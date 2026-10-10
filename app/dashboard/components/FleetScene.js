'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import { CatmullRomCurve3, Vector3 } from 'three'
import { FLEET_STATUSES } from '@/lib/fleetDigitalTwin'

function Block({ at = [0, 0, 0], size, color = '#fff', ...props }) {
  return <mesh position={at} castShadow receiveShadow {...props}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.9} flatShading /></mesh>
}

const Tree = memo(function Tree({ x, z, small = false }) {
  return <group position={[x, 0, z]}>
    <mesh position={[0, .7, 0]} castShadow><cylinderGeometry args={[.12, .16, 1.4, 6]} /><meshStandardMaterial color="#bd9a76" /></mesh>
    <mesh position={[0, small ? 1.45 : 2, 0]} castShadow><icosahedronGeometry args={[small ? .7 : 1.05, 1]} /><meshStandardMaterial color="#85dba7" flatShading /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .025, 0]}><circleGeometry args={[.8, 16]} /><meshBasicMaterial color="#c2d8cc" /></mesh>
  </group>
})

const Office = memo(function Office() {
  return <group>
    <Block at={[-4, .12, -8]} size={[16, .24, 9]} color="#e2e8ef" />
    <Block at={[-5, 2.1, -8]} size={[12, 4.2, 6.8]} color="#fafcff" />
    <Block at={[3.5, 1.5, -7.5]} size={[4.8, 3, 5.8]} color="#eef3f8" />
    <Block at={[-5, 4.25, -8]} size={[12.5, .28, 7.3]} color="#e0e5ef" />
    <Block at={[3.5, 3.1, -7.5]} size={[5.2, .25, 6.2]} color="#dce4ee" />
    <Block at={[-5, 4.48, -8]} size={[9, .2, 4.4]} color="#ecf0f7" />
    {[0, 1].flatMap(row => Array.from({ length: 8 }, (_, col) => <Block key={`${row}-${col}`} at={[-10 + col * 1.45, 1.1 + row * 1.7, -4.54]} size={[.78, 1, .06]} color="#b9dbee" />))}
    {[0, 1, 2].map(n => <Block key={n} at={[5.93, 1.4, -9.1 + n * 1.5]} size={[.06, 1.2, .85]} color="#b9dbee" />)}
    <Block at={[-3.8, 1, -4.47]} size={[1.2, 2, .1]} color="#8fb5d5" />
    <Block at={[-3.8, 2.65, -3.7]} size={[3.4, .18, 1.8]} color="#f2f5fc" />
    <Block at={[-3.8, .15, -3.5]} size={[3.4, .3, 1.5]} color="#dae1ec" />
    <Block at={[-7, 4.5, -8.5]} size={[3, .12, 2.2]} color="#7987bd" />
    <Block at={[-14, .1, -7.2]} size={[3, .2, 5]} color="#d1eddf" />
    <Block at={[-14, 1.2, -9]} size={[2.7, 2.4, 1.8]} color="#e5dcfa" />
    <Block at={[-14, 2.5, -9]} size={[3, .2, 2.1]} color="#ba9be3" />
    <Block at={[-14, 1.2, -7.99]} size={[1.4, 1.2, .1]} color="#b6d8ec" />
  </group>
})

function Canopy() {
  return <group position={[12.5, 0, -6]}>
    {[-2.2, 2.2].flatMap(x => [-1.5, 1.5].map(z => <Block key={`${x}-${z}`} at={[x, 1.6, z]} size={[.13, 3.2, .13]} color="#a6b7c5" />))}
    <Block at={[0, 3.22, 0]} size={[5.5, .12, 4.2]} color="#709ad1" />
    {Array.from({ length: 5 }, (_, n) => <Block key={n} at={[-2.1 + n * 1.05, 3.3, 0]} size={[.04, .025, 4.1]} color="#c5daf4" />)}
    {[0, 1].map(n => <group key={n} position={[-1.5 + n * 3, 0, -1]}><Block at={[0, .7, 0]} size={[.5, 1.4, .5]} color="#327cda" /><Block at={[0, 1, .28]} size={[.32, .35, .02]} color="#aef5f5" /></group>)}
  </group>
}

function Gate({ end }) {
  return <group position={[2, 0, end]}>
    <Block at={[4, 1.05, -1]} size={[2.7, 2.1, 2.6]} color="#fff" />
    <Block at={[4, 2.2, -1]} size={[3, .25, 3]} color="#acbfcf" />
    <Block at={[4, 1.2, .32]} size={[1.8, .9, .05]} color="#b6dbee" />
    <Block at={[-2.2, .65, 0]} size={[.4, 1.3, .4]} color="#e9b655" />
    <Block at={[.2, 1.3, 0]} size={[4.5, .16, .2]} color="#f5f6fd" />
    {[-1, 0, 1, 2].map(n => <Block key={n} at={[n, 1.31, .01]} size={[.32, .18, .21]} color="#9b68d5" />)}
  </group>
}

function Person({ x, z }) {
  return <group position={[x, 0, z]}>
    <Block at={[0, .65, 0]} size={[.25, .65, .22]} color="#52bca6" />
    <mesh position={[0, 1.1, 0]}><sphereGeometry args={[.17, 8, 6]} /><meshStandardMaterial color="#edc6a3" /></mesh>
    <Block at={[-.08, .18, 0]} size={[.09, .4, .12]} color="#667994" /><Block at={[.08, .18, 0]} size={[.09, .4, .12]} color="#667994" />
  </group>
}

export const MiniCar = memo(function MiniCar({ color = '#fff' }) {
  return <group>
    <Block at={[0, .42, 0]} size={[1.25, .4, 2.5]} color={color} />
    <Block at={[0, .77, -.2]} size={[1.15, .48, 1.2]} color={color} />
    <Block at={[0, .82, .42]} size={[1.01, .32, .025]} color="#35485d" />
    <Block at={[0, .82, -.82]} size={[1.01, .29, .025]} color="#35485d" />
    {[-1, 1].map(sign => <group key={sign}>
      <Block at={[sign * .59, .82, -.2]} size={[.026, .3, 1.02]} color="#40566c" />
      <Block at={[sign * .63, .43, .12]} size={[.025, .13, 1.9]} color="#8446bf" />
      {[-.78, .78].map(z => <mesh key={z} position={[sign * .63, .27, z]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[.25, .25, .16, 12]} /><meshStandardMaterial color="#263442" roughness={1} /></mesh>)}
    </group>)}
    <Block at={[0, .44, 1.27]} size={[.8, .16, .025]} color="#d9e7f3" />
  </group>
})

function route(parking, end, direction) {
  const p = [new Vector3(parking.x, 0, parking.z), new Vector3(parking.x, 0, parking.z + 2.3),
    new Vector3(2, 0, parking.z + 2.3), new Vector3(2, 0, end + 3)]
  return new CatmullRomCurve3(direction === 'return' ? p.reverse() : p, false, 'centripetal', .3)
}

const Vehicle = memo(function Vehicle({ car, moves, end, selected, onSelect, reducedMotion, shown }) {
  const group = useRef(); const queue = useRef([]); const seen = useRef(new Set()); const animation = useRef(null)
  const { invalidate } = useThree()
  const parking = car.parking
  const baseVisible = car.status !== 'on_trip' && shown
  useEffect(() => {
    if (!parking || !group.current) return
    moves.forEach(move => {
      if (seen.current.has(move.key)) return
      seen.current.add(move.key); if (!reducedMotion) queue.current.push(move)
    })
    if (reducedMotion) { queue.current = []; animation.current = null }
    if (!animation.current && queue.current.length === 0) {
      group.current.position.set(parking.x, 0, parking.z); group.current.rotation.y = 0; group.current.visible = baseVisible
    }
    invalidate()
  }, [moves, parking, baseVisible, reducedMotion, invalidate])
  useFrame((_, delta) => {
    if (!group.current || !parking) return
    if (!animation.current && queue.current.length) {
      const next = queue.current.shift()
      animation.current = { ...next, elapsed: 0, curve: route(parking, end, next.direction) }
    }
    const current = animation.current
    if (!current) return
    current.elapsed += Math.min(delta, .1)
    const progress = Math.min(1, current.elapsed / 8)
    const curve = current.curve
    const t = progress * progress * (3 - 2 * progress)
    group.current.position.copy(curve.getPoint(t))
    const tangent = curve.getTangent(t)
    group.current.rotation.y = Math.atan2(tangent.x, tangent.z)
    group.current.visible = shown
    if (progress >= 1) {
      animation.current = null
      if (!queue.current.length) { group.current.position.set(parking.x, 0, parking.z); group.current.rotation.y = 0; group.current.visible = baseVisible }
    }
    invalidate()
  })
  if (!parking) return null
  return <group ref={group} position={[parking.x, 0, parking.z]} visible={baseVisible}
    onClick={event => { event.stopPropagation(); onSelect(car.id) }}>
    <MiniCar color={selected ? '#f6ecff' : '#ffffff'} />
  </group>
})

function CameraRig({ view, focus, end }) {
  const controls = useRef(); const { camera, size, invalidate } = useThree()
  useEffect(() => {
    const centerZ = (end - 12) / 2
    const target = focus ? new Vector3(focus.x, 0, focus.z) : new Vector3(0, 0, centerZ)
    const offset = view.top ? new Vector3(0, 48, .01) : new Vector3(32, 38, 34)
    camera.position.copy(target.clone().add(offset)); camera.lookAt(target)
    // Three.js camera is an external mutable scene object, not React state.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = Math.min(size.width / 53, size.height / (end + 20)) * view.zoom
    camera.updateProjectionMatrix()
    if (controls.current) { controls.current.target.copy(target); controls.current.update() }
    invalidate()
  }, [camera, size.width, size.height, view, focus, end, invalidate])
  return <MapControls ref={controls} enableRotate={false} minZoom={5} maxZoom={90} onEnd={() => {
    if (!controls.current) return
    controls.current.target.x = Math.max(-17, Math.min(17, controls.current.target.x))
    controls.current.target.z = Math.max(-12, Math.min(end, controls.current.target.z))
    controls.current.update(); invalidate()
  }} />
}

function ProjectedLabels({ host, enabled }) {
  const { camera, size, invalidate } = useThree()
  const point = useMemo(() => new Vector3(), [])
  useEffect(()=>{invalidate()},[enabled,invalidate])
  useFrame(() => {
    host.current?.querySelectorAll('[data-world-x]').forEach(node => {
      point.set(Number(node.dataset.worldX),Number(node.dataset.worldY),Number(node.dataset.worldZ)).project(camera)
      node.style.transform=`translate(${(point.x+1)*size.width/2}px,${(1-point.y)*size.height/2}px) translate(-50%,-50%)`
      node.style.visibility=point.z>-1 && point.z<1 ? 'visible':'hidden'
    })
  })
  return null
}

export default memo(function FleetScene({ vehicles, selectedId, onSelect, moves, view, focus, reducedMotion, visibleIds, labelsHost, labels }) {
  const end = Math.max(20, ...vehicles.map(car => (car.parking?.z || 0) + 5))
  const movesByCar = useMemo(() => {
    const map = new Map()
    moves.forEach(move => map.set(String(move.carId), [...(map.get(String(move.carId)) || []), move]))
    return map
  }, [moves])
  return <Canvas orthographic shadows dpr={[1, 1.5]} frameloop="demand" camera={{ position: [32, 38, 34], near: .1, far: 200 }}
    role="img" aria-label="ฉากสำนักงานและรถในช่องจอดแบบ 3D"
    gl={{ antialias: true, alpha: false }} fallback={<p>ผังลานรถจำลอง เลือกรถจากรายการด้านข้างได้</p>}>
    <color attach="background" args={['#edf3f7']} />
    <ambientLight intensity={1.4} /><hemisphereLight args={['#fff', '#cddde5', 1.1]} />
    <directionalLight castShadow position={[-12, 30, 12]} intensity={2} shadow-mapSize={[1024, 1024]} shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={32} shadow-camera-bottom={-25} shadow-bias={-.001} />
    <Block at={[0, -.3, (end - 12) / 2]} size={[37, .5, end + 15]} color="#f4f7fa" />
    <Block at={[2, .005, (end - 10) / 2]} size={[4.6, .04, end + 18]} color="#c3cfda" />
    {[3.3, 8.3, 13.3, 18.3].filter(z => z < end).map(z => <Block key={z} at={[0, .035, z]} size={[35, .06, 1.85]} color="#c3cfda" />)}
    {Array.from({ length: Math.floor((end + 12) / 3) }, (_, i) => <Block key={i} at={[2, .05, -10 + i * 3]} size={[.08, .025, 1.2]} color="#fff" />)}
    <Office /><Canopy /><Gate end={end} />
    {[[-17,-11],[-12,-12],[-8,-12],[-3,-12],[3,-12],[8,-12],[16,-10],[-17,-4],[8,-4],[16,-2],[-17,3],[-17,8],[-17,13],[-17,18],[17,4],[17,9],[17,14],[17,19],[-10,20],[-6,20]].map(([x,z],i) => <Tree key={i} x={x} z={z} small={i%3===0} />)}
    {[[-2,-3],[8,-3],[-16,10],[5,19],[-12,-5]].map(([x,z],i) => <Person key={i} x={x} z={z} />)}
    {vehicles.map(car => car.parking && <group key={car.id}>
      <group position={[car.parking.x, 0, car.parking.z]} onClick={event => { event.stopPropagation(); if (visibleIds.includes(car.id)) onSelect(car.id) }}>
        <Block at={[0, .04, 0]} size={[2.7, .06, 3.8]} color={selectedId===car.id ? '#ead9ff' : car.status==='on_trip' ? '#e7edf2' : '#daf0e8'} />
        {[-1,1].map(sign => <Block key={sign} at={[sign*1.32,.09,0]} size={[.06,.045,3.8]} color={selectedId===car.id ? '#8b36d1' : FLEET_STATUSES[car.status].color} />)}
        <Block at={[0,.09,-1.87]} size={[2.7,.045,.06]} color="#fff" />
      </group>
      <Vehicle car={car} end={end} moves={movesByCar.get(String(car.id)) || NO_MOVES} shown={visibleIds.includes(car.id)} selected={selectedId===car.id} onSelect={onSelect} reducedMotion={reducedMotion} />
    </group>)}
    <ProjectedLabels host={labelsHost} enabled={labels} />
    <CameraRig view={view} focus={focus} end={end} />
  </Canvas>
})

const NO_MOVES = []
