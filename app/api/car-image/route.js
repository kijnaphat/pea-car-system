import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { CAR_IMAGE_BUCKET } from '@/lib/carImages'

const CACHE_SECONDS = 30 * 24 * 60 * 60
const STALE_SECONDS = 24 * 60 * 60

const IMAGE_VARIANTS = {
  thumb: { width: 160, quality: 62 },
  card: { width: 640, quality: 70 },
  hero: { width: 1280, quality: 74 },
}

export const runtime = 'nodejs'

function imageHeaders(contentType = 'image/webp') {
  const browserCache = `public, max-age=${CACHE_SECONDS}, immutable`
  const edgeCache = `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${STALE_SECONDS}`

  return {
    'Content-Type': contentType,
    'Cache-Control': browserCache,
    'CDN-Cache-Control': edgeCache,
    'Vercel-CDN-Cache-Control': edgeCache,
  }
}

export async function GET(request) {
  const imagePath = request.nextUrl.searchParams.get('path')
  const variantName = request.nextUrl.searchParams.get('variant') || 'hero'
  const variant = IMAGE_VARIANTS[variantName] || IMAGE_VARIANTS.hero
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!imagePath || !supabaseUrl || imagePath.includes('..')) {
    return NextResponse.json({ error: 'Invalid image path' }, { status: 400 })
  }

  const encodedPath = imagePath.split('/').map(encodeURIComponent).join('/')
  const sourceUrl = `${supabaseUrl}/storage/v1/object/public/${CAR_IMAGE_BUCKET}/${encodedPath}`
  const response = await fetch(sourceUrl, { next: { revalidate: CACHE_SECONDS } })

  if (!response.ok) {
    return NextResponse.json({ error: 'Image not found' }, { status: response.status })
  }

  const originalImage = Buffer.from(await response.arrayBuffer())

  try {
    const optimizedImage = await sharp(originalImage)
      .rotate()
      .resize({
        width: variant.width,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: variant.quality, effort: 4 })
      .toBuffer()

    return new NextResponse(optimizedImage, { headers: imageHeaders() })
  } catch {
    return new NextResponse(originalImage, {
      headers: imageHeaders(response.headers.get('content-type') || 'image/jpeg'),
    })
  }
}
