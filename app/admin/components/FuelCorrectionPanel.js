'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { supabase } from '@/lib/supabaseClient'

const THAI_DATE = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const REASON_PRESETS = [
  'พนักงานกรอกจำนวนลิตรผิด',
  'พนักงานกรอกค่าใช้จ่ายผิด',
  'แก้ไขตามใบเสร็จจริง',
]

const numberValue = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const liters = value => `${numberValue(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ลิตร`
const baht = value => `${numberValue(value).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`
const getCar = trip => Array.isArray(trip?.cars) ? trip.cars[0] : trip?.cars
const isEV = trip => String(getCar(trip)?.fuel_type || '').trim().toUpperCase() === 'EV'

function FuelValue({ icon, label, value, tone = 'purple' }) {
  const toneClass = tone === 'orange'
    ? 'border-[#f4d7a4] bg-[#fff9ed] text-[#b96a00]'
    : 'border-[#ddcce2] bg-[#faf6fb] text-[#702082]'

  return (
    <div className={`rounded-[15px] border p-3.5 ${toneClass}`}>
      <p className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.1em] opacity-70"><Icon icon={icon} width="14" height="14" />{label}</p>
      <p className="mt-1.5 text-[18px] font-black tracking-[-.35px]">{value}</p>
    </div>
  )
}

export default function FuelCorrectionPanel() {
  const [logs, setLogs] = useState([])
  const [corrections, setCorrections] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modal, setModal] = useState(null)
  const [fuelLiters, setFuelLiters] = useState('')
  const [fuelCost, setFuelCost] = useState('')
  const [reason, setReason] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const [logsResult, correctionsResult] = await Promise.all([
      supabase
        .from('trip_logs')
        .select('id, created_at, car_id, driver_name, start_time, end_time, fuel_liters, fuel_cost, is_completed, cars(id, plate_number, model, fuel_type)')
        .eq('is_completed', true)
        .order('end_time', { ascending: false })
        .limit(500),
      supabase
        .from('fuel_corrections')
        .select('id, trip_log_id, old_fuel_liters, new_fuel_liters, old_fuel_cost, new_fuel_cost, reason, corrected_at')
        .order('corrected_at', { ascending: false })
        .limit(50),
    ])

    if (logsResult.error) {
      setError(`โหลดรายการเติมน้ำมันไม่สำเร็จ: ${logsResult.error.message}`)
      setLoading(false)
      return
    }

    if (correctionsResult.error) {
      setError(`โหลดประวัติการแก้ไขไม่สำเร็จ: ${correctionsResult.error.message}`)
      setLoading(false)
      return
    }

    setLogs((logsResult.data || []).filter(trip => !isEV(trip)))
    setCorrections(correctionsResult.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const logsById = useMemo(() => new Map(logs.map(trip => [String(trip.id), trip])), [logs])

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('th-TH')
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    return logs.filter(trip => {
      const car = getCar(trip)
      const time = new Date(trip.end_time || trip.start_time || trip.created_at).getTime()
      const hasFuel = numberValue(trip.fuel_liters) > 0 || numberValue(trip.fuel_cost) > 0
      const matchesSearch = !query || [car?.plate_number, car?.model, trip.driver_name, trip.id]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase('th-TH').includes(query))
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'filled' && hasFuel)
        || (statusFilter === 'empty' && !hasFuel)

      return matchesSearch
        && matchesStatus
        && (from === null || time >= from)
        && (to === null || time <= to)
    })
  }, [logs, search, statusFilter, dateFrom, dateTo])

  const openCorrection = trip => {
    setModal(trip)
    setFuelLiters(String(numberValue(trip.fuel_liters)))
    setFuelCost(String(numberValue(trip.fuel_cost)))
    setReason('')
    setError('')
    setSuccess('')
  }

  const closeModal = () => {
    if (saving) return
    setModal(null)
    setFuelLiters('')
    setFuelCost('')
    setReason('')
  }

  const parsedLiters = fuelLiters === '' ? Number.NaN : Number(fuelLiters)
  const parsedCost = fuelCost === '' ? Number.NaN : Number(fuelCost)

  const validationMessage = useMemo(() => {
    if (!modal) return ''
    if (!Number.isFinite(parsedLiters) || parsedLiters < 0) return 'กรุณากรอกจำนวนลิตรเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'
    if (!Number.isFinite(parsedCost) || parsedCost < 0) return 'กรุณากรอกค่าใช้จ่ายเป็นตัวเลขตั้งแต่ 0 ขึ้นไป'
    if (parsedLiters === numberValue(modal.fuel_liters) && parsedCost === numberValue(modal.fuel_cost)) return 'ข้อมูลใหม่ยังเท่ากับข้อมูลเดิม'
    if (reason.trim().length < 3) return 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร'
    return ''
  }, [modal, parsedLiters, parsedCost, reason])

  const submitCorrection = async event => {
    event.preventDefault()
    if (!modal || validationMessage) return

    setSaving(true)
    setError('')
    const { error: rpcError } = await supabase.rpc('admin_correct_trip_fuel', {
      p_trip_log_id: modal.id,
      p_fuel_liters: parsedLiters,
      p_fuel_cost: parsedCost,
      p_reason: reason.trim(),
    })

    if (rpcError) {
      setError(`แก้ไขข้อมูลเติมน้ำมันไม่สำเร็จ: ${rpcError.message}`)
      setSaving(false)
      return
    }

    setSuccess('แก้ไขข้อมูลเติมน้ำมันสำเร็จ และบันทึกประวัติเรียบร้อยแล้ว')
    setModal(null)
    setSaving(false)
    await loadData()
  }

  if (loading) {
    return (
      <div className="rounded-[22px] border border-[#eadfed] bg-white p-10 text-center shadow-[0_12px_36px_rgba(75,21,96,.07)]">
        <Icon icon="ph:spinner-gap-bold" width="30" height="30" className="mx-auto animate-spin text-[#702082]" />
        <p className="mt-3 text-[13px] font-semibold text-[#765c7c]">กำลังโหลดข้อมูลเติมน้ำมัน...</p>
      </div>
    )
  }

  return (
    <>
      {modal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && closeModal()}>
          <form onSubmit={submitCorrection} className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-[24px] border border-[#eadfed] bg-white p-6 shadow-[0_28px_80px_rgba(54,15,65,.28)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#d57a00]">Fuel correction</p>
                <h2 className="mt-1 text-[20px] font-bold text-[#4b1560]">แก้ไขข้อมูลเติมน้ำมัน</h2>
                <p className="mt-1 text-[12px] text-[#765c7c]">{getCar(modal)?.plate_number || `รายการ #${modal.id}`} · {THAI_DATE.format(new Date(modal.end_time || modal.start_time || modal.created_at))}</p>
              </div>
              <button type="button" onClick={closeModal} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3edf5] text-[#765c7c]" aria-label="ปิด"><Icon icon="ph:x-bold" width="17" height="17" /></button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <FuelValue icon="ph:gas-pump-duotone" label="เดิม" value={liters(modal.fuel_liters)} />
              <FuelValue icon="ph:coins-duotone" label="เดิม" value={baht(modal.fuel_cost)} tone="orange" />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-bold text-[#702082]">จำนวนลิตรใหม่</label>
                <div className="relative mt-2"><input type="number" inputMode="decimal" min="0" step="0.01" autoFocus required value={fuelLiters} onChange={event => setFuelLiters(event.target.value)} className="w-full rounded-[14px] border border-[#dac8df] bg-white px-4 py-3.5 pr-14 text-[18px] font-bold text-[#35133f] outline-none focus:border-[#702082] focus:ring-2 focus:ring-[#702082]/10" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#9a83a0]">ลิตร</span></div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#702082]">ค่าใช้จ่ายใหม่</label>
                <div className="relative mt-2"><input type="number" inputMode="decimal" min="0" step="0.01" required value={fuelCost} onChange={event => setFuelCost(event.target.value)} className="w-full rounded-[14px] border border-[#dac8df] bg-white px-4 py-3.5 pr-14 text-[18px] font-bold text-[#35133f] outline-none focus:border-[#702082] focus:ring-2 focus:ring-[#702082]/10" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[#9a83a0]">บาท</span></div>
              </div>
            </div>

            <label className="mt-5 block text-[11px] font-bold text-[#702082]">เหตุผลที่แก้ *</label>
            <textarea required rows="3" value={reason} onChange={event => setReason(event.target.value)} placeholder="เช่น แก้ไขตามยอดในใบเสร็จ" className="mt-2 w-full resize-none rounded-[14px] border border-[#dac8df] bg-white px-4 py-3 text-[16px] text-[#35133f] outline-none focus:border-[#702082] focus:ring-2 focus:ring-[#702082]/10" />
            <div className="mt-2 flex flex-wrap gap-2">
              {REASON_PRESETS.map(preset => <button key={preset} type="button" onClick={() => setReason(preset)} className="rounded-full border border-[#dfcfe4] bg-[#f8f3fa] px-3 py-1.5 text-[10px] font-semibold text-[#702082]">{preset}</button>)}
            </div>

            {error && <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-[#fff0ef] px-3 py-2.5 text-[11px] font-semibold text-[#c83c35]"><Icon icon="ph:x-circle-fill" width="16" height="16" className="mt-0.5 shrink-0" />{error}</p>}
            {validationMessage && <p className="mt-4 flex items-center gap-2 rounded-[12px] bg-[#fff0ef] px-3 py-2.5 text-[11px] font-semibold text-[#c83c35]"><Icon icon="ph:warning-fill" width="16" height="16" />{validationMessage}</p>}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button type="button" onClick={closeModal} disabled={saving} className="rounded-[13px] border border-[#dac8df] bg-white px-4 py-3.5 text-[12px] font-bold text-[#765c7c] disabled:opacity-50">ยกเลิก</button>
              <button type="submit" disabled={saving || Boolean(validationMessage)} className="flex items-center justify-center gap-2 rounded-[13px] bg-[#702082] px-4 py-3.5 text-[12px] font-bold text-white shadow-[0_9px_22px_rgba(112,32,130,.2)] disabled:cursor-not-allowed disabled:opacity-45"><Icon icon={saving ? 'ph:spinner-gap-bold' : 'ph:floppy-disk-bold'} className={saving ? 'animate-spin' : ''} width="17" height="17" />{saving ? 'กำลังบันทึก...' : 'ยืนยันการแก้ไข'}</button>
            </div>
          </form>
        </div>
      )}

      <section className="space-y-4">
        {success && <p className="flex items-center gap-2 rounded-[14px] border border-[#bde7c8] bg-[#effaf2] px-4 py-3 text-[11px] font-bold text-[#248a3d]"><Icon icon="ph:check-circle-fill" width="18" height="18" />{success}</p>}
        {error && !modal && <p className="flex items-center gap-2 rounded-[14px] border border-[#f2c3bf] bg-[#fff1f0] px-4 py-3 text-[11px] font-bold text-[#c83c35]"><Icon icon="ph:x-circle-fill" width="18" height="18" />{error}</p>}

        <div className="rounded-[22px] border border-[#eadfed] bg-white p-5 shadow-[0_12px_36px_rgba(75,21,96,.07)] sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="min-w-0 flex-1">
              <label className="text-[10px] font-bold uppercase tracking-[.12em] text-[#846c89]">ค้นหารายการ</label>
              <div className="relative mt-2"><Icon icon="ph:magnifying-glass-bold" width="18" height="18" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9a83a0]" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ทะเบียนรถ รุ่น ผู้ขับ หรือเลขรายการ" className="h-12 w-full rounded-[13px] border border-[#dac8df] bg-[#fcfafd] pl-11 pr-4 text-[16px] text-[#35133f] outline-none focus:border-[#702082] focus:ring-2 focus:ring-[#702082]/10" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:w-[330px]">
              <div><label className="text-[10px] font-bold text-[#846c89]">ตั้งแต่วันที่</label><input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} className="mt-2 h-12 w-full rounded-[13px] border border-[#dac8df] bg-white px-3 text-[12px] text-[#4b1560] outline-none" /></div>
              <div><label className="text-[10px] font-bold text-[#846c89]">ถึงวันที่</label><input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} className="mt-2 h-12 w-full rounded-[13px] border border-[#dac8df] bg-white px-3 text-[12px] text-[#4b1560] outline-none" /></div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {[['all', 'ทั้งหมด'], ['filled', 'มีการเติมน้ำมัน'], ['empty', 'ไม่ได้เติมน้ำมัน']].map(([value, label]) => <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`rounded-full border px-3 py-2 text-[10px] font-bold transition-all ${statusFilter === value ? 'border-[#702082] bg-[#702082] text-white' : 'border-[#dfcfe4] bg-white text-[#765c7c]'}`}>{label}</button>)}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredLogs.map(trip => {
            const car = getCar(trip)
            const hasFuel = numberValue(trip.fuel_liters) > 0 || numberValue(trip.fuel_cost) > 0
            return (
              <article key={trip.id} className="rounded-[22px] border border-[#eadfed] bg-white p-5 shadow-[0_10px_30px_rgba(75,21,96,.06)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-[17px] font-bold text-[#4b1560]">{car?.plate_number || `รถ #${trip.car_id}`}</h3><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${hasFuel ? 'bg-[#fff1d8] text-[#a85f00]' : 'bg-[#f1f3f5] text-[#737b7f]'}`}>{hasFuel ? 'มีข้อมูลน้ำมัน' : 'ไม่ได้เติมน้ำมัน'}</span></div><p className="mt-1 text-[11px] text-[#846c89]">{THAI_DATE.format(new Date(trip.end_time || trip.start_time || trip.created_at))} · {trip.driver_name || 'ไม่ระบุผู้ขับ'}</p></div>
                  <span className="shrink-0 rounded-[9px] bg-[#f5edf7] px-2 py-1 text-[9px] font-bold text-[#846c89]">#{trip.id}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3"><FuelValue icon="ph:gas-pump-duotone" label="ปริมาณน้ำมัน" value={liters(trip.fuel_liters)} /><FuelValue icon="ph:coins-duotone" label="ค่าใช้จ่าย" value={baht(trip.fuel_cost)} tone="orange" /></div>
                <button type="button" onClick={() => openCorrection(trip)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[12px] border border-[#ddcce2] bg-[#faf6fb] px-4 py-3 text-[11px] font-bold text-[#702082] transition-all hover:border-[#702082] hover:bg-[#f7eef9] active:scale-[.99]"><Icon icon="ph:pencil-simple-bold" width="17" height="17" />แก้ไขข้อมูลเติมน้ำมัน</button>
              </article>
            )
          })}
        </div>

        {filteredLogs.length === 0 && <div className="rounded-[22px] border border-dashed border-[#d9c8de] bg-white p-10 text-center"><Icon icon="ph:gas-pump-duotone" width="36" height="36" className="mx-auto text-[#b29bb8]" /><p className="mt-3 text-[13px] font-bold text-[#765c7c]">ไม่พบรายการตามเงื่อนไขที่เลือก</p></div>}

        <div className="overflow-hidden rounded-[22px] border border-[#eadfed] bg-white shadow-[0_12px_36px_rgba(75,21,96,.07)]">
          <div className="border-b border-[#eadfed] px-5 py-4 sm:px-6"><h2 className="flex items-center gap-2 text-[14px] font-bold text-[#4b1560]"><Icon icon="ph:clock-counter-clockwise-duotone" width="20" height="20" />ประวัติการแก้ไขน้ำมันล่าสุด</h2><p className="mt-1 text-[10px] text-[#846c89]">เก็บค่าเดิม ค่าใหม่ เหตุผล และเวลาที่แก้ไขเพื่อการตรวจสอบ</p></div>
          <div className="divide-y divide-[#eee4f0]">
            {corrections.map(item => {
              const trip = logsById.get(String(item.trip_log_id))
              return <div key={item.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:px-6"><div><p className="text-[12px] font-bold text-[#4b1560]">{getCar(trip)?.plate_number || `รายการ #${item.trip_log_id}`}</p><p className="mt-1 text-[11px] leading-5 text-[#765c7c]">น้ำมัน {liters(item.old_fuel_liters)} → <strong className="text-[#702082]">{liters(item.new_fuel_liters)}</strong><br className="sm:hidden" /> · ค่าใช้จ่าย {baht(item.old_fuel_cost)} → <strong className="text-[#d57a00]">{baht(item.new_fuel_cost)}</strong> · {item.reason}</p></div><p className="text-[10px] text-[#9a83a0] sm:text-right">{THAI_DATE.format(new Date(item.corrected_at))}</p></div>
            })}
            {corrections.length === 0 && <p className="px-6 py-8 text-center text-[12px] text-[#9a83a0]">ยังไม่มีประวัติการแก้ไขข้อมูลน้ำมัน</p>}
          </div>
        </div>
      </section>
    </>
  )
}
