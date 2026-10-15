import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SITE_BUILDINGS } from '../lib/fleetSiteLayout.js'

test('decorative campus is offline geometry and does not add telemetry or database polling', () => {
  const campus = readFileSync(new URL('../app/dashboard/components/FleetCampus.js', import.meta.url), 'utf8')
  assert.doesNotMatch(campus, /fetch\(|supabase|useFrame|useTexture|https:\/\//)
  for (const landmark of ['Office', 'Carport', 'Building', 'Road', 'Gate', 'Tree', 'Planter', 'HipRoof', 'RoundCourt', 'SoftBlock']) assert.ok(campus.includes(`function ${landmark}(`))
  assert.ok(campus.includes('RoundedBox'))
  assert.equal(SITE_BUILDINGS.office.floors,4)
  assert.equal(Object.values(SITE_BUILDINGS).filter(b=>b.floors===2).length,2)
  assert.equal(SITE_BUILDINGS.lower.floors,1)
  for(const name of ['office','entry','lower','rear']) assert.ok(campus.includes('SITE_BUILDINGS.'+name))
  assert.ok(campus.includes('extrudeGeometry args={[outline'))
  assert.ok(campus.includes('roadNetwork(overflowAisles,chargingRows,site)'))
  assert.ok(campus.includes('net.surface.flatMap'))
  assert.ok(campus.includes('function ChargingCanopy('))
  assert.ok(campus.includes('function Charger('))
  assert.ok(campus.includes('site.exit.x'))
  const scene = readFileSync(new URL('../app/dashboard/components/FleetScene.js', import.meta.url), 'utf8')
  assert.ok(scene.includes('<FleetCampus bounds={bounds} overflowAisles={overflowAisles} chargingBays={chargingBays} vehicles={vehicles}/>'))
  assert.ok(scene.includes('frameloop="demand"'))
  assert.ok(scene.includes('<TrafficLayer vehicles={vehicles}'))
  assert.ok(scene.includes('<Canvas orthographic '))
  assert.ok(scene.includes('enableRotate={!top}'))
  assert.ok(scene.includes('<OrbitControls'))
  assert.ok(scene.includes('<FleetCampusLife reducedMotion={reducedMotion} bounds={bounds}/>'))
  assert.ok(scene.includes('<FleetCampusProps bounds={bounds} reducedMotion={reducedMotion}/>'))
  assert.ok(scene.includes('camera.matrixWorldInverse'))
  assert.ok(scene.includes('<Canvas orthographic shadows'))
  assert.ok(scene.includes('[minZ,maxZ]'))
})

test('detailed models remain display-only children of the original traffic wrappers', () => {
  const source = readFileSync(new URL('../app/dashboard/components/FleetScene.js', import.meta.url), 'utf8')
  // The user requested new vehicle geometry; lock behavior instead of an old mesh hash.
  assert.ok(source.includes('export const MiniCar = FleetVehicleModel'))
  assert.ok(source.includes('<MiniCar car={car}/>'))
  assert.ok(source.includes('const position=restingPose(car)'))
  assert.ok(source.includes('controller.current.setFleet(ambientTraffic?[...vehicles,...visitors.cars]:vehicles)'))
  assert.ok(source.includes('group.position.set(pose.x,0,pose.z);group.rotation.y=pose.yaw'))
  assert.ok(source.includes('shown.has(id)'))
  assert.ok(source.includes('if(reducedMotion) controller.current.clear(moves)'))
})
