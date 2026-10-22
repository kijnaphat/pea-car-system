-- Canonical repair ledger notifications reuse the existing transactional outbox.
-- No webhook secrets, HTTP calls, schedule changes or historical backfill here.
create function private.repair_ledger_discord_status_label(p_status text)
returns text language sql immutable security invoker set search_path = '' as $$
  select case coalesce(p_status,'')
    when '' then 'รอดำเนินการ'
    when 'committee_signed' then 'คณะกรรมการลงนามแล้ว'
    when 'submitted_executive' then 'เสนอผู้บริหาร'
    when 'submitted_review' then 'ส่งตรวจเสนอ'
    when 'paid' then 'รับเงินแล้ว'
    else 'ไม่ระบุสถานะ' end;
$$;
revoke all on function private.repair_ledger_discord_status_label(text) from public,anon,authenticated,service_role;

create function private.repair_ledger_discord_date(p_day date)
returns text language sql immutable security invoker set search_path = '' as $$
  select case when p_day is null then 'ยังไม่ระบุ'
    else pg_catalog.to_char(p_day,'DD/MM/') || (extract(year from p_day)::integer+543)::text end;
$$;
revoke all on function private.repair_ledger_discord_date(date) from public,anon,authenticated,service_role;

create function private.capture_repair_ledger_discord_event()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  v_event_type text;
  v_title text;
  v_description text;
  v_fields jsonb;
  v_actor text;
  v_color integer;
  v_changes jsonb;
begin
  if tg_op='INSERT' then
    v_event_type:='maintenance.ledger_created';
    v_title:='🛠️ เพิ่มรายการสมุดคุมงานซ่อม';
    v_description:='บันทึกรายการซ่อมใหม่สำเร็จ';
    v_color:=3066993;
    v_changes:=jsonb_build_object('ledger_id',new.id,'operation','created','status',new.status);
  elsif tg_op='UPDATE' and new.status is distinct from old.status then
    v_event_type:='maintenance.ledger_status_changed';
    v_title:='🔄 เปลี่ยนสถานะงานซ่อม';
    v_description:='สถานะเดิม: '||private.repair_ledger_discord_status_label(old.status)
      ||E'\nสถานะใหม่: '||private.repair_ledger_discord_status_label(new.status);
    v_color:=case when new.status='paid' then 3066993 else 3447003 end;
    v_changes:=jsonb_build_object('ledger_id',new.id,'operation','status_changed',
      'old_status',old.status,'new_status',new.status);
  else
    return new;
  end if;

  -- These names are server-validated by the existing before-write ledger guard.
  -- Never forward the raw personnel code, auth token, full row or account document.
  v_actor:=coalesce(nullif(pg_catalog.btrim(new.updated_by_staff_name),''),
    case when tg_op='INSERT' then nullif(pg_catalog.btrim(new.created_by_staff_name),'') end,
    'ผู้ดูแลระบบ');
  v_fields:=jsonb_build_array(
    private.discord_audit_field('ทะเบียนรถ',new.plate_number,true),
    private.discord_audit_field('แผนก',new.department,true),
    private.discord_audit_field('วันที่ลง ยพ.6',
      case when new.usage_date is null then 'ยังไม่เลือกวันที่ใช้งานรถ'
        else private.repair_ledger_discord_date(new.usage_date) end,true),
    private.discord_audit_field('วันที่ซ่อมจริง',private.repair_ledger_discord_date(new.repair_date),true),
    private.discord_audit_field('ร้าน / อู่ซ่อม',new.shop_name,true),
    private.discord_audit_field('เลขบิล',new.bill_number,true),
    private.discord_audit_field('จำนวนเงิน',case when new.amount is null then 'รอระบุยอด'
      else pg_catalog.to_char(new.amount,'FM9,999,999,990.00')||' บาท' end,true),
    private.discord_audit_field('รายการซ่อม',new.repair_description,false),
    private.discord_audit_field('ผู้ดำเนินการ',v_actor,true)
  );
  if tg_op='INSERT' then
    v_fields:=v_fields||jsonb_build_array(
      private.discord_audit_field('สถานะ',private.repair_ledger_discord_status_label(new.status),true));
  else
    v_fields:=v_fields||jsonb_build_array(
      private.discord_audit_field('สถานะเดิม',private.repair_ledger_discord_status_label(old.status),true),
      private.discord_audit_field('สถานะใหม่',private.repair_ledger_discord_status_label(new.status),true));
  end if;
  v_fields:=v_fields||jsonb_build_array(private.discord_audit_field('แหล่งข้อมูล',
    case when new.maintenance_record_id is not null then 'เชื่อมข้อมูลแจ้งซ่อมของผู้ใช้'
      when new.source_type='report' then 'บันทึกจากรายงานการใช้รถ' else 'กรอกจากสมุดคุมงานซ่อม' end,true));

  if new.car_id is not null then
    v_description:=v_description||E'\n[เปิดสมุดคุมงานซ่อม](https://pea-car-system.vercel.app/report/repairs?car_id='
      ||new.car_id::text||'&month='||pg_catalog.to_char(coalesce(new.usage_date,new.repair_date),'YYYY-MM')||')';
  end if;

  -- Insert and its outbox event commit together. The existing worker handles
  -- Discord errors/retries AFTER commit, so network failure cannot block a save.
  -- A retry INSERT ON CONFLICT DO NOTHING and an unchanged status enqueue nothing.
  perform private.queue_audit_event_to_channel(
    'maintenance',v_event_type,v_title,v_description,v_color,
    'repair_work_ledger',new.id::text,v_actor,v_fields,'maintenance_billing',v_changes);
  return new;
end;
$$;
revoke all on function private.capture_repair_ledger_discord_event() from public,anon,authenticated,service_role;

create trigger notify_repair_ledger_discord
  after insert or update of status on public.repair_work_ledger
  for each row execute function private.capture_repair_ledger_discord_event();

comment on trigger notify_repair_ledger_discord on public.repair_work_ledger is
  'One queued maintenance_billing alert per new ledger entry or actual status transition; no detail-edit, source-link, no-op or retry alerts.';
