// User-supplied Eo.jpg plan, expressed in illustrative scene units, not GPS.
// Slot numbers remain permanent database IDs; only their visual coordinates move.
export const SITE = {
  roadStart: -22, roadEnd: 66.5, roadHalfWidth: 4.4,
  incomingLane: -2.1, outgoingLane: 2.1,
  entrance: { x: -48, z: -35.1 }, exit: { x: 56.5, z: -19 },
  bounds: { minX: -57, maxX: 70, minZ: -43, maxZ: 15, maxY: 9 },
}

// Shared footprints keep buildings, labels and clearance checks in agreement.
const approachYaw = Math.atan2(20,27)
export const SITE_BUILDINGS = {
  office: { x: -41.5, z: -5.7, width: 7.6, depth: 22, floors: 4, accent: '#6c99bd', rotation: approachYaw, office: true },
  entry: { x: -50, z: -20, width: 5.2, depth: 6, floors: 2, accent: '#c8797e', rotation: approachYaw },
  lower: { x: -20, z: 10, width: 5, depth: 5, floors: 1, accent: '#aa95c7' },
  rear: { x: 63.5, z: 10, width: 6, depth: 5.2, floors: 2, accent: '#92bc78' },
}
export const SITE_CHARGING = { x: -8.75, z: 9.5, width: 14.8, depth: 6.4, rowSpacing: 10 }
// Matching carports directly opposite each other, with a clear road in between.
export const SITE_CUSTOMER = { x: SITE_CHARGING.x, z: -SITE_CHARGING.z, width: SITE_CHARGING.width, depth: SITE_CHARGING.depth }
export const PARKING_START_X = 4
export const SITE_ROADS = [
  { key: 'main', from: [SITE.roadStart,0], to: [SITE.roadEnd,0], width: 8.8 },
  { key: 'approach', from: [SITE.entrance.x,SITE.entrance.z], to: [SITE.roadStart,0], width: 8.8 },
  { key: 'entry-street', from: [-54.5,-30.3], to: [-41.5,-39.9], width: 5.6 },
  { key: 'exit', from: [SITE.exit.x,0], to: [SITE.exit.x,SITE.exit.z], width: 6.4 },
  { key: 'exit-street', from: [SITE.exit.x-9.5,SITE.exit.z], to: [SITE.exit.x+11.5,SITE.exit.z], width: 5.6 },
]
export const OVERFLOW_ROW_SPACING = 9.6
export const OVERFLOW_AISLE_OFFSET = 4.8

export function siteParkingPosition(slotNumber) {
  const n = Math.max(1, Math.floor(Number(slotNumber) || 1)) - 1
  if (n < 18) return { row: 'upper', x: PARKING_START_X + n * 2.75, z: -6.9, yaw: 0 }
  // P19–P30 align with the rightmost twelve spaces in the upper row.
  // Future slots form additional rows without reusing a deleted vehicle's ID.
  const extraRow = Math.floor((n - 18) / 12)
  return { row: 'lower', x: PARKING_START_X + 6*2.75 + ((n - 18) % 12) * 2.75,
    z: 6.9 + extraRow * OVERFLOW_ROW_SPACING, yaw: extraRow ? 0 : Math.PI }
}

export function siteBounds(vehicles = []) {
  return { ...SITE.bounds, maxZ: Math.max(SITE.bounds.maxZ,
    ...siteOverflowAisles(vehicles).map(z => z + 3.5)) }
}

export function siteOverflowAisles(vehicles = []) {
  const highest = Math.max(30,...vehicles.filter(car=>car.parking).map(car=>car.slotNo))
  const rows = Math.ceil((highest-30)/12)
  return Array.from({length:rows},(_,n)=>siteParkingPosition(31+n*12).z+OVERFLOW_AISLE_OFFSET)
}

export function siteParkingSlots(vehicles = []) {
  const assigned = new Map(vehicles.filter(car => car.parking).map(car => [car.slotNo,car]))
  const highest = Math.max(30,...assigned.keys())
  // Expand by whole rows (P31–P42, P43–P54, …), including currently empty spaces.
  const capacity = 30 + Math.ceil((highest-30)/12)*12
  const numbers = Array.from({length:capacity},(_,n)=>n+1)
  return numbers.map(slotNo => ({ slotNo, slotCode: `P${String(slotNo).padStart(2,'0')}`,
    parking: siteParkingPosition(slotNo), car: assigned.get(slotNo) || null }))
}

// Capacity is planning geometry, not evidence that a hidden/absent car exists.
// Keep permanent IDs and empty on-trip spaces, but never invent visible Pxx bays.
export function displayedParkingSlots(vehicles = []) {
  return siteParkingSlots(vehicles.filter(car=>car.is_visible!==false))
    .filter(slot=>slot.car)
}

export const SITE_LABELS = [
  { key: 'office', label: 'สำนักงาน 4 ชั้น', detail: 'กฟภ. กำแพงแสน', x: SITE_BUILDINGS.office.x, y: 8.9, z: SITE_BUILDINGS.office.z, primary: true },
  { key: 'entry-building', label: 'อาคาร 2 ชั้น', x: SITE_BUILDINGS.entry.x, y: 4.9, z: SITE_BUILDINGS.entry.z },
  { key: 'one-storey', label: 'อาคาร 1 ชั้น', x: SITE_BUILDINGS.lower.x, y: 3.1, z: SITE_BUILDINGS.lower.z },
  { key: 'customer', label: 'โรงรถลูกค้า', x: SITE_CUSTOMER.x, y: 3.6, z: SITE_CUSTOMER.z },
  { key: 'carport', label: 'โรงรถ / จุดชาร์จ EV', x: SITE_CHARGING.x, y: 4.2, z: SITE_CHARGING.z },
  { key: 'rear-building', label: 'อาคาร 2 ชั้น', x: SITE_BUILDINGS.rear.x, y: 4.9, z: SITE_BUILDINGS.rear.z },
  { key: 'entrance', label: 'ทางเข้า', x: -39, y: .4, z: -22 },
  { key: 'exit', label: 'ทางออก', x: SITE.exit.x, y: .4, z: -12 },
  { key: 'dead-end', label: 'ทางตัน', x: SITE.roadEnd-2, y: .4, z: 0 },
]
