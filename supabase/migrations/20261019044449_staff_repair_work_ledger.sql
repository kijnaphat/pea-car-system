-- Staff ID access to the separate repair book. No canonical maintenance,
-- Filename aligned to the applied Supabase migration history version.
-- trip log, vehicle-status or Y.P.6 records are changed by these routines.
-- Staff codes are checked server-side on every call and never stored in the book.
alter table public.repair_work_ledger
  add column created_by_staff_id bigint,
  add column updated_by_staff_id bigint,
  add column created_by_staff_name text,
  add column updated_by_staff_name text;

comment on table public.repair_work_ledger is
  'Repair bookkeeping via admin access or verified staff-code RPCs. Anonymous direct table access remains denied.';
comment on column public.repair_work_ledger.created_by_staff_id is
  'Historical verified staff ID snapshot, intentionally not a staff foreign key.';
comment on column public.repair_work_ledger.updated_by_staff_id is
  'Historical verified staff ID snapshot, intentionally not a staff foreign key.';

-- Authorization comes from the boundary functions, not client-editable JWT claims,
-- custom GUCs, or caller-supplied audit fields. The private cores are not executable
-- by any API role. Their invoker context is the definer boundary's table owner.
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
       or new.maintenance_record_id is distinct from old.maintenance_record_id
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
  new.updated_by := v_uid;
  return new;
end;
$$;
revoke all on function public.guard_repair_work_ledger() from public, anon, authenticated;

create function private.list_repair_work_ledger_core(p_month date, p_car_id bigint default null)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_start date;
  v_end date;
  v_rows jsonb;
  v_cars jsonb;
begin
  if p_month is null or p_month < date '1900-01-01' or p_month > date '2200-12-31' then
    raise exception using errcode = '22023', message = 'เดือนรายงานไม่ถูกต้อง';
  end if;
  if p_car_id is not null and p_car_id <= 0 then
    raise exception using errcode = '22023', message = 'ทะเบียนรถที่เลือกไม่ถูกต้อง';
  end if;
  v_start := date_trunc('month', p_month::timestamp)::date;
  v_end := (v_start + interval '1 month')::date;

  with saved as (
    select l.repair_date, l.id::text as sort_id,
      (to_jsonb(l) - 'maintenance_record_id' - 'created_by' - 'updated_by' - 'created_by_staff_id' - 'updated_by_staff_id') || jsonb_build_object(
        'source_id', l.maintenance_record_id, 'amount', l.amount::text, 'machine_hours', l.machine_hours::text
      ) as entry
    from public.repair_work_ledger l
    where l.repair_date >= v_start and l.repair_date < v_end
      and (p_car_id is null or l.car_id = p_car_id)
  ), imported as (
    select (coalesce(m.completed_at, m.reported_at) at time zone 'Asia/Bangkok')::date as repair_date,
      m.id::text as sort_id,
      jsonb_build_object(
        'id', null, 'source_id', m.id, 'source_type', 'maintenance', 'client_request_id', m.id,
        'car_id', m.car_id,
        'repair_date', (coalesce(m.completed_at, m.reported_at) at time zone 'Asia/Bangkok')::date,
        'plate_number', coalesce(c.plate_number, ''), 'department', coalesce(d.name, ''),
        'shop_name', '', 'bill_number', '',
        'amount', case when m.billing_status = 'billed' then m.repair_amount::text else null end,
        'repair_description', coalesce(nullif(items.description, ''), nullif(btrim(m.completion_note), ''), m.description),
        'status', '', 'accounting_document_number', '', 'paid_date', null, 'machine_hours', null,
        'created_at', null, 'updated_at', null,
        'created_by_staff_name', null, 'updated_by_staff_name', null
      ) as entry
    from public.car_maintenance_records m
    join public.cars c on c.id = m.car_id
    left join public.departments d on d.id = c.department_id
    left join lateral (
      select string_agg(
        case when ri.repair_item_code = 'other' then coalesce(nullif(btrim(ri.custom_text), ''), names.name)
          else names.name end, ', ' order by names.display_order, names.code
      ) as description
      from public.car_maintenance_repair_items ri
      join public.maintenance_repair_items names on names.code = ri.repair_item_code
      where ri.maintenance_record_id = m.id
    ) items on true
    where coalesce(m.completed_at, m.reported_at) >= (v_start::timestamp at time zone 'Asia/Bangkok')
      and coalesce(m.completed_at, m.reported_at) < (v_end::timestamp at time zone 'Asia/Bangkok')
      and (p_car_id is null or m.car_id = p_car_id)
      and not exists (select 1 from public.repair_work_ledger l where l.maintenance_record_id = m.id)
  ), all_rows as (
    select * from saved union all select * from imported
  )
  select coalesce(jsonb_agg(entry order by repair_date, sort_id), '[]'::jsonb) into v_rows from all_rows;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'plate_number', c.plate_number, 'department', coalesce(d.name, '')
  ) order by c.plate_number, c.id), '[]'::jsonb)
  into v_cars from public.cars c left join public.departments d on d.id = c.department_id;

  return jsonb_build_object('rows', v_rows, 'cars', v_cars);
end;
$$;

create function private.save_repair_work_ledger_core(p_entry jsonb, p_staff_id bigint, p_staff_name text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid;
  v_source_id uuid;
  v_request_id uuid;
  v_expected timestamptz;
  v_car_id bigint;
  v_date date;
  v_paid_date date;
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
    'department','shop_name','bill_number','amount','repair_description','status',
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
    or (v_source_type in ('manual', 'report') and v_source_id is not null)
    or v_source_type not in ('maintenance','manual','report') then
    raise exception using errcode = '22023', message = 'แหล่งที่มาของรายการไม่ถูกต้อง';
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
      car_id = v_car_id, repair_date = v_date, plate_number = v_plate,
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
      maintenance_record_id, car_id, repair_date, plate_number, department, shop_name, bill_number,
      amount, repair_description, status, accounting_document_number, paid_date, machine_hours,
      source_type, client_request_id, created_by_staff_id, created_by_staff_name,
      updated_by_staff_id, updated_by_staff_name
    ) values (
      v_source_id, v_car_id, v_date, v_plate, v_department, v_shop, v_bill, v_amount,
      v_description, v_status, v_document, v_paid_date, v_hours, v_source_type, v_request_id,
      p_staff_id, p_staff_name, p_staff_id, p_staff_name
    ) on conflict (client_request_id) do nothing returning * into v_saved;
    if not found then
      select * into v_saved from public.repair_work_ledger l where l.client_request_id = v_request_id;
      if not found or v_saved.maintenance_record_id is distinct from v_source_id
        or v_saved.source_type is distinct from v_source_type or v_saved.car_id is distinct from v_car_id then
        raise exception using errcode = '23505', message = 'รหัสบันทึกซ้ำถูกใช้กับข้อมูลอื่นแล้ว กรุณาโหลดข้อมูลล่าสุด';
      end if;
      if row(v_saved.repair_date, v_saved.plate_number, v_saved.department, v_saved.shop_name,
          v_saved.bill_number, v_saved.amount, v_saved.repair_description, v_saved.status,
          v_saved.accounting_document_number, v_saved.paid_date, v_saved.machine_hours)
        is distinct from row(v_date, v_plate, v_department, v_shop, v_bill, v_amount,
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


revoke all on function private.list_repair_work_ledger_core(date,bigint) from public, anon, authenticated, service_role;
revoke all on function private.save_repair_work_ledger_core(jsonb,bigint,text) from public, anon, authenticated, service_role;

-- This internal lookup is only reachable from the checked boundary functions.
-- A staff ID is an identifier, not a password; this matches the existing personnel
-- workflow, without pretending that it is Supabase Auth or changing database roles.
create function private.require_repair_ledger_staff(p_staff_code text)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_code text;
  v_identity jsonb;
begin
  if p_staff_code is null or char_length(p_staff_code) > 32 then
    raise exception using errcode = '42501', message = 'กรุณาตรวจสอบรหัสประจำตัวพนักงาน';
  end if;
  v_code := translate(normalize(btrim(p_staff_code), NFKC), '๐๑๒๓๔๕๖๗๘๙', '0123456789');
  if v_code !~ '^[0-9]{1,7}$' then
    raise exception using errcode = '42501', message = 'กรุณาตรวจสอบรหัสประจำตัวพนักงาน';
  end if;
  select jsonb_build_object('staff_id',s.id,'full_name',s.full_name,
    'position',coalesce(s.position,''),'department',coalesce(d.name,''))
  into v_identity
  from public.staff s left join public.departments d on d.id = s.department_id
  where s.staff_code = v_code
  order by s.id limit 1;
  if v_identity is null then
    raise exception using errcode = '42501', message = 'กรุณาตรวจสอบรหัสประจำตัวพนักงาน';
  end if;
  return v_identity;
end;
$$;
revoke all on function private.require_repair_ledger_staff(text) from public, anon, authenticated, service_role;

create function private.repair_ledger_staff_boundary(p_staff_code text, p_operation text,
  p_month date default null, p_car_id bigint default null, p_entry jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_staff jsonb;
begin
  -- Required even for authenticated callers and direct private-function calls.
  v_staff := private.require_repair_ledger_staff(p_staff_code);
  case p_operation
    when 'verify' then return v_staff;
    when 'list' then return private.list_repair_work_ledger_core(p_month,p_car_id);
    when 'save' then return private.save_repair_work_ledger_core(
      p_entry,(v_staff ->> 'staff_id')::bigint,v_staff ->> 'full_name');
    else raise exception using errcode = '22023', message = 'คำสั่งสมุดคุมงานซ่อมไม่ถูกต้อง';
  end case;
end;
$$;
revoke all on function private.repair_ledger_staff_boundary(text,text,date,bigint,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.repair_ledger_staff_boundary(text,text,date,bigint,jsonb)
  to anon, authenticated;

create function private.repair_ledger_admin_boundary(p_operation text,
  p_month date default null,p_car_id bigint default null,p_entry jsonb default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or coalesce((select auth.jwt()) -> 'app_metadata' ->> 'role','') <> 'admin' then
    raise exception using errcode = '42501', message = 'กรุณาเข้าสู่ระบบด้วยบัญชีแอดมิน';
  end if;
  case p_operation
    when 'list' then return private.list_repair_work_ledger_core(p_month,p_car_id);
    when 'save' then return private.save_repair_work_ledger_core(p_entry,null,null);
    else raise exception using errcode = '22023', message = 'คำสั่งสมุดคุมงานซ่อมไม่ถูกต้อง';
  end case;
end;
$$;
revoke all on function private.repair_ledger_admin_boundary(text,date,bigint,jsonb)
  from public, anon, authenticated, service_role;
grant execute on function private.repair_ledger_admin_boundary(text,date,bigint,jsonb) to authenticated;

create function public.verify_repair_ledger_staff(p_staff_code text)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.repair_ledger_staff_boundary(p_staff_code,'verify'); $$;

create function public.list_repair_work_ledger_staff(p_staff_code text,p_month date,p_car_id bigint default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.repair_ledger_staff_boundary(p_staff_code,'list',p_month,p_car_id); $$;

create function public.save_repair_work_ledger_staff(p_staff_code text,p_entry jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.repair_ledger_staff_boundary(p_staff_code,'save',null,null,p_entry); $$;

-- The legacy admin endpoints keep their signatures, with shared validation cores.
create or replace function public.list_repair_work_ledger(p_month date,p_car_id bigint default null)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.repair_ledger_admin_boundary('list',p_month,p_car_id); $$;

create or replace function public.save_repair_work_ledger(p_entry jsonb)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.repair_ledger_admin_boundary('save',null,null,p_entry); $$;

revoke all on function public.verify_repair_ledger_staff(text) from public, anon, authenticated;
revoke all on function public.list_repair_work_ledger_staff(text,date,bigint) from public, anon, authenticated;
revoke all on function public.save_repair_work_ledger_staff(text,jsonb) from public, anon, authenticated;
grant execute on function public.verify_repair_ledger_staff(text) to anon, authenticated;
grant execute on function public.list_repair_work_ledger_staff(text,date,bigint) to anon, authenticated;
grant execute on function public.save_repair_work_ledger_staff(text,jsonb) to anon, authenticated;
revoke all on function public.list_repair_work_ledger(date,bigint) from public, anon, authenticated;
revoke all on function public.save_repair_work_ledger(jsonb) from public, anon, authenticated;
grant execute on function public.list_repair_work_ledger(date,bigint) to authenticated;
grant execute on function public.save_repair_work_ledger(jsonb) to authenticated;

-- Existing per-column authenticated grants deliberately exclude staff audit fields.
-- No anonymous table grants or additional RLS policies are added.
notify pgrst, 'reload schema';
