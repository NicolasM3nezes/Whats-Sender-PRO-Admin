import { createClient } from "npm:@supabase/supabase-js@2.111.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
function txt(v: unknown, max = 500) { return String(v ?? "").trim().slice(0, max); }
function isUuid(v: unknown) { return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v); }

async function currentAdmin(req: Request) {
  const h = req.headers.get("Authorization") || ""; const token = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (!token) return null;
  const { data: ud, error: ue } = await db.auth.getUser(token); if (ue || !ud.user) return null;
  const { data: a } = await db.from("admin_users").select("user_id,role,active").eq("user_id", ud.user.id).eq("active", true).maybeSingle();
  if (!a || !["owner","admin","support"].includes(a.role)) return null;
  return { user: ud.user, role: a.role };
}

async function latestVersion() {
  const { data: product } = await db.from("products").select("id").eq("code","whats_sender_pro").maybeSingle();
  if (!product) return null;
  const { data: runtime } = await db.from("product_runtime_settings").select("latest_version,minimum_supported_version").eq("product_id",product.id).maybeSingle();
  return runtime || null;
}

async function overview() {
  const since24 = new Date(Date.now() - 24*60*60*1000).toISOString();
  const since7 = new Date(Date.now() - 7*24*60*60*1000).toISOString();
  const runtime = await latestVersion();
  const [{ data: diagnostics }, { data: campaigns }, { data: errors }, { data: orgs }, { data: devices }] = await Promise.all([
    db.from("device_diagnostics").select("device_id,organization_id,app_version,os_name,os_version,chrome_version,whatsapp_state,last_campaign_status,last_error_code,last_heartbeat_at,updated_at").order("last_heartbeat_at",{ascending:false}).limit(500),
    db.from("campaign_telemetry").select("id,campaign_id,organization_id,device_id,app_version,campaign_name,status,total_count,sent_count,failed_count,remaining_count,speed_mode,media_mode,test_mode,started_at,finished_at,duration_seconds,updated_at").gte("updated_at",since7).order("updated_at",{ascending:false}).limit(300),
    db.from("diagnostic_events").select("id,organization_id,device_id,event_type,severity,code,app_version,created_at").eq("severity","error").gte("created_at",since7).order("created_at",{ascending:false}).limit(200),
    db.from("organizations").select("id,legal_name,trade_name,status"),
    db.from("devices").select("id,organization_id,nickname,hostname,status,app_version,last_seen_at")
  ]);
  const orgMap = new Map((orgs||[]).map((o:any)=>[o.id,o]));
  const deviceMap = new Map((devices||[]).map((d:any)=>[d.id,d]));
  const rows = (diagnostics||[]).map((d:any)=>({ ...d, organization_name:(orgMap.get(d.organization_id) as any)?.trade_name || (orgMap.get(d.organization_id) as any)?.legal_name || "—", device_name:(deviceMap.get(d.device_id) as any)?.nickname || (deviceMap.get(d.device_id) as any)?.hostname || "Dispositivo", device_status:(deviceMap.get(d.device_id) as any)?.status || "—" }));
  const campaignRows = (campaigns||[]).map((c:any)=>({ ...c, organization_name:(orgMap.get(c.organization_id) as any)?.trade_name || (orgMap.get(c.organization_id) as any)?.legal_name || "—", device_name:(deviceMap.get(c.device_id) as any)?.nickname || (deviceMap.get(c.device_id) as any)?.hostname || "Dispositivo" }));
  const onlineCutoff = Date.now() - 15*60*1000;
  const online = rows.filter((r:any)=>Date.parse(r.last_heartbeat_at||0) >= onlineCutoff).length;
  const outdated = runtime?.latest_version ? rows.filter((r:any)=>r.app_version && r.app_version !== runtime.latest_version).length : 0;
  const errors24 = (errors||[]).filter((e:any)=>Date.parse(e.created_at||0) >= Date.parse(since24)).length;
  const campaigns24 = campaignRows.filter((c:any)=>Date.parse(c.updated_at||0) >= Date.parse(since24)).length;
  return { runtime, summary:{ devices:rows.length, online, outdated, errors_24h:errors24, campaigns_24h:campaigns24 }, devices:rows, campaigns:campaignRows, errors:errors||[] };
}

async function companyHealth(payload:any) {
  const organizationId = txt(payload?.organization_id,80); if (!isUuid(organizationId)) throw new Error("invalid_organization_id");
  const [{data: diagnostics},{data: campaigns},{data: errors},{data: devices}] = await Promise.all([
    db.from("device_diagnostics").select("*").eq("organization_id",organizationId).order("last_heartbeat_at",{ascending:false}),
    db.from("campaign_telemetry").select("*").eq("organization_id",organizationId).order("updated_at",{ascending:false}).limit(100),
    db.from("diagnostic_events").select("id,device_id,event_type,severity,code,app_version,created_at").eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(100),
    db.from("devices").select("id,nickname,hostname,status,app_version,last_seen_at").eq("organization_id",organizationId)
  ]);
  const deviceMap = new Map((devices||[]).map((d:any)=>[d.id,d]));
  return { devices:(diagnostics||[]).map((d:any)=>({...d,device_name:(deviceMap.get(d.device_id) as any)?.nickname || (deviceMap.get(d.device_id) as any)?.hostname || "Dispositivo"})), campaigns:campaigns||[], errors:errors||[] };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"method_not_allowed"},405);
  const admin=await currentAdmin(req); if(!admin) return json({error:"forbidden"},403);
  const body=await req.json().catch(()=>({})); const action=txt(body?.action,100); const payload=body?.payload||{};
  try{
    let data:unknown;
    if(action==="overview") data=await overview();
    else if(action==="company.health") data=await companyHealth(payload);
    else return json({error:"unknown_action"},400);
    return json({ok:true,data});
  }catch(e){ console.error("operations-console",action,e); return json({ok:false,error:e instanceof Error?e.message:"internal_error"},400); }
});