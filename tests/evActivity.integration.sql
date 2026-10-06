do $test$
declare
  v_ev bigint := -1000000000000-floor(random()*1000000000000)::bigint;
  v_oil bigint := v_ev-1;
  v_staff bigint := v_ev-2;
  v_code text := 'ev-test-'||gen_random_uuid()::text;
  v_result jsonb;
  v_id bigint;
  v_category text;
begin
  -- This subtransaction rolls back ALL fixtures and queued audit events on success.
  begin
    insert into public.cars(id,plate_number,fuel_type,status,is_visible) overriding system value values
      (v_ev,'EV TEST / ROLLBACK','EV','available',false),(v_oil,'OIL TEST / ROLLBACK','ดีเซล','available',false);
    insert into public.staff(id,staff_code,full_name) overriding system value values(v_staff,v_code,'EV TEST / ROLLBACK');

    v_result:=public.take_car_out_v4(v_ev,v_code,100,'[ทดสอบ - ขับรถ] สถานที่ทดสอบ',null,null,null,null,array[]::integer[],'usage')::jsonb;
    assert v_result->>'success'='true', 'EV usage start: '||v_result::text;
    v_id:=(v_result->>'trip_log_id')::bigint;
    assert (select activity_type='usage' and battery_before is null from public.trip_logs where id=v_id),'usage discriminator';
    assert (public.take_car_out_v4(v_ev,v_code,100,'test',null,null,null,null,array[]::integer[],'usage')::jsonb ? 'error'), 'double start blocked';
    assert (public.take_car_out_v4(v_oil,v_code,100,'test',null,null,null,null,array[]::integer[],'usage')::jsonb ? 'error'), 'same staff second car blocked';
    assert (public.return_car_v2(v_ev,90,0,0,null,v_id)::jsonb ? 'error'), 'mileage backwards blocked';
    assert (public.return_car_v2(v_ev,120,1,100,null,v_id)::jsonb ? 'error'), 'EV fuel blocked';
    assert (public.return_car_v2(v_ev,120,0,0,80,v_id)::jsonb ? 'error'), 'usage battery blocked';
    assert (public.return_car_v2(v_ev,120,0,0,null,v_id+1)::jsonb ? 'error'), 'stale return blocked';
    assert (public.return_car_v2(v_ev,120,0,0,null,v_id)::jsonb->>'success'='true'), 'EV return success';
    assert (select end_mileage=120 and battery_after is null and is_completed from public.trip_logs where id=v_id),'EV usage finished data';

    v_result:=public.take_car_out_v4(v_ev,v_code,120,'สำนักงานใหญ่',0,'PEA','สำนักงานใหญ่',null,array[]::integer[],'charge')::jsonb;
    assert v_result->>'success'='true','charge start zero battery: '||v_result::text;
    v_id:=(v_result->>'trip_log_id')::bigint;
    assert (public.return_car_v2(v_ev,null,0,0,0,v_id)::jsonb ? 'error'),'battery increase enforced';
    assert (public.return_car_v2(v_ev,null,0,0,101,v_id)::jsonb ? 'error'),'battery range enforced';
    assert (public.return_car_v2(v_ev,130,0,0,90,v_id)::jsonb ? 'error'),'charge mileage pinned';
    assert (public.return_car_v2(v_ev,null,0,0,90,v_id)::jsonb->>'success'='true'),'charge finish success';
    assert (select start_mileage=end_mileage and end_mileage=120 and battery_after=90 from public.trip_logs where id=v_id),'charge data unchanged';

    v_result:=public.take_car_out_v3(v_ev,v_code,120,'สำนักงานใหญ่',10,'PEA','สำนักงานใหญ่',null,array[]::integer[])::jsonb;
    assert v_result->>'success'='true','old charge start compatible';
    assert (public.return_car(v_ev,null,0,0,80)::jsonb->>'success'='true'),'old charge finish compatible';

    assert (public.take_car_out_v4(v_oil,v_code,100,'test',10,'PEA','test',null,array[]::integer[],'charge')::jsonb ? 'error'),'oil cannot charge';
    assert (public.take_car_out_v4(v_ev,v_code,100,'test',10,'PEA','test',null,array[]::integer[],'usage')::jsonb ? 'error'),'mixed activity blocked';
    assert (public.take_car_out_v4(v_ev,v_code,100,'test',101,'PEA','test',null,array[]::integer[],'charge')::jsonb ? 'error'),'invalid battery start blocked';
    v_result:=public.take_car_out_v3(v_oil,v_code,100,'ทดสอบ',null,null,null,null,array[]::integer[])::jsonb;
    assert v_result->>'success'='true','old oil start compatible';
    v_id:=(v_result->>'trip_log_id')::bigint;
    assert (public.return_car_v2(v_oil,150,5,200,null,v_id)::jsonb->>'success'='true'),'oil fuel return unchanged';

    select code into v_category from public.maintenance_issue_categories where is_active=true limit 1;
    assert v_category is not null,'active issue category';
    v_result:=public.take_car_out_v4(v_ev,v_code,120,'สถานที่ทดสอบ',null,null,null,null,array[]::integer[],'usage')::jsonb;
    v_id:=(v_result->>'trip_log_id')::bigint;
    assert (public.return_car_and_report_maintenance_v2(v_ev,v_code,140,0,0,null,v_category,'ทดสอบแบบไม่เก็บข้อมูล',v_id+1) ? 'error'),'maintenance stale return blocked';
    v_result:=public.return_car_and_report_maintenance_v2(v_ev,v_code,140,0,0,null,v_category,'ทดสอบแบบไม่เก็บข้อมูล',v_id);
    assert v_result->>'success'='true','EV usage maintenance without battery: '||v_result::text;
    assert (select status='maintenance' from public.cars where id=v_ev),'maintenance car state';

    raise exception using errcode='ZE001', message='EV_TESTS_PASSED';
  exception when sqlstate 'ZE001' then
    null;
  end;
  assert not exists(select 1 from public.cars where id in (v_ev,v_oil)),'no fixture cars persisted';
  assert not exists(select 1 from public.staff where id=v_staff),'no fixture staff persisted';
end;
$test$;
