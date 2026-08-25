create table if not exists private.discord_audit_channels (
  channel_key text primary key,
  channel_name text not null,
  display_name text not null,
  description text not null,
  display_order smallint not null,
  enabled boolean not null default false,
  webhook_secret_id uuid,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint discord_audit_channels_key_format check (channel_key ~ '^[a-z0-9_]+$')
);

revoke all on table private.discord_audit_channels from public, anon, authenticated;

insert into private.discord_audit_channels (
  channel_key, channel_name, display_name, description, display_order
)
values
  ('all', 'log-all', 'รวมทุกเหตุการณ์', 'ช่องสำรอง หากหมวดนั้นยังไม่ได้ตั้งค่า Webhook', 1),
  ('car_out', 'log-car-out', 'นำรถออก', 'รถถูกนำออกไปใช้งาน', 10),
  ('car_return', 'log-car-return', 'คืนรถ', 'รถถูกคืนและปิดรายการใช้งาน', 20),
  ('ev', 'log-ev-charge', 'ชาร์จรถ EV', 'เริ่มชาร์จและชาร์จเสร็จ', 30),
  ('maintenance', 'log-maintenance', 'งานซ่อม', 'แจ้งชำรุด ซ่อมเสร็จ และวางบิล', 40),
  ('mileage', 'log-mileage-review', 'เลขไมล์และข้อมูลผิดปกติ', 'แก้เลขไมล์และยืนยันตรวจสอบข้อมูล', 50),
  ('admin', 'log-admin-actions', 'การทำรายการของ Admin', 'เพิ่ม แก้ไข ลบ และเปลี่ยนข้อมูลหลัก', 60),
  ('documents', 'log-documents', 'เอกสารและลายเซ็น', 'ลายเซ็นและรายงานประจำเดือน', 70),
  ('security', 'log-security', 'ความปลอดภัย', 'Admin เข้าออกระบบและการตั้งค่าความปลอดภัย', 80),
  ('database', 'log-database-changes', 'ฐานข้อมูลแบบละเอียด', 'ทุก INSERT UPDATE DELETE พร้อมข้อมูลก่อนและหลังที่ตัดข้อมูลลับแล้ว', 90),
  ('system', 'log-system', 'ระบบและการส่ง Log', 'ทดสอบระบบ คิวส่ง และเหตุการณ์ระบบ', 100)
on conflict (channel_key) do update
set channel_name = excluded.channel_name,
    display_name = excluded.display_name,
    description = excluded.description,
    display_order = excluded.display_order;

update private.discord_audit_channels c
set webhook_secret_id = s.webhook_secret_id,
    enabled = s.enabled,
    updated_by = s.updated_by,
    updated_at = s.updated_at
from private.discord_audit_settings s
where c.channel_key = 'all'
  and s.id = true
  and s.webhook_secret_id is not null
  and c.webhook_secret_id is null;

alter table public.audit_events
  add column if not exists intended_channel_key text not null default 'system',
  add column if not exists delivery_channel_key text;

create index if not exists audit_events_channel_status_idx
  on public.audit_events (intended_channel_key, delivery_status, occurred_at desc);

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
    when p_event_type like 'ev.%' then 'ev'
    when p_event_type like 'maintenance.%' then 'maintenance'
    when p_event_type in ('admin.mileage_corrected', 'admin.anomaly_reviewed') then 'mileage'
    when p_event_type like 'document.%' then 'documents'
    when p_event_type like 'security.%' then 'security'
    when p_event_type like 'database.%' then 'database'
    when p_event_type like 'admin.%' or p_event_type = 'vehicle.status_changed' then 'admin'
    when p_category = 'maintenance' then 'maintenance'
    when p_category = 'document' then 'documents'
    when p_category = 'security' then 'security'
    when p_category = 'admin' then 'admin'
    else 'system'
  end;
$$;

revoke all on function private.discord_audit_channel_for_event(text, text)
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

  select candidate.channel_key
  into v_delivery_channel
  from (
    select c.channel_key, 1 as priority
    from private.discord_audit_channels c
    where c.channel_key = v_intended_channel
      and c.enabled
      and c.webhook_secret_id is not null
    union all
    select c.channel_key, 2 as priority
    from private.discord_audit_channels c
    where c.channel_key = 'all'
      and v_intended_channel <> 'all'
      and c.enabled
      and c.webhook_secret_id is not null
  ) candidate
  order by candidate.priority
  limit 1;

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
    intended_channel_key,
    delivery_channel_key,
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
      'fields', case when pg_catalog.jsonb_typeof(p_fields) = 'array' then p_fields else '[]'::jsonb end,
      'audit', case when pg_catalog.jsonb_typeof(p_audit_details) = 'object' then p_audit_details else '{}'::jsonb end
    ),
    v_intended_channel,
    v_delivery_channel,
    case when v_delivery_channel is null then 'disabled' else 'pending' end
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function private.queue_audit_event_to_channel(text, text, text, text, integer, text, text, text, jsonb, text, jsonb)
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
language sql
security definer
set search_path = pg_catalog
as $$
  select private.queue_audit_event_to_channel(
    p_category,
    p_event_type,
    p_title,
    p_description,
    p_color,
    p_entity_type,
    p_entity_id,
    p_actor_label,
    p_fields,
    null,
    '{}'::jsonb
  );
$$;

revoke all on function private.queue_audit_event(text, text, text, text, integer, text, text, text, jsonb)
  from public, anon, authenticated;

update public.audit_events e
set intended_channel_key = private.discord_audit_channel_for_event(e.category, e.event_type),
    delivery_channel_key = case
      when e.delivery_status in ('pending', 'sending') then 'all'
      else e.delivery_channel_key
    end;

create or replace function private.sanitize_audit_row(
  p_table_schema text,
  p_table_name text,
  p_row jsonb
)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $$
begin
  if p_row is null or p_row = 'null'::jsonb then
    return '{}'::jsonb;
  end if;

  if p_table_schema = 'storage' and p_table_name = 'objects' then
    return pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id', p_row -> 'id',
      'bucket_id', p_row -> 'bucket_id',
      'name', p_row -> 'name',
      'created_at', p_row -> 'created_at',
      'updated_at', p_row -> 'updated_at',
      'mime_type', p_row #> '{metadata,mimetype}',
      'size', p_row #> '{metadata,size}'
    ));
  end if;

  return p_row
    - 'driver_sig'
    - 'controller_sig'
    - 'phone'
    - 'email'
    - 'token'
    - 'webhook_secret_id'
    - 'signature'
    - 'access_token'
    - 'refresh_token';
end;
$$;

revoke all on function private.sanitize_audit_row(text, text, jsonb)
  from public, anon, authenticated;

create or replace function private.capture_exhaustive_database_audit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old jsonb := '{}'::jsonb;
  v_new jsonb := '{}'::jsonb;
  v_changed_keys jsonb := '[]'::jsonb;
  v_entity_id text;
  v_actor text := coalesce((select auth.jwt()) ->> 'email', 'ผู้ใช้งานเว็บไซต์');
  v_operation text := lower(TG_OP);
  v_title text;
  v_color integer;
  v_fields jsonb;
begin
  if TG_OP <> 'DELETE' then
    v_new := private.sanitize_audit_row(TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(NEW));
  end if;
  if TG_OP <> 'INSERT' then
    v_old := private.sanitize_audit_row(TG_TABLE_SCHEMA, TG_TABLE_NAME, to_jsonb(OLD));
  end if;

  if TG_TABLE_SCHEMA = 'storage'
     and coalesce(v_new ->> 'bucket_id', v_old ->> 'bucket_id') <> 'car-images' then
    return case when TG_OP = 'DELETE' then OLD else NEW end;
  end if;

  if TG_OP = 'UPDATE' and v_old = v_new then
    return NEW;
  end if;

  select coalesce(pg_catalog.jsonb_agg(changed.key order by changed.key), '[]'::jsonb)
  into v_changed_keys
  from (
    select keys.key
    from pg_catalog.jsonb_object_keys(v_old || v_new) keys(key)
    where v_old -> keys.key is distinct from v_new -> keys.key
  ) changed;

  v_entity_id := coalesce(
    v_new ->> 'id', v_old ->> 'id',
    v_new ->> 'maintenance_record_id', v_old ->> 'maintenance_record_id',
    v_new ->> 'trip_log_id', v_old ->> 'trip_log_id',
    v_new ->> 'code', v_old ->> 'code',
    v_new ->> 'name', v_old ->> 'name'
  );

  v_title := case TG_OP
    when 'INSERT' then '🟢 Database INSERT'
    when 'UPDATE' then '🟡 Database UPDATE'
    else '🔴 Database DELETE'
  end;
  v_color := case TG_OP when 'INSERT' then 3066993 when 'UPDATE' then 15844367 else 15158332 end;

  v_fields := pg_catalog.jsonb_build_array(
    private.discord_audit_field('ตาราง', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, true),
    private.discord_audit_field('การทำรายการ', v_operation, true),
    private.discord_audit_field('Record ID', coalesce(v_entity_id, '-'), true),
    private.discord_audit_field('ช่องที่เปลี่ยน', coalesce(v_changed_keys::text, '[]'), false),
    private.discord_audit_field('ข้อมูลก่อนหน้า (ตัดข้อมูลลับแล้ว)', case when TG_OP = 'INSERT' then '-' else pg_catalog.jsonb_pretty(v_old) end, false),
    private.discord_audit_field('ข้อมูลใหม่ (ตัดข้อมูลลับแล้ว)', case when TG_OP = 'DELETE' then '-' else pg_catalog.jsonb_pretty(v_new) end, false)
  );

  perform private.queue_audit_event_to_channel(
    'database',
    'database.row_' || v_operation,
    v_title || ' · ' || TG_TABLE_NAME,
    'บันทึกการเปลี่ยนแปลงฐานข้อมูลแบบละเอียดเพื่อใช้ตรวจสอบย้อนหลัง',
    v_color,
    TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
    v_entity_id,
    v_actor,
    v_fields,
    'database',
    pg_catalog.jsonb_build_object(
      'schema', TG_TABLE_SCHEMA,
      'table', TG_TABLE_NAME,
      'operation', v_operation,
      'changed_keys', v_changed_keys,
      'old', v_old,
      'new', v_new
    )
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

revoke all on function private.capture_exhaustive_database_audit()
  from public, anon, authenticated;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'cars',
    'staff',
    'trip_logs',
    'report_signatures',
    'departments',
    'tasks',
    'operation_areas',
    'trip_log_operation_areas',
    'mileage_corrections',
    'trip_anomaly_reviews',
    'maintenance_issue_categories',
    'car_maintenance_records',
    'maintenance_repair_items',
    'car_maintenance_repair_items'
  ] loop
    execute pg_catalog.format('drop trigger if exists capture_exhaustive_database_audit on public.%I', v_table);
    execute pg_catalog.format(
      'create trigger capture_exhaustive_database_audit after insert or update or delete on public.%I for each row execute function private.capture_exhaustive_database_audit()',
      v_table
    );
  end loop;

  if pg_catalog.to_regclass('private.maintenance_takeout_handoffs') is not null then
    execute 'drop trigger if exists capture_exhaustive_database_audit on private.maintenance_takeout_handoffs';
    execute 'create trigger capture_exhaustive_database_audit after insert or update or delete on private.maintenance_takeout_handoffs for each row execute function private.capture_exhaustive_database_audit()';
  end if;

  if pg_catalog.to_regclass('storage.objects') is not null then
    execute 'drop trigger if exists capture_car_image_storage_audit on storage.objects';
    execute 'create trigger capture_car_image_storage_audit after insert or update or delete on storage.objects for each row execute function private.capture_exhaustive_database_audit()';
  end if;
end;
$$;

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

  for v_event in
    with ranked as (
      select
        e.id,
        pg_catalog.row_number() over (
          partition by e.delivery_channel_key
          order by e.occurred_at
        ) as channel_rank
      from public.audit_events e
      where e.delivery_status = 'pending'
        and e.delivery_channel_key is not null
        and e.next_attempt_at <= pg_catalog.now()
        and e.attempt_count < 5
    )
    select e.*
    from public.audit_events e
    join ranked r on r.id = e.id
    where r.channel_rank <= 4
    order by e.occurred_at
    limit 24
    for update of e skip locked
  loop
    select ds.decrypted_secret
    into v_webhook_url
    from private.discord_audit_channels c
    join vault.decrypted_secrets ds on ds.id = c.webhook_secret_id
    where c.channel_key = v_event.delivery_channel_key
      and c.enabled;

    if v_webhook_url is null then
      update public.audit_events
      set delivery_status = 'disabled',
          last_error = 'ช่อง Discord ถูกปิดหรือไม่มี Webhook',
          request_id = null
      where id = v_event.id;
      continue;
    end if;

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

create or replace function public.configure_discord_audit_channel(
  p_channel_key text,
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
  v_channel_name text;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  select c.webhook_secret_id, c.channel_name
  into v_secret_id, v_channel_name
  from private.discord_audit_channels c
  where c.channel_key = p_channel_key
  for update;

  if not found then
    raise exception 'ไม่พบประเภท Discord Log Channel' using errcode = '22023';
  end if;

  if v_url !~ '^https://(canary\.|ptb\.)?discord(app)?\.com/api(/v[0-9]+)?/webhooks/[0-9]+/[A-Za-z0-9._-]+$' then
    raise exception 'Discord Webhook URL ไม่ถูกต้อง' using errcode = '22023';
  end if;

  if v_secret_id is null then
    select vault.create_secret(
      v_url,
      'pea_car_discord_audit_' || p_channel_key,
      'Discord webhook for KPN Smart Car channel ' || v_channel_name
    ) into v_secret_id;
  else
    perform vault.update_secret(
      v_secret_id,
      v_url,
      'pea_car_discord_audit_' || p_channel_key,
      'Discord webhook for KPN Smart Car channel ' || v_channel_name
    );
  end if;

  update private.discord_audit_channels
  set webhook_secret_id = v_secret_id,
      enabled = coalesce(p_enabled, true),
      updated_by = (select auth.uid()),
      updated_at = pg_catalog.now()
  where channel_key = p_channel_key;

  perform private.queue_audit_event_to_channel(
    'security',
    'security.discord_channel_configured',
    '🔐 ตั้งค่า Discord Channel แล้ว',
    'ผู้ดูแลระบบบันทึก Webhook สำหรับ #' || v_channel_name || ' สำเร็จ',
    10181046,
    'discord_audit_channels',
    p_channel_key,
    coalesce((select auth.jwt()) ->> 'email', 'Admin'),
    pg_catalog.jsonb_build_array(
      private.discord_audit_field('Channel', '#' || v_channel_name, true),
      private.discord_audit_field('สถานะ', case when coalesce(p_enabled, true) then 'เปิดใช้งาน' else 'ปิดใช้งาน' end, true)
    ),
    'security',
    pg_catalog.jsonb_build_object('configured_channel', p_channel_key)
  );

  return pg_catalog.jsonb_build_object(
    'channel_key', p_channel_key,
    'channel_name', v_channel_name,
    'configured', true,
    'enabled', coalesce(p_enabled, true)
  );
end;
$$;

create or replace function public.set_discord_audit_channel_enabled(
  p_channel_key text,
  p_enabled boolean
)
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

  select c.webhook_secret_id is not null
  into v_configured
  from private.discord_audit_channels c
  where c.channel_key = p_channel_key
  for update;

  if not found then
    raise exception 'ไม่พบประเภท Discord Log Channel' using errcode = '22023';
  end if;
  if coalesce(p_enabled, false) and not coalesce(v_configured, false) then
    raise exception 'กรุณาตั้งค่า Webhook ของ Channel นี้ก่อนเปิดใช้งาน' using errcode = '22023';
  end if;

  update private.discord_audit_channels
  set enabled = coalesce(p_enabled, false),
      updated_by = (select auth.uid()),
      updated_at = pg_catalog.now()
  where channel_key = p_channel_key;

  if not coalesce(p_enabled, false) then
    update public.audit_events
    set delivery_status = 'disabled',
        last_error = 'Channel ถูกปิดโดย Admin'
    where delivery_channel_key = p_channel_key
      and delivery_status = 'pending';
  end if;

  return pg_catalog.jsonb_build_object(
    'channel_key', p_channel_key,
    'configured', coalesce(v_configured, false),
    'enabled', coalesce(p_enabled, false)
  );
end;
$$;

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
        'configured', c.webhook_secret_id is not null,
        'enabled', c.enabled,
        'updated_at', c.updated_at,
        'pending_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_channel_key = c.channel_key and e.delivery_status in ('pending', 'sending')),
        'failed_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_channel_key = c.channel_key and e.delivery_status = 'failed'),
        'delivered_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_channel_key = c.channel_key and e.delivery_status = 'delivered')
      ) order by c.display_order
    ), '[]'::jsonb),
    'totals', pg_catalog.jsonb_build_object(
      'pending_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_status in ('pending', 'sending')),
      'failed_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_status = 'failed'),
      'delivered_count', (select pg_catalog.count(*) from public.audit_events e where e.delivery_status = 'delivered'),
      'stored_count', (select pg_catalog.count(*) from public.audit_events e),
      'last_event_at', (select pg_catalog.max(e.occurred_at) from public.audit_events e)
    )
  ) into v_result
  from private.discord_audit_channels c;

  return coalesce(v_result, pg_catalog.jsonb_build_object('channels', '[]'::jsonb, 'totals', '{}'::jsonb));
end;
$$;

create or replace function public.test_discord_audit_channel(p_channel_key text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_event_id uuid;
  v_channel_name text;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  select c.channel_name into v_channel_name
  from private.discord_audit_channels c
  where c.channel_key = p_channel_key
    and c.enabled
    and c.webhook_secret_id is not null;

  if v_channel_name is null then
    raise exception 'Channel นี้ยังไม่ได้ตั้งค่าหรือยังไม่เปิดใช้งาน' using errcode = '22023';
  end if;

  v_event_id := private.queue_audit_event_to_channel(
    'system',
    'system.discord_channel_test',
    '🟣 ทดสอบ #' || v_channel_name || ' สำเร็จ',
    'KPN Smart Car เชื่อมต่อ Log Channel นี้แล้ว',
    7356546,
    'discord_audit_channels',
    p_channel_key,
    coalesce((select auth.jwt()) ->> 'email', 'Admin'),
    pg_catalog.jsonb_build_array(
      private.discord_audit_field('Channel', '#' || v_channel_name, true),
      private.discord_audit_field('สถานะ', 'พร้อมรับ Log', true),
      private.discord_audit_field('ความปลอดภัย', 'Webhook ถูกเข้ารหัสและไม่มีข้อมูลลับในข้อความ', false)
    ),
    p_channel_key,
    pg_catalog.jsonb_build_object('test', true)
  );

  perform private.process_discord_audit_queue();
  return pg_catalog.jsonb_build_object('success', true, 'event_id', v_event_id, 'channel_name', v_channel_name);
end;
$$;

create or replace function public.retry_failed_discord_audits_for_channel(p_channel_key text default null)
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
  set delivery_status = 'pending',
      attempt_count = 0,
      next_attempt_at = pg_catalog.now(),
      request_id = null,
      last_error = null
  where delivery_status = 'failed'
    and (p_channel_key is null or delivery_channel_key = p_channel_key);
  get diagnostics v_count = row_count;

  perform private.process_discord_audit_queue();
  return pg_catalog.jsonb_build_object('queued_count', v_count);
end;
$$;

revoke all on function public.configure_discord_audit_channel(text, text, boolean) from public, anon, authenticated;
revoke all on function public.set_discord_audit_channel_enabled(text, boolean) from public, anon, authenticated;
revoke all on function public.get_discord_audit_channels_status() from public, anon, authenticated;
revoke all on function public.test_discord_audit_channel(text) from public, anon, authenticated;
revoke all on function public.retry_failed_discord_audits_for_channel(text) from public, anon, authenticated;

grant execute on function public.configure_discord_audit_channel(text, text, boolean) to authenticated;
grant execute on function public.set_discord_audit_channel_enabled(text, boolean) to authenticated;
grant execute on function public.get_discord_audit_channels_status() to authenticated;
grant execute on function public.test_discord_audit_channel(text) to authenticated;
grant execute on function public.retry_failed_discord_audits_for_channel(text) to authenticated;

create or replace function public.configure_discord_audit_webhook(
  p_webhook_url text,
  p_enabled boolean default true
)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select public.configure_discord_audit_channel('all', p_webhook_url, p_enabled);
$$;

create or replace function public.set_discord_audit_enabled(p_enabled boolean)
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select public.set_discord_audit_channel_enabled('all', p_enabled);
$$;

create or replace function public.test_discord_audit_webhook()
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select public.test_discord_audit_channel('all');
$$;

create or replace function public.retry_failed_discord_audits()
returns jsonb
language sql
security invoker
set search_path = pg_catalog
as $$
  select public.retry_failed_discord_audits_for_channel(null);
$$;
