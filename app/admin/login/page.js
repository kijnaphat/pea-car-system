'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import { supabase } from '@/lib/supabaseClient'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/admin')
    } catch (error) {
      setErrorMsg(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-[calc(100dvh-78px)] bg-[#f8f3fa] font-sarabun flex items-center justify-center p-4 sm:p-7 relative overflow-hidden">
      <div className="absolute -top-32 -left-28 w-80 h-80 rounded-full bg-[#702082]/10 blur-2xl" />
      <div className="absolute -bottom-36 -right-24 w-96 h-96 rounded-full bg-[#ffdd00]/20 blur-3xl" />

      <section className="relative w-full max-w-[1040px] min-h-[640px] bg-white rounded-[30px] overflow-hidden border border-[#eadfed] shadow-[0_24px_70px_rgba(79,28,91,.16)] grid grid-cols-1 lg:grid-cols-[1.05fr_.95fr]">
        <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden px-10 py-10 text-white"
          style={{background:'linear-gradient(145deg,#451257 0%,#702082 58%,#963ba5 100%)'}}>
          <div className="absolute -right-36 -top-32 w-96 h-96 rounded-full border-[58px] border-white/[0.05]" />
          <div className="absolute -left-32 -bottom-40 w-96 h-96 rounded-full bg-[#ffdd00]/10" />

          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 bg-white rounded-[16px] p-1.5 shadow-lg"><img src="/pea_logo.png" alt="PEA" className="w-full h-full object-contain" /></div>
            <div><p className="text-[11px] font-bold tracking-[.14em] text-[#ffea70]">การไฟฟ้าส่วนภูมิภาค</p><p className="text-[20px] font-bold">PEA Fleet</p></div>
          </div>

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3.5 py-2 text-[11px] font-semibold mb-5"><span className="w-2 h-2 rounded-full bg-[#ffdd00]" />ระบบบริหารจัดการยานพาหนะ</span>
            <h1 className="text-[42px] font-bold leading-[1.08] tracking-[-1.3px]">จัดการรถ PEA<br/>อย่างมั่นใจในทุกวัน</h1>
            <p className="mt-5 text-[15px] leading-relaxed text-white/70 max-w-[390px]">เข้าสู่ระบบสำหรับผู้ดูแล เพื่อจัดการรถ บุคลากร งาน พื้นที่ปฏิบัติงาน และตรวจสอบข้อมูล Fleet จากศูนย์กลางเดียว</p>
          </div>

          <div className="relative grid grid-cols-3 gap-3">
            {[
              {icon:'ph:car-profile-duotone',label:'จัดการรถ'},
              {icon:'ph:users-three-duotone',label:'บุคลากร'},
              {icon:'ph:chart-pie-slice-duotone',label:'รายงาน'},
            ].map(item => <div key={item.label} className="rounded-[18px] bg-white/10 border border-white/10 px-3 py-4 text-center"><Icon icon={item.icon} width="25" height="25" className="mx-auto text-[#ffdd00]"/><p className="mt-2 text-[11px] font-semibold">{item.label}</p></div>)}
          </div>
        </aside>

        <div className="flex flex-col px-6 py-7 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-[52px] h-[52px] bg-white rounded-[14px] border border-[#eadfed] p-1.5 shadow-sm"><img src="/pea_logo.png" alt="PEA" className="w-full h-full object-contain" /></div>
            <div><p className="text-[10px] font-bold tracking-[.12em] text-[#702082]">การไฟฟ้าส่วนภูมิภาค</p><p className="text-[18px] font-bold text-[#4b1560]">PEA Fleet</p></div>
          </div>

          <button onClick={() => router.push('/')} className="self-start inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#765c7c] hover:text-[#702082] transition-colors"><Icon icon="ph:arrow-left" width="16" height="16" />กลับหน้าหลัก</button>

          <div className="my-auto py-8">
            <p className="text-[11px] font-bold tracking-[.14em] text-[#8b3c98] mb-2">ADMIN PORTAL</p>
            <h2 className="text-[32px] sm:text-[38px] font-bold text-[#35133f] tracking-[-1px]">ยินดีต้อนรับ</h2>
            <p className="mt-2 text-[14px] text-[#765c7c]">เข้าสู่ระบบด้วยบัญชีผู้ดูแล PEA</p>

            {errorMsg && <div className="mt-6 flex items-start gap-2.5 rounded-[15px] bg-[#fff0f0] border border-[#ffd7d4] px-4 py-3.5 text-[12px] text-[#c93830]"><Icon icon="ph:warning-circle-duotone" width="19" height="19" className="flex-shrink-0"/><span>{errorMsg}</span></div>}

            <form onSubmit={handleLogin} className="mt-7 space-y-5">
              <label className="block">
                <span className="text-[12px] font-bold text-[#4b4050]">อีเมลหรือรหัสผู้ใช้งาน</span>
                <div className="relative mt-2">
                  <Icon icon="ph:user-circle-duotone" width="21" height="21" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b3c98]" />
                  <input type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@pea.co.th"
                    className="w-full rounded-[16px] border border-[#ded1e2] bg-[#fcf9fd] pl-12 pr-4 py-4 text-[14px] text-[#35133f] outline-none transition-all placeholder:text-[#b5a7b8] focus:bg-white focus:border-[#702082] focus:ring-4 focus:ring-[#702082]/10" />
                </div>
              </label>

              <label className="block">
                <span className="text-[12px] font-bold text-[#4b4050]">รหัสผ่าน</span>
                <div className="relative mt-2">
                  <Icon icon="ph:lock-key-duotone" width="21" height="21" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b3c98]" />
                  <input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="กรอกรหัสผ่าน"
                    className="w-full rounded-[16px] border border-[#ded1e2] bg-[#fcf9fd] pl-12 pr-12 py-4 text-[14px] text-[#35133f] outline-none transition-all placeholder:text-[#b5a7b8] focus:bg-white focus:border-[#702082] focus:ring-4 focus:ring-[#702082]/10" />
                  <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8e7d92] hover:text-[#702082]" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}><Icon icon={showPassword ? 'ph:eye-duotone' : 'ph:eye-slash-duotone'} width="20" height="20" /></button>
                </div>
              </label>

              <button type="submit" disabled={loading} className={`w-full rounded-[16px] py-4 text-[14px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[.985] ${loading ? 'bg-[#d8c5dc] text-white cursor-not-allowed' : 'bg-[#702082] text-white shadow-[0_10px_24px_rgba(112,32,130,.24)] hover:bg-[#5c176d]'}`}>
                {loading ? <><Icon icon="ph:spinner-gap-bold" width="19" height="19" className="animate-spin"/>กำลังเข้าสู่ระบบ...</> : <>เข้าสู่ระบบ <Icon icon="ph:arrow-right-bold" width="16" height="16" className="text-[#ffdd00]"/></>}
              </button>
            </form>

            <div className="mt-6 flex items-start gap-2.5 rounded-[15px] bg-[#fff9d9] border border-[#f3df70] px-4 py-3.5 text-[#66510d]">
              <Icon icon="ph:shield-check-duotone" width="20" height="20" className="flex-shrink-0 text-[#a88000]" />
              <p className="text-[11px] leading-relaxed">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น หากไม่สามารถเข้าสู่ระบบได้ กรุณาติดต่อผู้ดูแล IT ของหน่วยงาน</p>
            </div>
          </div>

          <p className="text-center text-[10px] text-[#aa9cae]">PEA Smart Vehicle Management · Secure Admin Access</p>
        </div>
      </section>
    </main>
  )
}
