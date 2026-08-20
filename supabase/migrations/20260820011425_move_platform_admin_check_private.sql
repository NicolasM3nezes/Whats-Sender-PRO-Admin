create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.active = true
  );
$$;

revoke all on function private.is_platform_admin() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_platform_admin() to authenticated, service_role;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and qual = 'is_platform_admin()'
  loop
    execute format(
      'alter policy %I on %I.%I using (private.is_platform_admin())',
      r.policyname, r.schemaname, r.tablename
    );
  end loop;
end $$;

revoke all on function public.is_platform_admin() from public, anon, authenticated;
drop function public.is_platform_admin();
