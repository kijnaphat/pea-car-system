-- Run as migration owner after repair_ledger_discord_notifications.
-- Safe transactional verification: ONLY temporary ledger/outbox rows are written.
-- All writes ROLLBACK. Never calls a queue processor, HTTP, or any live webhook.
-- Existing car/staff/trip/maintenance records are read only, never fabricated.
begin;
set local statement_timeout='20s';
create temporary table repair_ledger_discord_test_state (
  staff_code text,staff_id bigint,staff_name text,car_id bigint,plate text,
  usage_date date,source_id uuid,source2_id uuid,payload jsonb,saved jsonb
) on commit drop;
insert into repair_ledger_discord_test_state(staff_code,staff_id,staff_name,car_id,plate,usage_date,source_id,source2_id)
select s.staff_code,s.id,s.full_name,c.id,c.plate_number,u.day,
  (select m.id from public.car_maintenance_records m where m.car_id=c.id
    and not exists(select 1 from public.repair_work_ledger l where l.maintenance_record_id=m.id)
    order by m.id limit 1),
  (select m.id from public.car_maintenance_records m where m.car_id=c.id
    and not exists(select 1 from public.repair_work_ledger l where l.maintenance_record_id=m.id)
    order by m.id offset 1 limit 1)
from (select id,staff_code,full_name from public.staff where staff_code ~ '^[0-9]{1,7}$' order by id limit 1) s
cross join lateral (
  select t.car_id,(t.start_time at time zone 'Asia/Bangkok')::date as day
  from public.trip_logs t join public.cars c on c.id=t.car_id
  where t.is_completed is true and public.effective_trip_activity(t.activity_type,c.fuel_type)='usage'
    and (t.start_time at time zone 'Asia/Bangkok')::date <= (now() at time zone 'Asia/Bangkok')::date
  order by (select count(*) from public.car_maintenance_records m where m.car_id=t.car_id
    and not exists(select 1 from public.repair_work_ledger l where l.maintenance_record_id=m.id)) desc,
    t.start_time desc limit 1
) u join public.cars c on c.id=u.car_id;

create function pg_temp.repair_discord_assert(p_ok boolean,p_message text)
returns void language plpgsql security invoker as $$
begin if not coalesce(p_ok,false) then raise exception '%',p_message; end if; end;
$$;

do $$ declare s repair_ledger_discord_test_state%rowtype; v_signature text; begin
  select * into s from repair_ledger_discord_test_state;
  perform pg_temp.repair_discord_assert(found,'Test requires existing numeric staff and completed driving trip');
  foreach v_signature in array array[
    'private.capture_repair_ledger_discord_event()',
    'private.repair_ledger_discord_status_label(text)',
    'private.repair_ledger_discord_date(date)'
  ] loop
    perform pg_temp.repair_discord_assert(not has_function_privilege('anon',v_signature,'EXECUTE')
      and not has_function_privilege('authenticated',v_signature,'EXECUTE')
      and not has_function_privilege('service_role',v_signature,'EXECUTE'),'Private Discord helper exposed: '||v_signature);
  end loop;
  perform pg_temp.repair_discord_assert(not has_table_privilege('anon','public.repair_work_ledger','INSERT,UPDATE,DELETE')
    and not has_table_privilege('anon','public.audit_events','SELECT,INSERT,UPDATE,DELETE'),'Unchecked ledger/outbox exposed to anon');
  perform pg_temp.repair_discord_assert(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname in('capture_repair_ledger_discord_event',
      'repair_ledger_discord_status_label','repair_ledger_discord_date') and p.prosecdef),'New helper unnecessarily bypasses RLS');
  perform pg_temp.repair_discord_assert(private.repair_ledger_discord_date(date '2026-10-21')='21/10/2569'
    and private.repair_ledger_discord_date(null)='ยังไม่ระบุ','Thai calendar/date NULL labels incorrect');
  perform pg_temp.repair_discord_assert(private.repair_ledger_discord_status_label('')='รอดำเนินการ'
    and private.repair_ledger_discord_status_label(null)='รอดำเนินการ'
    and private.repair_ledger_discord_status_label('committee_signed')='คณะกรรมการลงนามแล้ว'
    and private.repair_ledger_discord_status_label('submitted_executive')='เสนอผู้บริหาร'
    and private.repair_ledger_discord_status_label('submitted_review')='ส่งตรวจเสนอ'
    and private.repair_ledger_discord_status_label('paid')='รับเงินแล้ว','Thai status labels changed');
  update repair_ledger_discord_test_state set payload=jsonb_build_object(
    'source_type','manual','client_request_id',gen_random_uuid(),'car_id',s.car_id,
    'repair_date',s.usage_date-1,'usage_date',s.usage_date,'plate_number',s.plate,
    'department','Discord rollback department','repair_description','ROLLBACK Discord canonical repair',
    'amount',null,'status','','shop_name','ROLLBACK Discord shop','bill_number','TEST-ROLLBACK',
    'accounting_document_number','SENSITIVE-ACCOUNTING-DO-NOT-SEND','paid_date',s.usage_date);
end $$;
grant select,update on repair_ledger_discord_test_state to anon;
set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ declare s repair_ledger_discord_test_state%rowtype; v_saved jsonb; begin
  select * into s from repair_ledger_discord_test_state;
  begin perform public.save_repair_work_ledger_staff(null,s.payload);
    raise exception 'Anonymous create without staff accepted'; exception when insufficient_privilege then null; end;
  begin perform public.save_repair_work_ledger_staff(s.staff_code,s.payload-'usage_date');
    raise exception 'Invalid create accepted'; exception when invalid_parameter_value then null; end;
  v_saved:=public.save_repair_work_ledger_staff(s.staff_code,s.payload);
  if public.save_repair_work_ledger_staff(s.staff_code,s.payload) is distinct from v_saved then
    raise exception 'Identical insert retry returned a different record'; end if;
  begin perform public.save_repair_work_ledger_staff(s.staff_code,s.payload||'{"amount":"7.77"}');
    raise exception 'Changed insert retry accepted'; exception when serialization_failure then null; end;
  update repair_ledger_discord_test_state set saved=v_saved;
end $$;
reset role;

do $$ declare s repair_ledger_discord_test_state%rowtype; e public.audit_events%rowtype;
  v_edit jsonb; v_saved jsonb; v_status text; v_old text:=''; v_count integer:=1; v_fields jsonb;
begin
  select * into s from repair_ledger_discord_test_state;
  perform pg_temp.repair_discord_assert((select count(*) from public.audit_events
    where entity_type='repair_work_ledger' and entity_id=s.saved->>'id')=1,'Insert retry or invalid request duplicated alert');
  select * into e from public.audit_events where entity_type='repair_work_ledger' and entity_id=s.saved->>'id';
  perform pg_temp.repair_discord_assert(e.event_type='maintenance.ledger_created'
    and e.intended_channel_key='maintenance_billing' and e.actor_label=s.staff_name,'Wrong created event, channel or validated staff actor');
  v_fields:=e.details->'fields';
  perform pg_temp.repair_discord_assert(exists(select 1 from jsonb_array_elements(v_fields) f
    where f->>'name'='จำนวนเงิน' and f->>'value'='รอระบุยอด'),'Unknown amount incorrectly displayed as zero');
  perform pg_temp.repair_discord_assert(exists(select 1 from jsonb_array_elements(v_fields) f
    where f->>'name'='วันที่ซ่อมจริง' and f->>'value'=private.repair_ledger_discord_date(s.usage_date-1))
    and exists(select 1 from jsonb_array_elements(v_fields) f
      where f->>'name'='วันที่ลง ยพ.6' and f->>'value'=private.repair_ledger_discord_date(s.usage_date)),
    'Repair and usage dates mixed up');
  -- Full-form no-op and ordinary detail/accounting edits must stay silent.
  v_edit:=s.payload||jsonb_build_object('id',s.saved->>'id','updated_at',s.saved->>'updated_at');
  v_saved:=public.save_repair_work_ledger_staff(s.staff_code,v_edit);
  v_edit:=v_edit||jsonb_build_object('updated_at',v_saved->>'updated_at','amount','0.00',
    'repair_description','ROLLBACK Discord edited details','shop_name','Edited shop');
  v_saved:=public.save_repair_work_ledger_staff(s.staff_code,v_edit);
  perform pg_temp.repair_discord_assert((select count(*) from public.audit_events
    where entity_type='repair_work_ledger' and entity_id=s.saved->>'id')=1,'No-op/detail edit generated a status alert');
  -- Test every supported transition, including returning to pending.
  foreach v_status in array array['committee_signed','submitted_executive','submitted_review','paid',''] loop
    v_edit:=v_edit||jsonb_build_object('updated_at',v_saved->>'updated_at','status',v_status);
    v_saved:=public.save_repair_work_ledger_staff(s.staff_code,v_edit);
    v_count:=v_count+1;
    perform pg_temp.repair_discord_assert((select count(*) from public.audit_events
      where entity_type='repair_work_ledger' and entity_id=s.saved->>'id')=v_count,'Actual status transition not queued exactly once');
    select * into e from public.audit_events where entity_type='repair_work_ledger' and entity_id=s.saved->>'id'
      and event_type='maintenance.ledger_status_changed' and details->'audit'->>'old_status'=v_old
      and details->'audit'->>'new_status'=v_status;
    perform pg_temp.repair_discord_assert(found,'Status transition old/new values missing');
    perform pg_temp.repair_discord_assert(exists(select 1 from jsonb_array_elements(e.details->'fields') f
      where f->>'name'='สถานะเดิม' and f->>'value'=private.repair_ledger_discord_status_label(v_old))
      and exists(select 1 from jsonb_array_elements(e.details->'fields') f
        where f->>'name'='สถานะใหม่' and f->>'value'=private.repair_ledger_discord_status_label(v_status))
      and exists(select 1 from jsonb_array_elements(e.details->'fields') f
        where f->>'name'='จำนวนเงิน' and f->>'value'='0.00 บาท'),'Thai old/new or genuine zero amount wrong');
    begin perform public.save_repair_work_ledger_staff(s.staff_code,v_edit);
      raise exception 'Stale status edit accepted'; exception when serialization_failure then null; end;
    perform pg_temp.repair_discord_assert((select count(*) from public.audit_events
      where entity_type='repair_work_ledger' and entity_id=s.saved->>'id')=v_count,'Stale edit created an alert');
    v_old:=v_status;
  end loop;
  update repair_ledger_discord_test_state set saved=v_saved;
end $$;

do $$ declare s repair_ledger_discord_test_state%rowtype; v_import jsonb; v_zero jsonb;
  v_link jsonb; v_payload jsonb; v_count bigint; v_rollback_id uuid:=gen_random_uuid();
begin
  select * into s from repair_ledger_discord_test_state;
  -- Creating an already-paid entry emits only created, not an extra status event.
  v_payload:=s.payload||jsonb_build_object('client_request_id',gen_random_uuid(),'status','paid','amount','0.00',
    'repair_description',repeat('รายละเอียดซ่อม ',300));
  v_zero:=public.save_repair_work_ledger_staff(s.staff_code,v_payload);
  perform public.save_repair_work_ledger_staff(s.staff_code,v_payload);
  perform pg_temp.repair_discord_assert((select count(*) from public.audit_events
    where entity_type='repair_work_ledger' and entity_id=v_zero->>'id')=1
    and exists(select 1 from public.audit_events e where e.entity_id=v_zero->>'id'
      and e.event_type='maintenance.ledger_created'),'Non-default insert emitted duplicate/status alerts');
  if s.source_id is not null then
    v_payload:=s.payload||jsonb_build_object('client_request_id',gen_random_uuid(),'source_type','maintenance',
      'source_id',s.source_id,'repair_description','ROLLBACK Discord imported source');
    v_import:=public.save_repair_work_ledger_staff(s.staff_code,v_payload);
    perform public.save_repair_work_ledger_staff(s.staff_code,v_payload);
    begin perform public.save_repair_work_ledger_staff(s.staff_code,v_payload||jsonb_build_object('client_request_id',gen_random_uuid()));
      raise exception 'Same source imported twice'; exception when unique_violation then null; end;
    perform pg_temp.repair_discord_assert((select count(*) from public.audit_events
      where entity_type='repair_work_ledger' and entity_id=v_import->>'id')=1,'Import/retry duplicated created event');
  else raise notice 'No unused maintenance source; import check skipped'; end if;
  if s.source2_id is not null then
    select count(*) into v_count from public.audit_events where entity_type='repair_work_ledger' and entity_id=s.saved->>'id';
    v_link:=public.link_repair_ledger_source_staff(s.staff_code,(s.saved->>'id')::uuid,s.source2_id,(s.saved->>'updated_at')::timestamptz);
    perform public.link_repair_ledger_source_staff(s.staff_code,(s.saved->>'id')::uuid,s.source2_id,(s.saved->>'updated_at')::timestamptz);
    perform pg_temp.repair_discord_assert((select count(*) from public.audit_events
      where entity_type='repair_work_ledger' and entity_id=s.saved->>'id')=v_count,'Source linking emitted a repair/status alert');
  else raise notice 'No second unused source; linking check skipped'; end if;
  -- The inserted row and its queued event must roll back atomically.
  select count(*) into v_count from public.audit_events;
  begin
    perform public.save_repair_work_ledger_staff(s.staff_code,s.payload||jsonb_build_object(
      'client_request_id',v_rollback_id,'repair_description','ROLLBACK Discord nested transaction'));
    raise exception using errcode='ZX001',message='Expected nested rollback';
  exception when sqlstate 'ZX001' then null; end;
  perform pg_temp.repair_discord_assert((select count(*) from public.audit_events)=v_count
    and not exists(select 1 from public.repair_work_ledger where client_request_id=v_rollback_id),
    'Rollback leaked ledger or outbox event');
end $$;

-- Legacy authenticated admin edits must not attribute a change to the original staff creator.
-- Use an existing auth user only; never create accounts in the production rollback test.
do $$ declare s repair_ledger_discord_test_state%rowtype; v_admin uuid; v_saved jsonb;
  e public.audit_events%rowtype;
begin
  select id into v_admin from auth.users order by created_at limit 1;
  if v_admin is null then raise notice 'No existing auth user; admin actor regression skipped'; return; end if;
  select * into s from repair_ledger_discord_test_state;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated',
    'app_metadata',jsonb_build_object('role','admin'))::text,true);
  perform set_config('request.jwt.claim.sub',v_admin::text,true);
  v_saved:=public.save_repair_work_ledger(s.payload||jsonb_build_object('id',s.saved->>'id',
    'updated_at',(select updated_at from public.repair_work_ledger where id=(s.saved->>'id')::uuid),
    'source_type',(select source_type from public.repair_work_ledger where id=(s.saved->>'id')::uuid),
    'source_id',(select maintenance_record_id from public.repair_work_ledger where id=(s.saved->>'id')::uuid),
    'status','committee_signed'));
  select * into e from public.audit_events where entity_type='repair_work_ledger' and entity_id=v_saved->>'id'
    and actor_user_id=v_admin and event_type='maintenance.ledger_status_changed';
  perform pg_temp.repair_discord_assert(found and e.actor_label='ผู้ดูแลระบบ',
    'Admin update was incorrectly attributed to the historical staff creator');
  perform set_config('request.jwt.claims','{}',true);
  perform set_config('request.jwt.claim.sub','',true);
end $$;

do $$ declare e public.audit_events%rowtype; f jsonb; v_payload jsonb; v_length integer; begin
  for e in select audit.* from public.audit_events audit join public.repair_work_ledger l on l.id::text=audit.entity_id
    where audit.entity_type='repair_work_ledger' and (l.repair_description like 'ROLLBACK Discord%'
      or audit.actor_label=(select staff_name from repair_ledger_discord_test_state)
        and audit.details::text like '%TEST-ROLLBACK%')
  loop
    perform pg_temp.repair_discord_assert(e.details::text not like '%SENSITIVE-ACCOUNTING-DO-NOT-SEND%'
      and not exists(select 1 from jsonb_object_keys(e.details->'audit') k
        where k in('staff_code','p_staff_code','client_request_id','accounting_document_number',
          'updated_by_staff_id','created_by_staff_id','old','new')),'Private staff/accounting/raw row data leaked');
    v_payload:=private.build_discord_audit_payload(e);
    perform pg_temp.repair_discord_assert(v_payload->'allowed_mentions'->'parse'='[]'::jsonb,'User content can ping Discord mentions');
    perform pg_temp.repair_discord_assert(jsonb_array_length(e.details->'fields')<=25,'Discord field count limit exceeded');
    v_length:=char_length(e.title)+coalesce(char_length(e.description),0)+200;
    for f in select value from jsonb_array_elements(e.details->'fields') loop
      perform pg_temp.repair_discord_assert(char_length(f->>'name')<=256 and char_length(f->>'value')<=1024,
        'Discord name/value limits exceeded');
      v_length:=v_length+char_length(f->>'name')+char_length(f->>'value');
    end loop;
    perform pg_temp.repair_discord_assert(v_length<=6000,'Discord aggregate embed text limit exceeded');
    perform pg_temp.repair_discord_assert(e.intended_channel_key='maintenance_billing','Alert sent to an unintended logical channel');
    perform pg_temp.repair_discord_assert(e.delivery_channel_key='maintenance_billing'
      and e.delivery_status='pending','Configured repair channel not selected or event not queued');
  end loop;
end $$;
rollback;
select 'repair ledger Discord checks passed (all writes rolled back; no HTTP processing)' as result;
