import test from 'node:test'
import assert from 'node:assert/strict'
import { SITE, SITE_LABELS, SITE_BUILDINGS, SITE_ROADS, SITE_CUSTOMER, SITE_CHARGING, displayedParkingSlots, siteParkingPosition, siteParkingSlots, siteBounds, siteOverflowAisles, siteLayout, arrangeFleetParking } from '../lib/fleetSiteLayout.js'
import { demoSnapshot, fleetVehicles } from '../lib/fleetDigitalTwin.js'

test('reference bays are balanced 15/15, facing the road and flush with both canopies',()=>{
  const slots=siteParkingSlots()
  assert.equal(slots.length,30)
  assert.equal(slots.filter(s=>s.parking.row==='upper').length,15)
  assert.equal(slots.filter(s=>s.parking.row==='lower').length,15)
  assert.ok(Math.abs(slots[1].parking.x-1.35-(SITE_CHARGING.x+(SITE_CHARGING.width+.5)/2))<1e-8)
  assert.equal(slots.at(-1).parking.x-slots[1].parking.x,14*2.75)
  assert.equal(new Set(slots.map(s=>s.parking.x+','+s.parking.z)).size,30)
  assert.equal(slots[1].parking.yaw,Math.PI)
  assert.ok(slots.every(s=>Math.abs(s.parking.z)>SITE.roadHalfWidth+1.9))
})

test('empty/deleted spaces remain empty and filtering never renumbers parked vehicles',()=>{
  const cars=fleetVehicles(demoSnapshot()).filter(car=>car.slotNo!==2)
  const slots=siteParkingSlots(cars)
  assert.equal(slots[1].car,null)
  assert.equal(slots[2].car.slotCode,'P03')
  assert.deepEqual(slots[2].parking,siteParkingPosition(3))
  assert.equal(slots.filter(s=>s.car).length,24)
  assert.deepEqual(siteParkingSlots(cars.slice().reverse()),slots)
  const extra={...cars[0],slotNo:31,slotCode:'P31',parking:siteParkingPosition(31)}
  assert.equal(siteParkingSlots([...cars,extra]).at(-1).slotCode,'P31')
  assert.equal(siteParkingSlots([...cars,extra])[30].car,extra)
  assert.ok(siteBounds([extra]).maxZ>=extra.parking.z+4)
})

function rectangle(x,z,width,depth,yaw=0) {
  const c=Math.cos(yaw),s=Math.sin(yaw)
  return [-1,1].flatMap(a=>[-1,1].map(b=>({x:x+a*width/2*c+b*depth/2*s,z:z-a*width/2*s+b*depth/2*c})))
}
function footprint(building) {
  // Include the paved base and the office's projecting entrance canopy.
  const left=-building.width/2-.65,right=building.width/2+(building.office?2.8:.65)
  const shift=(left+right)/2,yaw=building.rotation||0
  return rectangle(building.x+shift*Math.cos(yaw),building.z-shift*Math.sin(yaw),right-left,building.depth+1.3,yaw)
}
function separatingGap(a,b) {
  const edges=[[0,1],[0,2]]
  const axes=[a,b].flatMap(corners=>edges.map(([i,j])=>{
    const dx=corners[j].x-corners[i].x,dz=corners[j].z-corners[i].z,l=Math.hypot(dx,dz)
    return {x:-dz/l,z:dx/l}
  }))
  return Math.max(...axes.map(axis=>{
    const aa=a.map(p=>p.x*axis.x+p.z*axis.z),bb=b.map(p=>p.x*axis.x+p.z*axis.z)
    return Math.max(Math.min(...bb)-Math.max(...aa),Math.min(...aa)-Math.max(...bb))
  }))
}

test('entrance buildings including office canopy have a walkway clear of every road',()=>{
  for(const building of [SITE_BUILDINGS.entry,SITE_BUILDINGS.office]) {
    const a=footprint(building)
    for(const road of SITE_ROADS) {
      const [x,z]=road.from,[xx,zz]=road.to
      const b=rectangle((x+xx)/2,(z+zz)/2,road.width+.5,Math.hypot(xx-x,zz-z)+.2,Math.atan2(xx-x,zz-z))
      assert.ok(separatingGap(a,b)>=.8,'building overlaps walkway/road '+road.key)
    }
    assert.ok(a.every(p=>p.x>SITE.bounds.minX && p.x<SITE.bounds.maxX && p.z>SITE.bounds.minZ && p.z<SITE.bounds.maxZ))
  }
  assert.ok(separatingGap(footprint(SITE_BUILDINGS.entry),footprint(SITE_BUILDINGS.office))>=1)
  for(const [name,key] of [['office','office'],['entry','entry-building']]) {
    const label=SITE_LABELS.find(l=>l.key===key)
    assert.equal(label.x,SITE_BUILDINGS[name].x)
    assert.equal(label.z,SITE_BUILDINGS[name].z)
  }
})

test('new cars alternate between the same two rows without renumbering P01–P30',()=>{
  const base=siteParkingSlots()
  for(const highest of [31,42,43,55,120]) {
    const car={slotNo:highest,parking:siteParkingPosition(highest)}
    const slots=siteParkingSlots([car]),aisles=siteOverflowAisles([car]),bounds=siteBounds([car])
    assert.equal(slots.length,highest)
    assert.deepEqual(slots.slice(0,30).map(s=>s.parking),base.map(s=>s.parking))
    assert.equal(slots[highest-1].car,car)
    assert.equal(slots[highest-1].parking.yaw,highest%2?0:Math.PI)
    assert.equal(Math.abs(car.parking.z),6.9)
    assert.deepEqual(aisles,[])
    assert.ok(bounds.maxX>car.parking.x+12)
    assert.ok(slots.every(s=>s.parking.z+1.9<bounds.maxZ))
  }
  assert.deepEqual(siteOverflowAisles([{slotNo:31}]),[])
})

test('entrance is left of slots, exit is right, with a dead end beyond the exit',()=>{
  assert.ok(SITE.entrance.x<siteParkingPosition(1).x)
  assert.ok(SITE.exit.x>siteParkingPosition(18).x)
  assert.ok(SITE.roadEnd>SITE.exit.x)
  for(const key of ['office','entry-building','one-storey','customer','carport','rear-building','entrance','exit','dead-end']) assert.ok(SITE_LABELS.some(l=>l.key===key))
})

test('customer and EV carports face each other, with all permanent rows outside the roofs',()=>{
  assert.equal(SITE_CUSTOMER.x,SITE_CHARGING.x)
  assert.equal(SITE_CUSTOMER.z,-SITE_CHARGING.z)
  assert.equal(SITE_CUSTOMER.width,SITE_CHARGING.width)
  assert.equal(SITE_CUSTOMER.depth,SITE_CHARGING.depth)
  const right=SITE_CUSTOMER.x+(SITE_CUSTOMER.width+.5)/2
  assert.ok(Math.abs(siteParkingPosition(1).x-1.35-right)<1e-8)
  assert.ok(Math.abs(siteParkingPosition(2).x-1.35-right)<1e-8)
  assert.ok(SITE.exit.x>siteParkingPosition(18).x+4)
  assert.equal(SITE.roadEnd-SITE.roadStart,88.5)
})

test('visible bays balance within one car, are contiguous and new cars append without moving old cars',()=>{
  const raw=demoSnapshot(),before=fleetVehicles(raw)
  const newCar={...raw.carsDataRaw[0],id:'new-31',fuel_type:'diesel',car_type:'รถกระบะ'}
  const after=fleetVehicles({...raw,carsDataRaw:[...raw.carsDataRaw,newCar],parkingSlots:[...raw.parkingSlots,{car_id:newCar.id,slot_no:31}]})
  assert.equal(after.at(-1).slotCode,'P31')
  const lastOnSide=before.filter(car=>car.parking.row===after.at(-1).parking.row).at(-1)
  assert.equal(after.at(-1).parking.x-lastOnSide.parking.x,2.75)
  assert.deepEqual(after.slice(0,-1).map(car=>car.parking),before.map(car=>car.parking))
  const hidden=fleetVehicles({...raw,carsDataRaw:raw.carsDataRaw.map(car=>car.id==='demo-20'?{...car,is_visible:false}:car)})
  const lower=hidden.filter(car=>car.parking.row==='lower')
  lower.slice(1).forEach((car,i)=>assert.equal(car.parking.x-lower[i].parking.x,2.75))
  assert.ok(!lower.some(car=>car.slotNo===20))
  assert.equal(siteLayout(arrangeFleetParking(Array.from({length:90},(_,n)=>({id:n,slotNo:n+1})))).exit.x>100,true)
  for(const length of [0,1,3,28,29,30,65,120]) {
    const cars=arrangeFleetParking(Array.from({length},(_,n)=>({id:n,slotNo:n+1})))
    assert.ok(Math.abs(cars.filter(c=>c.parking.row==='upper').length-cars.filter(c=>c.parking.row==='lower').length)<=1)
  }
  const subset=arrangeFleetParking([{id:1,slotNo:2},{id:2,slotNo:8},{id:3,slotNo:10},{id:4,slotNo:21},{id:5,slotNo:25,is_visible:false},{id:6}])
  assert.deepEqual(subset.filter(c=>c.parking).map(c=>c.slotNo),[2,8,10,21])
  assert.equal(subset.filter(c=>c.parking?.row==='upper').length,2)
  assert.equal(subset.filter(c=>c.parking?.row==='lower').length,2)
})

test('admin-hidden and absent cars have no painted slots or labels; returning visibility restores the same ID',()=>{
  const raw=demoSnapshot(),hidden={...raw,carsDataRaw:raw.carsDataRaw.map(car=>car.id==='demo-2'?{...car,is_visible:false}:car)}
  const cars=fleetVehicles(hidden),slots=displayedParkingSlots(cars)
  assert.equal(slots.length,24)
  assert.ok(!slots.some(slot=>slot.slotCode==='P02'))
  assert.ok(!slots.some(slot=>slot.slotCode==='P29'||slot.slotCode==='P30'))
  assert.equal(slots.find(slot=>slot.slotCode==='P03').car.id,'demo-3')
  const onTrip={...cars[0],status:'on_trip'}
  assert.ok(displayedParkingSlots([onTrip]).some(slot=>slot.slotCode==='P01'))
  assert.deepEqual(displayedParkingSlots([{...onTrip,is_visible:false}]),[])
  const restored=displayedParkingSlots(fleetVehicles(raw)).find(slot=>slot.slotCode==='P02')
  assert.equal(restored.car.id,'demo-2')
  assert.deepEqual(restored.parking,siteParkingPosition(2))
})
