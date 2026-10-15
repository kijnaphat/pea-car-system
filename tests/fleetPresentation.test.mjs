import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Vector3, Matrix4 } from 'three'
import { architecturalSun } from '../lib/fleetPresentation.js'
import { SITE } from '../lib/fleetSiteLayout.js'

test('architectural sun covers the complete site, including future parking expansion', () => {
  for (const maxX of [SITE.bounds.maxX, 180, 340]) {
    const bounds = { ...SITE.bounds, maxX }, light = architecturalSun(bounds)
    const camera = new Matrix4().lookAt(new Vector3(...light.position), new Vector3(...light.center), new Vector3(0, 1, 0))
    camera.setPosition(...light.position); camera.invert()
    for (const x of [bounds.minX, bounds.maxX]) for (const z of [bounds.minZ, bounds.maxZ]) for (const y of [-.6, 10]) {
      const p = new Vector3(x, y, z).applyMatrix4(camera)
      assert.ok(p.x >= light.left && p.x <= light.right)
      assert.ok(p.y >= light.bottom && p.y <= light.top)
      assert.ok(-p.z >= light.near && -p.z <= light.far)
    }
    assert.ok(Object.values(light).flat().every(Number.isFinite))
  }
})

test('studio reflections allocate once per renderer and release their GPU resources', () => {
  const scene = readFileSync(new URL('../app/dashboard/components/FleetEnvironment.js', import.meta.url), 'utf8')
  assert.ok(scene.includes("from 'three/addons/environments/RoomEnvironment.js'"))
  assert.ok(scene.includes('generator.fromScene(room'))
  assert.ok(scene.includes('room.dispose(); generator.dispose()'))
  assert.ok(scene.includes('environment.dispose()'))
  assert.ok(scene.includes('[gl, scene, invalidate, intensity]'))
  assert.ok(scene.includes('{ size: 128 }'))
  assert.doesNotMatch(scene, /https:\/\/|useTexture|\.hdr/)
})
