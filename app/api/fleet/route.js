import { createSnapshotCache, snapshotCacheHeaders } from '@/lib/fleetSnapshotCache'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const readSnapshot = createSnapshotCache(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Fleet configuration unavailable')

  // Always use the public role, never a visitor's cookie/token or a service-role key.
  const response = await fetch(`${url}/rest/v1/rpc/get_public_fleet_snapshot`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}',
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Fleet upstream status ${response.status}`)
  const snapshot = await response.json()
  if (!['carsDataRaw', 'activeLogs', 'maintenanceRecords', 'latestLogs'].every(field => Array.isArray(snapshot?.[field]))) {
    throw new Error('Invalid fleet snapshot')
  }
  return snapshot
})

export async function GET(request) {
  // One canonical cache key; arbitrary parameters cannot force fresh database reads.
  if (new URL(request.url).search) {
    return Response.json({ error: 'Unsupported query parameters' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const { value, expiresAt } = await readSnapshot()
    return Response.json(value, { headers: snapshotCacheHeaders(expiresAt) })
  } catch (error) {
    console.error('Public fleet snapshot unavailable:', error.message)
    return Response.json({ error: 'โหลดสถานะรถไม่สำเร็จ กรุณาลองอีกครั้ง' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
