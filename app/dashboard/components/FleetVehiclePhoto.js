'use client'

/* eslint-disable @next/next/no-img-element -- Stored photos already use the optimized card-image proxy; local examples need no second optimizer. */

import { useState } from 'react'
import { ImageOff } from 'lucide-react'
import { nextVehiclePhoto, recordPhotoFailure, vehiclePhotoKey, vehiclePhotoSources } from '@/lib/fleetVehiclePhoto'

function PhotoFrame({ car, choices }) {
  const [failed, setFailed] = useState([])
  const source = nextVehiclePhoto(choices, failed)
  const fail = src => setFailed(previous => recordPhotoFailure(previous, src))

  return <figure className="twin-vehicle-photo" aria-label={`ภาพรถ ${car.plate_number || ''}`}>
    <figcaption><strong>ภาพรถ</strong><span>{source ? source.actual ? 'ภาพที่บันทึกสำหรับรถคันนี้' : 'ภาพตัวอย่างตามประเภทรถ' : 'ยังไม่มีภาพที่แสดงได้'}</span></figcaption>
    <div className="twin-vehicle-photo-frame">
      {source ? <img key={source.src} src={source.src} alt={source.actual ? `ภาพที่บันทึกของรถ ${car.plate_number || car.model || ''}` : `ภาพตัวอย่าง ${car.car_type || car.model || 'ประเภทรถ'}`} loading="lazy" decoding="async" onError={() => fail(source.src)}/>
        : <div className="twin-vehicle-photo-empty" role="status"><ImageOff size={34} strokeWidth={1.3}/><strong>ไม่มีภาพรถที่แสดงได้</strong><span>ยังไม่มีภาพ หรือไม่สามารถโหลดภาพได้</span></div>}
    </div>
    {source && <p>{source.actual ? 'ภาพที่แอดมินบันทึกไว้ในระบบ' : 'ใช้ภาพประเภทเดียวกันประกอบการแสดงผล · ไม่ใช่ภาพยืนยันของรถคันนี้'}</p>}
  </figure>
}

// Reset load failures synchronously when the selected car or image changes.
// Stored photos use the existing optimized card proxy; local type examples are
// explicit fallbacks, never presented as an uploaded photo of this exact car.
export default function FleetVehiclePhoto({ car }) {
  const choices = vehiclePhotoSources(car)
  return <PhotoFrame key={vehiclePhotoKey(car, choices)} car={car || {}} choices={choices}/>
}
