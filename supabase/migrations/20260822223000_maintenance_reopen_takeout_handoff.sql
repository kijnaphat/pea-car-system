create table if not exists private.maintenance_takeout_handoffs (
  token uuid primary key default gen_random_uuid(),
  maintenance_record_id uuid not null unique references public.car_maintenance_records(id) on update cascade on delete cascade,
  car_id bigint not null references public.cars(id) on update cascade on delete cascade,
  staff_id bigint not null references public.staff(id) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  used_at timestamptz,
  constraint maintenance_takeout_handoffs_expiry_valid
    check (expires_at > created_at),
  constraint maintenance_takeout_handoffs_usage_valid
    check (used_at is null or used_at >= created_at)
);

create index if not exists maintenance_takeout_handoffs_car_id_idx
  on private.maintenance_takeout_handoffs (car_id);

create index if not exists maintenance_takeout_handoffs_staff_id_idx
  on private.maintenance_takeout_handoffs (staff_id);

alter table private.maintenance_takeout_handoffs enable row level security;
revoke all on table private.maintenance_takeout_handoffs from public, anon, authenticated;

create or replace function private.complete_car_maintenance_v3_impl(
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
  v_result jsonb;
  v_maintenance_id uuid;
  v_staff_id bigint;
  v_takeout_token uuid;
  v_expires_at timestamptz := pg_catalog.now() + interval '60 minutes';
begin
  v_result := private.complete_car_maintenance_v2_impl(
    p_car_id,
    p_staff_code,
    p_completion_note,
    p_billing_status,
    p_repair_item_codes,
    p_other_repair_text,
    p_repair_amount
  );

  if v_result ? 'error' then
    return v_result;
  end if;

  v_maintenance_id := (v_result ->> 'maintenance_id')::uuid;

  select cmr.completed_by_staff_id
  into v_staff_id
  from public.car_maintenance_records cmr
  where cmr.id = v_maintenance_id;

  if v_staff_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบข้อมูลพนักงานผู้เปิดใช้งานรถ');
  end if;

  update public.car_maintenance_records
  set y6_trip_log_id = null
  where id = v_maintenance_id;

  insert into private.maintenance_takeout_handoffs (
    maintenance_record_id,
    car_id,
    staff_id,
    expires_at
  ) values (
    v_maintenance_id,
    p_car_id,
    v_staff_id,
    v_expires_at
  )
  on conflict (maintenance_record_id) do update
  set token = gen_random_uuid(),
      car_id = excluded.car_id,
      staff_id = excluded.staff_id,
      created_at = pg_catalog.now(),
      expires_at = excluded.expires_at,
      used_at = null
  returning token into v_takeout_token;

  return (v_result - 'y6_trip_log_id') || pg_catalog.jsonb_build_object(
    'takeout_token', v_takeout_token,
    'takeout_token_expires_at', v_expires_at,
    'y6_link_status', 'awaiting_takeout'
  );
end;
$$;

create or replace function public.complete_car_maintenance_v3(
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
  select private.complete_car_maintenance_v3_impl(
    p_car_id,
    p_staff_code,
    p_completion_note,
    p_billing_status,
    p_repair_item_codes,
    p_other_repair_text,
    p_repair_amount
  );
$$;

create or replace function private.get_maintenance_takeout_handoff_impl(
  p_token uuid,
  p_car_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_result jsonb;
begin
  if p_token is null or p_car_id is null then
    return pg_catalog.jsonb_build_object('error', 'ไม่พบสิทธิ์ดำเนินการต่อจากงานซ่อม');
  end if;

  select pg_catalog.jsonb_build_object(
    'valid', true,
    'staff_id', s.id,
    'full_name', s.full_name,
    'position', s.position,
    'department_name', d.name,
    'expires_at', h.expires_at
  )
  into v_result
  from private.maintenance_takeout_handoffs h
  join public.staff s on s.id = h.staff_id
  left join public.departments d on d.id = s.department_id
  join public.car_maintenance_records cmr on cmr.id = h.maintenance_record_id
  where h.token = p_token
    and h.car_id = p_car_id
    and h.used_at is null
    and h.expires_at > pg_catalog.now()
    and cmr.status = 'completed'
  limit 1;

  if v_result is null then
    return pg_catalog.jsonb_build_object('error', 'สิทธิ์ดำเนินการต่อหมดอายุหรือถูกใช้งานแล้ว กรุณากรอกรหัสพนักงานตามปกติ');
  end if;

  return v_result;
end;
$$;

create or replace function public.get_maintenance_takeout_handoff(
  p_token uuid,
  p_car_id bigint
)
returns jsonb
language sql
set search_path = pg_catalog
as $$
  select private.get_maintenance_takeout_handoff_impl(p_token, p_car_id);
$$;

create or replace function private.take_car_out_after_maintenance_impl(
  p_token uuid,
  p_car_id bigint,
  p_start_mileage integer,
  p_location text,
  p_battery_before integer,
  p_station_type text,
  p_station_name text,
  p_task_id integer,
  p_operation_area_ids integer[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
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

  v_result := private.take_car_out_v3_impl(
    p_car_id,
    v_staff_code,
    p_start_mileage,
    p_location,
    p_battery_before,
    p_station_type,
    p_station_name,
    p_task_id,
    p_operation_area_ids
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
$$;

create or replace function public.take_car_out_after_maintenance(
  p_token uuid,
  p_car_id bigint,
  p_start_mileage integer,
  p_location text,
  p_battery_before integer,
  p_station_type text,
  p_station_name text,
  p_task_id integer,
  p_operation_area_ids integer[]
)
returns jsonb
language sql
set search_path = pg_catalog
as $$
  select private.take_car_out_after_maintenance_impl(
    p_token,
    p_car_id,
    p_start_mileage,
    p_location,
    p_battery_before,
    p_station_type,
    p_station_name,
    p_task_id,
    p_operation_area_ids
  );
$$;

-- If the continuation link expires or the page is refreshed, the first real
-- takeout after reopening still owns the repair entry in Y.P.6. This trigger
-- only sees maintenance records created by the handoff workflow above.
create or replace function private.attach_reopened_maintenance_to_new_trip()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.is_completed then
    return new;
  end if;

  update public.car_maintenance_records cmr
  set y6_trip_log_id = new.id
  from private.maintenance_takeout_handoffs h
  where h.maintenance_record_id = cmr.id
    and h.car_id = new.car_id
    and h.used_at is null
    and cmr.status = 'completed'
    and cmr.y6_trip_log_id is null;

  update private.maintenance_takeout_handoffs h
  set used_at = pg_catalog.now()
  from public.car_maintenance_records cmr
  where cmr.id = h.maintenance_record_id
    and h.car_id = new.car_id
    and h.used_at is null
    and cmr.y6_trip_log_id = new.id;

  return new;
end;
$$;

drop trigger if exists attach_reopened_maintenance_to_new_trip_trigger
  on public.trip_logs;
create trigger attach_reopened_maintenance_to_new_trip_trigger
after insert on public.trip_logs
for each row
execute function private.attach_reopened_maintenance_to_new_trip();

create or replace function private.admin_finalize_maintenance_billing_v2_impl(
  p_maintenance_id uuid,
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
  v_result jsonb;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  v_result := public.admin_finalize_maintenance_billing(
    p_maintenance_id,
    p_repair_item_codes,
    p_other_repair_text,
    p_repair_amount
  );

  if v_result ? 'success' and exists (
    select 1
    from private.maintenance_takeout_handoffs h
    where h.maintenance_record_id = p_maintenance_id
      and h.used_at is null
  ) then
    update public.car_maintenance_records
    set y6_trip_log_id = null
    where id = p_maintenance_id;

    v_result := (v_result - 'y6_trip_log_id') || pg_catalog.jsonb_build_object(
      'y6_link_status', 'awaiting_takeout'
    );
  end if;

  return v_result;
end;
$$;

create or replace function public.admin_finalize_maintenance_billing_v2(
  p_maintenance_id uuid,
  p_repair_item_codes text[],
  p_other_repair_text text,
  p_repair_amount numeric
)
returns jsonb
language sql
set search_path = pg_catalog
as $$
  select private.admin_finalize_maintenance_billing_v2_impl(
    p_maintenance_id,
    p_repair_item_codes,
    p_other_repair_text,
    p_repair_amount
  );
$$;

revoke all on function private.complete_car_maintenance_v3_impl(bigint, text, text, text, text[], text, numeric)
  from public, anon, authenticated;
grant execute on function private.complete_car_maintenance_v3_impl(bigint, text, text, text, text[], text, numeric)
  to anon, authenticated, service_role;

revoke all on function private.get_maintenance_takeout_handoff_impl(uuid, bigint)
  from public, anon, authenticated;
grant execute on function private.get_maintenance_takeout_handoff_impl(uuid, bigint)
  to anon, authenticated, service_role;

revoke all on function private.take_car_out_after_maintenance_impl(uuid, bigint, integer, text, integer, text, text, integer, integer[])
  from public, anon, authenticated;
grant execute on function private.take_car_out_after_maintenance_impl(uuid, bigint, integer, text, integer, text, text, integer, integer[])
  to anon, authenticated, service_role;

revoke all on function private.attach_reopened_maintenance_to_new_trip()
  from public, anon, authenticated;

revoke all on function private.admin_finalize_maintenance_billing_v2_impl(uuid, text[], text, numeric)
  from public, anon, authenticated;
grant execute on function private.admin_finalize_maintenance_billing_v2_impl(uuid, text[], text, numeric)
  to authenticated, service_role;

revoke all on function public.complete_car_maintenance_v3(bigint, text, text, text, text[], text, numeric)
  from public, anon, authenticated;
grant execute on function public.complete_car_maintenance_v3(bigint, text, text, text, text[], text, numeric)
  to anon, authenticated, service_role;

revoke all on function public.get_maintenance_takeout_handoff(uuid, bigint)
  from public, anon, authenticated;
grant execute on function public.get_maintenance_takeout_handoff(uuid, bigint)
  to anon, authenticated, service_role;

revoke all on function public.take_car_out_after_maintenance(uuid, bigint, integer, text, integer, text, text, integer, integer[])
  from public, anon, authenticated;
grant execute on function public.take_car_out_after_maintenance(uuid, bigint, integer, text, integer, text, text, integer, integer[])
  to anon, authenticated, service_role;

revoke all on function public.admin_finalize_maintenance_billing_v2(uuid, text[], text, numeric)
  from public, anon, authenticated;
grant execute on function public.admin_finalize_maintenance_billing_v2(uuid, text[], text, numeric)
  to authenticated, service_role;
