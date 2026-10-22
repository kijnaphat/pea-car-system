// Server-only. Cache the SMALL optimized source: Next rejects >2 MB cache entries.
import sharp from 'sharp'
import { createHash } from 'node:crypto'

export const IMAGE_CACHE_SECONDS = 365 * 24 * 60 * 60
export const MAX_SOURCE_BYTES = 8 * 1024 * 1024
export const MAX_CACHED_IMAGE_BYTES = 256 * 1024
export const CAR_IMAGE_VARIANTS = {
  thumb: { width: 160, quality: 60 },
  card: { width: 640, quality: 68 },
  hero: { width: 1280, quality: 72 },
}

export function parseCarImageRequest(url) {
  const params = new URL(url).searchParams
  if ([...params.keys()].some(key => !['path', 'variant'].includes(key))
    || params.getAll('path').length !== 1 || params.getAll('variant').length > 1) return null
  const path = params.get('path')
  const variant = params.get('variant') || 'hero'
  if (!Object.hasOwn(CAR_IMAGE_VARIANTS, variant) || !path || path.length > 180
    || path.includes('..') || !/^(cars\/[1-9]\d*\/[a-zA-Z0-9_.-]+|legacy\/[a-zA-Z0-9_.-]+)$/.test(path)) return null
  return { path, variant }
}

export async function readBoundedImage(response) {
  if (Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) throw new Error('Image exceeds source limit')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty image response')
  const chunks = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_SOURCE_BYTES) throw new Error('Image exceeds source limit')
      chunks.push(Buffer.from(value))
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally { reader.releaseLock() }
  return Buffer.concat(chunks)
}

export async function optimizeImageSource(original) {
  for (const [width, quality] of [[1280, 72], [960, 64], [640, 58]]) {
    const bytes = await sharp(original, { limitInputPixels: 40000000, animated: false })
      .rotate().resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .webp({ quality, effort: 4 }).toBuffer()
    if (bytes.length <= MAX_CACHED_IMAGE_BYTES) return bytes.toString('base64')
  }
  throw new Error('Unable to produce a bounded cached image')
}

// Concurrent variants share one persistent-cache lookup/origin download. Bounded,
// tenant-scoped hot cache; failures are not retained and can recover.
export function createCarSourceReader(load, { maxEntries = 64 } = {}) {
  const values = new Map()
  const pending = new Map()
  return async (projectUrl, imagePath) => {
    const key = JSON.stringify([projectUrl, imagePath])
    if (values.has(key)) {
      const value = values.get(key)
      values.delete(key); values.set(key, value)
      return value
    }
    if (pending.has(key)) return pending.get(key)
    const promise = Promise.resolve().then(() => load(projectUrl, imagePath)).then(value => {
      values.set(key, value)
      while (values.size > maxEntries) values.delete(values.keys().next().value)
      return value
    })
    pending.set(key, promise)
    try { return await promise } finally { pending.delete(key) }
  }
}

export async function renderCarImage(sourceBase64, variant) {
  const source = Buffer.from(sourceBase64, 'base64')
  const config = CAR_IMAGE_VARIANTS[variant]
  if (!config) throw new Error('Unsupported image variant')
  const bytes = variant === 'hero' ? source : await sharp(source)
    .resize({ width: config.width, height: config.width, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: config.quality, effort: 4 }).toBuffer()
  return { bytes, etag: `"${createHash('sha256').update(bytes).digest('hex')}"` }
}
