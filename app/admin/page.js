'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

// ค่าเริ่มต้นของฟอร์ม
const initialCarData = { plate_number: '', model: '', car_type: '', fuel_type: 'Gas', status: 'available', budget: '', department: '', usage_type: '', ownership_type: '' }
const initialStaffData = { staff_code: '', full_name: '', position: '', department_id: '' }
const initialTaskData = { name: '', department_id: '' }
const initialDepartmentData = { name: '' }

export default function AdminDashboard() {
  const router = useRouter()
  const [loadingSession, setLoadingSession] = useState(true)
  const [activeMenu, setActiveMenu] = useState('cars')
  
  // 📱 State สำหรับเปิด/ปิด Sidebar บนมือถือ
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // ================= Form States =================
  const [carData, setCarData] = useState(initialCarData)
  const [staffData, setStaffData] = useState(initialStaffData)
  const [taskData, setTaskData] = useState(initialTaskData)
  const [departmentData, setDepartmentData] = useState(initialDepartmentData)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)

  // ================= Lists States =================
  const [carsList, setCarsList] = useState([])
  const [staffList, setStaffList] = useState([])
  const [tasksList, setTasksList] = useState([])
  const [departmentsList, setDepartmentsList] = useState([])
  
  const [departmentsOptions, setDepartmentsOptions] = useState([])
  const [isLoadingData, setIsLoadingData] = useState(false)

  // 1. ตรวจสอบ Session 
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/admin/login')
      } else {
        setLoadingSession(false)
        fetchDepartmentsOptions()
      }
    }
    checkSession()
  }, [router])

  // 2. ดึงข้อมูลตัวเลือกแผนก
  const fetchDepartmentsOptions = async () => {
    const { data, error } = await supabase.from('departments').select('id, name').order('name')
    if (!error && data) setDepartmentsOptions(data)
  }

  // 3. ดึงข้อมูลหลักตามแท็บ
  const fetchData = useCallback(async () => {
    setIsLoadingData(true)
    try {
      if (activeMenu === 'cars') {
        const { data, error } = await supabase.from('cars').select('*').order('id', { ascending: false })
        if (error) throw error; setCarsList(data || [])
      } else if (activeMenu === 'staff') {
        const { data, error } = await supabase.from('staff').select('*, departments(name)').order('id', { ascending: false })
        if (error) throw error; setStaffList(data || [])
      } else if (activeMenu === 'tasks') {
        const { data, error } = await supabase.from('tasks').select('*, departments(name)').order('created_at', { ascending: false })
        if (error) throw error; setTasksList(data || [])
      } else if (activeMenu === 'departments') {
        const { data, error } = await supabase.from('departments').select('*').order('created_at', { ascending: false })
        if (error) throw error; setDepartmentsList(data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error.message)
    } finally {
      setIsLoadingData(false)
    }
  }, [activeMenu])

  useEffect(() => {
    if (!loadingSession) {
      fetchData()
      cancelEdit()
    }
  }, [activeMenu, loadingSession, fetchData])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // ================= ยกเลิกการแก้ไข =================
  const cancelEdit = () => {
    setEditingId(null)
    setCarData(initialCarData)
    setStaffData(initialStaffData)
    setTaskData(initialTaskData)
    setDepartmentData(initialDepartmentData)
  }

  // ================= เตรียมแก้ไข (ใส่ข้อมูลลงฟอร์ม) =================
  const handleEdit = (type, data) => {
    setEditingId(data.id)
    if (type === 'cars') setCarData(data)
    if (type === 'staff') setStaffData({ ...data, department_id: data.department_id || '' })
    if (type === 'tasks') setTaskData({ ...data, department_id: data.department_id || '' })
    if (type === 'departments') setDepartmentData(data)
    
    // เลื่อนจอขึ้นไปตรงฟอร์ม
    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' })
  }

  // ================= Submit ฟอร์ม =================
  const handleSubmitCar = async (e) => {
    e.preventDefault(); setIsSubmitting(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('cars').update(carData).eq('id', editingId)
        if (error) throw error; alert('✅ แก้ไขสำเร็จ')
      } else {
        const { error } = await supabase.from('cars').insert([carData])
        if (error) throw error; alert('✅ เพิ่มข้อมูลสำเร็จ')
      }
      cancelEdit(); fetchData()
    } catch (error) { alert('❌ ' + error.message) } finally { setIsSubmitting(false) }
  }

  const handleSubmitStaff = async (e) => {
    e.preventDefault(); setIsSubmitting(true)
    try {
      const payload = { ...staffData, department_id: staffData.department_id ? parseInt(staffData.department_id) : null }
      if (editingId) {
        const { error } = await supabase.from('staff').update(payload).eq('id', editingId)
        if (error) throw error; alert('✅ แก้ไขสำเร็จ')
      } else {
        const { error } = await supabase.from('staff').insert([payload])
        if (error) throw error; alert('✅ เพิ่มข้อมูลสำเร็จ')
      }
      cancelEdit(); fetchData()
    } catch (error) { alert('❌ ' + error.message) } finally { setIsSubmitting(false) }
  }

  const handleSubmitTask = async (e) => {
    e.preventDefault(); setIsSubmitting(true)
    try {
      const payload = { ...taskData, department_id: taskData.department_id ? parseInt(taskData.department_id) : null }
      if (editingId) {
        const { error } = await supabase.from('tasks').update(payload).eq('id', editingId)
        if (error) throw error; alert('✅ แก้ไขสำเร็จ')
      } else {
        const { error } = await supabase.from('tasks').insert([payload])
        if (error) throw error; alert('✅ เพิ่มข้อมูลสำเร็จ')
      }
      cancelEdit(); fetchData()
    } catch (error) { alert('❌ ' + error.message) } finally { setIsSubmitting(false) }
  }

  const handleSubmitDepartment = async (e) => {
    e.preventDefault(); setIsSubmitting(true)
    try {
      if (editingId) {
        const { error } = await supabase.from('departments').update(departmentData).eq('id', editingId)
        if (error) throw error; alert('✅ แก้ไขสำเร็จ')
      } else {
        const { error } = await supabase.from('departments').insert([departmentData])
        if (error) throw error; alert('✅ เพิ่มข้อมูลสำเร็จ')
      }
      cancelEdit(); fetchData(); fetchDepartmentsOptions()
    } catch (error) { alert('❌ ' + error.message) } finally { setIsSubmitting(false) }
  }

  // ================= ลบข้อมูล =================
  const deleteRecord = async (table, id) => {
    if (!confirm(`⚠️ ยืนยันการลบข้อมูลนี้?`)) return
    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error; alert('🗑️ ลบข้อมูลสำเร็จ')
      fetchData()
      if (table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('❌ ' + error.message) }
  }

  if (loadingSession) return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#742F99] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )

  // เมนูทั้งหมดสำหรับ Sidebar
  const sidebarMenus = [
    { id: 'cars', icon: '🚗', title: 'จัดการรถยนต์', desc: 'ข้อมูลรถทั้งหมด' },
    { id: 'staff', icon: '👥', title: 'พนักงาน', desc: 'รายชื่อผู้ขับขี่/พนักงาน' },
    { id: 'tasks', icon: '📋', title: 'ตารางงาน', desc: 'การใช้งานรถยนต์' },
    { id: 'departments', icon: '🏢', title: 'แผนก', desc: 'จัดการสังกัด' },
  ]

  const activeMenuObj = sidebarMenus.find(m => m.id === activeMenu)

  // Style สำหรับ Input
  const inputStyle = "w-full p-3.5 bg-slate-50 text-slate-800 rounded-xl border border-slate-200 outline-none focus:border-[#742F99] focus:ring-4 focus:ring-[#742F99]/10 transition-all text-sm font-medium"
  const labelStyle = "text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider"

  return (
    <div className="flex h-screen bg-[#F1F5F9] font-sarabun overflow-hidden relative">
      
      {/* 📱 Overlay สำหรับมือถือเวลาเปิด Sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity" 
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* 👈 1. Sidebar (YouTube Style - Dark Premium & Responsive) */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-[280px] bg-[#0F0F13] text-slate-300 flex flex-col transition-transform duration-300 ease-in-out z-50 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* โลโก้ / หัว Sidebar */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-tr from-[#742F99] to-[#b04deb] rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-purple-900/50">
              PEA
            </div>
            <div>
              <h1 className="font-bold text-white tracking-wide text-lg leading-tight">Admin<span className="text-purple-400">Panel</span></h1>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Fleet System</p>
            </div>
          </div>
          {/* 📱 ปุ่มปิด Sidebar บนมือถือ */}
          <button className="lg:hidden text-slate-400 hover:text-white text-2xl" onClick={() => setIsSidebarOpen(false)}>
            &times;
          </button>
        </div>

        {/* เมนูนำทาง */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          <p className="text-[11px] font-bold text-slate-500 mb-4 px-2 uppercase tracking-widest">Main Menu</p>
          {sidebarMenus.map(menu => (
            <button 
              key={menu.id} 
              onClick={() => {
                setActiveMenu(menu.id)
                setIsSidebarOpen(false) // 📱 ปิดเมนูเมื่อกดเลือกบนมือถือ
              }}
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 text-left ${
                activeMenu === menu.id 
                ? 'bg-[#742F99]/10 text-white shadow-inner relative before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-8 before:w-1.5 before:bg-purple-500 before:rounded-r-full' 
                : 'hover:bg-white/5 hover:text-white text-slate-400'
              }`}
            >
              <span className={`text-xl ${activeMenu === menu.id ? 'text-purple-400 drop-shadow-md' : 'grayscale opacity-70'}`}>
                {menu.icon}
              </span>
              <div>
                <p className="font-bold text-sm">{menu.title}</p>
                <p className={`text-[10px] ${activeMenu === menu.id ? 'text-purple-300/80' : 'text-slate-500 hidden sm:block'}`}>{menu.desc}</p>
              </div>
            </button>
          ))}
        </nav>

        {/* ส่วนท้าย (Logout) */}
        <div className="p-4 border-t border-white/5 shrink-0">
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-red-500/10 hover:text-red-400 transition-colors text-sm font-bold">
            <span>🚪</span> ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* 👉 2. Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#F8FAFC]">
        
        {/* 🔝 Topbar */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            {/* 📱 ปุ่ม Hamburger บนมือถือ */}
            <button 
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              onClick={() => setIsSidebarOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <span className="text-2xl hidden sm:block">{activeMenuObj?.icon}</span>
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">{activeMenuObj?.title}</h2>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 px-3 sm:px-4 py-2 rounded-full border border-slate-200">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-600">Admin Online</span>
          </div>
        </header>

        {/* 📜 Content Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-10 scroll-smooth">
          <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 pb-10">

            {/* --- ส่วนที่ 1: ฟอร์มจัดการข้อมูล --- */}
            <div id="form-section" className="bg-white p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 relative overflow-hidden">
              <div className={`absolute top-0 left-0 w-full h-1.5 ${editingId ? 'bg-amber-400' : 'bg-gradient-to-r from-[#742F99] to-[#b04deb]'}`}></div>
              
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
                <h3 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2">
                  {editingId ? <span className="text-amber-500">✏️ กำลังแก้ไข (ID: {editingId})</span> : <span className="text-[#742F99]">➕ เพิ่มข้อมูลใหม่</span>}
                </h3>
                {editingId && (
                  <button onClick={cancelEdit} className="text-xs w-full sm:w-auto bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold hover:bg-slate-200 transition-colors">
                    ❌ ยกเลิกการแก้ไข
                  </button>
                )}
              </div>

              {/* ===== FORM: CARS ===== */}
              {activeMenu === 'cars' && (
                <form onSubmit={handleSubmitCar} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  <div className="sm:col-span-1 lg:col-span-1"><label className={labelStyle}>ทะเบียนรถ *</label><input type="text" required value={carData.plate_number} onChange={e => setCarData({...carData, plate_number: e.target.value})} className={inputStyle} placeholder="เช่น 6ขฆ 6169" /></div>
                  <div className="sm:col-span-1 lg:col-span-2"><label className={labelStyle}>ยี่ห้อ / รุ่น</label><input type="text" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} className={inputStyle} placeholder="MG EP, Toyota Revo" /></div>
                  
                  <div><label className={labelStyle}>ประเภทรถ (car_type)</label><input type="text" value={carData.car_type} onChange={e => setCarData({...carData, car_type: e.target.value})} className={inputStyle} placeholder="รถกระบะ, รถบรรทุก" /></div>
                  <div>
                    <label className={labelStyle}>ชนิดพลังงาน (fuel_type)</label>
                    <select value={carData.fuel_type} onChange={e => setCarData({...carData, fuel_type: e.target.value})} className={inputStyle}>
                      <option value="Gas">🛢️ Gas/Diesel</option><option value="EV">⚡ EV</option>
                    </select>
                  </div>
                  <div><label className={labelStyle}>กรรมสิทธิ์ (ownership_type)</label><input type="text" value={carData.ownership_type} onChange={e => setCarData({...carData, ownership_type: e.target.value})} className={inputStyle} placeholder="รถเช่า, รถการไฟฟ้า" /></div>
                  
                  <div><label className={labelStyle}>สังกัดแผนก (department)</label><input type="text" value={carData.department} onChange={e => setCarData({...carData, department: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>การใช้งาน (usage_type)</label><input type="text" value={carData.usage_type} onChange={e => setCarData({...carData, usage_type: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>งบประมาณ (budget)</label><input type="text" value={carData.budget} onChange={e => setCarData({...carData, budget: e.target.value})} className={inputStyle} /></div>
                  
                  <div className="sm:col-span-2 lg:col-span-3 mt-2 sm:mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className={`w-full sm:w-auto px-8 py-3.5 text-white rounded-xl font-bold shadow-lg transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-[#742F99] hover:bg-[#5e237c] shadow-purple-900/20'}`}>
                      {isSubmitting ? '⏳...' : (editingId ? '💾 บันทึกการแก้ไข' : '➕ เพิ่มรถยนต์คันใหม่')}
                    </button>
                  </div>
                </form>
              )}

              {/* ===== FORM: STAFF ===== */}
              {activeMenu === 'staff' && (
                <form onSubmit={handleSubmitStaff} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div><label className={labelStyle}>รหัสพนักงาน *</label><input type="text" required value={staffData.staff_code} onChange={e => setStaffData({...staffData, staff_code: e.target.value})} className={inputStyle} placeholder="ระบุรหัสประจำตัว" /></div>
                  <div><label className={labelStyle}>ชื่อ-นามสกุล *</label><input type="text" required value={staffData.full_name} onChange={e => setStaffData({...staffData, full_name: e.target.value})} className={inputStyle} placeholder="ชื่อ นามสกุล" /></div>
                  <div><label className={labelStyle}>ตำแหน่ง</label><input type="text" value={staffData.position} onChange={e => setStaffData({...staffData, position: e.target.value})} className={inputStyle} placeholder="เช่น ช่างสายอากาศ 4" /></div>
                  <div>
                    <label className={labelStyle}>สังกัดแผนก</label>
                    <select value={staffData.department_id} onChange={e => setStaffData({...staffData, department_id: e.target.value})} className={inputStyle}>
                      <option value="">-- ไม่ระบุ --</option>
                      {departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 mt-2 sm:mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className={`w-full sm:w-auto px-8 py-3.5 text-white rounded-xl font-bold shadow-lg transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-[#742F99] hover:bg-[#5e237c] shadow-purple-900/20'}`}>
                      {isSubmitting ? '⏳...' : (editingId ? '💾 บันทึกการแก้ไข' : '➕ เพิ่มพนักงานใหม่')}
                    </button>
                  </div>
                </form>
              )}

              {/* ===== FORM: TASKS ===== */}
              {activeMenu === 'tasks' && (
                <form onSubmit={handleSubmitTask} className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div><label className={labelStyle}>ชื่องาน / ภารกิจ *</label><input type="text" required value={taskData.name} onChange={e => setTaskData({...taskData, name: e.target.value})} className={inputStyle} placeholder="รายละเอียดงานเบื้องต้น" /></div>
                  <div>
                    <label className={labelStyle}>เชื่อมโยงแผนกรับผิดชอบ</label>
                    <select value={taskData.department_id} onChange={e => setTaskData({...taskData, department_id: e.target.value})} className={inputStyle}>
                      <option value="">-- ไม่ระบุ --</option>
                      {departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
                    </select>
                  </div>
                  <div className="sm:col-span-2 mt-2 sm:mt-4 pt-4 border-t border-slate-100 flex justify-end">
                    <button type="submit" disabled={isSubmitting} className={`w-full sm:w-auto px-8 py-3.5 text-white rounded-xl font-bold shadow-lg transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-[#742F99] hover:bg-[#5e237c] shadow-purple-900/20'}`}>
                      {isSubmitting ? '⏳...' : (editingId ? '💾 บันทึกการแก้ไข' : '➕ สร้างงานใหม่')}
                    </button>
                  </div>
                </form>
              )}

              {/* ===== FORM: DEPARTMENTS ===== */}
              {activeMenu === 'departments' && (
                <form onSubmit={handleSubmitDepartment} className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-5 items-end">
                  <div className="sm:col-span-3"><label className={labelStyle}>ชื่อแผนก *</label><input type="text" required value={departmentData.name} onChange={e => setDepartmentData({...departmentData, name: e.target.value})} className={inputStyle} placeholder="ระบุชื่อแผนก" /></div>
                  <div className="sm:col-span-1 mt-2 sm:mt-0">
                    <button type="submit" disabled={isSubmitting} className={`w-full py-3.5 text-white rounded-xl font-bold shadow-lg transition-all ${editingId ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' : 'bg-[#742F99] hover:bg-[#5e237c] shadow-purple-900/20'}`}>
                      {isSubmitting ? '⏳...' : (editingId ? '💾 บันทึก' : '➕ เพิ่มแผนก')}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* --- ส่วนที่ 2: ตารางแสดงข้อมูล --- */}
            <div className="bg-white rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 overflow-hidden">
              <div className="p-4 sm:p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="text-[11px] sm:text-sm font-black text-slate-500 uppercase tracking-widest">
                  📄 รายการข้อมูลทั้งหมด
                </h3>
                <span className="bg-[#742F99]/10 text-[#742F99] py-1 px-3 rounded-full text-[10px] sm:text-xs font-bold">
                  {activeMenu === 'cars' ? carsList.length : activeMenu === 'staff' ? staffList.length : activeMenu === 'tasks' ? tasksList.length : departmentsList.length} รายการ
                </span>
              </div>

              {/* ใช้ overflow-x-auto เพื่อให้ตารางเลื่อนซ้ายขวาได้บนมือถือ */}
              <div className="overflow-x-auto p-2 sm:p-4">
                
                {/* TABLE: CARS */}
                {activeMenu === 'cars' && (
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                    <thead><tr><th className="p-3 text-slate-400 font-bold uppercase text-xs">ทะเบียน</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">รุ่น/ประเภท</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">แผนก</th><th className="p-3 text-center text-slate-400 font-bold uppercase text-xs rounded-tr-xl w-24">จัดการ</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {carsList.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 rounded-xl transition-colors lg:group">
                          <td className="p-3 font-bold text-[#742F99]">{item.plate_number}</td>
                          <td className="p-3"><p className="text-slate-800 font-medium">{item.model}</p><p className="text-xs text-slate-500">{item.car_type}</p></td>
                          <td className="p-3 text-slate-600">{item.department || '-'}</td>
                          <td className="p-3 flex justify-center gap-1 opacity-100 lg:opacity-50 lg:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit('cars', item)} className="p-2 bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-700 rounded-lg">✏️</button>
                            <button onClick={() => deleteRecord('cars', item.id)} className="p-2 bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-700 rounded-lg">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* TABLE: STAFF */}
                {activeMenu === 'staff' && (
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
                    <thead><tr><th className="p-3 text-slate-400 font-bold uppercase text-xs">รหัส</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">ชื่อ-นามสกุล</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">ตำแหน่ง</th><th className="p-3 text-slate-400 font-bold uppercase text-xs">แผนก</th><th className="p-3 text-center text-slate-400 font-bold uppercase text-xs w-24">จัดการ</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">
                      {staffList.map(item => (
                        <tr key={item.id} className="hover:bg-slate-50 lg:group">
                          <td className="p-3 font-bold text-slate-600">{item.staff_code}</td><td className="p-3 font-medium text-slate-800">{item.full_name}</td><td className="p-3 text-slate-500">{item.position || '-'}</td><td className="p-3 text-[#742F99] font-medium bg-[#742F99]/5 rounded-lg inline-block mt-1">{item.departments?.name || '-'}</td>
                          <td className="p-3"><div className="flex justify-center gap-1 opacity-100 lg:opacity-50 lg:group-hover:opacity-100 transition-opacity"><button onClick={() => handleEdit('staff', item)} className="p-2 bg-slate-100 hover:bg-amber-100 rounded-lg">✏️</button><button onClick={() => deleteRecord('staff', item.id)} className="p-2 bg-slate-100 hover:bg-red-100 rounded-lg">🗑️</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* TABLE: TASKS & DEPARTMENTS */}
                {(activeMenu === 'tasks' || activeMenu === 'departments') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-2 sm:p-0">
                    {(activeMenu === 'tasks' ? tasksList : departmentsList).map(item => (
                      <div key={item.id} className="p-4 sm:p-5 border border-slate-100 rounded-2xl hover:shadow-md hover:border-[#742F99]/30 transition-all bg-white lg:group flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ID: {item.id}</span>
                            <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleEdit(activeMenu, item)} className="p-1.5 text-slate-400 hover:text-amber-500 bg-slate-50 hover:bg-amber-50 rounded">✏️</button>
                              <button onClick={() => deleteRecord(activeMenu, item.id)} className="p-1.5 text-slate-400 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded">🗑️</button>
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