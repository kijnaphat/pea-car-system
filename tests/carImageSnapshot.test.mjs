import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import sharp from 'sharp'
import { CAR_IMAGE_SNAPSHOT, CAR_IMAGE_SNAPSHOT_PROJECT } from '../lib/carImageSnapshot.js'
import { getBundledCarImageUrl, getCarImage, getStoredCarImageUrl, isCarImageStoragePaused } from '../lib/carImages.js'
import { IMAGE_CACHE_SECONDS, parseCarImageRequest } from '../lib/carImageDelivery.js'

const variants = { thumb: 160, card: 640, hero: 1280 }
const paths = Object.keys(CAR_IMAGE_SNAPSHOT)
const routeSource = readFileSync(new URL('../app/api/car-image/route.js', import.meta.url), 'utf8')

function withProject(project, callback) {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (project === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
  else process.env.NEXT_PUBLIC_SUPABASE_URL = project
  return Promise.resolve().then(callback).finally(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous
  })
}

// Exercise the actual exported handler without importing Next's production cache
// or resolving its build-time @ alias. Both origin and renderer are observable stubs.
function handlerFixture() {
  const calls = { bundled: 0, origin: 0, rendered: 0 }
  const handler = new Function('parseCarImageRequest', 'getBundledCarImageUrl', 'isCarImageStoragePaused', 'readSource',
    'renderCarImage', 'IMAGE_CACHE_SECONDS',
    `${routeSource.slice(routeSource.indexOf('export async function GET')).replace('export async function GET', 'async function GET')}; return GET;`)(
    parseCarImageRequest,
    (...args) => { calls.bundled++; return getBundledCarImageUrl(...args) },
    isCarImageStoragePaused,
    async () => { calls.origin++; return 'new-bounded-source' },
    async () => { calls.rendered++; return { bytes: Buffer.from('bounded-webp'), etag: '"fixture-etag"' } },
    IMAGE_CACHE_SECONDS,
  )
  return { handler, calls }
}

function request(path, variant = 'hero') {
  return new Request(`https://example.test/api/car-image?${new URLSearchParams({ path, variant })}`)
}

test('reviewed snapshot covers 30 complete image paths, each with exactly three variants', () => {
  assert.equal(paths.length, 30)
  for (const path of paths) {
    assert.match(path, /^(cars\/[1-9]\d*\/[a-zA-Z0-9_.-]+|legacy\/[a-zA-Z0-9_.-]+)$/)
    assert.deepEqual(Object.keys(CAR_IMAGE_SNAPSHOT[path]).sort(), Object.keys(variants).sort())
  }
})

test('only the exact Supabase project and exact current image path resolve to static copies', () => {
  assert.ok(paths.length)
  for (const path of paths) {
    for (const variant of Object.keys(variants)) {
      assert.equal(getBundledCarImageUrl(path, variant, CAR_IMAGE_SNAPSHOT_PROJECT), CAR_IMAGE_SNAPSHOT[path][variant])
      assert.equal(getBundledCarImageUrl(path, variant, `${CAR_IMAGE_SNAPSHOT_PROJECT}/`), CAR_IMAGE_SNAPSHOT[path][variant])
    }
    for (const project of [null, '', 'https://dqwemzjmzowyxyhbljoe.supabase.co',
      `${CAR_IMAGE_SNAPSHOT_PROJECT}.evil.test`, `${CAR_IMAGE_SNAPSHOT_PROJECT}?other=1`,
      `${CAR_IMAGE_SNAPSHOT_PROJECT}/storage`, `${CAR_IMAGE_SNAPSHOT_PROJECT}//`,
      CAR_IMAGE_SNAPSHOT_PROJECT.replace('https://', 'https://attacker@'),
      CAR_IMAGE_SNAPSHOT_PROJECT.replace('https://', 'http://')]) {
      assert.equal(getBundledCarImageUrl(path, 'hero', project), null, `reject project ${project}`)
    }
    for (const otherPath of [`${path}-replacement`, `new/${path}`, `/${path}`, `${path}?v=2`,
      path.replace(/[^/]+$/, 'main-9999999999999.webp'), '__proto__', 'constructor']) {
      assert.equal(getBundledCarImageUrl(otherPath, 'hero', CAR_IMAGE_SNAPSHOT_PROJECT), null)
    }
    assert.equal(getBundledCarImageUrl(path, 'unsupported', CAR_IMAGE_SNAPSHOT_PROJECT), null)
  }
})

test('emergency Storage pause is scoped to the exact Kamphaeng Saen project only', async () => {
  for (const project of [CAR_IMAGE_SNAPSHOT_PROJECT, `${CAR_IMAGE_SNAPSHOT_PROJECT}/`]) {
    assert.equal(isCarImageStoragePaused(project), true)
    await withProject(project, () => assert.equal(isCarImageStoragePaused(), true))
  }
  for (const project of [null, '', 'https://dqwemzjmzowyxyhbljoe.supabase.co',
    `${CAR_IMAGE_SNAPSHOT_PROJECT}.evil.test`, `${CAR_IMAGE_SNAPSHOT_PROJECT}?other=1`,
    `${CAR_IMAGE_SNAPSHOT_PROJECT}/storage`, `${CAR_IMAGE_SNAPSHOT_PROJECT}//`,
    CAR_IMAGE_SNAPSHOT_PROJECT.replace('https://', 'https://attacker@'),
    CAR_IMAGE_SNAPSHOT_PROJECT.replace('https://', 'http://')]) {
    assert.equal(isCarImageStoragePaused(project), false, `do not pause unrelated project ${project}`)
  }
  await withProject(undefined, () => assert.equal(isCarImageStoragePaused(), false))
})

test('paused tenant reuses current static photos while unknown/replaced/obsolete paths use only local fallbacks', async () => {
  const path = paths[0]
  assert.ok(path)
  await withProject(CAR_IMAGE_SNAPSHOT_PROJECT, () => {
    assert.equal(getStoredCarImageUrl(path, 'thumb'), CAR_IMAGE_SNAPSHOT[path].thumb)
    assert.equal(getStoredCarImageUrl(path), CAR_IMAGE_SNAPSHOT[path].hero)
    assert.equal(getCarImage({ image_path: path, car_type: 'รถ EV' }, 'card'), CAR_IMAGE_SNAPSHOT[path].card)
    for (const unknownPath of ['cars/999/main-9999999999999.webp',
      path.replace(/[^/]+$/, 'main-9999999999999.webp'), 'cars/999/main-old.webp', 'legacy/obsolete.png']) {
      assert.equal(getStoredCarImageUrl(unknownPath, 'card'), null)
      assert.equal(getStoredCarImageUrl(unknownPath, 'unsupported'), null)
      assert.equal(getCarImage({ image_path: unknownPath, car_type: 'รถ EV' }, 'card'), '/mg.png')
      assert.equal(getCarImage({ image_path: unknownPath, car_type: 'unknown' }, 'card'), '/car-placeholder.svg')
    }
    assert.equal(getStoredCarImageUrl(null), null)
  })
  await withProject('https://dqwemzjmzowyxyhbljoe.supabase.co', () => {
    assert.equal(getBundledCarImageUrl(path), null)
    assert.match(getStoredCarImageUrl(path, 'thumb'), /^\/api\/car-image\?path=/)
  })
  await withProject(undefined, () => assert.equal(getBundledCarImageUrl(path), null))
})

test('all static assets are content-addressed bounded WebP variants, without missing or unreferenced files', async () => {
  const referenced = new Set()
  for (const [path, images] of Object.entries(CAR_IMAGE_SNAPSHOT)) {
    for (const [variant, maxDimension] of Object.entries(variants)) {
      const asset = images[variant]
      const match = /^\/fleet-images\/([a-f0-9]{64})-(thumb|card|hero)\.webp$/.exec(asset)
      assert.ok(match, `${path}: trusted relative hashed asset URL`)
      assert.equal(match[2], variant)
      const bytes = readFileSync(new URL(`../public${asset}`, import.meta.url))
      assert.ok(bytes.length > 0 && bytes.length <= 262144, `${path} ${variant}: bounded asset`)
      assert.equal(createHash('sha256').update(bytes).digest('hex'), match[1], `${path} ${variant}: filename identifies bytes`)
      const metadata = await sharp(bytes).metadata()
      assert.equal(metadata.format, 'webp')
      assert.ok(metadata.width > 0 && metadata.width <= maxDimension)
      assert.ok(metadata.height > 0 && metadata.height <= maxDimension)
      assert.equal(metadata.exif, undefined, 'do not publish camera EXIF')
      referenced.add(asset.split('/').pop())
    }
  }
  assert.equal(referenced.size, 90)
  assert.deepEqual(readdirSync(new URL('../public/fleet-images', import.meta.url)).sort(), [...referenced].sort())
})

test('actual API handler redirects known images before any source/cache read using a fixed immutable relative URL', async () => {
  await withProject(CAR_IMAGE_SNAPSHOT_PROJECT, async () => {
    const { handler, calls } = handlerFixture()
    for (const variant of Object.keys(variants)) {
      const response = await handler(request(paths[0], variant))
      assert.equal(response.status, 308)
      assert.equal(response.headers.get('location'), CAR_IMAGE_SNAPSHOT[paths[0]][variant])
      assert.match(response.headers.get('cache-control'), /^public, max-age=31536000, immutable$/)
      assert.equal(response.headers.get('x-car-image-delivery'), 'bundled-static')
      assert.equal(await response.text(), '')
    }
    assert.deepEqual(calls, { bundled: 3, origin: 0, rendered: 0 })
  })
})

test('actual API handler validates malformed requests before looking up or reading any image', async () => {
  await withProject(CAR_IMAGE_SNAPSHOT_PROJECT, async () => {
    const { handler, calls } = handlerFixture()
    const path = encodeURIComponent(paths[0])
    for (const query of [`path=${path}&variant=unsupported`, `path=${path}&bust=1`,
      `path=${path}&path=${path}`, `path=${path}&variant=hero&variant=thumb`,
      'path=../secret', 'path=cars/1/../main', 'path=https://evil.test/a']) {
      const response = await handler(new Request(`https://example.test/api/car-image?${query}`))
      assert.equal(response.status, 400)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.equal(response.headers.get('location'), null)
    }
    assert.deepEqual(calls, { bundled: 0, origin: 0, rendered: 0 })
  })
})

test('actual API handler temporarily redirects every valid unknown KPN path before any source/cache/origin read or rendering', async () => {
  for (const project of [CAR_IMAGE_SNAPSHOT_PROJECT, `${CAR_IMAGE_SNAPSHOT_PROJECT}/`]) {
    await withProject(project, async () => {
      const { handler, calls } = handlerFixture()
      const unknownPaths = ['cars/999/main-9999999999999.webp',
        paths[0].replace(/[^/]+$/, 'main-9999999999999.webp'), 'cars/999/main-old.webp', 'legacy/obsolete.png']
      for (const path of unknownPaths) {
        for (const variant of Object.keys(variants)) {
          const response = await handler(request(path, variant))
          assert.equal(response.status, 307, 'temporary response must be reversible when emergency mode ends')
          assert.equal(response.headers.get('location'), '/car-placeholder.svg')
          assert.equal(response.headers.get('cache-control'), 'public, max-age=300')
          assert.equal(response.headers.get('x-car-image-delivery'), 'local-fallback')
          assert.equal(await response.text(), '')
        }
      }
      assert.deepEqual(calls, { bundled: unknownPaths.length * Object.keys(variants).length, origin: 0, rendered: 0 })
    })
  }
})

test('actual API handler preserves bounded dynamic delivery for both current and unknown paths of other tenants', async () => {
  for (const path of [paths[0], 'cars/999/main-9999999999999.webp']) {
    await withProject('https://dqwemzjmzowyxyhbljoe.supabase.co', async () => {
      const { handler, calls } = handlerFixture()
      const response = await handler(request(path, 'card'))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('location'), null)
      assert.equal(response.headers.get('content-type'), 'image/webp')
      assert.equal(await response.text(), 'bounded-webp')
      assert.deepEqual(calls, { bundled: 1, origin: 1, rendered: 1 })
    })
  }
})
