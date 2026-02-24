'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const router = useRouter()
  const [loadingSession, setLoadingSession] = useState(true)
  const [activeMenu, setActiveMenu] = useState('cars') // 'cars' หรือ 'staff'

  // Form State สำหรับเพิ่มรถ (Cars)
  const [carData, setCarData] = useState({ plate_number: '', model: '', car_type: '', fuel_type: 'Gas', status: 'available' })
  
  // Form State สำหรับเพิ่มพนักงาน (Staff)
  const [staffData, setStaffData] = useState({ staff_code: '', full_name: '', position: '' })

  const [isSubmitting, setIsSubmitting] = useState(false)

  // 1. ตรวจสอบว่าล็อกอินหรือยัง
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/admin/login')
      } else {
        setLoadingSession(false)
      }
    }
    checkSession()
  }, [router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // 2. ฟังก์ชันเพิ่มข้อมูลลงตาราง Cars
  const handleAddCar = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('cars').insert([carData])
      if (error) throw error
      alert('✅ เพิ่มข้อมูลรถสำเร็จ')
      setCarData({ plate_number: '', model: '', car_type: '', fuel_type: 'Gas', status: 'available' }) 
    } catch (error) {
      alert('❌ เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 3. ฟังก์ชันเพิ่มข้อมูลลงตาราง Staff
  const handleAddStaff = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from('staff').insert([staffData])
      if (error) throw error
      alert('✅ เพิ่มข้อมูลพนักงานสำเร็จ')
      setStaffData({ staff_code: '', full_name: '', position: '' }) 
    } catch (error) {
      alert('❌ เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingSession) return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#742F99] border-t-transparent rounded-full animate-spin"></div>
      <p className="mt-4 text-[#742F99] font-bold">กำลังโหลด...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#EBF0F6] font-sarabun pb-10">
      
      {/* 🟣 Header (Mobile Style) */}
      <div className="bg-gradient-to-r from-[#742F99] to-[#591d79] px-6 pt-12 pb-8 text-white rounded-b-[2.5rem] shadow-lg relative z-20">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Admin Panel</h1>
            <p className="text-purple-200 text-xs mt-1 uppercase tracking-widest font-bold">PEA Fleet Management</p>
          </div>
          <button 
            onClick={handleLogout} 
            className="bg-white/20 hover:bg-white/30 text-white p-3 rounded-xl backdrop-blur-md border border-white/20 active:scale-95 transition-all shadow-sm text-xs font-bold flex items-center gap-1"
          >
            <span>🚪</span> ออกจากระบบ
          </button>
        </div>
      </div>

      {/* 🟢 Tabs Menu */}
      <div className="px-4 mt-6 relative z-10 flex gap-3">
        <button 
          onClick={() => setActiveMenu('cars')}
          className={`flex-1 py-3.5 px-2 rounded-2xl font-bold transition-all shadow-sm text-sm flex flex-col items-center justify-center gap-1 ${
            activeMenu === 'cars' 
            ? 'bg-white text-[#742F99] border-2 border-[#742F99] scale-100 shadow-md' 
            : 'bg-white/60 text-gray-500 border-2 border-transparent hover:bg-white scale-95 opacity-80'
          }`}
        >
          <span className="text-xl">🚗</span>
          เพิ่มข้อมูลรถ
        </button>
        
        <button 
          onClick={() => setActiveMenu('staff')}
          className={`flex-1 py-3.5 px-2 rounded-2xl font-bold transition-all shadow-sm text-sm flex flex-col items-center justify-center gap-1 ${
            activeMenu === 'staff' 
            ? 'bg-white text-[#742F99] border-2 border-[#742F99] scale-100 shadow-md' 
            : 'bg-white/60 text-gray-500 border-2 border-transparent hover:bg-white scale-95 opacity-80'
          }`}
        >
          <span className="text-xl">👥</span>
          เพิ่มพนักงาน
        </button>
      </div>

      {/* 🔵 Main Content Form */}
      <div className="px-4 mt-6">
        
        {/* ================= ฟอร์ม: เพิ่มข้อมูลรถ ================= */}
        {activeMenu === 'cars' && (
          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-purple-900/5 border border-purple-50 animate-fade-in-up">
            <h3 className="text-lg font-black text-[#742F99] border-b border-purple-100 pb-3 mb-5 flex items-center gap-2">
              <span>📋</span> ฟอร์มบันทึกรถยนต์คันใหม่
            </h3>
            
            <form onSubmit={handleAddCar} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[13px] font-bold text-gray-500 ml-1">ทะเบียนรถ</label>
                <input 
                  type="text" required 
                  value={carData.plate_number} 
                  onChange={e => setCarData({...carData, plate_number: e.target.value})} 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-[#742F99] transition-colors" 
                  placeholder="เช่น 6ขฆ 6169" 
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[13px] font-bold text-gray-500 ml-1">ยี่ห้อ / รุ่น</label>
                <input 
                  type="text" required 
                  value={carData.model} 
                  onChange={e => setCarData({...carData, model: e.target.value})} 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-[#742F99] transition-colors" 
                  placeholder="เช่น MG EP หรือ Toyota Revo" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[13px] font-bold text-gray-500 ml-1">ประเภทรถ (รูปแบบการแสดงผล)</label>
                <input 
                  type="text" required 
                  value={carData.car_type} 
                  onChange={e => setCarData({...carData, car_type: e.target.value})} 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-[#742F99] transition-colors" 
                  placeholder="เช่น รถกระบะ, รถบรรทุก 2 ตันเเก้ไฟ" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[13px] font-bold text-gray-500 ml-1">ชนิดพลังงาน (Fuel Type)</label>
                <select 
                  value={carData.fuel_type} 
                  onChange={e => setCarData({...carData, fuel_type: e.target.value})} 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-[#742F99] transition-colors appearance-none"
                >
                  <option value="Gas">🛢️ รถน้ำมัน (Gas/Diesel)</option>
                  <option value="EV">⚡ รถไฟฟ้า (EV)</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full py-4 mt-4 bg-[#742F99] active:bg-[#5b237a] text-white rounded-2xl font-bold shadow-lg shadow-purple-900/20 transition-all"
              >
                {isSubmitting ? '⏳ กำลังบันทึก...' : '💾 ยืนยันเพิ่มข้อมูลรถ'}
              </button>
            </form>
          </div>
        )}

        {/* ================= ฟอร์ม: เพิ่มข้อมูลพนักงาน ================= */}
        {activeMenu === 'staff' && (
          <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-purple-900/5 border border-purple-50 animate-fade-in-up">
            <h3 className="text-lg font-black text-[#742F99] border-b border-purple-100 pb-3 mb-5 flex items-center gap-2">
              <span>📋</span> ฟอร์มบันทึกพนักงานใหม่
            </h3>
            
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[13px] font-bold text-gray-500 ml-1">รหัสพนักงาน</label>
                <input 
                  type="text" required 
                  value={staffData.staff_code} 
                  onChange={e => setStaffData({...staffData, staff_code: e.target.value})} 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-[#742F99] transition-colors" 
                  placeholder="รหัสประจำตัวพนักงาน 6 หลัก..." 
                />
              </div>
              
              <div className="space-y-1">
                <label className="text-[13px] font-bold text-gray-500 ml-1">ชื่อ-นามสกุล</label>
                <input 
                  type="text" required 
                  value={staffData.full_name} 
                  onChange={e => setStaffData({...staffData, full_name: e.target.value})} 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-[#742F99] transition-colors" 
                  placeholder="เช่น สมชาย ใจดี" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[13px] font-bold text-gray-500 ml-1">ตำแหน่ง / แผนก</label>
                <input 
                  type="text" 
                  value={staffData.position} 
                  onChange={e => setStaffData({...staffData, position: e.target.value})} 
                  className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none focus:border-[#742F99] transition-colors" 
                  placeholder="เช่น ช่างสายอากาศ 4 แผนกก่อสร้าง" 
                />
              </div>

              <button 
                type="submit" 
                disabled={isSubmitting} 
                className="w-full py-4 mt-4 bg-[#742F99] active:bg-[#5b237a] text-white rounded-2xl font-bold shadow-lg shadow-purple-900/20 transition-all"
              >
                {isSubmitting ? '⏳ กำลังบันทึก...' : '💾 ยืนยันเพิ่มข้อมูลพนักงาน'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}