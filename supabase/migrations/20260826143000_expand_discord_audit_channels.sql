alter table private.discord_audit_channels
  add column if not exists group_key text not null default 'system',
  add column if not exists group_label text not null default 'ระบบ';

insert into private.discord_audit_channels (
  channel_key, channel_name, display_name, description, display_order, group_key, group_label
)
values
  ('all', 'log-all', 'รวมทุกเหตุการณ์', 'ช่องสำรองสุดท้ายสำหรับทุกเหตุการณ์', 1, 'overview', 'ภาพรวม'),

  ('car_out', 'log-car-out', 'นำรถออก', 'รถถูกนำออกไปใช้งาน', 10, 'trip', 'การใช้งานรถ'),
  ('car_return', 'log-car-return', 'คืนรถ', 'รถถูกคืนและปิดรายการใช้งาน', 20, 'trip', 'การใช้งานรถ'),
  ('trip_data', 'log-trip-data', 'ข้อมูลรายการเดินรถ', 'การเปลี่ยนแปลงข้อมูลรายการเดินรถแบบละเอียด', 30, 'trip', 'การใช้งานรถ'),
  ('fuel', 'log-fuel', 'น้ำมันและค่าใช้จ่าย', 'การเติมน้ำมัน ปริมาณ และค่าใช้จ่าย', 40, 'trip', 'การใช้งานรถ'),

  ('ev', 'log-ev-charge', 'รวมการชาร์จ EV', 'ช่องรวมสำรองของเหตุการณ์รถ EV', 50, 'ev', 'รถ EV'),
  ('ev_start', 'log-ev-start', 'เริ่มชาร์จ EV', 'เริ่มชาร์จ สถานี และแบตเตอรี่ก่อนชาร์จ', 60, 'ev', 'รถ EV'),
  ('ev_complete', 'log-ev-complete', 'ชาร์จ EV เสร็จ', 'ผลหลังชาร์จและแบตเตอรี่หลังชาร์จ', 70, 'ev', 'รถ EV'),

  ('mileage', 'log-mileage-review', 'รวมเลขไมล์และตรวจสอบ', 'ช่องรวมสำรองของเลขไมล์และข้อมูลผิดปกติ', 80, 'review', 'ตรวจสอบข้อมูล'),
  ('mileage_corrections', 'log-mileage-corrections', 'แก้ไขเลขไมล์', 'ค่าเดิม ค่าใหม่ เหตุผล และผู้แก้ไข', 90, 'review', 'ตรวจสอบข้อมูล'),
  ('anomaly_reviews', 'log-anomaly-reviews', 'ตรวจรายการผิดปกติ', 'การยืนยันหรือยกเลิกความผิดปกติ', 100, 'review', 'ตรวจสอบข้อมูล'),

  ('maintenance', 'log-maintenance', 'รวมงานซ่อม', 'ช่องรวมสำรองของกระบวนการซ่อมทั้งหมด', 110, 'maintenance', 'งานซ่อมและบำรุงรักษา'),
  ('maintenance_report', 'log-maintenance-report', 'แจ้งชำรุดและส่งซ่อม', 'เปิดรายการรถชำรุดหรือส่งซ่อม', 120, 'maintenance', 'งานซ่อมและบำรุงรักษา'),
  ('maintenance_complete', 'log-maintenance-complete', 'ซ่อมเสร็จและเปิดใช้รถ', 'ยืนยันผลซ่อมและเปิดใช้งานรถอีกครั้ง', 130, 'maintenance', 'งานซ่อมและบำรุงรักษา'),
  ('maintenance_billing', 'log-maintenance-billing', 'บิลและค่าใช้จ่ายซ่อม', 'สถานะวางบิล รายการซ่อม และจำนวนเงิน', 140, 'maintenance', 'งานซ่อมและบำรุงรักษา'),
  ('maintenance_records', 'log-maintenance-records', 'ข้อมูลใบงานซ่อม', 'ข้อมูลก่อนและหลังของใบงานซ่อม', 150, 'maintenance', 'งานซ่อมและบำรุงรักษา'),
  ('maintenance_items', 'log-maintenance-items', 'รายการอะไหล่และงานซ่อม', 'เพิ่ม แก้ไข หรือลบรายการซ่อมจริง', 160, 'maintenance', 'งานซ่อมและบำรุงรักษา'),
  ('maintenance_handoff', 'log-maintenance-handoff', 'ส่งต่อหลังซ่อม', 'ข้อมูลส่งต่อเพื่อเปิดใช้งานและนำรถออก', 170, 'maintenance', 'งานซ่อมและบำรุงรักษา'),
  ('maintenance_catalog', 'log-maintenance-catalog', 'หมวดอาการและรายการซ่อม', 'แก้ไขตัวเลือกหมวดอาการและรายการซ่อมมาตรฐาน', 180, 'maintenance', 'งานซ่อมและบำรุงรักษา'),

  ('car_status', 'log-car-status', 'สถานะรถ', 'พร้อมใช้งาน กำลังใช้งาน หรือกำลังซ่อม', 190, 'master', 'ข้อมูลหลัก'),
  ('car_master', 'log-car-master', 'ข้อมูลรถ', 'เพิ่ม แก้ไข หรือลบข้อมูลรถ', 200, 'master', 'ข้อมูลหลัก'),
  ('car_images', 'log-car-images', 'รูปรถ', 'อัปโหลด เปลี่ยน หรือลบรูปประจำรถ', 210, 'master', 'ข้อมูลหลัก'),
  ('staff', 'log-staff', 'ข้อมูลพนักงาน', 'เพิ่ม แก้ไข หรือลบข้อมูลพนักงาน', 220, 'master', 'ข้อมูลหลัก'),
  ('departments', 'log-departments', 'แผนกและสังกัด', 'แก้ไขข้อมูลแผนกและสังกัด', 230, 'master', 'ข้อมูลหลัก'),
  ('tasks', 'log-tasks', 'งานและภารกิจ', 'แก้ไขรายการงานหรือภารกิจ', 240, 'master', 'ข้อมูลหลัก'),
  ('operation_areas', 'log-operation-areas', 'พื้นที่ปฏิบัติงาน', 'แก้ไขพื้นที่และพื้นที่ของรายการเดินรถ', 250, 'master', 'ข้อมูลหลัก'),

  ('documents', 'log-documents', 'รวมเอกสาร', 'ช่องรวมสำรองของเอกสารและรายงาน', 260, 'document', 'เอกสารและรายงาน'),
  ('signatures', 'log-signatures', 'ลายเซ็นรายงาน', 'สร้างหรือแก้ไขลายเซ็นโดยไม่ส่งภาพลายเซ็น', 270, 'document', 'เอกสารและรายงาน'),

  ('admin', 'log-admin-actions', 'การทำรายการของ Admin', 'การเปลี่ยนแปลงที่ไม่เข้าห้องเฉพาะ', 280, 'security', 'Admin และความปลอดภัย'),
  ('admin_sessions', 'log-admin-sessions', 'Admin เข้าและออกระบบ', 'การ Login และ Logout ของผู้ดูแลระบบ', 290, 'security', 'Admin และความปลอดภัย'),
  ('security', 'log-security', 'ความปลอดภัย', 'เหตุการณ์ด้านสิทธิ์และความปลอดภัย', 300, 'security', 'Admin และความปลอดภัย'),
  ('discord_admin', 'log-discord-admin', 'ตั้งค่าระบบ Discord', 'ตั้งค่า เปิด ปิด และทดสอบ Webhook', 310, 'security', 'Admin และความปลอดภัย'),

  ('database', 'log-database-changes', 'ฐานข้อมูลที่ไม่เข้าหมวด', 'การเปลี่ยนฐานข้อมูลที่ไม่มีห้องเฉพาะ', 320, 'system', 'ระบบและฐานข้อมูล'),
  ('system', 'log-system', 'ระบบและคิว Log', 'เหตุการณ์ระบบ การติดตั้ง และคิวส่ง', 330, 'system', 'ระบบและฐานข้อมูล')
on conflict (channel_key) do update
set channel_name = excluded.channel_name,
    display_name = excluded.display_name,
    description = excluded.description,
    display_order = excluded.display_order,
    group_key = excluded.group_key,
    group_label = excluded.group_label;

create or replace function private.discord_audit_channel_for_event(
  p_category text,
  p_event_type text
)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_event_type = 'vehicle.taken_out' then 'car_out'
    when p_event_type = 'vehicle.returned' then 'car_return'
    when p_event_type = 'vehicle.fuel_recorded' then 'fuel'
    when p_event_type = 'vehicle.status_changed' then 'car_status'
    when p_event_type = 'ev.charge_started' then 'ev_start'
    when p_event_type = 'ev.charge_completed' then 'ev_complete'
    when p_event_type = 'maintenance.reported' then 'maintenance_report'
    when p_event_type = 'maintenance.completed' then 'maintenance_complete'
    when p_event_type = 'maintenance.billing_updated' then 'maintenance_billing'
    when p_event_type = 'admin.mileage_corrected' then 'mileage_corrections'
    when p_event_type = 'admin.anomaly_reviewed' then 'anomaly_reviews'
    when p_event_type like 'document.signature_%' then 'signatures'
    when p_event_type in ('security.admin_login', 'security.admin_logout') then 'admin_sessions'
    when p_event_type like 'security.discord_%' then 'discord_admin'
    when p_event_type like 'admin.car_%' then 'car_master'
    when p_event_type like 'admin.staff.%' then 'staff'
    when p_event_type like 'admin.departments.%' then 'departments'
    when p_event_type like 'admin.tasks.%' then 'tasks'
    when p_event_type like 'admin.operation_areas.%' then 'operation_areas'
    when p_event_type like 'admin.maintenance_issue_categories.%'
      or p_event_type like 'admin.maintenance_repair_items.%' then 'maintenance_catalog'

    when p_event_type like 'database.public.trip_logs.%'
      or p_event_type like 'database.public.trip_log_operation_areas.%' then 'trip_data'
    when p_event_type like 'database.public.cars.%' then 'car_master'
    when p_event_type like 'database.storage.objects.%' then 'car_images'
    when p_event_type like 'database.public.staff.%' then 'staff'
    when p_event_type like 'database.public.departments.%' then 'departments'
    when p_event_type like 'database.public.tasks.%' then 'tasks'
    when p_event_type like 'database.public.operation_areas.%' then 'operation_areas'
    when p_event_type like 'database.public.mileage_corrections.%' then 'mileage_corrections'
    when p_event_type like 'database.public.trip_anomaly_reviews.%' then 'anomaly_reviews'
    when p_event_type like 'database.public.car_maintenance_records.%' then 'maintenance_records'
    when p_event_type like 'database.public.car_maintenance_repair_items.%' then 'maintenance_items'
    when p_event_type like 'database.public.maintenance_repair_items.%'
      or p_event_type like 'database.public.maintenance_issue_categories.%' then 'maintenance_catalog'
    when p_event_type like 'database.private.maintenance_takeout_handoffs.%' then 'maintenance_handoff'
    when p_event_type like 'database.public.report_signatures.%' then 'signatures'

    when p_event_type like 'ev.%' then 'ev'
    when p_event_type like 'maintenance.%' then 'maintenance'
    when p_event_type like 'document.%' then 'documents'
    when p_event_type like 'security.%' then 'security'
    when p_event_type like 'database.%' then 'database'
    when p_event_type like 'admin.%' then 'admin'
    when p_category = 'maintenance' then 'maintenance'
    when p_category = 'document' then 'documents'
    when p_category = 'security' then 'security'
    when p_category = 'admin' then 'admin'
    else 'system'
  end;
$$;

revoke all on function private.discord_audit_channel_for_event(text, text)
  from public, anon, authenticated;

create or replace function private.discord_audit_parent_channel(p_channel_key text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_channel_key in ('ev_start', 'ev_complete') then 'ev'
    when p_channel_key in ('mileage_corrections', 'anomaly_reviews') then 'mileage'
    when p_channel_key in (
      'maintenance_report', 'maintenance_complete', 'maintenance_billing',
      'maintenance_records', 'maintenance_items', 'maintenance_handoff', 'maintenance_catalog'
    ) then 'maintenance'
    when p_channel_key = 'signatures' then 'documents'
    when p_channel_key in ('admin_sessions', 'discord_admin') then 'security'
    when p_channel_key in (
      'car_status', 'car_master', 'car_images', 'staff', 'departments', 'tasks', 'operation_areas'
    ) then 'admin'
    else 'all'
  end;
$$;

revoke all on function private.discord_audit_parent_channel(text)
  from public, anon, authenticated;

create or replace function private.resolve_discord_audit_delivery_channel(p_channel_key text)
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select candidate.channel_key
  from (
    select c.channel_key, 1 as priority
    from private.discord_audit_channels c
    where c.channel_key = p_channel_key
      and c.enabled
      and c.webhook_secret_id is not null
    union all
    select c.channel_key, 2 as priority
    from private.discord_audit_channels c
    where c.channel_key = private.discord_audit_parent_channel(p_channel_key)
      and c.channel_key <> p_channel_key
      and c.enabled
      and c.webhook_secret_id is not null
    union all
    select c.channel_key, 3 as priority
    from private.discord_audit_channels c
    where c.channel_key = 'all'
      and p_channel_key <> 'all'
      and private.discord_audit_parent_channel(p_channel_key) <> 'all'
      and c.enabled
      and c.webhook_secret_id is not null
  ) candidate
  order by candidate.priority
  limit 1;
$$;

revoke all on function private.resolve_discord_audit_delivery_channel(text)
  from public, anon, authenticated;

create or replace function private.queue_audit_event_to_channel(
  p_category text,
  p_event_type text,
  p_title text,
  p_description text,
  p_color integer,
  p_entity_type text,
  p_entity_id text,
  p_actor_label text,
  p_fields jsonb default '[]'::jsonb,
  p_channel_key text default null,
  p_audit_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event_id uuid;
  v_intended_channel text := coalesce(
    nullif(p_channel_key, ''),
    private.discord_audit_channel_for_event(p_category, p_event_type)
  );
  v_delivery_channel text;
begin
  if not exists (
    select 1 from private.discord_audit_channels c
    where c.channel_key = v_intended_channel
  ) then
    v_intended_channel := 'system';
  end if;

  v_delivery_channel := private.resolve_discord_audit_delivery_channel(v_intended_channel);

  insert into public.audit_events (
    category, event_type, title, description, color, entity_type, entity_id,
    actor_user_id, actor_label, details, intended_channel_key,
    delivery_channel_key, delivery_status
  ) values (
    pg_catalog.left(coalesce(p_category, 'system'), 50),
    pg_catalog.left(coalesce(p_event_type, 'system.event'), 100),
    pg_catalog.left(coalesce(p_title, 'บันทึกเหตุการณ์'), 256),
    pg_catalog.left(p_description, 4000),
    coalesce(p_color, 7356546),
    pg_catalog.left(p_entity_type, 80),
    pg_catalog.left(p_entity_id, 200),
    (select auth.uid()),
    pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_actor_label), ''), 'ผู้ใช้งานเว็บไซต์'), 200),
    pg_catalog.jsonb_build_object(
      'fields', case when pg_catalog.jsonb_typeof(p_fields) = 'array' then p_fields else '[]'::jsonb end,
      'audit', case when pg_catalog.jsonb_typeof(p_audit_details) = 'object' then p_audit_details else '{}'::jsonb end
    ),
    v_intended_channel,
    v_delivery_channel,
    case when v_delivery_channel is null then 'disabled' else 'pending' end
  ) returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function private.queue_audit_event_to_channel(text, text, text, text, integer, text, text, text, jsonb, text, jsonb)
  from public, anon, authenticated;

create or replace function private.capture_fuel_audit_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_plate text;
begin
  if coalesce(OLD.is_completed, false) = false
     and coalesce(NEW.is_completed, false) = true
     and (coalesce(NEW.fuel_liters, 0) > 0 or coalesce(NEW.fuel_cost, 0) > 0) then
    select c.plate_number into v_plate
    from public.cars c
    where c.id = NEW.car_id;

    perform private.queue_audit_event_to_channel(
      'vehicle',
      'vehicle.fuel_recorded',
      '⛽ บันทึกการเติมน้ำมัน',
      'มีการบันทึกน้ำมันและค่าใช้จ่ายในตอนคืนรถ',
      15844367,
      'trip_logs',
      NEW.id::text,
      coalesce(nullif(NEW.driver_name, ''), 'ผู้ใช้งานเว็บไซต์'),
      pg_catalog.jsonb_build_array(
        private.discord_audit_field('ทะเบียนรถ', v_plate, true),
        private.discord_audit_field('ผู้ขับ', NEW.driver_name, true),
        private.discord_audit_field('ปริมาณน้ำมัน', coalesce(NEW.fuel_liters, 0)::text || ' ลิตร', true),
        private.discord_audit_field('ค่าใช้จ่าย', coalesce(NEW.fuel_cost, 0)::text || ' บาท', true)
      ),
      'fuel',
      pg_catalog.jsonb_build_object('trip_log_id', NEW.id)
    );
  end if;
  return NEW;
end;
$$;

revoke all on function private.capture_fuel_audit_event()
  from public, anon, authenticated;

drop trigger if exists capture_fuel_audit_event on public.trip_logs;
create trigger capture_fuel_audit_event
after update on public.trip_logs
for each row execute function private.capture_fuel_audit_event();

create or replace function public.get_discord_audit_channels_status()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
stable
as $$
declare
  v_result jsonb;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  select pg_catalog.jsonb_build_object(
    'channels', coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'channel_key', c.channel_key,
        'channel_name', c.channel_name,
        'display_name', c.display_name,
        'description', c.description,
        'display_order', c.display_order,
        'group_key', c.group_key,
        'group_label', c.group_label,
        'configured', c.webhook_secret_id is not null,
        'enabled', c.enabled,
        'updated_at', c.updated_at,
        'pending_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_channel_key = c.channel_key and e.delivery_status in ('pending', 'sending')),
        'failed_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_channel_key = c.channel_key and e.delivery_status = 'failed'),
        'delivered_count', 0
      ) order by c.display_order
    ), '[]'::jsonb),
    'totals', pg_catalog.jsonb_build_object(
      'pending_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_status in ('pending', 'sending')),
      'failed_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_status = 'failed'),
      'delivered_count', 0,
      'stored_count', (select pg_catalog.count(*) from public.audit_events e),
      'last_event_at', (select pg_catalog.max(e.occurred_at) from public.audit_events e)
    )
  ) into v_result
  from private.discord_audit_channels c;

  return coalesce(v_result, pg_catalog.jsonb_build_object('channels', '[]'::jsonb, 'totals', '{}'::jsonb));
end;
$$;

revoke all on function public.get_discord_audit_channels_status()
  from public, anon, authenticated;
grant execute on function public.get_discord_audit_channels_status()
  to authenticated;

update public.audit_events e
set intended_channel_key = private.discord_audit_channel_for_event(e.category, e.event_type)
where e.delivery_status <> 'sending';

update public.audit_events e
set delivery_channel_key = private.resolve_discord_audit_delivery_channel(e.intended_channel_key),
    delivery_status = case
      when private.resolve_discord_audit_delivery_channel(e.intended_channel_key) is null then 'disabled'
      else 'pending'
    end,
    next_attempt_at = pg_catalog.now(),
    last_error = case
      when private.resolve_discord_audit_delivery_channel(e.intended_channel_key) is null then 'ยังไม่ได้ตั้งค่า Webhook สำหรับ Channel นี้หรือ Channel สำรอง'
      else null
    end
where e.delivery_status in ('disabled', 'pending');
