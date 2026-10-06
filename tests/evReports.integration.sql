do $test$
declare
  v_car bigint := -1000000000000-floor(random()*1000000000000)::bigint;
  v_driver bigint := v_car-2;
  v_controller bigint := v_car-3;
  v_driver_code text := 'report-test-'||gen_random_uuid()::text;
  v_controller_code text := 'report-test-'||gen_random_uuid()::text;
  v_original_definition text;
  v_result jsonb;
begin
  v_original_definition := pg_get_functiondef('private.save_ev_usage_report_signature(bigint,text,text,text,text)'::regprocedure);
  begin
    -- Fixed clock only in this uncommitted subtransaction. The function and
    -- fixtures/audit queue are ALL restored before this test commits.
    execute replace(v_original_definition,
      '(pg_catalog.now() at time zone ''Asia/Bangkok'')::date','date ''2026-10-28''');
    insert into public.cars(id,plate_number,fuel_type,status,is_visible) overriding system value
      values(v_car,'EV REPORT TEST / ROLLBACK','EV','available',false),
        (v_car-1,'OIL REPORT TEST / ROLLBACK','ดีเซล','available',false);
    insert into public.staff(id,staff_code,full_name) overriding system value
      values(v_driver,v_driver_code,'REPORT TEST DRIVER'),(v_controller,v_controller_code,'REPORT TEST CONTROLLER');
    insert into public.report_signatures(car_id,report_month,driver_sig,driver_name,driver_staff_id)
      values(v_car,'2026-10','data:image/png;base64,CHARGE','CHARGE SIGNER',v_driver);
    execute 'set local role anon';
    v_result:=public.save_report_signature_v2(v_car,'2026-10','driver',v_driver_code,'data:image/png;base64,AAA=','usage')::jsonb;
    assert v_result->>'success'='true','anonymous verified staff EV usage sign: '||v_result::text;
    assert public.save_report_signature_v2(v_car,'2026-10','controller',v_controller_code,'data:image/png;base64,BBB=','usage')::jsonb->>'success'='true','independent controller';
    assert (select driver_name='CHARGE SIGNER' and driver_sig='data:image/png;base64,CHARGE' from public.report_signatures where car_id=v_car),'charge signature preserved';
    assert (select driver_name='REPORT TEST DRIVER' and controller_name='REPORT TEST CONTROLLER' from public.ev_usage_report_signatures where car_id=v_car),'usage signatures separate';
    assert public.save_report_signature_v2(v_car,'2026-10','driver',v_controller_code,'data:image/png;base64,BBB=','usage')::jsonb ? 'error','different signer cannot replace';
    assert public.save_report_signature_v2(v_car,'2026-10','driver',v_controller_code,null,'usage')::jsonb ? 'error','different signer cannot clear';
    assert public.save_report_signature_v2(v_car,'2026-10','driver',v_driver_code,'invalid','usage')::jsonb ? 'error','invalid image rejected';
    assert public.save_report_signature_v2(v_car,'2026-09','driver',v_driver_code,'data:image/png;base64,AAA=','usage')::jsonb ? 'error','wrong month rejected';
    assert public.save_report_signature_v2(v_car,'2026-10','driver','invalid','data:image/png;base64,AAA=','usage')::jsonb ? 'error','unknown staff rejected';
    assert public.save_report_signature_v2(v_car,'2026-10','driver',v_driver_code,'data:image/png;base64,AAA=','bad')::jsonb ? 'error','unknown report rejected';
    assert public.save_report_signature_v2(v_car-1,'2026-10','driver',v_driver_code,'data:image/png;base64,AAA=','charge')::jsonb ? 'error','oil cannot have charge report';
    begin
      insert into public.ev_usage_report_signatures(car_id,report_month) values(v_car,'2026-11');
      raise exception 'anon direct signature insert was allowed';
    exception when insufficient_privilege then null;
    end;
    assert public.save_report_signature_v2(v_car,'2026-10','driver',v_driver_code,null,'usage')::jsonb->>'success'='true','original signer can clear';
    assert (select driver_sig is null and controller_sig is not null from public.ev_usage_report_signatures where car_id=v_car),'only selected usage signer cleared';
    assert (select count(*)=1 from public.ev_usage_report_signatures where car_id=v_car),'one usage record per month';
    assert (select driver_sig='data:image/png;base64,CHARGE' from public.report_signatures where car_id=v_car),'clearing usage does not clear charge';
    execute 'reset role';
    assert not exists(select 1 from public.audit_events where entity_type='ev_usage_report_signatures' and details::text like '%data:image%'),'audit never contains images';
    raise exception using errcode='ZE002',message='EV_REPORT_TESTS_PASSED';
  exception when sqlstate 'ZE002' then null;
  end;
  assert not exists(select 1 from public.cars where id in(v_car,v_car-1)),'no test cars persisted';
  assert not exists(select 1 from public.staff where id in(v_driver,v_controller)),'no test staff persisted';
  assert pg_get_functiondef('private.save_ev_usage_report_signature(bigint,text,text,text,text)'::regprocedure)=v_original_definition,'fixed test clock restored';
end;
$test$;
