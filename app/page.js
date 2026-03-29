'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
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
// 🎨 Component: กระดานเซ็นชื่อ (Signature Pad) สำหรับ ReportPage
// ==========================================
function SignatureModal({ isOpen, onClose, onSave, title, onVerifySuccess }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [empId, setEmpId] = useState('');
  const [staffInfo, setStaffInfo] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) { setEmpId(''); setStaffInfo(null); setError(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && staffInfo && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e3a8a'; 
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = 'auto'; }
  }, [isOpen, staffInfo]);

  if (!isOpen) return null;

  const verifyEmp = async () => {
    if (!empId) return;
    setIsLoading(true); setError('');
    try {
        const { data } = await supabase.from('staff').select('full_name, position').eq('staff_code', empId).single();
        if (data) {
            setStaffInfo(data);
            if (onVerifySuccess) onVerifySuccess(); 
        }
        else setError('❌ ไม่พบรหัสพนักงานในระบบ');
    } catch (err) { setError('❌ ไม่พบรหัสพนักงานในระบบ'); }
    setIsLoading(false);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); 
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => { setIsDrawing(false); };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const base64Text = canvas.toDataURL('image/png');
    
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (base64Text === blank.toDataURL()) {
        alert("กรุณาเซ็นชื่อก่อนบันทึกครับ");
        return;
    }
    onSave(base64Text, staffInfo.full_name, staffInfo.position);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        <div className="bg-gradient-to-r from-[#742F99] to-[#591d79] text-white p-5 text-center font-black text-lg">
          ✍️ {title}
        </div>
        
        <div className="bg-blue-50/80 border-b border-blue-100 text-blue-700 text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-2 shadow-sm">
            <span className="text-lg">📅</span> อนุญาตให้เซ็นเอกสารเฉพาะวันที่ 28 ถึง 5 ของเดือนถัดไป
        </div>

        <div className="p-6">
          {!staffInfo ? (
            <div className="space-y-4">
               <div className="text-center space-y-1 mb-4">
                  <div className="text-4xl mb-2">🔐</div>
                  <h3 className="font-bold text-gray-800 text-lg">ยืนยันตัวตนก่อนเซ็นชื่อ</h3>
                  <p className="text-xs text-gray-500">กรุณากรอกรหัสพนักงานของคุณ</p>
               </div>
               <div>
                   <input type="text" value={empId} onChange={e => setEmpId(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyEmp()} className="w-full border-2 border-gray-200 bg-gray-50 p-4 rounded-2xl text-center text-xl font-bold tracking-widest outline-none focus:border-[#742F99] focus:bg-white transition-all" placeholder="XXXXXX" />
                   <div className="h-6 mt-1 text-center">{error && <p className="text-red-500 text-sm font-bold animate-pulse">{error}</p>}</div>
               </div>
               <div className="flex gap-3 pt-2">
                   <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-600 p-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors">ยกเลิก</button>
                   <button onClick={verifyEmp} disabled={isLoading} className={`flex-1 text-white p-4 rounded-2xl font-bold shadow-lg transition-all ${isLoading ? 'bg-gray-400' : 'bg-[#742F99] hover:bg-[#591d79]'}`}>{isLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}</button>
               </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in-down">
               <div className="bg-green-50 border border-green-200 p-3 rounded-2xl flex justify-between items-center shadow-sm">
                  <div>
                      <p className="text-green-800 text-sm font-bold flex items-center gap-1"><span className="text-lg">✅</span> คุณ{staffInfo.full_name}</p>
                      <p className="text-green-600 text-[10px] ml-6">{staffInfo.position}</p>
                  </div>
                  <button onClick={() => setStaffInfo(null)} className="text-[10px] bg-white border border-green-200 px-2 py-1 rounded-lg text-green-700 font-bold hover:bg-green-100">เปลี่ยนรหัส</button>
               </div>
               <p className="text-center text-xs text-gray-400 font-bold uppercase tracking-wider">กรุณาใช้นิ้วเซ็นชื่อในกรอบด้านล่าง</p>
               <div className="flex justify-center bg-gray-50 p-3 rounded-2xl border border-gray-100 relative">
                 <canvas ref={canvasRef} width={320} height={160} className="bg-white border-2 border-dashed border-gray-300 rounded-xl cursor-crosshair touch-none shadow-inner" style={{ touchAction: 'none' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
               </div>
               <div className="flex gap-3 pt-2">
                 <button onClick={clearCanvas} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">ลบเขียนใหม่</button>
                 <button onClick={handleSave} className="flex-1 py-3.5 bg-gradient-to-r from-[#742F99] to-[#591d79] text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95">บันทึกลายเซ็น</button>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 📄 Component: หน้าตารายงาน
// ==========================================
function ReportPage() {
  const searchParams = useSearchParams()
  const carId = searchParams.get('car_id')
  
  const [car, setCar] = useState(null)
  const [logs, setLogs] = useState([])
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [today, setToday] = useState(new Date())

  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [dearText, setDearText] = useState('')

  const [driverSigText, setDriverSigText] = useState(null)
  const [driverName, setDriverName] = useState('')
  const [driverPos, setDriverPos] = useState('')

  const [controllerSigText, setControllerSigText] = useState(null)
  const [controllerName, setControllerName] = useState('')
  const [controllerPos, setControllerPos] = useState('')

  const [sigModal, setSigModal] = useState({ isOpen: false, target: null, title: '' })

  // ✅ ตรรกะใหม่: คำนวณเดือนที่ระบบอนุญาตให้เซ็นได้ ณ วันนี้
  const [signableMonth, setSignableMonth] = useState(null);
  const [canSignAny, setCanSignAny] = useState(false);
  const [isCurrentMonthSignable, setIsCurrentMonthSignable] = useState(false);

  useEffect(() => {
     const d = today;
     const date = d.getDate();
     let allowedMonth = null;

     if (date >= 28) {
         // ถ้าวันนี้วันที่ 28 ขึ้นไป จะเซ็นของเดือนนี้ได้
         const y = d.getFullYear();
         const m = String(d.getMonth() + 1).padStart(2, '0');
         allowedMonth = `${y}-${m}`;
     } else if (date <= 5) {
         // ถ้าวันนี้วันที่ 1-5 จะเซ็นของเดือนที่แล้วได้
         let y = d.getFullYear();
         let m = d.getMonth();
         if (m === 0) {
             y -= 1;
             m = 12;
         }
         allowedMonth = `${y}-${String(m).padStart(2, '0')}`;
     }

     setSignableMonth(allowedMonth);
     setCanSignAny(allowedMonth !== null);
     setIsCurrentMonthSignable(allowedMonth === selectedMonth);

  }, [today, selectedMonth]);

  const [scale, setScale] = useState(1);
  const A4_WIDTH_PX = 1123; 

  useEffect(() => {
    const handleResize = () => {
      const availableWidth = window.innerWidth - 16; 
      if (availableWidth < A4_WIDTH_PX) setScale(availableWidth / A4_WIDTH_PX);
      else setScale(1);
    };
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchData = async () => {
    if (!carId) return

    const [year, month] = selectedMonth.split('-')
    const startDate = `${year}-${month}-01T00:00:00`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${month}-${lastDay}T23:59:59`

    const { data: c } = await supabase.from('cars').select('*').eq('id', carId).single()
    setCar(c)

    const { data: l } = await supabase.from('trip_logs')
      .select('*').eq('car_id', carId).eq('is_completed', true)
      .gte('start_time', startDate).lte('start_time', endDate)
      .order('start_time', { ascending: true })
    setLogs(l || [])

    const { data: sigData } = await supabase
      .from('report_signatures')
      .select('*')
      .eq('car_id', String(carId))
      .eq('report_month', selectedMonth)
      .single()

    if (sigData) {
        setDriverSigText(sigData.driver_sig || null)
        setDriverName(sigData.driver_name || '')
        setDriverPos(sigData.driver_pos || '')
        setControllerSigText(sigData.controller_sig || null)
        setControllerName(sigData.controller_name || '')
        setControllerPos(sigData.controller_pos || '')
    } else {
        setDriverSigText(null); setDriverName(''); setDriverPos('');
        setControllerSigText(null); setControllerName(''); setControllerPos('');
    }
  }

  useEffect(() => {
    if (carId) fetchData()
    setToday(new Date())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId, selectedMonth])

  const saveSignatureToDB = async (target, base64Text, fetchedName, fetchedPos) => {
    try {
        const { data: existing } = await supabase.from('report_signatures').select('id').eq('car_id', String(carId)).eq('report_month', selectedMonth).single()

        const payload = {}
        if (target === 'driver') {
            payload.driver_sig = base64Text; payload.driver_name = fetchedName; payload.driver_pos = fetchedPos;
            setDriverSigText(base64Text); setDriverName(fetchedName); setDriverPos(fetchedPos);
        } else {
            payload.controller_sig = base64Text; payload.controller_name = fetchedName; payload.controller_pos = fetchedPos;
            setControllerSigText(base64Text); setControllerName(fetchedName); setControllerPos(fetchedPos);
        }

        if (existing) {
            await supabase.from('report_signatures').update(payload).eq('id', existing.id)
        } else {
            await supabase.from('report_signatures').insert([{ ...payload, car_id: String(carId), report_month: selectedMonth }])
        }
    } catch (err) { alert('เกิดข้อผิดพลาดในการบันทึกลายเซ็น: ' + err.message) }
  }

  const handleDeleteSig = async (target) => {
      if(!confirm('ต้องการลบลายเซ็นนี้ใช่หรือไม่?')) return;
      await saveSignatureToDB(target, null, '', '');
  }

  const openSigModal = (target, title) => {
      if (!canSignAny) {
          alert('⚠️ นอกเวลาอนุญาต (ระบบให้เซ็นเอกสารได้เฉพาะวันที่ 28 ถึง 5 ของเดือนเท่านั้นครับ)');
          return;
      }
      setSigModal({ isOpen: true, target, title });
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit' }) : ''
  const formatThaiMonth = (d) => d ? new Date(d).toLocaleDateString('th-TH', { month: 'long' }) : ''
  const formatThaiYear = (d) => d ? new Date(d).getFullYear() + 543 : ''
  const reportDate = new Date(`${selectedMonth}-01`)

  const totalDistance = logs.reduce((sum, log) => sum + (log.end_mileage - log.start_mileage), 0)
  const totalFuelLiters = logs.reduce((sum, log) => sum + (Number(log.fuel_liters) || 0), 0)
  const totalFuelCost = logs.reduce((sum, log) => sum + (Number(log.fuel_cost) || 0), 0)
  const kmPerLiter = (totalDistance > 0 && totalFuelLiters > 0) ? (totalDistance / totalFuelLiters).toFixed(2) : ''
  const startMonthMileage = logs.length > 0 ? logs[0].start_mileage : 0;
  const endMonthMileage = logs.length > 0 ? logs[logs.length - 1].end_mileage : 0;
  const isEVCar = car?.fuel_type?.toUpperCase() === 'EV' || car?.plate_number?.includes('6ขฆ-6169') || car?.plate_number?.includes('6ขฆ 6169');

  const ITEMS_PER_PAGE = 10;
  const pages = [];
  let currentIndex = 0;
  if (logs.length === 0) {
      pages.push([]);
  } else {
      while (currentIndex < logs.length) {
          let remaining = logs.length - currentIndex;
          if (remaining <= 10) {
              pages.push(logs.slice(currentIndex, currentIndex + remaining));
              currentIndex += remaining;
          } else {
              pages.push(logs.slice(currentIndex, currentIndex + 11));
              currentIndex += 11;
          }
      }
      if (pages.length > 0 && pages[pages.length - 1].length === 11) {
          pages.push([]);
      }
  }

  const CheckboxCell = ({ checked, text, showDots = true }) => (
    <div className="flex items-center justify-start px-1 h-full w-full">
        <div className="w-3.5 h-3.5 border border-black flex-shrink-0 flex items-center justify-center text-[12px] leading-none mr-1 relative bg-white">
            {checked && <span className="absolute -top-[1px] font-normal">✓</span>}
        </div>
        <div className="truncate text-[10px] leading-none flex-grow text-left">
           {checked && text ? text : (showDots ? '........................' : '')}
        </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-500 flex flex-col items-center pb-12 print:bg-white print:p-0 font-sarabun text-black relative overflow-x-hidden ${isEVCar ? 'pt-[260px]' : 'pt-[380px]'} xl:pt-8`}>
      
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            background: white !important; 
            margin: 0; 
            padding: 0; 
            overflow: visible !important;
          }
          html { background: white; overflow: visible !important; }
          .print\\:hidden { display: none !important; }
          .print-container { 
            width: 100% !important; 
            display: block !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            background: white !important; 
          }
          .page-wrapper { 
            width: 297mm !important; 
            height: 210mm !important; 
            margin: 0 auto !important; 
            padding: 0 !important;
            box-shadow: none !important; 
            border: none !important;
            border-radius: 0 !important; 
            page-break-after: always !important;
            page-break-inside: avoid !important;
            background: white !important;
            transform: none !important;
          }
          .page-inner { 
            width: 297mm !important; 
            height: 210mm !important; 
            transform: none !important; 
            position: relative !important; 
            padding: 8mm 12mm 10mm 12mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        }
      `}</style>

      <SignatureModal 
        isOpen={sigModal.isOpen} title={sigModal.title}
        onClose={() => setSigModal({ isOpen: false, target: null, title: '' })}
        onSave={(base64Text, fetchedName, fetchedPos) => saveSignatureToDB(sigModal.target, base64Text, fetchedName, fetchedPos)}
        onVerifySuccess={() => {
            // ✅ กระโดดเปลี่ยนเดือนให้ตรงกับที่อนุญาตให้เซ็นอัตโนมัติ
            if (signableMonth && selectedMonth !== signableMonth) {
                setSelectedMonth(signableMonth);
            }
        }}
      />

      <div className="w-full fixed top-0 left-0 xl:w-[320px] xl:top-4 xl:left-auto xl:right-4 print:hidden z-50 flex flex-col gap-2 bg-white/95 backdrop-blur-md p-3 shadow-lg xl:shadow-2xl border-b xl:border border-gray-200 xl:rounded-2xl overflow-hidden">
        
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-black text-[#742F99] text-[15px] xl:text-lg">⚙️ ตั้งค่าเอกสาร</h3>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-700 font-bold text-[11px] xl:text-sm flex items-center gap-1 active:scale-95 transition-transform">🖨️ พิมพ์</button>
        </div>

        {/* ✅ ป้ายแจ้งเตือนเรื่องรอบเวลาเซ็นเอกสาร */}
        {!canSignAny ? (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 text-[10px] p-1.5 rounded-lg text-center font-bold">
                🔒 นอกเวลาอนุญาต (เซ็นได้เฉพาะวันที่ 28 ถึง 5 ของรอบเดือน)
            </div>
        ) : selectedMonth !== signableMonth ? (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-[10px] p-1.5 rounded-lg text-center font-bold">
                ℹ️ หากกดเซ็น ระบบจะสลับไปเดือนที่กำหนด ({signableMonth})
            </div>
        ) : (
            <div className="bg-green-50 border border-green-200 text-green-700 text-[10px] p-1.5 rounded-lg text-center font-bold">
                ✅ สามารถแก้ไขลายเซ็นของเดือนนี้ได้
            </div>
        )}

        <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-gray-600 whitespace-nowrap">📅 เดือน :</label>
                <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="flex-1 border border-gray-200 bg-white rounded-lg px-2 py-1 text-[11px] outline-none focus:border-[#742F99]" />
            </div>

            {!isEVCar && (
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-bold text-gray-500 w-6">จาก</label>
                    <input type="text" value={fromText} onChange={(e) => setFromText(e.target.value)} placeholder="แผนก..." className="w-full border border-gray-200 rounded p-1 text-[10px] outline-none focus:border-[#742F99]"/>
                </div>
                <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-bold text-gray-500 w-6">ถึง</label>
                    <input type="text" value={toText} onChange={(e) => setToText(e.target.value)} placeholder="ผจก..." className="w-full border border-gray-200 rounded p-1 text-[10px] outline-none focus:border-[#742F99]"/>
                </div>
                <div className="flex items-center gap-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-gray-500 w-6">เรียน</label>
                    <input type="text" value={dearText} onChange={(e) => setDearText(e.target.value)} placeholder="ผจก..." className="w-full border border-gray-200 rounded p-1 text-[10px] outline-none focus:border-[#742F99]"/>
                </div>
              </div>
            )}

            <div>
                <label className="text-[10px] font-bold text-gray-500 block mb-1">✍️ การลงนามเอกสาร</label>
                <div className="grid grid-cols-2 gap-2">
                    <div className="border border-gray-200 rounded-lg p-1.5 bg-gray-50 flex flex-col justify-center items-center relative h-[60px]">
                        <span className="text-[9px] font-bold text-gray-600 absolute top-1 left-2">{isEVCar ? 'ผู้รายงาน' : 'ผู้ขับรถ'}</span>
                        {driverSigText ? (
                            <>
                                <img src={driverSigText} alt="sig" className="h-6 object-contain mt-3" />
                                {/* ✅ ซ่อนปุ่มลบ ถ้าเปิดดูเดือนอื่นอยู่ (ป้องกันมือลั่นลบผิดเดือน) */}
                                {isCurrentMonthSignable && <button onClick={() => handleDeleteSig('driver')} className="absolute top-1 right-1 text-red-500 bg-white border border-red-100 w-4 h-4 rounded-full flex items-center justify-center text-[8px] shadow-sm font-bold">✖</button>}
                            </>
                        ) : (
                            <button onClick={() => openSigModal('driver', isEVCar ? 'เซ็นชื่อผู้รายงาน' : 'เซ็นชื่อผู้ขับยานพาหนะ')} className={`mt-3 w-[90%] py-1 rounded shadow-sm text-[10px] font-bold border transition-colors ${canSignAny ? 'bg-white border-[#742F99] text-[#742F99]' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                + เซ็นชื่อ
                            </button>
                        )}
                    </div>

                    <div className="border border-gray-200 rounded-lg p-1.5 bg-gray-50 flex flex-col justify-center items-center relative h-[60px]">
                        <span className="text-[9px] font-bold text-gray-600 absolute top-1 left-2">ผู้ควบคุม</span>
                        {controllerSigText ? (
                            <>
                                <img src={controllerSigText} alt="sig" className="h-6 object-contain mt-3" />
                                {/* ✅ ซ่อนปุ่มลบ ถ้าเปิดดูเดือนอื่นอยู่ */}
                                {isCurrentMonthSignable && <button onClick={() => handleDeleteSig('controller')} className="absolute top-1 right-1 text-red-500 bg-white border border-red-100 w-4 h-4 rounded-full flex items-center justify-center text-[8px] shadow-sm font-bold">✖</button>}
                            </>
                        ) : (
                            <button onClick={() => openSigModal('controller', 'เซ็นชื่อผู้ควบคุม')} className={`mt-3 w-[90%] py-1 rounded shadow-sm text-[10px] font-bold border transition-colors ${canSignAny ? 'bg-white border-[#742F99] text-[#742F99]' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                + เซ็นชื่อ
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="w-full flex flex-col items-center gap-6 print:block print:w-auto print-container">
          {pages.map((pageLogs, pageIndex) => {
            const isLastPage = pageIndex === pages.length - 1;
            const targetRows = isLastPage ? 10 : 11;
            const emptyRows = Array.from({ length: Math.max(0, targetRows - pageLogs.length) });

            return (
              <div 
                key={pageIndex} 
                className="page-wrapper relative shadow-2xl xl:shadow-xl rounded-md bg-white overflow-hidden"
                style={{ width: `${A4_WIDTH_PX * scale}px`, height: `${794 * scale}px` }}
              >
                <div 
                  className="page-inner absolute top-0 left-0 bg-white box-border flex flex-col font-normal text-black"
                  style={{ width: `${A4_WIDTH_PX}px`, height: `794px`, padding: '25px 38px 30px 38px', transform: `scale(${scale})`, transformOrigin: 'top left' }}
                >
                    {/* ========================================= */}
                    {/* ⚡ REPORT FORM: EV */}
                    {/* ========================================= */}
                    {isEVCar ? (
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="mb-1">
                                    <h1 className="text-lg font-normal text-center">รายงานการอัดประจุไฟฟ้าสำหรับรถยนต์ไฟฟ้า (EV)</h1>
                                    <div className="h-4"></div> 
                                    <div className="flex flex-wrap justify-center items-end text-[13px] font-normal leading-loose whitespace-nowrap px-1">
                                        <span>รายงานการอัดประจุไฟฟ้าสำหรับรถยนต์ไฟฟ้า (EV) ประจำเดือน</span>
                                        <div className="border-b border-dotted border-black px-2 min-w-[80px] text-center mx-1">{formatThaiMonth(reportDate)}</div>
                                        <span>พ.ศ.</span>
                                        <div className="border-b border-dotted border-black px-2 min-w-[50px] text-center mx-1">{formatThaiYear(reportDate)}</div>
                                        <span>หน่วยงาน</span>
                                        <div className="border-b border-dotted border-black px-2 min-w-[100px] text-center mx-1">กฟส.กพส.</div>
                                        <span>หมายเลขทะเบียน</span>
                                        <div className="border-b border-dotted border-black px-2 min-w-[100px] text-center mx-1">{car?.plate_number}</div>
                                    </div>
                                </div>

                                <table className="w-full border-collapse border border-black text-[11px] font-normal">
                                    <thead>
                                        <tr className="text-center h-[25px] font-normal">
                                            <th rowSpan={3} className="border border-black w-[8%] font-normal">วันที่</th>
                                            <th rowSpan={3} className="border border-black w-[15%] font-normal">หน่วยงานที่ใช้</th>
                                            <th rowSpan={3} className="border border-black w-[10%] font-normal">เลขไมล์(กม.)</th>
                                            <th colSpan={2} className="border border-black w-[10%] font-normal">% แบตเตอรี่</th>
                                            <th colSpan={6} className="border border-black font-normal">สถานีอัดประจุรถยนต์ไฟฟ้า</th>
                                        </tr>
                                        <tr className="text-center h-[25px] font-normal">
                                            <th rowSpan={2} className="border border-black w-[5%] font-normal">ก่อน</th>
                                            <th rowSpan={2} className="border border-black w-[5%] font-normal">หลัง</th>
                                            <th colSpan={4} className="border border-black font-normal">สถานีชาร์จของ PEA Volta</th>
                                            <th colSpan={2} className="border border-black font-normal">สถานีชาร์จนอกเครือข่าย<br/>PEA Volta</th>
                                        </tr>
                                        <tr className="text-center h-[35px] font-normal">
                                            <th className="border border-black w-[5%] text-[10px] font-normal">สนญ.</th>
                                            <th className="border border-black w-[10%] text-[10px] font-normal">กฟก. (ระบุ)</th>
                                            <th className="border border-black w-[10%] text-[10px] font-normal">บางจาก (ระบุ)</th>
                                            <th className="border border-black w-[10%] text-[10px] font-normal">PEA Volta อื่น ๆ (ระบุ)</th>
                                            <th className="border border-black w-[5%] text-[10px] font-normal">Wall<br/>Charge</th>
                                            <th className="border border-black w-[12%] text-[10px] font-normal">สถานีชาร์จ อื่น ๆ (ระบุ)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageLogs.map((log, i) => {
                                            const stName = log.station_name || '';
                                            const stType = log.station_type || '';
                                            const getDetail = (text) => text.includes(':') ? text.split(':')[1].trim() : text;

                                            const isHQ = stName.includes('สำนักงานใหญ่') || stName.includes('HQ');
                                            const isKFK = stName.includes('กฟก.');
                                            const isBangchak = stName.includes('บางจาก');
                                            const isPEAOther = stName.includes('PEA Volta');
                                            const isWall = stName.includes('Wall Charge');
                                            const isOther = !isHQ && !isKFK && !isBangchak && !isPEAOther && !isWall && stType === 'OTHER';

                                            return (
                                                <tr key={i} className="h-[28px] text-center font-normal align-middle">
                                                    <td className="border border-black">{formatDate(log.start_time)}</td>
                                                    <td className="border border-black text-center px-1 truncate max-w-[150px]">กฟส.กพส.</td>
                                                    <td className="border border-black text-right px-1">{log.end_mileage.toLocaleString()}</td>
                                                    <td className="border border-black">{log.battery_before || '-'}</td>
                                                    <td className="border border-black">{log.battery_after || '-'}</td>
                                                    <td className="border border-black text-center align-middle p-0"><div className="flex justify-center"><CheckboxCell checked={isHQ} showDots={false} /></div></td>
                                                    <td className="border border-black p-0 align-middle"><CheckboxCell checked={isKFK} text={getDetail(stName)} /></td>
                                                    <td className="border border-black p-0 align-middle"><CheckboxCell checked={isBangchak} text={getDetail(stName)} /></td>
                                                    <td className="border border-black p-0 align-middle"><CheckboxCell checked={isPEAOther} text={getDetail(stName)} /></td>
                                                    <td className="border border-black text-center align-middle p-0"><div className="flex justify-center"><CheckboxCell checked={isWall} showDots={false} /></div></td>
                                                    <td className="border border-black p-0 align-middle"><CheckboxCell checked={isOther} text={getDetail(stName)} /></td>
                                                </tr>
                                            )
                                        })}
                                        {emptyRows.map((_, i) => (
                                            <tr key={`empty-${i}`} className="h-[28px] font-normal">
                                                <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                                <td className="border border-black"></td><td className="border border-black"></td>
                                                <td className="border border-black p-0 align-middle"><div className="flex justify-center"><CheckboxCell checked={false} showDots={false} /></div></td>
                                                <td className="border border-black p-0 align-middle"><CheckboxCell checked={false} /></td>
                                                <td className="border border-black p-0 align-middle"><CheckboxCell checked={false} /></td>
                                                <td className="border border-black p-0 align-middle"><CheckboxCell checked={false} /></td>
                                                <td className="border border-black p-0 align-middle"><div className="flex justify-center"><CheckboxCell checked={false} showDots={false} /></div></td>
                                                <td className="border border-black p-0 align-middle"><CheckboxCell checked={false} /></td>
                                            </tr>
                                        ))}
                                        {/* แถวรวมโชว์เฉพาะหน้าสุดท้าย */}
                                        {isLastPage && (
                                            <tr className="h-[30px] font-normal text-[11px] align-middle bg-gray-50 print:bg-transparent">
                                                <td colSpan={3} className="border border-black text-right pr-2">รวม</td>
                                                <td colSpan={2} className="border border-black text-center text-black"></td>
                                                <td colSpan={6} className="border border-black text-center text-black"></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                
                                <div className="mt-1 text-[10px] font-normal">
                                    หมายเหตุ : สถานีชาร์จ อื่น ๆ เช่น EA Anywhere , EV Station , MEA EV , EGAT และ Emergency charger
                                </div>
                            </div>
                            
                            {/* ✅ ลายเซ็นโชว์ทุกหน้า */}
                            <div className="mt-auto pb-2 flex justify-between items-end px-4 font-normal">
                                <div className="text-sm">
                                    <p className="mb-2">เลขไมล์ต้นเดือน................<span className="font-normal ml-2">{startMonthMileage.toLocaleString()}</span>........................</p>
                                    <p>เลขไมล์ปลายเดือน..............<span className="font-normal ml-2">{endMonthMileage.toLocaleString()}</span>........................</p>
                                </div>
                                
                                <div className="flex gap-x-28">
                                    <div className="text-sm text-center flex flex-col items-center w-[250px]">
                                        <div className="flex items-end justify-center w-full relative h-12 mb-1">
                                            <span className="mr-2">(ลงชื่อ)</span>
                                            <div className="border-b border-dotted border-black w-full h-full flex items-end justify-center pb-1">
                                                {driverSigText && <img src={driverSigText} alt="signature" className="max-h-12 max-w-full object-contain" />}
                                            </div>
                                        </div>
                                        <div className="flex w-full justify-center items-end my-1">
                                            ( <div className="border-b border-dotted border-black w-full mx-1 h-5 text-center font-normal">{driverName}</div> )
                                        </div>
                                        <div className="flex w-full justify-center items-end">
                                            <div className="w-full text-center h-5">{driverPos}</div>
                                        </div>
                                        <p className="mt-1">ผู้รายงาน/เบอร์โทร</p>
                                    </div>

                                    <div className="text-sm text-center flex flex-col items-center w-[250px]">
                                        <div className="flex items-end justify-center w-full relative h-12 mb-1">
                                            <span className="mr-2">(ลงชื่อ)</span>
                                            <div className="border-b border-dotted border-black w-full h-full flex items-end justify-center pb-1">
                                                {controllerSigText && <img src={controllerSigText} alt="signature" className="max-h-12 max-w-full object-contain" />}
                                            </div>
                                        </div>
                                        <div className="flex w-full justify-center items-end my-1">
                                            ( <div className="border-b border-dotted border-black w-full mx-1 h-5 text-center font-normal">{controllerName}</div> )
                                        </div>
                                        <div className="flex w-full justify-center items-end">
                                            <div className="w-full text-center h-5">{controllerPos}</div>
                                        </div>
                                        <p className="mt-1">ผู้ควบคุม</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ========================================= */
                        /* 🚙 REPORT FORM: STANDARD (รถน้ำมัน) */
                        /* ========================================= */
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-end mb-1 font-normal">
                                    <div className="w-[280px] flex justify-start pl-10">
                                        <div className="flex flex-col items-center">
                                            <img src="/pea_logo.png" alt="PEA Logo" className="h-12 mb-1 object-contain" />
                                            <div className="text-[16px] font-bold leading-tight">การไฟฟ้าส่วนภูมิภาค</div>
                                            <div className="text-[9px] text-gray-600 uppercase leading-none tracking-tighter">Provincial Electricity Authority</div>
                                        </div>
                                    </div>
                                    <div className="text-center flex-grow pb-[2px]">
                                        <div className="text-[14px]">การไฟฟ้าส่วนภูมิภาค</div>
                                        <div className="text-[14px]">แบบฟอร์มรายงานการใช้ยานพาหนะหรือเครื่องจักร</div>
                                    </div>
                                    <div className="w-[280px] text-right text-[13px] pb-[2px]">
                                        หน้าที่ {pageIndex + 1} / {pages.length}
                                    </div>
                                </div>

                                <div className="text-[13px] space-y-1 mt-1 font-normal">
                                    <div className="grid grid-cols-3 w-full items-center">
                                        <div className="flex items-center pl-10">จาก <div className={`border-b border-dotted border-black w-[100px] ml-1 text-center font-normal ${fromText ? 'text-black' : 'text-transparent'}`}>{fromText || '.'}</div></div>
                                        <div className="flex items-center justify-center whitespace-nowrap">ถึง (หัวหน้าหน่วยงาน) <div className={`border-b border-dotted border-black w-[150px] ml-1 text-center font-normal ${toText ? 'text-black' : 'text-transparent'}`}>{toText || '.'}</div></div>
                                        <div></div>
                                    </div>
                                    <div className="grid grid-cols-3 w-full items-center">
                                        <div className="flex items-center pl-10">เรื่อง <span className="ml-5 font-normal">รายงานการใช้ยานพาหนะหรือเครื่องจักร</span></div>
                                        <div className="flex items-center justify-center whitespace-nowrap">วันที่ <span className="border-b border-dotted border-black w-8 text-center mx-1">{today.getDate()}</span> เดือน <span className="border-b border-dotted border-black w-24 text-center mx-1">{formatThaiMonth(today)}</span> ปี <span className="border-b border-dotted border-black w-16 text-center mx-1">{formatThaiYear(today)}</span></div>
                                        <div></div>
                                    </div>
                                    <div className="flex items-center pl-10">เรียน <span className="ml-5">หัวหน้าหน่วยงาน</span> <div className={`border-b border-dotted border-black w-[100px] ml-1 text-center font-normal ${dearText ? 'text-black' : 'text-transparent'}`}>{dearText || '.'}</div></div>
                                    <div className="flex flex-wrap pt-0.5 items-end leading-relaxed pl-10">
                                        <span className="ml-12">รายงานการใช้ยานพาหนะ ประจำเดือน</span> <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1">{formatThaiMonth(reportDate)}</span> พ.ศ. <span className="border-b border-dotted border-black min-w-[50px] text-center mx-1">{formatThaiYear(reportDate)}</span> หมายเลขทะเบียน <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1 font-normal">{car?.plate_number}</span> รหัส <span className="border-b border-dotted border-black min-w-[60px] text-center mx-1"></span> ประเภท <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1 font-normal">{car?.car_type}</span> ชนิด <span className="border-b border-dotted border-black min-w-[60px] text-center mx-1"></span>
                                    </div>
                                    <div className="flex items-center gap-3 pt-0.5 text-[12px] pl-10 font-normal">
                                        <span>ชนิดเชื้อเพลิง</span>
                                        {['แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ E20', 'แก๊สโซฮอล์ E85', 'ดีเซล'].map(f => (
                                            <div key={f} className="flex items-center gap-1 font-normal">
                                                <div className="w-3.5 h-3.5 border border-black flex items-center justify-center text-[11px] relative">{car?.fuel_type === f && <span className="absolute -top-1 font-normal">✓</span>}</div> <span>{f}</span>
                                            </div>
                                        ))}
                                        <span className="ml-2 font-normal">น้ำมันหล่อลื่น จำนวน ................. ลิตร</span>
                                    </div>
                                    <div className="flex items-center pt-0.5 text-[12px] pl-10 font-normal">
                                        อัตราสิ้นเปลืองเชื้อเพลิงยานพาหนะ <span className="border-b border-dotted border-black w-[130px] text-center mx-1 font-normal text-black">{kmPerLiter}</span> กิโลเมตร/ลิตร, <span className="ml-2 font-normal">เครื่องจักร ..................... ลิตร/ชั่วโมง</span>
                                    </div>
                                </div>

                                <table className="w-full border-collapse border border-black mt-2 text-[12px] font-normal">
                                    <thead>
                                        <tr className="text-center h-[40px] bg-gray-50 print:bg-transparent font-normal">
                                        <th className="border border-black w-[10%] font-normal">วันที่</th><th className="border border-black w-[14%] font-normal px-1">ชื่อ-ตำแหน่ง<br/>หน่วยงานที่ใช้</th><th className="border border-black w-[14%] font-normal px-1">สถานที่ปฏิบัติงาน</th>
                                        <th className="border border-black w-[12%] p-0 font-normal"><div className="h-[20px] flex items-center justify-center border-b border-black text-[11px]">เลขระยะทาง</div><div className="h-[20px] flex divide-x divide-black text-[11px]"><div className="w-1/2 flex items-center justify-center text-[10px]">ไป</div><div className="w-1/2 flex items-center justify-center text-[10px]">กลับ</div></div></th>
                                        <th className="border border-black w-[7%] font-normal text-[10px]">ชั่วโมงการ<br/>ทำงาน</th><th className="border border-black w-[8%] font-normal text-[10px]">น้ำมันที่เติม<br/>(ลิตร)</th><th className="border border-black w-[8%] font-normal text-[10px]">จำนวนเงิน<br/>(บาท)</th><th className="border border-black w-[11%] font-normal text-[11px]">รายการซ่อม</th><th className="border border-black w-[8%] font-normal text-[10px]">จำนวนเงิน<br/>(บาท)</th><th className="border border-black w-[8%] font-normal text-[11px]">หมายเหตุ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageLogs.map((log, i) => (
                                        <tr key={i} className="h-[26px] align-middle font-normal">
                                            <td className="border border-black text-center">{formatDate(log.start_time)}</td><td className="border border-black px-1 text-center truncate max-w-[120px]">{log.driver_name}</td><td className="border border-black px-1 text-center truncate max-w-[120px]">{log.location}</td>
                                            <td className="border border-black p-0 h-full font-normal"><div className="flex divide-x divide-black h-[26px]"><div className="w-1/2 flex items-center justify-center">{log.start_mileage}</div><div className="w-1/2 flex items-center justify-center">{log.end_mileage}</div></div></td>
                                            <td className="border border-black text-center"></td><td className="border border-black text-center">{log.fuel_liters ? Number(log.fuel_liters).toFixed(2) : ''}</td><td className="border border-black text-right px-1">{log.fuel_cost > 0 ? Number(log.fuel_cost).toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                        </tr>
                                        ))}
                                        {emptyRows.map((_, i) => (
                                        <tr key={`empty-${i}`} className="h-[26px] font-normal">
                                            <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black p-0 h-full"><div className="flex divide-x divide-black h-[26px]"><div className="w-1/2"></div><div className="w-1/2"></div></div></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                        </tr>
                                        ))}
                                        {/* แถวรวมโชว์เฉพาะหน้าสุดท้าย */}
                                        {isLastPage && (
                                            <tr className="h-[30px] font-normal text-[11px] align-middle bg-gray-50 print:bg-transparent">
                                                <td colSpan={3} className="border border-black text-right pr-2">รวม</td><td className="border border-black text-center text-black">{totalDistance > 0 ? totalDistance.toLocaleString() + ' กม.' : '-'}</td><td className="border border-black"></td><td className="border border-black text-center text-black">{totalFuelLiters > 0 ? totalFuelLiters.toFixed(2) : ''}</td><td className="border border-black text-right px-1 text-black">{totalFuelCost > 0 ? totalFuelCost.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td><td className="border border-black"></td><td className="border border-black text-right px-1"></td><td className="border border-black"></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                <div className="mt-1 pl-12 text-[13px] font-normal">จึงเรียนเพื่อโปรดทราบ</div>
                            </div>
                            
                            <div className="mt-auto pb-2 flex justify-center items-center w-full font-normal text-[13px]">
                                <div className="flex gap-x-28">
                                    <div className="flex flex-col items-center w-[280px]">
                                        <div className="flex w-full items-end h-12 mb-1">
                                            ลงชื่อ 
                                            <div className="border-b border-dotted border-black flex-grow ml-2 h-full relative flex items-end justify-center pb-1">
                                                {driverSigText && <img src={driverSigText} alt="signature" className="max-h-12 max-w-full object-contain" />}
                                            </div>
                                        </div>
                                        <div className="flex w-full items-end my-1">
                                            ( <div className="border-b border-dotted border-black flex-grow mx-1 h-5 text-center font-normal">{driverName}</div> )
                                        </div>
                                        <div className="flex w-full items-end">
                                            ตำแหน่ง <div className="border-b border-dotted border-black flex-grow ml-1 h-5 text-center font-normal">{driverPos}</div>
                                        </div>
                                        <div className="mt-2 text-center font-normal">ผู้ขับยานพาหนะ</div>
                                    </div>

                                    <div className="flex flex-col items-center w-[280px]">
                                        <div className="flex w-full items-end h-12 mb-1">
                                            ลงชื่อ 
                                            <div className="border-b border-dotted border-black flex-grow ml-2 h-full relative flex items-end justify-center pb-1">
                                                {controllerSigText && <img src={controllerSigText} alt="signature" className="max-h-12 max-w-full object-contain" />}
                                            </div>
                                        </div>
                                        <div className="flex w-full items-end my-1">
                                            ( <div className="border-b border-dotted border-black flex-grow mx-1 h-5 text-center font-normal">{controllerName}</div> )
                                        </div>
                                        <div className="flex w-full items-end">
                                            ตำแหน่ง <div className="border-b border-dotted border-black flex-grow ml-1 h-5 text-center font-normal">{controllerPos}</div>
                                        </div>
                                        <div className="mt-2 text-center font-normal">ผู้ควบคุม</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-8 left-8 text-[10px] font-normal">{isEVCar ? '' : 'ยพ.6-ป.46'}</div>
                </div>
              </div>
            )
          })}
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
  const [isMileageLocked, setIsMileageLocked] = useState(false)
  const [selectedLocation, setSelectedLocation] = useState('') 
  const [customLocation, setCustomLocation] = useState('') 
  
  // Return Inputs
  const [endMileage, setEndMileage] = useState('')
  const [fuelLiters, setFuelLiters] = useState('')
  const [fuelCost, setFuelCost] = useState('')
  const [hasRefueled, setHasRefueled] = useState(null)

  // EV Inputs
  const [battBefore, setBattBefore] = useState('')
  const [battAfter, setBattAfter] = useState('')
  const [stationType, setStationType] = useState('PEA') 
  const [subStationType, setSubStationType] = useState('') 
  const [stationName, setStationName] = useState('') 
  
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // ✅ State สำหรับควบคุมการแสดง Popup แจ้งเตือนเรื่องการเซ็นเอกสาร (ใหม่)
  const [isSignReminderDismissed, setIsSignReminderDismissed] = useState(false)
  
  // ✅ State สำหรับควบคุมการแสดง Popup ยืนยันเลขไมล์
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)

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

  // ✅ คืนรถ หรือ ถอดสายชาร์จ EV (อัปเดตรองรับ skipConfirm)
  const handleReturn = async (skipConfirm = false) => {
    // ✅ ตรวจสอบจาก fuel_type
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

        // ✅ บังคับตรวจสอบว่าเติมน้ำมันหรือยัง ถ้ามีเติมน้ำมันแล้วแต่ไม่กรอกให้แจ้งเตือน
        if (hasRefueled === true && (!fuelLiters || !fuelCost)) {
             return alert('กรุณากรอกข้อมูล ปริมาณน้ำมัน (ลิตร) และ จำนวนเงิน (บาท) ให้ครบถ้วน')
        }

        // ✅ แจ้งเตือน Popup ตรวจสอบเลขไมล์ก่อนบันทึกจริง (เฉพาะรถน้ำมัน)
        if (skipConfirm !== true) {
            setShowReturnConfirm(true);
            return;
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
          updateData.fuel_liters = (hasRefueled && fuelLiters) ? parseFloat(fuelLiters) : 0
          updateData.fuel_cost = (hasRefueled && fuelCost) ? parseFloat(fuelCost) : 0
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
  
  // ✅ ตรรกะใหม่: ตรวจสอบว่าเป็นช่วงเวลาเซ็นเอกสารหรือไม่ (วันที่ 28 ถึง 5)
  const currentDay = currentTime.getDate();
  const isSigningPeriod = currentDay >= 28 || currentDay <= 5;
  const showSignReminder = isSigningPeriod && !isSignReminderDismissed && car.status === 'available';

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sarabun flex flex-col pb-10">
      
      {/* ✅ Popup แจ้งเตือนให้เซ็นเอกสาร (แสดงเฉพาะตอนนำรถออก ทั้ง EV และน้ำมัน ในช่วงวันที่ 28-5) */}
      {showSignReminder && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center animate-fade-in-down border border-gray-100">
               <div className="text-5xl mb-3">📝</div>
               <h3 className="text-xl font-black text-gray-800 mb-2 tracking-tight">ถึงเวลาเซ็นเอกสาร!</h3>
               <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  ขณะนี้อยู่ในช่วงเวลา <span className="font-bold text-[#742F99]">เซ็นเอกสารประจำเดือน</span><br/>
                  อย่าลืมเข้าไปเซ็นชื่อที่หน้ารายงาน (ไอคอน 🖨️) นะครับ
               </p>
               <button 
                  onClick={() => setIsSignReminderDismissed(true)} 
                  className="w-full bg-[#742F99] text-white py-3.5 rounded-xl font-bold hover:bg-[#5b237a] active:scale-95 transition-all shadow-md"
               >
                   รับทราบ
               </button>
           </div>
        </div>
      )}

      {/* ✅ Popup ยืนยันเลขไมล์ (แสดงหลังจากกดคืนรถ) */}
      {showReturnConfirm && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center animate-fade-in-down border border-gray-100">
               <div className="text-5xl mb-3">📍</div>
               <h3 className="text-xl font-black text-gray-800 mb-2 tracking-tight">ตรวจสอบเลขไมล์</h3>
               
               <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-3 border border-gray-200">
                  <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">ไมล์ก่อนเดินทาง:</span>
                      <span className="font-bold text-gray-700">{parseFloat(activeLog?.start_mileage).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                      <span className="text-gray-500 text-sm">ไมล์ล่าสุด (จบงาน):</span>
                      <span className="font-black text-[#742F99] text-lg">{parseFloat(endMileage).toLocaleString()}</span>
                  </div>
                  <div className="border-t border-dashed border-gray-300 pt-3 flex justify-between items-center">
                      <span className="text-gray-600 text-sm font-bold">ระยะทางที่ขับไป:</span>
                      <span className="font-black text-green-600 text-xl">{(parseFloat(endMileage) - parseFloat(activeLog?.start_mileage)).toLocaleString()} <span className="text-sm">กม.</span></span>
                  </div>
               </div>

               <div className="flex gap-3">
                   {/* ปุ่มยืนยันอยู่ด้านซ้าย */}
                   <button 
                      onClick={() => { setShowReturnConfirm(false); handleReturn(true); }} 
                      className="flex-1 bg-[#742F99] text-white py-3.5 rounded-xl font-bold hover:bg-[#5b237a] active:scale-95 transition-all shadow-md"
                   >
                       ยืนยัน
                   </button>
                   {/* ปุ่มแก้ไขอยู่ด้านขวา */}
                   <button 
                      onClick={() => setShowReturnConfirm(false)} 
                      className="flex-1 bg-gray-100 text-gray-600 py-3.5 rounded-xl font-bold hover:bg-gray-200 active:scale-95 transition-all shadow-sm border border-gray-200"
                   >
                       แก้ไข
                   </button>
               </div>
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

                       {/* ✅ ส่วนเลือกและกรอกการเติมน้ำมัน */}
                       <div className="pt-4 border-t border-dashed border-gray-200 mt-4 space-y-3">
                           <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block text-center">มีการเติมน้ำมันหรือไม่?</label>
                           <div className="flex gap-2">
                               <button 
                                  onClick={() => { setHasRefueled(true); setFuelLiters(''); setFuelCost(''); }} 
                                  className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 transition-all ${hasRefueled === true ? 'bg-green-50 border-green-500 text-green-700 shadow-sm' : 'bg-white border-gray-200 text-gray-400'}`}
                               >
                                  ✅ มีการเติม
                               </button>
                               <button 
                                  onClick={() => { setHasRefueled(false); setFuelLiters(''); setFuelCost(''); }} 
                                  className={`flex-1 py-3 rounded-xl text-xs font-bold border-2 transition-all ${hasRefueled === false ? 'bg-red-50 border-red-500 text-red-700 shadow-sm' : 'bg-white border-gray-200 text-gray-400'}`}
                               >
                                  ❌ ไม่ได้เติม
                               </button>
                           </div>

                           {/* โชว์ช่องกรอกเฉพาะตอนกด "มีการเติม" */}
                           {hasRefueled === true && (
                               <div className="grid grid-cols-2 gap-3 pt-2 animate-fade-in-down">
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">เติมน้ำมัน (ลิตร)</label>
                                    <input type="number" value={fuelLiters} onChange={e => setFuelLiters(e.target.value)} className="w-full p-3 bg-white rounded-xl border border-gray-200 text-center outline-none focus:border-green-500" placeholder="ระบุจำนวน" />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase">จำนวนเงิน (บาท)</label>
                                    <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} className="w-full p-3 bg-white rounded-xl border border-gray-200 text-center outline-none focus:border-green-500" placeholder="ระบุจำนวน" />
                                  </div>
                               </div>
                           )}
                       </div>
                   </>
               )}

               {/* ✅ ปรับให้ปุ่มล็อค (สีเทา) จนกว่าจะเลือกกดเติมน้ำมัน */}
               <button 
                  onClick={() => handleReturn(false)} 
                  disabled={loading || (!isEV && hasRefueled === null)} 
                  className={`w-full py-4 rounded-2xl font-bold shadow-lg mt-6 text-white transition-all ${
                      loading ? 'bg-gray-400 cursor-not-allowed' : 
                      (!isEV && hasRefueled === null) ? 'bg-gray-300 border-gray-300 text-gray-500 cursor-not-allowed' : 
                      'bg-[#742F99] hover:bg-[#5b237a] active:scale-95'
                  }`}
               >
                 {loading ? '⏳ กำลังบันทึก...' : (isEV ? 'ยืนยันเลิกชาร์จไฟรถ' : 'ยืนยันคืนรถ')}
               </button>
               
               {!isEV && hasRefueled === null && (
                   <p className="text-center text-xs font-bold text-red-500 mt-2 animate-pulse">👆 กรุณาเลือกว่า มีการเติมน้ำมัน หรือไม่ ก่อนกดยืนยัน</p>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}