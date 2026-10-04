import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

async function moduleAt(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8')
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
}
const { createSnapshotCache, snapshotCacheHeaders } = await moduleAt('../lib/fleetSnapshotCache.js')
const { loadFleetSnapshot } = await moduleAt('../lib/fleetSnapshot.js')
const payload = { carsDataRaw: [{ id: 1 }], activeLogs: [], latestLogs: [], maintenanceRecords: [] }

test('100 simultaneous visitors and repeated reads share one database request per 30 seconds', async () => {
  let now = 0
  let reads = 0
  const read = createSnapshotCache(async () => { reads++; return payload }, { now: () => now })
  const results = await Promise.all(Array.from({ length: 100 }, read))
  assert.equal(reads, 1)
  assert.ok(results.every(result => result.value === payload))
  now = 29999
  await read()
  assert.equal(reads, 1)
  now = 30000
  await Promise.all(Array.from({ length: 100 }, read))
  assert.equal(reads, 2)
})

test('failed reads are not cached and can recover without serving stale success', async () => {
  let now = 0
  let reads = 0
  let fail = false
  const read = createSnapshotCache(async () => {
    reads++
    if (fail) throw new Error('unavailable')
    return payload
  }, { now: () => now })
  await read()
  now = 30000
  fail = true
  await assert.rejects(read(), /unavailable/)
  fail = false
  await read()
  assert.equal(reads, 3)
})

test('CDN TTL subtracts function cache age rather than stacking TTLs', () => {
  assert.equal(snapshotCacheHeaders(30000, 0)['Vercel-CDN-Cache-Control'], 'public, s-maxage=30, must-revalidate')
  assert.equal(snapshotCacheHeaders(30000, 20000)['Vercel-CDN-Cache-Control'], 'public, s-maxage=10, must-revalidate')
  assert.equal(snapshotCacheHeaders(30000, 30000)['Vercel-CDN-Cache-Control'], 'no-store')
  assert.equal(snapshotCacheHeaders(30000, 0)['Cache-Control'], 'public, max-age=0, must-revalidate')
})

test('ordinary polling uses shared endpoint and does not fall back to uncached Supabase on errors', async () => {
  let freshReads = 0
  const options = {
    loadFresh: () => { freshReads++; return payload },
    fetchSnapshot: async () => ({ ok: true, json: async () => payload }),
  }
  assert.deepEqual(await loadFleetSnapshot(options), payload)
  await assert.rejects(loadFleetSnapshot({ ...options, fetchSnapshot: async () => ({ ok: false }) }))
  assert.equal(freshReads, 0)
})

function storage(marker) {
  return {
    getItem: () => marker,
    setItem: (_, value) => { marker = value },
    removeItem: () => { marker = null },
  }
}

test('successful mutation triggers exactly one fresh read after navigation', async () => {
  const s = storage('1000')
  let freshReads = 0
  let sharedReads = 0
  const options = {
    storage: s, now: 2000,
    loadFresh: async () => { freshReads++; return payload },
    fetchSnapshot: async () => { sharedReads++; return { ok: true, json: async () => payload } },
  }
  await loadFleetSnapshot(options)
  assert.equal(s.getItem(), null)
  await loadFleetSnapshot(options)
  assert.equal(freshReads, 1)
  assert.equal(sharedReads, 1)
})

test('failed or incomplete fresh reads retain mutation marker for retry', async () => {
  const s = storage('1000')
  const options = { storage: s, now: 2000 }
  await assert.rejects(loadFleetSnapshot({ ...options, loadFresh: async () => { throw new Error('offline') } }))
  assert.equal(s.getItem(), '1000')
  await assert.rejects(loadFleetSnapshot({ ...options, loadFresh: async () => ({}) }))
  assert.equal(s.getItem(), '1000')
})

test('expired markers use cache and a newer mutation marker is not discarded', async () => {
  const s = storage('1000')
  let freshReads = 0
  await loadFleetSnapshot({ storage: s, now: 121000,
    loadFresh: async () => { freshReads++; return payload },
    fetchSnapshot: async () => ({ ok: true, json: async () => payload }),
  })
  assert.equal(freshReads, 0)
  assert.equal(s.getItem(), null)
  s.setItem('', '130000')
  await loadFleetSnapshot({ storage: s, now: 130001,
    loadFresh: async () => { s.setItem('', '130002'); return payload },
  })
  assert.equal(s.getItem(), '130002')
})
