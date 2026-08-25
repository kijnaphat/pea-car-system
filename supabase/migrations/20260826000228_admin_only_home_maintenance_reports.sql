create or replace function private.admin_report_car_maintenance_impl(
  p_car_id bigint,
  p_staff_code text,
  p_issue_category_code text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    return pg_catalog.jsonb_build_object(
      'error',
      'กรุณาเข้าสู่ระบบด้วยบัญชี Admin ก่อนแจ้งรถชำรุดจากหน้า Home'
    );
  end if;

  return private.report_car_maintenance_impl(
    p_car_id,
    p_staff_code,
    p_issue_category_code,
    p_description
  );
end;
$$;

create or replace function public.report_car_maintenance(
  p_car_id bigint,
  p_staff_code text,
  p_issue_category_code text,
  p_description text
)
returns jsonb
language sql
set search_path = pg_catalog
as $$
  select private.admin_report_car_maintenance_impl(
    p_car_id,
    p_staff_code,
    p_issue_category_code,
    p_description
  );
$$;

revoke all on function private.report_car_maintenance_impl(bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function private.report_car_maintenance_impl(bigint, text, text, text)
  to service_role;

revoke all on function private.admin_report_car_maintenance_impl(bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function private.admin_report_car_maintenance_impl(bigint, text, text, text)
  to authenticated, service_role;

revoke all on function public.report_car_maintenance(bigint, text, text, text)
  from public, anon, authenticated;
grant execute on function public.report_car_maintenance(bigint, text, text, text)
  to authenticated, service_role;

-- Keep the QR return-and-repair flow public exactly as before.
revoke all on function public.return_car_and_report_maintenance(bigint, text, integer, numeric, numeric, integer, text, text)
  from public, anon, authenticated;
grant execute on function public.return_car_and_report_maintenance(bigint, text, integer, numeric, numeric, integer, text, text)
  to anon, authenticated, service_role;
