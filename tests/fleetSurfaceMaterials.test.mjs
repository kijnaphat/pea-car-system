import test from 'node:test'
import assert from 'node:assert/strict'
import { surfaceSwatch, curbJoints, raisedCurbRuns } from '../lib/fleetSurfaceMaterials.js'

test('asphalt and stone swatches are deterministic, opaque, bounded and visually distinct', () => {
  for (const kind of ['stone', 'asphalt']) {
    const pixels = surfaceSwatch(kind)
    assert.equal(pixels.length, 128 * 128 * 4)
    assert.deepEqual(pixels, surfaceSwatch(kind))
    assert.ok(pixels.every((n, i) => i % 4 !== 3 || n === 255))
    assert.ok(new Set(pixels).size > 10)
  }
  assert.notDeepEqual(surfaceSwatch('stone'), surfaceSwatch('asphalt'))
  assert.throws(() => surfaceSwatch('stone', 1024), RangeError)
})

test('raised kerbs break at driveways without changing the underlying road boundary', () => {
  const ring = [[0,0],[8,0],[8,6],[0,6],[0,0]], original = JSON.stringify(ring)
  const cutout = { minX: 2, maxX: 6, minZ: -.2, maxZ: .2 }
  const runs = raisedCurbRuns(ring, [cutout])
  assert.ok(runs.length >= 2)
  assert.ok(runs.flat().every(([x,z]) => !(x >= 2 && x <= 6 && Math.abs(z) <= .2)))
  assert.equal(JSON.stringify(ring), original)
  assert.ok(runs.flat().every(p => p.every(Number.isFinite)))
})

test('curb joints follow road edges, have finite geometry and obey a fixed instance budget', () => {
  const ring = [[0,0],[8,0],[8,6],[0,6],[0,0]], parts = curbJoints([ring])
  assert.ok(parts.length > 10 && parts.length < 20)
  for (const p of parts) {
    assert.ok([...p.at, ...p.size, ...p.rotation].every(Number.isFinite))
    assert.ok(p.at[0] === 0 || p.at[0] === 8 || p.at[2] === 0 || p.at[2] === 6)
  }
  assert.ok(curbJoints([[[0,0],[10000,0]]]).length <= 1000)
})
