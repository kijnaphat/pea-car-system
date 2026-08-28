const Bone = ({ className = '' }) => <div className={`pea-skeleton ${className}`} />

function HomeSkeleton() {
  return (
    <main className="kpn-screen min-h-screen bg-[#f8f3fa] pb-28 lg:bg-[#f3edf5] lg:px-6 lg:py-6">
      <header className="bg-white"><div className="mx-auto flex max-w-[620px] lg:max-w-[1280px] items-center justify-between px-5 py-3 lg:px-8 lg:py-5"><div className="flex items-center gap-3"><Bone className="h-11 w-11 rounded-[14px]" /><div><Bone className="h-2.5 w-24" /><Bone className="mt-2 h-5 w-44" /></div></div><Bone className="h-11 w-11 rounded-full" /></div></header>
      <div className="mx-auto max-w-[620px] overflow-hidden bg-white lg:max-w-[1280px] lg:rounded-[30px] lg:shadow-[0_14px_45px_rgba(75,21,96,.10)]">
        <section className="px-5 pt-4 lg:px-6 lg:pt-6"><div className="relative h-[128px] overflow-hidden rounded-[22px] bg-[#702082] p-5 sm:h-[150px] lg:h-[210px] lg:rounded-[26px] lg:p-8"><div className="pea-skeleton-dark h-2.5 w-20" /><div className="pea-skeleton-dark mt-3 h-6 w-44 lg:h-9 lg:w-64" /><div className="pea-skeleton-dark mt-2 h-4 w-32 lg:w-44" /><div className="pea-skeleton-dark mt-3 h-6 w-28 rounded-full" /><div className="pea-skeleton-dark absolute bottom-5 right-6 h-16 w-16 rounded-full lg:bottom-8 lg:right-12 lg:h-28 lg:w-28" /></div><div className="mx-auto mt-3 flex w-16 justify-between">{Array.from({length:4}).map((_, i) => <Bone key={i} className={`h-1.5 ${i === 0 ? 'w-5' : 'w-1.5'} rounded-full`} />)}</div></section>
        <section className="px-5 py-4 lg:px-6"><div className="flex gap-3 overflow-hidden lg:grid lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="min-w-[118px] flex-1 rounded-[19px] border border-[#eee3f1] bg-white p-3 lg:min-w-0 lg:p-4"><div className="flex items-center gap-2"><Bone className="h-6 w-6 rounded-[8px]" /><Bone className="h-3 w-16" /></div><Bone className="mt-3 h-7 w-1/2" /><Bone className="mt-2 h-2.5 w-2/3" /></div>)}</div></section>
        <section className="bg-[#f1e3f4] px-5 py-5 lg:px-6"><div className="flex items-center gap-3"><Bone className="h-10 w-10 rounded-full" /><div><Bone className="h-5 w-28" /><Bone className="mt-2 h-2.5 w-36" /></div></div><div className="mt-4 flex gap-3 overflow-hidden lg:grid lg:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="min-w-[88%] rounded-[24px] bg-white p-5 lg:min-w-0"><div className="flex justify-between"><div className="flex items-center gap-2"><Bone className="h-10 w-10 rounded-xl" /><div><Bone className="h-4 w-28" /><Bone className="mt-2 h-2.5 w-16" /></div></div><Bone className="h-5 w-14 rounded-full" /></div><Bone className="mt-5 h-3 w-full" /><Bone className="mt-2 h-3 w-[88%]" /><Bone className="mt-2 h-3 w-3/5" /><Bone className="mt-4 h-3 w-32" /></div>)}</div><div className="mx-auto mt-3 flex w-12 justify-between lg:hidden">{Array.from({length:4}).map((_, i) => <Bone key={i} className={`h-1.5 ${i === 0 ? 'w-5' : 'w-1.5'} rounded-full`} />)}</div></section>
        <section className="px-5 pt-6 lg:px-6"><div className="flex items-center justify-between"><Bone className="h-7 w-28" /><Bone className="h-10 w-10 rounded-full" /></div><div className="mt-5 flex justify-between"><Bone className="h-3 w-16" /><Bone className="h-3 w-20" /></div><div className="mt-2 lg:grid lg:grid-cols-2 lg:gap-x-8">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-3 border-b border-[#edf0ee] py-4"><Bone className="h-14 w-14 rounded-full" /><div className="flex-1"><Bone className="h-3 w-16 rounded-full" /><Bone className="mt-2 h-5 w-2/5" /><Bone className="mt-2 h-3 w-3/5" /></div><div><Bone className="h-5 w-16 rounded-full" /><Bone className="mt-3 h-2.5 w-14" /></div></div>)}</div><Bone className="mx-auto my-6 h-3 w-52" /><div className="mb-7 flex items-center justify-between rounded-[22px] border border-[#eadfed] bg-[#faf5fb] p-4"><div className="flex items-center gap-3"><Bone className="h-11 w-11 rounded-[14px]" /><div><Bone className="h-3 w-28" /><Bone className="mt-2 h-4 w-36" /></div></div><Bone className="h-5 w-5 rounded-full" /></div></section>
      </div>
    </main>
  )
}

function DashboardSkeleton() {
  return (
    <main className="kpn-screen min-h-screen bg-[#f3eaf5] p-4 md:p-6">
      <div className="mx-auto max-w-7xl"><Bone className="h-9 w-56" /><Bone className="mt-3 h-4 w-36" />
        <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="rounded-[22px] bg-white p-5 shadow-sm"><Bone className="h-4 w-2/3" /><Bone className="mt-5 h-8 w-1/2" /><Bone className="mt-4 h-3 w-3/4" /></div>)}</div>
        <div className="mt-4 grid gap-4 lg:grid-cols-5"><div className="rounded-[24px] bg-white p-5 lg:col-span-3"><Bone className="h-5 w-32" /><Bone className="mt-6 h-56 w-full rounded-xl" /></div><div className="rounded-[24px] bg-white p-5 lg:col-span-2"><Bone className="h-5 w-28" />{Array.from({ length: 5 }).map((_, i) => <Bone key={i} className="mt-5 h-4 w-full" />)}</div></div>
      </div>
    </main>
  )
}

function AdminSkeleton() {
  return (
    <main className="kpn-screen min-h-screen bg-[#f3edf5] p-4 md:p-6"><div className="mx-auto flex max-w-7xl gap-4">
      <aside className="hidden w-64 shrink-0 rounded-[24px] bg-[#35133f] p-5 md:block"><Bone className="h-8 w-32 bg-white/20" />{Array.from({ length: 5 }).map((_, i) => <Bone key={i} className="mt-5 h-11 w-full bg-white/15" />)}</aside>
      <section className="min-w-0 flex-1"><Bone className="h-9 w-48" /><div className="mt-6 rounded-[24px] bg-white p-5"><div className="flex justify-between"><Bone className="h-8 w-36" /><Bone className="h-10 w-28" /></div>{Array.from({ length: 7 }).map((_, i) => <div key={i} className="mt-5 flex gap-4"><Bone className="h-5 w-1/5" /><Bone className="h-5 flex-1" /><Bone className="h-5 w-16" /></div>)}</div></section>
    </div></main>
  )
}

function ReportSkeleton() {
  return (
    <main className="min-h-screen bg-[#f8f3fa] pb-10"><section className="bg-gradient-to-r from-[#702082] to-[#4b1560] px-6 pt-12 pb-24 rounded-b-[3rem]"><Bone className="h-7 w-52 bg-white/30" /><Bone className="mt-3 h-4 w-36 bg-white/20" /></section><section className="mx-auto -mt-12 max-w-5xl px-4"><div className="rounded-[24px] bg-white p-5 shadow-lg"><Bone className="h-11 w-full rounded-xl" /><div className="mt-5 grid gap-3 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-2xl border border-[#eee5f0] p-4"><Bone className="h-4 w-2/3" /><Bone className="mt-4 h-3 w-full" /><Bone className="mt-2 h-3 w-4/5" /></div>)}</div></div></section></main>
  )
}

function LoginSkeleton() {
  return (
    <main className="kpn-screen relative flex min-h-[calc(100dvh-78px)] items-center justify-center overflow-hidden bg-[#f8f3fa] p-4 font-sarabun sm:p-7">
      <div className="absolute -top-32 -left-28 h-80 w-80 rounded-full bg-[#702082]/10 blur-2xl" />
      <div className="absolute -bottom-36 -right-24 h-96 w-96 rounded-full bg-[#ffdd00]/20 blur-3xl" />
      <section className="relative grid min-h-[640px] w-full max-w-[1040px] grid-cols-1 overflow-hidden rounded-[30px] border border-[#eadfed] bg-white shadow-[0_24px_70px_rgba(79,28,91,.16)] lg:grid-cols-[1.05fr_.95fr]">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-[#451257] via-[#702082] to-[#963ba5] px-10 py-10 lg:flex">
          <div className="flex items-center gap-3"><div className="pea-skeleton-dark h-14 w-14 rounded-[16px]" /><div><div className="pea-skeleton-dark h-3 w-28" /><div className="pea-skeleton-dark mt-2 h-5 w-20" /></div></div>
          <div><div className="pea-skeleton-dark h-8 w-48 rounded-full" /><div className="pea-skeleton-dark mt-6 h-11 w-[86%]" /><div className="pea-skeleton-dark mt-3 h-11 w-[68%]" /><div className="pea-skeleton-dark mt-6 h-4 w-[82%]" /><div className="pea-skeleton-dark mt-3 h-4 w-[68%]" /></div>
          <div className="grid grid-cols-3 gap-3">{Array.from({length:3}).map((_, i) => <div key={i} className="rounded-[18px] border border-white/10 bg-white/10 p-4"><div className="pea-skeleton-dark mx-auto h-7 w-7 rounded-full" /><div className="pea-skeleton-dark mx-auto mt-3 h-3 w-12" /></div>)}</div>
        </aside>
        <div className="flex flex-col px-6 py-7 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
          <div className="lg:hidden flex items-center gap-3 mb-10"><Bone className="h-[52px] w-[52px] rounded-[14px]" /><div><Bone className="h-3 w-24" /><Bone className="mt-2 h-5 w-20" /></div></div>
          <Bone className="h-4 w-24" />
          <div className="my-auto py-8"><Bone className="h-3 w-24" /><Bone className="mt-4 h-10 w-48" /><Bone className="mt-3 h-4 w-56" /><div className="mt-8"><Bone className="h-3 w-32" /><Bone className="mt-2 h-[54px] w-full rounded-[16px]" /></div><div className="mt-5"><Bone className="h-3 w-20" /><Bone className="mt-2 h-[54px] w-full rounded-[16px]" /></div><Bone className="mt-6 h-[54px] w-full rounded-[16px]" /><div className="mt-6 rounded-[15px] bg-[#fff9d9] p-4"><Bone className="h-3 w-full" /><Bone className="mt-2 h-3 w-4/5" /></div></div>
          <Bone className="mx-auto h-3 w-56" />
        </div>
      </section>
    </main>
  )
}

export default function PageSkeleton({ variant = 'home' }) {
  if (variant === 'dashboard') return <DashboardSkeleton />
  if (variant === 'admin') return <AdminSkeleton />
  if (variant === 'report') return <ReportSkeleton />
  if (variant === 'login') return <LoginSkeleton />
  return <HomeSkeleton />
}
