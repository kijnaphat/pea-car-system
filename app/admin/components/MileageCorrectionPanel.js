'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Icon } from '@iconify/react'
import { supabase } from '@/lib/supabaseClient'

const THAI_DATE = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const REASON_PRESETS = [
  'พนักงานกรอกตัวเลขเกินหรือขาด',
  'อ่านเลขจากหน้าปัดคลาดเคลื่อน',
  'แก้ตามหลักฐานเลขไมล์จริง',
]

const mileage = value => value === null || value === undefined
  ? '—'
  : Number(value).toLocaleString('th-TH')

const tripTime = trip => new Date(trip.start_time || trip.created_at).getTime()

const getCar = trip => Array.isArray(trip.cars) ? trip.cars[0] : trip.cars

function buildTripSequence(logs) {
  const byCar = new Map()

  logs.forEach(log => {
    const carLogs = byCar.get(log.car_id) || []
    carLogs.push(log)
    byCar.set(log.car_id, carLogs)
  })

  const decorated = new Map()
  byCar.forEach(carLogs => {
    carLogs.sort((a, b) => tripTime(a) - tripTime(b) || Number(a.id) - Number(b.id))
    carLogs.forEach((trip, index) => {
      decorated.set(trip.id, {
        ...trip,
        previousTrip: carLogs[index - 1] || null,
        nextTrip: carLogs[index + 1] || null,
      })
    })
  })

  return logs
    .map(log => decorated.get(log.id))
    .sort((a, b) => tripTime(b) - tripTime(a) || Number(b.id) - Number(a.id))
}

function getTripIssues(trip) {
  const issues = []
  const start = trip.start_mileage
  const end = trip.end_mileage
  const previousEnd = trip.previousTrip?.end_mileage

  if (start !== null && end !== null && end < start) {
    issues.push('เลขไมล์คืนต่ำกว่าเลขไมล์ออก')
  }
  if (start !== null && end !== null && end - start > 1000) {
    issues.push('ระยะทางมากกว่า 1,000 กม.')
  }
  if (previousEnd !== null && previousEnd !== undefined && start !== null && previousEnd !== start) {
    issues.push(`ไม่ต่อจากเที่ยวก่อน (${mileage(previousEnd)} กม.)`)
  }

  return issues
}

function MileageBox({ label, value, tone, onEdit, disabled }) {
  return (
    <div className={`rounded-[16px] border p-4 ${tone === 'green' ? 'border-[#bfe8cb] bg-[#f2fbf5]' : 'border-[#ddcce2] bg-[#faf6fb]'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#846c89]">{label}</p>
          <p className="mt-1 text-[22px] font-bold text-[#4b1560]">{mileage(value)} <span className="text-[11px] font-medium text-[#846c89]">กม.</span></p>
        </div>
        {!disabled && (
          <button
            type="button"
            onClick={onEdit}
            className="flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#dac8df] bg-white text-[#702082] shadow-sm transition-all hover:border-[#702082] hover:bg-[#f7eef9] active:scale-95"
            aria-label={`แก้ไข${label}`}
            title={`แก้ไข${label}`}
          >
            <Icon icon="ph:pencil-simple-bold" width="18" height="18" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function MileageCorrectionPanel() {
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
  const [newValue, setNewValue] = useState('')
  const [reason, setReason] = useState('')
  const [syncAdjacent, setSyncAdjacent] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    const [logsResult, correctionsResult] = await Promise.all([
      supabase
        .from('trip_logs')
        .select('id, created_at, car_id, driver_name, start_time, end_time, start_mileage, end_mileage, is_completed, cars(id, plate_number, model, fuel_type)')
        .not('start_mileage', 'is', null)
        .order('start_time', { ascending: false })
        .limit(500),
      supabase
        .from('mileage_corrections')
        .select('id, batch_id, trip_log_id, field_name, old_value, new_value, reason, corrected_at')
        .order('corrected_at', { ascending: false })
        .limit(50),
    ])

    if (logsResult.error) {
      setError(`โหลดรายการเดินทางไม่สำเร็จ: ${logsResult.error.message}`)
      setLoading(false)
      return
    }

    if (correctionsResult.error) {
      setError(`โหลดประวัติการแก้ไขไม่สำเร็จ: ${correctionsResult.error.message}`)
      setLoading(false)
      return
    }

    setLogs(logsResult.data || [])
    setCorrections(correctionsResult.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  const sequencedLogs = useMemo(() => buildTripSequence(logs), [logs])
  const logsById = useMemo(() => new Map(sequencedLogs.map(trip => [String(trip.id), trip])), [sequencedLogs])

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('th-TH')
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null

    return sequencedLogs.filter(trip => {
      const car = getCar(trip)
      const issues = getTripIssues(trip)
      const time = tripTime(trip)
      const matchesSearch = !query || [car?.plate_number, car?.model, trip.driver_name, trip.id]
        .filter(Boolean)
        .some(value => String(value).toLocaleLowerCase('th-TH').includes(query))
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'issues' && issues.length > 0)
        || (statusFilter === 'active' && !trip.is_completed)
        || (statusFilter === 'completed' && trip.is_completed)

      return matchesSearch
        && matchesStatus
        && (from === null || time >= from)
        && (to === null || time <= to)
    })
  }, [sequencedLogs, search, statusFilter, dateFrom, dateTo])

  const openCorrection = (trip, fieldName) => {
    const oldValue = trip[fieldName]
    const adjacent = fieldName === 'start_mileage' ? trip.previousTrip : trip.nextTrip
    const adjacentValue = fieldName === 'start_mileage' ? adjacent?.end_mileage : adjacent?.start_mileage
    const canSync = Boolean(adjacent && adjacentValue === oldValue)

    setModal({ trip, fieldName, oldValue, adjacent, canSync })
    setNewValue(String(oldValue))
    setReason('')
    setSyncAdjacent(canSync)
    setError('')
    setSuccess('')
  }

  const closeModal = () => {
    if (saving) return
    setModal(null)
    setNewValue('')
    setReason('')
    setSyncAdjacent(false)
  }

  const parsedNewValue = newValue === '' ? null : Number(newValue)
  const previewStart = modal?.fieldName === 'start_mileage' ? parsedNewValue : modal?.trip.start_mileage
  const previewEnd = modal?.fieldName === 'end_mileage' ? parsedNewValue : modal?.trip.end_mileage
  const previewDistance = previewStart !== null && previewEnd !== null ? previewEnd - previewStart : null

  const validationMessage = useMemo(() => {
    if (!modal) return ''
    if (!Number.isInteger(parsedNewValue) || parsedNewValue < 0) return 'กรุณากรอกเลขไมล์เป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป'
    if (parsedNewValue === modal.oldValue) return 'เลขไมล์ใหม่ยังเท่ากับค่าเดิม'
    if (previewStart !== null && previewEnd !== null && previewEnd < previewStart) return 'เลขไมล์คืนต้องไม่น้อยกว่าเลขไมล์ออก'
    if (syncAdjacent && modal.canSync && modal.fieldName === 'start_mileage') {
      const adjacentStart = modal.adjacent?.start_mileage
      if (adjacentStart !== null && adjacentStart !== undefined && parsedNewValue < adjacentStart) {
        return 'เลขใหม่ต่ำกว่าเลขไมล์ออกของเที่ยวก่อนหน้า'
      }
    }
    if (syncAdjacent && modal.canSync && modal.fieldName === 'end_mileage') {
      const adjacentEnd = modal.adjacent?.end_mileage
      if (adjacentEnd !== null && adjacentEnd !== undefined && parsedNewValue > adjacentEnd) {
        return 'เลขใหม่สูงกว่าเลขไมล์คืนของเที่ยวถัดไป'
      }
    }
    if (reason.trim().length < 3) return 'กรุณาระบุเหตุผลอย่างน้อย 3 ตัวอักษร'
    return ''
  }, [modal, parsedNewValue, previewStart, previewEnd, reason, syncAdjacent])

  const submitCorrection = async event => {
    event.preventDefault()
    if (!modal || validationMessage) return

    setSaving(true)
    setError('')
    const { data, error: rpcError } = await supabase.rpc('admin_correct_trip_mileage', {
      p_trip_log_id: modal.trip.id,
      p_field_name: modal.fieldName,
      p_new_value: parsedNewValue,
      p_reason: reason.trim(),
      p_sync_adjacent: syncAdjacent && modal.canSync,
    })

    if (rpcError) {
      setError(`แก้ไขเลขไมล์ไม่สำเร็จ: ${rpcError.message}`)
      setSaving(false)
      return
    }

    const syncedText = data?.synced_trip_log_id ? ' และปรับเที่ยวที่เชื่อมต่อให้แล้ว' : ''
    setSuccess(`แก้ไขเลขไมล์สำเร็จ${syncedText}`)
    setModal(null)
    setSaving(false)
    await loadData()
  }

  if (loading) {
    return (
      <div className="rounded-[22px] border border-[#eadfed] bg-white p-10 text-center shadow-[0_12px_36px_rgba(75,21,96,.07)]">
        <Icon icon="ph:spinner-gap-bold" width="30" height="30" className="mx-auto animate-spin text-[#702082]" />
        <p className="mt-3 text-[13px] font-semibold text-[#765c7c]">กำลังโหลดประวัติเลขไมล์...</p>
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
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8e3ba0]">Mileage correction</p>
                <h2 className="mt-1 text-[20px] font-bold text-[#4b1560]">แก้เลขไมล์{modal.fieldName === 'start_mileage' ? 'ตอนนำรถออก' : 'ตอนคืนรถ'}</h2>
                <p className="mt-1 text-[12px] text-[#765c7c]">{getCar(modal.trip)?.plate_number || `รายการ #${modal.trip.id}`} · {THAI_DATE.format(new Date(modal.trip.start_time || modal.trip.created_at))}</p>
              </div>
              <button type="button" onClick={closeModal} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f3edf5] text-[#765c7c]" aria-label="ปิด"><Icon icon="ph:x-bold" width="17" height="17" /></button>
            </div>

            <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[16px] border border-[#eadfed] bg-[#faf7fb] p-4 text-center">
              <div><p className="text-[10px] font-bold text-[#846c89]">ค่าเดิม</p><p className="mt-1 text-[21px] font-bold text-[#9a7ca0]">{mileage(modal.oldValue)}</p></div>
              <Icon icon="ph:arrow-right-bold" className="text-[#c4aeca]" width="19" height="19" />
              <div><p className="text-[10px] font-bold text-[#702082]">ค่าใหม่</p><p className="mt-1 text-[21px] font-bold text-[#4b1560]">{mileage(parsedNewValue)}</p></div>
            </div>

            <label className="mt-5 block text-[11px] font-bold text-[#702082]">เลขไมล์ใหม่ (กม.)</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              autoFocus
              required
              value={newValue}
              onChange={event => setNewValue(event.target.value)}
              className="mt-2 w-full rounded-[14px] border border-[#dac8df] bg-white px-4 py-4 text-[22px] font-bold text-[#35133f] outline-none focus:border-[#702082] focus:ring-2 focus:ring-[#702082]/10"
            />

            {previewDistance !== null && (
              <div className={`mt-3 flex items-center justify-between rounded-[12px] px-4 py-3 text-[12px] ${previewDistance < 0 || previewDistance > 1000 ? 'bg-[#fff0ef] text-[#c83c35]' : 'bg-[#effaf2] text-[#248a3d]'}`}>
                <span className="font-semibold">ระยะทางหลังแก้</span>
                <strong className="text-[15px]">{mileage(previewDistance)} กม.</strong>
              </div>
            )}

            {modal.canSync && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[14px] border border-[#eadb91] bg-[#fffbea] p-4">
                <input type="checkbox" checked={syncAdjacent} onChange={event => setSyncAdjacent(event.target.checked)} className="mt-0.5 h-4 w-4 accent-[#702082]" />
                <span>
                  <span className="block text-[12px] font-bold text-[#4b1560]">ปรับเลขไมล์{modal.fieldName === 'start_mileage' ? 'คืนของเที่ยวก่อนหน้า' : 'ออกของเที่ยวถัดไป'}ให้ตรงกัน</span>
                  <span className="mt-1 block text-[11px] leading-5 text-[#765c7c]">พบว่ารายการที่เชื่อมต่อใช้ค่าเดิม {mileage(modal.oldValue)} กม. ระบบจะบันทึกทั้งสองจุดพร้อมประวัติในครั้งเดียว</span>
                </span>
              </label>
            )}

            <label className="mt-5 block text-[11px] font-bold text-[#702082]">เหตุผลที่แก้ *</label>
            <textarea
              required
              rows="3"
              value={reason}
              onChange={event => setReason(event.target.value)}
              placeholder="เช่น พนักงานกรอกเลขเกินหนึ่งหลัก"
              className="mt-2 w-full resize-none rounded-[14px] border border-[#dac8df] bg-white px-4 py-3 text-[14px] text-[#35133f] outline-none focus:border-[#702082] focus:ring-2 focus:ring-[#702082]/10"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              {REASON_PRESETS.map(preset => <button key={preset} type="button" onClick={() => setReason(preset)} className="rounded-full border border-[#dfcfe4] bg-[#f8f3fa] px-3 py-1.5 text-[10px] font-semibold text-[#702082]">{preset}</button>)}
            </div>

            {error && <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-[#fff0ef] px-3 py-2.5 text-[11px] font-semibold text-[#c83c35]"><Icon icon="ph:x-circle-fill" width="16" height="16" className="mt-0.5 shrink-0" />{error}</p>}
            {validationMessage && <p className="mt-4 flex items-center gap-2 rounded-[12px] bg-[#fff0ef] px-3 py-2.5 text-[11px] font-semibold text-[#c83c35]"><Icon icon="ph:warning-circle-fill" width="16" height="16" />{validationMessage}</p>}

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={closeModal} disabled={saving} className="flex-1 rounded-[13px] border border-[#dfcfe4] bg-white px-4 py-3.5 text-[13px] font-bold text-[#765c7c] disabled:opacity-50">ยกเลิก</button>
              <button type="submit" disabled={saving || Boolean(validationMessage)} className="flex flex-1 items-center justify-center gap-2 rounded-[13px] bg-[#ffdd00] px-4 py-3.5 text-[13px] font-bold text-[#3b1746] disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <><Icon icon="ph:spinner-gap-bold" className="animate-spin" width="17" height="17" />กำลังบันทึก</> : <><Icon icon="ph:check-bold" width="17" height="17" />ยืนยันการแก้ไข</>}
              </button>
            </div>
          </form>
        </div>
      )}

      <section className="space-y-6">
        <div className="rounded-[22px] border border-[#eadfed] bg-white p-5 shadow-[0_12px_36px_rgba(75,21,96,.07)] sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex items-center gap-2"><Icon icon="ph:speedometer-duotone" width="24" height="24" className="text-[#702082]" /><h2 className="text-[17px] font-bold text-[#4b1560]">ค้นหารายการที่ต้องแก้</h2></div>
              <p className="mt-1 text-[11px] text-[#846c89]">แก้ได้เฉพาะเลขไมล์ออกและเลขไมล์คืน พร้อมบันทึกประวัติทุกครั้ง</p>
            </div>
            <button type="button" onClick={loadData} className="flex h-10 items-center justify-center gap-2 rounded-[12px] border border-[#dfcfe4] bg-[#f8f3fa] px-4 text-[11px] font-bold text-[#702082]"><Icon icon="ph:arrows-clockwise-bold" width="16" height="16" />รีเฟรชข้อมูล</button>
          </div>

          {error && <div className="mt-4 flex items-start gap-2 rounded-[13px] border border-[#ffd1ce] bg-[#fff0ef] p-3 text-[12px] font-semibold text-[#c83c35]"><Icon icon="ph:x-circle-fill" width="18" height="18" className="shrink-0" />{error}</div>}
          {success && <div className="mt-4 flex items-start gap-2 rounded-[13px] border border-[#bee8ca] bg-[#effaf2] p-3 text-[12px] font-semibold text-[#248a3d]"><Icon icon="ph:check-circle-fill" width="18" height="18" className="shrink-0" />{success}</div>}

          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(240px,1fr)_160px_160px]">
            <label className="relative">
              <Icon icon="ph:magnifying-glass" width="18" height="18" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9e86a4]" />
              <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหาทะเบียนรถ ชื่อผู้ขับ หรือเลขรายการ" className="h-12 w-full rounded-[13px] border border-[#dfcfe4] bg-white pl-11 pr-4 text-[13px] text-[#35133f] outline-none focus:border-[#702082]" />
            </label>
            <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} aria-label="วันที่เริ่มต้น" className="h-12 rounded-[13px] border border-[#dfcfe4] bg-white px-3 text-[12px] text-[#4b1560] outline-none focus:border-[#702082]" />
            <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} aria-label="วันที่สิ้นสุด" className="h-12 rounded-[13px] border border-[#dfcfe4] bg-white px-3 text-[12px] text-[#4b1560] outline-none focus:border-[#702082]" />
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {[
              ['all', 'ทั้งหมด'],
              ['issues', 'เฉพาะผิดปกติ'],
              ['active', 'กำลังใช้งาน'],
              ['completed', 'คืนรถแล้ว'],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`shrink-0 rounded-full border px-3.5 py-2 text-[11px] font-bold transition-all ${statusFilter === value ? 'border-[#702082] bg-[#702082] text-white' : 'border-[#dfcfe4] bg-white text-[#765c7c]'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredLogs.map(trip => {
            const car = getCar(trip)
            const issues = getTripIssues(trip)
            const distance = trip.start_mileage !== null && trip.end_mileage !== null ? trip.end_mileage - trip.start_mileage : null
            return (
              <article key={trip.id} className={`rounded-[22px] border bg-white p-5 shadow-[0_10px_30px_rgba(75,21,96,.06)] ${issues.length ? 'border-[#f1c2bd]' : 'border-[#eadfed]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[17px] font-bold text-[#4b1560]">{car?.plate_number || `รถ #${trip.car_id}`}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${trip.is_completed ? 'bg-[#eaf8ee] text-[#248a3d]' : 'bg-[#fff5cc] text-[#8b6800]'}`}>{trip.is_completed ? 'คืนรถแล้ว' : 'กำลังใช้งาน'}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#846c89]">{THAI_DATE.format(new Date(trip.start_time || trip.created_at))} · {trip.driver_name || 'ไม่ระบุผู้ขับ'}</p>
                  </div>
                  <span className="shrink-0 rounded-[9px] bg-[#f5edf7] px-2 py-1 text-[9px] font-bold text-[#846c89]">#{trip.id}</span>
                </div>

                {issues.length > 0 && <div className="mt-4 space-y-1 rounded-[13px] border border-[#ffd1ce] bg-[#fff3f2] p-3">{issues.map(issue => <p key={issue} className="flex items-center gap-2 text-[10px] font-semibold text-[#c83c35]"><Icon icon="ph:warning-fill" width="14" height="14" />{issue}</p>)}</div>}

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <MileageBox label="ตอนนำรถออก" value={trip.start_mileage} onEdit={() => openCorrection(trip, 'start_mileage')} />
                  <MileageBox label="ตอนคืนรถ" value={trip.end_mileage} tone="green" disabled={trip.end_mileage === null} onEdit={() => openCorrection(trip, 'end_mileage')} />
                </div>

                <div className="mt-3 grid grid-cols-3 divide-x divide-[#eadfed] rounded-[13px] border border-[#eadfed] bg-[#faf7fb] px-2 py-3 text-center">
                  <div className="px-2"><p className="text-[9px] font-bold text-[#9a83a0]">เที่ยวก่อน</p><p className="mt-1 text-[11px] font-bold text-[#5a3b62]">{mileage(trip.previousTrip?.end_mileage)} กม.</p></div>
                  <div className="px-2"><p className="text-[9px] font-bold text-[#9a83a0]">ระยะทาง</p><p className="mt-1 text-[11px] font-bold text-[#702082]">{mileage(distance)} กม.</p></div>
                  <div className="px-2"><p className="text-[9px] font-bold text-[#9a83a0]">เที่ยวถัดไป</p><p className="mt-1 text-[11px] font-bold text-[#5a3b62]">{mileage(trip.nextTrip?.start_mileage)} กม.</p></div>
                </div>
              </article>
            )
          })}
        </div>

        {filteredLogs.length === 0 && <div className="rounded-[22px] border border-dashed border-[#d9c8de] bg-white p-10 text-center"><Icon icon="ph:magnifying-glass-duotone" width="36" height="36" className="mx-auto text-[#b29bb8]" /><p className="mt-3 text-[13px] font-bold text-[#765c7c]">ไม่พบรายการตามเงื่อนไขที่เลือก</p></div>}

        <div className="overflow-hidden rounded-[22px] border border-[#eadfed] bg-white shadow-[0_12px_36px_rgba(75,21,96,.07)]">
          <div className="border-b border-[#eadfed] px-5 py-4 sm:px-6"><h2 className="flex items-center gap-2 text-[14px] font-bold text-[#4b1560]"><Icon icon="ph:clock-counter-clockwise-duotone" width="20" height="20" />ประวัติการแก้ไขล่าสุด</h2><p className="mt-1 text-[10px] text-[#846c89]">ประวัตินี้ไม่สามารถลบหรือแก้ไขย้อนหลังได้</p></div>
          <div className="divide-y divide-[#eee4f0]">
            {corrections.map(item => {
              const trip = logsById.get(String(item.trip_log_id))
              return (
                <div key={item.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:px-6">
                  <div>
                    <p className="text-[12px] font-bold text-[#4b1560]">{getCar(trip || {})?.plate_number || `รายการ #${item.trip_log_id}`} · {item.field_name === 'start_mileage' ? 'เลขไมล์ตอนนำรถออก' : 'เลขไมล์ตอนคืนรถ'}</p>
                    <p className="mt-1 text-[11px] text-[#765c7c]">{mileage(item.old_value)} → <strong className="text-[#702082]">{mileage(item.new_value)} กม.</strong> · {item.reason}</p>
                  </div>
                  <p className="text-[10px] text-[#9a83a0] sm:text-right">{THAI_DATE.format(new Date(item.corrected_at))}</p>
                </div>
              )
            })}
            {corrections.length === 0 && <p className="px-6 py-8 text-center text-[12px] text-[#9a83a0]">ยังไม่มีประวัติการแก้ไขเลขไมล์</p>}
          </div>
        </div>
      </section>
    </>
  )
}
