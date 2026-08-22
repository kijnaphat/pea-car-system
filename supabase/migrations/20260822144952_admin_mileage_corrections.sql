create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists public.mileage_corrections (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  trip_log_id bigint not null references public.trip_logs(id) on delete restrict,
  field_name text not null check (field_name in ('start_mileage', 'end_mileage')),
  old_value integer,
  new_value integer,
  reason text not null,
  corrected_by uuid,
  corrected_at timestamptz not null default now(),
  constraint mileage_corrections_old_value_nonnegative check (old_value is null or old_value >= 0),
  constraint mileage_corrections_new_value_nonnegative check (new_value is null or new_value >= 0),
  constraint mileage_corrections_changed_value check (old_value is distinct from new_value),
  constraint mileage_corrections_reason_present check (char_length(btrim(reason)) >= 3)
);

create index if not exists mileage_corrections_trip_log_idx
  on public.mileage_corrections (trip_log_id, corrected_at desc);

create index if not exists mileage_corrections_batch_idx
  on public.mileage_corrections (batch_id);

alter table public.mileage_corrections enable row level security;

drop policy if exists "admin_read_mileage_corrections" on public.mileage_corrections;
create policy "admin_read_mileage_corrections"
on public.mileage_corrections
for select
to authenticated
using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

revoke all on table public.mileage_corrections from public, anon, authenticated;
grant select on table public.mileage_corrections to authenticated;

create or replace function private.audit_trip_mileage_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reason text := nullif(current_setting('app.mileage_correction_reason', true), '');
  v_batch_text text := nullif(current_setting('app.mileage_correction_batch_id', true), '');
  v_batch_id uuid;
begin
  begin
    v_batch_id := coalesce(v_batch_text::uuid, gen_random_uuid());
  exception when invalid_text_representation then
    v_batch_id := gen_random_uuid();
  end;

  v_reason := coalesce(v_reason, 'แก้ไขเลขไมล์โดยผู้ดูแลระบบ');

  if old.start_mileage is distinct from new.start_mileage then
    insert into public.mileage_corrections (
      batch_id, trip_log_id, field_name, old_value, new_value, reason, corrected_by
    ) values (
      v_batch_id, new.id, 'start_mileage', old.start_mileage, new.start_mileage,
      v_reason, (select auth.uid())
    );
  end if;

  if old.end_mileage is distinct from new.end_mileage then
    insert into public.mileage_corrections (
      batch_id, trip_log_id, field_name, old_value, new_value, reason, corrected_by
    ) values (
      v_batch_id, new.id, 'end_mileage', old.end_mileage, new.end_mileage,
      v_reason, (select auth.uid())
    );
  end if;

  return new;
end;
$$;

revoke all on function private.audit_trip_mileage_changes() from public, anon, authenticated;

drop trigger if exists audit_trip_mileage_changes on public.trip_logs;
create trigger audit_trip_mileage_changes
after update of start_mileage, end_mileage on public.trip_logs
for each row
when (
  old.start_mileage is distinct from new.start_mileage
  or old.end_mileage is distinct from new.end_mileage
)
execute function private.audit_trip_mileage_changes();

drop policy if exists "admin_update_trip_mileage" on public.trip_logs;
create policy "admin_update_trip_mileage"
on public.trip_logs
for update
to authenticated
using (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin')
with check (coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') = 'admin');

grant update (start_mileage, end_mileage) on public.trip_logs to authenticated;

create or replace function public.admin_correct_trip_mileage(
  p_trip_log_id bigint,
  p_field_name text,
  p_new_value integer,
  p_reason text,
  p_sync_adjacent boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
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
        set end_mileage = p_new_value
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
        set start_mileage = p_new_value
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
$$;

revoke all on function public.admin_correct_trip_mileage(bigint, text, integer, text, boolean)
  from public, anon;
grant execute on function public.admin_correct_trip_mileage(bigint, text, integer, text, boolean)
  to authenticated;
