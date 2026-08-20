import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "whats-sender-releases";
const PRODUCT_CODE = "whats_sender_pro";

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function txt(v: unknown, max = 5000) { return String(v ?? "").trim().slice(0, max); }
function isUuid(v: unknown) { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
function isSha(v: unknown) { return typeof v === "string" && /^[a-f0-9]{64}$/i.test(v); }
function isVersion(v: unknown) { return typeof v === "string" && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(v); }
function safePath(v: unknown) {
  const p = txt(v, 1000).replace(/\\/g, "/").replace(/^\/+/, "");
  if (!p || p.includes("../") || p === ".." || p.includes("\u0000")) return null;
  return p;
}
function compareVersions(a: string, b: string) {
  const aa = a.split(/[+-]/)[0].split(".").map(Number);
  const bb = b.split(/[+-]/)[0].split(".").map(Number);
  for (let i=0;i<3;i++) { const x=aa[i]||0, y=bb[i]||0; if (x!==y) return x>y?1:-1; }
  return 0;
}

async function currentAdmin(req: Request) {
  const h = req.headers.get("Authorization") || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  const { data: ud, error: ue } = await db.auth.getUser(token);
  if (ue || !ud.user) return null;
  const { data: a } = await db.from("admin_users").select("user_id,role,active").eq("user_id", ud.user.id).eq("active", true).maybeSingle();
  if (!a) return null;
  return { user: ud.user, role: a.role as string };
}

async function product() {
  const { data, error } = await db.from("products").select("id,code,name,status").eq("code", PRODUCT_CODE).maybeSingle();
  if (error || !data) throw new Error("product_not_found");
  return data;
}

async function audit(actor: string, action: string, entityId?: string | null, metadata: Record<string, unknown> = {}) {
  try { await db.from("audit_logs").insert({ actor_user_id: actor, actor_type: "admin", action, entity_type: "app_release", entity_id: entityId ?? null, metadata }); } catch {}
}

async function getRelease(id: string) {
  const { data, error } = await db.from("app_releases").select("*").eq("id", id).maybeSingle();
  if (error || !data) throw new Error("release_not_found");
  return data;
}

async function objectExists(storagePath: string) {
  const parts = storagePath.split("/");
  const name = parts.pop()!;
  const folder = parts.join("/");
  const { data, error } = await db.storage.from(BUCKET).list(folder, { limit: 20, search: name });
  if (error) throw error;
  return Boolean((data || []).find((x) => x.name === name));
}

async function listReleases() {
  const p = await product();
  const { data, error } = await db.from("app_releases")
    .select("id,version,channel,status,mandatory,release_notes,manifest_path,total_size_bytes,file_count,published_at,created_at,updated_at")
    .eq("product_id", p.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function releaseGet(id: string) {
  const r = await getRelease(id);
  const [{ data: files, error: fe }, { data: rollouts, error: re }] = await Promise.all([
    db.from("app_release_files").select("id,relative_path,sha256,size_bytes,storage_path,content_type,created_at").eq("release_id", id).order("relative_path"),
    db.from("app_update_rollouts").select("id,audience,organization_id,percentage,active,created_at").eq("release_id", id).order("created_at"),
  ]);
  if (fe) throw fe; if (re) throw re;
  return { release: r, files: files || [], rollouts: rollouts || [] };
}

async function releaseCreate(admin: any, pld: any) {
  const p = await product();
  const version = txt(pld.version, 80);
  const channel = txt(pld.channel, 20) || "production";
  if (!isVersion(version)) throw new Error("invalid_version");
  if (!["test","production"].includes(channel)) throw new Error("invalid_channel");
  const { data, error } = await db.from("app_releases").insert({
    product_id: p.id, version, channel, status: "draft", mandatory: Boolean(pld.mandatory),
    release_notes: txt(pld.release_notes, 20000) || null, created_by: admin.user.id,
  }).select("*").single();
  if (error) {
    if ((error.message || "").toLowerCase().includes("duplicate")) throw new Error("release_already_exists");
    throw error;
  }
  await audit(admin.user.id, "release.created", data.id, { version, channel });
  return data;
}

async function uploadAuthorize(releaseId: string, sha256: string, contentType: string | null) {
  const r = await getRelease(releaseId);
  if (!["draft","ready"].includes(r.status)) throw new Error("release_not_editable");
  if (!isSha(sha256)) throw new Error("invalid_sha256");
  const hash = sha256.toLowerCase();
  const storagePath = `objects/${hash.slice(0,2)}/${hash}`;
  if (await objectExists(storagePath)) return { exists: true, storage_path: storagePath };
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(storagePath, { upsert: false });
  if (error || !data) throw error || new Error("signed_upload_failed");
  return { exists: false, storage_path: storagePath, token: data.token, signed_url: data.signedUrl, content_type: contentType || "application/octet-stream" };
}

async function fileRegister(admin: any, pld: any) {
  const releaseId = txt(pld.release_id, 80); if (!isUuid(releaseId)) throw new Error("invalid_release_id");
  const r = await getRelease(releaseId); if (!["draft","ready"].includes(r.status)) throw new Error("release_not_editable");
  const relativePath = safePath(pld.relative_path); if (!relativePath) throw new Error("invalid_relative_path");
  const sha256 = txt(pld.sha256, 64).toLowerCase(); if (!isSha(sha256)) throw new Error("invalid_sha256");
  const sizeBytes = Number(pld.size_bytes); if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) throw new Error("invalid_size");
  const storagePath = `objects/${sha256.slice(0,2)}/${sha256}`;
  if (!(await objectExists(storagePath))) throw new Error("object_not_uploaded");
  const { data, error } = await db.from("app_release_files").upsert({
    release_id: releaseId, relative_path: relativePath, sha256, size_bytes: sizeBytes,
    storage_path: storagePath, content_type: txt(pld.content_type, 200) || "application/octet-stream",
  }, { onConflict: "release_id,relative_path" }).select("*").single();
  if (error) throw error;
  return data;
}

async function releaseFinalize(admin: any, releaseId: string) {
  const r = await getRelease(releaseId); if (!["draft","ready"].includes(r.status)) throw new Error("release_not_editable");
  const { data: files, error } = await db.from("app_release_files").select("relative_path,sha256,size_bytes,storage_path,content_type").eq("release_id", releaseId).order("relative_path");
  if (error) throw error; if (!files?.length) throw new Error("release_has_no_files");
  const totalSize = files.reduce((s: number, f: any) => s + Number(f.size_bytes || 0), 0);
  const manifest = {
    schema: 1,
    release_id: r.id,
    version: r.version,
    channel: r.channel,
    mandatory: r.mandatory,
    release_notes: r.release_notes,
    created_at: new Date().toISOString(),
    files: files.map((f: any) => ({ path: f.relative_path, sha256: f.sha256, size: Number(f.size_bytes), storage_path: f.storage_path, content_type: f.content_type || "application/octet-stream" })),
  };
  const manifestPath = `manifests/${releaseId}.json`;
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
  const { error: upErr } = await db.storage.from(BUCKET).upload(manifestPath, blob, { upsert: true, contentType: "application/json", cacheControl: "0" });
  if (upErr) throw upErr;
  const { data: updated, error: updErr } = await db.from("app_releases").update({ status: "ready", manifest_path: manifestPath, total_size_bytes: totalSize, file_count: files.length, updated_at: new Date().toISOString() }).eq("id", releaseId).select("*").single();
  if (updErr) throw updErr;
  await audit(admin.user.id, "release.finalized", releaseId, { version: r.version, file_count: files.length, total_size_bytes: totalSize });
  return updated;
}

async function releasePublish(admin: any, pld: any) {
  const releaseId = txt(pld.release_id, 80); if (!isUuid(releaseId)) throw new Error("invalid_release_id");
  const r = await getRelease(releaseId); if (r.status !== "ready") throw new Error("release_not_ready");
  const audience = txt(pld.audience, 30) || (r.channel === "test" ? "testers" : "all");
  const organizationId = pld.organization_id ? txt(pld.organization_id, 80) : null;
  const percentage = pld.percentage == null ? null : Number(pld.percentage);
  if (!["all","testers","organization","percentage"].includes(audience)) throw new Error("invalid_audience");
  if (audience === "organization" && !isUuid(organizationId)) throw new Error("invalid_organization_id");
  if (audience === "percentage" && (!Number.isInteger(percentage) || percentage < 1 || percentage > 100)) throw new Error("invalid_percentage");

  await db.from("app_update_rollouts").update({ active: false }).eq("release_id", releaseId).eq("active", true);
  const rollout: any = { release_id: releaseId, audience, active: true, created_by: admin.user.id };
  if (audience === "organization") rollout.organization_id = organizationId;
  if (audience === "percentage") rollout.percentage = percentage;
  const { error: roErr } = await db.from("app_update_rollouts").insert(rollout); if (roErr) throw roErr;
  const now = new Date().toISOString();
  const { data: updated, error } = await db.from("app_releases").update({ status: "published", published_by: admin.user.id, published_at: now, updated_at: now }).eq("id", releaseId).select("*").single();
  if (error) throw error;

  if (r.channel === "production") {
    const { data: runtime } = await db.from("product_runtime_settings").select("latest_version").eq("product_id", r.product_id).maybeSingle();
    const current = runtime?.latest_version || "0.0.0";
    if (compareVersions(r.version, current) >= 0) {
      await db.from("product_runtime_settings").upsert({ product_id: r.product_id, latest_version: r.version }, { onConflict: "product_id" });
    }
  }
  await audit(admin.user.id, "release.published", releaseId, { version: r.version, channel: r.channel, audience, percentage, organization_id: organizationId });
  return updated;
}

async function releaseWithdraw(admin: any, releaseId: string) {
  const r = await getRelease(releaseId);
  await db.from("app_update_rollouts").update({ active: false }).eq("release_id", releaseId).eq("active", true);
  const { data: updated, error } = await db.from("app_releases").update({ status: "withdrawn", updated_at: new Date().toISOString() }).eq("id", releaseId).select("*").single();
  if (error) throw error;
  if (r.channel === "production") {
    const { data: rows } = await db.from("app_releases").select("version").eq("product_id", r.product_id).eq("channel","production").eq("status","published");
    const newest = (rows || []).map((x:any)=>x.version).sort((a:string,b:string)=>compareVersions(b,a))[0] || null;
    await db.from("product_runtime_settings").upsert({ product_id: r.product_id, latest_version: newest }, { onConflict: "product_id" });
  }
  await audit(admin.user.id, "release.withdrawn", releaseId, { version: r.version });
  return updated;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = await currentAdmin(req);
  if (!admin) return json({ error: "forbidden" }, 403);
  if (admin.role !== "owner") return json({ error: "owner_required" }, 403);
  const body = await req.json().catch(() => ({}));
  const action = txt(body?.action, 100);
  const pld = body?.payload || {};
  try {
    let data: unknown;
    switch (action) {
      case "list": data = await listReleases(); break;
      case "get": data = await releaseGet(txt(pld.release_id,80)); break;
      case "create": data = await releaseCreate(admin, pld); break;
      case "upload.authorize": data = await uploadAuthorize(txt(pld.release_id,80), txt(pld.sha256,64), txt(pld.content_type,200)||null); break;
      case "file.register": data = await fileRegister(admin, pld); break;
      case "finalize": data = await releaseFinalize(admin, txt(pld.release_id,80)); break;
      case "publish": data = await releasePublish(admin, pld); break;
      case "withdraw": data = await releaseWithdraw(admin, txt(pld.release_id,80)); break;
      default: return json({ error: "unknown_action" }, 400);
    }
    return json({ ok: true, data });
  } catch (e) {
    console.error("release-admin", action, e);
    const msg = e instanceof Error ? e.message : "internal_error";
    return json({ ok: false, error: msg }, 400);
  }
});
