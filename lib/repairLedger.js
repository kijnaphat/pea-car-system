export const REPAIR_LEDGER_STATUSES = Object.freeze([
  { value: '', label: 'รอดำเนินการ' },
  { value: 'committee_signed', label: 'คณะกรรมการลงนามแล้ว' },
  { value: 'submitted_executive', label: 'เสนอผู้บริหาร' },
  { value: 'submitted_review', label: 'ส่งตรวจเสนอ' },
  { value: 'paid', label: 'รับเงินแล้ว' },
])

export function ledgerStatus(value) {
  return REPAIR_LEDGER_STATUSES.find(status => status.value === (value || '')) || REPAIR_LEDGER_STATUSES[0]
}

/** Calendar fields stay calendar fields: never parse a YYYY-MM-DD as UTC. */
export function isLedgerDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  return year >= 1900 && month >= 1 && month <= 12 && day >= 1
    && day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function isLedgerMonth(value) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || '') && Number(value.slice(0, 4)) >= 1900
}

export function ledgerToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = type => parts.find(value => value.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function ledgerDateLabel(value) {
  if (!isLedgerDate(value)) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${Number(year) + 543}`
}

export function ledgerMonthLabel(value) {
  if (!isLedgerMonth(value)) return 'ทุกเดือน'
  const names = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
  return `${names[Number(value.slice(5)) - 1]} ${Number(value.slice(0, 4)) + 543}`
}

/** Decimal -> integer cents, without binary-float arithmetic or rounding away data. */
export function ledgerAmountCents(value) {
  const input = String(value ?? '').trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(input)) return null
  const [whole, fraction = ''] = input.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export function ledgerAmountValue(value) {
  const cents = ledgerAmountCents(value)
  if (cents === null) return null
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
}

export function ledgerMoneyFromCents(cents) {
  const sign = cents < 0n ? '-' : ''
  const absolute = cents < 0n ? -cents : cents
  return `${sign}${String(absolute / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(absolute % 100n).padStart(2, '0')}`
}

export function ledgerMoney(value) {
  const cents = ledgerAmountCents(value)
  return cents === null ? '—' : ledgerMoneyFromCents(cents)
}

export function ledgerTotals(rows) {
  return rows.reduce((totals, row) => {
    const amount = ledgerAmountCents(row.amount) ?? 0n
    totals.amount += amount
    if (row.status === 'paid') totals.paid += amount
    else totals.pending += amount
    return totals
  }, { amount: 0n, paid: 0n, pending: 0n })
}

export function ledgerRowKey(row) {
  return row.id ? `entry:${row.id}` : `${row.source_type || 'maintenance'}:${row.source_id ?? row.source_record_id}`
}

export function ledgerSourceLabel(row) {
  if (row.source_type === 'maintenance') return 'จากรายการส่งซ่อม'
  if (row.source_type === 'report') return 'จากรายงานการใช้รถ'
  return 'กรอกเอง'
}

export function ledgerFilterRows(rows, { search = '', status = 'all' } = {}) {
  const query = search.trim().toLocaleLowerCase('th-TH')
  return rows.filter(row => {
    if (status !== 'all' && (row.status || '') !== status) return false
    return !query || [row.plate_number, row.department, row.shop_name, row.bill_number,
      row.repair_description, row.accounting_document_number]
      .some(value => String(value || '').toLocaleLowerCase('th-TH').includes(query))
  })
}

export function ledgerDraft(row = {}, { car, today = ledgerToday() } = {}) {
  // The actual repair/bill date is independent of the selected report month.
  // Never silently invent the first day of a historical month.
  const date = isLedgerDate(row.repair_date) ? row.repair_date : today
  return {
    ...row,
    repair_date: date,
    usage_date: isLedgerDate(row.usage_date) ? row.usage_date : '',
    car_id: String(row.car_id ?? car?.id ?? ''),
    plate_number: row.plate_number || car?.plate_number || '',
    department: row.department || car?.department_name || (typeof car?.department === 'string' ? car.department : car?.departments?.name) || '',
    shop_name: row.shop_name || '',
    bill_number: row.bill_number || '',
    amount: ledgerAmountValue(row.amount) ?? '',
    repair_description: row.repair_description || '',
    status: ledgerStatus(row.status).value,
    accounting_document_number: row.accounting_document_number || '',
    paid_date: row.paid_date || '',
  }
}

export function ledgerValidateDraft(draft, { allowLegacyUsageDate = false } = {}) {
  const errors = {}
  // Only an existing, still-unmapped legacy entry can use this escape hatch.
  // The caller must check the original mapping is unchanged; the server repeats it.
  const legacyUnmapped = allowLegacyUsageDate && Boolean(draft.id) && !draft.usage_date
  if (!legacyUnmapped && (!/^[1-9]\d*$/.test(String(draft.car_id || '')) || !Number.isSafeInteger(Number(draft.car_id)))) {
    errors.car_id = 'กรุณาเลือกรถที่มีอยู่ในระบบ'
  }
  if (!legacyUnmapped && !isLedgerDate(draft.usage_date)) errors.usage_date = 'กรุณาเลือกวันที่มีการใช้งานรถเพื่อลง ยพ.6'
  if (!isLedgerDate(draft.repair_date)) errors.repair_date = 'กรุณาระบุวันที่ให้ถูกต้อง'
  if (!String(draft.plate_number || '').trim()) errors.plate_number = 'กรุณาระบุทะเบียนรถ'
  if (!String(draft.repair_description || '').trim()) errors.repair_description = 'กรุณาระบุรายการซ่อม'
  if (String(draft.amount ?? '').trim() && ledgerAmountCents(draft.amount) === null) errors.amount = 'กรอกจำนวนเงินตั้งแต่ 0 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง'
  if (draft.paid_date && !isLedgerDate(draft.paid_date)) errors.paid_date = 'กรุณาระบุวันที่จ่ายเงินให้ถูกต้อง'
  if (!REPAIR_LEDGER_STATUSES.some(status => status.value === draft.status)) errors.status = 'กรุณาเลือกสถานะที่ถูกต้อง'
  return errors
}

export function ledgerPayload(draft) {
  return {
    ...draft,
    car_id: draft.car_id ? Number(draft.car_id) : null,
    usage_date: draft.usage_date || null,
    plate_number: draft.plate_number.trim(),
    department: draft.department.trim(),
    shop_name: draft.shop_name.trim(),
    bill_number: draft.bill_number.trim(),
    amount: ledgerAmountValue(draft.amount),
    repair_description: draft.repair_description.trim(),
    accounting_document_number: draft.accounting_document_number.trim(),
    paid_date: draft.paid_date || null,
  }
}

function duplicateText(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('th-TH')
}

/** Possible matches are warnings, never a reason to forbid legitimate same-day work. */
export function findPossibleLedgerDuplicates(draft, rows = []) {
  const carId = String(draft.car_id || '')
  if (!/^[1-9]\d*$/.test(carId)) return []
  const bill = duplicateText(draft.bill_number)
  const shop = duplicateText(draft.shop_name)
  const description = duplicateText(draft.repair_description)
  const amount = ledgerAmountCents(draft.amount)
  return rows.filter(row => {
    if (!row.id || (draft.id && row.id === draft.id) || String(row.car_id || '') !== carId) return false
    if (draft.source_id && row.source_id === draft.source_id) return true
    // Invoice numbers may repeat between vendors: a known different shop is not a match.
    const rowShop = duplicateText(row.shop_name)
    if (bill && bill === duplicateText(row.bill_number) && (!shop || !rowShop || shop === rowShop)) return true
    const sameDate = (isLedgerDate(draft.usage_date) && row.usage_date === draft.usage_date)
      || (isLedgerDate(draft.repair_date) && row.repair_date === draft.repair_date)
    if (!sameDate) return false
    const sameDescription = Boolean(description) && description === duplicateText(row.repair_description)
    const rowAmount = ledgerAmountCents(row.amount)
    const sameKnownAmount = amount !== null && rowAmount !== null && amount === rowAmount
    return sameDescription || (sameKnownAmount && Boolean(shop) && shop === rowShop)
  })
}
