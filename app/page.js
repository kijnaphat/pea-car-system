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

  // 2. ถ้าไม่มี -> ไปหน้า Home
  return <CarSelector />
}

// ==========================================
// 1. หน้าแสดงผล (Home)
// ==========================================
function CarSelector() {
  const router = useRouter()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  
  // ✅ State สำหรับควบคุมการเปิด/ปิดหน้าต่างคู่มือ
  const [showInstructions, setShowInstructions] = useState(false)

  const fetchCars = async () => {
    try {
      const { data: carsData } = await supabase.from('cars').select('*')
      const { data: activeLogs } = await supabase.from('trip_logs').select('car_id, start_time, driver_name').eq('is_completed', false)
      
      // ✅ ดึงข้อมูล car_id ทั้งหมดใน trip_logs เพื่อเช็คว่าคันไหนเคยใช้งานแล้วบ้าง
      const { data: allLogs } = await supabase.from('trip_logs').select('car_id')

      if (carsData) {
        // ✅ สร้าง Set เอาไว้ตรวจสอบว่ามีประวัติการใช้รถหรือไม่
        const activatedSet = new Set(allLogs?.map(l => l.car_id) || [])

        const mergedCars = carsData.map(car => {
            const log = activeLogs?.find(l => l.car_id === car.id)
            // ✅ เพิ่ม isActivated เข้าไป
            return { ...car, activeLog: log, isActivated: activatedSet.has(car.id) }
        })

        mergedCars.sort((a, b) => {
            if (a.status === 'busy' && b.status !== 'busy') return -1 
            if (a.status !== 'busy' && b.status === 'busy') return 1  
            return a.plate_number.localeCompare(b.plate_number)
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
    const interval = setInterval(fetchCars, 5000) 
    return () => clearInterval(interval)
  }, [])

  // ฟังก์ชันช่วยดึงรูปภาพรถตามประเภท
  const getCarImage = (car) => {
    const type = car.car_type || ''
    
    // ✅ เช็คว่าเป็นรถ EV หรือไม่ (ดูจาก fuel_type แทนทะเบียน)
    if (car.car_type?.toUpperCase() === 'รถ EV') return '/mg.png'
    if (car.car_type?.toUpperCase() === 'รถ EV ทดเเทน') return '/mg2.png'
    
    // เช็คตามคำขึ้นต้นของประเภทรถ
    if (type.startsWith('รถกระเช้า')) return '/aerial_lift.png'
    if (type.startsWith('รถบรรทุก 2 ตันเเก้ไฟ')) return '/2_ton_truck.png'
    if (type.startsWith('รถเครน')) return '/crane.png'
    if (type.startsWith('รถตู้โดยสาร') || type.startsWith('รถตู้')) return '/van.png'
    if (type.startsWith('รถกระบะ')) return '/truck.png'
    if (type.startsWith('รถบรรทุก 2')) return '/2ton.png'
    if (type.startsWith('รถบรรทุก 1 ตันแก้ไฟ')) return '/1ton.png'
    if (type.startsWith('รถบรรทุก 6 ตัน ฮอทไลน์')) return '/hotline.png'
    
    return null 
  }

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#742F99] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#EBF0F6] font-sarabun pb-6 relative">
      
      {/* 🟣 Header */}
      <div className="bg-gradient-to-r from-[#742F99] to-[#591d79] px-6 pt-12 pb-24 text-white rounded-b-[3rem] shadow-xl relative z-10">
        <div className="flex justify-between items-start">
          <div>
             <h1 className="text-2xl font-black tracking-tight">PEA SMART VEHICLE MANAGEMENT</h1>
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

      {/* 🌟 Alert Instruction (ป้ายเหลือง) */}
      <div className="-mt-16 mx-4 relative z-20 mb-8">
        <style>{`
          @keyframes scroll-left {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-100%); }
          }
          .animate-scrolling-text {
            display: inline-block;
            white-space: nowrap;
            padding-left: 100%;
            animation: scroll-left 25s linear infinite;
            will-change: transform;
          }
        `}</style>

        <div className="bg-gradient-to-r from-[#FF8008] to-[#FFC837] p-1 rounded-[2rem] shadow-2xl shadow-orange-500/40">
          <div className="bg-white/10 backdrop-blur-xl rounded-[1.8rem] p-4 flex flex-col gap-3 border border-white/30">
              
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="bg-white text-orange-500 w-12 h-12 rounded-full shadow-lg flex items-center justify-center relative">
                          <span className="absolute w-full h-full rounded-full border-4 border-orange-300 animate-ping opacity-30"></span>
                          <span className="text-2xl z-10">📱</span>
                      </div>
                      <div>
                          <h3 className="text-white text-xl font-black tracking-widest drop-shadow-md">SCAN QR CODE</h3>
                          <p className="text-orange-50 text-[10px] uppercase font-bold tracking-widest bg-black/20 px-2 py-0.5 rounded-md inline-block mt-0.5">
                              ระบบสแกนรับ-คืนรถ
                          </p>
                      </div>
                  </div>
                  
                  {/* ปุ่มกดเพื่อเปิด Modal อธิบายการใช้งาน */}
                  <button 
                      onClick={() => setShowInstructions(true)}
                      className="bg-white/20 hover:bg-white/40 text-white w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/40 shadow-inner transition-all active:scale-95 cursor-pointer"
                      title="คลิกเพื่อดูวิธีใช้งาน"
                  >
                      <span className="text-xl font-bold">➔</span>
                  </button>
              </div>

              <div className="bg-black/25 rounded-xl p-2 relative overflow-hidden border border-white/10 flex items-center h-10 w-full">
                  <div className="w-full overflow-hidden">
                      <p className="text-white text-sm font-bold animate-scrolling-text drop-shadow-sm tracking-wide">
                          กรุณาสแกน QR Code ประจำรถ เพื่อทำรายการ นำรถออก หรือ คืนรถ / ชาร์จรถ ทุกครั้งเพื่ออัปเดตสถานะในระบบ 🚗⚡
                      </p>
                  </div>
              </div>
          </div>
        </div>
      </div>

      {/* ⚪ รายการรถ */}
      <div className="px-4 space-y-4 relative z-20">
        {cars.map((car) => {
          const carImageSrc = getCarImage(car)
          
          // ✅ เช็คว่าเป็น EV ไหม สำหรับเปลี่ยน Text ในป้ายสถานะ
          const isEV = car.fuel_type?.toUpperCase() === 'EV' || car.car_type?.toUpperCase().includes('EV')

          return (
            <div 
                key={car.id} 
                className={`relative p-5 rounded-[2rem] shadow-sm border transition-all ${
                    car.status === 'busy' 
                    ? 'bg-white border-red-100 shadow-red-100' 
                    : 'bg-white border-gray-100'
                }`}
            >
                <button 
                    onClick={(e) => {
                        e.stopPropagation()
                        window.open(`/report?car_id=${car.id}`, '_blank')
                    }}
                    className="absolute top-4 right-4 bg-gray-50 hover:bg-gray-200 text-gray-400 p-2 rounded-xl transition-colors z-30"
                >
                    🖨️
                </button>

                <div className="flex items-center gap-4">
                    {/* ✅ อัปเดตสีพื้นหลังรูปให้เป็นสีเทาถ้า Not Activated */}
                    <div className={`w-20 h-20 flex-shrink-0 rounded-2xl flex items-center justify-center text-3xl shadow-inner overflow-hidden ${
                        !car.isActivated ? 'bg-gray-100 text-gray-400' : car.status === 'available' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                        {carImageSrc ? (
                            <img src={carImageSrc} alt={car.car_type} className="w-full h-full object-cover" />
                        ) : (
                            '🚗'
                        )}
                    </div>

                    <div className="flex-1">
                        <h3 className="text-xl font-black text-gray-800 tracking-tight">{car.plate_number}</h3>
                        
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">
                            {car.model} <span className="mx-1 text-gray-300">|</span> <span className="text-[#742F99]">{car.car_type}</span>
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                            {/* ✅ อัปเดตสีป้ายสถานะและข้อความเฉพาะ EV */}
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                !car.isActivated ? 'bg-gray-100 text-gray-500' : car.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${!car.isActivated ? 'bg-gray-400' : car.status === 'available' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                                {!car.isActivated ? 'Not Activated' : car.status === 'available' ? (isEV ? 'พร้อมใช้งาน' : 'ว่างพร้อมใช้') : (isEV ? 'กำลังชาร์จไฟ' : 'กำลังใช้งาน')}
                            </span>

                            {car.status === 'busy' && car.activeLog && (
                                <span className="px-3 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-600 flex items-center gap-1">
                                    🕒 ออก: {new Date(car.activeLog.start_time).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.
                                </span>
                            )}
                        </div>
                        
                        {car.status === 'busy' && car.activeLog && (
                            <p className="text-[10px] text-gray-400 mt-2 ml-1 font-bold">
                                👤 โดย: <span className="text-gray-600">{car.activeLog.driver_name}</span>
                            </p>
                        )}
                    </div>
                </div>
            </div>
          )
        })}
        
        <div className="text-center pt-6 text-gray-300 text-[10px]">
            PEA Fleet System v2.26 (Unlocked EV Mileage)
        </div>
      </div>

      {/* ✅ Modal คำอธิบายการใช้งาน */}
      {showInstructions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowInstructions(false)}
            ></div>
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl relative z-10 max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                <div className="bg-gradient-to-r from-[#742F99] to-[#591d79] p-5 text-white flex justify-between items-center shadow-md z-10">
                    <h2 className="text-lg font-black flex items-center gap-2">
                        <span>📖</span> คู่มือการใช้งานระบบ
                    </h2>
                    <button 
                        onClick={() => setShowInstructions(false)}
                        className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors text-sm"
                    >✖</button>
                </div>
                <div className="p-5 overflow-y-auto space-y-5 text-gray-700 bg-gray-50">
                    <div className="bg-white border border-red-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-red-300 text-red-700 font-bold p-3 flex items-center gap-2 text-sm">
                            <span className="text-lg">🚙</span> รถยนต์ทั่วไป (รถใช้น้ำมัน)
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="relative">
                                <div className="absolute left-[9px] top-6 bottom-[-20px] w-0.5 bg-orange-100"></div>
                                <h4 className="font-bold text-red-600 text-xs mb-1 flex items-center gap-2">
                                    <span className="bg-red-300 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] z-10 relative">1</span> 
                                    การนำรถออก
                                </h4>
                                <p className="text-[11px] text-gray-500 ml-7 leading-relaxed">
                                    สแกน QR Code ➔ กรอกรหัสประจำตัว ➔ กรอกเลขไมล์เริ่มต้น ➔ กรอกสถานที่ ➔ <span className="text-red-600 font-bold">กดยืนยันนำรถออก</span>
                                </p>
                            </div>
                            <div className="relative">
                                <h4 className="font-bold text-red-600 text-xs mb-1 flex items-center gap-2">
                                    <span className="bg-red-300 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] z-10 relative">2</span> 
                                    การคืนรถ
                                </h4>
                                <p className="text-[11px] text-gray-500 ml-7 leading-relaxed">
                                    สแกน QR Code ➔ กรอกเลขไมล์ล่าสุดหลังใช้รถ ➔ กรอกข้อมูลเติมน้ำมัน ➔ <span className="text-red-600 font-bold">กดยืนยันคืนรถ</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white border border-sky-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-sky-300 text-sky-700 font-bold p-3 flex items-center gap-2 text-sm">
                            <span className="text-lg">⚡</span> รถยนต์ไฟฟ้า (EV)
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="relative">
                                <div className="absolute left-[9px] top-6 bottom-[-20px] w-0.5 bg-green-100"></div>
                                <h4 className="font-bold text-sky-600 text-xs mb-1 flex items-center gap-2">
                                    <span className="bg-sky-300 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] z-10 relative">1</span> 
                                    การเริ่มชาร์จไฟรถ
                                </h4>
                                <p className="text-[11px] text-gray-500 ml-7 leading-relaxed">
                                    สแกน QR Code ➔ กรอกรหัสประจำตัว ➔ กรอกเลขไมล์ ➔ กรอก%แบตก่อนชาร์จ ➔ เลือกสถานี ➔ <span className="text-sky-600 font-bold">กดยืนยันเริ่มชาร์จ</span>
                                </p>
                            </div>
                            <div className="relative">
                                <h4 className="font-bold text-sky-600 text-xs mb-1 flex items-center gap-2">
                                    <span className="bg-sky-300 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] z-10 relative">2</span> 
                                    การเลิกชาร์จไฟรถ
                                </h4>
                                <p className="text-[11px] text-gray-500 ml-7 leading-relaxed">
                                    สแกน QR Code ➔ กรอกปริมาณ%แบตเตอรี่ล่าสุด ➔ <span className="text-sky-600 font-bold">กดยืนยันเลิกชาร์จ</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t bg-white text-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button 
                        onClick={() => setShowInstructions(false)}
                        className="w-full bg-[#742F99] text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-[#591d79] transition-colors active:scale-95"
                    >รับทราบและเข้าใจแล้ว</button>
                </div>
            </div>
        </div>
      )}
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
  const [isMileageLocked, setIsMileageLocked] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState('') 
  const [customLocation, setCustomLocation] = useState('') 
  
  // Return Inputs
  const [endMileage, setEndMileage] = useState('')
  const [fuelLiters, setFuelLiters] = useState('')
  const [fuelCost, setFuelCost] = useState('')

  // EV Inputs
  const [battBefore, setBattBefore] = useState('')
  const [battAfter, setBattAfter] = useState('')
  const [stationType, setStationType] = useState('PEA') 
  const [subStationType, setSubStationType] = useState('') 
  const [stationName, setStationName] = useState('') 
  
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // ✅ State ควบคุมการแสดง Popup แจ้งเตือนเรื่องเติมน้ำมัน
  const [showFuelWarning, setShowFuelWarning] = useState(true)

  // ตัวเลือก Dropdown
  const kfkList = ['กฟจ.นฐ.', 'กฟส.นช.', 'กฟส.บลน.', 'กฟจ.สพ.', 'กฟส.อมง.', 'กฟส.ศปจ.', 'กฟจ.สค.','กฟส.กทบ.','กฟจ.กจ.','กฟส.ทมง.','กฟส.ทมก.','กฟส.สขบ.'];
  const otherBrandList = ['EA Anywhere', 'EV Station', 'MEA EV', 'EGAT', 'Emergency charger'];

  // Config ตัวเลือกสถานี
  const peaOptions = [
      { id: 'HQ', label: 'สำนักงานใหญ่ (สนญ.)', inputType: 'none' },
      { id: 'PEA_OFFICE', label: 'กฟก. (เลือกสาขา)', inputType: 'dropdown_kfk' }, 
      { id: 'BANGCHAK', label: 'บางจาก (ระบุ)', inputType: 'text' },
      { id: 'PEA_OTHER', label: 'PEA Volta อื่น ๆ (ระบุ)', inputType: 'text' },
  ]
  const otherOptions = [
      { id: 'WALL', label: 'Wall Charge', inputType: 'none' },
      { id: 'OTHER_BRAND', label: 'สถานีชาร์จ อื่น ๆ (เลือก)', inputType: 'dropdown_other' }, 
  ]

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const { data: c } = await supabase.from('cars').select('*').eq('id', carId).single()
      if (c) {
        setCar(c)
        
        // ✅ ตรวจสอบว่าเป็นรถ EV ไหมจากคอลัมน์ fuel_type
        const isThisCarEV = c?.fuel_type?.toUpperCase() === 'EV';

        if (c.status === 'available') {
           const { data: l } = await supabase.from('trip_logs')
             .select('end_mileage')
             .eq('car_id', carId)
             .eq('is_completed', true)
             .order('created_at', { ascending: false })
             .limit(1)
             .single()
           
           if (isThisCarEV) {
               // ✅ ถ้ารถเป็น EV ปลดล็อกช่องเลขไมล์ และให้เว้นว่างบังคับพิมพ์ใหม่
               setMileage('')
               setIsMileageLocked(false)
           } else if (l?.end_mileage) {
               // ถ้ารถน้ำมัน ดึงเลขไมล์เดิมมาแสดงและล็อกการแก้ไข
               setMileage(l.end_mileage.toString())
               setIsMileageLocked(true)
           } else {
               setMileage('0')
           }
        } else {
           const { data: l } = await supabase.from('trip_logs').select('*').eq('car_id', carId).eq('is_completed', false).limit(1).single()
           if (l) setActiveLog(l)
        }
      }
    }
    fetchData()
  }, [carId])

  const checkStaff = async () => {
    if (employeeId.length < 4) return
    const { data } = await supabase.from('staff').select('full_name, position').eq('staff_code', employeeId).single()
    if (data) {
        setStaffName(data.full_name); setStaffPosition(data.position); setStaffError(false)
    } else {
        setStaffName(''); setStaffPosition(''); setStaffError(true)
    }
  }

  // ✅ นำรถออก หรือ เริ่มชาร์จ EV
  const handleTakeOut = async () => {
    let currentName = staffName
    let currentPosition = staffPosition

    if (!currentName) {
        const { data } = await supabase.from('staff').select('full_name, position').eq('staff_code', employeeId).single()
        if (data) { 
            currentName = data.full_name; 
            currentPosition = data.position;
            setStaffPosition(data.position);
        }
    }

    if (!currentName) { setStaffError(true); alert('❌ ไม่พบรหัสพนักงานในระบบ'); return }

    // Validation
    const isEV = car?.fuel_type?.toUpperCase() === 'EV';
    const finalLocation = selectedLocation === 'อื่นๆ' ? customLocation : selectedLocation
    
    if (!employeeId) return alert('กรุณากรอกรหัสพนักงาน')
    
    if (isEV) {
        if (!mileage) return alert('กรุณากรอกเลขไมล์เริ่มต้น')
        if (!battBefore) return alert('กรุณากรอก % แบตเตอรี่ก่อนชาร์จ')
        if (!subStationType) return alert('กรุณาระบุประเภทสถานีชาร์จ')
        
        const selectedOption = (stationType === 'PEA' ? peaOptions : otherOptions).find(o => o.id === subStationType);
        if (selectedOption?.inputType !== 'none' && !stationName) {
            return alert('กรุณาระบุชื่อสถานี/สาขาให้ครบถ้วน')
        }
    } else {
        if (!mileage || !finalLocation) return alert('กรุณากรอกข้อมูลให้ครบถ้วน')
    }
    
    setLoading(true)

    try {
      // 1. เช็คสิทธิป้องกันรถคันนี้ถูกคนอื่นตัดหน้ายืมไปก่อน
      const { data: latestCar } = await supabase.from('cars').select('status').eq('id', carId).single()
      if (latestCar.status === 'busy') {
         alert('⚠️ รถคันนี้เพิ่งถูกบุคคลอื่นทำรายการนำออกไปแล้วครับ')
         window.location.href = '/'
         return
      }

      // 2. 🌟 NEW: เช็คว่าพนักงานคนนี้ มีค้างคืนรถคันอื่นอยู่ไหม? (ห้ามยืมซ้อน)
      const { data: activeTrips } = await supabase
          .from('trip_logs')
          .select(`
              car_id,
              cars ( plate_number )
          `)
          .eq('driver_name', currentName)
          .eq('is_completed', false);

      if (activeTrips && activeTrips.length > 0) {
          // ดึงทะเบียนรถคันที่ติดอยู่ออกมาบอกพนักงาน
          const busyPlate = activeTrips[0].cars?.plate_number || 'รถคันเดิม';
          alert(`⚠️ ไม่อนุญาตให้ทำรายการ!\nคุณ ${currentName} ยังไม่ได้ทำรายการคืนรถทะเบียน [ ${busyPlate} ]\n\nกรุณาสแกนเพื่อคืนรถคันเดิมให้เรียบร้อยก่อนครับ`);
          setLoading(false);
          return; // หยุดการทำงาน ไม่ให้ยืมรถใหม่
      }

      // 3. เตรียมข้อมูลที่จะ Insert
      const insertData = {
        car_id: carId, 
        driver_name: currentName, 
        driver_position: currentPosition,
        start_mileage: parseFloat(mileage || 0), 
        start_time: new Date().toISOString(), 
        is_completed: false
      }

      if (isEV) {
          const selectedOption = (stationType === 'PEA' ? peaOptions : otherOptions).find(o => o.id === subStationType);
          const label = selectedOption ? selectedOption.label.replace(/ \(.+\)/, '') : '';
          const finalStationName = (selectedOption?.inputType !== 'none' && stationName) ? `${label}: ${stationName}` : label;

          insertData.location = finalStationName; 
          insertData.battery_before = parseInt(battBefore);
          insertData.station_type = stationType;
          insertData.station_name = finalStationName;
      } else {
          insertData.location = finalLocation;
      }

      // 4. บันทึกข้อมูล
      const { error } = await supabase.from('trip_logs').insert(insertData)
      if (error) throw error
      await supabase.from('cars').update({ status: 'busy' }).eq('id', carId)
      
      if (isEV) {
          alert(`✅ บันทึกเริ่มการชาร์จสำเร็จ!\nสถานะรถเปลี่ยนเป็น "กำลังใช้งาน"\nเมื่อชาร์จเสร็จ กรุณาสแกน QR เพื่อนำที่ชาร์จออก`)
          window.location.href = '/'
      } else {
          alert(`✅ บันทึกสำเร็จ!\nเดินทางปลอดภัยครับ คุณ ${currentName}`)
          window.location.href = '/'
      }

    } catch (err) { 
        alert('Error: ' + err.message) 
        setLoading(false) 
    } 
  }

  // ✅ คืนรถ หรือ ถอดสายชาร์จ EV
  const handleReturn = async () => {
    const isEV = car?.fuel_type?.toUpperCase() === 'EV';
    const startM = parseFloat(activeLog.start_mileage)

    if (isEV) {
        if (!battAfter) return alert('กรุณากรอก % แบตเตอรี่หลังชาร์จ')
        if (activeLog.battery_before && parseInt(battAfter) <= parseInt(activeLog.battery_before)) {
            return alert('❌ ข้อมูลผิดพลาด!\nเปอร์เซ็นต์แบตเตอรี่ "หลังชาร์จ" ต้องมากกว่า "ก่อนชาร์จ"')
        }
    } else {
        if (!endMileage) return alert('กรุณากรอกเลขไมล์ล่าสุด (จบงาน)')
        const endM = parseFloat(endMileage)
        if (endM < startM) {
            return alert(`❌ เลขไมล์ผิดพลาด!\nเลขไมล์จบ (${endM}) น้อยกว่า เลขไมล์เริ่ม (${startM})`)
        }
    }

    setLoading(true)

    try {
      const { data: latestCar } = await supabase.from('cars').select('status').eq('id', carId).single()
      if (latestCar.status === 'available') {
         alert('⚠️ รายการนี้ถูกคืนไปเรียบร้อยแล้วครับ')
         window.location.href = '/'
         return
      }

      const updateData = {
        end_time: new Date().toISOString(),
        is_completed: true
      }

      if (isEV) {
          updateData.end_mileage = startM 
          updateData.battery_after = parseInt(battAfter)
      } else {
          updateData.end_mileage = parseFloat(endMileage)
          updateData.fuel_liters = fuelLiters ? parseFloat(fuelLiters) : 0
          updateData.fuel_cost = fuelCost ? parseFloat(fuelCost) : 0
      }

      await supabase.from('trip_logs').update(updateData).eq('id', activeLog.id)
      await supabase.from('cars').update({ status: 'available' }).eq('id', carId)
      
      alert('✅ บันทึกข้อมูลเรียบร้อย ขอบคุณครับ!')
      window.location.href = '/'
    } catch (err) { 
        alert('Error: ' + err.message)
        setLoading(false)
    }
  }

  if (!car) return <div className="min-h-screen flex items-center justify-center text-[#742F99]">กำลังโหลด...</div>

  const isEV = car?.fuel_type?.toUpperCase() === 'EV';

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sarabun flex flex-col pb-10">
      
      {/* ✅ Popup แจ้งเตือนการเติมน้ำมัน (แสดงเฉพาะตอนคืนรถน้ำมัน) */}
      {showFuelWarning && car.status !== 'available' && !isEV && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center animate-fade-in-down border border-gray-100">
               <div className="text-5xl mb-3">⛽</div>
               <h3 className="text-xl font-black text-gray-800 mb-2 tracking-tight">อย่าลืมข้อมูลน้ำมัน!</h3>
               <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  หากมีการ <span className="font-bold text-[#742F99]">เติมน้ำมัน</span> ระหว่างใช้งาน<br/>
                  กรุณากรอกปริมาณ (ลิตร) และ จำนวนเงิน (บาท) ด้วยนะครับ
               </p>
               <button 
                  onClick={() => setShowFuelWarning(false)} 
                  className="w-full bg-[#742F99] text-white py-3.5 rounded-xl font-bold hover:bg-[#5b237a] active:scale-95 transition-all shadow-md"
               >
                   รับทราบ และเริ่มกรอกข้อมูล
               </button>
           </div>
        </div>
      )}

      <div className="bg-[#742F99] px-6 pt-10 pb-20 text-white rounded-b-[2.5rem] shadow-lg relative">
        <button onClick={() => window.location.href = '/'} className="absolute top-10 left-5 bg-white/20 p-2 px-4 rounded-xl text-sm">⬅ กลับ</button>
        <div className="text-center mt-6">
          <h2 className="text-3xl font-black">{car.plate_number}</h2>
          <p className="text-purple-200 text-sm uppercase font-bold">{car.model} | {car.car_type}</p>
          {isEV && <span className="bg-green-400 text-green-900 text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 inline-block shadow-sm shadow-green-400/50">Electric Vehicle</span>}
        </div>
      </div>

      <div className="-mt-12 px-4 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-50">
          {car.status === 'available' ? (
            // ================== ฟอร์มนำรถออก ==================
            <div className="space-y-4">
              <h3 className="font-bold text-[#742F99] border-b pb-3 text-lg flex items-center gap-2">
                {isEV ? '⚡ บันทึกเริ่มการชาร์จรถ' : '📋 บันทึกนำรถออก'}
              </h3>
              
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
                 <div className="flex justify-between items-center ml-1">
                    <label className="text-xs font-bold text-gray-400">เลขไมล์เริ่มต้น</label>
                    {isMileageLocked && <span className="text-[10px] text-[#742F99] font-bold bg-purple-50 px-2 py-0.5 rounded-full">🔒 ต่อเนื่องจากล่าสุด</span>}
                 </div>
                 <input 
                    type="number" value={mileage} readOnly={isMileageLocked} onChange={e => setMileage(e.target.value)} 
                    placeholder={isEV ? "กรอกเลขไมล์ล่าสุด..." : ""}
                    className={`w-full p-4 rounded-2xl border outline-none font-mono text-lg transition-colors ${
                        isMileageLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'bg-gray-50 border-gray-100 focus:border-[#742F99]'
                    }`}
                 />
              </div>

              {isEV ? (
                  <div className="space-y-4 pt-2 border-t border-dashed border-gray-200">
                      <div className="space-y-1">
                           <label className="text-[11px] font-bold text-gray-400 ml-1 uppercase tracking-wider">แบตก่อนชาร์จ (%)</label>
                           <input type="number" value={battBefore} onChange={e => setBattBefore(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 text-center text-lg focus:border-[#742F99] outline-none" placeholder="ระบุตัวเลข 0-100" />
                      </div>

                      <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-400 ml-1 uppercase tracking-wider">ประเภทสถานีชาร์จ</label>
                          <div className="flex gap-2">
                              <button onClick={() => { setStationType('PEA'); setSubStationType(''); setStationName(''); }} className={`flex-1 py-3 rounded-xl text-[11px] font-bold border transition-all ${stationType === 'PEA' ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-gray-200 text-gray-400'}`}>สถานี PEA Volta</button>
                              <button onClick={() => { setStationType('OTHER'); setSubStationType(''); setStationName(''); }} className={`flex-1 py-3 rounded-xl text-[11px] font-bold border transition-all ${stationType === 'OTHER' ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-gray-200 text-gray-400'}`}>สถานีแบรนด์อื่นๆ</button>
                          </div>
                      </div>

                      <div className="space-y-2">
                          <label className="text-[11px] font-bold text-gray-400 ml-1 uppercase tracking-wider">ระบุสาขา / แบรนด์</label>
                          <div className="grid grid-cols-2 gap-2">
                              {(stationType === 'PEA' ? peaOptions : otherOptions).map((opt) => (
                                  <button 
                                     key={opt.id}
                                     onClick={() => { setSubStationType(opt.id); setStationName(''); }}
                                     className={`py-3 px-2 rounded-xl text-[11px] border text-left transition-all ${subStationType === opt.id ? 'bg-green-50 border-green-500 text-green-700 font-bold' : 'bg-white border-gray-100 text-gray-600'}`}
                                  >
                                     {subStationType === opt.id ? '● ' : '○ '}{opt.label}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {(() => {
                          const selectedOption = (stationType === 'PEA' ? peaOptions : otherOptions).find(o => o.id === subStationType);
                          if (!selectedOption) return null;

                          if (selectedOption.inputType === 'text') {
                              return (
                                  <div className="space-y-1 animate-fade-in-down pt-2">
                                       <label className="text-[10px] font-bold text-gray-400 uppercase">รายละเอียดเพิ่มเติม</label>
                                       <input type="text" value={stationName} onChange={e => setStationName(e.target.value)} placeholder="ระบุชื่อสถานี..." className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-[#742F99] outline-none" />
                                  </div>
                              );
                          }
                          if (selectedOption.inputType === 'dropdown_kfk') {
                              return (
                                  <div className="space-y-1 animate-fade-in-down pt-2">
                                       <label className="text-[10px] font-bold text-gray-400 uppercase">เลือกสาขาของ กฟก.</label>
                                       <select value={stationName} onChange={e => setStationName(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none">
                                           <option value="" disabled>-- กรุณาเลือก --</option>
                                           {kfkList.map(k => <option key={k} value={k}>{k}</option>)}
                                       </select>
                                  </div>
                              );
                          }
                          if (selectedOption.inputType === 'dropdown_other') {
                              return (
                                  <div className="space-y-1 animate-fade-in-down pt-2">
                                       <label className="text-[10px] font-bold text-gray-400 uppercase">เลือกแบรนด์สถานี</label>
                                       <select value={stationName} onChange={e => setStationName(e.target.value)} className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none">
                                           <option value="" disabled>-- กรุณาเลือก --</option>
                                           {otherBrandList.map(b => <option key={b} value={b}>{b}</option>)}
                                       </select>
                                  </div>
                              );
                          }
                          return null;
                      })()}
                  </div>
              ) : (
                  <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 ml-1">สถานที่ไปปฏิบัติงาน</label>
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
              )}

              <button onClick={handleTakeOut} disabled={loading} className={`w-full py-4 rounded-2xl font-bold mt-4 shadow-lg transition-all text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#742F99] hover:bg-[#5b237a]'}`}>
                {loading ? '⏳ กำลังบันทึก...' : (isEV ? '⚡ ยืนยันเริ่มชาร์จไฟรถ' : 'ยืนยันนำรถออก')}
              </button>
            </div>
          ) : (
            // ================== ฟอร์มคืนรถ ==================
            <div className="space-y-4">
               <div className="flex justify-between items-center border-b pb-3">
                  <h3 className={`font-bold text-lg flex items-center gap-2 ${isEV ? 'text-purple-600' : 'text-purple-600'}`}>
                      {isEV ? '🔌 นำที่ชาร์จออก' : '↩️ คืนรถ'}
                  </h3>
                  <span className="text-xs text-gray-400">{currentTime.toLocaleTimeString('th-TH')}</span>
               </div>
               
               <div className={`${isEV ? 'bg-purple-50 border-purple-100' : 'bg-purple-50 border-purple-100'} p-4 rounded-2xl border`}>
                  <p className={`text-sm font-bold ${isEV ? 'text-purple-800' : 'text-purple-800'}`}>👤 ผู้ใช้: {activeLog?.driver_name}</p>
                  
                  {isEV ? (
                      <div className="mt-2 text-purple-700 text-xs font-medium space-y-1 border-t border-purple-200/50 pt-2">
                          <p>🔋 แบตก่อนชาร์จ: <span className="font-bold text-purple-800">{activeLog?.battery_before}%</span></p>
                          <p>📍 สถานี: {activeLog?.station_name}</p>
                      </div>
                  ) : (
                      <p className="text-purple-600 text-xs mt-1 font-medium">ไมล์เริ่ม: {activeLog?.start_mileage?.toLocaleString()}</p>
                  )}
               </div>
               
               {isEV ? (
                   <div className="space-y-2 pt-2">
                       <label className="text-xs font-bold text-gray-500 ml-1 block text-center mt-4">กรุณากรอกปริมาณแบตเตอรี่ล่าสุด</label>
                       <div className="flex items-center justify-center gap-4 bg-white border-2 border-purple-200 rounded-2xl p-4 shadow-inner">
                           <span className="text-3xl">🔋</span>
                           <input 
                                type="number" value={battAfter} onChange={e => setBattAfter(e.target.value)} placeholder="0-100"
                                className="w-24 p-2 bg-gray-50 rounded-xl outline-none text-center text-2xl font-black text-purple-700 border-none" 
                           />
                           <span className="text-xl font-bold text-purple-700">%</span>
                       </div>
                   </div>
               ) : (
                   <>
                       <div className="space-y-1 pt-2">
                          <label className="text-xs font-bold text-gray-400 ml-1">เลขไมล์ล่าสุด (จบงาน)</label>
                          <input 
                            type="number" value={endMileage} onChange={e => setEndMileage(e.target.value)} placeholder="กรอกเลขไมล์ปัจจุบัน..."
                            className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-purple-500 outline-none font-mono text-lg" 
                          />
                       </div>
                       <div className="grid grid-cols-2 gap-3 pt-2 border-t border-dashed border-gray-200 mt-4">
                          <div className="space-y-1 mt-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">เติมน้ำมัน (ลิตร)</label>
                            <input type="number" value={fuelLiters} onChange={e => setFuelLiters(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 text-center" />
                          </div>
                          <div className="space-y-1 mt-2">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">จำนวนเงิน (บาท)</label>
                            <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 text-center" />
                          </div>
                       </div>
                   </>
               )}

               <button onClick={handleReturn} disabled={loading} className={`w-full py-4 rounded-2xl font-bold shadow-lg mt-6 text-white transition-all ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#742F99] hover:bg-[#5b237a]'}`}>
                 {loading ? '⏳ กำลังบันทึก...' : (isEV ? 'ยืนยันเลิกชาร์จไฟรถ' : 'ยืนยันคืนรถ')}
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}