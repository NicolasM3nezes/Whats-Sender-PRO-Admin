create table if not exists public.device_diagnostics (
  device_id uuid primary key references public.devices(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  app_version text,
  os_name text,
  os_version text,
  chrome_version text,
  whatsapp_state text,
  last_campaign_status text,
  last_error_code text,
  last_heartbeat_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_telemetry (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  app_version text,
  campaign_name text,
  status text not null check (status in ('created','running','stopped','completed','failed')),
  total_count integer not null default 0 check (total_count >= 0),
  sent_count integer not null default 0 check (sent_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  remaining_count integer not null default 0 check (remaining_count >= 0),
  speed_mode text,
  media_mode text,
  test_mode boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(device_id, campaign_id)
);

create table if not exists public.diagnostic_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info','warning','error')),
  code text,
  app_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_device_diagnostics_org_heartbeat on public.device_diagnostics(organization_id, last_heartbeat_at desc);
create index if not exists idx_campaign_telemetry_org_started on public.campaign_telemetry(organization_id, started_at desc);
create index if not exists idx_campaign_telemetry_device_started on public.campaign_telemetry(device_id, started_at desc);
create index if not exists idx_diagnostic_events_device_created on public.diagnostic_events(device_id, created_at desc);
create index if not exists idx_diagnostic_events_org_created on public.diagnostic_events(organization_id, created_at desc);

alter table public.device_diagnostics enable row level security;
alter table public.campaign_telemetry enable row level security;
alter table public.diagnostic_events enable row level security;

revoke all on public.device_diagnostics from anon, authenticated;
revoke all on public.campaign_telemetry from anon, authenticated;
revoke all on public.diagnostic_events from anon, authenticated;
