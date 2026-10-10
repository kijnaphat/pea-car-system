'use client'

import { memo } from 'react'

// A diagram, not a surveyed site: static geometry with no textures or requests.
const TEAL = '#14b8a6'
function shade(color, factor) {
  return '#'+color.slice(1).match(/../g).map(value=>Math.round(parseInt(value,16)*factor).toString(16).padStart(2,'0')).join('')
}
function Box({ at, size, color = '#fff', ...props }) {
  const full = color.length===4 ? '#'+color.slice(1).split('').map(c=>c+c).join('') : color
  return <mesh position={at} {...props}><boxGeometry args={size}/>{[.97,1,1,.96,.99,.97].map((factor,i)=><meshBasicMaterial key={i} attach={'material-'+i} color={shade(full,factor)} toneMapped={false}/>)}</mesh>
}
function Outline({ x, z, width, depth, y = .07, color = TEAL }) {
  return <group>
    {[-1,1].map(n=><group key={n}>
      <Box at={[x+n*width/2,y,z]} size={[.045,.025,depth]} color={color}/>
      <Box at={[x,y,z+n*depth/2]} size={[width,.025,.045]} color={color}/>
    </group>)}
  </group>
}

function SimpleTree({ x, z, tone = 0, small = false }) {
  return <group position={[x,0,z]}>
    <mesh position={[0,.6,0]}><cylinderGeometry args={[.075,.1,1.2,7]}/><meshBasicMaterial color="#c9b9a5" toneMapped={false}/></mesh>
    <mesh position={[0,small ? 1.25 : 1.7,0]}><sphereGeometry args={[small ? .53 : .75,12,10]}/><meshBasicMaterial color={['#86efac','#6ee7b7','#4ade80'][tone%3]} toneMapped={false}/></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.022,0]}><circleGeometry args={[small ? .45 : .6,16]}/><meshBasicMaterial color="#e6efec"/></mesh>
  </group>
}

const OfficeBuilding = memo(function OfficeBuilding() {
  return <group>
    <Box at={[-4,.08,-8]} size={[17,.16,9]} color="#edf3f3"/>
    <Outline x={-4} z={-8} width={17} depth={9} y={.17}/>
    <Box at={[-5,2.12,-8.2]} size={[12,4.1,6.3]} color="#ffffff"/>
    <Box at={[3.4,1.6,-8.2]} size={[4.7,3.05,6.3]} color="#f8fbfb"/>
    <Box at={[-5,4.23,-8.2]} size={[12.35,.16,6.65]} color="#e8eff3"/>
    <Box at={[3.4,3.19,-8.2]} size={[5,.16,6.65]} color="#e8eff3"/>
    <Outline x={-5} z={-8.2} width={12.35} depth={6.65} y={4.32} color="#bdcfd1"/>
    <Outline x={3.4} z={-8.2} width={5} depth={6.65} y={3.28} color="#bdcfd1"/>
    {[0,1].flatMap(row=>Array.from({length:7},(_,col)=><Box key={row+'-'+col} at={[-10+col*1.5,1.1+row*1.7,-5.02]} size={[.82,.92,.055]} color="#badbe7"/>))}
    {[0,1].flatMap(row=>[0,1,2].map(col=><Box key={row+'-'+col} at={[5.78,.95+row*1.3,-10.2+col*1.7]} size={[.045,.8,.8]} color="#badbe7"/>))}
    <Box at={[-3.8,1,-4.99]} size={[1.25,1.95,.075]} color="#91cfcf"/>
    <Box at={[-3.8,2.15,-4.1]} size={[3,.13,1.9]} color="#d5ebef"/>
    <Box at={[-3.8,.15,-3.8]} size={[3,.15,1.7]} color="#e3eced"/>
    <Box at={[-3.8,.23,-4.2]} size={[3,.14,.8]} color="#f7fbfb"/>
    <Box at={[-5,2.12,-4.97]} size={[12,.055,.075]} color="#d5e5e5"/>
    <Box at={[3.4,.33,-4.97]} size={[4.7,.075,.08]} color="#14b8a6"/>
    <Box at={[-14,1.1,-9]} size={[3,2.2,2.8]} color="#ffffff"/>
    <Box at={[-14,2.25,-9]} size={[3.25,.13,3.05]} color="#d7e9ef"/>
    <Outline x={-14} z={-9} width={3.25} depth={3.05} y={2.33} color="#b8d8d5"/>
    <Box at={[-14,1.1,-7.56]} size={[1.9,.8,.055]} color="#b9dfe5"/>
  </group>
})

function ChargingCourt() {
  return <group>
    <Box at={[12,.05,-7]} size={[7.5,.07,7]} color="#f0f7f7"/>
    <Outline x={12} z={-7} width={7.5} depth={7}/>
    {[-1,1].flatMap(a=>[-1,1].map(b=><Box key={a+'-'+b} at={[12+a*3,1.35,-7+b*1.7]} size={[.1,2.7,.1]} color="#bed6dd"/>))}
    <Box at={[12,2.75,-7]} size={[7.2,.12,4.4]} color="#c5e3ee"/>
    {[0,1,2,3].map(n=><Box key={n} at={[9.25+n*1.8,2.83,-7]} size={[.025,.012,4.2]} color="#edf9fb"/>)}
    {[-2,0,2].map(n=><group key={n}>
      <Box at={[12+n,.65,-8.4]} size={[.42,1.3,.35]} color="#ffffff"/>
      <Box at={[12+n,.85,-8.2]} size={[.3,.4,.025]} color="#6bcac3"/>
    </group>)}
  </group>
}

function Arrow({ x, z, reverse = false }) {
  return <group position={[x,.06,z]} rotation={[0,reverse ? Math.PI : 0,0]}>
    <Box at={[0,0,0]} size={[.075,.012,.75]} color="#fff"/>
    {[-1,1].map(n=><Box key={n} at={[n*.13,0,.25]} size={[.065,.012,.36]} color="#fff" rotation={[0,n*.8,0]}/>)}
  </group>
}

function InternalRoad({ end }) {
  return <group>
    <Box at={[2,.025,(end-2)/2]} size={[4.6,.035,end+7]} color="#e3e9ec"/>
    {[-1,1].map(n=><Box key={n} at={[2+n*2.3,.055,(end-2)/2]} size={[.045,.015,end+7]} color="#9bd5ce"/>)}
    {[3.3,8.3,13.3,18.3].filter(z=>z<end).map(z=><group key={z}>
      <Box at={[-8,.024,z]} size={[16,.03,1.9]} color="#e3e9ec"/>
      <Box at={[11,.024,z]} size={[13,.03,1.9]} color="#e3e9ec"/>
      {[-1,1].map(n=><group key={n}><Box at={[-8,.045,z+n*.96]} size={[16,.012,.03]} color="#b8d8d5"/><Box at={[11,.045,z+n*.96]} size={[13,.012,.03]} color="#b8d8d5"/></group>)}
    </group>)}
    {Array.from({length:Math.floor((end+4)/3)},(_,n)=><Box key={n} at={[2,.05,-2+n*3]} size={[.055,.012,.8]} color="#fff"/>)}
    {[7,14,end+1].map(z=><group key={z}><Arrow x={.85} z={z}/><Arrow x={3.15} z={z} reverse/></group>)}
  </group>
}

function OfficeGate({ end }) {
  return <group position={[2,0,end]}>
    <Box at={[-2.55,.7,0]} size={[.6,1.4,.6]} color="#fff"/>
    <Box at={[2.55,.7,0]} size={[.6,1.4,.6]} color="#fff"/>
    <Box at={[-2.55,1.46,0]} size={[.72,.09,.72]} color="#c6e6e5"/>
    <Box at={[2.55,1.46,0]} size={[.72,.09,.72]} color="#c6e6e5"/>
    <Box at={[0,1.15,0]} size={[4.6,.1,.13]} color="#fff"/>
    {[-1.5,-.5,.5,1.5].map(n=><Box key={n} at={[n,1.15,.075]} size={[.35,.1,.025]} color="#a898ce"/>)}
    <Box at={[4.5,1,-1]} size={[2.2,2,2.3]} color="#ffffff"/>
    <Box at={[4.5,2.06,-1]} size={[2.45,.12,2.55]} color="#d8e9ef"/>
    <Box at={[4.5,1.1,.18]} size={[1.5,.7,.025]} color="#b9dfe5"/>
    <Outline x={4.5} z={-1} width={2.55} depth={2.75}/>
  </group>
}

export default memo(function FleetCampus({ end }) {
  const center = (end-10)/2
  const depth = end+18
  return <group>
    <Box at={[0,-.03,center]} size={[38,.035,depth]} color="#f4f7f7"/>
    <Outline x={0} z={center} width={38} depth={depth} y={.005} color="#b8d8d5"/>
    <InternalRoad end={end}/>
    <OfficeBuilding/>
    <ChargingCourt/>
    <OfficeGate end={end}/>
    {[[-17,-10],[-12,-12],[-3,-12],[7,-12],[17,-8],[-17,0],[17,3],[-17,10],[17,13],[-14,end+1],[13,end+1]].map(([x,z],i)=><SimpleTree key={i} x={x} z={z} tone={i} small={i%3===0}/>)}
  </group>
})
