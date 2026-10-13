// Offline architectural detail, in the existing illustrative campus units.
// No external models, textures, GPS, telemetry or business-state changes.
export const ARCHITECTURE = {
  wall: '#e7e4db', stone: '#c7c7bc', frame: '#d8dcd8', steel: '#566b70',
  glass: '#4f737d', roof: '#86949a', paving: '#d8d7c9', road: '#69777a',
  grass: '#afb891', foliage: ['#728765', '#819273', '#637b60', '#91a17d', '#6f855f'],
  sky: '#d5e5ec', floorHeight: 1.65,
}

const part = (at, size, color, rotation) => ({ at, size, color, ...(rotation ? { rotation } : {}) })

export function facadeParts({ width, depth, floors }) {
  const frames = [], glass = [], trim = []
  const faces = [
    { length: depth, horizontal: false, sign: -1 }, { length: depth, horizontal: false, sign: 1 },
    { length: width, horizontal: true, sign: -1 }, { length: width, horizontal: true, sign: 1 },
  ]
  faces.forEach(({ length, horizontal, sign }) => {
    const bays = Math.max(2, Math.floor(length / 1.85)), step = length / bays
    for (let floor = 0; floor < floors; floor++) {
      const y = 1 + floor * ARCHITECTURE.floorHeight
      for (let bay = 0; bay < bays; bay++) {
        const along = -length / 2 + step * (bay + .5), pane = step * .64
        const position = offset => horizontal ? [along, y, sign * (depth / 2 + offset)] : [sign * (width / 2 + offset), y, along]
        const size = (span, height, thickness) => horizontal ? [span, height, thickness] : [thickness, height, span]
        frames.push(part(position(.055), size(pane + .16, 1.16, .11), ARCHITECTURE.frame))
        glass.push(part(position(.12), size(pane, .95, .035), ARCHITECTURE.glass))
        trim.push(part(position(.15), size(.035, .99, .03), ARCHITECTURE.steel))
        const sill = position(.15); sill[1] -= .59
        trim.push(part(sill, size(pane + .3, .065, .3), ARCHITECTURE.stone))
        // Narrow fins create real light/shadow instead of a painted window decal.
        const fin = position(.12)
        if (horizontal) fin[0] -= step * .43
        else fin[2] -= step * .43
        trim.push(part(fin, size(.085, 1.4, .22), ARCHITECTURE.wall))
      }
    }
  })
  return { frames, glass, trim }
}

export function canopyStructure(width, depth, height = 3.5) {
  const parts = []
  for (const x of [-width / 2 + .35, -width / 6, width / 6, width / 2 - .35]) {
    for (const z of [-depth / 2 + .3, depth / 2 - .3]) {
      parts.push(part([x, height / 2, z], [.12, height, .12], ARCHITECTURE.steel))
      parts.push(part([x, .08, z], [.38, .16, .38], ARCHITECTURE.stone))
    }
  }
  for (const z of [-depth / 2 + .3, depth / 2 - .3]) {
    parts.push(part([0, height, z], [width, .18, .12], ARCHITECTURE.steel))
    parts.push(part([0, height - .38, z], [width, .1, .1], ARCHITECTURE.frame))
    const steps = Math.ceil(width / 1.5), span = width / steps
    for (let n = 0; n < steps; n++) {
      parts.push(part([-width / 2 + span * (n + .5), height - .2, z], [Math.hypot(span, .36), .055, .055], ARCHITECTURE.steel, [0, 0, (n % 2 ? -1 : 1) * Math.atan2(.36, span)]))
    }
  }
  return parts
}

export function treeCrown(small = false, tone = 0) {
  const r = small ? .59 : .84, y = small ? 1.8 : 2.55
  return [
    part([0, y, 0], [r, r * 1.22, r], ARCHITECTURE.foliage[tone % 5]),
    part([-.32 * r, y + r * .4, .16 * r], [r * .72, r * .84, r * .74], ARCHITECTURE.foliage[(tone + 1) % 5]),
    part([.4 * r, y - r * .12, -.2 * r], [r * .71, r * .84, r * .7], ARCHITECTURE.foliage[(tone + 2) % 5]),
    part([-.25 * r, y - r * .32, -.28 * r], [r * .7, r * .74, r * .71], ARCHITECTURE.foliage[(tone + 3) % 5]),
  ]
}
