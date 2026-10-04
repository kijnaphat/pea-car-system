// Schedule the next read after the previous one finishes. Hidden tabs make no reads.
export function startVisiblePolling(refresh, intervalMs = 60000) {
  let stopped = false
  let running = false
  let timer
  let lastStartedAt = null

  const schedule = delay => {
    window.clearTimeout(timer)
    if (!stopped && document.visibilityState === 'visible') {
      timer = window.setTimeout(run, delay)
    }
  }

  const run = async () => {
    if (stopped || running || document.visibilityState !== 'visible') return
    running = true
    lastStartedAt = Date.now()
    try {
      await refresh()
    } catch (error) {
      console.error('Background refresh failed:', error)
    } finally {
      running = false
      schedule(intervalMs)
    }
  }

  const onVisibilityChange = () => {
    window.clearTimeout(timer)
    if (document.visibilityState === 'visible' && !running) {
      // Refresh on return, but avoid bursts from rapidly switching tabs.
      const remaining = lastStartedAt === null ? 0 : Math.max(0, 15000 - (Date.now() - lastStartedAt))
      schedule(remaining)
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  schedule(0)
  return () => {
    stopped = true
    window.clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}
