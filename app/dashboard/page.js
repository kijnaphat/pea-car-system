'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function UltimateDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  const [globalStats, setGlobalStats] = useState({
    totalDistance: 0, totalTrips: 0, fuelSavings: 0, activeRate: 0, availableCars: 0, totalCars: 0
  })

  const [gasolineStats, setGasolineStats] = useState({ cost: 0, distance: 0, efficiency: 0, fuelLiters: 0 })
  const [evStats, setEvStats] = useState({ distance: 0, charges: 0, avgGain: 0, carbonSaved: 0, peaVoltaRate: 0 })

  const [analytics, setAnalytics] = useState({
    dailyTrend: [], topLocations: [], topDrivers: [], fleetTable: [], recentActivity: []
  })

  const handleClose = () => {
    window.close()
    setTimeout(() => { if (!window.closed) router.push('/') }, 100)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: logs } = await supabase.from('trip_logs').select('*, cars(*)').eq('is_completed', true)
        const { data: cars } = await supabase.from('cars').select('*')
        const { data: recent } = await supabase.from('trip_logs').select('*, cars(plate_number)').order('end_time', { ascending: false }).limit(5)

        if (logs && cars) {
          // ⛽ Gasoline Analytics
          const gasLogs = logs.filter(l => !l.cars?.plate_number?.includes('6ขฆ'))
          const gCost = gasLogs.reduce((s, l) => s + (l.fuel_cost || 0), 0)
          const gDist = gasLogs.reduce((s, l) => s + (l.end_mileage - l.start_mileage), 0)
          const gLiters = gasLogs.reduce((s, l) => s + (l.fuel_liters || 0), 0)

          // ⚡ EV Analytics
          const evLogs = logs.filter(l => l.cars?.plate_number?.includes('6ขฆ'))
          const evDist = evLogs.reduce((s, l) => s + (l.end_mileage - l.start_mileage), 0)
          const evCharges = evLogs.filter(l => l.battery_after > 0)
          const peaVoltaCount = evCharges.filter(l => l.station_type === 'PEA').length
          const battGains = evCharges.map(l => (l.battery_after - l.battery_before))
          const avgCharge = battGains.length > 0 ? (battGains.reduce((a,b)=>a+b,0)/battGains.length) : 0

          // Calculate Comprehensive Fleet Table
          const fleetData = cars.map(c => {
             const cLogs = logs.filter(l => l.car_id === c.id)
             const totalD = cLogs.reduce((s, l) => s + (l.end_mileage - l.start_mileage), 0)
             const totalC = cLogs.reduce((s, l) => s + (l.fuel_cost || 0), 0)
             const chargeCount = cLogs.filter(l => l.battery_after > 0 || l.fuel_liters > 0).length
             const isEV = c.plate_number.includes('6ขฆ')
             
             return {
               plate: c.plate_number,
               type: isEV ? 'EV' : 'Gasoline',
               dist: totalD,
               trips: cLogs.length,
               efficiency: isEV ? 0 : (totalD > 0 ? (totalC / totalD).toFixed(2) : 0),
               refillCount: chargeCount,
               status: c.status
             }
          }).sort((a,b) => b.dist - a.dist)

          setGlobalStats({
            totalDistance: gDist + evDist,
            totalTrips: logs.length,
            fuelSavings: (evDist * (gCost / (gDist || 1))).toFixed(0),
            activeRate: ((cars.filter(c => c.status === 'busy').length / cars.length) * 100).toFixed(0),
            availableCars: cars.filter(c => c.status === 'available').length,
            totalCars: cars.length
          })

          setGasolineStats({ cost: gCost, distance: gDist, efficiency: gDist > 0 ? (gCost/gDist).toFixed(2) : 0, fuelLiters: gLiters })
          setEvStats({ distance: evDist, charges: evCharges.length, avgGain: avgCharge.toFixed(1), carbonSaved: (evDist * 0.12).toFixed(1), peaVoltaRate: evCharges.length > 0 ? ((peaVoltaCount/evCharges.length)*100).toFixed(0) : 0 })
          
          // Advanced Analytics
          const locMap = {}; const driverMap = {}; const trendMap = {}
          logs.forEach(l => {
            locMap[l.location] = (locMap[l.location] || 0) + 1
            if (!driverMap[l.driver_name]) driverMap[l.driver_name] = { trips: 0, dist: 0 }
            driverMap[l.driver_name].trips++
            driverMap[l.driver_name].dist += (l.end_mileage - l.start_mileage)
            const d = new Date(l.created_at).toLocaleDateString('th-TH', {weekday:'short'})
            trendMap[d] = (trendMap[d] || 0) + 1
          })

          setAnalytics({
            topLocations: Object.entries(locMap).sort((a,b)=>b[1]-a[1]).slice(0, 5),
            topDrivers: Object.entries(driverMap).sort((a,b)=>b.dist-a.dist).slice(0, 5),
            dailyTrend: Object.entries(trendMap).map(([label, val]) => ({ label, val })),
            fleetTable: fleetData,
            recentActivity: recent || []
          })
        }
      } catch (err) { console.error(err) } finally { setLoading(false) }
    }
    fetchData()
  }, [])

  if (loading) return <div className="min-h-screen bg-white flex flex-col items-center justify-center font-bold text-[#742F99]">
    <div className="w-12 h-12 border-4 border-[#742F99] border-t-transparent rounded-full animate-spin mb-4"></div>
    <p>กำลังประมวลผลข้อมูล Fleet ระดับสูง...</p>
  </div>

  return (
    <div className="min-h-screen bg-[#F4F7FE] font-sarabun text-slate-700 pb-20">
      
      {/* ⚪ NAVIGATION (Light Mode) */}
      <div className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-50 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
           <div className="p-2 bg-[#742F99]/5 rounded-2xl">
              <img src="/pea_logo.png" className="h-10 w-10 object-contain" alt="Logo" />
           </div>
           <div>
              <h1 className="text-xl font-black tracking-tight text-slate-800">FLEET ULTIMATE DASHBOARD</h1>
              <p className="text-[10px] text-purple-500 font-bold uppercase tracking-widest">Real-time Performance Monitoring</p>
           </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => router.push('/')} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all">หน้าหลัก</button>
          <button onClick={handleClose} className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-black hover:bg-red-600 hover:text-white transition-all">✖</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* 📊 GLOBAL KPI GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 relative overflow-hidden group">
              <div className="absolute -right-2 -bottom-2 opacity-5 text-6xl group-hover:scale-110 transition-transform">🚗</div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">การใช้รถปัจจุบัน</p>
              <div className="flex items-baseline gap-2 mt-2">
                 <span className="text-4xl font-black text-[#742F99]">{globalStats.activeRate}%</span>
                 <span className="text-xs text-slate-400 font-bold uppercase">Utilization</span>
              </div>
              <p className="text-[10px] text-green-500 mt-2 font-bold">● จอดว่าง {globalStats.availableCars} จาก {globalStats.totalCars} คัน</p>
           </div>
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">ระยะทางสะสมรวม</p>
              <h2 className="text-3xl font-black mt-2 text-slate-800">{globalStats.totalDistance.toLocaleString()} <span className="text-xs text-slate-400 font-bold">KM</span></h2>
              <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{width: '75%'}}></div>
              </div>
           </div>
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">การปล่อย CO2 ที่ลดได้</p>
              <h2 className="text-3xl font-black mt-2 text-green-500">{evStats.carbonSaved} <span className="text-xs">kg</span></h2>
              <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-tighter">Green Energy Impact</p>
           </div>
           <div className="bg-gradient-to-br from-[#742F99] to-[#5b237a] p-6 rounded-[2rem] shadow-lg text-white">
              <p className="text-purple-200 text-[10px] font-black uppercase tracking-widest">มูลค่าประหยัดรวม</p>
              <h2 className="text-3xl font-black mt-2">฿{globalStats.fuelSavings}</h2>
              <p className="text-[10px] text-white/50 mt-2 font-bold">เปรียบเทียบ EV vs น้ำมัน</p>
           </div>
        </div>

        {/* 🌓 DUAL CORE ANALYTICS (GAS vs EV) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* GAS Zone */}
           <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black flex items-center gap-2"><span className="text-orange-500 text-2xl">⛽</span> รายงานรถน้ำมัน</h3>
                <span className="text-[10px] font-black bg-orange-50 text-orange-600 px-3 py-1 rounded-full">GASOLINE FLEET</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                 <div className="text-center p-4 bg-orange-50 rounded-2xl">
                    <p className="text-[10px] font-black text-orange-400 uppercase">จ่ายน้ำมันรวม</p>
                    <p className="text-xl font-black text-orange-600">฿{gasolineStats.cost.toLocaleString()}</p>
                 </div>
                 <div className="text-center p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase">เติมสะสม</p>
                    <p className="text-xl font-black text-slate-700">{gasolineStats.fuelLiters.toFixed(1)} <span className="text-[10px]">L</span></p>
                 </div>
                 <div className="text-center p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase">ความสิ้นเปลือง</p>
                    <p className="text-xl font-black text-slate-700">{gasolineStats.efficiency} <span className="text-[10px]">บ/กม</span></p>
                 </div>
              </div>
           </div>

           {/* EV Zone */}
           <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border-t-8 border-green-400 border border-slate-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black flex items-center gap-2"><span className="text-green-500 text-2xl">⚡</span> รายงานรถ EV</h3>
                <span className="text-[10px] font-black bg-green-50 text-green-600 px-3 py-1 rounded-full">ELECTRIC VEHICLE</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                 <div className="text-center p-4 bg-green-50 rounded-2xl">
                    <p className="text-[10px] font-black text-green-400 uppercase">จำนวนครั้งชาร์จ</p>
                    <p className="text-2xl font-black text-green-600">{evStats.charges}</p>
                 </div>
                 <div className="text-center p-4 bg-blue-50 rounded-2xl">
                    <p className="text-[10px] font-black text-blue-400 uppercase">PEA Volta Rate</p>
                    <p className="text-2xl font-black text-blue-600">{evStats.peaVoltaRate}%</p>
                 </div>
                 <div className="text-center p-4 bg-slate-50 rounded-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase">ประจุเฉลี่ย</p>
                    <p className="text-2xl font-black text-slate-700">+{evStats.avgGain}%</p>
                 </div>
              </div>
           </div>
        </div>

        {/* 📈 MID ROW: TREND & DRIVER RANKING */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-10">แนวโน้มการใช้งาน 7 วัน</h3>
              <div className="h-56 flex items-end justify-between gap-4 px-2">
                 {analytics.dailyTrend.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center group relative cursor-pointer">
                       <div className="opacity-0 group-hover:opacity-100 absolute -top-10 transition-all bg-slate-800 text-white text-[10px] px-3 py-1 rounded-full shadow-lg font-bold z-10">{d.val} งาน</div>
                       <div className="w-full max-w-[40px] bg-slate-100 rounded-t-xl h-full flex items-end overflow-hidden">
                          <div className="w-full bg-gradient-to-t from-[#742F99] to-purple-400 group-hover:from-blue-500 group-hover:to-cyan-300 transition-all duration-500" style={{height: `${(d.val / Math.max(...analytics.dailyTrend.map(x=>x.val), 1)) * 100}%`}}></div>
                       </div>
                       <span className="text-[10px] font-black text-slate-400 mt-4 uppercase">{d.label}</span>
                    </div>
                 ))}
              </div>
           </div>

           <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Top Performers (KM)</h3>
              <div className="space-y-4">
                 {analytics.topDrivers.map(([name, data], i) => (
                    <div key={i} className="flex items-center justify-between group">
                       <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${i===0?'bg-yellow-400 text-white':'bg-slate-100 text-slate-400'}`}>{i+1}</div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-600">{name}</span>
                            <span className="text-[9px] text-slate-400 uppercase">{data.trips} ภารกิจ</span>
                          </div>
                       </div>
                       <span className="text-xs font-black text-[#742F99]">{data.dist.toLocaleString()} กม.</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* 📑 BOTTOM ROW: COMPREHENSIVE STATUS & ACTIVITY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           {/* Detailed Fleet Table */}
           <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-10 shadow-sm border border-slate-200">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8">Comprehensive Fleet Status</h3>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="text-[10px] text-slate-400 uppercase font-black border-b border-slate-100">
                          <th className="pb-6 px-4">Plate Number</th>
                          <th className="pb-6 px-4">Type</th>
                          <th className="pb-6 px-4">Distance</th>
                          <th className="pb-6 px-4 text-center">Refill/Charge</th>
                          <th className="pb-6 px-4 text-center">Efficiency</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {analytics.fleetTable.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-all">
                             <td className="py-6 px-4 font-black text-slate-800">{c.plate}</td>
                             <td className="py-6 px-4">
                                <span className={`text-[9px] font-black px-3 py-1 rounded-full ${c.type === 'EV' ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'}`}>{c.type}</span>
                             </td>
                             <td className="py-6 px-4 font-black text-slate-700">{c.dist.toLocaleString()} <span className="text-[9px] text-slate-300">KM</span></td>
                             <td className="py-6 px-4 text-center text-sm font-bold text-slate-500">{c.refillCount} ครั้ง</td>
                             <td className="py-6 px-4 text-center">
                                {c.type === 'EV' ? (
                                   <span className="text-[10px] font-bold text-green-500">Eco-Friendly</span>
                                ) : (
                                   <span className="text-sm font-black text-[#742F99]">{c.efficiency} <span className="text-[9px] font-normal text-slate-400">บ/กม</span></span>
                                )}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>

           {/* Recent Activity Feed */}
           <div className="bg-[#1e293b] rounded-[2.5rem] p-8 shadow-2xl text-white">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-8">Recent Activity</h3>
              <div className="space-y-6">
                 {analytics.recentActivity.map((act, i) => (
                    <div key={i} className="flex items-start gap-4 border-l-2 border-slate-700 pl-4 relative">
                       <div className="absolute -left-[5px] top-0 w-2 h-2 bg-blue-500 rounded-full"></div>
                       <div className="flex flex-col">
                          <span className="text-xs font-black text-blue-400">{act.cars?.plate_number}</span>
                          <span className="text-[11px] font-bold text-slate-200 mt-1">{act.driver_name} ➜ {act.location}</span>
                          <span className="text-[9px] text-slate-500 mt-1">{new Date(act.end_time).toLocaleTimeString('th-TH')} น.</span>
                       </div>
                    </div>
                 ))}
                 {analytics.recentActivity.length === 0 && <p className="text-xs text-slate-500 text-center py-10">ไม่มีรายการล่าสุด</p>}
              </div>
              <button onClick={() => router.push('/')} className="w-full mt-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-blue-500/20 uppercase tracking-widest">ดูรถทั้งหมด</button>
           </div>
        </div>

      </div>
    </div>
  )
}