-- Run as migration owner after repair_ledger_usage_date_yp6, against a test DB
-- or existing deployment. ONLY repair_work_ledger test rows are written and all
-- writes ROLLBACK. Never creates/changes a car, staff, trip or maintenance report.
begin;
set local statement_timeout='20s';
create temporary table repair_ledger_usage_test_state (
  staff_code text,staff_id bigint,staff_name text,car_id bigint,plate text,
  usage_date date,other_date date,month date,unused_date date,source_id uuid,
  canonical_before jsonb,payload jsonb,saved jsonb,updated jsonb,legacy jsonb
) on commit drop;
insert into repair_ledger_usage_test_state(staff_code,staff_id,staff_name,car_id,plate,usage_date,other_date,month,unused_date,source_id,canonical_before)
select s.staff_code,s.id,s.full_name,c.id,c.plate_number,u.day,u.other_day,date_trunc('month',u.day)::date,
  (select x::date from generate_series(date '1900-01-01',date '1900-02-01',interval '1 day') x
    where not exists(select 1 from public.trip_logs t where t.car_id=c.id
      and (t.start_time at time zone 'Asia/Bangkok')::date=x::date) limit 1),
  (select m.id from public.car_maintenance_records m where m.car_id=c.id
    and not exists(select 1 from public.repair_work_ledger l where l.maintenance_record_id=m.id)
    order by m.reported_at limit 1),
  jsonb_build_object('trips',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.trip_logs t),
    'maintenance',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') from public.car_maintenance_records m),
    'cars',(select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]') from public.cars v))
from (select id,staff_code,full_name from public.staff where staff_code ~ '^[0-9]{1,7}$' order by id limit 1) s
cross join lateral (
  select t.car_id,(t.start_time at time zone 'Asia/Bangkok')::date as day,
    (select (t2.start_time at time zone 'Asia/Bangkok')::date
      from public.trip_logs t2 join public.cars c2 on c2.id=t2.car_id
      where t2.car_id=t.car_id and t2.is_completed is true
        and public.effective_trip_activity(t2.activity_type,c2.fuel_type)='usage'
        and (t2.start_time at time zone 'Asia/Bangkok')::date<(t.start_time at time zone 'Asia/Bangkok')::date
      order by t2.start_time desc limit 1) as other_day
  from public.trip_logs t join public.cars c on c.id=t.car_id
  where t.is_completed is true and public.effective_trip_activity(t.activity_type,c.fuel_type)='usage'
    and (t.start_time at time zone 'Asia/Bangkok')::date <= (now() at time zone 'Asia/Bangkok')::date
  order by exists(select 1 from public.car_maintenance_records m where m.car_id=t.car_id
    and not exists(select 1 from public.repair_work_ledger l where l.maintenance_record_id=m.id)) desc,
    t.start_time desc limit 1
) u join public.cars c on c.id=u.car_id;

do $$ declare s repair_ledger_usage_test_state%rowtype; begin
  select * into s from repair_ledger_usage_test_state;
  if not found then raise exception 'Test requires existing numeric staff and completed driving trip'; end if;
  if has_table_privilege('anon','public.repair_work_ledger','SELECT,INSERT,UPDATE,DELETE')
    or has_column_privilege('authenticated','public.repair_work_ledger','amount','UPDATE')
    or has_column_privilege('authenticated','public.repair_work_ledger','repair_date','INSERT') then
    raise exception 'Unchecked table writes exposed';
  end if;
  if has_function_privilege('anon','private.require_repair_ledger_usage_date(bigint,date)','EXECUTE')
    or has_function_privilege('anon','private.list_repair_ledger_usage_dates_core(bigint,date)','EXECUTE')
    or has_function_privilege('anon','private.link_repair_ledger_source_core(uuid,uuid,timestamptz,bigint,text)','EXECUTE') then
    raise exception 'Private unchecked core exposed';
  end if;
  -- A legacy bookkeeping row deliberately has NO guessed usage day.
  insert into public.repair_work_ledger(car_id,repair_date,plate_number,repair_description,client_request_id,
    updated_by_staff_id,updated_by_staff_name)
  values(s.car_id,s.usage_date,s.plate,'ROLLBACK legacy ledger usage test',gen_random_uuid(),s.staff_id,s.staff_name);
  update repair_ledger_usage_test_state set legacy=(select (to_jsonb(l)-'maintenance_record_id')
      ||jsonb_build_object('source_id',l.maintenance_record_id)
    from public.repair_work_ledger l where l.repair_description='ROLLBACK legacy ledger usage test'
    order by l.created_at desc limit 1),
    payload=jsonb_build_object('source_type','manual','client_request_id',gen_random_uuid(),'car_id',s.car_id,
      'repair_date',s.usage_date,'usage_date',s.usage_date,'plate_number',s.plate,'department','',
      'repair_description','ROLLBACK canonical ledger usage test','amount','123.45','machine_hours','1.25',
      'shop_name','ROLLBACK Test Shop','bill_number','TEST-ROLLBACK-001');
end $$;
grant select,update on repair_ledger_usage_test_state to anon;
set local role anon;
select set_config('request.jwt.claims','{}',true);

do $$ declare s repair_ledger_usage_test_state%rowtype; v_dates jsonb; v_report jsonb; v_list jsonb; v_saved jsonb; v_bad jsonb; begin
  select * into s from repair_ledger_usage_test_state;
  begin perform public.list_repair_ledger_usage_dates_staff(null,s.car_id,s.month);
    raise exception 'Usage dates accepted no staff'; exception when insufficient_privilege then null; end;
  begin perform public.link_repair_ledger_source_staff(null,gen_random_uuid(),gen_random_uuid(),now());
    raise exception 'Source linking accepted no staff'; exception when insufficient_privilege then null; end;
  begin perform public.find_repair_ledger_duplicates_staff(null,'{}');
    raise exception 'Duplicate lookup accepted no staff'; exception when insufficient_privilege then null; end;
  v_dates:=public.list_repair_ledger_usage_dates_staff(s.staff_code,s.car_id,s.month);
  if not exists(select 1 from jsonb_array_elements(v_dates) d where d->>'usage_date'=s.usage_date::text
    and (d->>'trip_count')::integer>0) then raise exception 'Completed usage date missing'; end if;
  if exists(select 1 from jsonb_array_elements(v_dates) d where d->>'usage_date'=s.unused_date::text)
    then raise exception 'Non-driving date offered'; end if;
  foreach v_bad in array array[
    s.payload-'usage_date',s.payload||jsonb_build_object('usage_date',s.unused_date),
    s.payload||jsonb_build_object('usage_date',(now() at time zone 'Asia/Bangkok')::date+1),
    s.payload||jsonb_build_object('usage_date','2026-02-30'),
    s.payload||jsonb_build_object('car_id',null),
    s.payload||jsonb_build_object('created_by_staff_name','forged')
  ] loop
    begin perform public.save_repair_work_ledger_staff(s.staff_code,v_bad);
      raise exception 'Invalid date/car/audit accepted'; exception when invalid_parameter_value then null; end;
  end loop;
  v_saved:=public.save_repair_work_ledger_staff(s.staff_code,s.payload);
  if public.save_repair_work_ledger_staff(s.staff_code,s.payload) is distinct from v_saved then
    raise exception 'Identical request retry did not return same record';
  end if;
  begin perform public.save_repair_work_ledger_staff(s.staff_code,s.payload||'{"amount":"9.99"}');
    raise exception 'Changed retry silently accepted'; exception when serialization_failure then null; end;
  update repair_ledger_usage_test_state set saved=v_saved;
  v_report:=public.list_repair_ledger_yp6(s.car_id,s.month);
  if (select count(*) from jsonb_array_elements(v_report->'rows') r where r->>'id'=v_saved->>'id')<>1 then
    raise exception 'YP6 must project exactly once';
  end if;
  if not exists(select 1 from jsonb_array_elements(v_report->'rows') r where r->>'id'=v_saved->>'id'
      and r->>'amount'='123.45' and r->>'usage_date'=s.usage_date::text) then
    raise exception 'YP6 wrong day or exact monetary value';
  end if;
  if exists(select 1 from jsonb_array_elements(v_report->'rows') r, jsonb_object_keys(r) k
    where k not in ('id','car_id','usage_date','repair_description','amount','machine_hours','source_id')) then
    raise exception 'Public report leaked private bookkeeping fields';
  end if;
  v_list:=public.list_repair_work_ledger_staff(s.staff_code,s.month,s.car_id);
  if not (v_list ? 'inbox') or not exists(select 1 from jsonb_array_elements(v_list->'rows') r where r->>'id'=v_saved->>'id')
    or exists(select 1 from jsonb_array_elements(v_list->'rows') r where r->>'id' is null)
    or exists(select 1 from jsonb_array_elements(v_list->'inbox') r where r->>'id' is not null) then
    raise exception 'Saved ledger and optional inbox mixed';
  end if;
end $$;

do $$ declare s repair_ledger_usage_test_state%rowtype; v_edit jsonb; v_saved jsonb; v_report jsonb; v_dupes jsonb; begin
  select * into s from repair_ledger_usage_test_state;
  v_edit:=s.payload||jsonb_build_object('id',s.saved->>'id','updated_at',s.saved->>'updated_at','amount',null,'status','paid');
  v_saved:=public.save_repair_work_ledger_staff(s.staff_code,v_edit);
  begin perform public.save_repair_work_ledger_staff(s.staff_code,v_edit);
    raise exception 'Stale edit silently overwrote record'; exception when serialization_failure then null; end;
  v_report:=public.list_repair_ledger_yp6(s.car_id,s.month);
  if not exists(select 1 from jsonb_array_elements(v_report->'rows') r where r->>'id'=v_saved->>'id' and r->'amount'='null'::jsonb)
    then raise exception 'Unknown amount converted to zero'; end if;
  if s.other_date is not null then
    v_edit:=v_edit||jsonb_build_object('updated_at',v_saved->>'updated_at','usage_date',s.other_date);
    v_saved:=public.save_repair_work_ledger_staff(s.staff_code,v_edit);
    v_report:=public.list_repair_ledger_yp6(s.car_id,date_trunc('month',s.other_date)::date);
    if not exists(select 1 from jsonb_array_elements(v_report->'rows') r where r->>'id'=v_saved->>'id' and r->>'usage_date'=s.other_date::text)
      then raise exception 'Historical usage-date move not reflected'; end if;
  end if;
  update repair_ledger_usage_test_state set updated=v_saved;
  -- Candidate is found by normalized shop/bill even from a different usage month.
  v_dupes:=public.find_repair_ledger_duplicates_staff(s.staff_code,jsonb_build_object('car_id',s.car_id,
    'usage_date',date '1900-01-01','repair_date',date '1900-01-01','repair_description','another description',
    'shop_name',' rollback   test shop ','bill_number',' test-rollback-001 '));
  if not exists(select 1 from jsonb_array_elements(v_dupes) r where r->>'id'=v_saved->>'id'
      and r->>'updated_at'=v_saved->>'updated_at' and r->>'client_request_id'=v_saved->>'client_request_id') then
    raise exception 'Cross-month probable duplicate missing its editable revision';
  end if;
  v_dupes:=public.find_repair_ledger_duplicates_staff(s.staff_code,jsonb_build_object('car_id',s.car_id,
    'id',v_saved->>'id','shop_name','ROLLBACK Test Shop','bill_number','TEST-ROLLBACK-001'));
  if exists(select 1 from jsonb_array_elements(v_dupes) r where r->>'id'=v_saved->>'id') then
    raise exception 'Duplicate lookup returned the record being edited';
  end if;
  -- Updating an unmapped legacy row is allowed without silently mapping it.
  v_edit:=jsonb_build_object('id',s.legacy->>'id','source_type','manual','client_request_id',s.legacy->>'client_request_id',
    'updated_at',s.legacy->>'updated_at','car_id',s.car_id,'repair_date',s.usage_date,'usage_date',null,
    'plate_number',s.plate,'repair_description','ROLLBACK legacy ledger usage test','status','paid');
  v_saved:=public.save_repair_work_ledger_staff(s.staff_code,v_edit);
  if v_saved->'usage_date'<>'null'::jsonb then raise exception 'Legacy date was invented'; end if;
  begin perform public.save_repair_work_ledger_staff(s.staff_code,v_edit||jsonb_build_object(
      'updated_at',v_saved->>'updated_at','amount','10.00'));
    raise exception 'Legacy report values changed before selecting usage day';
    exception when invalid_parameter_value then null; end;
end $$;

do $$ declare s repair_ledger_usage_test_state%rowtype; v_link jsonb; v_list jsonb; v_report jsonb; begin
  select * into s from repair_ledger_usage_test_state;
  if s.source_id is null then return; end if;
  v_link:=public.link_repair_ledger_source_staff(s.staff_code,(s.updated->>'id')::uuid,s.source_id,(s.updated->>'updated_at')::timestamptz);
  if v_link->>'source_id'<>s.source_id::text or v_link->>'id'<>s.updated->>'id' then raise exception 'Link copied record instead of attaching source'; end if;
  if public.link_repair_ledger_source_staff(s.staff_code,(s.updated->>'id')::uuid,s.source_id,(s.updated->>'updated_at')::timestamptz) is distinct from v_link
    then raise exception 'Identical link retry not idempotent'; end if;
  v_report:=public.list_repair_ledger_yp6(s.car_id,date '1900-01-01');
  if not (v_report->'linked_source_ids' ? s.source_id::text) then raise exception 'Cross-month source dedup missing'; end if;
  begin perform public.save_repair_work_ledger_staff(s.staff_code,s.payload||jsonb_build_object(
    'client_request_id',gen_random_uuid(),'source_type','maintenance','source_id',s.source_id));
    raise exception 'Same maintenance imported twice'; exception when unique_violation then null; end;
end $$;
reset role;
do $$ declare s repair_ledger_usage_test_state%rowtype; v_after jsonb; begin
  select * into s from repair_ledger_usage_test_state;
  v_after:=jsonb_build_object('trips',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.trip_logs t),
    'maintenance',(select coalesce(jsonb_agg(to_jsonb(m) order by m.id),'[]') from public.car_maintenance_records m),
    'cars',(select coalesce(jsonb_agg(to_jsonb(v) order by v.id),'[]') from public.cars v));
  if v_after is distinct from s.canonical_before then raise exception 'Canonical operational data changed'; end if;
end $$;
rollback;
select 'repair ledger usage-date / YP6 checks passed (all writes rolled back)' as result;
