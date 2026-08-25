create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.discord_audit_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  webhook_secret_id uuid,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into private.discord_audit_settings (id)
values (true)
on conflict (id) do nothing;

revoke all on table private.discord_audit_settings from public, anon, authenticated;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  category text not null,
  event_type text not null,
  title text not null,
  description text,
  color integer not null default 7356546 check (color between 0 and 16777215),
  entity_type text,
  entity_id text,
  actor_user_id uuid,
  actor_label text,
  details jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'disabled'
    check (delivery_status in ('disabled', 'pending', 'sending', 'delivered', 'failed')),
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  request_id bigint,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error text
);

create index if not exists audit_events_occurred_at_idx
  on public.audit_events (occurred_at desc);
create index if not exists audit_events_delivery_queue_idx
  on public.audit_events (delivery_status, next_attempt_at, occurred_at);
create index if not exists audit_events_entity_idx
  on public.audit_events (entity_type, entity_id, occurred_at desc);

alter table public.audit_events enable row level security;

drop policy if exists "admin_read_audit_events" on public.audit_events;
create policy "admin_read_audit_events"
on public.audit_events
for select
to authenticated
using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

revoke all on table public.audit_events from public, anon, authenticated;
grant select on table public.audit_events to authenticated;

create or replace function private.discord_audit_field(
  p_name text,
  p_value text,
  p_inline boolean default true
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $$
  select pg_catalog.jsonb_build_object(
    'name', pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_name), ''), '-'), 256),
    'value', pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_value), ''), '-'), 1024),
    'inline', coalesce(p_inline, true)
  );
$$;

revoke all on function private.discord_audit_field(text, text, boolean)
  from public, anon, authenticated;

create or replace function private.queue_audit_event(
  p_category text,
  p_event_type text,
  p_title text,
  p_description text,
  p_color integer,
  p_entity_type text,
  p_entity_id text,
  p_actor_label text,
  p_fields jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event_id uuid;
  v_delivery_status text;
begin
  select case when s.enabled and s.webhook_secret_id is not null then 'pending' else 'disabled' end
  into v_delivery_status
  from private.discord_audit_settings s
  where s.id = true;

  insert into public.audit_events (
    category,
    event_type,
    title,
    description,
    color,
    entity_type,
    entity_id,
    actor_user_id,
    actor_label,
    details,
    delivery_status
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
      'fields', case when pg_catalog.jsonb_typeof(p_fields) = 'array' then p_fields else '[]'::jsonb end
    ),
    coalesce(v_delivery_status, 'disabled')
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function private.queue_audit_event(text, text, text, text, integer, text, text, text, jsonb)
  from public, anon, authenticated;

create or replace function private.capture_business_audit_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_new jsonb := '{}'::jsonb;
  v_old jsonb := '{}'::jsonb;
  v_fields jsonb := '[]'::jsonb;
  v_actor text := coalesce((select auth.jwt()) ->> 'email', 'ผู้ใช้งานเว็บไซต์');
  v_title text;
  v_description text;
  v_category text := 'system';
  v_event_type text;
  v_entity_id text;
  v_color integer := 7356546;
  v_plate text;
  v_car_fuel text;
  v_staff_name text;
  v_category_name text;
  v_operation text := lower(TG_OP);
begin
  if TG_OP <> 'DELETE' then
    v_new := to_jsonb(NEW);
  end if;
  if TG_OP <> 'INSERT' then
    v_old := to_jsonb(OLD);
  end if;

  v_entity_id := coalesce(
    v_new ->> 'id', v_old ->> 'id',
    v_new ->> 'code', v_old ->> 'code',
    v_new ->> 'trip_log_id', v_old ->> 'trip_log_id'
  );

  if TG_TABLE_NAME = 'trip_logs' then
    select c.plate_number, c.fuel_type
    into v_plate, v_car_fuel
    from public.cars c
    where c.id = coalesce((v_new ->> 'car_id')::bigint, (v_old ->> 'car_id')::bigint);

    if TG_OP = 'INSERT' then
      v_category := 'vehicle';
      if nullif(v_new ->> 'station_type', '') is not null then
        v_event_type := 'ev.charge_started';
        v_title := '⚡ เริ่มชาร์จรถ EV';
        v_description := 'มีการบันทึกการเริ่มชาร์จรถไฟฟ้า';
        v_color := 3447003;
      else
        v_event_type := 'vehicle.taken_out';
        v_title := '🚗 นำรถออก';
        v_description := 'มีการนำรถออกไปปฏิบัติงาน';
        v_color := 5763719;
      end if;
      v_actor := coalesce(nullif(v_new ->> 'driver_name', ''), v_actor);
      v_fields := pg_catalog.jsonb_build_array(
        private.discord_audit_field('ทะเบียนรถ', v_plate, true),
        private.discord_audit_field('ผู้ขับ/ผู้ปฏิบัติ', v_new ->> 'driver_name', true),
        private.discord_audit_field('เลขไมล์ออก', v_new ->> 'start_mileage', true),
        private.discord_audit_field('แบตเตอรี่ก่อน', case when v_new ->> 'battery_before' is null then '-' else (v_new ->> 'battery_before') || '%' end, true),
        private.discord_audit_field('งาน / สถานที่', v_new ->> 'location', false)
      );
    elsif coalesce((v_old ->> 'is_completed')::boolean, false) = false
       and coalesce((v_new ->> 'is_completed')::boolean, false) = true then
      v_category := 'vehicle';
      if nullif(v_new ->> 'station_type', '') is not null then
        v_event_type := 'ev.charge_completed';
        v_title := '🔋 ชาร์จรถ EV เสร็จสิ้น';
        v_description := 'มีการบันทึกผลหลังชาร์จรถไฟฟ้า';
        v_color := 10181046;
      else
        v_event_type := 'vehicle.returned';
        v_title := '✅ คืนรถแล้ว';
        v_description := 'รถถูกคืนและปิดรายการใช้งานเรียบร้อย';
        v_color := 3066993;
      end if;
      v_actor := coalesce(nullif(v_new ->> 'driver_name', ''), v_actor);
      v_fields := pg_catalog.jsonb_build_array(
        private.discord_audit_field('ทะเบียนรถ', v_plate, true),
        private.discord_audit_field('ผู้ขับ/ผู้ปฏิบัติ', v_new ->> 'driver_name', true),
        private.discord_audit_field('เลขไมล์', coalesce(v_new ->> 'start_mileage', '-') || ' → ' || coalesce(v_new ->> 'end_mileage', '-'), true),
        private.discord_audit_field('แบตเตอรี่', coalesce(v_new ->> 'battery_before', '-') || '% → ' || coalesce(v_new ->> 'battery_after', '-') || '%', true),
        private.discord_audit_field('น้ำมัน / ค่าใช้จ่าย', coalesce(v_new ->> 'fuel_liters', '0') || ' ลิตร · ' || coalesce(v_new ->> 'fuel_cost', '0') || ' บาท', false)
      );
    else
      return NEW;
    end if;

  elsif TG_TABLE_NAME = 'cars' then
    v_category := 'admin';
    v_entity_id := coalesce(v_new ->> 'id', v_old ->> 'id');
    if TG_OP = 'INSERT' then
      v_event_type := 'admin.car_created'; v_title := '➕ เพิ่มรถใหม่'; v_color := 5763719;
      v_description := 'ผู้ดูแลระบบเพิ่มรถเข้าสู่ระบบ';
    elsif TG_OP = 'DELETE' then
      v_event_type := 'admin.car_deleted'; v_title := '🗑️ ลบข้อมูลรถ'; v_color := 15158332;
      v_description := 'ผู้ดูแลระบบลบรถออกจากระบบ';
    elsif v_old ->> 'status' is distinct from v_new ->> 'status' then
      v_category := 'vehicle'; v_event_type := 'vehicle.status_changed'; v_title := '🔄 เปลี่ยนสถานะรถ'; v_color := 15844367;
      v_description := 'สถานะรถถูกเปลี่ยนในระบบ';
    else
      v_event_type := 'admin.car_updated'; v_title := '✏️ แก้ไขข้อมูลรถ'; v_color := 10181046;
      v_description := 'ผู้ดูแลระบบแก้ไขรายละเอียดรถ';
    end if;
    v_fields := pg_catalog.jsonb_build_array(
      private.discord_audit_field('ทะเบียนรถ', coalesce(v_new ->> 'plate_number', v_old ->> 'plate_number'), true),
      private.discord_audit_field('รุ่น / ประเภท', coalesce(v_new ->> 'model', v_old ->> 'model', '-') || ' · ' || coalesce(v_new ->> 'car_type', v_old ->> 'car_type', '-'), true),
      private.discord_audit_field('สถานะ', coalesce(v_old ->> 'status', '-') || ' → ' || coalesce(v_new ->> 'status', '-'), true),
      private.discord_audit_field('แสดงหน้า Home', coalesce(v_new ->> 'is_visible', v_old ->> 'is_visible', '-'), true)
    );

  elsif TG_TABLE_NAME = 'car_maintenance_records' then
    v_category := 'maintenance';
    select c.plate_number into v_plate
    from public.cars c
    where c.id = coalesce((v_new ->> 'car_id')::bigint, (v_old ->> 'car_id')::bigint);
    select mic.name into v_category_name
    from public.maintenance_issue_categories mic
    where mic.code = coalesce(v_new ->> 'issue_category_code', v_old ->> 'issue_category_code');
    if TG_OP = 'INSERT' then
      v_event_type := 'maintenance.reported'; v_title := '🛠️ แจ้งรถชำรุด / ส่งซ่อม'; v_color := 15105570;
      v_description := 'มีการเปิดรายการแจ้งซ่อมใหม่';
      select s.full_name into v_staff_name from public.staff s where s.id = (v_new ->> 'reported_by_staff_id')::bigint;
      v_actor := coalesce(v_staff_name, v_actor);
    elsif v_old ->> 'status' = 'open' and v_new ->> 'status' = 'completed' then
      v_event_type := 'maintenance.completed'; v_title := '🔧 ซ่อมเสร็จและเปิดใช้งานรถ'; v_color := 3066993;
      v_description := 'รายการซ่อมถูกยืนยันว่าเสร็จแล้ว';
      select s.full_name into v_staff_name from public.staff s where s.id = (v_new ->> 'completed_by_staff_id')::bigint;
      v_actor := coalesce(v_staff_name, v_actor);
    elsif v_old ->> 'billing_status' is distinct from v_new ->> 'billing_status' then
      v_event_type := 'maintenance.billing_updated'; v_title := '🧾 บันทึกข้อมูลซ่อมและวางบิล'; v_color := 15844367;
      v_description := 'ผู้ดูแลระบบบันทึกรายการและค่าใช้จ่ายงานซ่อม';
    else
      return NEW;
    end if;
    v_fields := pg_catalog.jsonb_build_array(
      private.discord_audit_field('ทะเบียนรถ', v_plate, true),
      private.discord_audit_field('ประเภทอาการ', v_category_name, true),
      private.discord_audit_field('ผู้ดำเนินการ', v_actor, true),
      private.discord_audit_field('สถานะบิล', coalesce(v_new ->> 'billing_status', v_old ->> 'billing_status', '-'), true),
      private.discord_audit_field('รายละเอียด', coalesce(v_new ->> 'description', v_old ->> 'description'), false),
      private.discord_audit_field('ผลการซ่อม', coalesce(v_new ->> 'completion_note', '-'), false)
    );

  elsif TG_TABLE_NAME = 'mileage_corrections' then
    if TG_OP <> 'INSERT' or nullif(v_new ->> 'corrected_by', '') is null then return NEW; end if;
    v_category := 'admin'; v_event_type := 'admin.mileage_corrected'; v_title := '📏 แก้ไขเลขไมล์'; v_color := 15105570;
    v_description := 'ผู้ดูแลระบบแก้ไขเลขไมล์ที่บันทึกผิด';
    select c.plate_number, tl.driver_name into v_plate, v_staff_name
    from public.trip_logs tl join public.cars c on c.id = tl.car_id
    where tl.id = (v_new ->> 'trip_log_id')::bigint;
    v_fields := pg_catalog.jsonb_build_array(
      private.discord_audit_field('ทะเบียนรถ', v_plate, true),
      private.discord_audit_field('ผู้ขับ', v_staff_name, true),
      private.discord_audit_field('ช่องที่แก้', v_new ->> 'field_name', true),
      private.discord_audit_field('ค่าเดิม → ค่าใหม่', coalesce(v_new ->> 'old_value', '-') || ' → ' || coalesce(v_new ->> 'new_value', '-'), true),
      private.discord_audit_field('เหตุผล', v_new ->> 'reason', false)
    );

  elsif TG_TABLE_NAME = 'trip_anomaly_reviews' then
    if TG_OP <> 'INSERT' then return NEW; end if;
    v_category := 'admin'; v_event_type := 'admin.anomaly_reviewed'; v_title := '🔎 ยืนยันตรวจสอบข้อมูลผิดปกติ'; v_color := 15844367;
    v_description := 'ผู้ดูแลระบบตรวจสอบและยืนยันข้อมูลรายการเดินทางแล้ว';
    select c.plate_number, tl.driver_name into v_plate, v_staff_name
    from public.trip_logs tl join public.cars c on c.id = tl.car_id
    where tl.id = (v_new ->> 'trip_log_id')::bigint;
    v_fields := pg_catalog.jsonb_build_array(
      private.discord_audit_field('ทะเบียนรถ', v_plate, true),
      private.discord_audit_field('ผู้ขับ', v_staff_name, true),
      private.discord_audit_field('หมายเหตุ', v_new ->> 'note', false)
    );

  elsif TG_TABLE_NAME = 'report_signatures' then
    v_category := 'document'; v_color := 10181046;
    select c.plate_number into v_plate
    from public.cars c where c.id = coalesce((v_new ->> 'car_id')::bigint, (v_old ->> 'car_id')::bigint);
    if TG_OP = 'INSERT' then
      v_event_type := 'document.signature_created'; v_title := '✍️ ลงลายมือชื่อรายงานประจำเดือน';
    else
      v_event_type := 'document.signature_updated'; v_title := '✍️ อัปเดตลายมือชื่อรายงาน';
    end if;
    v_description := 'บันทึกลายมือชื่อในรายงาน โดยไม่ส่งภาพลายเซ็นไป Discord';
    v_fields := pg_catalog.jsonb_build_array(
      private.discord_audit_field('ทะเบียนรถ', v_plate, true),
      private.discord_audit_field('เดือนรายงาน', coalesce(v_new ->> 'report_month', v_old ->> 'report_month'), true),
      private.discord_audit_field('ผู้ขับ', coalesce(v_new ->> 'driver_name', v_old ->> 'driver_name', '-'), true),
      private.discord_audit_field('ผู้ควบคุม', coalesce(v_new ->> 'controller_name', v_old ->> 'controller_name', '-'), true)
    );

  elsif TG_TABLE_NAME in ('staff', 'departments', 'tasks', 'operation_areas', 'maintenance_issue_categories', 'maintenance_repair_items') then
    v_category := 'admin'; v_color := case when TG_OP = 'DELETE' then 15158332 else 10181046 end;
    v_event_type := 'admin.' || TG_TABLE_NAME || '.' || v_operation;
    v_title := case TG_OP when 'INSERT' then '➕ เพิ่มข้อมูลตั้งค่าระบบ' when 'UPDATE' then '✏️ แก้ไขข้อมูลตั้งค่าระบบ' else '🗑️ ลบข้อมูลตั้งค่าระบบ' end;
    v_description := 'ผู้ดูแลระบบเปลี่ยนแปลงข้อมูล ' || TG_TABLE_NAME;
    v_fields := pg_catalog.jsonb_build_array(
      private.discord_audit_field('ประเภทข้อมูล', TG_TABLE_NAME, true),
      private.discord_audit_field('รายการ', coalesce(v_new ->> 'full_name', v_old ->> 'full_name', v_new ->> 'name', v_old ->> 'name', v_new ->> 'code', v_old ->> 'code'), true),
      private.discord_audit_field('รหัส', coalesce(v_new ->> 'staff_code', v_old ->> 'staff_code', v_entity_id), true),
      private.discord_audit_field('การทำรายการ', v_operation, true)
    );
  else
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  perform private.queue_audit_event(
    v_category,
    v_event_type,
    v_title,
    v_description,
    v_color,
    TG_TABLE_NAME,
    v_entity_id,
    v_actor,
    v_fields
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

revoke all on function private.capture_business_audit_event() from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'trip_logs',
    'cars',
    'staff',
    'departments',
    'tasks',
    'operation_areas',
    'car_maintenance_records',
    'report_signatures',
    'trip_anomaly_reviews',
    'mileage_corrections',
    'maintenance_issue_categories',
    'maintenance_repair_items'
  ] loop
    execute pg_catalog.format('drop trigger if exists capture_discord_audit_event on public.%I', v_table);
    execute pg_catalog.format(
      'create trigger capture_discord_audit_event after insert or update or delete on public.%I for each row execute function private.capture_business_audit_event()',
      v_table
    );
  end loop;
end;
$$;

create or replace function private.build_discord_audit_payload(p_event public.audit_events)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_fields jsonb := coalesce(p_event.details -> 'fields', '[]'::jsonb);
  v_repair_summary text;
  v_amount text;
begin
  if p_event.entity_type = 'car_maintenance_records'
     and p_event.event_type in ('maintenance.completed', 'maintenance.billing_updated') then
    select pg_catalog.string_agg(
      case when cri.repair_item_code = 'other'
        then coalesce(nullif(cri.custom_text, ''), mri.name)
        else mri.name
      end,
      ', ' order by mri.display_order, mri.name
    )
    into v_repair_summary
    from public.car_maintenance_repair_items cri
    join public.maintenance_repair_items mri on mri.code = cri.repair_item_code
    where cri.maintenance_record_id = p_event.entity_id::uuid;

    select case when cmr.repair_amount is null then 'ยังไม่วางบิล' else pg_catalog.to_char(cmr.repair_amount, 'FM999,999,990.00') || ' บาท' end
    into v_amount
    from public.car_maintenance_records cmr
    where cmr.id = p_event.entity_id::uuid;

    v_fields := v_fields || pg_catalog.jsonb_build_array(
      private.discord_audit_field('รายการซ่อมจริง', coalesce(v_repair_summary, 'ยังไม่ระบุ'), false),
      private.discord_audit_field('ค่าใช้จ่าย', coalesce(v_amount, 'ยังไม่วางบิล'), true)
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'username', 'KPN Smart Car Logs',
    'avatar_url', 'https://pea-car-system.vercel.app/pwa-icon-192.png',
    'allowed_mentions', pg_catalog.jsonb_build_object('parse', pg_catalog.jsonb_build_array()),
    'embeds', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
        'title', pg_catalog.left(p_event.title, 256),
        'description', pg_catalog.left(p_event.description, 4096),
        'color', p_event.color,
        'fields', (
          select coalesce(pg_catalog.jsonb_agg(field_item), '[]'::jsonb)
          from (
            select value as field_item
            from pg_catalog.jsonb_array_elements(v_fields)
            limit 25
          ) fields
        ),
        'footer', pg_catalog.jsonb_build_object(
          'text', 'KPN Smart Car · ' || p_event.event_type || ' · ID ' || p_event.id::text
        ),
        'timestamp', pg_catalog.to_char(p_event.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ))
    )
  );
exception when others then
  return pg_catalog.jsonb_build_object(
    'username', 'KPN Smart Car Logs',
    'allowed_mentions', pg_catalog.jsonb_build_object('parse', pg_catalog.jsonb_build_array()),
    'embeds', pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'title', pg_catalog.left(p_event.title, 256),
        'description', pg_catalog.left(coalesce(p_event.description, 'บันทึกเหตุการณ์จากระบบ'), 4096),
        'color', p_event.color,
        'footer', pg_catalog.jsonb_build_object('text', 'KPN Smart Car · ' || p_event.event_type),
        'timestamp', pg_catalog.to_char(p_event.occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      )
    )
  );
end;
$$;

revoke all on function private.build_discord_audit_payload(public.audit_events)
  from public, anon, authenticated;

create or replace function private.process_discord_audit_queue()
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_webhook_url text;
  v_event public.audit_events%rowtype;
  v_request_id bigint;
begin
  update public.audit_events e
  set delivery_status = 'delivered',
      delivered_at = pg_catalog.now(),
      last_error = null
  from net._http_response r
  where e.delivery_status = 'sending'
    and e.request_id = r.id
    and r.status_code between 200 and 299;

  update public.audit_events e
  set delivery_status = case when e.attempt_count >= 5 then 'failed' else 'pending' end,
      next_attempt_at = pg_catalog.now() + pg_catalog.make_interval(mins => least(30, e.attempt_count * 2)),
      last_error = pg_catalog.left(coalesce(r.error_msg, 'Discord HTTP ' || coalesce(r.status_code::text, 'unknown')), 1000),
      request_id = null
  from net._http_response r
  where e.delivery_status = 'sending'
    and e.request_id = r.id
    and (r.error_msg is not null or r.status_code < 200 or r.status_code >= 300);

  update public.audit_events e
  set delivery_status = case when e.attempt_count >= 5 then 'failed' else 'pending' end,
      next_attempt_at = pg_catalog.now() + interval '5 minutes',
      last_error = 'ไม่พบผลตอบกลับภายใน 10 นาที',
      request_id = null
  where e.delivery_status = 'sending'
    and e.last_attempt_at < pg_catalog.now() - interval '10 minutes'
    and not exists (select 1 from net._http_response r where r.id = e.request_id);

  select ds.decrypted_secret
  into v_webhook_url
  from private.discord_audit_settings s
  join vault.decrypted_secrets ds on ds.id = s.webhook_secret_id
  where s.id = true and s.enabled = true;

  if v_webhook_url is null then
    return;
  end if;

  for v_event in
    select e.*
    from public.audit_events e
    where e.delivery_status = 'pending'
      and e.next_attempt_at <= pg_catalog.now()
      and e.attempt_count < 5
    order by e.occurred_at
    limit 4
    for update skip locked
  loop
    begin
      v_request_id := net.http_post(
        url := v_webhook_url || case when pg_catalog.strpos(v_webhook_url, '?') > 0 then '&wait=true' else '?wait=true' end,
        body := private.build_discord_audit_payload(v_event),
        headers := '{"Content-Type":"application/json"}'::jsonb,
        timeout_milliseconds := 5000
      );

      update public.audit_events
      set delivery_status = 'sending',
          request_id = v_request_id,
          attempt_count = attempt_count + 1,
          last_attempt_at = pg_catalog.now(),
          last_error = null
      where id = v_event.id;
    exception when others then
      update public.audit_events
      set delivery_status = case when attempt_count + 1 >= 5 then 'failed' else 'pending' end,
          attempt_count = attempt_count + 1,
          next_attempt_at = pg_catalog.now() + interval '5 minutes',
          last_attempt_at = pg_catalog.now(),
          last_error = pg_catalog.left(SQLERRM, 1000)
      where id = v_event.id;
    end;
  end loop;
end;
$$;

revoke all on function private.process_discord_audit_queue()
  from public, anon, authenticated;

create or replace function public.configure_discord_audit_webhook(
  p_webhook_url text,
  p_enabled boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_url text := pg_catalog.btrim(coalesce(p_webhook_url, ''));
  v_secret_id uuid;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  if v_url !~ '^https://(canary\.|ptb\.)?discord(app)?\.com/api(/v[0-9]+)?/webhooks/[0-9]+/[A-Za-z0-9._-]+$' then
    raise exception 'Discord Webhook URL ไม่ถูกต้อง' using errcode = '22023';
  end if;

  select webhook_secret_id into v_secret_id
  from private.discord_audit_settings where id = true for update;

  if v_secret_id is null then
    select vault.create_secret(
      v_url,
      'pea_car_discord_audit_webhook',
      'Discord webhook for KPN Smart Car audit events'
    ) into v_secret_id;
  else
    perform vault.update_secret(
      v_secret_id,
      v_url,
      'pea_car_discord_audit_webhook',
      'Discord webhook for KPN Smart Car audit events'
    );
  end if;

  update private.discord_audit_settings
  set webhook_secret_id = v_secret_id,
      enabled = coalesce(p_enabled, true),
      updated_by = (select auth.uid()),
      updated_at = pg_catalog.now()
  where id = true;

  perform private.queue_audit_event(
    'security', 'security.discord_configured', '🔐 ตั้งค่า Discord Log แล้ว',
    'ผู้ดูแลระบบบันทึก Discord Webhook สำเร็จ โดย URL ถูกเก็บแบบเข้ารหัสใน Supabase Vault',
    10181046, 'discord_audit_settings', 'true',
    coalesce((select auth.jwt()) ->> 'email', 'Admin'),
    pg_catalog.jsonb_build_array(private.discord_audit_field('สถานะ', case when p_enabled then 'เปิดใช้งาน' else 'ปิดใช้งาน' end, true))
  );

  return pg_catalog.jsonb_build_object('configured', true, 'enabled', coalesce(p_enabled, true));
end;
$$;

create or replace function public.set_discord_audit_enabled(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_configured boolean;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  select webhook_secret_id is not null into v_configured
  from private.discord_audit_settings where id = true for update;

  if coalesce(p_enabled, false) and not coalesce(v_configured, false) then
    raise exception 'กรุณาตั้งค่า Discord Webhook ก่อนเปิดใช้งาน' using errcode = '22023';
  end if;

  update private.discord_audit_settings
  set enabled = coalesce(p_enabled, false), updated_by = (select auth.uid()), updated_at = pg_catalog.now()
  where id = true;

  if not coalesce(p_enabled, false) then
    update public.audit_events set delivery_status = 'disabled'
    where delivery_status = 'pending';
  end if;

  return pg_catalog.jsonb_build_object('configured', coalesce(v_configured, false), 'enabled', coalesce(p_enabled, false));
end;
$$;

create or replace function public.get_discord_audit_status()
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
    'configured', s.webhook_secret_id is not null,
    'enabled', s.enabled,
    'updated_at', s.updated_at,
    'pending_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_status in ('pending', 'sending')),
    'failed_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_status = 'failed'),
    'delivered_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_status = 'delivered'),
    'last_event_at', (select pg_catalog.max(e.occurred_at) from public.audit_events e)
  ) into v_result
  from private.discord_audit_settings s
  where s.id = true;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;

create or replace function public.test_discord_audit_webhook()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event_id uuid;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  if not exists (
    select 1 from private.discord_audit_settings s
    where s.id = true and s.enabled and s.webhook_secret_id is not null
  ) then
    raise exception 'Discord Log ยังไม่ได้เปิดใช้งาน' using errcode = '22023';
  end if;

  v_event_id := private.queue_audit_event(
    'system', 'system.discord_test', '🟣 ทดสอบ Discord Log สำเร็จ',
    'KPN Smart Car เชื่อมต่อระบบ Audit Log กับ Discord แล้ว ข้อความจริงจะถูกจัดหมวดและแสดงเป็น Embed แบบนี้',
    7356546, 'discord_audit_settings', 'true',
    coalesce((select auth.jwt()) ->> 'email', 'Admin'),
    pg_catalog.jsonb_build_array(
      private.discord_audit_field('ระบบ', 'KPN Smart Car', true),
      private.discord_audit_field('สถานะ', 'พร้อมรับ Log', true),
      private.discord_audit_field('ความปลอดภัย', 'ไม่ส่งรหัสผ่าน, Token, Webhook URL, เบอร์โทร หรือภาพลายเซ็น', false)
    )
  );

  perform private.process_discord_audit_queue();
  return pg_catalog.jsonb_build_object('success', true, 'event_id', v_event_id);
end;
$$;

create or replace function public.retry_failed_discord_audits()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  update public.audit_events
  set delivery_status = 'pending', attempt_count = 0, next_attempt_at = pg_catalog.now(), request_id = null, last_error = null
  where delivery_status = 'failed';
  get diagnostics v_count = row_count;
  perform private.process_discord_audit_queue();
  return pg_catalog.jsonb_build_object('queued_count', v_count);
end;
$$;

create or replace function public.log_admin_session_event(p_event_type text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event_id uuid;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;
  if p_event_type not in ('login', 'logout') then
    raise exception 'ประเภทเหตุการณ์ไม่ถูกต้อง' using errcode = '22023';
  end if;

  v_event_id := private.queue_audit_event(
    'security', 'security.admin_' || p_event_type,
    case p_event_type when 'login' then '🔓 Admin เข้าสู่ระบบ' else '🔒 Admin ออกจากระบบ' end,
    case p_event_type when 'login' then 'ผู้ดูแลระบบเข้าสู่ Admin Portal สำเร็จ' else 'ผู้ดูแลระบบออกจาก Admin Portal' end,
    case p_event_type when 'login' then 3066993 else 9807270 end,
    'auth_session', (select auth.uid())::text,
    coalesce((select auth.jwt()) ->> 'email', 'Admin'),
    pg_catalog.jsonb_build_array(private.discord_audit_field('บัญชี', coalesce((select auth.jwt()) ->> 'email', 'Admin'), true))
  );
  return pg_catalog.jsonb_build_object('success', true, 'event_id', v_event_id);
end;
$$;

revoke all on function public.configure_discord_audit_webhook(text, boolean) from public, anon, authenticated;
revoke all on function public.set_discord_audit_enabled(boolean) from public, anon, authenticated;
revoke all on function public.get_discord_audit_status() from public, anon, authenticated;
revoke all on function public.test_discord_audit_webhook() from public, anon, authenticated;
revoke all on function public.retry_failed_discord_audits() from public, anon, authenticated;
revoke all on function public.log_admin_session_event(text) from public, anon, authenticated;

grant execute on function public.configure_discord_audit_webhook(text, boolean) to authenticated;
grant execute on function public.set_discord_audit_enabled(boolean) to authenticated;
grant execute on function public.get_discord_audit_status() to authenticated;
grant execute on function public.test_discord_audit_webhook() to authenticated;
grant execute on function public.retry_failed_discord_audits() to authenticated;
grant execute on function public.log_admin_session_event(text) to authenticated;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'pea-car-discord-audit-every-minute' limit 1;
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'pea-car-discord-audit-every-minute',
    '* * * * *',
    'select private.process_discord_audit_queue();'
  );
end;
$$;
