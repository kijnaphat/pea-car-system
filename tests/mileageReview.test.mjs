import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTripSequence, getTripIssues, getIssueFingerprint, countPendingAnomalies } from '../lib/tripAnomalies.js'
import { loadMileageReviewData, clearMileageReviewCache, MILEAGE_HISTORY_CACHE_MS } from '../lib/mileageReviewData.js'
import { readFileSync } from 'node:fs'

const ev = { id: 24, fuel_type: 'EV', plate_number: 'EV test' }
const charge = (id, reading, date) => ({ id, car_id: 24, cars: ev, start_time: date, start_mileage: reading, end_mileage: reading, battery_before: 49, battery_after: 80, is_completed: true })
const example = [charge(3314, 61589, '2026-09-08T01:57:00Z'), charge(3342, 616950, '2026-09-09T04:24:00Z'), charge(3366, 61924, '2026-09-10T07:25:00Z')]
const codes = row => getTripIssues(row).map(issue => issue.code)

test('equal EV charge readings of 616,950 still flag the jump and following contradiction', () => {
  const bad = buildTripSequence(example).find(row => row.id === 3342)
  assert.deepEqual(codes(bad), ['ev_mileage_jump', 'ev_mileage_after_next'])
  assert.equal(bad.previousTrip.end_mileage, 61589)
  assert.equal(bad.nextTrip.start_mileage, 61924)
  assert.equal(codes(bad).includes('ev_mileage_changed'), false)
})

test('a plausible charging interval does not require consecutive readings to be equal', () => {
  const rows = buildTripSequence([example[0], charge(3342, 61695, example[1].start_time), example[2]])
  assert.equal(countPendingAnomalies(rows), 0)
})

test('EV driving does not get charging-only battery warnings', () => {
  const row = { id: 1, car_id: 24, cars: ev, activity_type: 'usage', start_mileage: 63850, end_mileage: 64032, is_completed: true }
  assert.deepEqual(codes(row), [])
})

test('a charge within an unfinished task validates only the parent start, not unrelated next trips', () => {
  const parent = { id: 1, car_id: 24, cars: ev, activity_type: 'usage', start_time: '2026-10-07T01:00:00Z', start_mileage: 100, end_mileage: null, is_completed: false }
  const child = { ...charge(2, 120, '2026-10-07T02:00:00Z'), activity_type: 'charge', parent_trip_log_id: 1 }
  const next = { ...parent, id: 3, start_time: '2026-10-08T01:00:00Z', start_mileage: 100 }
  const row = buildTripSequence([parent, child, next]).find(item => item.id === 2)
  assert.deepEqual(codes(row), [])
  assert.deepEqual(codes({ ...row, start_mileage: 90, end_mileage: 90 }), ['ev_mileage_outside_parent'])
})

test('a completed parent bounds the charging reading without splitting the driving sequence', () => {
  const parent = { id: 1, car_id: 24, cars: ev, activity_type: 'usage', start_time: '2026-10-07T01:00:00Z', start_mileage: 100, end_mileage: 150, is_completed: true }
  const child = { ...charge(2, 600000, '2026-10-07T02:00:00Z'), activity_type: 'charge', parent_trip_log_id: 1 }
  const next = { ...parent, id: 3, start_time: '2026-10-08T01:00:00Z', start_mileage: 150, end_mileage: 180 }
  const sequence = buildTripSequence([parent, child, next])
  assert.ok(codes(sequence.find(item => item.id === 2)).includes('ev_mileage_outside_parent'))
  assert.deepEqual(codes(sequence.find(item => item.id === 3)), [])
})

test('existing EV battery reviews remain compatible; changed mileage context reopens a reviewed warning', () => {
  const battery = { ...example[0], battery_after: 20 }
  assert.equal(getIssueFingerprint(battery), JSON.stringify({ version: 1, issue_codes: ['ev_battery_not_increased'], start_mileage: 61589, end_mileage: 61589, battery_before: 49, battery_after: 20, previous_end_mileage: null }))
  const sequence = buildTripSequence(example)
  const bad = sequence.find(row => row.id === 3342)
  const reviewed = [{ trip_log_id: bad.id, issue_fingerprint: getIssueFingerprint(bad) }]
  assert.equal(countPendingAnomalies(example, reviewed), 1)
  assert.equal(countPendingAnomalies([{ ...example[0], start_mileage: 61590, end_mileage: 61590 }, ...example.slice(1)], reviewed), 2)
})

function fakeClient(tables, { failure = null, delay = 0 } = {}) {
  const requests = []
  const client = {
    session: { user: { id: 'admin-one' }, access_token: 'test-one' },
    auth: { getSession: async () => ({ data: { session: client.session }, error: null }) },
    from(table) {
      return {
        select(columns) {
          return { order(key, options) {
            return { async range(from, to) {
              requests.push({ table, columns, key, options, from, to })
              if (delay) await new Promise(resolve => setTimeout(resolve, delay))
              if (failure?.(table, from)) return { data: null, error: { message: 'offline' } }
              const sorted = [...(tables[table] || [])].sort((a, b) => Number(a.id) - Number(b.id))
              return { data: sorted.slice(from, to + 1), error: null }
            } }
          } }
        },
      }
    },
    requests,
  }
  return client
}

test('all history/reviews are paginated, including an anomalous EV older than the newest 500', async () => {
  const logs = [...example.map(row => ({ ...row, cars: undefined })), ...Array.from({ length: 600 }, (_, n) => ({ id: 4000 + n, car_id: 99, activity_type: 'usage', start_time: '2026-10-10T01:00:00Z', start_mileage: n, end_mileage: n + 1 }))]
  const reviews = Array.from({ length: 1001 }, (_, n) => ({ id: n, trip_log_id: 999999, issue_fingerprint: 'test' }))
  const client = fakeClient({ trip_logs: logs, cars: [ev, { id: 99, fuel_type: 'ดีเซล' }], trip_anomaly_reviews: reviews })
  const result = await loadMileageReviewData(client)
  assert.equal(result.logs.length, 603)
  assert.equal(result.reviews.length, 1001)
  assert.equal(result.logs.find(row => row.id === 3342).cars.fuel_type, 'EV')
  assert.ok(codes(buildTripSequence(result.logs).find(row => row.id === 3342)).includes('ev_mileage_jump'))
  assert.ok(client.requests.some(req => req.table === 'trip_logs' && req.from === 500))
  assert.ok(client.requests.some(req => req.table === 'trip_anomaly_reviews' && req.from === 1000))
  assert.ok(client.requests.filter(req => req.table === 'trip_logs').every(req => req.columns.includes('activity_type') && req.columns.includes('parent_trip_log_id') && !req.columns.includes('cars(')))
})

test('sidebar and panel share one in-flight request and cache; manual refresh reads immediately', async () => {
  const client = fakeClient({ trip_logs: [example[0]], cars: [ev] }, { delay: 2 })
  const [sidebar, panel] = await Promise.all([loadMileageReviewData(client), loadMileageReviewData(client)])
  assert.equal(sidebar, panel)
  assert.equal(client.requests.length, 3)
  assert.equal(await loadMileageReviewData(client), sidebar)
  assert.equal(client.requests.length, 3)
  await loadMileageReviewData(client, { forceRefresh: true })
  assert.equal(client.requests.length, 6)
  clearMileageReviewCache(client)
  await loadMileageReviewData(client)
  assert.equal(client.requests.length, 9)
})

test('expired cache, logout and changed user/token cannot reuse the old history', async () => {
  const client = fakeClient({ trip_logs: [example[0]], cars: [ev] })
  await loadMileageReviewData(client)
  const realNow = Date.now
  try {
    Date.now = () => realNow() + MILEAGE_HISTORY_CACHE_MS + 10
    await loadMileageReviewData(client)
    assert.equal(client.requests.length, 6)
  } finally { Date.now = realNow }
  client.session = { user: { id: 'admin-two' }, access_token: 'test-two' }
  await loadMileageReviewData(client)
  assert.equal(client.requests.length, 9)
  client.session.access_token = 'test-refreshed'
  await loadMileageReviewData(client)
  assert.equal(client.requests.length, 12)
  client.session = null
  await assert.rejects(loadMileageReviewData(client), /เข้าสู่ระบบ/)
  assert.equal(client.requests.length, 12)
})

test('a later page failure never returns/caches an incomplete anomaly count', async () => {
  let fail = true
  const client = fakeClient({ trip_logs: Array.from({ length: 510 }, (_, id) => ({ id })), cars: [] }, { failure: (table, from) => fail && table === 'trip_logs' && from === 500 })
  await assert.rejects(loadMileageReviewData(client), /trip_logs/)
  fail = false
  const complete = await loadMileageReviewData(client)
  assert.equal(complete.logs.length, 510)
  assert.equal(client.requests.filter(req => req.table === 'trip_logs' && req.from === 0).length, 2)
})

test('admin UI starts at pending anomalies, clears hidden filters and renders history in pages', () => {
  const panel = readFileSync(new URL('../app/admin/components/MileageCorrectionPanel.js', import.meta.url), 'utf8')
  const admin = readFileSync(new URL('../app/admin/page.js', import.meta.url), 'utf8')
  assert.ok(panel.includes("useState('issues')"))
  assert.match(panel, /const showAllIssues = \(\) => \{\s*setSearch\(''\)\s*setDateFrom\(''\)\s*setDateTo\(''\)/)
  assert.ok(panel.includes('displayedLogs.map'))
  assert.ok(panel.includes('loadMileageReviewData(supabase'))
  assert.ok(admin.includes('loadMileageReviewData(supabase'))
  assert.equal(admin.includes('car_id, start_time, start_mileage'), false)
})
