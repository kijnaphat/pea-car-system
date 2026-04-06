'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

// --- Helper Components for Premium UI ---
const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-white/80 backdrop-blur-2xl rounded-[2.5rem] border border-white shadow-[0_10px_40px_rgb(0,0,0,0.03)] p-7 relative overflow-hidden ${className}`}>
    {children}
  </div>
)

const SectionTitle = ({ icon, title, subtitle }) => (
  <div className="mb-6 z-10 relative">
      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
          <span className="bg-gradient-to-br from-[#742F99] to-[#A163C1] text-transparent bg-clip-text text-xl drop-shadow-sm">{icon}</span> 
          {title}
      </h3>
      {subtitle && <p className="text-[10px] text-slate-400 font-bold ml-8 mt-1">{subtitle}</p>}
  </div>
)

export default function UltimateDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  const [timeFilter, setTimeFilter] = useState('month')
  
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0];
  })
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const [rawLogs, setRawLogs] = useState([])
  const [carsList, setCarsList] = useState([])
  
  const [globalStats, setGlobalStats] = useState({
    totalDistance: 0, totalTrips: 0, fuelSavings: 0, activeRate: 0, availableCars: 0, totalCars: 0, busyCars: 0, avgTripDist: 0, ecoScore: 0
  })

  const [gasolineStats, setGasolineStats] = useState({ cost: 0, distance: 0, efficiency: 0, fuelLiters: 0 })
  const [evStats, setEvStats] = useState({ distance: 0, charges: 0, avgGain: 0, carbonSaved: 0 })

  const [analytics, setAnalytics] = useState({
    dailyTrend: [], hourlyTrend: [], topLocations: [], driverStats: [], fleetTable: [], carDriverHistory: []
  })

  const handleClose = () => {
    window.close()
    setTimeout(() => { if (!window.closed) router.push('/') }, 100)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: logs } = await supabase.from('trip_logs').select('*, cars(*)').eq('is_completed', true).order('start_time', { ascending: false })
        const { data: cars } = await supabase.from('cars').select('*')

        if (logs && cars) {
          setRawLogs(logs)
          setCarsList(cars)
        }
      } catch (err) { 
        console.error(err) 
      } finally { 
        setLoading(false) 
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (rawLogs.length === 0 || carsList.length === 0) return

    const now = new Date()
    let startDate = new Date(0) 
    let endDate = new Date() 

    if (timeFilter === 'week') {
      const day = now.getDay()
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) 
      startDate = new Date(now.setDate(diff))
      startDate.setHours(0,0,0,0)
    } else if (timeFilter === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      startDate.setHours(0,0,0,0)
    } else if (timeFilter === 'custom') {
      startDate = new Date(customStartDate)
      startDate.setHours(0,0,0,0)
      endDate = new Date(customEndDate)
      endDate.setHours(23,59,59,999) 
    }

    const filteredLogs = rawLogs.filter(l => {
        const logDate = new Date(l.start_time)
        return logDate >= startDate && logDate <= endDate
    })

    const gasLogs = filteredLogs.filter(l => l.cars?.fuel_type?.toUpperCase() !== 'EV' && !l.cars?.plate_number?.includes('6ขฆ'))
    const gCost = gasLogs.reduce((s, l) => s + (l.fuel_cost || 0), 0)
    const gDist = gasLogs.reduce((s, l) => s + (l.end_mileage - l.start_mileage), 0)
    const gLiters = gasLogs.reduce((s, l) => s + (l.fuel_liters || 0), 0)

    const evLogs = filteredLogs.filter(l => l.cars?.fuel_type?.toUpperCase() === 'EV' || l.cars?.plate_number?.includes('6ขฆ'))
    const evDist = evLogs.reduce((s, l) => s + (l.end_mileage - l.start_mileage), 0)
    const evCharges = evLogs.filter(l => l.battery_after > 0)
    const battGains = evCharges.map(l => (l.battery_after - l.battery_before))
    const avgCharge = battGains.length > 0 ? (battGains.reduce((a,b)=>a+b,0)/battGains.length) : 0

    const totalDist = gDist + evDist
    const totalTrips = filteredLogs.length

    const fleetData = carsList.map(c => {
        const cLogs = filteredLogs.filter(l => l.car_id === c.id)
        const totalD = cLogs.reduce((s, l) => s + (l.end_mileage - l.start_mileage), 0)
        const totalC = cLogs.reduce((s, l) => s + (l.fuel_cost || 0), 0)
        const totalL = cLogs.reduce((s, l) => s + (l.fuel_liters || 0), 0)
        const chargeCount = cLogs.filter(l => l.battery_after > 0 || l.fuel_liters > 0).length
        const isEV = c.fuel_type?.toUpperCase() === 'EV' || c.plate_number.includes('6ขฆ')

        return {
          plate: c.plate_number,
          type: isEV ? 'EV' : 'Gasoline',
          dist: totalD,
          trips: cLogs.length,
          fuelLiters: totalL,
          fuelCost: totalC, 
          efficiency: isEV ? 0 : (totalD > 0 ? (totalC / totalD).toFixed(2) : 0),
          refillCount: chargeCount,
          status: c.status,
          model: c.model
        }
    }).sort((a,b) => b.dist - a.dist)

    const driverMap = {}
    const locMap = {}
    const hourlyMap = Array(24).fill(0)

    filteredLogs.forEach(l => {
      // Driver Stats
      if (!driverMap[l.driver_name]) driverMap[l.driver_name] = { trips: 0, dist: 0, cars: new Set() }
      driverMap[l.driver_name].trips++
      driverMap[l.driver_name].dist += (l.end_mileage - l.start_mileage)
      if (l.cars?.plate_number) driverMap[l.driver_name].cars.add(l.cars.plate_number)

      // Location Stats
      if (l.location && l.location !== '-') {
          locMap[l.location] = (locMap[l.location] || 0) + 1
      }

      // Hourly Stats
      const hour = new Date(l.start_time).getHours()
      hourlyMap[hour]++
    })
    
    const driverList = Object.entries(driverMap).map(([name, data]) => ({
      name, trips: data.trips, dist: data.dist, carsUsed: Array.from(data.cars).join(', ')
    })).sort((a,b) => b.dist - a.dist)

    const topLocationsList = Object.entries(locMap).map(([name, count]) => ({
        name, count
    })).sort((a,b) => b.count - a.count).slice(0, 5)

    const carDriverMap = {}
    carsList.forEach(c => {
      const cLogs = filteredLogs.filter(l => l.car_id === c.id)
      if (cLogs.length > 0) {
        const drivers = {}
        cLogs.forEach(l => {
          drivers[l.driver_name] = (drivers[l.driver_name] || 0) + 1
        })
        carDriverMap[c.plate_number] = {
           type: c.fuel_type?.toUpperCase() === 'EV' || c.plate_number.includes('6ขฆ') ? 'EV' : 'GAS',
           totalTrips: cLogs.length,
           drivers: Object.entries(drivers).map(([name, count]) => `${name} (${count})`).join(', ')
        }
      }
    })
    const carDriverList = Object.entries(carDriverMap).map(([plate, data]) => ({ plate, ...data })).sort((a,b) => b.totalTrips - a.totalTrips)

    const trendMap = {}
    filteredLogs.forEach(l => {
      const d = new Date(l.start_time).toLocaleDateString('th-TH', {day: '2-digit', month: 'short'})
      trendMap[d] = (trendMap[d] || 0) + 1
    })
    const sortedTrend = Object.entries(trendMap).map(([label, val]) => ({ label, val })).slice(0, 7).reverse()
    const sortedHourly = hourlyMap.map((val, label) => ({ label: `${label}:00`, val }))

    const busy = carsList.filter(c => c.status === 'busy').length;
    const avail = carsList.filter(c => c.status === 'available').length;

    setGlobalStats({
      totalDistance: totalDist,
      totalTrips: totalTrips,
      fuelSavings: (evDist * (gCost / (gDist || 1))).toFixed(0),
      activeRate: ((busy / carsList.length) * 100).toFixed(0),
      availableCars: avail,
      busyCars: busy,
      totalCars: carsList.length,
      avgTripDist: totalTrips > 0 ? (totalDist / totalTrips).toFixed(1) : 0,
      ecoScore: totalDist > 0 ? ((evDist / totalDist) * 100).toFixed(0) : 0 
    })

    setGasolineStats({ cost: gCost, distance: gDist, efficiency: gDist > 0 ? (gCost/gDist).toFixed(2) : 0, fuelLiters: gLiters })
    setEvStats({ distance: evDist, charges: evCharges.length, avgGain: avgCharge.toFixed(1), carbonSaved: (evDist * 0.12).toFixed(1) })
    
    setAnalytics({
      dailyTrend: sortedTrend,
      hourlyTrend: sortedHourly,
      topLocations: topLocationsList,
      driverStats: driverList,
      fleetTable: fleetData,
      carDriverHistory: carDriverList
    })

  }, [rawLogs, carsList, timeFilter, customStartDate, customEndDate])

  if (loading) return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center justify-center font-bold text-[#742F99]">
        <div className="w-20 h-20 relative flex items-center justify-center">
             <div className="absolute w-full h-full border-4 border-[#742F99]/20 rounded-full"></div>
             <div className="absolute w-full h-full border-4 border-t-[#742F99] rounded-full animate-spin"></div>
             <span className="text-2xl animate-pulse">⚡</span>
        </div>
        <p className="tracking-widest mt-4 text-sm font-black animate-pulse">LOADING DASHBOARD...</p>
    </div>
  )

  const maxTrend = Math.max(...analytics.dailyTrend.map(d => d.val), 1);
  const maxHourly = Math.max(...analytics.hourlyTrend.map(d => d.val), 1);
  const maxLoc = Math.max(...analytics.topLocations.map(l => l.count), 1);

  return (
    <div className="min-h-screen bg-slate-50 font-sarabun text-slate-700 pb-20 selection:bg-[#742F99] selection:text-white relative">
      
      {/* Background Ornaments */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-[#742F99]/5 to-transparent -z-10 pointer-events-none"></div>
      <div className="absolute top-20 right-20 w-96 h-96 bg-purple-300/20 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      {/* 🟣 PREMIUM NAVIGATION */}
      <div className="bg-white/70 backdrop-blur-2xl border-b border-white px-6 py-4 sticky top-0 z-50 flex flex-col xl:flex-row gap-6 justify-between items-center shadow-[0_4px_30px_rgb(0,0,0,0.03)]">
        <div className="flex items-center gap-4">
           <img src="/pea_logo.png" className="h-12 w-auto object-contain drop-shadow-sm" alt="PEA Logo" />
           <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-800">FLEET <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#742F99] to-[#A163C1]">INTELLIGENCE</span></h1>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Advanced Analytics & Monitoring</p>
           </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 bg-white/60 p-2 rounded-3xl border border-white shadow-sm">
          
          {timeFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-[#742F99]/5 border border-[#742F99]/20 p-2 px-4 rounded-2xl shadow-inner transition-all animate-fade-in-right">
                <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="text-xs font-bold text-[#742F99] bg-transparent outline-none cursor-pointer font-mono"/>
                <span className="text-[#742F99]/40 text-xs font-black">➔</span>
                <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="text-xs font-bold text-[#742F99] bg-transparent outline-none cursor-pointer font-mono"/>
            </div>
          )}

          <div className="flex bg-slate-100/80 p-1 rounded-2xl shadow-inner">
            {['week', 'month', 'custom', 'all'].map(tf => (
                <button 
                    key={tf}
                    onClick={() => setTimeFilter(tf)} 
                    className={`px-5 py-2.5 text-[11px] uppercase tracking-wider font-black rounded-xl transition-all duration-300 ${
                        timeFilter === tf 
                        ? 'bg-gradient-to-r from-[#742F99] to-[#8B46AC] shadow-lg shadow-[#742F99]/30 text-white scale-100' 
                        : 'text-slate-500 hover:bg-white hover:text-[#742F99] scale-95'
                    }`}
                >
                    {tf === 'week' ? 'สัปดาห์นี้' : tf === 'month' ? 'เดือนนี้' : tf === 'custom' ? 'กำหนดเอง' : 'ทั้งหมด'}
                </button>
            ))}
          </div>

          <div className="w-px h-8 bg-slate-200 mx-2 hidden md:block"></div>

          <div className="flex gap-2">
            <button onClick={() => router.push('/')} className="group px-5 py-2.5 bg-white border border-slate-100 rounded-2xl text-xs font-bold hover:border-[#742F99]/30 hover:bg-[#742F99]/5 text-slate-600 hover:text-[#742F99] transition-all shadow-sm flex items-center gap-2">
                <span className="group-hover:-translate-x-1 transition-transform">⬅</span> หน้าหลัก
            </button>
            <button onClick={handleClose} className="px-5 py-2.5 bg-red-50 border border-red-100 rounded-2xl text-xs font-black text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm hover:shadow-red-500/20">
                ✖ ปิด
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto p-4 md:p-8 space-y-6 mt-2">
        
        {/* 🌟 BENTO GRID ROW 1: CORE KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <GlassCard className="group hover:-translate-y-1 transition-all duration-500">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-blue-100/50">🛣️</div>
                <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">ระยะทางสะสม</p>
                    <h3 className="text-3xl font-black text-slate-800 mt-0.5">{globalStats.totalDistance.toLocaleString()} <span className="text-sm text-slate-400 font-bold">KM</span></h3>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#742F99] mt-5">
                 <span className="bg-[#742F99]/10 text-[#742F99] px-2.5 py-1 rounded-lg">⚡ {globalStats.totalTrips} ภารกิจ</span>
                 <span className="text-slate-400 border border-slate-200 px-2.5 py-1 rounded-lg">~{globalStats.avgTripDist} กม./รอบ</span>
              </div>
           </GlassCard>
           
           <GlassCard className="group hover:-translate-y-1 transition-all duration-500">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-orange-50 text-orange-500 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-orange-100/50">⛽</div>
                <div>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">ใช้น้ำมันรวม</p>
                    <h3 className="text-3xl font-black text-slate-800 mt-0.5">{gasolineStats.fuelLiters.toLocaleString(undefined, {maximumFractionDigits:1})} <span className="text-sm text-slate-400 font-bold">L</span></h3>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-orange-600 mt-5">
                 <span className="bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-lg">จ่าย ฿{gasolineStats.cost.toLocaleString()}</span>
                 <span className="text-slate-400">เรท {gasolineStats.efficiency} บ./กม.</span>
              </div>
           </GlassCard>

           <GlassCard className="group hover:-translate-y-1 transition-all duration-500 bg-gradient-to-br from-white to-green-50/50 border-green-100/50">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/5 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
              <div className="flex justify-between items-start mb-4 relative z-10">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center text-xl shadow-inner border border-green-200/50">🌱</div>
                  <span className="text-[9px] font-black bg-green-500 text-white px-3 py-1 rounded-xl uppercase tracking-wider animate-pulse shadow-lg shadow-green-500/30">Green Impact</span>
              </div>
              <div className="relative z-10">
                  <p className="text-green-600/70 text-[10px] font-black uppercase tracking-widest">ลดการปล่อย CO2</p>
                  <h3 className="text-4xl font-black text-green-600 mt-0.5">{evStats.carbonSaved} <span className="text-lg font-bold">kg</span></h3>
              </div>
           </GlassCard>

           <GlassCard className="!p-1 bg-gradient-to-br from-[#742F99] via-[#A163C1] to-[#5b237a] shadow-xl shadow-[#742F99]/20 hover:-translate-y-1 transition-all duration-500 group !border-none">
              <div className="absolute inset-0 bg-[url('/noise.png')] opacity-10 mix-blend-overlay"></div>
              <div className="bg-[#742F99]/90 backdrop-blur-md rounded-[2.3rem] p-6 h-full relative overflow-hidden flex flex-col justify-center">
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md text-white rounded-xl flex items-center justify-center text-lg shadow-inner border border-white/20">💰</div>
                    <p className="text-purple-200 text-[10px] font-black uppercase tracking-widest leading-tight">มูลค่าประหยัด<br/>(เทียบใช้น้ำมัน)</p>
                </div>
                <h3 className="text-4xl font-black text-white mt-1 drop-shadow-sm">฿{Number(globalStats.fuelSavings).toLocaleString()}</h3>
              </div>
           </GlassCard>
        </div>

        {/* 📈 BENTO GRID ROW 2: ADVANCED CHARTS & FLEET STATUS */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
           
           {/* Left Block: Charts (8 cols) */}
           <div className="xl:col-span-8 flex flex-col gap-6">
               {/* 📊 Chart 1: Daily Trend */}
               <GlassCard>
                  <SectionTitle icon="📅" title="ความถี่การใช้งาน (Daily Missions)" subtitle="ดูแนวโน้มปริมาณภารกิจย้อนหลัง" />
                  <div className="h-56 flex items-end justify-between gap-3 px-2 relative border-b border-slate-100/80 pb-4 pt-10">
                     {analytics.dailyTrend.map((d, i) => {
                         const heightPct = (d.val / maxTrend) * 100;
                         return (
                             <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-12 transition-all bg-slate-800 text-white text-[11px] px-3 py-1.5 rounded-xl shadow-xl shadow-slate-800/20 font-bold z-10 whitespace-nowrap pointer-events-none -translate-y-2 group-hover:translate-y-0">
                                    {d.val} ภารกิจ
                                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-800 rotate-45 rounded-sm"></div>
                                </div>
                                <div className="w-full max-w-[48px] bg-slate-100/50 rounded-t-2xl flex items-end overflow-hidden relative group-hover:bg-[#742F99]/5 transition-colors" style={{height: '100%'}}>
                                   <div 
                                      className="w-full bg-gradient-to-t from-[#742F99] via-[#8B46AC] to-[#A163C1] rounded-t-2xl group-hover:brightness-110 transition-all duration-500 ease-out relative shadow-sm" 
                                      style={{height: `${heightPct}%`}}
                                   >
                                      <div className="absolute top-0 left-0 w-full h-1 bg-white/40"></div>
                                   </div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 mt-3 whitespace-nowrap group-hover:text-[#742F99] transition-colors">{d.label}</span>
                             </div>
                         )
                     })}
                     {analytics.dailyTrend.length === 0 && <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm font-bold">ไม่มีข้อมูลในช่วงเวลานี้</div>}
                  </div>
               </GlassCard>

               {/* ⏰ Chart 2: Hourly Trend */}
               <GlassCard>
                  <SectionTitle icon="⏰" title="ช่วงเวลาหนาแน่น (Hourly Heatmap)" subtitle="วิเคราะห์เวลาที่มีการนำรถออกมากที่สุด (00:00 - 23:00)" />
                  <div className="h-40 flex items-end justify-between gap-1 relative pb-6 pt-8">
                     {analytics.hourlyTrend.map((d, i) => {
                         const heightPct = (d.val / maxHourly) * 100;
                         const isPeak = heightPct > 70;
                         return (
                             <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                                {d.val > 0 && (
                                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 transition-all bg-slate-800 text-white text-[9px] px-2 py-1 rounded-lg shadow-sm font-bold z-10 whitespace-nowrap pointer-events-none">
                                      {d.val} งาน
                                  </div>
                                )}
                                <div className="w-full bg-slate-100/50 rounded-t-sm flex items-end overflow-hidden relative" style={{height: '100%'}}>
                                   <div 
                                      className={`w-full transition-all duration-500 ease-out rounded-t-sm ${isPeak ? 'bg-gradient-to-t from-orange-500 to-yellow-400 shadow-[0_0_10px_rgba(249,115,22,0.3)]' : 'bg-gradient-to-t from-blue-400 to-cyan-300'} group-hover:brightness-110`} 
                                      style={{height: `${heightPct}%`, minHeight: d.val>0 ? '4px' : '0'}}
                                   ></div>
                                </div>
                                <span className={`text-[8px] font-bold mt-2 absolute -bottom-4 whitespace-nowrap transform -rotate-45 origin-top-left ${isPeak ? 'text-orange-500' : 'text-slate-400'}`}>{i % 2 === 0 ? d.label : ''}</span>
                             </div>
                         )
                     })}
                  </div>
               </GlassCard>
           </div>

           {/* Right Block: Status & Eco Score & Locations (4 cols) */}
           <div className="xl:col-span-4 flex flex-col gap-6">
              
              {/* ECO Score Widget (NEW) */}
              <GlassCard className="bg-gradient-to-br from-green-500 to-emerald-700 text-white !border-none shadow-xl shadow-green-500/20 relative group overflow-hidden">
                 <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
                 <div className="flex justify-between items-center z-10 relative">
                     <div>
                         <p className="text-green-100 text-[10px] font-black uppercase tracking-widest mb-1">ดัชนีรักษ์โลก (EV Ratio)</p>
                         <h3 className="text-4xl font-black drop-shadow-md">{globalStats.ecoScore}%</h3>
                     </div>
                     <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center relative">
                         <div className="absolute inset-0 rounded-full border-4 border-white" style={{ clipPath: `polygon(0 0, 100% 0, 100% ${globalStats.ecoScore}%, 0 ${globalStats.ecoScore}%)` }}></div>
                         <span className="text-2xl drop-shadow-sm">🌍</span>
                     </div>
                 </div>
                 <p className="text-[10px] text-green-50 mt-4 font-bold bg-black/10 inline-block px-3 py-1 rounded-lg backdrop-blur-sm border border-white/10 z-10 relative">สัดส่วนระยะทางที่วิ่งด้วยรถ EV</p>
              </GlassCard>

              {/* Fleet Status Overview */}
              <GlassCard>
                  <SectionTitle icon="🚘" title="สถานะลานจอด" />
                  <div className="flex items-center gap-6 bg-slate-50 p-5 rounded-3xl border border-slate-100">
                      <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center rounded-full bg-white shadow-sm border border-slate-100">
                          <svg viewBox="0 0 36 36" className="w-16 h-16 rotate-[-90deg]">
                             <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4"/>
                             <path className="text-[#742F99] drop-shadow-[0_0_3px_rgba(116,47,153,0.4)]" strokeDasharray={`${globalStats.activeRate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                          </svg>
                          <div className="absolute flex flex-col items-center mt-0.5">
                             <span className="text-lg font-black text-[#742F99] leading-none">{globalStats.activeRate}%</span>
                          </div>
                      </div>
                      <div className="flex flex-col gap-2.5 w-full">
                          <div className="flex justify-between items-center text-xs font-bold">
                              <span className="flex items-center gap-2 text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> วิ่งงาน</span>
                              <span className="text-slate-800 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">{globalStats.busyCars}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold">
                              <span className="flex items-center gap-2 text-green-600"><span className="w-2 h-2 rounded-full bg-green-500"></span> จอดว่าง</span>
                              <span className="text-slate-800 bg-green-50 px-2 py-0.5 rounded-md border border-green-100">{globalStats.availableCars}</span>
                          </div>
                      </div>
                  </div>
              </GlassCard>

              {/* Top Locations */}
              <GlassCard className="flex-1 flex flex-col">
                  <SectionTitle icon="📍" title="ปลายทางยอดฮิต" />
                  <div className="space-y-4 flex-1 mt-2">
                     {analytics.topLocations.map((loc, i) => (
                        <div key={i} className="flex flex-col gap-1.5 group">
                            <div className="flex justify-between items-end text-[11px] font-bold">
                                <span className="text-slate-700 truncate pr-2 flex items-center gap-2">
                                   <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${i===0 ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-200 text-slate-500'}`}>{i+1}</span>
                                   {loc.name}
                                </span>
                                <span className="text-slate-500 whitespace-nowrap">{loc.count} ครั้ง</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner relative">
                                <div className="bg-gradient-to-r from-orange-400 to-yellow-400 h-full rounded-full transition-all duration-1000 relative" style={{width: `${(loc.count / maxLoc)*100}%`}}></div>
                            </div>
                        </div>
                     ))}
                     {analytics.topLocations.length === 0 && <p className="text-xs text-slate-400 text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">ไม่มีข้อมูลปลายทาง</p>}
                  </div>
              </GlassCard>
           </div>
        </div>

        {/* 📑 ROW 3: COMPREHENSIVE FLEET TABLE */}
        <GlassCard>
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <SectionTitle icon="📋" title="รายงานสรุปรายคัน (Fleet Detail Report)" subtitle="แสดงข้อมูลระยะทาง ปริมาณเชื้อเพลิง และประสิทธิภาพของรถแต่ละคัน" />
           </div>
           
           <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="text-[11px] text-slate-500 uppercase font-black bg-slate-50/80 backdrop-blur-sm">
                       <th className="py-5 px-6 border-b border-slate-200">ทะเบียนรถ / รุ่น</th>
                       <th className="py-5 px-6 border-b border-slate-200">สถานะ</th>
                       <th className="py-5 px-6 border-b border-slate-200 text-center">ใช้งาน (รอบ)</th>
                       <th className="py-5 px-6 border-b border-slate-200 text-right">ระยะทางรวม</th>
                       <th className="py-5 px-6 border-b border-slate-200 text-right">ปริมาณ / ค่าใช้จ่าย</th>
                       <th className="py-5 px-6 border-b border-slate-200 text-center">ประสิทธิภาพ</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 text-sm bg-white">
                    {analytics.fleetTable.map((c, i) => (
                       <tr key={i} className="hover:bg-[#742F99]/[0.02] transition-colors">
                          <td className="py-4 px-6">
                             <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-sm border ${c.type==='EV'?'bg-green-50 border-green-100 text-green-600':'bg-orange-50 border-orange-100 text-orange-600'}`}>
                                   {c.type==='EV' ? '⚡' : '⛽'}
                                </div>
                                <div>
                                   <p className="font-black text-slate-700 text-base">{c.plate}</p>
                                   <p className="text-[10px] text-slate-400 font-bold">{c.model} | {c.type}</p>
                                </div>
                             </div>
                          </td>
                          <td className="py-4 px-6">
                             <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-full border shadow-sm ${
                                 c.status === 'available' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
                             }`}>
                                 <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'available' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></span>
                                 {c.status === 'available' ? 'ว่างพร้อมใช้' : 'กำลังใช้งาน'}
                             </span>
                          </td>
                          <td className="py-4 px-6 text-center">
                             <span className="font-black text-[#742F99] bg-[#742F99]/10 px-3 py-1 rounded-lg border border-[#742F99]/20">{c.trips}</span>
                          </td>
                          <td className="py-4 px-6 text-right">
                             <span className="font-black text-slate-700 text-base">{c.dist.toLocaleString()}</span> <span className="text-[11px] text-slate-400 font-bold">กม.</span>
                          </td>
                          <td className="py-4 px-6 text-right font-bold text-slate-600">
                              {c.type === 'EV' ? (
                                  <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-100 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-sm">
                                      ⚡ {c.refillCount} ชาร์จ
                                  </span>
                              ) : (
                                  <div className="flex flex-col items-end gap-1.5">
                                      <span className="inline-flex items-center gap-1.5 text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm">
                                          ⛽ {c.fuelLiters.toFixed(1)} L
                                      </span>
                                      {c.fuelCost > 0 && (
                                          <span className="inline-flex items-center gap-1.5 text-sky-700 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm">
                                              💸 ฿ {c.fuelCost.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                          </span>
                                      )}
                                  </div>
                              )}
                          </td>
                          <td className="py-4 px-6 text-center">
                             {c.type === 'EV' ? (
                                <span className="text-[10px] font-black text-white bg-gradient-to-r from-green-400 to-green-600 px-3 py-1 rounded-full uppercase tracking-wider shadow-sm shadow-green-500/20">EV ECO</span>
                             ) : (
                                <span className="font-black text-[#742F99] bg-purple-50 px-3 py-1 rounded-lg border border-purple-100">{c.efficiency} <span className="text-[10px] font-normal text-purple-400">บ./กม.</span></span>
                             )}
                          </td>
                       </tr>
                    ))}
                    {analytics.fleetTable.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-sm text-slate-400 font-bold bg-slate-50/50">ไม่มีข้อมูลการใช้งานในช่วงเวลานี้</td></tr>}
                 </tbody>
              </table>
           </div>
        </GlassCard>

        {/* 👥 ROW 4: LEADERBOARDS & LOGS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Top Vehicles */}
           <GlassCard>
              <SectionTitle icon="⭐️" title="รถที่ถูกใช้งานมากสุด" />
              <div className="space-y-4">
                 {analytics.fleetTable.filter(c=>c.dist > 0).slice(0, 3).map((c, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 border border-slate-100 rounded-2xl relative overflow-hidden">
                       <div className={`absolute left-0 top-0 w-1.5 h-full ${i===0?'bg-yellow-400':i===1?'bg-slate-400':'bg-orange-400'}`}></div>
                       <div className="flex flex-col ml-2">
                          <span className="text-sm font-black text-slate-800">{c.plate}</span>
                          <span className="text-[10px] text-slate-500 font-bold mt-0.5">{c.model}</span>
                       </div>
                       <div className="text-right">
                          <span className="text-base font-black text-[#742F99] block">{c.dist.toLocaleString()} <span className="text-[10px] text-slate-400">กม.</span></span>
                          <span className="text-[9px] text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm">{c.trips} รอบ</span>
                       </div>
                    </div>
                 ))}
                 {analytics.fleetTable.filter(c=>c.dist > 0).length === 0 && <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50"><p className="text-sm text-slate-400 font-bold">ยังไม่มีรถออกวิ่ง</p></div>}
              </div>
           </GlassCard>

           {/* Driver Leaderboard */}
           <GlassCard>
              <SectionTitle icon="👨‍✈️" title="นักขับยอดเยี่ยม" />
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                 {analytics.driverStats.map((d, i) => (
                    <div key={i} className="flex items-center justify-between group p-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 rounded-xl transition-colors">
                       <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center font-black text-xs shadow-sm ${
                              i===0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-500 text-white' : 
                              i===1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-white' : 
                              i===2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white' : 
                              'bg-slate-100 text-slate-400'
                          }`}>
                              {i+1}
                          </div>
                          <div className="flex flex-col">
                             <span className="text-xs font-black text-slate-700">{d.name}</span>
                             <span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[120px]">ขับ: {d.carsUsed}</span>
                          </div>
                       </div>
                       <div className="text-right">
                          <span className="text-sm font-black text-slate-800 block">{d.dist.toLocaleString()} <span className="text-[9px] text-slate-400">กม.</span></span>
                       </div>
                    </div>
                 ))}
                 {analytics.driverStats.length === 0 && <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50"><p className="text-sm text-slate-400 font-bold">ไม่มีข้อมูลผู้ขับขี่</p></div>}
              </div>
           </GlassCard>

           {/* Vehicle Usage Log */}
           <GlassCard>
              <SectionTitle icon="🔍" title="ใครขับคันไหนบ้าง?" />
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                 {analytics.carDriverHistory.map((c, i) => (
                    <div key={i} className="flex flex-col p-4 bg-white border border-slate-100 rounded-2xl relative overflow-hidden hover:border-[#742F99]/30 transition-colors">
                       <div className="flex justify-between items-center border-b border-slate-50 pb-2 mb-2">
                          <span className="text-sm font-black text-slate-800">{c.plate}</span>
                          <span className="text-[9px] bg-[#742F99]/10 text-[#742F99] px-2 py-1 rounded-md font-bold">{c.totalTrips} งาน</span>
                       </div>
                       <div className="flex flex-wrap gap-1.5">
                          {c.drivers.split(', ').map((driverLine, idx) => (
                             <span key={idx} className="bg-slate-50 text-[10px] text-slate-600 px-2 py-1 rounded-md font-medium border border-slate-100">
                                {driverLine}
                             </span>
                          ))}
                       </div>
                    </div>
                 ))}
                 {analytics.carDriverHistory.length === 0 && <div className="h-32 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50"><p className="text-sm text-slate-400 font-bold">ไม่มีข้อมูลการใช้รถ</p></div>}
              </div>
           </GlassCard>

        </div>

      </div>
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        input[type="date"]::-webkit-calendar-picker-indicator { 
            cursor: pointer; 
            filter: invert(27%) sepia(51%) saturate(2878%) hue-rotate(253deg) brightness(83%) contrast(85%);
            opacity: 0.6;
            transition: opacity 0.2s;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover { opacity: 1; }

        @keyframes fade-in-right {
            from { opacity: 0; transform: translateX(-10px); }
            to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-right { animation: fade-in-right 0.3s ease-out; }
      `}</style>
    </div>
  )
}