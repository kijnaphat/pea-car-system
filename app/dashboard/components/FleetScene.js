'use client'

import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3, MOUSE, TOUCH, ACESFilmicToneMapping, SRGBColorSpace, PCFShadowMap } from 'three'
import { createFleetTraffic } from '@/lib/fleetTraffic'
import { createCampusVisitors } from '@/lib/fleetCampusVisitors'
import { FLEET_STATUSES } from '@/lib/fleetDigitalTwin'
import { vehicleStyle } from '@/lib/fleetVehicleStyle'
import { displayedParkingSlots, siteOverflowAisles } from '@/lib/fleetSiteLayout'
import { restingPose, siteChargingBays, campusBounds } from '@/lib/fleetCharging'
import FleetCampus from './FleetCampus'
import FleetCampusProps from './FleetCampusProps'
import FleetCampusLife from './FleetCampusLife'
import { DEFAULT_ORBIT, MIN_ELEVATION, MAX_ELEVATION, cameraView, cameraOffset, captureOrbit } from '@/lib/fleetCamera'
import { ARCHITECTURE } from '@/lib/fleetArchitecture'

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

const Vehicle = memo(function Vehicle({ car, selected, onSelect, register }) {
  const connect=useCallback(node=>register(car.id,node),[car.id,register])
  if(!car.parking) return null
  const position=restingPose(car)
  return <group ref={connect} position={[position.x,0,position.z]} rotation={[0,position.yaw,0]} visible={car.status!=='on_trip'}
    onClick={event=>{event.stopPropagation();onSelect(car.id)}}>
    <MiniCar car={car}/>
    {selected && <mesh rotation={[-Math.PI/2,0,0]} position={[0,.13,0]}><ringGeometry args={[1.8,1.9,32]}/><meshBasicMaterial color="#982ee7" transparent opacity={.7}/></mesh>}
  </group>
})

function VisitorMotorcycle({ color }) {
  return <group>
    <Block at={[0,.58,0]} size={[.38,.33,.96]} color={color}/>
    <Block at={[0,.84,-.2]} size={[.4,.12,.6]} color="#344456"/>
    <Block at={[0,1,.53]} size={[.7,.065,.09]} color="#607180"/>
    <Block at={[0,.79,.59]} size={[.32,.4,.13]} color={color}/>
    <Block at={[0,.97,.668]} size={[.22,.14,.02]} color="#fff0c9"/>
    {[-.65,.65].map(z=><mesh key={z} position={[0,.3,z]} rotation={[0,0,Math.PI/2]} castShadow><cylinderGeometry args={[.3,.3,.16,12]}/><meshStandardMaterial color="#263442"/></mesh>)}
  </group>
}

function VisitorCar({ car, register }) {
  const connect=useCallback(node=>register(car.id,node),[car.id,register])
  if(car.kind==='motorcycle') return <group ref={connect} position={[car.parking.x,0,car.parking.z]} visible={car.status!=='on_trip'}><VisitorMotorcycle color={car.color}/></group>
  return <group ref={connect} position={[car.parking.x,0,car.parking.z]} visible={car.status!=='on_trip'}>
    <Block at={[0,.46,0]} size={[1.4,.4,2.95]} color={car.color}/>
    <Block at={[0,.87,-.08]} size={[1.21,.51,1.4]} color={car.color}/>
    <Block at={[0,.94,.63]} size={[1.08,.33,.03]} color="#a3c5d6"/>
    <Block at={[0,.94,-.8]} size={[1.08,.33,.03]} color="#8daebd"/>
    {[-1,1].map(sign=><group key={sign}>
      <Block at={[sign*.619,.93,-.08]} size={[.025,.33,1.16]} color="#93b6c9"/>
      <Block at={[sign*.47,.51,1.49]} size={[.29,.15,.025]} color="#fff4d4"/>
      <Block at={[sign*.47,.51,-1.49]} size={[.29,.13,.025]} color="#c77372"/>
    </group>)}
    <Wheels axles={[-.99,.99]}/>
    <Block at={[0,.34,1.5]} size={[.46,.14,.028]} color="#f1eadf"/>
  </group>
}

function TrafficLayer({ vehicles, moves, selectedId, onSelect, reducedMotion, visibleIds, trafficHost, ambientTraffic }) {
  const groups=useRef(new Map()),controller=useRef(null)
  const visitors=useMemo(()=>createCampusVisitors(),[])
  const {invalidate}=useThree()
  const shown=useMemo(()=>new Set(visibleIds.map(String)),[visibleIds])
  const register=useCallback((id,node)=>{if(node) groups.current.set(String(id),node);else groups.current.delete(String(id))},[])
  useEffect(()=>{invalidate()},[shown,invalidate])
  useEffect(()=>{
    if(!controller.current) controller.current=createFleetTraffic()
    controller.current.setFleet(ambientTraffic?[...vehicles,...visitors.cars]:vehicles)
    if(reducedMotion) controller.current.clear(moves)
    else controller.current.enqueue(moves)
    invalidate()
  },[vehicles,moves,reducedMotion,invalidate,ambientTraffic,visitors])
  useEffect(()=>()=>{if(trafficHost.current) {trafficHost.current.textContent='';trafficHost.current.hidden=true}},[trafficHost])
  useFrame((_,delta)=>{
    const traffic=controller.current
    if(!traffic || document.visibilityState!=='visible') return
    traffic.advance(delta)
    if(ambientTraffic&&!reducedMotion) visitors.tick(traffic,vehicles)
    let moving=0,waiting=0
    groups.current.forEach((group,id)=>{
      const pose=traffic.pose(id)
      if(!pose) {group.visible=false;return}
      group.position.set(pose.x,0,pose.z);group.rotation.y=pose.yaw
      const visitor=id.startsWith('campus-visitor-')
      group.visible=pose.visible && (visitor?ambientTraffic:shown.has(id))
      if(!visitor && pose.moving) moving++
      else if(!visitor && pose.waiting) waiting++
    })
    const pending=traffic.busy()
    if(trafficHost.current) {
      const message=moving||waiting ? `คิวภาพจำลอง · กำลังวิ่ง ${moving} · รอ ${waiting}` : ''
      if(trafficHost.current.textContent!==message) trafficHost.current.textContent=message
      trafficHost.current.hidden=!message
    }
    if(pending) invalidate()
  })
  return <>{vehicles.map(car=><Vehicle key={car.id} car={car} selected={selectedId===car.id} onSelect={onSelect} register={register}/>)}
    {ambientTraffic && visitors.cars.map(car=><VisitorCar key={car.id} car={car} register={register}/>)}</>
}

function CameraRig({ view, focus, bounds }) {
  const controls = useRef(); const { camera, size, invalidate } = useThree()
  const memory=useRef({...DEFAULT_ORBIT,target:null}),previous=useRef(null),fit=useRef(1)
  const {minX,maxX,minZ,maxZ,maxY}=bounds
  const {zoom,top,reset,turn=0,tilt=0,drag='rotate'}=view
  const focusX=focus?.x,focusZ=focus?.z
  const mouseButtons=useMemo(()=>({LEFT:drag==='pan'||top?MOUSE.PAN:MOUSE.ROTATE,MIDDLE:MOUSE.DOLLY,RIGHT:drag==='pan'||top?MOUSE.ROTATE:MOUSE.PAN}),[drag,top])
  const touches=useMemo(()=>({ONE:drag==='pan'||top?TOUCH.PAN:TOUCH.ROTATE,TWO:TOUCH.DOLLY_PAN}),[drag,top])
  useEffect(() => {
    const next={zoom,top,reset,turn,tilt}
    memory.current=cameraView(memory.current,previous.current,next)
    const target=focusX!==undefined ? new Vector3(focusX,0,focusZ)
      : memory.current.target ? new Vector3(...memory.current.target) : new Vector3((minX+maxX)/2,.6,(minZ+maxZ)/2)
    const orbit=cameraOffset(memory.current,top),offset=new Vector3(orbit.x,orbit.y,orbit.z)
    offset.multiplyScalar(Math.max(1,(Math.hypot(maxX-minX,maxZ-minZ,maxY)/2+20)/offset.length()))
    camera.position.copy(target.clone().add(offset));camera.lookAt(target)
    camera.updateMatrixWorld()
    const corners = [minX,maxX].flatMap(x => [minZ,maxZ].flatMap(z => [0,maxY].map(y => new Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse))))
    const width = Math.max(...corners.map(p=>p.x)) - Math.min(...corners.map(p=>p.x))
    const height = Math.max(...corners.map(p=>p.y)) - Math.min(...corners.map(p=>p.y))
    // Three.js camera is an external mutable scene object, not React state.
    // eslint-disable-next-line react-hooks/immutability
    camera.zoom = Math.min(size.width / (width+4), size.height / (height+4)) * memory.current.zoomFactor
    fit.current=Math.min(size.width/(width+4),size.height/(height+4))
    camera.updateProjectionMatrix()
    if (controls.current) { controls.current.target.copy(target); controls.current.update() }
    previous.current=next
    invalidate()
    // Scalar dependencies deliberately keep polling snapshots from resetting the camera.
  }, [camera,size.width,size.height,zoom,top,reset,turn,tilt,focusX,focusZ,minX,maxX,minZ,maxZ,maxY,invalidate])
  return <OrbitControls ref={controls} enableRotate={!top} enableDamping={false} minZoom={.7} maxZoom={90}
    minPolarAngle={top ? .00001 : Math.PI/2-MAX_ELEVATION} maxPolarAngle={top ? .00002 : Math.PI/2-MIN_ELEVATION}
    mouseButtons={mouseButtons} touches={touches} screenSpacePanning={false} rotateSpeed={.65} onEnd={() => {
    if (!controls.current) return
    const control=controls.current,old=control.target.clone()
    control.target.x = Math.max(minX, Math.min(maxX, control.target.x))
    control.target.z = Math.max(minZ, Math.min(maxZ, control.target.z))
    camera.position.add(control.target.clone().sub(old));control.update()
    memory.current=captureOrbit(memory.current,{azimuth:control.getAzimuthalAngle(),polar:control.getPolarAngle(),zoomFactor:camera.zoom/fit.current,target:control.target.toArray()},top)
    invalidate()
  }} />
}

function ParkingSlot({ car, selected, onSelect, visible }) {
  const border = selected ? '#8b36d1' : FLEET_STATUSES[car.status].color
  return <group position={[car.parking.x,0,car.parking.z]} rotation={[0,car.parking.yaw,0]} onClick={event=>{event.stopPropagation();if(visible) onSelect(car.id)}}>
    <mesh position={[0,.035,0]} receiveShadow><boxGeometry args={[2.7,.04,3.8]}/><meshStandardMaterial color={selected ? '#ead9ff' : car.status==='on_trip' ? '#e7edf2' : '#daf0e8'} roughness={1}/></mesh>
    {[-1,1].map(n=><group key={n}>
      <mesh position={[n*1.33,.066,0]}><boxGeometry args={[.04,.015,3.8]}/><meshBasicMaterial color={border}/></mesh>
      <mesh position={[0,.066,n*1.88]}><boxGeometry args={[2.7,.015,.04]}/><meshBasicMaterial color={border}/></mesh>
    </group>)}
    <mesh position={[0,.068,-1.55]}><boxGeometry args={[1.1,.02,.05]}/><meshBasicMaterial color="#fff"/></mesh>
  </group>
}

function ProjectedLabels({ host, enabled }) {
  const { camera, size, invalidate } = useThree()
  const point = useMemo(() => new Vector3(), [])
  useEffect(()=>{invalidate()},[enabled,invalidate])
  useFrame(() => {
    host.current?.querySelectorAll('[data-world-x]').forEach(node => {
      point.set(Number(node.dataset.worldX),Number(node.dataset.worldY),Number(node.dataset.worldZ)).project(camera)
      node.style.transform=`translate(${(point.x+1)*size.width/2}px,${(1-point.y)*size.height/2}px) translate(-50%,-50%)`
      // At phone-scale, dense labels overlap. Reveal them as the user zooms in.
      const readable=camera.zoom>=6 || node.classList.contains('twin-campus-label')
      node.style.visibility=point.z>-1 && point.z<1 && readable ? 'visible':'hidden'
    })
  })
  return null
}

function ArchitecturalLight({ bounds }) {
  const { size } = useThree()
  const shadowSize = size.width >= 900 ? 2048 : 1024
  return <>
    <ambientLight intensity={.38}/>
    <hemisphereLight args={['#fff3dc', '#788e8a', 1.15]}/>
    <directionalLight castShadow position={[-36, 48, 26]} intensity={2.1}
      shadow-mapSize={[shadowSize, shadowSize]} shadow-camera-left={-72}
      shadow-camera-right={Math.max(90, bounds.maxX + 18)} shadow-camera-top={65}
      shadow-camera-bottom={-65} shadow-camera-near={.5} shadow-camera-far={250}
      shadow-normalBias={.025} shadow-bias={-.0003} shadow-radius={3}/>
  </>
}

export default memo(function FleetScene({ vehicles, selectedId, onSelect, moves, view, focus, reducedMotion, visibleIds, labelsHost, labels, trafficHost, ambientTraffic = true }) {
  const bounds = useMemo(()=>campusBounds(vehicles),[vehicles])
  const slots = useMemo(()=>displayedParkingSlots(vehicles),[vehicles])
  const overflowAisles = useMemo(()=>siteOverflowAisles(vehicles),[vehicles])
  const chargingBays = useMemo(()=>siteChargingBays(vehicles),[vehicles])
  return <Canvas orthographic shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]} frameloop="demand" camera={{ position: [4, 58, 40], near: .1, far: 1000 }}
    role="img" aria-label="ฉากสำนักงานและรถในช่องจอดแบบ 3D"
    gl={{ antialias: true, alpha: false, toneMapping: ACESFilmicToneMapping, toneMappingExposure: .95, outputColorSpace: SRGBColorSpace }} fallback={<p>ผังลานรถจำลอง เลือกรถจากรายการด้านข้างได้</p>}>
    <color attach="background" args={[ARCHITECTURE.sky]} />
    <ArchitecturalLight bounds={bounds}/>
    <FleetCampus bounds={bounds} overflowAisles={overflowAisles} chargingBays={chargingBays} vehicles={vehicles}/>
    <FleetCampusProps bounds={bounds} reducedMotion={reducedMotion}/>
    <FleetCampusLife reducedMotion={reducedMotion} bounds={bounds}/>
    {slots.map(slot => <ParkingSlot key={slot.slotNo} car={slot.car || {id:null,status:'unknown',parking:slot.parking}} selected={!!slot.car && selectedId===slot.car.id} onSelect={onSelect} visible={!!slot.car && visibleIds.includes(slot.car.id)}/>)}
    <TrafficLayer vehicles={vehicles} moves={moves} selectedId={selectedId} onSelect={onSelect} reducedMotion={reducedMotion} visibleIds={visibleIds} trafficHost={trafficHost} ambientTraffic={ambientTraffic}/>
    <ProjectedLabels host={labelsHost} enabled={labels} />
    <CameraRig view={view} focus={focus} bounds={bounds} />
  </Canvas>
})
