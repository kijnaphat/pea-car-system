'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'

export default function GlobalBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const items = [
    { label:'หน้าหลัก', path:'/', icon:'ph:house-fill', active:pathname === '/' },
    { label:'แดชบอร์ด', path:'/dashboard', icon:'ph:chart-pie-slice-duotone', active:pathname.startsWith('/dashboard') },
    { label:'แอดมิน', path:'/admin', icon:'ph:user-gear-duotone', active:pathname.startsWith('/admin') },
  ]

  return (
    <nav className="fixed bottom-0 inset-x-0 z-[100] bg-white/95 border-t border-[#eadfed] print:hidden"
      style={{backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)'}} aria-label="เมนูหลัก">
      <div className="max-w-[620px] mx-auto h-[78px] px-8 grid grid-cols-3 items-center">
        {items.map(item => (
          <button key={item.path} onClick={() => router.push(item.path)}
            className={`relative h-full flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${item.active ? 'text-[#702082]' : 'text-[#b9aebc]'}`}>
            <Icon icon={item.icon} width="26" height="26" />
            <span>{item.label}</span>
            {item.active && <span className="absolute top-2 right-[35%] w-2.5 h-2.5 rounded-full bg-[#ffdd00] border border-white"/>}
          </button>
        ))}
      </div>
    </nav>
  )
}
