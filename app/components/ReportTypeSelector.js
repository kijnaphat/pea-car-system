'use client'

export default function ReportTypeSelector({ value, onChange, count }) {
  return (
    <section aria-label="เลือกแบบรายงานรถ EV" className="print:hidden rounded-2xl bg-white p-3 space-y-2 border border-[#eadfed]">
      <p className="text-sm font-bold text-[#4b1560]">รายงานรถ EV มี 2 แบบ</p>
      <div className="grid grid-cols-2 gap-2">
        {[{ value: 'usage', title: 'รายงานการใช้งาน', detail: 'แบบรถน้ำมัน · ยพ.6' },
          { value: 'charge', title: 'รายงานการชาร์จ EV', detail: 'แบบ EV เดิม' }].map(option => (
          <button key={option.value} type="button" aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-xl border-2 p-3 text-left transition-colors ${value === option.value ? 'border-[#702082] bg-[#f2e9f7] text-[#4b1560]' : 'border-[#eadfed] text-[#765c7c]'}`}>
            <span className="block text-sm font-bold">{option.title}</span>
            <span className="block text-xs mt-1">{option.detail}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-[#765c7c]" role="status">
        {value === 'usage' ? 'เฉพาะเที่ยวขับ · ไม่รวมการชาร์จ · ไม่ใช้น้ำมัน' : 'เฉพาะการชาร์จ · รวมประวัติชาร์จเดิม'} · {count} รายการ
      </p>
    </section>
  )
}
