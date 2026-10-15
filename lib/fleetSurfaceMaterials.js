// Small deterministic material swatches generated locally, not downloaded maps.
// Texture dimensions stay bounded independently of the number of cars.
export function surfaceSwatch(kind = 'stone', size = 128) {
  if (!Number.isInteger(size) || size < 8 || size > 256) throw new RangeError('Material swatch must be 8–256 pixels')
  const pixels = new Uint8Array(size * size * 4)
  let seed = kind === 'asphalt' ? 39417 : 92113
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const grain = (seed >>> 24) / 255
    const seam = kind !== 'asphalt' && (x % (size / 4) < 1 || y % (size / 4) < 1)
    const value = Math.round(kind === 'asphalt' ? 233 + grain * 22 : seam ? 215 : 239 + grain * 16)
    const at = (y * size + x) * 4
    pixels[at] = value; pixels[at + 1] = value; pixels[at + 2] = value; pixels[at + 3] = 255
  }
  return pixels
}

export function curbJoints(rings, spacing = 1.8) {
  const parts = []
  for (const ring of rings) {
    let distance = 0, next = spacing
    for (let i = 1; i < ring.length; i++) {
      const [ax, az] = ring[i - 1], [bx, bz] = ring[i], dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz)
      if (!length) continue
      while (next < distance + length && parts.length < 1000) {
        const t = (next - distance) / length
        parts.push({ at: [ax + dx * t, .169, az + dz * t], size: [.018, .012, .18], rotation: [0, -Math.atan2(dz, dx), 0], color: '#b3b2a4' })
        next += spacing
      }
      distance += length
    }
  }
  return parts
}

// Raised kerbs stop at parking forecourts. Only a flush painted edge continues
// through those driveways, so cars never appear to climb a concrete obstacle.
export function raisedCurbRuns(ring, cutouts = []) {
  const runs = []
  let current = []
  const finish = () => { if (current.length > 1) runs.push(current); current = [] }
  const blocked = ([x, z]) => cutouts.some(c => x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ)
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .45))
    for (let n = 0; n < count; n++) {
      const from = [a[0] + (b[0] - a[0]) * n / count, a[1] + (b[1] - a[1]) * n / count]
      const to = [a[0] + (b[0] - a[0]) * (n + 1) / count, a[1] + (b[1] - a[1]) * (n + 1) / count]
      if (blocked(from) || blocked(to)) finish()
      else { if (!current.length) current.push(from); current.push(to) }
    }
  }
  finish()
  return runs
}
