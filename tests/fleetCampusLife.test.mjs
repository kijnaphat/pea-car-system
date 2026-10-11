import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { WALKERS, STATIC_PEOPLE, walkingPose, startCampusLife } from '../lib/fleetCampusLife.js'
import { roadNetwork, pointInRoad } from '../lib/fleetRoadGeometry.js'
import { SITE_BUILDINGS, SITE_CUSTOMER, siteParkingSlots } from '../lib/fleetSiteLayout.js'
import { siteChargingBays } from '../lib/fleetCharging.js'

test('fictional walking routes stay off roads, buildings, permanent slots and charger bays',()=>{
  const road=roadNetwork([21.3,30.9,40.5],3).surface
  const slots=siteParkingSlots([{slotNo:66,parking:{x:32.75,z:35.7}}])
  const bays=siteChargingBays(Array.from({length:12},()=>({fuel_type:'EV'})))
  const inBox=(p,b)=>{
    const yaw=b.rotation||0,c=Math.cos(yaw),s=Math.sin(yaw),dx=p.x-b.x,dz=p.z-b.z
    return Math.abs(dx*c-dz*s)<b.width/2+.3 && Math.abs(dx*s+dz*c)<b.depth/2+.3
  }
  for(const person of WALKERS) for(let time=0;time<300;time+=.5) {
    const p=walkingPose(person,time)
    assert.ok(Object.values(p).every(Number.isFinite))
    assert.equal(pointInRoad(p,road),false,person.id+' is on the road')
    for(const b of [...Object.values(SITE_BUILDINGS),SITE_CUSTOMER]) assert.equal(inBox(p,b),false,person.id+' is inside a building')
    for(const slot of slots) assert.equal(Math.abs(p.x-slot.parking.x)<1.35+.3 && Math.abs(p.z-slot.parking.z)<1.9+.3,false,person.id+' walks through a parked car')
    for(const bay of bays) assert.equal(Math.abs(p.x-bay.x)<1.55+.3 && Math.abs(p.z-bay.z)<2.4+.3,false,person.id+' walks through a charge bay')
  }
  for(const person of STATIC_PEOPLE) assert.equal(pointInRoad(person,road),false,person.id+' stands in the road')
})
test('local animation ticks at 10fps at most, stops while hidden and cleans up on unmount',()=>{
  const listeners=new Map(),queue=new Map();let id=0,renders=0
  const page={visibilityState:'visible',addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)}
  const timers={setTimeout:(fn,delay)=>{assert.equal(delay,100);queue.set(++id,fn);return id},clearTimeout:key=>queue.delete(key)}
  const stop=startCampusLife(()=>renders++,{page,timers})
  assert.equal(renders,1)
  for(let n=0;n<10;n++) {const [key,tick]=queue.entries().next().value;queue.delete(key);tick()}
  assert.equal(renders,11)
  assert.equal(queue.size,1)
  page.visibilityState='hidden';listeners.get('visibilitychange')()
  assert.equal(queue.size,0)
  page.visibilityState='visible';listeners.get('visibilitychange')()
  assert.equal(renders,12)
  stop();assert.equal(queue.size,0);assert.equal(listeners.size,0)
})
test('ambient props/people use local geometry only, with reduced motion and no telemetry writes',()=>{
  for(const file of ['FleetCampusLife.js','FleetCampusProps.js']) {
    const source=readFileSync(new URL('../app/dashboard/components/'+file,import.meta.url),'utf8')
    assert.doesNotMatch(source,/fetch\(|supabase|useTexture|https:\/\//)
  }
  const life=readFileSync(new URL('../app/dashboard/components/FleetCampusLife.js',import.meta.url),'utf8')
  assert.ok(life.includes('if(reducedMotion) return'))
  assert.ok(life.includes('reducedMotion?0:pose.gait'))
  const props=readFileSync(new URL('../app/dashboard/components/FleetCampusProps.js',import.meta.url),'utf8')
  for(const name of ['Fountain','Pergola','CoffeeKiosk','BicycleRack','UtilityYard','RecyclingBins','Fence','FlowerBed']) assert.ok(props.includes('function '+name+'('))
})
