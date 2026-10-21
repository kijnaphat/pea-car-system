import test from 'node:test'
import assert from 'node:assert/strict'
import { appendLedgerRepairRows, attachLegacyRepairCosts, repairReportMonthBounds, repairReportTotalCents, repairUsageDay } from '../lib/repairLedgerReport.js'
import { monthlyReportData } from '../lib/tripActivity.js'

const trip = { id: 10, car_id: 5, activity_type: 'usage', start_time: '2026-10-17T18:00:00Z', start_mileage: 100, end_mileage: 120, fuel_liters: 2, fuel_cost: 60 }
const entry = { id: 'entry-a', car_id: 5, usage_date: '2026-10-18', repair_description: 'เปลี่ยนยาง', amount: '125.10', machine_hours: '2.50', source_id: 'source-a' }

test('report bounds and usage dates use Bangkok, exclusive next-month boundary', () => {
  assert.equal(repairUsageDay(trip.start_time), '2026-10-18')
  assert.equal(repairUsageDay('invalid'), '')
  assert.deepEqual(repairReportMonthBounds('2026-12'), { start: '2026-12-01T00:00:00+07:00', end: '2027-01-01T00:00:00+07:00' })
  assert.throws(() => repairReportMonthBounds('2026-13'))
})

test('one canonical repair is shown once despite several trips that day or a duplicated response', () => {
  const trips = [trip, { ...trip, id: 11, start_time: '2026-10-18T07:00:00Z' }]
  const rows = appendLedgerRepairRows(trips, [entry, entry], { carId: 5, month: '2026-10' })
  assert.equal(rows.length, 3)
  assert.equal(rows.filter(row => row._repairOnly).length, 1)
  assert.equal(repairReportTotalCents(rows), 12510n)
  assert.equal(rows.at(-1).usage_date, '2026-10-18')
  assert.equal(rows.at(-1).start_mileage, null)
  assert.equal(rows.at(-1).fuel_liters, null)
  assert.equal(trips.reduce((sum, row) => sum + row.end_mileage - row.start_mileage, 0), 40)
  assert.equal(trip.repair_cost, undefined, 'no trip object mutation')
})

test('unknown amount is not zero; real zero stays known and decimals total exactly', () => {
  const rows = appendLedgerRepairRows([], [
    { ...entry, id: 'unknown', amount: null }, { ...entry, id: 'zero', amount: '0.00' },
    { ...entry, id: 'a', amount: '0.10' }, { ...entry, id: 'b', amount: '0.20' },
  ], { carId: 5, month: '2026-10' })
  assert.equal(rows.find(row => row.id === 'repair:unknown').repair_cost, null)
  assert.equal(rows.find(row => row.id === 'repair:zero').repair_cost, '0.00')
  assert.equal(repairReportTotalCents(rows), 30n)
})

test('backdating selects usage_date, never bill/creation/actual repair date; other car/month and unmapped history excluded', () => {
  const rows = appendLedgerRepairRows([], [
    { ...entry, repair_date: '2026-11-20', paid_date: '2026-12-01' },
    { ...entry, id: 'wrong-car', car_id: 6 }, { ...entry, id: 'wrong-month', usage_date: '2026-09-18' },
    { ...entry, id: 'legacy', usage_date: null },
  ], { carId: 5, month: '2026-10' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].usage_date, '2026-10-18')
})

test('linked maintenance is superseded across months, unlinked legacy remains once', () => {
  const legacy = id => ({ id, y6_trip_log_id: 10, repair_amount: '2.05', car_maintenance_repair_items: [{ repair_item_code: 'other', custom_text: 'งานเดิม' }] })
  const rows = attachLegacyRepairCosts([trip], [legacy('source-a'), legacy('source-b'), legacy('source-b')], ['source-a'])
  assert.equal(rows[0].repair_cost, '2.05')
  assert.equal(rows[0].repair_description, 'งานเดิม')
  assert.equal(attachLegacyRepairCosts([trip], [legacy('source-a')], ['source-a'])[0].repair_cost, null)
})

test('EV ledger rows are appended only after usage filtering, mileage boundaries and charging report stay intact', () => {
  const car = { fuel_type: 'EV' }
  const charge = { ...trip, id: 20, activity_type: 'charge', start_time: '2026-10-18T01:00:00Z', end_mileage: 110 }
  const data = monthlyReportData([trip, charge], car, 'usage')
  assert.equal(data.rows.length, 1)
  assert.equal(appendLedgerRepairRows(data.rows, [entry], { carId: 5, month: '2026-10' }).length, 2)
  assert.equal(data.startMileage, 100)
  const charging = monthlyReportData([trip, charge], car, 'charge')
  assert.deepEqual(charging.rows, [charge])
  assert.equal(repairReportTotalCents(charging.rows), 0n)
})
