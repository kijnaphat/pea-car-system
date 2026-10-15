// Shared, offline roof construction. Keep a short positive ridge even when the
// footprint is narrower than the usual hipped-roof inset would allow.
export function hipRoofInset(width, depth) {
  if (!Number.isFinite(width) || width <= .04 || !Number.isFinite(depth) || depth <= 0) {
    throw new RangeError('Roof width must exceed .04 and depth must be positive')
  }
  return Math.min(depth * .45, width / 2 - .02)
}

export function hipRoofMesh(width, depth, rise) {
  const inset = hipRoofInset(width, depth)
  if (!Number.isFinite(rise) || rise <= 0) throw new RangeError('Roof rise must be positive')
  return {
    points: new Float32Array([
      -width / 2, 0, -depth / 2,
      width / 2, 0, -depth / 2,
      width / 2, 0, depth / 2,
      -width / 2, 0, depth / 2,
      -width / 2 + inset, rise, 0,
      width / 2 - inset, rise, 0,
    ]),
    // Both broad planes and the two hipped ends face upward. Ridge endpoints
    // never reverse, so the broad planes cannot acquire back-facing slivers.
    indices: new Uint16Array([0, 4, 1, 1, 4, 5, 3, 2, 4, 2, 5, 4, 0, 3, 4, 1, 5, 2]),
  }
}
