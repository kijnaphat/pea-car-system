'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

// เพิ่ม is_visible เข้าไปใน initial data (ค่าเริ่มต้นให้แสดงผล)
const initialCarData = { plate_number: '', model: '', car_type: '', fuel_type: 'Gas', status: 'available', budget: '', department: '', usage_type: '', ownership_type: '', is_visible: true }
const initialStaffData = { staff_code: '', full_name: '', position: '', department_id: '' }
const initialTaskData = { name: '', department_id: '' }
const initialDepartmentData = { name: '' }
const initialOperationAreaData = { name: '' }

const fieldLabels = {
  plate_number: 'ป้ายทะเบียน', model: 'ยี่ห้อ/รุ่น', car_type: 'ประเภทรถ', fuel_type: 'ประเภทพลังงาน', 
  budget: 'งบประมาณจัดหา', department: 'สังกัด', usage_type: 'ลักษณะการใช้งาน', ownership_type: 'กรรมสิทธิ์',
  staff_code: 'รหัสพนักงาน', full_name: 'ชื่อ-นามสกุล', position: 'ตำแหน่ง', department_id: 'รหัสแผนก',
  name: 'ชื่อรายการ (แผนก/สถานที่/งาน)' 
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
  const [operationAreaData, setOperationAreaData] = useState(initialOperationAreaData)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [carsList, setCarsList] = useState([])
  const [staffList, setStaffList] = useState([])
  const [tasksList, setTasksList] = useState([])
  const [departmentsList, setDepartmentsList] = useState([])
  const [operationAreasList, setOperationAreasList] = useState([])
  const [departmentsOptions, setDepartmentsOptions] = useState([])

  const [deleteModal, setDeleteModal] = useState({ isOpen: false, table: '', data: null })
  const [updateModal, setUpdateModal] = useState({ isOpen: false, table: '', oldData: null, newData: null })

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
      } else if (activeMenu === 'operation_areas') {
        const { data } = await supabase.from('operation_areas').select('*').order('created_at', { ascending: false })
        setOperationAreasList(data || [])
      }
    } catch (error) { console.error('Error:', error.message) }
  }, [activeMenu])

  useEffect(() => {
    if (!loadingSession) { fetchData(); cancelEdit() }
  }, [activeMenu, loadingSession, fetchData])

  const handleLogout = async () => {
    if(confirm('ยืนยันการออกจากระบบ PEA Smart Fleet?')) {
        await supabase.auth.signOut()
        router.push('/') 
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setCarData(initialCarData); setStaffData(initialStaffData)
    setTaskData(initialTaskData); setDepartmentData(initialDepartmentData)
    setOperationAreaData(initialOperationAreaData)
  }

  const handleEdit = (type, data) => {
    setEditingId(data.id)
    const cleanData = { ...data }
    delete cleanData.departments 

    if (type === 'cars') setCarData(cleanData)
    if (type === 'staff') setStaffData({ ...cleanData, department_id: cleanData.department_id || '' })
    if (type === 'tasks') setTaskData({ ...cleanData, department_id: cleanData.department_id || '' })
    if (type === 'departments') setDepartmentData(cleanData)
    if (type === 'operation_areas') setOperationAreaData(cleanData)
    
    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' })
  }

  // 📍 ฟังก์ชันใหม่สำหรับสลับสวิตช์ เปิด-ปิด การแสดงผล
  const toggleCarVisibility = async (carId, currentStatus) => {
    // มองว่าถ้าค่าเป็น null/undefined ให้ถือว่าเป็น true (มองเห็น) ไว้ก่อน
    const isCurrentlyVisible = currentStatus !== false; 
    const newStatus = !isCurrentlyVisible;

    // อัปเดต State ทันทีเพื่อให้ UI เปลี่ยนไว ไม่ต้องรอโหลด
    setCarsList(prev => prev.map(car => car.id === carId ? { ...car, is_visible: newStatus } : car))

    try {
      const { error } = await supabase.from('cars').update({ is_visible: newStatus }).eq('id', carId)
      if (error) throw error;
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + error.message)
      // ถ้า Error ให้ Revert state กลับ
      setCarsList(prev => prev.map(car => car.id === carId ? { ...car, is_visible: isCurrentlyVisible } : car))
    }
  }

  const handlePreSubmit = (e, table, currentFormState) => {
    e.preventDefault()
    const payload = { ...currentFormState }
    delete payload.id; delete payload.created_at; delete payload.departments 

    if (payload.department_id !== undefined) {
      payload.department_id = payload.department_id ? parseInt(payload.department_id) : null
    }

    if (editingId) {
      let oldData = null;
      if (table === 'cars') oldData = carsList.find(item => item.id === editingId)
      if (table === 'staff') oldData = staffList.find(item => item.id === editingId)
      if (table === 'tasks') oldData = tasksList.find(item => item.id === editingId)
      if (table === 'departments') oldData = departmentsList.find(item => item.id === editingId)
      if (table === 'operation_areas') oldData = operationAreasList.find(item => item.id === editingId)
      
      const cleanOldData = { ...oldData }; delete cleanOldData.departments 
      setUpdateModal({ isOpen: true, table, oldData: cleanOldData, newData: payload })
    } else {
      executeInsert(table, payload)
    }
  }

  const executeInsert = async (table, payload) => {
    setIsSubmitting(true)
    try {
      const { error } = await supabase.from(table).insert([payload])
      if (error) throw error; 
      alert('บันทึกข้อมูลเข้าสู่ระบบสำเร็จ')
      cancelEdit(); fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const executeUpdate = async () => {
    setIsSubmitting(true)
    const { table, newData } = updateModal
    try {
      const { data, error } = await supabase.from(table).update(newData).eq('id', editingId).select()
      if (error) throw error; 
      if (!data || data.length === 0) throw new Error('ไม่พบข้อมูลที่ต้องการแก้ไข');
      alert('อัปเดตข้อมูลสำเร็จ')
      setUpdateModal({ isOpen: false, table: '', oldData: null, newData: null })
      cancelEdit(); fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('เกิดข้อผิดพลาดในการอัปเดต: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const confirmDelete = (table, itemData) => setDeleteModal({ isOpen: true, table, data: itemData })

  const executeDelete = async () => {
    setIsSubmitting(true)
    const { table, data: itemToDelete } = deleteModal
    try {
      const { data, error } = await supabase.from(table).delete().eq('id', itemToDelete.id).select()
      if (error) throw error; 
      if (!data || data.length === 0) throw new Error('ไม่สามารถลบข้อมูลได้');
      alert('ลบข้อมูลออกจากระบบเรียบร้อยแล้ว')
      setDeleteModal({ isOpen: false, table: '', data: null })
      fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message) } finally { setIsSubmitting(false) }
  }

  if (loadingSession) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden">
      <div className="absolute w-96 h-96 bg-[#5C2D91] rounded-full blur-[100px] opacity-20 animate-pulse"></div>
      <div className="text-center z-10 flex flex-col items-center">
        <div className="w-20 h-20 border-4 border-[#ECA10D]/30 border-t-[#ECA10D] rounded-full animate-spin mb-6"></div>
        <h1 className="text-2xl font-black text-[#5C2D91] tracking-tight">PEA Smart Fleet</h1>
        <p className="text-sm font-medium text-gray-500 mt-2 tracking-widest uppercase">Initializing System...</p>
      </div>
    </div>
  )

  const sidebarMenus = [
    { id: 'cars', icon: '🚙', title: 'ยานพาหนะ', desc: 'ข้อมูลรถยนต์ในระบบ' },
    { id: 'staff', icon: '👨‍💼', title: 'บุคลากร', desc: 'ข้อมูลพนักงานขับรถ' },
    { id: 'tasks', icon: '📋', title: 'ตารางงาน', desc: 'จัดการเส้นทางปฏิบัติงาน' },
    { id: 'departments', icon: '🏢', title: 'แผนก/สังกัด', desc: 'โครงสร้างหน่วยงาน' },
    { id: 'operation_areas', icon: '📍', title: 'พื้นที่ปฏิบัติการ', desc: 'จุดดำเนินงาน' },
  ]
  const activeMenuObj = sidebarMenus.find(m => m.id === activeMenu)
  
  const inputStyle = "w-full rounded-2xl border-none bg-gray-100/80 px-5 py-3.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#5C2D91]/40 focus:bg-white transition-all shadow-inner"
  const labelStyle = "text-[12px] font-bold text-gray-500 mb-2 block uppercase tracking-wider pl-1"

  return (
    <div className="flex h-screen bg-[#F4F5F8] font-sans overflow-hidden p-2 sm:p-4 gap-4">
      
      {/* 🔴 Delete Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl text-center transform transition-all border border-gray-100">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-8 h-8"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">ลบข้อมูลรายการนี้?</h3>
            <p className="text-gray-500 text-sm mb-6">ข้อมูลจะถูกลบออกจากฐานข้อมูลและไม่สามารถกู้คืนได้</p>
            <div className="bg-gray-50 text-gray-700 p-4 rounded-2xl mb-8 border border-gray-100 font-semibold break-words">
              {deleteModal.data.plate_number || deleteModal.data.full_name || deleteModal.data.name}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ isOpen: false, table: '', data: null })} className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-all">ยกเลิก</button>
              <button onClick={executeDelete} disabled={isSubmitting} className="flex-1 py-3.5 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all shadow-lg shadow-red-500/30">
                {isSubmitting ? 'กำลังลบ...' : 'ลบข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟡 Update Modal */}
      {updateModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col relative border border-gray-100">
            <div className="flex items-center gap-4 mb-6 border-b border-gray-100 pb-5">
              <div className="w-12 h-12 bg-[#5C2D91]/10 text-[#5C2D91] rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">ตรวจสอบการเปลี่ยนแปลง</h3>
                <p className="text-gray-500 text-sm mt-0.5">ระบบตรวจพบการอัปเดตข้อมูล โปรดยืนยัน</p>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3 mb-8 pr-2">
              {Object.keys(updateModal.newData).map(key => {
                if (key === 'id' || key === 'created_at' || updateModal.oldData[key] === updateModal.newData[key]) return null;
                return (
                  <div key={key} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="sm:w-1/3 text-[11px] uppercase tracking-wider font-bold text-gray-400">{fieldLabels[key] || key}</div>
                    <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm">
                      <span className="text-gray-400 line-through bg-gray-200/50 px-3 py-1.5 rounded-lg">{updateModal.oldData[key] || '-'}</span>
                      <span className="hidden sm:inline text-gray-300">→</span>
                      <span className="text-[#5C2D91] font-bold bg-[#5C2D91]/10 px-3 py-1.5 rounded-lg">{updateModal.newData[key] || '-'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-auto shrink-0">
              <button onClick={() => setUpdateModal({ isOpen: false, table: '', oldData: null, newData: null })} className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold transition-all">ยกเลิก</button>
              <button onClick={executeUpdate} disabled={isSubmitting} className="flex-1 py-3.5 bg-[#5C2D91] hover:bg-[#431F6A] text-white rounded-2xl font-bold transition-all shadow-lg shadow-[#5C2D91]/30">
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* 👈 Floating Sidebar */}
      <aside className={`fixed lg:static inset-y-4 left-4 w-[280px] bg-[#5C2D91] rounded-[2rem] text-white flex flex-col transition-transform duration-300 z-50 shadow-2xl lg:shadow-none overflow-hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0'}`}>
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="h-28 flex items-center gap-4 px-8 shrink-0 relative z-10 pt-4">
          <div className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-inner">⚡</div>
          <div>
            <h1 className="font-black text-white text-xl tracking-wide">PEA Fleet</h1>
            <p className="text-[10px] text-[#ECA10D] uppercase tracking-widest font-bold mt-1">Management</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-2 relative z-10">
          {sidebarMenus.map(menu => (
            <button 
              key={menu.id} 
              onClick={() => { setActiveMenu(menu.id); setIsSidebarOpen(false) }}
              className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all text-left group ${activeMenu === menu.id ? 'bg-white text-[#5C2D91] shadow-lg shadow-black/10' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}
            >
              <span className={`text-xl transition-transform ${activeMenu === menu.id ? 'scale-110' : 'group-hover:scale-110'}`}>{menu.icon}</span>
              <div>
                <p className="font-bold text-[13px]">{menu.title}</p>
                {activeMenu === menu.id && <p className="text-[10px] mt-0.5 text-[#5C2D91]/60 font-semibold">{menu.desc}</p>}
              </div>
            </button>
          ))}
        </nav>
        <div className="p-6 shrink-0 relative z-10">
          <button onClick={handleLogout} className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-bold border border-white/10 flex items-center justify-center gap-2 backdrop-blur-sm">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" /></svg>
             Log out
          </button>
        </div>
      </aside>

      {/* 👉 Main Content */}
      <main className="flex-1 bg-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col overflow-hidden relative border border-gray-100">
        
        {/* Header */}
        <header className="h-20 bg-white/70 backdrop-blur-xl flex items-center justify-between px-6 sm:px-10 shrink-0 z-20 border-b border-gray-100 sticky top-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 text-gray-400 hover:text-[#5C2D91] hover:bg-[#5C2D91]/10 rounded-xl transition-all" onClick={() => setIsSidebarOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
            <div>
                <h2 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-0.5">{activeMenuObj?.title}</h2>
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">{activeMenuObj?.desc}</h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
                <p className="text-[13px] font-bold text-gray-800">Admin_PEA</p>
                <p className="text-[10px] text-green-500 font-bold">● Online</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-tr from-[#5C2D91] to-[#ECA10D] rounded-full flex items-center justify-center text-white text-sm font-bold shadow-md border-2 border-white">PEA</div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-10 scroll-smooth bg-[#F9FAFC]/50">
          <div className="max-w-7xl mx-auto space-y-8 pb-12">

            {/* ส่วนที่ 1: ฟอร์ม */}
            <div id="form-section" className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                <h3 className="text-lg font-black text-gray-900 flex items-center gap-3">
                  {editingId ? 
                    <span className="flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-[#ECA10D]/10 text-[#ECA10D] flex items-center justify-center text-sm">✏️</span> แก้ไขข้อมูล (ID: {editingId})</span> : 
                    <span className="flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-[#5C2D91]/10 text-[#5C2D91] flex items-center justify-center text-sm">➕</span> เพิ่มรายการใหม่</span>
                  }
                </h3>
                {editingId && <button onClick={cancelEdit} className="text-xs bg-gray-100 text-gray-600 px-5 py-2.5 rounded-full font-bold hover:bg-gray-200 transition-all">ยกเลิกการแก้ไข</button>}
              </div>

              {/* ฟอร์มรถ (ตัดมาเฉพาะ HTML ฟอร์มเดิม) */}
              {activeMenu === 'cars' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'cars', carData)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="sm:col-span-1 lg:col-span-1"><label className={labelStyle}>ป้ายทะเบียน *</label><input type="text" required placeholder="เช่น กท 1234" value={carData.plate_number} onChange={e => setCarData({...carData, plate_number: e.target.value})} className={inputStyle} /></div>
                  <div className="sm:col-span-1 lg:col-span-2"><label className={labelStyle}>ยี่ห้อ / รุ่น</label><input type="text" placeholder="เช่น Toyota Hilux Revo" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ประเภทรถ</label><input type="text" placeholder="เช่น กระบะตอนเดียว" value={carData.car_type} onChange={e => setCarData({...carData, car_type: e.target.value})} className={inputStyle} /></div>
                  
                  <div><label className={labelStyle}>ประเภทพลังงาน</label><select value={carData.fuel_type} onChange={e => setCarData({...carData, fuel_type: e.target.value})} className={inputStyle}><option value="Gas">เชื้อเพลิง (น้ำมัน)</option><option value="EV">ไฟฟ้า (EV)</option></select></div>
                  <div><label className={labelStyle}>กรรมสิทธิ์</label><input type="text" placeholder="เช่น รถเช่า / รถองค์กร" value={carData.ownership_type} onChange={e => setCarData({...carData, ownership_type: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>แผนกที่รับผิดชอบ</label><input type="text" placeholder="ระบุชื่อแผนกย่อย" value={carData.department} onChange={e => setCarData({...carData, department: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ลักษณะการใช้งาน</label><input type="text" placeholder="เช่น ปฏิบัติการ, ส่วนกลาง" value={carData.usage_type} onChange={e => setCarData({...carData, usage_type: e.target.value})} className={inputStyle} /></div>
                  
                  <div className="sm:col-span-2 lg:col-span-4 mt-2 flex justify-end">
                    <button type="submit" className={`px-8 py-3.5 text-white rounded-full font-bold transition-all text-sm shadow-lg ${editingId ? 'bg-[#ECA10D] hover:bg-[#D4900B] shadow-[#ECA10D]/30' : 'bg-[#5C2D91] hover:bg-[#431F6A] shadow-[#5C2D91]/30'}`}>
                      {editingId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                    </button>
                  </div>
                </form>
              )}

              {/* ฟอร์มพนักงาน */}
              {activeMenu === 'staff' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'staff', staffData)} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div><label className={labelStyle}>รหัสพนักงาน *</label><input type="text" required placeholder="ระบุรหัสพนักงาน" value={staffData.staff_code} onChange={e => setStaffData({...staffData, staff_code: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ชื่อ-นามสกุล *</label><input type="text" required placeholder="ระบุชื่อ-นามสกุล" value={staffData.full_name} onChange={e => setStaffData({...staffData, full_name: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ตำแหน่ง</label><input type="text" placeholder="ระบุตำแหน่ง" value={staffData.position} onChange={e => setStaffData({...staffData, position: e.target.value})} className={inputStyle} /></div>
                  <div>
                    <label className={labelStyle}>สังกัด (แผนก)</label>
                    <select value={staffData.department_id} onChange={e => setStaffData({...staffData, department_id: e.target.value})} className={inputStyle}><option value="">-- ไม่ระบุสังกัด --</option>{departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select>
                  </div>
                  <div className="sm:col-span-2 mt-2 flex justify-end">
                    <button type="submit" className={`px-8 py-3.5 text-white rounded-full font-bold transition-all text-sm shadow-lg ${editingId ? 'bg-[#ECA10D] hover:bg-[#D4900B] shadow-[#ECA10D]/30' : 'bg-[#5C2D91] hover:bg-[#431F6A] shadow-[#5C2D91]/30'}`}>
                      {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มบุคลากร'}
                    </button>
                  </div>
                </form>
              )}

              {/* ฟอร์มตารางงาน */}
              {activeMenu === 'tasks' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'tasks', taskData)} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div><label className={labelStyle}>ชื่อภารกิจ / เส้นทาง *</label><input type="text" required placeholder="รายละเอียดภารกิจ" value={taskData.name} onChange={e => setTaskData({...taskData, name: e.target.value})} className={inputStyle} /></div>
                  <div>
                    <label className={labelStyle}>แผนกที่รับผิดชอบ</label>
                    <select value={taskData.department_id} onChange={e => setTaskData({...taskData, department_id: e.target.value})} className={inputStyle}><option value="">-- ส่วนกลาง --</option>{departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select>
                  </div>
                  <div className="sm:col-span-2 mt-2 flex justify-end">
                    <button type="submit" className={`px-8 py-3.5 text-white rounded-full font-bold transition-all text-sm shadow-lg ${editingId ? 'bg-[#ECA10D] hover:bg-[#D4900B] shadow-[#ECA10D]/30' : 'bg-[#5C2D91] hover:bg-[#431F6A] shadow-[#5C2D91]/30'}`}>
                      {editingId ? 'บันทึกการแก้ไข' : 'สร้างภารกิจ'}
                    </button>
                  </div>
                </form>
              )}

              {/* ฟอร์มแผนก & สถานที่ */}
              {(activeMenu === 'departments' || activeMenu === 'operation_areas') && (
                <form onSubmit={(e) => handlePreSubmit(e, activeMenu, activeMenu === 'departments' ? departmentData : operationAreaData)} className="flex flex-col sm:flex-row gap-6 items-end">
                  <div className="flex-1 w-full">
                    <label className={labelStyle}>{activeMenu === 'departments' ? 'ชื่อแผนก / สังกัด *' : 'ชื่อสถานที่ / พื้นที่ปฏิบัติการ *'}</label>
                    <input type="text" required placeholder="ระบุชื่อ" value={activeMenu === 'departments' ? departmentData.name : operationAreaData.name} onChange={e => activeMenu === 'departments' ? setDepartmentData({...departmentData, name: e.target.value}) : setOperationAreaData({...operationAreaData, name: e.target.value})} className={inputStyle} />
                  </div>
                  <button type="submit" className={`w-full sm:w-auto px-8 py-3.5 text-white rounded-full font-bold transition-all text-sm shadow-lg shrink-0 ${editingId ? 'bg-[#ECA10D] hover:bg-[#D4900B] shadow-[#ECA10D]/30' : 'bg-[#5C2D91] hover:bg-[#431F6A] shadow-[#5C2D91]/30'}`}>
                    {editingId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}
                  </button>
                </form>
              )}
            </div>

            {/* ส่วนที่ 2: รายการข้อมูล */}
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-[14px] font-black text-gray-800">DATABASE RECORDS</h3>
                <span className="bg-gray-100 text-gray-600 py-1.5 px-4 rounded-full text-[11px] font-bold tracking-wider">
                  {activeMenu === 'cars' ? carsList.length : activeMenu === 'staff' ? staffList.length : activeMenu === 'tasks' ? tasksList.length : activeMenu === 'departments' ? departmentsList.length : operationAreasList.length} ITEMS
                </span>
              </div>

              <div className="overflow-x-auto">
                {activeMenu === 'cars' && (
                  <table className="w-full text-left whitespace-nowrap min-w-[900px]">
                    <thead className="bg-gray-50/50"><tr className="border-b border-gray-100">
                      {/* 📍 เพิ่มหัวตารางสำหรับปุ่ม Toggle Show/Hide */}
                      <th className="py-4 px-8 text-gray-400 font-bold text-[10px] uppercase tracking-widest w-24">Show on Home</th>
                      <th className="py-4 px-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">License Plate</th>
                      <th className="py-4 px-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Model & Type</th>
                      <th className="py-4 px-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Energy</th>
                      <th className="py-4 px-4 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Department</th>
                      <th className="py-4 px-8 text-center text-gray-400 font-bold text-[10px] uppercase tracking-widest w-32">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {carsList.map(item => (
                        <tr key={item.id} className="hover:bg-purple-50/30 transition-colors group">
                          
                          {/* 📍 สวิตช์ Toggle แบบ Modern สำหรับซ่อน/แสดงรถคันนี้หน้า Home */}
                          <td className="p-4 px-8">
                            <button
                              type="button"
                              onClick={() => toggleCarVisibility(item.id, item.is_visible)}
                              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#5C2D91] focus:ring-offset-2 ${
                                item.is_visible !== false ? 'bg-[#5C2D91]' : 'bg-gray-300'
                              }`}
                              title={item.is_visible !== false ? 'กำลังแสดงผลที่หน้า Home' : 'ซ่อนจากหน้า Home แล้ว'}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  item.is_visible !== false ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          <td className="p-4 px-4">
                            <div className="inline-block border border-gray-300 bg-white rounded-md shadow-sm px-3 py-1">
                                <span className="font-black text-gray-900 text-sm">{item.plate_number}</span>
                            </div>
                          </td>
                          <td className="p-4 px-4"><p className="text-gray-900 font-bold text-[13px]">{item.model || 'N/A'}</p><p className="text-[11px] text-gray-400 mt-0.5">{item.car_type || '-'}</p></td>
                          <td className="p-4 px-4">
                            <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${item.fuel_type === 'EV' ? 'bg-green-50 text-green-600 border-green-200' : 'bg-orange-50 text-orange-600 border-orange-200'}`}>
                              {item.fuel_type === 'EV' ? '⚡ EV Mode' : '🛢️ Gasoline'}
                            </span>
                          </td>
                          <td className="p-4 px-4 text-gray-500 text-[13px] font-medium">{item.department || '-'}</td>
                          <td className="p-4 px-8 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit('cars', item)} className="p-2 text-gray-400 hover:text-[#5C2D91] hover:bg-[#5C2D91]/10 rounded-xl transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                            </button>
                            <button onClick={() => confirmDelete('cars', item)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* ตารางพนักงาน (แบบ Clean) */}
                {activeMenu === 'staff' && (
                  <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                    <thead className="bg-gray-50/50"><tr className="border-b border-gray-100">
                      <th className="py-4 px-8 text-gray-400 font-bold text-[10px] uppercase tracking-widest">ID</th>
                      <th className="py-4 px-8 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Name</th>
                      <th className="py-4 px-8 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Position</th>
                      <th className="py-4 px-8 text-gray-400 font-bold text-[10px] uppercase tracking-widest">Department</th>
                      <th className="py-4 px-8 text-center text-gray-400 font-bold text-[10px] uppercase tracking-widest w-32">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {staffList.map(item => (
                        <tr key={item.id} className="hover:bg-purple-50/30 transition-colors group">
                          <td className="p-4 px-8 text-xs font-bold text-gray-400">{item.staff_code}</td>
                          <td className="p-4 px-8">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[#5C2D91] font-bold text-xs">{item.full_name.charAt(0)}</div>
                              <span className="font-bold text-gray-900 text-[13px]">{item.full_name}</span>
                            </div>
                          </td>
                          <td className="p-4 px-8 text-gray-500 text-[13px]">{item.position || '-'}</td>
                          <td className="p-4 px-8"><span className="text-[11px] font-bold text-[#5C2D91] bg-[#5C2D91]/5 border border-[#5C2D91]/10 px-3 py-1 rounded-full">{item.departments?.name || 'Unassigned'}</span></td>
                          <td className="p-4 px-8 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handleEdit('staff', item)} className="p-2 text-gray-400 hover:text-[#5C2D91] hover:bg-[#5C2D91]/10 rounded-xl transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                            </button>
                            <button onClick={() => confirmDelete('staff', item)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Card งาน, แผนก, สถานที่ */}
                {(activeMenu === 'tasks' || activeMenu === 'departments' || activeMenu === 'operation_areas') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                    {(activeMenu === 'tasks' ? tasksList : activeMenu === 'departments' ? departmentsList : operationAreasList).map(item => (
                      <div key={item.id} className="p-6 border border-gray-100 rounded-[1.5rem] hover:shadow-[0_10px_30px_rgb(92,45,145,0.06)] transition-all bg-white relative group">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(activeMenu, item) }} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-[#5C2D91] hover:bg-purple-50">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" /></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); confirmDelete(activeMenu, item) }} className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                          </button>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-[#5C2D91]/5 flex items-center justify-center mb-4 text-[#5C2D91]">
                           {activeMenu === 'tasks' ? '📋' : activeMenu === 'departments' ? '🏢' : '📍'}
                        </div>
                        <h4 className="font-bold text-gray-900 text-[15px] mb-1">{item.name}</h4>
                        {activeMenu === 'tasks' && (
                          <p className="text-[11px] text-gray-500 font-medium">
                            <span className="font-bold">Dept:</span> {item.departments?.name || 'Unassigned'}
                          </p>
                        )}
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