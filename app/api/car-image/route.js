import { unstable_cache } from 'next/cache'
import { CAR_IMAGE_BUCKET, getBundledCarImageUrl, isCarImageStoragePaused } from '@/lib/carImages'
import { IMAGE_CACHE_SECONDS, createCarSourceReader, optimizeImageSource, parseCarImageRequest,
  readBoundedImage, renderCarImage } from '@/lib/carImageDelivery'

export const runtime = 'nodejs'

const persistentSource = unstable_cache(async (projectUrl, imagePath) => {
  const encodedPath = imagePath.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(`${projectUrl}/storage/v1/object/public/${CAR_IMAGE_BUCKET}/${encodedPath}`, {
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) {
    const error = new Error('Image source unavailable')
    error.status = response.status === 404 || response.status === 400 ? 404 : 502
    throw error
  }
  // Persist AFTER resizing: even a 5 MB original produces a <350 KB JSON entry.
  // Shared by all variants and retained across requests/instances/deployments.
  return optimizeImageSource(await readBoundedImage(response))
}, ['car-image-optimized-source-v2'], { revalidate: IMAGE_CACHE_SECONDS })

const readSource = createCarSourceReader(persistentSource)

export async function GET(request) {
  const image = parseCarImageRequest(request.url)
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!image || !projectUrl) return Response.json({ error: 'Invalid image request' }, {
    status: 400, headers: { 'Cache-Control': 'no-store' },
  })
  // Backwards-compatible old URLs no longer depend on cache retention or fetch
  // any Supabase original when this exact project's image has a static copy.
  const bundled = getBundledCarImageUrl(image.path, image.variant, projectUrl)
  if (bundled) return new Response(null, { status: 308, headers: {
    Location: bundled, 'Cache-Control': `public, max-age=${IMAGE_CACHE_SECONDS}, immutable`,
    'X-Car-Image-Delivery': 'bundled-static',
  } })
  // Stop BEFORE consulting either cache or origin. This also protects valid old
  // API links to obsolete/unbundled originals, without breaking existing photos.
  if (isCarImageStoragePaused(projectUrl)) return new Response(null, { status: 307, headers: {
    Location: '/car-placeholder.svg', 'Cache-Control': 'public, max-age=300',
    'X-Car-Image-Delivery': 'local-fallback',
  } })
  try {
    const source = await readSource(projectUrl, image.path)
    const { bytes, etag } = await renderCarImage(source, image.variant)
    const headers = {
      'Content-Type': 'image/webp', ETag: etag,
      'Cache-Control': `public, max-age=${IMAGE_CACHE_SECONDS}, immutable`,
      'CDN-Cache-Control': `public, s-maxage=${IMAGE_CACHE_SECONDS}, stale-while-revalidate=86400`,
      'Vercel-CDN-Cache-Control': `public, s-maxage=${IMAGE_CACHE_SECONDS}, stale-while-revalidate=86400`,
    }
    if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers })
    return new Response(bytes, { headers })
  } catch (error) {
    // Never fall back to serving/caching the multi-megabyte original on errors.
    return Response.json({ error: 'Image temporarily unavailable' }, {
      status: error.status || 502, headers: { 'Cache-Control': 'no-store' },
    })
  }
}
