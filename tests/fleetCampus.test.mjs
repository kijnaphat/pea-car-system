import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('decorative campus is offline geometry and does not add telemetry or database polling', () => {
  const campus = readFileSync(new URL('../app/dashboard/components/FleetCampus.js', import.meta.url), 'utf8')
  assert.doesNotMatch(campus, /fetch\(|supabase|useFrame|useTexture|https:\/\//)
  for (const landmark of ['Office', 'SolarCanopy', 'Gate', 'Tree', 'Planter', 'Arrow']) assert.ok(campus.includes(`function ${landmark}(`))
  const scene = readFileSync(new URL('../app/dashboard/components/FleetScene.js', import.meta.url), 'utf8')
  assert.ok(scene.includes('<FleetCampus end={end}/>'))
  assert.ok(scene.includes('frameloop="demand"'))
  assert.ok(scene.includes('<Vehicle car={car}'))
})
