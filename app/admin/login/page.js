'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'

export default function AdminLogin() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // ================= State สำหรับ มินิเกมสตาร์ทรถ =================
  const [appState, setAppState] = useState('intro') 
  const [taps, setTaps] = useState(0)
  const [isShaking, setIsShaking] = useState(false)

  const startGame = () => {
    setTaps(0)
    setAppState('playing')
  }

  const tapScooter = () => {
    if (appState !== 'playing') return
    
    const newTaps = taps + 1
    setTaps(newTaps)
    
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 150)

    if (newTaps >= 3) {
      setTimeout(() => {
        setAppState('unlocked')
        // หน่วงเวลาให้โชว์หน้าปลดล็อกสักพัก แล้วเปลี่ยนเป็นหน้า Login
        setTimeout(() => {
          setAppState('login')
        }, 1200)
      }, 350)
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/admin') 
    } catch (error) {
      setErrorMsg(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    // บนมือถือพื้นหลังดำเต็มจอ / บน Desktop พื้นหลังเทาเพื่อเน้น Card
    <div className="fixed inset-0 bg-[#1c1c1e] md:bg-[#8e8e93] overflow-hidden flex items-center justify-center md:p-8 font-sans"
         style={{ WebkitFontSmoothing: 'antialiased' }}>
      
      <style>{`
        * { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        
        @keyframes subtleShake {
          0%, 100% { transform: translateX(0) scale(1.02); }
          25% { transform: translateX(-3px) scale(1.02); }
          75% { transform: translateX(3px) scale(1.02); }
        }
        .animate-subtle-shake { animation: subtleShake 0.15s ease-in-out; }
        
        @keyframes floatMinimal {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-float-minimal { animation: floatMinimal 5s ease-in-out infinite; }
        
        @keyframes fadeScaleUp {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fade-scale-up { animation: fadeScaleUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes pulseRing {
          0% { transform: scale(0.9); opacity: 0.5; }
          50% { transform: scale(1); opacity: 0.8; }
          100% { transform: scale(0.9); opacity: 0.5; }
        }
        .animate-pulse-ring { animation: pulseRing 4s ease-in-out infinite; }
      `}</style>

      {/* ================= 💻 Main Container (Card) ================= */}
      {/* บนมือถือ = เต็มจอไร้ขอบ, บน Desktop = มีขอบโค้งและเงา */}
      <div className="w-full h-[100dvh] md:max-w-[1100px] md:h-[700px] bg-[#1c1c1e] md:rounded-[16px] md:shadow-[0_30px_80px_rgba(0,0,0,0.4)] flex flex-col relative z-10 overflow-hidden">
        
        {/* ── Top Navigation Bar (แสดงเฉพาะ Desktop) ตัดเมนูตรงกลางออกตามรีเควสต์ ── */}
        <div className="hidden md:flex items-center justify-between px-10 py-6 relative z-30">
          <div className="flex items-center gap-2 text-[#f5f5f7]">
            <div className="w-6 h-6 bg-[#f5f5f7] rounded-md flex items-center justify-center text-[#1c1c1e] font-bold text-[10px]">PEA</div>
            <span className="text-[17px] font-semibold tracking-tight">Fleet</span>
          </div>
          
          <div className="flex gap-5 text-[#86868b]">
            <Icon icon="ph:magnifying-glass" width="18" height="18" className="hover:text-[#f5f5f7] cursor-pointer transition-colors" />
            <Icon icon="ph:bag" width="18" height="18" className="hover:text-[#f5f5f7] cursor-pointer transition-colors" />
          </div>
        </div>

        {/* ── Main Content Area (สลับเลเยอร์บนมือถือ / แบ่งซ้ายขวาบน Desktop) ── */}
        <div className="flex flex-1 relative z-20">
          
          {/* ⚪ ฝั่งซ้าย: Form Login */}
          {/* บนมือถือ: ซ่อนตอนเล่นเกม และเฟด+เลื่อนขึ้นมาตอน Login */}
          <div className={`absolute inset-0 md:relative w-full md:w-[45%] px-8 md:pl-20 md:pr-10 flex flex-col justify-center transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] z-30 ${
            appState === 'login' 
              ? 'opacity-100 translate-y-0 md:translate-x-0' 
              : 'opacity-0 translate-y-12 md:translate-y-0 md:-translate-x-12 pointer-events-none'
          }`}>
            
            {/* โลโก้ PEA Fleet เหนือ Login (เหมือนในภาพ Reference) */}
            <div className="flex items-center gap-3 text-[#f5f5f7] mb-8 md:mb-12">
              <div className="w-10 h-10 bg-[#f5f5f7] rounded-[10px] flex items-center justify-center text-[#1c1c1e] font-bold text-[14px]">
                PEA
              </div>
              <span className="text-[22px] font-semibold tracking-tight">Fleet</span>
            </div>

            <h1 className="text-[34px] md:text-[42px] font-medium text-[#f5f5f7] tracking-tight leading-tight mb-8">
              Login With PEA
            </h1>

            {errorMsg && (
              <div className="bg-[#ff3b30]/10 text-[#ff453a] p-3 rounded-lg text-[13px] mb-6 flex items-center gap-2 border border-[#ff3b30]/20">
                <Icon icon="ph:warning-circle" className="text-[16px] flex-shrink-0" />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-[10px] border border-[#424245] bg-transparent px-4 py-4 text-[15px] text-[#f5f5f7] placeholder-[#86868b] focus:border-[#86868b] focus:ring-1 focus:ring-[#86868b] outline-none transition-colors"
                placeholder="Enter PEA ID or Email"
              />
              
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-[10px] border border-[#424245] bg-transparent px-4 py-4 pr-10 text-[15px] text-[#f5f5f7] placeholder-[#86868b] focus:border-[#86868b] focus:ring-1 focus:ring-[#86868b] outline-none transition-colors"
                  placeholder="Password"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#86868b] hover:text-[#f5f5f7] transition-colors outline-none">
                  <Icon icon={showPassword ? "ph:eye" : "ph:eye-closed"} width="18" height="18" />
                </button>
              </div>

              <p className="text-[12px] text-[#86868b] mt-2 mb-4 leading-relaxed">
                Your PEA ID is the email address or employee number you use to sign in to internal systems, Fleet, and services.
              </p>

              <button 
                type="submit" disabled={loading}
                className={`w-full py-4 rounded-[10px] font-medium text-[15px] transition-all flex items-center justify-center gap-2 ${
                  loading 
                    ? 'bg-[#424245] text-[#86868b] cursor-not-allowed' 
                    : 'bg-[#f5d596] text-[#1c1c1e] hover:bg-[#e3c38b] active:scale-[0.98]'
                }`}
              >
                {loading ? <Icon icon="ph:spinner-gap-bold" className="animate-spin" width="20" height="20" /> : 'Login'}
              </button>
            </form>

            <div className="mt-8 text-[12px] text-[#86868b] flex flex-col gap-1.5">
              <span className="hover:text-[#f5f5f7] cursor-pointer transition-colors w-max">Forgot your PEA ID or password?</span>
              <span>Don't have an account? <span className="text-[#f5f5f7] cursor-pointer">Contact IT support.</span></span>
            </div>
          </div>

          {/* ⚫ ฝั่งขวา: Graphic น้อง Watt-D (ขยายขนาดแล้ว) */}
          <div className={`absolute inset-0 md:relative w-full md:w-[55%] flex items-center justify-center transition-all duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)] z-20 ${
            appState === 'login' 
              ? 'opacity-0 md:opacity-100 scale-95 md:scale-100 pointer-events-none md:pointer-events-auto' 
              : 'opacity-100 scale-100 pointer-events-auto'
          }`}>
            
            {/* ── วงแหวน (Concentric Circles) ปรับขยายขนาดให้เข้ากับน้อง Watt-D ที่ใหญ่ขึ้น ── */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none scale-90 md:scale-100">
              <div className="absolute w-[300px] md:w-[360px] h-[300px] md:h-[360px] rounded-full border border-white/10 animate-pulse-ring" style={{ animationDuration: '4s' }} />
              <div className="absolute w-[420px] md:w-[500px] h-[420px] md:h-[500px] rounded-full border border-white/5 animate-pulse-ring" style={{ animationDuration: '5s' }} />
              <div className="absolute w-[540px] md:w-[640px] h-[540px] md:h-[640px] rounded-full border border-white/[0.03] animate-pulse-ring" style={{ animationDuration: '6s' }} />
              <div className="absolute w-[680px] md:w-[800px] h-[680px] md:h-[800px] rounded-full border border-white/[0.015]" />
            </div>

            {/* ── แสง Glow ตรงกลาง ขยายให้ใหญ่ขึ้นเช่นกัน ── */}
            <div className="absolute w-[200px] md:w-[260px] h-[200px] md:h-[260px] rounded-full bg-gradient-to-tr from-[#0071e3] via-[#ff9f0a] to-[#f5d596] opacity-30 blur-[40px] pointer-events-none" />

            {/* ── Interactive Element (น้อง Watt-D) ── */}
            <div className="relative z-20 flex flex-col items-center">
              
              {/* ข้อความบอกสถานะมินิเกม */}
              {appState !== 'login' && (
                <div className="absolute -top-24 md:-top-32 text-center w-max animate-fade-scale-up">
                   <h2 className="text-[24px] md:text-[28px] font-medium text-[#f5f5f7] tracking-tight mb-2">
                     {appState === 'intro' ? 'Authenticate' : appState === 'playing' ? 'Tap 3 Times' : 'Access Granted'}
                   </h2>
                   {appState === 'intro' && <p className="text-[12px] md:text-[13px] text-[#86868b]">Tap Watt-D to connect to Fleet System.</p>}
                   
                   {appState === 'playing' && (
                      <div className="flex gap-2 justify-center mt-3">
                        {[1, 2, 3].map((step) => (
                          <div key={step} className={`w-6 h-6 md:w-8 md:h-8 rounded-full flex items-center justify-center text-[10px] md:text-[12px] font-medium transition-all ${
                              taps >= step ? 'bg-[#f5d596] text-[#1c1c1e]' : 'bg-[#424245] text-[#86868b]'
                          }`}>
                            {taps >= step ? <Icon icon="ph:check-bold" /> : step}
                          </div>
                        ))}
                      </div>
                   )}
                </div>
              )}

              {/* รูปรถน้อง Watt-D (ขยายขนาดเป็น 240px บนมือถือ / 320px บนเดสก์ท็อป) */}
              <button 
                onClick={appState === 'playing' || appState === 'intro' ? (appState === 'intro' ? startGame : tapScooter) : undefined}
                disabled={appState === 'unlocked' || appState === 'login'}
                className={`transition-all duration-300 focus:outline-none ${
                  isShaking ? 'animate-subtle-shake' : 
                  (appState === 'intro' || appState === 'playing') ? 'hover:scale-105 cursor-pointer' : 
                  'cursor-default animate-float-minimal'
                }`}
              >
                <img 
                  src="/scooter.png" 
                  alt="Vehicle" 
                  className="w-[240px] md:w-[320px] h-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]" 
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}