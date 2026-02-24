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
        router.push('/admin/login') // ถ้ายังไม่ล็อกอิน เด้งกลับไปหน้า login
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
      setCarData({ plate_number: '', model: '', car_type: '', fuel_type: 'Gas', status: 'available' }) // Reset form
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
      setStaffData({ staff_code: '', full_name: '', position: '' }) // Reset form
    } catch (error) {
      alert('❌ เกิดข้อผิดพลาด: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loadingSession) return <div className="min-h-screen flex items-center justify-center">กำลังโหลดข้อมูล...</div>

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex font-sarabun">
      
      {/* 🟢 Sidebar Menu */}
      <div className="w-64 bg-white shadow-xl flex flex-col justify-between">
        <div>
          <div className="p-6 bg-[#742F99] text-white">
            <h2 className="text-xl font-black">Admin Panel</h2>
            <p className="text-xs text-purple-200 mt-1">PEA Fleet Management</p>
          </div>
          <div className="p-4 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 ml-2">จัดการตาราง (Tables)</p>
            
            <button 
              onClick={() => setActiveMenu('cars')}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeMenu === 'cars' ? 'bg-purple-100 text-[#742F99]' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              🚗 เพิ่มข้อมูลรถ (Cars)
            </button>
            
            <button 
              onClick={() => setActiveMenu('staff')}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeMenu === 'staff' ? 'bg-purple-100 text-[#742F99]' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              👥 เพิ่มพนักงาน (Staff)
            </button>
            
            {/* คุณสามารถเพิ่มปุ่มสำหรับตารางอื่นๆ ได้ที่นี่ */}
          </div>
        </div>
        
        <div className="p-4 border-t">
          <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all">
            🚪 ออกจากระบบ
          </button>
        </div>
      </div>

      {/* 🔵 Main Content Area */}
      <div className="flex-1 p-10 overflow-y-auto">
        <div className="max-w-3xl">
          
          {/* ฟอร์ม: เพิ่มข้อมูลรถ */}
          {activeMenu === 'cars' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-fade-in-up">
              <h3 className="text-2xl font-black text-[#742F99] border-b pb-4 mb-6">🚗 เพิ่มข้อมูลรถยนต์คันใหม่</h3>
              <form onSubmit={handleAddCar} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-600">ทะเบียนรถ</label>
                    <input type="text" required value={carData.plate_number} onChange={e => setCarData({...carData, plate_number: e.target.value})} className="w-full p-3 mt-1 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#742F99]" placeholder="เช่น 6ขฆ 6169" />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-600">ยี่ห้อ/รุ่น</label>
                    <input type="text" required value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} className="w-full p-3 mt-1 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#742F99]" placeholder="เช่น MG EP หรือ Toyota Revo" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-bold text-gray-600">ประเภทรถ (รูปแบบการแสดงผล)</label>
                    <input type="text" required value={carData.car_type} onChange={e => setCarData({...carData, car_type: e.target.value})} className="w-full p-3 mt-1 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#742F99]" placeholder="เช่น รถกระบะ, รถบรรทุก 2 ตันเเก้ไฟ" />
                  </div>
                  <div>
                    <label className="text-sm font-bold text-gray-600">ชนิดพลังงาน (Fuel Type)</label>
                    <select value={carData.fuel_type} onChange={e => setCarData({...carData, fuel_type: e.target.value})} className="w-full p-3 mt-1 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#742F99]">
                      <option value="Gas">รถน้ำมัน (Gas/Diesel)</option>
                      <option value="EV">รถไฟฟ้า (EV)</option>
                    </select>
                  </div>
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-6 bg-[#742F99] hover:bg-[#5b237a] text-white rounded-xl font-bold shadow-lg transition-all">
                  {isSubmitting ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูลรถ'}
                </button>
              </form>
            </div>
          )}

          {/* ฟอร์ม: เพิ่มข้อมูลพนักงาน */}
          {activeMenu === 'staff' && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-fade-in-up">
              <h3 className="text-2xl font-black text-[#742F99] border-b pb-4 mb-6">👥 เพิ่มข้อมูลพนักงานใหม่</h3>
              <form onSubmit={handleAddStaff} className="space-y-4">
                <div>
                  <label className="text-sm font-bold text-gray-600">รหัสพนักงาน</label>
                  <input type="text" required value={staffData.staff_code} onChange={e => setStaffData({...staffData, staff_code: e.target.value})} className="w-full p-3 mt-1 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#742F99]" placeholder="รหัสประจำตัวพนักงาน 6 หลัก..." />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600">ชื่อ-นามสกุล</label>
                  <input type="text" required value={staffData.full_name} onChange={e => setStaffData({...staffData, full_name: e.target.value})} className="w-full p-3 mt-1 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#742F99]" placeholder="เช่น สมชาย ใจดี" />
                </div>
                <div>
                  <label className="text-sm font-bold text-gray-600">ตำแหน่ง / แผนก</label>
                  <input type="text" value={staffData.position} onChange={e => setStaffData({...staffData, position: e.target.value})} className="w-full p-3 mt-1 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:border-[#742F99]" placeholder="เช่น ช่างสายอากาศ 4 แผนกก่อสร้าง" />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full py-4 mt-6 bg-[#742F99] hover:bg-[#5b237a] text-white rounded-xl font-bold shadow-lg transition-all">
                  {isSubmitting ? 'กำลังบันทึก...' : '💾 บันทึกข้อมูลพนักงาน'}
                </button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}