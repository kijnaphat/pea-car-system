'use client'

import { memo, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import { Shape, Path, Vector3, CatmullRomCurve3 } from 'three'
import { SITE, SITE_BUILDINGS, SITE_CUSTOMER, SITE_CHARGING, SITE_HEDGE, SITE_HEDGE_BED, SITE_MOTORCYCLES, siteLayout } from '@/lib/fleetSiteLayout'
import { roadNetwork, roadDashes } from '@/lib/fleetRoadGeometry'
import { ARCHITECTURE, facadeParts, officeRoofParts, pitchedRoofParts, ancillaryEntranceParts, treeCrown } from '@/lib/fleetArchitecture'
import { ArchitecturalCanopy, StaticParts } from './FleetArchitecture'
import FleetSurfaceMaterial from './FleetSurfaceMaterial'
import { curbJoints, raisedCurbRuns } from '@/lib/fleetSurfaceMaterials'
import { LandscapeInstances } from './FleetCampusProps'
import { hipRoofMesh } from '@/lib/fleetRoofGeometry'

// Decorative, fictional campus only. No location lookup, textures or network calls.
function Box({ at, size, color, ...props }) {
  return <mesh position={at} castShadow receiveShadow {...props}><boxGeometry args={size}/><meshStandardMaterial color={color} roughness={.82}/></mesh>
}

function SoftBlock({ at, size, color, radius = .16, ...props }) {
  return <RoundedBox position={at} args={size} radius={Math.min(radius,...size.map(n=>n/3))} smoothness={2} bevelSegments={2} castShadow receiveShadow {...props}><meshStandardMaterial color={color} roughness={.85}/></RoundedBox>
}

function HipRoof({ at, width, depth, rise = 1.1, color = '#91a7ba' }) {
  const { points, indices } = useMemo(()=>hipRoofMesh(width,depth,rise),[width,depth,rise])
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

function Tree({ x, z, small = false, tone = 0, planted = false }) {
  const crown = useMemo(() => treeCrown(small, tone), [small, tone])
  const trunk = small ? 1.35 : 1.9
  return <group position={[x,0,z]}>
    {!planted && <><Box at={[0,.08,0]} size={[1.6,.16,1.6]} color={ARCHITECTURE.stone}/>
    <Box at={[0,.18,0]} size={[1.4,.08,1.4]} color={ARCHITECTURE.grass}/></>}
    <mesh position={[0,trunk/2+.18,0]} castShadow><cylinderGeometry args={[.085,.14,trunk,7]}/><meshStandardMaterial color="#8e7a61" roughness={1}/></mesh>
    <LandscapeInstances parts={crown}/>
  </group>
}

function Planter({ x, z, width = 2.6 }) {
  return <group position={[x,0,z]}>
    <Box at={[0,.2,0]} size={[width,.4,.75]} color="#f0ece1"/>
    <Box at={[0,.46,0]} size={[width-.18,.25,.6]} color="#79bb82"/>
    {[-.6,0,.6].map((n,i)=><mesh key={n} position={[n,.64,0]}><sphereGeometry args={[.15,6,5]}/><meshStandardMaterial color={i%2 ? '#e3b1dc' : '#f4de89'}/></mesh>)}
  </group>
}

// Dimensions and landmarks follow the user's supplied site plan.
function Building({ x, z, width, depth, floors, accent, rotation = 0, office = false }) {
  const height = floors * ARCHITECTURE.floorHeight
  const facade = useMemo(() => facadeParts({ width, depth, floors }), [width, depth, floors])
  const roof = useMemo(() => officeRoofParts({ width, depth }), [width, depth])
  const roofSeams = useMemo(() => pitchedRoofParts(depth + .7, width + .7), [width, depth])
  const paving = useMemo(() => {
    const parts = []
    for (let z = -depth / 2; z <= depth / 2; z += .85) parts.push({ at: [0, .17, z], size: [width + 1.15, .005, .012], color: '#bab7aa' })
    for (const x of [-width / 2 - .4, width / 2 + .4]) parts.push({ at: [x, .173, 0], size: [.012, .005, depth + 1.15], color: '#bab7aa' })
    return parts
  }, [width, depth])
  const floorEdges = useMemo(() => {
    const parts = []
    for (let row = 0; row < floors; row++) {
      const y = ARCHITECTURE.floorHeight * (row + 1)
      for (const sign of [-1, 1]) {
        parts.push({ at: [sign * (width / 2 + .12), y, 0], size: [.13, .13, depth + .32], color: ARCHITECTURE.frame })
        parts.push({ at: [0, y, sign * (depth / 2 + .12)], size: [width + .32, .13, .13], color: ARCHITECTURE.frame })
        parts.push({ at: [sign * (width / 2 + .125), y - .09, 0], size: [.06, .035, depth + .28], color: ARCHITECTURE.steel })
        parts.push({ at: [0, y - .09, sign * (depth / 2 + .125)], size: [width + .28, .035, .06], color: ARCHITECTURE.steel })
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push({ at: [sx * (width / 2 - .08), height / 2 + .18, sz * (depth / 2 + .08)], size: [.2, height, .12], color: ARCHITECTURE.frame })
    return parts
  }, [width, depth, floors, height])
  const facadeDetails = useMemo(() => [...floorEdges, ...facade.frames, ...facade.trim, ...facade.shading], [floorEdges, facade])
  const entrance = useMemo(() => {
    const parts = []
    if (office) {
      for (let n = 0; n <= 10; n++) {
        const angle = n * Math.PI / 10
        parts.push({ at: [Math.sin(angle) * 1.65, height / 2 + .2, Math.cos(angle) * 1.65], size: [.055, height, .09], color: ARCHITECTURE.frame, rotation: [0, angle, 0] })
      }
      for (const sign of [-1, 1]) parts.push({ at: [2.4, 1.3, sign * 1.6], size: [.1, 2.5, .1], color: ARCHITECTURE.bronze })
      for (let n = 0; n < 9; n++) parts.push({ at: [1.2, 2.6, -1.7 + n * .425], size: [3, .06, .045], color: ARCHITECTURE.bronze })
      parts.push({ at: [1.63, 1.26, -.57], size: [.08, 2.2, .08], color: ARCHITECTURE.frame })
      parts.push({ at: [1.63, 1.26, .57], size: [.08, 2.2, .08], color: ARCHITECTURE.frame })
      parts.push({ at: [1.67, 2.33, 0], size: [.08, .08, 1.25], color: ARCHITECTURE.frame })
      parts.push({ at: [1.675, 1.26, 0], size: [.03, 1.96, .035], color: ARCHITECTURE.frame })
      parts.push({ at: [1.715, 1.18, .1], size: [.05, .36, .035], color: ARCHITECTURE.bronze })
    } else {
      // A small recessed glazed lobby and stone steps fit inside the same apron.
      parts.push(...ancillaryEntranceParts({ depth, floors }))
    }
    return parts
  }, [office, height, depth, floors])
  return <group position={[x,0,z]} rotation={[0,rotation,0]}>
    <SoftBlock at={[0,.08,0]} size={[width+1.3,.16,depth+1.3]} color={ARCHITECTURE.paving}/>
    <StaticParts parts={paving}/>
    <SoftBlock at={[0,height/2+.18,0]} size={[width,height,depth]} radius={.05} color={ARCHITECTURE.wall}/>
    <SoftBlock at={[0,.35,0]} size={[width+.12,.34,depth+.12]} color={ARCHITECTURE.stone}/>
    <StaticParts parts={facadeDetails}/><StaticParts parts={facade.glass} glass/>
    <StaticParts parts={facade.reflections} glass/>
    {office ? <group position={[0,height+.22,0]}>
      <Box at={[0,0,0]} size={[width+.35,.22,depth+.35]} color={ARCHITECTURE.roof}/>
      <StaticParts parts={roof.stone}/><StaticParts parts={roof.metal} metal/>
      <StaticParts parts={roof.solar} glass/><StaticParts parts={roof.glass} metal/>
    </group> : <group position={[0,height+.25,0]} rotation={[0,Math.PI/2,0]}>
      <HipRoof at={[0,0,0]} width={depth+.7} depth={width+.7} rise={.65} color={accent}/>
      <StaticParts parts={roofSeams} metal/>
    </group>}
    {office && <group position={[width/2+.02,0,0]}>
      <mesh position={[0,height/2+.2,0]}><cylinderGeometry args={[1.6,1.6,height,32,1,false,0,Math.PI]}/><meshPhysicalMaterial color={ARCHITECTURE.glass} roughness={.18} metalness={.16} clearcoat={.85}/></mesh>
      {[.3,1.95,3.6,5.25,6.85].map(y=><mesh key={y} position={[0,y,0]} castShadow><cylinderGeometry args={[1.75,1.75,.1,32,1,false,0,Math.PI]}/><meshStandardMaterial color={ARCHITECTURE.frame}/></mesh>)}
      <SoftBlock at={[1.1,.2,0]} size={[2.6,.3,4]} color="#eeebe1"/>
      <SoftBlock at={[1.2,2.5,0]} size={[3.1,.16,4.1]} color={ARCHITECTURE.frame}/>
      <StaticParts parts={entrance} metal/>
      <Box at={[1.63,1.26,0]} size={[.055,2.05,1.23]} color="#426975"/>
    </group>}
    {!office && <StaticParts parts={entrance}/>}
    {office && <SoftBlock at={[6.95,.025,0]} size={[.7,.05,18]} color="#dddcd1"/>}
  </group>
}

function Office() {
  return <Building {...SITE_BUILDINGS.office}/>
}

function Carport({ x, z, width, depth = 4.5, customer = false }) {
  return <group position={[x,0,z]}>
    <SoftBlock at={[0,.06,0]} size={[width+.5,.12,depth+.5]} color={customer ? '#cccbbd' : '#c6d5cf'}/>
    <ArchitecturalCanopy width={width} depth={depth}/>
    {customer && [-5.2,-1.75,1.75,5.2].map(x=><group key={x}>
      <Box at={[x,.13,0]} size={[.06,.012,depth-.25]} color="#ecebda"/>
      <Box at={[x,.23,-depth/2+.75]} size={[1.2,.2,.15]} color={ARCHITECTURE.stone}/>
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

function Arrow({ x, z, yaw }) {
  return <group position={[x,.09,z]} rotation={[0,yaw,0]}>
    <Box at={[0,0,0]} size={[.1,.02,1.1]} color="#f9fcff"/>
    {[-1,1].map(n=><Box key={n} at={[n*.2,0,.35]} size={[.09,.02,.55]} color="#f9fcff" rotation={[0,n*.8,0]}/>)}
  </group>
}

function RoadSurface({ polygons, y, color, asphalt = false }) {
  const shapes=useMemo(()=>polygons.map(poly=>{
    const shape=new Shape()
    poly.forEach((ring,n)=>{
      const path=n ? new Path() : shape
      ring.forEach(([x,z],i)=>i ? path.lineTo(x,-z) : path.moveTo(x,-z));path.closePath()
      if(n) shape.holes.push(path)
    })
    return shape
  }),[polygons])
  return <mesh rotation={[-Math.PI/2,0,0]} position={[0,y,0]} receiveShadow><shapeGeometry args={[shapes]}/><FleetSurfaceMaterial kind={asphalt?'asphalt':'stone'} color={color}/></mesh>
}

function RoadEdge({ ring }) {
  const curve=useMemo(()=>new CatmullRomCurve3(ring.slice(0,-1).map(([x,z])=>new Vector3(x,.046,z)),true,'catmullrom',0),[ring])
  return <mesh><tubeGeometry args={[curve,Math.max(64,ring.length*3),.018,4,true]}/><meshBasicMaterial color="#ede9dc"/></mesh>
}

function RaisedCurb({ path }) {
  const curve=useMemo(()=>new CatmullRomCurve3(path.map(([x,z])=>new Vector3(x,.075,z)),false,'catmullrom',0),[path])
  return <mesh castShadow receiveShadow><tubeGeometry args={[curve,Math.max(8,path.length*2),.09,6,false]}/><meshStandardMaterial color="#ddd9c9" roughness={.9}/></mesh>
}

function Road({ overflowAisles, chargingRows, site, vehicles }) {
  const net=useMemo(()=>roadNetwork(overflowAisles,chargingRows,site),[overflowAisles,chargingRows,site])
  const curbs=useMemo(()=>{
    const last=Math.max(0,...vehicles.filter(c=>c.parking).map(c=>c.parking.x))+1.8
    const cutouts=[-1,1].map(sign=>({minX:-23,maxX:last,minZ:sign>0?4.05:-4.75,maxZ:sign>0?4.75:-4.05}))
    return net.surface.flatMap(poly=>poly).flatMap(ring=>raisedCurbRuns(ring,cutouts))
  },[net,vehicles])
  const joints=useMemo(()=>curbJoints(curbs),[curbs])
  return <group>
    <RoadSurface polygons={net.pavement} y={-.015} color="#babeb5"/>
    <RoadSurface polygons={net.surface} y={.025} color={ARCHITECTURE.road} asphalt/>
    {net.surface.flatMap(poly=>poly).map((ring,i)=><RoadEdge key={i} ring={ring}/>)}
    {curbs.map((path,i)=><RaisedCurb key={i} path={path}/>)}
    <StaticParts parts={joints}/>
    {net.routes.flatMap(route=>roadDashes(route,site)).map((p,i)=><Box key={i} at={[p.x,.05,p.z]} size={[.09,.015,1.2]} color="#fff5d8" rotation={[0,p.yaw,0]}/>)}
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
        <ArchitecturalCanopy width={SITE_CHARGING.width} depth={SITE_CHARGING.depth} height={3.6}/>
        {[-5.2,-1.75,1.75,5.2].map(x=><group key={x} position={[x,4.13,1.45]} rotation={[-.12,0,0]}>
          <SoftBlock at={[0,0,0]} size={[2.9,.08,2.2]} color="#344d5b"/>
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
  const site=useMemo(()=>siteLayout(vehicles),[vehicles])
  // Irregular precinct silhouette, not a square campus invented around the cars.
  const outline=useMemo(()=>{
    const shape=new Shape()
    const points=[[-57,-31],[-42,-42],[-16,-17],[site.exit.x-6.5,-17],[site.exit.x-6.5,-23],[bounds.maxX-1,-23],[bounds.maxX-1,bounds.maxZ],[-35,bounds.maxZ],[-55,9],[-57,-18]]
    points.forEach(([x,z],i)=>i ? shape.lineTo(x,-z) : shape.moveTo(x,-z))
    shape.closePath()
    return shape
  },[bounds.maxX,bounds.maxZ,site.exit.x])
  return <group>
    <mesh position={[0,-.58,0]} rotation={[-Math.PI/2,0,0]}>
      <extrudeGeometry args={[outline,{depth:.1,bevelEnabled:false}]}/><meshStandardMaterial color="#7b837d" roughness={.9}/>
    </mesh>
    <mesh position={[0,-.5,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
      <extrudeGeometry args={[outline,{depth:.45,bevelEnabled:true,bevelThickness:.025,bevelSize:.035,bevelSegments:2,steps:1}]}/><FleetSurfaceMaterial color={ARCHITECTURE.paving}/>
    </mesh>
    <Road overflowAisles={overflowAisles} chargingRows={Math.max(1,Math.ceil(chargingBays.length/4))} site={site} vehicles={vehicles}/>
    {Array.from({length:Math.ceil((site.exit.x+17)/14)},(_,n)=>-17+n*14).map(x=><Arrow key={x} x={x} z={SITE.outgoingLane} yaw={Math.PI/2}/>)}
    <Arrow x={-28} z={-8} yaw={Math.atan2(20,27)}/><Arrow x={site.exit.x} z={-12} yaw={Math.PI}/>
    <Office/>
    <Building {...SITE_BUILDINGS.entry}/>
    <Building {...SITE_BUILDINGS.lower}/>
    <Building {...SITE_BUILDINGS.rear} x={site.roadEnd-3}/>
    <Carport {...SITE_CUSTOMER} customer/>
    <group position={[SITE_MOTORCYCLES.x,0,SITE_MOTORCYCLES.z]}>
      <SoftBlock at={[0,.025,0]} size={[SITE_MOTORCYCLES.width,.05,SITE_MOTORCYCLES.depth]} color="#d7e6df"/>
      {[-1.52,0,1.52].map(x=><Box key={x} at={[x,.055,0]} size={[.04,.015,2.75]} color="#f3eedb"/>)}
      <Box at={[0,.055,-1.36]} size={[3.15,.015,.04]} color="#f3eedb"/>
    </group>
    <ChargingCanopy bays={chargingBays} vehicles={vehicles}/>
    {/* Pavements, planted beds and furniture stay outside the vehicle corridors. */}
    {[4,16,28,40,52].map((x,i)=><Lamp key={x} x={x} z={-11.1} yaw={i%2?Math.PI:0}/>)}
    <Bench x={-30} z={10.5} yaw={.25}/><Bench x={-24} z={-17} yaw={Math.PI}/>
    <group position={[-35,.06,-17.55]} rotation={[0,Math.atan2(20,27),0]}>
      {Array.from({length:8},(_,n)=><Box key={n} at={[-3.1+n*.88,0,0]} size={[.43,.014,1.55]} color="#f5f2e5"/>)}
    </group>
    {/* Entrance hedge follows the diagonal; rear trees flank the dead end. */}
    <group position={[SITE_HEDGE_BED.x,0,SITE_HEDGE_BED.z]} rotation={[0,SITE_HEDGE_BED.rotation,0]}>
      <SoftBlock at={[0,.13,0]} size={[SITE_HEDGE_BED.width,.26,SITE_HEDGE_BED.depth]} color="#e3e1d0"/>
      <SoftBlock at={[0,.28,0]} size={[SITE_HEDGE.width,.06,SITE_HEDGE_BED.depth-.15]} color={ARCHITECTURE.grass}/>
    </group>
    {Array.from({length:SITE_HEDGE.count},(_,n)=><Tree key={n} x={SITE_HEDGE.x+n*SITE_HEDGE.stepX} z={SITE_HEDGE.z+n*SITE_HEDGE.stepZ} small tone={n} planted/>)}
    {[[site.roadEnd-3.5,-8],[site.roadEnd-.5,-8],[site.roadEnd+1.5,-8],[-29.5,12],[-30,9]].map(([x,z],i)=><Tree key={i} x={x} z={z} tone={i}/>)}
    <RoundCourt x={-29} z={6.5} radius={1.6}/><Tree x={-29} z={6.5} small/>
    <Planter x={site.roadEnd-3} z={5.8} width={3.4}/><Planter x={-25.5} z={5.6}/>
    {[[-26,4.7],[-22,6.5],[-16,13.7],[-2,13.7],[site.roadEnd-4.5,5.2],[-31,-4]].map(([x,z],i)=><Person key={i} x={x} z={z} color={i%2 ? '#e5bc53' : '#39a88f'}/>)}
    <Gate x={-37} z={-20.2} yaw={Math.atan2(20,27)}/>
    <Gate x={site.exit.x} z={-14.5}/>
    {/* Dead-end barrier is beyond the right-hand exit, never on a traffic route. */}
    <Box at={[site.roadEnd,.8,0]} size={[.24,1.6,8.8]} color="#eff2ee"/>
    {[-3,-1,1,3].map(z=><Box key={z} at={[site.roadEnd-.15,.9,z]} size={[.08,.28,1]} color="#dfac55"/>)}
  </group>
})
