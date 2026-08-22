'use client'

import { useEffect, useRef, useState } from 'react'
import { Icon } from '@iconify/react'
import { supabase } from '@/lib/supabaseClient'
import { normalizeStaffCode } from '@/lib/staffCode'

const MODE_COPY = {
  report: {
    eyebrow: 'แจ้งสภาพรถ',
    title: 'แจ้งรถชำรุด',
    description: 'รถจะเปลี่ยนเป็นสถานะกำลังซ่อมและไม่สามารถนำออกได้',
    submit: 'ยืนยันส่งซ่อม',
    icon: 'ph:wrench-duotone',
  },
  complete: {
    eyebrow: 'ปิดงานซ่อม',
    title: 'เปิดใช้งานรถอีกครั้ง',
    description: 'บันทึกรายการซ่อมและเปิดรถกลับมาใช้งาน หากยังไม่มีบิลสามารถส่งให้ Admin กรอกภายหลังได้',
    submit: 'ยืนยันเปิดใช้งานรถ',
    icon: 'ph:check-circle-duotone',
  },
  return: {
    eyebrow: 'คืนรถพร้อมแจ้งปัญหา',
    title: 'คืนรถและส่งซ่อม',
    description: 'ระบบจะปิดรายการใช้งานปัจจุบันและส่งรถเข้าซ่อมพร้อมกัน',
    submit: 'ยืนยันคืนรถและส่งซ่อม',
    icon: 'ph:car-profile-duotone',
  },
}

export default function MaintenanceActionModal({
  isOpen,
  mode = 'report',
  car,
  maintenanceRecord,
  returnPayload,
  onClose,
  onSuccess,
}) {
  const copy = MODE_COPY[mode] || MODE_COPY.report
  const isComplete = mode === 'complete'
  const [categories, setCategories] = useState([])
  const [repairItems, setRepairItems] = useState([])
  const [staffCode, setStaffCode] = useState('')
  const [staff, setStaff] = useState(null)
  const [staffError, setStaffError] = useState('')
  const [categoryCode, setCategoryCode] = useState('')
  const [description, setDescription] = useState('')
  const [completionNote, setCompletionNote] = useState('ตรวจสอบและซ่อมเรียบร้อยแล้ว')
  const [billingStatus, setBillingStatus] = useState('billed')
  const [selectedRepairCodes, setSelectedRepairCodes] = useState([])
  const [otherRepairText, setOtherRepairText] = useState('')
  const [repairAmount, setRepairAmount] = useState('')
  const [repairListOpen, setRepairListOpen] = useState(false)
  const [repairSearch, setRepairSearch] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const lookupSequenceRef = useRef(0)

  useEffect(() => {
    if (!isOpen) return
    setStaffCode('')
    setStaff(null)
    setStaffError('')
    setCategoryCode('')
    setDescription('')
    setCompletionNote('ตรวจสอบและซ่อมเรียบร้อยแล้ว')
    setBillingStatus('billed')
    setSelectedRepairCodes([])
    setOtherRepairText('')
    setRepairAmount('')
    setRepairListOpen(false)
    setRepairSearch('')
    setErrorMessage('')
    setSubmitting(false)
    lookupSequenceRef.current += 1

    if (isComplete) {
      supabase
        .from('maintenance_repair_items')
        .select('code, name, display_order')
        .eq('is_active', true)
        .order('display_order')
        .then(({ data, error }) => {
          if (error) setErrorMessage('โหลดรายการซ่อมไม่สำเร็จ กรุณาลองใหม่')
          else setRepairItems(data || [])
        })
    } else {
      supabase
        .from('maintenance_issue_categories')
        .select('code, name, display_order')
        .eq('is_active', true)
        .order('display_order')
        .then(({ data, error }) => {
          if (error) setErrorMessage('โหลดประเภทปัญหาไม่สำเร็จ กรุณาลองใหม่')
          else setCategories(data || [])
        })
    }
  }, [isOpen, isComplete, car?.id, mode])

  const verifyStaff = async (rawCode = staffCode) => {
    const normalized = normalizeStaffCode(rawCode)
    setStaffCode(normalized)
    setStaff(null)
    setStaffError('')

    if (normalized.length < 6) {
      setStaffError('กรุณากรอกรหัสพนักงานให้ครบ')
      return null
    }

    const sequence = ++lookupSequenceRef.current
    const { data, error } = await supabase
      .rpc('get_staff_by_code', { p_staff_code: normalized })
      .maybeSingle()

    if (sequence !== lookupSequenceRef.current) return null
    if (error) {
      setStaffError('เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง')
      return null
    }
    if (!data) {
      setStaffError('ไม่พบรหัสพนักงานนี้')
      return null
    }

    setStaff(data)
    return data
  }

  const handleSubmit = async () => {
    setErrorMessage('')
    const verifiedStaff = staff || await verifyStaff(staffCode)
    if (!verifiedStaff) return

    if (!isComplete && !categoryCode) {
      setErrorMessage('กรุณาเลือกประเภทปัญหา')
      return
    }
    if (!isComplete && description.trim().length < 3) {
      setErrorMessage('กรุณาระบุรายละเอียดอาการอย่างน้อย 3 ตัวอักษร')
      return
    }
    if (isComplete && completionNote.trim().length < 3) {
      setErrorMessage('กรุณาระบุผลการตรวจหรือการซ่อมอย่างน้อย 3 ตัวอักษร')
      return
    }
    if (isComplete && billingStatus === 'billed') {
      if (selectedRepairCodes.length === 0) {
        setErrorMessage('กรุณาเลือกรายการซ่อมอย่างน้อย 1 รายการ')
        return
      }
      if (selectedRepairCodes.includes('other') && otherRepairText.trim().length < 2) {
        setErrorMessage('กรุณาระบุรายละเอียดรายการซ่อมอื่น ๆ')
        return
      }
      if (repairAmount === '' || Number(repairAmount) < 0) {
        setErrorMessage('กรุณากรอกจำนวนเงินค่าซ่อมตั้งแต่ 0 บาทขึ้นไป')
        return
      }
    }

    setSubmitting(true)
    try {
      let request
      if (mode === 'complete') {
        request = supabase.rpc('complete_car_maintenance_v2', {
          p_car_id: Number(car.id),
          p_staff_code: staffCode,
          p_completion_note: completionNote.trim(),
          p_billing_status: billingStatus,
          p_repair_item_codes: billingStatus === 'billed' ? selectedRepairCodes : [],
          p_other_repair_text: billingStatus === 'billed' && selectedRepairCodes.includes('other') ? otherRepairText.trim() : null,
          p_repair_amount: billingStatus === 'billed' ? Number(repairAmount) : null,
        })
      } else if (mode === 'return') {
        request = supabase.rpc('return_car_and_report_maintenance', {
          p_car_id: Number(car.id),
          p_staff_code: staffCode,
          p_end_mileage: returnPayload?.endMileage ?? null,
          p_fuel_liters: returnPayload?.fuelLiters ?? 0,
          p_fuel_cost: returnPayload?.fuelCost ?? 0,
          p_battery_after: returnPayload?.batteryAfter ?? null,
          p_issue_category_code: categoryCode,
          p_description: description.trim(),
        })
      } else {
        request = supabase.rpc('report_car_maintenance', {
          p_car_id: Number(car.id),
          p_staff_code: staffCode,
          p_issue_category_code: categoryCode,
          p_description: description.trim(),
        })
      }

      const { data, error } = await request
      if (error) throw error
      if (data?.error) {
        setErrorMessage(data.error)
        return
      }

      const successMessage = mode === 'complete'
        ? billingStatus === 'pending_invoice'
          ? '✅ เปิดใช้งานรถแล้ว และส่งรายการรอข้อมูลวางบิลให้ Admin เรียบร้อย'
          : '✅ เปิดใช้งานรถและบันทึกรายการซ่อมลงใบ ยพ.6 เรียบร้อยแล้ว'
        : mode === 'return'
          ? '✅ คืนรถและส่งซ่อมเรียบร้อยแล้ว'
          : '✅ แจ้งส่งซ่อมเรียบร้อยแล้ว'
      window.alert(successMessage)
      onSuccess?.(data)
    } catch (error) {
      console.error('Maintenance action failed:', error)
      setErrorMessage(error.message || 'บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen || !car) return null

  const visibleRepairItems = repairItems.filter(item => (
    !repairSearch.trim() || item.name.toLocaleLowerCase('th-TH').includes(repairSearch.trim().toLocaleLowerCase('th-TH'))
  ))

  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-labelledby="maintenance-modal-title">
      <button className="absolute inset-0 bg-[#24102b]/60 backdrop-blur-sm" onClick={submitting ? undefined : onClose} aria-label="ปิดหน้าต่าง" />
      <section className="relative z-10 flex max-h-[92dvh] w-full max-w-[470px] flex-col overflow-hidden rounded-t-[28px] bg-[#f8f3fa] shadow-[0_-16px_60px_rgba(44,13,51,.3)] sm:rounded-[28px]">
        <header className="relative overflow-hidden bg-[linear-gradient(135deg,#8b5200_0%,#d57a00_55%,#f0a61a_100%)] px-5 pb-5 pt-4 text-white">
          <div className="absolute -bottom-16 -right-10 h-44 w-44 rounded-full border-[22px] border-white/10" />
          <div className="relative mx-auto mb-4 h-1 w-10 rounded-full bg-white/45 sm:hidden" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px] bg-white/18 ring-1 ring-white/25"><Icon icon={copy.icon} width="29" height="29" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[.12em] text-[#fff1b8]">{copy.eyebrow}</p>
                <h2 id="maintenance-modal-title" className="truncate text-[22px] font-bold">{copy.title}</h2>
                <p className="mt-0.5 truncate text-[13px] font-semibold text-white/85">{car.plate_number}</p>
              </div>
            </div>
            <button onClick={onClose} disabled={submitting} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 active:scale-90" aria-label="ปิด"><Icon icon="ph:x-bold" width="17" height="17" /></button>
          </div>
          <p className="relative mt-4 text-[12px] leading-relaxed text-white/85">{copy.description}</p>
        </header>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          {isComplete && maintenanceRecord && (
            <div className="mb-3 rounded-[18px] border border-[#f2d08d] bg-[#fff9e9] p-4">
              <p className="text-[10px] font-bold tracking-[.08em] text-[#9a6200]">รายการที่กำลังซ่อม</p>
              <p className="mt-1 text-[15px] font-bold text-[#553306]">{maintenanceRecord.maintenance_issue_categories?.name || 'ปัญหารถ'}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#765b31]">{maintenanceRecord.description}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="rounded-[18px] border border-[#eadfed] bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <label className="text-[11px] font-bold text-[#765c7c]">รหัสพนักงานผู้ดำเนินการ</label>
                {staff && <button onClick={() => { setStaff(null); setStaffCode(''); setStaffError(''); lookupSequenceRef.current += 1 }} className="text-[11px] font-bold text-[#702082]">เปลี่ยนรหัส</button>}
              </div>
              {!staff ? (
                <input
                  value={staffCode}
                  onChange={event => { lookupSequenceRef.current += 1; setStaffCode(normalizeStaffCode(event.target.value)); setStaff(null); setStaffError('') }}
                  onBlur={event => verifyStaff(event.currentTarget.value)}
                  onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={7}
                  enterKeyHint="done"
                  autoComplete="off"
                  placeholder="กรอกรหัสพนักงาน แล้วกด Enter"
                  className={`w-full rounded-[14px] border-[1.5px] px-4 py-3.5 text-[17px] font-semibold outline-none ${staffError ? 'border-[#ff453a] bg-[#fff2f1] text-[#c92d25]' : 'border-transparent bg-[#f8f3fa] text-[#4b1560] focus:border-[#702082] focus:bg-white'}`}
                />
              ) : (
                <div className="flex items-center gap-3 rounded-[14px] bg-[#effaf3] px-3.5 py-3">
                  <Icon icon="ph:user-circle-check-duotone" width="31" height="31" className="text-[#20a653]" />
                  <div className="min-w-0"><p className="truncate text-[14px] font-bold text-[#225a36]">{staff.full_name}</p><p className="truncate text-[11px] text-[#65846f]">{staff.position || 'พนักงาน'}</p></div>
                </div>
              )}
              {staffError && <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#d7332a]"><Icon icon="ph:warning-circle-fill" width="15" height="15" />{staffError}</p>}
            </div>

            {!isComplete && (
              <div className="rounded-[18px] border border-[#eadfed] bg-white p-4 shadow-sm">
                <label className="text-[11px] font-bold text-[#765c7c]">ประเภทปัญหา</label>
                <select value={categoryCode} onChange={event => setCategoryCode(event.target.value)} className="mt-2 w-full appearance-none rounded-[14px] border-[1.5px] border-transparent bg-[#f8f3fa] px-4 py-3.5 text-[15px] font-semibold text-[#4b1560] outline-none focus:border-[#d57a00] focus:bg-white">
                  <option value="">-- เลือกประเภทปัญหา --</option>
                  {categories.map(category => <option key={category.code} value={category.code}>{category.name}</option>)}
                </select>
              </div>
            )}

            {isComplete && (
              <>
                <div className="rounded-[18px] border border-[#eadfed] bg-white p-4 shadow-sm">
                  <label className="text-[11px] font-bold text-[#765c7c]">สถานะใบวางบิล</label>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setBillingStatus('billed')} className={`rounded-[14px] border px-3 py-3 text-left ${billingStatus === 'billed' ? 'border-[#28a653] bg-[#effaf3] text-[#207c42]' : 'border-[#eadfed] bg-[#faf7fb] text-[#765c7c]'}`}>
                      <span className="block text-[13px] font-bold">มีข้อมูลบิลแล้ว</span>
                      <span className="mt-0.5 block text-[10px]">กรอกรายการและยอดเงิน</span>
                    </button>
                    <button type="button" onClick={() => setBillingStatus('pending_invoice')} className={`rounded-[14px] border px-3 py-3 text-left ${billingStatus === 'pending_invoice' ? 'border-[#d57a00] bg-[#fff8e8] text-[#8a5200]' : 'border-[#eadfed] bg-[#faf7fb] text-[#765c7c]'}`}>
                      <span className="block text-[13px] font-bold">ยังไม่วางบิล</span>
                      <span className="mt-0.5 block text-[10px]">ส่งให้ Admin กรอกภายหลัง</span>
                    </button>
                  </div>
                  {billingStatus === 'pending_invoice' && (
                    <div className="mt-3 flex items-start gap-2 rounded-[13px] bg-[#fff3d6] px-3 py-2.5 text-[11px] leading-relaxed text-[#805000]">
                      <Icon icon="ph:bell-ringing-duotone" width="18" height="18" className="mt-0.5 shrink-0" />
                      <span>รถจะเปิดใช้งานได้ทันที แต่ยังไม่ลงใบ ยพ.6 จนกว่า Admin จะกรอกรายการซ่อมและจำนวนเงินครบ</span>
                    </div>
                  )}
                </div>

                {billingStatus === 'billed' && (
                  <div className="rounded-[18px] border border-[#eadfed] bg-white p-4 shadow-sm">
                    <label className="text-[11px] font-bold text-[#765c7c]">รายการซ่อมจริง (เลือกได้หลายรายการ)</label>
                    <button type="button" onClick={() => setRepairListOpen(value => !value)} className="mt-2 flex w-full items-center justify-between rounded-[14px] bg-[#f8f3fa] px-4 py-3.5 text-left text-[14px] font-semibold text-[#4b1560]">
                      <span>{selectedRepairCodes.length > 0 ? `เลือกแล้ว ${selectedRepairCodes.length} รายการ` : '-- เลือกรายการซ่อม --'}</span>
                      <Icon icon={repairListOpen ? 'ph:caret-up-bold' : 'ph:caret-down-bold'} width="16" height="16" />
                    </button>
                    {repairListOpen && (
                      <div className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-[14px] border border-[#eadfed] bg-white p-2">
                        <div className="sticky top-0 z-10 bg-white pb-1">
                          <div className="relative">
                            <Icon icon="ph:magnifying-glass" width="17" height="17" className="absolute left-3 top-1/2 -translate-y-1/2 text-[#927a98]" />
                            <input value={repairSearch} onChange={event => setRepairSearch(event.target.value)} placeholder="ค้นหารายการซ่อม" className="w-full rounded-[11px] bg-[#f8f3fa] py-2.5 pl-9 pr-3 text-[12px] text-[#4b1560] outline-none focus:ring-2 focus:ring-[#702082]/15" />
                          </div>
                        </div>
                        {visibleRepairItems.map(item => {
                          const checked = selectedRepairCodes.includes(item.code)
                          return (
                            <button key={item.code} type="button" onClick={() => setSelectedRepairCodes(codes => checked ? codes.filter(code => code !== item.code) : [...codes, item.code])} className={`flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left text-[13px] ${checked ? 'bg-[#f0e5f3] font-bold text-[#702082]' : 'text-[#5e4863]'}`}>
                              <Icon icon={checked ? 'ph:check-square-fill' : 'ph:square'} width="20" height="20" className={checked ? 'text-[#702082]' : 'text-[#b7a6bb]'} />
                              {item.name}
                            </button>
                          )
                        })}
                        {visibleRepairItems.length === 0 && <p className="py-5 text-center text-[11px] text-[#927a98]">ไม่พบรายการที่ค้นหา</p>}
                      </div>
                    )}
                    {selectedRepairCodes.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedRepairCodes.map(code => <span key={code} className="rounded-full bg-[#f0e5f3] px-2.5 py-1 text-[10px] font-bold text-[#702082]">{repairItems.find(item => item.code === code)?.name || code}</span>)}
                      </div>
                    )}
                    {selectedRepairCodes.includes('other') && (
                      <input value={otherRepairText} onChange={event => setOtherRepairText(event.target.value)} maxLength={300} placeholder="ระบุรายการซ่อมอื่น ๆ" className="mt-3 w-full rounded-[14px] border-[1.5px] border-transparent bg-[#f8f3fa] px-4 py-3 text-[14px] text-[#4b1560] outline-none focus:border-[#d57a00] focus:bg-white" />
                    )}
                    <label className="mt-4 block text-[11px] font-bold text-[#765c7c]">จำนวนเงินค่าซ่อม (บาท)</label>
                    <div className="relative mt-2">
                      <input type="number" min="0" step="0.01" inputMode="decimal" value={repairAmount} onChange={event => setRepairAmount(event.target.value)} placeholder="0.00" className="w-full rounded-[14px] border-[1.5px] border-transparent bg-[#f8f3fa] px-4 py-3.5 pr-14 text-[18px] font-bold text-[#4b1560] outline-none focus:border-[#d57a00] focus:bg-white" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] font-bold text-[#927a98]">บาท</span>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="rounded-[18px] border border-[#eadfed] bg-white p-4 shadow-sm">
              <label className="text-[11px] font-bold text-[#765c7c]">{isComplete ? 'ผลการตรวจหรือการซ่อม' : 'รายละเอียดอาการ'}</label>
              <textarea
                value={isComplete ? completionNote : description}
                onChange={event => isComplete ? setCompletionNote(event.target.value) : setDescription(event.target.value)}
                maxLength={1000}
                rows={4}
                placeholder={isComplete ? 'เช่น เปลี่ยนยางและตรวจสอบเรียบร้อยแล้ว' : 'เช่น ยางหน้าซ้ายแบน มีเสียงผิดปกติขณะขับ'}
                className="mt-2 w-full resize-none rounded-[14px] border-[1.5px] border-transparent bg-[#f8f3fa] px-4 py-3.5 text-[14px] leading-relaxed text-[#4b1560] outline-none focus:border-[#d57a00] focus:bg-white"
              />
            </div>

            {errorMessage && <div className="flex items-start gap-2 rounded-[15px] border border-[#ffd2cf] bg-[#fff1f0] px-4 py-3 text-[12px] font-semibold text-[#c7352c]"><Icon icon="ph:warning-circle-duotone" width="19" height="19" className="shrink-0" /><span>{errorMessage}</span></div>}

            <button onClick={handleSubmit} disabled={submitting} className={`flex w-full items-center justify-center gap-2 rounded-[18px] py-4 text-[16px] font-bold text-white transition-transform active:scale-[.98] ${submitting ? 'bg-[#b8a796]' : isComplete ? 'bg-[#28a653] shadow-[0_9px_22px_rgba(40,166,83,.25)]' : 'bg-[#d57a00] shadow-[0_9px_22px_rgba(213,122,0,.25)]'}`}>
              <Icon icon={submitting ? 'ph:spinner-gap-bold' : copy.icon} width="22" height="22" className={submitting ? 'animate-spin' : ''} />
              {submitting ? 'กำลังบันทึก...' : copy.submit}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
