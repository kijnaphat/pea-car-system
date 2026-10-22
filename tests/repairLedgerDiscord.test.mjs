import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { REPAIR_LEDGER_STATUSES } from '../lib/repairLedger.js'

const migrations = new URL('../supabase/migrations/', import.meta.url)
const file = readdirSync(migrations).find(name => /^\d+_repair_ledger_discord_notifications\.sql$/.test(name))
const sql = readFileSync(new URL(file, migrations), 'utf8')

test('Discord status labels follow all ledger workflow choices without changing the staff-code access model', () => {
  for (const { value, label } of REPAIR_LEDGER_STATUSES) {
    assert.ok(sql.includes(`when '${value}' then '${label}'`), `missing status: ${label}`)
  }
  assert.match(sql, /security invoker set search_path = ''/)
  assert.match(sql, /revoke all on function private\.capture_repair_ledger_discord_event\(\) from public,anon,authenticated,service_role/)
  assert.doesNotMatch(sql, /grant\s+execute|alter\s+table\s+public\.repair_work_ledger/i)
})

test('Discord ledger notifications are transactional, event-scoped and routed away from daily summaries', () => {
  assert.match(sql, /after insert or update of status on public\.repair_work_ledger/)
  assert.match(sql, /new\.status is distinct from old\.status/)
  assert.match(sql, /maintenance\.ledger_created/)
  assert.match(sql, /maintenance\.ledger_status_changed/)
  assert.match(sql, /private\.queue_audit_event_to_channel\(/)
  assert.match(sql, /v_fields,'maintenance_billing',v_changes/)
  assert.doesNotMatch(sql, /net\.http_post|process_discord_audit_queue\(|daily_summary|webhook_secret_id|decrypted_secret|cron\./)
  assert.doesNotMatch(sql, /insert into public\.repair_work_ledger|update public\.repair_work_ledger/i)
})

test('notifications distinguish pending money and both dates, and never serialize a whole financial/personnel row', () => {
  assert.match(sql, /new\.amount is null then 'รอระบุยอด'/)
  assert.match(sql, /'วันที่ลง ยพ\.6'/)
  assert.match(sql, /'วันที่ซ่อมจริง'/)
  assert.match(sql, /new\.updated_by_staff_name/)
  assert.doesNotMatch(sql, /staff_code|accounting_document_number|to_jsonb\(new\)|row_to_json\(new\)/i)
  assert.match(sql, /case when tg_op='INSERT' then nullif\(pg_catalog\.btrim\(new\.created_by_staff_name\)/)
})
