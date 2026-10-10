import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { vehicleStyle } from '../lib/fleetVehicleStyle.js'
import { demoSnapshot } from '../lib/fleetDigitalTwin.js'

test('actual fleet types use distinct, explicit models, with crane precedence over truck', () => {
  const cases = [
    ['รถกระเช้าแก้ไฟ','bucket',6], ['รถเครน บรรทุก','crane',6],
    ['รถบรรทุก 7.5 ตัน ติดเครนแข็ง','crane',6], ['รถบรรทุกขุดเจาะ','drill',6],
    ['รถบรรทุก 6 ล้อ','heavy_truck',6], ['รถบรรทุก 6 ตัน ฮอทไลน์','heavy_truck',6],
    ['รถบรรทุก 3 ตันส่วนบุคคล','light_truck',4], ['รถบรรทุก 2 ตันเเก้ไฟ','light_truck',4],
    ['รถบรรทุก 1 ตันแก้ไฟ','light_truck',4], ['รถบรรทุกมีข้างเสริมหลังคา','covered_truck',4],
    ['รถกระบะ 4 ประตู','pickup',4], ['รถตู้โดยสาร 12 ที่นั่ง','van',4],
    ['รถ EV ทดเเทน','ev',4], ['TEST_CAR','motorcycle',2],
  ]
  cases.forEach(([car_type, kind, wheels])=>{
    const style=vehicleStyle({id:1,car_type})
    assert.equal(style.kind,kind,car_type);assert.equal(style.wheels,wheels,car_type)
    assert.match(style.color,/^#[0-9a-f]{6}$/)
  })
  assert.equal(vehicleStyle({fuel_type:'EV'}).kind,'ev')
  assert.equal(vehicleStyle({car_type:'ประเภทใหม่ที่ยังไม่รู้จัก'}).kind,'generic')
})
test('paint is stable for a car across status changes and selection; categories have different paint',()=>{
  const car={id:10,car_type:'รถกระบะ 4 ประตู',status:'available'}
  assert.deepEqual(vehicleStyle(car),vehicleStyle({...car,status:'busy',selected:true}))
  const types=['รถกระเช้า','รถเครน','รถบรรทุกขุดเจาะ','รถบรรทุก 6 ล้อ','รถบรรทุก 2 ตัน','รถตู้','รถ EV']
  assert.equal(new Set(types.map(car_type=>vehicleStyle({id:1,car_type}).color)).size,types.length)
})
test('demo includes every operational vehicle silhouette and remains isolated',()=>{
  const kinds=new Set(demoSnapshot().carsDataRaw.map(car=>vehicleStyle(car).kind))
  assert.equal(kinds.size,9)
  assert.ok(kinds.has('bucket') && kinds.has('crane') && kinds.has('heavy_truck'))
})
test('dashboard does not offer a direct checkout/car URL, but retains read-only report links',()=>{
  const source=readFileSync(new URL('../app/dashboard/components/FleetDigitalTwin.js',import.meta.url),'utf8')
  assert.ok(!source.includes('/?car_id='))
  assert.ok(!source.includes('เปิดรายการรถ'))
  assert.ok(source.includes('สแกน QR Code ที่รถเท่านั้น'))
  assert.ok(source.includes('/report?car_id='))
  assert.ok(source.includes('ขยายผังเต็มความกว้าง'))
})
