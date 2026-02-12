'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams, useRouter } from 'next/navigation' // ✅ เพิ่ม useRouter

export default function CarActionFormMobile() {
  const searchParams = useSearchParams()
  const carId = searchParams.get('car_id')
  const router = useRouter() // ✅ เรียกใช้ Router

  // --- State ข้อมูล ---
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
  const [currentTime, setCurrentTime] = useState(new Date())

  const [isLoading, setIsLoading] = useState(false)

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // --- 1. ดึงข้อมูลพนักงาน + ตำแหน่ง ---
  useEffect(() => {
    const fetchStaff = async () => {
      if (employeeId.length >= 4) {
        const { data } = await supabase
          .from('staff')
          .select('full_name, position') 
          .eq('staff_code', employeeId)
          .single()
        
        if (data) {
          setStaffName(data.full_name)
          setStaffPosition(data.position)
        } else {
          setStaffName('')
          setStaffPosition('')
        }
      } else {
        setStaffName('')
        setStaffPosition('')
      }
    }
    const timeoutId = setTimeout(() => fetchStaff(), 500)
    return () => clearTimeout(timeoutId)
  }, [employeeId])

  // --- 2. ดึงข้อมูลรถ ---
  const fetchData = async () => {
    if (!carId) return
    const { data: carData } = await supabase.from('cars').select('*').eq('id', carId).single()
    
    if (carData) {
      setCar(carData)
      if (carData.status === 'available') {
         const { data: lastLog } = await supabase.from('trip_logs')
           .select('end_mileage')
           .eq('car_id', carId).eq('is_completed', true)
           .order('created_at', { ascending: false }).limit(1).single()
         if (lastLog?.end_mileage) setMileage(lastLog.end_mileage.toString())
      } else if (carData.status === 'busy') {
        const { data: logData } = await supabase.from('trip_logs')
          .select('*').eq('car_id', carId).eq('is_completed', false)
          .order('created_at', { ascending: false }).limit(1).single()
        if (logData) setActiveLog(logData)
      }
    }
  }

  useEffect(() => { fetchData() }, [carId])

  // --- Action: นำรถออก ---
  const handleTakeOut = async () => {
    const finalLocation = selectedLocation === 'อื่นๆ' ? customLocation : selectedLocation

    if (!employeeId || !mileage || !finalLocation) {
      alert("กรุณากรอกข้อมูลให้ครบทุกช่องครับ")
      return
    }

    setIsLoading(true)
    try {
      const nameToSave = staffName || employeeId 

      const { error: logError } = await supabase.from('trip_logs').insert({
        car_id: carId,
        driver_name: nameToSave, 
        start_mileage: parseFloat(mileage),
        location: finalLocation,
        start_time: new Date().toISOString(),
        is_completed: false
      })
      if (logError) throw logError

      const { error: carError } = await supabase.from('cars').update({ status: 'busy' }).eq('id', carId)
      if (carError) throw carError

      alert(`✅ บันทึกสำเร็จ!\nผู้ขับ: ${nameToSave}\nตำแหน่ง: ${staffPosition || '-'}`)
      setEmployeeId(''); setStaffName(''); setStaffPosition(''); setCustomLocation(''); setSelectedLocation('')
      fetchData()

    } catch (error) {
      console.error(error)
      alert("❌ Error: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  // --- Action: คืนรถ ---
  const handleReturn = async () => {
    if (!endMileage) return alert("กรุณากรอกเลขไมล์จบครับ")
    if (activeLog && parseFloat(endMileage) < activeLog.start_mileage) return alert("❌ เลขไมล์จบ ต้องมากกว่าเลขไมล์เริ่มครับ")

    setIsLoading(true)
    try {
      if (activeLog) {
        const { error: logError } = await supabase.from('trip_logs').update({
            end_mileage: parseFloat(endMileage),
            fuel_liters: fuelLiters ? parseFloat(fuelLiters) : 0,
            fuel_cost: fuelCost ? parseFloat(fuelCost) : 0,
            end_time: new Date().toISOString(),
            is_completed: true
        }).eq('id', activeLog.id)
        if (logError) throw logError
      }
      const { error: carError } = await supabase.from('cars').update({ status: 'available' }).eq('id', carId)
      if (carError) throw carError

      alert("✅ คืนรถเรียบร้อย!")
      setEndMileage(''); setFuelLiters(''); setFuelCost('')
      fetchData()
    } catch (error) {
      alert("❌ Error: " + error.message)
    } finally {
      setIsLoading(false)
    }
  }

  if (!car) return <div className="min-h-screen flex items-center justify-center text-[#742F99]">กำลังโหลด...</div>

  return (
    <div className="min-h-screen bg-[#F8F9FD] font-sarabun flex flex-col relative pb-10">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#742F99] to-[#521d70] px-6 pt-12 pb-24 text-white relative shadow-lg overflow-hidden rounded-b-[2.5rem]">
        <div className="absolute top-[-20%] right-[-10%] opacity-10 pointer-events-none">
           <img src="/pea_logo.png" className="w-64 h-64 blur-sm" alt="bg-logo" />
        </div>
        
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6 relative z-10">
          
          {/* Logo Zone */}
          <div className="flex items-center gap-3">
             <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-md border border-white/10">
               <img src="/pea_logo.png" className="w-8 h-8 object-contain" alt="logo" />
             </div>
             <div>
               <div className="text-[10px] opacity-80 leading-none">ระบบจัดการยานพาหนะ</div>
               <div className="text-sm font-bold tracking-wide">PEA Smart Car</div>
             </div>
          </div>

          {/* ✅ Button Group (Dashboard & Print) */}
          <div className="flex gap-2">
            {/* ปุ่ม Dashboard */}
            <button 
                onClick={() => router.push('/dashboard')} 
                className="bg-white/20 hover:bg-white/30 text-white p-2.5 rounded-full shadow-lg backdrop-blur-sm transition-transform active:scale-95 flex items-center justify-center"
                title="ไปยัง Dashboard"
            >
                <span className="text-lg">📊</span>
            </button>

            {/* ปุ่ม Print */}
            <button 
                onClick={() => window.open(`/report?car_id=${car.id || ''}`, '_blank')} 
                className="bg-[#F3B236]/90 hover:bg-[#F3B236] text-white p-2.5 rounded-full shadow-lg backdrop-blur-sm transition-transform active:scale-95 flex items-center justify-center"
                title="พิมพ์เอกสาร"
            >
                <span className="text-lg">🖨️</span>
            </button>
          </div>

        </div>

        <div className="relative z-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight mb-1 drop-shadow-md">{car.plate_number}</h1>
          <p className="text-purple-200 text-sm font-light mb-4">{car.model}</p>
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border backdrop-blur-md ${car.status === 'available' ? 'bg-green-500/20 border-green-300/30' : 'bg-red-500/20 border-red-300/30'}`}>
            {car.status === 'available' ? <><span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span></span><span className="text-xs font-medium text-green-200">รถว่าง - พร้อมใช้งาน</span></> : <><span className="h-2.5 w-2.5 rounded-full bg-red-500"></span><span className="text-xs font-medium text-red-200">รถไม่ว่าง - กำลังใช้งาน</span></>}
          </div>
        </div>
      </div>

      {/* Form Area */}
      <div className="-mt-14 px-4 flex-grow relative z-20">
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 border border-gray-50">
          
          {car.status === 'available' && (
            <div className="space-y-5">
               <h2 className="text-lg font-bold text-[#742F99] border-b pb-2 flex items-center gap-2"><span>📋</span> บันทึกนำรถออก</h2>
               
               <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">รหัสพนักงาน</label>
                 <input type="text" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="กรอกรหัสพนักงาน..." className="w-full pl-4 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-gray-700 focus:bg-white focus:border-[#742F99]/30 focus:outline-none transition-all font-medium" />
                 <div className="min-h-[20px] ml-1 flex flex-col">
                    {staffName ? (
                        <>
                            <span className="text-sm text-green-600 font-bold animate-pulse">✓ คุณ{staffName}</span>
                            <span className="text-xs text-gray-500">ตำแหน่ง: {staffPosition || '-'}</span>
                        </>
                    ) : ( employeeId.length >= 4 && <span className="text-xs text-gray-400 italic">กำลังค้นหา...</span> )}
                 </div>
               </div>

               <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">เลขไมล์เริ่มต้น</label>
                 <input type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="เช่น 120500" className="w-full pl-4 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-gray-700 focus:bg-white focus:border-[#742F99]/30 focus:outline-none transition-all font-medium" />
               </div>

               <div className="space-y-2">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">สถานที่ปฏิบัติงาน</label>
                 <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="w-full pl-4 pr-10 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-gray-700 focus:bg-white focus:border-[#742F99]/30 focus:outline-none appearance-none transition-all font-medium">
                    <option value="" disabled>เลือกพื้นที่...</option>
                    <option value="พื้นที่อำเภอกำแพงแสน">พื้นที่อำเภอกำแพงแสน</option>
                    <option value="คลังพัสดุนครชัยศรี">คลังพัสดุนครชัยศรี</option>
                    <option value="สำนักงานกฟก.3">สำนักงานกฟก.3</option>
                    <option value="อื่นๆ">อื่นๆ (กรอกเอง)</option>
                 </select>
                 {selectedLocation === 'อื่นๆ' && (
                    <input type="text" value={customLocation} onChange={(e) => setCustomLocation(e.target.value)} placeholder="ระบุสถานที่..." className="w-full pl-4 pr-4 py-3 bg-purple-50 border border-purple-100 rounded-xl text-purple-700 focus:outline-none animate-fade-in-down" />
                 )}
               </div>

               <button onClick={handleTakeOut} disabled={isLoading} className="w-full bg-[#742F99] hover:bg-[#602380] text-white font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-[#742F99]/30 active:scale-[0.98] transition-all flex justify-center items-center mt-2">
                 {isLoading ? 'กำลังบันทึก...' : 'ยืนยันนำรถออก'}
               </button>
            </div>
          )}

          {car.status === 'busy' && (
            <div className="space-y-5">
               <div className="flex justify-between items-center border-b pb-2">
                 <h2 className="text-lg font-bold text-red-600 flex items-center gap-2"><span>↩️</span> บันทึกคืนรถ</h2>
                 <div className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 font-mono">
                    เวลา: {currentTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                 </div>
               </div>
               <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-sm">
                  <div className="flex justify-between mb-1"><span className="text-orange-800 font-bold">ผู้ขับ:</span><span className="text-gray-700">{activeLog?.driver_name || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-orange-800 font-bold">ไมล์เริ่ม:</span><span className="text-gray-700">{activeLog?.start_mileage?.toLocaleString()}</span></div>
               </div>
               <div className="space-y-1">
                 <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">เลขไมล์จบงาน</label>
                 <input type="number" value={endMileage} onChange={(e) => setEndMileage(e.target.value)} placeholder={`ต้องมากกว่า ${activeLog?.start_mileage || 0}`} className="w-full pl-4 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-gray-700 focus:bg-white focus:border-red-500/30 focus:outline-none transition-all font-medium" />
               </div>
               <div className="pt-2 border-t border-dashed">
                   <p className="text-xs text-gray-400 mb-2 ml-1">ข้อมูลเชื้อเพลิง (กรอกเฉพาะเมื่อมีการเติม)</p>
                   <div className="grid grid-cols-2 gap-3">
                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-gray-400 uppercase">ปริมาณ (ลิตร)</label>
                           <input type="number" value={fuelLiters} onChange={(e) => setFuelLiters(e.target.value)} placeholder="0" className="w-full pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:outline-none" />
                       </div>
                       <div className="space-y-1">
                           <label className="text-[10px] font-bold text-gray-400 uppercase">ราคา (บาท)</label>
                           <input type="number" value={fuelCost} onChange={(e) => setFuelCost(e.target.value)} placeholder="0.00" className="w-full pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:border-blue-400 focus:outline-none" />
                       </div>
                   </div>
               </div>
               <button onClick={handleReturn} disabled={isLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-lg py-3.5 rounded-xl shadow-lg shadow-red-600/30 active:scale-[0.98] transition-all flex justify-center items-center mt-2">
                 {isLoading ? 'กำลังบันทึก...' : 'ยืนยันการคืนรถ'}
               </button>
            </div>
          )}
        </div>
        <p className="text-center text-gray-400 text-xs mt-6 font-medium">PEA Vehicle System © 2024</p>
      </div>
    </div>
  )
}