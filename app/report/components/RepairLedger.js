'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, BookOpen, Check, FilePlus2, Filter, LoaderCircle, LogOut, Pencil, Printer, RefreshCw, Search, ShieldCheck, UserRound, X } from 'lucide-react'
import { clearRepairLedgerIdentity, getRepairLedgerIdentity, loadRepairLedger, saveRepairLedger, watchRepairLedgerIdentity } from '@/lib/repairLedgerData'
import {
  REPAIR_LEDGER_STATUSES, isLedgerMonth, ledgerDateLabel, ledgerDraft, ledgerFilterRows,
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

function RepairEditor({ row, cars, month, selectedCarId, identity, onClose, onSaved }) {
  const dialogRef = useRef(null)
  const initialCar = cars.find(car => String(car.id) === String(selectedCarId))
  const [draft, setDraft] = useState(() => ledgerDraft(row || {
    source_type: 'manual', source_id: null, client_request_id: crypto.randomUUID(),
  }, { car: initialCar, month }))
  const [errors, setErrors] = useState({})
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const alive = useRef(true)
  const [initialDraft] = useState(() => JSON.stringify(draft))
  const dirty = JSON.stringify(draft) !== initialDraft
  const fromMaintenance = row?.source_type === 'maintenance'
  const update = (name, value) => {
    setDraft(previous => ({ ...previous, [name]: value }))
    setErrors(previous => ({ ...previous, [name]: undefined }))
    setSaveError('')
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
    if (!dirty && !saving) return
    const beforeUnload = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty, saving])

  const close = () => {
    if (saving) return
    if (!dirty || window.confirm('ข้อมูลที่แก้ไขยังไม่ได้บันทึก ต้องการปิดแบบฟอร์มและละทิ้งการแก้ไขหรือไม่?')) onClose()
  }

  const selectCar = value => {
    const car = cars.find(item => String(item.id) === value)
    setDraft(previous => ({
      ...previous, car_id: value,
      ...(car ? {
        plate_number: car.plate_number || '',
        department: car.department_name || (typeof car.department === 'string' ? car.department : car.departments?.name) || '',
      } : {}),
    }))
  }

  const save = async event => {
    event.preventDefault()
    if (saving) return
    const invalid = ledgerValidateDraft(draft)
    setErrors(invalid)
    if (Object.keys(invalid).length) {
      dialogRef.current?.querySelector(`[name="${Object.keys(invalid)[0]}"]`)?.focus()
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      await saveRepairLedger(ledgerPayload(draft))
      if (!alive.current) return
      onSaved(draft.repair_date.slice(0, 7) !== month || Boolean(selectedCarId && String(draft.car_id) !== String(selectedCarId)))
    } catch (error) {
      if (error?.code === '42501') clearRepairLedgerIdentity()
      if (!alive.current) return
      setSaveError(error?.message || 'บันทึกไม่สำเร็จ ข้อมูลที่กรอกยังอยู่ กรุณาลองอีกครั้ง')
      setSaving(false)
    }
  }
  const inputProps = name => ({
    name, value: draft[name], onChange: event => update(name, event.target.value),
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `repair-ledger-error-${name}` : undefined,
    disabled: saving,
  })

  return <dialog ref={dialogRef} className="repair-ledger-dialog" aria-labelledby={identity ? 'repair-ledger-editor-title' : undefined} aria-label={!identity ? 'ยืนยันรหัสพนักงานอีกครั้ง' : undefined} onCancel={event => { event.preventDefault(); close() }}>
    {identity ? <form onSubmit={save} noValidate>
      <header className="repair-ledger-editor-header">
        <div><span className="repair-ledger-eyebrow">สมุดคุมงานซ่อม</span><h2 id="repair-ledger-editor-title">{row ? 'แก้ไขรายการซ่อม' : 'เพิ่มรายการซ่อม'}</h2></div>
        <button type="button" className="repair-ledger-icon-button" aria-label="ปิดแบบฟอร์ม" disabled={saving} onClick={close}><X size={21} /></button>
      </header>
      <div className="repair-ledger-editor-body">
        <p className="repair-ledger-editor-identity"><UserRound size={15} /> ผู้บันทึก: <strong>{identity.full_name}</strong></p>
        {row && <p className="repair-ledger-editor-note"><ShieldCheck size={18} /> แก้เฉพาะสมุดคุมงานซ่อม ไม่เปลี่ยนสถานะรถหรือประวัติส่งซ่อมต้นฉบับ</p>}
        <div className="repair-ledger-editor-grid">
          <Field label="วันที่" name="repair_date" errors={errors}><input type="date" {...inputProps('repair_date')} /></Field>
          <Field label="เลือกรถในระบบ" name="car_id" errors={errors} optional>
            <select name="car_id" value={draft.car_id} onChange={event => selectCar(event.target.value)} disabled={saving || fromMaintenance}>
              <option value="">กรอกทะเบียนเอง</option>
              {cars.map(car => <option key={car.id} value={String(car.id)}>{car.plate_number}</option>)}
            </select>
          </Field>
          <Field label="ทะเบียนรถ" name="plate_number" errors={errors}><input type="text" maxLength={120} placeholder="เช่น 90-7606 นฐ." {...inputProps('plate_number')} /></Field>
          <Field label="แผนก" name="department" errors={errors} optional><input type="text" maxLength={200} placeholder="ชื่อแผนก" {...inputProps('department')} /></Field>
          <Field label="ร้าน / อู่ซ่อม" name="shop_name" errors={errors} optional><input type="text" maxLength={300} placeholder="ชื่อร้านหรืออู่ซ่อม" {...inputProps('shop_name')} /></Field>
          <Field label="เลขบิล" name="bill_number" errors={errors} optional><input type="text" maxLength={200} placeholder="เลขใบเสร็จ / ใบแจ้งหนี้" {...inputProps('bill_number')} /></Field>
          <Field label="จำนวนเงิน (บาท)" name="amount" errors={errors} optional><input type="text" inputMode="decimal" placeholder="ยังไม่ทราบจำนวนเงิน" maxLength={18} {...inputProps('amount')} /><small>เว้นว่างได้ถ้ายังไม่มีบิล · ทศนิยมไม่เกิน 2 ตำแหน่ง</small></Field>
          <Field label="สถานะ" name="status" errors={errors} optional><select {...inputProps('status')}>{REPAIR_LEDGER_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field>
          <Field label="รายการซ่อม" name="repair_description" errors={errors} wide><textarea rows={3} maxLength={5000} placeholder="ระบุรายละเอียดงานซ่อม / อะไหล่" {...inputProps('repair_description')} /></Field>
          <Field label="ลงเลขเอกสารบัญชี" name="accounting_document_number" errors={errors} optional><input type="text" maxLength={200} placeholder="เลขเอกสารบัญชี" {...inputProps('accounting_document_number')} /></Field>
          <Field label="วันที่จ่ายเงิน" name="paid_date" errors={errors} optional><input type="date" {...inputProps('paid_date')} /></Field>
        </div>
        <p className="repair-ledger-small-note">การกรอกวันที่จ่ายเงินจะไม่เปลี่ยนสถานะอัตโนมัติ กรุณาเลือกสถานะตามขั้นตอนที่ดำเนินการจริง</p>
        {saveError && <p className="repair-ledger-alert repair-ledger-alert-error" role="alert">{saveError}</p>}
      </div>
      <footer className="repair-ledger-editor-footer">
        <button type="button" className="repair-ledger-button repair-ledger-button-secondary" disabled={saving} onClick={close}>ยกเลิก</button>
        <button type="submit" className="repair-ledger-button repair-ledger-button-primary" disabled={saving}>{saving ? <LoaderCircle size={18} className="repair-ledger-spin" /> : <Check size={18} />}{saving ? 'กำลังบันทึก…' : 'บันทึกรายการ'}</button>
      </footer>
    </form> : <div className="repair-ledger-editor-body"><p className="repair-ledger-editor-note">การยืนยันหมดอายุแล้ว ข้อมูลที่กรอกยังอยู่ ยืนยันรหัสเดิมเพื่อกรอกต่อได้</p><RepairLedgerIdentity embedded onCancel={close} /></div>}
  </dialog>
}

export default function RepairLedger({ initialCarId = '', initialMonth = '' }) {
  const [month, setMonth] = useState(() => isLedgerMonth(initialMonth) ? initialMonth : ledgerToday().slice(0, 7))
  const [carId, setCarId] = useState(initialCarId)
  const [rows, setRows] = useState(emptyRows)
  const [cars, setCars] = useState([])
  const [identity, setIdentity] = useState(getRepairLedgerIdentity)
  const lastStaffId = useRef(identity?.staff_id ?? null)
  const [loading, setLoading] = useState(Boolean(identity))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [statusDrafts, setStatusDrafts] = useState({})
  const [savingKey, setSavingKey] = useState('')
  const [editor, setEditor] = useState(null)
  const sequence = useRef(0)
  const accessEpoch = useRef(0)
  const access = identity ? 'allowed' : 'denied'

  const refresh = useCallback(async ({ preserveStatusDrafts = false } = {}) => {
    const request = ++sequence.current
    setError('')
    if (!getRepairLedgerIdentity()) {
      setRows([])
      setCars([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const result = await loadRepairLedger({ month, carId: carId || null })
      if (request !== sequence.current) return
      setRows(result.rows || [])
      setCars(result.cars || [])
      if (!preserveStatusDrafts) setStatusDrafts({})
    } catch (caught) {
      if (caught?.code === '42501') clearRepairLedgerIdentity()
      if (request !== sequence.current) return
      setRows([])
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
    setCars([])
    setStatusDrafts({})
    // Retain the in-memory editor during expiry, but reveal it only after the
    // same staff ID re-verifies. A different person must never inherit a draft.
    if (nextIdentity && lastStaffId.current !== null && lastStaffId.current !== nextIdentity.staff_id) setEditor(null)
    if (nextIdentity) lastStaffId.current = nextIdentity.staff_id
    setSavingKey('')
    setError('')
    setNotice('')
  }), [])

  const filteredRows = useMemo(() => ledgerFilterRows(rows, { search, status: statusFilter }), [rows, search, statusFilter])
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
    clearRepairLedgerIdentity()
  }

  useEffect(() => {
    if (!unsavedStatuses && !savingKey) return
    const beforeUnload = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [unsavedStatuses, savingKey])

  const printReport = () => {
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
      await saveRepairLedger(ledgerPayload(ledgerDraft({ ...row, status: statusDrafts[key] })))
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
  const editButton = row => <button className="repair-ledger-edit-button" aria-label={`แก้ไขงานซ่อม ${row.plate_number} ${ledgerDateLabel(row.repair_date)}`} disabled={Boolean(savingKey)} onClick={() => setEditor({ row })}><Pencil size={15} /><span>แก้ไข</span></button>

  return <main className="repair-ledger-page">
    <div className="repair-ledger-screen-only repair-ledger-topbar">
      <Link href={backHref} className="repair-ledger-back" onClick={event => { if (!confirmDiscard()) event.preventDefault() }}><ArrowLeft size={18} />กลับรายงานรถ</Link>
      <span><ShieldCheck size={16} /> ยืนยันด้วยรหัสพนักงาน</span>
    </div>
    <header className="repair-ledger-header">
      <div className="repair-ledger-title-wrap"><span className="repair-ledger-book repair-ledger-screen-only"><BookOpen size={25} /></span><div><span className="repair-ledger-eyebrow">การไฟฟ้าส่วนภูมิภาค · รายงานการซ่อมยานพาหนะ</span><h1>สมุดคุมงานซ่อม</h1><p>{ledgerMonthLabel(month)} <span>·</span> {selectedCar?.plate_number || (carId ? 'รถที่เลือก' : 'รถทุกคัน')}{statusFilter !== 'all' && <> <span>·</span> {ledgerStatus(statusFilter).label}</>}{search && <> <span>·</span> ค้นหา: {search}</>}</p></div></div>
      {access === 'allowed' && <div className="repair-ledger-header-actions repair-ledger-screen-only">
        <button className="repair-ledger-button repair-ledger-button-secondary" disabled={loading || Boolean(savingKey)} onClick={printReport}><Printer size={18} />พิมพ์ / PDF</button>
        <button className="repair-ledger-button repair-ledger-button-primary" disabled={loading || Boolean(savingKey)} onClick={() => setEditor({ row: null })}><FilePlus2 size={18} />เพิ่มรายการ</button>
      </div>}
    </header>

    {access === 'denied' ? <div className="repair-ledger-screen-only"><RepairLedgerIdentity /></div> : <>
      {access === 'allowed' && <>
        <div className="repair-ledger-verified repair-ledger-screen-only">
          <span className="repair-ledger-verified-icon"><UserRound size={20} /></span>
          <div><small>ยืนยันผู้บันทึกแล้ว</small><strong>{identity.full_name}</strong><span>ข้อมูลที่บันทึกจะระบุชื่อผู้ดำเนินการ · ใช้รหัสของตนเองเท่านั้น</span></div>
          <button type="button" disabled={Boolean(savingKey)} onClick={changeIdentity}><LogOut size={16} />เปลี่ยนผู้บันทึก</button>
        </div>
        <div className="repair-ledger-summary repair-ledger-screen-only">
          <div><span>รายการที่แสดง</span><strong>{filteredRows.length.toLocaleString('th-TH')}<small> รายการ</small></strong></div>
          <div><span>จำนวนเงินที่ระบุแล้ว</span><strong>{ledgerMoneyFromCents(totals.amount)}<small> บาท</small></strong>{unknownAmounts > 0 && <small>ยังไม่ระบุยอด {unknownAmounts.toLocaleString('th-TH')} รายการ</small>}</div>
          <div><span>รับเงินแล้ว</span><strong className="repair-ledger-paid-total">{ledgerMoneyFromCents(totals.paid)}<small> บาท</small></strong></div>
          <div><span>ยังไม่ระบุว่ารับเงินแล้ว</span><strong>{ledgerMoneyFromCents(totals.pending)}<small> บาท</small></strong></div>
        </div>
        <div className="repair-ledger-filters repair-ledger-screen-only">
          <label><span>เดือน</span><input type="month" min="1900-01" value={month} disabled={Boolean(savingKey)} onChange={event => { if (isLedgerMonth(event.target.value) && confirmDiscard()) { setMonth(event.target.value); setNotice('') } }} /></label>
          <label><span>ทะเบียนรถ</span><select value={carId} disabled={Boolean(savingKey)} onChange={event => { if (confirmDiscard()) { setCarId(event.target.value); setNotice('') } }}><option value="">รถทุกคัน</option>{cars.map(car => <option key={car.id} value={String(car.id)}>{car.plate_number}</option>)}</select></label>
          <label><span><Filter size={13} />สถานะ</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">ทุกสถานะ</option>{REPAIR_LEDGER_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          <label className="repair-ledger-search"><span><Search size={13} />ค้นหารายการ</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ทะเบียน ร้าน เลขบิล รายการซ่อม…" /></label>
          <button className="repair-ledger-icon-button" aria-label="โหลดสมุดคุมงานซ่อมใหม่" disabled={loading || Boolean(savingKey)} onClick={() => { if (confirmDiscard()) refresh() }}><RefreshCw size={18} className={loading ? 'repair-ledger-spin' : ''} /></button>
        </div>
      </>}
      {error && <div className="repair-ledger-alert repair-ledger-alert-error repair-ledger-screen-only" role="alert">{error}<button onClick={refresh} disabled={loading}>ลองอีกครั้ง</button></div>}
      {notice && <p className="repair-ledger-alert repair-ledger-alert-success repair-ledger-screen-only" role="status"><Check size={17} />{notice}</p>}
      {unsavedStatuses && <p className="repair-ledger-alert repair-ledger-alert-warning repair-ledger-screen-only">มีสถานะที่ยังไม่บันทึก กรุณากด “บันทึกสถานะ” ก่อนเปลี่ยนตัวกรองหรือออกจากหน้า รายงานพิมพ์จะแสดงข้อมูลที่บันทึกแล้วเท่านั้น</p>}
      {loading ? <div className="repair-ledger-empty repair-ledger-screen-only" role="status"><LoaderCircle size={26} className="repair-ledger-spin" /><strong>กำลังโหลดสมุดคุมงานซ่อม…</strong></div>
        : access === 'allowed' && <>
          <p className="repair-ledger-table-note repair-ledger-screen-only">ดึงข้อมูลส่งซ่อมและบันทึกการซ่อมที่มีอยู่ให้อัตโนมัติ เติมรายละเอียดที่ขาดหรือกด “เพิ่มรายการ” เพื่อกรอกเองได้ <strong>สถานะจะเปลี่ยนเมื่อกดบันทึกเท่านั้น</strong></p>
          {unsavedStatuses && <p className="repair-ledger-print-notice">หมายเหตุ: มีการเปลี่ยนสถานะบนหน้าจอที่ยังไม่ได้บันทึก เอกสารนี้แสดงสถานะเดิมที่บันทึกแล้วเท่านั้น</p>}
          <div className="repair-ledger-table-wrap">
            <table className="repair-ledger-table">
              <caption className="repair-ledger-visually-hidden">สมุดคุมงานซ่อม ประจำเดือน{ledgerMonthLabel(month)}</caption>
              <colgroup>{[8, 9, 7, 10, 8, 9, 18, 12, 10, 9].map((width, index) => <col key={index} style={{ width: `${width * .94}%` }} />)}<col className="repair-ledger-screen-only" style={{ width: '6%' }} /></colgroup>
              <thead><tr>{columnHeaders.map(header => <th key={header} scope="col">{header}</th>)}<th scope="col" className="repair-ledger-screen-only">จัดการ</th></tr></thead>
              <tbody>{filteredRows.length ? filteredRows.map(row => <tr key={ledgerRowKey(row)}>
                <td className="repair-ledger-date">{ledgerDateLabel(row.repair_date)}</td><td><strong>{row.plate_number}</strong><small className="repair-ledger-row-source repair-ledger-screen-only">{ledgerSourceLabel(row)}</small>{row.updated_by_staff_name && <small className="repair-ledger-row-source repair-ledger-screen-only">บันทึกโดย {row.updated_by_staff_name}</small>}</td><td>{row.department || '—'}</td><td>{row.shop_name || '—'}</td><td>{row.bill_number || '—'}</td><td className="repair-ledger-number">{ledgerMoney(row.amount)}</td><td className="repair-ledger-description">{row.repair_description || '—'}</td><td>{statusControl(row)}</td><td>{row.accounting_document_number || '—'}</td><td className="repair-ledger-date">{ledgerDateLabel(row.paid_date)}</td><td className="repair-ledger-screen-only">{editButton(row)}</td>
              </tr>) : <tr><td colSpan={11} className="repair-ledger-table-empty">ยังไม่มีรายการซ่อมในเดือนหรือตัวกรองที่เลือก</td></tr>}</tbody>
              <tfoot><tr><th colSpan={5} scope="row">รวม {filteredRows.length.toLocaleString('th-TH')} รายการ</th><td className="repair-ledger-number">{ledgerMoneyFromCents(totals.amount)}</td><td colSpan={4} /><td className="repair-ledger-screen-only" /></tr></tfoot>
            </table>
          </div>
          <div className="repair-ledger-mobile-records repair-ledger-screen-only">
            {filteredRows.length ? filteredRows.map(row => <article key={ledgerRowKey(row)} className="repair-ledger-mobile-card">
              <header><div><span className="repair-ledger-row-source">{ledgerSourceLabel(row)} · {ledgerDateLabel(row.repair_date)}</span><h2>{row.plate_number}</h2></div>{editButton(row)}</header>
              <p className="repair-ledger-mobile-description">{row.repair_description || '—'}</p>
              <dl><div><dt>แผนก</dt><dd>{row.department || '—'}</dd></div><div><dt>ร้าน</dt><dd>{row.shop_name || '—'}</dd></div><div><dt>เลขบิล</dt><dd>{row.bill_number || '—'}</dd></div><div><dt>จำนวนเงิน</dt><dd className="repair-ledger-mobile-amount">{ledgerMoney(row.amount)} บาท</dd></div><div><dt>เลขเอกสารบัญชี</dt><dd>{row.accounting_document_number || '—'}</dd></div><div><dt>วันที่จ่ายเงิน</dt><dd>{ledgerDateLabel(row.paid_date)}</dd></div></dl>
              <div className="repair-ledger-mobile-status"><span>สถานะ</span>{statusControl(row)}</div>
              {row.updated_by_staff_name && <p className="repair-ledger-mobile-actor">ผู้บันทึกล่าสุด: {row.updated_by_staff_name}</p>}
            </article>) : <div className="repair-ledger-empty"><BookOpen size={30} /><strong>ยังไม่มีรายการในเดือนนี้</strong><p>เลือกเดือนอื่น หรือล้างตัวกรองเพื่อดูรายการเพิ่มเติม</p><button className="repair-ledger-button repair-ledger-button-secondary" onClick={() => setEditor({ row: null })}><FilePlus2 size={17} />เพิ่มรายการซ่อม</button></div>}
          </div>
          <footer className="repair-ledger-report-footer"><span>สมุดคุมงานซ่อม · {ledgerMonthLabel(month)} · สถานะตามข้อมูลที่บันทึกแล้ว</span><span>แสดง {filteredRows.length.toLocaleString('th-TH')} รายการ · หน่วยเงิน: บาท{unknownAmounts > 0 && ` · ยังไม่ระบุยอด ${unknownAmounts} รายการ (ไม่รวมในยอดเงิน)`}</span></footer>
        </>}
    </>}
    {editor && <RepairEditor key={editor.row ? ledgerRowKey(editor.row) : 'new'} row={editor.row} cars={cars} month={month} selectedCarId={carId} identity={identity} onClose={() => setEditor(null)} onSaved={outsideFilters => {
      setEditor(null)
      setNotice(outsideFilters ? 'บันทึกแล้ว รายการอยู่นอกเดือนหรือทะเบียนที่เลือก เปลี่ยนตัวกรองเพื่อดูรายการได้' : 'บันทึกรายการซ่อมแล้ว')
      refresh()
    }} />}
  </main>
}
