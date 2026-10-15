'use client'

import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3, Object3D, MOUSE, TOUCH, ACESFilmicToneMapping, SRGBColorSpace, PCFShadowMap } from 'three'
import { createFleetTraffic } from '@/lib/fleetTraffic'
import { createCampusVisitors } from '@/lib/fleetCampusVisitors'
import { FLEET_STATUSES } from '@/lib/fleetDigitalTwin'
import FleetVehicleModel from './FleetVehicleModel'
import { displayedParkingSlots, siteOverflowAisles } from '@/lib/fleetSiteLayout'
import { restingPose, siteChargingBays, campusBounds } from '@/lib/fleetCharging'
import FleetCampus from './FleetCampus'
import FleetCampusProps from './FleetCampusProps'
import FleetCampusLife from './FleetCampusLife'
import { DEFAULT_ORBIT, MIN_ELEVATION, MAX_ELEVATION, cameraView, cameraOffset, captureOrbit } from '@/lib/fleetCamera'
import { ARCHITECTURE } from '@/lib/fleetArchitecture'
import { architecturalSun } from '@/lib/fleetPresentation'
import FleetEnvironment from './FleetEnvironment'

export const MiniCar = FleetVehicleModel

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

function VisitorCar({ car, register }) {
  const connect=useCallback(node=>register(car.id,node),[car.id,register])
  return <group ref={connect} position={[car.parking.x,0,car.parking.z]} visible={car.status!=='on_trip'}>
    <FleetVehicleModel car={car} kind={car.kind==='motorcycle'?'motorcycle':'generic'} color={car.color}/>
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
    <mesh position={[0,.035,0]} receiveShadow><boxGeometry args={[2.7,.04,3.8]}/><meshStandardMaterial color={selected ? '#d9cce7' : car.status==='on_trip' ? '#c6cbc8' : '#b5c2b5'} roughness={.95}/></mesh>
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
  const { minX, maxX, minZ, maxZ, maxY } = bounds
  const sun = useMemo(() => architecturalSun({ minX, maxX, minZ, maxZ, maxY }), [minX, maxX, minZ, maxZ, maxY])
  const target = useMemo(() => {
    const object = new Object3D()
    object.position.set(...sun.center)
    return object
  }, [sun])
  return <>
    <FleetEnvironment/>
    <ambientLight intensity={.08}/>
    <hemisphereLight args={['#e9f3ff', '#647257', .65]}/>
    <directionalLight color="#dceafa" position={[30, 24, -40]} intensity={.22}/>
    <primitive object={target}/>
    <directionalLight castShadow target={target} position={sun.position} color="#fff9f0" intensity={3.1}
      shadow-mapSize={[shadowSize, shadowSize]} shadow-camera-left={sun.left}
      shadow-camera-right={sun.right} shadow-camera-top={sun.top}
      shadow-camera-bottom={sun.bottom} shadow-camera-near={sun.near} shadow-camera-far={sun.far}
      shadow-normalBias={.025} shadow-bias={-.00012} shadow-radius={2}/>
  </>
}

export default memo(function FleetScene({ vehicles, selectedId, onSelect, moves, view, focus, reducedMotion, visibleIds, labelsHost, labels, trafficHost, ambientTraffic = true }) {
  const bounds = useMemo(()=>campusBounds(vehicles),[vehicles])
  const slots = useMemo(()=>displayedParkingSlots(vehicles),[vehicles])
  const overflowAisles = useMemo(()=>siteOverflowAisles(vehicles),[vehicles])
  const chargingBays = useMemo(()=>siteChargingBays(vehicles),[vehicles])
  return <Canvas orthographic shadows={{ type: PCFShadowMap }} dpr={[1, 1.5]} frameloop="demand" camera={{ position: [4, 58, 40], near: .1, far: 1000 }}
    role="img" aria-label="ฉากสำนักงานและรถในช่องจอดแบบ 3D"
    gl={{ antialias: true, alpha: false, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1, outputColorSpace: SRGBColorSpace }} fallback={<p>ผังลานรถจำลอง เลือกรถจากรายการด้านข้างได้</p>}>
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
