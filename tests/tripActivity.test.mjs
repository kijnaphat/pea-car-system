import test from 'node:test'
import assert from 'node:assert/strict'
import { isChargeTrip, tripActivity, monthlyReportData, reportTypeForCar, reportSignatureTable } from '../lib/tripActivity.js'
import { getTripIssues, isEVTrip, buildTripSequence } from '../lib/tripAnomalies.js'
const ev = {fuel_type:'EV'}
const oil = {fuel_type:'ดีเซล'}
test('charging inside a trip does not split driving sequence or double-count report distance', () => {
  const logs = [
    {id:1,car_id:24,activity_type:'usage',start_time:'2026-10-07T01:00:00Z',end_time:'2026-10-07T05:00:00Z',start_mileage:100,end_mileage:150,is_completed:true},
    {id:2,car_id:24,parent_trip_log_id:1,activity_type:'charge',start_time:'2026-10-07T03:00:00Z',end_time:'2026-10-07T03:00:00Z',start_mileage:120,end_mileage:120,battery_before:10,battery_after:90,is_completed:true},
    {id:3,car_id:24,activity_type:'usage',start_time:'2026-10-07T06:00:00Z',end_time:'2026-10-07T07:00:00Z',start_mileage:150,end_mileage:160,is_completed:true},
  ]
  const beforeNextTrip = monthlyReportData(logs.slice(0,2),ev,'charge')
  assert.equal(beforeNextTrip.rows.length,1)
  assert.equal(beforeNextTrip.endMileage,150)
  const sequence = buildTripSequence(logs)
  const next = sequence.find(log => log.id===3)
  assert.equal(next.previousTrip.id,1)
  assert.deepEqual(getTripIssues(next),[])
  const usage = monthlyReportData(logs,ev,'usage')
  assert.equal(usage.rows.length,2)
  assert.equal(usage.rows.reduce((sum,log)=>sum+log.end_mileage-log.start_mileage,0),60)
})
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

test('EV usage and charge reports partition the month without mixing legacy charge rows',()=>{
  const logs=[
    {id:1,start_mileage:100,end_mileage:100,battery_before:10,battery_after:80},
    {id:2,activity_type:'usage',start_mileage:100,end_mileage:140,fuel_liters:0,fuel_cost:0},
    {id:3,activity_type:'charge',start_mileage:140,end_mileage:140},
    {id:4,activity_type:'usage',start_mileage:140,end_mileage:200,fuel_liters:0,fuel_cost:0},
  ]
  const usage=monthlyReportData(logs,ev,'usage'), charge=monthlyReportData(logs,ev,'charge')
  assert.deepEqual(usage.rows.map(x=>x.id),[2,4])
  assert.deepEqual(charge.rows.map(x=>x.id),[1,3])
  assert.equal(usage.rows.reduce((sum,x)=>sum+x.end_mileage-x.start_mileage,0),100)
  assert.equal(usage.rows.reduce((sum,x)=>sum+x.fuel_liters,0),0)
  assert.equal(charge.endMileage,200)
  assert.equal(monthlyReportData([],ev,'usage').type,'usage')
})
test('report routing preserves oil reports and isolates EV driving signatures',()=>{
  assert.equal(reportTypeForCar(ev,null),'charge')
  assert.equal(reportTypeForCar(ev,'bad'),'charge')
  assert.equal(reportTypeForCar(oil,'charge'),'usage')
  assert.equal(reportSignatureTable(ev,'usage'),'ev_usage_report_signatures')
  assert.equal(reportSignatureTable(ev,'charge'),'report_signatures')
  assert.equal(reportSignatureTable(ev,null),'report_signatures')
  assert.equal(reportSignatureTable(oil,'usage'),'report_signatures')
})
