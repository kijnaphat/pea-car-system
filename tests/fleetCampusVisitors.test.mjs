import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VISITOR_CARS, createCampusVisitors } from '../lib/fleetCampusVisitors.js'
import { CAMPUS_GARDENS, CAMPUS_TABLES } from '../lib/fleetCampusAmenities.js'
import { arrangeFleetParking, SITE_CUSTOMER, SITE_BUILDINGS, SITE_HEDGE } from '../lib/fleetSiteLayout.js'
import { createFleetTraffic, trafficOverlaps } from '../lib/fleetTraffic.js'
import { roadNetwork, pointInRoad } from '../lib/fleetRoadGeometry.js'
import { WALKERS, walkingPose } from '../lib/fleetCampusLife.js'

test('decorative visitors repeatedly enter/leave via shared reservations without changing fleet data',()=>{
  const fleet=arrangeFleetParking(Array.from({length:28},(_,n)=>({id:'real-'+n,slotNo:n+1,status:'available'})))
  const original=JSON.stringify(fleet),visitors=createCampusVisitors(),traffic=createFleetTraffic()
  traffic.setFleet([...fleet,...visitors.cars])
  let arrivals=0,departures=0,realMove=false
  const seen=new Set()
  for(let step=0;step<7000;step++) {
    traffic.advance(.1);visitors.tick(traffic,fleet)
    if(!realMove&&traffic.now()>32) {
      fleet[2].status='on_trip';traffic.setFleet([...fleet,...visitors.cars])
      traffic.enqueue([{carId:fleet[2].id,direction:'depart',key:'real-checkout'}]);realMove=true
    }
    for(const task of traffic.reservations()) if(!seen.has(task.key)) {
      seen.add(task.key)
      if(task.key.startsWith('visitor:')) task.direction==='return'?arrivals++:departures++
    }
    const poses=[...fleet,...visitors.cars].map(car=>traffic.pose(car.id)).filter(p=>p?.visible)
    for(let i=0;i<poses.length;i++) for(let j=i+1;j<poses.length;j++) if(poses[i].moving||poses[j].moving)
      assert.equal(trafficOverlaps(poses[i],poses[j]),false,'visitor overlaps another car at '+traffic.now())
  }
  assert.ok(arrivals>=8);assert.ok(departures>=8)
  fleet[2].status='available'
  assert.equal(JSON.stringify(fleet),original)
  assert.ok(visitors.cars.every(car=>car.ambient&&!car.slotNo))
  assert.deepEqual(VISITOR_CARS.map(car=>car.status),['available','available','on_trip','on_trip'])
  for(const car of visitors.cars) {
    assert.ok(Math.abs(car.parking.x-SITE_CUSTOMER.x)<SITE_CUSTOMER.width/2-1)
    assert.equal(car.parking.z,SITE_CUSTOMER.z)
  }
})

test('new gardens and shade tables stay behind current/future bays, outside roads, buildings and walking routes',()=>{
  const {surface}=roadNetwork(),fleet=arrangeFleetParking(Array.from({length:120},(_,n)=>({slotNo:n+1})))
  const boxes=[...CAMPUS_GARDENS,...CAMPUS_TABLES.map(t=>({...t,width:2.5,depth:2.5}))]
  for(const box of boxes) for(let x=-box.width/2;x<=box.width/2;x+=.1) for(let z=-box.depth/2;z<=box.depth/2;z+=.1) {
    const p={x:box.x+x,z:box.z+z}
    assert.equal(pointInRoad(p,surface),false,'amenity on road')
    for(const car of fleet) assert.ok(Math.abs(p.x-car.parking.x)>1.35||Math.abs(p.z-car.parking.z)>1.9,'amenity in a permanent bay')
    for(const b of Object.values(SITE_BUILDINGS).filter(b=>!b.rotation))
      assert.ok(Math.abs(p.x-b.x)>(b.width+1.3)/2||Math.abs(p.z-b.z)>(b.depth+1.3)/2,'amenity in building')
  }
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
    const a=boxes[i],b=boxes[j]
    assert.ok(Math.abs(a.x-b.x)>=(a.width+b.width)/2 || Math.abs(a.z-b.z)>=(a.depth+b.depth)/2,'garden and table overlap')
  }
  for(const walker of WALKERS) for(let t=0;t<300;t+=1) {
    const p=walkingPose(walker,t)
    for(const b of boxes) assert.ok(Math.abs(p.x-b.x)>b.width/2+.15||Math.abs(p.z-b.z)>b.depth/2+.15,walker.id+' walks through furniture')
    const yaw=Math.atan2(SITE_HEDGE.stepX,SITE_HEDGE.stepZ),dx=p.x-SITE_HEDGE.x-6*SITE_HEDGE.stepX,dz=p.z-SITE_HEDGE.z-6*SITE_HEDGE.stepZ
    assert.ok(Math.abs(dx*Math.cos(yaw)-dz*Math.sin(yaw))>SITE_HEDGE.width/2+.3||Math.abs(dx*Math.sin(yaw)+dz*Math.cos(yaw))>12*1.87/2+1.2,walker.id+' walks through hedge')
  }
})

test('no street slab, visitor telemetry, counts, interactions or independent polling',()=>{
  const campus=readFileSync(new URL('../app/dashboard/components/FleetCampus.js',import.meta.url),'utf8')
  assert.ok(!campus.includes('at={[-26,.025,-12.6]}'))
  const visitors=readFileSync(new URL('../lib/fleetCampusVisitors.js',import.meta.url),'utf8')
  assert.doesNotMatch(visitors,/fetch\(|supabase|setInterval|setTimeout|Date\.now/)
  const scene=readFileSync(new URL('../app/dashboard/components/FleetScene.js',import.meta.url),'utf8')
  assert.ok(scene.includes('document.visibilityState'))
  assert.ok(scene.includes('if(ambientTraffic&&!reducedMotion)'))
  const customerModel=scene.slice(scene.indexOf('function VisitorCar('),scene.indexOf('function TrafficLayer('))
  assert.doesNotMatch(customerModel,/onClick|onSelect/)
  const twin=readFileSync(new URL('../app/dashboard/components/FleetDigitalTwin.js',import.meta.url),'utf8')
  assert.ok(twin.includes("ambientTraffic={mode!=='replay'}"))
  assert.ok(twin.includes('รถลูกค้าเป็นภาพจำลอง ไม่รวมยอดรถหรือรายงาน'))
})
