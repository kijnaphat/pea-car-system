'use client'

import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { RoundedBox } from '@react-three/drei'
import { CatmullRomCurve3, Vector3 } from 'three'
import { SITE, SITE_BICYCLES } from '@/lib/fleetSiteLayout'
import { CAMPUS_TABLES, LANDSCAPE, gardenDetails, fenceDetails } from '@/lib/fleetCampusAmenities'
import { ARCHITECTURE } from '@/lib/fleetArchitecture'
import { StaticParts } from './FleetArchitecture'

function Block({ at, size, color, ...props }) {
  return <mesh position={at} castShadow receiveShadow {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.9}/></mesh>
}
function Soft({ at, size, color, ...props }) {
  return <RoundedBox position={at} args={size} radius={Math.min(.12,...size.map(n=>n/3))} smoothness={2} bevelSegments={1} castShadow receiveShadow {...props}><meshStandardMaterial color={color} roughness={.85}/></RoundedBox>
}
function FlowerBed({ x, z, width=2.4, color='#ddb67a' }) {
  const flowers=useMemo(()=>Array.from({length:7},(_,n)=>({at:[-width*.37+n*width*.74/6,.42,Math.sin(n*2)*.16],size:[.12,.09,.12],color:n%3?color:'#ced1ad'})),[width,color])
  return <group position={[x,0,z]}>
    <Soft at={[0,.12,0]} size={[width,.24,.9]} color={LANDSCAPE.limestone}/>
    <Soft at={[0,.28,0]} size={[width-.18,.12,.7]} color={LANDSCAPE.leaf[1]}/>
    <StaticParts parts={flowers} foliage/>
  </group>
}
function Fountain({ reducedMotion }) {
  const ripple=useRef()
  const paving=useMemo(()=>{
    const parts=[]
    for(let n=0;n<24;n++) {
      const angle=n*Math.PI/12
      parts.push({at:[Math.sin(angle)*2.5,.087,Math.cos(angle)*2.5],size:[.012,.008,1.25],color:LANDSCAPE.joint,rotation:[0,angle,0]})
    }
    for(let n=0;n<4;n++) {
      const angle=Math.PI/4+n*Math.PI/2,x=Math.sin(angle)*2.86,z=Math.cos(angle)*2.86
      parts.push({at:[x,.34,z],size:[.13,.58,.13],color:LANDSCAPE.bronze})
      parts.push({at:[x,.62,z],size:[.14,.06,.14],color:LANDSCAPE.light})
    }
    return parts
  },[])
  useFrame(({clock})=>{
    if(!ripple.current) return
    const wave=reducedMotion?0:Math.sin(clock.elapsedTime*1.8)
    ripple.current.scale.set(1+wave*.06,1,1+wave*.06)
    ripple.current.rotation.y=reducedMotion?0:clock.elapsedTime*.2
  })
  const jets=useMemo(()=>[0,1,2,3].map(n=>{
    const angle=n*Math.PI/2
    return new CatmullRomCurve3([new Vector3(0,1.02,0),new Vector3(Math.cos(angle)*.35,1.45,Math.sin(angle)*.35),new Vector3(Math.cos(angle)*.85,.26,Math.sin(angle)*.85)])
  }),[])
  return <group position={[-47,0,1.2]}>
    <mesh position={[0,.04,0]} receiveShadow><cylinderGeometry args={[3.2,3.2,.08,40]}/><meshStandardMaterial color={LANDSCAPE.limestone} roughness={.95}/></mesh>
    <StaticParts parts={paving}/>
    <mesh position={[0,.16,0]} castShadow receiveShadow><cylinderGeometry args={[1.8,1.8,.25,36]}/><meshStandardMaterial color="#929c91" roughness={.72}/></mesh>
    <mesh position={[0,.29,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.67,.12,6,36]}/><meshStandardMaterial color="#e1dac8" roughness={.6}/></mesh>
    <mesh position={[0,.3,0]}><cylinderGeometry args={[1.53,1.53,.015,36]}/><meshStandardMaterial color="#4c9299" metalness={.28} roughness={.22}/></mesh>
    <mesh position={[0,.63,0]} castShadow><cylinderGeometry args={[.13,.25,.68,10]}/><meshStandardMaterial color={LANDSCAPE.bronze} metalness={.4} roughness={.45}/></mesh>
    {jets.map((jet,n)=><mesh key={n}><tubeGeometry args={[jet,16,.025,4,false]}/><meshBasicMaterial color="#c4f1f8" transparent opacity={.8}/></mesh>)}
    <group ref={ripple} position={[0,.315,0]}>
      {[.6,1.1].map(radius=><mesh key={radius} rotation={[Math.PI/2,0,0]}><torusGeometry args={[radius,.015,4,30]}/><meshBasicMaterial color="#d4f4f7" transparent opacity={.55}/></mesh>)}
      {[0,2,4].map(angle=><mesh key={angle} position={[Math.cos(angle)*1.25,.005,Math.sin(angle)*1.25]} rotation={[-Math.PI/2,0,angle]}><circleGeometry args={[.09,3]}/><meshBasicMaterial color="#e3fafb"/></mesh>)}
    </group>
  </group>
}
function Pergola() {
  const detail=useMemo(()=>{
    const parts=[],add=(at,size,color)=>parts.push({at,size,color})
    for(const x of [-2.1,2.1]) for(const z of [-1.5,1.5]) {
      add([x,1.4,z],[.12,2.8,.12],LANDSCAPE.bronze)
      add([x,.12,z],[.32,.24,.32],LANDSCAPE.limestone)
    }
    for(const z of [-1.5,1.5]) add([0,2.77,z],[4.8,.2,.15],LANDSCAPE.timber)
    for(let n=0;n<13;n++) add([-2.2+n*.366,2.92,0],[.12,.16,3.8],LANDSCAPE.timber)
    for(let n=0;n<6;n++) add([0,.53,-.8+n*.12],[3.8,.095,.08],LANDSCAPE.timber)
    for(let n=0;n<4;n++) add([0,.69+n*.14,-.89],[3.8,.09,.07],LANDSCAPE.timber)
    for(const x of [-1.5,1.5]) add([x,.25,-.5],[.12,.5,.65],LANDSCAPE.bronze)
    for(let n=0;n<5;n++) add([-2+n,.113,0],[.012,.008,3.9],LANDSCAPE.joint)
    return parts
  },[])
  return <group position={[-44,0,8]}>
    <Soft at={[0,.05,0]} size={[5.2,.1,4.1]} color={LANDSCAPE.limestone}/>
    <StaticParts parts={detail}/>
    <FlowerBed x={-2.55} z={.55} width={1.4}/><FlowerBed x={2.55} z={.55} width={1.4}/>
  </group>
}
function CoffeeKiosk() {
  const slats=useMemo(()=>Array.from({length:15},(_,n)=>({at:[-1.4+n*.2,.57,.913],size:[.055,.76,.025],color:LANDSCAPE.timber})),[])
  return <group position={[-6,0,-14.9]}>
    <Soft at={[0,.055,0]} size={[4.2,.11,3.4]} color={LANDSCAPE.limestone}/>
    <Soft at={[0,.54,0]} size={[3,.98,1.8]} color="#766b55"/>
    <StaticParts parts={slats}/>
    <Block at={[0,1.06,0]} size={[3.3,.12,2]} color="#e9e3d3"/>
    {[-1.5,1.5].map(x=><Block key={x} at={[x,1.4,.66]} size={[.075,2.8,.075]} color={LANDSCAPE.bronze}/>)}
    <Soft at={[0,2.73,0]} size={[3.7,.16,2.8]} color={LANDSCAPE.bronze}/>
    {[-1.4,-.7,0,.7,1.4].map(x=><Block key={x} at={[x,2.6,1.32]} size={[.42,.26,.04]} color="#b9baa2"/>)}
    <Soft at={[.77,1.47,.26]} size={[.52,.69,.48]} color="#607d88"/>
    {[-.9,-.45,0].map(x=><mesh key={x} position={[x,1.17,.7]}><cylinderGeometry args={[.085,.065,.14,8]}/><meshStandardMaterial color="#fcf7e9"/></mesh>)}
  </group>
}
function Bicycle({ x }) {
  return <group position={[x,0,0]} rotation={[0,Math.PI/2,0]}>
    {[-.65,.65].map(z=><mesh key={z} position={[0,.44,z]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.35,.045,5,16]}/><meshStandardMaterial color="#53636f"/></mesh>)}
    <Block at={[0,.62,0]} size={[.05,.05,1.2]} color="#6e9bac"/>
    <Block at={[0,.8,.25]} size={[.06,.66,.06]} color="#6e9bac" rotation={[.55,0,0]}/>
    <Block at={[0,.66,-.2]} size={[.06,.52,.06]} color="#6e9bac" rotation={[-.75,0,0]}/>
    <Block at={[0,1.04,-.35]} size={[.28,.06,.22]} color="#516b73"/>
    <Block at={[0,1.14,.6]} size={[.48,.05,.05]} color="#c2d4d9"/>
  </group>
}
function BicycleRack() {
  return <group position={[SITE_BICYCLES.x,0,SITE_BICYCLES.z]}>
    <Soft at={[0,.03,0]} size={[3.8,.06,2]} color="#d9e2dc"/>
    {[-1.2,0,1.2].map(x=><group key={x}><Bicycle x={x}/><Block at={[x,.3,.55]} size={[.07,.6,.07]} color="#9fafb5"/></group>)}
  </group>
}
function UtilityYard() {
  return <group position={[25,0,-14.3]}>
    <Soft at={[0,.04,0]} size={[4.2,.08,3.4]} color="#d1dcd9"/>
    {[-.9,.9].map(x=><group key={x}>
      <Soft at={[x,.68,0]} size={[1.3,1.28,1.1]} color="#779d96"/>
      <Block at={[x,.76,.561]} size={[.025,.96,.025]} color="#426b68"/>
      {[-.3,-.1,.1,.3].map(y=><Block key={y} at={[x,.8+y,.57]} size={[.55,.025,.02]} color="#426b68"/>)}
      <mesh position={[x,.68,.589]}><circleGeometry args={[.12,3]}/><meshBasicMaterial color="#e4d282"/></mesh>
    </group>)}
    <Block at={[0,1.5,-1.35]} size={[4.2,.08,.1]} color="#a5b8b5"/>
    {[-2,-1,0,1,2].map(x=><Block key={x} at={[x,.77,-1.35]} size={[.05,1.5,.05]} color="#a5b8b5"/>)}
  </group>
}
function RecyclingBins() {
  return <group position={[-14.3,0,-15.3]}>{['#65aa93','#71a9c4','#d1b16e'].map((color,n)=><group key={color} position={[n*.65,0,0]}>
    <Soft at={[0,.42,0]} size={[.48,.78,.46]} color={color}/><Block at={[0,.84,0]} size={[.54,.08,.5]} color="#dce7df"/>
    <Block at={[0,.7,.241]} size={[.28,.11,.02]} color="#486774"/>
  </group>)}</group>
}
function Fence({ x, z, length, yaw=0 }) {
  const detail=useMemo(()=>fenceDetails(length),[length])
  return <group position={[x,0,z]} rotation={[0,yaw,0]}><StaticParts parts={detail}/></group>
}

function GardenIslands() {
  const detail=useMemo(()=>gardenDetails(),[])
  return <group><StaticParts parts={detail.hardscape}/><StaticParts parts={detail.planting} foliage/></group>
}

function ShadeTable({ x, z, color }) {
  const detail=useMemo(()=>{
    const parts=[]
    for(const sign of [-1,1]) for(let n=0;n<4;n++) parts.push({at:[sign*.94,.42,-.18+n*.12],size:[.48,.06,.08],color:LANDSCAPE.timber})
    for(const sign of [-1,1]) {
      parts.push({at:[sign*.94,.2,0],size:[.08,.4,.32],color:LANDSCAPE.bronze})
      parts.push({at:[sign*1.16,.63,0],size:[.055,.4,.46],color:LANDSCAPE.bronze})
    }
    parts.push({at:[0,1.22,0],size:[.055,2.4,.055],color:LANDSCAPE.bronze})
    return parts
  },[])
  return <group position={[x,0,z]}>
    <mesh position={[0,.025,0]} receiveShadow><cylinderGeometry args={[1.25,1.25,.05,20]}/><meshStandardMaterial color={LANDSCAPE.limestone} roughness={.9}/></mesh>
    <mesh position={[0,.77,0]} castShadow><cylinderGeometry args={[.62,.62,.1,16]}/><meshStandardMaterial color={LANDSCAPE.timber}/></mesh>
    <mesh position={[0,.82,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.57,.015,4,20]}/><meshStandardMaterial color={LANDSCAPE.bronze}/></mesh>
    <StaticParts parts={detail}/>
    <mesh position={[0,2.49,0]} castShadow><coneGeometry args={[1.17,.35,8]}/><meshStandardMaterial color={color} roughness={.9}/></mesh>
    <mesh position={[0,2.71,0]}><sphereGeometry args={[.065,6,4]}/><meshStandardMaterial color={LANDSCAPE.bronze}/></mesh>
  </group>
}

export default memo(function FleetCampusProps({ bounds, reducedMotion }) {
  return <group>
    <mesh position={[-47,-.015,3]} receiveShadow><cylinderGeometry args={[6,6,.025,36]}/><meshStandardMaterial color={ARCHITECTURE.grass}/></mesh>
    <Fountain reducedMotion={reducedMotion}/><Pergola/><CoffeeKiosk/><BicycleRack/><UtilityYard/><RecyclingBins/>
    <FlowerBed x={-51.5} z={-3} width={3}/><FlowerBed x={-48.7} z={5.8} width={2}/>
    <FlowerBed x={-31} z={11.2} width={3.4} color="#ddb997"/>
    <GardenIslands/>
    {CAMPUS_TABLES.map(table=><ShadeTable key={table.x+','+table.z} {...table}/>)}
    <Fence x={-56} z={-7} length={30}/><Fence x={(bounds?.maxX||SITE.bounds.maxX)-1.4} z={-10} length={9}/><Fence x={(bounds?.maxX||SITE.bounds.maxX)-1.4} z={9.2} length={7}/>
    {[31.5,32.5,33.5].map(x=><group key={x} position={[x,0,-13.2]}>
      <Block at={[0,.045,0]} size={[.35,.09,.35]} color="#748d94"/>
      <mesh position={[0,.3,0]} castShadow><coneGeometry args={[.16,.5,8]}/><meshStandardMaterial color="#ddad61"/></mesh>
      <Block at={[0,.32,0]} size={[.16,.07,.16]} color="#f5ebd6"/>
    </group>)}
  </group>
})
