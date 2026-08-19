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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

type AdminContext = {
  user: { id: string; email?: string | null; last_sign_in_at?: string | null; created_at?: string };
  role: string;
  metadata: Record<string, unknown>;
};

async function currentAdmin(req: Request): Promise<AdminContext | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;

  const { data: userData, error: userError } = await db.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return null;

  const { data: admin, error } = await db
    .from("admin_users")
    .select("user_id, role, active, metadata")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (error || !admin) return null;
  return {
    user,
    role: admin.role,
    metadata: admin.metadata || {},
  };
}

function hasRole(role: string, allowed: string[]) {
  return allowed.includes(role);
}

function text(value: unknown, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

function nullableText(value: unknown, max = 5000) {
  const v = text(value, max);
  return v || null;
}

function normalizeDocument(value: unknown) {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 32) || null;
}

function normalizePhone(value: unknown) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 24) || null;
}

function validUrl(value: unknown) {
  const v = text(value, 1000);
  if (!v) return null;
  try {
    const u = new URL(v);
    if (!['http:', 'https:'].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId?: string | null,
  organizationId?: string | null,
  metadata: Record<string, unknown> = {},
  beforeData?: unknown,
  afterData?: unknown,
) {
  try {
    await db.from("audit_logs").insert({
      actor_user_id: actorId,
      actor_type: "admin",
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      organization_id: organizationId ?? null,
      metadata,
      before_data: beforeData ?? null,
      after_data: afterData ?? null,
    });
  } catch (error) {
    console.error("audit_failed", error);
  }
}

async function profileUpdate(admin: AdminContext, payload: any) {
  const name = text(payload?.name, 120);
  if (name.length < 2) throw new Error("invalid_name");

  const { data: row, error: fetchError } = await db
    .from("admin_users")
    .select("metadata")
    .eq("user_id", admin.user.id)
    .maybeSingle();
  if (fetchError || !row) throw new Error("admin_not_found");

  const metadata = { ...(row.metadata || {}), name };
  const { error } = await db
    .from("admin_users")
    .update({ metadata })
    .eq("user_id", admin.user.id);
  if (error) throw error;

  const { error: userError } = await db.auth.admin.updateUserById(admin.user.id, {
    user_metadata: { full_name: name },
  });
  if (userError) throw userError;

  await audit(admin.user.id, "profile.updated", "admin_user", admin.user.id, null, { name });
  return { name };
}

async function auditList(payload: any) {
  const limit = Math.max(1, Math.min(200, Number(payload?.limit ?? 100)));
  const q = text(payload?.q, 100).replace(/[,%()]/g, " ");
  const action = text(payload?.action, 100);
  const organizationId = text(payload?.organization_id, 80);

  let query = db
    .from("audit_logs")
    .select("id, actor_user_id, actor_type, action, entity_type, entity_id, organization_id, metadata, before_data, after_data, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) query = query.eq("action", action);
  if (organizationId) query = query.eq("organization_id", organizationId);
  if (q) query = query.or(`action.ilike.%${q}%,entity_type.ilike.%${q}%`);

  const { data: logs, error } = await query;
  if (error) throw error;

  const actorIds = [...new Set((logs || []).map((x: any) => x.actor_user_id).filter(Boolean))];
  const orgIds = [...new Set((logs || []).map((x: any) => x.organization_id).filter(Boolean))];

  const [adminsRes, orgsRes] = await Promise.all([
    actorIds.length
      ? db.from("admin_users").select("user_id, metadata").in("user_id", actorIds)
      : Promise.resolve({ data: [] as any[], error: null }),
    orgIds.length
      ? db.from("organizations").select("id, legal_name, trade_name").in("id", orgIds)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  const adminMeta = new Map((adminsRes.data || []).map((a: any) => [a.user_id, a.metadata || {}]));
  const orgMap = new Map((orgsRes.data || []).map((o: any) => [o.id, o]));

  let authUsers = new Map<string, any>();
  if (actorIds.length) {
    const { data: usersData } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    authUsers = new Map((usersData?.users || []).map((u: any) => [u.id, u]));
  }

  return (logs || []).map((log: any) => {
    const user = authUsers.get(log.actor_user_id);
    const meta: any = adminMeta.get(log.actor_user_id) || {};
    const org: any = orgMap.get(log.organization_id);
    return {
      ...log,
      actor_email: user?.email || meta?.email || null,
      actor_name: meta?.name || user?.user_metadata?.full_name || null,
      organization_name: org ? (org.trade_name || org.legal_name) : null,
    };
  });
}

async function systemGet() {
  const { data: product, error: productError } = await db
    .from("products")
    .select("id, code, name, status")
    .eq("code", "whats_sender_pro")
    .maybeSingle();
  if (productError || !product) throw new Error("product_not_found");

  const { data: settings, error } = await db
    .from("product_runtime_settings")
    .select("product_id, minimum_supported_version, latest_version, maintenance_mode, maintenance_message, support_url, update_url, metadata, updated_at")
    .eq("product_id", product.id)
    .maybeSingle();
  if (error) throw error;

  return {
    product,
    settings: settings || {
      product_id: product.id,
      minimum_supported_version: null,
      latest_version: null,
      maintenance_mode: false,
      maintenance_message: null,
      support_url: null,
      update_url: null,
      metadata: {},
      updated_at: null,
    },
  };
}

async function systemUpdate(admin: AdminContext, payload: any) {
  const current = await systemGet();
  const productId = current.product.id;
  const before = current.settings;

  const supportUrlRaw = nullableText(payload?.support_url, 1000);
  const updateUrlRaw = nullableText(payload?.update_url, 1000);
  const supportUrl = supportUrlRaw ? validUrl(supportUrlRaw) : null;
  const updateUrl = updateUrlRaw ? validUrl(updateUrlRaw) : null;
  if (supportUrlRaw && !supportUrl) throw new Error("invalid_support_url");
  if (updateUrlRaw && !updateUrl) throw new Error("invalid_update_url");

  const metadata = {
    ...(before?.metadata || {}),
    release_notes: nullableText(payload?.release_notes, 10000),
  };

  const next = {
    product_id: productId,
    minimum_supported_version: nullableText(payload?.minimum_supported_version, 50),
    latest_version: nullableText(payload?.latest_version, 50),
    maintenance_mode: Boolean(payload?.maintenance_mode),
    maintenance_message: nullableText(payload?.maintenance_message, 2000),
    support_url: supportUrl,
    update_url: updateUrl,
    metadata,
  };

  const { data, error } = await db
    .from("product_runtime_settings")
    .upsert(next, { onConflict: "product_id" })
    .select("*")
    .single();
  if (error) throw error;

  await audit(admin.user.id, "system.runtime_updated", "product", productId, null, {}, before, data);
  return data;
}

async function companyUpdate(admin: AdminContext, payload: any) {
  const organizationId = text(payload?.organization_id, 80);
  if (!organizationId) throw new Error("missing_organization_id");

  const { data: before, error: beforeError } = await db
    .from("organizations")
    .select("id, legal_name, trade_name, document_number, email, billing_email, phone, notes, metadata")
    .eq("id", organizationId)
    .maybeSingle();
  if (beforeError || !before) throw new Error("organization_not_found");

  const legalName = text(payload?.legal_name, 250);
  if (legalName.length < 2) throw new Error("invalid_legal_name");

  const update = {
    legal_name: legalName,
    trade_name: nullableText(payload?.trade_name, 250),
    document_number: normalizeDocument(payload?.document_number),
    email: nullableText(payload?.email, 320),
    billing_email: nullableText(payload?.billing_email, 320),
    phone: normalizePhone(payload?.phone),
    notes: nullableText(payload?.notes, 10000),
  };

  const { data: after, error } = await db
    .from("organizations")
    .update(update)
    .eq("id", organizationId)
    .select("id, legal_name, trade_name, document_number, email, billing_email, phone, notes, metadata")
    .single();
  if (error) throw error;

  await audit(admin.user.id, "company.updated", "organization", organizationId, organizationId, {}, before, after);
  return after;
}

async function paymentAdd(admin: AdminContext, payload: any) {
  const organizationId = text(payload?.organization_id, 80);
  if (!organizationId) throw new Error("missing_organization_id");

  const amountCents = Math.max(0, Math.round(Number(payload?.amount_cents ?? 0)));
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error("invalid_amount");

  const status = text(payload?.status, 30) || "paid";
  const method = text(payload?.method, 30) || "pix";
  const validStatuses = ["pending", "paid", "failed", "refunded", "canceled", "chargeback"];
  const validMethods = ["pix", "card", "boleto", "transfer", "cash", "other"];
  if (!validStatuses.includes(status)) throw new Error("invalid_payment_status");
  if (!validMethods.includes(method)) throw new Error("invalid_payment_method");

  const { data: sub } = await db
    .from("subscriptions")
    .select("id")
    .eq("organization_id", organizationId)
    .is("ended_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const paidAt = status === "paid" ? new Date().toISOString() : null;
  const dueAt = payload?.due_at ? new Date(String(payload.due_at)).toISOString() : null;

  const { data, error } = await db
    .from("payments")
    .insert({
      organization_id: organizationId,
      subscription_id: sub?.id || null,
      provider: "manual",
      status,
      method,
      amount_cents: amountCents,
      currency: "BRL",
      due_at: dueAt,
      paid_at: paidAt,
      notes: nullableText(payload?.notes, 3000),
      metadata: { source: "admin_console" },
    })
    .select("id, provider, status, method, amount_cents, currency, due_at, paid_at, notes, created_at")
    .single();
  if (error) throw error;

  await audit(admin.user.id, "payment.added", "payment", data.id, organizationId, {
    amount_cents: amountCents,
    status,
    method,
  });
  return data;
}

async function deviceRename(admin: AdminContext, payload: any) {
  const deviceId = text(payload?.device_id, 80);
  const organizationId = text(payload?.organization_id, 80);
  const nickname = nullableText(payload?.nickname, 120);
  if (!deviceId) throw new Error("missing_device_id");

  const { data: before, error: beforeError } = await db
    .from("devices")
    .select("id, organization_id, nickname, hostname")
    .eq("id", deviceId)
    .maybeSingle();
  if (beforeError || !before) throw new Error("device_not_found");
  if (organizationId && before.organization_id !== organizationId) throw new Error("device_organization_mismatch");

  const { data: after, error } = await db
    .from("devices")
    .update({ nickname })
    .eq("id", deviceId)
    .select("id, organization_id, nickname, hostname")
    .single();
  if (error) throw error;

  await audit(admin.user.id, "device.renamed", "device", deviceId, before.organization_id, { nickname }, before, after);
  return after;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const admin = await currentAdmin(req);
  if (!admin) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = text(body?.action, 100);
  const payload = body?.payload ?? {};

  try {
    let data: unknown;

    switch (action) {
      case "me":
        data = {
          user_id: admin.user.id,
          email: admin.user.email || "",
          role: admin.role,
          active: true,
          name: (admin.metadata?.name as string) || "",
          last_sign_in_at: admin.user.last_sign_in_at || null,
          created_at: admin.user.created_at || null,
        };
        break;

      case "profile.update":
        data = await profileUpdate(admin, payload);
        break;

      case "audit.list":
        if (!hasRole(admin.role, ["owner", "admin"])) return json({ error: "forbidden" }, 403);
        data = await auditList(payload);
        break;

      case "system.get":
        data = await systemGet();
        break;

      case "system.update":
        if (admin.role !== "owner") return json({ error: "owner_required" }, 403);
        data = await systemUpdate(admin, payload);
        break;

      case "companies.update":
        if (!hasRole(admin.role, ["owner", "admin", "finance"])) return json({ error: "forbidden" }, 403);
        data = await companyUpdate(admin, payload);
        break;

      case "payments.add":
        if (!hasRole(admin.role, ["owner", "admin", "finance"])) return json({ error: "forbidden" }, 403);
        data = await paymentAdd(admin, payload);
        break;

      case "devices.rename":
        if (!hasRole(admin.role, ["owner", "admin", "support"])) return json({ error: "forbidden" }, 403);
        data = await deviceRename(admin, payload);
        break;

      default:
        return json({ error: "unknown_action" }, 400);
    }

    return json({ ok: true, data });
  } catch (error) {
    console.error("admin-console", action, error);
    const message = error instanceof Error ? error.message : "internal_error";
    return json({ ok: false, error: message }, 400);
  }
});
