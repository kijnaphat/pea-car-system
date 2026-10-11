import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createFleetTraffic, trafficPath, trafficPose, trafficOverlaps, TRAFFIC_HEADWAY } from '../lib/fleetTraffic.js'
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
  const out=trafficPath(car.parking,20,'depart'),back=trafficPath(car.parking,20,'return')
  assert.deepEqual(trafficPose(out,0),{x:car.parking.x,z:car.parking.z,yaw:0})
  assert.equal(trafficPose(out,out.duration).x,3.05)
  assert.equal(trafficPose(back,0).x,.95)
  assert.equal(trafficPose(back,back.duration).x,car.parking.x)
  assert.equal(trafficPose(back,back.duration).z,car.parking.z)
  assert.ok(out.nodes.length>20)
  assert.ok(out.duration>8)
})

test('a simultaneous departure batch waits and follows without overlapping',()=>{
  const cars=fleet().slice(0,10).map(car=>({...car,status:'on_trip'}))
  const traffic=createFleetTraffic();traffic.setFleet(cars);traffic.enqueue(events(cars),20)
  const reservations=traffic.reservations()
  for(let i=1;i<reservations.length;i++) assert.ok(reservations[i].start-reservations[i-1].start>=TRAFFIC_HEADWAY-1e-8)
  assert.equal(traffic.pose(cars[1].id).waiting,true)
  assert.equal(traffic.pose(cars[1].id).visible,true)
  assert.ok(verifySeparation(traffic,cars)>=2,'cars can follow simultaneously, not only one for the entire journey')
  assert.ok(cars.every(car=>traffic.pose(car.id).visible===false))
})

test('all 25 vehicles across rows can exit together without merge collisions',()=>{
  const cars=fleet().map(car=>({...car,status:'on_trip'}))
  const traffic=createFleetTraffic();traffic.setFleet(cars);traffic.enqueue(events(cars),20)
  verifySeparation(traffic,cars)
})

test('mixed returns and departures reserve crossings, and each car keeps event order',()=>{
  const cars=fleet().slice(0,8)
  const traffic=createFleetTraffic();traffic.setFleet(cars)
  const moves=cars.map((car,i)=>({carId:car.id,direction:i%2?'return':'depart',key:'mixed-'+i}))
  traffic.enqueue(moves,20)
  traffic.enqueue([{carId:cars[0].id,direction:'return',key:'same-car-back'}],20)
  const tasks=traffic.reservations().filter(task=>task.carId===cars[0].id)
  assert.ok(tasks[1].start>tasks[0].end)
  assert.equal(traffic.pose(cars[1].id).visible,false,'waiting return stays outside compound')
  verifySeparation(traffic,cars)
  assert.ok(cars.every(car=>traffic.pose(car.id).visible))
})

test('repeated snapshots do not replay events; reduced motion clears the visual queue',()=>{
  const cars=fleet().slice(0,3)
  const traffic=createFleetTraffic();traffic.setFleet(cars)
  const moves=events(cars)
  traffic.enqueue(moves,20);traffic.enqueue(moves,20)
  assert.equal(traffic.reservations().length,3)
  traffic.clear(moves);traffic.enqueue(moves,20)
  assert.equal(traffic.busy(),false)
  assert.ok(cars.every(car=>traffic.pose(car.id).visible))
  assert.equal(cars[0].status,'available','visual scheduling must not mutate business records')
})

test('invalid/deleted vehicles are ignored and incremental batches preserve existing reservations',()=>{
  const cars=fleet().slice(0,4)
  const traffic=createFleetTraffic();traffic.setFleet(cars)
  traffic.enqueue(events(cars.slice(0,2)),20)
  const first=traffic.reservations()[0]
  traffic.advance(.1);traffic.enqueue(events(cars.slice(2)),20)
  assert.deepEqual(traffic.reservations()[0],first)
  traffic.enqueue([{carId:'missing',direction:'depart',key:'missing'}],20)
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
