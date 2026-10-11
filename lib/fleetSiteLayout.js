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
  lower: { x: -24, z: 10, width: 5, depth: 5, floors: 1, accent: '#aa95c7' },
  rear: { x: 63.5, z: 10, width: 6, depth: 5.2, floors: 2, accent: '#92bc78' },
}
export const SITE_CHARGING = { x: -8.75, z: 9.5, width: 14.8, depth: 6.4, rowSpacing: 10 }
// Matching carports directly opposite each other, with a clear road in between.
export const SITE_CUSTOMER = { x: SITE_CHARGING.x, z: -SITE_CHARGING.z, width: SITE_CHARGING.width, depth: SITE_CHARGING.depth }
export const LOWER_PARKING_START_X = Math.round((SITE_CHARGING.x+(SITE_CHARGING.width+.5)/2+1.35)*100)/100
export const PARKING_START_X = LOWER_PARKING_START_X
// Both rows meet their carport edge. Visual order is independent of permanent IDs.
export const SITE_HEDGE = { x:-33.5, z:-27.2, stepX:1.12, stepZ:1.5, count:13, width:1.7 }
export const SITE_BICYCLES = { x:-17.8, z:-15.3, width:3.8, depth:2 }
export const siteRoads = (site=SITE) => [
  { key: 'main', from: [site.roadStart,0], to: [site.roadEnd,0], width: 8.8 },
  { key: 'approach', from: [site.entrance.x,site.entrance.z], to: [site.roadStart,0], width: 8.8 },
  { key: 'entry-street', from: [-54.5,-30.3], to: [-41.5,-39.9], width: 5.6 },
  { key: 'exit', from: [site.exit.x,0], to: [site.exit.x,site.exit.z], width: 6.4 },
  { key: 'exit-street', from: [site.exit.x-9.5,site.exit.z], to: [site.exit.x+11.5,site.exit.z], width: 5.6 },
]
export const SITE_ROADS = siteRoads()
export const OVERFLOW_ROW_SPACING = 9.6
export const OVERFLOW_AISLE_OFFSET = 4.8

export function siteParkingPosition(slotNumber,visibleIndex) {
  const n = Math.max(1, Math.floor(Number(slotNumber) || 1)) - 1
  const index=visibleIndex ?? n,upper=index%2===0
  return {row:upper?'upper':'lower',x:PARKING_START_X+Math.floor(index/2)*2.75,z:upper?-6.9:6.9,yaw:upper?0:Math.PI}
}

export function arrangeFleetParking(vehicles) {
  let visibleIndex=0
  return vehicles.filter(car=>car.is_visible!==false).sort((a,b)=>(a.slotNo||Infinity)-(b.slotNo||Infinity)).map(car=>({...car,
    parking:car.slotNo ? siteParkingPosition(car.slotNo,visibleIndex++) : null}))
}

export function siteLayout(vehicles=[]) {
  const right=Math.max(PARKING_START_X,...vehicles.filter(car=>car.parking && car.is_visible!==false).map(car=>car.parking.x))
  const exitX=Math.max(SITE.exit.x,right+5.75),roadEnd=exitX+10
  return {...SITE,exit:{...SITE.exit,x:exitX},roadEnd,bounds:{...SITE.bounds,maxX:roadEnd+3.5}}
}

export function siteBounds(vehicles = []) {
  return siteLayout(vehicles).bounds
}

export function siteOverflowAisles() { return [] }

export function siteParkingSlots(vehicles = []) {
  const assigned = new Map(vehicles.filter(car => car.parking).map(car => [car.slotNo,car]))
  const highest = Math.max(30,...assigned.keys())
  const capacity = highest
  const numbers = Array.from({length:capacity},(_,n)=>n+1)
  return numbers.map(slotNo => ({ slotNo, slotCode: `P${String(slotNo).padStart(2,'0')}`,
    parking: assigned.get(slotNo)?.parking || siteParkingPosition(slotNo), car: assigned.get(slotNo) || null }))
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

export function siteLabels(vehicles=[]) {
  const site=siteLayout(vehicles)
  return SITE_LABELS.map(label=>label.key==='rear-building'?{...label,x:site.roadEnd-3}
    :label.key==='exit'?{...label,x:site.exit.x}:label.key==='dead-end'?{...label,x:site.roadEnd-2}:label)
}
