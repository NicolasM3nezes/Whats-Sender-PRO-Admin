import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function txt(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function compareVersions(a: string, b: string) {
  const aa = a.split(/[+-]/)[0].split(".").slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  const bb = b.split(/[+-]/)[0].split(".").slice(0, 3).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    const x = aa[i] || 0;
    const y = bb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

async function currentOwner(req: Request) {
  const header = req.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;

  const { data: userData, error: userError } = await db.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return null;

  const { data: admin, error } = await db
    .from("admin_users")
    .select("user_id,role,active")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (error || !admin || admin.role !== "owner") return null;
  return { user, role: admin.role as string };
}

async function product() {
  const { data, error } = await db
    .from("products")
    .select("id,code,name,status")
    .eq("code", PRODUCT_CODE)
    .maybeSingle();
  if (error || !data) throw new Error("product_not_found");
  return data;
}

async function audit(actorId: string, action: string, releaseId?: string | null, metadata: Record<string, unknown> = {}) {
  try {
    await db.from("audit_logs").insert({
      actor_user_id: actorId,
      actor_type: "admin",
      action,
      entity_type: "app_release",
      entity_id: releaseId ?? null,
      metadata,
    });
  } catch (error) {
    console.error("release-console audit_failed", error);
  }
}

async function getRelease(releaseId: string) {
  if (!isUuid(releaseId)) throw new Error("invalid_release_id");
  const { data, error } = await db.from("app_releases").select("*").eq("id", releaseId).maybeSingle();
  if (error || !data) throw new Error("release_not_found");
  return data;
}

async function validateRollout(payload: any) {
  const audience = txt(payload?.audience, 30) || "testers";
  const organizationId = payload?.organization_id ? txt(payload.organization_id, 80) : null;
  const percentage = payload?.percentage == null || payload?.percentage === "" ? null : Number(payload.percentage);

  if (!["all", "testers", "organization", "percentage"].includes(audience)) throw new Error("invalid_audience");

  if (audience === "organization") {
    if (!isUuid(organizationId)) throw new Error("invalid_organization_id");
    const { data: org, error } = await db.from("organizations").select("id,status").eq("id", organizationId).maybeSingle();
    if (error || !org) throw new Error("organization_not_found");
  }

  if (audience === "percentage" && (!Number.isInteger(percentage) || Number(percentage) < 1 || Number(percentage) > 100)) {
    throw new Error("invalid_percentage");
  }

  return { audience, organizationId, percentage };
}

async function replaceRollout(release: any, ownerId: string, payload: any) {
  const { audience, organizationId, percentage } = await validateRollout(payload);
  const { error: disableError } = await db.from("app_update_rollouts").update({ active: false }).eq("release_id", release.id).eq("active", true);
  if (disableError) throw disableError;

  const row: Record<string, unknown> = { release_id: release.id, audience, active: true, created_by: ownerId };
  if (audience === "organization") row.organization_id = organizationId;
  if (audience === "percentage") row.percentage = percentage;

  const { data, error } = await db.from("app_update_rollouts").insert(row).select("id,audience,organization_id,percentage,active,created_at").single();
  if (error) throw error;
  return data;
}

async function syncLatestVersion(productId: string) {
  const { data: rows, error } = await db.from("app_releases").select("version").eq("product_id", productId).eq("channel", "production").eq("status", "published");
  if (error) throw error;

  const newest = (rows || []).map((row: any) => row.version).sort((a: string, b: string) => compareVersions(b, a))[0] || null;
  const { error: runtimeError } = await db.from("product_runtime_settings").upsert({ product_id: productId, latest_version: newest }, { onConflict: "product_id" });
  if (runtimeError) throw runtimeError;
  return newest;
}

async function overview() {
  const p = await product();
  const [{ data: releases, error: releaseError }, { data: runtime, error: runtimeError }] = await Promise.all([
    db.from("app_releases").select("id,product_id,version,channel,status,mandatory,release_notes,total_size_bytes,file_count,published_at,created_at,updated_at").eq("product_id", p.id).order("created_at", { ascending: false }),
    db.from("product_runtime_settings").select("latest_version,minimum_supported_version,maintenance_mode,updated_at").eq("product_id", p.id).maybeSingle(),
  ]);
  if (releaseError) throw releaseError;
  if (runtimeError) throw runtimeError;

  const releaseRows = releases || [];
  const releaseIds = releaseRows.map((r: any) => r.id);
  const [rolloutRes, eventRes, deviceRes] = await Promise.all([
    releaseIds.length ? db.from("app_update_rollouts").select("release_id,audience,organization_id,percentage,active,created_at").in("release_id", releaseIds).eq("active", true) : Promise.resolve({ data: [], error: null }),
    releaseIds.length ? db.from("app_update_events").select("release_id,event_type,created_at").in("release_id", releaseIds).order("created_at", { ascending: false }).limit(10000) : Promise.resolve({ data: [], error: null }),
    db.from("devices").select("id,app_version,status,organization_id").eq("status", "active"),
  ]);
  if (rolloutRes.error) throw rolloutRes.error;
  if (eventRes.error) throw eventRes.error;
  if (deviceRes.error) throw deviceRes.error;

  const rollouts = rolloutRes.data || [];
  const organizationIds = [...new Set(rollouts.map((r: any) => r.organization_id).filter(Boolean))];
  let organizations: any[] = [];
  if (organizationIds.length) {
    const { data, error } = await db.from("organizations").select("id,legal_name,trade_name").in("id", organizationIds);
    if (error) throw error;
    organizations = data || [];
  }

  const orgMap = new Map(organizations.map((o: any) => [o.id, o]));
  const rolloutMap = new Map<string, any>();
  for (const rollout of rollouts) {
    const org: any = rollout.organization_id ? orgMap.get(rollout.organization_id) : null;
    rolloutMap.set(rollout.release_id, { ...rollout, organization_name: org ? (org.trade_name || org.legal_name) : null });
  }

  const statsMap = new Map<string, Record<string, number>>();
  for (const event of eventRes.data || []) {
    if (!event.release_id) continue;
    const stats = statsMap.get(event.release_id) || {};
    stats[event.event_type] = (stats[event.event_type] || 0) + 1;
    statsMap.set(event.release_id, stats);
  }

  const runningByVersion = new Map<string, number>();
  for (const device of deviceRes.data || []) {
    const version = txt(device.app_version, 80);
    if (!version) continue;
    runningByVersion.set(version, (runningByVersion.get(version) || 0) + 1);
  }

  const rows = releaseRows.map((release: any) => ({
    ...release,
    rollout: rolloutMap.get(release.id) || null,
    stats: {
      offered: statsMap.get(release.id)?.offered || 0,
      download_started: statsMap.get(release.id)?.download_started || 0,
      download_completed: statsMap.get(release.id)?.download_completed || 0,
      install_started: statsMap.get(release.id)?.install_started || 0,
      install_succeeded: statsMap.get(release.id)?.install_succeeded || 0,
      install_failed: statsMap.get(release.id)?.install_failed || 0,
      rollback_succeeded: statsMap.get(release.id)?.rollback_succeeded || 0,
      rollback_failed: statsMap.get(release.id)?.rollback_failed || 0,
      running: runningByVersion.get(release.version) || 0,
    },
  }));

  return {
    product: p,
    runtime: runtime || null,
    summary: {
      releases: rows.length,
      published: rows.filter((r: any) => r.status === "published").length,
      download_completed: rows.reduce((sum: number, r: any) => sum + Number(r.stats.download_completed || 0), 0),
      failures: rows.reduce((sum: number, r: any) => sum + Number(r.stats.install_failed || 0) + Number(r.stats.rollback_failed || 0), 0),
      running_latest: runtime?.latest_version ? (runningByVersion.get(runtime.latest_version) || 0) : 0,
    },
    releases: rows,
  };
}

async function publish(owner: any, payload: any) {
  const release = await getRelease(txt(payload?.release_id, 80));
  if (release.status !== "ready") throw new Error("release_not_ready");
  const rollout = await replaceRollout(release, owner.user.id, payload);
  const now = new Date().toISOString();
  const { data: updated, error } = await db.from("app_releases").update({ status: "published", published_by: owner.user.id, published_at: now, updated_at: now }).eq("id", release.id).select("*").single();
  if (error) throw error;
  if (release.channel === "production") await syncLatestVersion(release.product_id);
  await audit(owner.user.id, "release.published_from_console", release.id, { version: release.version, audience: rollout.audience, organization_id: rollout.organization_id || null, percentage: rollout.percentage || null });
  return { release: updated, rollout };
}

async function rolloutSet(owner: any, payload: any) {
  const release = await getRelease(txt(payload?.release_id, 80));
  if (release.status !== "published") throw new Error("release_not_published");
  const rollout = await replaceRollout(release, owner.user.id, payload);
  await audit(owner.user.id, "release.rollout_updated", release.id, { version: release.version, audience: rollout.audience, organization_id: rollout.organization_id || null, percentage: rollout.percentage || null });
  return rollout;
}

async function releaseUpdate(owner: any, payload: any) {
  const release = await getRelease(txt(payload?.release_id, 80));
  if (!["ready", "published"].includes(release.status)) throw new Error("release_not_editable");
  const { data, error } = await db.from("app_releases").update({ mandatory: Boolean(payload?.mandatory), release_notes: txt(payload?.release_notes, 20000) || null, updated_at: new Date().toISOString() }).eq("id", release.id).select("*").single();
  if (error) throw error;
  await audit(owner.user.id, "release.updated_from_console", release.id, { version: release.version, mandatory: data.mandatory });
  return data;
}

async function withdraw(owner: any, payload: any) {
  const release = await getRelease(txt(payload?.release_id, 80));
  if (!["ready", "published"].includes(release.status)) throw new Error("release_cannot_be_withdrawn");
  const { error: rolloutError } = await db.from("app_update_rollouts").update({ active: false }).eq("release_id", release.id).eq("active", true);
  if (rolloutError) throw rolloutError;
  const { data, error } = await db.from("app_releases").update({ status: "withdrawn", updated_at: new Date().toISOString() }).eq("id", release.id).select("*").single();
  if (error) throw error;
  if (release.channel === "production") await syncLatestVersion(release.product_id);
  await audit(owner.user.id, "release.withdrawn_from_console", release.id, { version: release.version });
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const owner = await currentOwner(req);
  if (!owner) return json({ error: "owner_required" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = txt(body?.action, 100);
  const payload = body?.payload || {};

  try {
    let data: unknown;
    switch (action) {
      case "overview": data = await overview(); break;
      case "publish": data = await publish(owner, payload); break;
      case "rollout.set": data = await rolloutSet(owner, payload); break;
      case "release.update": data = await releaseUpdate(owner, payload); break;
      case "withdraw": data = await withdraw(owner, payload); break;
      default: return json({ error: "unknown_action" }, 400);
    }
    return json({ ok: true, data });
  } catch (error) {
    console.error("release-console", action, error);
    const message = error instanceof Error ? error.message : "internal_error";
    return json({ ok: false, error: message }, 400);
  }
});
