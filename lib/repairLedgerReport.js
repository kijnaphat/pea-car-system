import { isLedgerDate, isLedgerMonth, ledgerAmountCents, ledgerAmountValue } from './repairLedger.js'

/** Match the calendar used by the usage-date picker, independent of the viewer's timezone. */
export function repairUsageDay(value) {
  if (isLedgerDate(value)) return value
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const part = name => parts.find(item => item.type === name)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function repairReportMonthBounds(month) {
  if (!isLedgerMonth(month)) throw new Error('เดือนรายงานไม่ถูกต้อง')
  const [year, number] = month.split('-').map(Number)
  const next = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`
  return { start: `${month}-01T00:00:00+07:00`, end: `${next}-01T00:00:00+07:00` }
}

/** Keep historical billed repairs until explicitly superseded by their canonical ledger entry. */
export function attachLegacyRepairCosts(trips, repairs, linkedSourceIds = []) {
  const superseded = new Set(linkedSourceIds.map(String))
  const seen = new Set()
  const byTrip = new Map()
  for (const repair of repairs) {
    if (seen.has(String(repair.id)) || superseded.has(String(repair.id))) continue
    seen.add(String(repair.id))
    const entry = byTrip.get(String(repair.y6_trip_log_id)) || { descriptions: [], cents: 0n, known: false }
    const descriptions = (repair.car_maintenance_repair_items || []).map(item => (
      item.repair_item_code === 'other' ? item.custom_text : item.maintenance_repair_items?.name
    )).filter(Boolean)
    entry.descriptions.push(...descriptions)
    const cents = ledgerAmountCents(repair.repair_amount)
    if (cents !== null) { entry.cents += cents; entry.known = true }
    byTrip.set(String(repair.y6_trip_log_id), entry)
  }
  return trips.map(trip => {
    const repair = byTrip.get(String(trip.id))
    return {
      ...trip,
      repair_description: repair?.descriptions.join(', ') || '',
      repair_cost: repair?.known ? `${repair.cents / 100n}.${String(repair.cents % 100n).padStart(2, '0')}` : null,
    }
  })
}

/** Presentation-only rows. Never persisted as trips, or used for mileage, fuel or charging. */
export function appendLedgerRepairRows(usageTrips, entries, { carId, month }) {
  const seen = new Set()
  const repairs = entries.filter(entry => {
    if (!entry.id || seen.has(String(entry.id)) || String(entry.car_id) !== String(carId)
      || !isLedgerDate(entry.usage_date) || entry.usage_date.slice(0, 7) !== month) return false
    seen.add(String(entry.id))
    return true
  }).map(entry => ({
    id: `repair:${entry.id}`, _repairOnly: true, usage_date: entry.usage_date,
    start_time: `${entry.usage_date}T12:00:00+07:00`,
    driver_name: '', location: '', start_mileage: null, end_mileage: null,
    fuel_liters: null, fuel_cost: null, machine_hours: entry.machine_hours,
    repair_description: entry.repair_description || '', repair_cost: ledgerAmountValue(entry.amount),
  }))
  return [...usageTrips, ...repairs].sort((a, b) => {
    const day = repairUsageDay(a.usage_date || a.start_time).localeCompare(repairUsageDay(b.usage_date || b.start_time))
    if (day) return day
    if (Boolean(a._repairOnly) !== Boolean(b._repairOnly)) return a._repairOnly ? 1 : -1
    if (a._repairOnly) return String(a.id).localeCompare(String(b.id))
    return new Date(a.start_time) - new Date(b.start_time)
  })
}

export function repairReportTotalCents(rows) {
  return rows.reduce((sum, row) => sum + (ledgerAmountCents(row.repair_cost) ?? 0n), 0n)
}
