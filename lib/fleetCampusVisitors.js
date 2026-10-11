import { SITE_CUSTOMER } from './fleetSiteLayout.js'

// Fictional customer cars only. Never passed to fleet counts, reports or APIs.
export const VISITOR_CARS = [-14,-10.5,-7,-3.5].map((x,n)=>({
  id:`campus-visitor-${n}`,ambient:true,color:['#e9e7de','#497b95','#bc8466','#8b779d'][n],
  status:n<2?'available':'on_trip',parking:{x,z:SITE_CUSTOMER.z,yaw:0},
}))

export function createCampusVisitors() {
  const cars=VISITOR_CARS.map(car=>({...car,parking:{...car.parking}}))
  const due=[65,90,5,28]
  let sequence=0
  return {
    cars,
    tick(traffic,fleet) {
      const now=traffic.now()
      // Real checkout/return/charge events have priority over new decorative moves.
      if(traffic.reservations().some(task=>!task.carId.startsWith('campus-visitor-')&&task.end>now)) return
      const index=due.findIndex(time=>time<=now)
      if(index<0) return
      const car=cars[index],direction=car.status==='on_trip'?'return':'depart'
      car.status=direction==='return'?'available':'on_trip'
      traffic.setFleet([...fleet,...cars])
      const key=`visitor:${++sequence}:${car.id}:${direction}`
      traffic.enqueue([{carId:car.id,direction,key}])
      const task=traffic.reservations().find(task=>task.key===key)
      due[index]=(task?.end ?? now)+(direction==='return'?55:24)+index*5
    },
  }
}
