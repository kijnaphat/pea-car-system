create table if not exists public.maintenance_issue_categories (
  code text primary key,
  name text not null unique,
  display_order smallint not null,
  is_active boolean not null default true,
  constraint maintenance_issue_categories_code_present
    check (code ~ '^[a-z0-9_]+$'),
  constraint maintenance_issue_categories_name_present
    check (char_length(btrim(name)) between 2 and 100)
);

insert into public.maintenance_issue_categories (code, name, display_order)
values
  ('tires_wheels', 'ยาง / ล้อ', 10),
  ('brakes', 'ระบบเบรก', 20),
  ('engine', 'เครื่องยนต์ / ระบบขับเคลื่อน', 30),
  ('electrical', 'ระบบไฟฟ้า / แบตเตอรี่', 40),
  ('air_conditioning', 'เครื่องปรับอากาศ', 50),
  ('body', 'ตัวถัง / กระจก', 60),
  ('equipment', 'อุปกรณ์ประจำรถ', 70),
  ('other', 'อื่น ๆ', 80)
on conflict (code) do update
set name = excluded.name,
    display_order = excluded.display_order,
    is_active = true;

create table if not exists public.car_maintenance_records (
  id uuid primary key default gen_random_uuid(),
  car_id bigint not null references public.cars(id) on update cascade on delete restrict,
  issue_category_code text not null references public.maintenance_issue_categories(code) on update cascade on delete restrict,
  description text not null,
  status text not null default 'open',
  reported_by_staff_id bigint not null references public.staff(id) on update cascade on delete restrict,
  reported_at timestamptz not null default now(),
  completed_by_staff_id bigint references public.staff(id) on update cascade on delete restrict,
  completion_note text,
  completed_at timestamptz,
  constraint car_maintenance_records_description_present
    check (char_length(btrim(description)) between 3 and 1000),
  constraint car_maintenance_records_status_valid
    check (status in ('open', 'completed')),
  constraint car_maintenance_records_lifecycle_valid
    check (
      (status = 'open' and completed_by_staff_id is null and completion_note is null and completed_at is null)
      or
      (status = 'completed' and completed_by_staff_id is not null and char_length(btrim(completion_note)) >= 3 and completed_at is not null)
    )
);

create unique index if not exists car_maintenance_records_one_open_per_car_idx
  on public.car_maintenance_records (car_id)
  where status = 'open';

create index if not exists car_maintenance_records_reported_at_idx
  on public.car_maintenance_records (reported_at desc);

create index if not exists car_maintenance_records_status_reported_at_idx
  on public.car_maintenance_records (status, reported_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.cars'::regclass
      and conname = 'cars_status_valid'
  ) then
    alter table public.cars
      add constraint cars_status_valid
      check (status in ('available', 'busy', 'maintenance'));
  end if;
end;
$$;

alter table public.maintenance_issue_categories enable row level security;
alter table public.car_maintenance_records enable row level security;

drop policy if exists "public_read_active_maintenance_categories" on public.maintenance_issue_categories;
create policy "public_read_active_maintenance_categories"
on public.maintenance_issue_categories
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "public_read_open_car_maintenance" on public.car_maintenance_records;
create policy "public_read_open_car_maintenance"
on public.car_maintenance_records
for select
to anon
using (status = 'open');

drop policy if exists "staff_read_open_or_admin_read_all_car_maintenance" on public.car_maintenance_records;
create policy "staff_read_open_or_admin_read_all_car_maintenance"
on public.car_maintenance_records
for select
to authenticated
using (
  status = 'open'
  or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin'
);

revoke all on table public.maintenance_issue_categories from public, anon, authenticated;
revoke all on table public.car_maintenance_records from public, anon, authenticated;
grant select on table public.maintenance_issue_categories to anon, authenticated;
grant select on table public.car_maintenance_records to anon, authenticated;

create or replace function private.report_car_maintenance_impl(
  p_car_id bigint,
  p_staff_code text,
  p_issue_category_code text,
  p_description text
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
  v_reported_at timestamptz;
begin
  if p_car_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรถในระบบ');
  end if;

  if p_staff_code is null or pg_catalog.btrim(p_staff_code) = '' then
    return pg_catalog.jsonb_build_object('error', 'กรุณาระบุรหัสพนักงาน');
  end if;

  if p_description is null or pg_catalog.char_length(pg_catalog.btrim(p_description)) < 3 then
    return pg_catalog.jsonb_build_object('error', 'กรุณาระบุรายละเอียดอาการอย่างน้อย 3 ตัวอักษร');
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(p_description)) > 1000 then
    return pg_catalog.jsonb_build_object('error', 'รายละเอียดอาการยาวเกิน 1,000 ตัวอักษร');
  end if;

  select s.id
  into v_staff_id
  from public.staff s
  where s.staff_code = pg_catalog.btrim(p_staff_code)
  limit 1;

  if v_staff_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรหัสพนักงานนี้');
  end if;

  if not exists (
    select 1
    from public.maintenance_issue_categories mic
    where mic.code = p_issue_category_code
      and mic.is_active = true
  ) then
    return pg_catalog.jsonb_build_object('error', 'กรุณาเลือกประเภทปัญหา');
  end if;

  select c.status
  into v_car_status
  from public.cars c
  where c.id = p_car_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรถในระบบ');
  end if;

  if v_car_status = 'busy' then
    return pg_catalog.jsonb_build_object('error', 'รถกำลังใช้งาน กรุณาคืนรถและเลือกส่งซ่อมในหน้าคืนรถ');
  end if;

  if v_car_status = 'maintenance' then
    return pg_catalog.jsonb_build_object('error', 'รถคันนี้อยู่ระหว่างซ่อมแล้ว');
  end if;

  if v_car_status <> 'available' then
    return pg_catalog.jsonb_build_object('error', 'สถานะรถไม่พร้อมสำหรับการแจ้งซ่อม');
  end if;

  if exists (
    select 1
    from public.trip_logs tl
    where tl.car_id = p_car_id
      and tl.is_completed = false
  ) then
    return pg_catalog.jsonb_build_object('error', 'พบรายการใช้งานที่ยังไม่คืนรถ กรุณาคืนรถก่อน');
  end if;

  insert into public.car_maintenance_records (
    car_id,
    issue_category_code,
    description,
    reported_by_staff_id
  ) values (
    p_car_id,
    p_issue_category_code,
    pg_catalog.btrim(p_description),
    v_staff_id
  )
  returning id, reported_at into v_record_id, v_reported_at;

  update public.cars
  set status = 'maintenance'
  where id = p_car_id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'maintenance_id', v_record_id,
    'reported_at', v_reported_at
  );
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('error', 'รถคันนี้มีรายการซ่อมที่ยังไม่ปิดอยู่แล้ว');
end;
$$;

create or replace function private.complete_car_maintenance_impl(
  p_car_id bigint,
  p_staff_code text,
  p_completion_note text
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

  v_completed_at := pg_catalog.now();

  update public.car_maintenance_records
  set status = 'completed',
      completed_by_staff_id = v_staff_id,
      completion_note = pg_catalog.btrim(p_completion_note),
      completed_at = v_completed_at
  where id = v_record_id;

  update public.cars
  set status = 'available'
  where id = p_car_id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'maintenance_id', v_record_id,
    'completed_at', v_completed_at
  );
end;
$$;

create or replace function private.return_car_and_report_maintenance_impl(
  p_car_id bigint,
  p_staff_code text,
  p_end_mileage integer,
  p_fuel_liters numeric,
  p_fuel_cost numeric,
  p_battery_after integer,
  p_issue_category_code text,
  p_description text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_car_status text;
  v_fuel_type text;
  v_staff_id bigint;
  v_log_id bigint;
  v_start_mileage integer;
  v_record_id uuid;
  v_reported_at timestamptz;
begin
  if p_car_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรถในระบบ');
  end if;

  if p_staff_code is null or pg_catalog.btrim(p_staff_code) = '' then
    return pg_catalog.jsonb_build_object('error', 'กรุณาระบุรหัสพนักงาน');
  end if;

  if p_description is null or pg_catalog.char_length(pg_catalog.btrim(p_description)) < 3 then
    return pg_catalog.jsonb_build_object('error', 'กรุณาระบุรายละเอียดอาการอย่างน้อย 3 ตัวอักษร');
  end if;

  if pg_catalog.char_length(pg_catalog.btrim(p_description)) > 1000 then
    return pg_catalog.jsonb_build_object('error', 'รายละเอียดอาการยาวเกิน 1,000 ตัวอักษร');
  end if;

  if coalesce(p_fuel_liters, 0) < 0 or coalesce(p_fuel_cost, 0) < 0 then
    return pg_catalog.jsonb_build_object('error', 'ข้อมูลน้ำมันไม่ถูกต้อง');
  end if;

  if p_battery_after is not null and (p_battery_after < 0 or p_battery_after > 100) then
    return pg_catalog.jsonb_build_object('error', 'เปอร์เซ็นต์แบตเตอรี่ต้องอยู่ระหว่าง 0 ถึง 100');
  end if;

  select s.id
  into v_staff_id
  from public.staff s
  where s.staff_code = pg_catalog.btrim(p_staff_code)
  limit 1;

  if v_staff_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรหัสพนักงานนี้');
  end if;

  if not exists (
    select 1
    from public.maintenance_issue_categories mic
    where mic.code = p_issue_category_code
      and mic.is_active = true
  ) then
    return pg_catalog.jsonb_build_object('error', 'กรุณาเลือกประเภทปัญหา');
  end if;

  select c.status, c.fuel_type
  into v_car_status, v_fuel_type
  from public.cars c
  where c.id = p_car_id
  for update;

  if not found then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรถในระบบ');
  end if;

  if v_car_status <> 'busy' then
    return pg_catalog.jsonb_build_object('error', 'รถคันนี้ไม่ได้อยู่ในสถานะกำลังใช้งาน');
  end if;

  select tl.id, tl.start_mileage
  into v_log_id, v_start_mileage
  from public.trip_logs tl
  where tl.car_id = p_car_id
    and tl.is_completed = false
  order by tl.start_time desc
  limit 1
  for update;

  if v_log_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรายการที่ค้างอยู่');
  end if;

  if pg_catalog.upper(coalesce(v_fuel_type, '')) = 'EV' then
    if p_battery_after is null then
      return pg_catalog.jsonb_build_object('error', 'กรุณากรอกเปอร์เซ็นต์แบตเตอรี่หลังชาร์จ');
    end if;
  else
    if p_end_mileage is null then
      return pg_catalog.jsonb_build_object('error', 'กรุณากรอกเลขไมล์ล่าสุด');
    end if;
    if p_end_mileage < v_start_mileage then
      return pg_catalog.jsonb_build_object('error', 'เลขไมล์จบต้องมากกว่าหรือเท่ากับเลขไมล์เริ่ม');
    end if;
  end if;

  update public.trip_logs
  set end_time = pg_catalog.now(),
      end_mileage = coalesce(p_end_mileage, v_start_mileage),
      fuel_liters = coalesce(p_fuel_liters, 0),
      fuel_cost = coalesce(p_fuel_cost, 0),
      battery_after = p_battery_after,
      is_completed = true
  where id = v_log_id;

  insert into public.car_maintenance_records (
    car_id,
    issue_category_code,
    description,
    reported_by_staff_id
  ) values (
    p_car_id,
    p_issue_category_code,
    pg_catalog.btrim(p_description),
    v_staff_id
  )
  returning id, reported_at into v_record_id, v_reported_at;

  update public.cars
  set status = 'maintenance'
  where id = p_car_id;

  return pg_catalog.jsonb_build_object(
    'success', true,
    'maintenance_id', v_record_id,
    'trip_log_id', v_log_id,
    'reported_at', v_reported_at
  );
exception
  when unique_violation then
    return pg_catalog.jsonb_build_object('error', 'รถคันนี้มีรายการซ่อมที่ยังไม่ปิดอยู่แล้ว');
end;
$$;

create or replace function public.report_car_maintenance(
  p_car_id bigint,
  p_staff_code text,
  p_issue_category_code text,
  p_description text
)
returns jsonb
language sql
set search_path = pg_catalog
as $$
  select private.report_car_maintenance_impl(
    p_car_id,
    p_staff_code,
    p_issue_category_code,
    p_description
  );
$$;

create or replace function public.complete_car_maintenance(
  p_car_id bigint,
  p_staff_code text,
  p_completion_note text
)
returns jsonb
language sql
set search_path = pg_catalog
as $$
  select private.complete_car_maintenance_impl(
    p_car_id,
    p_staff_code,
    p_completion_note
  );
$$;

create or replace function public.return_car_and_report_maintenance(
  p_car_id bigint,
  p_staff_code text,
  p_end_mileage integer,
  p_fuel_liters numeric,
  p_fuel_cost numeric,
  p_battery_after integer,
  p_issue_category_code text,
  p_description text
)
returns jsonb
language sql
set search_path = pg_catalog
as $$
  select private.return_car_and_report_maintenance_impl(
    p_car_id,
    p_staff_code,
    p_end_mileage,
    p_fuel_liters,
    p_fuel_cost,
    p_battery_after,
    p_issue_category_code,
    p_description
  );
$$;

revoke all on function private.report_car_maintenance_impl(bigint, text, text, text) from public;
revoke all on function private.complete_car_maintenance_impl(bigint, text, text) from public;
revoke all on function private.return_car_and_report_maintenance_impl(bigint, text, integer, numeric, numeric, integer, text, text) from public;
grant execute on function private.report_car_maintenance_impl(bigint, text, text, text) to anon, authenticated, service_role;
grant execute on function private.complete_car_maintenance_impl(bigint, text, text) to anon, authenticated, service_role;
grant execute on function private.return_car_and_report_maintenance_impl(bigint, text, integer, numeric, numeric, integer, text, text) to anon, authenticated, service_role;

revoke all on function public.report_car_maintenance(bigint, text, text, text) from public, anon, authenticated;
revoke all on function public.complete_car_maintenance(bigint, text, text) from public, anon, authenticated;
revoke all on function public.return_car_and_report_maintenance(bigint, text, integer, numeric, numeric, integer, text, text) from public, anon, authenticated;
grant execute on function public.report_car_maintenance(bigint, text, text, text) to anon, authenticated, service_role;
grant execute on function public.complete_car_maintenance(bigint, text, text) to anon, authenticated, service_role;
grant execute on function public.return_car_and_report_maintenance(bigint, text, integer, numeric, numeric, integer, text, text) to anon, authenticated, service_role;

create or replace function private.take_car_out_v3_impl(
  p_car_id bigint,
  p_staff_code text,
  p_start_mileage integer,
  p_location text,
  p_battery_before integer,
  p_station_type text,
  p_station_name text,
  p_task_id integer,
  p_operation_area_ids integer[]
)
returns json
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_status text;
  v_fuel_type text;
  v_active_count integer;
  v_driver_staff_id bigint;
  v_driver_name text;
  v_driver_position text;
  v_driver_department_id integer;
  v_trip_log_id bigint;
begin
  if p_car_id is null or p_staff_code is null or pg_catalog.btrim(p_staff_code) = '' then
    return pg_catalog.json_build_object('error', 'ข้อมูลรถหรือรหัสพนักงานไม่ครบถ้วน');
  end if;

  if p_start_mileage is not null and p_start_mileage < 0 then
    return pg_catalog.json_build_object('error', 'เลขไมล์เริ่มต้นไม่ถูกต้อง');
  end if;

  select s.id, s.full_name, s.position, s.department_id
  into v_driver_staff_id, v_driver_name, v_driver_position, v_driver_department_id
  from public.staff s
  where s.staff_code = pg_catalog.btrim(p_staff_code)
  limit 1;

  if v_driver_staff_id is null then
    return pg_catalog.json_build_object('error', 'ไม่พบข้อมูลพนักงานในระบบ');
  end if;

  if p_task_id is not null and not exists (
    select 1
    from public.tasks t
    where t.id = p_task_id
      and t.department_id = v_driver_department_id
  ) then
    return pg_catalog.json_build_object('error', 'ประเภทงานไม่ตรงกับแผนกพนักงาน');
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(coalesce(p_operation_area_ids, array[]::integer[])) area_id
    where area_id is not null
      and not exists (
        select 1 from public.operation_areas oa where oa.id = area_id
      )
  ) then
    return pg_catalog.json_build_object('error', 'ไม่พบพื้นที่ปฏิบัติงานในระบบ');
  end if;

  select c.status, c.fuel_type
  into v_status, v_fuel_type
  from public.cars c
  where c.id = p_car_id
  for update;

  if not found then
    return pg_catalog.json_build_object('error', 'ไม่พบรถในระบบ');
  end if;

  if v_status = 'busy' then
    return pg_catalog.json_build_object('error', 'รถกำลังถูกใช้งานอยู่');
  end if;

  if v_status = 'maintenance' then
    return pg_catalog.json_build_object('error', 'รถกำลังซ่อมและยังไม่พร้อมใช้งาน');
  end if;

  if v_status <> 'available' then
    return pg_catalog.json_build_object('error', 'สถานะรถไม่พร้อมใช้งาน');
  end if;

  select pg_catalog.count(*)
  into v_active_count
  from public.trip_logs
  where driver_staff_id = v_driver_staff_id
    and is_completed = false;

  if v_active_count > 0 then
    return pg_catalog.json_build_object('error', 'พนักงานยังไม่คืนรถคันเดิม');
  end if;

  insert into public.trip_logs (
    car_id,
    driver_staff_id,
    task_id,
    driver_name,
    driver_position,
    start_mileage,
    start_time,
    location,
    battery_before,
    station_type,
    station_name,
    is_completed
  ) values (
    p_car_id,
    v_driver_staff_id,
    p_task_id,
    v_driver_name,
    v_driver_position,
    p_start_mileage,
    pg_catalog.now(),
    p_location,
    p_battery_before,
    p_station_type,
    p_station_name,
    false
  )
  returning id into v_trip_log_id;

  insert into public.trip_log_operation_areas (trip_log_id, operation_area_id)
  select v_trip_log_id, area_id
  from (
    select distinct area_id
    from pg_catalog.unnest(
      coalesce(p_operation_area_ids, array[]::integer[])
    ) area_id
    where area_id is not null
  ) normalized_areas;

  update public.cars
  set status = 'busy'
  where id = p_car_id;

  return pg_catalog.json_build_object(
    'success', true,
    'trip_log_id', v_trip_log_id
  );
end;
$$;
