-- Same public fields as Home, returned in one RLS-respecting request.
create or replace function public.get_public_fleet_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_cars as materialized (
    select c.*, case when d.id is null then null else jsonb_build_object('name', d.name) end as departments
    from public.cars c
    left join public.departments d on d.id = c.department_id
    where c.is_visible is distinct from false
  ), active_trips as (
    select t.id, t.car_id, t.start_time, t.end_time, t.start_mileage, t.end_mileage,
           t.driver_name, t.driver_position, t.location, t.is_completed
    from public.trip_logs t
    join visible_cars c on c.id = t.car_id
    where t.is_completed = false
    order by t.start_time desc
  ), latest_trips as (
    select distinct on (t.car_id)
           t.id, t.car_id, t.start_time, t.end_time, t.start_mileage, t.end_mileage,
           t.driver_name, t.driver_position, t.location, t.is_completed
    from public.trip_logs t
    join visible_cars c on c.id = t.car_id
    where t.is_completed = true
    order by t.car_id, t.start_time desc, t.id desc
  ), open_maintenance as (
    select m.id, m.car_id, m.description, m.reported_at, m.issue_category_code,
           case when cat.code is null then null else jsonb_build_object('name', cat.name) end as maintenance_issue_categories
    from public.car_maintenance_records m
    join visible_cars c on c.id = m.car_id
    left join public.maintenance_issue_categories cat on cat.code = m.issue_category_code
    where m.status = 'open'
    order by m.reported_at desc
  )
  select jsonb_build_object(
    'carsDataRaw', coalesce((select jsonb_agg(to_jsonb(c)) from visible_cars c), '[]'::jsonb),
    'activeLogs', coalesce((select jsonb_agg(to_jsonb(t)) from active_trips t), '[]'::jsonb),
    'latestLogs', coalesce((select jsonb_agg(to_jsonb(t)) from latest_trips t), '[]'::jsonb),
    'maintenanceRecords', coalesce((select jsonb_agg(to_jsonb(m)) from open_maintenance m), '[]'::jsonb),
    'generatedAt', current_timestamp
  );
$$;

revoke all on function public.get_public_fleet_snapshot() from public;
grant execute on function public.get_public_fleet_snapshot() to anon, authenticated, service_role;
notify pgrst, 'reload schema';
