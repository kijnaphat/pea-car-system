import { isLedgerDate, isLedgerMonth, ledgerAmountCents } from './repairLedger.js'
import { normalizeStaffCode } from './staffCode.js'

const fields = ['id', 'source_id', 'source_type', 'client_request_id', 'updated_at', 'car_id',
  'repair_date', 'usage_date', 'plate_number', 'department', 'shop_name', 'bill_number', 'amount',
  'repair_description', 'status', 'accounting_document_number', 'paid_date', 'machine_hours']

function ledgerError(error) {
  const message = error?.code === '42501' ? 'กรุณายืนยันรหัสพนักงานที่มีอยู่ในระบบก่อนใช้สมุดคุมงานซ่อม'
    : ['23505', '40001'].includes(error?.code) ? 'รายการนี้ถูกบันทึกหรือแก้ไขจากอีกหน้าจอแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไขอีกครั้ง'
      : ['PGRST202', '42P01'].includes(error?.code) ? 'สมุดคุมงานซ่อมยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
        : error?.message || 'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังไม่ถูกล้าง'
  return Object.assign(new Error(message), { code: error?.code })
}

function reportFilter({ month, carId }, requireCar = false) {
  if (!isLedgerMonth(month)) throw new Error('กรุณาเลือกเดือนให้ถูกต้อง')
  if ((requireCar || carId) && (!/^[1-9]\d*$/.test(String(carId || '')) || !Number.isSafeInteger(Number(carId)))) {
    throw new Error('กรุณาเลือกรถที่มีอยู่ในระบบ')
  }
  return { p_month: `${month}-01`, p_car_id: carId ? Number(carId) : null }
}

function confirmedEntry(data) {
  if (!data?.id || !data.updated_at) throw new Error('ไม่ได้รับการยืนยันการบันทึก กรุณาโหลดสมุดคุมเพื่อตรวจสอบก่อนลองอีกครั้ง')
  return data
}

/** Dependency injection keeps tests independent of credentials and live records. */
export function createRepairLedgerClient(client, { now = Date.now, sessionMs = 30 * 60 * 1000 } = {}) {
  // Staff identifiers are retained only in this tab's memory, never in URLs or storage.
  // The database validates the code afresh on EVERY read/write; this is only a UI gate.
  let credential = null
  let revision = 0
  let expiryTimer = null
  const listeners = new Set()
  const getRepairLedgerIdentity = () => credential && now() < credential.expiresAt ? { ...credential.identity } : null
  const notify = () => { for (const listener of listeners) listener(getRepairLedgerIdentity()) }
  const clearRepairLedgerIdentity = () => {
    revision += 1
    credential = null
    clearTimeout(expiryTimer)
    expiryTimer = null
    notify()
  }
  const requireAccess = () => {
    if (!getRepairLedgerIdentity()) {
      if (credential) clearRepairLedgerIdentity()
      throw ledgerError({ code: '42501' })
    }
    return { code: credential.code, revision }
  }
  const handleError = error => {
    if (error?.code === '42501') clearRepairLedgerIdentity()
    throw ledgerError(error)
  }
  const checkRevision = expected => {
    if (expected !== revision || !getRepairLedgerIdentity()) throw ledgerError({ code: '42501' })
  }
  return {
    getRepairLedgerIdentity,
    getRepairLedgerAccess: async () => Boolean(getRepairLedgerIdentity()),
    clearRepairLedgerIdentity,
    watchRepairLedgerIdentity(callback) {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
    async verifyRepairLedgerStaff(value, { signal } = {}) {
      const code = normalizeStaffCode(value)
      if (!code) throw ledgerError({ code: '42501' })
      clearRepairLedgerIdentity()
      const request = revision
      const { data, error } = await client.rpc('verify_repair_ledger_staff', { p_staff_code: code })
      if (request !== revision || signal?.aborted) throw ledgerError({ code: '42501' })
      if (error) handleError(error)
      if (!data?.staff_id || typeof data.full_name !== 'string' || !data.full_name.trim()) {
        throw ledgerError({ code: '42501' })
      }
      const identity = { staff_id: data.staff_id, full_name: data.full_name, position: data.position || '', department: data.department || '' }
      credential = { code, identity, expiresAt: now() + sessionMs }
      expiryTimer = setTimeout(clearRepairLedgerIdentity, sessionMs)
      expiryTimer.unref?.()
      notify()
      return { ...identity }
    },
    async loadRepairLedger({ month, carId = null }) {
      const filters = reportFilter({ month, carId })
      const access = requireAccess()
      const { data, error } = await client.rpc('list_repair_work_ledger_staff', {
        p_staff_code: access.code, ...filters,
      })
      checkRevision(access.revision)
      if (error) handleError(error)
      if (!data || !Array.isArray(data.rows) || !Array.isArray(data.cars)) throw new Error('ข้อมูลสมุดคุมไม่ครบ กรุณาโหลดใหม่')
      if (data.inbox !== undefined && !Array.isArray(data.inbox)) throw new Error('ข้อมูลแจ้งซ่อมไม่ครบ กรุณาโหลดใหม่')
      // Older deployments returned suggestions in the main row list. Keep them out
      // of saved totals until a staff member explicitly confirms an entry.
      return {
        ...data,
        rows: data.rows.filter(row => row.id),
        inbox: data.inbox ?? data.rows.filter(row => !row.id),
      }
    },
    async loadRepairLedgerUsageDates({ month, carId }) {
      const filters = reportFilter({ month, carId }, true)
      const access = requireAccess()
      const { data, error } = await client.rpc('list_repair_ledger_usage_dates_staff', {
        p_staff_code: access.code, ...filters,
      })
      checkRevision(access.revision)
      if (error) handleError(error)
      if (!Array.isArray(data) || data.some(row => !isLedgerDate(row?.usage_date)
        || !row.usage_date.startsWith(`${month}-`) || !Number.isSafeInteger(row.trip_count) || row.trip_count < 1)
        || new Set(data.map(row => row.usage_date)).size !== data.length) {
        throw new Error('ข้อมูลวันที่ใช้งานรถไม่ครบ กรุณาโหลดใหม่')
      }
      return data.map(({ usage_date, trip_count }) => ({ usage_date, trip_count }))
        .sort((a, b) => a.usage_date.localeCompare(b.usage_date))
    },
    async loadRepairLedgerYp6({ month, carId }) {
      const filters = reportFilter({ month, carId }, true)
      // This is the intentionally minimal public YP6 projection, NOT the staff
      // ledger: no invoice, payment, staff-code or audit fields are requested.
      const { data, error } = await client.rpc('list_repair_ledger_yp6', filters)
      if (error) throw ledgerError(error)
      if (!data || !Array.isArray(data.rows) || !Array.isArray(data.linked_source_ids)
        || data.linked_source_ids.some(id => typeof id !== 'string' || !id)
        || data.rows.some(row => !row?.id || Number(row.car_id) !== filters.p_car_id
          || !isLedgerDate(row.usage_date) || !row.usage_date.startsWith(`${month}-`)
          || typeof row.repair_description !== 'string'
          || (row.amount !== null && (typeof row.amount !== 'string' || ledgerAmountCents(row.amount) === null)))) {
        throw new Error('ข้อมูลค่าซ่อมใน ยพ.6 ไม่ครบ กรุณาโหลดใหม่')
      }
      return {
        rows: data.rows.map(({ id, car_id, usage_date, repair_description, amount, machine_hours, source_id }) => ({
          id, car_id, usage_date, repair_description, amount, machine_hours: machine_hours ?? null, source_id: source_id ?? null,
        })),
        linked_source_ids: [...new Set(data.linked_source_ids)],
      }
    },
    async findRepairLedgerDuplicates(entry) {
      const access = requireAccess()
      const payload = Object.fromEntries(fields.filter(key => entry[key] !== undefined).map(key => [key, entry[key]]))
      const { data, error } = await client.rpc('find_repair_ledger_duplicates_staff', {
        p_staff_code: access.code, p_entry: payload,
      })
      checkRevision(access.revision)
      if (error) handleError(error)
      if (!Array.isArray(data) || data.some(row => !row?.id || String(row.car_id) !== String(entry.car_id))) {
        throw new Error('ตรวจสอบรายการซ้ำไม่สำเร็จ กรุณาลองใหม่ก่อนบันทึก')
      }
      return data
    },
    async linkRepairLedgerSource({ entryId, sourceId, updatedAt }) {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuid.test(entryId || '') || !uuid.test(sourceId || '') || typeof updatedAt !== 'string' || !updatedAt) {
        throw new Error('กรุณาเลือกรายการสมุดซ่อมและข้อมูลแจ้งซ่อมให้ถูกต้อง')
      }
      const access = requireAccess()
      const { data, error } = await client.rpc('link_repair_ledger_source_staff', {
        p_staff_code: access.code, p_entry_id: entryId, p_source_id: sourceId, p_updated_at: updatedAt,
      })
      checkRevision(access.revision)
      if (error) handleError(error)
      return confirmedEntry(data)
    },
    async saveRepairLedger(entry) {
      const access = requireAccess()
      // Never forward arbitrary UI state, JWTs or editable audit ownership fields.
      const payload = Object.fromEntries(fields.filter(key => entry[key] !== undefined).map(key => [key, entry[key]]))
      const { data, error } = await client.rpc('save_repair_work_ledger_staff', { p_staff_code: access.code, p_entry: payload })
      checkRevision(access.revision)
      if (error) handleError(error)
      return confirmedEntry(data)
    },
  }
}
