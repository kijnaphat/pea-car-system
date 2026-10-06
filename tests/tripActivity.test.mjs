import test from 'node:test'
import assert from 'node:assert/strict'
import { isChargeTrip, tripActivity, monthlyReportData } from '../lib/tripActivity.js'
import { getTripIssues, isEVTrip, buildTripSequence } from '../lib/tripAnomalies.js'
const ev = {fuel_type:'EV'}
const oil = {fuel_type:'ดีเซล'}
test('historical EV charge and oil usage remain compatible',()=>{
  assert.equal(tripActivity({cars:ev}), 'charge')
  assert.equal(tripActivity({cars:oil}), 'usage')
  assert.equal(isChargeTrip(null,ev),false)
})
test('explicit EV usage overrides car type and does not require battery',()=>{
  const trip={activity_type:'usage',cars:ev,start_mileage:100,end_mileage:120,is_completed:true}
  assert.equal(isEVTrip(trip),false)
  assert.deepEqual(getTripIssues(trip),[])
  assert.ok(getTripIssues({...trip,end_mileage:90}).some(x=>x.code==='mileage_end_before_start'))
})
test('EV charge retains unchanged mileage and battery validation including zero',()=>{
  const trip={activity_type:'charge',cars:ev,start_mileage:100,end_mileage:100,battery_before:0,battery_after:80,is_completed:true}
  assert.deepEqual(getTripIssues(trip),[])
  assert.ok(getTripIssues({...trip,end_mileage:120}).some(x=>x.code==='ev_mileage_changed'))
  assert.ok(getTripIssues({...trip,battery_after:0}).some(x=>x.code==='ev_battery_not_increased'))
})
test('printed EV report contains only charge rows but month mileage uses both activities',()=>{
  const logs=[
    {id:1,activity_type:'usage',start_mileage:100,end_mileage:120},
    {id:2,activity_type:'charge',start_mileage:120,end_mileage:120},
    {id:3,activity_type:'usage',start_mileage:120,end_mileage:180},
  ]
  const report=monthlyReportData(logs,ev)
  assert.deepEqual(report.rows.map(x=>x.id),[2])
  assert.equal(report.startMileage,100)
  assert.equal(report.endMileage,180)
  assert.equal(monthlyReportData(logs,oil).rows.length,3)
  assert.equal(monthlyReportData([],ev).rows.length,0)
})
test('old EV charging rows still print and the activity sequence stays coherent',()=>{
  const logs=[
    {id:1,car_id:1,cars:ev,start_time:'2026-10-06T01:00:00Z',start_mileage:100,end_mileage:100,battery_before:10,battery_after:90,is_completed:true},
    {id:2,car_id:1,cars:ev,activity_type:'usage',start_time:'2026-10-06T02:00:00Z',start_mileage:100,end_mileage:140,is_completed:true},
  ]
  assert.deepEqual(monthlyReportData(logs,ev).rows.map(x=>x.id),[1])
  assert.deepEqual(getTripIssues(buildTripSequence(logs).find(x=>x.id===2)),[])
})
