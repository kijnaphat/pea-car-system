import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ARCHITECTURE, facadeParts, officeRoofParts, pitchedRoofParts, ancillaryEntranceParts, canopyStructure, treeCrown } from '../lib/fleetArchitecture.js'
import { SITE_BUILDINGS, SITE_CHARGING, SITE_CUSTOMER } from '../lib/fleetSiteLayout.js'

test('detailed facades keep four floors and remain inside the existing building footprint', () => {
  for (const b of Object.values(SITE_BUILDINGS)) {
    const facade = facadeParts(b)
    assert.ok(facade.glass.length >= b.floors * 8)
    assert.equal(facade.frames.length, facade.glass.length)
    assert.ok(facade.glass.length <= 128)
    assert.ok(facade.shading.length > facade.glass.length)
    assert.equal(facade.reflections.length, facade.glass.length)
    for (const p of Object.values(facade).flat()) {
      assert.ok(p.at.every(Number.isFinite))
      assert.ok(p.size.every(n => Number.isFinite(n) && n > 0))
      assert.ok(Math.abs(p.at[0]) + p.size[0] / 2 <= b.width / 2 + .65)
      assert.ok(Math.abs(p.at[2]) + p.size[2] / 2 <= b.depth / 2 + .65)
      assert.ok(p.at[1] + p.size[1] / 2 < b.floors * ARCHITECTURE.floorHeight + .2)
    }
  }
})

test('steel trusses stay above cars and the eight posts stay on carport edges', () => {
  for (const b of [SITE_CUSTOMER, SITE_CHARGING]) {
    const parts = canopyStructure(b.width, b.depth)
    const posts = parts.filter(p => p.size[1] === 3.5 && p.size[0] === .12)
    assert.equal(posts.length, 8)
    assert.ok(posts.every(p => Math.abs(p.at[2]) > 2.7))
    assert.ok(parts.filter(p => p.at[1] > 3).every(p => p.at[1] - p.size[1] / 2 > 3))
    assert.ok(parts.every(p => p.at.every(Number.isFinite) && p.size.every(n => n > 0)))
  }
})

test('office photovoltaic roof and plant details stay on the original roof below site framing', () => {
  const b = SITE_BUILDINGS.office, roof = officeRoofParts(b)
  assert.deepEqual(roof, officeRoofParts(b))
  assert.ok(roof.solar.length >= 12)
  assert.ok(roof.metal.length > 20)
  for (const p of Object.values(roof).flat()) {
    assert.ok(p.at.every(Number.isFinite) && p.size.every(n => Number.isFinite(n) && n > 0))
    assert.ok(Math.abs(p.at[0]) + p.size[0] / 2 <= b.width / 2 + .25)
    assert.ok(Math.abs(p.at[2]) + p.size[2] / 2 <= b.depth / 2 + .25)
    assert.ok(b.floors * ARCHITECTURE.floorHeight + .22 + p.at[1] + p.size[1] / 2 < 9)
  }
})

test('standing-seam roof details follow the hipped roof without widening the building apron', () => {
  for (const b of Object.values(SITE_BUILDINGS).filter(b => !b.office)) {
    const width = b.depth + .7, depth = b.width + .7
    const seams = pitchedRoofParts(width, depth)
    assert.deepEqual(seams, pitchedRoofParts(width, depth))
    assert.ok(seams.length > 12)
    for (const p of seams) {
      assert.ok(p.at.every(Number.isFinite) && p.size.every(n => Number.isFinite(n) && n > 0))
      assert.ok(Math.abs(p.at[0]) + p.size[0] / 2 <= width / 2 + .1)
      // Include rotation in the seam's projected depth to protect the roof edge.
      const projectedDepth = p.size[2] * Math.abs(Math.cos(p.rotation?.[0] || 0))
      assert.ok(Math.abs(p.at[2]) + projectedDepth / 2 <= depth / 2 + .1)
    }
  }
})

test('one-storey and two-storey lobbies clear their roof eaves and stay within the paved apron', () => {
  for (const b of Object.values(SITE_BUILDINGS).filter(b => !b.office)) {
    for (const p of ancillaryEntranceParts(b)) {
      assert.ok(p.at[1] + p.size[1] / 2 < b.floors * ARCHITECTURE.floorHeight + .18)
      assert.ok(Math.abs(p.at[2]) + p.size[2] / 2 <= b.depth / 2 + .65)
      assert.ok(p.at.every(Number.isFinite) && p.size.every(n => Number.isFinite(n) && n > 0))
    }
  }
})

test('natural foliage is deterministic and fits the existing landscaping clearance', () => {
  for (const small of [false, true]) for (let tone = 0; tone < 5; tone++) {
    const crown = treeCrown(small, tone)
    assert.equal(crown.length, 4)
    assert.deepEqual(crown, treeCrown(small, tone))
    assert.ok(crown.every(p => ARCHITECTURE.foliage.includes(p.color)))
    assert.ok(crown.every(p => Math.abs(p.at[0]) + p.size[0] <= 1 && Math.abs(p.at[2]) + p.size[2] <= 1))
  }
})

test('architectural detail batches static geometry with no network textures or animation loop', () => {
  const component = readFileSync(new URL('../app/dashboard/components/FleetArchitecture.js', import.meta.url), 'utf8')
  const campus = readFileSync(new URL('../app/dashboard/components/FleetCampus.js', import.meta.url), 'utf8')
  const scene = readFileSync(new URL('../app/dashboard/components/FleetScene.js', import.meta.url), 'utf8')
  assert.ok(component.includes('<instancedMesh'))
  assert.ok(component.includes('useLayoutEffect'))
  assert.doesNotMatch(component, /fetch\(|useTexture|useFrame|Math\.random|https:\/\//)
  assert.ok(campus.includes('facadeParts({ width, depth, floors })'))
  assert.ok(campus.includes('<ArchitecturalCanopy width={SITE_CHARGING.width}'))
  assert.ok(campus.includes('<StaticParts parts={facade.glass} glass/>'))
  assert.ok(component.includes('setColorAt(n, color.set(part.color))'))
  assert.doesNotMatch(component, /meshStandardMaterial vertexColors/)
  assert.ok(scene.includes('PCFShadowMap'))
  assert.ok(scene.includes('size.width >= 900 ? 2048 : 1024'))
  assert.ok(scene.includes('frameloop="demand"'))
  assert.ok(scene.includes('dpr={[1, 1.5]}'))
})
