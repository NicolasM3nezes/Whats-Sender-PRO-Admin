import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function txt(v: unknown, max = 500) { return String(v ?? "").trim().slice(0, max); }
function isUuid(v: unknown): v is string { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }
async function sha256Hex(v: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)); return [...new Uint8Array(d)].map((b)=>b.toString(16).padStart(2,"0")).join(""); }
function finiteInt(v: unknown, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback; }
function safeMetadata(v: unknown) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const allowed = ["source","reason","screen","startup_seconds","update_version","network","last_action"];
  const out: Record<string, unknown> = {};
  for (const k of allowed) if (k in (v as Record<string, unknown>)) out[k] = (v as Record<string, unknown>)[k];
  return out;
}

type DeviceCtx = { device: any; organization: any; product: any; subscription: any; license: any };
async function authorizeDevice(body: any): Promise<DeviceCtx> {
  const token = txt(body?.activation_token, 500);
  const installationId = body?.installation_id;
  const machineFingerprint = txt(body?.machine_fingerprint, 1000);
  if (token.length < 32 || !isUuid(installationId) || machineFingerprint.length < 16) throw new Error("invalid_payload");
  const [tokenHash, machineHash] = await Promise.all([sha256Hex(token), sha256Hex(machineFingerprint)]);
  const { data: device, error: de } = await db.from("devices").select("id,license_id,organization_id,installation_id,machine_fingerprint_hash,status").eq("device_token_hash", tokenHash).maybeSingle();
  if (de || !device) throw new Error("invalid_activation");
  if (device.status !== "active") throw new Error("device_revoked");
  if (device.installation_id !== installationId || device.machine_fingerprint_hash !== machineHash) throw new Error("device_mismatch");
  const { data: license } = await db.from("licenses").select("id,product_id,subscription_id,status,expires_at").eq("id", device.license_id).maybeSingle();
  if (!license || license.status !== "active") throw new Error("license_unavailable");
  if (license.expires_at && Date.now() > Date.parse(license.expires_at)) throw new Error("license_expired");
  const [orgRes, productRes, subRes] = await Promise.all([
    db.from("organizations").select("id,status").eq("id", device.organization_id).maybeSingle(),
    db.from("products").select("id,status,code").eq("id", license.product_id).maybeSingle(),
    license.subscription_id ? db.from("subscriptions").select("id,status,current_period_end,grace_until").eq("id", license.subscription_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const organization = orgRes.data; const product = productRes.data; const subscription = subRes.data;
  if (!organization || organization.status !== "active") throw new Error("organization_unavailable");
  if (!product || product.status !== "active") throw new Error("product_unavailable");
  if (!subscription || ["suspended","canceled","expired"].includes(subscription.status)) throw new Error("subscription_unavailable");
  const end = subscription.current_period_end ? Date.parse(subscription.current_period_end) : null;
  const grace = subscription.grace_until ? Date.parse(subscription.grace_until) : null;
  if (end && Date.now() > end && !(grace && Date.now() <= grace)) throw new Error("subscription_expired");
  return { device, organization, product, subscription, license };
}

async function heartbeat(ctx: DeviceCtx, body: any) {
  const row = {
    device_id: ctx.device.id,
    organization_id: ctx.organization.id,
    app_version: txt(body?.app_version, 80) || null,
    os_name: txt(body?.os_name, 120) || null,
    os_version: txt(body?.os_version, 120) || null,
    chrome_version: txt(body?.chrome_version, 120) || null,
    whatsapp_state: txt(body?.whatsapp_state, 40) || null,
    last_campaign_status: txt(body?.last_campaign_status, 40) || null,
    last_error_code: txt(body?.last_error_code, 200) || null,
    last_heartbeat_at: new Date().toISOString(),
    metadata: safeMetadata(body?.metadata),
  };
  const { error } = await db.from("device_diagnostics").upsert(row, { onConflict: "device_id" });
  if (error) throw error;
  await db.from("devices").update({ app_version: row.app_version, last_seen_at: row.last_heartbeat_at }).eq("id", ctx.device.id);
  return { ok: true };
}

async function campaign(ctx: DeviceCtx, body: any) {
  const campaignId = body?.campaign_id;
  if (!isUuid(campaignId)) throw new Error("invalid_campaign_id");
  const status = txt(body?.status, 30);
  if (!["created","running","stopped","completed","failed"].includes(status)) throw new Error("invalid_campaign_status");
  const row = {
    campaign_id: campaignId,
    organization_id: ctx.organization.id,
    device_id: ctx.device.id,
    app_version: txt(body?.app_version, 80) || null,
    campaign_name: txt(body?.campaign_name, 120) || null,
    status,
    total_count: finiteInt(body?.total_count),
    sent_count: finiteInt(body?.sent_count),
    failed_count: finiteInt(body?.failed_count),
    remaining_count: finiteInt(body?.remaining_count),
    speed_mode: txt(body?.speed_mode, 30) || null,
    media_mode: txt(body?.media_mode, 30) || null,
    test_mode: Boolean(body?.test_mode),
    started_at: body?.started_at ? new Date(String(body.started_at)).toISOString() : null,
    finished_at: body?.finished_at ? new Date(String(body.finished_at)).toISOString() : null,
    duration_seconds: body?.duration_seconds == null ? null : finiteInt(body.duration_seconds),
    metadata: safeMetadata(body?.metadata),
  };
  const { error } = await db.from("campaign_telemetry").upsert(row, { onConflict: "device_id,campaign_id" });
  if (error) throw error;
  await db.from("device_diagnostics").upsert({ device_id: ctx.device.id, organization_id: ctx.organization.id, app_version: row.app_version, last_campaign_status: status, last_heartbeat_at: new Date().toISOString(), metadata: {} }, { onConflict: "device_id" });
  return { ok: true };
}

async function event(ctx: DeviceCtx, body: any) {
  const severity = txt(body?.severity, 20) || "info";
  if (!["info","warning","error"].includes(severity)) throw new Error("invalid_severity");
  const eventType = txt(body?.event_type, 80); if (!eventType) throw new Error("invalid_event_type");
  const code = txt(body?.code, 200) || null;
  const { error } = await db.from("diagnostic_events").insert({ organization_id: ctx.organization.id, device_id: ctx.device.id, event_type: eventType, severity, code, app_version: txt(body?.app_version, 80) || null, metadata: safeMetadata(body?.metadata) });
  if (error) throw error;
  if (severity === "error") await db.from("device_diagnostics").upsert({ device_id: ctx.device.id, organization_id: ctx.organization.id, app_version: txt(body?.app_version,80)||null, last_error_code: code || eventType, last_heartbeat_at: new Date().toISOString(), metadata: {} }, { onConflict: "device_id" });
  return { ok: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = new URL(req.url); const path = url.pathname.replace(/\/+$/, "");
  if (req.method === "GET" && path.endsWith("/health")) return json({ ok: true, service: "desktop-telemetry", server_time: new Date().toISOString() });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  try {
    const ctx = await authorizeDevice(body);
    let data: unknown;
    if (path.endsWith("/heartbeat")) data = await heartbeat(ctx, body);
    else if (path.endsWith("/campaign")) data = await campaign(ctx, body);
    else if (path.endsWith("/event")) data = await event(ctx, body);
    else return json({ error: "not_found" }, 404);
    return json({ ok: true, data });
  } catch (e) {
    console.error("desktop-telemetry", path, e);
    const msg = e instanceof Error ? e.message : "internal_error";
    const forbidden = ["invalid_activation","device_revoked","device_mismatch","license_unavailable","license_expired","organization_unavailable","subscription_unavailable","subscription_expired"].includes(msg);
    return json({ ok: false, error: msg }, forbidden ? 403 : 400);
  }
});