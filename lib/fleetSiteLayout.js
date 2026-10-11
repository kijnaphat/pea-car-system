// User-supplied Eo.jpg plan, expressed in illustrative scene units, not GPS.
// Slot numbers remain permanent database IDs; only their visual coordinates move.
export const SITE = {
  roadStart: -22, roadEnd: 46, roadHalfWidth: 4.4,
  incomingLane: -2.1, outgoingLane: 2.1,
  entrance: { x: -48, z: -35.1 }, exit: { x: 36, z: -19 },
  bounds: { minX: -57, maxX: 49, minZ: -43, maxZ: 15, maxY: 9 },
}

// Shared footprints keep buildings, labels and clearance checks in agreement.
const approachYaw = Math.atan2(20,27)
export const SITE_BUILDINGS = {
  office: { x: -41.5, z: -5.7, width: 7.6, depth: 22, floors: 4, accent: '#6c99bd', rotation: approachYaw, office: true },
  entry: { x: -50, z: -20, width: 5.2, depth: 6, floors: 2, accent: '#c8797e', rotation: approachYaw },
  lower: { x: -20, z: 10, width: 5, depth: 5, floors: 1, accent: '#aa95c7' },
  rear: { x: 42, z: 9.5, width: 6, depth: 5.2, floors: 2, accent: '#92bc78' },
}
export const SITE_ROADS = [
  { key: 'main', from: [SITE.roadStart,0], to: [SITE.roadEnd,0], width: 8.8 },
  { key: 'approach', from: [SITE.entrance.x,SITE.entrance.z], to: [SITE.roadStart,0], width: 8.8 },
  { key: 'entry-street', from: [-54.5,-30.3], to: [-41.5,-39.9], width: 5.6 },
  { key: 'exit', from: [SITE.exit.x,0], to: [SITE.exit.x,SITE.exit.z], width: 6.4 },
  { key: 'exit-street', from: [29,SITE.exit.z], to: [47,SITE.exit.z], width: 5.6 },
]
export const OVERFLOW_ROW_SPACING = 9.6
export const OVERFLOW_AISLE_OFFSET = 4.8

export function siteParkingPosition(slotNumber) {
  const n = Math.max(1, Math.floor(Number(slotNumber) || 1)) - 1
  if (n < 18) return { row: 'upper', x: -14 + n * 2.75, z: -6.9, yaw: 0 }
  // P19–P30 align with the rightmost twelve spaces in the upper row.
  // Future slots form additional rows without reusing a deleted vehicle's ID.
  const extraRow = Math.floor((n - 18) / 12)
  return { row: 'lower', x: 2.5 + ((n - 18) % 12) * 2.75,
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

export const SITE_LABELS = [
  { key: 'office', label: 'สำนักงาน 4 ชั้น', detail: 'กฟภ. กำแพงแสน', x: SITE_BUILDINGS.office.x, y: 8.9, z: SITE_BUILDINGS.office.z, primary: true },
  { key: 'entry-building', label: 'อาคาร 2 ชั้น', x: SITE_BUILDINGS.entry.x, y: 4.9, z: SITE_BUILDINGS.entry.z },
  { key: 'one-storey', label: 'อาคาร 1 ชั้น', x: SITE_BUILDINGS.lower.x, y: 3.1, z: SITE_BUILDINGS.lower.z },
  { key: 'customer', label: 'โรงรถลูกค้า', x: -20.2, y: 3.6, z: -7.5 },
  { key: 'carport', label: 'หลังคาโรงรถ', x: -8, y: 3.6, z: 10 },
  { key: 'rear-building', label: 'อาคาร 2 ชั้น', x: SITE_BUILDINGS.rear.x, y: 4.9, z: SITE_BUILDINGS.rear.z },
  { key: 'entrance', label: 'ทางเข้า', x: -39, y: .4, z: -22 },
  { key: 'exit', label: 'ทางออก', x: 36, y: .4, z: -12 },
  { key: 'dead-end', label: 'ทางตัน', x: 44, y: .4, z: 0 },
]
