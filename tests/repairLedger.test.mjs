import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  REPAIR_LEDGER_STATUSES, isLedgerDate, isLedgerMonth, ledgerToday, ledgerDateLabel,
  ledgerMonthLabel, ledgerAmountCents, ledgerAmountValue, ledgerMoney, ledgerMoneyFromCents,
  ledgerTotals, ledgerDraft, ledgerValidateDraft, ledgerPayload, ledgerFilterRows, ledgerRowKey,
} from '../lib/repairLedger.js'

test('calendar dates use Bangkok calendar values without a UTC date shift', () => {
  assert.equal(ledgerToday(new Date('2026-10-18T18:01:00Z')), '2026-10-19')
  assert.equal(ledgerDateLabel('2026-10-19'), '19/10/2569')
  assert.equal(ledgerMonthLabel('2026-10'), 'ตุลาคม 2569')
  assert.equal(ledgerDateLabel(null), '—')
  for (const value of ['2024-02-29', '2026-01-31', '2026-04-30']) assert.equal(isLedgerDate(value), true)
  for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-10-00', '19/10/2026', '2026-1-1']) assert.equal(isLedgerDate(value), false)
  assert.equal(isLedgerMonth('2026-10'), true)
  assert.equal(isLedgerMonth('2026-13'), false)
})

test('amounts and totals use exact cents; unknown differs from an explicit zero', () => {
  assert.equal(ledgerAmountCents('0.10'), 10n)
  assert.equal(ledgerAmountCents('0.2'), 20n)
  assert.equal(ledgerAmountValue('0012.3'), '12.30')
  assert.equal(ledgerMoney('1234567890.12'), '1,234,567,890.12')
  assert.equal(ledgerMoney('0'), '0.00')
  assert.equal(ledgerMoney(null), '—')
  for (const invalid of ['', null, '-1', '1.234', '1e3', 'Infinity', '1,000', 'one']) assert.equal(ledgerAmountCents(invalid), null)
  const totals = ledgerTotals([{ amount: '0.10', status: '' }, { amount: '0.20', status: 'paid' }, { amount: null }])
  assert.deepEqual(totals, { amount: 30n, paid: 20n, pending: 10n })
  assert.equal(ledgerMoneyFromCents(totals.amount), '0.30')
})

test('ledger has only the requested four stages plus an unasserted pending state', () => {
  assert.deepEqual(REPAIR_LEDGER_STATUSES.map(item => [item.value, item.label]), [
    ['', 'รอดำเนินการ'], ['committee_signed', 'คณะกรรมการลงนามแล้ว'],
    ['submitted_executive', 'เสนอผู้บริหาร'], ['submitted_review', 'ส่งตรวจเสนอ'], ['paid', 'รับเงินแล้ว'],
  ])
  const draft = ledgerDraft({ paid_date: '2026-10-19' })
  assert.equal(draft.status, '', 'a payment date must never assert receipt of money automatically')
})

test('drafts autofill car details but preserve maintenance source identity and concurrency token', () => {
  const draft = ledgerDraft({ source_type: 'maintenance', source_id: 'maint-1', car_id: 7, updated_at: 'opaque-token', amount: null }, {
    car: { id: 7, plate_number: '90-7606 นฐ.', departments: { name: 'แผนกปฏิบัติการ' } }, month: '2026-09', today: '2026-10-19',
  })
  assert.equal(draft.repair_date, '2026-09-01')
  assert.equal(draft.department, 'แผนกปฏิบัติการ')
  assert.equal(draft.plate_number, '90-7606 นฐ.')
  assert.equal(draft.amount, '')
  const payload = ledgerPayload({ ...draft, repair_description: ' เปลี่ยนน้ำมันเครื่อง ', bill_number: ' B-001 ' })
  assert.equal(payload.source_id, 'maint-1')
  assert.equal(payload.updated_at, 'opaque-token')
  assert.equal(payload.car_id, 7)
  assert.equal(payload.bill_number, 'B-001')
  assert.equal(payload.amount, null)
  assert.equal(payload.repair_description, 'เปลี่ยนน้ำมันเครื่อง')
  assert.equal(payload.paid_date, null)
})

test('form requires date, plate and description while unknown billing fields can stay blank', () => {
  const draft = ledgerDraft({ repair_date: '2026-10-19', plate_number: 'ทดสอบ 123', repair_description: 'ตรวจเบรก' })
  assert.deepEqual(ledgerValidateDraft(draft), {})
  assert.ok(ledgerValidateDraft({ ...draft, repair_date: '2026-02-30' }).repair_date)
  assert.ok(ledgerValidateDraft({ ...draft, plate_number: ' ' }).plate_number)
  assert.ok(ledgerValidateDraft({ ...draft, repair_description: ' ' }).repair_description)
  assert.ok(ledgerValidateDraft({ ...draft, amount: '-20' }).amount)
  assert.ok(ledgerValidateDraft({ ...draft, amount: '1.234' }).amount)
  assert.ok(ledgerValidateDraft({ ...draft, status: 'arbitrary' }).status)
})

test('search and status filters operate on the same report rows used by printing and totals', () => {
  const rows = [
    { id: '1', plate_number: 'รถ 1', shop_name: 'ร้านเอ', amount: '0.10', status: '' },
    { id: '2', plate_number: 'รถ 2', shop_name: 'ร้านบี', amount: '0.20', status: 'paid', accounting_document_number: 'ACC-20' },
  ]
  assert.deepEqual(ledgerFilterRows(rows, { status: '' }).map(row => row.id), ['1'])
  assert.deepEqual(ledgerFilterRows(rows, { search: 'acc-20' }).map(row => row.id), ['2'])
  assert.equal(ledgerTotals(ledgerFilterRows(rows, { search: 'ร้านบี', status: 'paid' })).amount, 20n)
  assert.equal(ledgerRowKey({ source_type: 'maintenance', source_id: 'm1' }), 'maintenance:m1')
  assert.equal(ledgerRowKey({ id: 'l1' }), 'entry:l1')
})

test('UI saves explicitly, uses one retry-safe manual key, and checks access before loading financial rows', () => {
  const component = readFileSync(new URL('../app/report/components/RepairLedger.js', import.meta.url), 'utf8')
  assert.match(component, /const \[draft, setDraft\] = useState\(\(\) => ledgerDraft/)
  assert.match(component, /client_request_id: crypto\.randomUUID\(\)/)
  assert.equal((component.match(/crypto\.randomUUID/g) || []).length, 1)
  assert.match(component, /const allowed = await getRepairLedgerAccess\(\)/)
  assert.ok(component.indexOf('if (!allowed)') < component.indexOf('await loadRepairLedger'))
  assert.match(component, /บันทึกสถานะ/)
  assert.match(component, /useEffect\(\(\) => watchRepairLedgerAccess\(allowed =>/)
  assert.match(component, /accessEpoch\.current \+= 1/)
  assert.match(component, /epoch !== accessEpoch\.current/)
  assert.match(component, /window\.addEventListener\('beforeunload'/)
  assert.match(component, /const printReport = \(\) =>/)
  assert.match(component, /รายงานจะพิมพ์สถานะเดิมที่บันทึกแล้ว/)
  assert.match(component, /if \(!alive\.current\) return/)
  assert.doesNotMatch(component, /setInterval|setTimeout|localStorage|\.from\(/)
  const css = readFileSync(new URL('../app/report/components/repair-ledger.css', import.meta.url), 'utf8')
  assert.match(css, /size:A4 landscape/)
  assert.match(css, /display:table-header-group/)
  assert.match(css, /@media print/)
})
