-- EV charging remains backward-compatible; historical rows are never rewritten.
alter table public.trip_logs add column activity_type text;
alter table public.trip_logs add constraint trip_logs_activity_type_check check (activity_type in ('usage','charge'));
comment on column public.trip_logs.activity_type is 'usage = driving; charge = EV charging; NULL = legacy (EV charging, other driving)';

create or replace function public.effective_trip_activity(p_activity_type text, p_fuel_type text)
returns text language sql immutable security invoker set search_path = ''
as $$ select coalesce(p_activity_type, case when upper(btrim(coalesce(p_fuel_type, ''))) = 'EV' then 'charge' else 'usage' end); $$;
revoke all on function public.effective_trip_activity(text,text) from public;
grant execute on function public.effective_trip_activity(text,text) to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.take_car_out_v4_impl(p_car_id bigint, p_staff_code text, p_start_mileage integer, p_location text, p_battery_before integer, p_station_type text, p_station_name text, p_task_id integer, p_operation_area_ids integer[], p_activity_type text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_activity text;
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
  limit 1
  for update;

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

  v_activity := public.effective_trip_activity(p_activity_type, v_fuel_type);
  if v_activity not in ('usage','charge') then
    return pg_catalog.json_build_object('error','ประเภทกิจกรรมไม่ถูกต้อง');
  end if;
  if p_start_mileage is null or p_start_mileage < 0 or nullif(pg_catalog.btrim(p_location),'') is null then
    return pg_catalog.json_build_object('error','กรุณากรอกเลขไมล์และสถานที่ให้ครบถ้วน');
  end if;
  if v_activity = 'charge' then
    if upper(btrim(coalesce(v_fuel_type,''))) <> 'EV' then
      return pg_catalog.json_build_object('error','บันทึกชาร์จได้เฉพาะรถ EV');
    end if;
    if p_battery_before is null or p_battery_before < 0 or p_battery_before > 100
       or p_station_type not in ('PEA','OTHER') or p_station_type is null
       or nullif(pg_catalog.btrim(p_station_name),'') is null then
      return pg_catalog.json_build_object('error','กรุณากรอกแบตเตอรี่ 0–100% และสถานีชาร์จให้ครบถ้วน');
    end if;
  elsif p_battery_before is not null or nullif(p_station_type,'') is not null or nullif(p_station_name,'') is not null then
    return pg_catalog.json_build_object('error','รายการใช้งานรถต้องไม่ปนข้อมูลการชาร์จ');
  end if;
  if exists (select 1 from public.trip_logs where car_id = p_car_id and is_completed = false) then
    return pg_catalog.json_build_object('error','รถยังมีรายการที่ไม่ได้ปิด');
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
    activity_type,
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
    v_activity,
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
$function$
;
CREATE OR REPLACE FUNCTION private.take_car_out_v3_impl(p_car_id bigint, p_staff_code text, p_start_mileage integer, p_location text, p_battery_before integer, p_station_type text, p_station_name text, p_task_id integer, p_operation_area_ids integer[])
 RETURNS json
 LANGUAGE sql
 SECURITY INVOKER
 SET search_path TO 'pg_catalog'
AS $$ select private.take_car_out_v4_impl(p_car_id,p_staff_code,p_start_mileage,p_location,p_battery_before,p_station_type,p_station_name,p_task_id,p_operation_area_ids,null); $$;
CREATE OR REPLACE FUNCTION public.take_car_out_v4(p_car_id bigint, p_staff_code text, p_start_mileage integer, p_location text, p_battery_before integer, p_station_type text, p_station_name text, p_task_id integer, p_operation_area_ids integer[], p_activity_type text)
 RETURNS json
 LANGUAGE sql
 SET search_path TO 'pg_catalog'
AS $function$
  select private.take_car_out_v4_impl(
    p_car_id,
    p_staff_code,
    p_start_mileage,
    p_location,
    p_battery_before,
    p_station_type,
    p_station_name,
    p_task_id,
    p_operation_area_ids,
    p_activity_type
  );
$function$
;
CREATE OR REPLACE FUNCTION private.take_car_out_after_maintenance_v2_impl(p_token uuid, p_car_id bigint, p_start_mileage integer, p_location text, p_battery_before integer, p_station_type text, p_station_name text, p_task_id integer, p_operation_area_ids integer[], p_activity_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_handoff record;
  v_staff_code text;
  v_result jsonb;
  v_trip_log_id bigint;
begin
  if p_token is null or p_car_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบสิทธิ์ดำเนินการต่อจากงานซ่อม');
  end if;

  select h.token, h.maintenance_record_id, h.staff_id
  into v_handoff
  from private.maintenance_takeout_handoffs h
  join public.car_maintenance_records cmr on cmr.id = h.maintenance_record_id
  where h.token = p_token
    and h.car_id = p_car_id
    and h.used_at is null
    and h.expires_at > pg_catalog.now()
    and cmr.status = 'completed'
  for update of h;

  if not found then
    return pg_catalog.jsonb_build_object('error', 'สิทธิ์ดำเนินการต่อหมดอายุหรือถูกใช้งานแล้ว กรุณากรอกรหัสพนักงานตามปกติ');
  end if;

  select s.staff_code
  into v_staff_code
  from public.staff s
  where s.id = v_handoff.staff_id;

  if v_staff_code is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบข้อมูลพนักงานผู้เปิดใช้งานรถ');
  end if;

  v_result := private.take_car_out_v4_impl(
    p_car_id,
    v_staff_code,
    p_start_mileage,
    p_location,
    p_battery_before,
    p_station_type,
    p_station_name,
    p_task_id,
    p_operation_area_ids,
    p_activity_type
  )::jsonb;

  if v_result ? 'error' then
    return v_result;
  end if;

  v_trip_log_id := (v_result ->> 'trip_log_id')::bigint;

  update public.car_maintenance_records
  set y6_trip_log_id = v_trip_log_id
  where id = v_handoff.maintenance_record_id;

  update private.maintenance_takeout_handoffs
  set used_at = pg_catalog.now()
  where token = p_token;

  return v_result || pg_catalog.jsonb_build_object(
    'maintenance_id', v_handoff.maintenance_record_id,
    'y6_trip_log_id', v_trip_log_id,
    'maintenance_handoff_used', true
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.take_car_out_after_maintenance_v2(p_token uuid, p_car_id bigint, p_start_mileage integer, p_location text, p_battery_before integer, p_station_type text, p_station_name text, p_task_id integer, p_operation_area_ids integer[], p_activity_type text)
 RETURNS jsonb
 LANGUAGE sql
 SET search_path TO 'pg_catalog'
AS $function$
  select private.take_car_out_after_maintenance_v2_impl(
    p_token,
    p_car_id,
    p_start_mileage,
    p_location,
    p_battery_before,
    p_station_type,
    p_station_name,
    p_task_id,
    p_operation_area_ids,
    p_activity_type
  );
$function$
;

create or replace function private.return_car_activity_impl(p_car_id bigint,p_end_mileage integer,p_fuel_liters numeric,p_fuel_cost numeric,p_battery_after integer,p_trip_log_id bigint)
returns json language plpgsql security definer set search_path = 'pg_catalog' as $$
declare
  v_car public.cars%rowtype;
  v_log public.trip_logs%rowtype;
  v_activity text;
begin
  select * into v_car from public.cars where id=p_car_id for update;
  if not found or v_car.status <> 'busy' then
    return json_build_object('error','รถไม่ได้อยู่ในสถานะกำลังใช้งาน');
  end if;
  select * into v_log from public.trip_logs where car_id=p_car_id and is_completed=false order by start_time desc,id desc limit 1 for update;
  if not found then return json_build_object('error','ไม่พบรายการที่ค้างอยู่'); end if;
  if p_trip_log_id is not null and v_log.id <> p_trip_log_id then
    return json_build_object('error','รายการรถเปลี่ยนแล้ว กรุณาสแกน QR ใหม่');
  end if;
  if (select count(*) from public.trip_logs where car_id=p_car_id and is_completed=false) <> 1 then
    return json_build_object('error','พบรายการค้างซ้ำ กรุณาให้ผู้ดูแลตรวจสอบ');
  end if;
  v_activity := public.effective_trip_activity(v_log.activity_type,v_car.fuel_type);
  if coalesce(p_fuel_liters,0)<0 or coalesce(p_fuel_cost,0)<0 then
    return json_build_object('error','ข้อมูลน้ำมันไม่ถูกต้อง');
  end if;
  if upper(btrim(coalesce(v_car.fuel_type,'')))='EV' and (coalesce(p_fuel_liters,0)<>0 or coalesce(p_fuel_cost,0)<>0) then
    return json_build_object('error','รถ EV ไม่บันทึกการเติมน้ำมัน');
  end if;
  if v_activity='charge' then
    if p_battery_after is null or p_battery_after<0 or p_battery_after>100 or p_battery_after<=v_log.battery_before then
      return json_build_object('error','แบตหลังชาร์จต้องเพิ่มขึ้นและอยู่ในช่วง 0–100%');
    end if;
    if p_end_mileage is not null and p_end_mileage<>v_log.start_mileage then
      return json_build_object('error','เลขไมล์ระหว่างชาร์จต้องเท่าเดิม');
    end if;
  else
    if p_end_mileage is null or p_end_mileage<0 or p_end_mileage<v_log.start_mileage then
      return json_build_object('error','เลขไมล์คืนต้องไม่น้อยกว่าเลขไมล์ออก');
    end if;
    if p_battery_after is not null then
      return json_build_object('error','รายการใช้งานรถต้องไม่ปนข้อมูลการชาร์จ');
    end if;
  end if;
  update public.trip_logs set end_time=now(),end_mileage=case when v_activity='charge' then v_log.start_mileage else p_end_mileage end,
    fuel_liters=coalesce(p_fuel_liters,0),fuel_cost=coalesce(p_fuel_cost,0),battery_after=p_battery_after,is_completed=true where id=v_log.id;
  update public.cars set status='available' where id=p_car_id;
  return json_build_object('success',true,'trip_log_id',v_log.id,'activity_type',v_activity);
end;
$$;
create or replace function public.return_car(p_car_id bigint,p_end_mileage integer,p_fuel_liters numeric,p_fuel_cost numeric,p_battery_after integer)
returns json language sql security invoker set search_path='pg_catalog'
as $$ select private.return_car_activity_impl(p_car_id,p_end_mileage,p_fuel_liters,p_fuel_cost,p_battery_after,null); $$;
create or replace function public.return_car_v2(p_car_id bigint,p_end_mileage integer,p_fuel_liters numeric,p_fuel_cost numeric,p_battery_after integer,p_trip_log_id bigint)
returns json language sql security invoker set search_path='pg_catalog'
as $$ select case when p_trip_log_id is null then json_build_object('error','ไม่พบรหัสรายการ กรุณาสแกนใหม่') else private.return_car_activity_impl(p_car_id,p_end_mileage,p_fuel_liters,p_fuel_cost,p_battery_after,p_trip_log_id) end; $$;
CREATE OR REPLACE FUNCTION private.return_car_and_report_maintenance_impl(p_car_id bigint, p_staff_code text, p_end_mileage integer, p_fuel_liters numeric, p_fuel_cost numeric, p_battery_after integer, p_issue_category_code text, p_description text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_car_status text;
  v_fuel_type text;
  v_activity text;
  v_battery_before integer;
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

  select tl.id, tl.start_mileage, public.effective_trip_activity(tl.activity_type,v_fuel_type), tl.battery_before
  into v_log_id, v_start_mileage, v_activity, v_battery_before
  from public.trip_logs tl
  where tl.car_id = p_car_id
    and tl.is_completed = false
  order by tl.start_time desc
  limit 1
  for update;

  if v_log_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบรายการที่ค้างอยู่');
  end if;

  if pg_catalog.upper(btrim(coalesce(v_fuel_type,''))) = 'EV' and (coalesce(p_fuel_liters,0)<>0 or coalesce(p_fuel_cost,0)<>0) then
    return jsonb_build_object('error','รถ EV ไม่บันทึกการเติมน้ำมัน');
  end if;
  if (select count(*) from public.trip_logs where car_id=p_car_id and is_completed=false) <> 1 then return jsonb_build_object('error','พบรายการค้างซ้ำ กรุณาให้ผู้ดูแลตรวจสอบ'); end if;
  if v_activity = 'charge' then
    if p_end_mileage is not null and p_end_mileage <> v_start_mileage then return jsonb_build_object('error','เลขไมล์ระหว่างชาร์จต้องเท่าเดิม'); end if;
    if p_battery_after is null or p_battery_after <= v_battery_before then
      return pg_catalog.jsonb_build_object('error', 'กรุณากรอกเปอร์เซ็นต์แบตเตอรี่หลังชาร์จ');
    end if;
  else
    if p_battery_after is not null then return jsonb_build_object('error','รายการใช้งานรถต้องไม่ปนข้อมูลการชาร์จ'); end if;
    if p_end_mileage is null or p_end_mileage < 0 then
      return pg_catalog.jsonb_build_object('error', 'กรุณากรอกเลขไมล์ล่าสุด');
    end if;
    if p_end_mileage < v_start_mileage then
      return pg_catalog.jsonb_build_object('error', 'เลขไมล์จบต้องมากกว่าหรือเท่ากับเลขไมล์เริ่ม');
    end if;
  end if;

  update public.trip_logs
  set end_time = pg_catalog.now(),
      end_mileage = case when v_activity = 'charge' then v_start_mileage else p_end_mileage end,
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
$function$
;
CREATE OR REPLACE FUNCTION public.get_public_fleet_snapshot()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with visible_cars as materialized (
    select c.*, case when d.id is null then null else jsonb_build_object('name', d.name) end as departments
    from public.cars c
    left join public.departments d on d.id = c.department_id
    where c.is_visible is distinct from false
  ), active_trips as (
    select t.id, t.car_id, t.start_time, t.end_time, t.start_mileage, t.end_mileage,
           t.driver_name, t.driver_position, t.location, t.is_completed, t.activity_type
    from public.trip_logs t
    join visible_cars c on c.id = t.car_id
    where t.is_completed = false
    order by t.start_time desc
  ), latest_trips as (
    select distinct on (t.car_id)
           t.id, t.car_id, t.start_time, t.end_time, t.start_mileage, t.end_mileage,
           t.driver_name, t.driver_position, t.location, t.is_completed, t.activity_type
    from public.trip_logs t
    join visible_cars c on c.id = t.car_id
    where t.is_completed = true
    order by t.car_id, t.start_time desc, t.id desc
  ), open_maintenance as (
    select m.id, m.car_id, m.description, m.reported_at, m.issue_category_code,
           case when cat.code is null then null else jsonb_build_object('name', cat.name) end as maintenance_issue_categories
    from public.car_maintenance_records m
    join visible_cars c on c.id = m.car_id
    left join public.maintenance_issue_categories cat on cat.code = m.issue_category_code
    where m.status = 'open'
    order by m.reported_at desc
  )
  select jsonb_build_object(
    'carsDataRaw', coalesce((select jsonb_agg(to_jsonb(c)) from visible_cars c), '[]'::jsonb),
    'activeLogs', coalesce((select jsonb_agg(to_jsonb(t)) from active_trips t), '[]'::jsonb),
    'latestLogs', coalesce((select jsonb_agg(to_jsonb(t)) from latest_trips t), '[]'::jsonb),
    'maintenanceRecords', coalesce((select jsonb_agg(to_jsonb(m)) from open_maintenance m), '[]'::jsonb),
    'generatedAt', current_timestamp
  );
$function$
;
CREATE OR REPLACE FUNCTION public.admin_correct_ev_charge_mileage(p_trip_log_id bigint, p_new_value integer, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_trip public.trip_logs%rowtype;
  v_fuel_type text;
  v_batch_id uuid := gen_random_uuid();
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  if p_new_value is null or p_new_value < 0 then
    raise exception 'เลขไมล์ใหม่ต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป' using errcode = '22023';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร' using errcode = '22023';
  end if;

  select *
  into v_trip
  from public.trip_logs
  where id = p_trip_log_id
  for update;

  if not found then
    raise exception 'ไม่พบรายการชาร์จที่ต้องการแก้ไข' using errcode = 'P0002';
  end if;

  select fuel_type
  into v_fuel_type
  from public.cars
  where id = v_trip.car_id;

  if public.effective_trip_activity(v_trip.activity_type,v_fuel_type) <> 'charge' then
    raise exception 'รายการนี้ไม่ใช่รถ EV' using errcode = '22023';
  end if;

  if v_trip.start_mileage is not distinct from p_new_value
     and (
       (not coalesce(v_trip.is_completed, false) and v_trip.end_mileage is null)
       or v_trip.end_mileage is not distinct from p_new_value
     ) then
    raise exception 'เลขไมล์ใหม่ต้องไม่ซ้ำกับค่าเดิม' using errcode = '22023';
  end if;

  perform set_config('app.mileage_correction_reason', btrim(p_reason), true);
  perform set_config('app.mileage_correction_batch_id', v_batch_id::text, true);

  update public.trip_logs
  set
    start_mileage = p_new_value,
    end_mileage = case
      when coalesce(v_trip.is_completed, false) or v_trip.end_mileage is not null then p_new_value
      else null
    end
  where id = v_trip.id;

  return jsonb_build_object(
    'trip_log_id', v_trip.id,
    'old_start_mileage', v_trip.start_mileage,
    'old_end_mileage', v_trip.end_mileage,
    'new_mileage', p_new_value,
    'batch_id', v_batch_id,
    'updated_both', coalesce(v_trip.is_completed, false) or v_trip.end_mileage is not null
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_correct_trip_mileage(p_trip_log_id bigint, p_field_name text, p_new_value integer, p_reason text, p_sync_adjacent boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_trip public.trip_logs%rowtype;
  v_adjacent public.trip_logs%rowtype;
  v_old_value integer;
  v_batch_id uuid := gen_random_uuid();
  v_synced_trip_id bigint;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  if p_field_name not in ('start_mileage', 'end_mileage') then
    raise exception 'ช่องเลขไมล์ไม่ถูกต้อง' using errcode = '22023';
  end if;

  if p_new_value is null or p_new_value < 0 then
    raise exception 'เลขไมล์ใหม่ต้องเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป' using errcode = '22023';
  end if;

  if p_reason is null or char_length(btrim(p_reason)) < 3 then
    raise exception 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร' using errcode = '22023';
  end if;

  select *
  into v_trip
  from public.trip_logs
  where id = p_trip_log_id
  for update;

  if not found then
    raise exception 'ไม่พบรายการเดินทางที่ต้องการแก้ไข' using errcode = 'P0002';
  end if;

  if public.effective_trip_activity(v_trip.activity_type,(select fuel_type from public.cars where id=v_trip.car_id))='charge' then
    raise exception 'ใช้เมนูแก้ไขเลขไมล์การชาร์จสำหรับรายการนี้' using errcode='22023';
  end if;
  perform set_config('app.mileage_correction_reason', btrim(p_reason), true);
  perform set_config('app.mileage_correction_batch_id', v_batch_id::text, true);

  if p_field_name = 'start_mileage' then
    v_old_value := v_trip.start_mileage;

    if v_old_value is null then
      raise exception 'รายการนี้ไม่มีเลขไมล์ตอนนำรถออกให้แก้ไข' using errcode = '22023';
    end if;

    if p_new_value = v_old_value then
      raise exception 'เลขไมล์ใหม่ต้องไม่ซ้ำกับค่าเดิม' using errcode = '22023';
    end if;

    if v_trip.end_mileage is not null and p_new_value > v_trip.end_mileage then
      raise exception 'เลขไมล์ตอนนำรถออกต้องไม่มากกว่าเลขไมล์ตอนคืนรถ' using errcode = '22023';
    end if;

    if p_sync_adjacent then
      select *
      into v_adjacent
      from public.trip_logs
      where car_id = v_trip.car_id
        and (coalesce(start_time, created_at), id)
          < (coalesce(v_trip.start_time, v_trip.created_at), v_trip.id)
      order by coalesce(start_time, created_at) desc, id desc
      limit 1
      for update;

      if found and v_adjacent.end_mileage = v_old_value then
        if v_adjacent.start_mileage is not null and p_new_value < v_adjacent.start_mileage then
          raise exception 'เลขใหม่จะทำให้เลขไมล์คืนของเที่ยวก่อนหน้าต่ำกว่าเลขไมล์ออก' using errcode = '22023';
        end if;

        update public.trip_logs
        set end_mileage = p_new_value, start_mileage = case when public.effective_trip_activity(v_adjacent.activity_type,(select fuel_type from public.cars where id=v_adjacent.car_id))='charge' then p_new_value else start_mileage end
        where id = v_adjacent.id;
        v_synced_trip_id := v_adjacent.id;
      end if;
    end if;

    update public.trip_logs
    set start_mileage = p_new_value
    where id = v_trip.id;
  else
    v_old_value := v_trip.end_mileage;

    if v_old_value is null then
      raise exception 'รายการนี้ยังไม่มีเลขไมล์ตอนคืนรถให้แก้ไข' using errcode = '22023';
    end if;

    if p_new_value = v_old_value then
      raise exception 'เลขไมล์ใหม่ต้องไม่ซ้ำกับค่าเดิม' using errcode = '22023';
    end if;

    if v_trip.start_mileage is not null and p_new_value < v_trip.start_mileage then
      raise exception 'เลขไมล์ตอนคืนรถต้องไม่น้อยกว่าเลขไมล์ตอนนำรถออก' using errcode = '22023';
    end if;

    if p_sync_adjacent then
      select *
      into v_adjacent
      from public.trip_logs
      where car_id = v_trip.car_id
        and (coalesce(start_time, created_at), id)
          > (coalesce(v_trip.start_time, v_trip.created_at), v_trip.id)
      order by coalesce(start_time, created_at), id
      limit 1
      for update;

      if found and v_adjacent.start_mileage = v_old_value then
        if v_adjacent.end_mileage is not null and p_new_value > v_adjacent.end_mileage then
          raise exception 'เลขใหม่จะทำให้เลขไมล์ออกของเที่ยวถัดไปมากกว่าเลขไมล์คืน' using errcode = '22023';
        end if;

        update public.trip_logs
        set start_mileage = p_new_value, end_mileage = case when public.effective_trip_activity(v_adjacent.activity_type,(select fuel_type from public.cars where id=v_adjacent.car_id))='charge' and v_adjacent.is_completed then p_new_value else end_mileage end
        where id = v_adjacent.id;
        v_synced_trip_id := v_adjacent.id;
      end if;
    end if;

    update public.trip_logs
    set end_mileage = p_new_value
    where id = v_trip.id;
  end if;

  return jsonb_build_object(
    'trip_log_id', v_trip.id,
    'field_name', p_field_name,
    'old_value', v_old_value,
    'new_value', p_new_value,
    'batch_id', v_batch_id,
    'synced_trip_log_id', v_synced_trip_id
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION private.queue_daily_vehicle_usage_summary(p_report_date date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  v_bangkok_today date := pg_catalog.timezone('Asia/Bangkok', pg_catalog.now())::date;
  v_report_date date := coalesce(p_report_date, v_bangkok_today - 1);
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_event_id uuid;
  v_trip_count integer := 0;
  v_cars_out integer := 0;
  v_return_trip_count integer := 0;
  v_cars_returned integer := 0;
  v_outstanding integer := 0;
  v_overdue_12h integer := 0;
  v_distance_km numeric := 0;
  v_bad_mileage integer := 0;
  v_long_distance integer := 0;
  v_bad_time integer := 0;
  v_missing_return integer := 0;
  v_bad_ev_battery integer := 0;
  v_duplicate_active integer := 0;
  v_data_anomaly_count integer := 0;
  v_issue_count integer := 0;
  v_overdue_list text;
  v_analysis text;
  v_description text;
  v_color integer;
  v_fields jsonb;
  v_summary jsonb;
begin
  if v_report_date >= v_bangkok_today then
    raise exception 'รายงานรายวันสร้างได้เฉพาะวันที่สิ้นสุดแล้วเท่านั้น'
      using errcode = '22023';
  end if;

  -- Keep generation idempotent even when the cron worker retries.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('pea-car-daily-summary:' || v_report_date::text));

  select r.event_id
  into v_event_id
  from private.daily_vehicle_usage_reports r
  where r.report_date = v_report_date;

  if found then
    return v_event_id;
  end if;

  v_period_start := v_report_date::timestamp at time zone 'Asia/Bangkok';
  v_period_end := (v_report_date + 1)::timestamp at time zone 'Asia/Bangkok';

  select pg_catalog.count(*)::integer,
         pg_catalog.count(distinct tl.car_id)::integer
  into v_trip_count, v_cars_out
  from public.trip_logs tl
  where public.effective_trip_activity(tl.activity_type,(select fuel_type from public.cars where id=tl.car_id))='usage'
    and coalesce(tl.start_time, tl.created_at) >= v_period_start
    and coalesce(tl.start_time, tl.created_at) < v_period_end;

  select pg_catalog.count(*)::integer,
         pg_catalog.count(distinct tl.car_id)::integer,
         coalesce(pg_catalog.sum(
           case
             when tl.start_mileage is not null
              and tl.end_mileage is not null
              and tl.end_mileage >= tl.start_mileage
             then tl.end_mileage - tl.start_mileage
             else 0
           end
         ), 0)
  into v_return_trip_count, v_cars_returned, v_distance_km
  from public.trip_logs tl
  where public.effective_trip_activity(tl.activity_type,(select fuel_type from public.cars where id=tl.car_id))='usage'
    and tl.end_time >= v_period_start
    and tl.end_time < v_period_end;

  select pg_catalog.count(distinct tl.car_id)::integer,
         pg_catalog.count(distinct tl.car_id) filter (
           where public.effective_trip_activity(tl.activity_type,(select fuel_type from public.cars where id=tl.car_id))='usage'
        and coalesce(tl.start_time, tl.created_at) <= v_period_end - interval '12 hours'
         )::integer
  into v_outstanding, v_overdue_12h
  from public.trip_logs tl
  where public.effective_trip_activity(tl.activity_type,(select fuel_type from public.cars where id=tl.car_id))='usage'
    and coalesce(tl.start_time, tl.created_at) < v_period_end
    and (tl.end_time is null or tl.end_time >= v_period_end);

  select
    pg_catalog.count(*) filter (
      where tl.start_mileage is not null
        and tl.end_mileage is not null
        and tl.end_mileage < tl.start_mileage
    )::integer,
    pg_catalog.count(*) filter (
      where tl.start_mileage is not null
        and tl.end_mileage is not null
        and tl.end_mileage - tl.start_mileage > 1000
    )::integer,
    pg_catalog.count(*) filter (
      where tl.end_time is not null
        and tl.end_time < coalesce(tl.start_time, tl.created_at)
    )::integer,
    pg_catalog.count(*) filter (
      where coalesce(tl.is_completed, false)
        and tl.end_time is null
    )::integer,
    pg_catalog.count(*) filter (
      where public.effective_trip_activity(tl.activity_type,c.fuel_type) = 'charge'
        and (
          tl.battery_before is null
          or tl.battery_before < 0
          or tl.battery_before > 100
          or (
            coalesce(tl.is_completed, false)
            and (
              tl.battery_after is null
              or tl.battery_after < 0
              or tl.battery_after > 100
              or tl.battery_after <= tl.battery_before
            )
          )
        )
    )::integer,
    pg_catalog.count(distinct tl.id) filter (
      where (
        (tl.start_mileage is not null and tl.end_mileage is not null and tl.end_mileage < tl.start_mileage)
        or (tl.start_mileage is not null and tl.end_mileage is not null and tl.end_mileage - tl.start_mileage > 1000)
        or (tl.end_time is not null and tl.end_time < coalesce(tl.start_time, tl.created_at))
        or (coalesce(tl.is_completed, false) and tl.end_time is null)
        or (
          public.effective_trip_activity(tl.activity_type,c.fuel_type) = 'charge'
          and (
            tl.battery_before is null
            or tl.battery_before < 0
            or tl.battery_before > 100
            or (
              coalesce(tl.is_completed, false)
              and (
                tl.battery_after is null
                or tl.battery_after < 0
                or tl.battery_after > 100
                or tl.battery_after <= tl.battery_before
              )
            )
          )
        )
      )
    )::integer
  into v_bad_mileage, v_long_distance, v_bad_time, v_missing_return,
       v_bad_ev_battery, v_data_anomaly_count
  from public.trip_logs tl
  left join public.cars c on c.id = tl.car_id
  where (
      coalesce(tl.start_time, tl.created_at) >= v_period_start
      and coalesce(tl.start_time, tl.created_at) < v_period_end
    ) or (
      tl.end_time >= v_period_start
      and tl.end_time < v_period_end
    );

  select pg_catalog.string_agg(
    '• ' || outstanding.plate_number || ' · ' || outstanding.driver_name || ' · ' ||
    outstanding.duration_text,
    E'\n'
    order by outstanding.started_at
  )
  into v_overdue_list
  from (
    select per_car.*
    from (
      select distinct on (tl.car_id)
        coalesce(nullif(pg_catalog.btrim(c.plate_number), ''), 'ไม่ระบุทะเบียน') as plate_number,
        coalesce(nullif(pg_catalog.btrim(tl.driver_name), ''), 'ไม่ระบุผู้ขับ') as driver_name,
        coalesce(tl.start_time, tl.created_at) as started_at,
        pg_catalog.floor(extract(epoch from (v_period_end - coalesce(tl.start_time, tl.created_at))) / 3600)::integer::text ||
          ' ชม. ' ||
          (pg_catalog.floor(extract(epoch from (v_period_end - coalesce(tl.start_time, tl.created_at))) / 60)::integer % 60)::text ||
          ' นาที' as duration_text
      from public.trip_logs tl
      left join public.cars c on c.id = tl.car_id
      where coalesce(tl.start_time, tl.created_at) <= v_period_end - interval '12 hours'
        and (tl.end_time is null or tl.end_time >= v_period_end)
      order by tl.car_id, coalesce(tl.start_time, tl.created_at)
    ) per_car
    order by per_car.started_at
    limit 5
  ) outstanding;

  select pg_catalog.count(*)::integer
  into v_duplicate_active
  from (
    select tl.car_id
    from public.trip_logs tl
    where coalesce(tl.start_time, tl.created_at) < v_period_end
      and (tl.end_time is null or tl.end_time >= v_period_end)
    group by tl.car_id
    having pg_catalog.count(*) > 1
  ) duplicate_cars;

  if v_overdue_12h > 5 then
    v_overdue_list := coalesce(v_overdue_list || E'\n', '') || 'และอีก ' || (v_overdue_12h - 5)::text || ' คัน';
  end if;

  v_issue_count := v_overdue_12h + v_data_anomaly_count + v_duplicate_active;
  v_color := case
    when v_overdue_12h > 0 or v_duplicate_active > 0 then 15158332
    when v_data_anomaly_count > 0 then 15844367
    else 3066993
  end;

  v_analysis := case
    when v_issue_count = 0 then
      '✅ ไม่พบความผิดปกติสำคัญในข้อมูลของวันนี้'
    else
      '⚠️ พบ ' || v_issue_count::text || ' ประเด็นที่ควรตรวจสอบ' || E'\n' ||
      '• รถยังไม่คืนเกิน 12 ชม. ' || v_overdue_12h::text || ' คัน' || E'\n' ||
      '• เลขไมล์คืนต่ำกว่าเลขไมล์ออก ' || v_bad_mileage::text || ' รายการ' || E'\n' ||
      '• ระยะทางมากกว่า 1,000 กม. ' || v_long_distance::text || ' รายการ' || E'\n' ||
      '• เวลาออก/คืนไม่สัมพันธ์กัน ' || v_bad_time::text || ' รายการ' || E'\n' ||
      '• ปิดงานแต่ไม่มีเวลาคืน ' || v_missing_return::text || ' รายการ' || E'\n' ||
      '• ข้อมูลแบตเตอรี่ EV ผิดปกติ ' || v_bad_ev_battery::text || ' รายการ' || E'\n' ||
      '• รถมีรายการค้างซ้ำซ้อน ' || v_duplicate_active::text || ' คัน'
  end;

  v_description :=
    'สรุปการใช้งานรถช่วง 00:00–23:59 น. วันที่ ' ||
    pg_catalog.to_char(v_report_date, 'DD/MM/YYYY') ||
    ' (เวลาไทย) พร้อมตรวจข้อมูลผิดปกติอัตโนมัติ';

  v_fields := pg_catalog.jsonb_build_array(
    private.discord_audit_field('🚗 รถออก', v_cars_out::text || ' คัน · ' || v_trip_count::text || ' เที่ยว', true),
    private.discord_audit_field('🏁 คืนรถ', v_cars_returned::text || ' คัน · ' || v_return_trip_count::text || ' เที่ยว', true),
    private.discord_audit_field('🕘 ยังไม่คืน ณ 23:59', v_outstanding::text || ' คัน', true),
    private.discord_audit_field('⏰ ยังไม่คืนเกิน 12 ชม.', v_overdue_12h::text || ' คัน', true),
    private.discord_audit_field('🛣️ ระยะทางรวมที่บันทึก', pg_catalog.to_char(v_distance_km, 'FM999,999,990.##') || ' กม.', true),
    private.discord_audit_field('🔎 ตรวจพบความผิดปกติ', v_issue_count::text || ' ประเด็น', true),
    private.discord_audit_field('รายงานการใช้งานสั้น ๆ', v_analysis, false)
  );

  if v_overdue_12h > 0 then
    v_fields := v_fields || pg_catalog.jsonb_build_array(
      private.discord_audit_field('รถที่ค้างเกิน 12 ชั่วโมง', coalesce(v_overdue_list, '-'), false)
    );
  end if;

  v_summary := pg_catalog.jsonb_build_object(
    'report_date', v_report_date,
    'timezone', 'Asia/Bangkok',
    'period_start', v_period_start,
    'period_end', v_period_end,
    'trip_count', v_trip_count,
    'cars_out', v_cars_out,
    'return_trip_count', v_return_trip_count,
    'cars_returned', v_cars_returned,
    'outstanding_at_day_end', v_outstanding,
    'outstanding_over_12_hours', v_overdue_12h,
    'distance_km', v_distance_km,
    'data_anomaly_count', v_data_anomaly_count,
    'issue_count', v_issue_count,
    'anomaly_breakdown', pg_catalog.jsonb_build_object(
      'end_mileage_below_start', v_bad_mileage,
      'distance_over_1000_km', v_long_distance,
      'return_before_departure', v_bad_time,
      'completed_without_return_time', v_missing_return,
      'invalid_ev_battery', v_bad_ev_battery,
      'duplicate_active_trips', v_duplicate_active
    )
  );

  v_event_id := private.queue_audit_event_to_channel(
    'vehicle',
    'vehicle.daily_summary',
    '📊 สรุปการใช้งานรถประจำวันที่ ' || pg_catalog.to_char(v_report_date, 'DD/MM/YYYY'),
    v_description,
    v_color,
    'daily_vehicle_usage_report',
    v_report_date::text,
    'ระบบสรุปรายวัน',
    v_fields,
    'daily_summary',
    v_summary
  );

  insert into private.daily_vehicle_usage_reports (
    report_date,
    period_start,
    period_end,
    event_id,
    summary
  ) values (
    v_report_date,
    v_period_start,
    v_period_end,
    v_event_id,
    v_summary
  );

  perform private.process_discord_audit_queue();

  return v_event_id;
end;
$function$
;
revoke all on function private.take_car_out_v4_impl(bigint,text,integer,text,integer,text,text,integer,integer[],text) from public;
grant execute on function private.take_car_out_v4_impl(bigint,text,integer,text,integer,text,text,integer,integer[],text) to anon,authenticated,service_role;
revoke all on function public.take_car_out_v4(bigint,text,integer,text,integer,text,text,integer,integer[],text) from public;
grant execute on function public.take_car_out_v4(bigint,text,integer,text,integer,text,text,integer,integer[],text) to anon,authenticated,service_role;
revoke all on function private.take_car_out_after_maintenance_v2_impl(uuid,bigint,integer,text,integer,text,text,integer,integer[],text) from public;
grant execute on function private.take_car_out_after_maintenance_v2_impl(uuid,bigint,integer,text,integer,text,text,integer,integer[],text) to anon,authenticated,service_role;
revoke all on function public.take_car_out_after_maintenance_v2(uuid,bigint,integer,text,integer,text,text,integer,integer[],text) from public;
grant execute on function public.take_car_out_after_maintenance_v2(uuid,bigint,integer,text,integer,text,text,integer,integer[],text) to anon,authenticated,service_role;
revoke all on function private.return_car_activity_impl(bigint,integer,numeric,numeric,integer,bigint) from public;
grant execute on function private.return_car_activity_impl(bigint,integer,numeric,numeric,integer,bigint) to anon,authenticated,service_role;
revoke all on function public.return_car_v2(bigint,integer,numeric,numeric,integer,bigint) from public;
grant execute on function public.return_car_v2(bigint,integer,numeric,numeric,integer,bigint) to anon,authenticated,service_role;
notify pgrst, 'reload schema';

-- Reject a stale maintenance-return form before closing any newer activity.
create or replace function private.return_car_and_report_maintenance_v2_impl(p_car_id bigint,p_staff_code text,p_end_mileage integer,p_fuel_liters numeric,p_fuel_cost numeric,p_battery_after integer,p_issue_category_code text,p_description text,p_trip_log_id bigint)
returns jsonb language plpgsql security definer set search_path='pg_catalog' as $$
begin
  perform 1 from public.cars where id=p_car_id for update;
  if p_trip_log_id is null or not exists(select 1 from public.trip_logs where id=p_trip_log_id and car_id=p_car_id and is_completed=false) then
    return jsonb_build_object('error','รายการรถเปลี่ยนแล้ว กรุณาสแกน QR ใหม่');
  end if;
  return private.return_car_and_report_maintenance_impl(p_car_id,p_staff_code,p_end_mileage,p_fuel_liters,p_fuel_cost,p_battery_after,p_issue_category_code,p_description);
end;
$$;
create or replace function public.return_car_and_report_maintenance_v2(p_car_id bigint,p_staff_code text,p_end_mileage integer,p_fuel_liters numeric,p_fuel_cost numeric,p_battery_after integer,p_issue_category_code text,p_description text,p_trip_log_id bigint)
returns jsonb language sql security invoker set search_path='pg_catalog'
as $$ select private.return_car_and_report_maintenance_v2_impl(p_car_id,p_staff_code,p_end_mileage,p_fuel_liters,p_fuel_cost,p_battery_after,p_issue_category_code,p_description,p_trip_log_id); $$;
revoke all on function private.return_car_and_report_maintenance_v2_impl(bigint,text,integer,numeric,numeric,integer,text,text,bigint) from public;
revoke all on function public.return_car_and_report_maintenance_v2(bigint,text,integer,numeric,numeric,integer,text,text,bigint) from public;
grant execute on function private.return_car_and_report_maintenance_v2_impl(bigint,text,integer,numeric,numeric,integer,text,text,bigint) to anon,authenticated,service_role;
grant execute on function public.return_car_and_report_maintenance_v2(bigint,text,integer,numeric,numeric,integer,text,text,bigint) to anon,authenticated,service_role;
