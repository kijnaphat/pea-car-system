'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

const initialCarData = { plate_number: '', model: '', car_type: '', fuel_type: 'Gas', status: 'available', budget: '', department: '', usage_type: '', ownership_type: '' }
const initialStaffData = { staff_code: '', full_name: '', position: '', department_id: '' }
const initialTaskData = { name: '', department_id: '' }
const initialDepartmentData = { name: '' }
const initialOperationAreaData = { name: '' } // 📍 เพิ่ม Initial State สำหรับสถานที่

const fieldLabels = {
  plate_number: 'ป้ายทะเบียน', model: 'ยี่ห้อ/รุ่น', car_type: 'ประเภทรถ', fuel_type: 'กินน้ำมัน/ไฟฟ้า', 
  budget: 'งบจัดหา', department: 'สังกัด(เขียนเอา)', usage_type: 'เอาไปทำไร', ownership_type: 'รถใคร?',
  staff_code: 'รหัสลับ', full_name: 'ชื่อ-สกุล', position: 'ตำแหน่ง/ทรง', department_id: 'รหัสซุ้ม',
  name: 'ชื่อ (ลายแทง/ซุ้ม/สถานที่)' // 📍 ปรับชื่อ label ให้ครอบคลุม
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
  const [operationAreaData, setOperationAreaData] = useState(initialOperationAreaData) // 📍 State ของฟอร์มสถานที่

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const [carsList, setCarsList] = useState([])
  const [staffList, setStaffList] = useState([])
  const [tasksList, setTasksList] = useState([])
  const [departmentsList, setDepartmentsList] = useState([])
  const [operationAreasList, setOperationAreasList] = useState([]) // 📍 State เก็บข้อมูลสถานที่จาก DB
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
      } else if (activeMenu === 'operation_areas') { // 📍 ดึงข้อมูลตาราง operation_areas
        const { data } = await supabase.from('operation_areas').select('*').order('created_at', { ascending: false })
        setOperationAreasList(data || [])
      }
    } catch (error) { console.error('Error:', error.message) }
  }, [activeMenu])

  useEffect(() => {
    if (!loadingSession) { fetchData(); cancelEdit() }
  }, [activeMenu, loadingSession, fetchData])

  const handleLogout = async () => {
    if(confirm('หนีงานป่าวเนี่ย? จะชิ่งหรอถามจริง! 🤨')) {
        await supabase.auth.signOut()
        router.push('/admin/login')
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setCarData(initialCarData); setStaffData(initialStaffData)
    setTaskData(initialTaskData); setDepartmentData(initialDepartmentData)
    setOperationAreaData(initialOperationAreaData) // 📍 รีเซ็ตสถานที่
  }

  const handleEdit = (type, data) => {
    setEditingId(data.id)
    const cleanData = { ...data }
    delete cleanData.departments 

    if (type === 'cars') setCarData(cleanData)
    if (type === 'staff') setStaffData({ ...cleanData, department_id: cleanData.department_id || '' })
    if (type === 'tasks') setTaskData({ ...cleanData, department_id: cleanData.department_id || '' })
    if (type === 'departments') setDepartmentData(cleanData)
    if (type === 'operation_areas') setOperationAreaData(cleanData) // 📍 ดึงข้อมูลสถานที่มาแก้
    
    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' })
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
      if (table === 'operation_areas') oldData = operationAreasList.find(item => item.id === editingId) // 📍 หา oldData สถานที่
      
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
      alert('🚀 บรื้นนน! ยัดข้อมูลลงฐานสำเร็จแบบเบรกแตก!')
      cancelEdit(); fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('💥 แหกโค้งจ้า! พังเฉย: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const executeUpdate = async () => {
    setIsSubmitting(true)
    const { table, newData } = updateModal
    try {
      const { data, error } = await supabase.from(table).update(newData).eq('id', editingId).select()
      if (error) throw error; 
      if (!data || data.length === 0) throw new Error('หาตัวไม่เจอ หนีไปไหนแล้ว?');
      alert('🔧 จูนกล่องดันรางเรียบร้อย แรงทะลุไมล์!')
      setUpdateModal({ isOpen: false, table: '', oldData: null, newData: null })
      cancelEdit(); fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('😭 น็อตหวาน! จูนไม่เข้า: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const confirmDelete = (table, itemData) => setDeleteModal({ isOpen: true, table, data: itemData })

  const executeDelete = async () => {
    setIsSubmitting(true)
    const { table, data: itemToDelete } = deleteModal
    try {
      const { data, error } = await supabase.from(table).delete().eq('id', itemToDelete.id).select()
      if (error) throw error; 
      if (!data || data.length === 0) throw new Error('ลบไม่ได้เฉย ผีหลอก!');
      alert('🗑️ ตุยเย่! ข้อมูลปลิวไปคุยกับรากมะม่วงแล้วจ้า 🥭')
      setDeleteModal({ isOpen: false, table: '', data: null })
      fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('💢 เหนียวเกิ๊น! ลบไม่ออกโว้ย: ' + error.message) } finally { setIsSubmitting(false) }
  }

  if (loadingSession) return (
    <div className="min-h-screen bg-[#088cb3] flex items-center justify-center relative overflow-hidden">
      <div className="text-center z-10 active:scale-90 transition-transform cursor-pointer hover-engine-shake">
        <img src="/scooter.png" alt="Loading Scooter" className="w-64 mx-auto mb-4 animate-super-float drop-shadow-[0_20px_30px_rgba(0,0,0,0.3)]" />
        <p className="text-2xl font-black text-white animate-pulse tracking-widest uppercase mt-8">รอแป๊บนะวัยรุ่น เครื่องมันเย็น...</p>
      </div>
    </div>
  )

  const sidebarMenus = [
    { id: 'cars', icon: '🛵', title: '1. จัดการรถยนต์', desc: 'รถแต่งซิ่งหรือวิ่งทิพย์' },
    { id: 'staff', icon: '😎', title: '2. พนักงาน', desc: 'รวมพลคนตึงๆ ทั้งนั้น' },
    { id: 'tasks', icon: '🗺️', title: '3. ตารางงาน', desc: 'จะแว้นไปไหนต่อไหนว่ามา' },
    { id: 'departments', icon: '🏢', title: '4. แผนก', desc: 'อยู่ซุ้มไหน ซอยไหน' },
    { id: 'operation_areas', icon: '📍', title: '5. สถานที่', desc: 'จุดเกิดเหตุ / จุดนัดหมาย' }, // 📍 เพิ่มเมนูที่ 5
  ]
  const activeMenuObj = sidebarMenus.find(m => m.id === activeMenu)
  
  const inputStyle = "w-full rounded-full border-2 border-gray-100 px-5 py-3.5 text-sm font-bold text-gray-700 focus:outline-none focus:border-[#a42f56] focus:ring-4 focus:ring-[#a42f56]/20 transition-all placeholder-gray-300 bg-gray-50/50 shadow-inner focus:scale-[1.02] focus:bg-white"
  const labelStyle = "text-[12px] font-black text-gray-500 mb-1.5 block uppercase tracking-wider ml-3"

  return (
    <div className="flex h-screen bg-[#F1F6F9] font-sans overflow-hidden relative">
      
      {/* 🏍️ GIANT Floating Motorbikes in Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <img src="/scooter.png" alt="bg-scooter" className="absolute top-[-10%] left-[-15%] w-[45rem] opacity-[0.04] animate-super-float blur-[2px]" />
        <img src="/scooter.png" alt="bg-scooter" className="absolute top-[30%] right-[-10%] w-[55rem] opacity-[0.03] animate-super-float-slow rotate-[15deg] blur-[1px]" />
        <img src="/scooter.png" alt="bg-scooter" className="absolute bottom-[-20%] left-[20%] w-[40rem] opacity-[0.05] animate-super-float-fast -rotate-[10deg]" />
      </div>

      <style>{`
        @keyframes superFloat { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-30px) rotate(5deg); } }
        @keyframes superFloatSlow { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-40px) rotate(-5deg); } }
        @keyframes superFloatFast { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-20px) rotate(8deg); } }
        .animate-super-float { animation: superFloat 6s ease-in-out infinite; }
        .animate-super-float-slow { animation: superFloatSlow 8s ease-in-out infinite; }
        .animate-super-float-fast { animation: superFloatFast 4s ease-in-out infinite; }
        
        @keyframes engineShake { 
          0%, 100% { transform: translateX(0) rotate(0deg) scale(1); } 
          25% { transform: translateX(-5px) rotate(-4deg) scale(1.05); } 
          75% { transform: translateX(5px) rotate(4deg) scale(1.05); } 
        }
        .hover-engine-shake:hover { animation: engineShake 0.15s ease-in-out; cursor: pointer; }
      `}</style>
      
      {/* 🔴 Delete Modal: กวนโสตประสาท */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-[#088cb3]/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-md shadow-[0_30px_60px_rgba(0,0,0,0.4)] text-center transform transition-all active:scale-90 duration-200 border-8 border-red-500 relative overflow-hidden">
            <img src="/scooter.png" alt="Crash" className="absolute -top-10 -right-10 w-48 opacity-20 rotate-[130deg]" />
            <div className="mb-2 flex justify-center hover-engine-shake relative z-10">
                <img src="/scooter.png" alt="Crash" className="w-36 drop-shadow-2xl rotate-[160deg]" />
            </div>
            <h3 className="text-3xl font-black text-gray-900 mb-2 relative z-10">เอาจริงดิ? ลบหรอ!?</h3>
            <p className="text-gray-500 text-sm mb-6 relative z-10">ใจคอทำด้วยไรเนี่ย ลบแล้วกู้คืนไม่ได้นะโว้ยยยย!</p>
            
            <div className="bg-red-50 text-[#a42f56] p-5 rounded-3xl mb-8 border-4 border-dashed border-red-200 font-black shadow-inner relative z-10">
              <p className="text-xl break-words">
                {deleteModal.data.plate_number || deleteModal.data.full_name || deleteModal.data.name}
              </p>
            </div>

            <div className="flex gap-4 relative z-10">
              <button onClick={() => setDeleteModal({ isOpen: false, table: '', data: null })} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full font-bold transition-all active:scale-75 active:rotate-[-5deg]">มือลั่น โทษที!</button>
              <button onClick={executeDelete} disabled={isSubmitting} className="flex-1 py-4 bg-[#a42f56] hover:bg-[#8b2749] text-white rounded-full font-black transition-all shadow-xl shadow-[#a42f56]/40 active:scale-75 active:rotate-[5deg] hover-engine-shake">
                {isSubmitting ? 'กำลังส่งลงหลุม...' : 'เออ! บดมันทิ้งเลย!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟡 Update Modal: เช็กอะไหล่กวนๆ */}
      {updateModal.isOpen && (
        <div className="fixed inset-0 bg-[#088cb3]/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-2xl shadow-[0_30px_60px_rgba(0,0,0,0.4)] max-h-[90vh] flex flex-col relative overflow-hidden border-8 border-yellow-400">
            <img src="/scooter.png" alt="Bg Scooter" className="absolute -bottom-20 -left-20 w-80 opacity-10 rotate-12 pointer-events-none" />

            <div className="flex items-center gap-6 mb-6 border-b-4 border-gray-100 pb-6 relative z-10">
              <img src="/scooter.png" alt="Fix" className="w-28 animate-super-float drop-shadow-xl hover-engine-shake" />
              <div>
                <h3 className="text-3xl font-black text-gray-900">🔍 ส่องดูดิ๊ แก้ไรไปบ้าง!</h3>
                <p className="text-gray-500 text-base font-bold mt-1">ประกอบผิดเดี๋ยวล้อหลุดกลางทางนะเว้ย</p>
              </div>
            </div>
            
            <div className="overflow-y-auto flex-1 bg-gray-50 rounded-3xl p-5 space-y-3 mb-6 border-2 border-gray-100 shadow-inner relative z-10">
              {Object.keys(updateModal.newData).map(key => {
                if (key === 'id' || key === 'created_at' || updateModal.oldData[key] === updateModal.newData[key]) return null;
                return (
                  <div key={key} className="bg-white p-4 rounded-2xl border-2 border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 transition-transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer">
                    <div className="sm:w-1/3 text-[11px] font-black text-gray-400 uppercase tracking-widest pl-2">{fieldLabels[key] || key}</div>
                    <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm font-black">
                      <span className="text-red-400 line-through w-full sm:w-auto bg-red-50/50 px-3 py-1.5 rounded-xl border border-red-100">{updateModal.oldData[key] || 'ไม่มีข้อมูล (ว่างจัด)'}</span>
                      <span className="hidden sm:inline text-gray-300 text-xl animate-pulse">➡️</span>
                      <span className="text-[#088cb3] w-full sm:w-auto bg-[#088cb3]/10 px-3 py-1.5 rounded-xl border border-[#088cb3]/20 text-base">{updateModal.newData[key] || 'ลบทิ้งเฉย (ว่าง)'}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-4 mt-auto shrink-0 relative z-10">
              <button onClick={() => setUpdateModal({ isOpen: false, table: '', oldData: null, newData: null })} className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full font-black transition-all active:scale-90 active:rotate-[-3deg]">มือลั่น! กลับไปแก้ก่อน</button>
              <button onClick={executeUpdate} disabled={isSubmitting} className="flex-1 py-4 bg-[#088cb3] hover:bg-[#067292] text-white rounded-full font-black transition-all shadow-xl shadow-[#088cb3]/40 active:scale-90 active:rotate-[3deg] hover-engine-shake">
                {isSubmitting ? 'กำลังอัดน็อต...' : '💾 อัดน็อตแน่นๆ เซฟเลย!'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSidebarOpen && <div className="fixed inset-0 bg-[#088cb3]/80 z-40 lg:hidden backdrop-blur-md" onClick={() => setIsSidebarOpen(false)}></div>}

      {/* 👈 Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-[300px] bg-[#088cb3] text-white flex flex-col transition-transform duration-300 z-50 shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} rounded-r-[3rem] lg:rounded-none overflow-hidden`}>
        
        <div className="h-32 flex items-center gap-4 px-8 border-b-2 border-white/10 shrink-0 relative z-10">
          <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-[#088cb3] font-black text-4xl shadow-xl hover-engine-shake active:scale-75 transition-all cursor-pointer">
            P
          </div>
          <div>
            <h1 className="font-black text-white text-2xl leading-tight tracking-tight drop-shadow-md">PEA Fleet</h1>
            <p className="text-[11px] text-[#a42f56] bg-white px-2 py-0.5 rounded-full uppercase tracking-widest font-black mt-2 inline-block shadow-sm">แอดมินขาซิ่ง</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-8 px-5 space-y-3 relative z-10">
          {sidebarMenus.map(menu => (
            <button 
              key={menu.id} 
              onClick={() => { setActiveMenu(menu.id); setIsSidebarOpen(false) }}
              className={`w-full flex items-center gap-5 px-5 py-4 rounded-3xl transition-all text-left group active:scale-90 active:rotate-[-2deg] duration-150 ${activeMenu === menu.id ? 'bg-white text-[#088cb3] shadow-[0_15px_30px_rgba(0,0,0,0.2)]' : 'hover:bg-white/10 text-white/80 hover:text-white border border-transparent hover:border-white/20'}`}
            >
              <span className={`text-4xl transition-transform ${activeMenu === menu.id ? 'animate-super-float drop-shadow-md' : 'group-hover:scale-125 group-hover:rotate-12'}`}>{menu.icon}</span>
              <div>
                <p className="font-black text-sm tracking-wide">{menu.title}</p>
                <p className={`text-[10px] font-bold ${activeMenu === menu.id ? 'text-[#088cb3]/70' : 'text-white/50'}`}>{menu.desc}</p>
              </div>
            </button>
          ))}
        </nav>

        <div className="relative mt-auto pointer-events-none">
           <img src="/scooter.png" alt="Big Sidebar Scooter" className="w-72 absolute bottom-0 -right-12 opacity-30 drop-shadow-2xl translate-y-10 hover:-translate-y-2 transition-transform duration-500" />
        </div>

        <div className="p-6 shrink-0 relative z-10 bg-gradient-to-t from-[#067292] to-transparent pt-10">
          <button onClick={handleLogout} className="w-full py-4 rounded-full bg-[#a42f56] text-white transition-all text-sm font-black shadow-xl shadow-[#a42f56]/50 hover-engine-shake active:scale-90 active:rotate-[4deg] border-2 border-white/20 hover:border-white/50 backdrop-blur-md">
             หนีกลับบ้าน (Logout) 🏃‍♂️💨
          </button>
        </div>
      </aside>

      {/* 👉 Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden z-10 relative">
        
        {/* Header */}
        <header className="h-28 bg-white/80 backdrop-blur-xl flex items-center justify-between px-8 sm:px-12 shrink-0 z-20 shadow-sm border-b-2 border-gray-100">
          <div className="flex items-center gap-5">
            <button className="lg:hidden p-3 bg-gray-100 text-gray-600 rounded-2xl transition-all active:scale-75 active:rotate-180" onClick={() => setIsSidebarOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-7 h-7"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
            </button>
            <span className="text-5xl hidden sm:block animate-super-float drop-shadow-md">{activeMenuObj?.icon}</span>
            <div>
                <h2 className="text-[#088cb3] font-black text-[10px] tracking-widest uppercase mb-1 bg-[#088cb3]/10 inline-block px-2 py-0.5 rounded-md">หอบังคับการ</h2>
                <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight leading-none drop-shadow-sm">{activeMenuObj?.title}</h1>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 bg-[#088cb3]/5 px-6 py-3 rounded-full border-2 border-[#088cb3]/20 shadow-inner active:scale-90 active:rotate-3 transition-all cursor-pointer hover-engine-shake">
            <img src="/scooter.png" alt="mini scooter" className="w-12 animate-super-float-fast drop-shadow-md" />
            <span className="text-xs font-black text-[#088cb3] uppercase tracking-widest">Admin สแตนด์บายพร้อมบวก</span>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 scroll-smooth relative z-10">
          <div className="max-w-6xl mx-auto space-y-12 pb-24">

            {/* ส่วนที่ 1: ฟอร์ม */}
            <div id="form-section" className="bg-white/95 backdrop-blur-md p-8 sm:p-12 rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.06)] border-2 border-gray-100 relative overflow-hidden group hover:border-[#088cb3]/30 transition-colors duration-500">
              
              <img src="/scooter.png" alt="Corner Scooter" className="absolute -top-10 -right-10 w-72 opacity-10 rotate-[20deg] pointer-events-none group-hover:rotate-[35deg] group-hover:scale-110 transition-transform duration-700" />

              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-10 relative z-10">
                <h3 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-4">
                  {editingId ? 
                    <span className="text-[#088cb3] flex items-center gap-3"><span className="text-4xl animate-spin drop-shadow-md">⚙️</span> กำลังจับจูนเครื่อง (ID: {editingId})</span> : 
                    <span className="text-[#a42f56] flex items-center gap-3"><span className="text-4xl hover-engine-shake drop-shadow-md cursor-pointer">✨</span> ยัดข้อมูลเถื่อนลงอู่ (หยอกๆ)</span>
                  }
                </h3>
                {editingId && <button onClick={cancelEdit} className="text-sm w-full sm:w-auto bg-gray-100 text-gray-500 px-8 py-3.5 rounded-full font-black hover:bg-gray-200 hover:text-gray-800 transition-all active:scale-75 active:rotate-3 shadow-inner border border-gray-200">❌ ไม่แก้ละ เหนื่อย!</button>}
              </div>

              <div className="relative z-10">
              {/* ฟอร์มรถ */}
              {activeMenu === 'cars' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'cars', carData)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="sm:col-span-1 lg:col-span-1"><label className={labelStyle}>ป้ายทะเบียน (อย่าเถื่อน) *</label><input type="text" required placeholder="กข 1234 หรือ ป้ายแดง?" value={carData.plate_number} onChange={e => setCarData({...carData, plate_number: e.target.value})} className={inputStyle} /></div>
                  <div className="sm:col-span-1 lg:col-span-2"><label className={labelStyle}>ยี่ห้อ / รุ่น (ทรงเชงหรือทรงช่าง?)</label><input type="text" placeholder="เช่น Honda เวฟ 110i แต่งเต็ม" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ประเภทรถ</label><input type="text" placeholder="มอเตอร์ไซค์, ซาเล้ง" value={carData.car_type} onChange={e => setCarData({...carData, car_type: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>กินน้ำมันหรือซดไฟ?</label><select value={carData.fuel_type} onChange={e => setCarData({...carData, fuel_type: e.target.value})} className={inputStyle}><option value="Gas">🛢️ น้ำมัน (Gas) สายเบิร์น</option><option value="EV">⚡ ไฟฟ้า (EV) สายเงียบ</option></select></div>
                  <div><label className={labelStyle}>รถใคร? (กรรมสิทธิ์)</label><input type="text" placeholder="ของหลวง หรือ ขโมยมาหยอกๆ" value={carData.ownership_type} onChange={e => setCarData({...carData, ownership_type: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>อยู่ซุ้มไหน? (พิมพ์ชื่อแผนก)</label><input type="text" placeholder="เช่น กฟล. แก๊งซิ่ง" value={carData.department} onChange={e => setCarData({...carData, department: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>เอาไปทำไร? (การใช้งาน)</label><input type="text" placeholder="ขับไปซื้อแกง หรือ ออกทริป" value={carData.usage_type} onChange={e => setCarData({...carData, usage_type: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>งบจัดหา (อย่ามุบมิบ)</label><input type="text" placeholder="กี่บาท ว่ามา..." value={carData.budget} onChange={e => setCarData({...carData, budget: e.target.value})} className={inputStyle} /></div>
                  
                  <div className="sm:col-span-2 lg:col-span-3 mt-6 flex justify-end">
                    <button type="submit" className={`w-full sm:w-auto px-12 py-5 text-white rounded-full font-black shadow-xl transition-all text-base hover-engine-shake active:scale-90 active:rotate-[-3deg] ${editingId ? 'bg-[#088cb3] hover:bg-[#067292] shadow-[#088cb3]/40 border-b-4 border-[#065b75]' : 'bg-[#a42f56] hover:bg-[#8b2749] shadow-[#a42f56]/40 border-b-4 border-[#7a1f3c]'}`}>
                      {editingId ? '🔧 บันทึกข้อมูลจูนเครื่อง!' : '🚀 กระทืบคันเร่ง ดันรถเข้าอู่!'}
                    </button>
                  </div>
                </form>
              )}

              {/* ฟอร์มพนักงาน */}
              {activeMenu === 'staff' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'staff', staffData)} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div><label className={labelStyle}>รหัสลับตัวตึง *</label><input type="text" required placeholder="ใส่รหัสซะ!" value={staffData.staff_code} onChange={e => setStaffData({...staffData, staff_code: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ชื่อ-นามสกุล (พร้อมฉายา) *</label><input type="text" required placeholder="เช่น บอย ซอยตัน" value={staffData.full_name} onChange={e => setStaffData({...staffData, full_name: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ตำแหน่ง (ทรงไหนบอกมา)</label><input type="text" placeholder="เช่น หัวหน้าแก๊ง, สายหมอบ" value={staffData.position} onChange={e => setStaffData({...staffData, position: e.target.value})} className={inputStyle} /></div>
                  <div>
                    <label className={labelStyle}>สังกัดซุ้ม</label>
                    <select value={staffData.department_id} onChange={e => setStaffData({...staffData, department_id: e.target.value})} className={inputStyle}><option value="">-- เป็นพวกไร้สังกัด (หมาป่าเดียวดาย) --</option>{departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select>
                  </div>
                  <div className="sm:col-span-2 mt-6 flex justify-end">
                    <button type="submit" className={`w-full sm:w-auto px-12 py-5 text-white rounded-full font-black shadow-xl transition-all text-base hover-engine-shake active:scale-90 active:rotate-[3deg] ${editingId ? 'bg-[#088cb3] hover:bg-[#067292] shadow-[#088cb3]/40 border-b-4 border-[#065b75]' : 'bg-[#a42f56] hover:bg-[#8b2749] shadow-[#a42f56]/40 border-b-4 border-[#7a1f3c]'}`}>
                      {editingId ? '😎 อัปเดตทรงนักบิด' : '🛵 เซ็นสัญญา รับคนเข้าแก๊ง!'}
                    </button>
                  </div>
                </form>
              )}

              {/* ฟอร์มตารางงาน */}
              {activeMenu === 'tasks' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'tasks', taskData)} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div><label className={labelStyle}>ชื่อลายแทง (ไปแว้นไหน) *</label><input type="text" required placeholder="เช่น ไปรับสาวหน้าปากซอย" value={taskData.name} onChange={e => setTaskData({...taskData, name: e.target.value})} className={inputStyle} /></div>
                  <div>
                    <label className={labelStyle}>โยนงานให้ซุ้มไหน?</label>
                    <select value={taskData.department_id} onChange={e => setTaskData({...taskData, department_id: e.target.value})} className={inputStyle}><option value="">-- ไปคนเดียวเฟี้ยวๆ --</option>{departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}</select>
                  </div>
                  <div className="sm:col-span-2 mt-6 flex justify-end">
                    <button type="submit" className={`w-full sm:w-auto px-12 py-5 text-white rounded-full font-black shadow-xl transition-all text-base hover-engine-shake active:scale-90 active:-rotate-3 ${editingId ? 'bg-[#088cb3] shadow-[#088cb3]/40 border-b-4 border-[#065b75]' : 'bg-[#a42f56] shadow-[#a42f56]/40 border-b-4 border-[#7a1f3c]'}`}>
                      {editingId ? '🗺️ เปลี่ยนลายแทงกะทันหัน' : '🏁 แจกเควส สร้างภารกิจ!'}
                    </button>
                  </div>
                </form>
              )}

              {/* ฟอร์มแผนก */}
              {activeMenu === 'departments' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'departments', departmentData)} className="grid grid-cols-1 sm:grid-cols-4 gap-6 items-end">
                  <div className="sm:col-span-3"><label className={labelStyle}>ชื่อซุ้ม / ชื่อแก๊งใหม่ *</label><input type="text" required placeholder="เช่น กฟล. แก๊งลูกหมู" value={departmentData.name} onChange={e => setDepartmentData({...departmentData, name: e.target.value})} className={inputStyle} /></div>
                  <div className="sm:col-span-1 mt-4 sm:mt-0">
                    <button type="submit" className={`w-full py-5 text-white rounded-full font-black shadow-xl transition-all text-base hover-engine-shake active:scale-90 active:rotate-3 ${editingId ? 'bg-[#088cb3] shadow-[#088cb3]/40 border-b-4 border-[#065b75]' : 'bg-[#a42f56] shadow-[#a42f56]/40 border-b-4 border-[#7a1f3c]'}`}>
                      {editingId ? '🏢 โมดิฟายซุ้มเดิม' : '🏢 ตั้งซุ้มใหม่ เบ่งบารมี!'}
                    </button>
                  </div>
                </form>
              )}

              {/* 📍 ฟอร์มสถานที่ (operation_areas) */}
              {activeMenu === 'operation_areas' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'operation_areas', operationAreaData)} className="grid grid-cols-1 sm:grid-cols-4 gap-6 items-end">
                  <div className="sm:col-span-3">
                    <label className={labelStyle}>ชื่อสถานที่ / จุดเกิดเหตุ *</label>
                    <input type="text" required placeholder="เช่น ท้ายซอย 4, ลานกว้างหน้าห้าง" value={operationAreaData.name} onChange={e => setOperationAreaData({...operationAreaData, name: e.target.value})} className={inputStyle} />
                  </div>
                  <div className="sm:col-span-1 mt-4 sm:mt-0">
                    <button type="submit" className={`w-full py-5 text-white rounded-full font-black shadow-xl transition-all text-base hover-engine-shake active:scale-90 active:rotate-3 ${editingId ? 'bg-[#088cb3] shadow-[#088cb3]/40 border-b-4 border-[#065b75]' : 'bg-[#a42f56] shadow-[#a42f56]/40 border-b-4 border-[#7a1f3c]'}`}>
                      {editingId ? '📍 ย้ายจุดนัดพบ' : '📍 ปักหมุดที่ใหม่!'}
                    </button>
                  </div>
                </form>
              )}
              </div>
            </div>

            {/* ส่วนที่ 2: รายการข้อมูล */}
            <div className="bg-white/95 backdrop-blur-md rounded-[3rem] shadow-[0_20px_50px_rgba(0,0,0,0.03)] border-2 border-gray-100 overflow-hidden transition-all">
              <div className="p-8 border-b-2 border-gray-100 bg-gray-50 flex justify-between items-center">
                <h3 className="text-sm font-black text-gray-600 uppercase tracking-widest flex items-center gap-3">
                  <img src="/scooter.png" alt="icon" className="w-12 animate-super-float-fast drop-shadow-lg" /> รายการของในโกดัง
                </h3>
                <span className="bg-[#088cb3] text-white py-2 px-6 rounded-full text-sm font-black shadow-md active:scale-75 transition-transform cursor-pointer hover-engine-shake">
                  โผล่มาแล้ว {activeMenu === 'cars' ? carsList.length : activeMenu === 'staff' ? staffList.length : activeMenu === 'tasks' ? tasksList.length : activeMenu === 'departments' ? departmentsList.length : operationAreasList.length} ตัว
                </span>
              </div>

              <div className="overflow-x-auto p-4 sm:p-8 scroll-smooth">
                {activeMenu === 'cars' && (
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[800px]">
                    <thead><tr className="border-b-4 border-gray-100"><th className="pb-4 pt-2 px-5 text-gray-400 font-black uppercase text-xs tracking-widest">ทะเบียนรถ</th><th className="pb-4 pt-2 px-5 text-gray-400 font-black uppercase text-xs tracking-widest">ทรงรถ/รุ่น</th><th className="pb-4 pt-2 px-5 text-gray-400 font-black uppercase text-xs tracking-widest">ซดอะไร</th><th className="pb-4 pt-2 px-5 text-gray-400 font-black uppercase text-xs tracking-widest">แก๊งไหนคุม</th><th className="pb-4 pt-2 px-5 text-center text-gray-400 font-black uppercase text-xs tracking-widest w-36">จะเอายังไง?</th></tr></thead>
                    <tbody className="divide-y-2 divide-gray-50">
                      {carsList.map(item => (
                        <tr key={item.id} className="hover:bg-[#088cb3]/5 transition-all group active:scale-[0.98] cursor-pointer">
                          <td className="p-5 font-black text-[#088cb3] text-xl">{item.plate_number}</td>
                          <td className="p-5"><p className="text-gray-900 font-black text-base">{item.model || 'ไม่มีรุ่น (รถประกอบเองอ่อ)'}</p><p className="text-xs text-gray-400 font-bold mt-1">{item.car_type || 'รถไรวะดูไม่ออก'}</p></td>
                          <td className="p-5"><span className={`px-4 py-2 text-xs font-black rounded-full shadow-sm border-b-2 ${item.fuel_type === 'EV' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>{item.fuel_type === 'EV' ? '⚡ ซดไฟเงียบๆ' : '🛢️ น้ำมันสายเบิร์น'}</span></td>
                          <td className="p-5 text-gray-600 text-sm font-bold">{item.department || 'ลอยนวล (ไม่ระบุ)'}</td>
                          <td className="p-5 flex justify-center gap-3">
                            <button onClick={() => handleEdit('cars', item)} className="w-12 h-12 flex items-center justify-center bg-white hover:bg-[#088cb3] hover:text-white text-gray-500 rounded-2xl transition-all border-2 border-gray-200 shadow-sm text-xl active:scale-50 active:rotate-45">✏️</button>
                            <button onClick={() => confirmDelete('cars', item)} className="w-12 h-12 flex items-center justify-center bg-white hover:bg-red-500 hover:text-white text-gray-500 rounded-2xl transition-all border-2 border-gray-200 shadow-sm text-xl active:scale-50 active:-rotate-45 hover-engine-shake">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {activeMenu === 'staff' && (
                  <table className="w-full text-left text-sm whitespace-nowrap min-w-[700px]">
                    <thead><tr className="border-b-4 border-gray-100"><th className="pb-4 pt-2 px-5 text-gray-400 font-black uppercase text-xs tracking-widest">รหัสลับ</th><th className="pb-4 pt-2 px-5 text-gray-400 font-black uppercase text-xs tracking-widest">ชื่อฉายา</th><th className="pb-4 pt-2 px-5 text-gray-400 font-black uppercase text-xs tracking-widest">ทรงไหน</th><th className="pb-4 pt-2 px-5 text-gray-400 font-black uppercase text-xs tracking-widest">เด็กซุ้มไหน</th><th className="pb-4 pt-2 px-5 text-center text-gray-400 font-black uppercase text-xs tracking-widest w-36">จะเอายังไง?</th></tr></thead>
                    <tbody className="divide-y-2 divide-gray-50">
                      {staffList.map(item => (
                        <tr key={item.id} className="hover:bg-[#a42f56]/5 transition-all group active:scale-[0.98] cursor-pointer">
                          <td className="p-5 font-bold text-gray-400 text-base">{item.staff_code}</td>
                          <td className="p-5 font-black text-gray-900 text-lg flex items-center gap-3"><img src="/scooter.png" className="w-10 drop-shadow-md group-hover:animate-super-float-fast group-hover:rotate-12 transition-transform" alt="avt" /> {item.full_name}</td>
                          <td className="p-5 text-gray-500 text-sm font-bold">{item.position || 'ทรงโจร (ไม่ระบุ)'}</td>
                          <td className="p-5"><span className="text-xs font-black text-[#a42f56] bg-[#a42f56]/10 px-4 py-2 rounded-full shadow-inner border border-[#a42f56]/20">{item.departments?.name || 'หมาป่าเดียวดาย'}</span></td>
                          <td className="p-5 flex justify-center gap-3">
                            <button onClick={() => handleEdit('staff', item)} className="w-12 h-12 flex items-center justify-center bg-white hover:bg-[#a42f56] hover:text-white text-gray-500 rounded-2xl transition-all border-2 border-gray-200 shadow-sm text-xl active:scale-50 active:rotate-45">✏️</button>
                            <button onClick={() => confirmDelete('staff', item)} className="w-12 h-12 flex items-center justify-center bg-white hover:bg-red-500 hover:text-white text-gray-500 rounded-2xl transition-all border-2 border-gray-200 shadow-sm text-xl active:scale-50 active:-rotate-45 hover-engine-shake">🗑️</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* 📍 แสดงเป็นแบบกล่องการ์ดเหมือนกัน สำหรับ งาน, แผนก, และสถานที่ */}
                {(activeMenu === 'tasks' || activeMenu === 'departments' || activeMenu === 'operation_areas') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(activeMenu === 'tasks' ? tasksList : activeMenu === 'departments' ? departmentsList : operationAreasList).map(item => (
                      <div key={item.id} className="p-8 border-2 border-gray-100 rounded-[3rem] hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] transition-all bg-white relative overflow-hidden group active:scale-95 active:rotate-1 cursor-pointer">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-bl-[100%] group-hover:bg-[#088cb3]/10 transition-colors duration-500"></div>
                        <img src="/scooter.png" className="absolute -bottom-10 -right-5 w-40 opacity-10 group-hover:opacity-30 group-hover:scale-125 group-hover:-rotate-[20deg] transition-all duration-500" alt="bg" />
                        
                        <h4 className="font-black text-gray-900 text-2xl mb-3 tracking-tight relative z-10 leading-tight">{item.name}</h4>
                        {activeMenu === 'tasks' && <p className="text-xs text-gray-500 font-black mb-6 uppercase tracking-wider relative z-10 bg-gray-100 inline-block px-4 py-1.5 rounded-full border border-gray-200 shadow-inner">สังกัดซุ้ม: {item.departments?.name || 'ไม่มีสังกัด!'}</p>}
                        
                        <div className="flex gap-3 mt-6 relative z-10">
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(activeMenu, item) }} className="px-6 py-3.5 text-xs font-black bg-white hover:bg-[#088cb3] hover:text-white rounded-full transition-all text-gray-600 border-2 border-gray-200 shadow-sm active:scale-75 active:rotate-6">โมดิฟาย (Edit)</button>
                          <button onClick={(e) => { e.stopPropagation(); confirmDelete(activeMenu, item) }} className="px-6 py-3.5 text-xs font-black bg-white hover:bg-red-500 hover:text-white rounded-full transition-all text-gray-600 border-2 border-gray-200 shadow-sm active:scale-75 active:-rotate-6 hover-engine-shake">บดทิ้ง (Delete)</button>
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