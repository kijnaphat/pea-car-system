'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'

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
    const isCurrentlyVisible = currentStatus !== false; 
    const newStatus = !isCurrentlyVisible;

    // อัปเดต State ทันทีเพื่อให้ UI เปลี่ยนไว
    setCarsList(prev => prev.map(car => car.id === carId ? { ...car, is_visible: newStatus } : car))

    try {
      const { error } = await supabase.from('cars').update({ is_visible: newStatus }).eq('id', carId)
      if (error) throw error;
    } catch (error) {
      alert('เกิดข้อผิดพลาดในการอัปเดตสถานะ: ' + error.message)
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
    <div className="min-h-screen bg-[#000000] flex items-center justify-center relative overflow-hidden font-sans">
      <div className="absolute w-96 h-96 bg-[#f5d596] rounded-full blur-[120px] opacity-10 animate-pulse"></div>
      <div className="text-center z-10 flex flex-col items-center">
        <Icon icon="ph:spinner-gap-bold" className="animate-spin text-[#f5d596] mb-6" width="48" height="48" />
        <h1 className="text-2xl font-medium text-[#f5f5f7] tracking-tight">Authenticating</h1>
        <p className="text-sm font-medium text-[#86868b] mt-2 tracking-widest uppercase">Connecting to Fleet...</p>
      </div>
    </div>
  )

  const sidebarMenus = [
    { id: 'cars', icon: 'ph:car-profile', title: 'Vehicles', desc: 'Manage fleet' },
    { id: 'staff', icon: 'ph:users', title: 'Personnel', desc: 'Driver profiles' },
    { id: 'tasks', icon: 'ph:clipboard-text', title: 'Tasks', desc: 'Routing & assignments' },
    { id: 'departments', icon: 'ph:buildings', title: 'Departments', desc: 'Organization units' },
    { id: 'operation_areas', icon: 'ph:map-pin', title: 'Locations', desc: 'Operating zones' },
  ]
  const activeMenuObj = sidebarMenus.find(m => m.id === activeMenu)
  
  // Reusable Styles for Dark Mode
  const inputStyle = "w-full rounded-[10px] border border-[#424245] bg-transparent px-4 py-3.5 text-[14px] text-[#f5f5f7] placeholder-[#5c5c5f] focus:border-[#86868b] focus:ring-1 focus:ring-[#86868b] outline-none transition-colors"
  const labelStyle = "text-[11px] font-medium text-[#86868b] mb-2 block uppercase tracking-wider pl-1"

  return (
    <div className="flex h-screen bg-[#000000] font-sans overflow-hidden p-0 md:p-4 gap-4" style={{ WebkitFontSmoothing: 'antialiased' }}>
      
      <style>{`
        * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #424245; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #5c5c5f; }
        select option { background: #1c1c1e; color: #f5f5f7; }
      `}</style>

      {/* 🔴 Delete Modal (Dark Theme) */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-[#1c1c1e] border border-[#38383a] rounded-[24px] p-8 w-full max-w-md shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-center transform transition-all">
            <div className="w-16 h-16 bg-[#ff453a]/10 text-[#ff453a] rounded-full flex items-center justify-center mx-auto mb-5 border border-[#ff453a]/20">
              <Icon icon="ph:trash" width="32" height="32" />
            </div>
            <h3 className="text-xl font-semibold text-[#f5f5f7] mb-2 tracking-tight">Delete Record?</h3>
            <p className="text-[#86868b] text-sm mb-6">This action cannot be undone. This will permanently delete the selected data.</p>
            <div className="bg-[#000000] text-[#f5f5f7] p-4 rounded-xl mb-8 border border-[#38383a] font-medium break-words">
              {deleteModal.data.plate_number || deleteModal.data.full_name || deleteModal.data.name}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ isOpen: false, table: '', data: null })} className="flex-1 py-3.5 bg-[#38383a] hover:bg-[#424245] text-[#f5f5f7] rounded-[12px] font-medium transition-all">Cancel</button>
              <button onClick={executeDelete} disabled={isSubmitting} className="flex-1 py-3.5 bg-[#ff453a] hover:bg-[#ff3b30] text-white rounded-[12px] font-medium transition-all">
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟡 Update Modal (Dark Theme) */}
      {updateModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-[#1c1c1e] border border-[#38383a] rounded-[24px] p-8 w-full max-w-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[90vh] flex flex-col relative">
            <div className="flex items-center gap-4 mb-6 border-b border-[#38383a] pb-5">
              <div className="w-12 h-12 bg-[#f5d596]/10 text-[#f5d596] rounded-full flex items-center justify-center border border-[#f5d596]/20">
                <Icon icon="ph:arrows-clockwise" width="24" height="24" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[#f5f5f7] tracking-tight">Confirm Changes</h3>
                <p className="text-[#86868b] text-sm mt-0.5">Please review the updates before saving.</p>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3 mb-8 pr-2">
              {Object.keys(updateModal.newData).map(key => {
                if (key === 'id' || key === 'created_at' || updateModal.oldData[key] === updateModal.newData[key]) return null;
                return (
                  <div key={key} className="bg-[#000000] p-4 rounded-[12px] border border-[#38383a] flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="sm:w-1/3 text-[11px] uppercase tracking-wider font-semibold text-[#86868b]">{fieldLabels[key] || key}</div>
                    <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm">
                      <span className="text-[#86868b] line-through bg-[#1c1c1e] px-3 py-1.5 rounded-md border border-[#38383a]">{updateModal.oldData[key] || '-'}</span>
                      <span className="hidden sm:inline text-[#424245]"><Icon icon="ph:arrow-right-bold"/></span>
                      <span className="text-[#f5d596] font-medium bg-[#f5d596]/10 px-3 py-1.5 rounded-md border border-[#f5d596]/20">{updateModal.newData[key] || '-'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-auto shrink-0">
              <button onClick={() => setUpdateModal({ isOpen: false, table: '', oldData: null, newData: null })} className="flex-1 py-3.5 bg-[#38383a] hover:bg-[#424245] text-[#f5f5f7] rounded-[12px] font-medium transition-all">Cancel</button>
              <button onClick={executeUpdate} disabled={isSubmitting} className="flex-1 py-3.5 bg-[#f5d596] hover:bg-[#e3c38b] text-[#1c1c1e] rounded-[12px] font-medium transition-all">
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* 👈 Sidebar (Dark Minimalist) */}
      <aside className={`fixed md:static inset-y-0 left-0 w-[260px] bg-[#000000] border-r border-[#38383a] text-[#f5f5f7] flex flex-col transition-transform duration-300 z-50 overflow-hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        <div className="h-24 flex items-center gap-3 px-8 shrink-0 border-b border-[#1c1c1e]">
          <div className="w-8 h-8 bg-[#f5f5f7] rounded-[8px] flex items-center justify-center text-[#1c1c1e] font-bold text-[12px]">
            PEA
          </div>
          <div>
            <h1 className="font-semibold text-[#f5f5f7] text-[16px] tracking-tight">Admin Portal</h1>
            <p className="text-[10px] text-[#86868b] uppercase tracking-widest font-medium mt-0.5">Fleet System</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1 relative z-10">
          <p className="px-4 text-[11px] font-semibold text-[#5c5c5f] uppercase tracking-widest mb-3">Management</p>
          {sidebarMenus.map(menu => (
            <button 
              key={menu.id} 
              onClick={() => { setActiveMenu(menu.id); setIsSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-[12px] transition-colors text-left group ${
                activeMenu === menu.id 
                  ? 'bg-[#2c2c2e] text-[#f5f5f7]' 
                  : 'text-[#86868b] hover:bg-[#1c1c1e] hover:text-[#f5f5f7]'
              }`}
            >
              <Icon icon={menu.icon} width="20" height="20" className={activeMenu === menu.id ? 'text-[#f5f5f7]' : 'text-[#86868b] group-hover:text-[#f5f5f7]'} />
              <span className="font-medium text-[14px]">{menu.title}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 shrink-0 border-t border-[#1c1c1e]">
          <button onClick={handleLogout} className="w-full py-3 rounded-[10px] bg-[#1c1c1e] hover:bg-[#2c2c2e] text-[#f5f5f7] transition-all text-[13px] font-medium flex items-center justify-center gap-2 border border-[#38383a]">
             <Icon icon="ph:sign-out" width="18" height="18" />
             Sign Out
          </button>
        </div>
      </aside>

      {/* 👉 Main Content */}
      <main className="flex-1 bg-[#000000] flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="h-20 bg-[#000000]/80 backdrop-blur-xl flex items-center justify-between px-6 sm:px-10 shrink-0 z-20 border-b border-[#38383a] sticky top-0">
          <div className="flex items-center gap-4">
            <button className="md:hidden p-2 text-[#86868b] hover:text-[#f5f5f7] transition-colors" onClick={() => setIsSidebarOpen(true)}>
              <Icon icon="ph:list" width="24" height="24" />
            </button>
            <div>
                <h1 className="text-[22px] md:text-[24px] font-medium text-[#f5f5f7] tracking-tight">{activeMenuObj?.title}</h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
                <p className="text-[13px] font-medium text-[#f5f5f7]">Admin_PEA</p>
                <p className="text-[10px] text-[#34c759] font-medium tracking-wide">● Online</p>
            </div>
            <div className="w-9 h-9 bg-[#1c1c1e] border border-[#38383a] rounded-full flex items-center justify-center text-[#f5f5f7] text-xs font-bold">A</div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6 pb-12">

            {/* ส่วนที่ 1: ฟอร์ม (Dark Card) */}
            <div id="form-section" className="bg-[#1c1c1e] p-6 sm:p-8 rounded-[16px] border border-[#38383a]">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                <h3 className="text-[18px] font-medium text-[#f5f5f7] flex items-center gap-3 tracking-tight">
                  {editingId ? 
                    <><Icon icon="ph:pencil-simple" className="text-[#f5d596]" width="22" height="22" /> Edit Record (ID: {editingId})</> : 
                    <><Icon icon="ph:plus-circle" className="text-[#86868b]" width="22" height="22" /> Add New Record</>
                  }
                </h3>
                {editingId && <button onClick={cancelEdit} className="text-[12px] bg-[#38383a] text-[#f5f5f7] px-4 py-2 rounded-[8px] font-medium hover:bg-[#424245] transition-all border border-[#424245]">Cancel Edit</button>}
              </div>

              {/* ฟอร์มรถ */}
              {activeMenu === 'cars' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'cars', carData)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="sm:col-span-1 lg:col-span-1"><label className={labelStyle}>License Plate *</label><input type="text" required placeholder="e.g. กท 1234" value={carData.plate_number} onChange={e => setCarData({...carData, plate_number: e.target.value})} className={inputStyle} /></div>
                  <div className="sm:col-span-1 lg:col-span-2"><label className={labelStyle}>Brand / Model</label><input type="text" placeholder="e.g. Toyota Hilux Revo" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Car Type</label><input type="text" placeholder="e.g. Pickup" value={carData.car_type} onChange={e => setCarData({...carData, car_type: e.target.value})} className={inputStyle} /></div>
                  
                  <div><label className={labelStyle}>Energy Type</label><select value={carData.fuel_type} onChange={e => setCarData({...carData, fuel_type: e.target.value})} className={inputStyle}><option value="Gas">Gasoline</option><option value="EV">Electric (EV)</option></select></div>
                  <div><label className={labelStyle}>Ownership</label><input type="text" placeholder="e.g. Rental" value={carData.ownership_type} onChange={e => setCarData({...carData, ownership_type: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Department</label><input type="text" placeholder="e.g. IT Dept" value={carData.department} onChange={e => setCarData({...carData, department: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Usage Type</label><input type="text" placeholder="e.g. Operation" value={carData.usage_type} onChange={e => setCarData({...carData, usage_type: e.target.value})} className={inputStyle} /></div>
                  
                  <div className="sm:col-span-2 lg:col-span-4 mt-2 flex justify-end">
                    <button type="submit" className="px-8 py-3.5 bg-[#f5d596] hover:bg-[#e3c38b] text-[#1c1c1e] rounded-[10px] font-medium transition-all text-[14px]">
                      {editingId ? 'Save Changes' : 'Create Record'}
                    </button>
                  </div>
                </form>
              )}

              {/* ฟอร์มพนักงาน */}
              {activeMenu === 'staff' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'staff', staffData)} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div><label className={labelStyle}>Staff ID *</label><input type="text" required placeholder="ID Number" value={staffData.staff_code} onChange={e => setStaffData({...staffData, staff_code: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Full Name *</label><input type="text" required placeholder="First Last" value={staffData.full_name} onChange={e => setStaffData({...staffData, full_name: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>Position</label><input type="text" placeholder="Job Title" value={staffData.position} onChange={e => setStaffData({...staffData, position: e.target.value})} className={inputStyle} /></div>
                  <div>
                    <label className={labelStyle}>Department</label>
                    <select value={staffData.department_id} onChange={e => setStaffData({...staffData, department_id: e.target.value})} className={inputStyle}><option value="">-- Unassigned --</option>{departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select>
                  </div>
                  <div className="sm:col-span-2 mt-2 flex justify-end">
                    <button type="submit" className="px-8 py-3.5 bg-[#f5d596] hover:bg-[#e3c38b] text-[#1c1c1e] rounded-[10px] font-medium transition-all text-[14px]">
                      {editingId ? 'Save Changes' : 'Add Personnel'}
                    </button>
                  </div>
                </form>
              )}

              {/* ฟอร์มตารางงาน */}
              {activeMenu === 'tasks' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'tasks', taskData)} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div><label className={labelStyle}>Task / Route Name *</label><input type="text" required placeholder="Task details" value={taskData.name} onChange={e => setTaskData({...taskData, name: e.target.value})} className={inputStyle} /></div>
                  <div>
                    <label className={labelStyle}>Department</label>
                    <select value={taskData.department_id} onChange={e => setTaskData({...taskData, department_id: e.target.value})} className={inputStyle}><option value="">-- Central --</option>{departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select>
                  </div>
                  <div className="sm:col-span-2 mt-2 flex justify-end">
                    <button type="submit" className="px-8 py-3.5 bg-[#f5d596] hover:bg-[#e3c38b] text-[#1c1c1e] rounded-[10px] font-medium transition-all text-[14px]">
                      {editingId ? 'Save Changes' : 'Create Task'}
                    </button>
                  </div>
                </form>
              )}

              {/* ฟอร์มแผนก & สถานที่ */}
              {(activeMenu === 'departments' || activeMenu === 'operation_areas') && (
                <form onSubmit={(e) => handlePreSubmit(e, activeMenu, activeMenu === 'departments' ? departmentData : operationAreaData)} className="flex flex-col sm:flex-row gap-5 items-end">
                  <div className="flex-1 w-full">
                    <label className={labelStyle}>{activeMenu === 'departments' ? 'Department Name *' : 'Operation Area Name *'}</label>
                    <input type="text" required placeholder="Enter name" value={activeMenu === 'departments' ? departmentData.name : operationAreaData.name} onChange={e => activeMenu === 'departments' ? setDepartmentData({...departmentData, name: e.target.value}) : setOperationAreaData({...operationAreaData, name: e.target.value})} className={inputStyle} />
                  </div>
                  <button type="submit" className="w-full sm:w-auto px-8 py-3.5 bg-[#f5d596] hover:bg-[#e3c38b] text-[#1c1c1e] rounded-[10px] font-medium transition-all text-[14px] shrink-0">
                    {editingId ? 'Save Changes' : 'Save Record'}
                  </button>
                </form>
              )}
            </div>

            {/* ส่วนที่ 2: รายการข้อมูล (Table) */}
            <div className="bg-[#1c1c1e] rounded-[16px] border border-[#38383a] overflow-hidden">
              <div className="px-6 py-5 border-b border-[#38383a] flex justify-between items-center bg-[#1c1c1e]">
                <h3 className="text-[13px] font-medium text-[#f5f5f7] tracking-wider uppercase">Database Records</h3>
                <span className="bg-[#2c2c2e] text-[#86868b] py-1 px-3 rounded-md text-[11px] font-medium border border-[#38383a]">
                  {activeMenu === 'cars' ? carsList.length : activeMenu === 'staff' ? staffList.length : activeMenu === 'tasks' ? tasksList.length : activeMenu === 'departments' ? departmentsList.length : operationAreasList.length} ITEMS
                </span>
              </div>

              <div className="overflow-x-auto">
                {activeMenu === 'cars' && (
                  <table className="w-full text-left whitespace-nowrap min-w-[900px]">
                    <thead className="bg-[#1c1c1e]"><tr className="border-b border-[#38383a]">
                      <th className="py-4 px-6 text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest w-24">Display</th>
                      <th className="py-4 px-4 text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest">License Plate</th>
                      <th className="py-4 px-4 text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest">Model & Type</th>
                      <th className="py-4 px-4 text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest">Energy</th>
                      <th className="py-4 px-4 text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest">Department</th>
                      <th className="py-4 px-6 text-center text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest w-24">Edit</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#38383a]">
                      {carsList.map(item => (
                        <tr key={item.id} className="hover:bg-[#2c2c2e] transition-colors group">
                          
                          {/* Toggle Switch */}
                          <td className="p-4 px-6">
                            <button
                              type="button"
                              onClick={() => toggleCarVisibility(item.id, item.is_visible)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                item.is_visible !== false ? 'bg-[#34c759]' : 'bg-[#424245]'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  item.is_visible !== false ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          <td className="p-4 px-4">
                            <span className="font-medium text-[#f5f5f7] text-[14px] bg-[#2c2c2e] px-3 py-1.5 rounded-[6px] border border-[#424245]">{item.plate_number}</span>
                          </td>
                          <td className="p-4 px-4"><p className="text-[#f5f5f7] font-medium text-[13px]">{item.model || 'N/A'}</p><p className="text-[11px] text-[#86868b] mt-0.5">{item.car_type || '-'}</p></td>
                          <td className="p-4 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded-md border ${item.fuel_type === 'EV' ? 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/20' : 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/20'}`}>
                              <Icon icon={item.fuel_type === 'EV' ? "ph:lightning" : "ph:gas-pump"} width="12" height="12" /> {item.fuel_type === 'EV' ? 'EV Mode' : 'Gasoline'}
                            </span>
                          </td>
                          <td className="p-4 px-4 text-[#86868b] text-[13px]">{item.department || '-'}</td>
                          <td className="p-4 px-6 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit('cars', item)} className="p-1.5 text-[#86868b] hover:text-[#f5f5f7] transition-colors"><Icon icon="ph:pencil-simple" width="18" height="18" /></button>
                            <button onClick={() => confirmDelete('cars', item)} className="p-1.5 text-[#86868b] hover:text-[#ff453a] transition-colors"><Icon icon="ph:trash" width="18" height="18" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* ตารางพนักงาน */}
                {activeMenu === 'staff' && (
                  <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                    <thead className="bg-[#1c1c1e]"><tr className="border-b border-[#38383a]">
                      <th className="py-4 px-6 text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest">ID</th>
                      <th className="py-4 px-6 text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest">Name</th>
                      <th className="py-4 px-6 text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest">Position</th>
                      <th className="py-4 px-6 text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest">Department</th>
                      <th className="py-4 px-6 text-center text-[#5c5c5f] font-semibold text-[10px] uppercase tracking-widest w-24">Edit</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#38383a]">
                      {staffList.map(item => (
                        <tr key={item.id} className="hover:bg-[#2c2c2e] transition-colors group">
                          <td className="p-4 px-6 text-[12px] text-[#86868b] font-medium">{item.staff_code}</td>
                          <td className="p-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-[#2c2c2e] border border-[#424245] flex items-center justify-center text-[#f5f5f7] font-medium text-[11px]">{item.full_name.charAt(0)}</div>
                              <span className="font-medium text-[#f5f5f7] text-[13px]">{item.full_name}</span>
                            </div>
                          </td>
                          <td className="p-4 px-6 text-[#86868b] text-[13px]">{item.position || '-'}</td>
                          <td className="p-4 px-6"><span className="text-[11px] text-[#86868b] bg-[#2c2c2e] border border-[#424245] px-2.5 py-1 rounded-md">{item.departments?.name || 'Unassigned'}</span></td>
                          <td className="p-4 px-6 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                             <button onClick={() => handleEdit('staff', item)} className="p-1.5 text-[#86868b] hover:text-[#f5f5f7] transition-colors"><Icon icon="ph:pencil-simple" width="18" height="18" /></button>
                             <button onClick={() => confirmDelete('staff', item)} className="p-1.5 text-[#86868b] hover:text-[#ff453a] transition-colors"><Icon icon="ph:trash" width="18" height="18" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Card งาน, แผนก, สถานที่ */}
                {(activeMenu === 'tasks' || activeMenu === 'departments' || activeMenu === 'operation_areas') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-6 bg-[#000000]">
                    {(activeMenu === 'tasks' ? tasksList : activeMenu === 'departments' ? departmentsList : operationAreasList).map(item => (
                      <div key={item.id} className="p-5 border border-[#38383a] rounded-[12px] hover:border-[#5c5c5f] transition-all bg-[#1c1c1e] relative group">
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(activeMenu, item) }} className="text-[#86868b] hover:text-[#f5f5f7] transition-colors"><Icon icon="ph:pencil-simple" width="18" height="18" /></button>
                          <button onClick={(e) => { e.stopPropagation(); confirmDelete(activeMenu, item) }} className="text-[#86868b] hover:text-[#ff453a] transition-colors"><Icon icon="ph:trash" width="18" height="18" /></button>
                        </div>
                        <div className="w-8 h-8 rounded-md bg-[#2c2c2e] border border-[#424245] flex items-center justify-center mb-4 text-[#f5f5f7]">
                           <Icon icon={activeMenu === 'tasks' ? "ph:clipboard-text" : activeMenu === 'departments' ? "ph:buildings" : "ph:map-pin"} width="16" height="16" />
                        </div>
                        <h4 className="font-medium text-[#f5f5f7] text-[14px] mb-1">{item.name}</h4>
                        {activeMenu === 'tasks' && (
                          <p className="text-[12px] text-[#86868b]">
                            Dept: {item.departments?.name || 'Unassigned'}
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