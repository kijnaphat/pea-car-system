import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { demoSnapshot, fleetVehicles } from '../lib/fleetDigitalTwin.js'
import { THAMAKA_BUILDINGS, THAMAKA_WALKERS, thamakaVehicles, thamakaOutline, thamakaLayout, thamakaSlots, thamakaTrafficPath, thamakaRoadNetwork, thamakaRoadMarkings, pointInRoad, createThamakaTraffic, createThamakaVisitors } from '../lib/thamakaSiteLayout.js'
import { trafficPose, trafficOverlaps } from '../lib/fleetTraffic.js'
import { walkingPose } from '../lib/fleetCampusLife.js'

test('Thamaka display keeps statuses, permanent IDs and source data immutable',()=>{
  const data=demoSnapshot(),before=structuredClone(data),legacy=fleetVehicles(data),cars=thamakaVehicles(data)
  assert.deepEqual(data,before)
  assert.deepEqual(cars.map(c=>[c.id,c.slotNo,c.slotCode,c.status]),legacy.map(c=>[c.id,c.slotNo,c.slotCode,c.status]))
  assert.notDeepEqual(cars[0].parking,legacy[0].parking)
  assert.equal(thamakaSlots(thamakaVehicles({})).length,0)
  const hidden={...data,carsDataRaw:data.carsDataRaw.map((c,n)=>n===1?{...c,is_visible:false}:c)}
  assert.ok(!thamakaSlots(thamakaVehicles(hidden)).some(s=>s.slotNo===2))
  assert.equal(thamakaVehicles(hidden)[1].slotNo,3)
})
test('reference land is a separate compact fenced precinct with a courtyard office and roof cluster',()=>{
  assert.ok(THAMAKA_BUILDINGS.find(b=>b.key==='office').atrium)
  assert.ok(THAMAKA_BUILDINGS.some(b=>b.key==='office-wing'))
  assert.equal(thamakaOutline().length,6)
  const office=THAMAKA_BUILDINGS.find(b=>b.key==='office'),warehouse=THAMAKA_BUILDINGS.find(b=>b.key==='warehouse')
  assert.ok(office.x>0&&warehouse.x<0,'office must be right and warehouse left, as annotated')
  assert.ok(office.solar)
  assert.ok(thamakaLayout().entrance.x>office.x&&thamakaLayout().exit.x>office.x,'both gates on the right')
  const network=thamakaRoadNetwork()
  assert.equal(network.surface.length,1)
  assert.ok(network.routes.some(r=>r.key==='frontage'))
  const ui=readFileSync(new URL('../app/dashboard/components/FleetDigitalTwin.js',import.meta.url),'utf8')
  assert.ok(ui.includes("import('./ThamakaScene')"))
  assert.ok(ui.includes('thamakaVehicles(next)'))
  assert.ok(ui.includes('ThamakaFlatMap vehicles={vehicles}'))
  assert.ok(!ui.includes('สำนักงาน 4 ชั้น'))
})
test('all fleet paths and pedestrian routes clear the reference buildings',()=>{
  const cars=thamakaVehicles(demoSnapshot())
  for(const car of cars)for(const direction of ['depart','return',...(car.chargingBay?['charge','uncharge']:[])]) {
    const path=thamakaTrafficPath(car.parking,direction,car.chargingBay,thamakaLayout(cars))
    for(let time=0;time<=path.duration;time+=.16) {
      const p=trafficPose(path,time)
      for(const b of THAMAKA_BUILDINGS)assert.ok(Math.abs(p.x-b.x)>=b.width/2+1.05||Math.abs(p.z-b.z)>=b.depth/2+1.85,`${car.slotCode} ${direction} hits ${b.key}`)
    }
  }
  for(const person of THAMAKA_WALKERS)for(let time=0;time<80;time+=.7) {
    const p=walkingPose(person,time)
    for(const b of THAMAKA_BUILDINGS)assert.ok(Math.abs(p.x-b.x)>b.width/2+.15||Math.abs(p.z-b.z)>b.depth/2+.15,`person hits ${b.key}`)
  }
})
test('simultaneous real departures keep shared collision reservations on the new site',()=>{
  const cars=thamakaVehicles(demoSnapshot()).slice(0,12),traffic=createThamakaTraffic()
  traffic.setFleet(cars);traffic.enqueue(cars.map(c=>({carId:c.id,direction:'depart',key:`${c.id}:new-map-test`})))
  const end=Math.max(...traffic.reservations().map(r=>r.end))+1
  while(traffic.now()<end) {
    traffic.advance(.1)
    const poses=cars.map(c=>traffic.pose(c.id)).filter(p=>p.visible)
    for(let i=0;i<poses.length;i++)for(let j=i+1;j<poses.length;j++)assert.equal(trafficOverlaps(poses[i],poses[j]),false,'two vehicles overlap')
  }
})
test('new records extend only Thamaka visual bays without changing existing IDs or calling APIs',()=>{
  const data=demoSnapshot(),before=thamakaVehicles(data)
  const after=thamakaVehicles({...data,carsDataRaw:[...data.carsDataRaw,{...data.carsDataRaw[0],id:'extra'}],parkingSlots:[...data.parkingSlots,{car_id:'extra',slot_no:101}]})
  assert.deepEqual(after.slice(0,-1).map(c=>c.parking),before.map(c=>c.parking))
  assert.equal(after.at(-1).slotCode,'P101')
  assert.ok(thamakaLayout(after).bounds.maxX>after.at(-1).parking.x+15)
  const layout=readFileSync(new URL('../lib/thamakaSiteLayout.js',import.meta.url),'utf8')
  assert.doesNotMatch(layout,/supabase\.|fetch\(|navigator\.geolocation|\.from\(['"]/)
})

test('material-yard and future rear rows preserve existing positions and clear all buildings',()=>{
  const data=demoSnapshot(),before=thamakaVehicles(data)
  const additions=Array.from({length:30},(_,n)=>({...data.carsDataRaw[6],id:`extra-${n}`}))
  const fleet=thamakaVehicles({...data,carsDataRaw:[...data.carsDataRaw,...additions],parkingSlots:[...data.parkingSlots,...additions.map((c,n)=>({car_id:c.id,slot_no:26+n}))]})
  assert.deepEqual(fleet.slice(0,25).map(c=>c.parking),before.map(c=>c.parking))
  assert.ok(thamakaLayout(fleet).bounds.minZ<thamakaLayout(before).bounds.minZ)
  for(const car of fleet)for(const direction of ['depart','return']) {
    const route=thamakaTrafficPath(car.parking,direction,car.chargingBay)
    for(let t=0;t<route.duration;t+=.3)for(const b of THAMAKA_BUILDINGS) {
      const p=trafficPose(route,t)
      assert.ok(Math.abs(p.x-b.x)>=b.width/2+1.05||Math.abs(p.z-b.z)>=b.depth/2+1.85,`${car.slotCode} ${direction} ${b.key}`)
    }
  }
})
test('Thamaka fictional visitor cars and motorcycles use their own right-side parking safely',()=>{
  const visitors=createThamakaVisitors(),traffic=createThamakaTraffic(),fleet=thamakaVehicles(demoSnapshot())
  assert.equal(visitors.cars.length,5)
  assert.ok(visitors.cars.every(c=>c.parking.x>30&&c.parking.row==='visitor'))
  traffic.setFleet([...fleet,...visitors.cars])
  for(let n=0;n<4000;n++){traffic.advance(.1);visitors.tick(traffic,fleet)}
  assert.equal(fleet.length,25)
  for(const car of visitors.cars)for(const direction of ['depart','return']) {
    const route=thamakaTrafficPath(car.parking,direction)
    for(let t=0;t<route.duration;t+=.2)for(const b of THAMAKA_BUILDINGS) {
      const p=trafficPose(route,t)
      assert.ok(Math.abs(p.x-b.x)>=b.width/2+1.05||Math.abs(p.z-b.z)>=b.depth/2+1.85,`${car.id} hits ${b.key}`)
    }
  }
})

test('west street bridges the canal and joins both public roads at full width',()=>{
  const {surface}=thamakaRoadNetwork()
  for(let z=-38;z<48;z+=.2)for(const x of [-45.5,-44,-42.5])assert.ok(pointInRoad({x,z},surface),`west road gap at ${x},${z}`)
  for(let x=-44;x<28;x+=.2)for(const z of [45.5,47,48.5])assert.ok(pointInRoad({x,z},surface),'main-road junction is pinched')
})
test('both gate lanes carry the complete vehicle footprint to the public road',()=>{
  const cars=thamakaVehicles(demoSnapshot()),{surface}=thamakaRoadNetwork(cars)
  for(const car of cars.slice(0,3))for(const direction of ['depart','return']) {
    const route=thamakaTrafficPath(car.parking,direction,car.chargingBay)
    for(let t=0;t<route.duration;t+=.08) {
      const p=trafficPose(route,t)
      if(p.x<31)continue
      for(const w of [-1.025,1.025])for(const l of [-1.825,1.825]) {
        const x=p.x+w*Math.cos(p.yaw)+l*Math.sin(p.yaw),z=p.z-w*Math.sin(p.yaw)+l*Math.cos(p.yaw)
        assert.ok(pointInRoad({x,z},surface),`${direction} footprint leaves the gate asphalt at ${x},${z}`)
      }
    }
  }
})
test('junction paint stays clear and the front loop does not cover building footprints',()=>{
  const net=thamakaRoadNetwork(),marks=thamakaRoadMarkings(net)
  assert.ok(net.routes.some(r=>r.key==='front-drive'))
  for(const p of marks)for(const [x,z] of [[-16.5,-19.3],[-16.5,22],[33,24.7],[40,1],[52,11],[-44,31],[-44,47]])assert.ok(Math.hypot(p.x-x,p.z-z)>=4.5)
  for(const b of THAMAKA_BUILDINGS)for(let x=b.x-b.width/2+.1;x<b.x+b.width/2;x+=.5)for(let z=b.z-b.depth/2+.1;z<b.z+b.depth/2;z+=.5)assert.equal(pointInRoad({x,z},net.surface),false,`asphalt covers ${b.key}`)
  const campus=readFileSync(new URL('../app/dashboard/components/ThamakaCampus.js',import.meta.url),'utf8')
  assert.ok(campus.includes('ThamakaRoadEdge'))
  assert.ok(campus.includes('RoadBridge'))
  assert.ok(!campus.includes('roadDashes('),'must not inherit Kamphaeng Saen junction coordinates')
})
