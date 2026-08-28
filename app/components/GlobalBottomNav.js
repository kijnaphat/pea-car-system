'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { Icon } from '@iconify/react'

export default function GlobalBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isVehicleWorkflow = Boolean(searchParams.get('car_id'))

  useEffect(() => {
    document.documentElement.classList.remove('dark')
    window.localStorage.setItem('pea-theme', 'light')
  }, [])
  const items = [
    { label:'หน้าหลัก', path:'/', icon:'ph:house-duotone', active:pathname === '/' },
    { label:'แดชบอร์ด', path:'/dashboard', icon:'ph:chart-pie-slice-duotone', active:pathname.startsWith('/dashboard') },
    { label:'ผู้ดูแล', path:'/admin', icon:'ph:user-gear-duotone', active:pathname.startsWith('/admin') },
  ]

  if (isVehicleWorkflow) return null

  return (
    <>
      <div className="global-nav-spacer h-[96px] print:hidden" aria-hidden="true" />
      <nav className="fixed inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-[100] flex justify-center px-5 print:hidden md:bottom-6 md:px-6" aria-label="เมนูหลัก">
        <div className="kpn-dock flex h-[78px] w-full max-w-[520px] items-center gap-1 rounded-[30px] border px-3 py-2 md:h-[82px] md:max-w-[580px] md:gap-3 md:px-5">
          {items.map(item => (
            <button key={item.path} onClick={() => router.push(item.path)}
              className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[22px] px-1 text-[10px] font-extrabold transition-all duration-300 md:text-[12px] ${item.active ? 'kpn-dock-active' : 'kpn-dock-inactive'}`}>
              <span className={`kpn-dock-icon flex items-center justify-center rounded-full transition-all duration-300 ${item.active ? 'kpn-dock-icon-active h-11 w-11' : 'kpn-dock-icon-inactive h-9 w-9'}`}><Icon icon={item.icon} width="22" height="22" className="md:h-[24px] md:w-[24px]" /></span>
              <span className="leading-none">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
