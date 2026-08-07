'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import PageSkeleton from '@/app/components/PageSkeleton'
import { getSignatureSchedule } from '@/lib/signatureSchedule'

// --- Main Component ---
function MainApp() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const carId = searchParams.get('car_id') 

  // 1. ถ้า URL มีคำว่า /report ให้แสดงหน้ารายงาน
  if (pathname && pathname.includes('/report')) {
    return <ReportPage />
  }

  // 2. ถ้ามี car_id -> ไปหน้าฟอร์มสแกนรถ
  if (carId) {
    return <CarActionForm carId={carId} />
  }

  // 3. ถ้าไม่มี -> ไปหน้า Home (Dashboard เลือกรถ)
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
    if (type.startsWith('รถบรรทุกขุดเจาะ')) return '/3ton.png'
    if (type.startsWith('รถบรรทุกเครนแข็ง 7.5 ตัน')) return '/7ton.png'
    
    return null 
  }

  if (loading) return <PageSkeleton variant="report" />

  return (
    <div className="min-h-screen bg-[#f8f3fa] font-sarabun pb-6 relative">
      
      {/* 🟣 Header */}
      <div className="bg-gradient-to-r from-[#702082] to-[#4b1560] px-6 pt-12 pb-24 text-white rounded-b-[3rem] shadow-xl relative z-10">
        <div className="flex justify-between items-start">
          <div>
             <h1 className="text-2xl font-black tracking-tight">PEA SMART VEHICLE MANAGEMENT</h1>
             <p className="text-purple-200 text-sm opacity-90">ระบบบริหารจัดการยานพาหนะ</p>
          </div>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl backdrop-blur-md border border-white/10 active:scale-95 transition-all shadow-lg"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
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

        <div className="bg-gradient-to-r from-[#702082] to-[#ffdd00] p-1 rounded-[2rem] shadow-2xl shadow-[#702082]/30">
          <div className="bg-white/10 backdrop-blur-xl rounded-[1.8rem] p-4 flex flex-col gap-3 border border-white/30">
              
              <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="bg-white text-[#702082] w-12 h-12 rounded-full shadow-lg flex items-center justify-center relative">
                          <span className="absolute w-full h-full rounded-full border-4 border-[#ffdd00] animate-ping opacity-30"></span>
                          <span className="z-10">
                              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                          </span>
                      </div>
                      <div>
                          <h3 className="text-white text-xl font-black tracking-widest drop-shadow-md">SCAN QR CODE</h3>
                          <p className="text-[#fff9d6] text-[10px] uppercase font-bold tracking-widest bg-black/20 px-2 py-0.5 rounded-md inline-block mt-0.5">
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
                          กรุณาสแกน QR Code ประจำรถ เพื่อทำรายการ นำรถออก หรือ คืนรถ / ชาร์จรถ ทุกครั้งเพื่ออัปเดตสถานะในระบบ
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
                    <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                </button>

                <div className="flex items-center gap-4">
                    {/* ✅ อัปเดตสีพื้นหลังรูปให้เป็นสีเทาถ้า Not Activated */}
                    <div className={`w-20 h-20 flex-shrink-0 rounded-2xl flex items-center justify-center text-3xl shadow-inner overflow-hidden ${
                        !car.isActivated ? 'bg-gray-100 text-gray-400' : car.status === 'available' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                    }`}>
                        {carImageSrc ? (
                            <img src={carImageSrc} alt={car.car_type} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-sm font-bold text-gray-400">NO IMG</span>
                        )}
                    </div>

                    <div className="flex-1">
                        <h3 className="text-xl font-black text-gray-800 tracking-tight">{car.plate_number}</h3>
                        
                        <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">
                            {car.model} <span className="mx-1 text-gray-300">|</span> <span className="text-[#702082]">{car.car_type}</span>
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
                                    ออก: {new Date(car.activeLog.start_time).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})} น.
                                </span>
                            )}
                        </div>
                        
                        {car.status === 'busy' && car.activeLog && (
                            <p className="text-[10px] text-gray-400 mt-2 ml-1 font-bold">
                                โดย: <span className="text-gray-600">{car.activeLog.driver_name}</span>
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
                <div className="bg-gradient-to-r from-[#702082] to-[#4b1560] p-5 text-white flex justify-between items-center shadow-md z-10">
                    <h2 className="text-lg font-black flex items-center gap-2">
                        คู่มือการใช้งานระบบ
                    </h2>
                    <button 
                        onClick={() => setShowInstructions(false)}
                        className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-500 transition-colors text-sm"
                    >✖</button>
                </div>
                <div className="p-5 overflow-y-auto space-y-5 text-gray-700 bg-gray-50">
                    <div className="bg-white border border-red-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="bg-red-300 text-red-700 font-bold p-3 flex items-center gap-2 text-sm">
                            รถยนต์ทั่วไป (รถใช้น้ำมัน)
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
                            รถยนต์ไฟฟ้า (EV)
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
                        className="w-full bg-[#702082] text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-[#4b1560] transition-colors active:scale-95"
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
function SignatureModal({ isOpen, onClose, onSave, title, onVerifySuccess, signaturePeriodText }) {
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
        const { data } = await supabase.rpc('get_staff_by_code', { p_staff_code: empId }).single();
        if (data) {
            setStaffInfo(data);
            if (onVerifySuccess) onVerifySuccess(); 
        }
        else setError('ไม่พบรหัสพนักงานในระบบ');
    } catch (err) { setError('ไม่พบรหัสพนักงานในระบบ'); }
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
    
    if (window.confirm('ยืนยันการลงชื่อ ใช่หรือไม่?')) {
        onSave(base64Text, staffInfo.full_name, staffInfo.position, staffInfo.id, empId);
        onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">
        <div className="bg-gradient-to-r from-[#702082] to-[#4b1560] text-white p-5 text-center font-black text-lg">
          {title}
        </div>
        
        <div className="bg-blue-50/80 border-b border-blue-100 text-blue-700 text-xs py-2 px-4 text-center font-bold flex items-center justify-center gap-2 shadow-sm">
            ช่วงลงลายเซ็นรอบนี้ {signaturePeriodText}
        </div>

        <div className="p-6">
          {!staffInfo ? (
            <div className="space-y-4">
               <div className="text-center space-y-1 mb-4">
                  <svg className="w-10 h-10 mx-auto mb-2 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                  <h3 className="font-bold text-gray-800 text-lg">ยืนยันตัวตนก่อนเซ็นชื่อ</h3>
                  <p className="text-xs text-gray-500">กรุณากรอกรหัสพนักงานของคุณ</p>
               </div>
               <div>
                   <input type="text" value={empId} onChange={e => setEmpId(e.target.value)} onKeyDown={e => e.key === 'Enter' && verifyEmp()} className="w-full border-2 border-gray-200 bg-gray-50 p-4 rounded-2xl text-center text-xl font-bold tracking-widest outline-none focus:border-[#702082] focus:bg-white transition-all" placeholder="XXXXXX" />
                   <div className="h-6 mt-1 text-center">{error && <p className="text-red-500 text-sm font-bold animate-pulse">{error}</p>}</div>
               </div>
               <div className="flex gap-3 pt-2">
                   <button onClick={onClose} className="flex-1 bg-gray-100 text-gray-600 p-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors">ยกเลิก</button>
                   <button onClick={verifyEmp} disabled={isLoading} className={`flex-1 text-white p-4 rounded-2xl font-bold shadow-lg transition-all ${isLoading ? 'bg-gray-400' : 'bg-[#702082] hover:bg-[#4b1560]'}`}>{isLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}</button>
               </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fade-in-down">
               <div className="bg-green-50 border border-green-200 p-3 rounded-2xl flex justify-between items-center shadow-sm">
                  <div>
                      <p className="text-green-800 text-sm font-bold flex items-center gap-1">คุณ{staffInfo.full_name}</p>
                      <p className="text-green-600 text-[10px]">{staffInfo.position}</p>
                  </div>
                  <button onClick={() => setStaffInfo(null)} className="text-[10px] bg-white border border-green-200 px-2 py-1 rounded-lg text-green-700 font-bold hover:bg-green-100">เปลี่ยนรหัส</button>
               </div>
               <p className="text-center text-xs text-gray-400 font-bold uppercase tracking-wider">กรุณาใช้นิ้วเซ็นชื่อในกรอบด้านล่าง</p>
               <div className="flex justify-center bg-gray-50 p-3 rounded-2xl border border-gray-100 relative">
                 <canvas ref={canvasRef} width={320} height={160} className="bg-white border-2 border-dashed border-gray-300 rounded-xl cursor-crosshair touch-none shadow-inner" style={{ touchAction: 'none' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
               </div>
               <div className="flex gap-3 pt-2">
                 <button onClick={clearCanvas} className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">ลบเขียนใหม่</button>
                 <button onClick={handleSave} className="flex-1 py-3.5 bg-gradient-to-r from-[#702082] to-[#4b1560] text-white rounded-xl font-bold shadow-lg hover:shadow-xl active:scale-95">บันทึกลายเซ็น</button>
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
// ── Mobile Bottom Sheet for Report Controls ──
function MobileControlSheet({ 
  selectedMonth, setSelectedMonth, fromText, setFromText, toText, setToText, dearText, setDearText, 
  isEVCar, canSignAny, isCurrentMonthSignable, signableMonth, driverSigText, controllerSigText, 
  signaturePeriodText,
  handleDeleteSig, openSigModal, logs, drillDate, setDrillDate, drillDesc, setDrillDesc, drillCost, 
  setDrillCost, drillHours, setDrillHours, drillSaving, setDrillSaving, drillSaved, setDrillSaved,
  handleSaveDoc, docSaving, docSaved 
}) {
  const [activeTab, setActiveTab] = useState('doc')
  const [expanded, setExpanded] = useState(false)
  const dragRef = useRef(null)
  const startYRef = useRef(null)

  const onTouchStart = e => { startYRef.current = e.touches[0].clientY }
  const onTouchEnd = e => {
    if (startYRef.current === null) return
    const dy = e.changedTouches[0].clientY - startYRef.current
    if (dy > 60) setExpanded(false) // swipe down 60px = ปิด
    startYRef.current = null
  }

  return (
    <div className="bg-[rgba(245,245,247,0.95)] backdrop-blur-2xl"
         style={{boxShadow:'0 4px 20px rgba(0,0,0,0.12)', borderBottom:'0.5px solid rgba(0,0,0,0.1)', WebkitFontSmoothing:'antialiased'}}>

      {/* Tab bar */}
      <div className="flex w-full px-3 pt-2.5 pb-2.5 gap-2">
        <button onClick={()=> expanded ? setExpanded(false) : window.location.href = '/'}
          className={`px-4 py-2.5 rounded-[12px] font-bold flex-shrink-0 flex items-center justify-center transition-all ${expanded ? 'bg-[#ff3b30] text-white text-[15px]' : 'bg-[#4b1560] text-white'}`}>
          {expanded ? '✕' : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <button onClick={()=>{setActiveTab('doc'); setExpanded(t => activeTab==='doc' ? !t : true)}}
          className={`flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all ${activeTab==='doc'&&expanded?'bg-[#4b1560] text-white':'bg-[#e5e5ea] text-[#3c3c43]'}`}>
          เอกสาร
        </button>
        <button onClick={()=>{setActiveTab('drill'); setExpanded(t => activeTab==='drill' ? !t : true)}}
          className={`flex-1 py-2.5 rounded-[12px] text-[13px] font-semibold transition-all ${activeTab==='drill'&&expanded?'bg-[#4b1560] text-white':'bg-[#e5e5ea] text-[#3c3c43]'}`}>
          รายการซ่อม
        </button>
        <button onClick={()=>window.print()}
          className="px-4 py-2.5 rounded-[12px] text-[13px] font-semibold bg-[#4b1560] text-white flex-shrink-0">
          <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
        </button>
      </div>

      {/* Expanded content — swipe down to close */}
      {expanded && (
        <div ref={dragRef}
             onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
             className="px-3 pb-32 space-y-3 max-h-[75vh] overflow-y-auto border-t border-[rgba(0,0,0,0.06)]">
          {/* handle bar */}
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-[#c7c7cc]"/>
          </div>
          {activeTab === 'doc' ? (
            <>
              {/* Status */}
              {!canSignAny ? (
                <div className="flex items-center gap-2 bg-[#fff8ed] rounded-[12px] px-3 py-2.5">
                  <span className="text-[12px] font-medium text-[#a05c00]">นอกเวลาเซ็น · รอบถัดไป {signaturePeriodText}</span>
                </div>
              ) : signableMonth && selectedMonth !== signableMonth ? (
                <div className="flex items-center gap-2 bg-[#edf6ff] rounded-[12px] px-3 py-2.5">
                  <span className="text-[12px] font-medium text-[#702082]">จะสลับเป็นเดือน {signableMonth}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-[#edfbf0] rounded-[12px] px-3 py-2.5">
                  <span className="w-2 h-2 rounded-full bg-[#34c759]"/><span className="text-[12px] font-medium text-[#1a7f37]">แก้ไขลายเซ็นได้</span>
                </div>
              )}

              {/* เดือน */}
              <div className="bg-white rounded-[14px] px-4 py-3 flex items-center justify-between"
                   style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                <span className="text-[14px] font-medium text-[#4b1560]">เดือน</span>
                <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)}
                  className="text-[14px] text-[#702082] bg-transparent border-none outline-none font-medium"/>
              </div>

              {/* จาก/ถึง/เรียน */}
              {!isEVCar && (
                <div className="bg-white rounded-[14px] overflow-hidden"
                     style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                  {[{l:'จาก',v:fromText,s:setFromText,p:'แผนก...'},{l:'ถึง',v:toText,s:setToText,p:'หัวหน้า...'},{l:'เรียน',v:dearText,s:setDearText,p:'ผจก...'}].map(({l,v,s,p},i,arr)=>(
                    <div key={l} className={`flex items-center px-4 py-3 gap-3 ${i<arr.length-1?'border-b border-[rgba(0,0,0,0.06)]':''}`}>
                      <span className="text-[12px] text-[#6e6e73] w-8 flex-shrink-0 font-medium">{l}</span>
                      <input type="text" value={v} onChange={e=>s(e.target.value)} placeholder={p}
                        className="flex-1 text-[14px] text-[#4b1560] bg-transparent border-none outline-none placeholder:text-[#c7c7cc]"/>
                    </div>
                  ))}
                </div>
              )}

              {/* ลายเซ็น */}
              <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em] pt-2">ลายเซ็น</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  {key:'driver',label:isEVCar?'ผู้รายงาน':'ผู้ขับรถ',sig:driverSigText,title:isEVCar?'เซ็นชื่อผู้รายงาน':'เซ็นชื่อผู้ขับ'},
                  {key:'controller',label:'ผู้ควบคุม',sig:controllerSigText,title:'เซ็นชื่อผู้ควบคุม'},
                ].map(({key,label,sig,title})=>(
                  <div key={key} className="bg-white rounded-[16px] flex flex-col items-center py-4 px-3 relative min-h-[90px]"
                       style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                    <span className="text-[11px] text-[#6e6e73] mb-2 font-medium">{label}</span>
                    {sig ? (
                      <>
                        <img src={sig} alt="sig" className="h-9 object-contain"/>
                        {isCurrentMonthSignable && (
                          <button onClick={()=>handleDeleteSig(key)}
                            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#ff3b30] flex items-center justify-center text-white text-[10px] font-bold">✕</button>
                        )}
                      </>
                    ) : (
                      <button onClick={()=>openSigModal(key,title)}
                        className={`text-[13px] font-medium px-4 py-1.5 rounded-full border transition-colors ${canSignAny?'border-[#702082] text-[#702082]':'border-[#d2d2d7] text-[#aeaeb2] cursor-not-allowed'}`}>
                        + เซ็น
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* ปุ่มบันทึกข้อความ (จาก/ถึง/เรียน) */}
              {!isEVCar && (
                <button onClick={handleSaveDoc} disabled={docSaving}
                  className={`w-full py-3 rounded-[14px] text-[14px] font-semibold transition-all active:scale-[0.98] ${
                    docSaved ? 'bg-[#edfbf0] text-[#1a7f37]' : 'bg-[#4b1560] text-white hover:bg-[#3a3a3c]'
                  }`}>
                  {docSaving ? 'กำลังบันทึก...' : docSaved ? '✓ บันทึกข้อความแล้ว' : 'บันทึกเอกสาร'}
                </button>
              )}
            </>
          ) : (
            /* ── Tab: ซ่อม ── */
            <>
              {/* วันที่ */}
              <div className="bg-white rounded-[14px] overflow-hidden"
                   style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em]">วันที่</p>
                </div>
                <select value={drillDate} onChange={e=>{setDrillDate(e.target.value);setDrillSaved(false)}}
                  className="w-full px-4 py-3 text-[15px] text-[#4b1560] bg-transparent border-none outline-none">
                  <option value="">-- เลือกวันที่ --</option>
                  {[...new Map(logs.map(l=>{
                    const d=new Date(l.start_time)
                    const key=d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'})
                    const localIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    return [localIso,{key,iso:localIso}]
                  })).values()].map(({key,iso})=>(
                    <option key={iso} value={iso}>{key}</option>
                  ))}
                </select>
              </div>

              {/* รายการซ่อม */}
              <div className="bg-white rounded-[14px] overflow-hidden"
                   style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                <div className="px-4 pt-3 pb-1">
                  <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em]">รายการซ่อม</p>
                </div>
                <input type="text" value={drillDesc} onChange={e=>{setDrillDesc(e.target.value);setDrillSaved(false)}}
                  placeholder="เช่น ซ่อมดับเพลิง, ซ่อมอพยพ..."
                  className="w-full px-4 py-3 text-[15px] text-[#4b1560] bg-transparent border-none outline-none placeholder:text-[#c7c7cc]"/>
              </div>

              {/* เงิน + ชั่วโมง */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-[14px] overflow-hidden"
                     style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                  <div className="px-3 pt-3 pb-1"><p className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em]">เงิน (บาท)</p></div>
                  <input type="number" value={drillCost} onChange={e=>{setDrillCost(e.target.value);setDrillSaved(false)}} placeholder="0"
                    className="w-full px-3 py-3 text-[18px] font-mono font-semibold text-[#4b1560] text-center bg-transparent border-none outline-none"/>
                </div>
                <div className="bg-white rounded-[14px] overflow-hidden"
                     style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                  <div className="px-3 pt-3 pb-1"><p className="text-[10px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em]">ชม.เครื่องจักร</p></div>
                  <input type="number" value={drillHours} onChange={e=>{setDrillHours(e.target.value);setDrillSaved(false)}} placeholder="0.0" step="0.5"
                    className="w-full px-3 py-3 text-[18px] font-mono font-semibold text-[#4b1560] text-center bg-transparent border-none outline-none"/>
                </div>
              </div>

              <button onClick={()=>{if(!drillDate||!drillDesc)return alert('กรุณาเลือกวันที่และกรอกรายการซ่อม');setDrillSaving(true);setTimeout(()=>{setDrillSaving(false);setDrillSaved(true)},600)}}
                disabled={drillSaving}
                className={`w-full py-4 rounded-[16px] text-[16px] font-semibold transition-all active:scale-[0.98] ${drillSaved?'bg-[#edfbf0] text-[#1a7f37]':'bg-[#4b1560] text-white'}`}>
                {drillSaving ? 'กำลังบันทึก...' : drillSaved ? '✓ บันทึกแล้ว' : 'บันทึกการซ่อม'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

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

  const [drillDate, setDrillDate] = useState('')
  const [drillDesc, setDrillDesc] = useState('')
  const [drillCost, setDrillCost] = useState('')
  const [drillHours, setDrillHours] = useState('')
  const [drillSaving, setDrillSaving] = useState(false)
  const [drillSaved, setDrillSaved] = useState(false)

  const [docSaving, setDocSaving] = useState(false)
  const [docSaved, setDocSaved] = useState(false)

  const [signableMonth, setSignableMonth] = useState(null);
  const [canSignAny, setCanSignAny] = useState(false);
  const [isCurrentMonthSignable, setIsCurrentMonthSignable] = useState(false);
  const signatureSchedule = getSignatureSchedule(today);

  // 🟢 เพิ่มฟังก์ชัน extractTaskOnly เพื่อตัดคำเอาเฉพาะประเภทงาน
  const extractTaskOnly = (locationString) => {
      if (!locationString) return '';
      // ข้อความใน DB ถูกบันทึกแบบ: "[แผนก - ประเภทงาน] พื้นที่"
      const match = locationString.match(/\[.*? - (.*?)\]/);
      return match ? match[1].trim() : locationString;
  };

  useEffect(() => {
     const d = today;
     const date = d.getDate();
     let allowedMonth = null;

     if (date >= 28) {
         const y = d.getFullYear();
         const m = String(d.getMonth() + 1).padStart(2, '0');
         allowedMonth = `${y}-${m}`;
     } else if (date <= 5) {
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

  useEffect(() => {
    if (carId) {
      const savedFrom = localStorage.getItem(`doc_from_${carId}`)
      const savedTo = localStorage.getItem(`doc_to_${carId}`)
      const savedDear = localStorage.getItem(`doc_dear_${carId}`)
      if (savedFrom) setFromText(savedFrom)
      if (savedTo) setToText(savedTo)
      if (savedDear) setDearText(savedDear)
    }
  }, [carId])

  const handleSaveDoc = () => {
    setDocSaving(true)
    localStorage.setItem(`doc_from_${carId}`, fromText)
    localStorage.setItem(`doc_to_${carId}`, toText)
    localStorage.setItem(`doc_dear_${carId}`, dearText)
    
    setTimeout(() => {
      setDocSaving(false)
      setDocSaved(true)
      setTimeout(() => setDocSaved(false), 2000)
    }, 400)
  }

  const [scale, setScale] = useState(1);
  const A4_WIDTH_PX = 1123; 

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 1280
      const availableWidth = isMobile
        ? window.innerWidth - 16
        : window.innerWidth - 16
      if (availableWidth < A4_WIDTH_PX) setScale(availableWidth / A4_WIDTH_PX)
      else setScale(1)
    }
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
      .eq('car_id', Number(carId))
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
  }, [carId, selectedMonth])

  const saveSignatureToDB = async (target, base64Text, fetchedName, fetchedPos, staffId = null, staffCode = null) => {
    try {
        if (!staffCode) throw new Error('กรุณายืนยันรหัสพนักงานก่อนบันทึก')
        const { data, error } = await supabase.rpc('save_report_signature', {
          p_car_id: Number(carId), p_report_month: selectedMonth, p_target: target,
          p_staff_code: staffCode, p_signature: base64Text,
        })
        if (error) throw error
        if (data?.error) throw new Error(data.error)
        if (target === 'driver') {
          setDriverSigText(base64Text); setDriverName(fetchedName); setDriverPos(fetchedPos);
        } else {
          setControllerSigText(base64Text); setControllerName(fetchedName); setControllerPos(fetchedPos);
        }
    } catch (err) { alert('เกิดข้อผิดพลาดในการบันทึกลายเซ็น: ' + err.message) }
  }

  const handleDeleteSig = async (target) => {
      if(!confirm('ต้องการลบลายเซ็นนี้ใช่หรือไม่?')) return;
      const staffCode = window.prompt('กรอกรหัสพนักงานของผู้ลงนามเพื่อยืนยันการลบ');
      if (!staffCode) return;
      await saveSignatureToDB(target, null, '', '', null, staffCode);
  }

  const openSigModal = (target, title) => {
      if (!canSignAny) {
          alert(`นอกเวลาอนุญาต รอบลงลายเซ็นถัดไป ${signatureSchedule.periodText}`);
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

  const maxLastPageRows = isEVCar ? 12 : 5;
  const maxRegularRows = isEVCar ? 12 : 8;

  const pages = [];
  let currentIndex = 0;
  if (logs.length === 0) {
      pages.push([]);
  } else {
      while (currentIndex < logs.length) {
          let remaining = logs.length - currentIndex;
          if (remaining <= maxLastPageRows) {
              pages.push(logs.slice(currentIndex, currentIndex + remaining));
              currentIndex += remaining;
          } else {
              pages.push(logs.slice(currentIndex, currentIndex + maxRegularRows));
              currentIndex += maxRegularRows;
          }
      }
      if (pages.length > 0 && pages[pages.length - 1].length > maxLastPageRows) {
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
    <div className="min-h-screen bg-[#f8f3fa] flex flex-col items-center print:bg-white print:p-0 font-sarabun text-black relative overflow-x-hidden pt-0 pb-8 xl:pt-8 xl:pb-12"
         style={{WebkitFontSmoothing:'antialiased'}}>
      
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
        signaturePeriodText={signatureSchedule.periodText}
        onClose={() => setSigModal({ isOpen: false, target: null, title: '' })}
        onSave={(base64Text, fetchedName, fetchedPos, staffId, staffCode) => saveSignatureToDB(sigModal.target, base64Text, fetchedName, fetchedPos, staffId, staffCode)}
        onVerifySuccess={() => {
            if (signableMonth && selectedMonth !== signableMonth) {
                setSelectedMonth(signableMonth);
            }
        }}
      />

      <style>{`
        @media print { .ctrl-panel { display:none !important; } }
      `}</style>

      {/* ── Desktop Sidebar ── */}
      <div className="ctrl-panel hidden xl:flex xl:fixed xl:top-4 xl:right-4 xl:w-[300px] xl:flex-col xl:gap-3 xl:z-50 print:hidden"
            style={{WebkitFontSmoothing:'antialiased'}}>

        {/* Card: ตั้งค่าเอกสาร */}
        <div className="bg-[rgba(248,243,250,0.94)] backdrop-blur-2xl rounded-[20px] overflow-hidden"
             style={{boxShadow:'0 2px 1px rgba(0,0,0,0.03),0 8px 28px rgba(0,0,0,0.12)', border:'0.5px solid rgba(0,0,0,0.08)'}}>
          <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[#4b1560] tracking-[-0.3px]">เอกสาร</span>
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-[#4b1560] text-white text-[12px] font-medium px-3.5 py-1.5 rounded-full active:bg-[#3a3a3c] transition-colors">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              พิมพ์
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            {/* Status badge */}
            {!canSignAny ? (
              <div className="flex items-center gap-2 bg-[#fff8ed] rounded-[10px] px-3 py-2">
                <span className="text-[11px] font-medium text-[#a05c00]">นอกเวลาเซ็น · รอบถัดไป {signatureSchedule.periodText}</span>
              </div>
            ) : selectedMonth !== signableMonth ? (
              <div className="flex items-center gap-2 bg-[#edf6ff] rounded-[10px] px-3 py-2">
                <span className="text-[11px] font-medium text-[#702082]">จะสลับเป็นเดือน {signableMonth}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[#edfbf0] rounded-[10px] px-3 py-2">
                <span className="w-[7px] h-[7px] rounded-full bg-[#34c759] flex-shrink-0"/>
                <span className="text-[11px] font-medium text-[#1a7f37]">แก้ไขลายเซ็นได้</span>
              </div>
            )}

            {/* เดือน */}
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#4b1560] font-medium">เดือน</span>
              <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
                className="text-[13px] text-[#702082] bg-transparent border-none outline-none cursor-pointer font-medium"/>
            </div>

            {/* จาก/ถึง/เรียน */}
            {!isEVCar && (
              <div className="bg-white rounded-[14px] overflow-hidden" style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                {[{l:'จาก',v:fromText,s:setFromText,p:'แผนก...'},{l:'ถึง',v:toText,s:setToText,p:'หัวหน้า...'},{l:'เรียน',v:dearText,s:setDearText,p:'ผจก...'}].map(({l,v,s,p},i,arr)=>(
                  <div key={l} className={`flex items-center px-3 py-2.5 gap-3 ${i<arr.length-1?'border-b border-[rgba(0,0,0,0.06)]':''}`}>
                    <span className="text-[11px] text-[#6e6e73] w-7 flex-shrink-0 font-medium">{l}</span>
                    <input type="text" value={v} onChange={e=>s(e.target.value)} placeholder={p}
                      className="flex-1 text-[12px] text-[#4b1560] bg-transparent border-none outline-none placeholder:text-[#c7c7cc]"/>
                  </div>
                ))}
              </div>
            )}

            {/* ลายเซ็น */}
            <div>
              <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em] mb-2">ลายเซ็น</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[
                  {key:'driver', label:isEVCar?'ผู้รายงาน':'ผู้ขับรถ', sig:driverSigText, title:isEVCar?'เซ็นชื่อผู้รายงาน':'เซ็นชื่อผู้ขับ'},
                  {key:'controller', label:'ผู้ควบคุม', sig:controllerSigText, title:'เซ็นชื่อผู้ควบคุม'},
                ].map(({key,label,sig,title})=>(
                  <div key={key} className="bg-white rounded-[14px] flex flex-col items-center py-2.5 px-2 relative min-h-[70px]"
                       style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                    <span className="text-[10px] text-[#6e6e73] mb-2 font-medium">{label}</span>
                    {sig ? (
                      <>
                        <img src={sig} alt="sig" className="h-7 object-contain"/>
                        {isCurrentMonthSignable && (
                          <button onClick={()=>handleDeleteSig(key)}
                            className="absolute top-1.5 right-1.5 w-[18px] h-[18px] rounded-full bg-[#ff3b30] flex items-center justify-center text-white text-[9px] font-bold">✕</button>
                        )}
                      </>
                    ) : (
                      <button onClick={()=>openSigModal(key,title)}
                        className={`text-[11px] font-medium px-3 py-1 rounded-full border transition-colors ${canSignAny?'border-[#702082] text-[#702082]':'border-[#d2d2d7] text-[#aeaeb2] cursor-not-allowed'}`}>
                        + เซ็น
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ปุ่มบันทึกเอกสาร สำหรับ Desktop */}
            {!isEVCar && (
              <button onClick={handleSaveDoc} disabled={docSaving}
                className={`w-full py-2 rounded-[10px] text-[12px] font-semibold transition-all active:scale-[0.98] ${
                  docSaved ? 'bg-[#edfbf0] text-[#1a7f37]' : 'bg-[#4b1560] text-white hover:bg-[#3a3a3c]'
                }`}>
                {docSaving ? 'กำลังบันทึก...' : docSaved ? '✓ บันทึกข้อมูลแล้ว' : 'บันทึกเอกสาร'}
              </button>
            )}

          </div>
        </div>

        {/* Card: บันทึกการซ่อม */}
        <div className="bg-[rgba(248,243,250,0.94)] backdrop-blur-2xl rounded-[20px] overflow-hidden"
             style={{boxShadow:'0 2px 1px rgba(0,0,0,0.03),0 8px 28px rgba(0,0,0,0.12)', border:'0.5px solid rgba(0,0,0,0.08)'}}>
          <div className="px-4 py-3 border-b border-black/[0.06] flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[#4b1560] tracking-[-0.3px]">บันทึกการซ่อม</span>
            {drillSaved && <span className="text-[11px] font-medium text-[#1a7f37] bg-[#edfbf0] px-2.5 py-0.5 rounded-full">✓ บันทึกแล้ว</span>}
          </div>
          <div className="px-4 py-3 space-y-3">
            <div>
              <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em] mb-1.5">วันที่</p>
              <div className="bg-white rounded-[14px] overflow-hidden" style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}>
                <select value={drillDate} onChange={e=>{setDrillDate(e.target.value);setDrillSaved(false)}}
                  className="w-full px-3 py-2.5 text-[13px] text-[#4b1560] bg-transparent border-none outline-none">
                  <option value="">-- เลือกวันที่ --</option>
                  {[...new Map(logs.map(l=>{
                    const d=new Date(l.start_time)
                    const key=d.toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit',year:'numeric'})
                    const localIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    return [localIso,{key,iso:localIso}]
                  })).values()].map(({key,iso})=>(
                    <option key={iso} value={iso}>{key}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em] mb-1.5">รายการซ่อม</p>
              <input type="text" value={drillDesc} onChange={e=>{setDrillDesc(e.target.value);setDrillSaved(false)}} placeholder="เช่น ซ่อมดับเพลิง..."
                className="w-full bg-white rounded-[14px] px-3 py-2.5 text-[13px] outline-none placeholder:text-[#c7c7cc]"
                style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em] mb-1.5">เงิน (บาท)</p>
                <input type="number" value={drillCost} onChange={e=>{setDrillCost(e.target.value);setDrillSaved(false)}} placeholder="0"
                  className="w-full bg-white rounded-[14px] px-3 py-2.5 text-[13px] outline-none text-center font-mono"
                  style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}/>
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em] mb-1.5">ชม.เครื่องจักร</p>
                <input type="number" value={drillHours} onChange={e=>{setDrillHours(e.target.value);setDrillSaved(false)}} placeholder="0.0" step="0.5"
                  className="w-full bg-white rounded-[14px] px-3 py-2.5 text-[13px] outline-none text-center font-mono"
                  style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06),0 0 0 0.5px rgba(0,0,0,0.07)'}}/>
              </div>
            </div>
            <button onClick={()=>{if(!drillDate||!drillDesc)return alert('กรุณาเลือกวันที่และกรอกรายการซ่อม');setDrillSaving(true);setTimeout(()=>{setDrillSaving(false);setDrillSaved(true)},600)}}
              disabled={drillSaving}
              className="w-full bg-[#4b1560] text-white text-[14px] font-semibold py-3 rounded-[14px] active:bg-[#3a3a3c] transition-colors">
              {drillSaving?'กำลังบันทึก...':'บันทึกการซ่อม'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Bottom Sheet ── */}
      <div className="ctrl-panel xl:hidden sticky top-0 z-50 print:hidden w-full">
        <MobileControlSheet
          selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
          fromText={fromText} setFromText={setFromText}
          toText={toText} setToText={setToText}
          dearText={dearText} setDearText={setDearText}
          isEVCar={isEVCar} canSignAny={canSignAny}
          isCurrentMonthSignable={isCurrentMonthSignable}
          signaturePeriodText={signatureSchedule.periodText}
          signableMonth={signableMonth} driverSigText={driverSigText}
          controllerSigText={controllerSigText}
          handleDeleteSig={handleDeleteSig} openSigModal={openSigModal}
          logs={logs}
          drillDate={drillDate} setDrillDate={setDrillDate}
          drillDesc={drillDesc} setDrillDesc={setDrillDesc}
          drillCost={drillCost} setDrillCost={setDrillCost}
          drillHours={drillHours} setDrillHours={setDrillHours}
          drillSaving={drillSaving} setDrillSaving={setDrillSaving}
          drillSaved={drillSaved} setDrillSaved={setDrillSaved}
          handleSaveDoc={handleSaveDoc} docSaving={docSaving} docSaved={docSaved}
        />
      </div>

      <div className="w-full flex flex-col items-center gap-4 xl:gap-6 print:block print:w-auto print-container px-2 xl:px-0">
          {pages.map((pageLogs, pageIndex) => {
            const isLastPage = pageIndex === pages.length - 1;
            const targetRows = isLastPage ? (isEVCar ? 12 : 5) : (isEVCar ? 12 : 8);
            const emptyRows = Array.from({ length: Math.max(0, targetRows - pageLogs.length) });

            return (
              <div 
                key={pageIndex} 
                className="page-wrapper relative rounded-[8px] bg-white overflow-hidden"
                style={{ width: `${A4_WIDTH_PX * scale}px`, height: `${794 * scale}px`, boxShadow:'0 2px 2px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.12)' }}
              >
                <div 
                  className="page-inner absolute top-0 left-0 bg-white box-border flex flex-col font-normal text-black"
                  style={{ width: `${A4_WIDTH_PX}px`, height: `794px`, padding: '25px 38px 30px 38px', transform: `scale(${scale})`, transformOrigin: 'top left' }}
                >
                    {/* ========================================= */}
                    {/* REPORT FORM: EV */}
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
                        /* REPORT FORM: STANDARD (รถน้ำมัน) */
                        /* ========================================= */
                        <div className="flex-1 flex flex-col justify-between pt-4">
                            <div>
                                {/* Header (Top) */}
                                <div className="relative font-normal text-[14px] leading-[1.8] text-black">
                                    <div className="absolute top-0 right-0 text-[12px]">หน้าที่ {pageIndex + 1} / {pages.length}</div>
                                    
                                    <div className="text-center mb-4">
                                        <div className="text-[18px] font-bold">การไฟฟ้าส่วนภูมิภาค</div>
                                        <div className="text-[18px] font-bold">แบบฟอร์มรายงานการใช้ยานพาหนะหรือเครื่องจักร</div>
                                    </div>

                                    <div className="flex items-end mb-1">
                                        <div className="whitespace-nowrap">จาก<span className="inline-block border-b border-dotted border-black w-[250px] text-center px-2">{fromText}</span></div>
                                        <div className="whitespace-nowrap mx-2">ถึง <span className="inline-block border-b border-dotted border-black w-[250px] text-center px-2">{toText}</span></div>
                                        <div className="whitespace-nowrap flex-grow text-right pr-2">วันที่<span className="inline-block border-b border-dotted border-black w-[40px] text-center px-1">{today.getDate()}</span>เดือน<span className="inline-block border-b border-dotted border-black w-[100px] text-center px-1">{formatThaiMonth(today)}</span>พ.ศ.<span className="inline-block border-b border-dotted border-black w-[60px] text-center px-1">{formatThaiYear(today)}</span></div>
                                    </div>
                                    
                                    <div className="flex items-end mb-1">
                                        <div className="whitespace-nowrap w-full">เรื่อง<span className="ml-4">รายงานการใช้ยานพาหนะ / เครื่องจักร</span></div>
                                    </div>

                                    <div className="flex items-end mb-1">
                                        <div className="whitespace-nowrap w-full">เรียน<span className="ml-4"></span><span className="inline-block border-b border-dotted border-black w-[350px] text-center px-2">{dearText}</span></div>
                                    </div>

                                    <div className="flex items-end mb-1">
                                        <div className="whitespace-nowrap ml-10">รายงานการใช้ยานพาหนะ / เครื่องจักร ประจำเดือน</div>
                                        <span className="inline-block border-b border-dotted border-black w-[150px] mx-1 text-center px-2">{formatThaiMonth(reportDate)}</span>พ.ศ.
                                        <span className="inline-block border-b border-dotted border-black w-[80px] mx-1 text-center px-2">{formatThaiYear(reportDate)}</span>หมายเลขทะเบียน
                                        <span className="inline-block border-b border-dotted border-black w-[200px] mx-1 text-center px-2">{car?.plate_number}</span>
                                    </div>

                                    <div className="flex items-end mb-1">
                                        <div className="whitespace-nowrap">รหัส<span className="inline-block border-b border-dotted border-black w-[250px] mx-1 text-center px-2"></span></div>
                                        <div className="whitespace-nowrap">ประเภท<span className="inline-block border-b border-dotted border-black w-[250px] mx-1 text-center px-2">{car?.car_type}</span></div>
                                        <div className="whitespace-nowrap">ชนิด<span className="inline-block border-b border-dotted border-black w-[200px] mx-1 text-center px-2"></span></div>
                                    </div>

                                    <div className="flex items-end mb-1">
                                        <div className="whitespace-nowrap">ชนิดของน้ำมันเชื้อเพลิง<span className="inline-block border-b border-dotted border-black w-[400px] mx-1 text-center px-2">{car?.fuel_type}</span></div>
                                        <div className="whitespace-nowrap">น้ำมันหล่อลื่น จำนวน<span className="inline-block border-b border-dotted border-black w-[150px] mx-1 text-center px-2"></span>ลิตร</div>
                                    </div>

                                    <div className="flex items-end mb-4">
                                        <div className="whitespace-nowrap">เฉลี่ยการใช้น้ำมันเชื้อเพลิง ลิตรละ<span className="inline-block border-b border-dotted border-black w-[200px] mx-1 text-center px-2">{kmPerLiter}</span>กิโลเมตร ,</div>
                                        <div className="whitespace-nowrap">ชั่วโมงละ<span className="inline-block border-b border-dotted border-black w-[150px] mx-1 text-center px-2"></span>ลิตร</div>
                                    </div>
                                </div>

                                <table className="w-full border-collapse border border-black text-[12px] font-normal text-black">
                                    <thead>
                                        <tr className="text-center bg-white print:bg-transparent font-normal">
                                            <th rowSpan={2} className="border border-black w-[6%] font-normal">วันที่</th>
                                            <th rowSpan={2} className="border border-black w-[16%] font-normal px-1 leading-tight">ชื่อ-ตำแหน่ง<br/>หน่วยงานที่ใช้<br/>ยานพาหนะ</th>
                                            <th rowSpan={2} className="border border-black w-[16%] font-normal px-1">ไปปฏิบัติงานที่ใด</th>
                                            <th colSpan={2} className="border border-black w-[12%] font-normal">เลขระยะทาง</th>
                                            <th rowSpan={2} className="border border-black w-[7%] font-normal text-[11px] px-1 leading-tight">ชั่วโมง<br/>ทำงานของ<br/>เครื่องจักร</th>
                                            <th rowSpan={2} className="border border-black w-[9%] font-normal text-[11px] px-1 leading-tight">น้ำมัน<br/>เชื้อเพลิงที่<br/>เติมแต่ละครั้ง<br/>(ลิตร)</th>
                                            <th rowSpan={2} className="border border-black w-[8%] font-normal text-[11px] px-1 leading-tight">จำนวนเงิน<br/>(บาท)</th>
                                            <th rowSpan={2} className="border border-black w-[11%] font-normal text-[12px] px-1">รายการซ่อม</th>
                                            <th rowSpan={2} className="border border-black w-[8%] font-normal text-[11px] px-1 leading-tight">จำนวนเงิน<br/>(บาท)</th>
                                            <th rowSpan={2} className="border border-black w-[7%] font-normal text-[12px] px-1">หมายเหตุ</th>
                                        </tr>
                                        <tr className="text-center bg-white print:bg-transparent font-normal">
                                            <th className="border border-black font-normal w-[6%]">ไป</th>
                                            <th className="border border-black font-normal w-[6%]">กลับ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageLogs.map((log, i) => (
                                        <tr key={i} className="h-[28px] align-middle font-normal text-[12px]">
                                            <td className="border border-black text-center">{formatDate(log.start_time)}</td>
                                            <td className="border border-black px-1 text-left truncate max-w-[140px]">{log.driver_name}</td>
                                            
                                            {/* 🟢 ดึงข้อมูลแสดงแค่ ประเภทงาน */}
                                            <td className="border border-black px-1 text-left truncate max-w-[140px]">
                                                {extractTaskOnly(log.location)}
                                            </td>

                                            <td className="border border-black text-center">{log.start_mileage}</td>
                                            <td className="border border-black text-center">{log.end_mileage}</td>
                                            <td className="border border-black text-center"></td>
                                            <td className="border border-black text-center">{log.fuel_liters ? Number(log.fuel_liters).toFixed(2) : ''}</td>
                                            <td className="border border-black text-center">{log.fuel_cost > 0 ? Number(log.fuel_cost).toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td>
                                            <td className="border border-black"></td>
                                            <td className="border border-black"></td>
                                            <td className="border border-black"></td>
                                        </tr>
                                        ))}
                                        {emptyRows.map((_, i) => (
                                        <tr key={`empty-${i}`} className="h-[28px] font-normal">
                                            <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                            <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                            <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                            <td className="border border-black"></td><td className="border border-black"></td>
                                        </tr>
                                        ))}
                                        {/* แถวรวมโชว์เฉพาะหน้าสุดท้าย */}
                                        {isLastPage && (
                                            <tr className="h-[28px] font-normal text-[12px] align-middle bg-white print:bg-transparent">
                                                <td colSpan={3} className="border border-black text-center">รวมทั้งสิ้น</td>
                                                <td colSpan={2} className="border border-black text-center text-black">{totalDistance > 0 ? totalDistance.toLocaleString() : ''}</td>
                                                <td className="border border-black"></td>
                                                <td className="border border-black text-center text-black">{totalFuelLiters > 0 ? totalFuelLiters.toFixed(2) : ''}</td>
                                                <td className="border border-black text-center text-black">{totalFuelCost > 0 ? totalFuelCost.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td>
                                                <td className="border border-black"></td>
                                                <td className="border border-black"></td>
                                                <td className="border border-black"></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                {isLastPage && (
                                    <div className="mt-4 flex justify-center w-full">
                                        <div className="w-[500px] text-[13px] font-normal leading-relaxed space-y-1.5 text-black">
                                            <div className="flex justify-between items-end">
                                                <span className="w-[300px]">1. รวมระยะทาง กม. ที่ใช้ในการปฏิบัติงาน</span>
                                                <span className="border-b border-dotted border-black flex-1 mx-2 text-center">{totalDistance > 0 ? totalDistance.toLocaleString() : ''}</span>
                                                <span className="w-[50px]">กม.</span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="w-[300px]">2. รวมน้ำมันเชื้อเพลิงที่ใช้ในการปฏิบัติงาน</span>
                                                <span className="border-b border-dotted border-black flex-1 mx-2 text-center">{totalFuelLiters > 0 ? totalFuelLiters.toFixed(2) : ''}</span>
                                                <span className="w-[50px]">ลิตร</span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="w-[300px]">3. อัตราเฉลี่ยน้ำมันเชื้อเพลิง</span>
                                                <span className="border-b border-dotted border-black flex-1 mx-2 text-center">{kmPerLiter}</span>
                                                <span className="w-[50px]">กม./ลิตร</span>
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="w-[300px]">4. รวมจำนวนเงินที่ใช้ในการเติมน้ำมัน</span>
                                                <span className="border-b border-dotted border-black flex-1 mx-2 text-center">{totalFuelCost > 0 ? totalFuelCost.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</span>
                                                <span className="w-[50px]">บาท</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="mt-auto pb-4 flex justify-between px-16 w-full font-normal text-[13px] text-black">
                                <div className="flex flex-col items-center w-[250px]">
                                    <div className="w-full relative h-12 flex items-end justify-center mb-1">
                                        {driverSigText && <img src={driverSigText} alt="signature" className="absolute bottom-1 max-h-12 max-w-full object-contain" />}
                                        <div className="w-full flex items-end justify-between text-[13px]">
                                            <span>(</span>
                                            <span className="flex-1 border-b border-dotted border-black mx-2 text-center">{driverName}</span>
                                            <span>)</span>
                                        </div>
                                    </div>
                                    <div className="mt-1 text-center font-normal">พขร.(บ) ผู้ดูแลรถยนต์</div>
                                </div>

                                <div className="flex flex-col items-center w-[250px]">
                                    <div className="w-full relative h-12 flex items-end justify-center mb-1">
                                        {controllerSigText && <img src={controllerSigText} alt="signature" className="absolute bottom-1 max-h-12 max-w-full object-contain" />}
                                        <div className="w-full flex items-end justify-between text-[13px]">
                                            <span>(</span>
                                            <span className="flex-1 border-b border-dotted border-black mx-2 text-center">{controllerName}</span>
                                            <span>)</span>
                                        </div>
                                    </div>
                                    <div className="mt-1 text-center font-normal">ผู้ควบคุมรถยนต์</div>
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

export default function Page() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen">กำลังโหลด...</div>}>
      <MainApp />
    </Suspense>
  )
}
