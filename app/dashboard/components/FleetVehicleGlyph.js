import { vehicleStyle } from '@/lib/fleetVehicleStyle'

// Lightweight counterpart of the 3D silhouettes for the list and WebGL fallback.
export default function FleetVehicleGlyph({ car, size = 48, style }) {
  const { kind, color } = vehicleStyle(car)
  const truck = ['bucket', 'crane', 'drill', 'heavy_truck', 'light_truck', 'covered_truck'].includes(kind)
  return <svg width={size} height={size * .6} viewBox="0 0 80 48" role="img" aria-label={`โมเดล ${vehicleStyle(car).label}`} style={style}>
    {kind === 'motorcycle' ? <><path d="M23 34 36 17h14l10 17H23m13-17-5-6m17 0h10" fill="none" stroke={color} strokeWidth="5" strokeLinejoin="round"/><circle cx="22" cy="35" r="9" fill="#263442"/><circle cx="60" cy="35" r="9" fill="#263442"/></> : <>
      {truck ? <><path d="M8 31V18h39v16H8" fill={color}/><path d="M49 34V13h14l10 10v11Z" fill={color}/><path d="M54 17h7l7 7H54Z" fill="#a9d3e6"/>{kind === 'covered_truck' && <path d="M9 18V7h37v11" fill="#e3e9ec"/>}{kind === 'heavy_truck' && <path d="M10 17V12h35v5" fill={color}/>}</> : <><path d={kind === 'van' ? 'M8 34V13Q8 8 15 8h42l15 15v11Z' : kind === 'pickup' ? 'M8 34V24h28V12h22l14 13v9Z' : 'M8 34V25l12-4 11-10h24l12 12 7 4v7Z'} fill={color}/><path d={kind === 'van' ? 'M15 13h41l10 11H15Z' : kind === 'pickup' ? 'M41 16h14l9 9H41Z' : 'M33 15h19l10 9H25Z'} fill="#a9d3e6"/>{kind === 'pickup' && <path d="M10 25h23" stroke="#314654" strokeWidth="3"/>}</>}
      {kind === 'bucket' && <><path d="m21 20 10-13 20 2" fill="none" stroke="#f9c53d" strokeWidth="5"/><path d="M47 4h12v10H47Z" fill="#fff3d8" stroke="#ab8040"/></>}
      {kind === 'crane' && <><path d="m19 20 9-14 31 3" fill="none" stroke="#f6c637" strokeWidth="6"/><path d="M59 9v9l-3 2" fill="none" stroke="#394554" strokeWidth="2"/></>}
      {kind === 'drill' && <><path d="M28 5v23m-7-22h14" stroke="#e7b54e" strokeWidth="5"/><path d="M28 26v10" stroke="#35455b" strokeWidth="3"/></>}
      <path d="M9 32h63" stroke="#32485c" strokeWidth="2"/>
      <circle cx="19" cy="35" r="7" fill="#263442"/><circle cx="63" cy="35" r="7" fill="#263442"/>
      {['bucket','crane','drill','heavy_truck'].includes(kind) && <circle cx="34" cy="35" r="7" fill="#263442"/>}
      <circle cx="19" cy="35" r="3" fill="#c5d1dc"/><circle cx="63" cy="35" r="3" fill="#c5d1dc"/>
      {['bucket','crane','drill','heavy_truck'].includes(kind) && <circle cx="34" cy="35" r="3" fill="#c5d1dc"/>}
      {kind === 'ev' && <path d="m43 25-4 6h4l-2 5 7-8h-4l2-3Z" fill="white"/>}
    </>}
  </svg>
}
