'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import PageSkeleton from '@/app/components/PageSkeleton'
import CarQrLabel from '@/app/components/CarQrLabel'
import DataManagementPanel from '@/app/admin/components/DataManagementPanel'
import DiscordAuditPanel from '@/app/admin/components/DiscordAuditPanel'
import { CAR_IMAGE_BUCKET, getCarImage, getLegacyCarImage } from '@/lib/carImages'
import { countPendingAnomalies } from '@/lib/tripAnomalies'

// เพิ่ม is_visible เข้าไปใน initial data (ค่าเริ่มต้นให้แสดงผล)
const initialCarData = { plate_number: '', model: '', car_type: '', fuel_type: 'ดีเซล', status: 'available', budget: '', department_id: '', usage_type: '', ownership_type: '', is_visible: true, image_path: '' }
const initialStaffData = { staff_code: '', full_name: '', position: '', department_id: '' }
const initialTaskData = { name: '', department_id: '' }
const initialDepartmentData = { name: '' }
const initialOperationAreaData = { name: '' }

const fieldLabels = {
  plate_number: 'ป้ายทะเบียน', model: 'ยี่ห้อ/รุ่น', car_type: 'ประเภทรถ', fuel_type: 'ประเภทพลังงาน', 
  budget: 'งบประมาณจัดหา', usage_type: 'ลักษณะการใช้งาน', ownership_type: 'กรรมสิทธิ์',
  image_path: 'รูปรถ', status: 'สถานะ', is_visible: 'แสดงหน้า Home',
  staff_code: 'รหัสพนักงาน', full_name: 'ชื่อ-นามสกุล', position: 'ตำแหน่ง', department_id: 'รหัสแผนก',
  name: 'ชื่อรายการ (แผนก/สถานที่/งาน)' 
}

export default function AdminDashboard() {
  const router = useRouter()
  const [loadingSession, setLoadingSession] = useState(true)
  const [activeMenu, setActiveMenu] = useState('cars')

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
  const [carImageFile, setCarImageFile] = useState(null)
  const [carImagePreview, setCarImagePreview] = useState('')
  const [removeCarImage, setRemoveCarImage] = useState(false)
  const [qrCar, setQrCar] = useState(null)
  const [isMigratingImages, setIsMigratingImages] = useState(false)
  const [mileageAnomalyCount, setMileageAnomalyCount] = useState(0)
  const [pendingBillingCount, setPendingBillingCount] = useState(0)

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error || !user || user.app_metadata?.role !== 'admin') {
        if (user) await supabase.auth.signOut()
        router.replace('/admin/login')
      }
      else { setLoadingSession(false); fetchDepartmentsOptions() }
    }
    checkSession()
  }, [router])

  const fetchDepartmentsOptions = async () => {
    const { data, error } = await supabase.from('departments').select('id, name').order('name')
    if (!error && data) setDepartmentsOptions(data)
  }

  const fetchMileageAnomalyCount = useCallback(async () => {
    const [logsResult, reviewsResult] = await Promise.all([
      supabase
        .from('trip_logs')
        .select('id, created_at, car_id, start_time, start_mileage, end_mileage, battery_before, battery_after, is_completed, cars(id, fuel_type)')
        .order('start_time', { ascending: false })
        .limit(500),
      supabase
        .from('trip_anomaly_reviews')
        .select('trip_log_id, issue_fingerprint'),
    ])

    if (!logsResult.error && !reviewsResult.error) {
      setMileageAnomalyCount(countPendingAnomalies(logsResult.data || [], reviewsResult.data || []))
    }
  }, [])

  const fetchPendingBillingCount = useCallback(async () => {
    const { count, error } = await supabase
      .from('car_maintenance_records')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .eq('billing_status', 'pending_invoice')
    if (!error) setPendingBillingCount(count || 0)
  }, [])

  useEffect(() => {
    if (loadingSession) return undefined
    fetchMileageAnomalyCount()
    fetchPendingBillingCount()
    const refreshManagementCounts = () => {
      fetchMileageAnomalyCount()
      fetchPendingBillingCount()
    }
    const interval = window.setInterval(refreshManagementCounts, 60000)
    const refreshWhenVisible = () => document.visibilityState === 'visible' && refreshManagementCounts()
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [loadingSession, fetchMileageAnomalyCount, fetchPendingBillingCount])

  const fetchData = useCallback(async () => {
    try {
      if (activeMenu === 'cars') {
        const { data } = await supabase.from('cars').select('*, departments(name)').order('id', { ascending: false })
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
        await supabase.rpc('log_admin_session_event', { p_event_type: 'logout' })
        await supabase.auth.signOut()
        router.replace('/') 
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setCarData(initialCarData); setStaffData(initialStaffData)
    setTaskData(initialTaskData); setDepartmentData(initialDepartmentData)
    setOperationAreaData(initialOperationAreaData)
    if (carImagePreview?.startsWith('blob:')) URL.revokeObjectURL(carImagePreview)
    setCarImageFile(null)
    setCarImagePreview('')
    setRemoveCarImage(false)
  }

  const handleEdit = (type, data) => {
    setEditingId(data.id)
    const cleanData = { ...data }
    delete cleanData.departments 

    if (type === 'cars') {
      setCarData({ ...cleanData, department_id: cleanData.department_id || '', image_path: cleanData.image_path || '' })
      setCarImageFile(null)
      setCarImagePreview(getCarImage(cleanData) || '')
      setRemoveCarImage(false)
    }
    if (type === 'staff') setStaffData({ ...cleanData, department_id: cleanData.department_id || '' })
    if (type === 'tasks') setTaskData({ ...cleanData, department_id: cleanData.department_id || '' })
    if (type === 'departments') setDepartmentData(cleanData)
    if (type === 'operation_areas') setOperationAreaData(cleanData)
    
    document.getElementById('form-section').scrollIntoView({ behavior: 'smooth' })
  }

  const handleCarImageChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    if (!allowedTypes.includes(file.type)) {
      alert('รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ AVIF')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('ขนาดรูปต้องไม่เกิน 5 MB')
      event.target.value = ''
      return
    }
    if (carImagePreview?.startsWith('blob:')) URL.revokeObjectURL(carImagePreview)
    setCarImageFile(file)
    setCarImagePreview(URL.createObjectURL(file))
    setRemoveCarImage(false)
  }

  const uploadCarImage = async (carId, file) => {
    const imagePath = `cars/${carId}/main`
    const { error } = await supabase.storage.from(CAR_IMAGE_BUCKET).upload(imagePath, file, {
      upsert: true,
      contentType: file.type,
      cacheControl: '3600',
    })
    if (error) throw error
    return imagePath
  }

  const migrateLegacyImages = async () => {
    const carsToMigrate = carsList.filter(car => !car.image_path && getLegacyCarImage(car))
    if (carsToMigrate.length === 0) return
    setIsMigratingImages(true)
    try {
      const groupedCars = new Map()
      carsToMigrate.forEach(car => {
        const legacyImage = getLegacyCarImage(car)
        if (!groupedCars.has(legacyImage)) groupedCars.set(legacyImage, [])
        groupedCars.get(legacyImage).push(car.id)
      })

      for (const [legacyImage, carIds] of groupedCars) {
        const response = await fetch(legacyImage)
        if (!response.ok) throw new Error(`ไม่สามารถอ่านไฟล์เดิม ${legacyImage}`)
        const blob = await response.blob()
        const imagePath = `legacy/${legacyImage.split('/').pop()}`
        const { error: uploadError } = await supabase.storage.from(CAR_IMAGE_BUCKET).upload(imagePath, blob, {
          upsert: true,
          contentType: blob.type || 'image/png',
          cacheControl: '3600',
        })
        if (uploadError) throw uploadError
        const { error: updateError } = await supabase.from('cars').update({ image_path: imagePath }).in('id', carIds)
        if (updateError) throw updateError
      }
      alert(`ย้ายรูปรถเดิมเข้า Supabase Storage สำเร็จ ${carsToMigrate.length} คัน`)
      fetchData()
    } catch (error) {
      alert('ย้ายรูปเดิมไม่สำเร็จ: ' + error.message)
    } finally {
      setIsMigratingImages(false)
    }
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

    Object.keys(payload).forEach(key => {
      if (typeof payload[key] === 'string') payload[key] = payload[key].trim()
    })

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
      if (table === 'cars') {
        const insertPayload = { ...payload, image_path: null }
        const { data: newCar, error } = await supabase.from(table).insert([insertPayload]).select().single()
        if (error) throw error
        let savedCar = newCar
        if (carImageFile) {
          const imagePath = await uploadCarImage(newCar.id, carImageFile)
          const { data: updatedCar, error: updateError } = await supabase.from('cars').update({ image_path: imagePath }).eq('id', newCar.id).select().single()
          if (updateError) throw updateError
          savedCar = updatedCar
        }
        setQrCar(savedCar)
      } else {
        const { error } = await supabase.from(table).insert([payload])
        if (error) throw error
      }
      alert('บันทึกข้อมูลเข้าสู่ระบบสำเร็จ')
      cancelEdit(); fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const executeUpdate = async () => {
    setIsSubmitting(true)
    const { table, newData } = updateModal
    try {
      const updatePayload = { ...newData }
      const previousImagePath = table === 'cars' ? updateModal.oldData?.image_path : null
      if (table === 'cars' && carImageFile) updatePayload.image_path = await uploadCarImage(editingId, carImageFile)
      if (table === 'cars' && removeCarImage) updatePayload.image_path = null

      const { data, error } = await supabase.from(table).update(updatePayload).eq('id', editingId).select()
      if (error) throw error; 
      if (!data || data.length === 0) throw new Error('ไม่พบข้อมูลที่ต้องการแก้ไข');
      if (table === 'cars' && removeCarImage && previousImagePath?.startsWith('cars/')) {
        const { error: removeError } = await supabase.storage.from(CAR_IMAGE_BUCKET).remove([previousImagePath])
        if (removeError) console.error('Remove old car image:', removeError.message)
      }
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
      if (table === 'cars' && itemToDelete.image_path?.startsWith('cars/')) {
        const { error: removeError } = await supabase.storage.from(CAR_IMAGE_BUCKET).remove([itemToDelete.image_path])
        if (removeError) console.error('Remove car image:', removeError.message)
      }
      alert('ลบข้อมูลออกจากระบบเรียบร้อยแล้ว')
      setDeleteModal({ isOpen: false, table: '', data: null })
      fetchData(); if(table === 'departments') fetchDepartmentsOptions()
    } catch (error) { alert('เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message) } finally { setIsSubmitting(false) }
  }

  const uniqueCarValues = (field, defaults = []) => [...new Set([
    ...defaults,
    ...carsList.map(car => car[field]).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b, 'th'))

  const modelOptions = uniqueCarValues('model', ['อีซูซุ', 'โตโยต้า', 'นิสสัน', 'มิตซูบิชิ', 'ฮีโน่', 'MG'])
  const carTypeOptions = uniqueCarValues('car_type', ['รถกระบะ 4 ประตู', 'รถตู้โดยสาร', 'รถกระเช้าแก้ไฟ', 'รถเครน บรรทุก', 'รถบรรทุก 2 ตัน', 'รถ EV'])
  const usageTypeOptions = uniqueCarValues('usage_type')
  const carsWithoutStoredImages = carsList.filter(car => !car.image_path && getLegacyCarImage(car)).length

  // ผู้ที่ยังไม่ได้เข้าสู่ระบบจะถูกส่งไปหน้า Login จึงใช้โครง loading ของหน้า Login
  if (loadingSession) return <PageSkeleton variant="login" />

  const sidebarMenus = [
    { id: 'cars', icon: 'ph:car-profile-duotone', title: 'รถทั้งหมด', desc: 'Vehicles' },
    { id: 'mileage', icon: 'ph:database-duotone', title: 'แก้ไขข้อมูล', desc: 'Mileage & Repair' },
    { id: 'staff', icon: 'ph:users-three-duotone', title: 'บุคลากร', desc: 'Personnel' },
    { id: 'tasks', icon: 'ph:clipboard-text-duotone', title: 'ประเภทงาน', desc: 'Tasks' },
    { id: 'departments', icon: 'ph:buildings-duotone', title: 'แผนก', desc: 'Departments' },
    { id: 'operation_areas', icon: 'ph:map-pin-duotone', title: 'พื้นที่งาน', desc: 'Locations' },
    { id: 'discord', icon: 'ph:discord-logo-duotone', title: 'Discord Log', desc: 'Audit & Alerts' },
  ]
  const activeMenuObj = sidebarMenus.find(m => m.id === activeMenu)
  const dataManagementCount = mileageAnomalyCount + pendingBillingCount
  
  const inputStyle = "w-full rounded-[12px] border border-[#dfcfe4] bg-white px-4 py-3.5 text-[14px] text-[#35133f] placeholder-[#a892ad] focus:border-[#702082] focus:ring-2 focus:ring-[#702082]/10 outline-none transition-all shadow-[0_1px_2px_rgba(75,21,96,.03)]"
  const labelStyle = "text-[11px] font-bold text-[#702082] mb-2 block uppercase tracking-wider pl-1"

  return (
    <div className="kpn-screen kpn-admin pea-admin flex h-[calc(100dvh-60px)] bg-[#f3edf5] font-sans overflow-hidden p-0 md:p-4 gap-4" style={{ WebkitFontSmoothing: 'antialiased' }}>
      
      <style>{`
        * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbb6d1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #a98caf; }
        select option { background: #ffffff; color: #35133f; }
        .hide-admin-scrollbar::-webkit-scrollbar { display: none; }
        .hide-admin-scrollbar { scrollbar-width: none; }
        .admin-main tbody tr:hover { background: #fbf7fc !important; }
        .admin-main tbody { border-color: #eadfed !important; }
        .admin-main [class*="bg-[#3b1746]"] { background: #ffffff !important; }
        .admin-main [class*="bg-[#2a0f33]"] { background: #faf7fb !important; }
        .admin-main [class*="bg-[#54205f]"] { background: #f5edf7 !important; }
        .admin-main [class*="border-[#6b3475]"] { border-color: #eadfed !important; }
        .admin-main [class*="border-[#7e4a87]"] { border-color: #dfcfe4 !important; }
        .admin-main [class*="text-[#fffaf0]"] { color: #35133f !important; }
        .admin-main [class*="text-[#c9b8cd]"] { color: #765c7c !important; }
        .admin-main [class*="text-[#a688ad]"] { color: #8b6f92 !important; }
        .admin-main [class*="divide-[#6b3475]"] > :not(:last-child) { border-color: #eadfed !important; }
      `}</style>

      {qrCar && <CarQrLabel car={qrCar} onClose={() => setQrCar(null)} />}

      {/* 🔴 Delete Modal (Dark Theme) */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-[#eadfed] rounded-[24px] p-8 w-full max-w-md shadow-[0_24px_70px_rgba(75,21,96,.22)] text-center transform transition-all">
            <div className="w-16 h-16 bg-[#ff453a]/10 text-[#ff453a] rounded-full flex items-center justify-center mx-auto mb-5 border border-[#ff453a]/20">
              <Icon icon="ph:trash" width="32" height="32" />
            </div>
            <h3 className="text-xl font-semibold text-[#4b1560] mb-2 tracking-tight">Delete Record?</h3>
            <p className="text-[#765c7c] text-sm mb-6">This action cannot be undone. This will permanently delete the selected data.</p>
            <div className="bg-[#f8f3fa] text-[#35133f] p-4 rounded-xl mb-8 border border-[#eadfed] font-medium break-words">
              {deleteModal.data.plate_number || deleteModal.data.full_name || deleteModal.data.name}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteModal({ isOpen: false, table: '', data: null })} className="flex-1 py-3.5 bg-[#f1e6f4] hover:bg-[#e6d7ea] text-[#702082] rounded-[12px] font-semibold transition-all">Cancel</button>
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
          <div className="bg-white border border-[#eadfed] rounded-[24px] p-8 w-full max-w-2xl shadow-[0_24px_70px_rgba(75,21,96,.22)] max-h-[90vh] flex flex-col relative">
            <div className="flex items-center gap-4 mb-6 border-b border-[#eadfed] pb-5">
              <div className="w-12 h-12 bg-[#ffdd00] text-[#4b1560] rounded-full flex items-center justify-center border border-[#e7c900]">
                <Icon icon="ph:arrows-clockwise" width="24" height="24" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[#4b1560] tracking-tight">Confirm Changes</h3>
                <p className="text-[#765c7c] text-sm mt-0.5">Please review the updates before saving.</p>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 space-y-3 mb-8 pr-2">
              {Object.keys(updateModal.newData).map(key => {
                if (key === 'id' || key === 'created_at' || updateModal.oldData[key] === updateModal.newData[key]) return null;
                return (
                  <div key={key} className="bg-[#faf7fb] p-4 rounded-[12px] border border-[#eadfed] flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="sm:w-1/3 text-[11px] uppercase tracking-wider font-semibold text-[#765c7c]">{fieldLabels[key] || key}</div>
                    <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm">
                      <span className="text-[#846c89] line-through bg-white px-3 py-1.5 rounded-md border border-[#eadfed]">{updateModal.oldData[key] || '-'}</span>
                      <span className="hidden sm:inline text-[#7e4a87]"><Icon icon="ph:arrow-right-bold"/></span>
                      <span className="text-[#ffdd00] font-medium bg-[#ffdd00]/10 px-3 py-1.5 rounded-md border border-[#ffdd00]/20">{updateModal.newData[key] || '-'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-auto shrink-0">
              <button onClick={() => setUpdateModal({ isOpen: false, table: '', oldData: null, newData: null })} className="flex-1 py-3.5 bg-[#f1e6f4] hover:bg-[#e6d7ea] text-[#702082] rounded-[12px] font-semibold transition-all">Cancel</button>
              <button onClick={executeUpdate} disabled={isSubmitting} className="flex-1 py-3.5 bg-[#ffdd00] hover:bg-[#e8c900] text-[#3b1746] rounded-[12px] font-medium transition-all">
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar สำหรับจอใหญ่ */}
      <aside className="kpn-admin-sidebar hidden md:flex w-[272px] shrink-0 bg-gradient-to-b from-[#32103d] via-[#270d31] to-[#1d0925] border border-white/10 text-[#fffaf0] flex-col rounded-[26px] overflow-hidden shadow-[0_24px_70px_rgba(0,0,0,.28)] relative">
        <div className="absolute -top-20 -right-20 w-52 h-52 rounded-full bg-[#8e3ba0]/25 blur-3xl pointer-events-none"/>
        <div className="absolute bottom-10 -left-20 w-48 h-48 rounded-full bg-[#ffdd00]/5 blur-3xl pointer-events-none"/>
        
        <div className="h-[106px] flex items-center gap-3.5 px-6 shrink-0 border-b border-white/10 relative z-10">
          <div className="w-11 h-11 bg-white rounded-[14px] p-1.5 flex items-center justify-center border-2 border-[#ffdd00] shadow-[0_8px_24px_rgba(255,221,0,.18)] overflow-hidden">
            <img src="/pea_logo.png" alt="PEA" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-white text-[17px] tracking-tight">Admin Portal</h1>
            <p className="text-[10px] text-[#cdb8d2] uppercase tracking-[.18em] font-semibold mt-1">PEA Fleet System</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2 relative z-10">
          <p className="mb-3 flex items-center gap-2 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-[#a98caf]">
            Management
            {dataManagementCount > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff453a] px-1.5 py-0.5 text-[9px] font-bold tracking-normal text-white shadow-[0_0_0_3px_rgba(255,69,58,.14)]">{dataManagementCount > 99 ? '99+' : dataManagementCount}</span>}
          </p>
          {sidebarMenus.map(menu => (
            <button 
              key={menu.id} 
              onClick={() => setActiveMenu(menu.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-[15px] transition-all text-left group border ${
                activeMenu === menu.id 
                  ? 'bg-gradient-to-r from-[#6f287d] to-[#572063] text-white border-white/10 shadow-[0_8px_22px_rgba(0,0,0,.18)]'
                  : 'text-[#c9b8cd] border-transparent hover:bg-white/[.06] hover:text-white'
              }`}
            >
              <span className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${activeMenu === menu.id ? 'bg-[#ffdd00] text-[#4b1560]' : 'bg-white/[.06] text-[#c9b8cd] group-hover:text-white'}`}>
                <Icon icon={menu.icon} width="22" height="22" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold text-[14px]">
                  {menu.title}
                  {menu.id === 'mileage' && dataManagementCount > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff453a] px-1.5 py-0.5 text-[9px] font-bold leading-none text-white">{dataManagementCount > 99 ? '99+' : dataManagementCount}</span>}
                </span>
                <span className={`block text-[10px] mt-0.5 ${activeMenu === menu.id ? 'text-white/65' : 'text-[#94789b]'}`}>{menu.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="p-4 shrink-0 border-t border-white/10 relative z-10">
          <div className="flex items-center gap-3 px-2 pb-3">
            <span className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-[#ffdd00] font-bold text-[12px]">A</span>
            <div><p className="text-[12px] font-semibold text-white">Admin PEA</p><p className="text-[9px] text-[#62d98b] mt-0.5">● Online</p></div>
          </div>
          <button onClick={handleLogout} className="w-full py-3 rounded-[12px] bg-white/[.06] hover:bg-[#ff453a]/15 text-[#e4d6e7] hover:text-[#ff8d87] transition-all text-[12px] font-semibold flex items-center justify-center gap-2 border border-white/10 hover:border-[#ff453a]/30">
             <Icon icon="ph:sign-out-bold" width="18" height="18" />
             ออกจากระบบ
          </button>
        </div>
      </aside>

      {/* 👉 Main Content */}
      <main className="admin-main min-w-0 flex-1 bg-[radial-gradient(circle_at_top_right,_#fff6bd_0%,_#fbf7fc_24%,_#f6f0f8_100%)] flex flex-col overflow-hidden relative md:rounded-[26px] md:border md:border-[#e5d6e9] md:shadow-[0_20px_60px_rgba(75,21,96,.12)]">
        
        {/* Header */}
        <header className="kpn-dashboard-nav min-h-[76px] bg-white/90 backdrop-blur-xl flex items-center justify-between px-4 sm:px-7 shrink-0 z-20 border-t-[4px] border-t-[#ffdd00] border-b border-b-[#eadfed] sticky top-0 shadow-[0_4px_20px_rgba(75,21,96,.04)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="md:hidden w-10 h-10 bg-white rounded-[13px] p-1.5 flex items-center justify-center border-2 border-[#ffdd00] shrink-0 shadow-[0_6px_20px_rgba(255,221,0,.16)] overflow-hidden"><img src="/pea_logo.png" alt="PEA" className="w-full h-full object-contain" /></div>
            <div>
                <p className="md:hidden text-[9px] text-[#8b3c98] uppercase tracking-[.16em] font-semibold mb-0.5">Admin Portal</p>
                <h1 className="flex items-center gap-2 text-[18px] font-bold tracking-tight text-[#4b1560] md:text-[24px]">{activeMenuObj?.title}{activeMenu === 'mileage' && dataManagementCount > 0 && <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-[#ff453a] px-1.5 py-0.5 text-[10px] font-bold text-white">{dataManagementCount > 99 ? '99+' : dataManagementCount}</span>}</h1>
                <p className="hidden md:block text-[11px] text-[#846c89] mt-0.5">จัดการข้อมูล {activeMenuObj?.desc} ของระบบ</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block text-right">
                <p className="text-[13px] font-semibold text-[#4b1560]">Admin_PEA</p>
                <p className="text-[10px] text-[#34c759] font-medium tracking-wide">● Online</p>
            </div>
            <button onClick={handleLogout} aria-label="ออกจากระบบ" className="h-10 px-3 sm:px-4 rounded-[12px] border border-[#e3d4e7] bg-[#f7f1f8] text-[#702082] hover:bg-[#fff0ef] hover:text-[#d33c35] active:scale-95 transition-all flex items-center gap-2 text-[11px] font-semibold">
              <Icon icon="ph:sign-out-bold" width="19" height="19" />
              <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </header>

        {/* เมนูมือถือ: ไม่บังเนื้อหาและเลื่อนได้แนวนอน */}
        <nav className="md:hidden shrink-0 flex gap-2 overflow-x-auto hide-admin-scrollbar px-4 py-3 bg-white/80 border-b border-[#eadfed] backdrop-blur-lg">
          {sidebarMenus.map(menu => (
            <button key={menu.id} onClick={() => setActiveMenu(menu.id)} className={`shrink-0 h-11 px-3.5 rounded-[13px] flex items-center gap-2 border transition-all active:scale-95 ${activeMenu === menu.id ? 'bg-[#ffdd00] border-[#e5c700] text-[#4b1560] shadow-[0_6px_18px_rgba(255,221,0,.18)]' : 'bg-white border-[#e7dbe9] text-[#765c7c]'}`}>
              <Icon icon={menu.icon} width="19" height="19" />
              <span className="text-[12px] font-bold whitespace-nowrap">{menu.title}</span>
              {menu.id === 'mileage' && dataManagementCount > 0 && <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#ff453a] px-1.5 py-0.5 text-[9px] font-bold text-white">{dataManagementCount > 99 ? '99+' : dataManagementCount}</span>}
            </button>
          ))}
        </nav>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6 pb-12">

            {activeMenu === 'mileage' ? (
              <DataManagementPanel
                mileageAnomalyCount={mileageAnomalyCount}
                pendingBillingCount={pendingBillingCount}
                onAnomalyCountChange={setMileageAnomalyCount}
                onPendingBillingCountChange={setPendingBillingCount}
              />
            ) : activeMenu === 'discord' ? (
              <DiscordAuditPanel />
            ) : (
              <>

            {/* ส่วนที่ 1: ฟอร์ม (Dark Card) */}
            <div id="form-section" className="bg-white p-6 sm:p-8 rounded-[22px] border border-[#eadfed] shadow-[0_12px_36px_rgba(75,21,96,.07)]">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                <h3 className="text-[18px] font-bold text-[#4b1560] flex items-center gap-3 tracking-tight">
                  {editingId ? 
                    <><Icon icon="ph:pencil-simple" className="text-[#ffdd00]" width="22" height="22" /> Edit Record (ID: {editingId})</> :
                    <><Icon icon="ph:plus-circle" className="text-[#702082]" width="22" height="22" /> Add New Record</>
                  }
                </h3>
                {editingId && <button onClick={cancelEdit} className="text-[12px] bg-[#f3eaf5] text-[#702082] px-4 py-2 rounded-[10px] font-semibold hover:bg-[#eadfed] transition-all border border-[#dfcfe4]">Cancel Edit</button>}
              </div>

              {/* ฟอร์มรถ */}
              {activeMenu === 'cars' && (
                <form onSubmit={(e) => handlePreSubmit(e, 'cars', carData)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div><label className={labelStyle}>ทะเบียนรถ *</label><input type="text" required placeholder="เช่น 1กข-1234 กทม." value={carData.plate_number} onChange={e => setCarData({...carData, plate_number: e.target.value})} className={inputStyle} /></div>
                  <div><label className={labelStyle}>ยี่ห้อ / รุ่น</label><input list="car-model-options" type="text" placeholder="เลือกหรือพิมพ์รุ่นใหม่" value={carData.model} onChange={e => setCarData({...carData, model: e.target.value})} className={inputStyle} /><datalist id="car-model-options">{modelOptions.map(value => <option key={value} value={value} />)}</datalist></div>
                  <div><label className={labelStyle}>ประเภทรถ</label><input list="car-type-options" type="text" placeholder="เลือกหรือพิมพ์ประเภทใหม่" value={carData.car_type} onChange={e => setCarData({...carData, car_type: e.target.value})} className={inputStyle} /><datalist id="car-type-options">{carTypeOptions.map(value => <option key={value} value={value} />)}</datalist></div>
                  <div><label className={labelStyle}>ประเภทพลังงาน</label><select value={carData.fuel_type} onChange={e => setCarData({...carData, fuel_type: e.target.value})} className={inputStyle}><option value="ดีเซล">ดีเซล</option><option value="เบนซิน">เบนซิน</option><option value="Gas">Gasoline</option><option value="EV">ไฟฟ้า (EV)</option><option value="Hybrid">ไฮบริด</option></select></div>

                  <div><label className={labelStyle}>กรรมสิทธิ์</label><select value={carData.ownership_type || ''} onChange={e => setCarData({...carData, ownership_type: e.target.value})} className={inputStyle}><option value="">-- เลือกกรรมสิทธิ์ --</option><option value="รถของการไฟฟ้า">รถของการไฟฟ้า</option><option value="รถเช่า">รถเช่า</option><option value="รถยืมใช้">รถยืมใช้</option></select></div>
                  <div>
                    <label className={labelStyle}>แผนกผู้รับผิดชอบ</label>
                    <select
                      value={carData.department_id}
                      onChange={e => {
                        const departmentId = e.target.value
                        setCarData({
                          ...carData,
                          department_id: departmentId,
                        })
                      }}
                      className={inputStyle}
                    >
                      <option value="">-- ยังไม่ระบุแผนก --</option>
                      {departmentsOptions.map(dept => (<option key={dept.id} value={dept.id}>{dept.name}</option>))}
                    </select>
                  </div>
                  <div><label className={labelStyle}>ลักษณะการใช้งาน</label><input list="car-usage-options" type="text" placeholder="เลือกหรือพิมพ์งานใหม่" value={carData.usage_type || ''} onChange={e => setCarData({...carData, usage_type: e.target.value})} className={inputStyle} /><datalist id="car-usage-options">{usageTypeOptions.map(value => <option key={value} value={value} />)}</datalist></div>
                  <div><label className={labelStyle}>งบประมาณจัดหา</label><select value={carData.budget || ''} onChange={e => setCarData({...carData, budget: e.target.value})} className={inputStyle}><option value="">-- ยังไม่ระบุ --</option><option value="ทำการ">งบทำการ</option><option value="ลงทุน">งบลงทุน</option></select></div>
                  <div><label className={labelStyle}>สถานะเริ่มต้น</label><select value={carData.status} onChange={e => setCarData({...carData, status: e.target.value})} className={inputStyle}><option value="available">ว่างพร้อมใช้</option><option value="busy">กำลังใช้งาน</option><option value="maintenance" disabled>กำลังซ่อม (จัดการจากหน้า Home)</option></select></div>
                  <div><label className={labelStyle}>แสดงที่หน้า Home</label><select value={String(carData.is_visible !== false)} onChange={e => setCarData({...carData, is_visible: e.target.value === 'true'})} className={inputStyle}><option value="true">แสดงรถ</option><option value="false">ซ่อนรถ</option></select></div>

                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className={labelStyle}>รูปรถ (JPG, PNG, WebP, AVIF · ไม่เกิน 5 MB)</label>
                    <label className="flex min-h-[116px] cursor-pointer items-center gap-4 rounded-[16px] border-2 border-dashed border-[#d9c8de] bg-[#fcf9fd] p-4 transition-colors hover:border-[#702082]">
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleCarImageChange} className="hidden" />
                      {carImagePreview ? <img src={carImagePreview} alt="ตัวอย่างรูปรถ" className="h-20 w-28 rounded-[12px] border border-[#eadfed] bg-white object-cover" /> : <span className="flex h-20 w-28 items-center justify-center rounded-[12px] bg-[#f1e6f4] text-[#702082]"><Icon icon="ph:image-square-duotone" width="34" height="34" /></span>}
                      <span className="min-w-0"><span className="block text-[13px] font-bold text-[#4b1560]">{carImageFile ? carImageFile.name : carImagePreview ? 'คลิกเพื่อเปลี่ยนรูปรถ' : 'คลิกเพื่อเลือกรูปรถ'}</span><span className="mt-1 block text-[11px] text-[#846c89]">รูปนี้จะเก็บใน Supabase Storage และแสดงบนหน้า Home</span></span>
                    </label>
                    {(carImageFile || carData.image_path) && <button type="button" onClick={() => { if (carImagePreview.startsWith('blob:')) URL.revokeObjectURL(carImagePreview); setCarImageFile(null); setCarImagePreview(''); setCarData({...carData, image_path: ''}); setRemoveCarImage(true) }} className="mt-2 text-[11px] font-semibold text-[#d33c35]">ลบรูปที่เลือก</button>}
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    {carsWithoutStoredImages > 0 && <button type="button" onClick={migrateLegacyImages} disabled={isMigratingImages} className="rounded-[12px] border border-[#dfcfe4] bg-[#f5edf7] px-4 py-3 text-[12px] font-bold text-[#702082] disabled:opacity-50"><Icon icon="ph:database-duotone" width="17" height="17" className="mr-1 inline" />{isMigratingImages ? 'กำลังย้ายรูป...' : `นำรูปเดิมเข้า Storage (${carsWithoutStoredImages} คัน)`}</button>}
                    <button type="submit" disabled={isSubmitting} className="rounded-[12px] bg-[#ffdd00] px-6 py-3.5 text-[14px] font-bold text-[#3b1746] transition-all hover:bg-[#e8c900] disabled:opacity-50">
                      {isSubmitting ? 'กำลังบันทึก...' : editingId ? 'บันทึกการแก้ไข' : 'สร้างรถและ QR Code'}
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
                    <button type="submit" className="px-8 py-3.5 bg-[#ffdd00] hover:bg-[#e8c900] text-[#3b1746] rounded-[10px] font-medium transition-all text-[14px]">
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
                    <button type="submit" className="px-8 py-3.5 bg-[#ffdd00] hover:bg-[#e8c900] text-[#3b1746] rounded-[10px] font-medium transition-all text-[14px]">
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
                  <button type="submit" className="w-full sm:w-auto px-8 py-3.5 bg-[#ffdd00] hover:bg-[#e8c900] text-[#3b1746] rounded-[10px] font-medium transition-all text-[14px] shrink-0">
                    {editingId ? 'Save Changes' : 'Save Record'}
                  </button>
                </form>
              )}
            </div>

            {/* ส่วนที่ 2: รายการข้อมูล (Table) */}
            <div className="bg-white rounded-[22px] border border-[#eadfed] overflow-hidden shadow-[0_12px_36px_rgba(75,21,96,.07)]">
              <div className="px-6 py-5 border-b border-[#eadfed] flex justify-between items-center bg-white">
                <h3 className="text-[13px] font-bold text-[#4b1560] tracking-wider uppercase">Database Records</h3>
                <span className="bg-[#fff7bf] text-[#4b1560] py-1 px-3 rounded-full text-[11px] font-bold border border-[#f3df4b]">
                  {activeMenu === 'cars' ? carsList.length : activeMenu === 'staff' ? staffList.length : activeMenu === 'tasks' ? tasksList.length : activeMenu === 'departments' ? departmentsList.length : operationAreasList.length} ITEMS
                </span>
              </div>

              <div className="overflow-x-auto">
                {activeMenu === 'cars' && (
                  <table className="w-full text-left whitespace-nowrap min-w-[1060px]">
                    <thead className="bg-[#3b1746]"><tr className="border-b border-[#6b3475]">
                      <th className="py-4 px-6 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest w-24">Display</th>
                      <th className="py-4 px-4 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest">Image</th>
                      <th className="py-4 px-4 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest">License Plate</th>
                      <th className="py-4 px-4 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest">Model & Type</th>
                      <th className="py-4 px-4 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest">Energy</th>
                      <th className="py-4 px-4 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest">Department</th>
                      <th className="py-4 px-6 text-center text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest w-24">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#6b3475]">
                      {carsList.map(item => (
                        <tr key={item.id} className="hover:bg-[#54205f] transition-colors group">
                          
                          {/* Toggle Switch */}
                          <td className="p-4 px-6">
                            <button
                              type="button"
                              onClick={() => toggleCarVisibility(item.id, item.is_visible)}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                item.is_visible !== false ? 'bg-[#34c759]' : 'bg-[#7e4a87]'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  item.is_visible !== false ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </td>

                          <td className="p-3 px-4">
                            {getCarImage(item) ? <img src={getCarImage(item)} alt={item.plate_number} className="h-12 w-16 rounded-[10px] border border-[#eadfed] bg-white object-cover" /> : <span className="flex h-12 w-16 items-center justify-center rounded-[10px] bg-[#f1e6f4] text-[#702082]"><Icon icon="ph:car-profile-duotone" width="26" height="26" /></span>}
                          </td>

                          <td className="p-4 px-4">
                            <span className="font-medium text-[#fffaf0] text-[14px] bg-[#54205f] px-3 py-1.5 rounded-[6px] border border-[#7e4a87]">{item.plate_number}</span>
                          </td>
                          <td className="p-4 px-4"><p className="text-[#fffaf0] font-medium text-[13px]">{item.model || 'N/A'}</p><p className="text-[11px] text-[#c9b8cd] mt-0.5">{item.car_type || '-'}</p></td>
                          <td className="p-4 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider rounded-md border ${item.fuel_type === 'EV' ? 'bg-[#34c759]/10 text-[#34c759] border-[#34c759]/20' : 'bg-[#ff9f0a]/10 text-[#ff9f0a] border-[#ff9f0a]/20'}`}>
                              <Icon icon={item.fuel_type === 'EV' ? "ph:lightning" : "ph:gas-pump"} width="12" height="12" /> {item.fuel_type === 'EV' ? 'EV Mode' : 'Gasoline'}
                            </span>
                          </td>
                          <td className="p-4 px-4 text-[#c9b8cd] text-[13px]">{item.departments?.name || 'Unassigned'}</td>
                          <td className="p-4 px-6 flex justify-center gap-2">
                            <button type="button" onClick={() => setQrCar(item)} title="สร้าง QR Code" className="p-1.5 text-[#702082] transition-colors hover:text-[#4b1560]"><Icon icon="ph:qr-code-duotone" width="19" height="19" /></button>
                            <button type="button" onClick={() => handleEdit('cars', item)} title="แก้ไขรถ" className="p-1.5 text-[#c9b8cd] hover:text-[#fffaf0] transition-colors"><Icon icon="ph:pencil-simple" width="18" height="18" /></button>
                            <button type="button" onClick={() => confirmDelete('cars', item)} title="ลบรถ" className="p-1.5 text-[#c9b8cd] hover:text-[#ff453a] transition-colors"><Icon icon="ph:trash" width="18" height="18" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* ตารางพนักงาน */}
                {activeMenu === 'staff' && (
                  <table className="w-full text-left whitespace-nowrap min-w-[700px]">
                    <thead className="bg-[#3b1746]"><tr className="border-b border-[#6b3475]">
                      <th className="py-4 px-6 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest">ID</th>
                      <th className="py-4 px-6 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest">Name</th>
                      <th className="py-4 px-6 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest">Position</th>
                      <th className="py-4 px-6 text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest">Department</th>
                      <th className="py-4 px-6 text-center text-[#a688ad] font-semibold text-[10px] uppercase tracking-widest w-24">Action</th>
                    </tr></thead>
                    <tbody className="divide-y divide-[#6b3475]">
                      {staffList.map(item => (
                        <tr key={item.id} className="hover:bg-[#54205f] transition-colors group">
                          <td className="p-4 px-6 text-[12px] text-[#c9b8cd] font-medium">{item.staff_code}</td>
                          <td className="p-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-[#54205f] border border-[#7e4a87] flex items-center justify-center text-[#fffaf0] font-medium text-[11px]">{item.full_name.charAt(0)}</div>
                              <span className="font-medium text-[#fffaf0] text-[13px]">{item.full_name}</span>
                            </div>
                          </td>
                          <td className="p-4 px-6 text-[#c9b8cd] text-[13px]">{item.position || '-'}</td>
                          <td className="p-4 px-6"><span className="text-[11px] text-[#c9b8cd] bg-[#54205f] border border-[#7e4a87] px-2.5 py-1 rounded-md">{item.departments?.name || 'Unassigned'}</span></td>
                          <td className="p-4 px-6 flex justify-center gap-2">
                             <button onClick={() => handleEdit('staff', item)} className="p-1.5 text-[#c9b8cd] hover:text-[#fffaf0] transition-colors"><Icon icon="ph:pencil-simple" width="18" height="18" /></button>
                             <button onClick={() => confirmDelete('staff', item)} className="p-1.5 text-[#c9b8cd] hover:text-[#ff453a] transition-colors"><Icon icon="ph:trash" width="18" height="18" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Card งาน, แผนก, สถานที่ */}
                {(activeMenu === 'tasks' || activeMenu === 'departments' || activeMenu === 'operation_areas') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-6 bg-[#2a0f33]">
                    {(activeMenu === 'tasks' ? tasksList : activeMenu === 'departments' ? departmentsList : operationAreasList).map(item => (
                      <div key={item.id} className="p-5 border border-[#6b3475] rounded-[12px] hover:border-[#a688ad] transition-all bg-[#3b1746] relative group">
                        <div className="absolute top-4 right-4 flex gap-2">
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(activeMenu, item) }} className="text-[#c9b8cd] hover:text-[#fffaf0] transition-colors"><Icon icon="ph:pencil-simple" width="18" height="18" /></button>
                          <button onClick={(e) => { e.stopPropagation(); confirmDelete(activeMenu, item) }} className="text-[#c9b8cd] hover:text-[#ff453a] transition-colors"><Icon icon="ph:trash" width="18" height="18" /></button>
                        </div>
                        <div className="w-8 h-8 rounded-md bg-[#54205f] border border-[#7e4a87] flex items-center justify-center mb-4 text-[#fffaf0]">
                           <Icon icon={activeMenu === 'tasks' ? "ph:clipboard-text" : activeMenu === 'departments' ? "ph:buildings" : "ph:map-pin"} width="16" height="16" />
                        </div>
                        <h4 className="font-medium text-[#fffaf0] text-[14px] mb-1 pr-16">{item.name}</h4>
                        {activeMenu === 'tasks' && (
                          <p className="text-[12px] text-[#c9b8cd]">
                            Dept: {item.departments?.name || 'Unassigned'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

              </>
            )}

          </div>
        </div>
      </main>
    </div>
  )
}
