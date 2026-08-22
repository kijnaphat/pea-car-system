update public.maintenance_repair_items
set is_active = false
where code in (
  'inspection_labor',
  'engine_oil_filter',
  'tires_wheels',
  'brakes',
  'battery_electrical',
  'engine_drivetrain',
  'air_conditioning',
  'suspension_steering',
  'body_glass',
  'vehicle_equipment'
);

insert into public.maintenance_repair_items (code, name, display_order, is_active)
values
  ('general_inspection', 'ตรวจเช็กสภาพรถ', 10, true),
  ('repair_labor', 'ค่าแรงซ่อม', 20, true),

  ('replace_engine_oil', 'เปลี่ยนน้ำมันเครื่อง', 100, true),
  ('replace_engine_oil_filter', 'เปลี่ยนไส้กรองน้ำมันเครื่อง', 110, true),
  ('replace_air_filter', 'เปลี่ยนไส้กรองอากาศ', 120, true),
  ('replace_fuel_filter', 'เปลี่ยนไส้กรองเชื้อเพลิง', 130, true),
  ('replace_transmission_oil', 'เปลี่ยนน้ำมันเกียร์', 140, true),
  ('replace_differential_oil', 'เปลี่ยนน้ำมันเฟืองท้าย', 150, true),

  ('replace_tire', 'เปลี่ยนยาง', 200, true),
  ('patch_tire', 'ปะยาง', 210, true),
  ('rotate_tires', 'สลับยาง', 220, true),
  ('wheel_alignment', 'ตั้งศูนย์ล้อ', 230, true),
  ('wheel_balancing', 'ถ่วงล้อ', 240, true),
  ('repair_wheel', 'ซ่อมล้อ', 250, true),

  ('replace_brake_pads', 'เปลี่ยนผ้าเบรก', 300, true),
  ('replace_brake_disc', 'เปลี่ยนจานเบรก', 310, true),
  ('replace_brake_fluid', 'เปลี่ยนน้ำมันเบรก', 320, true),
  ('repair_brake_system', 'ซ่อมระบบเบรก', 330, true),

  ('replace_battery', 'เปลี่ยนแบตเตอรี่', 400, true),
  ('repair_electrical_system', 'ซ่อมระบบไฟฟ้า', 410, true),
  ('replace_light_bulb', 'เปลี่ยนหลอดไฟ', 420, true),
  ('repair_alternator', 'ซ่อมไดชาร์จ', 430, true),
  ('repair_starter_motor', 'ซ่อมมอเตอร์สตาร์ท', 440, true),
  ('repair_lighting_system', 'ซ่อมระบบไฟส่องสว่าง', 450, true),

  ('repair_engine', 'ซ่อมเครื่องยนต์', 500, true),
  ('repair_transmission', 'ซ่อมระบบเกียร์', 510, true),
  ('repair_drivetrain', 'ซ่อมระบบส่งกำลัง', 520, true),
  ('repair_fuel_system', 'ซ่อมระบบเชื้อเพลิง', 530, true),
  ('repair_radiator', 'ซ่อมหม้อน้ำ', 540, true),
  ('replace_coolant', 'เปลี่ยนน้ำยาหล่อเย็น', 550, true),
  ('replace_belt', 'เปลี่ยนสายพาน', 560, true),

  ('repair_air_conditioner', 'ซ่อมเครื่องปรับอากาศ', 600, true),
  ('refill_refrigerant', 'เติมน้ำยาแอร์', 610, true),
  ('replace_ac_compressor', 'เปลี่ยนคอมเพรสเซอร์แอร์', 620, true),

  ('repair_suspension', 'ซ่อมช่วงล่าง', 700, true),
  ('repair_steering', 'ซ่อมพวงมาลัย', 710, true),
  ('replace_shock_absorber', 'เปลี่ยนโช้คอัพ', 720, true),
  ('replace_ball_joint', 'เปลี่ยนลูกหมาก', 730, true),
  ('replace_bushing', 'เปลี่ยนบูช', 740, true),

  ('repair_body', 'ซ่อมตัวถัง', 800, true),
  ('paint_vehicle', 'ทำสีรถ', 810, true),
  ('replace_glass', 'เปลี่ยนกระจก', 820, true),
  ('repair_door', 'ซ่อมประตู', 830, true),
  ('repair_side_mirror', 'ซ่อมกระจกมองข้าง', 840, true),

  ('repair_vehicle_equipment', 'ซ่อมอุปกรณ์ประจำรถ', 900, true),
  ('replace_wiper_blade', 'เปลี่ยนใบปัดน้ำฝน', 910, true),
  ('repair_emergency_light', 'ซ่อมสัญญาณไฟฉุกเฉิน', 920, true),
  ('repair_gps', 'ซ่อมระบบ GPS', 930, true),
  ('repair_dash_camera', 'ซ่อมกล้องติดรถ', 940, true),

  ('inspect_ev_battery', 'ตรวจเช็กแบตเตอรี่รถไฟฟ้า', 1000, true),
  ('repair_charging_system', 'ซ่อมระบบชาร์จ', 1010, true),
  ('repair_ev_motor', 'ซ่อมมอเตอร์ไฟฟ้า', 1020, true),
  ('repair_inverter', 'ซ่อมอินเวอร์เตอร์', 1030, true),

  ('wash_vehicle', 'ล้างรถ', 1100, true),
  ('clean_vehicle_interior', 'ทำความสะอาดภายใน', 1110, true),
  ('other', 'อื่น ๆ', 1200, true)
on conflict (code) do update
set name = excluded.name,
    display_order = excluded.display_order,
    is_active = excluded.is_active;

drop policy if exists "public_read_active_maintenance_repair_items"
  on public.maintenance_repair_items;
drop policy if exists "public_read_maintenance_repair_items"
  on public.maintenance_repair_items;

create policy "public_read_maintenance_repair_items"
on public.maintenance_repair_items
for select
to anon, authenticated
using (true);
