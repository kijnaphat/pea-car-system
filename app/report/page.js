'use client'
import React, { useState, useEffect, Suspense, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams } from 'next/navigation'

// ==========================================
// 🎨 Component: กระดานเซ็นชื่อ (Signature Pad)
// ==========================================
function SignatureModal({ isOpen, onClose, onSave, title }) {
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
        if (data) setStaffInfo(data);
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
            <span className="text-lg">📅</span> อนุญาตให้เซ็นเอกสารเฉพาะวันที่ 28 ถึง 5
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

  const currentDay = today.getDate()
  const isSigningAllowed = currentDay >= 28 || currentDay <= 5

  // ระบบคำนวณการย่อหน้าจอ (Perfect Fit Scale)
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
      if (!isSigningAllowed) {
          alert('⚠️ ระบบอนุญาตให้เซ็นชื่อ แก้ไข หรือลบลายเซ็นได้เฉพาะวันที่ 28 ถึง 5 ของเดือนเท่านั้นครับ');
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
  if (logs.length === 0) pages.push([]);
  else for (let i = 0; i < logs.length; i += ITEMS_PER_PAGE) pages.push(logs.slice(i, i + ITEMS_PER_PAGE));

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
    // ✅ เพิ่ม pt-[380px] สำหรับรถน้ำมัน และ pt-[260px] สำหรับ EV เพื่อดันกระดาษให้พ้นแผงควบคุม
    <div className={`min-h-screen bg-gray-500 flex flex-col items-center pb-12 print:bg-white print:p-0 font-sarabun text-black relative overflow-x-hidden ${isEVCar ? 'pt-[260px]' : 'pt-[380px]'} xl:pt-8`}>
      
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          .page-wrapper { width: 297mm !important; height: 210mm !important; margin: 0 !important; box-shadow: none !important; border-radius: 0 !important; page-break-after: always; }
          .page-inner { width: 297mm !important; height: 210mm !important; transform: none !important; position: static !important; padding: 8mm 10mm 18mm 10mm !important; }
        }
      `}</style>

      <SignatureModal 
        isOpen={sigModal.isOpen} title={sigModal.title}
        onClose={() => setSigModal({ isOpen: false, target: null, title: '' })}
        onSave={(base64Text, fetchedName, fetchedPos) => saveSignatureToDB(sigModal.target, base64Text, fetchedName, fetchedPos)}
      />

      <div className="w-full fixed top-0 left-0 xl:w-[320px] xl:top-4 xl:left-auto xl:right-4 print:hidden z-50 flex flex-col gap-2 bg-white/95 backdrop-blur-md p-3 shadow-lg xl:shadow-2xl border-b xl:border border-gray-200 xl:rounded-2xl overflow-hidden">
        
        <div className="flex justify-between items-center mb-1">
          <h3 className="font-black text-[#742F99] text-[15px] xl:text-lg">⚙️ ตั้งค่าเอกสาร</h3>
          <button onClick={() => window.print()} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-blue-700 font-bold text-[11px] xl:text-sm flex items-center gap-1 active:scale-95 transition-transform">🖨️ พิมพ์</button>
        </div>

        {!isSigningAllowed && (
            <div className="bg-orange-50 border border-orange-200 text-orange-700 text-[10px] p-1.5 rounded-lg text-center font-bold">
                🔒 หมดเวลาเซ็น (อนุญาตเฉพาะ 28-5)
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
                                {isSigningAllowed && <button onClick={() => handleDeleteSig('driver')} className="absolute top-1 right-1 text-red-500 bg-white border border-red-100 w-4 h-4 rounded-full flex items-center justify-center text-[8px] shadow-sm font-bold">✖</button>}
                            </>
                        ) : (
                            <button onClick={() => openSigModal('driver', isEVCar ? 'เซ็นชื่อผู้รายงาน' : 'เซ็นชื่อผู้ขับยานพาหนะ')} className={`mt-3 w-[90%] py-1 rounded shadow-sm text-[10px] font-bold border transition-colors ${isSigningAllowed ? 'bg-white border-[#742F99] text-[#742F99]' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                + เซ็นชื่อ
                            </button>
                        )}
                    </div>

                    <div className="border border-gray-200 rounded-lg p-1.5 bg-gray-50 flex flex-col justify-center items-center relative h-[60px]">
                        <span className="text-[9px] font-bold text-gray-600 absolute top-1 left-2">ผู้ควบคุม</span>
                        {controllerSigText ? (
                            <>
                                <img src={controllerSigText} alt="sig" className="h-6 object-contain mt-3" />
                                {isSigningAllowed && <button onClick={() => handleDeleteSig('controller')} className="absolute top-1 right-1 text-red-500 bg-white border border-red-100 w-4 h-4 rounded-full flex items-center justify-center text-[8px] shadow-sm font-bold">✖</button>}
                            </>
                        ) : (
                            <button onClick={() => openSigModal('controller', 'เซ็นชื่อผู้ควบคุม')} className={`mt-3 w-[90%] py-1 rounded shadow-sm text-[10px] font-bold border transition-colors ${isSigningAllowed ? 'bg-white border-[#742F99] text-[#742F99]' : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'}`}>
                                + เซ็นชื่อ
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="w-full flex flex-col items-center gap-6 print:block print:w-auto">
          {pages.map((pageLogs, pageIndex) => {
            const emptyRows = Array.from({ length: Math.max(0, ITEMS_PER_PAGE - pageLogs.length) })
            const isLastPage = pageIndex === pages.length - 1;

            return (
              <div 
                key={pageIndex} 
                className="page-wrapper relative shadow-2xl xl:shadow-xl rounded-md bg-white overflow-hidden"
                style={{ width: `${A4_WIDTH_PX * scale}px`, height: `${794 * scale}px` }}
              >
                <div 
                  className="page-inner absolute top-0 left-0 bg-white box-border flex flex-col font-normal text-black"
                  style={{ width: `${A4_WIDTH_PX}px`, height: `794px`, padding: '30px 38px 68px 38px', transform: `scale(${scale})`, transformOrigin: 'top left' }}
                >
                    {/* ========================================= */}
                    {/* ⚡ REPORT FORM: EV */}
                    {/* ========================================= */}
                    {isEVCar ? (
                        <>
                            <div className="mb-2">
                                <h1 className="text-lg font-normal text-center">รายงานการอัดประจุไฟฟ้าสำหรับรถยนต์ไฟฟ้า (EV)</h1>
                                <div className="h-6"></div> 
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
                                    <tr className="text-center h-[30px] font-normal">
                                        <th rowSpan={3} className="border border-black w-[8%] font-normal">วันที่</th>
                                        <th rowSpan={3} className="border border-black w-[15%] font-normal">หน่วยงานที่ใช้</th>
                                        <th rowSpan={3} className="border border-black w-[10%] font-normal">เลขไมล์(กม.)</th>
                                        <th colSpan={2} className="border border-black w-[10%] font-normal">% แบตเตอรี่</th>
                                        <th colSpan={6} className="border border-black font-normal">สถานีอัดประจุรถยนต์ไฟฟ้า</th>
                                    </tr>
                                    <tr className="text-center h-[30px] font-normal">
                                        <th rowSpan={2} className="border border-black w-[5%] font-normal">ก่อน</th>
                                        <th rowSpan={2} className="border border-black w-[5%] font-normal">หลัง</th>
                                        <th colSpan={4} className="border border-black font-normal">สถานีชาร์จของ PEA Volta</th>
                                        <th colSpan={2} className="border border-black font-normal">สถานีชาร์จนอกเครือข่าย<br/>PEA Volta</th>
                                    </tr>
                                    <tr className="text-center h-[40px] font-normal">
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
                                            <tr key={i} className="h-[35px] text-center font-normal align-middle">
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
                                        <tr key={`empty-${i}`} className="h-[35px] font-normal">
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
                                </tbody>
                            </table>
                            
                            <div className="mt-2 text-[10px] font-normal">
                                หมายเหตุ : สถานีชาร์จ อื่น ๆ เช่น EA Anywhere , EV Station , MEA EV , EGAT และ Emergency charger
                            </div>
                            
                            {isLastPage && (
                                <div className="mt-auto pb-6 flex justify-between items-end px-4 font-normal">
                                    <div className="text-sm">
                                        <p className="mb-2">เลขไมล์ต้นเดือน................<span className="font-normal ml-2">{startMonthMileage.toLocaleString()}</span>........................</p>
                                        <p>เลขไมล์ปลายเดือน..............<span className="font-normal ml-2">{endMonthMileage.toLocaleString()}</span>........................</p>
                                    </div>
                                    
                                    <div className="flex gap-x-28">
                                        <div className="text-sm text-center flex flex-col items-center w-[250px]">
                                            <div className="flex items-end justify-center w-full relative h-16 mb-1">
                                                <span className="mr-2">(ลงชื่อ)</span>
                                                <div className="border-b border-dotted border-black w-full h-full flex items-end justify-center pb-1">
                                                    {driverSigText && <img src={driverSigText} alt="signature" className="max-h-16 max-w-full object-contain" />}
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
                                            <div className="flex items-end justify-center w-full relative h-16 mb-1">
                                                <span className="mr-2">(ลงชื่อ)</span>
                                                <div className="border-b border-dotted border-black w-full h-full flex items-end justify-center pb-1">
                                                    {controllerSigText && <img src={controllerSigText} alt="signature" className="max-h-16 max-w-full object-contain" />}
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
                            )}
                        </>
                    ) : (
                        /* ========================================= */
                        /* 🚙 REPORT FORM: STANDARD (รถน้ำมัน) */
                        /* ========================================= */
                        <>
                            <div className="flex justify-between items-end mb-1 font-normal">
                                <div className="w-[280px] flex justify-start pl-10">
                                    <div className="flex flex-col items-center">
                                        <img src="/pea_logo.png" alt="PEA Logo" className="h-14 mb-1 object-contain" />
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

                            <div className="text-[13px] space-y-1 mt-2 font-normal">
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
                                <div className="flex flex-wrap pt-1 items-end leading-relaxed pl-10">
                                    <span className="ml-12">รายงานการใช้ยานพาหนะ ประจำเดือน</span> <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1">{formatThaiMonth(reportDate)}</span> พ.ศ. <span className="border-b border-dotted border-black min-w-[50px] text-center mx-1">{formatThaiYear(reportDate)}</span> หมายเลขทะเบียน <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1 font-normal">{car?.plate_number}</span> รหัส <span className="border-b border-dotted border-black min-w-[60px] text-center mx-1"></span> ประเภท <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1 font-normal">{car?.car_type}</span> ชนิด <span className="border-b border-dotted border-black min-w-[60px] text-center mx-1"></span>
                                </div>
                                <div className="flex items-center gap-3 pt-1 text-[12px] pl-10 font-normal">
                                    <span>ชนิดเชื้อเพลิง</span>
                                    {['แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ E20', 'แก๊สโซฮอล์ E85', 'ดีเซล'].map(f => (
                                        <div key={f} className="flex items-center gap-1 font-normal">
                                            <div className="w-3.5 h-3.5 border border-black flex items-center justify-center text-[11px] relative">{car?.fuel_type === f && <span className="absolute -top-1 font-normal">✓</span>}</div> <span>{f}</span>
                                        </div>
                                    ))}
                                    <span className="ml-2 font-normal">น้ำมันหล่อลื่น จำนวน ................. ลิตร</span>
                                </div>
                                <div className="flex items-center pt-1 text-[12px] pl-10 font-normal">
                                    อัตราสิ้นเปลืองเชื้อเพลิงยานพาหนะ <span className="border-b border-dotted border-black w-[130px] text-center mx-1 font-normal text-black">{kmPerLiter}</span> กิโลเมตร/ลิตร, <span className="ml-2 font-normal">เครื่องจักร ..................... ลิตร/ชั่วโมง</span>
                                </div>
                            </div>

                            <table className="w-full border-collapse border border-black mt-2 text-[12px] font-normal">
                                <thead>
                                    <tr className="text-center h-[45px] bg-gray-50 print:bg-transparent font-normal">
                                    <th className="border border-black w-[10%] font-normal">วันที่</th><th className="border border-black w-[14%] font-normal px-1">ชื่อ-ตำแหน่ง<br/>หน่วยงานที่ใช้</th><th className="border border-black w-[14%] font-normal px-1">สถานที่ปฏิบัติงาน</th>
                                    <th className="border border-black w-[12%] p-0 font-normal"><div className="h-[22px] flex items-center justify-center border-b border-black text-[11px]">เลขระยะทาง</div><div className="h-[23px] flex divide-x divide-black text-[11px]"><div className="w-1/2 flex items-center justify-center text-[10px]">ไป</div><div className="w-1/2 flex items-center justify-center text-[10px]">กลับ</div></div></th>
                                    <th className="border border-black w-[7%] font-normal text-[10px]">ชั่วโมงการ<br/>ทำงาน</th><th className="border border-black w-[8%] font-normal text-[10px]">น้ำมันที่เติม<br/>(ลิตร)</th><th className="border border-black w-[8%] font-normal text-[10px]">จำนวนเงิน<br/>(บาท)</th><th className="border border-black w-[11%] font-normal text-[11px]">รายการซ่อม</th><th className="border border-black w-[8%] font-normal text-[10px]">จำนวนเงิน<br/>(บาท)</th><th className="border border-black w-[8%] font-normal text-[11px]">หมายเหตุ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageLogs.map((log, i) => (
                                    <tr key={i} className="h-[28px] align-middle font-normal">
                                        <td className="border border-black text-center">{formatDate(log.start_time)}</td><td className="border border-black px-1 text-center truncate max-w-[120px]">{log.driver_name}</td><td className="border border-black px-1 text-center truncate max-w-[120px]">{log.location}</td>
                                        <td className="border border-black p-0 h-full font-normal"><div className="flex divide-x divide-black h-[28px]"><div className="w-1/2 flex items-center justify-center">{log.start_mileage}</div><div className="w-1/2 flex items-center justify-center">{log.end_mileage}</div></div></td>
                                        <td className="border border-black text-center"></td><td className="border border-black text-center">{log.fuel_liters ? Number(log.fuel_liters).toFixed(2) : ''}</td><td className="border border-black text-right px-1">{log.fuel_cost > 0 ? Number(log.fuel_cost).toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                    </tr>
                                    ))}
                                    {emptyRows.map((_, i) => (
                                    <tr key={`empty-${i}`} className="h-[28px] font-normal">
                                        <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black p-0 h-full"><div className="flex divide-x divide-black h-[28px]"><div className="w-1/2"></div><div className="w-1/2"></div></div></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                    </tr>
                                    ))}
                                    {isLastPage && (
                                        <tr className="h-[35px] font-normal text-[11px] align-middle bg-gray-50 print:bg-transparent">
                                            <td colSpan={3} className="border border-black text-right pr-2">รวม</td><td className="border border-black text-center text-black">{totalDistance > 0 ? totalDistance.toLocaleString() + ' กม.' : '-'}</td><td className="border border-black"></td><td className="border border-black text-center text-black">{totalFuelLiters > 0 ? totalFuelLiters.toFixed(2) : ''}</td><td className="border border-black text-right px-1 text-black">{totalFuelCost > 0 ? totalFuelCost.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td><td className="border border-black"></td><td className="border border-black text-right px-1"></td><td className="border border-black"></td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            <div className="mt-2 pl-12 text-[13px] font-normal">จึงเรียนเพื่อโปรดทราบ</div>
                            
                            <div className="mt-auto pb-8 flex justify-center items-center w-full font-normal text-[13px]">
                                <div className="flex gap-x-28">
                                    
                                    <div className="flex flex-col items-center w-[280px]">
                                        <div className="flex w-full items-end h-16 mb-1">
                                            ลงชื่อ 
                                            <div className="border-b border-dotted border-black flex-grow ml-2 h-full relative flex items-end justify-center pb-1">
                                                {driverSigText && <img src={driverSigText} alt="signature" className="max-h-16 max-w-full object-contain" />}
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
                                        <div className="flex w-full items-end h-16 mb-1">
                                            ลงชื่อ 
                                            <div className="border-b border-dotted border-black flex-grow ml-2 h-full relative flex items-end justify-center pb-1">
                                                {controllerSigText && <img src={controllerSigText} alt="signature" className="max-h-16 max-w-full object-contain" />}
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
                        </>
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
    <Suspense fallback={<div className="flex justify-center items-center h-screen">กำลังโหลดรายงาน...</div>}>
      <ReportPage />
    </Suspense>
  )
}