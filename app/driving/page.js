'use client'
import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams, useRouter } from 'next/navigation'

export default function DrivingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center"><div className="w-8 h-8 border-[2.5px] border-[#333] border-t-white rounded-full animate-spin"/></div>}>
      <DrivingDashboard />
    </Suspense>
  )
}

function DrivingDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const carId = searchParams.get('car_id')

  const [car, setCar] = useState(null)
  const [log, setLog] = useState(null)
  const [isTracking, setIsTracking] = useState(false)
  const [location, setLocation] = useState({ lat: 0, lng: 0, speed: 0 })
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // นาฬิกา
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // ดึงข้อมูลรถและคนขับ
  useEffect(() => {
    const fetchTripData = async () => {
      if (!carId) return
      const { data: carData } = await supabase.from('cars').select('*').eq('id', carId).single()
      const { data: logData } = await supabase.from('trip_logs').select('*').eq('car_id', carId).eq('is_completed', false).single()
      
      if (carData) setCar(carData)
      if (logData) setLog(logData)
    }
    fetchTripData()
  }, [carId])

  // 📍 ระบบป้องกันหน้าจอดับ (Screen Wake Lock) และ GPS Tracking
  useEffect(() => {
    if (!carId) return

    let wakeLock = null
    let watchId = null

    // ฟังก์ชันขอสิทธิ์ให้หน้าจอสว่างตลอดเวลา
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
          setWakeLockActive(true)
          
          wakeLock.addEventListener('release', () => {
            setWakeLockActive(false)
          })
        }
      } catch (err) {
        console.error('Wake Lock Error:', err)
      }
    }

    // ฟังก์ชันเริ่มจับพิกัด
    const startTracking = () => {
      if ('geolocation' in navigator) {
        watchId = navigator.geolocation.watchPosition(
          async (pos) => {
            const { latitude, longitude, speed } = pos.coords
            // ความเร็วที่ได้มาเป็น เมตร/วินาที -> แปลงเป็น กม./ชม.
            const speedKmh = speed ? Math.round(speed * 3.6) : 0
            
            setLocation({ lat: latitude, lng: longitude, speed: speedKmh })
            setIsTracking(true)

            // ส่งข้อมูลขึ้น Supabase
            await supabase.from('current_locations').upsert({
              car_id: Number(carId),
              latitude,
              longitude,
              updated_at: new Date().toISOString()
            }, { onConflict: 'car_id' })
          },
          (err) => {
            console.error("GPS Tracking Error:", err)
            setIsTracking(false)
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
        )
      }
    }

    // เริ่มทำงานเมื่อเปิดหน้านี้
    requestWakeLock()
    startTracking()

    // 🔄 กรณีคนขับเผลอสลับแอปแล้วกลับมาเปิดเว็บใหม่ ต้องขอ WakeLock ซ้ำ
    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Cleanup ตอนปิดหน้าเว็บ
    return () => {
      if (wakeLock !== null) wakeLock.release()
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [carId])

  if (!car) return null

  return (
    <div className="min-h-screen bg-black font-sarabun text-white flex flex-col pt-12 pb-8 px-6">
      
      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-[42px] font-bold tracking-tight leading-none text-[#ff9f0a]">{car.plate_number}</h1>
          <p className="text-[18px] text-[#8e8e93] mt-2 font-medium">{log?.driver_name || 'ไม่ทราบชื่อผู้ขับ'}</p>
        </div>
        <div className="text-right">
          <p className="text-[28px] font-bold tracking-tight">{currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      {/* ── Status Cards ── */}
      <div className="space-y-4 mb-auto">
        {/* ความเร็ว */}
        <div className="bg-[#1c1c1e] rounded-[24px] p-6 flex flex-col items-center justify-center border border-white/10"
             style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          <span className="text-[14px] text-[#8e8e93] font-medium uppercase tracking-widest mb-1">ความเร็ว (กม./ชม.)</span>
          <span className="text-[80px] font-bold text-white leading-none tracking-tighter">
            {location.speed}
          </span>
        </div>

        {/* GPS Status */}
        <div className="bg-[#1c1c1e] rounded-[24px] p-6 border border-white/10 flex items-center justify-between">
          <div>
            <span className="block text-[14px] text-[#8e8e93] font-medium mb-1">สถานะการเชื่อมต่อ</span>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isTracking ? 'bg-[#32d74b] animate-pulse' : 'bg-[#ff453a]'}`} />
              <span className={`text-[16px] font-semibold ${isTracking ? 'text-[#32d74b]' : 'text-[#ff453a]'}`}>
                {isTracking ? 'กำลังส่งพิกัด Real-time' : 'กำลังค้นหาสัญญาณ GPS...'}
              </span>
            </div>
          </div>
        </div>

        {/* หน้าจอสว่าง Status */}
        <div className="bg-[#1c1c1e] rounded-[24px] p-4 border border-white/10 flex items-center gap-3">
          <span className="text-[24px]">{wakeLockActive ? '☀️' : '🌙'}</span>
          <p className="text-[13px] text-[#8e8e93] leading-snug">
            {wakeLockActive 
              ? 'ระบบล็อกหน้าจอให้สว่างตลอดเวลาแล้ว กรุณาวางโทรศัพท์ทิ้งไว้และห้ามกดปิดหน้าจอ' 
              : 'คำเตือน: ระบบป้องกันหน้าจอดับไม่ทำงาน โทรศัพท์อาจดับและหยุดส่งพิกัด'}
          </p>
        </div>
      </div>

      {/* ── Action Button ── */}
      <div className="mt-8 pt-6 border-t border-white/10">
        <button 
          onClick={() => router.push(`/?car_id=${carId}`)}
          className="w-full bg-[#ff453a] text-white py-[20px] rounded-[20px] text-[18px] font-bold tracking-wide active:scale-95 transition-transform"
          style={{ boxShadow: '0 8px 24px rgba(255, 69, 58, 0.3)' }}
        >
          จบงาน / คืนรถ
        </button>
      </div>

    </div>
  )
}