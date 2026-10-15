import test from 'node:test'
import assert from 'node:assert/strict'
import { hipRoofInset, hipRoofMesh } from '../lib/fleetRoofGeometry.js'
import { pitchedRoofParts } from '../lib/fleetArchitecture.js'
import { SITE_BUILDINGS } from '../lib/fleetSiteLayout.js'

const actualRoofs = [
  ...Object.entries(SITE_BUILDINGS).filter(([, building]) => !building.office)
    .map(([name, building]) => ({ name, width: building.depth + .7, depth: building.width + .7, rise: .65 })),
  { name: 'gate', width: 2.5, depth: 2.8, rise: .45 },
]

test('every actual hipped roof has a positive ridge and nondegenerate upward-facing triangles', () => {
  for (const { name, width, depth, rise } of actualRoofs) {
    const { points, indices } = hipRoofMesh(width, depth, rise)
    assert.ok(points instanceof Float32Array)
    assert.ok(indices instanceof Uint16Array)
    assert.equal(points.length, 18)
    assert.equal(indices.length, 18)
    assert.ok([...points].every(Number.isFinite))
    assert.ok(points[12] < points[15], `${name}: ridge never reverses`)
    assert.ok(points[15] - points[12] >= .039999, `${name}: positive short ridge`)
    for (let n = 0; n < indices.length; n += 3) {
      const [a, b, c] = [...indices.slice(n, n + 3)].map(index => [...points.slice(index * 3, index * 3 + 3)])
      const ab = b.map((value, i) => value - a[i]), ac = c.map((value, i) => value - a[i])
      const normal = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]]
      assert.ok(normal[1] > 0, `${name}: triangle ${n / 3} faces above the roof`)
      assert.ok(Math.hypot(...normal) > .0001, `${name}: triangle ${n / 3} has area`)
    }
    for (let n = 0; n < points.length; n += 3) {
      assert.ok(Math.abs(points[n]) <= width / 2 + .000001, `${name}: original X footprint`)
      assert.ok(points[n + 1] >= 0 && points[n + 1] <= rise + .000001, `${name}: original height`)
      assert.ok(Math.abs(points[n + 2]) <= depth / 2 + .000001, `${name}: original Z footprint`)
    }
    assert.deepEqual(hipRoofMesh(width, depth, rise), hipRoofMesh(width, depth, rise))
  }
})

test('standing seams and mesh share the same ridge and roof planes, including narrow gate and rear roofs', () => {
  for (const { name, width, depth, rise } of actualRoofs) {
    const inset = hipRoofInset(width, depth), parts = pitchedRoofParts(width, depth, rise)
    const ridge = parts[0], mesh = hipRoofMesh(width, depth, rise)
    assert.ok(Math.abs(ridge.size[0] - (mesh.points[15] - mesh.points[12])) < .000001, `${name}: matching ridge`)
    const seams = parts.filter(part => part.rotation)
    assert.ok(seams.length > 0)
    for (const seam of seams) {
      assert.ok([...seam.at, ...seam.size, ...seam.rotation].every(Number.isFinite))
      assert.ok(seam.size.every(value => value > 0))
      // Box centreline endpoints follow the broad roof plane exactly, .02 above
      // its surface; the clamped hip inset limits the maximum height near ends.
      for (const sign of [-1, 1]) {
        const x = seam.at[0]
        const y = seam.at[1] - sign * Math.sin(seam.rotation[0]) * seam.size[2] / 2
        const z = seam.at[2] + sign * Math.cos(seam.rotation[0]) * seam.size[2] / 2
        const surface = rise * Math.min(1, (width / 2 - Math.abs(x)) / inset, (depth / 2 - Math.abs(z)) / (depth / 2))
        assert.ok(Math.abs(y - surface - .02) < .000001, `${name}: seam remains on the roof`)
      }
    }
  }
})

test('invalid dimensions cannot create NaN or inverted hipped roofs', () => {
  for (const dimensions of [[0, 3, 1], [.04, 3, 1], [2, 0, 1], [2, -3, 1], [2, 3, 0], [2, 3, NaN], [Infinity, 3, 1]]) {
    assert.throws(() => hipRoofMesh(...dimensions), RangeError)
  }
})
