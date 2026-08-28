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
    { label:'หน้าหลัก', path:'/', icon:'ph:house-duotone', active:pathname === '/' },
    { label:'แดชบอร์ด', path:'/dashboard', icon:'ph:chart-pie-slice-duotone', active:pathname.startsWith('/dashboard') },
    { label:'ผู้ดูแล', path:'/admin', icon:'ph:user-gear-duotone', active:pathname.startsWith('/admin') },
  ]

  return (
    <nav className="fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-[100] flex justify-center px-3 print:hidden md:bottom-5 md:px-6" aria-label="เมนูหลัก">
      <div className="kpn-dock flex h-[64px] w-full max-w-[590px] items-center gap-1 rounded-[22px] border p-1.5 md:h-[70px] md:max-w-[680px] md:gap-2 md:p-2">
        {items.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            className={`relative flex h-full min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[17px] px-2 text-[11px] font-extrabold transition-all duration-300 md:gap-2 md:px-5 md:text-sm ${item.active ? 'kpn-dock-active' : 'kpn-dock-inactive'}`}>
            <span className={`flex h-8 w-8 items-center justify-center rounded-[11px] transition-colors ${item.active ? 'bg-white/12' : 'bg-[#f2f4f8]'}`}><Icon icon={item.icon} width="20" height="20" className="md:h-[22px] md:w-[22px]" /></span>
            <span>{item.label}</span>
            {item.active && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#c9ff48] ring-2 ring-[#080d1b] md:right-3 md:top-3" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </nav>
  )
}
