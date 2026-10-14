'use client'

import { memo, useMemo } from 'react'
import { DoubleSide, Shape } from 'three'
import { THAMAKA_BUILDINGS, THAMAKA_CANOPIES, thamakaOutline, thamakaLayout, thamakaRoadNetwork } from '@/lib/thamakaSiteLayout'
import { roadDashes } from '@/lib/fleetRoadGeometry'
import { facadeParts, treeCrown, canopyStructure } from '@/lib/fleetArchitecture'
import { StaticParts } from './FleetArchitecture'
import { RoadSurface, RoadEdge } from './FleetCampus'

const part=(at,size,color,rotation)=>({at,size,color,...(rotation?{rotation}:{})})
function Block({at,size,color,...props}) {
  return <mesh position={at} castShadow receiveShadow {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.85}/></mesh>
}
function Gable({width,depth,color,rise=.9,y=0}) {
  const shape=useMemo(()=>({vertices:new Float32Array([
    -width/2,0,-depth/2,width/2,0,-depth/2,0,rise,-depth/2,
    -width/2,0,depth/2,width/2,0,depth/2,0,rise,depth/2,
  ]),indices:new Uint16Array([0,2,5,0,5,3,2,1,4,2,4,5,0,1,2,3,5,4])}),[width,depth,rise])
  return <mesh position={[0,y,0]} castShadow receiveShadow><bufferGeometry onUpdate={g=>g.computeVertexNormals()}>
    <bufferAttribute attach="attributes-position" args={[shape.vertices,3]}/><bufferAttribute attach="index" args={[shape.indices,1]}/>
  </bufferGeometry><meshStandardMaterial color={color} roughness={.9} side={DoubleSide}/></mesh>
}
function Building({building}) {
  const {x,z,width:w,depth:d,floors,roof,atrium}=building,h=floors*1.65
  const facade=useMemo(()=>facadeParts({width:w,depth:d,floors}),[w,d,floors])
  const detailing=useMemo(()=>{
    const a=[]
    for(let n=0;n<=floors;n++)a.push(part([0,.2+n*1.65,0],[w+.25,.12,d+.25],'#f0eee7'))
    return a
  },[w,d,floors])
  return <group position={[x,0,z]}>
    <Block at={[0,.05,0]} size={[w+1.2,.12,d+1.2]} color="#b9bbb1"/>
    {atrium ? <>
      {[-1,1].map(sign=><group key={sign}>
        <Block at={[sign*(w/2-2),h/2+.2,0]} size={[4,h,d]} color="#e5e3d9"/>
        <Block at={[0,h/2+.2,sign*(d/2-2)]} size={[w-8,h,4]} color="#e5e3d9"/>
        <Block at={[sign*(w/2-1.8),h+.37,0]} size={[4.2,.22,d+.5]} color={roof}/>
        <Block at={[0,h+.37,sign*(d/2-1.8)]} size={[w-7.2,.22,4.2]} color={roof}/>
        <Block at={[sign*(w/2+.15),h+.58,0]} size={[.18,.42,d+.55]} color="#f3f1e7"/>
        <Block at={[0,h+.58,sign*(d/2+.15)]} size={[w+.55,.42,.18]} color="#f3f1e7"/>
      </group>)}
      <Block at={[0,.15,0]} size={[w-8,.06,d-8]} color="#b5c5a3"/>
      <mesh position={[0,.2,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[1.15,24]}/><meshStandardMaterial color="#d9d3bf"/></mesh>
      <Block at={[w/2+.35,.15,0]} size={[.75,.3,4.3]} color="#d8d4c8"/>
      <Block at={[w/2+1.15,2.5,0]} size={[2.6,.18,4.8]} color="#bab3a0"/>
      {[-1,1].map(sign=><Block key={sign} at={[w/2+2.2,1.25,sign*1.95]} size={[.12,2.5,.12]} color="#eee9d9"/>)}
      <Block at={[w/2+.18,1.25,0]} size={[.03,1.9,1.8]} color="#46666f"/>
    </> : <>
      <Block at={[0,h/2+.2,0]} size={[w,h,d]} color="#e5e3d9"/>
      <StaticParts parts={detailing}/>
      <Gable width={w+.9} depth={d+.9} y={h+.27} color={roof}/>
    </>}
    <StaticParts parts={facade.frames}/><StaticParts parts={facade.glass} glass/><StaticParts parts={facade.trim}/>
  </group>
}
function Canopy({site,charging=false,bays=[],vehicles=[]}) {
  const structure=useMemo(()=>canopyStructure(site.width,site.depth,3.4),[site.width,site.depth])
  const ribs=useMemo(()=>Array.from({length:21},(_,n)=>part([-site.width/2+n*site.width/20,3.57,0],[.035,.04,site.depth+.4],'#d9d5c8')),[site.width,site.depth])
  return <group position={[site.x,0,site.z]}>
    <Block at={[0,.07,0]} size={[site.width+.7,.14,site.depth+.7]} color={charging?'#c4d6cf':'#c8c7b9'}/>
    <StaticParts parts={structure}/>
    <Block at={[0,3.5,0]} size={[site.width+.4,.11,site.depth+.5]} color={charging?'#929f9c':'#c6b994'}/>
    <StaticParts parts={ribs}/>
    {charging && [-4.7,0,4.7].map(x=><group key={x} position={[x,3.64,.65]} rotation={[-.13,0,0]}>
      <Block at={[0,0,0]} size={[3.7,.08,3.8]} color="#3b5868"/>
      {[-1.2,0,1.2].map(z=><Block key={z} at={[0,.055,z]} size={[3.6,.015,.025]} color="#8cacb9"/>)}
      {[-1.2,0,1.2].map(x=><Block key={x} at={[x,.055,0]} size={[.025,.015,3.7]} color="#8cacb9"/>)}
    </group>)}
    {bays.map(bay=>{
      const x=bay.x-site.x,z=bay.z-site.z,active=vehicles.some(c=>c.status==='charging'&&c.chargingBay?.code===bay.code)
      return <group key={bay.code} position={[x,0,z]}>
        {[-1,1].map(sign=><Block key={sign} at={[sign*1.5,.15,0]} size={[.05,.015,4.5]} color="#f7f9ed"/>)}
        <Block at={[0,.15,-2.25]} size={[3,.015,.055]} color="#f7f9ed"/>
        <Block at={[0,.98,2.65]} size={[.65,1.8,.4]} color="#f1f5ef"/>
        <Block at={[0,1.35,2.42]} size={[.42,.35,.035]} color="#264a59"/>
        <Block at={[0,1.63,2.42]} size={[.42,.075,.035]} color={active?'#33e8bc':'#7abecb'}/>
        <mesh position={[.42,.8,2.56]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.23,.03,6,14]}/><meshStandardMaterial color="#2f4348"/></mesh>
      </group>
    })}
  </group>
}
function Landscape({vehicles}) {
  const s=thamakaLayout(vehicles)
  const landscape=useMemo(()=>{
    const fixtures=[],leaves=[]
    const trees=[...Array.from({length:22},(_,n)=>[-51+(n%3)*.9,-25+n*2.25]),
      ...Array.from({length:Math.floor((s.exit.x+52)/3.5)},(_,n)=>[-48+n*3.5, -29+Math.sin(n)*1.3]),
      ...Array.from({length:Math.floor((s.exit.x+8)/5)},(_,n)=>[-11+n*5,23]),
      [-32,22],[-43,24],[-38,14],[-29,-26],[-17,-20],[-4,-20],[9,-20],[25,-21]]
    trees.forEach(([x,z],n)=>{
      const scale=.95+(n%5)*.13
      fixtures.push(part([x,.8,z],[.16,1.6,.16],'#8f7959'))
      treeCrown(false,n).forEach(p=>leaves.push({...p,at:[x+p.at[0]*scale,p.at[1]*scale,z+p.at[2]*scale],size:p.size.map(v=>v*scale)}))
      fixtures.push(part([x,.09,z],[1.5,.18,1.5],'#aeb798'))
    })
    for(const x of [-29,-13,12,32,s.exit.x+4]) {
      fixtures.push(part([x,2.1,-16],[.1,4.2,.1],'#76868a'),part([x+.45,4.2,-16],[1,.08,.1],'#76868a'),part([x+.9,4.15,-16],[.35,.09,.3],'#f9eacf'))
    }
    for(const z of [-26,-22,-18,-14,-10,-6,-2,2,6,10,14,18,22]) {
      fixtures.push(part([-53,.8,z],[.1,1.6,.1],'#b5b8ac'),part([-53,.9,z+1.8],[.075,.8,3.55],'#a9b5a9'))
    }
    // Front fence: explicit gate openings line up with both animation routes.
    for(let x=-50;x<s.exit.x+7;x+=1.6) {
      if(Math.abs(x-s.entrance.x)<5.3||Math.abs(x-s.exit.x)<4.1)continue
      fixtures.push(part([x,.8,28],[.12,1.6,.12],'#bebcaf'),part([x+.7,.8,28],[1.4,.9,.055],'#9aa99c'))
    }
    for(const x of [-41,-33]) {
      fixtures.push(part([x,.55,24],[2.2,.14,.6],'#af936e'),part([x,.93,24.27],[2.2,.5,.075],'#af936e'))
      for(const sign of [-1,1])fixtures.push(part([x+sign*.8,.28,24],[.12,.55,.5],'#52676b'))
    }
    for(const x of [s.entrance.x-4.5,s.entrance.x+4.5,s.exit.x-3.2,s.exit.x+3.2])fixtures.push(part([x,.9,28],[.45,1.8,.45],'#d7d1be'))
    fixtures.push(part([-28.5,2.2,26.2],[.08,4.4,.08],'#a9b0ab'),part([-28.2,3.85,26.2],[.6,.7,.03],'#8b51b2'))
    return {fixtures,leaves}
  },[s.exit.x,s.entrance.x])
  return <><StaticParts parts={landscape.fixtures}/><StaticParts parts={landscape.leaves} foliage/></>
}
export default memo(function ThamakaCampus({vehicles=[],chargingBays=[]}) {
  const site=useMemo(()=>thamakaLayout(vehicles),[vehicles])
  const frontageCenter=(site.bounds.minX+site.bounds.maxX)/2,frontageWidth=site.bounds.maxX-site.bounds.minX
  const outline=useMemo(()=>{
    const shape=new Shape();thamakaOutline(vehicles).forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();return shape
  },[vehicles])
  const net=useMemo(()=>thamakaRoadNetwork(vehicles),[vehicles])
  const markings=useMemo(()=>net.routes.flatMap(route=>roadDashes(route,site)).map(p=>part([p.x,.06,p.z],[.085,.018,1.2],'#eee9d2',[0,p.yaw,0])),[net,site])
  return <group>
    <Block at={[(site.bounds.minX+site.bounds.maxX)/2,-.65,7]} size={[site.bounds.maxX-site.bounds.minX+8,.45,94]} color="#b1b798"/>
    <mesh position={[0,-.27,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><extrudeGeometry args={[outline,{depth:.28,bevelEnabled:false}]}/><meshStandardMaterial color="#d2cfbf" roughness={1}/></mesh>
    <Block at={[frontageCenter,-.25,43]} size={[frontageWidth,.45,7.5]} color="#899c78"/>
    <Block at={[frontageCenter,-.14,43]} size={[frontageWidth,.08,4.7]} color="#3f7779"/>
    <Block at={[frontageCenter,-.07,43]} size={[frontageWidth,.012,4.1]} color="#608f89"/>
    {[-1,1].map(sign=><Block key={sign} at={[frontageCenter,-.12,43+sign*3.3]} size={[frontageWidth,.25,.5]} color="#adae86"/>)}
    <Block at={[frontageCenter,-.31,49]} size={[frontageWidth,.1,3]} color="#c1b694"/>
    <RoadSurface polygons={net.pavement} y={-.015} color="#b8b9ab"/>
    <RoadSurface polygons={net.surface} y={.025} color="#728080"/>
    {net.surface.flatMap(poly=>poly).map((ring,n)=><RoadEdge key={n} ring={ring}/>)}
    <StaticParts parts={markings}/>
    {Array.from({length:12},(_,n)=><Block key={n} at={[-59+n*.62,-.2,-9]} size={[.025,.025,41]} color="#999777"/>)}
    {THAMAKA_BUILDINGS.map(building=><Building key={building.key} building={building}/>)}
    <Canopy site={THAMAKA_CANOPIES.customer}/>
    {Array.from({length:Math.ceil(chargingBays.length/4)},(_,row)=><Canopy key={row} site={{...THAMAKA_CANOPIES.charging,z:9.5+row*10}}
      charging bays={chargingBays.slice(row*4,row*4+4)} vehicles={vehicles}/>)}
    <Landscape vehicles={vehicles}/>
  </group>
})
