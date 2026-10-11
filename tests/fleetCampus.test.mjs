import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
  assert.ok(campus.includes('roadNetwork(overflowAisles,chargingRows)'))
  assert.ok(campus.includes('net.surface.flatMap'))
  assert.ok(campus.includes('function ChargingCanopy('))
  assert.ok(campus.includes('function Charger('))
  assert.ok(campus.includes('SITE.exit.x'))
  const scene = readFileSync(new URL('../app/dashboard/components/FleetScene.js', import.meta.url), 'utf8')
  assert.ok(scene.includes('<FleetCampus bounds={bounds} overflowAisles={overflowAisles} chargingBays={chargingBays} vehicles={vehicles}/>'))
  assert.ok(scene.includes('frameloop="demand"'))
  assert.ok(scene.includes('<TrafficLayer vehicles={vehicles}'))
  assert.ok(scene.includes('<Canvas orthographic '))
  assert.ok(scene.includes('enableRotate={false}'))
  assert.ok(scene.includes('camera.matrixWorldInverse'))
  assert.ok(scene.includes('<Canvas orthographic shadows'))
  assert.ok(scene.includes('[bounds.minZ,bounds.maxZ]'))
})

test('traffic queue update preserves the approved vehicle meshes', () => {
  const source = readFileSync(new URL('../app/dashboard/components/FleetScene.js', import.meta.url), 'utf8')
  const hash = (start,end) => createHash('sha256').update(source.slice(source.indexOf(start),source.indexOf(end))).digest('hex')
  // Approved vehicle implementation at 5621bf9, deliberately unchanged by this map redesign.
  assert.equal(hash('function Block(', 'const Vehicle ='), 'fa36d653bb4ebde2ec3563a8444b12a58b3a5cc889c98f0549b3e9cfe625b9e6')
})
