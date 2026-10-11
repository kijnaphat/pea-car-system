import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createFleetTraffic, trafficPath, trafficPose, trafficOverlaps, TRAFFIC_HEADWAY } from '../lib/fleetTraffic.js'
import { SITE, siteParkingPosition } from '../lib/fleetSiteLayout.js'
import { demoSnapshot, fleetVehicles } from '../lib/fleetDigitalTwin.js'

const fleet=()=>fleetVehicles(demoSnapshot())
const events=(cars,direction='depart',prefix='batch')=>cars.map(car=>({carId:car.id,direction,key:prefix+':'+car.id+':'+direction}))
function verifySeparation(traffic,cars) {
  let peak=0
  while(traffic.busy()) {
    traffic.advance(.04)
    const moving=cars.map(car=>traffic.pose(car.id)).filter(p=>p?.moving)
    peak=Math.max(peak,moving.length)
    for(let i=0;i<moving.length;i++) for(let j=i+1;j<moving.length;j++) assert.equal(trafficOverlaps(moving[i],moving[j]),false,'moving vehicle footprints overlap at '+traffic.now())
    assert.ok(traffic.now()<1000,'queue must finish, not deadlock')
  }
  return peak
}

test('routes use separate entrance/exit lanes, rounded turns and distance-based speed',()=>{
  const car=fleet()[0]
  const out=trafficPath(car.parking,'depart'),back=trafficPath(car.parking,'return')
  assert.deepEqual(trafficPose(out,0),{x:car.parking.x,z:car.parking.z,yaw:0})
  assert.equal(trafficPose(out,out.duration).x,SITE.exit.x+9)
  assert.equal(trafficPose(out,out.duration).z,SITE.exit.z)
  assert.equal(trafficPose(back,0).x,SITE.entrance.x-2)
  assert.equal(trafficPose(back,0).z,SITE.entrance.z-2)
  assert.equal(trafficPose(back,back.duration).x,car.parking.x)
  assert.equal(trafficPose(back,back.duration).z,car.parking.z)
  assert.ok(out.nodes.length>20)
  assert.ok(out.duration>8)
})

test('a simultaneous departure batch waits and follows without overlapping',()=>{
  const cars=fleet().slice(0,10).map(car=>({...car,status:'on_trip'}))
  const traffic=createFleetTraffic();traffic.setFleet(cars);traffic.enqueue(events(cars))
  const reservations=traffic.reservations()
  for(let i=1;i<reservations.length;i++) assert.ok(reservations[i].start-reservations[i-1].start>=TRAFFIC_HEADWAY-1e-8)
  assert.equal(traffic.pose(cars[1].id).waiting,true)
  assert.equal(traffic.pose(cars[1].id).visible,true)
  assert.ok(verifySeparation(traffic,cars)>=2,'cars can follow simultaneously, not only one for the entire journey')
  assert.ok(cars.every(car=>traffic.pose(car.id).visible===false))
})

test('all 30 vehicles across the two reference rows can exit together without merge collisions',()=>{
  const cars=Array.from({length:30},(_,n)=>({id:'queue-'+n,slotNo:n+1,parking:siteParkingPosition(n+1),status:'on_trip'}))
  const traffic=createFleetTraffic();traffic.setFleet(cars);traffic.enqueue(events(cars))
  verifySeparation(traffic,cars)
})

test('mixed returns and departures reserve crossings, and each car keeps event order',()=>{
  const cars=fleet().slice(0,8)
  const traffic=createFleetTraffic();traffic.setFleet(cars)
  const moves=cars.map((car,i)=>({carId:car.id,direction:i%2?'return':'depart',key:'mixed-'+i}))
  traffic.enqueue(moves)
  traffic.enqueue([{carId:cars[0].id,direction:'return',key:'same-car-back'}])
  const tasks=traffic.reservations().filter(task=>task.carId===cars[0].id)
  assert.ok(tasks[1].start>tasks[0].end)
  assert.equal(traffic.pose(cars[1].id).visible,false,'waiting return stays outside compound')
  verifySeparation(traffic,cars)
  assert.ok(cars.every(car=>traffic.pose(car.id).visible))
})

test('future permanent slots depart towards the same main road, without crossing parked bays',()=>{
  const cars=[19,20,30,31,32,42,43].map(slotNo=>({id:'extra-'+slotNo,parking:siteParkingPosition(slotNo),status:'on_trip'}))
  const path=trafficPath(siteParkingPosition(31),'depart')
  assert.ok(path.nodes.slice(0,12).every(node=>node.z<=siteParkingPosition(31).z))
  const traffic=createFleetTraffic();traffic.setFleet(cars);traffic.enqueue(events(cars))
  verifySeparation(traffic,cars)
})

test('all reference spaces stay separated from waiting and already parked vehicles too',()=>{
  for(const mode of ['depart','return','mixed']) {
    const cars=Array.from({length:30},(_,n)=>({id:n,parking:siteParkingPosition(n+1),
      status:mode==='depart'||mode==='mixed'&&n%2===0?'on_trip':'available'}))
    const traffic=createFleetTraffic();traffic.setFleet(cars)
    traffic.enqueue(cars.map((car,n)=>({carId:car.id,direction:mode==='mixed'?(n%2?'return':'depart'):mode,key:mode+n})))
    while(traffic.busy()) {
      traffic.advance(.04)
      const visible=cars.map(car=>traffic.pose(car.id)).filter(p=>p.visible)
      for(let i=0;i<visible.length;i++) for(let j=i+1;j<visible.length;j++) assert.equal(trafficOverlaps(visible[i],visible[j]),false,mode+' overlaps waiting/parked car at '+traffic.now())
      assert.ok(traffic.now()<1000)
    }
  }
})

test('repeated snapshots do not replay events; reduced motion clears the visual queue',()=>{
  const cars=fleet().slice(0,3)
  const traffic=createFleetTraffic();traffic.setFleet(cars)
  const moves=events(cars)
  traffic.enqueue(moves);traffic.enqueue(moves)
  assert.equal(traffic.reservations().length,3)
  traffic.clear(moves);traffic.enqueue(moves)
  assert.equal(traffic.busy(),false)
  assert.ok(cars.every(car=>traffic.pose(car.id).visible))
  assert.equal(cars[0].status,'available','visual scheduling must not mutate business records')
})

test('an extended lower row has clear turning space around stationary cars during departures and returns',()=>{
  for(const direction of ['depart','return']) {
    const cars=Array.from({length:66},(_,n)=>({id:'expand-'+n,slotNo:n+1,parking:siteParkingPosition(n+1),status:'available'}))
    const moving=cars.filter(car=>[31,32,42,43,54,55,66].includes(car.slotNo))
    if(direction==='depart') for(const car of moving) car.status='on_trip'
    const traffic=createFleetTraffic();traffic.setFleet(cars);traffic.enqueue(events(moving,direction,'expanded'))
    while(traffic.busy()) {
      traffic.advance(.04)
      const visible=cars.map(car=>traffic.pose(car.id)).filter(p=>p.visible)
      for(let i=0;i<visible.length;i++) for(let j=i+1;j<visible.length;j++) {
        if(visible[i].moving || visible[j].moving) assert.equal(trafficOverlaps(visible[i],visible[j]),false,direction+' hits parked extra-row car at '+traffic.now())
      }
      assert.ok(traffic.now()<1000)
    }
  }
})

test('a parking reflow cancels stale visual paths, but never replays or writes a trip',()=>{
  const cars=fleet().slice(18),traffic=createFleetTraffic(),moves=events(cars)
  traffic.setFleet(cars);traffic.enqueue(moves);traffic.advance(.1)
  const changed=cars.slice(1).map(car=>({...car,parking:{...car.parking,x:car.parking.x-2.75}}))
  const records=JSON.stringify(changed)
  traffic.setFleet(changed);traffic.enqueue(moves)
  assert.equal(traffic.busy(),false)
  assert.equal(JSON.stringify(changed),records)
})

test('invalid/deleted vehicles are ignored and incremental batches preserve existing reservations',()=>{
  const cars=fleet().slice(0,4)
  const traffic=createFleetTraffic();traffic.setFleet(cars)
  traffic.enqueue(events(cars.slice(0,2)))
  const first=traffic.reservations()[0]
  traffic.advance(.1);traffic.enqueue(events(cars.slice(2)))
  assert.deepEqual(traffic.reservations()[0],first)
  traffic.enqueue([{carId:'missing',direction:'depart',key:'missing'}])
  assert.equal(traffic.reservations().length,4)
  traffic.setFleet(cars.slice(1))
  assert.equal(traffic.reservations().some(task=>task.carId===cars[0].id),false)
})

test('dashboard removes zone callouts but retains slots, details and the animation-only queue indicator',()=>{
  const source=readFileSync(new URL('../app/dashboard/components/FleetDigitalTwin.js',import.meta.url),'utf8')
  assert.doesNotMatch(source,/const zones|twin-zone-label|ลานจอดโซน/)
  assert.ok(source.includes('twin-slot-label'))
  assert.ok(source.includes('twin-traffic-hint'))
  assert.ok(source.includes('สแกน QR Code ที่รถเท่านั้น'))
})
