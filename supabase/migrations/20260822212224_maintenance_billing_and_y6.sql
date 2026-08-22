create table if not exists public.maintenance_repair_items (
  code text primary key,
  name text not null unique,
  display_order smallint not null,
  is_active boolean not null default true,
  constraint maintenance_repair_items_code_present
    check (code ~ '^[a-z0-9_]+$'),
  constraint maintenance_repair_items_name_present
    check (char_length(btrim(name)) between 2 and 120)
);

insert into public.maintenance_repair_items (code, name, display_order)
values
  ('inspection_labor', 'ตรวจเช็ก / ค่าแรง', 10),
  ('engine_oil_filter', 'เปลี่ยนน้ำมันเครื่อง / ไส้กรอง', 20),
  ('tires_wheels', 'ยาง / ล้อ', 30),
  ('brakes', 'ระบบเบรก', 40),
  ('battery_electrical', 'แบตเตอรี่ / ระบบไฟฟ้า', 50),
  ('engine_drivetrain', 'เครื่องยนต์ / ระบบขับเคลื่อน', 60),
  ('air_conditioning', 'เครื่องปรับอากาศ', 70),
  ('suspension_steering', 'ช่วงล่าง / พวงมาลัย', 80),
  ('body_glass', 'ตัวถัง / กระจก', 90),
  ('vehicle_equipment', 'อุปกรณ์ประจำรถ', 100),
  ('other', 'อื่น ๆ', 110)
on conflict (code) do update
set name = excluded.name,
    display_order = excluded.display_order,
    is_active = true;

alter table public.car_maintenance_records
  add column if not exists billing_status text not null default 'pending_invoice',
  add column if not exists repair_amount numeric(12, 2),
  add column if not exists y6_trip_log_id bigint,
  add column if not exists billing_completed_by uuid,
  add column if not exists billed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.car_maintenance_records'::regclass
      and conname = 'car_maintenance_records_billing_status_valid'
  ) then
    alter table public.car_maintenance_records
      add constraint car_maintenance_records_billing_status_valid
      check (billing_status in ('pending_invoice', 'billed'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.car_maintenance_records'::regclass
      and conname = 'car_maintenance_records_repair_amount_nonnegative'
  ) then
    alter table public.car_maintenance_records
      add constraint car_maintenance_records_repair_amount_nonnegative
      check (repair_amount is null or repair_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.car_maintenance_records'::regclass
      and conname = 'car_maintenance_records_y6_trip_log_id_fkey'
  ) then
    alter table public.car_maintenance_records
      add constraint car_maintenance_records_y6_trip_log_id_fkey
      foreign key (y6_trip_log_id) references public.trip_logs(id)
      on update cascade on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.car_maintenance_records'::regclass
      and conname = 'car_maintenance_records_billing_lifecycle_valid'
  ) then
    alter table public.car_maintenance_records
      add constraint car_maintenance_records_billing_lifecycle_valid
      check (
        (billing_status = 'pending_invoice' and repair_amount is null and billed_at is null)
        or
        (billing_status = 'billed' and repair_amount is not null and billed_at is not null)
      );
  end if;
end;
$$;

comment on column public.car_maintenance_records.y6_trip_log_id is
  'Latest completed trip whose date receives this repair in the YP6 report.';

create table if not exists public.car_maintenance_repair_items (
  maintenance_record_id uuid not null references public.car_maintenance_records(id) on update cascade on delete cascade,
  repair_item_code text not null references public.maintenance_repair_items(code) on update cascade on delete restrict,
  custom_text text,
  created_at timestamptz not null default now(),
  primary key (maintenance_record_id, repair_item_code),
  constraint car_maintenance_repair_items_custom_text_valid
    check (
      (repair_item_code = 'other' and char_length(btrim(custom_text)) between 2 and 300)
      or
      (repair_item_code <> 'other' and custom_text is null)
    )
);

create index if not exists car_maintenance_records_pending_billing_idx
  on public.car_maintenance_records (completed_at desc)
  where status = 'completed' and billing_status = 'pending_invoice';

create index if not exists car_maintenance_records_y6_trip_log_id_idx
  on public.car_maintenance_records (y6_trip_log_id)
  where y6_trip_log_id is not null;

create index if not exists car_maintenance_repair_items_code_idx
  on public.car_maintenance_repair_items (repair_item_code);

alter table public.maintenance_repair_items enable row level security;
alter table public.car_maintenance_repair_items enable row level security;

drop policy if exists "public_read_active_maintenance_repair_items" on public.maintenance_repair_items;
create policy "public_read_active_maintenance_repair_items"
on public.maintenance_repair_items
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "read_billed_maintenance_repair_items" on public.car_maintenance_repair_items;
create policy "read_billed_maintenance_repair_items"
on public.car_maintenance_repair_items
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.car_maintenance_records cmr
    where cmr.id = maintenance_record_id
      and cmr.status = 'completed'
      and cmr.billing_status = 'billed'
  )
  or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin'
);

drop policy if exists "admin_insert_maintenance_repair_items" on public.car_maintenance_repair_items;
create policy "admin_insert_maintenance_repair_items"
on public.car_maintenance_repair_items
for insert
to authenticated
with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "admin_delete_maintenance_repair_items" on public.car_maintenance_repair_items;
create policy "admin_delete_maintenance_repair_items"
on public.car_maintenance_repair_items
for delete
to authenticated
using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "public_read_open_car_maintenance" on public.car_maintenance_records;
create policy "public_read_open_or_billed_car_maintenance"
on public.car_maintenance_records
for select
to anon
using (
  status = 'open'
  or (status = 'completed' and billing_status = 'billed')
);

drop policy if exists "staff_read_open_or_admin_read_all_car_maintenance" on public.car_maintenance_records;
create policy "staff_read_billed_or_admin_read_all_car_maintenance"
on public.car_maintenance_records
for select
to authenticated
using (
  status = 'open'
  or (status = 'completed' and billing_status = 'billed')
  or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin'
);

drop policy if exists "admin_update_maintenance_billing" on public.car_maintenance_records;
create policy "admin_update_maintenance_billing"
on public.car_maintenance_records
for update
to authenticated
using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin')
with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

revoke all on table public.maintenance_repair_items from public, anon, authenticated;
revoke all on table public.car_maintenance_repair_items from public, anon, authenticated;
grant select on table public.maintenance_repair_items to anon, authenticated;
grant select on table public.car_maintenance_repair_items to anon, authenticated;
grant insert, delete on table public.car_maintenance_repair_items to authenticated;
grant update (billing_status, repair_amount, y6_trip_log_id, billing_completed_by, billed_at)
  on public.car_maintenance_records to authenticated;

create or replace function private.complete_car_maintenance_v2_impl(
  p_car_id bigint,
  p_staff_code text,
  p_completion_note text,
  p_billing_status text,
  p_repair_item_codes text[],
  p_other_repair_text text,
  p_repair_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_car_status text;
  v_staff_id bigint;
  v_record_id uuid;
  v_completed_at timestamptz;
  v_trip_log_id bigint;
  v_normalized_codes text[];
begin
  if p_car_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรถในระบบ');
  end if;

  if p_staff_code is null or pg_catalog.btrim(p_staff_code) = '' then
    return pg_catalog.jsonb_build_object('error', 'กรุณาระบุรหัสพนักงาน');
  end if;

  if p_completion_note is null or pg_catalog.char_length(pg_catalog.btrim(p_completion_note)) < 3 then
    return pg_catalog.jsonb_build_object('error', 'กรุณาระบุผลการตรวจหรือการซ่อมอย่างน้อย 3 ตัวอักษร');
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(p_completion_note)) > 1000 then
    return pg_catalog.jsonb_build_object('error', 'ผลการตรวจหรือการซ่อมยาวเกิน 1,000 ตัวอักษร');
  end if;

  if p_billing_status not in ('pending_invoice', 'billed') then
    return pg_catalog.jsonb_build_object('error', 'กรุณาเลือกสถานะใบวางบิล');
  end if;

  select pg_catalog.array_agg(distinct code order by code)
  into v_normalized_codes
  from pg_catalog.unnest(coalesce(p_repair_item_codes, array[]::text[])) code
  where code is not null and pg_catalog.btrim(code) <> '';

  if p_billing_status = 'billed' then
    if p_repair_amount is null or p_repair_amount < 0 then
      return pg_catalog.jsonb_build_object('error', 'กรุณากรอกจำนวนเงินค่าซ่อมตั้งแต่ 0 บาทขึ้นไป');
    end if;

    if coalesce(pg_catalog.array_length(v_normalized_codes, 1), 0) = 0 then
      return pg_catalog.jsonb_build_object('error', 'กรุณาเลือกรายการซ่อมอย่างน้อย 1 รายการ');
    end if;

    if exists (
      select 1
      from pg_catalog.unnest(v_normalized_codes) code
      where not exists (
        select 1 from public.maintenance_repair_items mri
        where mri.code = code and mri.is_active = true
      )
    ) then
      return pg_catalog.jsonb_build_object('error', 'พบรายการซ่อมที่ไม่ถูกต้อง');
    end if;

    if 'other' = any(v_normalized_codes)
       and (p_other_repair_text is null or pg_catalog.char_length(pg_catalog.btrim(p_other_repair_text)) < 2) then
      return pg_catalog.jsonb_build_object('error', 'กรุณาระบุรายละเอียดรายการซ่อมอื่น ๆ');
    end if;
  else
    v_normalized_codes := array[]::text[];
    p_other_repair_text := null;
    p_repair_amount := null;
  end if;

  select s.id
  into v_staff_id
  from public.staff s
  where s.staff_code = pg_catalog.btrim(p_staff_code)
  limit 1;

  if v_staff_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรหัสพนักงานนี้');
  end if;

  select c.status
  into v_car_status
  from public.cars c
  where c.id = p_car_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรถในระบบ');
  end if;

  if v_car_status <> 'maintenance' then
    return pg_catalog.jsonb_build_object('error', 'รถคันนี้ไม่ได้อยู่ในสถานะกำลังซ่อม');
  end if;

  select cmr.id
  into v_record_id
  from public.car_maintenance_records cmr
  where cmr.car_id = p_car_id
    and cmr.status = 'open'
  order by cmr.reported_at desc
  limit 1
  for update;

  if v_record_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรายการซ่อมที่ยังไม่ปิด');
  end if;

  select tl.id
  into v_trip_log_id
  from public.trip_logs tl
  where tl.car_id = p_car_id
    and tl.is_completed = true
  order by coalesce(tl.end_time, tl.start_time, tl.created_at) desc, tl.id desc
  limit 1;

  v_completed_at := pg_catalog.now();

  update public.car_maintenance_records
  set status = 'completed',
      completed_by_staff_id = v_staff_id,
      completion_note = pg_catalog.btrim(p_completion_note),
      completed_at = v_completed_at,
      billing_status = p_billing_status,
      repair_amount = p_repair_amount,
      y6_trip_log_id = v_trip_log_id,
      billing_completed_by = case when p_billing_status = 'billed' then null else billing_completed_by end,
      billed_at = case when p_billing_status = 'billed' then v_completed_at else null end
  where id = v_record_id;

  insert into public.car_maintenance_repair_items (
    maintenance_record_id,
    repair_item_code,
    custom_text
  )
  select
    v_record_id,
    code,
    case when code = 'other' then pg_catalog.btrim(p_other_repair_text) else null end
  from pg_catalog.unnest(v_normalized_codes) code;

  update public.cars
  set status = 'available'
  where id = p_car_id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'maintenance_id', v_record_id,
    'billing_status', p_billing_status,
    'pending_admin', p_billing_status = 'pending_invoice',
    'y6_trip_log_id', v_trip_log_id,
    'completed_at', v_completed_at
  );
end;
$$;

create or replace function private.complete_car_maintenance_impl(
  p_car_id bigint,
  p_staff_code text,
  p_completion_note text
)
returns jsonb
language sql
security definer
set search_path = pg_catalog
as $$
  select private.complete_car_maintenance_v2_impl(
    p_car_id,
    p_staff_code,
    p_completion_note,
    'pending_invoice',
    array[]::text[],
    null,
    null
  );
$$;

create or replace function public.complete_car_maintenance_v2(
  p_car_id bigint,
  p_staff_code text,
  p_completion_note text,
  p_billing_status text,
  p_repair_item_codes text[],
  p_other_repair_text text,
  p_repair_amount numeric
)
returns jsonb
language sql
set search_path = pg_catalog
as $$
  select private.complete_car_maintenance_v2_impl(
    p_car_id,
    p_staff_code,
    p_completion_note,
    p_billing_status,
    p_repair_item_codes,
    p_other_repair_text,
    p_repair_amount
  );
$$;

create or replace function public.admin_finalize_maintenance_billing(
  p_maintenance_id uuid,
  p_repair_item_codes text[],
  p_other_repair_text text,
  p_repair_amount numeric
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_record public.car_maintenance_records%rowtype;
  v_normalized_codes text[];
  v_trip_log_id bigint;
  v_billed_at timestamptz := now();
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  if p_maintenance_id is null then
    raise exception 'ไม่พบรายการซ่อม' using errcode = '22023';
  end if;

  if p_repair_amount is null or p_repair_amount < 0 then
    raise exception 'กรุณากรอกจำนวนเงินค่าซ่อมตั้งแต่ 0 บาทขึ้นไป' using errcode = '22023';
  end if;

  select array_agg(distinct code order by code)
  into v_normalized_codes
  from unnest(coalesce(p_repair_item_codes, array[]::text[])) code
  where code is not null and btrim(code) <> '';

  if coalesce(array_length(v_normalized_codes, 1), 0) = 0 then
    raise exception 'กรุณาเลือกรายการซ่อมอย่างน้อย 1 รายการ' using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(v_normalized_codes) code
    where not exists (
      select 1 from public.maintenance_repair_items mri
      where mri.code = code and mri.is_active = true
    )
  ) then
    raise exception 'พบรายการซ่อมที่ไม่ถูกต้อง' using errcode = '22023';
  end if;

  if 'other' = any(v_normalized_codes)
     and (p_other_repair_text is null or char_length(btrim(p_other_repair_text)) < 2) then
    raise exception 'กรุณาระบุรายละเอียดรายการซ่อมอื่น ๆ' using errcode = '22023';
  end if;

  select *
  into v_record
  from public.car_maintenance_records
  where id = p_maintenance_id
  for update;

  if not found then
    raise exception 'ไม่พบรายการซ่อมที่ต้องการแก้ไข' using errcode = 'P0002';
  end if;

  if v_record.status <> 'completed' or v_record.billing_status <> 'pending_invoice' then
    raise exception 'รายการนี้ไม่ได้อยู่ในสถานะรอข้อมูลวางบิล' using errcode = '22023';
  end if;

  v_trip_log_id := v_record.y6_trip_log_id;
  if v_trip_log_id is null then
    select tl.id
    into v_trip_log_id
    from public.trip_logs tl
    where tl.car_id = v_record.car_id
      and tl.is_completed = true
    order by coalesce(tl.end_time, tl.start_time, tl.created_at) desc, tl.id desc
    limit 1;
  end if;

  delete from public.car_maintenance_repair_items
  where maintenance_record_id = p_maintenance_id;

  insert into public.car_maintenance_repair_items (
    maintenance_record_id,
    repair_item_code,
    custom_text
  )
  select
    p_maintenance_id,
    code,
    case when code = 'other' then btrim(p_other_repair_text) else null end
  from unnest(v_normalized_codes) code;

  update public.car_maintenance_records
  set billing_status = 'billed',
      repair_amount = p_repair_amount,
      y6_trip_log_id = v_trip_log_id,
      billing_completed_by = (select auth.uid()),
      billed_at = v_billed_at
  where id = p_maintenance_id;

  return jsonb_build_object(
    'success', true,
    'maintenance_id', p_maintenance_id,
    'y6_trip_log_id', v_trip_log_id,
    'billed_at', v_billed_at
  );
end;
$$;

revoke all on function private.complete_car_maintenance_v2_impl(bigint, text, text, text, text[], text, numeric)
  from public, anon, authenticated;
grant execute on function private.complete_car_maintenance_v2_impl(bigint, text, text, text, text[], text, numeric)
  to anon, authenticated, service_role;

revoke all on function public.complete_car_maintenance_v2(bigint, text, text, text, text[], text, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_car_maintenance_v2(bigint, text, text, text, text[], text, numeric)
  to anon, authenticated, service_role;

revoke all on function public.admin_finalize_maintenance_billing(uuid, text[], text, numeric)
  from public, anon, authenticated;
grant execute on function public.admin_finalize_maintenance_billing(uuid, text[], text, numeric)
  to authenticated;
