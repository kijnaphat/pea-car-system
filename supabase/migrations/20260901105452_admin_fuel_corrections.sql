create table if not exists public.fuel_corrections (
  id uuid primary key default gen_random_uuid(),
  trip_log_id bigint not null references public.trip_logs(id) on delete restrict,
  old_fuel_liters numeric,
  new_fuel_liters numeric not null,
  old_fuel_cost numeric,
  new_fuel_cost numeric not null,
  reason text not null,
  corrected_by uuid,
  corrected_at timestamptz not null default now(),
  constraint fuel_corrections_old_liters_nonnegative check (old_fuel_liters is null or old_fuel_liters >= 0),
  constraint fuel_corrections_new_liters_nonnegative check (new_fuel_liters >= 0),
  constraint fuel_corrections_old_cost_nonnegative check (old_fuel_cost is null or old_fuel_cost >= 0),
  constraint fuel_corrections_new_cost_nonnegative check (new_fuel_cost >= 0),
  constraint fuel_corrections_changed_value check (
    old_fuel_liters is distinct from new_fuel_liters
    or old_fuel_cost is distinct from new_fuel_cost
  ),
  constraint fuel_corrections_reason_present check (char_length(btrim(reason)) >= 3)
);

create index if not exists fuel_corrections_trip_log_idx
  on public.fuel_corrections (trip_log_id, corrected_at desc);

alter table public.fuel_corrections enable row level security;

drop policy if exists "admin_read_fuel_corrections" on public.fuel_corrections;
create policy "admin_read_fuel_corrections"
on public.fuel_corrections
for select
to authenticated
using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

drop policy if exists "admin_insert_fuel_corrections" on public.fuel_corrections;
create policy "admin_insert_fuel_corrections"
on public.fuel_corrections
for insert
to authenticated
with check (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin'
  and corrected_by = (select auth.uid())
);

revoke all on table public.fuel_corrections from public, anon, authenticated;
grant select, insert on table public.fuel_corrections to authenticated;

grant update (fuel_liters, fuel_cost) on public.trip_logs to authenticated;

create or replace function public.admin_correct_trip_fuel(
  p_trip_log_id bigint,
  p_fuel_liters numeric,
  p_fuel_cost numeric,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_trip public.trip_logs%rowtype;
  v_fuel_type text;
begin
  if (select auth.uid()) is null
     or coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') <> 'admin' then
    raise exception 'อนุญาตเฉพาะผู้ดูแลระบบเท่านั้น' using errcode = '42501';
  end if;

  if p_fuel_liters is null or p_fuel_liters < 0 then
    raise exception 'จำนวนลิตรต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' using errcode = '22023';
  end if;

  if p_fuel_cost is null or p_fuel_cost < 0 then
    raise exception 'ค่าใช้จ่ายต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป' using errcode = '22023';
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

  if not coalesce(v_trip.is_completed, false) then
    raise exception 'แก้ไขข้อมูลน้ำมันได้หลังคืนรถแล้วเท่านั้น' using errcode = '22023';
  end if;

  select c.fuel_type
  into v_fuel_type
  from public.cars c
  where c.id = v_trip.car_id;

  if upper(btrim(coalesce(v_fuel_type, ''))) = 'EV' then
    raise exception 'รถ EV ไม่มีข้อมูลเติมน้ำมันให้แก้ไข' using errcode = '22023';
  end if;

  if v_trip.fuel_liters is not distinct from p_fuel_liters
     and v_trip.fuel_cost is not distinct from p_fuel_cost then
    raise exception 'ข้อมูลใหม่ยังเท่ากับข้อมูลเดิม' using errcode = '22023';
  end if;

  update public.trip_logs
  set fuel_liters = p_fuel_liters,
      fuel_cost = p_fuel_cost
  where id = v_trip.id;

  insert into public.fuel_corrections (
    trip_log_id,
    old_fuel_liters,
    new_fuel_liters,
    old_fuel_cost,
    new_fuel_cost,
    reason,
    corrected_by
  ) values (
    v_trip.id,
    v_trip.fuel_liters,
    p_fuel_liters,
    v_trip.fuel_cost,
    p_fuel_cost,
    btrim(p_reason),
    (select auth.uid())
  );

  return jsonb_build_object(
    'trip_log_id', v_trip.id,
    'old_fuel_liters', v_trip.fuel_liters,
    'new_fuel_liters', p_fuel_liters,
    'old_fuel_cost', v_trip.fuel_cost,
    'new_fuel_cost', p_fuel_cost
  );
end;
$$;

revoke all on function public.admin_correct_trip_fuel(bigint, numeric, numeric, text)
  from public, anon;
grant execute on function public.admin_correct_trip_fuel(bigint, numeric, numeric, text)
  to authenticated;

create or replace function private.capture_fuel_correction_audit_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_plate text;
  v_driver text;
  v_actor text := coalesce((select auth.jwt()) ->> 'email', 'ผู้ดูแลระบบ');
begin
  select c.plate_number, tl.driver_name
  into v_plate, v_driver
  from public.trip_logs tl
  join public.cars c on c.id = tl.car_id
  where tl.id = NEW.trip_log_id;

  perform private.queue_audit_event_to_channel(
    'admin',
    'admin.fuel_corrected',
    '⛽ แก้ไขข้อมูลเติมน้ำมัน',
    'ผู้ดูแลระบบแก้ไขจำนวนลิตรหรือค่าใช้จ่ายที่บันทึกไว้',
    15844367,
    'fuel_corrections',
    NEW.id::text,
    v_actor,
    pg_catalog.jsonb_build_array(
      private.discord_audit_field('ทะเบียนรถ', v_plate, true),
      private.discord_audit_field('ผู้ขับ', v_driver, true),
      private.discord_audit_field('ปริมาณน้ำมัน', coalesce(NEW.old_fuel_liters, 0)::text || ' → ' || NEW.new_fuel_liters::text || ' ลิตร', true),
      private.discord_audit_field('ค่าใช้จ่าย', coalesce(NEW.old_fuel_cost, 0)::text || ' → ' || NEW.new_fuel_cost::text || ' บาท', true),
      private.discord_audit_field('เหตุผล', NEW.reason, false)
    ),
    'fuel',
    pg_catalog.jsonb_build_object('trip_log_id', NEW.trip_log_id, 'fuel_correction_id', NEW.id)
  );

  return NEW;
end;
$$;

revoke all on function private.capture_fuel_correction_audit_event()
  from public, anon, authenticated;

drop trigger if exists capture_fuel_correction_audit_event on public.fuel_corrections;
create trigger capture_fuel_correction_audit_event
after insert on public.fuel_corrections
for each row execute function private.capture_fuel_correction_audit_event();

drop trigger if exists capture_exhaustive_database_audit on public.fuel_corrections;
create trigger capture_exhaustive_database_audit
after insert or update or delete on public.fuel_corrections
for each row execute function private.capture_exhaustive_database_audit();

comment on table public.fuel_corrections is
  'Immutable audit history for administrator corrections to trip fuel liters and cost.';
