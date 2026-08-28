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
      <div className="global-nav-spacer h-[84px] print:hidden" aria-hidden="true" />
      <nav className="fixed inset-x-0 bottom-[max(12px,env(safe-area-inset-bottom))] z-[100] flex justify-center px-6 print:hidden md:bottom-5 md:px-6" aria-label="เมนูหลัก">
        <div className="kpn-dock flex h-[68px] w-full max-w-[430px] items-center gap-1 rounded-full border px-3 py-1.5 md:h-[72px] md:max-w-[470px] md:gap-3 md:px-5">
          {items.map(item => (
            <button key={item.path} type="button" onClick={() => router.push(item.path)} aria-label={item.label} aria-current={item.active ? 'page' : undefined}
              className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 text-[10px] font-extrabold transition-all duration-300 md:text-[11px] ${item.active ? 'kpn-dock-active' : 'kpn-dock-inactive'}`}>
              <span className={`kpn-dock-icon flex items-center justify-center rounded-full transition-all duration-300 ${item.active ? 'kpn-dock-icon-active h-12 w-12' : 'kpn-dock-icon-inactive h-8 w-8'}`}><Icon icon={item.icon} width="22" height="22" className="md:h-[23px] md:w-[23px]" /></span>
              {!item.active && <span className="leading-none">{item.label}</span>}
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
