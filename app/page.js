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
// 1. หน้าแสดงผล (Home - Premium List View)
// ==========================================
function CarSelector() {
  const router = useRouter()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchCars = async () => {
    try {
      // 1. ดึงข้อมูลรถทั้งหมด
      const { data: carsData } = await supabase.from('cars').select('*')
      
      // 2. ดึงข้อมูล Log ที่ยังไม่จบ (เพื่อเอาเวลาเริ่มงาน)
      const { data: activeLogs } = await supabase.from('trip_logs').select('car_id, start_time, driver_name').eq('is_completed', false)

      if (carsData) {
        // 3. รวมข้อมูลรถ + เวลาเริ่มงาน
        const mergedCars = carsData.map(car => {
            const log = activeLogs?.find(l => l.car_id === car.id)
            return { ...car, activeLog: log } // ยัด log เข้าไปในรถ
        })

        // 4. จัดเรียง: รถไม่ว่าง (busy) ขึ้นก่อน
        mergedCars.sort((a, b) => {
            if (a.status === 'busy' && b.status !== 'busy') return -1 // a ขึ้นก่อน
            if (a.status !== 'busy' && b.status === 'busy') return 1  // b ขึ้นก่อน
            return a.plate_number.localeCompare(b.plate_number) // ถ้าสถานะเหมือนกัน เรียงตามทะเบียน
        })

        setCars(mergedCars)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCars()
    const interval = setInterval(fetchCars, 5000) // Auto Refresh 5 วิ
    return () => clearInterval(interval)
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#742F99] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#EBF0F6] font-sarabun pb-6">
      
      {/* 🟣 Header (Modern Curve) */}
      <div className="bg-gradient-to-r from-[#742F99] to-[#591d79] px-6 pt-12 pb-20 text-white rounded-b-[3rem] shadow-xl relative z-10">
        <div className="flex justify-between items-start">
          <div>
             <h1 className="text-2xl font-black tracking-tight">PEA SMART VEHICLE</h1>
             <p className="text-purple-200 text-sm opacity-90">ระบบบริหารจัดการยานพาหนะ</p>
          </div>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/10 active:scale-95 transition-all shadow-lg"
          >
            📊
          </button>
        </div>
      </div>

      {/* 🔶 Alert Instruction (ป้ายนิ่ง ไม่กระพริบแล้ว) */}
      <div className="-mt-12 mx-4 relative z-20 mb-6">
        {/* ✅ ลบ animate-pulse ออกแล้วครับ */}
        <div className="bg-gradient-to-br from-[#F2994A] to-[#F3B236] p-5 rounded-3xl shadow-xl shadow-orange-500/30 text-white flex items-center justify-between ring-4 ring-white">
            <div className="flex items-center gap-4">
                <div className="bg-white/20 p-3 rounded-2xl">
                    <span className="text-3xl">📱</span>
                </div>
                <div>
                    <h3 className="text-lg font-black drop-shadow-sm uppercase">สแกน QR Code ทุกครั้ง</h3>
                    <p className="text-xs opacity-90 font-medium bg-black/10 px-2 py-0.5 rounded-md inline-block mt-1">
                        เมื่อนำรถออก หรือ คืนรถ
                    </p>
                </div>
            </div>
            <div className="text-2xl opacity-80">➔</div>
        </div>
      </div>

      {/* ⚪ รายการรถ (List View 1 Column) */}
      <div className="px-4 space-y-4 relative z-20">
        {cars.map((car) => (
          <div 
            key={car.id} 
            className={`relative p-5 rounded-[2rem] shadow-sm border transition-all ${
                car.status === 'busy' 
                ? 'bg-white border-red-100 shadow-red-100' // รถไม่ว่าง
                : 'bg-white border-gray-100' // รถว่าง
            }`}
          >
             {/* 🖨️ ปุ่มพิมพ์ (มุมขวาบน) */}
             <button 
                 onClick={(e) => {
                    e.stopPropagation()
                    window.open(`/report?car_id=${car.id}`, '_blank')
                 }}
                 className="absolute top-4 right-4 bg-gray-50 hover:bg-gray-200 text-gray-400 p-2 rounded-xl transition-colors z-30"
             >
                 🖨️
             </button>

             <div className="flex items-start gap-4">
                {/* Icon รถ */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${
                    car.status === 'available' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                }`}>
                    {car.car_type === 'รถตู้' ? '🚐' : car.car_type === 'รถเก๋ง' ? '🚗' : '🛻'}
                </div>

                <div className="flex-1 pt-1">
                    {/* ทะเบียน */}
                    <h3 className="text-xl font-black text-gray-800 tracking-tight">{car.plate_number}</h3>
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{car.model}</p>

                    {/* Badge สถานะ + เวลา */}
                    <div className="mt-3 flex flex-wrap gap-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                            car.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                            <span className={`w-2 h-2 rounded-full ${car.status === 'available' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                            {car.status === 'available' ? 'ว่างพร้อมใช้' : 'กำลังใช้งาน'}
                        </span>

                        {/* 🕒 โชว์เวลาเฉพาะตอนไม่ว่าง */}
                        {car.status === 'busy' && car.activeLog && (
                            <span className="px-3 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-600 flex items-center gap-1">
                                🕒 ออก: {new Date(car.activeLog.start_time).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.
                            </span>
                        )}
                    </div>
                    
                    {/* ชื่อคนขับ (ถ้าไม่ว่าง) */}
                    {car.status === 'busy' && car.activeLog && (
                         <p className="text-[10px] text-gray-400 mt-2 ml-1">
                            โดย: {car.activeLog.driver_name}
                         </p>
                    )}
                </div>
             </div>
          </div>
        ))}
        
        <div className="text-center pt-6 text-gray-300 text-[10px]">
            PEA Fleet System v2.3
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 2. หน้าฟอร์มบันทึก (Action Form) - Logic เดิม
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