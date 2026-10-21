'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, BookOpen, Check, FilePlus2, Filter, Inbox, Link2, LoaderCircle, LogOut, Pencil, Printer, RefreshCw, Search, ShieldCheck, UserRound, X } from 'lucide-react'
import { clearRepairLedgerIdentity, findRepairLedgerDuplicates, getRepairLedgerIdentity, linkRepairLedgerSource, loadRepairLedger, loadRepairLedgerUsageDates, saveRepairLedger, watchRepairLedgerIdentity } from '@/lib/repairLedgerData'
import {
  REPAIR_LEDGER_STATUSES, findPossibleLedgerDuplicates, isLedgerMonth, ledgerDateLabel, ledgerDraft, ledgerFilterRows,
  ledgerMoney, ledgerMoneyFromCents, ledgerMonthLabel, ledgerPayload, ledgerRowKey,
  ledgerSourceLabel, ledgerStatus, ledgerToday, ledgerTotals, ledgerValidateDraft,
} from '@/lib/repairLedger'
import RepairLedgerIdentity from './RepairLedgerIdentity'
import './repair-ledger.css'

const emptyRows = []
const columnHeaders = ['วันที่', 'ทะเบียนรถ', 'แผนก', 'ร้าน', 'เลขบิล', 'จำนวนเงิน (บาท)', 'รายการซ่อม', 'สถานะ', 'ลงเลขเอกสารบัญชี', 'วันที่จ่ายเงิน']

function StatusControl({ row, draft, saving, onChange, onSave }) {
  const current = draft ?? row.status ?? ''
  const dirty = current !== (row.status || '')
  return <div className="repair-ledger-status-control">
    <span className={`repair-ledger-print-status repair-ledger-state-${row.status || 'pending'}`}>{ledgerStatus(row.status).label}</span>
    <div className="repair-ledger-screen-only">
      <select aria-label={`สถานะงานซ่อม ${row.plate_number} ${ledgerDateLabel(row.repair_date)}`} value={current} disabled={saving} onChange={event => onChange(event.target.value)} className={`repair-ledger-state-${current || 'pending'}`}>
        {REPAIR_LEDGER_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
      </select>
      {dirty && <button className="repair-ledger-status-save" onClick={onSave} disabled={saving}>
        {saving ? <LoaderCircle size={14} className="repair-ledger-spin" /> : <Check size={14} />} {saving ? 'กำลังบันทึก' : 'บันทึกสถานะ'}
      </button>}
    </div>
  </div>
}

function Field({ label, name, errors, children, wide = false, optional = false }) {
  return <label className={`repair-ledger-field${wide ? ' repair-ledger-field-wide' : ''}`}>
    <span>{label}{!optional && <span className="repair-ledger-required"> *</span>}</span>
    {children}
    {errors[name] && <small id={`repair-ledger-error-${name}`} className="repair-ledger-field-error">{errors[name]}</small>}
  </label>
}

function RepairEditor({ row, cars, month, selectedCarId, identity, onClose, onSaved, onOpenExisting }) {
  const dialogRef = useRef(null)
  const initialCar = cars.find(car => String(car.id) === String(selectedCarId))
  const [draft, setDraft] = useState(() => ledgerDraft(row ? {
    ...row, client_request_id: row.client_request_id || crypto.randomUUID(),
    ...(!row.id ? { repair_date: ledgerToday(), usage_date: null } : {}),
  } : {
    source_type: 'manual', source_id: null, client_request_id: crypto.randomUUID(),
  }, { car: initialCar, month }))
  const [usageMonth, setUsageMonth] = useState(() => row?.usage_date?.slice(0, 7) || month)
  const [usageDates, setUsageDates] = useState([])
  const [usageLoading, setUsageLoading] = useState(false)
  const [usageError, setUsageError] = useState('')
  const [usageRefresh, setUsageRefresh] = useState(0)
  const [possibleDuplicates, setPossibleDuplicates] = useState([])
  const [duplicateApproval, setDuplicateApproval] = useState('')
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const alive = useRef(true)
  const dateSequence = useRef(0)
  const [initialDraft] = useState(() => JSON.stringify(draft))
  const dirty = JSON.stringify(draft) !== initialDraft
  const fromMaintenance = row?.source_type === 'maintenance'
  const hasMaintenanceSource = Boolean(row?.source_id || row?.maintenance_record_id)
  const update = (name, value) => {
    setDraft(previous => ({ ...previous, [name]: value }))
    setErrors(previous => ({ ...previous, [name]: undefined }))
    setSaveError('')
    setPossibleDuplicates([])
    setDuplicateApproval('')
  }

  useEffect(() => {
    alive.current = true
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      alive.current = false
      document.body.style.overflow = previousOverflow
      if (dialog.open) dialog.close()
    }
  }, [])

  useEffect(() => {
    const request = ++dateSequence.current
    Promise.resolve().then(async () => {
      if (request !== dateSequence.current) return
      setUsageDates([])
      setUsageError('')
      if (!identity || !draft.car_id || !isLedgerMonth(usageMonth)) { setUsageLoading(false); return }
      setUsageLoading(true)
      try {
        const dates = await loadRepairLedgerUsageDates({ carId: draft.car_id, month: usageMonth })
        if (request === dateSequence.current) setUsageDates(dates)
      } catch (error) {
        if (error?.code === '42501') clearRepairLedgerIdentity()
        if (request === dateSequence.current) setUsageError(error?.message || 'โหลดวันที่ใช้งานไม่สำเร็จ กรุณาลองใหม่')
      } finally {
        if (request === dateSequence.current) setUsageLoading(false)
      }
    })
    return () => { dateSequence.current += 1 }
  }, [draft.car_id, usageMonth, identity, usageRefresh])

  useEffect(() => {
    if (!dirty && !saving) return
    const beforeUnload = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, saving])

  const close = () => {
    if (savingRef.current) return
    if (!dirty || window.confirm('ข้อมูลที่แก้ไขยังไม่ได้บันทึก ต้องการปิดแบบฟอร์มและละทิ้งการแก้ไขหรือไม่?')) onClose()
  }

  const selectCar = value => {
    const car = cars.find(item => String(item.id) === value)
    setDraft(previous => ({
      ...previous, car_id: value, usage_date: '',
      ...(car ? {
        plate_number: car.plate_number || '',
        department: car.department_name || (typeof car.department === 'string' ? car.department : car.departments?.name) || '',
      } : { plate_number: '', department: '' }),
    }))
    setErrors({})
    setSaveError('')
    setPossibleDuplicates([])
    setDuplicateApproval('')
  }

  const selectUsageMonth = value => {
    setUsageMonth(value)
    update('usage_date', '')
  }

  const save = async event => {
    event.preventDefault()
    if (savingRef.current) return
    const invalid = ledgerValidateDraft(draft)
    if (usageLoading || usageError || !usageDates.some(date => date.usage_date === draft.usage_date)) {
      invalid.usage_date = usageLoading ? 'กรุณารอโหลดวันที่ใช้งานรถ' : usageError || 'กรุณาเลือกวันที่ที่รถคันนี้มีรายการใช้งานจริง'
    }
    setErrors(invalid)
    if (Object.keys(invalid).length) {
      dialogRef.current?.querySelector(`[name="${Object.keys(invalid)[0]}"]`)?.focus()
      return
    }
    savingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      // Search this vehicle across all months before confirming a new item:
      // an invoice may already be entered under another report month. The
      // server separately enforces idempotency, source uniqueness and dates.
      const candidates = await findRepairLedgerDuplicates(ledgerPayload(draft))
      if (!alive.current) return
      const duplicates = findPossibleLedgerDuplicates(draft, candidates)
      const fingerprint = JSON.stringify(ledgerPayload(draft))
      if (duplicates.length && duplicateApproval !== fingerprint) {
        setPossibleDuplicates(duplicates)
        setSaving(false)
        savingRef.current = false
        return
      }
      const saved = await saveRepairLedger(ledgerPayload(draft))
      if (!alive.current) return
      onSaved(saved)
    } catch (error) {
      if (error?.code === '42501') clearRepairLedgerIdentity()
      if (!alive.current) return
      setSaveError(error?.message || 'บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง')
      setSaving(false)
      savingRef.current = false
    }
  }
  const inputProps = name => ({
    name, value: draft[name] ?? '', onChange: event => update(name, event.target.value),
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `repair-ledger-error-${name}` : undefined,
    disabled: saving,
  })

  return <dialog ref={dialogRef} className="repair-ledger-dialog" aria-labelledby={identity ? 'repair-ledger-editor-title' : undefined} aria-label={!identity ? 'ยืนยันรหัสพนักงานอีกครั้ง' : undefined} onCancel={event => { event.preventDefault(); close() }}>
    {identity ? <form onSubmit={save} noValidate>
      <header className="repair-ledger-editor-header">
        <div><span className="repair-ledger-eyebrow">กรอกครั้งเดียว ใช้ในสมุดซ่อมและ ยพ.6</span><h2 id="repair-ledger-editor-title">{row?.id ? 'แก้ไขรายการซ่อม' : fromMaintenance ? 'นำข้อมูลแจ้งซ่อมมาเติม' : 'เพิ่มรายการซ่อม'}</h2></div>
        <button type="button" className="repair-ledger-icon-button" aria-label="ปิดแบบฟอร์ม" disabled={saving} onClick={close}><X size={21} /></button>
      </header>
      <div className="repair-ledger-editor-body">
        <p className="repair-ledger-editor-identity"><UserRound size={15} /> ผู้บันทึก: <strong>{identity.full_name}</strong></p>
        <p className="repair-ledger-editor-note"><ShieldCheck size={18} /> {fromMaintenance && !row?.id ? 'เติมรายละเอียดจากข้อมูลแจ้งซ่อมให้แล้ว กรุณาตรวจรายการซ่อมจริงและเลือกวันที่ลง ยพ.6 ก่อนบันทึก' : 'เลือกวันที่ใช้งานรถที่ต้องการลงค่าซ่อม ยพ.6 จะใช้รายการนี้โดยตรง ไม่ต้องกรอกซ้ำ และไม่เปลี่ยนสถานะรถอัตโนมัติ'}</p>
        {row?.id && !row.usage_date && <p className="repair-ledger-alert repair-ledger-alert-warning">รายการเดิมยังไม่ได้เลือกวันที่ลง ยพ.6 เลือกวันที่ใช้งานรถด้านล่างเพื่อเชื่อมรายงาน โดยไม่สร้างรายการใหม่</p>}
        <div className="repair-ledger-editor-grid">
          <Field label="เลือกรถในระบบ" name="car_id" errors={errors} wide>
            <select name="car_id" value={draft.car_id} aria-invalid={Boolean(errors.car_id)} aria-describedby={errors.car_id ? 'repair-ledger-error-car_id' : undefined} onChange={event => selectCar(event.target.value)} disabled={saving || hasMaintenanceSource}>
              <option value="">เลือกรถที่ต้องการบันทึกงานซ่อม</option>
              {cars.map(car => <option key={car.id} value={String(car.id)}>{car.plate_number}</option>)}
            </select>
          </Field>
          <div className="repair-ledger-vehicle-summary repair-ledger-field-wide"><span>ทะเบียน <strong>{draft.plate_number || '—'}</strong></span><span>แผนก <strong>{draft.department || '—'}</strong></span><small>เติมจากข้อมูลรถในระบบอัตโนมัติ</small></div>
          <Field label="เดือน / ปีที่มีการใช้งานรถ" name="usage_month" errors={errors} optional><input type="month" name="usage_month" min="1900-01" max={ledgerToday().slice(0, 7)} value={usageMonth} disabled={saving || !draft.car_id} onChange={event => selectUsageMonth(event.target.value)} /><small>เลือกเดือนย้อนหลังได้</small></Field>
          <Field label="วันที่ใช้งานรถที่ลงค่าซ่อมใน ยพ.6" name="usage_date" errors={errors}>
            <select {...inputProps('usage_date')} disabled={saving || !draft.car_id || usageLoading || Boolean(usageError) || !usageDates.length}>
              <option value="">{!draft.car_id ? 'เลือกรถก่อน' : usageLoading ? 'กำลังโหลดวันที่ใช้งาน…' : !usageDates.length ? 'ไม่มีวันที่ใช้งานในเดือนนี้' : 'เลือกวันที่ใช้งานรถ'}</option>
              {usageDates.map(date => <option key={date.usage_date} value={date.usage_date}>{ledgerDateLabel(date.usage_date)} — ใช้งาน {Number(date.trip_count).toLocaleString('th-TH')} เที่ยว</option>)}
            </select>
            <small>แสดงเฉพาะวันที่มีรายการใช้งานรถจริง ไม่รวมวันที่มีเพียงการชาร์จ EV</small>
            {usageError && <span className="repair-ledger-date-error">{usageError}<button type="button" disabled={saving} onClick={() => setUsageRefresh(value => value + 1)}>ลองโหลดวันที่อีกครั้ง</button></span>}
          </Field>
          <Field label="รายการซ่อม" name="repair_description" errors={errors} wide><textarea rows={3} maxLength={5000} placeholder="ระบุรายละเอียดงานซ่อม / อะไหล่" {...inputProps('repair_description')} /></Field>
          <Field label="จำนวนเงิน (บาท)" name="amount" errors={errors} optional wide><input type="text" inputMode="decimal" placeholder="ยังไม่ทราบจำนวนเงิน เว้นว่างได้" maxLength={18} {...inputProps('amount')} /><small>เว้นว่างไม่ถือเป็น 0 บาท · กลับมาเติมยอดภายหลังในรายการเดิมได้</small></Field>
        </div>
        <details className="repair-ledger-extra-details" open={Object.keys(errors).some(name => ['repair_date', 'paid_date', 'status', 'machine_hours'].includes(name)) || undefined}>
          <summary>ข้อมูลบิลและติดตามงาน <small>ซ่อมจริง / วันที่บิล {ledgerDateLabel(draft.repair_date)} · แก้ไขและเติมรายละเอียดได้</small></summary>
          <div className="repair-ledger-editor-grid">
            <Field label="ร้าน / อู่ซ่อม" name="shop_name" errors={errors} optional><input type="text" maxLength={300} placeholder="ชื่อร้านหรืออู่ซ่อม" {...inputProps('shop_name')} /></Field>
            <Field label="เลขบิล" name="bill_number" errors={errors} optional><input type="text" maxLength={200} placeholder="เลขใบเสร็จ / ใบแจ้งหนี้" {...inputProps('bill_number')} /></Field>
            <Field label="วันที่ซ่อมจริง / วันที่บิล" name="repair_date" errors={errors}><input type="date" {...inputProps('repair_date')} /><small>รายการใหม่ตั้งต้นเป็นวันนี้ กรุณาแก้หากซ่อมคนละวัน · แยกจากวันที่ลง ยพ.6</small></Field>
            <Field label="สถานะ" name="status" errors={errors} optional><select {...inputProps('status')}>{REPAIR_LEDGER_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field>
            <Field label="ลงเลขเอกสารบัญชี" name="accounting_document_number" errors={errors} optional><input type="text" maxLength={200} placeholder="เลขเอกสารบัญชี" {...inputProps('accounting_document_number')} /></Field>
            <Field label="วันที่จ่ายเงิน" name="paid_date" errors={errors} optional><input type="date" {...inputProps('paid_date')} /></Field>
            <Field label="ชั่วโมงเครื่องจักร" name="machine_hours" errors={errors} optional><input type="text" inputMode="decimal" maxLength={18} placeholder="ถ้ามี" {...inputProps('machine_hours')} /></Field>
          </div>
          <p className="repair-ledger-small-note">วันที่จ่ายเงินไม่ย้ายวันที่ลง ยพ.6 และไม่เปลี่ยนสถานะอัตโนมัติ เลือกสถานะตามขั้นตอนที่ดำเนินการจริง</p>
        </details>
        {possibleDuplicates.length > 0 && <div className="repair-ledger-duplicate-warning" role="alert">
          <strong>มีรายการใกล้เคียง กรุณาตรวจสอบก่อนเพิ่มซ้ำ</strong>
          {possibleDuplicates.map(existing => <div key={existing.id}><span>{ledgerDateLabel(existing.usage_date || existing.repair_date)} · {existing.repair_description} · {ledgerMoney(existing.amount)} บาท</span><button type="button" disabled={saving} onClick={() => { if (window.confirm('เปิดรายการเดิมแทน และละทิ้งข้อมูลที่ยังไม่ได้บันทึกในแบบฟอร์มนี้หรือไม่?')) onOpenExisting(existing) }}>เปิดรายการเดิม</button></div>)}
          <label><input type="checkbox" checked={duplicateApproval === JSON.stringify(ledgerPayload(draft))} disabled={saving} onChange={event => setDuplicateApproval(event.target.checked ? JSON.stringify(ledgerPayload(draft)) : '')} />ตรวจแล้ว เป็นคนละงานซ่อม ต้องการบันทึกเป็นรายการใหม่</label>
        </div>}
        {saveError && <p className="repair-ledger-alert repair-ledger-alert-error" role="alert">{saveError}</p>}
      </div>
      <footer className="repair-ledger-editor-footer">
        <button type="button" className="repair-ledger-button repair-ledger-button-secondary" disabled={saving} onClick={close}>ยกเลิก</button>
        <button type="submit" className="repair-ledger-button repair-ledger-button-primary" disabled={saving || usageLoading || Boolean(usageError) || !draft.car_id || !usageDates.length}>{saving ? <LoaderCircle size={18} className="repair-ledger-spin" /> : <Check size={18} />}{saving ? 'กำลังบันทึก…' : 'บันทึกสมุดซ่อมและลง ยพ.6'}</button>
      </footer>
    </form> : <div className="repair-ledger-editor-body"><p className="repair-ledger-editor-note">การยืนยันหมดอายุแล้ว ข้อมูลที่กรอกยังอยู่ ยืนยันรหัสเดิมเพื่อกรอกต่อได้</p><RepairLedgerIdentity embedded onCancel={close} /></div>}
  </dialog>
}

function SourceLinkEditor({ source, month, identity, onClose, onSaved }) {
  const dialogRef = useRef(null)
  const sequence = useRef(0)
  const savingRef = useRef(false)
  const [linkMonth, setLinkMonth] = useState(month)
  const [candidates, setCandidates] = useState([])
  const [entryId, setEntryId] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { sequence.current += 1; document.body.style.overflow = previousOverflow; if (dialog.open) dialog.close() }
  }, [])
  useEffect(() => {
    const request = ++sequence.current
    Promise.resolve().then(async () => {
      if (request !== sequence.current) return
      setEntryId('')
      setCandidates([])
      setError('')
      if (!identity || !isLedgerMonth(linkMonth)) { setLoading(false); return }
      setLoading(true)
      try {
        const result = await loadRepairLedger({ month: linkMonth, carId: source.car_id })
        if (request === sequence.current) setCandidates((result.rows || []).filter(row => row.id && !row.source_id && !row.maintenance_record_id && String(row.car_id) === String(source.car_id)))
      } catch (caught) {
        if (request === sequence.current) setError(caught?.message || 'โหลดรายการเดิมไม่สำเร็จ')
      } finally {
        if (request === sequence.current) setLoading(false)
      }
    })
    return () => { sequence.current += 1 }
  }, [linkMonth, source.car_id, identity, reload])
  const close = () => { if (!savingRef.current) onClose() }
  const link = async event => {
    event.preventDefault()
    if (savingRef.current) return
    const entry = candidates.find(row => row.id === entryId)
    if (!entry) { setError('กรุณาเลือกรายการเดิมที่เป็นงานซ่อมเดียวกัน'); return }
    if (!window.confirm('ยืนยันว่าเป็นงานซ่อมเดียวกันหรือไม่? ระบบจะแนบข้อมูลแจ้งซ่อมกับรายการเดิม โดยไม่เพิ่มรายการหรือยอดเงินซ้ำ')) return
    const request = sequence.current
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      const saved = await linkRepairLedgerSource({ entryId: entry.id, sourceId: source.source_id, updatedAt: entry.updated_at })
      if (request === sequence.current) onSaved(saved)
    } catch (caught) {
      if (request === sequence.current) setError(caught?.message || 'เชื่อมรายการไม่สำเร็จ กรุณาโหลดข้อมูลล่าสุดก่อนลองอีกครั้ง')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }
  return <dialog ref={dialogRef} className="repair-ledger-dialog" aria-label="เชื่อมข้อมูลแจ้งซ่อมกับรายการเดิม" onCancel={event => { event.preventDefault(); close() }}>
    {identity ? <form onSubmit={link}>
      <header className="repair-ledger-editor-header"><div><span className="repair-ledger-eyebrow">ไม่เพิ่มข้อมูลซ้ำ</span><h2>เชื่อมกับรายการในสมุดซ่อม</h2></div><button type="button" className="repair-ledger-icon-button" onClick={close} disabled={saving} aria-label="ปิดการเชื่อมรายการ"><X size={21} /></button></header>
      <div className="repair-ledger-editor-body">
        <p className="repair-ledger-editor-note">{source.plate_number} · {source.repair_description || 'ข้อมูลแจ้งซ่อม'}<br />เลือกรายการที่กรอกไว้แล้ว ระบบจะเก็บข้อมูลสมุดซ่อมเดิมและแนบที่มาของการแจ้งซ่อมเท่านั้น</p>
        <div className="repair-ledger-editor-grid">
          <Field label="เดือนของรายการในสมุดซ่อม" name="link_month" errors={{}}><input type="month" value={linkMonth} min="1900-01" disabled={saving} onChange={event => setLinkMonth(event.target.value)} /></Field>
          <Field label="เลือกรายการเดิมของรถคันนี้" name="entry_id" errors={{}} wide><select value={entryId} disabled={loading || saving || !candidates.length} onChange={event => setEntryId(event.target.value)}><option value="">{loading ? 'กำลังโหลด…' : !candidates.length ? 'ไม่มีรายการที่เชื่อมได้ในเดือนนี้' : 'เลือกรายการที่เป็นงานเดียวกัน'}</option>{candidates.map(row => <option key={row.id} value={row.id}>{ledgerDateLabel(row.usage_date || row.repair_date)} · {row.repair_description} · {ledgerMoney(row.amount)} บาท</option>)}</select><small>เฉพาะรายการของรถคันเดียวกันที่ยังไม่เชื่อมกับข้อมูลแจ้งซ่อมอื่น เลือกย้อนหลังได้</small></Field>
        </div>
        {error && <div className="repair-ledger-alert repair-ledger-alert-error" role="alert">{error}<button type="button" disabled={saving} onClick={() => setReload(value => value + 1)}>โหลดรายการล่าสุด</button></div>}
      </div>
      <footer className="repair-ledger-editor-footer"><button type="button" className="repair-ledger-button repair-ledger-button-secondary" disabled={saving} onClick={close}>ยกเลิก</button><button type="submit" className="repair-ledger-button repair-ledger-button-primary" disabled={saving || loading || !entryId}>{saving ? <LoaderCircle size={18} className="repair-ledger-spin" /> : <Link2 size={18} />}{saving ? 'กำลังเชื่อม…' : 'เชื่อมกับรายการเดิม'}</button></footer>
    </form> : <div className="repair-ledger-editor-body"><p className="repair-ledger-editor-note">การยืนยันหมดอายุแล้ว ยืนยันรหัสเดิมเพื่อทำต่อ</p><RepairLedgerIdentity embedded onCancel={close} /></div>}
  </dialog>
}

export default function RepairLedger({ initialCarId = '', initialMonth = '' }) {
  const [month, setMonth] = useState(() => isLedgerMonth(initialMonth) ? initialMonth : ledgerToday().slice(0, 7))
  const [carId, setCarId] = useState(initialCarId)
  const [rows, setRows] = useState(emptyRows)
  const [inbox, setInbox] = useState(emptyRows)
  const [cars, setCars] = useState([])
  const [identity, setIdentity] = useState(getRepairLedgerIdentity)
  const lastStaffId = useRef(identity?.staff_id ?? null)
  const [loading, setLoading] = useState(Boolean(identity))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savedReport, setSavedReport] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [statusDrafts, setStatusDrafts] = useState({})
  const [savingKey, setSavingKey] = useState('')
  const [editor, setEditor] = useState(null)
  const [linkSource, setLinkSource] = useState(null)
  const sequence = useRef(0)
  const accessEpoch = useRef(0)
  const access = identity ? 'allowed' : 'denied'

  const refresh = useCallback(async ({ preserveStatusDrafts = false } = {}) => {
    const request = ++sequence.current
    setError('')
    if (!getRepairLedgerIdentity()) {
      setRows([])
      setInbox([])
      setCars([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await loadRepairLedger({ month, carId: carId || null })
      if (request !== sequence.current) return
      setRows((result.rows || []).filter(row => row.id))
      setInbox(result.inbox || (result.rows || []).filter(row => !row.id))
      setCars(result.cars || [])
      if (!preserveStatusDrafts) setStatusDrafts({})
    } catch (caught) {
      if (caught?.code === '42501') clearRepairLedgerIdentity()
      if (request !== sequence.current) return
      setRows([])
      setInbox([])
      setError(caught?.message || 'โหลดสมุดคุมงานซ่อมไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [month, carId])

  useEffect(() => {
    refresh()
    return () => { sequence.current += 1 }
  }, [refresh, identity])

  // Identity changes invalidate in-flight reads and keep another person's drafts private.
  useEffect(() => watchRepairLedgerIdentity(nextIdentity => {
    sequence.current += 1
    accessEpoch.current += 1
    setIdentity(nextIdentity)
    setLoading(Boolean(nextIdentity))
    setRows([])
    setInbox([])
    setCars([])
    setStatusDrafts({})
    // Retain the in-memory editor during expiry, but reveal it only after the
    // same staff ID re-verifies. A different person must never inherit a draft.
    if (nextIdentity && lastStaffId.current !== null && lastStaffId.current !== nextIdentity.staff_id) { setEditor(null); setLinkSource(null) }
    if (nextIdentity) lastStaffId.current = nextIdentity.staff_id
    setSavingKey('')
    setError('')
    setNotice('')
    setSavedReport(null)
  }), [])

  const filteredRows = useMemo(() => ledgerFilterRows(rows, { search, status: statusFilter }), [rows, search, statusFilter])
  const filteredInbox = useMemo(() => ledgerFilterRows(inbox, { search }), [inbox, search])
  const totals = useMemo(() => ledgerTotals(filteredRows), [filteredRows])
  const unknownAmounts = filteredRows.filter(row => row.amount === null || row.amount === undefined || row.amount === '').length
  const selectedCar = cars.find(car => String(car.id) === String(carId))
  const backCarId = carId || initialCarId
  const backHref = backCarId ? `/report?car_id=${encodeURIComponent(backCarId)}` : '/dashboard'
  const unsavedStatuses = rows.some(row => statusDrafts[ledgerRowKey(row)] !== undefined && statusDrafts[ledgerRowKey(row)] !== (row.status || ''))
  const confirmDiscard = () => !unsavedStatuses || window.confirm('มีสถานะที่ยังไม่ได้บันทึก ต้องการละทิ้งการเปลี่ยนสถานะและดำเนินการต่อหรือไม่?')
  const changeIdentity = () => {
    if (savingKey || !confirmDiscard()) return
    setEditor(null)
    setLinkSource(null)
    clearRepairLedgerIdentity()
  }

  useEffect(() => {
    if (!unsavedStatuses && !savingKey) return
    const beforeUnload = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [unsavedStatuses, savingKey])

  const printReport = () => {
    if (loading || error || !getRepairLedgerIdentity()) return
    if (unsavedStatuses && !window.confirm('มีสถานะที่ยังไม่ได้บันทึก รายงานจะพิมพ์สถานะเดิมที่บันทึกแล้ว ต้องการพิมพ์ต่อหรือไม่?')) return
    window.print()
  }

  const saveStatus = async row => {
    const key = ledgerRowKey(row)
    const epoch = accessEpoch.current
    if (savingKey || statusDrafts[key] === undefined) return
    setSavingKey(key)
    setError('')
    try {
      const draft = ledgerDraft({ ...row, status: statusDrafts[key] })
      const invalid = ledgerValidateDraft(draft, { allowLegacyUsageDate: Boolean(row.id && !row.usage_date) })
      if (Object.keys(invalid).length) throw new Error(Object.values(invalid)[0])
      await saveRepairLedger(ledgerPayload(draft))
      if (epoch !== accessEpoch.current) return
      setStatusDrafts(previous => Object.fromEntries(Object.entries(previous).filter(([draftKey]) => draftKey !== key)))
      setNotice(`บันทึกสถานะ ${row.plate_number} แล้ว`)
      await refresh({ preserveStatusDrafts: true })
    } catch (caught) {
      if (caught?.code === '42501') clearRepairLedgerIdentity()
      if (epoch !== accessEpoch.current) return
      setError(caught?.message || 'บันทึกสถานะไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      if (epoch === accessEpoch.current) setSavingKey('')
    }
  }
  const statusControl = row => <StatusControl row={row} draft={statusDrafts[ledgerRowKey(row)]} saving={Boolean(savingKey)} onChange={value => setStatusDrafts(previous => ({ ...previous, [ledgerRowKey(row)]: value }))} onSave={() => saveStatus(row)} />
  const openEditor = row => {
    if (!confirmDiscard()) return
    setStatusDrafts({})
    setEditor({ row })
  }
  const editButton = row => <button className="repair-ledger-edit-button" aria-label={`แก้ไขงานซ่อม ${row.plate_number} ${ledgerDateLabel(row.repair_date)}`} disabled={Boolean(savingKey)} onClick={() => openEditor(row)}><Pencil size={15} /><span>แก้ไข</span></button>
  const afterSave = (saved, linked = false) => {
    setEditor(null)
    setLinkSource(null)
    const outsideFilters = (saved.usage_date || saved.repair_date)?.slice(0, 7) !== month || Boolean(carId && String(saved.car_id) !== String(carId))
    setNotice(`${linked ? 'เชื่อมข้อมูลแจ้งซ่อมกับรายการเดิมแล้ว ไม่เพิ่มยอดซ้ำ' : saved.usage_date ? `บันทึกแล้ว ลง ยพ.6 วันที่ ${ledgerDateLabel(saved.usage_date)}` : 'บันทึกรายการแล้ว ยังรอเลือกวันที่ลง ยพ.6'}${outsideFilters ? ' · รายการอยู่นอกเดือนหรือทะเบียนที่กำลังดู' : ''}`)
    setSavedReport(saved.usage_date ? saved : null)
    refresh()
  }

  return <main className="repair-ledger-page">
    <div className="repair-ledger-screen-only repair-ledger-topbar">
      <Link href={backHref} className="repair-ledger-back" onClick={event => { if (!confirmDiscard()) event.preventDefault() }}><ArrowLeft size={18} />กลับรายงานรถ</Link>
      <span><ShieldCheck size={16} /> ยืนยันด้วยรหัสพนักงาน</span>
    </div>
    <header className="repair-ledger-header">
      <div className="repair-ledger-title-wrap"><span className="repair-ledger-book repair-ledger-screen-only"><BookOpen size={25} /></span><div><span className="repair-ledger-eyebrow">การไฟฟ้าส่วนภูมิภาค · รายงานการซ่อมยานพาหนะ</span><h1>สมุดคุมงานซ่อม</h1><p>{ledgerMonthLabel(month)} <span>·</span> {selectedCar?.plate_number || (carId ? 'รถที่เลือก' : 'รถทุกคัน')}{statusFilter !== 'all' && <> <span>·</span> {ledgerStatus(statusFilter).label}</>}{search && <> <span>·</span> ค้นหา: {search}</>}</p></div></div>
      {access === 'allowed' && <div className="repair-ledger-header-actions repair-ledger-screen-only">
        <button className="repair-ledger-button repair-ledger-button-secondary" disabled={loading || Boolean(error) || Boolean(savingKey)} onClick={printReport}><Printer size={18} />พิมพ์ / PDF</button>
        <button className="repair-ledger-button repair-ledger-button-primary" disabled={loading || Boolean(savingKey)} onClick={() => openEditor(null)}><FilePlus2 size={18} />เพิ่มรายการซ่อม</button>
      </div>}
    </header>

    {access === 'denied' ? <div className="repair-ledger-screen-only"><RepairLedgerIdentity /></div> : <>
      {access === 'allowed' && <>
        <div className="repair-ledger-verified repair-ledger-screen-only">
          <span className="repair-ledger-verified-icon"><UserRound size={20} /></span>
          <div><small>ยืนยันผู้บันทึกแล้ว</small><strong>{identity.full_name}</strong><span>ข้อมูลที่บันทึกจะระบุชื่อผู้ดำเนินการ · ใช้รหัสของตนเองเท่านั้น</span></div>
          <button type="button" disabled={Boolean(savingKey)} onClick={changeIdentity}><LogOut size={16} />เปลี่ยนผู้บันทึก</button>
        </div>
        {!loading && !error && <div className="repair-ledger-summary repair-ledger-screen-only">
          <div><span>รายการที่แสดง</span><strong>{filteredRows.length.toLocaleString('th-TH')}<small> รายการ</small></strong></div>
          <div><span>จำนวนเงินที่ระบุแล้ว</span><strong>{ledgerMoneyFromCents(totals.amount)}<small> บาท</small></strong>{unknownAmounts > 0 && <small>ยังไม่ระบุยอด {unknownAmounts.toLocaleString('th-TH')} รายการ</small>}</div>
          <div><span>รับเงินแล้ว</span><strong className="repair-ledger-paid-total">{ledgerMoneyFromCents(totals.paid)}<small> บาท</small></strong></div>
          <div><span>ยังไม่ระบุว่ารับเงินแล้ว</span><strong>{ledgerMoneyFromCents(totals.pending)}<small> บาท</small></strong></div>
        </div>}
        <div className="repair-ledger-filters repair-ledger-screen-only">
          <label><span>เดือน</span><input type="month" min="1900-01" value={month} disabled={Boolean(savingKey)} onChange={event => { if (isLedgerMonth(event.target.value) && confirmDiscard()) { setMonth(event.target.value); setNotice('') } }} /></label>
          <label><span>ทะเบียนรถ</span><select value={carId} disabled={Boolean(savingKey)} onChange={event => { if (confirmDiscard()) { setCarId(event.target.value); setNotice('') } }}><option value="">รถทุกคัน</option>{cars.map(car => <option key={car.id} value={String(car.id)}>{car.plate_number}</option>)}</select></label>
          <label><span><Filter size={13} />สถานะ</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">ทุกสถานะ</option>{REPAIR_LEDGER_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label className="repair-ledger-search"><span><Search size={13} />ค้นหารายการ</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ทะเบียน ร้าน เลขบิล รายการซ่อม…" /></label>
          <button className="repair-ledger-icon-button" aria-label="โหลดสมุดคุมงานซ่อมใหม่" disabled={loading || Boolean(savingKey)} onClick={() => { if (confirmDiscard()) refresh() }}><RefreshCw size={18} className={loading ? 'repair-ledger-spin' : ''} /></button>
        </div>
      </>}
      {error && <div className="repair-ledger-alert repair-ledger-alert-error repair-ledger-screen-only" role="alert">{error}<button onClick={refresh} disabled={loading}>ลองอีกครั้ง</button></div>}
      {notice && <div className="repair-ledger-alert repair-ledger-alert-success repair-ledger-screen-only" role="status"><Check size={17} /><span>{notice}</span>{savedReport && <Link className="repair-ledger-report-link" href={`/report?${new URLSearchParams({ car_id: String(savedReport.car_id), month: savedReport.usage_date.slice(0, 7), report_type: 'usage' })}`} onClick={event => { if (!confirmDiscard()) event.preventDefault() }}>เปิด ยพ.6 <ArrowUpRight size={16} /></Link>}</div>}
      {unsavedStatuses && <p className="repair-ledger-alert repair-ledger-alert-warning repair-ledger-screen-only">มีสถานะที่ยังไม่บันทึก กรุณากด “บันทึกสถานะ” ก่อนเปลี่ยนตัวกรองหรือออกจากหน้า รายงานพิมพ์จะแสดงข้อมูลที่บันทึกแล้วเท่านั้น</p>}
      {loading ? <div className="repair-ledger-empty repair-ledger-screen-only" role="status"><LoaderCircle size={26} className="repair-ledger-spin" /><strong>กำลังโหลดสมุดคุมงานซ่อม…</strong></div>
        : access === 'allowed' && !error && <>
          <p className="repair-ledger-table-note repair-ledger-screen-only">กรอกที่สมุดซ่อมเป็นหลัก แล้วลง ยพ.6 ตามวันที่ใช้งานรถที่เลือก <strong>ข้อมูลแจ้งซ่อมด้านล่างเป็นตัวช่วยเติม ไม่รวมในยอดจนกว่าจะบันทึกเข้ารายการหลัก</strong></p>
          <details className="repair-ledger-inbox repair-ledger-screen-only">
            <summary><Inbox size={19} /><span>ข้อมูลแจ้งซ่อมรอนำเข้า <strong>{filteredInbox.length.toLocaleString('th-TH')}</strong><small>ไม่จำเป็นต้องมีแจ้งซ่อม ก็เพิ่มรายการเองได้</small></span></summary>
            <div className="repair-ledger-inbox-body">
              <p>ตรวจรายละเอียดซ่อมจริงก่อนนำเข้า หากกรอกไว้แล้วให้เชื่อมกับรายการเดิม เพื่อไม่ให้ข้อมูลและยอดซ้ำ</p>
              {filteredInbox.length ? filteredInbox.map(source => <article key={ledgerRowKey(source)}>
                <div><strong>{source.plate_number}</strong><small>แจ้งเมื่อ {ledgerDateLabel(source.reported_date)}{source.completed_date && <> · ปิดงานเมื่อ {ledgerDateLabel(source.completed_date)}</>}</small><p>{source.repair_description || 'ยังไม่มีรายละเอียด'}</p>{source.amount !== null && source.amount !== undefined && <span>ยอดจากข้อมูลต้นทาง {ledgerMoney(source.amount)} บาท</span>}</div>
                <div className="repair-ledger-inbox-actions"><button type="button" className="repair-ledger-button repair-ledger-button-primary" disabled={Boolean(savingKey)} onClick={() => openEditor(source)}><FilePlus2 size={16} />ใช้ข้อมูลนี้เติมสมุดซ่อม</button><button type="button" className="repair-ledger-button repair-ledger-button-secondary" disabled={Boolean(savingKey)} onClick={() => { if (confirmDiscard()) { setStatusDrafts({}); setLinkSource(source) } }}><Link2 size={16} />กรอกไว้แล้ว เชื่อมรายการเดิม</button></div>
              </article>) : <p className="repair-ledger-inbox-empty">ไม่มีข้อมูลแจ้งซ่อมรอนำเข้าในเดือนและทะเบียนที่เลือก</p>}
            </div>
          </details>
          {unsavedStatuses && <p className="repair-ledger-print-notice">หมายเหตุ: มีการเปลี่ยนสถานะบนหน้าจอที่ยังไม่ได้บันทึก เอกสารนี้แสดงสถานะเดิมที่บันทึกแล้วเท่านั้น</p>}
          <div className="repair-ledger-table-wrap">
            <table className="repair-ledger-table">
              <caption className="repair-ledger-visually-hidden">สมุดคุมงานซ่อม ประจำเดือน{ledgerMonthLabel(month)}</caption>
              <colgroup>{[8, 9, 7, 10, 8, 9, 18, 12, 10, 9].map((width, index) => <col key={index} style={{ width: `${width * .94}%` }} />)}<col className="repair-ledger-screen-only" style={{ width: '6%' }} /></colgroup>
              <thead><tr>{columnHeaders.map(header => <th key={header} scope="col">{header}</th>)}<th scope="col" className="repair-ledger-screen-only">จัดการ</th></tr></thead>
              <tbody>{filteredRows.length ? filteredRows.map(row => <tr key={ledgerRowKey(row)}>
                <td className="repair-ledger-date">{ledgerDateLabel(row.usage_date || row.repair_date)}{row.usage_date ? <small className="repair-ledger-row-source repair-ledger-screen-only">ลง ยพ.6</small> : <small className="repair-ledger-pending-date repair-ledger-screen-only">รอเลือกวันที่ ยพ.6</small>}{row.repair_date !== row.usage_date && <small className="repair-ledger-row-source repair-ledger-screen-only">ซ่อมจริง {ledgerDateLabel(row.repair_date)}</small>}</td><td><strong>{row.plate_number}</strong><small className="repair-ledger-row-source repair-ledger-screen-only">{ledgerSourceLabel(row)}</small>{row.updated_by_staff_name && <small className="repair-ledger-row-source repair-ledger-screen-only">บันทึกโดย {row.updated_by_staff_name}</small>}</td><td>{row.department || '—'}</td><td>{row.shop_name || '—'}</td><td>{row.bill_number || '—'}</td><td className="repair-ledger-number">{ledgerMoney(row.amount)}</td><td className="repair-ledger-description">{row.repair_description || '—'}</td><td>{statusControl(row)}</td><td>{row.accounting_document_number || '—'}</td><td className="repair-ledger-date">{ledgerDateLabel(row.paid_date)}</td><td className="repair-ledger-screen-only">{editButton(row)}</td>
              </tr>) : <tr><td colSpan={11} className="repair-ledger-table-empty">ยังไม่มีรายการซ่อมในเดือนหรือตัวกรองที่เลือก</td></tr>}</tbody>
              <tfoot><tr><th colSpan={5} scope="row">รวม {filteredRows.length.toLocaleString('th-TH')} รายการ</th><td className="repair-ledger-number">{ledgerMoneyFromCents(totals.amount)}</td><td colSpan={4} /><td className="repair-ledger-screen-only" /></tr></tfoot>
            </table>
          </div>
          <div className="repair-ledger-mobile-records repair-ledger-screen-only">
            {filteredRows.length ? filteredRows.map(row => <article key={ledgerRowKey(row)} className="repair-ledger-mobile-card">
              <header><div><span className="repair-ledger-row-source">{ledgerSourceLabel(row)} · {ledgerDateLabel(row.usage_date || row.repair_date)}</span><h2>{row.plate_number}</h2></div>{editButton(row)}</header>
              {!row.usage_date && <p className="repair-ledger-pending-date">รายการเดิม · ยังรอเลือกวันที่ลง ยพ.6</p>}
              <p className="repair-ledger-mobile-description">{row.repair_description || '—'}</p>
              <dl><div><dt>วันที่ลง ยพ.6</dt><dd>{row.usage_date ? ledgerDateLabel(row.usage_date) : 'ยังไม่เลือก'}</dd></div><div><dt>วันที่ซ่อมจริง / บิล</dt><dd>{ledgerDateLabel(row.repair_date)}</dd></div><div><dt>แผนก</dt><dd>{row.department || '—'}</dd></div><div><dt>ร้าน</dt><dd>{row.shop_name || '—'}</dd></div><div><dt>เลขบิล</dt><dd>{row.bill_number || '—'}</dd></div><div><dt>จำนวนเงิน</dt><dd className="repair-ledger-mobile-amount">{ledgerMoney(row.amount)} บาท</dd></div><div><dt>เลขเอกสารบัญชี</dt><dd>{row.accounting_document_number || '—'}</dd></div><div><dt>วันที่จ่ายเงิน</dt><dd>{ledgerDateLabel(row.paid_date)}</dd></div></dl>
              <div className="repair-ledger-mobile-status"><span>สถานะ</span>{statusControl(row)}</div>
              {row.updated_by_staff_name && <p className="repair-ledger-mobile-actor">ผู้บันทึกล่าสุด: {row.updated_by_staff_name}</p>}
            </article>) : <div className="repair-ledger-empty"><BookOpen size={30} /><strong>ยังไม่มีรายการในเดือนนี้</strong><p>เลือกเดือนอื่น หรือล้างตัวกรองเพื่อดูรายการเพิ่มเติม</p><button className="repair-ledger-button repair-ledger-button-secondary" onClick={() => openEditor(null)}><FilePlus2 size={17} />เพิ่มรายการซ่อม</button></div>}
          </div>
          <footer className="repair-ledger-report-footer"><span>สมุดคุมงานซ่อม · {ledgerMonthLabel(month)} · สถานะตามข้อมูลที่บันทึกแล้ว</span><span>แสดง {filteredRows.length.toLocaleString('th-TH')} รายการ · หน่วยเงิน: บาท{unknownAmounts > 0 && ` · ยังไม่ระบุยอด ${unknownAmounts} รายการ (ไม่รวมในยอดเงิน)`}</span></footer>
        </>}
    </>}
    {(loading || error || access === 'denied') && <p className="repair-ledger-print-notice">ไม่สามารถยืนยันข้อมูลสมุดคุมงานซ่อมได้ กรุณายืนยันรหัสพนักงานและโหลดข้อมูลให้สำเร็จก่อนพิมพ์ เอกสารนี้ไม่ใช่รายงานยอดซ่อมที่สมบูรณ์</p>}
    {editor && <RepairEditor key={editor.row ? ledgerRowKey(editor.row) : 'new'} row={editor.row} cars={cars} month={month} selectedCarId={carId} identity={identity} onClose={() => setEditor(null)} onSaved={afterSave} onOpenExisting={existing => setEditor({ row: existing })} />}
    {linkSource && <SourceLinkEditor source={linkSource} month={month} identity={identity} onClose={() => setLinkSource(null)} onSaved={saved => afterSave(saved, true)} />}
  </main>
}
