-- A completed charging receipt inside an open driving trip; never a second
-- active trip. Existing EV charge reports automatically include these rows.
alter table public.trip_logs add column parent_trip_log_id bigint references public.trip_logs(id) on delete cascade;
alter table public.trip_logs add column charge_request_id uuid;
create index trip_logs_parent_trip_idx on public.trip_logs(parent_trip_log_id) where parent_trip_log_id is not null;
create unique index trip_logs_charge_request_idx on public.trip_logs(charge_request_id) where charge_request_id is not null;
alter table public.trip_logs add constraint nested_charge_shape check (
  parent_trip_log_id is null or (
    parent_trip_log_id <> id and activity_type is not distinct from 'charge'
    and is_completed is true and end_time is not null and start_time is not null
    and end_mileage is not null and start_mileage is not null and end_mileage=start_mileage
    and battery_before is not null and battery_after is not null
    and battery_before between 0 and 100 and battery_after between 0 and 100 and battery_after>battery_before
    and coalesce(fuel_liters,0)=0 and coalesce(fuel_cost,0)=0
  )
);

create function private.record_ev_charge_during_trip_impl(
  p_car_id bigint, p_trip_log_id bigint, p_staff_code text, p_mileage integer,
  p_battery_before integer, p_battery_after integer, p_station_type text,
  p_station_name text, p_request_id uuid
) returns json language plpgsql security definer set search_path='' as $$
declare v_car public.cars%rowtype; v_trip public.trip_logs%rowtype;
  v_staff_id bigint; v_existing public.trip_logs%rowtype; v_id bigint; v_min integer;
begin
  if p_request_id is null or p_trip_log_id is null or p_car_id is null then
    return pg_catalog.json_build_object('error','ข้อมูลรายการไม่ครบ กรุณาสแกน QR ใหม่');
  end if;
  select id into v_staff_id from public.staff where staff_code=pg_catalog.btrim(p_staff_code);
  if v_staff_id is null then return pg_catalog.json_build_object('error','ไม่พบรหัสพนักงาน'); end if;
  -- Serialize against returning the car, maintenance, and simultaneous receipts.
  select * into v_car from public.cars where id=p_car_id for update;
  if not found or pg_catalog.upper(pg_catalog.btrim(v_car.fuel_type)) is distinct from 'EV' then
    return pg_catalog.json_build_object('error','ใช้ได้เฉพาะรถ EV');
  end if;
  select * into v_trip from public.trip_logs where id=p_trip_log_id and car_id=p_car_id for update;
  if not found or v_trip.driver_staff_id is distinct from v_staff_id then
    return pg_catalog.json_build_object('error','ต้องใช้รหัสพนักงานผู้ขับภารกิจนี้คนเดิม');
  end if;
  select * into v_existing from public.trip_logs where charge_request_id=p_request_id;
  if found then
    if v_existing.parent_trip_log_id=p_trip_log_id and v_existing.driver_staff_id=v_staff_id
      and v_existing.start_mileage=p_mileage and v_existing.battery_before=p_battery_before
      and v_existing.battery_after=p_battery_after and v_existing.station_type=p_station_type
      and v_existing.station_name=pg_catalog.btrim(p_station_name) then
      return pg_catalog.json_build_object('success',true,'trip_log_id',v_existing.id,'already_saved',true);
    end if;
    return pg_catalog.json_build_object('error','รายการนี้ถูกบันทึกด้วยข้อมูลอื่นแล้ว กรุณาเปิดฟอร์มใหม่');
  end if;
  if v_car.status <> 'busy' or v_trip.is_completed is distinct from false
    or public.effective_trip_activity(v_trip.activity_type,v_car.fuel_type)<>'usage'
    or v_trip.parent_trip_log_id is not null then
    return pg_catalog.json_build_object('error','ภารกิจนี้จบแล้วหรือไม่ใช่เที่ยวขับ กรุณาสแกน QR ใหม่');
  end if;
  if (select count(*) from public.trip_logs where car_id=p_car_id and is_completed=false)<>1 then
    return pg_catalog.json_build_object('error','พบรายการค้างซ้ำ กรุณาติดต่อผู้ดูแล');
  end if;
  select greatest(v_trip.start_mileage,coalesce(max(start_mileage),v_trip.start_mileage)) into v_min
    from public.trip_logs where parent_trip_log_id=p_trip_log_id;
  if p_mileage is null or p_mileage<0 or p_mileage<v_min then
    return pg_catalog.json_build_object('error','เลขไมล์ต้องไม่น้อยกว่าเลขไมล์ออกหรือชาร์จครั้งก่อน ('||v_min||')');
  end if;
  if p_battery_before is null or p_battery_after is null or p_battery_before not between 0 and 100
    or p_battery_after not between 0 and 100 or p_battery_after<=p_battery_before then
    return pg_catalog.json_build_object('error','แบตหลังชาร์จต้องเพิ่มขึ้นและอยู่ในช่วง 0–100%');
  end if;
  if p_station_type is null or p_station_type not in ('PEA','OTHER')
    or nullif(pg_catalog.btrim(p_station_name),'') is null or pg_catalog.char_length(p_station_name)>500 then
    return pg_catalog.json_build_object('error','กรุณาระบุประเภทและชื่อสถานีชาร์จ');
  end if;
  insert into public.trip_logs(car_id,parent_trip_log_id,charge_request_id,activity_type,
    driver_staff_id,driver_name,driver_position,task_id,start_mileage,end_mileage,start_time,end_time,
    battery_before,battery_after,station_type,station_name,location,is_completed,fuel_liters,fuel_cost)
  values(p_car_id,p_trip_log_id,p_request_id,'charge',v_staff_id,v_trip.driver_name,v_trip.driver_position,
    v_trip.task_id,p_mileage,p_mileage,pg_catalog.now(),pg_catalog.now(),p_battery_before,p_battery_after,
    p_station_type,pg_catalog.btrim(p_station_name),pg_catalog.btrim(p_station_name),true,0,0) returning id into v_id;
  perform private.queue_audit_event('vehicle','ev.charge_completed','🔋 ชาร์จ EV ระหว่างภารกิจ',
    'ชาร์จเสร็จแล้ว ภารกิจเดิมยังเปิดอยู่ รถยังไม่ถูกคืน',10181046,'trip_logs',v_id::text,v_trip.driver_name,
    pg_catalog.jsonb_build_array(
      private.discord_audit_field('ทะเบียนรถ',v_car.plate_number,true),
      private.discord_audit_field('ผู้ขับ',v_trip.driver_name,true),
      private.discord_audit_field('เลขไมล์ชาร์จ',p_mileage::text,true),
      private.discord_audit_field('แบตเตอรี่',p_battery_before||'% → '||p_battery_after||'%',true),
      private.discord_audit_field('สถานีชาร์จ',pg_catalog.btrim(p_station_name),false),
      private.discord_audit_field('ภารกิจเดิม',p_trip_log_id::text,true)));
  return pg_catalog.json_build_object('success',true,'trip_log_id',v_id,'parent_trip_log_id',p_trip_log_id);
end;
$$;
revoke all on function private.record_ev_charge_during_trip_impl(bigint,bigint,text,integer,integer,integer,text,text,uuid) from public;
grant execute on function private.record_ev_charge_during_trip_impl(bigint,bigint,text,integer,integer,integer,text,text,uuid) to anon,authenticated,service_role;
create function public.record_ev_charge_during_trip(
  p_car_id bigint,p_trip_log_id bigint,p_staff_code text,p_mileage integer,p_battery_before integer,
  p_battery_after integer,p_station_type text,p_station_name text,p_request_id uuid
) returns json language sql security invoker set search_path='' as $$
  select private.record_ev_charge_during_trip_impl(p_car_id,p_trip_log_id,p_staff_code,p_mileage,
    p_battery_before,p_battery_after,p_station_type,p_station_name,p_request_id);
$$;
revoke all on function public.record_ev_charge_during_trip(bigint,bigint,text,integer,integer,integer,text,text,uuid) from public;
grant execute on function public.record_ev_charge_during_trip(bigint,bigint,text,integer,integer,integer,text,text,uuid) to anon,authenticated,service_role;

-- Protect return/maintenance AND admin corrections from violating child mileage.
create function private.guard_in_trip_charge_mileage() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_parent public.trip_logs%rowtype; v_min integer; v_max integer;
begin
  if new.parent_trip_log_id is not null then
    select * into v_parent from public.trip_logs where id=new.parent_trip_log_id;
    if v_parent.car_id is distinct from new.car_id or v_parent.driver_staff_id is distinct from new.driver_staff_id
      or v_parent.activity_type is distinct from 'usage' or new.start_mileage<v_parent.start_mileage
      or (v_parent.is_completed and new.start_mileage>v_parent.end_mileage) then
      raise exception 'เลขไมล์ชาร์จหรือภารกิจต้นทางไม่สัมพันธ์กัน' using errcode='22023';
    end if;
  else
    select min(start_mileage),max(start_mileage) into v_min,v_max from public.trip_logs where parent_trip_log_id=new.id;
    if v_min is not null and (new.start_mileage>v_min or (new.end_mileage is not null and new.end_mileage<v_max)) then
      raise exception 'เลขไมล์คืนต้องไม่น้อยกว่าเลขไมล์ที่ชาร์จระหว่างภารกิจ (%)',v_max using errcode='22023';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.guard_in_trip_charge_mileage() from public,anon,authenticated;
create trigger guard_in_trip_charge_mileage before insert or update on public.trip_logs
  for each row execute function private.guard_in_trip_charge_mileage();

-- Preserve the existing audit implementation but do not mislabel a completed
-- receipt INSERT as "charging started"; the RPC queues one completion event.
do $$ declare v_def text; begin
  v_def:=pg_catalog.pg_get_functiondef('private.capture_business_audit_event()'::regprocedure);
  if position('if TG_TABLE_NAME = ''trip_logs'' then' in v_def)=0 then raise exception 'Audit patch target missing'; end if;
  execute replace(v_def,'if TG_TABLE_NAME = ''trip_logs'' then',
    'if TG_TABLE_NAME = ''trip_logs'' then
    if coalesce(v_new ->> ''parent_trip_log_id'',v_old ->> ''parent_trip_log_id'') is not null then return NEW; end if;');
  v_def:=pg_catalog.pg_get_functiondef('public.get_public_fleet_snapshot()'::regprocedure);
  if position('order by t.car_id, t.start_time desc, t.id desc' in v_def)=0 then raise exception 'Snapshot patch target missing'; end if;
  execute replace(v_def,'order by t.car_id, t.start_time desc, t.id desc',
    'order by t.car_id, t.end_time desc nulls last, t.start_time desc, t.id desc');
  v_def:=pg_catalog.pg_get_functiondef('public.admin_correct_trip_mileage(bigint,text,integer,text,boolean)'::regprocedure);
  if position('and (coalesce(start_time, created_at), id)' in v_def)=0 then raise exception 'Mileage patch target missing'; end if;
  execute replace(v_def,'and (coalesce(start_time, created_at), id)',
    'and parent_trip_log_id is null and (coalesce(start_time, created_at), id)');
end; $$;
create index trip_logs_latest_returned_car_idx on public.trip_logs(car_id,end_time desc nulls last,start_time desc,id desc) where is_completed=true;
notify pgrst,'reload schema';
