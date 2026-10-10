'use client'

import { memo, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { MapControls } from '@react-three/drei'
import { CatmullRomCurve3, Vector3 } from 'three'
import { FLEET_STATUSES } from '@/lib/fleetDigitalTwin'
import { vehicleStyle } from '@/lib/fleetVehicleStyle'
import FleetCampus from './FleetCampus'

function Block({ at = [0, 0, 0], size, color = '#fff', ...props }) {
  return <mesh position={at} castShadow receiveShadow {...props}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.9} flatShading /></mesh>
}


function Wheels({ axles, width = 1.35, radius = .27 }) {
  return [-1, 1].flatMap(sign => axles.map(z => <group key={`${sign}-${z}`} position={[sign * width / 2, radius, z]} rotation={[0, 0, Math.PI / 2]}>
    <mesh castShadow><cylinderGeometry args={[radius, radius, .17, 12]} /><meshStandardMaterial color="#202b38" roughness={1} /></mesh>
    <mesh position={[0, -sign * .09, 0]}><cylinderGeometry args={[radius * .5, radius * .5, .02, 8]} /><meshStandardMaterial color="#b7c8d7" /></mesh>
  </group>))
}

function TruckCab({ color }) {
  return <group>
    <Block at={[0, .94, 1.07]} size={[1.45, 1.12, 1.05]} color={color} />
    <Block at={[0, 1.19, 1.605]} size={[1.23, .47, .025]} color="#9ec7df" />
    {[-1,1].map(sign=><group key={sign}><Block at={[sign*.733,1.2,1.04]} size={[.025,.44,.7]} color="#92b6cf"/><Block at={[sign*.57,.7,1.61]} size={[.26,.19,.025]} color="#fff2bf"/></group>)}
    <Block at={[0,.43,1.65]} size={[1.55,.16,.15]} color="#b1c3d0" />
    <Block at={[0,.77,1.62]} size={[.55,.22,.025]} color="#33485b" />
  </group>
}

function TruckBed({ color, kind }) {
  const equipment = ['bucket','crane','drill'].includes(kind)
  return <group>
    <Block at={[0,.48,-.52]} size={[1.48,.25,2.06]} color={color}/>
    <Block at={[0,.63,-.52]} size={[1.25,.08,1.84]} color="#475968"/>
    {!equipment && [-1,1].map(sign=><Block key={sign} at={[sign*.69,.91,-.52]} size={[.1,.55,2.06]} color={color}/>)}
    {!equipment && <Block at={[0,.91,-1.55]} size={[1.48,.55,.1]} color={color}/>}
    {kind==='covered_truck' && <><Block at={[0,1.65,-.52]} size={[1.5,.12,2.09]} color="#e5e9e7"/>{[-1,1].map(sign=><Block key={sign} at={[sign*.69,1.3,-.52]} size={[.06,.7,2.06]} color="#c8d5d4"/>)}</>}
    {kind==='bucket' && <>
      <Block at={[0,.92,-.7]} size={[.65,.65,.6]} color="#4a5a62"/>
      <Block at={[0,1.42,-.45]} size={[.24,.22,1.6]} color="#f4bd3c" rotation={[-.35,0,0]}/>
      <Block at={[0,1.91,-.88]} size={[.21,.18,1.15]} color="#eaaa22" rotation={[.45,0,0]}/>
      <Block at={[0,2.15,-1.38]} size={[.76,.6,.62]} color="#fff0d1"/>
      <Block at={[0,2.46,-1.38]} size={[.62,.02,.48]} color="#a38962"/>
    </>}
    {kind==='crane' && <>
      <Block at={[0,1,-.82]} size={[.58,.7,.56]} color="#39495b"/>
      <Block at={[0,1.5,-.47]} size={[.32,.3,1.82]} color="#f9c536" rotation={[-.3,0,0]}/>
      <Block at={[0,1.91,-.4]} size={[.26,.24,1.7]} color="#d9960b" rotation={[.18,0,0]}/>
      <Block at={[0,1.59,.36]} size={[.035,.6,.035]} color="#32455a"/>
      <Block at={[.08,1.3,.36]} size={[.2,.1,.08]} color="#32455a"/>
      <Block at={[0,.7,-1.35]} size={[2,.12,.2]} color="#ce9a2a"/>
    </>}
    {kind==='drill' && <>
      <Block at={[0,1.6,-.94]} size={[.27,2,.25]} color="#eab649" rotation={[.12,0,0]}/>
      <Block at={[0,2.5,-1.05]} size={[.85,.15,.4]} color="#eab649"/>
      <mesh position={[0,.75,-1.05]}><cylinderGeometry args={[.08,.08,.8,8]}/><meshStandardMaterial color="#3d4c60"/></mesh>
      <Block at={[0,.94,-.22]} size={[.85,.65,.7]} color="#a6b6bd"/>
    </>}
  </group>
}

export const MiniCar = memo(function MiniCar({ car }) {
  const { kind, color, wheels } = vehicleStyle(car)
  const truck = ['bucket','crane','drill','heavy_truck','light_truck','covered_truck'].includes(kind)
  if (truck) return <group>
    <Block at={[0,.31,0]} size={[1.3,.2,3.3]} color="#34465a"/>
    <TruckCab color={color}/><TruckBed color={color} kind={kind}/>
    <Wheels width={1.5} radius={.3} axles={wheels===6 ? [1.07,-.46,-1.1] : [1.07,-1.02]}/>
  </group>
  if (kind==='motorcycle') return <group>
    <Block at={[0,.56,0]} size={[.38,.32,.95]} color={color}/>
    <Block at={[0,.83,-.18]} size={[.4,.12,.6]} color="#273749"/>
    <Block at={[0,1,.53]} size={[.7,.07,.1]} color="#35485d"/>
    {[-.65,.65].map(z=><mesh key={z} position={[0,.3,z]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.3,.3,.16,12]}/><meshStandardMaterial color="#263442"/></mesh>)}
  </group>
  const van = kind==='van'; const pickup = kind==='pickup'
  return <group>
    <Block at={[0,.46,0]} size={[1.35,.42,2.95]} color={color}/>
    <Block at={[0,van?1.1:.88,van?-.08:.12]} size={[1.25,van?1.05:.52,van?2.62:1.27]} color={color}/>
    <Block at={[0,van?1.29:.91,van?1.245:.76]} size={[1.08,van?.52:.36,.025]} color="#92bad2"/>
    <Block at={[0,van?1.28:.92,van?-1.4:-.53]} size={[1.08,van?.53:.32,.025]} color="#8faec4"/>
    {[-1,1].map(sign=><group key={sign}>
      <Block at={[sign*.64,van?1.3:.95,van?-.1:.1]} size={[.025,van?.5:.34,van?2.22:1.08]} color="#8eacc4"/>
      <Block at={[sign*.68,.49,0]} size={[.025,.11,2.45]} color="#ecedf6"/>
    </group>)}
    {pickup && <><Block at={[0,.68,-1]} size={[1.17,.07,.81]} color="#364d60"/>{[-1,1].map(sign=><Block key={sign} at={[sign*.63,.8,-1]} size={[.11,.27,.9]} color={color}/>)}<Block at={[0,.8,-1.43]} size={[1.26,.27,.1]} color={color}/></>}
    {!van && !pickup && <Block at={[0,.73,-1.02]} size={[1.23,.15,.78]} color={color}/>}
    <Wheels axles={[-.98,.98]} width={1.36}/>
    {[-1,1].map(sign=><Block key={sign} at={[sign*.47,.5,1.49]} size={[.3,.17,.025]} color="#fff4c5"/>)}
    <Block at={[0,.32,1.49]} size={[1.25,.12,.06]} color="#d0dce4"/>
    {kind==='ev' && <Block at={[0,1.17,.12]} size={[.25,.025,.75]} color="#e4d3ff"/>}
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
    <MiniCar car={car} />
    {selected && <mesh rotation={[-Math.PI/2,0,0]} position={[0,.13,0]}><ringGeometry args={[1.8,1.9,32]}/><meshBasicMaterial color="#982ee7" transparent opacity={.7}/></mesh>}
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
    <color attach="background" args={['#f2f7fa']} />
    <ambientLight intensity={.7} /><hemisphereLight args={['#fff7ea', '#c0d5db', .65]} />
    <directionalLight castShadow position={[-12, 30, 12]} intensity={1.4} shadow-mapSize={[1024, 1024]} shadow-camera-left={-26} shadow-camera-right={26} shadow-camera-top={32} shadow-camera-bottom={-25} shadow-bias={-.001} />
    <FleetCampus end={end}/>
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
