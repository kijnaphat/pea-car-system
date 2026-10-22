import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MAX_CAR_UPLOAD_BYTES, optimizeCarImage } from '../lib/optimizeCarImage.js'

function browser(t, { bitmap = true, encode = () => new Blob(['small'], { type: 'image/webp' }) } = {}) {
  function setGlobal(name, value) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name)
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value })
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name])
  }
  let closed = 0, decoded = 0, revoked = 0
  const image = { width: 4000, height: 3000, close() { closed++ } }
  t.mock.method(globalThis.URL, 'createObjectURL', () => 'blob:test')
  t.mock.method(globalThis.URL, 'revokeObjectURL', () => { revoked++ })
  setGlobal('createImageBitmap', bitmap ? async () => image : undefined)
  setGlobal('Image', class { constructor() { this.width = 4000; this.height = 3000 } async decode() { decoded++ } })
  const canvas = { width: 0, height: 0,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob(callback, type, quality) { callback(encode(type, quality)) },
  }
  setGlobal('document', { createElement: () => canvas })
  return { canvas, counts: () => ({ closed, decoded, revoked }) }
}

test('new uploads are small real WebP files, preserve filename stem and close bitmap', async t => {
  const mock = browser(t)
  const result = await optimizeCarImage(new File(['camera'], 'car.JPG', { type: 'image/jpeg' }))
  assert.equal(result.type, 'image/webp'); assert.equal(result.name, 'car.webp')
  assert.ok(result.size <= MAX_CAR_UPLOAD_BYTES)
  assert.equal(mock.canvas.width, 1280); assert.equal(mock.canvas.height, 960)
  assert.equal(mock.counts().closed, 1)
})

test('Safari without createImageBitmap uses image decoding instead of uploading the huge original', async t => {
  const mock = browser(t, { bitmap: false })
  const result = await optimizeCarImage(new File([new Uint8Array(3000000)], 'car.jpg', { type: 'image/jpeg' }))
  assert.ok(result.size < 100)
  assert.equal(mock.counts().decoded, 1); assert.equal(mock.counts().revoked, 1)
})

test('unsupported WebP falls back to honest JPEG, never a PNG blob mislabeled WebP', async t => {
  browser(t, { encode: type => new Blob(['small'], { type: type === 'image/webp' ? 'image/png' : 'image/jpeg' }) })
  const result = await optimizeCarImage(new File(['camera'], 'car.png'))
  assert.equal(result.type, 'image/jpeg'); assert.equal(result.name, 'car.jpg')
})

test('failed/oversized conversion refuses upload rather than silently returning the multi-MB file', async t => {
  const mock = browser(t, { encode: type => new Blob([new Uint8Array(MAX_CAR_UPLOAD_BYTES + 1)], { type }) })
  await assert.rejects(optimizeCarImage(new File(['camera'], 'car.jpg')), /ย่อรูปไม่สำเร็จ/)
  assert.equal(mock.counts().closed, 1)
})

test('both regular and legacy uploads optimize, use versioned keys and enforce an upload budget', () => {
  const source = readFileSync(new URL('../app/admin/page.js', import.meta.url), 'utf8')
  assert.match(source, /file.size > MAX_CAR_UPLOAD_BYTES/)
  assert.match(source, /optimizeCarImage\(file\)/)
  assert.match(source, /optimizeCarImage\(new File/)
  assert.doesNotMatch(source, /upsert: true/)
})
