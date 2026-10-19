'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import { supabase } from '@/lib/supabaseClient'
import PageSkeleton from '@/app/components/PageSkeleton'
import { adminDestination } from '@/lib/adminDestination'
import '../admin-ui.css'

const getDestinationAfterLogin = () => {
  if (typeof window === 'undefined') return '/admin'
  return adminDestination(window.location.search)
}

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    let active = true
    const checkExistingSession = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        if (!error && user?.app_metadata?.role === 'admin') {
          router.replace(getDestinationAfterLogin())
          return
        }
        if (user) await supabase.auth.signOut()
      } finally {
        if (active) setCheckingSession(false)
      }
    }
    checkExistingSession()
    return () => { active = false }
  }, [router])

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user?.app_metadata?.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error('บัญชีนี้ไม่มีสิทธิ์ผู้ดูแลระบบ')
      }
      await supabase.rpc('log_admin_session_event', { p_event_type: 'login' })
      router.replace(getDestinationAfterLogin())
    } catch (error) {
      setErrorMsg(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession || loading) return <PageSkeleton variant="login" />

  return (
    <main className="kpn-screen kpn-login kpn-admin-login min-h-[calc(100dvh-78px)] flex items-center justify-center p-5 sm:p-8">
      <section className="admin-login-shell w-full max-w-[900px] overflow-hidden rounded-[12px] border border-[#dce1e2] bg-white grid grid-cols-1 md:grid-cols-[.86fr_1.14fr]">
        <aside className="admin-login-information hidden md:flex flex-col justify-between bg-[#f1efec] px-8 py-9 border-r border-[#dce1e2]">
          <div className="flex items-center gap-3">
            <img src="/pea_logo.png" alt="PEA" className="w-12 h-12 object-contain" />
            <div><p className="text-[12px] font-semibold text-[#5b246b]">การไฟฟ้าส่วนภูมิภาค</p><p className="text-[19px] font-bold text-[#20272b]">PEA Smart Car</p></div>
          </div>
          <div className="py-12">
            <div className="w-9 h-[3px] bg-[#c7a53c] mb-5" />
            <h1 className="text-[27px] font-bold leading-snug text-[#20272b]">ระบบจัดการ<br/>ยานพาหนะ</h1>
            <p className="mt-4 text-[14px] leading-7 text-[#687279]">สำหรับผู้ดูแลข้อมูลรถ บุคลากร<br/>และตรวจสอบการใช้งานของหน่วยงาน</p>
          </div>
          <div className="border-t border-[#d9ddda] pt-5 space-y-3">
            {[
              {icon:'ph:car-profile',label:'ทะเบียนและข้อมูลรถ'},
              {icon:'ph:users-three',label:'บุคลากรและหน่วยงาน'},
              {icon:'ph:clipboard-text',label:'ตรวจสอบข้อมูลและรายงาน'},
            ].map(item => <div key={item.label} className="flex items-center gap-3 text-[13px] text-[#687279]"><Icon icon={item.icon} width="19" height="19" className="text-[#5b246b]"/><span>{item.label}</span></div>)}
          </div>
        </aside>
        <div className="admin-login-form-panel flex flex-col px-6 py-7 sm:px-10 sm:py-9">
          <button type="button" onClick={() => router.push('/')} className="self-start inline-flex min-h-11 items-center gap-2 text-[13px] font-medium text-[#687279] hover:text-[#5b246b] transition-colors"><Icon icon="ph:arrow-left" width="17" height="17" />กลับหน้าหลัก</button>
          <div className="md:hidden flex items-center gap-3 mt-6">
            <img src="/pea_logo.png" alt="PEA" className="w-11 h-11 object-contain" />
            <div><p className="text-[11px] text-[#687279]">การไฟฟ้าส่วนภูมิภาค</p><p className="text-[18px] font-bold text-[#20272b]">PEA Smart Car</p></div>
          </div>
          <div className="my-auto py-8">
            <p className="text-[12px] font-semibold text-[#5b246b] mb-2">ผู้ดูแลระบบ</p>
            <h2 className="text-[28px] font-bold text-[#20272b]">เข้าสู่ระบบ</h2>
            <p className="mt-2 text-[14px] text-[#687279]">ใช้บัญชีผู้ดูแลที่ได้รับสิทธิ์จากหน่วยงาน</p>
            {errorMsg && <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-[8px] bg-[#fcf2f1] border border-[#e7cbc8] px-4 py-3 text-[13px] text-[#ac3f38]"><Icon icon="ph:warning-circle" width="19" height="19" className="shrink-0"/><span>{errorMsg}</span></div>}
            <form onSubmit={handleLogin} className="mt-7 space-y-5">
              <label className="block">
                <span className="text-[13px] font-semibold text-[#485259]">อีเมลผู้ใช้งาน</span>
                <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@pea.co.th" className="admin-login-field mt-2 w-full rounded-[8px] border border-[#cfd5d7] bg-white px-3.5 py-3 text-[16px] text-[#20272b] outline-none placeholder:text-[#91999e] focus:border-[#5b246b] focus:ring-2 focus:ring-[#5b246b]/10" />
              </label>
              <label className="block">
                <span className="text-[13px] font-semibold text-[#485259]">รหัสผ่าน</span>
                <div className="relative mt-2">
                  <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="กรอกรหัสผ่าน" className="admin-login-field w-full rounded-[8px] border border-[#cfd5d7] bg-white pl-3.5 pr-14 py-3 text-[16px] text-[#20272b] outline-none placeholder:text-[#91999e] focus:border-[#5b246b] focus:ring-2 focus:ring-[#5b246b]/10" />
                  <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-1 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-[6px] text-[#687279] hover:bg-[#f5f5f3] hover:text-[#5b246b]" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}><Icon icon={showPassword ? 'ph:eye' : 'ph:eye-slash'} width="20" height="20" /></button>
                </div>
              </label>
              <button type="submit" className="admin-login-submit w-full rounded-[8px] py-3.5 text-[15px] font-semibold flex items-center justify-center gap-2 bg-[#5b246b] text-white hover:bg-[#482055] transition-colors">เข้าสู่ระบบ<Icon icon="ph:arrow-right" width="18" height="18" /></button>
            </form>
            <div className="mt-6 flex items-start gap-2.5 border-t border-[#e4e7e6] pt-5 text-[#687279]">
              <Icon icon="ph:shield-check" width="19" height="19" className="shrink-0 mt-0.5" />
              <p className="text-[12px] leading-6">สำหรับผู้ดูแลระบบเท่านั้น หากเข้าสู่ระบบไม่ได้ กรุณาติดต่อผู้ดูแล IT ของหน่วยงาน</p>
            </div>
          </div>
          <p className="text-[11px] text-[#91999e]">PEA Smart Car · ระบบบริหารจัดการยานพาหนะ</p>
        </div>
      </section>
    </main>
  )
}
