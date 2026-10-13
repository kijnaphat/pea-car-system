// Shared, session-scoped history for the sidebar and correction panel. Keep this
// in memory only: mileage/driver history must not survive logout in browser storage.
export const MILEAGE_HISTORY_PAGE_SIZE = 500
export const MILEAGE_HISTORY_CACHE_MS = 5 * 60 * 1000
const cache = new WeakMap()

const LOG_COLUMNS = 'id, created_at, car_id, activity_type, parent_trip_log_id, driver_name, start_time, start_mileage, end_mileage, battery_before, battery_after, is_completed'

async function readAllPages(client, table, columns) {
  const rows = []
  for (let offset = 0; ; offset += MILEAGE_HISTORY_PAGE_SIZE) {
    const { data, error } = await client.from(table).select(columns)
      .order('id', { ascending: true })
      .range(offset, offset + MILEAGE_HISTORY_PAGE_SIZE - 1)
    if (error) throw new Error(`โหลด ${table} ไม่สำเร็จ: ${error.message}`)
    if (!Array.isArray(data)) throw new Error(`โหลด ${table} ไม่สำเร็จ: ไม่ได้รับรายการข้อมูล`)
    rows.push(...data)
    if (data.length < MILEAGE_HISTORY_PAGE_SIZE) return rows
  }
}

export function clearMileageReviewCache(client) {
  cache.delete(client)
}

export async function loadMileageReviewData(client, { forceRefresh = false } = {}) {
  // The session is only a local cache key. Database grants/RLS remain responsible
  // for authorization; do not use local session claims to bypass database access.
  const { data: auth, error: authError } = await client.auth.getSession()
  const userId = auth?.session?.user?.id
  const sessionToken = auth?.session?.access_token
  if (authError || !userId) {
    clearMileageReviewCache(client)
    throw new Error('กรุณาเข้าสู่ระบบผู้ดูแลอีกครั้ง')
  }
  const entry = cache.get(client)
  if (entry?.userId === userId && entry.sessionToken === sessionToken) {
    // Avoid duplicate requests when the menu count and panel mount together.
    if (entry.pending) {
      await entry.pending
      if (forceRefresh) return loadMileageReviewData(client, { forceRefresh: true })
      return loadMileageReviewData(client)
    }
    if (!forceRefresh && entry.data && Date.now() - entry.loadedAt < MILEAGE_HISTORY_CACHE_MS) return entry.data
  }

  const nextEntry = { userId, sessionToken }
  cache.set(client, nextEntry)
  nextEntry.pending = (async () => {
    const [rows, cars, reviews] = await Promise.all([
      readAllPages(client, 'trip_logs', LOG_COLUMNS),
      // Fetch each vehicle once rather than repeating it in every historical row.
      readAllPages(client, 'cars', 'id, plate_number, model, fuel_type'),
      readAllPages(client, 'trip_anomaly_reviews', 'id, trip_log_id, issue_fingerprint, note, reviewed_at'),
    ])
    const carsById = new Map(cars.map(car => [String(car.id), car]))
    return {
      logs: rows.map(row => ({ ...row, cars: carsById.get(String(row.car_id)) || null })),
      reviews,
      loadedAt: Date.now(),
    }
  })()
  try {
    nextEntry.data = await nextEntry.pending
    nextEntry.loadedAt = nextEntry.data.loadedAt
    return nextEntry.data
  } catch (error) {
    if (cache.get(client) === nextEntry) clearMileageReviewCache(client)
    throw error
  } finally {
    nextEntry.pending = null
  }
}
