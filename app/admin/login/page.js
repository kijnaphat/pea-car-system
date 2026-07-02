'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

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
  const [animStep, setAnimStep] = useState(0)

  const startGame = () => {
    setTaps(0)
    setAppState('playing')
  }

  const tapScooter = () => {
    if (appState !== 'playing') return
    
    const newTaps = taps + 1
    setTaps(newTaps)
    
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 200)

    if (newTaps >= 3) {
      setTimeout(() => {
        setAppState('unlocked')
        setTimeout(() => {
          setAppState('login')
          setTimeout(() => setAnimStep(1), 100)
          setTimeout(() => setAnimStep(2), 500)
          setTimeout(() => setAnimStep(3), 900)
        }, 1500)
      }, 300)
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
      setErrorMsg(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-[#4b207f] to-[#2b104c] overflow-y-auto overflow-x-hidden font-sans perspective-1000 flex items-center justify-center p-4 sm:p-8">
      
      <style>{`
        @keyframes engineShake {
          0%, 100% { transform: translateX(0) scale(1.1); }
          25% { transform: translateX(-4px) rotate(-1deg) scale(1.1); }
          75% { transform: translateX(4px) rotate(1deg) scale(1.1); }
        }
        .animate-engine-shake { animation: engineShake 0.2s ease-in-out; }
        
        @keyframes superFloat {
          0%, 100% { transform: translateY(0) translateX(0) rotate(0deg) scale(1.02); }
          25% { transform: translateY(-15px) translateX(8px) rotate(3deg) scale(1.05); }
          50% { transform: translateY(5px) translateX(-5px) rotate(-2deg) scale(0.98); }
          75% { transform: translateY(-10px) translateX(-8px) rotate(1deg) scale(1.03); }
        }
        .animate-super-float { animation: superFloat 6s ease-in-out infinite; }
      `}</style>

      {/* ================= 🎮 1. หน้า Intro ================= */}
      {appState === 'intro' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center transform transition-all scale-100 animate-fade-in-up border-t-4 border-[#ECA10D]">
            <span className="text-6xl mb-4 block">⚡</span>
            <h2 className="text-2xl font-black text-gray-800 mb-2">ระบบยืนยันตัวตน</h2>
            <p className="text-gray-500 text-sm mb-6 font-medium">
              กรุณา <span className="text-[#5C2D91] font-bold text-lg">แตะที่น้อง Watt-D (วัตต์-ดี) 3 ครั้ง</span><br/>
              เพื่อเชื่อมต่อระบบ (ไม่มีจับเวลา)
            </p>
            <button onClick={startGame} className="w-full py-4 bg-[#5C2D91] text-white rounded-full font-bold shadow-lg hover:bg-[#431F6A] hover:scale-105 transition-all">
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* ================= 🎮 2. หน้าเล่นเกม ================= */}
      {appState === 'playing' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center">
          <h1 className="text-3xl md:text-4xl font-black text-white drop-shadow-md text-center mb-10">
            แตะที่น้อง Watt-D <span className="text-[#ECA10D]">3</span> ครั้ง
          </h1>

          <button 
            onClick={tapScooter}
            className={`transition-all duration-200 focus:outline-none relative z-10 touch-manipulation ${isShaking ? 'animate-engine-shake' : 'hover:scale-105'}`}
          >
            {/* เปลี่ยน src เป็นไฟล์รูปน้อง Watt-D หากมี */}
            <img 
              src="/scooter.png" 
              alt="Tap Nong Watt-D" 
              className="w-48 sm:w-56 md:w-64 drop-shadow-[0_20px_40px_rgba(236,161,13,0.3)]" 
            />
          </button>

          <div className="mt-12 bg-white/10 backdrop-blur-md px-6 py-4 rounded-3xl shadow-xl flex flex-col items-center border border-white/20">
            <p className="text-[#ECA10D] text-xs font-bold uppercase tracking-widest mb-3">สถานะการเชื่อมต่อ</p>
            <div className="flex gap-3">
              {[1, 2, 3].map((step) => (
                <div 
                  key={step} 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold shadow-inner transition-all duration-500 ${
                    taps >= step 
                      ? 'bg-[#ECA10D] text-[#5C2D91] shadow-[0_0_15px_rgba(236,161,13,0.6)] scale-110' 
                      : 'bg-black/30 text-white/30'
                  }`}
                >
                  {taps >= step ? '✓' : step}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= 🔓 3. หน้าปลดล็อก ================= */}
      {appState === 'unlocked' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#5C2D91]/40 backdrop-blur-sm animate-fade-in">
          <div className="text-center">
            <span className="text-7xl block mb-4 animate-bounce drop-shadow-[0_0_20px_rgba(236,161,13,0.8)]">🔋</span>
            <h1 className="text-4xl md:text-6xl font-black text-white drop-shadow-xl">
              เชื่อมต่อสำเร็จ!
            </h1>
          </div>
        </div>
      )}

      {/* ================= 💻 4. ส่วนของหน้า Login ================= */}
      <div 
        className={`w-full max-w-[950px] min-h-[500px] md:h-[600px] bg-white rounded-3xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] flex flex-col md:flex-row relative z-10 transition-all duration-1000 cubic-bezier(0.175, 0.885, 0.32, 1.275) transform my-auto ${
          appState === 'login' && animStep >= 1 ? 'opacity-100 scale-100 rotateX-0 translate-y-0' : 'opacity-0 scale-50 rotate-x-12 translate-y-32 hidden'
        }`}
        style={{ transformStyle: 'preserve-3d', perspective: '1000px' }}
      >
        
        {/* ⚪ ฝั่งซ้าย: ฟอร์มล็อกอิน */}
        <div className="w-full md:w-[50%] p-8 pt-10 md:px-16 md:py-12 flex flex-col justify-center bg-white rounded-3xl md:rounded-l-3xl md:rounded-r-none z-10 md:shadow-[20px_0_30px_-15px_rgba(0,0,0,0.1)] relative overflow-hidden md:overflow-visible">
          
          {/* 📱 🛵 รูปรถ 3D สำหรับ "จอมือถือ" */}
          <div className={`block md:hidden absolute top-6 -right-2 sm:right-4 w-[200px] sm:w-[220px] pointer-events-none transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) delay-300 z-0 ${
            appState === 'login' && animStep >= 2 ? 'opacity-100 translate-x-0 translate-y-0 rotate-0 scale-100' : 'opacity-0 translate-x-32 translate-y-10 rotate-12 scale-50'
          }`}>
             <img src="/scooter.png" alt="3D Watt-D" className={`w-full h-auto drop-shadow-[0_15px_25px_rgba(0,0,0,0.2)] ${animStep >= 3 ? 'animate-super-float' : ''}`} />
          </div>

          <div className={`relative z-10 mb-8 transition-all duration-700 ease-out ${animStep >= 2 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
            <div className="mb-4 flex items-center">
              <div className="w-12 h-12 bg-[#5C2D91] rounded-lg flex items-center justify-center text-white font-bold text-xl mr-3 shadow-md">
                PEA
              </div>
              <h3 className="text-[#5C2D91] font-bold text-[14px] tracking-widest uppercase">Smart Fleet</h3>
            </div>
            <h1 className="text-[32px] md:text-[36px] font-extrabold text-gray-800 tracking-tight leading-none relative z-10">Welcome<br/>Back!</h1>
          </div>

          {errorMsg && (
            <div className="relative z-10 bg-red-50 text-red-500 p-3 rounded-xl text-xs mb-4 border border-red-100 text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className={`relative z-10 space-y-5 transition-all duration-700 delay-100 ease-out ${animStep >= 3 ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
            <div>
              <label className="text-[12px] font-bold text-[#5C2D91] mb-1.5 block ml-3">Email</label>
              <input 
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 px-5 py-3.5 text-[16px] md:text-sm text-gray-700 focus:outline-none focus:border-[#5C2D91] focus:ring-2 focus:ring-[#5C2D91]/20 transition-all placeholder-gray-300 bg-gray-50/50"
                placeholder="username@pea.co.th"
              />
            </div>
            
            <div>
              <label className="text-[12px] font-bold text-[#5C2D91] mb-1.5 block ml-3">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 px-5 py-3.5 text-[16px] md:text-sm text-gray-700 focus:outline-none focus:border-[#5C2D91] focus:ring-2 focus:ring-[#5C2D91]/20 transition-all placeholder-gray-300 pr-10 bg-gray-50/50"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#5C2D91] transition-colors focus:outline-none">
                  {showPassword ? '👁️' : '🙈'}
                </button>
              </div>
              <div className="flex justify-end mt-2 mr-2">
                <a href="#" className="text-[11px] text-gray-400 hover:text-[#ECA10D] transition-colors font-medium">Forgot Password?</a>
              </div>
            </div>

            <button 
              type="submit" disabled={loading}
              className={`w-full py-4 rounded-2xl font-bold text-sm text-white transition-all duration-300 mt-4 touch-manipulation relative z-20 ${
                loading ? 'bg-gray-300' : 'bg-[#5C2D91] hover:bg-[#431F6A] hover:shadow-[0_15px_30px_rgba(92,45,145,0.3)] hover:-translate-y-0.5 active:scale-[0.98]'
              }`}
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ 🚀'}
            </button>
          </form>
        </div>

        {/* 💻 🛵 ฝั่งขวา: พื้นหลังม่วงอ่อน พร้อมรูปรถ (ซ่อนในมือถือ) */}
        <div className="hidden md:block w-[50%] bg-gradient-to-br from-[#f8f5fb] to-[#ece3f5] rounded-r-3xl relative z-0 overflow-visible">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#5C2D91] via-transparent to-transparent rounded-r-3xl"></div>
          <div className={`absolute top-1/2 -left-[28%] -translate-y-1/2 w-[135%] flex items-center justify-center pointer-events-none z-20 transition-all duration-1000 cubic-bezier(0.34, 1.56, 0.64, 1) ${
            appState === 'login' && animStep >= 2 ? 'opacity-100 translate-y-0 translate-x-0' : 'opacity-0 -translate-y-48 translate-x-32'
          }`}>
            <img 
              src="/scooter.png" 
              alt="3D Watt-D" 
              className={`w-full h-auto object-contain drop-shadow-[20px_30px_40px_rgba(92,45,145,0.25)] ${animStep >= 3 ? 'animate-super-float' : ''}`} 
            />
          </div>
          <div className={`absolute bottom-16 left-[15%] w-[70%] h-6 bg-black/15 blur-xl rounded-[100%] transition-opacity duration-1000 delay-500 ${animStep >= 2 ? 'opacity-100' : 'opacity-0'}`}></div>
        </div>

      </div>
    </div>
  )
}