'use client'

import { memo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, SRGBColorSpace } from 'three'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import FleetVehicleModel from './FleetVehicleModel'
import { vehicleStyle } from '@/lib/fleetVehicleStyle'

// A single on-demand viewer for the selected car, never a Canvas per list row.
export default memo(function FleetVehicleShowcase({ car }) {
  const [turn, setTurn] = useState(0)
  const style = vehicleStyle(car)
  return <div className="twin-vehicle-showcase">
    <div className="twin-vehicle-showcase-heading"><span>โมเดลรถ 3D</span><small>ภาพจำลองตามประเภทรถ</small></div>
    <div className="twin-vehicle-showcase-canvas">
      <Canvas orthographic frameloop="demand" dpr={[1, 1.25]} camera={{ position: [4.8, 3.3, 5.8], zoom: 49, near: .1, far: 50 }}
        gl={{ antialias: true, alpha: true, toneMapping: ACESFilmicToneMapping, outputColorSpace: SRGBColorSpace }}
        role="img" aria-label={`โมเดล 3D ${style.label} หมุนดูรายละเอียดได้`}>
        <ambientLight intensity={.6}/><hemisphereLight args={['#fff8ee', '#77908b', 1.8]}/>
        <directionalLight position={[4, 6, 4]} color="#ffedce" intensity={3}/>
        <directionalLight position={[-3, 3, -5]} color="#d8edff" intensity={1.4}/>
        <group position={[0, -.7, 0]} rotation={[0, turn, 0]}><FleetVehicleModel car={car}/></group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.69, 0]} scale={[1.05, 1.75, 1]}>
          <circleGeometry args={[1, 40]}/><meshBasicMaterial color="#687a7a" transparent opacity={.12} depthWrite={false}/>
        </mesh>
        <OrbitControls enablePan={false} enableZoom={false} enableDamping={false} minPolarAngle={.25} maxPolarAngle={1.45} target={[0, .35, 0]}/>
      </Canvas>
    </div>
    <div className="twin-vehicle-showcase-controls"><button aria-label="หมุนโมเดลรถซ้าย" onClick={() => setTurn(value => value - Math.PI / 6)}><ChevronLeft size={16}/></button><span>ลากเพื่อหมุนดูรอบคัน</span><button aria-label="หมุนโมเดลรถขวา" onClick={() => setTurn(value => value + Math.PI / 6)}><ChevronRight size={16}/></button></div>
  </div>
})
