import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

function text(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isoOrNull(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = new Date(String(value));
  if (!Number.isFinite(parsed.getTime())) throw new Error("invalid_date");
  return parsed.toISOString();
}

function integerOrNull(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error("invalid_integer");
  return n;
}

type AdminContext = { user: { id: string; email?: string | null }; role: string };

async function currentAdmin(req: Request): Promise<AdminContext | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const { data: userData, error: userError } = await db.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return null;
  const { data: admin, error } = await db.from("admin_users").select("user_id, role, active").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (error || !admin) return null;
  return { user, role: admin.role };
}

function canFinance(role: string) { return ["owner", "admin", "finance"].includes(role) }
function canLicense(role: string) { return ["owner", "admin"].includes(role) }

async function audit(actorId: string, action: string, entityType: string, entityId: string | null, organizationId: string | null, beforeData: unknown, afterData: unknown, metadata: Record<string, unknown> = {}) {
  try {
    await db.from("audit_logs").insert({ actor_user_id: actorId, actor_type: "admin", action, entity_type: entityType, entity_id: entityId, organization_id: organizationId, before_data: beforeData, after_data: afterData, metadata });
  } catch (error) { console.error("audit_failed", error) }
}

async function organizationExists(organizationId: string) {
  const { data, error } = await db.from("organizations").select("id").eq("id", organizationId).maybeSingle();
  if (error || !data) throw new Error("organization_not_found");
}

async function currentSubscription(organizationId: string) {
  const { data, error } = await db.from("subscriptions").select("id, organization_id, plan_id, status, source, current_period_start, current_period_end, grace_until, trial_ends_at, billing_day, cancel_at_period_end, canceled_at, ended_at, amount_cents, currency, entitlements_override, metadata, created_at, updated_at").eq("organization_id", organizationId).is("ended_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function currentLicense(organizationId: string) {
  const { data, error } = await db.from("licenses").select("id, organization_id, product_id, subscription_id, status, max_devices_override, expires_at, issued_at, revoked_at, revoke_reason, key_prefix, updated_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}

async function overview(organizationId: string) {
  if (!isUuid(organizationId)) throw new Error("invalid_organization_id");
  await organizationExists(organizationId);
  const [subscription, license] = await Promise.all([currentSubscription(organizationId), currentLicense(organizationId)]);
  let productId = license?.product_id || null;
  if (!productId) {
    const { data: product } = await db.from("products").select("id").eq("code", "whats_sender_pro").maybeSingle();
    productId = product?.id || null;
  }
  let plans: any[] = [];
  if (productId) {
    const { data, error } = await db.from("plans").select("id, code, name, status, billing_interval, billing_interval_count, base_price_cents, currency, max_devices, validation_interval_minutes").eq("product_id", productId).order("name");
    if (error) throw error;
    plans = data || [];
  }
  return { subscription, license, plans };
}

async function subscriptionUpdate(admin: AdminContext, payload: any) {
  if (!canFinance(admin.role)) throw new Error("finance_required");
  const organizationId = text(payload?.organization_id, 80);
  if (!isUuid(organizationId)) throw new Error("invalid_organization_id");
  const subscription = await currentSubscription(organizationId);
  if (!subscription) throw new Error("subscription_not_found");
  const validStatuses = ["active", "trialing", "past_due", "suspended", "canceled", "expired"];
  const status = text(payload?.status, 30);
  if (!validStatuses.includes(status)) throw new Error("invalid_subscription_status");
  const planId = text(payload?.plan_id, 80);
  if (!isUuid(planId)) throw new Error("invalid_plan_id");
  const license = await currentLicense(organizationId);
  const { data: plan, error: planError } = await db.from("plans").select("id, product_id, status, base_price_cents").eq("id", planId).maybeSingle();
  if (planError || !plan || plan.status !== "active") throw new Error("plan_unavailable");
  if (license?.product_id && plan.product_id !== license.product_id) throw new Error("plan_product_mismatch");
  const amountCents = Math.round(Number(payload?.amount_cents ?? 0));
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > 1000000000) throw new Error("invalid_amount");
  const currentPeriodStart = isoOrNull(payload?.current_period_start);
  if (!currentPeriodStart) throw new Error("current_period_start_required");
  const currentPeriodEnd = isoOrNull(payload?.current_period_end);
  const graceUntil = isoOrNull(payload?.grace_until);
  const trialEndsAt = isoOrNull(payload?.trial_ends_at);
  const billingDay = integerOrNull(payload?.billing_day, 1, 31);
  if (currentPeriodEnd && new Date(currentPeriodEnd) < new Date(currentPeriodStart)) throw new Error("period_end_before_start");
  if (graceUntil && currentPeriodEnd && new Date(graceUntil) < new Date(currentPeriodEnd)) throw new Error("grace_before_period_end");
  const now = new Date().toISOString();
  const next = { plan_id: planId, status, current_period_start: currentPeriodStart, current_period_end: currentPeriodEnd, grace_until: graceUntil, trial_ends_at: trialEndsAt, billing_day: billingDay, cancel_at_period_end: Boolean(payload?.cancel_at_period_end), amount_cents: amountCents, currency: "BRL", canceled_at: status === "canceled" ? (subscription.canceled_at || now) : null, updated_at: now };
  const { data: after, error } = await db.from("subscriptions").update(next).eq("id", subscription.id).select("id, organization_id, plan_id, status, current_period_start, current_period_end, grace_until, trial_ends_at, billing_day, cancel_at_period_end, canceled_at, ended_at, amount_cents, currency, updated_at").single();
  if (error) throw error;
  await audit(admin.user.id, "subscription.updated", "subscription", subscription.id, organizationId, subscription, after, { plan_changed: subscription.plan_id !== after.plan_id, status_changed: subscription.status !== after.status });
  return after;
}

async function licenseUpdate(admin: AdminContext, payload: any) {
  if (!canLicense(admin.role)) throw new Error("admin_required");
  const organizationId = text(payload?.organization_id, 80);
  if (!isUuid(organizationId)) throw new Error("invalid_organization_id");
  const license = await currentLicense(organizationId);
  if (!license) throw new Error("license_not_found");
  const maxDevicesOverride = integerOrNull(payload?.max_devices_override, 1, 1000);
  const expiresAt = isoOrNull(payload?.expires_at);
  const next = { max_devices_override: maxDevicesOverride, expires_at: expiresAt, updated_at: new Date().toISOString() };
  const { data: after, error } = await db.from("licenses").update(next).eq("id", license.id).select("id, organization_id, status, max_devices_override, expires_at, key_prefix, updated_at").single();
  if (error) throw error;
  await audit(admin.user.id, "license.settings_updated", "license", license.id, organizationId, license, after);
  return after;
}

async function paymentUpdate(admin: AdminContext, payload: any) {
  if (!canFinance(admin.role)) throw new Error("finance_required");
  const organizationId = text(payload?.organization_id, 80);
  const paymentId = text(payload?.payment_id, 80);
  if (!isUuid(organizationId) || !isUuid(paymentId)) throw new Error("invalid_payment");
  const { data: before, error: beforeError } = await db.from("payments").select("id, organization_id, subscription_id, provider, status, method, amount_cents, currency, due_at, paid_at, notes, metadata, created_at").eq("id", paymentId).eq("organization_id", organizationId).maybeSingle();
  if (beforeError || !before) throw new Error("payment_not_found");
  const statuses = ["pending", "paid", "failed", "refunded", "canceled", "chargeback"];
  const methods = ["pix", "card", "boleto", "transfer", "cash", "other"];
  const status = text(payload?.status, 30);
  const method = text(payload?.method, 30);
  if (!statuses.includes(status)) throw new Error("invalid_payment_status");
  if (!methods.includes(method)) throw new Error("invalid_payment_method");
  const amountCents = Math.round(Number(payload?.amount_cents ?? 0));
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > 1000000000) throw new Error("invalid_amount");
  const dueAt = isoOrNull(payload?.due_at);
  let paidAt = isoOrNull(payload?.paid_at);
  if (status === "paid" && !paidAt) paidAt = new Date().toISOString();
  if (status !== "paid" && payload?.paid_at === "") paidAt = null;
  const next = { status, method, amount_cents: amountCents, due_at: dueAt, paid_at: paidAt, notes: text(payload?.notes, 3000) || null };
  const { data: after, error } = await db.from("payments").update(next).eq("id", paymentId).eq("organization_id", organizationId).select("id, organization_id, status, method, amount_cents, currency, due_at, paid_at, notes, created_at").single();
  if (error) throw error;
  await audit(admin.user.id, "payment.updated", "payment", paymentId, organizationId, before, after);
  return after;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const admin = await currentAdmin(req);
  if (!admin) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const action = text(body?.action, 100);
  const payload = body?.payload || {};
  try {
    let data: unknown;
    switch (action) {
      case "overview": {
        const organizationId = text(payload?.organization_id, 80);
        if (!canFinance(admin.role) && !canLicense(admin.role)) return json({ error: "forbidden" }, 403);
        data = await overview(organizationId);
        break;
      }
      case "subscription.update": data = await subscriptionUpdate(admin, payload); break;
      case "license.update": data = await licenseUpdate(admin, payload); break;
      case "payment.update": data = await paymentUpdate(admin, payload); break;
      default: return json({ error: "unknown_action" }, 400);
    }
    return json({ ok: true, data });
  } catch (error) {
    console.error("company-billing-console", action, error);
    const message = error instanceof Error ? error.message : "internal_error";
    const forbidden = ["finance_required", "admin_required", "forbidden"].includes(message);
    return json({ ok: false, error: message }, forbidden ? 403 : 400);
  }
});
