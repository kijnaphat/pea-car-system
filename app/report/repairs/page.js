'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import RepairLedger from '../components/RepairLedger'

function RepairLedgerPage() {
  const params = useSearchParams()
  return <RepairLedger initialCarId={params.get('car_id') || ''} initialMonth={params.get('month') || ''} />
}

export default function Page() {
  return <Suspense fallback={<div role="status" className="p-8 text-center">กำลังเปิดสมุดคุมงานซ่อม…</div>}><RepairLedgerPage /></Suspense>
}
