do $test$
declare
  v_ev bigint := -1000000000000-floor(random()*1000000000000)::bigint;
  v_oil bigint := v_ev-1; v_staff bigint := v_ev-2; v_other bigint := v_ev-3;
  v_code text := 'ev-charge-test-'||gen_random_uuid()::text;
  v_other_code text := 'ev-other-test-'||gen_random_uuid()::text;
  v_request uuid := gen_random_uuid(); v_second uuid := gen_random_uuid();
  v_trip bigint; v_charge bigint; v_result jsonb; v_snapshot jsonb;
begin
  begin
    insert into public.cars(id,plate_number,fuel_type,status,is_visible) overriding system value values
      (v_ev,'EV CHARGE TEST / ROLLBACK','EV','available',true),(v_oil,'OIL TEST / ROLLBACK','ดีเซล','available',false);
    insert into public.staff(id,staff_code,full_name) overriding system value values
      (v_staff,v_code,'EV CHARGE TEST / ROLLBACK'),(v_other,v_other_code,'OTHER TEST / ROLLBACK');
    set local role anon;
    v_result:=public.take_car_out_v4(v_ev,v_code,100,'[ทดสอบ - งาน] สถานที่',null,null,null,null,array[]::integer[],'usage')::jsonb;
    assert v_result->>'success'='true','driving start';
    v_trip:=(v_result->>'trip_log_id')::bigint;
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_other_code,120,10,90,'PEA','สำนักงานใหญ่',v_request)::jsonb ? 'error'),'other staff blocked';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,99,10,90,'PEA','สำนักงานใหญ่',v_request)::jsonb ? 'error'),'backward charge mileage blocked';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,120,90,10,'PEA','สำนักงานใหญ่',v_request)::jsonb ? 'error'),'battery reduction blocked';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,120,0,101,'PEA','สำนักงานใหญ่',v_request)::jsonb ? 'error'),'battery range blocked';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,120,0,80,'WRONG','สำนักงานใหญ่',v_request)::jsonb ? 'error'),'station invalid blocked';
    assert (public.record_ev_charge_during_trip(v_oil,v_trip,v_code,120,10,90,'PEA','สำนักงานใหญ่',v_request)::jsonb ? 'error'),'oil blocked';
    v_result:=public.record_ev_charge_during_trip(v_ev,v_trip,v_code,120,0,90,'PEA','สำนักงานใหญ่',v_request)::jsonb;
    assert v_result->>'success'='true','zero before valid: '||v_result::text;
    v_charge:=(v_result->>'trip_log_id')::bigint;
    assert (select status='busy' from public.cars where id=v_ev),'car still busy';
    assert (select is_completed=false and end_mileage is null from public.trip_logs where id=v_trip),'parent remains open';
    assert (select count(*)=1 from public.trip_logs where car_id=v_ev and not is_completed),'one active trip only';
    assert (select activity_type='charge' and is_completed and parent_trip_log_id=v_trip and start_mileage=end_mileage and start_mileage=120 from public.trip_logs where id=v_charge),'completed charge child';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,120,0,90,'PEA','สำนักงานใหญ่',v_request)::jsonb->>'already_saved'='true'),'retry idempotent';
    assert (select count(*)=1 from public.trip_logs where charge_request_id=v_request),'no duplicate retry';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,130,0,90,'PEA','สำนักงานใหญ่',v_request)::jsonb ? 'error'),'changed retry blocked';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,119,10,80,'OTHER','Wall Charge',v_second)::jsonb ? 'error'),'below previous charge blocked';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,130,10,80,'OTHER','Wall Charge',v_second)::jsonb->>'success'='true'),'multiple charges allowed';
    assert (public.take_car_out_v4(v_oil,v_code,100,'test',null,null,null,null,array[]::integer[],'usage')::jsonb ? 'error'),'driver cannot take second car';
    begin
      perform public.return_car_v2(v_ev,125,0,0,null,v_trip);
      raise exception 'return below last charge unexpectedly succeeded';
    exception when sqlstate '22023' then null; end;
    assert (select not is_completed from public.trip_logs where id=v_trip),'failed return remains open';
    assert (public.return_car_v2(v_ev,150,0,0,null,v_trip)::jsonb->>'success'='true'),'normal return after charges';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,160,10,80,'OTHER','Wall Charge',gen_random_uuid())::jsonb ? 'error'),'closed parent blocks new charge';
    assert (public.record_ev_charge_during_trip(v_ev,v_trip,v_code,120,0,90,'PEA','สำนักงานใหญ่',v_request)::jsonb->>'already_saved'='true'),'lost-response retry after return';
    reset role;
    -- Real-time now() is stable in a transaction; exercise ordering explicitly.
    update public.trip_logs set end_time=now()+interval '1 second' where id=v_trip;
    v_snapshot:=public.get_public_fleet_snapshot();
    assert (select (item->>'id')::bigint=v_trip from jsonb_array_elements(v_snapshot->'latestLogs') item where (item->>'car_id')::bigint=v_ev),'completed parent wins by end time';
    raise exception using errcode='ZE003',message='EV_IN_TRIP_CHARGE_TESTS_PASSED';
  exception when sqlstate 'ZE003' then null; end;
  assert not exists(select 1 from public.cars where id in (v_ev,v_oil)),'no test vehicles persisted';
  assert not exists(select 1 from public.staff where id in (v_staff,v_other)),'no test staff persisted';
end;
$test$;
