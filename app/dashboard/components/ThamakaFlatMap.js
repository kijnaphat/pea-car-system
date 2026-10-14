'use client'

import { useMemo } from 'react'
import { THAMAKA_BUILDINGS, THAMAKA_CANOPIES, thamakaLayout, thamakaOutline, thamakaRoadNetwork, siteChargingBays } from '@/lib/thamakaSiteLayout'
import { FLEET_STATUSES } from '@/lib/fleetDigitalTwin'
import { restingPose } from '@/lib/fleetCharging'
import FleetVehicleGlyph from './FleetVehicleGlyph'

const polygon=points=>points.map(([x,z])=>`${x},${z}`).join(' ')
const rings=poly=>poly.map(r=>'M'+r.map(([x,z])=>`${x} ${z}`).join('L')+'Z').join(' ')
export default function ThamakaFlatMap({vehicles,visible,selectedId,onSelect}) {
  const site=useMemo(()=>thamakaLayout(vehicles),[vehicles])
  const roads=useMemo(()=>thamakaRoadNetwork(vehicles),[vehicles])
  const canopies=[{...THAMAKA_CANOPIES.customer,key:'customer'},...Array.from({length:Math.ceil(siteChargingBays(vehicles).length/4)},(_,row)=>({...THAMAKA_CANOPIES.charging,key:`charging-${row}`,z:9.5+row*10,charging:true}))]
  const b=site.bounds
  return <div className="thamaka-flat" role="region" aria-label="ผังท่ามะกา 2D สำรอง อิงภาพอ้างอิง">
    <svg viewBox={`${b.minX} ${b.minZ} ${b.maxX-b.minX} ${b.maxZ-b.minZ}`} role="img" aria-label="อาคารสำนักงาน โรงจอด ถนน 3209 และแนวคลอง">
      <rect x={b.minX} y={b.minZ} width={b.maxX-b.minX} height={b.maxZ-b.minZ} fill="#b7c39b"/>
      <polygon points={polygon(thamakaOutline(vehicles))} fill="#d8d3c1" stroke="#9ca790" strokeWidth=".35"/>
      <rect x={b.minX} y="40" width={b.maxX-b.minX} height="5" fill="#5b9495"/>
      {roads.surface.map((p,n)=><path key={n} d={rings(p)} fillRule="evenodd" fill="#788787"/>)}
      {THAMAKA_BUILDINGS.map(building=><g key={building.key}>
        <rect x={building.x-building.width/2} y={building.z-building.depth/2} width={building.width} height={building.depth} fill={building.roof} stroke="#f9f6ee" strokeWidth=".5"/>
        {building.atrium&&<rect x={building.x-3} y={building.z-3.5} width="6" height="7" fill="#bbcca5" stroke="#f1eee3" strokeWidth=".4"/>}
      </g>)}
      {canopies.map(c=><g key={c.key}><rect x={c.x-c.width/2} y={c.z-c.depth/2} width={c.width} height={c.depth} fill={c.charging?'#70a2ab':'#c3b79b'} stroke="#eee9d4" strokeWidth=".3"/>
        <text x={c.x} y={c.z+.6} textAnchor="middle" fontSize="2" fill="#28464b">{c.charging?'EV':'โรงจอด'}</text></g>)}
      {visible.filter(car=>car.parking).map(car=>{const pose=restingPose(car);return <g key={car.id}>
        <rect x={car.parking.x-1.3} y={car.parking.z-1.9} width="2.6" height="3.8" fill="none" stroke={FLEET_STATUSES[car.status].color} strokeWidth=".22"/>
        {car.status!=='on_trip'&&<rect x={pose.x-.7} y={pose.z-1.5} width="1.4" height="3" rx=".25" fill={FLEET_STATUSES[car.status].color}/>}
        <text x={car.parking.x} y={car.parking.z+3} textAnchor="middle" fontSize="1.55" fill="#37505a">{car.slotCode}</text>
      </g>})}
      <text x="-38" y="14" textAnchor="middle" fontSize="2" fill="#334c52">สำนักงาน</text>
      <text x="10" y="35" textAnchor="middle" fontSize="2" fill="#f4efe2">ถนน 3209</text>
      <text x="10" y="44" textAnchor="middle" fontSize="2" fill="#e4f0e2">แนวคลอง</text>
    </svg>
    <div className="thamaka-flat-cars">{visible.map(car=><button key={car.id} onClick={()=>onSelect(car.id)} aria-pressed={selectedId===car.id}>
      <FleetVehicleGlyph car={car} size={32}/><span>{car.slotCode} · {car.plate_number}</span>
    </button>)}</div>
    <p>ผังท่ามะกาอิงภาพอ้างอิง · ไม่ใช่ GPS หรือแบบสำรวจ · เบิก–คืนด้วย QR ที่รถเท่านั้น</p>
  </div>
}
