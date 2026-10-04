const CHANGE_KEY = 'kpn:fleet-changed-at'
const CHANGE_LIFETIME_MS = 120000

export function markFleetChanged() {
  try { window.sessionStorage.setItem(CHANGE_KEY, String(Date.now())) } catch { /* Storage can be disabled. */ }
}

export async function loadFleetSnapshot({ fresh = false, loadFresh, fetchSnapshot = () => fetch('/api/fleet'), storage, now = Date.now() }) {
  let marker
  try {
    marker = storage?.getItem(CHANGE_KEY)
    if (marker && now - Number(marker) >= 0 && now - Number(marker) < CHANGE_LIFETIME_MS) fresh = true
    else if (marker) storage?.removeItem(CHANGE_KEY)
  } catch { /* Shared reads work without browser storage. */ }

  let snapshot
  if (fresh) {
    snapshot = await loadFresh()
  } else {
    const response = await fetchSnapshot()
    if (!response.ok) throw new Error('โหลดสถานะรถไม่สำเร็จ กรุณาลองอีกครั้ง')
    snapshot = await response.json()
  }
  if (!['carsDataRaw', 'activeLogs', 'maintenanceRecords', 'latestLogs'].every(key => Array.isArray(snapshot?.[key]))) {
    throw new Error('ข้อมูลสถานะรถไม่ครบถ้วน')
  }
  // Only consume the marker after a successful read; keep newer concurrent changes.
  if (fresh && marker) {
    try { if (storage?.getItem(CHANGE_KEY) === marker) storage.removeItem(CHANGE_KEY) } catch { /* Optional storage. */ }
  }
  return snapshot
}
