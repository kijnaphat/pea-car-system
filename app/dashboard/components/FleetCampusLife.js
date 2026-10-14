'use client'

import { memo, useCallback, useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { WALKERS, OFFICE_WALKERS, STATIC_PEOPLE, walkingPose, officeWalkingPose, startCampusLife } from '@/lib/fleetCampusLife'
const movingPeople=[...WALKERS,...OFFICE_WALKERS]

function Part({ position, size, color, ...props }) {
  return <mesh position={position} castShadow {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.95}/></mesh>
}

const Worker = memo(function Worker({ person, register }) {
  const pose=person.path ? person.officeVisitor?officeWalkingPose(person):walkingPose(person) : person
  const root=useRef(),leftLeg=useRef(),rightLeg=useRef(),leftArm=useRef(),rightArm=useRef()
  useEffect(()=>{
    register(person.id,{root:root.current,leftLeg:leftLeg.current,rightLeg:rightLeg.current,leftArm:leftArm.current,rightArm:rightArm.current})
    return ()=>register(person.id,null)
  },[person,register])
  return <group ref={root} position={[pose.x,pose.y||0,pose.z]} rotation={[0,pose.yaw||0,0]} visible={pose.visible!==false}>
    <Part position={[0,.83,0]} size={[.35,.51,.24]} color={person.color}/>
    <Part position={[0,.59,0]} size={[.35,.08,.25]} color="#40536b"/>
    <mesh position={[0,1.22,0]} castShadow><sphereGeometry args={[.18,10,8]}/><meshStandardMaterial color="#dfb590"/></mesh>
    {person.helmet ? <><mesh position={[0,1.36,0]} castShadow><sphereGeometry args={[.195,10,6,0,Math.PI*2,0,Math.PI/2]}/><meshStandardMaterial color="#f3d263"/></mesh><Part position={[0,1.36,.04]} size={[.43,.025,.37]} color="#f3d263"/></>
      : <mesh position={[0,1.31,-.035]} scale={[1,.65,1]}><sphereGeometry args={[.18,10,6]}/><meshStandardMaterial color="#495263"/></mesh>}
    {[[-1,leftLeg],[1,rightLeg]].map(([sign,ref])=><group key={sign} ref={ref} position={[sign*.105,.56,0]} rotation={[person.seated?-Math.PI/2:0,0,0]}>
      <Part position={[0,-.21,0]} size={[.13,.4,.16]} color="#42566a"/>
      {!person.seated && <Part position={[0,-.47,.05]} size={[.17,.1,.25]} color="#3d4658"/>}
    </group>)}
    {person.seated && [-1,1].map(sign=><group key={sign}><Part position={[sign*.105,.28,.39]} size={[.13,.47,.16]} color="#42566a"/><Part position={[sign*.105,.05,.45]} size={[.17,.1,.25]} color="#3d4658"/></group>)}
    {[[-1,leftArm],[1,rightArm]].map(([sign,ref])=><group key={sign} ref={ref} position={[sign*.23,1.01,0]} rotation={[0,0,person.wave&&sign===1?-1.1:sign*.12]}>
      <Part position={[0,-.15,0]} size={[.12,.27,.14]} color={person.color}/><Part position={[0,-.34,0]} size={[.09,.17,.11]} color="#dfb590"/>
    </group>)}
    {person.helmet && <Part position={[0,.87,.135]} size={[.25,.06,.01]} color="#e5e995"/>}
    {person.tool==='watering' && <group position={[.35,.51,.22]}>
      <mesh><cylinderGeometry args={[.15,.15,.25,8]}/><meshStandardMaterial color="#8abcc0"/></mesh>
      <Part position={[.19,.03,.1]} size={[.24,.06,.06]} color="#8abcc0" rotation={[0,-.4,0]}/>
    </group>}
  </group>
})

export { Worker }

export default memo(function FleetCampusLife({ reducedMotion, bounds }) {
  const {invalidate}=useThree(),actors=useRef(new Map())
  const register=useCallback((id,actor)=>{if(actor) actors.current.set(id,actor);else actors.current.delete(id)},[])
  useEffect(()=>{
    invalidate()
    if(reducedMotion) return
    return startCampusLife(invalidate)
  },[reducedMotion,invalidate])
  useFrame(({clock})=>{
    movingPeople.forEach(person=>{
      const actor=actors.current.get(person.id)
      if(!actor?.root) return
      const pose=person.officeVisitor?officeWalkingPose(person,reducedMotion?0:clock.elapsedTime):walkingPose(person,reducedMotion?0:clock.elapsedTime)
      actor.root.position.set(pose.x,pose.y||0,pose.z);actor.root.rotation.y=pose.yaw;actor.root.visible=pose.visible!==false
      const step=reducedMotion?0:pose.gait
      actor.leftLeg.rotation.x=step;actor.rightLeg.rotation.x=-step
      actor.leftArm.rotation.x=-step*.65;actor.rightArm.rotation.x=step*.65
    })
    STATIC_PEOPLE.filter(person=>person.wave).forEach(person=>{
      const arm=actors.current.get(person.id)?.rightArm
      if(arm) arm.rotation.z=-1.1+(reducedMotion?0:Math.sin(clock.elapsedTime*1.3)*.12)
    })
  })
  return <group>{movingPeople.map(person=><Worker key={person.id} person={person} register={register}/>)}{STATIC_PEOPLE.map(person=><Worker key={person.id} person={person.id==='gate-guard'&&bounds?{...person,x:bounds.maxX-8}:person} register={register}/>)}</group>
})
