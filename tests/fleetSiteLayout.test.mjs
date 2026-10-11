import test from 'node:test'
import assert from 'node:assert/strict'
import { SITE, SITE_LABELS, siteParkingPosition, siteParkingSlots, siteBounds } from '../lib/fleetSiteLayout.js'
import { demoSnapshot, fleetVehicles } from '../lib/fleetDigitalTwin.js'

test('reference plan has 18 upper and 12 lower permanent spaces facing the main road',()=>{
  const slots=siteParkingSlots()
  assert.equal(slots.length,30)
  assert.equal(slots.filter(s=>s.parking.row==='upper').length,18)
  assert.equal(slots.filter(s=>s.parking.row==='lower').length,12)
  assert.equal(slots[18].parking.x,slots[6].parking.x)
  assert.equal(slots.at(-1).parking.x,slots[17].parking.x)
  assert.equal(new Set(slots.map(s=>s.parking.x+','+s.parking.z)).size,30)
  assert.equal(slots[18].parking.yaw,Math.PI)
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
  assert.ok(siteBounds([extra]).maxZ>=extra.parking.z+4)
})

test('entrance is left of slots, exit is right, with a dead end beyond the exit',()=>{
  assert.ok(SITE.entrance.x<siteParkingPosition(1).x)
  assert.ok(SITE.exit.x>siteParkingPosition(18).x)
  assert.ok(SITE.roadEnd>SITE.exit.x)
  for(const key of ['office','entry-building','one-storey','customer','carport','rear-building','entrance','exit','dead-end']) assert.ok(SITE_LABELS.some(l=>l.key===key))
})
