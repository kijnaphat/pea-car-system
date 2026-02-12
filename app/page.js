'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams, useRouter } from 'next/navigation'

// --- Main Component: ตัวจัดการเปลี่ยนหน้าอัตโนมัติ ---
export default function App() {
  const searchParams = useSearchParams()
  const carId = searchParams.get('car_id') // ตรวจสอบว่ามีเลขรถส่งมาใน URL ไหม

  // 1. ถ้ามีเลขรถ (เช่น /?car_id=1) -> แสดงหน้าฟอร์มบันทึก
  if (carId) {
    return <CarActionForm carId={carId} />
  }

  // 2. ถ้าไม่มีเลขรถ (หน้าแรกสุด /) -> แสดงรายชื่อรถให้เลือก
  return <CarSelector />
}

// ==========================================
// ส่วนที่ 1: หน้าเลือกรถ (Home / Car Selector)
// ==========================================
function CarSelector() {
  const router = useRouter()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCars = async () => {
      try {
        // ดึงข้อมูลรถเรียงตามทะเบียน
        const { data } = await supabase.from('cars').select('*').order('plate_number', { ascending: true })
        if (data) setCars(data)
      } catch (err) {
        console.error("Error fetching cars:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchCars()
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#742F99] border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-[#742F99] font-bold animate-pulse">กำลังโหลดข้อมูลยานพาหนะ...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sarabun pb-10">
      
      {/* 🟣 Header สีม่วง PEA */}
      <div className="bg-gradient-to-br from-[#591d79] via-[#742F99] to-[#8e44ad] px-6 pt-12 pb-24 text-white rounded-b-[3.5rem] shadow-2xl relative overflow-hidden">
        
        {/* ลายน้ำ Logo PEA จางๆ */}
        <div className="absolute top-[-10%] right-[-10%] opacity-10 pointer-events-none rotate-12">
           <img src="/pea_logo.png" className="w-64 h-64 blur-[2px]" alt="bg-logo" />
        </div>

        <div className="flex justify-between items-center relative z-10">
          <div className="flex items-center gap-3">
             <div className="bg-white p-2 rounded-2xl shadow-lg">
                <img src="/pea_logo.png" className="w-10 h-10 object-contain" alt="logo" />
             </div>
             <div>
               <h1 className="text-xl font-black uppercase tracking-tight">PEA SMART CAR</h1>
               <p className="text-[10px] text-purple-200 tracking-wider">ระบบจัดการยานพาหนะดิจิทัล</p>
             </div>
          </div>
          {/* ✅ ปุ่มไป Dashboard (ใช้ลิงก์ย่อ /dashboard) */}
          <button 
            onClick={() => router.push('/dashboard')} 
            className="bg-white/20 hover:bg-white/30 p-3 rounded-2xl backdrop-blur-md border border-white/20 shadow-lg active:scale-95 transition-all"
            title="ดูภาพรวม (Dashboard)"
          >
            📊
          </button>
        </div>

        <div className="mt-10 text-center relative z-10">
           <h2 className="text-3xl font-bold drop-shadow-md">เลือกยานพาหนะ 🚗</h2>
           <p className="text-purple-100 text-sm mt-2 font-light">แตะที่รถเพื่อเริ่มงานหรือคืนรถ</p>
        </div>
      </div>

      {/* ⚪ รายการรถ (Grid List) */}
      <div className="-mt-14 px-5 space-y-4 relative z-20">
        {cars.map((car) => (
          <div 
            key={car.id} 
            onClick={() => router.push(`/?car_id=${car.id}`)} // ✅ ลิงก์ภายใน ใช้ /?car_id=...
            className="bg-white p-5 rounded-[2rem] shadow-md border border-gray-50 flex items-center gap-5 active:scale-95 transition-all cursor-pointer group hover:shadow-xl relative overflow-hidden"
          >
            {/* แถบสีสถานะด้านซ้าย */}
            <div className={`absolute left-0 top-0 bottom-0 w-2 ${car.status === 'available' ? 'bg-green-500' : 'bg-red-500'}`}></div>

            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-inner ${
              car.status === 'available' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {car.car_type === 'รถตู้' ? '🚐' : car.car_type === 'รถเก๋ง' ? '🚗' : '🛻'}
            </div>
            
            <div className="flex-1">
              <h3 className="text-xl font-extrabold text-gray-800 group-hover:text-[#742F99] transition-colors">{car.plate_number}</h3>
              <p className="text-xs text-gray-400 uppercase tracking-wide">{car.model}</p>
              <div className="flex gap-2 mt-2">
                 <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${
                    car.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700 animate-pulse'
                 }`}>
                    {car.status === 'available' ? '● ว่าง' : '● ใช้งานอยู่'}
                 </span>
              </div>
            </div>

            {/* ปุ่มลูกศร */}
            <div className="bg-gray-50 p-3 rounded-full text-gray-400 group-hover:bg-[#742F99] group-hover:text-white transition-colors">
              ➔
            </div>
          </div>
        ))}
      </div>
      
      <div className="text-center mt-10">
         <p className="text-[10px] text-gray-300 uppercase tracking-[0.3em]">PEA Fleet Management System v2.0</p>
      </div>
    </div>
  )
}

// ==========================================
// ส่วนที่ 2: หน้าฟอร์มบันทึก (Action Form)
// ==========================================
function CarActionForm({ carId }) {
  const router = useRouter()
  const [car, setCar] = useState(null)
  const [activeLog, setActiveLog] = useState(null)
  
  // State: นำรถออก
  const [employeeId, setEmployeeId] = useState('')
  const [staffName, setStaffName] = useState('') 
  const [staffPosition, setStaffPosition] = useState('') 
  const [mileage, setMileage] = useState('')
  const [selectedLocation, setSelectedLocation] = useState('') 
  const [customLocation, setCustomLocation] = useState('') 

  // State: คืนรถ
  const [endMileage, setEndMileage] = useState('')
  const [fuelLiters, setFuelLiters] = useState('')
  const [fuelCost, setFuelCost] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // นาฬิกา Realtime
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // ดึงข้อมูลรถ
  useEffect(() => {
    const fetchData = async () => {
      const { data: c } = await supabase.from('cars').select('*').eq('id', carId).single()
      if (c) {
        setCar(c)
        if (c.status === 'available') {
           // ดึงเลขไมล์ล่าสุดมาใส่ให้
           const { data: l } = await supabase.from('trip_logs')
             .select('end_mileage').eq('car_id', carId).eq('is_completed', true)
             .order('created_at', { ascending: false }).limit(1).single()
           if (l?.end_mileage) setMileage(l.end_mileage.toString())
        } else {
           // ดึงข้อมูลการใช้งานปัจจุบัน (เพื่อคืนรถ)
           const { data: l } = await supabase.from('trip_logs')
             .select('*').eq('car_id', carId).eq('is_completed', false)
             .limit(1).single()
           if (l) setActiveLog(l)
        }
      }
    }
    fetchData()
  }, [carId])

  // ดึงชื่อพนักงาน
  useEffect(() => {
    if (employeeId.length >= 4) {
      const fetchStaff = async () => {
        const { data } = await supabase.from('staff').select('full_name, position').eq('staff_code', employeeId).single()
        if (data) {
          setStaffName(data.full_name); setStaffPosition(data.position)
        } else {
          setStaffName(''); setStaffPosition('')
        }
      }
      fetchStaff()
    }
  }, [employeeId])

  // ฟังก์ชัน: นำรถออก
  const handleTakeOut = async () => {
    // เช็คเงื่อนไข: ถ้าเลือก 'อื่นๆ' ให้ใช้ค่าจากช่องกรอกเอง
    const finalLocation = selectedLocation === 'อื่นๆ' ? customLocation : selectedLocation

    if (!employeeId || !mileage || !finalLocation) return alert('กรุณากรอกข้อมูลให้ครบทุกช่องครับ')
    
    setLoading(true)
    try {
      const { error } = await supabase.from('trip_logs').insert({
        car_id: carId,
        driver_name: staffName || employeeId,
        driver_position: staffPosition,
        start_mileage: parseFloat(mileage),
        location: finalLocation, // ✅ บันทึกสถานที่
        start_time: new Date().toISOString(),
        is_completed: false
      })
      if (error) throw error
      await supabase.from('cars').update({ status: 'busy' }).eq('id', carId)
      
      alert('✅ บันทึกนำรถออกสำเร็จ!')
      window.location.href = '/' // กลับหน้าแรก
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // ฟังก์ชัน: คืนรถ
  const handleReturn = async () => {
    if (!endMileage) return alert('กรุณากรอกเลขไมล์จบงานครับ')
    
    setLoading(true)
    try {
      await supabase.from('trip_logs').update({
        end_mileage: parseFloat(endMileage),
        fuel_liters: fuelLiters ? parseFloat(fuelLiters) : 0,
        fuel_cost: fuelCost ? parseFloat(fuelCost) : 0,
        end_time: new Date().toISOString(),
        is_completed: true
      }).eq('id', activeLog.id)
      
      await supabase.from('cars').update({ status: 'available' }).eq('id', carId)
      
      alert('✅ บันทึกคืนรถเรียบร้อย!')
      window.location.href = '/' // กลับหน้าแรก
    } catch (err) {
      alert('เกิดข้อผิดพลาด: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!car) return <div className="min-h-screen flex items-center justify-center text-[#742F99] font-bold">กำลังโหลดข้อมูลรถ...</div>

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sarabun flex flex-col pb-10">
      
      {/* 🟣 Header หน้าฟอร์ม */}
      <div className="bg-gradient-to-br from-[#742F99] to-[#521d70] px-6 pt-12 pb-24 text-white rounded-b-[2.5rem] shadow-lg relative">
        {/* ปุ่มย้อนกลับ */}
        <button 
            onClick={() => window.location.href = '/'} 
            className="absolute top-12 left-6 bg-white/20 hover:bg-white/30 p-2 px-4 rounded-xl text-sm backdrop-blur-md transition-all flex items-center gap-1"
        >
            ⬅ กลับ
        </button>

        <div className="text-center mt-8">
          <h2 className="text-4xl font-black tracking-tight">{car.plate_number}</h2>
          <p className="text-purple-200 mt-1 uppercase tracking-widest text-xs">{car.model}</p>
        </div>

        {/* ✅ ปุ่มพิมพ์รายงาน (ลิงก์ย่อ /report) */}
        <div className="absolute top-12 right-6">
            <button 
                onClick={() => window.open(`/report?car_id=${car.id}`, '_blank')} 
                className="bg-[#F3B236] hover:bg-yellow-400 p-3 rounded-full shadow-lg shadow-yellow-600/20 transition-all active:scale-90"
                title="พิมพ์รายงาน"
            >
                🖨️
            </button>
        </div>
      </div>

      {/* ⚪ Form Container */}
      <div className="-mt-14 px-4 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-50">
          
          {car.status === 'available' ? (
            // === ฟอร์มนำรถออก ===
            <div className="space-y-4">
              <h3 className="font-bold text-[#742F99] border-b pb-3 text-lg flex items-center gap-2">
                <span>📋</span> บันทึกนำรถออก
              </h3>

              {/* รหัสพนักงาน */}
              <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">รหัสพนักงาน</label>
                 <input 
                    type="text" 
                    value={employeeId} 
                    onChange={e => setEmployeeId(e.target.value)} 
                    placeholder="กรอกรหัสพนักงาน..." 
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-[#742F99] focus:bg-white focus:outline-none transition-all" 
                 />
                 {staffName && (
                    <div className="flex items-center gap-2 text-green-600 text-sm font-bold bg-green-50 p-2 rounded-xl mt-1">
                        <span>✓</span> {staffName} <span className="text-xs text-green-500 font-normal">({staffPosition})</span>
                    </div>
                 )}
              </div>

              {/* เลขไมล์ */}
              <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">เลขไมล์เริ่มต้น</label>
                 <input 
                    type="number" 
                    value={mileage} 
                    onChange={e => setMileage(e.target.value)} 
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-[#742F99] focus:bg-white focus:outline-none transition-all font-mono text-lg" 
                 />
              </div>

              {/* สถานที่ (Dropdown + Custom) */}
              <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">สถานที่ปฏิบัติงาน</label>
                 <select 
                    value={selectedLocation} 
                    onChange={e => setSelectedLocation(e.target.value)} 
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-[#742F99] focus:bg-white focus:outline-none appearance-none transition-all"
                 >
                     <option value="" disabled>-- กรุณาเลือกสถานที่ --</option>
                     <option value="พื้นที่อำเภอกำแพงแสน">1. พื้นที่อำเภอกำแพงแสน</option>
                     <option value="คลังพัสดุนครชัยศรี">2. คลังพัสดุนครชัยศรี</option>
                     <option value="สำนักงานกฟก.3">3. สำนักงานกฟก.3</option>
                     <option value="อื่นๆ">4. อื่นๆ (ระบุเอง)</option>
                 </select>

                 {/* ช่องกรอกเอง (แสดงเมื่อเลือกอื่นๆ) */}
                 {selectedLocation === 'อื่นๆ' && (
                    <input 
                        type="text" 
                        value={customLocation} 
                        onChange={e => setCustomLocation(e.target.value)} 
                        placeholder="ระบุสถานที่..." 
                        className="w-full p-4 mt-2 bg-purple-50 text-[#742F99] rounded-2xl border border-purple-200 focus:outline-none animate-fade-in-down" 
                    />
                 )}
              </div>

              <button 
                onClick={handleTakeOut} 
                disabled={loading} 
                className="w-full bg-[#742F99] hover:bg-[#5b237a] text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-purple-200 active:scale-95 transition-all mt-4"
              >
                {loading ? 'กำลังบันทึก...' : 'ยืนยันการนำรถออก'}
              </button>
            </div>
          ) : (
            // === ฟอร์มคืนรถ ===
            <div className="space-y-4">
               <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-red-600 text-lg flex items-center gap-2">
                    <span>↩️</span> คืนรถ
                  </h3>
                  <span className="text-xs text-gray-400 font-mono">{currentTime.toLocaleTimeString('th-TH')}</span>
               </div>

               {/* ข้อมูลผู้ใช้งานปัจจุบัน */}
               <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <p className="text-orange-800 text-sm font-bold flex items-center gap-2">
                    👤 ผู้ใช้: {activeLog?.driver_name}
                  </p>
                  <p className="text-orange-600 text-xs mt-1 ml-6">
                    ไมล์เริ่ม: {activeLog?.start_mileage?.toLocaleString()} | สถานที่: {activeLog?.location}
                  </p>
               </div>

               {/* เลขไมล์จบ */}
               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wide ml-1">เลขไมล์จบงาน</label>
                  <input 
                    type="number" 
                    value={endMileage} 
                    onChange={e => setEndMileage(e.target.value)} 
                    placeholder="กรอกเลขไมล์เมื่อถึง..."
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-red-500 focus:bg-white focus:outline-none transition-all font-mono text-lg" 
                  />
               </div>

               {/* ข้อมูลน้ำมัน (Option) */}
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

               <button 
                 onClick={handleReturn} 
                 disabled={loading} 
                 className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-red-200 active:scale-95 transition-all mt-4"
               >
                 {loading ? 'กำลังบันทึก...' : 'ยืนยันการคืนรถ'}
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}