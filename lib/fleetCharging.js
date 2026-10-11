// Display positions only: a charge record never returns/completes a driving trip.
import { isElectricCar } from './tripActivity.js'
import { SITE_CHARGING, siteBounds } from './fleetSiteLayout.js'
export const CHARGING_ACCESS_X = -.6
export const chargingAisle = bay => bay.z-4.2

export function siteChargingBays(vehicles = []) {
  const count=Math.max(4,Math.ceil(vehicles.filter(isElectricCar).length/4)*4)
  return Array.from({length:count},(_,n)=>({index:n,code:`EV${String(n+1).padStart(2,'0')}`,
    x:-14+(n%4)*3.5,z:9+Math.floor(n/4)*SITE_CHARGING.rowSpacing,yaw:0}))
}

export function assignChargingBays(vehicles) {
  const electric=vehicles.filter(car=>car.parking && isElectricCar(car))
    .slice().sort((a,b)=>a.slotNo-b.slotNo || String(a.id).localeCompare(String(b.id)))
  const bays=siteChargingBays(vehicles)
  const assigned=new Map(electric.map((car,n)=>[String(car.id),bays[n]]))
  return vehicles.map(car=>({...car,chargingBay:assigned.get(String(car.id)) || null}))
}

export const restingPose = car => car.status==='charging' && car.chargingBay ? car.chargingBay : car.parking
export function campusBounds(vehicles = []) {
  const bounds=siteBounds(vehicles),bays=siteChargingBays(vehicles)
  return {...bounds,maxZ:Math.max(bounds.maxZ,bays.at(-1).z+5)}
}
