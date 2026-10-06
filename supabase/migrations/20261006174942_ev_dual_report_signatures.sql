-- Keep existing charging/oil signatures intact. EV driving reports have their
-- own month/signers, with the same verified staff-code workflow as before.
create table public.ev_usage_report_signatures (
  id bigint generated always as identity primary key,
  car_id bigint not null references public.cars(id) on delete cascade,
  report_month text not null check (report_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  driver_sig text, driver_name text, driver_pos text,
  controller_sig text, controller_name text, controller_pos text,
  driver_staff_id bigint references public.staff(id) on delete set null,
  controller_staff_id bigint references public.staff(id) on delete set null,
  unique (car_id, report_month)
);
create index ev_usage_signature_driver_idx on public.ev_usage_report_signatures(driver_staff_id) where driver_staff_id is not null;
create index ev_usage_signature_controller_idx on public.ev_usage_report_signatures(controller_staff_id) where controller_staff_id is not null;
alter table public.ev_usage_report_signatures enable row level security;
revoke all on public.ev_usage_report_signatures from public, anon, authenticated;
grant select on public.ev_usage_report_signatures to anon, authenticated;
grant all on public.ev_usage_report_signatures to service_role;
create policy public_read_ev_usage_signatures on public.ev_usage_report_signatures for select to anon, authenticated using (true);

create or replace function private.save_ev_usage_report_signature(
  p_car_id bigint, p_report_month text, p_target text, p_staff_code text, p_signature text
) returns json language plpgsql security definer set search_path = '' as $$
declare
  v_staff public.staff%rowtype;
  v_existing public.ev_usage_report_signatures%rowtype;
  v_date date := (pg_catalog.now() at time zone 'Asia/Bangkok')::date;
  v_allowed_month text;
  v_fuel_type text;
begin
  if p_car_id is null or p_report_month is null
    or p_report_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
    or p_target is null or p_target not in ('driver','controller')
    or nullif(pg_catalog.btrim(p_staff_code),'') is null then
    return pg_catalog.json_build_object('error','ข้อมูลสำหรับลงนามไม่ครบถ้วน');
  end if;
  if p_signature is not null and
    (p_signature !~ '^data:image/png;base64,' or pg_catalog.octet_length(p_signature) > 2097152) then
    return pg_catalog.json_build_object('error','รูปแบบหรือตัวลายเซ็นไม่ถูกต้อง');
  end if;
  if pg_catalog.date_part('day',v_date) >= 28 then
    v_allowed_month := pg_catalog.to_char(v_date,'YYYY-MM');
  elsif pg_catalog.date_part('day',v_date) <= 5 then
    v_allowed_month := pg_catalog.to_char(v_date - interval '1 month','YYYY-MM');
  else
    return pg_catalog.json_build_object('error','ลงนามได้เฉพาะวันที่ 28 ถึง 5 ของรอบเดือน');
  end if;
  if p_report_month <> v_allowed_month then
    return pg_catalog.json_build_object('error','เดือนไม่อยู่ในช่วงที่อนุญาตให้ลงนาม');
  end if;

  select * into v_staff from public.staff where staff_code=pg_catalog.btrim(p_staff_code) limit 1;
  if v_staff.id is null then return pg_catalog.json_build_object('error','ไม่พบรหัสพนักงานในระบบ'); end if;
  -- Serialize insert/update of a vehicle's signer record, including the first signature.
  select fuel_type into v_fuel_type from public.cars where id=p_car_id for update;
  if not found or pg_catalog.upper(pg_catalog.btrim(v_fuel_type)) is distinct from 'EV' then
    return pg_catalog.json_build_object('error','รายงานนี้ใช้สำหรับการขับรถ EV เท่านั้น');
  end if;
  select * into v_existing from public.ev_usage_report_signatures
    where car_id=p_car_id and report_month=p_report_month for update;
  if (p_target='driver' and v_existing.driver_staff_id is not null and v_existing.driver_staff_id<>v_staff.id)
    or (p_target='controller' and v_existing.controller_staff_id is not null and v_existing.controller_staff_id<>v_staff.id) then
    return pg_catalog.json_build_object('error','ลายเซ็นนี้ถูกยืนยันโดยพนักงานคนอื่นแล้ว');
  end if;
  if v_existing.id is null and p_signature is null then
    return pg_catalog.json_build_object('success',true);
  end if;
  if v_existing.id is null then
    insert into public.ev_usage_report_signatures(car_id,report_month)
      values(p_car_id,p_report_month) returning * into v_existing;
  end if;
  if p_target='driver' then
    update public.ev_usage_report_signatures set
      driver_sig=p_signature,
      driver_name=case when p_signature is null then null else v_staff.full_name end,
      driver_pos=case when p_signature is null then null else v_staff.position end,
      driver_staff_id=case when p_signature is null then null else v_staff.id end
      where id=v_existing.id;
  else
    update public.ev_usage_report_signatures set
      controller_sig=p_signature,
      controller_name=case when p_signature is null then null else v_staff.full_name end,
      controller_pos=case when p_signature is null then null else v_staff.position end,
      controller_staff_id=case when p_signature is null then null else v_staff.id end
      where id=v_existing.id;
  end if;
  return pg_catalog.json_build_object('success',true);
end;
$$;
revoke all on function private.save_ev_usage_report_signature(bigint,text,text,text,text) from public;
grant execute on function private.save_ev_usage_report_signature(bigint,text,text,text,text) to anon,authenticated,service_role;

create or replace function public.save_report_signature_v2(
  p_car_id bigint, p_report_month text, p_target text, p_staff_code text,
  p_signature text, p_report_type text
) returns json language plpgsql security invoker set search_path = '' as $$
declare v_is_ev boolean;
begin
  if p_report_type is null or p_report_type not in ('usage','charge') then
    return pg_catalog.json_build_object('error','กรุณาเลือกแบบรายงาน');
  end if;
  select pg_catalog.upper(pg_catalog.btrim(fuel_type))='EV' into v_is_ev
    from public.cars where id=p_car_id;
  if not found then return pg_catalog.json_build_object('error','ไม่พบรถในระบบ'); end if;
  if p_report_type='charge' and not coalesce(v_is_ev,false) then
    return pg_catalog.json_build_object('error','รายงานชาร์จใช้สำหรับรถ EV เท่านั้น');
  end if;
  if v_is_ev and p_report_type='usage' then
    return private.save_ev_usage_report_signature(p_car_id,p_report_month,p_target,p_staff_code,p_signature);
  end if;
  return public.save_report_signature(p_car_id,p_report_month,p_target,p_staff_code,p_signature);
end;
$$;
revoke all on function public.save_report_signature_v2(bigint,text,text,text,text,text) from public;
grant execute on function public.save_report_signature_v2(bigint,text,text,text,text,text) to anon,authenticated,service_role;

-- One event to the existing signatures channel; never send signature images.
create or replace function private.audit_ev_usage_signature() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_row public.ev_usage_report_signatures%rowtype; v_plate text;
begin
  v_row := case when TG_OP='DELETE' then OLD else NEW end;
  if TG_OP='INSERT' and v_row.driver_sig is null and v_row.controller_sig is null then return NEW; end if;
  select plate_number into v_plate from public.cars where id=v_row.car_id;
  perform private.queue_audit_event('document',
    case when TG_OP='DELETE' then 'document.signature_deleted' else 'document.signature_updated' end,
    '✍️ ลายเซ็นรายงานการใช้งานรถ EV','รายงาน ยพ.6 ของรถ EV (ไม่รวมรายงานชาร์จ)',10181046,
    'ev_usage_report_signatures',v_row.id::text,coalesce(v_row.driver_name,v_row.controller_name,'ผู้ใช้งานเว็บไซต์'),
    pg_catalog.jsonb_build_array(
      private.discord_audit_field('ทะเบียนรถ',v_plate,true),
      private.discord_audit_field('เดือนรายงาน',v_row.report_month,true),
      private.discord_audit_field('ผู้ขับ',v_row.driver_name,true),
      private.discord_audit_field('ผู้ควบคุม',v_row.controller_name,true)
    ));
  return case when TG_OP='DELETE' then OLD else NEW end;
end;
$$;
revoke all on function private.audit_ev_usage_signature() from public,anon,authenticated;
create trigger capture_ev_usage_signature after insert or update or delete on public.ev_usage_report_signatures
  for each row execute function private.audit_ev_usage_signature();
notify pgrst, 'reload schema';
