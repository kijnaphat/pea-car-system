import test from 'node:test'
import assert from 'node:assert/strict'
import { createRepairLedgerClient } from '../lib/repairLedgerApi.js'
import { adminDestination } from '../lib/adminDestination.js'
import { readFileSync } from 'node:fs'

function fixture(options) {
  const calls = []
  const client = {
    auth: { getUser: async () => { throw new Error('Staff ledger must not require an admin login') } },
    rpc: async (name, args) => {
      calls.push({ name, args })
      if (name === 'verify_repair_ledger_staff') return { data: { staff_id: 1, full_name: 'Test Personnel', position: 'Staff', department: 'Test' } }
      if (name === 'list_repair_ledger_usage_dates_staff') return { data: [] }
      if (name === 'list_repair_ledger_yp6') return { data: { rows: [], linked_source_ids: [] } }
      if (name === 'find_repair_ledger_duplicates_staff') return { data: [] }
      return { data: name.startsWith('list_') ? { rows: [], cars: [] } : { ...args.p_entry, id: 'saved', updated_at: 'new-version' } }
    },
  }
  return { api: createRepairLedgerClient(client, options), client, calls }
}

test('ledger never reads or writes before staff verification, regardless of admin login', async () => {
  const { api, calls } = fixture()
  assert.equal(await api.getRepairLedgerAccess(), false)
  await assert.rejects(api.loadRepairLedger({ month: '2026-10' }), /รหัสพนักงาน/)
  await assert.rejects(api.saveRepairLedger({}), /รหัสพนักงาน/)
  await assert.rejects(api.loadRepairLedgerUsageDates({ month: '2026-10', carId: 7 }), /รหัสพนักงาน/)
  await assert.rejects(api.findRepairLedgerDuplicates({ car_id: 7 }), /รหัสพนักงาน/)
  await assert.rejects(api.verifyRepairLedgerStaff(''), /รหัสพนักงาน/)
  assert.equal(calls.length, 0)
})

test('valid staff ID unlocks access without auth account and stays out of identity snapshot', async () => {
  const { api, calls } = fixture()
  const identity = await api.verifyRepairLedgerStaff('๑๒๓๔๕๖')
  assert.equal(await api.getRepairLedgerAccess(), true)
  assert.equal(identity.full_name, 'Test Personnel')
  assert.equal(JSON.stringify(identity).includes('123456'), false)
  assert.deepEqual(calls[0], { name: 'verify_repair_ledger_staff', args: { p_staff_code: '123456' } })
  identity.full_name = 'forged'
  assert.equal(api.getRepairLedgerIdentity().full_name, 'Test Personnel')
})

test('wrong staff IDs and malformed verification responses never unlock the ledger', async () => {
  const { api, client } = fixture()
  client.rpc = async () => ({ error: { code: '42501', message: 'No staff' } })
  await assert.rejects(api.verifyRepairLedgerStaff('123456'), /รหัสพนักงาน/)
  assert.equal(api.getRepairLedgerIdentity(), null)
  client.rpc = async () => ({ data: {} })
  await assert.rejects(api.verifyRepairLedgerStaff('123456'), /รหัสพนักงาน/)
  assert.equal(await api.getRepairLedgerAccess(), false)
})

test('month and car filters remain bounded, and unexpected API shapes fail visibly', async () => {
  const { api, client, calls } = fixture()
  await api.verifyRepairLedgerStaff('123456')
  calls.length = 0
  assert.deepEqual(await api.loadRepairLedger({ month: '2026-10', carId: '12' }), { rows: [], cars: [], inbox: [] })
  assert.deepEqual(calls[0], { name: 'list_repair_work_ledger_staff', args: { p_staff_code: '123456', p_month: '2026-10-01', p_car_id: 12 } })
  await assert.rejects(api.loadRepairLedger({ month: '2026-13' }), /เดือน/)
  client.rpc = async () => ({ data: null })
  await assert.rejects(api.loadRepairLedger({ month: '2026-10' }), /ไม่ครบ/)
})

test('save preserves exact decimal/null, concurrency and idempotency keys but strips owner and arbitrary UI fields', async () => {
  const { api, calls } = fixture()
  await api.verifyRepairLedgerStaff('123456')
  calls.length = 0
  const input = { amount: '0.10', usage_date: '2026-09-18', updated_at: 'exact-version', client_request_id: 'stable-request', created_by: 'forged', arbitrary: 'do not send', status: '' }
  await api.saveRepairLedger(input)
  assert.deepEqual(calls[0].args.p_entry, { amount: '0.10', usage_date: '2026-09-18', updated_at: 'exact-version', client_request_id: 'stable-request', status: '' })
  assert.equal(calls[0].name, 'save_repair_work_ledger_staff')
  assert.equal(calls[0].args.p_staff_code, '123456')
  await api.saveRepairLedger({ ...input, amount: null })
  assert.equal(calls[1].args.p_entry.amount, null)
  assert.equal(calls[1].args.p_entry.client_request_id, 'stable-request')
})

test('optional maintenance prefill never appears in confirmed ledger totals, including older RPC responses', async () => {
  const { api, client } = fixture()
  await api.verifyRepairLedgerStaff('123456')
  const saved = { id: 'saved', amount: '25.00' }
  const suggestion = { id: null, source_id: 'maintenance', amount: '99.00' }
  client.rpc = async () => ({ data: { rows: [saved, suggestion], cars: [] } })
  assert.deepEqual(await api.loadRepairLedger({ month: '2026-10' }), { rows: [saved], inbox: [suggestion], cars: [] })
  client.rpc = async () => ({ data: { rows: [saved], inbox: [suggestion], cars: [] } })
  assert.deepEqual(await api.loadRepairLedger({ month: '2026-10' }), { rows: [saved], inbox: [suggestion], cars: [] })
  client.rpc = async () => ({ data: { rows: [], inbox: {}, cars: [] } })
  await assert.rejects(api.loadRepairLedger({ month: '2026-10' }), /ไม่ครบ/)
})

test('usage dates are staff-scoped, bounded to a registered car/month, and preserve daily trip counts', async () => {
  const { api, client, calls } = fixture()
  await api.verifyRepairLedgerStaff('123456')
  calls.length = 0
  client.rpc = async (name, args) => {
    calls.push({ name, args })
    return { data: [{ usage_date: '2026-09-21', trip_count: 1 }, { usage_date: '2026-09-18', trip_count: 3 }] }
  }
  assert.deepEqual(await api.loadRepairLedgerUsageDates({ carId: '7', month: '2026-09' }), [
    { usage_date: '2026-09-18', trip_count: 3 }, { usage_date: '2026-09-21', trip_count: 1 },
  ])
  assert.deepEqual(calls[0], { name: 'list_repair_ledger_usage_dates_staff',
    args: { p_staff_code: '123456', p_car_id: 7, p_month: '2026-09-01' } })
  for (const carId of ['', null, 0, -1, '7.5', '9007199254740993']) {
    await assert.rejects(api.loadRepairLedgerUsageDates({ carId, month: '2026-09' }), /เลือกรถ/)
  }
  await assert.rejects(api.loadRepairLedgerUsageDates({ carId: 7, month: '2026-13' }), /เดือน/)
  for (const rows of [null, [{ usage_date: '2026-10-01', trip_count: 1 }], [{ usage_date: '2026-09-18', trip_count: 0 }],
    [{ usage_date: '2026-09-18', trip_count: 1 }, { usage_date: '2026-09-18', trip_count: 2 }]]) {
    client.rpc = async () => ({ data: rows })
    await assert.rejects(api.loadRepairLedgerUsageDates({ carId: 7, month: '2026-09' }), /ไม่ครบ/)
  }
})

test('late usage dates from an old staff identity are discarded', async () => {
  const { api, client } = fixture()
  await api.verifyRepairLedgerStaff('123456')
  let finish
  client.rpc = async () => new Promise(resolve => { finish = resolve })
  const request = api.loadRepairLedgerUsageDates({ carId: 7, month: '2026-09' })
  api.clearRepairLedgerIdentity()
  finish({ data: [{ usage_date: '2026-09-18', trip_count: 1 }] })
  await assert.rejects(request, /รหัสพนักงาน/)
})

test('duplicate candidates can span report months and remain staff-scoped, allowlisted and revision-protected', async () => {
  const { api, client, calls } = fixture()
  await api.verifyRepairLedgerStaff('123456')
  calls.length = 0
  const input = { id: 'self', car_id: 7, usage_date: '2026-10-18', repair_date: '2026-10-21',
    bill_number: 'B-01', shop_name: 'Test shop', amount: null, repair_description: 'Brake', arbitrary: 'discard',
    created_by: 'forged', staff_code: 'do-not-forward' }
  const older = { id: 'older', car_id: 7, usage_date: '2026-09-18', repair_date: '2026-10-21', bill_number: 'B-01', shop_name: 'Test shop', amount: null }
  client.rpc = async (name, args) => { calls.push({ name, args }); return { data: [older] } }
  assert.deepEqual(await api.findRepairLedgerDuplicates(input), [older])
  assert.deepEqual(calls[0], { name: 'find_repair_ledger_duplicates_staff', args: { p_staff_code: '123456', p_entry: {
    id: 'self', car_id: 7, usage_date: '2026-10-18', repair_date: '2026-10-21', bill_number: 'B-01',
    shop_name: 'Test shop', amount: null, repair_description: 'Brake',
  } } })
  for (const result of [null, [{ id: 'wrong-car', car_id: 8 }], [{ car_id: 7 }]]) {
    client.rpc = async () => ({ data: result })
    await assert.rejects(api.findRepairLedgerDuplicates(input), /ตรวจสอบรายการซ้ำ/)
  }
  let finish
  client.rpc = async () => new Promise(resolve => { finish = resolve })
  const request = api.findRepairLedgerDuplicates(input)
  api.clearRepairLedgerIdentity()
  finish({ data: [older] })
  await assert.rejects(request, /รหัสพนักงาน/)
})

test('public YP6 reads only its minimal projection and never sends staff code or requires an admin', async () => {
  const { api, client, calls } = fixture()
  client.rpc = async (name, args) => {
    calls.push({ name, args })
    return { data: { rows: [{ id: 'repair', car_id: 7, usage_date: '2026-09-18', repair_description: 'ตรวจเบรก',
      amount: null, machine_hours: null, source_id: 'maintenance', bill_number: 'must-not-forward' }],
    linked_source_ids: ['maintenance', 'maintenance', 'historical-source'] } }
  }
  const result = await api.loadRepairLedgerYp6({ carId: 7, month: '2026-09' })
  assert.deepEqual(calls[0], { name: 'list_repair_ledger_yp6', args: { p_car_id: 7, p_month: '2026-09-01' } })
  assert.deepEqual(result.linked_source_ids, ['maintenance', 'historical-source'])
  assert.equal(result.rows[0].amount, null)
  assert.equal(result.rows[0].bill_number, undefined)
  assert.equal(api.getRepairLedgerIdentity(), null)
  client.rpc = async () => ({ data: { rows: [{ ...result.rows[0], amount: '0.10' }], linked_source_ids: [] } })
  assert.equal((await api.loadRepairLedgerYp6({ carId: 7, month: '2026-09' })).rows[0].amount, '0.10')
  for (const row of [{ ...result.rows[0], car_id: 8 }, { ...result.rows[0], usage_date: '2026-10-01' },
    { ...result.rows[0], amount: 0.1 }, { ...result.rows[0], amount: '1.234' }]) {
    client.rpc = async () => ({ data: { rows: [row], linked_source_ids: [] } })
    await assert.rejects(api.loadRepairLedgerYp6({ carId: 7, month: '2026-09' }), /ไม่ครบ/)
  }
})

test('linking a source is explicit, revision-protected and never creates a second ledger entry', async () => {
  const { api, client, calls } = fixture()
  const entryId = '11111111-1111-4111-8111-111111111111'
  const sourceId = '22222222-2222-4222-8222-222222222222'
  await assert.rejects(api.linkRepairLedgerSource({ entryId, sourceId, updatedAt: 'old-version' }), /รหัสพนักงาน/)
  await api.verifyRepairLedgerStaff('123456')
  calls.length = 0
  client.rpc = async (name, args) => {
    calls.push({ name, args })
    return { data: { id: entryId, updated_at: 'new-version', source_id: sourceId } }
  }
  const result = await api.linkRepairLedgerSource({ entryId, sourceId, updatedAt: 'old-version' })
  assert.equal(result.id, entryId)
  assert.deepEqual(calls[0], { name: 'link_repair_ledger_source_staff', args: {
    p_staff_code: '123456', p_entry_id: entryId, p_source_id: sourceId, p_updated_at: 'old-version',
  } })
  await assert.rejects(api.linkRepairLedgerSource({ entryId: '', sourceId, updatedAt: 'old-version' }), /ให้ถูกต้อง/)
  client.rpc = async () => ({ error: { code: '40001' } })
  await assert.rejects(api.linkRepairLedgerSource({ entryId, sourceId, updatedAt: 'old-version' }), /อีกหน้าจอ/)
  let finish
  client.rpc = async () => new Promise(resolve => { finish = resolve })
  const request = api.linkRepairLedgerSource({ entryId, sourceId, updatedAt: 'old-version' })
  api.clearRepairLedgerIdentity()
  finish({ data: { id: entryId, updated_at: 'late-version' } })
  await assert.rejects(request, /รหัสพนักงาน/)
})

test('database errors do not claim success or automatically retry and overwrite data', async () => {
  const { api, client } = fixture()
  await api.verifyRepairLedgerStaff('123456')
  client.rpc = async () => ({ error: { code: '40001' } })
  await assert.rejects(api.saveRepairLedger({}), /อีกหน้าจอ/)
  client.rpc = async () => ({ data: {} })
  await assert.rejects(api.saveRepairLedger({}), /ยืนยัน/)
  client.rpc = async () => ({ error: { code: '42501' } })
  await assert.rejects(api.saveRepairLedger({}), /รหัสพนักงาน/)
  assert.equal(await api.getRepairLedgerAccess(), false)
})

test('identity expires and clear invalidates in-flight verification and old reads', async () => {
  let clock = 0
  const { api, client } = fixture({ now: () => clock, sessionMs: 1000 })
  const identities = []
  const unsubscribe = api.watchRepairLedgerIdentity(identity => identities.push(identity))
  await api.verifyRepairLedgerStaff('123456')
  assert.equal(identities.at(-1).staff_id, 1)
  clock = 1001
  assert.equal(api.getRepairLedgerIdentity(), null)
  await assert.rejects(api.saveRepairLedger({}), /รหัสพนักงาน/)
  assert.equal(identities.at(-1), null)
  let finish
  client.rpc = async () => new Promise(resolve => { finish = resolve })
  const verifying = api.verifyRepairLedgerStaff('123456')
  api.clearRepairLedgerIdentity()
  finish({ data: { staff_id: 1, full_name: 'Late Response' } })
  await assert.rejects(verifying, /รหัสพนักงาน/)
  assert.equal(api.getRepairLedgerIdentity(), null)
  unsubscribe()
})

test('switching identity discards a late financial-data response from prior identity', async () => {
  const { api, client } = fixture()
  await api.verifyRepairLedgerStaff('123456')
  let finish
  client.rpc = async () => new Promise(resolve => { finish = resolve })
  const loading = api.loadRepairLedger({ month: '2026-10' })
  api.clearRepairLedgerIdentity()
  finish({ data: { rows: [{ amount: '1.00' }], cars: [] } })
  await assert.rejects(loading, /รหัสพนักงาน/)
})

test('leaving a staff-ID form cancels verification before it can unlock another route', async () => {
  const { api, client } = fixture()
  let finish
  client.rpc = async () => new Promise(resolve => { finish = resolve })
  const controller = new AbortController()
  const verifying = api.verifyRepairLedgerStaff('123456', { signal: controller.signal })
  controller.abort()
  finish({ data: { staff_id: 1, full_name: 'Late Identity' } })
  await assert.rejects(verifying, /รหัสพนักงาน/)
  assert.equal(api.getRepairLedgerIdentity(), null)
})

test('login return destinations are same-origin allowlisted and retain only validated report filters', () => {
  assert.equal(adminDestination('?next=home-maintenance&car_id=12'), '/?admin_report_car_id=12')
  assert.equal(adminDestination(`?next=${encodeURIComponent('/report/repairs?car_id=12&month=2026-10&secret=discard')}`), '/report/repairs?car_id=12&month=2026-10')
  for (const next of ['https://evil.example', '//evil.example', '/report/repairs.evil', '/report/repairs/../admin', '/report/repairs%2Fevil']) {
    assert.equal(adminDestination(`?next=${encodeURIComponent(next)}`), '/admin')
  }
})

test('both report layouts open the canonical ledger instead of offering a second repair-entry form', () => {
  const source = readFileSync(new URL('../app/report/page.js', import.meta.url), 'utf8')
  assert.equal((source.match(/<RepairLedgerActions onOpen=\{openRepairLedger\}/g) || []).length, 2)
  assert.match(source, /loadRepairLedgerYp6\(\{ carId, month: selectedMonth \}\)/)
  assert.match(source, /appendLedgerRepairRows\(/)
  assert.match(source, /attachLegacyRepairCosts\(trips\.data \|\| \[\], repairs, ledger\.linked_source_ids\)/)
  assert.match(source, /\.eq\('billing_status', 'billed'\)/)
  assert.doesNotMatch(source, /saveRepairLedger|handleSaveRepair|repairDraftRef|pendingRepair|aria-label="วันที่ซ่อม"/)
  assert.match(source, /พนักงานทุกคนกรอกได้/)
  assert.match(source, /กรอกและแก้ไขที่สมุดคุมงานซ่อมเพียงที่เดียว/)
})
