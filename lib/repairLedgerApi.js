import { isLedgerMonth } from './repairLedger.js'

const fields = ['id', 'source_id', 'source_type', 'client_request_id', 'updated_at', 'car_id',
  'repair_date', 'plate_number', 'department', 'shop_name', 'bill_number', 'amount',
  'repair_description', 'status', 'accounting_document_number', 'paid_date', 'machine_hours']

function ledgerError(error) {
  if (error?.code === '42501') return new Error('กรุณาเข้าสู่ระบบด้วยบัญชีแอดมินเพื่อใช้สมุดคุมงานซ่อม')
  if (['23505', '40001'].includes(error?.code)) return new Error('รายการนี้ถูกบันทึกหรือแก้ไขจากอีกหน้าจอแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนแก้ไขอีกครั้ง')
  if (['PGRST202', '42P01'].includes(error?.code)) return new Error('สมุดคุมงานซ่อมยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ')
  return new Error(error?.message || 'เชื่อมต่อไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลที่กรอกยังไม่ถูกล้าง')
}

/** Dependency injection keeps tests independent of credentials and live records. */
export function createRepairLedgerClient(client) {
  const getRepairLedgerAccess = async () => {
    const { data, error } = await client.auth.getUser()
    if (error) {
      if (error.name === 'AuthSessionMissingError' || error.status === 401 || error.status === 403) return false
      throw ledgerError(error)
    }
    return data?.user?.app_metadata?.role === 'admin'
  }
  const requireAccess = async () => {
    if (!await getRepairLedgerAccess()) throw ledgerError({ code: '42501' })
  }
  return {
    getRepairLedgerAccess,
    async loadRepairLedger({ month, carId = null }) {
      if (!isLedgerMonth(month)) throw new Error('กรุณาเลือกเดือนให้ถูกต้อง')
      if (carId && !/^[1-9]\d*$/.test(String(carId))) throw new Error('ทะเบียนรถที่เลือกไม่ถูกต้อง')
      await requireAccess()
      const { data, error } = await client.rpc('list_repair_work_ledger', {
        p_month: `${month}-01`, p_car_id: carId ? Number(carId) : null,
      })
      if (error) throw ledgerError(error)
      if (!data || !Array.isArray(data.rows) || !Array.isArray(data.cars)) throw new Error('ข้อมูลสมุดคุมไม่ครบ กรุณาโหลดใหม่')
      return data
    },
    async saveRepairLedger(entry) {
      await requireAccess()
      // Never forward arbitrary UI state, JWTs or editable audit ownership fields.
      const payload = Object.fromEntries(fields.filter(key => entry[key] !== undefined).map(key => [key, entry[key]]))
      const { data, error } = await client.rpc('save_repair_work_ledger', { p_entry: payload })
      if (error) throw ledgerError(error)
      if (!data?.id || !data.updated_at) throw new Error('ไม่ได้รับการยืนยันการบันทึก กรุณาโหลดสมุดคุมเพื่อตรวจสอบก่อนลองอีกครั้ง')
      return data
    },
  }
}
