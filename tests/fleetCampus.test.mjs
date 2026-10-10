import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

test('decorative campus is offline geometry and does not add telemetry or database polling', () => {
  const campus = readFileSync(new URL('../app/dashboard/components/FleetCampus.js', import.meta.url), 'utf8')
  assert.doesNotMatch(campus, /fetch\(|supabase|useFrame|useTexture|https:\/\//)
  for (const landmark of ['Office', 'SolarCanopy', 'Gate', 'Tree', 'Planter', 'HipRoof', 'RoundCourt', 'SoftBlock']) assert.ok(campus.includes(`function ${landmark}(`))
  assert.ok(campus.includes('RoundedBox'))
  assert.ok(campus.includes('cylinderGeometry args={[2.2,2.2,6.4'))
  assert.ok(campus.includes('size={[18,6.3,10]}'))
  assert.ok(campus.includes('const depth = end + 28'))
  const scene = readFileSync(new URL('../app/dashboard/components/FleetScene.js', import.meta.url), 'utf8')
  assert.ok(scene.includes('<FleetCampus end={end}/>'))
  assert.ok(scene.includes('frameloop="demand"'))
  assert.ok(scene.includes('<Vehicle car={car}'))
  assert.ok(scene.includes('<Canvas orthographic '))
  assert.ok(scene.includes('enableRotate={false}'))
  assert.ok(scene.includes('camera.matrixWorldInverse'))
  assert.ok(scene.includes('<Canvas orthographic shadows'))
  assert.ok(scene.includes('[-25,end+4]'))
})

test('map-only redesign preserves the approved vehicle meshes and movement controller', () => {
  const source = readFileSync(new URL('../app/dashboard/components/FleetScene.js', import.meta.url), 'utf8')
  const hash = (start,end) => createHash('sha256').update(source.slice(source.indexOf(start),source.indexOf(end))).digest('hex')
  // Approved vehicle implementation at 5621bf9, deliberately unchanged by this map redesign.
  assert.equal(hash('function Block(', 'function route('), 'fa36d653bb4ebde2ec3563a8444b12a58b3a5cc889c98f0549b3e9cfe625b9e6')
  assert.equal(hash('function route(', 'function CameraRig('), '6869c095ab5278f12eedaa5de588caba35fac48e53ee52113c918e705b898012')
})
