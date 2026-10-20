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
      <nav className="fixed inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] z-[100] flex justify-center px-4 print:hidden md:bottom-4 md:px-6" aria-label="เมนูหลัก">
        <div className="kpn-dock flex h-[68px] w-full max-w-[430px] items-center gap-1 rounded-[28px] border p-1.5 md:max-w-[470px]">
          {items.map(item => (
            <button key={item.path} type="button" onClick={() => router.push(item.path)} aria-label={item.label} aria-current={item.active ? 'page' : undefined}
              className={`relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[22px] px-1 text-[11px] font-medium transition-colors ${item.active ? 'kpn-dock-active' : 'kpn-dock-inactive'}`}>
              <span className={`kpn-dock-icon flex h-6 w-6 items-center justify-center ${item.active ? 'kpn-dock-icon-active' : 'kpn-dock-icon-inactive'}`}><Icon icon={item.icon} width="21" height="21" /></span>
              <span className="leading-none">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  )
}
