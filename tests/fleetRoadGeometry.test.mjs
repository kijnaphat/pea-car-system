import test from 'node:test'
import assert from 'node:assert/strict'
import { SITE, SITE_CUSTOMER, SITE_HEDGE, SITE_BICYCLES, siteLayout, siteParkingPosition } from '../lib/fleetSiteLayout.js'
import { roadNetwork, roadDashes, pointInRoad, roundedPolyline } from '../lib/fleetRoadGeometry.js'

test('all roads, both T junctions and EV forecourt form one seam-free surface',()=>{
  for(const aisles of [[],[21.3],[21.3,30.9,40.5]]) {
    const network=roadNetwork(aisles,2)
    assert.equal(network.surface.length,1)
    assert.equal(network.pavement.length,1)
    for(const point of [{...SITE.entrance},{x:SITE.roadStart,z:0},{...SITE.exit},{x:SITE.exit.x,z:0},{x:-8,z:5.8}]) assert.ok(pointInRoad(point,network.surface))
    for(const polygon of network.surface) for(const ring of polygon) {
      assert.deepEqual(ring[0],ring.at(-1))
      assert.ok(ring.flat().every(Number.isFinite))
    }
    for(const route of network.routes) for(const dash of roadDashes(route)) assert.ok(pointInRoad(dash,network.surface),'dash painted outside road')
  }
})

test('bicycle rack and the continuous hedge planter remain off roads and away from each other',()=>{
  const {surface}=roadNetwork()
  const length=Math.hypot(SITE_HEDGE.stepX,SITE_HEDGE.stepZ)*12+1.8
  const yaw=Math.atan2(SITE_HEDGE.stepX,SITE_HEDGE.stepZ),c=Math.cos(yaw),s=Math.sin(yaw)
  const center={x:SITE_HEDGE.x+6*SITE_HEDGE.stepX,z:SITE_HEDGE.z+6*SITE_HEDGE.stepZ}
  for(let dx=-.925;dx<=.925;dx+=.15) for(let dz=-length/2;dz<=length/2;dz+=.15) {
    const p={x:center.x+dx*c+dz*s,z:center.z-dx*s+dz*c}
    assert.equal(pointInRoad(p,surface),false,'hedge base must not step into the road')
    assert.ok(Math.abs(p.x-SITE_BICYCLES.x)>SITE_BICYCLES.width/2+.1 || Math.abs(p.z-SITE_BICYCLES.z)>SITE_BICYCLES.depth/2+.1,'bicycle pad overlaps hedge')
  }
  for(let dx=-SITE_BICYCLES.width/2;dx<=SITE_BICYCLES.width/2;dx+=.1) for(let dz=-1;dz<=1;dz+=.1)
    assert.equal(pointInRoad({x:SITE_BICYCLES.x+dx,z:SITE_BICYCLES.z+dz},surface),false)
})

test('a long appended row extends roads and moves the exit without breaking the joined surface',()=>{
  const cars=Array.from({length:90},(_,n)=>({slotNo:n+1,parking:siteParkingPosition(n+1)})),site=siteLayout(cars)
  const network=roadNetwork([],1,site)
  assert.equal(network.surface.length,1)
  assert.ok(site.exit.x>cars.at(-1).parking.x+4)
  assert.ok(pointInRoad({x:site.exit.x,z:0},network.surface))
  assert.deepEqual(network.routes[0].points.at(-1),{x:site.roadEnd,z:0})
  for(const route of network.routes) for(const dash of roadDashes(route,site)) assert.ok(pointInRoad(dash,network.surface))
})

test('customer carport including paved base stays clear of the whole curved road',()=>{
  const {surface}=roadNetwork()
  for(let x=SITE_CUSTOMER.x-(SITE_CUSTOMER.width+.5)/2;x<=SITE_CUSTOMER.x+(SITE_CUSTOMER.width+.5)/2;x+=.15)
    for(let z=SITE_CUSTOMER.z-(SITE_CUSTOMER.depth+.5)/2;z<=SITE_CUSTOMER.z+(SITE_CUSTOMER.depth+.5)/2;z+=.15)
      assert.equal(pointInRoad({x,z},surface),false,'customer roof/pad overlaps curved road')
})

test('approach bend and its dashed centre line have a sampled continuous curve',()=>{
  const {routes}=roadNetwork(),spine=routes.find(r=>r.key==='spine')
  assert.ok(spine.points.length>20)
  assert.ok(spine.points.some(p=>p.x>-27 && p.x<-15 && p.z>-5 && p.z<0))
  assert.deepEqual(spine.points.at(-1),{x:SITE.roadEnd,z:0})
  assert.deepEqual(roundedPolyline([{x:0,z:0},{x:10,z:0}]),[{x:0,z:0},{x:10,z:0}])
  for(const dash of routes.filter(r=>r.key!=='spine').flatMap(roadDashes))
    assert.ok(Math.hypot(dash.x-SITE.exit.x,dash.z-SITE.exit.z)>=4.5)
})
