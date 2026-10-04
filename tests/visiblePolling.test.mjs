import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../lib/visiblePolling.js', import.meta.url), 'utf8')
const { startVisiblePolling } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

function browser(t) {
  let now = 0
  let id = 0
  const timers = new Map()
  const listeners = new Set()
  const originalNow = Date.now
  const originalWindow = globalThis.window
  const originalDocument = globalThis.document
  Date.now = () => now
  globalThis.window = {
    setTimeout: (fn, delay) => { timers.set(++id, { fn, at: now + delay }); return id },
    clearTimeout: key => timers.delete(key),
  }
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  }
  t.after(() => {
    Date.now = originalNow
    globalThis.window = originalWindow
    globalThis.document = originalDocument
  })
  return {
    timers,
    listeners,
    visible(state) {
      document.visibilityState = state ? 'visible' : 'hidden'
      for (const fn of listeners) fn()
    },
    async advance(ms) {
      const end = now + ms
      while (true) {
        const next = [...timers.entries()].filter(([, value]) => value.at <= end)
          .sort((a, b) => a[1].at - b[1].at)[0]
        if (!next) break
        now = next[1].at
        timers.delete(next[0])
        void next[1].fn()
        await Promise.resolve()
        await Promise.resolve()
      }
      now = end
    },
  }
}

test('refreshes each minute, pauses in hidden tabs, and reloads on return', async t => {
  const b = browser(t)
  let reads = 0
  const stop = startVisiblePolling(async () => { reads++ })
  await b.advance(600000)
  assert.equal(reads, 11)
  b.visible(false)
  await b.advance(600000)
  assert.equal(reads, 11)
  b.visible(true)
  await b.advance(0)
  assert.equal(reads, 12)
  stop()
  assert.equal(b.timers.size, 0)
  assert.equal(b.listeners.size, 0)
})

test('does not overlap slow requests or restart after unmount', async t => {
  const b = browser(t)
  let reads = 0
  let finish
  const stop = startVisiblePolling(() => {
    reads++
    return new Promise(resolve => { finish = resolve })
  })
  await b.advance(0)
  await b.advance(180000)
  b.visible(false)
  b.visible(true)
  await b.advance(0)
  assert.equal(reads, 1)
  stop()
  finish()
  await Promise.resolve()
  assert.equal(b.timers.size, 0)
})

test('rapid tab switching does not produce request bursts', async t => {
  const b = browser(t)
  let reads = 0
  const stop = startVisiblePolling(async () => { reads++ })
  await b.advance(0)
  for (let i = 0; i < 10; i++) {
    b.visible(false)
    b.visible(true)
    await b.advance(100)
  }
  assert.equal(reads, 1)
  await b.advance(14000)
  assert.equal(reads, 2)
  stop()
})

test('a page initially opened in the background waits until visible', async t => {
  const b = browser(t)
  b.visible(false)
  let reads = 0
  const stop = startVisiblePolling(async () => { reads++ })
  await b.advance(180000)
  assert.equal(reads, 0)
  b.visible(true)
  await b.advance(0)
  assert.equal(reads, 1)
  stop()
})
