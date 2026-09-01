import { NextResponse } from 'next/server'
import { CAR_IMAGE_BUCKET } from '@/lib/carImages'

const CACHE_SECONDS = 30 * 24 * 60 * 60

export async function GET(request) {
  const imagePath = request.nextUrl.searchParams.get('path')
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

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      'Content-Type': response.headers.get('content-type') || 'image/jpeg',
      'Cache-Control': `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=86400`,
    },
  })
}
