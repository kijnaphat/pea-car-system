import test from 'node:test'
import assert from 'node:assert/strict'
import { fleetVehicles, demoSnapshot, movementEvents } from '../lib/fleetDigitalTwin.js'
import { assignChargingBays, siteChargingBays, restingPose, campusBounds } from '../lib/fleetCharging.js'
import { siteParkingPosition } from '../lib/fleetSiteLayout.js'
import { createFleetTraffic, trafficOverlaps, trafficPath, trafficPose } from '../lib/fleetTraffic.js'

const initial=demoSnapshot()
const chargeData=(id=500)=>({...initial,carsDataRaw:initial.carsDataRaw.map(c=>c.id==='demo-1'?{...c,status:'busy'}:c),activeLogs:[{id,car_id:'demo-1',activity_type:'charge',battery_before:30}]})

test('charging lives under the canopy, keeps the permanent slot and does not replay on load',()=>{
  const before=fleetVehicles(initial),after=fleetVehicles(chargeData()),car=after[0]
  assert.deepEqual(car.parking,before[0].parking)
  assert.equal(car.slotCode,'P01')
  assert.equal(restingPose(car).code,'EV01')
  assert.deepEqual(movementEvents(null,after),[])
  assert.deepEqual(movementEvents(before,after),[{carId:'demo-1',direction:'charge',key:'500:charge'}])
  assert.deepEqual(movementEvents(after,before),[{carId:'demo-1',direction:'uncharge',key:'500:uncharge'}])
  assert.deepEqual(movementEvents(after,after),[])
  const path=trafficPath(car.parking,'charge',car.chargingBay)
  assert.equal(trafficPose(path,path.duration).x,car.chargingBay.x)
  assert.equal(trafficPose(path,path.duration).z,car.chargingBay.z)
})

test('charge bays do not shuffle when another EV starts/finishes; future EVs add unique bays',()=>{
  const before=fleetVehicles(initial),after=fleetVehicles(chargeData())
  assert.deepEqual(before.map(c=>c.chargingBay),after.map(c=>c.chargingBay))
  const cars=assignChargingBays(Array.from({length:12},(_,n)=>({id:n,slotNo:n+1,parking:siteParkingPosition(n+1),fuel_type:'EV',status:'charging'})))
  assert.equal(siteChargingBays(cars).length,12)
  assert.equal(new Set(cars.map(c=>c.chargingBay.x+','+c.chargingBay.z)).size,12)
  assert.ok(campusBounds(cars).maxZ>cars.at(-1).chargingBay.z+3)
})

function assertTrafficClear(cars,moves) {
  const traffic=createFleetTraffic();traffic.setFleet(cars);traffic.enqueue(moves)
  while(traffic.busy()) {
    traffic.advance(.04)
    const poses=cars.map(c=>traffic.pose(c.id)).filter(p=>p.visible)
    for(let i=0;i<poses.length;i++) for(let j=i+1;j<poses.length;j++) {
      if(poses[i].moving||poses[j].moving) assert.equal(trafficOverlaps(poses[i],poses[j]),false,'charging route hits moving/waiting/parked car at '+traffic.now())
    }
    assert.ok(traffic.now()<1000)
  }
  return traffic
}

test('multiple EVs drive to separate bays and back without hitting the permanent parked rows',()=>{
  const cars=fleetVehicles(initial),ev=cars.filter(c=>c.chargingBay)
  ev.forEach(c=>{c.status='charging'})
  let traffic=assertTrafficClear(cars,ev.map(c=>({carId:c.id,direction:'charge',key:'charge-'+c.id})))
  for(const c of ev) {assert.equal(traffic.pose(c.id).x,c.chargingBay.x);assert.equal(traffic.pose(c.id).z,c.chargingBay.z)}
  ev.forEach(c=>{c.status='available'})
  traffic=assertTrafficClear(cars,ev.map(c=>({carId:c.id,direction:'uncharge',key:'uncharge-'+c.id})))
  for(const c of ev) assert.equal(traffic.pose(c.id).z,c.parking.z)
})

test('second canopy row and permanent overflow slots use clear side/rear access',()=>{
  const cars=assignChargingBays(Array.from({length:54},(_,n)=>({id:n,slotNo:n+1,parking:siteParkingPosition(n+1),fuel_type:[1,10,19,23,31,43,54].includes(n+1)?'EV':'diesel',status:'available'})))
  const electric=cars.filter(c=>c.chargingBay);electric.forEach(c=>{c.status='charging'})
  assertTrafficClear(cars,electric.map(c=>({carId:c.id,direction:'charge',key:'multi-'+c.id})))
  electric.forEach(c=>{c.status='available'})
  assertTrafficClear(cars,electric.map(c=>({carId:c.id,direction:'uncharge',key:'back-'+c.id})))
})

test('charging inside an ongoing driving trip never ends or returns that mission',()=>{
  const trip={id:601,car_id:'demo-1',activity_type:'usage'}
  const data={...chargeData(),activeLogs:[trip]},before=fleetVehicles(data)
  const after=fleetVehicles({...data,latestLogs:[{id:602,car_id:'demo-1',activity_type:'charge',parent_trip_log_id:601,is_completed:true}]})
  assert.equal(after[0].status,'on_trip')
  assert.deepEqual(movementEvents(before,after),[])
})

test('fast completed charge and reduced motion only move models; no business records change',()=>{
  const before=fleetVehicles(initial),after=fleetVehicles({...initial,latestLogs:[{id:700,car_id:'demo-1',activity_type:'charge',is_completed:true}]})
  assert.deepEqual(movementEvents(before,after).map(e=>e.direction),['charge','uncharge'])
  const cars=fleetVehicles(chargeData()),original=JSON.stringify(cars),traffic=createFleetTraffic()
  traffic.setFleet(cars);traffic.clear(movementEvents(before,cars))
  assert.equal(traffic.pose('demo-1').z,cars[0].chargingBay.z)
  assert.equal(JSON.stringify(cars),original)
})
