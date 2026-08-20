create or replace function private.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.touch_updated_at() from public, anon, authenticated;

drop trigger if exists trg_device_diagnostics_updated_at on public.device_diagnostics;
create trigger trg_device_diagnostics_updated_at
before update on public.device_diagnostics
for each row execute function private.touch_updated_at();

drop trigger if exists trg_campaign_telemetry_updated_at on public.campaign_telemetry;
create trigger trg_campaign_telemetry_updated_at
before update on public.campaign_telemetry
for each row execute function private.touch_updated_at();
