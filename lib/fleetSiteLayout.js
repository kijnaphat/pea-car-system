// User-supplied Eo.jpg plan, expressed in illustrative scene units, not GPS.
// Slot numbers remain permanent database IDs; only their visual coordinates move.
export const SITE = {
  roadStart: -22, roadEnd: 46, roadHalfWidth: 4.4,
  incomingLane: -2.1, outgoingLane: 2.1,
  entrance: { x: -42, z: -27 }, exit: { x: 36, z: -19 },
  bounds: { minX: -52, maxX: 49, minZ: -35, maxZ: 15, maxY: 9 },
}

export function siteParkingPosition(slotNumber) {
  const n = Math.max(1, Math.floor(Number(slotNumber) || 1)) - 1
  if (n < 18) return { row: 'upper', x: -14 + n * 2.75, z: -6.9, yaw: 0 }
  // P19–P30 align with the rightmost twelve spaces in the upper row.
  // Future slots form additional rows without reusing a deleted vehicle's ID.
  const extraRow = Math.floor((n - 18) / 12)
  return { row: 'lower', x: 2.5 + ((n - 18) % 12) * 2.75, z: 6.9 + extraRow * 6, yaw: Math.PI }
}

export function siteBounds(vehicles = []) {
  return { ...SITE.bounds, maxZ: Math.max(SITE.bounds.maxZ, ...vehicles.map(car => (car.parking?.z || 0) + 6)) }
}

export const siteOverflowAisles = vehicles => [...new Set(vehicles.filter(car=>car.slotNo>30).map(car=>car.parking.z+2.6))]

export function siteParkingSlots(vehicles = []) {
  const assigned = new Map(vehicles.filter(car => car.parking).map(car => [car.slotNo,car]))
  const numbers = [...new Set([...Array.from({length:30},(_,n)=>n+1),...assigned.keys()])].sort((a,b)=>a-b)
  return numbers.map(slotNo => ({ slotNo, slotCode: `P${String(slotNo).padStart(2,'0')}`,
    parking: siteParkingPosition(slotNo), car: assigned.get(slotNo) || null }))
}

export const SITE_LABELS = [
  { key: 'office', label: 'สำนักงาน 4 ชั้น', detail: 'กฟภ. กำแพงแสน', x: -37, y: 8.9, z: -9, primary: true },
  { key: 'entry-building', label: 'อาคาร 2 ชั้น', x: -46, y: 4.9, z: -23 },
  { key: 'one-storey', label: 'อาคาร 1 ชั้น', x: -20, y: 3.1, z: 10 },
  { key: 'customer', label: 'โรงรถลูกค้า', x: -20.2, y: 3.6, z: -7.5 },
  { key: 'carport', label: 'หลังคาโรงรถ', x: -8, y: 3.6, z: 10 },
  { key: 'rear-building', label: 'อาคาร 2 ชั้น', x: 42, y: 4.9, z: 9.5 },
  { key: 'entrance', label: 'ทางเข้า', x: -39, y: .4, z: -22 },
  { key: 'exit', label: 'ทางออก', x: 36, y: .4, z: -12 },
  { key: 'dead-end', label: 'ทางตัน', x: 44, y: .4, z: 0 },
]
