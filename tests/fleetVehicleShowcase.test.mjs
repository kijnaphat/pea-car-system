import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createVehicleModel } from '../lib/fleetVehicleModel.js'
import { VISITOR_CARS } from '../lib/fleetCampusVisitors.js'

test('the selected car alone gets a demand-rendered model viewer with keyboard controls and an SVG fallback', () => {
  const viewer = readFileSync(new URL('../app/dashboard/components/FleetVehicleShowcase.js', import.meta.url), 'utf8')
  const twin = readFileSync(new URL('../app/dashboard/components/FleetDigitalTwin.js', import.meta.url), 'utf8')
  assert.ok(viewer.includes('frameloop="demand"'))
  assert.ok(viewer.includes('dpr={[1, 1.25]}'))
  assert.ok(viewer.includes('enableZoom={false}'))
  assert.ok(viewer.includes('aria-label="หมุนโมเดลรถซ้าย"'))
  assert.ok(viewer.includes('aria-label="หมุนโมเดลรถขวา"'))
  assert.doesNotMatch(viewer, /autoRotate|useFrame|fetch\(|supabase|setInterval/)
  assert.equal((twin.match(/<VehicleShowcase /g) || []).length, 1)
  assert.ok(twin.includes('!safeMap && <SceneBoundary key={`preview-${selected.id}`}'))
  assert.ok(twin.includes('<FleetVehicleGlyph car={selected} size={150}/>'))
  assert.ok(twin.includes('สแกน QR Code ที่รถเท่านั้น'))
})

test('every decorative visitor body including the detailed motorcycle fits its traffic controller footprint', () => {
  for (const car of VISITOR_CARS) {
    const model = createVehicleModel(car.kind === 'motorcycle' ? 'motorcycle' : 'generic', car.color)
    try {
      const footprint = car.footprint || { width: 2.05, length: 3.65 }
      assert.ok(Math.max(Math.abs(model.bounds.min.x), Math.abs(model.bounds.max.x)) * 2 <= footprint.width)
      assert.ok(Math.max(Math.abs(model.bounds.min.z), Math.abs(model.bounds.max.z)) * 2 <= footprint.length)
    } finally { model.dispose() }
  }
})
