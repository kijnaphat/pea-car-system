-- Run as the migration owner after the migration, in a single execution.
-- All bookkeeping test rows are rolled back; no canonical repair/trip row is changed.
-- Uses existing fixture IDs only, never creates users, cars, maintenance or trip logs.
begin;
set local statement_timeout = '20s';

create temporary table repair_ledger_test_state (
  admin_id uuid, car_id bigint, source_id uuid, source_car_id bigint,
  canonical_before jsonb, canonical_items_before jsonb, trip_count_before bigint,
  payload jsonb, first_result jsonb, latest_result jsonb, linked_result jsonb
) on commit drop;

insert into repair_ledger_test_state (admin_id, car_id, source_id, source_car_id,
  canonical_before, canonical_items_before, trip_count_before)
select (select id from auth.users order by created_at limit 1),
  (select id from public.cars order by id limit 1), m.id, m.car_id, to_jsonb(m),
  coalesce((select jsonb_agg(to_jsonb(i) order by i.repair_item_code)
    from public.car_maintenance_repair_items i where i.maintenance_record_id = m.id), '[]'::jsonb),
  (select count(*) from public.trip_logs)
from public.car_maintenance_records m
where not exists (select 1 from public.repair_work_ledger l where l.maintenance_record_id = m.id)
order by m.reported_at desc limit 1;

do $$ begin
  if not exists (select 1 from repair_ledger_test_state where admin_id is not null and car_id is not null) then
    raise exception 'Test requires one existing auth user, car and unimported maintenance record; no fixture will be created automatically';
  end if;
  if has_table_privilege('anon', 'public.repair_work_ledger', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'anon has an unexpected ledger grant';
  end if;
  if has_table_privilege('authenticated', 'public.repair_work_ledger', 'DELETE') then
    raise exception 'authenticated must not delete ledger rows';
  end if;
  if has_column_privilege('authenticated', 'public.repair_work_ledger', 'created_by', 'INSERT')
    or has_column_privilege('authenticated', 'public.repair_work_ledger', 'updated_at', 'UPDATE')
    or has_column_privilege('authenticated', 'public.repair_work_ledger', 'maintenance_record_id', 'UPDATE') then
    raise exception 'audit and source columns must not be client writable';
  end if;
end $$;

grant select, update on repair_ledger_test_state to authenticated;

-- anon: RPC grants and all direct table operations must be denied.
set local role anon;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.sub', '', true);
do $$ begin
  begin perform public.list_repair_work_ledger(date '2026-10-01');
    raise exception 'anon list unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin perform public.save_repair_work_ledger('{}');
    raise exception 'anon save unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin perform 1 from public.repair_work_ledger;
    raise exception 'anon read unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin insert into public.repair_work_ledger (repair_date,plate_number,repair_description,client_request_id)
      values (date '2026-10-19','TEST-ROLLBACK','test',gen_random_uuid());
    raise exception 'anon insert unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin update public.repair_work_ledger set status = 'paid';
    raise exception 'anon update unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin delete from public.repair_work_ledger;
    raise exception 'anon delete unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role','authenticated',
  'app_metadata',jsonb_build_object('role','admin'))::text, true) from repair_ledger_test_state;
select set_config('request.jwt.claim.sub', admin_id::text, true) from repair_ledger_test_state;
set local role authenticated;

-- Manual entry allows a free-text plate with no car record; blank amount stays null.
update repair_ledger_test_state set payload = jsonb_build_object(
  'client_request_id',gen_random_uuid(),'source_type','manual','car_id',null,
  'repair_date','2026-10-19','plate_number','TEST-ROLLBACK','department','ทดสอบ',
  'shop_name','ร้านทดสอบ','bill_number','B-ROLLBACK','amount',null,
  'repair_description','ทดสอบสมุดคุมงานซ่อม ไม่ใช่รายการจริง','status','',
  'accounting_document_number','','paid_date',null,'machine_hours',null
);
update repair_ledger_test_state set first_result = public.save_repair_work_ledger(payload);
update repair_ledger_test_state set latest_result = first_result;

do $$ declare s repair_ledger_test_state%rowtype; v_result jsonb; begin
  select * into s from repair_ledger_test_state;
  if s.first_result ->> 'id' is null or s.first_result ->> 'updated_at' is null
    or s.first_result -> 'amount' <> 'null'::jsonb or s.first_result -> 'car_id' <> 'null'::jsonb then
    raise exception 'manual insert, nullable car/amount or response failed';
  end if;
  if not exists (select 1 from public.repair_work_ledger where id = (s.first_result ->> 'id')::uuid
    and created_by = s.admin_id and updated_by = s.admin_id) then
    raise exception 'server-controlled audit ownership failed';
  end if;
  v_result := public.save_repair_work_ledger(s.payload);
  if v_result <> s.first_result then raise exception 'retry did not return original result'; end if;
  begin perform public.save_repair_work_ledger(s.payload || '{"amount":"99.99","status":"paid"}'::jsonb);
    raise exception 'changed duplicate request unexpectedly succeeded'; exception when serialization_failure then null; end;
  begin perform public.save_repair_work_ledger(s.payload || '{"repair_description":"changed after timeout"}'::jsonb);
    raise exception 'changed description on duplicate request unexpectedly succeeded'; exception when serialization_failure then null; end;
  if (select count(*) from public.repair_work_ledger where client_request_id = (s.payload ->> 'client_request_id')::uuid) <> 1 then
    raise exception 'idempotent request created duplicate rows';
  end if;
  v_result := public.list_repair_work_ledger(date '2026-10-01');
  if jsonb_typeof(v_result -> 'cars') <> 'array' or not exists (
    select 1 from jsonb_array_elements(v_result -> 'rows') r where r ->> 'id' = s.first_result ->> 'id'
  ) then raise exception 'saved row missing from monthly list'; end if;
end $$;

-- A real update needs the exact server timestamp; changes are monotonically versioned.
update repair_ledger_test_state set latest_result = public.save_repair_work_ledger(
  payload || jsonb_build_object('id',first_result ->> 'id','updated_at',first_result ->> 'updated_at',
    'amount','0.00','status','paid','accounting_document_number','ACC-ROLLBACK','paid_date','2026-10-19')
);

do $$ declare s repair_ledger_test_state%rowtype; v_bad jsonb; begin
  select * into s from repair_ledger_test_state;
  if s.latest_result ->> 'amount' <> '0.00' or s.latest_result ->> 'status' <> 'paid'
    or (s.latest_result ->> 'updated_at')::timestamptz <= (s.first_result ->> 'updated_at')::timestamptz then
    raise exception 'zero amount, paid status or monotonic optimistic version failed';
  end if;
  begin perform public.save_repair_work_ledger(s.payload || jsonb_build_object('id',s.first_result ->> 'id',
      'updated_at',s.first_result ->> 'updated_at','amount','999.99'));
    raise exception 'stale write unexpectedly succeeded'; exception when serialization_failure then null; end;
  begin perform public.save_repair_work_ledger(s.payload || jsonb_build_object('id',s.first_result ->> 'id'));
    raise exception 'unversioned write unexpectedly succeeded'; exception when serialization_failure then null; end;
  if (select amount from public.repair_work_ledger where id = (s.first_result ->> 'id')::uuid) <> 0 then
    raise exception 'stale write overwrote amount';
  end if;
  for v_bad in select value from jsonb_array_elements('[
    {"amount":"-1"},{"amount":"1.234"},{"amount":"NaN"},{"amount":"Infinity"},
    {"amount":"1e3"},{"amount":"10000000000.00"},{"machine_hours":"-1"},
    {"repair_date":"2026-02-30"},{"repair_date":"19/10/2026"},
    {"paid_date":"2026-02-30"},{"status":"not_a_stage"},{"plate_number":" "},
    {"repair_description":" "},{"client_request_id":null},{"created_by":"00000000-0000-0000-0000-000000000001"}
  ]'::jsonb) loop
    begin perform public.save_repair_work_ledger(s.payload || v_bad);
      raise exception 'invalid input unexpectedly succeeded: %', v_bad;
    exception when invalid_parameter_value then null; end;
  end loop;
  begin update public.repair_work_ledger set updated_at = now() where id = (s.first_result ->> 'id')::uuid;
    raise exception 'direct audit edit unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin delete from public.repair_work_ledger where id = (s.first_result ->> 'id')::uuid;
    raise exception 'admin delete unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;

-- A signed-in non-admin cannot elevate themselves through editable user_metadata.
reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role','authenticated',
  'app_metadata',jsonb_build_object('role','staff'),'user_metadata',jsonb_build_object('role','admin'))::text, true)
from repair_ledger_test_state;
set local role authenticated;
do $$ declare v_rows bigint; begin
  if exists (select 1 from public.repair_work_ledger) then raise exception 'nonadmin can read ledger'; end if;
  begin perform public.list_repair_work_ledger(date '2026-10-01');
    raise exception 'nonadmin list unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin perform public.save_repair_work_ledger((select payload from repair_ledger_test_state));
    raise exception 'nonadmin save unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin insert into public.repair_work_ledger (repair_date,plate_number,repair_description,client_request_id)
      values (date '2026-10-19','TEST-NONADMIN','test',gen_random_uuid());
    raise exception 'nonadmin insert unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  update public.repair_work_ledger set status = 'submitted_review';
  get diagnostics v_rows = row_count;
  if v_rows <> 0 then raise exception 'nonadmin update changed rows'; end if;
  begin delete from public.repair_work_ledger;
    raise exception 'nonadmin delete unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claims', jsonb_build_object('sub', admin_id, 'role','authenticated',
  'app_metadata',jsonb_build_object('role','admin'))::text, true) from repair_ledger_test_state;
set local role authenticated;

-- Import a virtual maintenance row. It must disappear as a virtual duplicate after save.
do $$ declare s repair_ledger_test_state%rowtype; v_month date; v_list jsonb; v_virtual jsonb; v_saved jsonb; begin
  select * into s from repair_ledger_test_state;
  v_month := date_trunc('month', coalesce(s.canonical_before ->> 'completed_at',s.canonical_before ->> 'reported_at')::timestamptz at time zone 'Asia/Bangkok')::date;
  v_list := public.list_repair_work_ledger(v_month,s.source_car_id);
  select value into v_virtual from jsonb_array_elements(v_list -> 'rows')
    where value ->> 'source_id' = s.source_id::text;
  if v_virtual is null or v_virtual -> 'id' <> 'null'::jsonb
    or v_virtual ->> 'client_request_id' <> s.source_id::text
    or v_virtual ->> 'source_type' <> 'maintenance' then
    raise exception 'virtual maintenance source missing or unstable';
  end if;
  if s.canonical_before ->> 'billing_status' <> 'billed' and v_virtual -> 'amount' <> 'null'::jsonb then
    raise exception 'unbilled amount must stay unknown';
  end if;
  v_virtual := v_virtual - 'created_at';
  begin perform public.save_repair_work_ledger(v_virtual || '{"car_id":null}'::jsonb);
    raise exception 'mismatched source car unexpectedly succeeded'; exception when invalid_parameter_value then null; end;
  v_saved := public.save_repair_work_ledger(v_virtual || '{"department":"แผนกแก้เอง","shop_name":"ร้านแก้เอง","status":"committee_signed"}'::jsonb);
  update repair_ledger_test_state set linked_result = v_saved;
  v_list := public.list_repair_work_ledger(v_month,s.source_car_id);
  if (select count(*) from jsonb_array_elements(v_list -> 'rows') r where r ->> 'source_id' = s.source_id::text) <> 1 then
    raise exception 'linked maintenance was duplicated';
  end if;
  if not exists (select 1 from jsonb_array_elements(v_list -> 'rows') r
      where r ->> 'id' = v_saved ->> 'id' and r ->> 'department' = 'แผนกแก้เอง'
        and r ->> 'shop_name' = 'ร้านแก้เอง' and r ->> 'status' = 'committee_signed') then
    raise exception 'manual snapshots were overwritten by source';
  end if;
  begin perform public.save_repair_work_ledger((v_saved - 'created_at') || '{"source_id":null,"source_type":"manual"}'::jsonb);
    raise exception 'immutable source unexpectedly changed'; exception when invalid_parameter_value then null; end;
  begin perform public.list_repair_work_ledger(date '1899-12-01');
    raise exception 'invalid month unexpectedly accepted'; exception when invalid_parameter_value then null; end;
end $$;

reset role;
do $$ declare s repair_ledger_test_state%rowtype; begin
  select * into s from repair_ledger_test_state;
  if (select to_jsonb(m) from public.car_maintenance_records m where m.id = s.source_id) is distinct from s.canonical_before then
    raise exception 'canonical maintenance was changed';
  end if;
  if coalesce((select jsonb_agg(to_jsonb(i) order by i.repair_item_code)
    from public.car_maintenance_repair_items i where i.maintenance_record_id = s.source_id),'[]'::jsonb)
    is distinct from s.canonical_items_before then raise exception 'canonical repair items changed'; end if;
  if (select count(*) from public.trip_logs) <> s.trip_count_before then raise exception 'trip rows changed'; end if;
  raise notice 'PASS: repair ledger anonymous/nonadmin denial, admin roundtrip, retry, optimistic concurrency, validation, source import, editable snapshots and canonical isolation';
end $$;

rollback;
