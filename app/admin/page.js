'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

const initialCarData = { plate_number: '', model: '', car_type: '', fuel_type: 'Gas', status: 'available', budget: '', department: '', usage_type: '', ownership_type: '' }
const initialStaffData = { staff_code: '', full_name: '', position: '', department_id: '' }
const initialTaskData = { name: '', department_id: '' }
const initialDepartmentData = { name: '' }

// ชื่อฟิลด์ภาษาไทยสำหรับแสดงในหน้าต่างเปรียบเทียบ
const fieldLabels = {
  plate_number: 'ทะเบียนรถ', model: 'ยี่ห้อ/รุ่น', car_type: 'ประเภทรถ', fuel_type: 'ชนิดพลังงาน', 
  budget: 'งบประมาณ', department: 'สังกัด(ข้อความ)', usage_type: 'การใช้งาน', ownership_type: 'กรรมสิทธิ์',
  staff_code: 'รหัสพนักงาน', full_name: 'ชื่อ-นามสกุล', position: 'ตำแหน่ง', department_id: 'ID แผนก',
  name: 'ชื่อ/รายละเอียด'
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loadingSession, setLoadingSession] = useState(true)
  const [activeMenu, setActiveMenu] = useState('cars')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [carData, setCarData] = useState(initialCarData)
  const [staffData, setStaffData] = useState(initialStaffData)
  const [taskData, setTaskData] = useState(initialTaskData)
  const [departmentData, setDepartmentData] = useState(initialDepartmentData)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [carsList, setCarsList] = useState([])
  const [staffList, setStaffList] = useState([])
  const [tasksList, setTasksList] = useState([])
  const [departmentsList, setDepartmentsList] = useState([])
  const [departmentsOptions, setDepartmentsOptions] = useState([])

  // ================= State สำหรับ Modal ยืนยัน =================
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, table: '', data: null })
  const [updateModal, setUpdateModal] = useState({ isOpen: false, table: '', oldData: null, newData: null })

  // 1. ตรวจสอบ Session 
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.push('/admin/login')
      else { setLoadingSession(false); fetchDepartmentsOptions() }
    }
    checkSession()
  }, [router])

  const fetchDepartmentsOptions = async () => {
    const { data, error } = await supabase.from('departments').select('id, name').order('name')
    if (!error && data) setDepartmentsOptions(data)
  }

  const fetchData = useCallback(async () => {
    try {
      if (activeMenu === 'cars') {
        const { data } = await supabase.from('cars').select('*').order('id', { ascending: false })
        setCarsList(data || [])
      } else if (activeMenu === 'staff') {
        const { data } = await supabase.from('staff').select('*, departments(name)').order('id', { ascending: false })
        setStaffList(data || [])
      } else if (activeMenu === 'tasks') {
        const { data } = await supabase.from('tasks').select('*, departments(name)').order('created_at', { ascending: false })
        setTasksList(data || [])
      } else if (activeMenu === 'departments') {
        const { data } = await supabase.from('departments').select('*').order('created_at', { ascending: false })
        setDepartmentsList(data || [])
      }
    } catch (error) { console.error('Error:', error.message) }
  }, [activeMenu])

  useEffect(() => {
    if (!loadingSession) { fetchData(); cancelEdit() }
  }, [activeMenu, loadingSession, fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setCarData(initialCarData); setStaffData(initialStaffData)
    setTaskData(initialTaskData); setDepartmentData(initialDepartmentData)
  }

  // ================= 🛠️ 1. เตรียมข้อมูลลงฟอร์ม (ลบข้อมูล Join ออก "ทุกตาราง" อัตโนมัติ) =================
  const handleEdit = (type, data) => {
    setEditingId(data.id)
    
    // 🛡️ ป้องกันแบบ Dynamic: คัดกรองเอาเฉพาะข้อมูลพื้นฐาน (Primitive Types) ตัดข้อมูลที่เป็น Object/Array ทิ้งทั้งหมด
    const cleanData = {}
    Object.keys(data).forEach(key => {
      if (typeof data[key] !== 'object' || data[key] === null) {
        cleanData[key] = data[key]
      }
    })

    if (type === 'cars') setCarData(cleanData)
    if (type === 'staff') setStaffData({ ...cleanData, department_id: cleanData.department_id || '' })
    if (type === 'tasks') setTaskData({ ...cleanData, department_id: cleanData.department_id || '' })
    if (type === 'departments') setDepartmentData(cleanData)
    
    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' })
  }

  // ================= 🛠️ 2. ตรวจสอบก่อนบันทึก (เปิด Modal และเคลียร์ข้อมูลขยะ) =================
  const handlePreSubmit = (e, table, currentFormState) => {
    e.preventDefault()
    
    // 🛡️ กรองข้อมูลฟอร์มก่อนนำไปเปรียบเทียบหรืออัปเดต ไม่ส่ง id หรือ created_at กลับไปอัปเดตทับ
    const payload = { ...currentFormState }
    delete payload.id
    delete payload.created_at

    if (payload.department_id !== undefined) {
      payload.department_id = payload.department_id ? parseInt(payload.department_id) : null
    }

    if (editingId) {
      // ดึงข้อมูลเก่ามาเปรียบเทียบ
      let oldData = null;
      if (table === 'cars') oldData = carsList.find(item => item.id === editingId)
      if (table === 'staff') oldData = staffList.find(item => item.id === editingId)
      if (table === 'tasks') oldData = tasksList.find(item => item.id === editingId)
      if (table === 'departments') oldData = departmentsList.find(item => item.id === editingId)
      
      // 🛡️ กรองข้อมูลเก่าแบบ Dynamic เพื่อลบพวก Object ที่ไป Join เผื่อมาทิ้งให้หมดเช่นกัน
      const cleanOldData = {}
      if (oldData) {
        Object.keys(oldData).forEach(key => {
          if (typeof oldData[key] !== 'object' || oldData[key] === null) {
            cleanOldData[key] = oldData[key]
          }
        })
      }
      
      setUpdateModal({ isOpen: true, table, oldData: cleanOldData, newData: payload })
    } else {
      executeInsert(table, payload)
    }
  }

  // ================= 💾 ฟังก์ชันบันทึกข้อมูล =================
  const executeInsert = async (table, payload) => {
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from(table).insert([payload])
      if (error) throw error; 
      alert('✅ เพิ่มข้อมูลสำเร็จ')
      cancelEdit(); fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('❌ เกิดข้อผิดพลาด: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const executeUpdate = async () => {
    setIsSubmitting(true)
    const { table, newData } = updateModal
    try {
      // 🔧 อัปเดต: เติม .select() เพื่อดักจับ Silent Failure
      const { data, error } = await supabase.from(table).update(newData).eq('id', editingId).select()
      
      if (error) throw error; 
      if (!data || data.length === 0) throw new Error('บันทึกไม่สำเร็จ (อาจติดสิทธิ์ RLS หรือหาข้อมูลไม่พบ)');

      alert('✅ แก้ไขข้อมูลสำเร็จ')
      setUpdateModal({ isOpen: false, table: '', oldData: null, newData: null })
      cancelEdit(); fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { 
      alert('❌ เกิดข้อผิดพลาด: ' + error.message) 
    } finally { 
      setIsSubmitting(false) 
    }
  }

  // ================= 🗑️ ฟังก์ชันลบข้อมูล =================
  const confirmDelete = (table, itemData) => {
    // เปลี่ยนชื่อตัวแปรกันงงเวลาส่งเข้า state
    setDeleteModal({ isOpen: true, table, data: itemData })
  }

  const executeDelete = async () => {
    setIsSubmitting(true)
    const { table, data: itemToDelete } = deleteModal
    try {
      // 🔧 อัปเดต: เติม .select() เพื่อดักจับ Silent Failure ตอนลบ
      const { data, error } = await supabase.from(table).delete().eq('id', itemToDelete.id).select()
      
      if (error) throw error; 
      if (!data || data.length === 0) throw new Error('ลบข้อมูลไม่สำเร็จ (อาจติดสิทธิ์ RLS หรือไม่มีข้อมูลนี้อยู่)');

      alert('🗑️ ลบข้อมูลสำเร็จ')
      setDeleteModal({ isOpen: false, table: '', data: null })
      fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { 
      alert('❌ ลบข้อมูลไม่สำเร็จ: ' + error.message) 
    } finally { 
      setIsSubmitting(false) 
    }
  }


  if (loadingSession) return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#742F99] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  const sidebarMenus = [
    { id: 'cars', icon: '🚗', title: 'จัดการรถยนต์', desc: 'ข้อมูลรถทั้งหมด' },
    { id: 'staff', icon: '👥', title: 'พนักงาน', desc: 'รายชื่อผู้ขับขี่/พนักงาน' },
    { id: 'tasks', icon: '📋', title: 'ตารางงาน', desc: 'การใช้งานรถยนต์' },
    { id: 'departments', icon: '🏢', title: 'แผนก', desc: 'จัดการสังกัด' },
  ]
  const activeMenuObj = sidebarMenus.find(m => m.id === activeMenu)
  const inputStyle = "w-full p-3.5 bg-slate-50 text-slate-800 rounded-xl border border-slate-200 outline-none focus:border-[#742F99] focus:ring-4 focus:ring-[#742F99]/10 transition-all text-sm font-medium"
  const labelStyle = "text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider"

  return (
    <div className="flex h-screen bg-[#F1F5F9] font-sarabun overflow-hidden relative">
      
      {/* 🔴 Modal: ยืนยันการลบข้อมูล */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl scale-100 transition-transform">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
            <h3 className="text-xl font-black text-center text-slate-800 mb-2">ยืนยันการลบข้อมูล?</h3>
            <p className="text-center text-slate-500 text-sm mb-6">คุณกำลังจะลบข้อมูลนี้ การกระทำนี้ไม่สามารถกู้คืนได้</p>
            
            <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl mb-6 text-sm text-center">
              <p className="font-bold text-slate-700">
                {deleteModal.data.plate_number || deleteModal.data.full_name || deleteModal.data.name}
              </p>
              <p className="text-xs text-slate-400 mt-1">ID: {deleteModal.data.id}</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ isOpen: false, table: '', data: null })} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">ยกเลิก</button>
              <button onClick={executeDelete} disabled={isSubmitting} className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-500/30">
                {isSubmitting ? 'กำลังลบ...' : 'ลบข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟡 Modal: ยืนยันการแก้ไขข้อมูล (เปรียบเทียบ) */}
      {updateModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center text-xl">📝</div>
              <h3 className="text-xl font-black text-slate-800">ยืนยันการเปลี่ยนแปลงข้อมูล</h3>
            </div>
            <p className="text-slate-500 text-sm mb-4">โปรดตรวจสอบข้อมูลที่มีการแก้ไขก่อนกดยืนยัน</p>
            
            <div className="overflow-y-auto flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3 mb-6">
              {Object.keys(updateModal.newData).map(key => {
                // ข้ามฟิลด์ id, created_at, หรือฟิลด์ที่ไม่ได้เปลี่ยนแปลง
                if (key === 'id' || key === 'created_at' || updateModal.oldData[key] === updateModal.newData[key]) return null;
                return (
                  <div key={key} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <div className="sm:w-1/3 text-xs font-bold text-slate-400 uppercase tracking-wider">{fieldLabels[key] || key}</div>
                    <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-2 text-sm">
                      <span className="bg-red-50 text-red-500 px-2 py-1 rounded-md line-through break-all w-full sm:w-auto">{updateModal.oldData[key] || '-'}</span>
                      <span className="hidden sm:inline text-slate-300">➡️</span>
                      <span className="bg-green-50 text-green-600 px-2 py-1 rounded-md font-bold break-all w-full sm:w-auto">{updateModal.newData[key] || '-'}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-3 mt-auto shrink-0">
              <button onClick={() => setUpdateModal({ isOpen: false, table: '', oldData: null, newData: null })} className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors">ย้อนกลับไปแก้ไข</button>
              <button onClick={executeUpdate} disabled={isSubmitting} className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-500/30">
                {isSubmitting ? 'กำลังบันทึก...' : '💾 ยืนยันการอัปเดต'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 Overlay มือถือ */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* 👈 Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-[280px] bg-[#0F0F13] text-slate-300 flex flex-col transition-transform duration-300 z-50 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-tr from-[#742F99] to-[#b04deb] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-900/50">PEA</div>
            <div>
              <h1 className="font-bold text-white text-lg leading-tight">Admin<span className="text-purple-400">Panel</span></h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Fleet System</p>
            </div>
          </div>
          <button className="lg:hidden text-slate-400 text-2xl" onClick={() => setIsSidebarOpen(false)}>&times;</button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          <p className="text-[11px] font-bold text-slate-500 mb-4 px-2 uppercase tracking-widest">Main Menu</p>
          {sidebarMenus.map(menu => (
            <button 
              key={menu.id} 
              onClick={() => { setActiveMenu(menu.id); setIsSidebarOpen(false) }}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all text-left ${activeMenu === menu.id ? 'bg-[#742F99]/10 text-white shadow-inner relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-1.5 before:bg-purple-500 before:rounded-r-full' : 'hover:bg-white/5 text-slate-400'}`}
            >
              <span className={`text-xl ${activeMenu === menu.id ? 'text-purple-400 drop-shadow-md' : 'grayscale opacity-70'}`}>{menu.icon}</span>
              <div>
                <p className="font-bold text-sm">{menu.title}</p>
                <p className={`text-[10px] ${activeMenu === menu.id ? 'text-purple-300/80' : 'text-slate-500 hidden sm:block'}`}>{menu.desc}</p>
              </div>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 shrink-0">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm font-bold"><span>🚪</span> ออกจากระบบ</button>
        </div>
      </aside>

      {/* 👉 Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFC]">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg" onClick={() => setIsSidebarOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
            <span className="text-2xl hidden sm:block">{activeMenuObj?.icon}</span>
            <h2 className="text-lg sm:text-xl font-black text-slate-800">{activeMenuObj?.title}</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 px-3 sm:px-4 py-2 rounded-full border border-slate-200">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-[10px] sm:text-xs font-bold text-slate-600">Admin Online</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 scroll-smooth">
          <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-10">

            {/* --- ส่วนที่ 1: ฟอร์ม --- */}
            <div id="form-section" className="bg-white p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1.5 ${editingId ? 'bg-amber-400' : 'bg-gradient-to-r from-[#742F99] to-[#b04deb]'}`}></div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
                <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                  {editingId ? <span className="text-amber-500">✏️ กำลังแก้ไข (ID: {editingId})</span> : <span className="text-[#742F99]">➕ เพิ่มข้อมูลใหม่</span>}
                </h3>
                {editingId && <button onClick={cancelEdit} className="text-xs w-full sm:w-auto bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-200">❌ ยกเลิก</button>}
              </div>

              {activeMenu === 'cars' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'cars', carData)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  <div className="sm:col-span-1 lg:col-span-1"><label className={labelStyle}>ทะเบียนรถ *</label><input type="text" required value={carData.plate_number} onChange={e => setCarData({...carData, plate_number: e.target.value})} className={inputStyle} /></div>
                  <div className="sm:col-span-1 lg:col-span-2"><label className={labelStyle}>ยี่ห้อ / รุ่น</label><input type="text" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ประเภทรถ (car_type)</label><input type="text" value={carData.car_type} onChange={e => setCarData({...carData, car_type: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ชนิดพลังงาน (fuel_type)</label><select value={carData.fuel_type} onChange={e => setCarData({...carData, fuel_type: e.target.value})} className={inputStyle}><option value="Gas">🛢️ Gas/Diesel</option><option value="EV">⚡ EV</option></select></div>
                  <div><label className={labelStyle}>กรรมสิทธิ์ (ownership_type)</label><input type="text" value={carData.ownership_type} onChange={e => setCarData({...carData, ownership_type: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>สังกัดแผนก (department)</label><input type="text" value={carData.department} onChange={e => setCarData({...carData, department: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>การใช้งาน (usage_type)</label><input type="text" value={carData.usage_type} onChange={e => setCarData({...carData, usage_type: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>งบประมาณ (budget)</label><input type="text" value={carData.budget} onChange={e => setCarData({...carData, budget: e.target.value})} className={inputStyle} /></div>
                  <div className="sm:col-span-2 lg:col-span-3 mt-2 sm:mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button type="submit" className={`w-full sm:w-auto px-8 py-3.5 text-white rounded-xl font-bold shadow-lg transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#742F99] hover:bg-[#5e237c]'}`}>{editingId ? 'ตรวจสอบการแก้ไข' : '➕ เพิ่มรถยนต์คันใหม่'}</button>
                  </div>
                </form>
              )}

              {activeMenu === 'staff' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'staff', staffData)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div><label className={labelStyle}>รหัสพนักงาน *</label><input type="text" required value={staffData.staff_code} onChange={e => setStaffData({...staffData, staff_code: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ชื่อ-นามสกุล *</label><input type="text" required value={staffData.full_name} onChange={e => setStaffData({...staffData, full_name: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ตำแหน่ง</label><input type="text" value={staffData.position} onChange={e => setStaffData({...staffData, position: e.target.value})} className={inputStyle} /></div>
                  <div>
                    <label className={labelStyle}>สังกัดแผนก</label>
                    <select value={staffData.department_id} onChange={e => setStaffData({...staffData, department_id: e.target.value})} className={inputStyle}><option value="">-- ไม่ระบุ --</option>{departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select>
                  </div>
                  <div className="sm:col-span-2 mt-2 sm:mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button type="submit" className={`w-full sm:w-auto px-8 py-3.5 text-white rounded-xl font-bold shadow-lg transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#742F99] hover:bg-[#5e237c]'}`}>{editingId ? 'ตรวจสอบการแก้ไข' : '➕ เพิ่มพนักงานใหม่'}</button>
                  </div>
                </form>
              )}

              {activeMenu === 'tasks' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'tasks', taskData)} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div><label className={labelStyle}>ชื่องาน / ภารกิจ *</label><input type="text" required value={taskData.name} onChange={e => setTaskData({...taskData, name: e.target.value})} className={inputStyle} /></div>
                  <div>
                    <label className={labelStyle}>เชื่อมโยงแผนก</label>
                    <select value={taskData.department_id} onChange={e => setTaskData({...taskData, department_id: e.target.value})} className={inputStyle}><option value="">-- ไม่ระบุ --</option>{departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select>
                  </div>
                  <div className="sm:col-span-2 mt-2 sm:mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button type="submit" className={`w-full sm:w-auto px-8 py-3.5 text-white rounded-xl font-bold shadow-lg transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#742F99] hover:bg-[#5e237c]'}`}>{editingId ? 'ตรวจสอบการแก้ไข' : '➕ สร้างงานใหม่'}</button>
                  </div>
                </form>
              )}

              {activeMenu === 'departments' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'departments', departmentData)} className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-5 items-end">
                  <div className="sm:col-span-3"><label className={labelStyle}>ชื่อแผนก *</label><input type="text" required value={departmentData.name} onChange={e => setDepartmentData({...departmentData, name: e.target.value})} className={inputStyle} /></div>
                  <div className="sm:col-span-1 mt-2 sm:mt-0">
                    <button type="submit" className={`w-full py-3.5 text-white rounded-xl font-bold shadow-lg transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#742F99] hover:bg-[#5e237c]'}`}>{editingId ? 'ตรวจสอบการแก้ไข' : '➕ เพิ่มแผนก'}</button>
                  </div>
                </form>
              )}
            </div>

            {/* --- ส่วนที่ 2: ตาราง --- */}
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-[11px] sm:text-sm font-black text-slate-500 uppercase tracking-widest">📄 รายการข้อมูล</h3>
                <span className="bg-[#742F99]/10 text-[#742F99] py-1 px-3 rounded-full text-[10px] sm:text-xs font-bold">{activeMenu === 'cars' ? carsList.length : activeMenu === 'staff' ? staffList.length : activeMenu === 'tasks' ? tasksList.length : departmentsList.length} รายการ</span>
              </div>

              <div className="overflow-x-auto p-2 sm:p-4">
                {activeMenu === 'cars' && (
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                    <thead><tr><th className="p-3 text-slate-400 font-bold uppercase text-xs">ทะเบียน</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">รุ่น/ประเภท</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">แผนก</th><th className="p-3 text-center text-slate-400 font-bold uppercase text-xs w-24">จัดการ</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {carsList.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 lg:group">
                          <td className="p-3 font-bold text-[#742F99]">{item.plate_number}</td><td className="p-3"><p className="text-slate-800 font-medium">{item.model}</p><p className="text-xs text-slate-500">{item.car_type}</p></td><td className="p-3 text-slate-600">{item.department || '-'}</td>
                          <td className="p-3 flex justify-center gap-1 opacity-100 lg:opacity-50 lg:group-hover:opacity-100"><button onClick={() => handleEdit('cars', item)} className="p-2 bg-slate-100 hover:bg-amber-100 rounded-lg">✏️</button><button onClick={() => confirmDelete('cars', item)} className="p-2 bg-slate-100 hover:bg-red-100 rounded-lg">🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeMenu === 'staff' && (
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                    <thead><tr><th className="p-3 text-slate-400 font-bold uppercase text-xs">รหัส</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">ชื่อ-นามสกุล</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">ตำแหน่ง</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">แผนก</th><th className="p-3 text-center text-slate-400 font-bold uppercase text-xs w-24">จัดการ</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {staffList.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 lg:group">
                          <td className="p-3 font-bold text-slate-600">{item.staff_code}</td><td className="p-3 font-medium text-slate-800">{item.full_name}</td><td className="p-3 text-slate-500">{item.position || '-'}</td><td className="p-3 text-[#742F99] font-medium bg-[#742F99]/5 rounded-lg inline-block mt-1">{item.departments?.name || '-'}</td>
                          <td className="p-3 flex justify-center gap-1 opacity-100 lg:opacity-50 lg:group-hover:opacity-100"><button onClick={() => handleEdit('staff', item)} className="p-2 bg-slate-100 hover:bg-amber-100 rounded-lg">✏️</button><button onClick={() => confirmDelete('staff', item)} className="p-2 bg-slate-100 hover:bg-red-100 rounded-lg">🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {(activeMenu === 'tasks' || activeMenu === 'departments') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-2 sm:p-0">
                    {(activeMenu === 'tasks' ? tasksList : departmentsList).map(item => (
                      <div key={item.id} className="p-4 sm:p-5 border border-slate-100 rounded-2xl hover:shadow-md hover:border-[#742F99]/30 transition-all bg-white lg:group flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID: {item.id}</span>
                            <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(activeMenu, item)} className="p-1.5 text-slate-400 hover:text-amber-500 bg-slate-50 hover:bg-amber-50 rounded">✏️</button>
                              <button onClick={() => confirmDelete(activeMenu, item)} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded">🗑️</button>
                            </div>
                          </div>
                          <p className={`font-black text-base sm:text-lg ${activeMenu === 'departments' ? 'text-[#742F99]' : 'text-slate-800'}`}>{item.name}</p>
                          {activeMenu === 'tasks' && <p className="text-[11px] sm:text-xs text-slate-500 mt-2 font-medium bg-slate-100 inline-block px-2 py-1 rounded-md">🏢 {item.departments?.name || 'ไม่ระบุแผนก'}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}