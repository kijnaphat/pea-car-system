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

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')

    try {
      // ใช้ระบบ Auth ของ Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      // ล็อกอินสำเร็จ ไปหน้า admin
      router.push('/admin')
    } catch (error) {
      setErrorMsg(error.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center p-4 font-sarabun">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#742F99] text-white rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">
            🔐
          </div>
          <h1 className="text-2xl font-black text-gray-800">Admin Login</h1>
          <p className="text-gray-500 text-sm mt-1">ระบบจัดการ PEA Smart Vehicle</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-4 border border-red-100 text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-600 ml-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 mt-1 bg-gray-50 rounded-2xl border border-gray-100 focus:border-[#742F99] outline-none"
              placeholder="admin@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-bold text-gray-600 ml-1">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 mt-1 bg-gray-50 rounded-2xl border border-gray-100 focus:border-[#742F99] outline-none"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-bold text-white transition-all mt-4 ${
              loading ? 'bg-gray-400' : 'bg-[#742F99] hover:bg-[#5b237a] shadow-lg'
            }`}
          >
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  )
}