import test from 'node:test'
import assert from 'node:assert/strict'
import { SITE, SITE_CUSTOMER } from '../lib/fleetSiteLayout.js'
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
