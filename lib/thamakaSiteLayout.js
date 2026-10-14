// Thamaka only: based on the annotated plan, not surveyed metres or live GPS.
import polygonClipping from 'polygon-clipping'
import { fleetVehicles as deriveFleet } from './fleetDigitalTwin.js'
import { isElectricCar } from './tripActivity.js'
import { roundedPolyline, ribbon, pointInRoad } from './fleetRoadGeometry.js'
import { buildTrafficPath, createFleetTraffic } from './fleetTraffic.js'
import { createCampusVisitors } from './fleetCampusVisitors.js'

export const THAMAKA_SITE = Object.freeze({
  id:'pea-thamaka', roadStart:-16.5, roadEnd:32, roadHalfWidth:3.7,
  incomingLane:-17.4, outgoingLane:-21.2,
  entrance:{x:48,z:7}, exit:{x:48,z:12},
  bounds:{minX:-52,maxX:61,minZ:-39,maxZ:52,maxY:7},
})
export const THAMAKA_ORBIT = Object.freeze({azimuth:.12,elevation:Math.PI*62/180,zoomFactor:1})
export const THAMAKA_BUILDINGS = Object.freeze([
  {key:'office',x:20,z:12,width:17,depth:18,floors:2,roof:'#deded7',atrium:true,solar:true},
  {key:'office-wing',x:19,z:-2,width:14,depth:9,floors:2,roof:'#c5c6be',solar:true},
  {key:'office-link',x:6.5,z:13,width:7,depth:15,floors:1,roof:'#dfdfd4'},
  {key:'warehouse',x:-29,z:-7,width:12,depth:23,floors:1,roof:'#d4d2c9',industrial:true},
  {key:'warehouse-rear',x:-29,z:-25,width:12,depth:8,floors:1,roof:'#b7b6ad',industrial:true},
  {key:'store',x:-30,z:18,width:11,depth:9,floors:1,roof:'#dbdbd2',industrial:true},
  {key:'east-service',x:34,z:-27,width:5,depth:6,floors:1,roof:'#d0d1c6'},
  {key:'east-store',x:40,z:-22,width:5,depth:6,floors:1,roof:'#cbd0c5'},
  {key:'gatehouse',x:42,z:14,width:3,depth:3,floors:1,roof:'#e1e0d6'},
])
export const THAMAKA_CANOPIES = Object.freeze({
  rear:{x:-4,z:-27,width:17,depth:5.2},
  charging:{x:-6,z:-5.5,width:16.5,depth:17.5},
  customer:{x:37,z:21,width:5.1,depth:10.5},
})
export const THAMAKA_WALKERS = Object.freeze([
  {id:'thamaka-office-front',color:'#4c8e85',speed:.6,phase:0,path:[[10,25],[26,25]]},
  {id:'thamaka-office-side',color:'#ad8f5c',speed:.5,phase:9,path:[[31.1,5],[31.1,21]]},
  {id:'thamaka-yard',color:'#6c83a0',speed:.55,phase:3,helmet:true,path:[[-13,19],[-5,19]]},
])
export function thamakaParkingPosition(slotNo,visibleIndex) {
  const n=visibleIndex ?? Math.max(0,Math.floor(Number(slotNo)||1)-1)
  if(n<15)return {x:-11+n*2.75,z:-25,yaw:0,row:'rear'}
  if(n<30)return {x:-20,z:-13+(n-15)*2.6,yaw:Math.PI/2,row:'yard'}
  const extra=n-30
  return {x:-11+(extra%15)*2.75,z:-37-Math.floor(extra/15)*10,yaw:0,row:'extension'}
}
export function arrangeThamakaParking(vehicles) {
  let n=0
  return vehicles.filter(car=>car.is_visible!==false).slice().sort((a,b)=>(a.slotNo||Infinity)-(b.slotNo||Infinity))
    .map(car=>({...car,parking:car.slotNo?thamakaParkingPosition(car.slotNo,n++):null}))
}
export function siteChargingBays(vehicles=[]) {
  const count=Math.max(4,Math.ceil(vehicles.filter(isElectricCar).length/4)*4)
  return Array.from({length:count},(_,n)=>({index:n,code:'EV'+String(n+1).padStart(2,'0'),
    x:-11.25+(n%4)*3.5,z:-8+Math.floor(n/4)*10,yaw:0}))
}
export function thamakaVehicles(snapshot) {
  const cars=arrangeThamakaParking(deriveFleet(snapshot)),bays=siteChargingBays(cars)
  const electric=cars.filter(car=>car.parking&&isElectricCar(car)),assign=new Map(electric.map((car,n)=>[String(car.id),bays[n]]))
  return cars.map(car=>({...car,chargingBay:assign.get(String(car.id))||null}))
}
export function thamakaLayout(vehicles=[]) {
  const minZ=Math.min(-31,...vehicles.filter(c=>c.parking&&c.is_visible!==false).map(c=>c.parking.z-5))
  const charging=siteChargingBays(vehicles),maxZ=Math.max(29,charging.at(-1).z+6)
  return {...THAMAKA_SITE,landMinZ:minZ,landMaxZ:maxZ,
    bounds:{...THAMAKA_SITE.bounds,minZ:minZ-8,maxZ:Math.max(52,maxZ+23)}}
}
export function thamakaOutline(vehicles=[]) {
  const s=thamakaLayout(vehicles)
  return [[-37,s.landMinZ],[40,s.landMinZ],[49,-10],[46,22],[30,s.landMaxZ],[-41,s.landMaxZ-1]]
}
export const THAMAKA_YARD = [[-22,-19],[3,-19],[3,23],[-23,24]]
export const thamakaSlots = vehicles=>vehicles.filter(c=>c.parking&&c.is_visible!==false)
  .map(car=>({slotNo:car.slotNo,slotCode:car.slotCode,parking:car.parking,car}))
export function thamakaLabels() {
  return [
    {key:'office',label:'อาคารสำนักงาน',detail:'การไฟฟ้าส่วนภูมิภาค สาขาท่ามะกา',x:20,z:14,y:5.5,primary:true},
    {key:'warehouse',label:'อาคารคลังพัสดุ',x:-29,z:-5,y:4},
    {key:'charging',label:'โรงจอดรถ / งานยานพาหนะ',detail:'จุดชาร์จ EV',x:-6,z:-5,y:4.8},
    {key:'rear',label:'โรงจอดรถด้านหลัง',x:-4,z:-27,y:3.5},
    {key:'yard',label:'ลานจอด / ลานวัสดุ',x:-8,z:20,y:.3},
    {key:'gatehouse',label:'ป้อมยาม',x:42,z:14,y:3.5},
    {key:'customer',label:'ที่จอดรถลูกค้า',x:37,z:23,y:4},
    {key:'entry',label:'ทางเข้า',x:46,z:5,y:1},
    {key:'exit',label:'ทางออก',x:48,z:14,y:1},
    {key:'road',label:'ถ. แม่น้ำแม่กลอง · 3209',x:-2,z:47,y:.2},
    {key:'canal',label:'คลองระบายน้ำ',x:-3,z:39,y:.2},
  ]
}
export function thamakaRoadNetwork(vehicles=[]) {
  const rows=Math.ceil(siteChargingBays(vehicles).length/4)
  const routes=[
    {key:'rear-drive',width:7.4,points:roundedPolyline([{x:-20,z:-19.3},{x:32,z:-19.3},{x:38,z:-12},{x:42,z:2},{x:49,z:10}],3)},
    {key:'yard-drive',width:4.8,points:[{x:-16.5,z:-19.3},{x:-16.5,z:24}]},
    {key:'visitor-drive',width:4.8,points:roundedPolyline([{x:40,z:0},{x:33,z:2},{x:33,z:25},{x:38,z:28}],2)},
    {key:'frontage',width:5.2,points:roundedPolyline([{x:-47,z:31},{x:32,z:31},{x:44,z:23},{x:51,z:13}],3)},
    {key:'west-street',width:5.5,points:roundedPolyline([{x:-44,z:-39},{x:-44,z:24},{x:-47,z:31}],2)},
    {key:'main-road',width:7,points:roundedPolyline([{x:-51,z:47},{x:30,z:47},{x:55,z:16},{x:58,z:-15}],3)},
  ]
  const extraRows=Math.max(0,Math.ceil((vehicles.filter(c=>c.parking&&c.is_visible!==false).length-30)/15))
  for(let row=0;row<extraRows;row++)routes.push({key:'extension-'+row,width:6,points:[{x:30,z:-19.3},{x:30,z:-31-row*10},{x:-14,z:-31-row*10}]})
  for(let row=0;row<rows;row++)routes.push({key:'charge-access-'+row,width:3.4,points:[{x:-16.5,z:-17.4},{x:-16.5,z:-12.2+row*10},{x:.5,z:-12.2+row*10}]})
  return {routes,surface:polygonClipping.union(...routes.map(r=>ribbon(r.points,r.width))),
    pavement:polygonClipping.union(...routes.map(r=>ribbon(r.points,r.width+.5)))}
}
export { pointInRoad }
const gateIn=[{x:54,z:5},{x:48,z:7},{x:40,z:1},{x:35,z:-14},{x:30,z:-17.4}]
const gateOut=[{x:32,z:-21.2},{x:38,z:-13},{x:41,z:3},{x:48,z:12},{x:55,z:18}]
function parkingApproach(parking,lane) {
  if(parking.row==='yard')return [{x:-16.5,z:lane},{x:-16.5,z:parking.z},{...parking}]
  if(parking.row==='extension')return [{x:30,z:lane},{x:30,z:parking.z+6},{x:parking.x,z:parking.z+6},{...parking}]
  if(parking.row==='visitor')return [{x:35,z:lane},{x:40,z:0},{x:33,z:2},{x:33,z:parking.z},{...parking}]
  return [{x:parking.x,z:lane},{...parking}]
}
export function thamakaTrafficPath(parking,direction,chargingBay) {
  const lane=direction==='depart'?-21.2:-17.4
  let points=direction==='depart'?[...parkingApproach(parking,lane).reverse(),...gateOut]:[...gateIn,...parkingApproach(parking,lane)]
  if(chargingBay&&['charge','uncharge'].includes(direction)) {
    const aisle=chargingBay.z-4.2,charging=[{x:chargingBay.x,z:-17.4},{x:chargingBay.x,z:aisle},{...chargingBay}]
    if(chargingBay.z>2)charging.splice(0,1,{x:-16.5,z:-17.4},{x:-16.5,z:aisle},{x:chargingBay.x,z:aisle})
    points=direction==='charge'?[...parkingApproach(parking,-17.4).reverse(),...charging]:[...charging.reverse(),...parkingApproach(parking,-17.4)]
  }
  return buildTrafficPath(points)
}
export const createThamakaTraffic=()=>createFleetTraffic({getLayout:thamakaLayout,pathBuilder:thamakaTrafficPath})
const visitors=[...Array.from({length:3},(_,n)=>({id:'campus-visitor-thamaka-'+n,ambient:true,color:['#b86273','#a28a61','#7b719b'][n],status:n?'on_trip':'available',parking:{x:37,z:17+n*3.5,yaw:-Math.PI/2,row:'visitor'}})),
  ...Array.from({length:2},(_,n)=>({id:'campus-visitor-bike-thamaka-'+n,ambient:true,kind:'motorcycle',color:['#8a647b','#589e96'][n],footprint:{width:.85,length:1.85},status:n?'on_trip':'available',parking:{x:37+n*1.8,z:27,yaw:0,row:'visitor'}}))]
export const createThamakaVisitors=()=>createCampusVisitors(visitors)
