'use client'

import { memo, useCallback, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ACESFilmicToneMapping, SRGBColorSpace, PCFShadowMap } from 'three'
import { THAMAKA_ORBIT, THAMAKA_WALKERS, thamakaLayout, thamakaSlots, createThamakaTraffic, siteChargingBays } from '@/lib/thamakaSiteLayout'
import { walkingPose, startCampusLife } from '@/lib/fleetCampusLife'
import { TrafficLayer, CameraRig, ParkingSlot, ProjectedLabels, ArchitecturalLight } from './FleetScene'
import { Worker } from './FleetCampusLife'
import ThamakaCampus from './ThamakaCampus'

function ThamakaPeople({reducedMotion}) {
  const {invalidate}=useThree(),actors=useRef(new Map())
  const register=useCallback((id,node)=>{if(node)actors.current.set(id,node);else actors.current.delete(id)},[])
  useEffect(()=>{invalidate();if(!reducedMotion)return startCampusLife(invalidate)},[invalidate,reducedMotion])
  useFrame(({clock})=>{
    if(document.visibilityState!=='visible')return
    for(const person of THAMAKA_WALKERS) {
      const actor=actors.current.get(person.id);if(!actor?.root)continue
      const p=walkingPose(person,reducedMotion?0:clock.elapsedTime)
      actor.root.position.set(p.x,0,p.z);actor.root.rotation.y=p.yaw
      actor.leftLeg.rotation.x=reducedMotion?0:p.gait;actor.rightLeg.rotation.x=reducedMotion?0:-p.gait
      actor.leftArm.rotation.x=reducedMotion?0:-p.gait*.65;actor.rightArm.rotation.x=reducedMotion?0:p.gait*.65
    }
  })
  return <group>{THAMAKA_WALKERS.map(person=><Worker key={person.id} person={person} register={register}/>)}</group>
}
export default memo(function ThamakaScene(props) {
  const {vehicles,selectedId,onSelect,moves,view,focus,reducedMotion,visibleIds,labelsHost,labels,trafficHost,ambientTraffic=true}=props
  const bounds=useMemo(()=>thamakaLayout(vehicles).bounds,[vehicles])
  const slots=useMemo(()=>thamakaSlots(vehicles),[vehicles])
  const bays=useMemo(()=>siteChargingBays(vehicles),[vehicles])
  return <Canvas orthographic shadows={{type:PCFShadowMap}} dpr={[1,1.5]} frameloop="demand"
    camera={{position:[-30,58,50],near:.1,far:1000}} role="img" aria-label="Digital Twin ท่ามะกา อิงภาพอ้างอิง อาคาร ลานรถ และแนวคลอง"
    gl={{antialias:true,alpha:false,toneMapping:ACESFilmicToneMapping,toneMappingExposure:.95,outputColorSpace:SRGBColorSpace}}>
    <color attach="background" args={['#dce7e5']}/><ArchitecturalLight bounds={bounds}/>
    <ThamakaCampus vehicles={vehicles} chargingBays={bays}/>
    <ThamakaPeople reducedMotion={reducedMotion}/>
    {slots.map(slot=><ParkingSlot key={slot.slotNo} car={slot.car} selected={selectedId===slot.car.id} onSelect={onSelect} visible={visibleIds.includes(slot.car.id)}/>)}
    <TrafficLayer vehicles={vehicles} moves={moves} selectedId={selectedId} onSelect={onSelect} reducedMotion={reducedMotion}
      visibleIds={visibleIds} trafficHost={trafficHost} ambientTraffic={ambientTraffic} controllerFactory={createThamakaTraffic}/>
    <ProjectedLabels host={labelsHost} enabled={labels}/>
    <CameraRig view={view} focus={focus} bounds={bounds} initialOrbit={THAMAKA_ORBIT}/>
  </Canvas>
})
