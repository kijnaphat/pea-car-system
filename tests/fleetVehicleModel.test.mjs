import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Color } from 'three'
import { createVehicleModel, createVehicleModelCache, vehicleModelIdentity, VEHICLE_MODEL_KINDS, VEHICLE_MODEL_ENVELOPE } from '../lib/fleetVehicleModel.js'
import { vehicleStyle, FLEET_PAINTS } from '../lib/fleetVehicleStyle.js'

const digest = model => {
  const hash = createHash('sha256')
  for (const batch of model.batches) {
    hash.update(batch.family)
    for (const name of ['position', 'normal', 'color']) hash.update(Buffer.from(batch.geometry.getAttribute(name).array.buffer))
  }
  return hash.digest('hex')
}

test('all eleven detailed models fit the existing traffic, parking and canopy clearances', () => {
  assert.equal(VEHICLE_MODEL_KINDS.length, 11)
  for (const kind of VEHICLE_MODEL_KINDS) {
    const model = createVehicleModel(kind, FLEET_PAINTS.owned.color)
    try {
      assert.ok(model.bounds.min.x >= -VEHICLE_MODEL_ENVELOPE.width / 2, `${kind}: left mirror/outrigger`)
      assert.ok(model.bounds.max.x <= VEHICLE_MODEL_ENVELOPE.width / 2, `${kind}: right mirror/outrigger`)
      assert.ok(model.bounds.min.z >= -VEHICLE_MODEL_ENVELOPE.length / 2, `${kind}: rear overhang`)
      assert.ok(model.bounds.max.z <= VEHICLE_MODEL_ENVELOPE.length / 2, `${kind}: front overhang`)
      assert.ok(model.bounds.min.y >= 0 && model.bounds.min.y <= .03, `${kind}: tire contact`)
      assert.ok(model.bounds.max.y < VEHICLE_MODEL_ENVELOPE.height, `${kind}: folded gear below canopy`)
      assert.ok(model.metrics.drawCalls >= 5 && model.metrics.drawCalls <= 8, `${kind}: material batch budget`)
      assert.ok(model.metrics.triangles >= 1200 && model.metrics.triangles <= 8500, `${kind}: geometry budget`)
      const six = ['bucket', 'crane', 'drill', 'heavy_truck'].includes(kind)
      assert.equal(model.metrics.wheelCount, kind === 'motorcycle' ? 2 : six ? 6 : 4)
      assert.equal(model.metrics.axles.length, six ? 3 : 2)
    } finally { model.dispose() }
  }
})

test('merged geometry has finite positions, normalized normals and linear vertex colors', () => {
  for (const kind of VEHICLE_MODEL_KINDS) {
    const model = createVehicleModel(kind, '#ed861f')
    try {
      for (const { geometry, material } of model.batches) {
        assert.equal(geometry.index, null)
        const positions = geometry.getAttribute('position'), normals = geometry.getAttribute('normal'), colors = geometry.getAttribute('color')
        assert.equal(positions.count % 3, 0)
        assert.equal(normals.count, positions.count)
        assert.equal(colors.count, positions.count)
        assert.ok(material.vertexColors)
        assert.equal(material.transparent, false)
        for (const value of positions.array) assert.ok(Number.isFinite(value))
        for (const value of colors.array) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1)
        for (let n = 0; n < normals.count; n++) assert.ok(Math.abs(Math.hypot(normals.getX(n), normals.getY(n), normals.getZ(n)) - 1) < .001)
      }
    } finally { model.dispose() }
  }
})

test('each silhouette is deterministic, distinct and independent of operational status', () => {
  const fingerprints = new Set()
  for (const kind of VEHICLE_MODEL_KINDS) {
    const a = createVehicleModel(kind, '#929ba5'), b = createVehicleModel(kind, '#929ba5')
    try {
      assert.equal(digest(a), digest(b), kind)
      fingerprints.add(digest(a))
    } finally { a.dispose(); b.dispose() }
  }
  assert.equal(fingerprints.size, VEHICLE_MODEL_KINDS.length)
})

test('owned orange, rental gray and EV blue still come from existing fleet paint rules', () => {
  for (const [data, color] of [
    [{ car_type: 'รถกระบะ', ownership_type: 'รถของการไฟฟ้า' }, FLEET_PAINTS.owned.color],
    [{ car_type: 'รถตู้', ownership_type: 'รถเช่า' }, FLEET_PAINTS.rental.color],
    [{ car_type: 'รถไฟฟ้า', fuel_type: 'EV', ownership_type: 'รถเช่า' }, FLEET_PAINTS.electric.color],
  ]) {
    const style = vehicleStyle(data), model = createVehicleModel(style.kind, style.color)
    try {
      assert.equal(model.color, color)
      const paint = model.batches.find(batch => batch.family === 'paint').geometry.getAttribute('color')
      const expected = new Color(color)
      assert.ok(Math.abs(paint.getX(0) - expected.r) < .00001)
      assert.ok(Math.abs(paint.getY(0) - expected.g) < .00001)
      assert.ok(Math.abs(paint.getZ(0) - expected.b) < .00001)
    } finally { model.dispose() }
  }
  const fallback = createVehicleModel('new unknown vehicle', 'not a color')
  assert.equal(fallback.kind, 'generic'); assert.equal(fallback.color, '#748a9b'); fallback.dispose()
})

test('shared cache survives strict-mode cleanup and never disposes another live car', () => {
  const queued = [], cache = createVehicleModelCache({ defer: task => queued.push(task) })
  const a = cache.get('ev', '#3aafd7'), b = cache.get('ev', '#3aafd7')
  assert.equal(a, b)
  cache.retain(a); cache.retain(b)
  cache.release(a); queued.splice(0).forEach(task => task())
  assert.equal(b.model.disposed, false)
  cache.release(b)
  cache.retain(b) // React's second setup occurs before deferred disposal.
  queued.splice(0).forEach(task => task())
  assert.equal(b.model.disposed, false)
  let geometries = 0, materials = 0
  for (const batch of b.model.batches) {
    batch.geometry.addEventListener('dispose', () => geometries++)
    batch.material.addEventListener('dispose', () => materials++)
  }
  cache.release(b); queued.splice(0).forEach(task => task())
  assert.equal(b.model.disposed, true)
  assert.equal(cache.size, 0)
  assert.equal(geometries, b.model.metrics.drawCalls)
  assert.equal(materials, b.model.metrics.drawCalls)
  b.model.dispose()
  assert.equal(geometries, b.model.metrics.drawCalls)
})

test('cache eviction can exceed the soft limit for live models but only reclaims unused resources', () => {
  const queued = [], cache = createVehicleModelCache({ limit: 1, defer: task => queued.push(task) })
  const a = cache.get('pickup', '#ed861f'); cache.retain(a)
  const b = cache.get('van', '#929ba5'); cache.retain(b)
  assert.equal(cache.size, 2)
  cache.clearUnused(); assert.equal(a.model.disposed, false); assert.equal(b.model.disposed, false)
  cache.release(a); queued.splice(0).forEach(task => task())
  assert.equal(cache.size, 1); assert.equal(a.model.disposed, true); assert.equal(b.model.disposed, false)
  cache.release(b); queued.splice(0).forEach(task => task())
  assert.equal(cache.size, 0)
})

test('more than32 sibling models are retained before deferred cache trimming', () => {
  const queued = [], cache = createVehicleModelCache({ limit: 32, defer: task => queued.push(task) })
  const cars = Array.from({ length: 33 }, (_, n) => cache.get('generic', `#${(0x456700 + n).toString(16)}`))
  assert.ok(cars.every(entry => !entry.model.disposed))
  cars.forEach(entry => cache.retain(entry))
  queued.splice(0).forEach(task => task())
  assert.equal(cache.size, 33)
  assert.ok(cars.every(entry => !entry.model.disposed))
  cars.forEach(entry => cache.release(entry))
  queued.splice(0).forEach(task => task())
  assert.equal(cache.size, 0)
})

test('render component uses the existing styles and shared meshes without telemetry or per-frame model rebuilding', () => {
  const source = readFileSync(new URL('../app/dashboard/components/FleetVehicleModel.js', import.meta.url), 'utf8')
  assert.match(source, /vehicleStyle\(car\)/)
  assert.match(source, /geometry=\{geometry\} material=\{material\}/)
  assert.match(source, /dispose=\{null\}/)
  assert.match(source, /models\.release\(committed\)/)
  assert.doesNotMatch(source, /useFrame|fetch\(|useTexture|https:|Math\.random/)
})

test('GPU cache acquisition happens only in committed layout effects, never in a yielding render', () => {
  const source = readFileSync(new URL('../app/dashboard/components/FleetVehicleModel.js', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /useMemo/)
  assert.match(source, /useState\(null\)/)
  assert.match(source, /useLayoutEffect\(\(\) => \{[\s\S]*const committed = models\.get\(kind, color\)\s+models\.retain\(committed\)/)
  assert.match(source, /if \(resource\?\.key !== key\) return null/)
  const cache = createVehicleModelCache()
  // Pure render-time identity calculation allocates no geometry, including for
  // a render that is abandoned or changes the paint before committing.
  for (let n = 0; n < 64; n++) vehicleModelIdentity('ev', `#${(0x456700 + n).toString(16)}`)
  assert.equal(cache.size, 0)
  assert.deepEqual(vehicleModelIdentity('unsupported', 'invalid'), { kind: 'generic', color: '#748a9b', key: 'generic:#748a9b' })
})
