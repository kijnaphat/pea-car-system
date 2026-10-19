-- Run as migration owner in one call after staff_repair_work_ledger.
-- Production-safe verification: ALL bookkeeping test writes ROLLBACK.
-- Existing staff/car/source IDs are selected only inside SQL, never returned.
begin;
set local statement_timeout = '20s';

create temporary table repair_ledger_staff_test_state (
  staff_id bigint, staff_code text, staff_name text,
  second_staff_id bigint, second_staff_code text, second_staff_name text,
  unknown_code text, admin_id uuid,
  car_id bigint, source_id uuid, source_car_id bigint,
  canonical_before jsonb, canonical_items_before jsonb, trips_before bigint, cars_before jsonb,
  ledger_before bigint, payload jsonb, first_result jsonb, latest_result jsonb, linked_result jsonb
) on commit drop;

insert into repair_ledger_staff_test_state (
  staff_id,staff_code,staff_name,second_staff_id,second_staff_code,second_staff_name,unknown_code,
  admin_id,car_id,source_id,source_car_id,
  canonical_before,canonical_items_before,trips_before,cars_before,ledger_before)
select a.id,a.staff_code,a.full_name,coalesce(b.id,a.id),coalesce(b.staff_code,a.staff_code),
  coalesce(b.full_name,a.full_name),'9999999',
  (select id from auth.users order by created_at limit 1),
  (select id from public.cars order by id limit 1),m.id,m.car_id,
  (select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from public.car_maintenance_records r),
  (select coalesce(jsonb_agg(to_jsonb(i) order by i.maintenance_record_id,i.repair_item_code),'[]') from public.car_maintenance_repair_items i),
  (select count(*) from public.trip_logs),
  (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'status',c.status) order by c.id),'[]') from public.cars c),
  (select count(*) from public.repair_work_ledger)
from (select id,staff_code,full_name from public.staff where staff_code ~ '^[0-9]{1,7}$' order by id limit 1) a
left join lateral (
  select id,staff_code,full_name from public.staff where staff_code ~ '^[0-9]{1,7}$' and id<>a.id order by id limit 1
) b on true
left join lateral (
  select r.id,r.car_id from public.car_maintenance_records r
  where not exists(select 1 from public.repair_work_ledger l where l.maintenance_record_id=r.id)
  order by r.reported_at desc limit 1
) m on true;

do $$ declare v_unknown text; begin
  if not exists(select 1 from repair_ledger_staff_test_state where staff_id is not null and car_id is not null) then
    raise exception 'Verification requires an existing numeric staff code and a car; no personnel or cars will be created';
  end if;
  select unknown_code into v_unknown from repair_ledger_staff_test_state;
  while exists(select 1 from public.staff where staff_code=v_unknown) loop
    v_unknown := (v_unknown::integer-1)::text;
  end loop;
  update repair_ledger_staff_test_state set unknown_code=v_unknown;
  if has_table_privilege('anon','public.repair_work_ledger','SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'anon unexpectedly has direct ledger privileges';
  end if;
  if has_column_privilege('authenticated','public.repair_work_ledger','created_by_staff_id','INSERT')
    or has_column_privilege('authenticated','public.repair_work_ledger','updated_by_staff_name','UPDATE') then
    raise exception 'Client may forge staff audit columns';
  end if;
  if has_function_privilege('anon','private.list_repair_work_ledger_core(date,bigint)','EXECUTE')
    or has_function_privilege('authenticated','private.save_repair_work_ledger_core(jsonb,bigint,text)','EXECUTE')
    or has_function_privilege('service_role','private.save_repair_work_ledger_core(jsonb,bigint,text)','EXECUTE')
    or has_function_privilege('anon','private.require_repair_ledger_staff(text)','EXECUTE') then
    raise exception 'Unchecked private core or staff resolver is client executable';
  end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in(
      'verify_repair_ledger_staff','list_repair_work_ledger_staff','save_repair_work_ledger_staff',
      'list_repair_work_ledger','save_repair_work_ledger') and p.prosecdef) then
    raise exception 'Public ledger wrapper unexpectedly uses SECURITY DEFINER';
  end if;
end $$;

grant select,update on repair_ledger_staff_test_state to anon,authenticated;
set local role anon;
select set_config('request.jwt.claims','{}',true);
select set_config('request.jwt.claim.sub','',true);

-- No code, malformed or unknown code may verify, read, save, or call a boundary.
do $$ declare s repair_ledger_staff_test_state%rowtype; v_code text; v_identity jsonb; begin
  select * into s from repair_ledger_staff_test_state;
  foreach v_code in array array[null,'',' ',s.unknown_code,'abc','12345678','1 OR 1=1',repeat('1',33)] loop
    begin perform public.verify_repair_ledger_staff(v_code);
      raise exception 'Invalid staff verification unexpectedly succeeded';
    exception when insufficient_privilege then null; end;
    begin perform public.list_repair_work_ledger_staff(v_code,date '2026-10-01');
      raise exception 'Invalid-code ledger read unexpectedly succeeded';
    exception when insufficient_privilege then null; end;
    begin perform public.save_repair_work_ledger_staff(v_code,'{}');
      raise exception 'Invalid-code save unexpectedly succeeded';
    exception when insufficient_privilege then null; end;
    begin perform private.repair_ledger_staff_boundary(v_code,'list',date '2026-10-01');
      raise exception 'Direct boundary skipped verification';
    exception when insufficient_privilege then null; end;
  end loop;
  begin perform private.list_repair_work_ledger_core(date '2026-10-01');
    raise exception 'anon called list core'; exception when insufficient_privilege then null; end;
  begin perform private.save_repair_work_ledger_core('{}',s.staff_id,s.staff_name);
    raise exception 'anon called write core'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.repair_work_ledger;
    raise exception 'anon read table'; exception when insufficient_privilege then null; end;
  begin insert into public.repair_work_ledger(repair_date,plate_number,repair_description,client_request_id)
    values(date '2026-10-19','TEST-STAFF-ROLLBACK','not real',gen_random_uuid());
    raise exception 'anon inserted table'; exception when insufficient_privilege then null; end;
  begin update public.repair_work_ledger set status='paid';
    raise exception 'anon updated table'; exception when insufficient_privilege then null; end;
  begin delete from public.repair_work_ledger;
    raise exception 'anon deleted table'; exception when insufficient_privilege then null; end;
  v_identity := public.verify_repair_ledger_staff(s.staff_code);
  if (v_identity->>'staff_id')::bigint<>s.staff_id or v_identity->>'full_name'<>s.staff_name
    or v_identity ? 'staff_code' or v_identity ? 'phone' or v_identity ? 'email' then
    raise exception 'Staff identity incorrect or leaks extra personnel fields';
  end if;
  if public.verify_repair_ledger_staff(translate(s.staff_code,'0123456789','๐๑๒๓๔๕๖๗๘๙'))<>v_identity
    or public.verify_repair_ledger_staff(translate(s.staff_code,'0123456789','０１２３４５６７８９'))<>v_identity then
    raise exception 'Thai/full-width personnel code normalization failed';
  end if;
end $$;

-- A public personnel workflow saves without an Auth session, recording real actor snapshots.
update repair_ledger_staff_test_state set payload=jsonb_build_object(
  'source_type','report','source_id',null,'client_request_id',gen_random_uuid(),'car_id',car_id,
  'repair_date','2026-10-19','plate_number','TEST-STAFF-ROLLBACK','department','ทดสอบ',
  'shop_name','ร้านทดสอบ','bill_number','B-ROLLBACK','amount',null,
  'repair_description','ทดสอบสมุดคุมงานซ่อม ไม่ใช่รายการจริง','status','',
  'accounting_document_number','','paid_date',null,'machine_hours',null
);
update repair_ledger_staff_test_state set first_result=public.save_repair_work_ledger_staff(staff_code,payload);
update repair_ledger_staff_test_state set latest_result=first_result;

do $$ declare s repair_ledger_staff_test_state%rowtype; v_list jsonb; v_bad jsonb; begin
  select * into s from repair_ledger_staff_test_state;
  if s.first_result->>'id' is null or s.first_result->>'updated_at' is null
    or s.first_result->'amount'<>'null'::jsonb
    or s.first_result->>'created_by_staff_name'<>s.staff_name
    or s.first_result->>'updated_by_staff_name'<>s.staff_name
    or s.first_result ? 'staff_code' then raise exception 'Staff save response or actor attribution failed'; end if;
  if public.save_repair_work_ledger_staff(s.staff_code,s.payload)<>s.first_result then
    raise exception 'Staff network retry did not return exact original result'; end if;
  begin perform public.save_repair_work_ledger_staff(s.staff_code,s.payload||'{"amount":"9.99"}');
    raise exception 'Changed retry falsely succeeded'; exception when serialization_failure then null; end;
  begin perform public.save_repair_work_ledger_staff(s.unknown_code,s.payload);
    raise exception 'Prior verification incorrectly authorized later invalid code';
    exception when insufficient_privilege then null; end;
  v_list := public.list_repair_work_ledger_staff(s.staff_code,date '2026-10-01',s.car_id);
  if jsonb_typeof(v_list->'cars')<>'array' or not exists(
    select 1 from jsonb_array_elements(v_list->'rows') r where r->>'id'=s.first_result->>'id'
  ) then raise exception 'Staff monthly/car list did not include saved row'; end if;
  for v_bad in select value from jsonb_array_elements('[
    {"created_by_staff_id":999},{"updated_by_staff_name":"forged"},{"created_by":"forged"},
    {"amount":"-1"},{"amount":"1.234"},{"amount":"1e3"},{"amount":"NaN"},
    {"machine_hours":"-1"},{"repair_date":"2026-02-30"},{"paid_date":"2026-02-30"},
    {"status":"unknown"},{"plate_number":" "},{"repair_description":" "},{"client_request_id":null}
  ]'::jsonb) loop
    begin perform public.save_repair_work_ledger_staff(s.staff_code,s.payload||v_bad);
      raise exception 'Staff save accepted invalid input or forged audit';
    exception when invalid_parameter_value then null; end;
  end loop;
end $$;

-- All five stages remain editable; exact timestamp concurrency and creator audit survive staff changes.
do $$ declare s repair_ledger_staff_test_state%rowtype; v_stage text; v_result jsonb; begin
  foreach v_stage in array array['committee_signed','submitted_executive','submitted_review','paid',''] loop
    select * into s from repair_ledger_staff_test_state;
    v_result := public.save_repair_work_ledger_staff(s.second_staff_code,s.payload||jsonb_build_object(
      'id',s.latest_result->>'id','updated_at',s.latest_result->>'updated_at',
      'amount','0.00','status',v_stage,'accounting_document_number','ACC-ROLLBACK','paid_date','2026-10-19'));
    if v_result->>'status'<>v_stage or v_result->>'amount'<>'0.00'
      or v_result->>'created_by_staff_name'<>s.staff_name
      or v_result->>'updated_by_staff_name'<>s.second_staff_name
      or (v_result->>'updated_at')::timestamptz<=(s.latest_result->>'updated_at')::timestamptz then
      raise exception 'Stage update, exact amount, monotonic version or staff snapshots failed';
    end if;
    update repair_ledger_staff_test_state set latest_result=v_result;
  end loop;
  select * into s from repair_ledger_staff_test_state;
  begin perform public.save_repair_work_ledger_staff(s.staff_code,s.payload||jsonb_build_object(
    'id',s.first_result->>'id','updated_at',s.first_result->>'updated_at','status','paid'));
    raise exception 'Stale staff edit overwrote newer data'; exception when serialization_failure then null; end;
  begin perform public.save_repair_work_ledger_staff(s.staff_code,s.payload||jsonb_build_object('id',s.first_result->>'id'));
    raise exception 'Unversioned staff edit succeeded'; exception when serialization_failure then null; end;
  begin perform public.list_repair_work_ledger_staff(s.staff_code,null);
    raise exception 'Invalid list month succeeded'; exception when invalid_parameter_value then null; end;
end $$;

-- Source imports remain ledger-only and cannot rebind a record to a different vehicle.
do $$ declare s repair_ledger_staff_test_state%rowtype; v_list jsonb; v_source jsonb; v_result jsonb; v_month date; begin
  select * into s from repair_ledger_staff_test_state;
  if s.source_id is null then return; end if;
  -- Source date is not exposed outside this transaction.
  reset role;
  select date_trunc('month',coalesce(m.completed_at,m.reported_at) at time zone 'Asia/Bangkok')::date
    into v_month from public.car_maintenance_records m where m.id=s.source_id;
  set local role anon;
  v_list := public.list_repair_work_ledger_staff(s.staff_code,v_month,s.source_car_id);
  select r into v_source from jsonb_array_elements(v_list->'rows') r where r->>'source_id'=s.source_id::text;
  if v_source is null or v_source->'id'<>'null'::jsonb then raise exception 'Virtual source row missing'; end if;
  v_source := v_source-'created_at'-'updated_at'-'created_by_staff_name'-'updated_by_staff_name';
  v_result := public.save_repair_work_ledger_staff(s.staff_code,v_source||'{"shop_name":"ร้านทดสอบนำเข้า"}');
  if v_result->>'source_type'<>'maintenance' then raise exception 'Staff source import failed'; end if;
  update repair_ledger_staff_test_state set linked_result=v_result;
  v_list := public.list_repair_work_ledger_staff(s.staff_code,v_month,s.source_car_id);
  if (select count(*) from jsonb_array_elements(v_list->'rows') r where r->>'source_id'=s.source_id::text)<>1 then
    raise exception 'Source import duplicates virtual maintenance'; end if;
end $$;

-- Non-admin Auth sessions may use only the staff-code endpoints, not admin claims from user_metadata.
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated',
  'app_metadata',jsonb_build_object('role','staff'),'user_metadata',jsonb_build_object('role','admin'))::text,true)
from repair_ledger_staff_test_state;
select set_config('request.jwt.claim.sub',coalesce(admin_id::text,''),true) from repair_ledger_staff_test_state;
set local role authenticated;
do $$ declare s repair_ledger_staff_test_state%rowtype; v_count bigint; begin
  select * into s from repair_ledger_staff_test_state;
  begin perform public.list_repair_work_ledger(date '2026-10-01');
    raise exception 'user_metadata elevated admin access'; exception when insufficient_privilege then null; end;
  if exists(select 1 from public.repair_work_ledger) then raise exception 'Non-admin direct read bypassed RLS'; end if;
  perform public.list_repair_work_ledger_staff(s.staff_code,date '2026-10-01');
  begin update public.repair_work_ledger set updated_by_staff_id=s.staff_id,updated_by_staff_name=s.staff_name
    where id=(s.first_result->>'id')::uuid;
    raise exception 'Direct client forged audit'; exception when insufficient_privilege then null; end;
  update public.repair_work_ledger set status='paid';
  get diagnostics v_count=row_count;
  if v_count<>0 then raise exception 'Non-admin directly changed ledger status'; end if;
end $$;

-- Legacy admins still work, and cannot accidentally attribute their edit to the last staff member.
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',admin_id,'role','authenticated',
  'app_metadata',jsonb_build_object('role','admin'))::text,true) from repair_ledger_staff_test_state;
set local role authenticated;
do $$ declare s repair_ledger_staff_test_state%rowtype; v_result jsonb; begin
  select * into s from repair_ledger_staff_test_state;
  if s.admin_id is null then return; end if;
  perform public.list_repair_work_ledger(date '2026-10-01');
  v_result := public.save_repair_work_ledger(s.payload||jsonb_build_object(
    'id',s.latest_result->>'id','updated_at',s.latest_result->>'updated_at','amount','0.00',
    'status','submitted_review','accounting_document_number','ACC-ROLLBACK','paid_date','2026-10-19'));
  if v_result->>'created_by_staff_name'<>s.staff_name
    or v_result->'updated_by_staff_name'<>'null'::jsonb then
    raise exception 'Legacy admin edit lost creator audit or retained false staff updater';
  end if;
  begin update public.repair_work_ledger set created_by_staff_name='forged' where id=(s.first_result->>'id')::uuid;
    raise exception 'Admin REST client forged staff creator'; exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$ declare s repair_ledger_staff_test_state%rowtype; begin
  select * into s from repair_ledger_staff_test_state;
  if not exists(select 1 from public.repair_work_ledger
    where id=(s.first_result->>'id')::uuid and created_by_staff_id=s.staff_id
      and created_by_staff_name=s.staff_name and updated_by_staff_id is null) then
    raise exception 'Persisted server actor audit incorrect';
  end if;
  if (select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]') from public.car_maintenance_records r)<>s.canonical_before
    or (select coalesce(jsonb_agg(to_jsonb(i) order by i.maintenance_record_id,i.repair_item_code),'[]') from public.car_maintenance_repair_items i)<>s.canonical_items_before
    or (select count(*) from public.trip_logs)<>s.trips_before
    or (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'status',c.status) order by c.id),'[]') from public.cars c)<>s.cars_before then
    raise exception 'Ledger workflow changed canonical maintenance, trip or vehicle records';
  end if;
  if (select count(*) from public.repair_work_ledger)<s.ledger_before+1 then
    raise exception 'Staff bookkeeping test row missing';
  end if;
end $$;

select 'Staff ledger authorization, snapshots, statuses, exact amounts, retries, concurrency, legacy admin and canonical isolation: PASS; all test writes rolled back' as verification;
rollback;
