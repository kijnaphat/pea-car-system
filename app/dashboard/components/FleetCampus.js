'use client'

import { memo } from 'react'

// Decorative, fictional campus only. No location lookup, textures or network calls.
function Box({ at, size, color, ...props }) {
  return <mesh position={at} castShadow receiveShadow {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.82}/></mesh>
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
    <Box at={[-4,.14,-8]} size={[17,.28,9.7]} color="#dde6ea"/>
    <Box at={[-5,2.4,-8.3]} size={[12,4.6,6.5]} color="#f7f9fc"/>
    <Box at={[3.6,1.9,-8.3]} size={[4.8,3.6,6.5]} color="#ecf1f6"/>
    <Box at={[-5,2.45,-4.99]} size={[12.2,.18,.28]} color="#c3d3df"/>
    <Box at={[-5,4.78,-8.3]} size={[12.5,.2,7]} color="#cad7e2"/>
    <Box at={[-5,4.93,-8.3]} size={[11.7,.12,6.2]} color="#e3eaf2"/>
    <Box at={[3.6,3.8,-8.3]} size={[5.1,.2,7]} color="#cbd9e3"/>
    {[-1,1].map(n=><Box key={n} at={[-5+n*6.05,5.08,-8.3]} size={[.12,.38,7]} color="#f7fbff"/>)}
    {[-1,1].map(n=><Box key={n} at={[-5,5.08,-8.3+n*3.4]} size={[12.3,.38,.12]} color="#f7fbff"/>)}
    {[0,1].flatMap(row=>Array.from({length:7},(_,col)=><Window key={`${row}-${col}`} x={-10+col*1.5} y={1.25+row*2.2} z={-4.98}/>))}
    {[0,1].flatMap(row=>[0,1,2,3].map(col=><Window key={`${row}-${col}`} x={-11.05} y={1.25+row*2.2} z={-10.6+col*1.5} side/>))}
    {[0,1].flatMap(row=>[0,1,2,3].map(col=><Window key={`${row}-${col}`} x={6.04} y={1+row*1.65} z={-10.6+col*1.5} side/>))}
    {[2.3,3.7,5.1].map(x=><Window key={x} x={x} y={2.15} z={-4.98}/>)}
    <Box at={[-3.9,1.15,-4.88]} size={[1.6,2.2,.14]} color="#578fac"/>
    <Box at={[-3.9,1.15,-4.77]} size={[.06,2.2,.04]} color="#dfeef7"/>
    <Box at={[-3.9,2.55,-3.85]} size={[3.9,.22,2.4]} color="#e4ebf5"/>
    {[-5.5,-2.3].map(x=><Box key={x} at={[x,1.24,-3]} size={[.16,2.5,.16]} color="#d2dce9"/>)}
    {[0,1,2].map(n=><Box key={n} at={[-3.9,.12+n*.1,-2.5-n*.4]} size={[3.9,.24+n*.2,.6]} color="#ecf0f5"/>)}
    <Box at={[-8,5.25,-8.8]} size={[2.4,.58,1.4]} color="#b1bfce"/>
    {[0,1].map(n=><mesh key={n} position={[-8.55+n*1.1,5.56,-8.8]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.38,12]}/><meshStandardMaterial color="#647a8e"/></mesh>)}
    <Planter x={-8.5} z={-3.8}/><Planter x={.1} z={-3.8}/><Planter x={4.7} z={-3.8}/>
    <Box at={[-14,.13,-8.4]} size={[4.5,.26,7.8]} color="#d7e7d1"/>
    <Box at={[-14,1.2,-9.5]} size={[3.5,2.4,2.9]} color="#e7e0f6"/>
    <Box at={[-14,2.5,-9.5]} size={[4,.23,3.5]} color="#ab91ca"/>
    <Box at={[-14,1.25,-8.02]} size={[2.3,1.2,.06]} color="#8ebbd0"/>
    <Tree x={-14} z={-5.6} small/>
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
  const depth = end + 16
  return <group>
    <Box at={[0,-.42,(end-12)/2]} size={[38,.65,depth]} color="#d8e2e9"/>
    <Box at={[0,-.06,(end-12)/2]} size={[37.7,.1,depth-.25]} color="#edf2ef"/>
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
    <Box at={[12.2,.09,-7.7]} size={[8.1,.16,8.3]} color="#c4e5dd"/>
    <Box at={[12.2,.2,-7.7]} size={[7.8,.05,8]} color="#e7f4ec"/>
    <SolarCanopy x={12.2} z={-7} charging/>
    <SolarCanopy x={-10} z={16} width={8.5} depth={3.8}/>
    <Box at={[-10,.09,end+1.2]} size={[11,.16,2.5]} color="#d4e7bd"/>
    {[-14,-10,-6].map(x=><Tree key={x} x={x} z={end+1.2} small/>)}
    <Box at={[-17.3,.09,(end-12)/2]} size={[1.9,.16,end+14]} color="#d6e8c7"/>
    <Box at={[17.3,.09,(end-12)/2]} size={[1.9,.16,end+14]} color="#d6e8c7"/>
    {[-11,-5,1,7,13,19].filter(z=>z<end).flatMap((z,i)=>[-17.3,17.3].map(x=><Tree key={`${x}-${z}`} x={x} z={z} tone={i}/>))}
    {[-9,-3,3,9,15].map((x,i)=><Tree key={x} x={x} z={-12.3} small tone={i}/>)}
    <Planter x={8.2} z={-4.4} width={1.8}/>
    {[[-2,-2.4],[7,-3],[9,-10],[-15,9.7],[5,end-3],[-6,end+1]].map(([x,z],i)=><Person key={i} x={x} z={z} color={i%3===0 ? '#e5bc53' : '#39a88f'}/>)}
    {[-1,1].map(sign=><group key={sign}>
      <Box at={[sign*18.7,.4,(end-12)/2]} size={[.12,.12,end+14]} color="#f7fbff"/>
      <Box at={[sign*18.7,1.1,(end-12)/2]} size={[.1,.08,end+14]} color="#b9cbd0"/>
      {Array.from({length:Math.ceil((end+14)/3)},(_,i)=><Box key={i} at={[sign*18.7,.65,-12.5+i*3]} size={[.15,1.3,.15]} color="#e4ecee"/>)}
    </group>)}
    <Gate end={end}/>
  </group>
})
