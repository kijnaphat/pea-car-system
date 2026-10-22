import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'
import { createCarSourceReader, MAX_CACHED_IMAGE_BYTES, MAX_SOURCE_BYTES, optimizeImageSource,
  parseCarImageRequest, readBoundedImage, renderCarImage } from '../lib/carImageDelivery.js'

test('valid existing/versioned image paths work; arbitrary variants, duplicate params and traversal do not', () => {
  const root = 'https://example.test/api/car-image?'
  for (const path of ['cars/14/main', 'cars/25/main-1789094576414.webp', 'legacy/75ton.png', 'legacy/truck.png-123.jpg']) {
    assert.deepEqual(parseCarImageRequest(root + new URLSearchParams({ path, variant: 'thumb' })), { path, variant: 'thumb' })
  }
  assert.equal(parseCarImageRequest(root + 'path=legacy/truck.png').variant, 'hero')
  for (const query of ['path=../secret', 'path=cars/1/../main', 'path=https://evil.test/a', 'path=%252e%252e/a',
    'path=cars/1/main&path=cars/2/main', 'path=cars/1/main&variant=huge', 'path=cars/1/main&bust=123',
    'path=cars/1/main&variant=hero&variant=card', 'path=cars/1/main%00']) assert.equal(parseCarImageRequest(root + query), null)
})

test('large originals become bounded WebP cache entries below the Next data-cache limit', async () => {
  const original = await sharp(randomBytes(1024 * 1024 * 3), { raw: { width: 1024, height: 1024, channels: 3 } }).png().toBuffer()
  assert.ok(original.length > 2 * 1024 * 1024, 'fixture must reproduce the old >2 MB cache failure')
  const source = await optimizeImageSource(original)
  assert.ok(Buffer.from(source, 'base64').length <= MAX_CACHED_IMAGE_BYTES)
  assert.ok(Buffer.byteLength(JSON.stringify(source)) < 350000)
  for (const [variant, maxWidth] of [['thumb', 160], ['card', 640], ['hero', 1280]]) {
    const { bytes, etag } = await renderCarImage(source, variant)
    const metadata = await sharp(bytes).metadata()
    assert.equal(metadata.format, 'webp')
    assert.ok(metadata.width <= maxWidth && metadata.height <= maxWidth)
    assert.match(etag, /^"[0-9a-f]{64}"$/)
    assert.equal((await renderCarImage(source, variant)).etag, etag)
  }
})

test('portrait images retain orientation and are bounded on both axes; corrupt originals never pass through', async () => {
  const original = await sharp({ create: { width: 500, height: 2200, channels: 4, background: '#bad8ef' } }).png().toBuffer()
  const result = await sharp(Buffer.from(await optimizeImageSource(original), 'base64')).metadata()
  assert.equal(result.height, 1280)
  assert.ok(result.width < result.height)
  await assert.rejects(optimizeImageSource(Buffer.from('not an image')))
})

test('50 simultaneous variants share one load; hot reads reuse it; project and changed path remain isolated', async () => {
  let reads = 0
  const source = createCarSourceReader(async (project, path) => { reads++; await new Promise(resolve => setTimeout(resolve, 5)); return `${project}:${path}` })
  await Promise.all(Array.from({ length: 50 }, () => source('https://one.supabase.co', 'cars/1/main')))
  assert.equal(reads, 1)
  await source('https://one.supabase.co', 'cars/1/main')
  assert.equal(reads, 1)
  await source('https://two.supabase.co', 'cars/1/main')
  await source('https://one.supabase.co', 'cars/1/main-123.webp')
  assert.equal(reads, 3)
})

test('failed downloads are retried rather than poisoning a permanent cache; hot entries are bounded', async () => {
  let reads = 0
  const source = createCarSourceReader(async () => { if (++reads === 1) throw new Error('offline'); return 'small' }, { maxEntries: 1 })
  await assert.rejects(source('project', 'a'), /offline/)
  assert.equal(await source('project', 'a'), 'small')
  await source('project', 'b'); await source('project', 'a')
  assert.equal(reads, 4)
})

test('upstream byte limits cover declared and chunked bodies, not only trusted content-length', async () => {
  await assert.rejects(readBoundedImage(new Response('x', { headers: { 'content-length': String(MAX_SOURCE_BYTES + 1) } })), /limit/)
  await assert.rejects(readBoundedImage(new Response(new Uint8Array(MAX_SOURCE_BYTES + 1))), /limit/)
  assert.equal((await readBoundedImage(new Response('small'))).toString(), 'small')
})

test('route persists optimized sources across variants, never fetch-caches or serves camera originals', () => {
  const route = readFileSync(new URL('../app/api/car-image/route.js', import.meta.url), 'utf8')
  assert.match(route, /unstable_cache/)
  assert.match(route, /optimizeImageSource\(await readBoundedImage\(response\)\)/)
  assert.match(route, /car-image-optimized-source-v2/)
  assert.match(route, /revalidate: IMAGE_CACHE_SECONDS/)
  assert.match(route, /cache: 'no-store', redirect: 'error'/)
  assert.doesNotMatch(route, /new Response\(original|next: \{ revalidate|service_role|SUPABASE_SERVICE/)
  assert.match(route, /if-none-match/)
})
