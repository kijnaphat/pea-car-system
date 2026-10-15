// Architectural-scale display meshes. Dimensions deliberately stay inside the
// existing traffic envelope; no model part represents live telemetry.
import {
  BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, ExtrudeGeometry,
  Float32BufferAttribute, Matrix4, MeshBasicMaterial, MeshPhysicalMaterial,
  MeshStandardMaterial, Quaternion, Shape, TorusGeometry, Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

export const VEHICLE_MODEL_KINDS = ['ev', 'pickup', 'van', 'generic', 'bucket', 'crane', 'drill', 'heavy_truck', 'light_truck', 'covered_truck', 'motorcycle']
export const VEHICLE_MODEL_ENVELOPE = { width: 2.05, length: 3.55, height: 3 }
const TRUCKS = new Set(['bucket', 'crane', 'drill', 'heavy_truck', 'light_truck', 'covered_truck'])
const PALETTE = { glass: '#233d49', rubber: '#20272b', metal: '#c3cecf', dark: '#36434a', equipment: '#dfa62b', ivory: '#e7e1cd' }
const safeColor = color => /^#[\da-f]{6}$/i.test(color || '') ? color.toLowerCase() : '#748a9b'

export function vehicleModelIdentity(requestedKind, requestedColor) {
  const kind = VEHICLE_MODEL_KINDS.includes(requestedKind) ? requestedKind : 'generic', color = safeColor(requestedColor)
  return { kind, color, key: `${kind}:${color}` }
}

function makeProfile(points, width, bevel = .025) {
  const shape = new Shape()
  points.forEach(([z, y], n) => n ? shape.lineTo(-z, y) : shape.moveTo(-z, y))
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: width, steps: 1, curveSegments: 1, bevelEnabled: bevel > 0, bevelSegments: 1, bevelSize: bevel, bevelThickness: bevel })
  geometry.rotateY(Math.PI / 2)
  geometry.translate(-width / 2, 0, 0)
  return geometry
}

function makeQuad(points) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap(i => points[i]), 3))
  geometry.computeVertexNormals()
  return geometry
}

function createBuilder(paint) {
  const groups = new Map(), metrics = { parts: 0, wheelCount: 0, axles: [] }
  function add(family, geometry, at = [0, 0, 0], rotation = [0, 0, 0], color) {
    const base = geometry.index ? geometry.toNonIndexed() : geometry
    if (base !== geometry) geometry.dispose()
    for (const name of Object.keys(base.attributes)) if (!['position', 'normal'].includes(name)) base.deleteAttribute(name)
    base.applyMatrix4(new Matrix4().compose(new Vector3(...at), new Quaternion().setFromEuler(new Euler(...rotation)), new Vector3(1, 1, 1)))
    if (!base.getAttribute('normal')) base.computeVertexNormals()
    const tone = new Color(color || (family === 'paint' ? paint : PALETTE[family] || '#a7b1ad'))
    const colors = new Float32Array(base.getAttribute('position').count * 3)
    for (let n = 0; n < colors.length; n += 3) { colors[n] = tone.r; colors[n + 1] = tone.g; colors[n + 2] = tone.b }
    base.setAttribute('color', new Float32BufferAttribute(colors, 3))
    if (!groups.has(family)) groups.set(family, [])
    groups.get(family).push(base)
    metrics.parts++
  }
  const box = (family, at, size, color, rotation) => add(family, new BoxGeometry(...size), at, rotation, color)
  const profile = (family, points, width, color, at, bevel = .025) => add(family, makeProfile(points, width, bevel), at, undefined, color)
  const cylinder = (family, at, radius, length, rotation, color, topRadius = radius, segments = 12) => add(family, new CylinderGeometry(topRadius, radius, length, segments), at, rotation, color)
  const torus = (family, at, radius, tube, rotation, color, arc = Math.PI * 2, segments = 16) => add(family, new TorusGeometry(radius, tube, 5, segments, arc), at, rotation, color)
  const quad = (family, points, color) => add(family, makeQuad(points), undefined, undefined, color)
  const rod = (family, start, end, radius, color) => {
    const a = new Vector3(...start), b = new Vector3(...end), direction = b.clone().sub(a)
    const geometry = new CylinderGeometry(radius, radius, direction.length(), 8)
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()))
    add(family, geometry, a.add(b).multiplyScalar(.5).toArray(), undefined, color)
  }
  const beam = (family, start, end, width, depth, color) => {
    const a = new Vector3(...start), b = new Vector3(...end), direction = b.clone().sub(a)
    const geometry = new BoxGeometry(width, direction.length(), depth)
    geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()))
    add(family, geometry, a.add(b).multiplyScalar(.5).toArray(), undefined, color)
  }
  return { groups, metrics, add, box, profile, cylinder, torus, quad, rod, beam }
}

function wheels(b, axles, { width = 1.35, radius = .275, truck = false } = {}) {
  b.metrics.axles = [...axles]
  for (const z of axles) for (const sign of [-1, 1]) {
    const x = sign * width / 2, y = radius + .025
    b.metrics.wheelCount++
    b.torus('rubber', [x, y, z], radius - .066, .069, [0, Math.PI / 2, 0])
    b.cylinder('rubber', [x, y, z], radius * .83, .17, [0, 0, Math.PI / 2])
    b.cylinder('metal', [x + sign * .09, y, z], radius * .65, .025, [0, 0, Math.PI / 2], '#b6c1c3')
    b.cylinder('dark', [x + sign * .107, y, z], radius * .49, .012, [0, 0, Math.PI / 2], '#334149')
    b.cylinder('metal', [x + sign * .123, y, z], radius * .18, .027, [0, 0, Math.PI / 2], '#d9dfe0')
    for (let n = 0; n < 6; n++) {
      const angle = n * Math.PI / 3
      const spokeY = y + Math.sin(angle) * radius * .34, spokeZ = z + Math.cos(angle) * radius * .34
      b.box('metal', [x + sign * .119, spokeY, spokeZ], [.018, .045, radius * .55], '#cbd3d2', [-angle, 0, 0])
      if (truck) b.cylinder('detail', [x + sign * .143, y + Math.sin(angle) * radius * .23, z + Math.cos(angle) * radius * .23], .014, .012, [0, 0, Math.PI / 2], '#f0e8d6', .014, 5)
    }
    for (let n = 0; n < 14; n++) {
      const angle = n * Math.PI * 2 / 14
      b.box('rubber', [x, y + Math.cos(angle) * (radius - .005), z + Math.sin(angle) * (radius - .005)], [.15, .018, .042], '#30383b', [angle, 0, .12 * sign])
    }
    // Arched liners and painted fender lips remain outside the wheel face.
    b.torus('dark', [sign * (truck ? .755 : .67), y, z], radius + .055, .025, [0, Math.PI / 2, 0], '#35454b', Math.PI)
    b.torus('paint', [sign * (truck ? .77 : .685), y, z], radius + .076, .026, [0, Math.PI / 2, 0], undefined, Math.PI)
  }
}

function mirrors(b, { width = .77, y = 1.02, z = .48, truck = false } = {}) {
  for (const sign of [-1, 1]) {
    b.rod('dark', [sign * (width - .08), y - .06, z], [sign * (width + .04), y, z + .04], .022)
    b.box('paint', [sign * (width + .08), y + .02, z + .04], [truck ? .15 : .13, truck ? .2 : .095, .17])
    b.box('metal', [sign * (width + .08), y + .02, z - .049], [truck ? .12 : .1, truck ? .16 : .065, .012], '#8aa5ad')
  }
}

function lampsAndBumpers(b, { front = 1.54, rear = -1.51, width = 1.32, y = .53, ev = false, truck = false } = {}) {
  b.box('dark', [0, .38, front + .025], [width * .95, .2, .07])
  b.box('metal', [0, .29, front + .035], [width, .065, .08], '#a5b1b5')
  b.box('metal', [0, .31, rear - .025], [width * .96, .075, .065])
  b.box('detail', [0, .41, front + .072], [.3, .095, .009], '#deded1')
  b.box('detail', [0, .4, rear - .066], [.3, .095, .008], '#d8d7c9')
  for (const sign of [-1, 1]) {
    b.box('lights', [sign * width * .34, y, front + .035], [width * .22, .12, .035], '#fff2ce')
    b.box('lights', [sign * width * .4, y + .095, front + .042], [width * .15, .027, .025], '#e2f6f8')
    b.box('lights', [sign * width * .41, .57, rear - .033], [truck ? .17 : .14, .16, .025], '#d55040')
    b.box('lights', [sign * width * .41, .56, rear - .05], [.07, .045, .012], '#eab15b')
    b.box('lights', [sign * (width / 2 + .006), .54, .7], [.012, .055, .1], '#e5b259')
  }
  b.box('dark', [0, y + .02, front + .042], [ev ? .47 : .52, .14, .027])
  for (let n = 0; n < (ev ? 1 : 4); n++) b.box(ev ? 'paint' : 'metal', [0, y - .025 + n * .035, front + .06], [ev ? .4 : .5, .012, .012], ev ? undefined : '#99a8ac')
}

function passenger(b, kind) {
  const ev = kind === 'ev', pickup = kind === 'pickup', van = kind === 'van'
  const length = van ? 3.18 : 3.05, front = length / 2, rear = -length / 2
  b.profile('paint', [[rear, .38], [rear, .66], [rear + .18, .76], [front - .35, .76], [front - .04, .62], [front, .43]], 1.31)
  b.box('dark', [0, .25, -.02], [1.13, .12, length - .3])
  if (van) {
    b.profile('paint', [[-1.48, .67], [-1.44, 1.59], [-1.24, 1.72], [.91, 1.72], [1.45, 1.3], [1.48, .68]], 1.29, undefined, undefined, .035)
    b.quad('glass', [[-.57, 1.3, 1.51], [.57, 1.3, 1.51], [.55, 1.62, 1.095], [-.55, 1.62, 1.095]])
    b.box('glass', [0, 1.3, -1.523], [1.11, .48, .012])
    for (const sign of [-1, 1]) {
      for (let n = 0; n < 4; n++) b.profile('glass', [[-.99 + n * .54, 1.11], [-.99 + n * .54, 1.56], [-.55 + n * .54, 1.56], [-.55 + n * .54, 1.11]], .012, n % 2 ? '#2b4652' : '#3e5c66', [sign * .688, 0, 0], 0)
      b.box('metal', [sign * .69, 1.04, -.08], [.02, .025, 2.46], '#a2afb0')
      b.box('dark', [sign * .692, .89, -.49], [.015, .021, .78])
      b.box('detail', [sign * .696, .94, -.08], [.025, .035, .18], '#c8d3d1')
      b.box('dark', [sign * .694, .63, -.18], [.02, .05, 2.36])
      b.box('dark', [sign * .692, .95, -1.38], [.012, .64, .012])
    }
    b.box('metal', [0, 1.76, -.16], [1.08, .04, 1.8], '#a0aaa7')
    for (const z of [-.85, .55]) b.box('dark', [0, 1.79, z], [1.16, .04, .055])
  } else {
    const cabinRear = pickup ? -.43 : -.83, roofRear = pickup ? -.3 : -.55
    const top = ev ? 1.34 : 1.27, frontRoof = .39, frontBase = .83
    b.profile('paint', [[cabinRear, .7], [roofRear, top - .06], [roofRear + .12, top], [frontRoof, top], [frontBase, .76]], 1.19, undefined, undefined, .025)
    b.quad('glass', [[-.55, .82, .83], [.55, .82, .83], [.53, top - .065, .49], [-.53, top - .065, .49]])
    b.quad('glass', [[.54, .8, cabinRear - .015], [-.54, .8, cabinRear - .015], [-.51, top - .08, roofRear - .055], [.51, top - .08, roofRear - .055]])
    for (const sign of [-1, 1]) {
      const side = sign * .621
      b.profile('glass', [[cabinRear + .08, .84], [roofRear + .08, top - .09], [.34, top - .09], [.65, .84]], .009, '#2d4854', [side, 0, 0], 0)
      b.box('dark', [side + sign * .008, (top + .78) / 2, -.03], [.018, top - .78, .055])
      b.box('metal', [side + sign * .011, .8, .02], [.015, .022, pickup ? .94 : 1.3], '#b7c6c7')
      b.box('detail', [sign * .664, .73, -.28], [.025, .037, .13], '#c7d0ce')
      b.box('dark', [sign * .664, .53, -.05], [.024, .07, 2.42])
      b.box('dark', [sign * .666, .69, -.55], [.012, .16, .009])
    }
    b.box('dark', [0, top + .035, (roofRear + .39) / 2], [ev ? .88 : .91, .02, ev ? .71 : .45], '#334b55')
    for (const sign of [-1, 1]) b.box('metal', [sign * .5, top + .048, (roofRear + .39) / 2], [.022, .025, pickup ? .5 : .87], '#aab7b9')
    if (pickup) {
      b.box('dark', [0, .76, -1.02], [1.13, .025, .77], '#34454d')
      for (const sign of [-1, 1]) b.box('paint', [sign * .61, .87, -1.04], [.105, .29, .92])
      b.box('paint', [0, .87, -1.49], [1.26, .28, .08])
      b.box('metal', [0, 1.01, -1.49], [1.2, .035, .08], '#a4b0b1')
      b.box('dark', [0, .93, -1.538], [.2, .035, .012])
      for (let n = 0; n < 5; n++) b.box('detail', [-.44 + n * .22, .781, -1.02], [.014, .012, .7], '#5c6c72')
      b.rod('metal', [-.51, .8, -.5], [-.51, 1.08, -.62], .035)
      b.rod('metal', [.51, .8, -.5], [.51, 1.08, -.62], .035)
      b.rod('metal', [-.51, 1.08, -.62], [.51, 1.08, -.62], .035)
    } else {
      b.profile('paint', [[-1.47, .71], [-1.33, .84], [cabinRear, .83], [cabinRear, .72]], 1.22)
      b.box('lights', [0, .745, -1.537], [.87, .026, .015], '#b94d43')
    }
    if (ev) {
      b.box('detail', [-.67, .69, -.89], [.015, .13, .18], '#68bed0')
      b.box('metal', [0, .8, 1.12], [.19, .013, .06], '#cbd8d9')
    }
  }
  mirrors(b, { width: van ? .77 : .72, y: van ? 1.27 : 1.02, z: van ? .93 : .5 })
  lampsAndBumpers(b, { front, rear, ev, y: van ? .72 : .55 })
  for (const sign of [-1, 1]) b.rod('dark', [sign * .27, van ? 1.32 : .86, van ? 1.47 : .77], [sign * .06, van ? 1.46 : .96, van ? 1.28 : .66], .012)
  wheels(b, [-1.02, 1.02])
}

function truckCab(b) {
  b.profile('paint', [[.59, .48], [.6, 1.57], [.77, 1.7], [1.28, 1.7], [1.55, 1.39], [1.56, .47]], 1.42, undefined, undefined, .035)
  b.quad('glass', [[-.625, 1.15, 1.615], [.625, 1.15, 1.615], [.6, 1.55, 1.47], [-.6, 1.55, 1.47]])
  for (const sign of [-1, 1]) {
    b.profile('glass', [[.73, 1.09], [.73, 1.54], [1.25, 1.54], [1.43, 1.3], [1.4, 1.09]], .014, '#2f4b56', [sign * .748, 0, 0], 0)
    b.box('dark', [sign * .755, .87, .68], [.015, .44, .012])
    b.box('metal', [sign * .759, .99, .94], [.023, .04, .17], '#c4ccca')
    b.box('metal', [sign * .7, .5, .94], [.19, .08, .77], '#a5b0b1')
    b.box('dark', [sign * .713, 1.73, 1], [.035, .035, .51])
    b.rod('dark', [sign * .3, 1.15, 1.608], [sign * .08, 1.24, 1.574], .012)
  }
  b.box('paint', [0, 1.73, .98], [1.34, .07, .57])
  b.box('dark', [0, .97, 1.592], [.99, .17, .02])
  for (const z of [-.25, .1]) b.box('dark', [0, .28, z], [1.45, .12, .12])
  mirrors(b, { width: .84, y: 1.24, z: 1.22, truck: true })
  lampsAndBumpers(b, { front: 1.63, rear: -1.61, width: 1.47, y: .76, truck: true })
}

function truckBed(b, kind) {
  const equipment = ['bucket', 'crane', 'drill'].includes(kind)
  b.box('paint', [0, .57, -.54], [1.48, .18, 1.98])
  b.box('dark', [0, .69, -.54], [1.3, .055, 1.84])
  for (const sign of [-1, 1]) {
    b.box('metal', [sign * .76, .5, -.59], [.065, .09, 2.06], '#9fadb0')
    b.box('dark', [sign * .7, .32, -.73], [.07, .18, 1.85])
    b.box('dark', [sign * .63, .45, -.09], [.19, .22, .52])
    b.box('metal', [sign * .74, .41, -.08], [.04, .13, .31])
    for (let n = 0; n < 4; n++) b.box('lights', [sign * .797, .54, -.2 - n * .37], [.012, .04, .07], '#e5b158')
  }
  if (!equipment) {
    for (const sign of [-1, 1]) {
      b.box('paint', [sign * .708, .97, -.54], [.08, .6, 1.98])
      b.box('metal', [sign * .756, 1.29, -.54], [.05, .055, 2.02], '#b5c1bf')
      for (let n = 0; n < 5; n++) b.box('metal', [sign * .756, .98, -1.38 + n * .42], [.025, .57, .038], '#a2b0b0')
      for (const y of [.82, 1.08]) b.box('detail', [sign * .754, y, -.54], [.018, .018, 1.92], '#c9d0c8')
    }
    b.box('paint', [0, .98, -1.55], [1.48, .59, .08])
    for (const x of [-.51, .51]) b.box('metal', [x, .8, -1.6], [.12, .08, .035])
  } else {
    for (const sign of [-1, 1]) {
      b.box('detail', [sign * .62, .91, -1.12], [.21, .39, .61], '#c1c4b9')
      b.box('dark', [sign * .735, .93, -1.13], [.025, .04, .17])
      b.box('equipment', [sign * .84, .57, -.83], [.18, .18, .42])
      b.box('metal', [sign * .84, .39, -.83], [.13, .23, .14])
    }
  }
  if (kind === 'covered_truck') {
    b.profile('detail', [[-1.52, 1.26], [-1.52, 1.91], [-1.35, 2.02], [.31, 2.02], [.46, 1.91], [.46, 1.26]], 1.47, '#d5d8ca', undefined, .035)
    for (const sign of [-1, 1]) for (let n = 0; n < 7; n++) b.box('metal', [sign * .763, 1.62, -1.4 + n * .29], [.024, .63, .025], '#adb9b4')
    b.box('dark', [0, 1.57, -1.57], [.012, .56, .015])
  }
}

function equipment(b, kind) {
  if (kind === 'bucket') {
    b.cylinder('dark', [0, .84, -.48], .3, .32)
    b.box('equipment', [0, 1.14, -.48], [.45, .32, .4])
    b.beam('equipment', [0, 1.2, -.4], [0, 1.93, .22], .25, .23)
    b.beam('equipment', [0, 1.93, .22], [0, 2.35, -1.02], .2, .18)
    b.rod('metal', [.14, 1.28, -.32], [.14, 1.79, .1], .038)
    b.rod('metal', [.12, 2.02, .08], [.12, 2.26, -.74], .029)
    for (const [y, z] of [[1.2, -.4], [1.93, .22], [2.35, -1.02]]) b.cylinder('metal', [0, y, z], .15, .3, [0, 0, Math.PI / 2], '#d0d2bf')
    b.box('detail', [0, 2.43, -1.12], [.76, .14, .65], PALETTE.ivory)
    for (const sign of [-1, 1]) {
      b.box('detail', [sign * .345, 2.67, -1.12], [.07, .43, .65], PALETTE.ivory)
      b.box('detail', [0, 2.67, -1.12 + sign * .29], [.76, .43, .07], PALETTE.ivory)
    }
    b.box('dark', [0, 2.515, -1.12], [.57, .02, .45], '#9c9986')
    b.box('equipment', [0, 2.91, -1.12], [.8, .06, .69], '#f3dc9d')
  } else if (kind === 'crane') {
    b.cylinder('dark', [0, .85, -.62], .34, .32)
    b.box('equipment', [0, 1.07, -.62], [.51, .28, .5])
    b.beam('equipment', [0, 1.17, -.68], [0, 1.94, .52], .3, .28)
    b.beam('equipment', [0, 1.94, .52], [0, 2.3, -1.28], .23, .21, '#bc8128')
    b.rod('metal', [.15, 1.28, -.46], [.15, 1.84, .4], .035)
    b.rod('metal', [.12, 2, .35], [.12, 2.26, -1.06], .027)
    for (const [y, z] of [[1.17, -.68], [1.94, .52]]) b.cylinder('metal', [0, y, z], .17, .36, [0, 0, Math.PI / 2])
    b.rod('dark', [0, 2.3, -1.28], [0, 1.65, -1.28], .015)
    b.torus('metal', [0, 1.57, -1.28], .08, .022, [0, 0, 0], '#64747b', Math.PI * 1.6, 10)
    b.box('dark', [0, 1.7, -1.28], [.13, .12, .08])
    for (const z of [-1.27, .15]) b.box('equipment', [0, .53, z], [1.96, .13, .18])
  } else if (kind === 'drill') {
    b.box('equipment', [0, 1.68, -.96], [.32, 2.06, .22], undefined, [.1, 0, 0])
    for (const sign of [-1, 1]) b.rod('metal', [sign * .16, .77, -.87], [sign * .16, 2.65, -1.06], .026)
    b.box('equipment', [0, 2.75, -1.07], [.74, .16, .36])
    b.box('equipment', [0, 1.78, -1.16], [.5, .34, .26])
    b.cylinder('metal', [0, 1.08, -1.18], .057, 1.1)
    for (let n = 0; n < 6; n++) b.torus('dark', [0, .72 + n * .11, -1.18], .1, .023, [Math.PI / 2 + .27, 0, n * .35], '#55666d', Math.PI * 1.7, 10)
    b.box('detail', [0, 1, -.12], [.86, .58, .68], '#b9c3bd')
    for (let n = 0; n < 6; n++) b.box('dark', [-.3 + n * .12, 1.09, .232], [.04, .29, .012])
    b.cylinder('dark', [.42, 1.38, -.18], .075, .43, undefined, '#495a62')
  }
}

function truck(b, kind) {
  b.box('dark', [0, .31, -.01], [1.26, .18, 3.2])
  truckCab(b)
  truckBed(b, kind)
  equipment(b, kind)
  const six = ['bucket', 'crane', 'drill', 'heavy_truck'].includes(kind)
  wheels(b, six ? [1.08, -.53, -1.19] : [1.08, -1.07], { width: 1.53, radius: .3, truck: true })
  if (['bucket', 'crane', 'drill'].includes(kind)) {
    b.cylinder('lights', [-.48, 1.85, .97], .07, .12, undefined, '#f2bd46', .055, 8)
    b.box('dark', [-.48, 1.775, .97], [.18, .025, .18])
  }
}

function motorcycle(b) {
  b.profile('paint', [[-.43, .42], [-.35, .88], [.22, .9], [.52, .65], [.45, .4]], .32, undefined, undefined, .03)
  b.profile('paint', [[.45, .54], [.44, 1.08], [.57, 1.17], [.7, 1.06], [.69, .6]], .3)
  b.box('dark', [0, .93, -.21], [.37, .1, .57])
  b.box('metal', [0, .47, -.09], [.26, .22, .32], '#8d9b9d')
  for (const sign of [-1, 1]) {
    b.rod('metal', [sign * .1, .92, .49], [sign * .1, .3, .66], .032)
    b.rod('metal', [sign * .14, .43, -.15], [sign * .11, .29, -.62], .03)
    b.rod('dark', [sign * .27, 1.11, .46], [sign * .33, 1.27, .46], .018)
    b.box('metal', [sign * .35, 1.29, .46], [.12, .085, .05], '#a8bdc3')
    b.box('dark', [sign * .2, .43, -.04], [.13, .055, .24])
  }
  b.box('dark', [0, 1.1, .47], [.61, .04, .07])
  b.box('lights', [0, 1.01, .711], [.22, .12, .025], '#fff0cf')
  b.box('lights', [0, .83, -.533], [.22, .065, .02], '#ca5148')
  b.cylinder('metal', [.19, .34, -.43], .055, .47, [Math.PI / 2, 0, 0], '#aebbbf')
  b.metrics.axles = [-.65, .65]
  b.metrics.wheelCount = 2
  for (const z of [-.65, .65]) {
    b.torus('rubber', [0, .29, z], .218, .067, [0, Math.PI / 2, 0], undefined, Math.PI * 2, 20)
    b.cylinder('metal', [0, .29, z], .165, .09, [0, 0, Math.PI / 2], '#abbabe')
    b.cylinder('dark', [0, .29, z], .127, .095, [0, 0, Math.PI / 2])
    for (let n = 0; n < 6; n++) b.rod('metal', [-.055, .29, z], [-.055, .29 + Math.sin(n * Math.PI / 3) * .15, z + Math.cos(n * Math.PI / 3) * .15], .012)
  }
}

function materialFor(family) {
  const base = { color: '#ffffff', vertexColors: true }
  if (family === 'paint') return new MeshPhysicalMaterial({ ...base, roughness: .28, metalness: .24, clearcoat: .9, clearcoatRoughness: .17 })
  if (family === 'glass') return new MeshPhysicalMaterial({ ...base, roughness: .12, metalness: .16, clearcoat: 1, clearcoatRoughness: .08 })
  if (family === 'lights') return new MeshBasicMaterial({ ...base, toneMapped: false })
  return new MeshStandardMaterial({ ...base, roughness: family === 'rubber' ? .92 : family === 'metal' ? .3 : .58, metalness: family === 'metal' ? .74 : family === 'rubber' ? 0 : .2 })
}

export function createVehicleModel(requestedKind = 'generic', requestedColor = '#748a9b') {
  const { kind, color } = vehicleModelIdentity(requestedKind, requestedColor)
  const b = createBuilder(color)
  if (kind === 'motorcycle') motorcycle(b)
  else if (TRUCKS.has(kind)) truck(b, kind)
  else passenger(b, kind)
  const batches = []
  for (const [family, parts] of b.groups) {
    const geometry = mergeGeometries(parts, false)
    parts.forEach(part => part.dispose())
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    batches.push({ family, geometry, material: materialFor(family) })
  }
  const bounds = batches[0].geometry.boundingBox.clone()
  for (const batch of batches.slice(1)) bounds.union(batch.geometry.boundingBox)
  const metrics = { ...b.metrics, drawCalls: batches.length, triangles: batches.reduce((sum, batch) => sum + batch.geometry.getAttribute('position').count / 3, 0) }
  let disposed = false
  return { kind, color, batches, bounds, metrics, get disposed() { return disposed }, dispose() {
    if (disposed) return
    disposed = true
    batches.forEach(({ geometry, material }) => { geometry.dispose(); material.dispose() })
  } }
}

// Inactive entries can be discarded, but a live mesh never loses shared GPU data.
// Deferred release survives React StrictMode's setup → cleanup → setup cycle.
export function createVehicleModelCache({ limit = 32, defer = queueMicrotask } = {}) {
  const entries = new Map()
  const remove = entry => { if (entries.get(entry.key) === entry && !entry.users) { entries.delete(entry.key); entry.model.dispose() } }
  return {
    get(kind, color) {
      const { kind: validKind, color: validColor, key } = vehicleModelIdentity(kind, color)
      let entry = entries.get(key)
      if (!entry) {
        entry = { key, model: createVehicleModel(validKind, validColor), users: 0, revision: 0 }
        entries.set(key, entry)
        // React renders all siblings before their layout effects retain them.
        // A synchronous LRU pass here could dispose a car still being mounted.
        if (entries.size > limit) defer(() => {
          for (const candidate of entries.values()) {
            if (entries.size <= limit) break
            if (!candidate.users) remove(candidate)
          }
        })
      }
      entry.revision++
      return entry
    },
    retain(entry) { entry.users++; entry.revision++ },
    release(entry) {
      entry.users = Math.max(0, entry.users - 1)
      const revision = ++entry.revision
      defer(() => { if (!entry.users && entry.revision === revision) remove(entry) })
    },
    clearUnused() { for (const entry of entries.values()) if (!entry.users) remove(entry) },
    get size() { return entries.size },
  }
}
