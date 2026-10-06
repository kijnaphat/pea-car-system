'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { normalizeStaffCode } from '@/lib/staffCode'

const stations = [
  ['PEA', 'สำนักงานใหญ่ (สนญ.)', false], ['PEA', 'กฟก.', true],
  ['PEA', 'บางจาก', true], ['PEA', 'PEA Volta อื่น ๆ', true],
  ['OTHER', 'Wall Charge', false], ['OTHER', 'สถานีชาร์จ อื่น ๆ', true],
]

export default function InTripChargeForm({ carId, trip, onClose, onSaved }) {
  const [code, setCode] = useState('')
  const [mileage, setMileage] = useState('')
  const [before, setBefore] = useState('')
  const [after, setAfter] = useState('')
  const [station, setStation] = useState('')
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef(null)
  const option = station === '' ? null : stations[Number(station)]
  const inputClass = 'w-full mt-1 rounded-xl border border-[#eadfed] bg-[#f8f3fa] p-3 text-[#4b1560]'

  const save = async event => {
    event.preventDefault()
    if (saving) return
    setError('')
    if (!normalizeStaffCode(code)) return setError('กรุณายืนยันรหัสพนักงานผู้ขับคนเดิม')
    if (mileage === '' || !Number.isInteger(Number(mileage)) || Number(mileage) < Number(trip.start_mileage)) return setError('เลขไมล์ชาร์จต้องไม่น้อยกว่าเลขไมล์ออก')
    if (before === '' || after === '' || ![before, after].every(v => Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100) || Number(after) <= Number(before)) return setError('แบตเตอรี่ต้องอยู่ในช่วง 0–100% และหลังชาร์จต้องมากกว่าก่อนชาร์จ')
    if (!option || (option[2] && !name.trim())) return setError('กรุณาเลือกสถานีและระบุชื่อ/สาขา')
    requestId.current ||= crypto.randomUUID()
    setSaving(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('record_ev_charge_during_trip', {
        p_car_id: Number(carId), p_trip_log_id: trip.id, p_staff_code: normalizeStaffCode(code),
        p_mileage: Number(mileage), p_battery_before: Number(before), p_battery_after: Number(after),
        p_station_type: option[0], p_station_name: option[2] ? `${option[1]}: ${name.trim()}` : option[1],
        p_request_id: requestId.current,
      })
      if (rpcError || data?.error) throw new Error(data?.error || rpcError.message)
      if (!data?.success) throw new Error('ไม่พบผลยืนยันการบันทึก กรุณาลองอีกครั้ง')
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} aria-label="ชาร์จ EV ระหว่างภารกิจ" className="bg-white rounded-[20px] p-5 space-y-4 border-2 border-[#702082]">
      <div>
        <h2 className="font-bold text-lg text-[#4b1560]">ชาร์จระหว่างภารกิจ</h2>
        <p className="text-sm text-[#765c7c] mt-1">กรอกเมื่อชาร์จเสร็จ รถยังอยู่กับ {trip.driver_name} และภารกิจยังไม่จบ</p>
      </div>
      <label className="block text-sm">รหัสพนักงานผู้ขับคนเดิม<input required inputMode="numeric" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} className={inputClass} /></label>
      <label className="block text-sm">เลขไมล์ขณะชาร์จ<input required type="number" min={trip.start_mileage || 0} step="1" value={mileage} onChange={e => setMileage(e.target.value)} className={inputClass} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">แบตก่อนชาร์จ (%)<input required type="number" min="0" max="100" step="1" value={before} onChange={e => setBefore(e.target.value)} className={inputClass} /></label>
        <label className="block text-sm">แบตหลังชาร์จ (%)<input required type="number" min="0" max="100" step="1" value={after} onChange={e => setAfter(e.target.value)} className={inputClass} /></label>
      </div>
      <label className="block text-sm">สถานีชาร์จ<select required value={station} onChange={e => { setStation(e.target.value); setName('') }} className={inputClass}>
        <option value="">เลือกประเภทสถานี</option>
        {stations.map((item, index) => <option key={index} value={index}>{item[1]}</option>)}
      </select></label>
      {option?.[2] && <label className="block text-sm">ชื่อสถานี / สาขา<input required maxLength={400} value={name} onChange={e => setName(e.target.value)} className={inputClass} /></label>}
      <p className="text-xs text-[#765c7c]">บันทึกวันที่และเวลาปัจจุบัน · เข้ารายงานชาร์จ EV · ไม่คืนรถและไม่นับเป็นเที่ยวขับเพิ่ม</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="w-full rounded-xl bg-[#702082] py-4 font-bold text-white disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึกชาร์จเสร็จ · ไปต่อภารกิจ'}</button>
      <button type="button" disabled={saving} onClick={onClose} className="w-full py-2 text-sm text-[#765c7c]">ยกเลิก · กลับไปหน้าคืนรถ</button>
    </form>
  )
}
