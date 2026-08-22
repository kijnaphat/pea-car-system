'use client'

import { useCallback, useEffect, useState } from 'react'
import { Icon } from '@iconify/react'
import { supabase } from '@/lib/supabaseClient'

const formatDateTime = value => value
  ? new Date(value).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' น.'
  : '-'

export default function MaintenanceBillingPanel({ onPendingCountChange }) {
  const [records, setRecords] = useState([])
  const [repairItems, setRepairItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [selectedCodes, setSelectedCodes] = useState([])
  const [otherText, setOtherText] = useState('')
  const [amount, setAmount] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchPending = useCallback(async () => {
    const [{ data, error }, itemsResult] = await Promise.all([
      supabase
        .from('car_maintenance_records')
        .select('id, car_id, description, completion_note, reported_at, completed_at, cars(plate_number, model), maintenance_issue_categories(name), reported_by:staff!car_maintenance_records_reported_by_staff_id_fkey(full_name), completed_by:staff!car_maintenance_records_completed_by_staff_id_fkey(full_name)')
        .eq('status', 'completed')
        .eq('billing_status', 'pending_invoice')
        .order('completed_at', { ascending: false }),
      supabase
        .from('maintenance_repair_items')
        .select('code, name, display_order')
        .eq('is_active', true)
        .order('display_order'),
    ])

    if (error) console.error('Pending maintenance billing failed:', error)
    else {
      const nextRecords = data || []
      setRecords(nextRecords)
      onPendingCountChange?.(nextRecords.length)
    }
    if (!itemsResult.error) setRepairItems(itemsResult.data || [])
    setLoading(false)
  }, [onPendingCountChange])

  useEffect(() => {
    const initialFetch = window.setTimeout(fetchPending, 0)
    const interval = window.setInterval(fetchPending, 60000)
    return () => {
      window.clearTimeout(initialFetch)
      window.clearInterval(interval)
    }
  }, [fetchPending])

  const openRecord = record => {
    setModal(record)
    setSelectedCodes([])
    setOtherText('')
    setAmount('')
    setErrorMessage('')
  }

  const toggleCode = code => {
    setSelectedCodes(codes => codes.includes(code) ? codes.filter(item => item !== code) : [...codes, code])
  }

  const saveBilling = async () => {
    setErrorMessage('')
    if (selectedCodes.length === 0) return setErrorMessage('กรุณาเลือกรายการซ่อมอย่างน้อย 1 รายการ')
    if (selectedCodes.includes('other') && otherText.trim().length < 2) return setErrorMessage('กรุณาระบุรายการซ่อมอื่น ๆ')
    if (amount === '' || Number(amount) < 0) return setErrorMessage('กรุณากรอกจำนวนเงินตั้งแต่ 0 บาทขึ้นไป')

    setSaving(true)
    const { data, error } = await supabase.rpc('admin_finalize_maintenance_billing', {
      p_maintenance_id: modal.id,
      p_repair_item_codes: selectedCodes,
      p_other_repair_text: selectedCodes.includes('other') ? otherText.trim() : null,
      p_repair_amount: Number(amount),
    })

    if (error || data?.error) {
      setErrorMessage(data?.error || error?.message || 'บันทึกข้อมูลไม่สำเร็จ')
      setSaving(false)
      return
    }

    setModal(null)
    setSaving(false)
    await fetchPending()
    window.alert('✅ บันทึกข้อมูลซ่อมและลงรายการในใบ ยพ.6 เรียบร้อยแล้ว')
  }

  if (loading) return <div className="rounded-[22px] border border-[#eadfed] bg-white py-16 text-center text-[13px] text-[#846c89]">กำลังโหลดรายการรอวางบิล...</div>

  return (
    <>
      <section className="overflow-hidden rounded-[22px] border border-[#eadfed] bg-white shadow-[0_12px_36px_rgba(75,21,96,.07)]">
        <header className="flex flex-col gap-2 border-b border-[#eadfed] bg-[linear-gradient(135deg,#fff8dc,#fbf7fc)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#b36b00]">Pending invoice</p>
            <h2 className="mt-1 text-[20px] font-bold text-[#4b1560]">ข้อมูลซ่อมรอวางบิล</h2>
            <p className="mt-1 text-[11px] text-[#765c7c]">รถเปิดใช้งานแล้ว แต่รายการนี้จะยังไม่แสดงในใบ ยพ.6 จนกว่าจะกรอกครบ</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-[#ff453a] px-3 py-1.5 text-[11px] font-bold text-white"><Icon icon="ph:bell-ringing-fill" width="15" height="15" />รอตรวจ {records.length} รายการ</span>
        </header>

        {records.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <Icon icon="ph:check-circle-duotone" width="48" height="48" className="mx-auto text-[#28a653]" />
            <p className="mt-3 text-[16px] font-bold text-[#4b1560]">ไม่มีข้อมูลซ่อมค้าง</p>
            <p className="mt-1 text-[12px] text-[#846c89]">รายการที่มีบิลครบแล้วถูกส่งลงใบ ยพ.6 เรียบร้อย</p>
          </div>
        ) : (
          <div className="divide-y divide-[#eee4f0]">
            {records.map(record => (
              <article key={record.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[17px] font-bold text-[#4b1560]">{record.cars?.plate_number || `รถ #${record.car_id}`}</h3>
                      <span className="rounded-full bg-[#fff1d6] px-2.5 py-1 text-[10px] font-bold text-[#9a6200]">ยังไม่วางบิล</span>
                    </div>
                    <p className="mt-1 text-[12px] font-semibold text-[#765c7c]">{record.maintenance_issue_categories?.name || 'ปัญหารถ'} · {record.cars?.model || '-'}</p>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#5f4964]">{record.description}</p>
                    <p className="mt-2 text-[10px] text-[#927a98]">เปิดรถเมื่อ {formatDateTime(record.completed_at)} · โดย {record.completed_by?.full_name || '-'}</p>
                  </div>
                  <button type="button" onClick={() => openRecord(record)} className="flex shrink-0 items-center justify-center gap-2 rounded-[14px] bg-[#702082] px-4 py-3 text-[12px] font-bold text-white active:scale-[.98]"><Icon icon="ph:receipt-duotone" width="19" height="19" />กรอกข้อมูลวางบิล</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {modal && (
        <div className="fixed inset-0 z-[1300] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button className="absolute inset-0 bg-[#24102b]/60 backdrop-blur-sm" onClick={saving ? undefined : () => setModal(null)} aria-label="ปิด" />
          <section className="relative z-10 max-h-[92dvh] w-full max-w-[500px] overflow-y-auto rounded-t-[26px] bg-[#f8f3fa] p-4 shadow-2xl sm:rounded-[26px] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#b36b00]">กรอกข้อมูลซ่อม</p><h2 className="mt-1 text-[21px] font-bold text-[#4b1560]">{modal.cars?.plate_number}</h2></div>
              <button onClick={() => setModal(null)} disabled={saving} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eadfed] text-[#702082]"><Icon icon="ph:x-bold" width="16" height="16" /></button>
            </div>

            <div className="mt-4 rounded-[15px] bg-[#fff8e8] p-3 text-[12px] leading-relaxed text-[#745325]">{modal.description}</div>

            <div className="mt-4 rounded-[18px] bg-white p-4">
              <label className="text-[11px] font-bold text-[#765c7c]">รายการซ่อมจริง (เลือกได้หลายรายการ)</label>
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {repairItems.map(item => {
                  const checked = selectedCodes.includes(item.code)
                  return <button key={item.code} type="button" onClick={() => toggleCode(item.code)} className={`flex w-full items-center gap-3 rounded-[11px] px-3 py-2.5 text-left text-[13px] ${checked ? 'bg-[#f0e5f3] font-bold text-[#702082]' : 'bg-[#faf7fb] text-[#5e4863]'}`}><Icon icon={checked ? 'ph:check-square-fill' : 'ph:square'} width="20" height="20" />{item.name}</button>
                })}
              </div>
              {selectedCodes.includes('other') && <input value={otherText} onChange={event => setOtherText(event.target.value)} maxLength={300} placeholder="ระบุรายการซ่อมอื่น ๆ" className="mt-3 w-full rounded-[13px] bg-[#f8f3fa] px-4 py-3 text-[13px] text-[#4b1560] outline-none focus:ring-2 focus:ring-[#702082]/15" />}

              <label className="mt-4 block text-[11px] font-bold text-[#765c7c]">จำนวนเงินค่าซ่อม (บาท)</label>
              <input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={event => setAmount(event.target.value)} placeholder="0.00" className="mt-2 w-full rounded-[13px] bg-[#f8f3fa] px-4 py-3.5 text-[18px] font-bold text-[#4b1560] outline-none focus:ring-2 focus:ring-[#702082]/15" />
            </div>

            {errorMessage && <div className="mt-3 rounded-[13px] bg-[#fff0ef] px-4 py-3 text-[12px] font-bold text-[#c7352c]">{errorMessage}</div>}
            <button onClick={saveBilling} disabled={saving} className="mt-4 flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#28a653] py-4 text-[15px] font-bold text-white disabled:bg-[#adbaaF]"><Icon icon={saving ? 'ph:spinner-gap-bold' : 'ph:check-circle-duotone'} width="21" height="21" className={saving ? 'animate-spin' : ''} />{saving ? 'กำลังบันทึก...' : 'บันทึกและลงใบ ยพ.6'}</button>
          </section>
        </div>
      )}
    </>
  )
}
