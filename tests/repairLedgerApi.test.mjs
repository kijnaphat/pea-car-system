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
  assert.deepEqual(await api.loadRepairLedger({ month: '2026-10', carId: '12' }), { rows: [], cars: [] })
  assert.deepEqual(calls[0], { name: 'list_repair_work_ledger_staff', args: { p_staff_code: '123456', p_month: '2026-10-01', p_car_id: 12 } })
  await assert.rejects(api.loadRepairLedger({ month: '2026-13' }), /เดือน/)
  client.rpc = async () => ({ data: null })
  await assert.rejects(api.loadRepairLedger({ month: '2026-10' }), /ไม่ครบ/)
})

test('save preserves exact decimal/null, concurrency and idempotency keys but strips owner and arbitrary UI fields', async () => {
  const { api, calls } = fixture()
  await api.verifyRepairLedgerStaff('123456')
  calls.length = 0
  const input = { amount: '0.10', updated_at: 'exact-version', client_request_id: 'stable-request', created_by: 'forged', arbitrary: 'do not send', status: '' }
  await api.saveRepairLedger(input)
  assert.deepEqual(calls[0].args.p_entry, { amount: '0.10', updated_at: 'exact-version', client_request_id: 'stable-request', status: '' })
  assert.equal(calls[0].name, 'save_repair_work_ledger_staff')
  assert.equal(calls[0].args.p_staff_code, '123456')
  await api.saveRepairLedger({ ...input, amount: null })
  assert.equal(calls[1].args.p_entry.amount, null)
  assert.equal(calls[1].args.p_entry.client_request_id, 'stable-request')
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

test('both repair form layouts use the persisted handler and ledger button; canonical YP6 accounting is unchanged', () => {
  const source = readFileSync(new URL('../app/report/page.js', import.meta.url), 'utf8')
  assert.equal((source.match(/<RepairLedgerActions onSave=\{handleSaveRepair\}/g) || []).length, 2)
  assert.match(source, /await saveRepairLedger\(draft\)/)
  assert.match(source, /source_type: 'report'/)
  assert.match(source, /\.eq\('billing_status', 'billed'\)/)
  assert.doesNotMatch(source, /setTimeout\(\(\)=>\{setDrillSaving/)
  assert.equal((source.match(/aria-label="วันที่ซ่อม"/g) || []).length, 2)
  assert.match(source, /if \(!getRepairLedgerIdentity\(\)\)/)
  assert.match(source, /pendingRepair && <RepairStaffVerification/)
  assert.doesNotMatch(source, /สำหรับแอดมิน · บันทึกลงสมุดคุม/)
})
