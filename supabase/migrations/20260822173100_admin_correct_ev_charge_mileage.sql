create or replace function public.admin_correct_ev_charge_mileage(
  p_trip_log_id bigint,
  p_new_value integer,
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

  if upper(btrim(coalesce(v_fuel_type, ''))) <> 'EV' then
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
$$;

revoke all on function public.admin_correct_ev_charge_mileage(bigint, integer, text)
  from public, anon;
grant execute on function public.admin_correct_ev_charge_mileage(bigint, integer, text)
  to authenticated;
