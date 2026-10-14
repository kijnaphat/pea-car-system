'use client'

import { memo, useMemo } from 'react'
import { DoubleSide, Shape } from 'three'
import { THAMAKA_BUILDINGS, THAMAKA_CANOPIES, THAMAKA_YARD, thamakaOutline, thamakaLayout, thamakaRoadNetwork } from '@/lib/thamakaSiteLayout'
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
  const {x,z,width:w,depth:d,floors,roof,atrium,industrial,solar}=building,h=industrial?3.2:floors*1.65
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
    {industrial?<>{[-1,1].map(sign=><Block key={sign} at={[w/2+.03,1.35,sign*d*.25]} size={[.07,2.3,3.7]} color="#80908c"/>)}
      <Block at={[0,h+.38,0]} size={[.13,.15,d+.9]} color="#8d9997"/></>:<><StaticParts parts={facade.frames}/><StaticParts parts={facade.glass} glass/><StaticParts parts={facade.trim}/></>}
    {solar&&<SolarPanels width={w} depth={d} y={h+.8} atrium={atrium}/>}
  </group>
}
function SolarPanels({width,depth,y,atrium}) {
  const parts=useMemo(()=>{
    const out=[],rows=atrium?[-depth/2+1.8,depth/2-1.8]:[-depth*.22,depth*.22]
    for(const z of rows)for(let x=-width/2+2.1;x<width/2-1;x+=2.5) {
      out.push(part([x,y,z],[2.25,.07,2.1],'#385a70'))
      for(const offset of [-.7,0,.7])out.push(part([x+offset,y+.05,z],[.025,.012,2.06],'#9bb8c3'))
      out.push(part([x,y+.05,z],[2.22,.012,.025],'#9bb8c3'))
    }
    return out
  },[width,depth,y,atrium])
  return <StaticParts parts={parts}/>
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
    const trees=[...Array.from({length:24},(_,n)=>[-39+Math.sin(n)*.55,s.landMinZ+1+n*(s.landMaxZ-s.landMinZ-4)/24]),
      ...Array.from({length:27},(_,n)=>[-36+n*2.7,s.landMinZ-1.7+Math.sin(n)*.7]),
      ...Array.from({length:23},(_,n)=>[-37+n*2.8,s.landMaxZ-.9+Math.sin(n)*.6]),
      ...Array.from({length:25},(_,n)=>[-49+n*3.15,35]),...Array.from({length:25},(_,n)=>[-49+n*3.15,42.7]),
      [30,0],[31,-8],[29,-12],[43,-22],[43,-17],[42,-11],[43,-5],[19,12],[7,23],[-22,9],[-22,2],[-22,-5]]
    trees.filter(([x,z])=>!THAMAKA_BUILDINGS.some(b=>{
      if(b.atrium&&Math.abs(x-b.x)<b.width/2-4.2&&Math.abs(z-b.z)<b.depth/2-4.2)return false
      return Math.abs(x-b.x)<b.width/2+1.3&&Math.abs(z-b.z)<b.depth/2+1.3
    })).forEach(([x,z],n)=>{
      const scale=z>33?.6:.95+(n%5)*.13
      fixtures.push(part([x,.8,z],[.16,1.6,.16],'#8f7959'))
      treeCrown(false,n).forEach(p=>leaves.push({...p,color:['#598c55','#7aa35b','#417b50','#8da862'][n%4],at:[x+p.at[0]*scale,p.at[1]*scale,z+p.at[2]*scale],size:p.size.map(v=>v*scale)}))
      fixtures.push(part([x,.09,z],[1.5,.18,1.5],'#aeb798'))
    })
    for(const [x,z] of [[-22,-20],[10,-29],[30,-30],[-24,25],[10,25],[43,20]]) {
      fixtures.push(part([x,2.1,z],[.1,4.2,.1],'#76868a'),part([x+.45,4.2,z],[1,.08,.1],'#76868a'),part([x+.9,4.15,z],[.35,.09,.3],'#f9eacf'))
    }
    const outline=thamakaOutline(vehicles)
    outline.forEach((a,i)=>{
      const b=outline[(i+1)%outline.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),yaw=Math.atan2(b[0]-a[0],b[1]-a[1])
      for(let d=0;d<length;d+=2) {
        const t=d/length,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t
        if(x>40&&z>-1&&z<15)continue
        fixtures.push(part([x,.8,z],[.1,1.6,.1],'#c4c5b5'),part([x+Math.sin(yaw)*.9,.9,z+Math.cos(yaw)*.9],[.055,.8,1.8],'#a4b0a0',[0,yaw,0]),part([x,.06,z],[.085,.018,1.25],'#c46063',[0,yaw,0]))
      }
    })
    // Stored materials remain behind the parking row, clear of vehicle routes.
    for(let n=0;n<16;n++) {
      const x=-35+(n%8)*3.3,z=25+Math.floor(n/8)*1.5
      fixtures.push(part([x,.4,z],[2.6,.8,.95],n%3?'#b1b5ad':'#a99a81'))
      for(let m=0;m<3;m++)fixtures.push(part([x-1+m*.8,.91,z],[.6,.22,.8],'#d1cdbc'))
    }
    for(const x of [11,27]) {
      fixtures.push(part([x,.55,24],[2.2,.14,.6],'#af936e'),part([x,.93,24.27],[2.2,.5,.075],'#af936e'))
      for(const sign of [-1,1])fixtures.push(part([x+sign*.8,.28,24],[.12,.55,.5],'#52676b'))
    }
    fixtures.push(part([29,2.2,24],[.08,4.4,.08],'#a9b0ab'),part([29.3,3.85,24],[.6,.7,.03],'#8b51b2'))
    return {fixtures,leaves}
  },[s.landMinZ,s.landMaxZ,vehicles])
  return <><StaticParts parts={landscape.fixtures}/><StaticParts parts={landscape.leaves} foliage/></>
}
export default memo(function ThamakaCampus({vehicles=[],chargingBays=[]}) {
  const site=useMemo(()=>thamakaLayout(vehicles),[vehicles])
  const outline=useMemo(()=>{
    const shape=new Shape();thamakaOutline(vehicles).forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();return shape
  },[vehicles])
  const net=useMemo(()=>thamakaRoadNetwork(vehicles),[vehicles])
  const yard=useMemo(()=>{const shape=new Shape();THAMAKA_YARD.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();return shape},[])
  const markings=useMemo(()=>net.routes.flatMap(route=>roadDashes(route,site)).map(p=>part([p.x,.06,p.z],[.085,.018,1.2],'#eee9d2',[0,p.yaw,0])),[net,site])
  return <group>
    <Block at={[(site.bounds.minX+site.bounds.maxX)/2,-.65,(site.bounds.minZ+site.bounds.maxZ)/2]} size={[site.bounds.maxX-site.bounds.minX,.45,site.bounds.maxZ-site.bounds.minZ]} color="#aeaa85"/>
    <mesh position={[0,-.27,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><extrudeGeometry args={[outline,{depth:.28,bevelEnabled:false}]}/><meshStandardMaterial color="#d2cfbf" roughness={1}/></mesh>
    <Block at={[-11,-.4,39]} size={[80,.35,8]} color="#81966d"/>
    <Block at={[-11,-.14,39]} size={[80,.08,5.3]} color="#315c6b"/>
    <Block at={[-11,-.07,39]} size={[80,.012,4.8]} color="#3b7783"/>
    {[-1,1].map(sign=><Block key={sign} at={[-11,-.12,39+sign*3.4]} size={[80,.25,.5]} color="#92a079"/>)}
    <mesh position={[0,.008,0]} rotation={[-Math.PI/2,0,0]} receiveShadow><shapeGeometry args={[yard]}/><meshStandardMaterial color="#bfc0b6" roughness={1}/></mesh>
    <RoadSurface polygons={net.pavement} y={-.015} color="#b8b9ab"/>
    <RoadSurface polygons={net.surface} y={.025} color="#728080"/>
    {net.surface.flatMap(poly=>poly).map((ring,n)=><RoadEdge key={n} ring={ring}/>)}
    <StaticParts parts={markings}/>
    {Array.from({length:12},(_,n)=><Block key={n} at={[-50+n*.4,-.2,-9]} size={[.025,.025,55]} color="#958e70"/>)}
    {THAMAKA_BUILDINGS.map(building=><Building key={building.key} building={building}/>)}
    <Canopy site={THAMAKA_CANOPIES.rear}/><Canopy site={THAMAKA_CANOPIES.customer}/>
    <Canopy site={{...THAMAKA_CANOPIES.charging,z:-5.5+Math.max(0,Math.ceil(chargingBays.length/4)-1)*5,depth:17.5+Math.max(0,Math.ceil(chargingBays.length/4)-1)*10}}
      charging bays={chargingBays} vehicles={vehicles}/>
    <GateArrows/>
    <Landscape vehicles={vehicles}/>
  </group>
})
function GateArrows() {
  return <group>{[{x:45,z:5,yaw:-2.3,color:'#2eac82'},{x:46,z:11,yaw:.85,color:'#d65a5d'}].map(a=><group key={a.z} position={[a.x,.07,a.z]} rotation={[0,a.yaw,0]}>
    <Block at={[0,0,0]} size={[.18,.015,3]} color={a.color}/>
    {[-1,1].map(sign=><Block key={sign} at={[sign*.33,0,1.3]} size={[.14,.015,1.2]} rotation={[0,sign*.6,0]} color={a.color}/>)}</group>)}</group>
}
