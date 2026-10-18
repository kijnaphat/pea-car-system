import test from 'node:test'
import assert from 'node:assert/strict'
import { createRepairLedgerClient } from '../lib/repairLedgerApi.js'
import { adminDestination } from '../lib/adminDestination.js'
import { readFileSync } from 'node:fs'

function fixture(user = { app_metadata: { role: 'admin' } }) {
  const calls = []
  const client = {
    auth: { getUser: async () => ({ data: { user } }) },
    rpc: async (name, args) => {
      calls.push({ name, args })
      return { data: name.startsWith('list_') ? { rows: [], cars: [] } : { ...args.p_entry, id: 'saved', updated_at: 'new-version' } }
    },
  }
  return { api: createRepairLedgerClient(client), client, calls }
}

test('ledger access trusts verified app metadata only and never queries financial data anonymously', async () => {
  for (const user of [null, { user_metadata: { role: 'admin' } }, { app_metadata: { role: 'staff' } }]) {
    const { api, calls } = fixture(user)
    assert.equal(await api.getRepairLedgerAccess(), false)
    await assert.rejects(api.loadRepairLedger({ month: '2026-10' }), /แอดมิน/)
    await assert.rejects(api.saveRepairLedger({}), /แอดมิน/)
    assert.equal(calls.length, 0)
  }
})

test('month and car filters remain bounded, and unexpected API shapes fail visibly', async () => {
  const { api, client, calls } = fixture()
  assert.deepEqual(await api.loadRepairLedger({ month: '2026-10', carId: '12' }), { rows: [], cars: [] })
  assert.deepEqual(calls[0], { name: 'list_repair_work_ledger', args: { p_month: '2026-10-01', p_car_id: 12 } })
  await assert.rejects(api.loadRepairLedger({ month: '2026-13' }), /เดือน/)
  client.rpc = async () => ({ data: null })
  await assert.rejects(api.loadRepairLedger({ month: '2026-10' }), /ไม่ครบ/)
})

test('save preserves exact decimal/null, concurrency and idempotency keys but strips owner and arbitrary UI fields', async () => {
  const { api, calls } = fixture()
  const input = { amount: '0.10', updated_at: 'exact-version', client_request_id: 'stable-request', created_by: 'forged', arbitrary: 'do not send', status: '' }
  await api.saveRepairLedger(input)
  assert.deepEqual(calls[0].args.p_entry, { amount: '0.10', updated_at: 'exact-version', client_request_id: 'stable-request', status: '' })
  await api.saveRepairLedger({ ...input, amount: null })
  assert.equal(calls[1].args.p_entry.amount, null)
  assert.equal(calls[1].args.p_entry.client_request_id, 'stable-request')
})

test('database errors do not claim success or automatically retry and overwrite data', async () => {
  const { api, client } = fixture()
  client.rpc = async () => ({ error: { code: '40001' } })
  await assert.rejects(api.saveRepairLedger({}), /อีกหน้าจอ/)
  client.rpc = async () => ({ data: {} })
  await assert.rejects(api.saveRepairLedger({}), /ยืนยัน/)
  client.auth.getUser = async () => ({ error: { name: 'AuthSessionMissingError' } })
  assert.equal(await api.getRepairLedgerAccess(), false)
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
})
