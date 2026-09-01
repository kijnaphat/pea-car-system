'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'
import MileageCorrectionPanel from '@/app/admin/components/MileageCorrectionPanel'
import MaintenanceBillingPanel from '@/app/admin/components/MaintenanceBillingPanel'
import FuelCorrectionPanel from '@/app/admin/components/FuelCorrectionPanel'

export default function DataManagementPanel({
  mileageAnomalyCount,
  pendingBillingCount,
  onAnomalyCountChange,
  onPendingBillingCountChange,
}) {
  const [activeTab, setActiveTab] = useState(pendingBillingCount > 0 ? 'maintenance' : 'mileage')

  const tabs = [
    { id: 'mileage', label: 'เลขไมล์', icon: 'ph:speedometer-duotone', count: mileageAnomalyCount },
    { id: 'fuel', label: 'ข้อมูลเติมน้ำมัน', icon: 'ph:gas-pump-duotone', count: 0, badge: 'ใหม่' },
    { id: 'maintenance', label: 'ข้อมูลซ่อมรอวางบิล', icon: 'ph:receipt-duotone', count: pendingBillingCount },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto rounded-[18px] border border-[#eadfed] bg-white p-2 shadow-sm">
        {tabs.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex min-w-fit flex-1 items-center justify-center gap-2 rounded-[13px] px-4 py-3 text-[12px] font-bold transition-all ${activeTab === tab.id ? 'bg-[#702082] text-white shadow-[0_7px_18px_rgba(112,32,130,.2)]' : 'bg-[#f8f3fa] text-[#765c7c]'}`}>
            <Icon icon={tab.icon} width="19" height="19" />
            {tab.label}
            {tab.badge && <span className={`rounded-full px-2 py-0.5 text-[8px] font-black ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-[#efffc9] text-[#4a6f00]'}`}>{tab.badge}</span>}
            {tab.count > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff453a] px-1.5 py-0.5 text-[9px] font-bold text-white">{tab.count > 99 ? '99+' : tab.count}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'mileage' && <MileageCorrectionPanel onAnomalyCountChange={onAnomalyCountChange} />}
      {activeTab === 'fuel' && <FuelCorrectionPanel />}
      {activeTab === 'maintenance' && <MaintenanceBillingPanel onPendingCountChange={onPendingBillingCountChange} />}
    </div>
  )
}
