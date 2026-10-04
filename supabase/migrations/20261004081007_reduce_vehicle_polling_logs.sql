-- Replace one REST read per available car with a single RLS-protected read.
create index if not exists trip_logs_latest_completed_car_idx
  on public.trip_logs (car_id, start_time desc, id desc)
  where is_completed = true;

create or replace function public.get_latest_completed_car_trips()
returns setof public.trip_logs
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (t.car_id) t.*
  from public.trip_logs as t
  where t.is_completed = true
  order by t.car_id, t.start_time desc, t.id desc;
$$;

revoke all on function public.get_latest_completed_car_trips() from public;
grant execute on function public.get_latest_completed_car_trips() to anon, authenticated, service_role;

notify pgrst, 'reload schema';
