-- Daily vehicle-usage digest for the completed Bangkok calendar day.
-- The report is generated at 00:05 Asia/Bangkok and queued through the
-- existing reliable Discord audit pipeline.

insert into private.discord_audit_channels (
  channel_key,
  channel_name,
  display_name,
  description,
  display_order,
  group_key,
  group_label
)
values (
  'daily_summary',
  'log-daily-summary',
  'สรุปการใช้งานรถรายวัน',
  'สรุปรถออก คืนรถ รถค้างคืน รถเกิน 12 ชั่วโมง และความผิดปกติ',
  25,
  'trip',
  'การใช้งานรถ'
)
on conflict (channel_key) do update
set channel_name = excluded.channel_name,
    display_name = excluded.display_name,
    description = excluded.description,
    display_order = excluded.display_order,
    group_key = excluded.group_key,
    group_label = excluded.group_label;

create or replace function private.discord_audit_parent_channel(p_channel_key text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when p_channel_key = 'daily_summary' then 'trip_data'
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

create table if not exists private.daily_vehicle_usage_reports (
  report_date date primary key,
  period_start timestamptz not null,
  period_end timestamptz not null,
  generated_at timestamptz not null default now(),
  event_id uuid not null,
  summary jsonb not null default '{}'::jsonb,
  constraint daily_vehicle_usage_reports_period_valid check (period_end > period_start)
);

revoke all on table private.daily_vehicle_usage_reports
  from public, anon, authenticated;

create or replace function private.queue_daily_vehicle_usage_summary(
  p_report_date date default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
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
  where coalesce(tl.start_time, tl.created_at) >= v_period_start
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
  where tl.end_time >= v_period_start
    and tl.end_time < v_period_end;

  select pg_catalog.count(distinct tl.car_id)::integer,
         pg_catalog.count(distinct tl.car_id) filter (
           where coalesce(tl.start_time, tl.created_at) <= v_period_end - interval '12 hours'
         )::integer
  into v_outstanding, v_overdue_12h
  from public.trip_logs tl
  where coalesce(tl.start_time, tl.created_at) < v_period_end
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
      where upper(pg_catalog.btrim(coalesce(c.fuel_type, ''))) = 'EV'
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
          upper(pg_catalog.btrim(coalesce(c.fuel_type, ''))) = 'EV'
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
$$;

revoke all on function private.queue_daily_vehicle_usage_summary(date)
  from public, anon, authenticated;

comment on function private.queue_daily_vehicle_usage_summary(date) is
  'Queues one idempotent Discord digest for a completed Asia/Bangkok calendar day.';

do $$
declare
  v_job_id bigint;
begin
  select j.jobid
  into v_job_id
  from cron.job j
  where j.jobname = 'pea-car-daily-vehicle-summary-bangkok'
  limit 1;

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  -- pg_cron schedules in UTC. 17:05 UTC is 00:05 Asia/Bangkok (UTC+7).
  perform cron.schedule(
    'pea-car-daily-vehicle-summary-bangkok',
    '5 17 * * *',
    'select private.queue_daily_vehicle_usage_summary();'
  );
end;
$$;
