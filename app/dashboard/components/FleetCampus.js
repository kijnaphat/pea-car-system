'use client'

import { memo, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { Shape, Path, Vector3, CatmullRomCurve3 } from 'three'
import { SITE, SITE_BUILDINGS, SITE_CUSTOMER, SITE_CHARGING } from '@/lib/fleetSiteLayout'
import { roadNetwork, roadDashes } from '@/lib/fleetRoadGeometry'

// Decorative, fictional campus only. No location lookup, textures or network calls.
function Box({ at, size, color, ...props }) {
  return <mesh position={at} castShadow receiveShadow {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.82}/></mesh>
}

function SoftBlock({ at, size, color, radius = .16, ...props }) {
  return <RoundedBox position={at} args={size} radius={Math.min(radius,...size.map(n=>n/3))} smoothness={2} bevelSegments={2} castShadow receiveShadow {...props}><meshStandardMaterial color={color} roughness={.85}/></RoundedBox>
}

function HipRoof({ at, width, depth, rise = 1.1, color = '#91a7ba' }) {
  const points = useMemo(()=>new Float32Array([
    -width/2,0,-depth/2, width/2,0,-depth/2, width/2,0,depth/2, -width/2,0,depth/2,
    -width/2+depth*.45,rise,0, width/2-depth*.45,rise,0,
  ]),[width,depth,rise])
  const indices = useMemo(()=>new Uint16Array([0,4,1,1,4,5,3,2,4,2,5,4,0,3,4,1,5,2]),[])
  return <mesh position={at} castShadow receiveShadow>
    <bufferGeometry onUpdate={geometry=>geometry.computeVertexNormals()}><bufferAttribute attach="attributes-position" args={[points,3]}/><bufferAttribute attach="index" args={[indices,1]}/></bufferGeometry>
    <meshStandardMaterial color={color} roughness={.9} flatShading/>
  </mesh>
}

function RoundCourt({ x, z, radius = 2, color = '#d1e4be' }) {
  return <group position={[x,0,z]}>
    <mesh position={[0,.12,0]} receiveShadow><cylinderGeometry args={[radius,radius,.2,32]}/><meshStandardMaterial color="#eee9de" roughness={1}/></mesh>
    <mesh position={[0,.23,0]} receiveShadow><cylinderGeometry args={[radius-.14,radius-.14,.04,32]}/><meshStandardMaterial color={color} roughness={1}/></mesh>
  </group>
}

function Tree({ x, z, small = false, tone = 0 }) {
  const height = small ? 1.6 : 2.3
  return <group position={[x,0,z]}>
    <Box at={[0,.08,0]} size={[1.6,.16,1.6]} color="#f8faf2"/>
    <Box at={[0,.18,0]} size={[1.4,.08,1.4]} color="#c4dda3"/>
    <mesh position={[0,.85,0]} castShadow><cylinderGeometry args={[.1,.15,1.6,7]}/><meshStandardMaterial color="#b79775"/></mesh>
    <mesh position={[0,height,0]} scale={[.9,1.15,.9]} castShadow><sphereGeometry args={[small ? .62 : .9,12,10]}/><meshStandardMaterial color={['#63c98c','#7bd394','#4bb97e'][tone%3]} roughness={1}/></mesh>
    <mesh position={[-.24,height+.25,.05]} scale={[.8,1,.8]}><sphereGeometry args={[small ? .42 : .6,10,8]}/><meshStandardMaterial color="#8ddd9d" roughness={1}/></mesh>
  </group>
}

function Planter({ x, z, width = 2.6 }) {
  return <group position={[x,0,z]}>
    <Box at={[0,.2,0]} size={[width,.4,.75]} color="#f0ece1"/>
    <Box at={[0,.46,0]} size={[width-.18,.25,.6]} color="#79bb82"/>
    {[-.6,0,.6].map((n,i)=><mesh key={n} position={[n,.64,0]}><sphereGeometry args={[.15,6,5]}/><meshStandardMaterial color={i%2 ? '#e3b1dc' : '#f4de89'}/></mesh>)}
  </group>
}

function Window({ x, y, z, side = false }) {
  return <group position={[x,y,z]} rotation={[0,side ? Math.PI/2 : 0,0]}>
    <Box at={[0,0,0]} size={[.91,1.06,.12]} color="#d2e1eb"/>
    <Box at={[0,0,.075]} size={[.72,.87,.04]} color="#85bbd5"/>
    <Box at={[-.18,0,.1]} size={[.035,.88,.02]} color="#c2e8f2"/>
    <Box at={[0,-.57,.13]} size={[1,.09,.25]} color="#f8fcff"/>
  </group>
}

// Dimensions and landmarks follow the user's supplied site plan.
function Building({ x, z, width, depth, floors, accent, rotation = 0, office = false }) {
  const height = floors * 1.65
  return <group position={[x,0,z]} rotation={[0,rotation,0]}>
    <SoftBlock at={[0,.08,0]} size={[width+1.3,.16,depth+1.3]} color="#e2e6e4"/>
    <SoftBlock at={[0,height/2+.18,0]} size={[width,height,depth]} radius={.22} color="#faf9f4"/>
    <SoftBlock at={[0,.35,0]} size={[width+.12,.45,depth+.12]} color={accent}/>
    {Array.from({length:floors},(_,row)=><group key={row}>
      <Box at={[0,1.65*(row+1)+.05,0]} size={[width+.16,.1,depth+.16]} color="#d5e1e6"/>
      {[-1,1].map(face=><group key={face} rotation={[0,face<0?Math.PI:0,0]}>
        {Array.from({length:Math.floor(depth/1.8)},(_,n)=><Window key={n} x={width/2+.045} y={1+row*1.65} z={-depth/2+1.1+n*1.8} side/>)}
        {[-1,1].map(sign=><Window key={sign} x={sign*width*.27} y={1+row*1.65} z={depth/2+.05}/>)}
      </group>)}
    </group>)}
    <group position={[0,height+.25,0]} rotation={[0,Math.PI/2,0]}>
      <HipRoof at={[0,0,0]} width={depth+.7} depth={width+.7} rise={office ? 1.3 : .8} color={accent}/>
    </group>
    {office && <group position={[width/2+.02,0,0]}>
      <mesh position={[0,height/2+.2,0]} castShadow><cylinderGeometry args={[1.6,1.6,height,24,1,false,0,Math.PI]}/><meshStandardMaterial color="#97c5d8" roughness={.3}/></mesh>
      {[.3,1.95,3.6,5.25,6.85].map(y=><mesh key={y} position={[0,y,0]}><cylinderGeometry args={[1.65,1.65,.12,24,1,false,0,Math.PI]}/><meshStandardMaterial color="#e5edf1"/></mesh>)}
      <SoftBlock at={[1.1,.2,0]} size={[2.6,.3,4]} color="#eeebe1"/>
      <SoftBlock at={[1.2,2.5,0]} size={[3.1,.16,4.1]} color="#c9dfeb"/>
      {[-1,1].map(n=><Box key={n} at={[2.4,1.3,n*1.6]} size={[.13,2.5,.13]} color="#c4d4de"/>)}
    </group>}
  </group>
}

function Office() {
  return <Building {...SITE_BUILDINGS.office}/>
}

function Carport({ x, z, width, depth = 4.5, customer = false }) {
  return <group position={[x,0,z]}>
    <SoftBlock at={[0,.06,0]} size={[width+.5,.12,depth+.5]} color={customer ? '#ece9da' : '#e2e8e8'}/>
    {[-1,1].flatMap(a=>[-1,1].map(b=><Box key={a+'-'+b} at={[a*(width/2-.35),1.45,b*(depth/2-.3)]} size={[.12,2.9,.12]} color="#aab8c2"/>))}
    <group position={[0,3,0]} rotation={[-.08,0,0]}>
      <SoftBlock at={[0,0,0]} size={[width,.18,depth]} color={customer ? '#d4ba7b' : '#a5afca'}/>
      {Array.from({length:Math.floor(width/.5)},(_,n)=><Box key={n} at={[-width/2+.25+n*.5,.12,0]} size={[.04,.04,depth]} color={customer ? '#f2e2b1' : '#d3d9ed'}/>)}
    </group>
  </group>
}

function Person({ x, z, color = '#3eaf9b' }) {
  return <group position={[x,0,z]}>
    <Box at={[0,.66,0]} size={[.26,.62,.23]} color={color}/>
    <mesh position={[0,1.1,0]} castShadow><sphereGeometry args={[.17,8,6]}/><meshStandardMaterial color="#e8bd97"/></mesh>
    {[-1,1].map(n=><group key={n}><Box at={[n*.1,.21,0]} size={[.1,.43,.14]} color="#486779"/><Box at={[n*.18,.61,0]} size={[.08,.45,.1]} color={color}/></group>)}
  </group>
}

function Arrow({ x, z, yaw }) {
  return <group position={[x,.09,z]} rotation={[0,yaw,0]}>
    <Box at={[0,0,0]} size={[.1,.02,1.1]} color="#f9fcff"/>
    {[-1,1].map(n=><Box key={n} at={[n*.2,0,.35]} size={[.09,.02,.55]} color="#f9fcff" rotation={[0,n*.8,0]}/>)}
  </group>
}

function RoadSurface({ polygons, y, color }) {
  const shapes=useMemo(()=>polygons.map(poly=>{
    const shape=new Shape()
    poly.forEach((ring,n)=>{
      const path=n ? new Path() : shape
      ring.forEach(([x,z],i)=>i ? path.lineTo(x,-z) : path.moveTo(x,-z));path.closePath()
      if(n) shape.holes.push(path)
    })
    return shape
  }),[polygons])
  return <mesh rotation={[-Math.PI/2,0,0]} position={[0,y,0]} receiveShadow><shapeGeometry args={[shapes]}/><meshStandardMaterial color={color} roughness={1}/></mesh>
}

function RoadEdge({ ring }) {
  const curve=useMemo(()=>new CatmullRomCurve3(ring.slice(0,-1).map(([x,z])=>new Vector3(x,.065,z)),true,'catmullrom',0),[ring])
  return <mesh><tubeGeometry args={[curve,Math.max(64,ring.length*3),.04,4,true]}/><meshBasicMaterial color="#f4f1df"/></mesh>
}

function Road({ overflowAisles, chargingRows }) {
  const net=useMemo(()=>roadNetwork(overflowAisles,chargingRows),[overflowAisles,chargingRows])
  return <group>
    <RoadSurface polygons={net.pavement} y={-.015} color="#cbd4d5"/>
    <RoadSurface polygons={net.surface} y={.025} color="#82919c"/>
    {net.surface.flatMap(poly=>poly).map((ring,i)=><RoadEdge key={i} ring={ring}/>)}
    {net.routes.flatMap(route=>roadDashes(route)).map((p,i)=><Box key={i} at={[p.x,.05,p.z]} size={[.09,.015,1.2]} color="#fff5d8" rotation={[0,p.yaw,0]}/>)}
  </group>
}

function Lamp({ x, z, yaw = 0 }) {
  return <group position={[x,0,z]} rotation={[0,yaw,0]}>
    <SoftBlock at={[0,.1,0]} size={[.6,.2,.6]} color="#d5d9d5"/>
    <Box at={[0,2.05,0]} size={[.09,4.1,.09]} color="#8e9eae"/>
    <Box at={[.4,4.1,0]} size={[.9,.08,.09]} color="#8e9eae"/>
    <SoftBlock at={[.77,4.04,0]} size={[.45,.09,.28]} color="#f8f3d2"/>
    <Box at={[-.04,4.33,0]} size={[.8,.06,.6]} color="#3f6988" rotation={[0,0,-.18]}/>
  </group>
}

function Bench({ x, z, yaw = 0 }) {
  return <group position={[x,0,z]} rotation={[0,yaw,0]}>
    {[.5,.64,.78].map(a=><SoftBlock key={a} at={[0,.55,a]} size={[1.8,.09,.11]} color="#b89873"/>)}
    <SoftBlock at={[0,.92,.84]} size={[1.8,.38,.08]} color="#b89873"/>
    {[-.65,.65].map(a=><Box key={a} at={[a,.28,.6]} size={[.1,.55,.55]} color="#637480"/>)}
  </group>
}

function Charger({ bay, car }) {
  const cable=useMemo(()=>new CatmullRomCurve3([new Vector3(.32,1.18,-.15),new Vector3(.78,.35,-.5),new Vector3(.72,.24,-.95),new Vector3(.62,.72,-1.35)]),[])
  const charging=car?.status==='charging'
  return <group position={[bay.x,0,bay.z+2.7]}>
    <SoftBlock at={[0,.09,0]} size={[.95,.18,.65]} color="#d3dde0"/>
    <SoftBlock at={[0,.94,0]} size={[.6,1.7,.42]} color="#f5fbff" radius={.1}/>
    <Box at={[0,1.32,-.222]} size={[.43,.35,.025]} color="#233952"/>
    <Box at={[0,1.52,-.241]} size={[.43,.07,.03]} color={charging?'#22c59b':'#72bbd3'}/>
    <Box at={[0,.72,-.228]} size={[.23,.28,.025]} color="#6fa9cd"/>
    <mesh position={[.25,1.78,0]}><sphereGeometry args={[.085,8,8]}/><meshBasicMaterial color={charging?'#22ddbb':'#99b3be'}/></mesh>
    {charging ? <mesh><tubeGeometry args={[cable,20,.035,5,false]}/><meshStandardMaterial color="#183c55"/></mesh>
      : <mesh position={[.38,.94,0]} rotation={[0,Math.PI/2,0]}><torusGeometry args={[.26,.035,5,18]}/><meshStandardMaterial color="#183c55"/></mesh>}
    {[-.6,.6].map(x=><Box key={x} at={[x,.34,-.1]} size={[.09,.68,.09]} color="#dfc77d"/>)}
  </group>
}

function ChargingCanopy({ bays, vehicles }) {
  const rows=Math.ceil(bays.length/4)
  return Array.from({length:rows},(_,row)=>{
    const z=SITE_CHARGING.z+row*SITE_CHARGING.rowSpacing
    return <group key={row}>
      <SoftBlock at={[SITE_CHARGING.x,.04,z]} size={[SITE_CHARGING.width+.5,.08,SITE_CHARGING.depth+.5]} color="#d3e9e5"/>
      <group position={[SITE_CHARGING.x,0,z]}>
        {[-7.03,6.75].flatMap(x=>[-1,1].map(b=><Box key={x+'-'+b} at={[x,1.8,b*2.8]} size={[.12,3.6,.12]} color="#8cabb5"/>))}
        <Box at={[0,3.6,-2.95]} size={[14.8,.16,.18]} color="#9dbbc8"/>
        <Box at={[0,3.6,2.95]} size={[14.8,.16,.18]} color="#9dbbc8"/>
        <mesh position={[0,3.62,0]} receiveShadow><boxGeometry args={[14.8,.06,6.4]}/><meshStandardMaterial color="#b6d8ed" transparent opacity={.3} depthWrite={false} roughness={.35}/></mesh>
        {[-5.2,-1.75,1.75,5.2].map(x=><group key={x} position={[x,3.74,1.45]} rotation={[-.12,0,0]}>
          <SoftBlock at={[0,0,0]} size={[2.9,.08,2.2]} color="#426885"/>
          {[-.95,0,.95].map(a=><Box key={a} at={[a,.05,0]} size={[.025,.012,2.1]} color="#90b6d0"/>)}
          {[-.7,0,.7].map(a=><Box key={a} at={[0,.05,a]} size={[2.8,.012,.025]} color="#90b6d0"/>)}
        </group>)}
      </group>
      {bays.slice(row*4,row*4+4).map(bay=>{
        const car=vehicles.find(c=>c.chargingBay?.code===bay.code && c.status==='charging')
        return <group key={bay.code}>
          <Box at={[bay.x,.095,bay.z]} size={[3.1,.015,4.8]} color={car?'#a1dcdf':'#c8e4e3'}/>
          {[-1,1].map(a=><Box key={a} at={[bay.x+a*1.53,.108,bay.z]} size={[.055,.014,4.8]} color="#f8fcff"/>)}
          <Box at={[bay.x,.108,bay.z-2.4]} size={[3.1,.014,.055]} color="#f8fcff"/>
          <Box at={[bay.x,.2,bay.z+1.65]} size={[1.3,.17,.18]} color="#688a96"/>
          <Charger bay={bay} car={car}/>
        </group>
      })}
    </group>
  })
}

function Gate({ x, z, yaw = 0 }) {
  return <group position={[x,0,z]} rotation={[0,yaw,0]}>
    <Box at={[-3.5,.75,0]} size={[.45,1.5,.45]} color="#edbc52"/>
    <group position={[-3.5,1.5,0]} rotation={[0,0,Math.PI/3]}>
      <Box at={[1.75,0,0]} size={[3.5,.12,.18]} color="#fff"/>
      {[.7,1.7,2.7].map(n=><Box key={n} at={[n,0,0]} size={[.4,.14,.2]} color="#c66b72"/>)}
    </group>
    <Box at={[5.1,1.05,0]} size={[2,2.1,2.4]} color="#fff1d8"/>
    <HipRoof at={[5.1,2.2,0]} width={2.5} depth={2.8} rise={.45} color="#9db7cb"/>
    <Box at={[5.1,1.25,1.21]} size={[1.45,.7,.03]} color="#8eb9cd"/>
  </group>
}

export default memo(function FleetCampus({ bounds, overflowAisles = [], chargingBays = [], vehicles = [] }) {
  // Irregular precinct silhouette, not a square campus invented around the cars.
  const outline=useMemo(()=>{
    const shape=new Shape()
    const points=[[-57,-31],[-42,-42],[-16,-17],[SITE.exit.x-6.5,-17],[SITE.exit.x-6.5,-23],[bounds.maxX-1,-23],[bounds.maxX-1,bounds.maxZ],[-35,bounds.maxZ],[-55,9],[-57,-18]]
    points.forEach(([x,z],i)=>i ? shape.lineTo(x,-z) : shape.moveTo(x,-z))
    shape.closePath()
    return shape
  },[bounds.maxX,bounds.maxZ])
  return <group>
    <mesh position={[0,-.5,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
      <extrudeGeometry args={[outline,{depth:.45,bevelEnabled:false}]}/><meshStandardMaterial color="#e4ece7" roughness={1}/>
    </mesh>
    <Road overflowAisles={overflowAisles} chargingRows={Math.max(1,Math.ceil(chargingBays.length/4))}/>
    {[-17,-5,9,23,37,51].map(x=><Arrow key={x} x={x} z={SITE.outgoingLane} yaw={Math.PI/2}/>)}
    <Arrow x={-28} z={-8} yaw={Math.atan2(20,27)}/><Arrow x={SITE.exit.x} z={-12} yaw={Math.PI}/>
    <Office/>
    <Building {...SITE_BUILDINGS.entry}/>
    <Building {...SITE_BUILDINGS.lower}/>
    <Building {...SITE_BUILDINGS.rear}/>
    <Carport {...SITE_CUSTOMER} customer/>
    <ChargingCanopy bays={chargingBays} vehicles={vehicles}/>
    {/* Pavements, planted beds and furniture stay outside the vehicle corridors. */}
    <SoftBlock at={[-26,.025,-12.6]} size={[1.2,.05,4.8]} color="#eee8d9"/>
    {[4,16,28,40,52].map((x,i)=><Lamp key={x} x={x} z={-11.1} yaw={i%2?Math.PI:0}/>)}
    {[5,20,32].map(x=><group key={x}><Planter x={x} z={12.5}/><Tree x={x+1.7} z={12.6} small/></group>)}
    <Bench x={-28} z={10.5} yaw={.25}/><Bench x={-24} z={-17} yaw={Math.PI}/>
    <group position={[-35,.06,-17.55]} rotation={[0,Math.atan2(20,27),0]}>
      {Array.from({length:8},(_,n)=><Box key={n} at={[-3.1+n*.88,0,0]} size={[.43,.014,1.55]} color="#f5f2e5"/>)}
    </group>
    {/* Entrance hedge follows the diagonal; rear trees flank the dead end. */}
    {Array.from({length:13},(_,n)=><group key={n}>
      <SoftBlock at={[-35+n*1.12,.28,-26+n*1.5]} size={[1.8,.5,1.8]} color="#cde0b3"/>
      <Tree x={-35+n*1.12} z={-26+n*1.5} small tone={n}/>
    </group>)}
    {[[63,-8],[66,-8],[68,-8],[-25,12],[-27,9]].map(([x,z],i)=><Tree key={i} x={x} z={z} tone={i}/>)}
    <RoundCourt x={-29} z={6.5} radius={1.6}/><Tree x={-29} z={6.5} small/>
    <Planter x={SITE_BUILDINGS.rear.x} z={5.8} width={3.4}/><Planter x={-24} z={6.5}/>
    {[[-26,4.7],[-22,6.5],[-16,13.7],[-2,13.7],[62,5.2],[-31,-4]].map(([x,z],i)=><Person key={i} x={x} z={z} color={i%2 ? '#e5bc53' : '#39a88f'}/>)}
    <Gate x={-37} z={-20.2} yaw={Math.atan2(20,27)}/>
    <Gate x={SITE.exit.x} z={-14.5}/>
    {/* Dead-end barrier is beyond the right-hand exit, never on a traffic route. */}
    <Box at={[SITE.roadEnd,.8,0]} size={[.24,1.6,8.8]} color="#eff2ee"/>
    {[-3,-1,1,3].map(z=><Box key={z} at={[SITE.roadEnd-.15,.9,z]} size={[.08,.28,1]} color="#dfac55"/>)}
  </group>
})
