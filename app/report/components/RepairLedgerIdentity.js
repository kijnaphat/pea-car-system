'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, LoaderCircle, ShieldCheck } from 'lucide-react'
import { normalizeStaffCode } from '@/lib/staffCode'
import { verifyRepairLedgerStaff } from '@/lib/repairLedgerData'
import './repair-ledger-identity.css'

export default function RepairLedgerIdentity({ onVerified, onCancel, embedded = false }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const inputId = useId()
  const alive = useRef(true)
  const busy = useRef(false)
  const inputRef = useRef(null)
  const requestRef = useRef(null)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false; requestRef.current?.abort() }
  }, [])

  const submit = async event => {
    event.preventDefault()
    if (busy.current) return
    const normalized = normalizeStaffCode(code)
    if (!normalized) {
      setError('กรุณากรอกรหัสพนักงานเป็นตัวเลข')
      inputRef.current?.focus()
      return
    }
    busy.current = true
    setVerifying(true)
    setError('')
    try {
      requestRef.current = new AbortController()
      const identity = await verifyRepairLedgerStaff(normalized, { signal: requestRef.current.signal })
      if (!alive.current) return
      setCode('')
      onVerified?.(identity)
    } catch (caught) {
      if (!alive.current) return
      setError(caught?.message || 'ยืนยันรหัสพนักงานไม่สำเร็จ กรุณาตรวจสอบรหัสและลองอีกครั้ง')
      inputRef.current?.focus()
    } finally {
      busy.current = false
      if (alive.current) setVerifying(false)
    }
  }

  return <section className={`repair-ledger-identity${embedded ? ' repair-ledger-identity-embedded' : ''}`} aria-labelledby={`${inputId}-title`}>
    <span className="repair-ledger-identity-icon"><ShieldCheck size={28} aria-hidden="true" /></span>
    <span className="repair-ledger-identity-eyebrow">พนักงานทุกคนสามารถกรอกได้</span>
    <h2 id={`${inputId}-title`}>ยืนยันรหัสพนักงานก่อนใช้งาน</h2>
    <p>ใช้รหัสประจำตัวพนักงานของคุณ เพื่อเปิดสมุดคุมงานซ่อมและระบุผู้บันทึกข้อมูล</p>
    <form onSubmit={submit} noValidate>
      <label htmlFor={inputId}>รหัสพนักงาน</label>
      <input ref={inputRef} id={inputId} type="text" inputMode="numeric" autoComplete="off" maxLength={7} value={code} disabled={verifying} placeholder="กรอกรหัสประจำตัวพนักงาน" aria-invalid={Boolean(error)} aria-describedby={`${inputId}-note${error ? ` ${inputId}-error` : ''}`} onChange={event => { setCode(normalizeStaffCode(event.target.value)); setError('') }} />
      {error && <div id={`${inputId}-error`} className="repair-ledger-identity-error" role="alert">{error}</div>}
      <div className="repair-ledger-identity-actions">
        {onCancel && <button type="button" className="repair-ledger-identity-cancel" disabled={verifying} onClick={onCancel}>ยกเลิก</button>}
        <button type="submit" className="repair-ledger-identity-submit" disabled={verifying}>{verifying ? <LoaderCircle size={18} className="repair-ledger-identity-spin" aria-hidden="true" /> : <ArrowRight size={18} aria-hidden="true" />}{verifying ? 'กำลังตรวจสอบรหัส…' : 'ยืนยันรหัสและดำเนินการต่อ'}</button>
      </div>
      <small id={`${inputId}-note`}>ไม่ต้องใช้บัญชีแอดมิน · ใช้รหัสของตนเองเท่านั้น<br />รหัสพนักงานไม่ใช่รหัสผ่าน ระบบจำการยืนยันเฉพาะช่วงใช้งานนี้</small>
    </form>
  </section>
}
