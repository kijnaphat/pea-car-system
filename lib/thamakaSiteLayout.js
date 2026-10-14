// PEA Thamaka only. Illustrative proportions traced from the supplied satellite
// screenshot, NOT GPS, surveyed dimensions, confirmed floor counts or traffic data.
import polygonClipping from 'polygon-clipping'
import { fleetVehicles as deriveFleet } from './fleetDigitalTwin.js'
import { assignChargingBays, siteChargingBays } from './fleetCharging.js'
import { roundedPolyline, ribbon, pointInRoad } from './fleetRoadGeometry.js'
import { buildTrafficPath, createFleetTraffic } from './fleetTraffic.js'

export const THAMAKA_SITE = {
  id:'pea-thamaka', roadStart:-24, roadEnd:27, roadHalfWidth:4.4,
  incomingLane:-2.1, outgoingLane:2.1,
  entrance:{x:-24,z:33}, exit:{x:22,z:33},
  bounds:{minX:-60,maxX:40.5,minZ:-39,maxZ:51,maxY:7},
}
export const THAMAKA_ORBIT = Object.freeze({azimuth:-.58,elevation:Math.PI*57/180,zoomFactor:1})
export const THAMAKA_BUILDINGS = Object.freeze([
  {key:'office',x:-38,z:14,width:14,depth:15,floors:2,roof:'#d6d6cb',atrium:true},
  {key:'office-wing',x:-47,z:8,width:6,depth:25,floors:1,roof:'#b8ab92'},
  {key:'service',x:-35,z:-18,width:21,depth:11,floors:1,roof:'#b9ad98'},
  {key:'store',x:-48,z:-15,width:5,depth:14,floors:1,roof:'#cec4b0'},
  {key:'gatehouse',x:-30.4,z:26.2,width:3,depth:3,floors:1,roof:'#b2a891'},
])
export const THAMAKA_CANOPIES = Object.freeze({
  customer:{x:-8.75,z:-9.5,width:14.8,depth:6.4},
  charging:{x:-8.75,z:9.5,width:14.8,depth:6.4},
})
export const THAMAKA_WALKERS = Object.freeze([
  {id:'thamaka-front-1',color:'#4c8e85',speed:.6,phase:0,path:[[-30.4,7],[-30.4,21]]},
  {id:'thamaka-front-2',color:'#ad8f5c',speed:.5,phase:9,path:[[-33,24],[-42,24]]},
  {id:'thamaka-rear',color:'#6c83a0',speed:.55,phase:3,helmet:true,path:[[-43,-8],[-26,-8]]},
])

export function thamakaParkingPosition(slotNo,visibleIndex) {
  const n=visibleIndex ?? Math.max(0,Math.floor(Number(slotNo)||1)-1)
  return {x:2+Math.floor(n/2)*2.75,z:n%2?-6.9:6.9,yaw:n%2?0:Math.PI,row:n%2?'upper':'lower'}
}
export function arrangeThamakaParking(vehicles) {
  let n=0
  return vehicles.filter(car=>car.is_visible!==false).slice().sort((a,b)=>(a.slotNo||Infinity)-(b.slotNo||Infinity))
    .map(car=>({...car,parking:car.slotNo?thamakaParkingPosition(car.slotNo,n++):null}))
}
export const thamakaVehicles = snapshot => assignChargingBays(arrangeThamakaParking(deriveFleet(snapshot)))
export function thamakaLayout(vehicles=[]) {
  const right=Math.max(16,...vehicles.filter(c=>c.parking&&c.is_visible!==false).map(c=>c.parking.x))
  const exitX=Math.max(22,right+6),roadEnd=exitX+5
  const charging=siteChargingBays(vehicles)
  return {...THAMAKA_SITE,exit:{...THAMAKA_SITE.exit,x:exitX},roadEnd,
    bounds:{...THAMAKA_SITE.bounds,maxX:roadEnd+13.5,maxZ:Math.max(51,charging.at(-1).z+18)}}
}
export function thamakaOutline(vehicles=[]) {
  const s=thamakaLayout(vehicles)
  return [[-54,-28],[-28,-34],[s.exit.x+5,-26],[s.exit.x+8,27],[-51,28]]
}
export const thamakaSlots = vehicles => vehicles.filter(c=>c.parking&&c.is_visible!==false)
  .map(car=>({slotNo:car.slotNo,slotCode:car.slotCode,parking:car.parking,car}))
export function thamakaLabels(vehicles=[]) {
  const site=thamakaLayout(vehicles)
  return [
    {key:'office',label:'สำนักงานท่ามะกา',detail:'ผังอิงภาพอ้างอิง',x:-38,z:14,y:5.4,primary:true},
    {key:'service',label:'กลุ่มอาคารด้านหลัง',x:-35,z:-18,y:4.4},
    {key:'customer',label:'โรงจอดรถลูกค้า',x:-8.75,z:-9.5,y:4.3},
    {key:'charging',label:'โรงจอด / ชาร์จ EV',x:-8.75,z:9.5,y:4.6},
    {key:'entry',label:'ทางเข้าจำลอง',x:site.entrance.x,z:25,y:1.2},
    {key:'exit',label:'ทางออกจำลอง',x:site.exit.x,z:25,y:1.2},
    {key:'road',label:'ถนน 3209 · ตำแหน่งอิงภาพ',x:14,z:33,y:.2},
    {key:'canal',label:'แนวคลองด้านหน้า',x:4,z:42,y:.2},
  ]
}
export function thamakaRoadNetwork(vehicles=[]) {
  const s=thamakaLayout(vehicles),rows=Math.ceil(siteChargingBays(vehicles).length/4)
  const routes=[
    {key:'yard',width:8.8,points:roundedPolyline([{...s.entrance},{x:s.roadStart,z:0},{x:s.roadEnd,z:0}],3)},
    {key:'exit',width:6.4,points:[{x:s.exit.x,z:0},{...s.exit}]},
    {key:'frontage',width:6.6,points:[{x:-59,z:33},{x:s.bounds.maxX,z:33}]},
    {key:'west-street',width:4.8,points:[{x:-56,z:50},{x:-56,z:-37}]},
  ]
  const polygons=routes.map(r=>ribbon(r.points,r.width)),paving=routes.map(r=>ribbon(r.points,r.width+.5))
  for(let row=0;row<rows;row++) {
    const z=9+row*10,aisle=z-4.2
    const route=[{x:-18.5,z:2.1},{x:-18.5,z:aisle},{x:-8.75,z:aisle}]
    polygons.push(ribbon(route,2.8),ribbon([{x:-8.75,z:4.2},{x:-8.75,z:z}],15.8))
    paving.push(ribbon(route,3.3),ribbon([{x:-8.75,z:4.2},{x:-8.75,z:z}],16.3))
  }
  return {routes,surface:polygonClipping.union(...polygons),pavement:polygonClipping.union(...paving)}
}
export { siteChargingBays, pointInRoad }
export function thamakaTrafficPath(parking,direction,chargingBay,site=thamakaLayout([{parking}])) {
  const lane=direction==='depart'?site.outgoingLane:site.incomingLane
  let points=direction==='depart'
    ? [{...parking},{x:parking.x,z:lane},{x:site.exit.x,z:lane},{...site.exit},{x:site.exit.x+9,z:site.exit.z}]
    : [{x:site.entrance.x-2,z:site.entrance.z-2},{x:site.roadStart,z:lane},{x:parking.x,z:lane},{...parking}]
  if(chargingBay&&['charge','uncharge'].includes(direction)) {
    const aisle=chargingBay.z-4.2,access={x:-18.5,z:aisle}
    points=direction==='charge'
      ? [{...parking},{x:parking.x,z:2.1},{x:-18.5,z:2.1},access,{x:chargingBay.x,z:aisle},{...chargingBay}]
      : [{...chargingBay},{x:chargingBay.x,z:aisle},access,{x:-18.5,z:-2.1},{x:parking.x,z:-2.1},{...parking}]
  }
  return buildTrafficPath(points)
}
export const createThamakaTraffic = () => createFleetTraffic({getLayout:thamakaLayout,pathBuilder:thamakaTrafficPath})
