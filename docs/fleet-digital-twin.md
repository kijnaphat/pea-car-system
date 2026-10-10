# ลานรถ Digital Twin

เปิด `/dashboard` เพื่อใช้มุมมองลานรถ 3D ส่วนกราฟและรายงานเดิมอยู่ที่ปุ่ม **สถิติและรายงานเดิม**

## ข้อมูลจริง

- ใช้ `cars` และ `trip_logs` เดิม ไม่สร้างเที่ยวรถจากแอนิเมชัน
- สถานะปัจจุบันอ่าน `/api/fleet` ที่มี shared cache ทุก 60 วินาที หยุดอ่านเมื่อแท็บถูกซ่อน
- ไม่เปิด Realtime subscription แบบรายผู้ชม เพื่อรักษาการลด Log Ingestion เดิม การเปลี่ยนสถานะจึงมีความหน่วงตามรอบอ่าน/แคช
- รถพร้อมใช้/กำลังชาร์จ/ซ่อมแสดงในผังจำลอง รถออกภารกิจแสดงช่องประจำว่าง ไม่ใช่หลักฐานว่ารถอยู่สำนักงานจริง
- ช่องประจำอยู่ใน `fleet_parking_slots` ไม่เปลี่ยนตามการเรียงรายการ กรองรถ หรือรีเฟรชรถที่กำลังออก
- รถใหม่ที่แสดงในระบบได้รับเลขช่องถัดไปจาก trigger ไม่ใช้ช่องของคันเดิมซ้ำ
- Dashboard แสดงรายละเอียดและรายงานเท่านั้น ไม่มีลิงก์เปิดรายการรถ/เบิก/คืน/ชาร์จ ให้สแกน QR ที่รถเพื่อเข้าสู่ขั้นตอนเดิม (ไม่เปลี่ยนการตรวจสิทธิ์หรือ URL ของระบบเดิม)
- แบตเตอรี่เป็นค่าที่บันทึกพร้อมเวลาบันทึก ไม่ใช่ telemetry; ไม่มีความเร็ว น้ำมันคงเหลือ หรือระยะทางคงเหลือจำลอง

## การเคลื่อนไหว

เมื่อ snapshot เปลี่ยนจากพร้อมใช้เป็นเที่ยวขับ ให้รถจำลองวิ่งออกตามทาง 8 วินาที เมื่อเที่ยวขับจบวิ่งกลับช่องเดิม คิวการเคลื่อนที่แยกรายคันและไม่แก้สถานะธุรกิจ

โหลดหน้าใหม่ใช้สถานะฐานข้อมูลเป็นจุดตั้งต้น ไม่เล่นเหตุการณ์เก่า รถที่ออกไปแล้วไม่ปรากฏในช่องเดิม การชาร์จระหว่างเที่ยวขับไม่สร้างการเบิกรถครั้งใหม่

## ย้อนหลัง

เลือกวันตามเวลาไทย อ่านเฉพาะเที่ยวที่ทับกับวันนั้น กดเล่นที่ 1–120× หรือเลื่อนเวลาเอง การเลื่อนรีเซ็ตคิวภาพจำลองและสร้างภาพ ณ เวลานั้นโดยตรง

เป็นการย้อน **เที่ยวขับ/ชาร์จของรถที่ยังอยู่ใน fleet ปัจจุบัน** ไม่ใช่ประวัติสถานะซ่อม/การเพิ่มลบรถย้อนหลัง ข้อมูลเหล่านั้นยังอ่านจากรายงานเดิม

## สาธิต / การเข้าถึง

สาธิต 25 คันเป็นข้อมูลในหน่วยความจำ ปุ่มเบิก/คืน/ส่ง 3 คัน/คืนทั้งหมด/รีเซ็ตไม่ติดต่อ Supabase หรือส่ง Discord ข้อมูลจริงโหลดกลับเมื่อสลับไปสถานะปัจจุบัน

เลือกจากรถ 3D, ช่องว่าง หรือรายการปุ่มด้านข้าง ใช้คีย์บอร์ดเลือกจากรายการได้ มี 2D top-down, 2D grid สำรอง, zoom/pan/reset และ reduced-motion กล้อง isometric ใช้ orthographic; ฉากเป็น geometry จริง ไม่ใช่ภาพพื้นหลัง

โมเดลจำแนกตาม `car_type`: กระเช้า/เครน/ขุดเจาะมีอุปกรณ์ชัดเจน, บรรทุกใหญ่มี 6 ล้อ, บรรทุกเล็ก/มีหลังคา/กระบะ/ตู้/EV มีรูปทรงต่างกัน ประเภทใหม่ที่ไม่รู้จักใช้โมเดลกลาง ไม่เดาตามยี่ห้อ สีเป็นสีจำแนกในผังจำลอง ไม่ใช่สีตัวรถจริง และคงสีเดิมเมื่อสถานะเปลี่ยน/ถูกเลือก มี silhouette เดียวกันในรายการและผังสำรอง

ผังหลักเพิ่มความสูงและความกว้าง มีปุ่มขยายเต็มความกว้างเพื่อซ่อนรายการด้านข้างชั่วคราว กดอีกครั้งคืนขนาดและรายการเดิม มือถือคง panel รายละเอียดใต้ผังเพื่อไม่บังการเลือก

## ตรวจสอบ

`node --test tests/*.mjs`, `npm run lint -- --quiet`, `npm run build`

ทดสอบ UI: อ่าน fleet จริง, filter/search/select/link, ย้อนหลังและเลื่อนเวลา, สาธิตหลายคันออก/กลับ, เข้า analytics เดิม และมือถือ โดยไม่สร้างธุรกรรมรถจริงระหว่าง QA
## Map-only infographic redesign

The campus is an orthographic 2.5D diagram with white blocks, simple pastel
windows, sparse sphere trees, off-white ground and light-gray roads. Thin teal
outlines delineate the compound, buildings and permanent parking slots. Basic
materials with explicit pastel face colors replace realistic campus shading;
tone mapping on campus objects and shadow maps are disabled.
Camera-space bounds fit the whole compound at the default view on desktop and
mobile, while zoom/pan keep the isometric angle fixed. Small neutral HTML labels
are projected in the existing React-owned layer (not additional Drei roots).

Vehicle geometry and classification/paint palettes are unchanged, as are the
movement controller, QR-only dashboard actions and all fleet data logic. The
example's 25-space limit does not hide the actual fleet: A10/B8/C7 remain, and
extra registered cars retain their permanent D slots. Counts use actual records.
No textures, location API, telemetry or additional data reads are introduced.
