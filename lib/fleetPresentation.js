// Camera-independent lighting for the architectural miniature. No scene/data state.
export function architecturalSun(bounds) {
  const center = [(bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2]
  const offset = [-38, 58, 28]
  const offsetLength = Math.hypot(...offset)
  const direction = offset.map(n => n / offsetLength)
  const length = Math.max(offsetLength, Math.hypot(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, bounds.maxY) * .7 + 20)
  const rightLength = Math.hypot(direction[0], direction[2])
  const right = [direction[2] / rightLength, 0, -direction[0] / rightLength]
  const up = [
    direction[1] * right[2],
    direction[2] * right[0] - direction[0] * right[2],
    -direction[1] * right[0],
  ]
  const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0)
  const corners = [bounds.minX, bounds.maxX].flatMap(x => [bounds.minZ, bounds.maxZ]
    .flatMap(z => [-.6, Math.max(10, bounds.maxY)].map(y => [x - center[0], y, z - center[2]])))
  const horizontal = corners.map(p => dot(p, right)), vertical = corners.map(p => dot(p, up))
  const depths = corners.map(p => length - dot(p, direction))
  return {
    center, position: center.map((n, i) => n + direction[i] * length),
    left: Math.min(...horizontal) - 2, right: Math.max(...horizontal) + 2,
    bottom: Math.min(...vertical) - 2, top: Math.max(...vertical) + 2,
    near: Math.max(.1, Math.min(...depths) - 5), far: Math.max(...depths) + 5,
  }
}
