'use client'

import { memo, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { Shape } from 'three'
import { SITE, SITE_BUILDINGS, SITE_ROADS } from '@/lib/fleetSiteLayout'

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
      {Array.from({length:Math.floor(depth/1.8)},(_,n)=><Window key={n} x={width/2+.045} y={1+row*1.65} z={-depth/2+1.1+n*1.8} side/>)}
      {[-1,1].map(sign=><Window key={sign} x={sign*width*.27} y={1+row*1.65} z={depth/2+.05}/>)}
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

function Road({ from, to, width = 8.8, markings = true }) {
  const dx=to[0]-from[0],dz=to[1]-from[1],length=Math.hypot(dx,dz)
  const yaw=Math.atan2(dx,dz)
  return <group position={[(from[0]+to[0])/2,0,(from[1]+to[1])/2]} rotation={[0,yaw,0]}>
    <SoftBlock at={[0,-.07,0]} size={[width+.5,.18,length+.2]} color="#dce2e2" radius={.05}/>
    <Box at={[0,.035,0]} size={[width,.06,length]} color="#a3afb9"/>
    {[-1,1].map(n=><Box key={n} at={[n*(width/2-.2),.076,0]} size={[.07,.015,length]} color="#f9fcfd"/>)}
    {markings && Array.from({length:Math.floor(length/3)},(_,n)=><Box key={n} at={[0,.078,-length/2+1.5+n*3]} size={[.09,.02,1.2]} color="#f9fcfd"/>)}
  </group>
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

export default memo(function FleetCampus({ bounds, overflowAisles = [] }) {
  // Irregular precinct silhouette, not a square campus invented around the cars.
  const outline=useMemo(()=>{
    const shape=new Shape()
    const points=[[-57,-31],[-42,-42],[-16,-11],[32,-11],[32,-23],[48,-23],[48,bounds.maxZ],[-30,bounds.maxZ],[-53,6],[-57,-18]]
    points.forEach(([x,z],i)=>i ? shape.lineTo(x,-z) : shape.moveTo(x,-z))
    shape.closePath()
    return shape
  },[bounds.maxZ])
  return <group>
    <mesh position={[0,-.5,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
      <extrudeGeometry args={[outline,{depth:.45,bevelEnabled:false}]}/><meshStandardMaterial color="#e4ece7" roughness={1}/>
    </mesh>
    {SITE_ROADS.map(road=><Road key={road.key} {...road}/>)}
    {overflowAisles.length>0 && <Road from={[SITE.exit.x,0]} to={[SITE.exit.x,Math.max(...overflowAisles)]} width={3.8}/>}
    {overflowAisles.map(z=><Road key={z} from={[0,z]} to={[SITE.exit.x,z]} width={5.2}/>)}
    {/* Intersection surfaces cover overlapping edge stripes at the junctions. */}
    <Box at={[SITE.roadStart,.081,0]} size={[5.5,.015,7.5]} color="#a3afb9"/>
    <Box at={[SITE.exit.x,.081,0]} size={[6.3,.015,8.5]} color="#a3afb9"/>
    <Box at={[SITE.exit.x,.081,SITE.exit.z]} size={[6.3,.015,5.5]} color="#a3afb9"/>
    {[-17,-5,9,23].map(x=><Arrow key={x} x={x} z={SITE.outgoingLane} yaw={Math.PI/2}/>)}
    <Arrow x={-28} z={-8} yaw={Math.atan2(20,27)}/><Arrow x={36} z={-12} yaw={Math.PI}/>
    <Office/>
    <Building {...SITE_BUILDINGS.entry}/>
    <Building {...SITE_BUILDINGS.lower}/>
    <Building {...SITE_BUILDINGS.rear}/>
    <Carport x={-20.2} z={-7.5} width={7.5} customer/>
    <Carport x={-12} z={10} width={7.5}/><Carport x={-3.5} z={10} width={6.5}/>
    {/* Entrance hedge follows the diagonal; rear trees flank the dead end. */}
    {Array.from({length:13},(_,n)=><group key={n}>
      <SoftBlock at={[-35+n*1.12,.28,-26+n*1.5]} size={[1.8,.5,1.8]} color="#cde0b3"/>
      <Tree x={-35+n*1.12} z={-26+n*1.5} small tone={n}/>
    </group>)}
    {[[41,-8],[44,-8],[46,-8],[-25,12],[-27,9]].map(([x,z],i)=><Tree key={i} x={x} z={z} tone={i}/>)}
    <RoundCourt x={-29} z={6.5} radius={1.6}/><Tree x={-29} z={6.5} small/>
    <Planter x={40} z={5.8} width={3.4}/><Planter x={-24} z={6.5}/>
    {[[-26,4.7],[-22,6.5],[-15,12.5],[-6,12.5],[40,5.2],[-31,-4]].map(([x,z],i)=><Person key={i} x={x} z={z} color={i%2 ? '#e5bc53' : '#39a88f'}/>)}
    <Gate x={-37} z={-20.2} yaw={Math.atan2(20,27)}/>
    <Gate x={36} z={-14.5}/>
    {/* Dead-end barrier is beyond the right-hand exit, never on a traffic route. */}
    <Box at={[46,.8,0]} size={[.24,1.6,8.8]} color="#eff2ee"/>
    {[-3,-1,1,3].map(z=><Box key={z} at={[45.85,.9,z]} size={[.08,.28,1]} color="#dfac55"/>)}
  </group>
})
