// A fixed-key cache for public data only. Concurrent misses share one database read.
export function createSnapshotCache(load, { ttlMs = 30000, now = Date.now } = {}) {
  let cached
  let pending

  return async function read() {
    if (cached && cached.expiresAt > now()) return cached
    if (pending) return pending

    const expiresAt = now() + ttlMs
    pending = Promise.resolve().then(load).then(value => {
      cached = { value, expiresAt }
      return cached
    })
    try {
      return await pending
    } finally {
      pending = undefined
    }
  }
}

export function snapshotCacheHeaders(expiresAt, now = Date.now()) {
  // Subtract time already spent in the function cache; do not stack two full TTLs.
  const seconds = Math.max(0, Math.floor((expiresAt - now) / 1000))
  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'CDN-Cache-Control': seconds ? `public, s-maxage=${seconds}, must-revalidate` : 'no-store',
    'Vercel-CDN-Cache-Control': seconds ? `public, s-maxage=${seconds}, must-revalidate` : 'no-store',
  }
}
