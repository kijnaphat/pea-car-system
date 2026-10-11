'use client'

import { memo, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { CatmullRomCurve3, Vector3 } from 'three'

function Block({ at, size, color, ...props }) {
  return <mesh position={at} castShadow receiveShadow {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.9}/></mesh>
}
function Soft({ at, size, color, ...props }) {
  return <RoundedBox position={at} args={size} radius={Math.min(.12,...size.map(n=>n/3))} smoothness={2} bevelSegments={1} castShadow receiveShadow {...props}><meshStandardMaterial color={color} roughness={.85}/></RoundedBox>
}
function FlowerBed({ x, z, width=2.4, color='#ddb67a' }) {
  return <group position={[x,0,z]}>
    <Soft at={[0,.12,0]} size={[width,.24,1]} color="#eee6d7"/>
    <Soft at={[0,.28,0]} size={[width-.18,.12,.8]} color="#9bcc9d"/>
    {[-.7,-.35,0,.35,.7].map((a,i)=><mesh key={i} position={[a,.4,Math.sin(i)*.22]}><sphereGeometry args={[.13,7,5]}/><meshStandardMaterial color={i%2?color:'#d7a5c6'}/></mesh>)}
  </group>
}
function Fountain() {
  const jets=useMemo(()=>[0,1,2,3].map(n=>{
    const angle=n*Math.PI/2
    return new CatmullRomCurve3([new Vector3(0,1.02,0),new Vector3(Math.cos(angle)*.35,1.45,Math.sin(angle)*.35),new Vector3(Math.cos(angle)*.85,.26,Math.sin(angle)*.85)])
  }),[])
  return <group position={[-47,0,1.2]}>
    <mesh position={[0,.04,0]} receiveShadow><cylinderGeometry args={[3.2,3.2,.08,40]}/><meshStandardMaterial color="#ede6d9"/></mesh>
    <mesh position={[0,.16,0]} castShadow receiveShadow><cylinderGeometry args={[1.8,1.8,.25,36]}/><meshStandardMaterial color="#becdd2"/></mesh>
    <mesh position={[0,.29,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[1.67,.12,6,36]}/><meshStandardMaterial color="#e8f1ed"/></mesh>
    <mesh position={[0,.3,0]}><cylinderGeometry args={[1.53,1.53,.015,36]}/><meshStandardMaterial color="#86c7d3" metalness={.15} roughness={.35}/></mesh>
    <mesh position={[0,.63,0]} castShadow><cylinderGeometry args={[.13,.25,.68,10]}/><meshStandardMaterial color="#afc2c6"/></mesh>
    {jets.map((jet,n)=><mesh key={n}><tubeGeometry args={[jet,16,.025,4,false]}/><meshBasicMaterial color="#c4f1f8" transparent opacity={.8}/></mesh>)}
  </group>
}
function Pergola() {
  return <group position={[-44,0,8]}>
    <Soft at={[0,.05,0]} size={[5.2,.1,4.1]} color="#e0d7c7"/>
    {[-1,1].flatMap(a=>[-1,1].map(b=><Block key={a+'-'+b} at={[a*2.1,1.4,b*1.5]} size={[.16,2.8,.16]} color="#aa8c68"/>))}
    {[-1.5,1.5].map(z=><Block key={z} at={[0,2.77,z]} size={[4.8,.2,.18]} color="#ba9872"/>)}
    {Array.from({length:9},(_,n)=><Block key={n} at={[-2.15+n*.54,2.92,0]} size={[.17,.16,3.8]} color="#c8af8b"/>)}
    <Block at={[0,.53,-.5]} size={[3.8,.13,.72]} color="#b69a75"/>
    <Block at={[0,.89,-.85]} size={[3.8,.58,.11]} color="#b69a75"/>
    {[-1.5,1.5].map(x=><Block key={x} at={[x,.25,-.5]} size={[.12,.5,.65]} color="#7f8e90"/>)}
    <FlowerBed x={-2.55} z={.55} width={1.4}/><FlowerBed x={2.55} z={.55} width={1.4}/>
  </group>
}
function CoffeeKiosk() {
  return <group position={[-6,0,-14.4]}>
    <Soft at={[0,.055,0]} size={[4.2,.11,3.4]} color="#e7dfcf"/>
    <Soft at={[0,.54,0]} size={[3,.98,1.8]} color="#c4af8e"/>
    <Block at={[0,1.06,0]} size={[3.3,.12,2]} color="#f2ead8"/>
    {[-1.5,1.5].map(x=><Block key={x} at={[x,1.4,.66]} size={[.1,2.8,.1]} color="#ad9172"/>)}
    <Soft at={[0,2.73,0]} size={[3.7,.16,2.8]} color="#978aae"/>
    {[-1.4,-.7,0,.7,1.4].map(x=><Block key={x} at={[x,2.6,1.32]} size={[.42,.26,.04]} color="#d1bbdf"/>)}
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
  return <group position={[-26,0,-14.7]}>
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
  return <group position={[x,0,z]} rotation={[0,yaw,0]}>
    {[.45,.95].map(y=><Block key={y} at={[0,y,0]} size={[.06,.08,length]} color="#cad6d3"/>)}
    {Array.from({length:Math.ceil(length/2)+1},(_,n)=><Block key={n} at={[0,.65,-length/2+n*length/Math.ceil(length/2)]} size={[.11,1.3,.11]} color="#b8cbc5"/>)}
  </group>
}

export default memo(function FleetCampusProps() {
  return <group>
    <mesh position={[-47,-.015,3]} receiveShadow><cylinderGeometry args={[6,6,.025,36]}/><meshStandardMaterial color="#c8debc"/></mesh>
    <Fountain/><Pergola/><CoffeeKiosk/><BicycleRack/><UtilityYard/><RecyclingBins/>
    <FlowerBed x={-51.5} z={-3} width={3}/><FlowerBed x={-48.7} z={5.8} width={2}/>
    <FlowerBed x={-31} z={11.2} width={3.4} color="#ddb997"/>
    <Fence x={-56} z={-7} length={30}/><Fence x={50.6} z={-10} length={9}/><Fence x={50.6} z={9.2} length={7}/>
    {[31.5,32.5,33.5].map(x=><group key={x} position={[x,0,-13.2]}>
      <Block at={[0,.045,0]} size={[.35,.09,.35]} color="#748d94"/>
      <mesh position={[0,.3,0]} castShadow><coneGeometry args={[.16,.5,8]}/><meshStandardMaterial color="#ddad61"/></mesh>
      <Block at={[0,.32,0]} size={[.16,.07,.16]} color="#f5ebd6"/>
    </group>)}
  </group>
})
