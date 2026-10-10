do $test$
declare v_count integer; v_slots integer;
begin
  select count(*) into v_count from public.cars where is_visible is distinct from false;
  select count(*) into v_slots from public.fleet_parking_slots p join public.cars c on c.id=p.car_id where c.is_visible is distinct from false;
  assert v_count=v_slots,'all visible vehicles assigned once';
  assert not has_table_privilege('anon','public.fleet_parking_slots','INSERT'),'public cannot assign slots';
  assert not has_table_privilege('anon','public.fleet_parking_slots','UPDATE'),'public cannot reassign slots';
  assert (select relrowsecurity from pg_class where oid='public.fleet_parking_slots'::regclass),'slot RLS enabled';
  set local role anon;
  assert jsonb_array_length(public.get_public_fleet_snapshot()->'parkingSlots')=v_count,'public snapshot exposes visible assignments';
  assert jsonb_typeof(public.get_public_fleet_snapshot()->'latestCharges')='array','latest battery receipt field exists';
  reset role;
end;
$test$;
