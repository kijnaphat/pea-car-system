'use client'
import { useState } from 'react'
// เพิ่มการ Import ZoomControl เข้ามา
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// สร้างไอคอนรถแบบจุดสีเขียว
const createCarIcon = () => {
  return L.divIcon({
    className: 'custom-car-icon',
    html: `<div style="background-color: #34c759; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  })
}

// 1. ปรับชื่อเมนูให้สั้นลง เพื่อให้เรียงแนวนอนบนมือถือได้สวยงาม
const MAP_STYLES = {
  clean: {
    name: 'Minimal',
    icon: '🗺️',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap & CARTO'
  },
  standard: {
    name: 'Standard',
    icon: '📍',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap'
  },
  satellite: {
    name: 'Satellite',
    icon: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri'
  }
}

export default function MapComponent({ locations }) {
  const [activeMap, setActiveMap] = useState('clean')

  const center = locations.length > 0 
    ? [locations[0].latitude, locations[0].longitude] 
    : [13.8591, 100.5217]; 

  return (
    <div className="relative w-full h-full font-sarabun">
      
      {/* ── Custom UI แบบ Capsule ลอยอยู่ตรงกลางด้านบน ── */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white/85 backdrop-blur-xl p-1.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/50 flex items-center gap-1 whitespace-nowrap">
        
        {Object.entries(MAP_STYLES).map(([key, style]) => (
          <button
            key={key}
            onClick={() => setActiveMap(key)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-[12px] sm:text-[13px] font-semibold transition-all duration-300 ${
              activeMap === key
                ? 'bg-[#1d1d1f] text-white shadow-md'
                : 'text-[#6e6e73] hover:bg-[#1d1d1f]/5 hover:text-[#1d1d1f]'
            }`}
          >
            <span className="text-[14px] sm:text-[15px]">{style.icon}</span>
            <span>{style.name}</span>
          </button>
        ))}
        
      </div>

      {/* ── ตัวแผนที่ Leaflet ── */}
      {/* ปิด zoomControl เริ่มต้น (zoomControl={false}) เพื่อเราจะจัดตำแหน่งใหม่เอง */}
      <MapContainer 
        center={center} 
        zoom={13} 
        zoomControl={false} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        {/* ย้ายปุ่ม ซูม + / - ไปไว้มุมขวาล่าง */}
        <ZoomControl position="bottomright" />
        
        <TileLayer
          key={activeMap} 
          attribution={MAP_STYLES[activeMap].attribution}
          url={MAP_STYLES[activeMap].url}
        />
        
        {/* วนลูปสร้างจุดพิกัดรถทุกคัน */}
        {locations.map((loc) => (
          <Marker 
            key={loc.car_id} 
            position={[loc.latitude, loc.longitude]}
            icon={createCarIcon()}
          >
            <Popup>
              <div style={{ fontFamily: 'Sarabun, sans-serif' }}>
                  <strong style={{ fontSize: '15px' }}>{loc.cars?.plate_number || 'ไม่ทราบทะเบียน'}</strong><br/>
                  <span style={{ color: '#6e6e73', fontSize: '12px' }}>{loc.cars?.car_type}</span><br/>
                  <span style={{ fontSize: '11px', color: '#aeaeb2' }}>
                    อัปเดต: {new Date(loc.updated_at).toLocaleTimeString('th-TH')} น.
                  </span>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      
    </div>
  )
}