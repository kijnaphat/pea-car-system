-- Canonical repair bookkeeping: explicit completed-usage day drives Y.P.6.
-- Filename aligned with the applied Supabase migration history version.
-- No inferred dates, fake trips, vehicle-status changes or destructive backfill.
alter table public.repair_work_ledger add column usage_date date;
alter table public.repair_work_ledger add constraint repair_work_ledger_usage_date_valid
  check (usage_date is null or (car_id is not null and usage_date between date '1900-01-01' and date '2200-12-31'));
alter table public.repair_work_ledger drop constraint repair_work_ledger_source_valid;
alter table public.repair_work_ledger add constraint repair_work_ledger_source_valid check (
  source_type in ('manual','report','maintenance')
  and (source_type <> 'maintenance' or maintenance_record_id is not null)
  and (maintenance_record_id is null or car_id is not null)
);
comment on column public.repair_work_ledger.usage_date is
  'Explicit Bangkok completed-driving day for Y.P.6; null is an unmapped legacy row. repair_date remains actual repair/bill date.';
comment on table public.repair_work_ledger is
  'Canonical repair ledger, optionally linked to a user maintenance report; selected usage_date projects once into Y.P.6.';
create index repair_work_ledger_car_usage_date_idx on public.repair_work_ledger(car_id,usage_date,id)
  where usage_date is not null;
-- Force writes through the checked RPCs; retain existing admin SELECT RLS.
revoke insert,update on public.repair_work_ledger from authenticated;
revoke insert (maintenance_record_id, car_id, repair_date, plate_number, department, shop_name,
  bill_number, amount, repair_description, status, accounting_document_number, paid_date,
  machine_hours, source_type, client_request_id) on public.repair_work_ledger from authenticated;
revoke update (car_id, repair_date, plate_number, department, shop_name, bill_number, amount,
  repair_description, status, accounting_document_number, paid_date, machine_hours)
  on public.repair_work_ledger from authenticated;

create function private.require_repair_ledger_usage_date(p_car_id bigint,p_usage_date date)
returns void language plpgsql stable security invoker set search_path = '' as $$
begin
  if p_car_id is null or p_car_id <= 0 or p_usage_date is null
      or p_usage_date > (now() at time zone 'Asia/Bangkok')::date
      or not exists (
        select 1 from public.trip_logs t join public.cars c on c.id=t.car_id
        where t.car_id=p_car_id and t.is_completed is true
          and t.start_time >= (p_usage_date::timestamp at time zone 'Asia/Bangkok')
          and t.start_time < ((p_usage_date+1)::timestamp at time zone 'Asia/Bangkok')
          and public.effective_trip_activity(t.activity_type,c.fuel_type)='usage'
      ) then
    raise exception using errcode = '22023', message = 'เลือกได้เฉพาะวันที่รถคันนี้มีรายการใช้งานที่คืนรถแล้ว ไม่รวมการชาร์จ';
  end if;
end;
$$;
revoke all on function private.require_repair_ledger_usage_date(bigint,date) from public,anon,authenticated,service_role;

create or replace function public.guard_repair_work_ledger()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_admin boolean := v_uid is not null
    and coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin';
  v_owner_context boolean;
  v_staff_name text;
  v_source_car bigint;
begin
  select current_user = pg_catalog.pg_get_userbyid(c.relowner)
    into v_owner_context from pg_catalog.pg_class c
    where c.oid = 'public.repair_work_ledger'::regclass;

  if v_owner_context and new.updated_by_staff_id is not null then
    select s.full_name into v_staff_name from public.staff s where s.id = new.updated_by_staff_id;
    if not found or new.updated_by_staff_name is distinct from v_staff_name then
      raise exception using errcode = '42501', message = 'กรุณายืนยันรหัสประจำตัวพนักงานก่อนใช้งาน';
    end if;
  elsif not v_admin then
    raise exception using errcode = '42501', message = 'กรุณายืนยันรหัสประจำตัวพนักงานก่อนใช้งาน';
  else
    -- A legacy admin edit must not be attributed to the previous staff editor.
    new.updated_by_staff_id := null;
    new.updated_by_staff_name := null;
  end if;

  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or (new.maintenance_record_id is distinct from old.maintenance_record_id and not (
         v_owner_context and new.updated_by_staff_id is not null
         and old.maintenance_record_id is null and new.maintenance_record_id is not null
         and new.car_id is not distinct from old.car_id))
       or new.client_request_id is distinct from old.client_request_id
       or new.source_type is distinct from old.source_type then
      raise exception using errcode = '22023', message = 'ไม่สามารถเปลี่ยนแหล่งที่มาของรายการที่บันทึกแล้ว';
    end if;
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.created_by_staff_id := old.created_by_staff_id;
    new.created_by_staff_name := old.created_by_staff_name;
    new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  else
    new.created_at := clock_timestamp();
    new.created_by := v_uid;
    new.updated_at := new.created_at;
    new.created_by_staff_id := new.updated_by_staff_id;
    new.created_by_staff_name := new.updated_by_staff_name;
  end if;
  if new.maintenance_record_id is not null then
    select m.car_id into v_source_car from public.car_maintenance_records m where m.id = new.maintenance_record_id;
    if not found or new.car_id is distinct from v_source_car then
      raise exception using errcode = '22023', message = 'รถไม่ตรงกับรายการส่งซ่อมต้นทาง';
    end if;
  end if;
  if new.usage_date is not null and (tg_op = 'INSERT'
      or new.usage_date is distinct from old.usage_date or new.car_id is distinct from old.car_id) then
    perform private.require_repair_ledger_usage_date(new.car_id,new.usage_date);
  elsif tg_op = 'UPDATE' and old.usage_date is not null and new.usage_date is null then
    raise exception using errcode = '22023', message = 'ไม่สามารถลบวันที่ลงรายการใน ยพ.6';
  end if;
  new.updated_by := v_uid;
  return new;
end;
$$;
revoke all on function public.guard_repair_work_ledger() from public, anon, authenticated;


create or replace function private.save_repair_work_ledger_core(p_entry jsonb, p_staff_id bigint, p_staff_name text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_source_id uuid;
  v_request_id uuid;
  v_expected timestamptz;
  v_car_id bigint;
  v_date date;
  v_paid_date date;
  v_usage_date date;
  v_previous public.repair_work_ledger%rowtype;
  v_amount numeric;
  v_hours numeric;
  v_source_type text;
  v_status text;
  v_plate text;
  v_description text;
  v_department text;
  v_shop text;
  v_bill text;
  v_document text;
  v_value text;
  v_saved public.repair_work_ledger%rowtype;
begin
  if p_entry is null or jsonb_typeof(p_entry) <> 'object' then
    raise exception using errcode = '22023', message = 'ข้อมูลสมุดคุมงานซ่อมไม่ถูกต้อง';
  end if;
  if exists (select 1 from jsonb_object_keys(p_entry) k where k not in (
    'id','source_id','source_type','client_request_id','updated_at','car_id','repair_date','plate_number',
    'usage_date','department','shop_name','bill_number','amount','repair_description','status',
    'accounting_document_number','paid_date','machine_hours'
  )) then
    raise exception using errcode = '22023', message = 'มีฟิลด์ที่ไม่อนุญาตให้แก้ไข';
  end if;
  begin
    v_id := nullif(btrim(p_entry ->> 'id'), '')::uuid;
    v_source_id := nullif(btrim(p_entry ->> 'source_id'), '')::uuid;
    v_request_id := nullif(btrim(p_entry ->> 'client_request_id'), '')::uuid;
    v_car_id := nullif(btrim(p_entry ->> 'car_id'), '')::bigint;
    v_expected := nullif(btrim(p_entry ->> 'updated_at'), '')::timestamptz;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
    raise exception using errcode = '22023', message = 'รหัสรายการหรือเวอร์ชันข้อมูลไม่ถูกต้อง';
  end;
  if v_request_id is null then
    raise exception using errcode = '22023', message = 'ไม่พบรหัสป้องกันการบันทึกซ้ำ กรุณาเปิดฟอร์มใหม่';
  end if;
  if v_car_id is not null and v_car_id <= 0 then
    raise exception using errcode = '22023', message = 'ทะเบียนรถที่เลือกไม่ถูกต้อง';
  end if;
  v_value := p_entry ->> 'repair_date';
  if v_value is null or v_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode = '22023', message = 'กรุณาระบุวันที่ซ่อมให้ถูกต้อง';
  end if;
  begin
    v_date := v_value::date;
    v_value := nullif(btrim(p_entry ->> 'paid_date'), '');
    if v_value is not null and v_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception using errcode = '22023', message = 'กรุณาระบุวันที่จ่ายเงินให้ถูกต้อง';
    end if;
    v_paid_date := v_value::date;
    v_value := nullif(btrim(p_entry ->> 'usage_date'), '');
    if v_value is not null and v_value !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception using errcode = '22023', message = 'วันที่ใช้งานรถไม่ถูกต้อง';
    end if;
    v_usage_date := v_value::date;
  exception when datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode = '22023', message = 'วันที่ไม่มีอยู่จริง กรุณาตรวจสอบอีกครั้ง';
  end;
  if v_date not between date '1900-01-01' and date '2200-12-31'
    or (v_paid_date is not null and v_paid_date not between date '1900-01-01' and date '2200-12-31') then
    raise exception using errcode = '22023', message = 'วันที่อยู่นอกช่วงที่รองรับ';
  end if;
  v_value := nullif(btrim(p_entry ->> 'amount'), '');
  if v_value is not null then
    if char_length(v_value) > 32 or v_value !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception using errcode = '22023', message = 'จำนวนเงินต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง';
    end if;
    v_amount := v_value::numeric;
    if v_amount >= 10000000000 then
      raise exception using errcode = '22023', message = 'จำนวนเงินมากเกินช่วงที่รองรับ';
    end if;
  end if;
  v_value := nullif(btrim(p_entry ->> 'machine_hours'), '');
  if v_value is not null then
    if char_length(v_value) > 32 or v_value !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception using errcode = '22023', message = 'ชั่วโมงเครื่องจักรต้องไม่ติดลบและมีทศนิยมไม่เกิน 2 ตำแหน่ง';
    end if;
    v_hours := v_value::numeric;
    if v_hours >= 10000000000 then
      raise exception using errcode = '22023', message = 'ชั่วโมงเครื่องจักรมากเกินช่วงที่รองรับ';
    end if;
  end if;
  v_source_type := coalesce(nullif(p_entry ->> 'source_type', ''), case when v_source_id is not null then 'maintenance' else 'manual' end);
  if (v_source_type = 'maintenance' and v_source_id is null)
    or v_source_type not in ('maintenance','manual','report') then
    raise exception using errcode = '22023', message = 'แหล่งที่มาของรายการไม่ถูกต้อง';
  end if;
  if v_id is null and v_source_id is not null and v_source_type <> 'maintenance' then
    raise exception using errcode='22023',message='การนำเข้าแจ้งซ่อมใหม่ต้องระบุแหล่งที่มาจากการแจ้งซ่อม';
  end if;
  v_status := coalesce(p_entry ->> 'status', '');
  if v_status not in ('','committee_signed','submitted_executive','submitted_review','paid') then
    raise exception using errcode = '22023', message = 'สถานะงานซ่อมไม่ถูกต้อง';
  end if;
  v_plate := btrim(coalesce(p_entry ->> 'plate_number', ''));
  v_description := btrim(coalesce(p_entry ->> 'repair_description', ''));
  v_department := btrim(coalesce(p_entry ->> 'department', ''));
  v_shop := btrim(coalesce(p_entry ->> 'shop_name', ''));
  v_bill := btrim(coalesce(p_entry ->> 'bill_number', ''));
  v_document := btrim(coalesce(p_entry ->> 'accounting_document_number', ''));
  if char_length(v_plate) not between 1 and 100 or char_length(v_description) not between 1 and 5000
    or char_length(v_department) > 200 or char_length(v_shop) > 300
    or char_length(v_bill) > 100 or char_length(v_document) > 100 then
    raise exception using errcode = '22023', message = 'กรุณาระบุทะเบียนและรายการซ่อม หรือข้อความยาวเกินที่รองรับ';
  end if;
  if v_source_id is not null and not exists (
    select 1 from public.car_maintenance_records m where m.id = v_source_id and m.car_id = v_car_id
  ) then
    raise exception using errcode = '22023', message = 'รถไม่ตรงกับรายการส่งซ่อมต้นทาง';
  end if;
  if v_car_id is not null and not exists (select 1 from public.cars c where c.id = v_car_id) then
    raise exception using errcode = '22023', message = 'ไม่พบรถที่เลือกในระบบ';
  end if;

  -- Identical request retries share this transaction-scoped lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_request_id::text, 726));
  if v_id is not null then
    select * into v_previous from public.repair_work_ledger l where l.id = v_id for update;
  else
    select * into v_previous from public.repair_work_ledger l where l.client_request_id = v_request_id for update;
  end if;
  if v_usage_date is null then
    -- Existing unmapped rows stay editable without guessing a historical date.
    if v_previous.id is null or v_previous.usage_date is not null
      or v_previous.car_id is distinct from v_car_id then
      raise exception using errcode = '22023', message = 'กรุณาเลือกวันที่มีการใช้งานรถเพื่อลง ยพ.6';
    end if;
    if row(v_previous.repair_date,v_previous.plate_number,v_previous.department,v_previous.shop_name,
        v_previous.bill_number,v_previous.amount,v_previous.repair_description,v_previous.machine_hours)
      is distinct from row(v_date,v_plate,v_department,v_shop,v_bill,v_amount,v_description,v_hours) then
      raise exception using errcode='22023',message='กรุณาเลือกวันที่ใช้งานรถก่อนแก้รายละเอียดซ่อมของรายการเดิม';
    end if;
  elsif v_previous.id is null or v_previous.usage_date is distinct from v_usage_date
      or v_previous.car_id is distinct from v_car_id then
    perform private.require_repair_ledger_usage_date(v_car_id,v_usage_date);
  end if;

  if v_id is not null then
    if v_expected is null then
      raise exception using errcode = '40001', message = 'ไม่พบเวอร์ชันข้อมูล กรุณาโหลดข้อมูลล่าสุด';
    end if;
    select * into v_saved from public.repair_work_ledger l where l.id = v_id;
    if not found then
      raise exception using errcode = '40001', message = 'ไม่พบรายการ กรุณาโหลดข้อมูลล่าสุด';
    end if;
    if v_saved.maintenance_record_id is distinct from v_source_id
      or v_saved.source_type is distinct from v_source_type
      or v_saved.client_request_id is distinct from v_request_id then
      raise exception using errcode = '22023', message = 'ไม่สามารถเปลี่ยนแหล่งที่มาของรายการที่บันทึกแล้ว';
    end if;
    update public.repair_work_ledger l set
      car_id = v_car_id, repair_date = v_date, usage_date = v_usage_date, plate_number = v_plate,
      department = v_department, shop_name = v_shop, bill_number = v_bill, amount = v_amount,
      repair_description = v_description, status = v_status,
      accounting_document_number = v_document, paid_date = v_paid_date, machine_hours = v_hours,
      updated_by_staff_id = p_staff_id, updated_by_staff_name = p_staff_name
    where l.id = v_id and l.updated_at = v_expected returning * into v_saved;
    if not found then
      raise exception using errcode = '40001', message = 'รายการถูกแก้ไขจากอีกหน้าจอ กรุณาโหลดข้อมูลล่าสุด';
    end if;
  else
    insert into public.repair_work_ledger (
      maintenance_record_id, car_id, repair_date, usage_date, plate_number, department, shop_name, bill_number,
      amount, repair_description, status, accounting_document_number, paid_date, machine_hours,
      source_type, client_request_id, created_by_staff_id, created_by_staff_name,
      updated_by_staff_id, updated_by_staff_name
    ) values (
      v_source_id, v_car_id, v_date, v_usage_date, v_plate, v_department, v_shop, v_bill, v_amount,
      v_description, v_status, v_document, v_paid_date, v_hours, v_source_type, v_request_id,
      p_staff_id, p_staff_name, p_staff_id, p_staff_name
    ) on conflict (client_request_id) do nothing returning * into v_saved;
    if not found then
      select * into v_saved from public.repair_work_ledger l where l.client_request_id = v_request_id;
      if not found or v_saved.maintenance_record_id is distinct from v_source_id
        or v_saved.source_type is distinct from v_source_type or v_saved.car_id is distinct from v_car_id then
        raise exception using errcode = '23505', message = 'รหัสบันทึกซ้ำถูกใช้กับข้อมูลอื่นแล้ว กรุณาโหลดข้อมูลล่าสุด';
      end if;
      if row(v_saved.repair_date, v_saved.usage_date, v_saved.plate_number, v_saved.department, v_saved.shop_name,
          v_saved.bill_number, v_saved.amount, v_saved.repair_description, v_saved.status,
          v_saved.accounting_document_number, v_saved.paid_date, v_saved.machine_hours)
        is distinct from row(v_date, v_usage_date, v_plate, v_department, v_shop, v_bill, v_amount,
          v_description, v_status, v_document, v_paid_date, v_hours) then
        raise exception using errcode = '40001', message = 'รหัสบันทึกนี้ถูกใช้แล้วแต่ข้อมูลต่างกัน กรุณาโหลดข้อมูลล่าสุด';
      end if;
      -- A byte-equivalent normalized network retry returns the committed result.
      -- A changed form must never receive a misleading success for older content.
    end if;
  end if;
  return (to_jsonb(v_saved) - 'maintenance_record_id' - 'created_by' - 'updated_by' - 'created_by_staff_id' - 'updated_by_staff_id') || jsonb_build_object(
    'source_id', v_saved.maintenance_record_id, 'amount', v_saved.amount::text, 'machine_hours', v_saved.machine_hours::text
  );
end;
$$;
create or replace function private.list_repair_work_ledger_core(p_month date, p_car_id bigint default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_start date; v_end date; v_rows jsonb; v_inbox jsonb; v_cars jsonb;
begin
  if p_month is null or p_month < date '1900-01-01' or p_month > date '2200-12-31' then
    raise exception using errcode='22023',message='เดือนรายงานไม่ถูกต้อง';
  end if;
  if p_car_id is not null and p_car_id <= 0 then
    raise exception using errcode='22023',message='ทะเบียนรถที่เลือกไม่ถูกต้อง';
  end if;
  v_start := date_trunc('month',p_month::timestamp)::date;
  v_end := (v_start+interval '1 month')::date;
  select coalesce(jsonb_agg(
    (to_jsonb(l)-'maintenance_record_id'-'created_by'-'updated_by'-'created_by_staff_id'-'updated_by_staff_id')
      ||jsonb_build_object('source_id',l.maintenance_record_id,'amount',l.amount::text,'machine_hours',l.machine_hours::text)
      order by coalesce(l.usage_date,l.repair_date),l.id),'[]'::jsonb)
  into v_rows from public.repair_work_ledger l
  where coalesce(l.usage_date,l.repair_date)>=v_start and coalesce(l.usage_date,l.repair_date)<v_end
    and (p_car_id is null or l.car_id=p_car_id);

  select coalesce(jsonb_agg(jsonb_build_object(
      'id',null,'source_id',m.id,'source_type','maintenance','client_request_id',m.id,'car_id',m.car_id,
      'usage_date',null,'repair_date',null,
      'reported_date',(m.reported_at at time zone 'Asia/Bangkok')::date,
      'completed_date',(m.completed_at at time zone 'Asia/Bangkok')::date,
      'plate_number',coalesce(c.plate_number,''),'department',coalesce(d.name,''),'shop_name','','bill_number','',
      'amount',case when m.billing_status='billed' then m.repair_amount::text else null end,
      'repair_description',coalesce(nullif(items.description,''),nullif(btrim(m.completion_note),''),m.description),
      'status','','accounting_document_number','','paid_date',null,'machine_hours',null,
      'created_at',null,'updated_at',null,'created_by_staff_name',null,'updated_by_staff_name',null
    ) order by coalesce(m.completed_at,m.reported_at),m.id),'[]'::jsonb)
  into v_inbox from public.car_maintenance_records m
    join public.cars c on c.id=m.car_id left join public.departments d on d.id=c.department_id
    left join lateral (
      select string_agg(case when ri.repair_item_code='other'
          then coalesce(nullif(btrim(ri.custom_text),''),names.name) else names.name end,
          ', ' order by names.display_order,names.code) as description
      from public.car_maintenance_repair_items ri
      join public.maintenance_repair_items names on names.code=ri.repair_item_code
      where ri.maintenance_record_id=m.id
    ) items on true
  where coalesce(m.completed_at,m.reported_at)>=(v_start::timestamp at time zone 'Asia/Bangkok')
    and coalesce(m.completed_at,m.reported_at)<(v_end::timestamp at time zone 'Asia/Bangkok')
    and (p_car_id is null or m.car_id=p_car_id)
    and not exists(select 1 from public.repair_work_ledger l where l.maintenance_record_id=m.id);

  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'plate_number',c.plate_number,
    'department',coalesce(d.name,'')) order by c.plate_number,c.id),'[]'::jsonb)
  into v_cars from public.cars c left join public.departments d on d.id=c.department_id;
  return jsonb_build_object('rows',v_rows,'inbox',v_inbox,'cars',v_cars);
end;
$$;

create function private.list_repair_ledger_usage_dates_core(p_car_id bigint,p_month date)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_start date; v_end date; v_rows jsonb;
begin
  if p_car_id is null or p_car_id <= 0 or p_month is null
    or p_month not between date '1900-01-01' and date '2200-12-31' then
    raise exception using errcode='22023',message='กรุณาเลือกรถและเดือนให้ถูกต้อง';
  end if;
  v_start:=date_trunc('month',p_month::timestamp)::date;
  v_end:=(v_start+interval '1 month')::date;
  select coalesce(jsonb_agg(jsonb_build_object('usage_date',q.usage_date,'trip_count',q.trip_count)
    order by q.usage_date desc),'[]'::jsonb) into v_rows
  from (
    select (t.start_time at time zone 'Asia/Bangkok')::date as usage_date,count(*) as trip_count
    from public.trip_logs t join public.cars c on c.id=t.car_id
    where t.car_id=p_car_id and t.is_completed is true
      and t.start_time >= (v_start::timestamp at time zone 'Asia/Bangkok')
      and t.start_time < (v_end::timestamp at time zone 'Asia/Bangkok')
      and t.start_time < (((now() at time zone 'Asia/Bangkok')::date+1)::timestamp at time zone 'Asia/Bangkok')
      and public.effective_trip_activity(t.activity_type,c.fuel_type)='usage'
    group by (t.start_time at time zone 'Asia/Bangkok')::date
  ) q;
  return v_rows;
end;
$$;
revoke all on function private.list_repair_ledger_usage_dates_core(bigint,date) from public,anon,authenticated,service_role;

-- Probable duplicates are suggestions, never a hard unique vehicle/day rule.
-- This cross-month query sees only the selected car and at most 20 candidates.
create function private.find_repair_ledger_duplicates_core(p_entry jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare v_car bigint; v_id uuid; v_source uuid; v_date date; v_usage date; v_shop text; v_bill text; v_description text; v_amount numeric; v_rows jsonb;
begin
  if p_entry is null or jsonb_typeof(p_entry)<>'object' then
    raise exception using errcode='22023',message='ข้อมูลตรวจรายการซ้ำไม่ถูกต้อง';
  end if;
  begin
    v_car:=nullif(btrim(p_entry->>'car_id'),'')::bigint;
    v_id:=nullif(btrim(p_entry->>'id'),'')::uuid;
    v_source:=nullif(btrim(p_entry->>'source_id'),'')::uuid;
    if nullif(btrim(p_entry->>'repair_date'),'') is not null then
      if p_entry->>'repair_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception using errcode='22023',message='วันที่ซ่อมไม่ถูกต้อง';
      end if;
      v_date:=(p_entry->>'repair_date')::date;
    end if;
    if nullif(btrim(p_entry->>'usage_date'),'') is not null then
      if p_entry->>'usage_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception using errcode='22023',message='วันที่ใช้งานรถไม่ถูกต้อง';
      end if;
      v_usage:=(p_entry->>'usage_date')::date;
    end if;
    if nullif(btrim(p_entry->>'amount'),'') is not null then
      if char_length(p_entry->>'amount')>32 or p_entry->>'amount' !~ '^[0-9]+([.][0-9]{1,2})?$' then
        raise exception using errcode='22023',message='จำนวนเงินไม่ถูกต้อง';
      end if;
      v_amount:=(p_entry->>'amount')::numeric;
    end if;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
    raise exception using errcode='22023',message='รหัสรถหรือข้อมูลตรวจรายการซ้ำไม่ถูกต้อง';
  end;
  if v_car is null or v_car<=0 then raise exception using errcode='22023',message='กรุณาเลือกรถในระบบ'; end if;
  if char_length(coalesce(p_entry->>'shop_name',''))>300 or char_length(coalesce(p_entry->>'bill_number',''))>100
    or char_length(coalesce(p_entry->>'repair_description',''))>5000 then
    raise exception using errcode='22023',message='ข้อความตรวจรายการซ้ำยาวเกินที่รองรับ';
  end if;
  v_shop:=lower(regexp_replace(normalize(btrim(coalesce(p_entry->>'shop_name','')),NFKC),'[[:space:]]+',' ','g'));
  v_bill:=lower(regexp_replace(normalize(btrim(coalesce(p_entry->>'bill_number','')),NFKC),'[[:space:]]+',' ','g'));
  v_description:=lower(regexp_replace(normalize(btrim(coalesce(p_entry->>'repair_description','')),NFKC),'[[:space:]]+',' ','g'));
  select coalesce(jsonb_agg(q.entry order by q.repair_date desc,q.id),'[]'::jsonb) into v_rows
  from (
    select l.id,l.repair_date,
      (to_jsonb(l)-'maintenance_record_id'-'created_by'-'updated_by'-'created_by_staff_id'-'updated_by_staff_id')
      ||jsonb_build_object('source_id',l.maintenance_record_id,'amount',l.amount::text,'machine_hours',l.machine_hours::text) as entry
    from public.repair_work_ledger l
    where l.car_id=v_car and (v_id is null or l.id<>v_id) and (
      (v_source is not null and l.maintenance_record_id=v_source)
      or (v_bill<>'' and lower(regexp_replace(normalize(btrim(l.bill_number),NFKC),'[[:space:]]+',' ','g'))=v_bill
        and (v_shop='' or btrim(l.shop_name)=''
          or lower(regexp_replace(normalize(btrim(l.shop_name),NFKC),'[[:space:]]+',' ','g'))=v_shop))
      or (((v_date is not null and l.repair_date=v_date) or (v_usage is not null and l.usage_date=v_usage)) and (
        (v_description<>'' and lower(regexp_replace(normalize(btrim(l.repair_description),NFKC),'[[:space:]]+',' ','g'))=v_description)
        or (v_amount is not null and l.amount=v_amount and v_shop<>''
          and lower(regexp_replace(normalize(btrim(l.shop_name),NFKC),'[[:space:]]+',' ','g'))=v_shop)
      ))
    ) order by l.repair_date desc,l.id limit 20
  ) q;
  return v_rows;
end;
$$;
revoke all on function private.find_repair_ledger_duplicates_core(jsonb) from public,anon,authenticated,service_role;

create function private.link_repair_ledger_source_core(p_entry_id uuid,p_source_id uuid,p_updated_at timestamptz,
  p_staff_id bigint,p_staff_name text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_saved public.repair_work_ledger%rowtype; v_source_car bigint;
begin
  if p_entry_id is null or p_source_id is null or p_updated_at is null then
    raise exception using errcode='22023',message='กรุณาเลือกรายการและโหลดข้อมูลล่าสุดก่อนเชื่อม';
  end if;
  select * into v_saved from public.repair_work_ledger l where l.id=p_entry_id for update;
  if not found then raise exception using errcode='40001',message='ไม่พบรายการ กรุณาโหลดข้อมูลล่าสุด'; end if;
  select m.car_id into v_source_car from public.car_maintenance_records m where m.id=p_source_id for share;
  if not found or v_saved.car_id is null or v_saved.car_id is distinct from v_source_car then
    raise exception using errcode='22023',message='รถไม่ตรงกับรายการส่งซ่อมต้นทาง';
  end if;
  if v_saved.maintenance_record_id is distinct from p_source_id then
    if v_saved.maintenance_record_id is not null then
      raise exception using errcode='23505',message='รายการนี้เชื่อมกับแจ้งซ่อมอื่นแล้ว';
    end if;
    if v_saved.updated_at is distinct from p_updated_at then
      raise exception using errcode='40001',message='รายการถูกแก้ไขจากอีกหน้าจอ กรุณาโหลดข้อมูลล่าสุด';
    end if;
    if exists(select 1 from public.repair_work_ledger l where l.maintenance_record_id=p_source_id) then
      raise exception using errcode='23505',message='แจ้งซ่อมนี้อยู่ในสมุดซ่อมแล้ว กรุณาเปิดรายการเดิม';
    end if;
    -- Keep creation origin, request UUID, dates and financial values unchanged.
    update public.repair_work_ledger l set maintenance_record_id=p_source_id,
      updated_by_staff_id=p_staff_id,updated_by_staff_name=p_staff_name
    where l.id=p_entry_id returning * into v_saved;
  end if;
  return (to_jsonb(v_saved)-'maintenance_record_id'-'created_by'-'updated_by'-'created_by_staff_id'-'updated_by_staff_id')
    ||jsonb_build_object('source_id',v_saved.maintenance_record_id,'amount',v_saved.amount::text,'machine_hours',v_saved.machine_hours::text);
end;
$$;
revoke all on function private.link_repair_ledger_source_core(uuid,uuid,timestamptz,bigint,text) from public,anon,authenticated,service_role;

-- The checked private definer boundary is the same established staff-ID security
-- model. Public RPC wrappers remain invoker and cannot directly read staff tables.
create or replace function private.repair_ledger_staff_boundary(p_staff_code text,p_operation text,
  p_month date default null,p_car_id bigint default null,p_entry jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_staff jsonb;
begin
  v_staff:=private.require_repair_ledger_staff(p_staff_code);
  case p_operation
    when 'verify' then return v_staff;
    when 'list' then return private.list_repair_work_ledger_core(p_month,p_car_id);
    when 'save' then return private.save_repair_work_ledger_core(p_entry,(v_staff->>'staff_id')::bigint,v_staff->>'full_name');
    when 'usage_dates' then return private.list_repair_ledger_usage_dates_core(p_car_id,p_month);
    when 'duplicates' then return private.find_repair_ledger_duplicates_core(p_entry);
    when 'link_source' then return private.link_repair_ledger_source_core(
      (p_entry->>'entry_id')::uuid,(p_entry->>'source_id')::uuid,(p_entry->>'updated_at')::timestamptz,
      (v_staff->>'staff_id')::bigint,v_staff->>'full_name');
    else raise exception using errcode='22023',message='คำสั่งสมุดคุมงานซ่อมไม่ถูกต้อง';
  end case;
end;
$$;
create function public.list_repair_ledger_usage_dates_staff(p_staff_code text,p_car_id bigint,p_month date)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.repair_ledger_staff_boundary(p_staff_code,'usage_dates',p_month,p_car_id);
$$;
create function public.link_repair_ledger_source_staff(p_staff_code text,p_entry_id uuid,p_source_id uuid,p_updated_at timestamptz)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.repair_ledger_staff_boundary(p_staff_code,'link_source',null,null,
    jsonb_build_object('entry_id',p_entry_id,'source_id',p_source_id,'updated_at',p_updated_at));
$$;
create function public.find_repair_ledger_duplicates_staff(p_staff_code text,p_entry jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.repair_ledger_staff_boundary(p_staff_code,'duplicates',null,null,p_entry);
$$;
revoke all on function public.list_repair_ledger_usage_dates_staff(text,bigint,date) from public,anon,authenticated;
revoke all on function public.link_repair_ledger_source_staff(text,uuid,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.list_repair_ledger_usage_dates_staff(text,bigint,date) to anon,authenticated;
grant execute on function public.link_repair_ledger_source_staff(text,uuid,uuid,timestamptz) to anon,authenticated;
revoke all on function public.find_repair_ledger_duplicates_staff(text,jsonb) from public,anon,authenticated;
grant execute on function public.find_repair_ledger_duplicates_staff(text,jsonb) to anon,authenticated;

-- Narrow public projection for an already public vehicle-use report. No staff
-- identity, invoice, shop, payment or accounting fields leave this boundary.
create function private.list_repair_ledger_yp6_boundary(p_car_id bigint,p_month date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_start date; v_end date; v_rows jsonb; v_links jsonb;
begin
  if p_car_id is null or p_car_id <= 0 or p_month is null
    or p_month not between date '1900-01-01' and date '2200-12-31' then
    raise exception using errcode='22023',message='กรุณาเลือกรถและเดือนให้ถูกต้อง';
  end if;
  v_start:=date_trunc('month',p_month::timestamp)::date;
  v_end:=(v_start+interval '1 month')::date;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'car_id',l.car_id,'usage_date',l.usage_date,
    'repair_description',l.repair_description,'amount',l.amount::text,'machine_hours',l.machine_hours::text,
    'source_id',l.maintenance_record_id) order by l.usage_date,l.id),'[]'::jsonb)
  into v_rows from public.repair_work_ledger l
  where l.car_id=p_car_id and l.usage_date>=v_start and l.usage_date<v_end;
  -- Across all months: moving a mapped repair must also suppress its old trip
  -- projection in the old month rather than count it in both monthly reports.
  select coalesce(jsonb_agg(l.maintenance_record_id order by l.maintenance_record_id),'[]'::jsonb)
  into v_links from public.repair_work_ledger l
  where l.car_id=p_car_id and l.usage_date is not null and l.maintenance_record_id is not null;
  return jsonb_build_object('rows',v_rows,'linked_source_ids',v_links);
end;
$$;
revoke all on function private.list_repair_ledger_yp6_boundary(bigint,date) from public,anon,authenticated,service_role;
grant execute on function private.list_repair_ledger_yp6_boundary(bigint,date) to anon,authenticated;
create function public.list_repair_ledger_yp6(p_car_id bigint,p_month date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.list_repair_ledger_yp6_boundary(p_car_id,p_month);
$$;
revoke all on function public.list_repair_ledger_yp6(bigint,date) from public,anon,authenticated;
grant execute on function public.list_repair_ledger_yp6(bigint,date) to anon,authenticated;
notify pgrst,'reload schema';
