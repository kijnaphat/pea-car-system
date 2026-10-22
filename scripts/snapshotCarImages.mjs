// Explicit one-off snapshot of already-public, optimized website images.
// Never reads credentials, fetches Supabase originals, modifies DB rows or deletes files.
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { parseCarImageRequest, renderCarImage, MAX_CACHED_IMAGE_BYTES } from '../lib/carImageDelivery.js'

const options = Object.fromEntries(process.argv.slice(2).reduce((pairs, item, i, items) => {
  if (i % 2 === 0) pairs.push([item, items[i + 1]])
  return pairs
}, []))
const site = new URL(options['--base-url'])
const project = new URL(options['--project-url'])
if (site.protocol !== 'https:' || site.hostname !== 'pea-car-system.vercel.app'
  || project.origin !== 'https://qsqshqbnatankvnxjjcy.supabase.co') throw new Error('Unexpected snapshot target')
const rows = JSON.parse(await fs.readFile(options['--input'], 'utf8'))
const output = path.resolve('public/fleet-images')
await fs.mkdir(output, { recursive: true })
const images = {}
let downloadedBytes = 0
let staticBytes = 0
for (const row of rows) {
  const url = new URL('/api/car-image', site)
  url.searchParams.set('path', row.image_path)
  url.searchParams.set('variant', 'hero')
  if (!parseCarImageRequest(url)) throw new Error('Unsafe source path')
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(30000) })
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/webp')) {
    throw new Error(`Optimized image unavailable: ${row.image_path}`)
  }
  const source = Buffer.from(await response.arrayBuffer())
  const metadata = await sharp(source).metadata()
  if (source.length > MAX_CACHED_IMAGE_BYTES || metadata.format !== 'webp'
    || metadata.width > 1280 || metadata.height > 1280) throw new Error('Source not already optimized')
  downloadedBytes += source.length
  const variants = {}
  for (const variant of ['thumb', 'card', 'hero']) {
    const { bytes } = await renderCarImage(source.toString('base64'), variant)
    const hash = createHash('sha256').update(bytes).digest('hex')
    const filename = `${hash}-${variant}.webp`
    const target = path.join(output, filename)
    try { await fs.writeFile(target, bytes, { flag: 'wx' }) } catch (error) {
      if (error.code !== 'EEXIST' || !(await fs.readFile(target)).equals(bytes)) throw error
    }
    variants[variant] = `/fleet-images/${filename}`
    staticBytes += bytes.length
  }
  images[row.image_path] = variants
  console.log(JSON.stringify({ image: row.image_path, downloadedBytes: source.length }))
}
await fs.writeFile(options['--manifest-output'], JSON.stringify({ projectOrigin: project.origin, images }, null, 2) + '\n')
console.log(JSON.stringify({ uniquePhotos: rows.length, downloadedBytes, staticBytes }))
