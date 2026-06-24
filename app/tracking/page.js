'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// โหลด MapComponent แบบปิด SSR เพื่อป้องกัน Error หน้าขาว (Window is not defined)
const MapView = dynamic(() => import('./MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#e5e5ea]">
      <div className="w-8 h-8 border-[2.5px] border-[#d2d2d7] border-t-[#0071e3] rounded-full animate-spin mb-3"/>
      <p className="text-[14px] text-[#6e6e73]">กำลังโหลดแผนที่...</p>
    </div>
  )
})

export default function TrackingPage() {
  const router = useRouter()
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)

  // ฟังก์ชันดึงข้อมูลพิกัดเริ่มต้น
  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('current_locations')
        .select(`
          car_id,
          latitude,
          longitude,
          updated_at,
          cars ( plate_number, car_type, status )
        `)
        .order('updated_at', { ascending: false })

      if (error) throw error
      if (data) setLocations(data)
    } catch (err) {
      console.error('Error fetching locations:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // 1. ดึงข้อมูลครั้งแรกเมื่อโหลดหน้าเว็บ
    fetchLocations()

    // 2. เปิดระบบ Supabase Realtime เพื่อรอรับพิกัดใหม่
    const channel = supabase
      .channel('realtime-locations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'current_locations' },
        (payload) => {
          console.log('ข้อมูล GPS อัปเดต!', payload)
          // สั่งให้ดึงข้อมูลใหม่ทั้งหมดมาแสดงเมื่อมีการอัปเดต
          fetchLocations() 
        }
      )
      .subscribe()

    // คืนค่าเมื่อปิดหน้าเว็บ
    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" style={{WebkitFontSmoothing:'antialiased'}}>
      <div className="w-8 h-8 border-[2.5px] border-[#d2d2d7] border-t-[#1d1d1f] rounded-full animate-spin"/>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f5f5f7] font-sarabun flex flex-col" style={{WebkitFontSmoothing:'antialiased'}}>
      
      {/* ── Nav Bar ── */}
      <nav className="sticky top-0 z-50 h-[52px] flex items-center justify-between px-5 bg-white/80 backdrop-blur-xl border-b border-black/[0.07]">
        <div className="flex items-center gap-3">
            <button onClick={() => router.push('/')}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f5f5f7] text-[#1d1d1f] active:bg-[#e5e5ea] transition-colors">
            <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7L7 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.4px]">ระบบติดตามรถ (GPS)</span>
        </div>
        <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34c759] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#248a3d]"></span>
            </span>
            <span className="text-[12px] font-medium text-[#248a3d]">Real-time Active</span>
        </div>
      </nav>

      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        
        {/* ── Sidebar: รายชื่อรถที่กำลังส่งพิกัด ── */}
        <div className="w-full xl:w-[380px] bg-white border-r border-[rgba(0,0,0,0.06)] flex flex-col h-[40vh] xl:h-[calc(100vh-52px)] flex-shrink-0">
          <div className="p-4 border-b border-[rgba(0,0,0,0.06)] bg-[#f9f9f9]">
            <h2 className="text-[14px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em]">รถที่กำลังส่งสัญญาณ</h2>
            <p className="text-[24px] font-bold text-[#1d1d1f] mt-1">{locations.length} คัน</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {locations.length === 0 ? (
                <div className="text-center py-10 opacity-50">
                    <span className="text-[40px]">📡</span>
                    <p className="text-[14px] mt-3 font-medium">ยังไม่มีรถส่งพิกัดเข้ามาในระบบ</p>
                </div>
            ) : (
                locations.map((loc) => (
                <div key={loc.car_id} className="bg-[#f5f5f7] rounded-[16px] p-4 transition-all hover:bg-[#f0f0f2]">
                    <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-[16px] font-bold text-[#1d1d1f]">{loc.cars?.plate_number || 'ไม่ทราบทะเบียน'}</h3>
                        <p className="text-[12px] text-[#6e6e73]">{loc.cars?.car_type}</p>
                    </div>
                    <span className="text-[11px] bg-[#edfbf0] text-[#248a3d] px-2 py-1 rounded-md font-semibold">ออนไลน์</span>
                    </div>
                    
                    <div className="bg-white rounded-[10px] p-2.5 mt-3 border border-[rgba(0,0,0,0.04)]">
                        <div className="flex justify-between text-[11px] text-[#6e6e73] mb-1">
                            <span>Lat: <strong className="text-[#1d1d1f]">{loc.latitude.toFixed(6)}</strong></span>
                            <span>Lng: <strong className="text-[#1d1d1f]">{loc.longitude.toFixed(6)}</strong></span>
                        </div>
                        <p className="text-[10px] text-[#aeaeb2] text-right mt-1.5">
                            อัปเดตล่าสุด: {new Date(loc.updated_at).toLocaleTimeString('th-TH')} น.
                        </p>
                        
                        {/* ปุ่มเปิดพิกัดใน Google Maps */}
                        <a href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`} target="_blank" rel="noreferrer"
                           className="mt-2 w-full block text-center bg-[#e5e5ea] hover:bg-[#d1d1d6] text-[#1d1d1f] text-[12px] font-medium py-1.5 rounded-lg transition-colors">
                           เปิดใน Google Maps 🗺️
                        </a>
                    </div>
                </div>
                ))
            )}
          </div>
        </div>

        {/* ── Main Map Area ── */}
        <div className="flex-1 relative z-0 bg-[#e5e5ea]">
            {/* เพิ่ม div ครอบพร้อมคลาส absolute inset-0 ตรงนี้ครับ */}
            <div className="absolute inset-0">
                <MapView locations={locations} />
            </div>
        </div>

      </div>
    </div>
  )
}