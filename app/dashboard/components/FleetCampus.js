'use client'

import { memo, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'

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

const Office = memo(function Office() {
  return <group>
    {/* Larger HQ precinct, expanded to the rear without moving a single vehicle slot. */}
    <SoftBlock at={[-2,.14,-13]} size={[26,.28,18]} radius={.12} color="#e4e9e9"/>
    <SoftBlock at={[-4,3.3,-13.5]} size={[18,6.3,10]} radius={.32} color="#faf9f4"/>
    <SoftBlock at={[6.5,2.9,-10.5]} size={[7,5.5,11]} radius={.3} color="#f4f6f5"/>
    <SoftBlock at={[-4,6.54,-13.5]} size={[18.7,.22,10.7]} color="#d4dfe7"/>
    <HipRoof at={[-4,6.67,-13.5]} width={18.9} depth={10.8} rise={1.5}/>
    <SoftBlock at={[6.5,5.73,-10.5]} size={[7.6,.18,11.6]} color="#d4dfe7"/>
    <group position={[6.5,5.85,-10.5]} rotation={[0,Math.PI/2,0]}><HipRoof at={[0,0,0]} width={11.7} depth={7.7} rise={1.1} color="#a4b9c6"/></group>
    {/* Glazed rounded atrium breaks up the rectilinear office wings. */}
    <mesh position={[-2,3.35,-8.5]} castShadow><cylinderGeometry args={[2.2,2.2,6.4,24,1,false,-Math.PI/2,Math.PI]}/><meshStandardMaterial color="#9fc9dc" roughness={.3} transparent opacity={.88}/></mesh>
    {[.25,2.4,4.6,6.55].map(y=><mesh key={y} position={[-2,y,-8.5]}><cylinderGeometry args={[2.24,2.24,.12,24,1,false,-Math.PI/2,Math.PI]}/><meshStandardMaterial color="#e5edf1"/></mesh>)}
    {[-.8,0,.8].map(angle=><Box key={angle} at={[-2+Math.sin(angle)*2.23,3.4,-8.5+Math.cos(angle)*2.23]} size={[.07,6.1,.07]} color="#e5edf1"/>)}
    {[0,1,2].flatMap(row=>[-11.7,-10.1,-8.5,-6.9,-5.3,1.4,3].map(x=><Window key={row+'-'+x} x={x} y={1.1+row*1.9} z={-8.44}/>))}
    {[0,1,2].flatMap(row=>[-17.3,-15.6,-13.9,-12.2,-10.5].map(z=><Window key={row+'-'+z} x={-13.06} y={1.1+row*1.9} z={z} side/>))}
    {[0,1].flatMap(row=>[-14.5,-12.7,-10.9,-9.1,-7.3].map(z=><Window key={row+'-'+z} x={10.04} y={1.35+row*2.1} z={z} side/>))}
    {[4.5,6.2,7.9,9.3].map(x=><Window key={x} x={x} y={3.8} z={-4.94}/>)}
    <Box at={[-4,2.35,-8.42]} size={[18,.12,.12]} color="#c6d5d7"/>
    <Box at={[6.5,2.4,-4.93]} size={[7,.12,.12]} color="#c6d5d7"/>
    <SoftBlock at={[-2,.28,-5.5]} size={[6,.35,4.3]} color="#e8e7df"/>
    <mesh position={[-2,2.7,-6.2]} castShadow><cylinderGeometry args={[3.1,3.1,.18,32,1,false,-Math.PI/2,Math.PI]}/><meshStandardMaterial color="#d6e6ed"/></mesh>
    {[-4.5,.5].map(x=><mesh key={x} position={[x,1.45,-5]} castShadow><cylinderGeometry args={[.12,.14,2.5,10]}/><meshStandardMaterial color="#c4d4de"/></mesh>)}
    {[0,1,2].map(n=><SoftBlock key={n} at={[-2,.08+n*.1,-3.2-n*.35]} size={[5.4,.16+n*.2,.5]} radius={.06} color="#f0eee6"/>)}
    <Box at={[-2,1.35,-6.23]} size={[1.5,2.3,.07]} color="#659aaf"/>
    <Box at={[-2,1.35,-6.16]} size={[.045,2.3,.025]} color="#edf6f7"/>
    <Planter x={-8} z={-7.2} width={3.8}/><Planter x={6.8} z={-4.1} width={3.5}/>
    <RoundCourt x={-12.8} z={-5.5} radius={2.1}/><Tree x={-12.8} z={-5.5}/>
    <RoundCourt x={12.5} z={-4.5} radius={1.7}/><Tree x={12.5} z={-4.5} small/>
    <SoftBlock at={[-14,1.3,-20.5]} size={[4.5,2.6,3.2]} color="#ebe7f3"/>
    <HipRoof at={[-14,2.66,-20.5]} width={4.9} depth={3.6} rise={.7} color="#b1a0c8"/>
    <Window x={-14} y={1.25} z={-18.85}/>
  </group>
})

function SolarCanopy({ x, z, width = 7, depth = 4.5, charging = false }) {
  return <group position={[x,0,z]}>
    {[-1,1].flatMap(a=>[-1,1].map(b=><Box key={`${a}-${b}`} at={[a*(width/2-.5),1.5,b*(depth/2-.4)]} size={[.12,3,.12]} color="#98acb9"/>))}
    <group position={[0,3.1,0]} rotation={[-.1,0,0]}>
      <Box at={[0,0,0]} size={[width,.17,depth]} color="#d8e3ee"/>
      {[0,1].flatMap(row=>Array.from({length:6},(_,col)=><group key={`${row}-${col}`} position={[-width/2+.6+col*(width-.3)/6,.13,-depth/4+row*depth/2]}>
        <Box at={[0,0,0]} size={[(width-.8)/6,.06,depth/2-.18]} color="#719bce"/>
        <Box at={[0,.04,0]} size={[.018,.015,depth/2-.22]} color="#b8d4ef"/>
      </group>))}
    </group>
    {charging && [-2,0,2].map(n=><group key={n} position={[n,0,-1.1]}>
      <Box at={[0,.75,0]} size={[.56,1.5,.4]} color="#f6fbff"/>
      <Box at={[0,1,.22]} size={[.4,.4,.035]} color="#247bb8"/>
      <Box at={[0,.45,.22]} size={[.4,.3,.035]} color="#61cdb5"/>
      <mesh position={[.38,.85,.1]} rotation={[0,0,.25]}><torusGeometry args={[.24,.035,6,12,Math.PI*1.6]}/><meshStandardMaterial color="#304555"/></mesh>
    </group>)}
  </group>
}

function Person({ x, z, color = '#3eaf9b' }) {
  return <group position={[x,0,z]}>
    <Box at={[0,.66,0]} size={[.26,.62,.23]} color={color}/>
    <mesh position={[0,1.1,0]} castShadow><sphereGeometry args={[.17,8,6]}/><meshStandardMaterial color="#e8bd97"/></mesh>
    {[-1,1].map(n=><group key={n}><Box at={[n*.1,.21,0]} size={[.1,.43,.14]} color="#486779"/><Box at={[n*.18,.61,0]} size={[.08,.45,.1]} color={color}/></group>)}
  </group>
}

function Arrow({ x, z, reverse = false }) {
  return <group position={[x,.085,z]} rotation={[0,reverse ? Math.PI : 0,0]}>
    <Box at={[0,0,0]} size={[.09,.015,.9]} color="#f9fcff"/>
    {[-1,1].map(n=><Box key={n} at={[n*.16,0,.28]} size={[.08,.015,.43]} color="#f9fcff" rotation={[0,n*.8,0]}/>)}
  </group>
}

function Gate({ end }) {
  return <group position={[2,0,end]}>
    <Box at={[4,.12,-1.7]} size={[3.6,.24,4]} color="#e6e8dd"/>
    <Box at={[4,1.1,-1.4]} size={[2.5,2.2,2.7]} color="#fff6d9"/>
    <Box at={[4,2.3,-1.4]} size={[3.1,.25,3.3]} color="#94b4c9"/>
    <Box at={[4,1.35,.02]} size={[1.8,.85,.05]} color="#87bbd7"/>
    <Box at={[2.73,1.35,-1.4]} size={[.05,.85,1.6]} color="#87bbd7"/>
    <Box at={[-2.15,.7,0]} size={[.5,1.4,.5]} color="#f1c04d"/>
    <Box at={[.08,1.38,0]} size={[4.5,.14,.2]} color="#fdfcff"/>
    {[-1.5,-.5,.5,1.5].map(n=><Box key={n} at={[n,1.39,0]} size={[.42,.16,.22]} color="#bd555e"/>)}
    <Box at={[4,.6,-3.4]} size={[.75,1.2,.08]} color="#7851b4"/>
    {[0,1,2,3,4,5].map(n=><Box key={n} at={[0,.08,1.2+n*.22]} size={[4.6,.025,.1]} color={n%2 ? '#717f86' : '#e6c365'}/>)}
    <Tree x={-4} z={-1} small/><Planter x={7} z={-1}/>
  </group>
}

export default memo(function FleetCampus({ end }) {
  const depth = end + 28
  const center = (end-22)/2
  return <group>
    <SoftBlock at={[0,-.42,center]} size={[38,.65,depth]} radius={.21} color="#d8e2e9"/>
    <SoftBlock at={[0,-.06,center]} size={[37.7,.1,depth-.25]} radius={.03} color="#edf2ef"/>
    <Box at={[2,.025,(end-2)/2]} size={[4.6,.05,end+7]} color="#acbac4"/>
    {[3.4,8.4,13.4,18.4].filter(z=>z<end).map(z=><group key={z}>
      <Box at={[0,.025,z]} size={[35,.05,1.9]} color="#acbac4"/>
      <Box at={[-8,.06,z-1.02]} size={[16,.07,.12]} color="#f9fbfc"/>
      <Box at={[11,.06,z-1.02]} size={[13,.07,.12]} color="#f9fbfc"/>
    </group>)}
    {Array.from({length:Math.floor((end+4)/2.6)},(_,n)=><Box key={n} at={[2,.068,-2+n*2.6]} size={[.065,.015,1]} color="#f7fafb"/>)}
    {[7,12,17,end+2].map(z=><group key={z}><Arrow x={.85} z={z}/><Arrow x={3.15} z={z} reverse/></group>)}
    <Box at={[-4,.06,-2.3]} size={[24,.13,1.2]} color="#faf9ef"/>
    {Array.from({length:9},(_,n)=><Box key={n} at={[.12+n*.47,.074,-1.5]} size={[.25,.025,1.4]} color="#fbfdff"/>)}
    <Office/>
    <SoftBlock at={[14.5,.09,-17]} size={[7,.16,8.3]} color="#c4e5dd"/>
    <Box at={[14.5,.2,-17]} size={[6.6,.05,8]} color="#e7f4ec"/>
    <SolarCanopy x={14.5} z={-17} width={6.3} charging/>
    <SolarCanopy x={-10} z={16} width={8.5} depth={3.8}/>
    <Box at={[-10,.09,end+1.2]} size={[11,.16,2.5]} color="#d4e7bd"/>
    {[-14,-10,-6].map(x=><Tree key={x} x={x} z={end+1.2} small/>)}
    <SoftBlock at={[-17.3,.09,center]} size={[1.9,.16,end+26]} color="#d6e8c7"/>
    <SoftBlock at={[17.3,.09,center]} size={[1.9,.16,end+26]} color="#d6e8c7"/>
    {[-11,-5,1,7,13,19].filter(z=>z<end).flatMap((z,i)=>[-17.3,17.3].map(x=><Tree key={`${x}-${z}`} x={x} z={z} tone={i}/>))}
    {[-9,-3,3,9,15].map((x,i)=><Tree key={x} x={x} z={-23.3} small tone={i}/>)}
    <Planter x={8.2} z={-4.4} width={1.8}/>
    {[[-2,-2.4],[7,-3],[9,-10],[-15,9.7],[5,end-3],[-6,end+1]].map(([x,z],i)=><Person key={i} x={x} z={z} color={i%3===0 ? '#e5bc53' : '#39a88f'}/>)}
    {[-1,1].map(sign=><group key={sign}>
      <Box at={[sign*18.7,.4,center]} size={[.12,.12,end+26]} color="#f7fbff"/>
      <Box at={[sign*18.7,1.1,center]} size={[.1,.08,end+26]} color="#b9cbd0"/>
      {Array.from({length:Math.ceil((end+26)/3)},(_,i)=><Box key={i} at={[sign*18.7,.65,-24.5+i*3]} size={[.15,1.3,.15]} color="#e4ecee"/>)}
    </group>)}
    <Gate end={end}/>
  </group>
})
