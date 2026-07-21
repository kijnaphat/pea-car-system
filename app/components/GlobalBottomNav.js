'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Icon } from '@iconify/react'

export default function GlobalBottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    window.localStorage.setItem('pea-theme', 'light')
  }, [])
  const items = [
    { label:'Home', path:'/', icon:'ph:house-duotone', active:pathname === '/' },
    { label:'Dashboard', path:'/dashboard', icon:'ph:chart-pie-slice-duotone', active:pathname.startsWith('/dashboard') },
    { label:'Admin', path:'/admin', icon:'ph:user-gear-duotone', active:pathname.startsWith('/admin') },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-3 z-[100] flex justify-center px-3 print:hidden md:bottom-5 md:px-6" aria-label="เมนูหลัก">
      <div className="pea-glass-nav flex h-[60px] w-full max-w-[590px] items-center gap-1 rounded-full border border-white/75 p-1.5 shadow-[0_14px_34px_rgba(51,28,67,.2)] md:h-[68px] md:max-w-[760px] md:gap-2 md:p-2">
        {items.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            className={`flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-extrabold transition-all duration-300 md:gap-2 md:px-5 md:text-sm ${item.active ? 'bg-[#6f218a] text-white shadow-[0_4px_12px_rgba(90,24,116,.3)]' : 'text-[#85818a] hover:bg-[#f4f4f5] hover:text-[#6f218a]'}`}>
            <Icon icon={item.icon} width="20" height="20" className="md:h-[22px] md:w-[22px]" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
