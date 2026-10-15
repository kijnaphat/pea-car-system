// Offline architectural detail, in the existing illustrative campus units.
// No external models, textures, GPS, telemetry or business-state changes.
export const ARCHITECTURE = {
  wall: '#eee9dc', stone: '#c6c2b3', frame: '#f4efe3', steel: '#43575c',
  glass: '#456975', roof: '#6e7e83', bronze: '#aa9470', timber: '#a68a65',
  shadow: '#66787b', solar: '#2f5363', paving: '#d7d2c3', road: '#536064',
  grass: '#a4af87', foliage: ['#728765', '#819273', '#637b60', '#91a17d', '#6f855f'],
  sky: '#e8eef0', floorHeight: 1.65,
}

const part = (at, size, color, rotation) => ({ at, size, color, ...(rotation ? { rotation } : {}) })

export function facadeParts({ width, depth, floors }) {
  const frames = [], glass = [], trim = [], shading = [], reflections = []
  const faces = [
    { length: depth, horizontal: false, sign: -1 }, { length: depth, horizontal: false, sign: 1 },
    { length: width, horizontal: true, sign: -1 }, { length: width, horizontal: true, sign: 1 },
  ]
  faces.forEach(({ length, horizontal, sign }) => {
    const bays = Math.max(2, Math.floor(length / 1.85)), step = length / bays
    for (let floor = 0; floor < floors; floor++) {
      const y = 1 + floor * ARCHITECTURE.floorHeight
      for (let bay = 0; bay < bays; bay++) {
        const along = -length / 2 + step * (bay + .5), pane = step * .72
        const position = offset => horizontal ? [along, y, sign * (depth / 2 + offset)] : [sign * (width / 2 + offset), y, along]
        const size = (span, height, thickness) => horizontal ? [span, height, thickness] : [thickness, height, span]
        frames.push(part(position(.055), size(pane + .18, 1.24, .11), ARCHITECTURE.shadow))
        glass.push(part(position(.12), size(pane, 1.04, .035), (floor + bay) % 4 === 0 ? '#577e88' : ARCHITECTURE.glass))
        trim.push(part(position(.155), size(.035, 1.08, .035), ARCHITECTURE.frame))
        const transom = position(.155); transom[1] += .24
        trim.push(part(transom, size(pane, .035, .035), ARCHITECTURE.steel))
        const sill = position(.18); sill[1] -= .63
        trim.push(part(sill, size(pane + .32, .065, .36), ARCHITECTURE.stone))
        // Physical lintels and deep vertical fins make this a miniature building,
        // not window stickers. Every piece stays inside the existing apron.
        const lintel = position(.24); lintel[1] += .63
        shading.push(part(lintel, size(pane + .35, .075, .46), ARCHITECTURE.frame))
        const fin = position(.22)
        if (horizontal) fin[0] -= step * .43
        else fin[2] -= step * .43
        shading.push(part(fin, size(.085, 1.42, .4), floor === 0 ? ARCHITECTURE.bronze : ARCHITECTURE.frame))
        const reflection = position(.142)
        if (horizontal) reflection[0] += pane * .3
        else reflection[2] += pane * .3
        reflections.push(part(reflection, size(pane * .12, .98, .006), '#7d9ca2'))
        if (floors > 2 && floor > 0 && bay % 3 === 0) {
          // Champagne screens articulate the tall office without changing its mass.
          for (let n = 0; n < 3; n++) {
            const blade = position(.36)
            if (horizontal) blade[0] += (n - 1) * pane * .27
            else blade[2] += (n - 1) * pane * .27
            shading.push(part(blade, size(.035, 1.24, .14), ARCHITECTURE.bronze))
          }
        }
      }
    }
  })
  return { frames, glass, trim, shading, reflections }
}

// Rooftop details use one box batch per material family, not one React mesh per
// solar cell. Heights are relative to the existing top slab; footprints do not grow.
export function officeRoofParts({ width, depth }) {
  const stone = [], metal = [], solar = [], glass = []
  for (const sign of [-1, 1]) {
    stone.push(part([sign * width / 2, .2, 0], [.13, .4, depth + .3], ARCHITECTURE.frame))
    stone.push(part([0, .2, sign * depth / 2], [width + .3, .4, .13], ARCHITECTURE.frame))
    metal.push(part([sign * width / 2, .42, 0], [.21, .045, depth + .4], ARCHITECTURE.steel))
    metal.push(part([0, .42, sign * depth / 2], [width + .4, .045, .21], ARCHITECTURE.steel))
  }
  // A clear service spine separates two banks of accurately gridded PV modules.
  const rows = Math.max(1, Math.floor((depth - 3) / 2.25))
  for (let row = 0; row < rows; row++) for (const sign of [-1, 1]) {
    const x = sign * width * .285, z = (row - (rows - 1) / 2) * 2.25
    metal.push(part([x, .17, z], [2.15, .08, 1.9], ARCHITECTURE.steel, [-.09, 0, 0]))
    solar.push(part([x, .225, z], [2.04, .035, 1.79], ARCHITECTURE.solar, [-.09, 0, 0]))
    for (const line of [-.5, 0, .5]) glass.push(part([x + line, .258, z], [.015, .012, 1.76], '#90aeb8', [-.09, 0, 0]))
    for (const line of [-.43, .43]) glass.push(part([x, .26 - line * .09, z + line], [2.02, .012, .015], '#90aeb8'))
  }
  stone.push(part([0, .33, -depth / 2 + 1.35], [1.15, .66, 1.6], ARCHITECTURE.wall))
  for (const z of [-depth / 2 + 1.35, depth / 2 - 1.35]) {
    metal.push(part([0, .18, z], [.85, .36, .85], '#9aa6a5'))
    for (let n = 0; n < 5; n++) metal.push(part([-.3 + n * .15, .385, z], [.045, .03, .7], ARCHITECTURE.steel))
  }
  for (let n = 0; n <= Math.ceil(depth / 1.1); n++) stone.push(part([0, .025, -depth / 2 + n * 1.1], [.55, .018, .018], '#b7baaf'))
  return { stone, metal, solar, glass }
}

export function pitchedRoofParts(width, depth, rise = .65) {
  const parts = [], slope = Math.atan2(rise, depth / 2)
  parts.push(part([0, rise + .025, 0], [Math.max(.1, width - depth * .9), .065, .11], ARCHITECTURE.steel))
  for (let x = -width / 2 + .45; x < width / 2 - .3; x += .58) {
    // The hipped end planes get short seams; the long centre gets full ones.
    const end = Math.max(0, Math.abs(x) - (width - depth * .9) / 2)
    const span = Math.max(.15, depth / 2 - end / .9), peak = span * Math.tan(slope)
    for (const sign of [-1, 1]) parts.push(part([x, peak / 2 + .02, sign * (depth / 2 - span / 2)], [.025, .025, span / Math.cos(slope)], '#9ba7a4', [sign * slope, 0, 0]))
  }
  for (const sign of [-1, 1]) {
    parts.push(part([0, -.02, sign * depth / 2], [width, .1, .1], ARCHITECTURE.steel))
    parts.push(part([sign * width / 2, -.02, 0], [.1, .1, depth], ARCHITECTURE.steel))
  }
  return parts
}

export function ancillaryEntranceParts({ depth, floors }) {
  const doorHeight = Math.min(1.85, floors * ARCHITECTURE.floorHeight - .3)
  const center = .3 + doorHeight / 2
  const parts = [part([0, center, depth / 2 + .18], [1.15, doorHeight, .04], ARCHITECTURE.glass)]
  for (const sign of [-1, 1]) parts.push(part([sign * .61, center, depth / 2 + .21], [.065, doorHeight + .15, .075], ARCHITECTURE.bronze))
  parts.push(part([0, doorHeight + .4, depth / 2 + .25], [1.5, .07, .56], ARCHITECTURE.frame))
  parts.push(part([0, .23, depth / 2 + .31], [1.65, .14, .6], ARCHITECTURE.stone))
  parts.push(part([0, center, depth / 2 + .22], [.03, doorHeight - .05, .04], ARCHITECTURE.frame))
  return parts
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
  // A slim, continuous fascia and rainwater channels give the glass canopy a
  // legible architectural edge while keeping its existing clear headroom.
  for (const z of [-depth / 2, depth / 2]) {
    parts.push(part([0, height + .075, z], [width + .16, .16, .12], ARCHITECTURE.steel))
    parts.push(part([0, height + .17, z], [width + .16, .035, .18], ARCHITECTURE.frame))
  }
  for (const x of [-width / 2, width / 2]) parts.push(part([x, height + .15, 0], [.1, .12, depth], ARCHITECTURE.steel))
  for (const x of [-width / 2 + .35, width / 2 - .35]) parts.push(part([x, height / 2, depth / 2 - .2], [.045, height, .045], ARCHITECTURE.bronze))
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
