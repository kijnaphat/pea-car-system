import test from 'node:test'
import assert from 'node:assert/strict'
import { demoSnapshot, fleetVehicles, movementEvents, replaySnapshot, dayBounds, parkingPosition } from '../lib/fleetDigitalTwin.js'
const initial = demoSnapshot()
test('counts and permanent slots come from records; hidden vehicles stay hidden', () => {
  const cars = fleetVehicles({...initial,carsDataRaw:[...initial.carsDataRaw,{id:'hidden',is_visible:false,status:'available'}]})
  assert.equal(cars.length,25)
  assert.equal(new Set(cars.map(car=>car.slotCode)).size,25)
  assert.deepEqual(parkingPosition(1),{zone:'A',x:-14,z:1})
  assert.equal(fleetVehicles({...initial,carsDataRaw:initial.carsDataRaw.slice(1)}).find(car=>car.id==='demo-2').slotCode,'P02')
})
test('initial load does not animate historical transactions; checkout and return are real pairs', () => {
  const before=fleetVehicles(initial)
  assert.deepEqual(movementEvents(null,before),[])
  const trip={id:100,car_id:'demo-1',activity_type:'usage',driver_name:'test',start_time:'2026-10-10T01:00:00Z'}
  const busy=fleetVehicles({...initial,carsDataRaw:initial.carsDataRaw.map(c=>c.id==='demo-1'?{...c,status:'busy'}:c),activeLogs:[trip]})
  assert.deepEqual(movementEvents(before,busy),[{carId:'demo-1',direction:'depart',key:'100:depart'}])
  assert.deepEqual(movementEvents(busy,busy),[])
  assert.deepEqual(movementEvents(busy,before),[{carId:'demo-1',direction:'return',key:'100:return'}])
  assert.equal(busy[0].slotCode,before[0].slotCode)
})
test('a completed short trip between refreshes animates once; nested charging is not a new checkout', () => {
  const before=fleetVehicles(initial)
  const completed={id:101,car_id:'demo-1',activity_type:'usage',is_completed:true}
  const after=fleetVehicles({...initial,latestLogs:[completed]})
  assert.equal(movementEvents(before,after).length,2)
  const nested=fleetVehicles({...initial,latestLogs:[{...completed,id:102,activity_type:'charge',parent_trip_log_id:101}]})
  assert.deepEqual(movementEvents(after,nested),[])
})
test('standalone EV charging has its own status; missing active row is unknown, not fabricated usage', () => {
  const charge={id:200,car_id:'demo-1',activity_type:'charge',battery_before:0}
  const data={...initial,carsDataRaw:initial.carsDataRaw.map(c=>c.id==='demo-1'?{...c,status:'busy'}:c),activeLogs:[charge]}
  const car=fleetVehicles(data)[0]
  assert.equal(car.status,'charging');assert.equal(car.battery,0)
  assert.equal(fleetVehicles({...data,activeLogs:[]})[0].status,'unknown')
})
test('replay uses Bangkok day boundaries, restores in-flight trips, and ignores child charge as another trip', () => {
  const {start,end}=dayBounds('2026-10-10')
  assert.equal(new Date(start).toISOString(),'2026-10-09T17:00:00.000Z')
  assert.equal(end-start,86400000)
  const logs=[{id:1,car_id:'demo-1',activity_type:'usage',start_time:new Date(start-3600000).toISOString(),end_time:new Date(start+7200000).toISOString()},
    {id:2,car_id:'demo-1',activity_type:'charge',parent_trip_log_id:1,start_time:new Date(start+1000).toISOString(),end_time:new Date(start+1000).toISOString(),battery_after:80}]
  const middle=fleetVehicles(replaySnapshot(initial,logs,start+2000))[0]
  assert.equal(middle.status,'on_trip');assert.equal(middle.trip.id,1)
  assert.equal(fleetVehicles(replaySnapshot(initial,logs,start+7200000))[0].status,'available')
  assert.equal(fleetVehicles(replaySnapshot(initial,logs,start+2000))[0].slotCode,'P01')
})
test('demo actions never share live record objects',()=>{
  const one=demoSnapshot();const two=demoSnapshot()
  one.carsDataRaw[0].status='busy'
  assert.equal(two.carsDataRaw[0].status,'available')
  assert.ok(one.carsDataRaw.every(car=>String(car.id).startsWith('demo-')))
})
