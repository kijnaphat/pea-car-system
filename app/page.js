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

      if (carsData) {
        const mergedCars = carsData.map(car => {
            const log = activeLogs?.find(l => l.car_id === car.id)
            return { ...car, activeLog: log }
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
    const plate = car.plate_number || ''
    
    // เช็คว่าเป็นรถ EV หรือไม่ (ดูจากทะเบียน)
    if (plate.includes('6ขฆ')) return '/mg.png'
    
    // เช็คตามคำขึ้นต้นของประเภทรถ
    if (type.startsWith('รถกระเช้า')) return '/aerial_lift.png'
    if (type.startsWith('รถบรรทุก 2 ตันเเก้ไฟ')) return '/2_ton_truck.png'
    if (type.startsWith('รถเครน')) return '/crane.png'
    if (type.startsWith('รถตู้โดยสาร') || type.startsWith('รถตู้')) return '/van.png'
    if (type.startsWith('รถกระบะ')) return '/truck.png'
    if (type.startsWith('รถบรรทุก 2')) return '/2ton.png'
    if (type.startsWith('รถบรรทุก 1 ตันแก้ไฟ')) return '/1ton.png'
    
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
                  
                  {/* ✅ เปลี่ยนเป็นปุ่มกดเพื่อเปิด Modal อธิบายการใช้งาน */}
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
                    <div className={`w-20 h-20 flex-shrink-0 rounded-2xl flex items-center justify-center text-3xl shadow-inner overflow-hidden ${
                        car.status === 'available' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
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
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                car.status === 'available' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                                <span className={`w-2 h-2 rounded-full ${car.status === 'available' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                                {car.status === 'available' ? 'ว่างพร้อมใช้' : 'กำลังใช้งาน'}
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
            PEA Fleet System v2.22 (Help Modal Added)
        </div>
      </div>

      {/* ✅ Modal คำอธิบายการใช้งาน */}
      {showInstructions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Background Blur */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={() => setShowInstructions(false)}
            ></div>

            {/* Modal Content */}
            <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl relative z-10 max-h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
                
                {/* Modal Header */}
                <div className="bg-gradient-to-r from-[#742F99] to-[#591d79] p-5 text-white flex justify-between items-center">
                    <h2 className="text-lg font-black flex items-center gap-2">
                        <span>📖</span> คู่มือการใช้งานระบบ
                    </h2>
                    <button 
                        onClick={() => setShowInstructions(false)}
                        className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors text-sm"
                    >
                        ✖
                    </button>
                </div>

                {/* Modal Body (Scrollable) */}
                <div className="p-6 overflow-y-auto space-y-6 text-gray-700">
                    
                    {/* Step 1 */}
                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl">
                        <h3 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2">
                            <span className="bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">1</span> 
                            การนำรถออกไปใช้งาน
                        </h3>
                        <ul className="text-sm space-y-1 ml-6 list-disc text-blue-900/80 marker:text-blue-400">
                            <li><strong>สแกน QR Code</strong> ที่ติดอยู่หน้ารถคันที่จะใช้</li>
                            <li>กรอก <strong>รหัสพนักงาน</strong> (ระบบจะดึงชื่อมาให้อัตโนมัติ)</li>
                            <li>กรอก <strong>เลขไมล์เริ่มต้น</strong> และ <strong>สถานที่</strong></li>
                            <li>กดปุ่มยืนยัน</li>
                        </ul>
                    </div>

                    {/* Step 2 */}
                    <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl">
                        <h3 className="font-bold text-orange-800 text-sm mb-2 flex items-center gap-2">
                            <span className="bg-orange-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">2</span> 
                            การคืนรถ (รถน้ำมัน ⛽)
                        </h3>
                        <ul className="text-sm space-y-1 ml-6 list-disc text-orange-900/80 marker:text-orange-400">
                            <li>เมื่อปฏิบัติงานเสร็จ <strong>สแกน QR Code เดิม</strong></li>
                            <li>กรอก <strong>เลขไมล์ล่าสุด</strong> (เลขไมล์จบงาน)</li>
                            <li>หากเติมน้ำมัน ให้ใส่จำนวนลิตร/จำนวนเงิน (ถ้าไม่มีเว้นว่างไว้)</li>
                            <li>กดปุ่มยืนยันการคืนรถ</li>
                        </ul>
                    </div>

                    {/* Step 3 */}
                    <div className="bg-green-50 border border-green-100 p-4 rounded-2xl">
                        <h3 className="font-bold text-green-800 text-sm mb-2 flex items-center gap-2">
                            <span className="bg-green-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs">3</span> 
                            การคืนรถ (รถไฟฟ้า EV ⚡)
                        </h3>
                        <ul className="text-sm space-y-1 ml-6 list-disc text-green-900/80 marker:text-green-400">
                            <li>สแกน QR Code เพื่อเข้าสู่หน้าคืนรถ</li>
                            <li>กรอก <strong>% แบตเตอรี่ ก่อนชาร์จ</strong> และ <strong>หลังชาร์จ</strong></li>
                            <li>ระบุประเภทสถานีชาร์จ (PEA Volta หรือ แบรนด์อื่นๆ)</li>
                            <li>กดปุ่มยืนยันการชาร์จรถ</li>
                        </ul>
                    </div>

                    {/* Extra Info */}
                    <div className="text-xs text-center text-gray-400 pt-2 border-t border-gray-100">
                        * กดที่ไอคอน 🖨️ เพื่อพิมพ์รายงานการใช้รถ (Log Book)<br/>
                        * กดที่ไอคอน 📊 มุมขวาบนเพื่อดูสถิติและ Dashboard
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t bg-gray-50 text-center">
                    <button 
                        onClick={() => setShowInstructions(false)}
                        className="w-full bg-[#742F99] text-white py-3 rounded-xl font-bold shadow-md hover:bg-[#591d79] transition-colors"
                    >
                        เข้าใจแล้ว
                    </button>
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
        if (c.status === 'available') {
           const { data: l } = await supabase.from('trip_logs')
             .select('end_mileage')
             .eq('car_id', carId)
             .eq('is_completed', true)
             .order('created_at', { ascending: false })
             .limit(1)
             .single()
           
           if (l?.end_mileage) {
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

  // นำรถออก
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

    const isEV = car?.plate_number?.includes('6ขฆ-6169') || car?.plate_number?.includes('6ขฆ 6169');
    const finalLocation = selectedLocation === 'อื่นๆ' ? customLocation : selectedLocation
    
    if (!employeeId) return alert('กรุณากรอกรหัสพนักงาน')
    if (!isEV && (!mileage || !finalLocation)) return alert('กรุณากรอกข้อมูลให้ครบถ้วน')
    
    setLoading(true)

    try {
      const { data: latestCar } = await supabase.from('cars').select('status').eq('id', carId).single()
      if (latestCar.status === 'busy') {
         alert('⚠️ รายการนี้ถูกบันทึกไปแล้วครับ')
         window.location.href = '/'
         return
      }

      const { error } = await supabase.from('trip_logs').insert({
        car_id: carId, 
        driver_name: currentName, 
        driver_position: currentPosition,
        start_mileage: parseFloat(mileage || 0), 
        location: isEV ? '-' : finalLocation, 
        start_time: new Date().toISOString(), is_completed: false
      })
      if (error) throw error
      await supabase.from('cars').update({ status: 'busy' }).eq('id', carId)
      
      if (isEV) {
          alert(`✅ บันทึกรถออกสำเร็จ!\nระบบจะพาไปหน้าบันทึกข้อมูลต่อทันที...`)
          window.location.reload()
      } else {
          alert(`✅ บันทึกสำเร็จ!\nเดินทางปลอดภัยครับ คุณ ${currentName}`)
          window.location.href = '/'
      }

    } catch (err) { 
        alert('Error: ' + err.message) 
        setLoading(false) 
    } 
  }

  // คืนรถ
  const handleReturn = async () => {
    const isEV = car?.plate_number?.includes('6ขฆ-6169') || car?.plate_number?.includes('6ขฆ 6169');

    if (!endMileage) return alert('กรุณากรอกเลขไมล์ล่าสุด (จบงาน)')
    
    if (isEV) {
        if (!battBefore || !battAfter) return alert('กรุณากรอก % แบตเตอรี่ ทั้งก่อนและหลังชาร์จ')
        
        if (parseInt(battBefore) >= parseInt(battAfter)) {
            return alert('❌ ข้อมูลผิดพลาด!\nเปอร์เซ็นต์แบตเตอรี่ "ก่อนชาร์จ" ต้องน้อยกว่า "หลังชาร์จ"')
        }

        if (!subStationType) return alert('กรุณาระบุประเภทสถานีชาร์จ')
        
        const selectedOption = (stationType === 'PEA' ? peaOptions : otherOptions).find(o => o.id === subStationType);
        if (selectedOption?.inputType !== 'none' && !stationName) {
            return alert('กรุณาระบุชื่อสถานี/สาขาให้ครบถ้วน')
        }
    }

    const startM = parseFloat(activeLog.start_mileage)
    const endM = parseFloat(endMileage)
    if (endM < startM) {
        alert(`❌ เลขไมล์ผิดพลาด!\nเลขไมล์จบ (${endM}) น้อยกว่า เลขไมล์เริ่ม (${startM})`)
        return
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
        end_mileage: endM,
        end_time: new Date().toISOString(),
        is_completed: true
      }

      if (isEV) {
          const selectedOption = (stationType === 'PEA' ? peaOptions : otherOptions).find(o => o.id === subStationType);
          const label = selectedOption ? selectedOption.label.replace(/ \(.+\)/, '') : '';
          const finalStationName = (selectedOption?.inputType !== 'none' && stationName) ? `${label}: ${stationName}` : label;

          updateData.battery_before = parseInt(battBefore)
          updateData.battery_after = parseInt(battAfter)
          updateData.station_type = stationType 
          updateData.station_name = finalStationName
      } else {
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

  const isEV = car?.plate_number?.includes('6ขฆ-6169') || car?.plate_number?.includes('6ขฆ 6169');

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sarabun flex flex-col pb-10">
      <div className="bg-[#742F99] px-6 pt-10 pb-20 text-white rounded-b-[2.5rem] shadow-lg relative">
        <button onClick={() => window.location.href = '/'} className="absolute top-10 left-5 bg-white/20 p-2 px-4 rounded-xl text-sm">⬅ กลับ</button>
        <div className="text-center mt-6">
          <h2 className="text-3xl font-black">{car.plate_number}</h2>
          <p className="text-purple-200 text-sm uppercase font-bold">{car.model} | {car.car_type}</p>
          {isEV && <span className="bg-green-400 text-green-900 text-[10px] font-bold px-2 py-0.5 rounded-full mt-2 inline-block">Electric Vehicle</span>}
        </div>
      </div>

      <div className="-mt-12 px-4 relative z-20">
        <div className="bg-white rounded-3xl shadow-xl p-6 border border-gray-50">
          {car.status === 'available' ? (
            // ================== ฟอร์มนำรถออก ==================
            <div className="space-y-4">
              <h3 className="font-bold text-[#742F99] border-b pb-3 text-lg">
                {isEV ? '⚡ บันทึกข้อมูลการชาร์จ' : '📋 บันทึกนำรถออก'}
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

              {!isEV && (
                <>
                  <div className="space-y-1">
                     <div className="flex justify-between items-center ml-1">
                        <label className="text-xs font-bold text-gray-400">เลขไมล์เริ่มต้น</label>
                        {isMileageLocked && <span className="text-[10px] text-[#742F99] font-bold bg-purple-50 px-2 py-0.5 rounded-full">🔒 ต่อเนื่องจากล่าสุด</span>}
                     </div>
                     <input 
                        type="number" value={mileage} readOnly={isMileageLocked} onChange={e => setMileage(e.target.value)} 
                        className={`w-full p-4 rounded-2xl border outline-none font-mono text-lg transition-colors ${
                            isMileageLocked ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'bg-gray-50 border-gray-100'
                        }`}
                     />
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
                </>
              )}

              <button onClick={handleTakeOut} disabled={loading} className={`w-full py-4 rounded-2xl font-bold mt-2 shadow-lg transition-all text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#742F99] hover:bg-[#5b237a]'}`}>
                {loading ? '⏳ กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          ) : (
            // ================== ฟอร์มคืนรถ / กรอกข้อมูล ==================
            <div className="space-y-4">
               <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-red-600 text-lg">↩️ {isEV ? 'บันทึกข้อมูลการชาร์จ' : 'คืนรถ'}</h3>
                  <span className="text-xs text-gray-400">{currentTime.toLocaleTimeString('th-TH')}</span>
               </div>
               <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                  <p className="text-orange-800 text-sm font-bold">👤 ผู้ใช้: {activeLog?.driver_name}</p>
                  
                  {!isEV && (
                      <p className="text-orange-600 text-xs mt-1">ไมล์เริ่ม: {activeLog?.start_mileage?.toLocaleString()}</p>
                  )}
               </div>
               
               <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 ml-1">เลขไมล์ล่าสุด (จบงาน)</label>
                  <input 
                    type="number" value={endMileage} onChange={e => setEndMileage(e.target.value)} placeholder="กรอกเลขไมล์ปัจจุบัน..."
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-red-500 outline-none font-mono text-lg" 
                  />
               </div>

               {isEV ? (
                   // ✅ ฟอร์มเฉพาะ EV
                   <div className="space-y-4 pt-4 border-t border-dashed border-gray-200 mt-2">
                       <p className="text-sm font-bold text-green-700 flex items-center gap-1">⚡ ข้อมูลการชาร์จ (กรุณากรอกให้ครบ)</p>
                       
                       <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">แบตก่อนชาร์จ (%)</label>
                                <input type="number" value={battBefore} onChange={e => setBattBefore(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 text-center" placeholder="0-100" />
                           </div>
                           <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">แบตหลังชาร์จ (%)</label>
                                <input type="number" value={battAfter} onChange={e => setBattAfter(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 text-center" placeholder="0-100" />
                           </div>
                       </div>

                       <div className="space-y-2">
                           <label className="text-[10px] font-bold text-gray-400 uppercase">ประเภทสถานี</label>
                           <div className="flex gap-2">
                               <button onClick={() => { setStationType('PEA'); setSubStationType(''); setStationName(''); }} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${stationType === 'PEA' ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-gray-200 text-gray-400'}`}>สถานีชาร์จของ PEA Volta</button>
                               <button onClick={() => { setStationType('OTHER'); setSubStationType(''); setStationName(''); }} className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${stationType === 'OTHER' ? 'bg-purple-100 border-purple-500 text-purple-700 shadow-sm' : 'bg-white border-gray-200 text-gray-400'}`}>สถานีชาร์จนอกเครือข่าย PEA Volta</button>
                           </div>
                       </div>

                       <div className="space-y-2">
                           <label className="text-[10px] font-bold text-gray-400 uppercase">ระบุสถานี</label>
                           <div className="grid grid-cols-2 gap-2">
                               {(stationType === 'PEA' ? peaOptions : otherOptions).map((opt) => (
                                   <button 
                                      key={opt.id}
                                      onClick={() => { setSubStationType(opt.id); setStationName(''); }}
                                      className={`py-2 px-2 rounded-lg text-[11px] border text-left transition-all ${subStationType === opt.id ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-gray-100 text-gray-600'}`}
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
                                   <div className="space-y-1 animate-fade-in-down">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">รายละเอียดเพิ่มเติม</label>
                                        <input 
                                            type="text" value={stationName} onChange={e => setStationName(e.target.value)} 
                                            placeholder="ระบุชื่อสถานี..."
                                            className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100" 
                                        />
                                   </div>
                               );
                           }
                           if (selectedOption.inputType === 'dropdown_kfk') {
                               return (
                                   <div className="space-y-1 animate-fade-in-down">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">เลือกสาขา</label>
                                        <select value={stationName} onChange={e => setStationName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 appearance-none">
                                            <option value="" disabled>-- กรุณาเลือก --</option>
                                            {kfkList.map(k => <option key={k} value={k}>{k}</option>)}
                                        </select>
                                   </div>
                               );
                           }
                           if (selectedOption.inputType === 'dropdown_other') {
                               return (
                                   <div className="space-y-1 animate-fade-in-down">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">เลือกแบรนด์</label>
                                        <select value={stationName} onChange={e => setStationName(e.target.value)} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-100 appearance-none">
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
               )}

               <button onClick={handleReturn} disabled={loading} className={`w-full py-4 rounded-2xl font-bold shadow-lg mt-4 text-white ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}>
                 {loading ? '⏳ กำลังบันทึก...' : 'ยืนยันการคืนรถ/การชาร์จรถ'}
               </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}