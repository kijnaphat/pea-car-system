import { isLedgerMonth } from './repairLedger.js'
import { normalizeStaffCode } from './staffCode.js'

const fields = ['id', 'source_id', 'source_type', 'client_request_id', 'updated_at', 'car_id',
  'repair_date', 'plate_number', 'department', 'shop_name', 'bill_number', 'amount',
  'repair_description', 'status', 'accounting_document_number', 'paid_date', 'machine_hours']

function ledgerError(error) {
  const message = error?.code === '42501' ? 'กรุณายืนยันรหัสพนักงานที่มีอยู่ในระบบก่อนใช้สมุดคุมงานซ่อม'
    : ['23505', '40001'].includes(error?.code) ? 'รายการนี้ถูกบันทึกหรือแก้ไขจากอีกหน้าจอแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไขอีกครั้ง'
      : ['PGRST202', '42P01'].includes(error?.code) ? 'สมุดคุมงานซ่อมยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ'
        : error?.message || 'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังไม่ถูกล้าง'
  return Object.assign(new Error(message), { code: error?.code })
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
      if (!isLedgerMonth(month)) throw new Error('กรุณาเลือกเดือนให้ถูกต้อง')
      if (carId && !/^[1-9]\d*$/.test(String(carId))) throw new Error('ทะเบียนรถที่เลือกไม่ถูกต้อง')
      const access = requireAccess()
      const { data, error } = await client.rpc('list_repair_work_ledger_staff', {
        p_staff_code: access.code, p_month: `${month}-01`, p_car_id: carId ? Number(carId) : null,
      })
      checkRevision(access.revision)
      if (error) handleError(error)
      if (!data || !Array.isArray(data.rows) || !Array.isArray(data.cars)) throw new Error('ข้อมูลสมุดคุมไม่ครบ กรุณาโหลดใหม่')
      return data
    },
    async saveRepairLedger(entry) {
      const access = requireAccess()
      // Never forward arbitrary UI state, JWTs or editable audit ownership fields.
      const payload = Object.fromEntries(fields.filter(key => entry[key] !== undefined).map(key => [key, entry[key]]))
      const { data, error } = await client.rpc('save_repair_work_ledger_staff', { p_staff_code: access.code, p_entry: payload })
      checkRevision(access.revision)
      if (error) handleError(error)
      if (!data?.id || !data.updated_at) throw new Error('ไม่ได้รับการยืนยันการบันทึก กรุณาโหลดสมุดคุมเพื่อตรวจสอบก่อนลองอีกครั้ง')
      return data
    },
  }
}
