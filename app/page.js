'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams, useRouter } from 'next/navigation'

// --- Main Component ---
export default function App() {
  const searchParams = useSearchParams()
  const carId = searchParams.get('car_id') 

  // 1. ถ้ามี car_id -> ไปหน้าฟอร์ม
  if (carId) {
    return <CarActionForm carId={carId} />
  }

  // 2. ถ้าไม่มี -> ไปหน้า Home (Dashboard View)
  return <CarSelector />
}

// ==========================================
// 1. หน้าแสดงผล (Home - Compact Grid 3 Cols)
// ==========================================
function CarSelector() {
  const router = useRouter()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCars = async () => {
    try {
      const { data } = await supabase.from('cars').select('*').order('plate_number', { ascending: true })
      if (data) setCars(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCars()
    const interval = setInterval(fetchCars, 5000) // Auto Refresh ทุก 5 วิ (เร็วขึ้นเพื่อให้ Realtime สุดๆ)
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#742F99] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F0F2F5] font-sarabun pb-4">
      
      {/* 🟣 Header (Super Compact) */}
      <div className="bg-[#742F99] px-4 pt-4 pb-16 text-white rounded-b-[1.5rem] shadow-md relative z-10">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
             <img src="/pea_logo.png" className="w-8 h-8 object-contain bg-white/20 rounded-lg p-1 backdrop-blur-sm" alt="logo" />
             <div>
               <h1 className="text-base font-bold leading-tight">PEA VIHICLE MANAGEMENT</h1>
               <p className="text-[9px] text-purple-200">สถานะยานพาหนะ Real-time</p>
             </div>
          </div>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="bg-white/10 hover:bg-white/20 p-2 rounded-xl backdrop-blur-md border border-white/10 active:scale-95 transition-all"
          >
            📊
          </button>
        </div>
      </div>

      {/* 🔶 Alert Instruction (แจ้งเตือนสแกน QR) */}
      <div className="-mt-10 mx-4 relative z-20 mb-4">
        {/* เปลี่ยนสีเป็น yellow-500/orange-500 และใช้ animate-pulse ธรรมดา */}
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 p-3 rounded-xl shadow-lg text-white flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                    📱
                </div>
                <div>
                    {/* เปลี่ยน text-shadow เป็น drop-shadow-md */}
                    <h3 className="text-sm font-bold drop-shadow-md">สแกน QR Code ที่รถ</h3>
                    <p className="text-[10px] opacity-90">เพื่อ บันทึกนำรถออก หรือ คืนรถ</p>
                </div>
            </div>
            <div className="text-xl">➔</div>
        </div>
      </div>

      {/* ⚪ รายการรถ (Grid Layout 3 คอลัมน์) */}
      <div className="px-2 relative z-20">
        <div className="grid grid-cols-3 gap-2">
          {cars.map((car) => (
            <div 
              key={car.id} 
              className="bg-white p-2 pt-3 rounded-xl shadow-sm border border-gray-100 relative flex flex-col items-center text-center group"
            >
              {/* 🖨️ Print Button (ย้ายมาตรงนี้) */}
              <button 
                 onClick={(e) => {
                    e.stopPropagation()
                    window.open(`/report?car_id=${car.id}`, '_blank')
                 }}
                 className="absolute top-1 right-1 text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-500 p-1.5 rounded-lg transition-colors z-30"
                 title="พิมพ์รายงาน"
              >
                 🖨️
              </button>

              {/* Status Dot */}
              <div className={`absolute top-2 left-2 w-2 h-2 rounded-full ${car.status === 'available' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>

              {/* Icon */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl mb-1 mt-2 ${
                car.status === 'available' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}>
                {car.car_type === 'รถตู้' ? '🚐' : car.car_type === 'รถเก๋ง' ? '🚗' : '🛻'}
              </div>
              
              {/* Info (Compact Text) */}
              <h3 className="text-sm font-extrabold text-gray-800 leading-tight">{car.plate_number}</h3>
              <p className="text-[8px] text-gray-400 uppercase tracking-wide mb-2 truncate w-full px-1">{car.model}</p>
              
              {/* Badge */}
              <div className={`text-[8px] px-1 py-0.5 rounded w-full font-bold ${
                 car.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                 {car.status === 'available' ? 'ว่าง' : 'ไม่ว่าง'}
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-center mt-6 text-gray-300 text-[10px]">
            PEA Fleet System v2.1
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 2. หน้าฟอร์มบันทึก (Action Form)
// ==========================================
function CarActionForm({ carId }) {
  const router = useRouter()
  const [car, setCar] = useState(null)
  const [activeLog, setActiveLog] = useState(null)
  
  // Inputs
  const [employeeId, setEmployeeId] = useState('')
  const [staffName, setStaffName] = useState('') 
  const [staffPosition, setStaffPosition] = useState('') 
  const [staffError, setStaffError] = useState(false)

  const [mileage, setMileage] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('') 
  const [customLocation, setCustomLocation] = useState('') 
  
  // Return Inputs
  const [endMileage, setEndMileage] = useState('')
  const [fuelLiters, setFuelLiters] = useState('')
  const [fuelCost, setFuelCost] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // โหลดข้อมูลรถ
  useEffect(() => {
    const fetchData = async () => {
      const { data: c } = await supabase.from('cars').select('*').eq('id', carId).single()
      if (c) {
        setCar(c)
        if (c.status === 'available') {
           const { data: l } = await supabase.from('trip_logs').select('end_mileage').eq('car_id', carId).eq('is_completed', true).order('created_at', { ascending: false }).limit(1).single()
           if (l?.end_mileage) setMileage(l.end_mileage.toString())
        } else {
           const { data: l } = await supabase.from('trip_logs').select('*').eq('car_id', carId).eq('is_completed', false).limit(1).single()
           if (l) setActiveLog(l)
        }
      }
    }
    fetchData()
  }, [carId])

  // เช็คชื่อพนักงาน
  const checkStaff = async () => {
    if (employeeId.length < 4) return
    const { data } = await supabase.from('staff').select('full_name, position').eq('staff_code', employeeId).single()
    if (data) {
        setStaffName(data.full_name); setStaffPosition(data.position); setStaffError(false)
    } else {
        setStaffName(''); setStaffPosition(''); setStaffError(true)
    }
  }

  // นำรถออก
  const handleTakeOut = async () => {
    let currentName = staffName
    if (!currentName) {
        const { data } = await supabase.from('staff').select('full_name, position').eq('staff_code', employeeId).single()
        if (data) { currentName = data.full_name; setStaffPosition(data.position) }
    }

    if (!currentName) { setStaffError(true); alert('❌ ไม่พบรหัสพนักงานในระบบ'); return }

    const finalLocation = selectedLocation === 'อื่นๆ' ? customLocation : selectedLocation
    if (!employeeId || !mileage || !finalLocation) return alert('กรุณากรอกข้อมูลให้ครบ')
    
    setLoading(true)
    try {
      const { error } = await supabase.from('trip_logs').insert({
        car_id: carId, driver_name: currentName, driver_position: staffPosition,
        start_mileage: parseFloat(mileage), location: finalLocation, start_time: new Date().toISOString(), is_completed: false
      })
      if (error) throw error
      await supabase.from('cars').update({ status: 'busy' }).eq('id', carId)
      alert(`✅ บันทึกสำเร็จ!\nเดินทางปลอดภัยครับ คุณ ${currentName}`)
      window.location.href = '/'
    } catch (err) { alert('Error: ' + err.message) } 
    finally { setLoading(false) }
  }

  // คืนรถ
  const handleReturn = async () => {
    if (!endMileage) return alert('กรุณากรอกเลขไมล์จบงาน')
    
    // Check Mileage Logic
    const startM = parseFloat(activeLog.start_mileage)
    const endM = parseFloat(endMileage)
    if (endM < startM) {
        alert(`❌ เลขไมล์ผิดพลาด!\nเลขไมล์จบ (${endM}) น้อยกว่า เลขไมล์เริ่ม (${startM})`)
        return
    }

    setLoading(true)
    try {
      await supabase.from('trip_logs').update({
        end_mileage: endM, fuel_liters: fuelLiters ? parseFloat(fuelLiters) : 0, fuel_cost: fuelCost ? parseFloat(fuelCost) : 0,
        end_time: new Date().toISOString(), is_completed: true
      }).eq('id', activeLog.id)
      await supabase.from('cars').update({ status: 'available' }).eq('id', carId)
      alert('✅ คืนรถเรียบร้อย ขอบคุณครับ!')
      window.location.href = '/'
    } catch (err) { alert('Error: ' + err.message) }
    finally { setLoading(false) }
  }

  if (!car) return <div className="min-h-screen flex items-center justify-center text-[#742F99]">กำลังโหลด...</div>

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sarabun flex flex-col pb-10">
      
      {/* Header Form (เอาปุ่ม Print ออก เพราะย้ายไปหน้าแรกแล้ว) */}
      <div className="bg-[#742F99] px-6 pt-10 pb-20 text-white rounded-b-[2.5rem] shadow-lg relative">
        <button onClick={() => window.location.href = '/'} className="absolute top-10 left-5 bg-white/20 p-2 px-4 rounded-xl text-sm">⬅ กลับ</button>
        <div className="text-center mt-6">
          <h2 className="text-3xl font-black">{car.plate_number}</h2>
          <p className="text-purple-200 text-sm uppercase">{car.model}</p>
        </div>
      </div>

      <div className="-mt-12 px-4 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-50">
          
          {car.status === 'available' ? (
            <div className="space-y-4">
              <h3 className="font-bold text-[#742F99] border-b pb-3 text-lg">📋 บันทึกนำรถออก</h3>
              
              <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 ml-1">รหัสพนักงาน</label>
                 <input 
                    type="text" value={employeeId} 
                    onChange={e => { setEmployeeId(e.target.value); setStaffError(false); setStaffName('') }} 
                    onBlur={checkStaff} 
                    placeholder="กรอกรหัสพนักงาน..." 
                    className={`w-full p-4 rounded-2xl border transition-all outline-none ${
                        staffError ? 'border-red-500 bg-red-50' : (staffName ? 'border-green-500 bg-green-50' : 'bg-gray-50 border-gray-100')
                    }`}
                 />
                 {staffName && <p className="text-green-600 text-xs font-bold ml-2">✅ คุณ{staffName}</p>}
                 {staffError && <p className="text-red-500 text-xs font-bold ml-2 animate-pulse">❌ ไม่พบรหัสพนักงานนี้</p>}
              </div>

              <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 ml-1">เลขไมล์เริ่มต้น</label>
                 <input type="number" value={mileage} onChange={e => setMileage(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none" />
              </div>

              <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 ml-1">สถานที่</label>
                 <select value={selectedLocation} onChange={e => setSelectedLocation(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none">
                      <option value="" disabled>เลือกพื้นที่...</option>
                      <option value="พื้นที่อำเภอกำแพงแสน">1. พื้นที่อำเภอกำแพงแสน</option>
                      <option value="คลังพัสดุนครชัยศรี">2. คลังพัสดุนครชัยศรี</option>
                      <option value="สำนักงานกฟก.3">3. สำนักงานกฟก.3</option>
                      <option value="อื่นๆ">4. อื่นๆ</option>
                 </select>
                 {selectedLocation === 'อื่นๆ' && (
                    <input type="text" value={customLocation} onChange={e => setCustomLocation(e.target.value)} placeholder="ระบุเอง..." className="w-full p-4 mt-2 bg-purple-50 text-[#742F99] rounded-2xl border border-purple-100 outline-none" />
                 )}
              </div>

              <button onClick={handleTakeOut} disabled={loading} className="w-full bg-[#742F99] text-white py-4 rounded-2xl font-bold mt-2 shadow-lg hover:bg-[#5b237a] transition-all">
                {loading ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
               <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-red-600 text-lg">↩️ คืนรถ</h3>
                  <span className="text-xs text-gray-400">{currentTime.toLocaleTimeString('th-TH')}</span>
               </div>

               <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <p className="text-orange-800 text-sm font-bold">👤 ผู้ใช้: {activeLog?.driver_name}</p>
                  <p className="text-orange-600 text-xs mt-1">ไมล์เริ่ม: {activeLog?.start_mileage?.toLocaleString()}</p>
               </div>

               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 ml-1">เลขไมล์จบงาน</label>
                  <input 
                    type="number" value={endMileage} onChange={e => setEndMileage(e.target.value)} placeholder="ต้องมากกว่าไมล์เริ่ม..."
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-red-500 outline-none font-mono text-lg" 
                  />
               </div>

               <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">เติมน้ำมัน (ลิตร)</label>
                    <input type="number" value={fuelLiters} onChange={e => setFuelLiters(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 text-center" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase">จำนวนเงิน (บาท)</label>
                    <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 text-center" />
                  </div>
               </div>

               <button onClick={handleReturn} disabled={loading} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold shadow-lg mt-4">
                 {loading ? 'กำลังบันทึก...' : 'ยืนยันการคืนรถ'}
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}