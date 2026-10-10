-- Permanent assignments in a FICTIONAL office layout. No GPS data or real
-- checkout/return records are modified by the digital-twin view.
create table public.fleet_parking_slots (
  slot_no bigint generated always as identity primary key,
  car_id bigint not null unique references public.cars(id) on delete cascade
);
alter table public.fleet_parking_slots enable row level security;
revoke all on public.fleet_parking_slots from public,anon,authenticated;
grant select on public.fleet_parking_slots to anon,authenticated;
grant all on public.fleet_parking_slots to service_role;
create policy read_visible_parking_slots on public.fleet_parking_slots for select to anon,authenticated
  using (exists(select 1 from public.cars c where c.id=car_id and c.is_visible is distinct from false));
insert into public.fleet_parking_slots(car_id) select id from public.cars where is_visible is distinct from false order by id;
create function private.assign_virtual_parking_slot() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.is_visible is distinct from false and not exists(select 1 from public.fleet_parking_slots where car_id=new.id) then
    insert into public.fleet_parking_slots(car_id) values(new.id) on conflict(car_id) do nothing;
  end if;
  return new;
end; $$;
revoke all on function private.assign_virtual_parking_slot() from public,anon,authenticated;
create trigger assign_virtual_parking_slot after insert or update of is_visible on public.cars
  for each row execute function private.assign_virtual_parking_slot();
do $$ declare v_def text; begin
  v_def:=pg_catalog.pg_get_functiondef('public.get_public_fleet_snapshot()'::regprocedure);
  if position('), open_maintenance as (' in v_def)=0 or position('''generatedAt'', current_timestamp' in v_def)=0 then
    raise exception 'Fleet snapshot patch target missing';
  end if;
  v_def:=replace(v_def,'), open_maintenance as (',
    '), latest_charges as (
      select distinct on(t.car_id) t.car_id,t.battery_after,t.end_time,t.start_time
      from public.trip_logs t join visible_cars c on c.id=t.car_id
      where t.is_completed=true and public.effective_trip_activity(t.activity_type,c.fuel_type)=''charge''
      order by t.car_id,t.end_time desc nulls last,t.id desc
    ), open_maintenance as (');
  v_def:=replace(v_def,'t.location, t.is_completed, t.activity_type',
    't.location, t.is_completed, t.activity_type,t.battery_before,t.battery_after,t.station_type,t.station_name,t.parent_trip_log_id');
  v_def:=replace(v_def,'''generatedAt'', current_timestamp',
    '''parkingSlots'',coalesce((select jsonb_agg(to_jsonb(p)) from public.fleet_parking_slots p join visible_cars c on c.id=p.car_id),''[]''::jsonb),
    ''latestCharges'',coalesce((select jsonb_agg(to_jsonb(t)) from latest_charges t),''[]''::jsonb),
    ''generatedAt'', current_timestamp');
  execute v_def;
end; $$;
notify pgrst,'reload schema';
