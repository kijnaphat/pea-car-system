import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const adminSource = readFileSync(new URL('../app/admin/page.js', import.meta.url), 'utf8')

// Execute the real pure event-function definitions with a paused tenant and
// observable dependencies; none may reach a file read, transform, or upload.
function pausedAdminHandler(name) {
  const start = adminSource.indexOf(`  const ${name} = async `)
  assert.notEqual(start, -1, `${name}: real admin function exists`)
  const end = adminSource.indexOf('\n  const ', start + 1)
  assert.notEqual(end, -1, `${name}: function boundary exists`)
  const calls = { alerts: [], storage: 0, transformed: 0, state: 0 }
  const storage = () => { calls.storage++; throw new Error('Storage must not be called while paused') }
  const handler = new Function('carImageStoragePaused', 'carImagePauseMessage', 'alert', 'supabase', 'optimizeCarImage',
    'setIsMigratingImages', 'carsList', 'MAX_CAR_UPLOAD_BYTES',
    `${adminSource.slice(start, end)}\n; return ${name};`)(
    true, adminSource.match(/const carImagePauseMessage = '([^']+)'/)?.[1],
    message => calls.alerts.push(message), { storage: { from: storage } },
    () => { calls.transformed++; throw new Error('Must not read or resize the selected file while paused') },
    () => { calls.state++ }, [], 196608,
  )
  return { handler, calls }
}

test('admin offers an explicit temporary photo notice while leaving the ordinary car form enabled', () => {
  assert.match(adminSource, /isCarImageStoragePaused/)
  assert.match(adminSource, /carImageStoragePaused\s*=\s*isCarImageStoragePaused\(\)/)
  const input = adminSource.match(/<input\b[^>]*type="file"[^>]*>/)?.[0]
  assert.ok(input, 'photo chooser still exists for unpaused tenants')
  assert.match(input, /disabled=\{carImageStoragePaused\}/)
  assert.match(adminSource, /onClick=\{migrateLegacyImages\}[^>]*disabled=\{[^}]*carImageStoragePaused[^}]*\}/)
  assert.match(adminSource, /ชั่วคราว/)
  assert.match(adminSource, /รูปเดิม|รูปที่มี|รูปปัจจุบัน/)
  const submit = adminSource.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0]
  assert.ok(submit)
  assert.doesNotMatch(submit, /carImageStoragePaused/, 'pause photos, not car creation/editing or QR codes')
})

test('paused admin file selection stops before even reading the chosen file or transforming bytes', async () => {
  const { handler, calls } = pausedAdminHandler('handleCarImageChange')
  let fileReads = 0
  const event = { target: { get files() { fileReads++; throw new Error('Do not read paused selection') }, value: 'selected-photo.png' } }
  await handler(event)
  assert.equal(fileReads, 0)
  assert.equal(event.target.value, '', 'discard any programmatically selected file while paused')
  assert.equal(calls.transformed, 0)
  assert.equal(calls.storage, 0)
})

test('paused admin upload rejects before bytes or Storage can be accessed, even if invoked outside the disabled input', async () => {
  const { handler, calls } = pausedAdminHandler('uploadCarImage')
  let fileReads = 0
  const file = { get size() { fileReads++; throw new Error('Do not read paused upload') } }
  await assert.rejects(handler(7, file), /ชั่วคราว|หยุด|ปิด|pause/i)
  assert.equal(fileReads, 0)
  assert.equal(calls.storage, 0)
})

test('paused legacy migration stops before enumerating cars, changing migration state, fetching, or uploading', async () => {
  const { handler, calls } = pausedAdminHandler('migrateLegacyImages')
  await handler()
  assert.equal(calls.storage, 0)
  assert.equal(calls.transformed, 0)
  assert.equal(calls.state, 0)
})
