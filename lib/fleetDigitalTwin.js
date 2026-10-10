import { isChargeTrip, isElectricCar } from './tripActivity.js'

export const FLEET_STATUSES = {
  available: { label: 'พร้อมใช้งาน', color: '#10b981', icon: 'car' },
  on_trip: { label: 'ใช้งานอยู่', color: '#f97316', icon: 'route' },
  charging: { label: 'กำลังชาร์จ', color: '#3b82f6', icon: 'zap' },
  maintenance: { label: 'ซ่อมบำรุง', color: '#ef4444', icon: 'wrench' },
  unknown: { label: 'รอตรวจสอบ', color: '#64748b', icon: 'circle' },
}

// These are coordinates in a fictional office model, never real-world positions.
export function parkingPosition(slotNumber) {
  const n = Math.max(1, Number(slotNumber) || 1) - 1
  if (n < 10) return { zone: 'A', x: -14 + (n % 5) * 3, z: 1 + Math.floor(n / 5) * 5 }
  if (n < 18) return { zone: 'B', x: 6 + ((n - 10) % 4) * 3, z: 1 + Math.floor((n - 10) / 4) * 5 }
  if (n < 25) return { zone: 'C', x: -14 + ((n - 18) % 5) * 3, z: 11 + Math.floor((n - 18) / 5) * 5 }
  return { zone: 'D', x: 6 + ((n - 25) % 4) * 3, z: 11 + Math.floor((n - 25) / 4) * 5 }
}

export function fleetVehicles(snapshot) {
  const active = new Map((snapshot.activeLogs || []).map(log => [String(log.car_id), log]))
  const latest = new Map((snapshot.latestLogs || []).map(log => [String(log.car_id), log]))
  const charges = new Map((snapshot.latestCharges || []).map(log => [String(log.car_id), log]))
  const slots = new Map((snapshot.parkingSlots || []).map(slot => [String(slot.car_id), slot.slot_no]))
  return (snapshot.carsDataRaw || []).filter(car => car.is_visible !== false).map(car => {
    const trip = active.get(String(car.id))
    const last = latest.get(String(car.id))
    const status = car.status === 'available' ? 'available' : car.status === 'maintenance' ? 'maintenance'
      : car.status === 'busy' && trip ? isChargeTrip(trip, car) ? 'charging' : 'on_trip' : 'unknown'
    const slotNo = slots.get(String(car.id))
    const charge = status === 'charging' ? trip : charges.get(String(car.id))
    return { ...car, status, trip, lastTrip: last, slotNo,
      slotCode: slotNo ? `P${String(slotNo).padStart(2, '0')}` : 'ยังไม่กำหนดช่อง',
      parking: slotNo ? parkingPosition(slotNo) : null,
      driver: (trip || last)?.driver_name || 'ยังไม่มีรายการ',
      location: trip?.station_name || trip?.location || '',
      battery: isElectricCar(car) ? status === 'charging' ? charge?.battery_before ?? null : charge?.battery_after ?? null : null,
      batteryAt: charge?.end_time || charge?.start_time || null,
    }
  }).sort((a, b) => (a.slotNo || Infinity) - (b.slotNo || Infinity) || Number(a.id) - Number(b.id))
}

export function movementEvents(before, after) {
  if (!before) return [] // Reload initializes state; never replay old transactions.
  const old = new Map(before.map(car => [String(car.id), car]))
  return after.flatMap(car => {
    const previous = old.get(String(car.id))
    if (!previous || !car.parking) return []
    const events = []
    const add = (direction, tripId) => { if (tripId) events.push({ carId: car.id, direction, key: `${tripId}:${direction}` }) }
    if (previous.status === 'on_trip' && (car.status !== 'on_trip' || previous.trip?.id !== car.trip?.id)) add('return', previous.trip?.id)
    if (car.status === 'on_trip' && (previous.status !== 'on_trip' || previous.trip?.id !== car.trip?.id)) add('depart', car.trip?.id)
    // A short trip can finish between two cached reads. Animate its real pair once.
    if (car.status === 'available' && previous.status === 'available' && car.lastTrip?.id !== previous.lastTrip?.id && !isChargeTrip(car.lastTrip, car)) {
      add('depart', car.lastTrip?.id); add('return', car.lastTrip?.id)
    }
    return events
  })
}

export function dayBounds(day) {
  const start = new Date(`${day}T00:00:00+07:00`).getTime()
  return { start, end: start + 86400000 }
}

export function replaySnapshot(live, logs, timestamp) {
  const cars = live.carsDataRaw || []
  const activeLogs = []; const latestLogs = []; const latestCharges = []
  cars.forEach(car => {
    const rows = logs.filter(log => String(log.car_id) === String(car.id) && Date.parse(log.start_time) <= timestamp)
    const active = rows.filter(log => !log.parent_trip_log_id && (!log.end_time || Date.parse(log.end_time) > timestamp))
      .sort((a, b) => Date.parse(b.start_time) - Date.parse(a.start_time))[0]
    const complete = rows.filter(log => log.end_time && Date.parse(log.end_time) <= timestamp)
      .sort((a, b) => Date.parse(b.end_time) - Date.parse(a.end_time))
    if (active) activeLogs.push(active)
    if (complete[0]) latestLogs.push(complete[0])
    const charge = complete.find(log => isChargeTrip(log, car))
    if (charge) latestCharges.push(charge)
  })
  const activeIds = new Set(activeLogs.map(log => String(log.car_id)))
  return { ...live, activeLogs, latestLogs, latestCharges,
    carsDataRaw: cars.map(car => ({ ...car, status: activeIds.has(String(car.id)) ? 'busy' : 'available' })) }
}

export function demoSnapshot() {
  const carsDataRaw = Array.from({ length: 25 }, (_, n) => ({ id: `demo-${n + 1}`, plate_number: `กข ${1200 + n * 113} นฐ.`,
    model: n % 3 === 0 ? 'MG EP' : 'Toyota Hilux', car_type: n % 3 === 0 ? 'รถ EV' : 'รถกระบะ',
    fuel_type: n % 3 === 0 ? 'EV' : 'ดีเซล', status: n === 24 ? 'maintenance' : 'available', departments: { name: 'ข้อมูลสาธิต' } }))
  return { carsDataRaw, activeLogs: [], latestLogs: [], latestCharges: [], maintenanceRecords: [],
    parkingSlots: carsDataRaw.map((car, n) => ({ car_id: car.id, slot_no: n + 1 })), generatedAt: new Date().toISOString() }
}
