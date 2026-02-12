'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  
  // Stats State
  const [stats, setStats] = useState({
    totalTrips: 0,
    activeCars: 0,
    totalFuelCost: 0,
    totalDistance: 0,
    avgCostPerKm: 0,
    availableCars: 0,
    totalCars: 0
  })

  // Chart Data States
  const [locationStats, setLocationStats] = useState([])
  const [driverStats, setDriverStats] = useState([])
  const [carStats, setCarStats] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  
  // ✅ New Analytics States
  const [dailyTrend, setDailyTrend] = useState([])      // กราฟ 7 วัน
  const [carTypeStats, setCarTypeStats] = useState([])  // ประเภทรถ
  const [timeStats, setTimeStats] = useState({ morning: 0, afternoon: 0 }) // ช่วงเวลา

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Data
      const { data: logs } = await supabase.from('trip_logs').select('*, cars(plate_number, model, car_type)').eq('is_completed', true)
      const { data: cars } = await supabase.from('cars').select('*')
      const { data: recents } = await supabase.from('trip_logs').select('*, cars(plate_number)').order('created_at', { ascending: false }).limit(6)

      if (logs && cars) {
        // --- Basic Stats ---
        const totalDist = logs.reduce((sum, log) => sum + (log.end_mileage - log.start_mileage), 0)
        const totalCost = logs.reduce((sum, log) => sum + (log.fuel_cost || 0), 0)
        const activeCount = cars.filter(c => c.status === 'busy').length

        setStats({
          totalTrips: logs.length,
          activeCars: activeCount,
          availableCars: cars.length - activeCount,
          totalCars: cars.length,
          totalFuelCost: totalCost,
          totalDistance: totalDist,
          avgCostPerKm: totalDist > 0 ? (totalCost / totalDist) : 0
        })

        // --- 1. Daily Trend (7 Days) ---
        const last7Days = [...Array(7)].map((_, i) => {
            const d = new Date()
            d.setDate(d.getDate() - i)
            return d.toISOString().split('T')[0]
        }).reverse()

        const trendMap = {}
        last7Days.forEach(date => trendMap[date] = 0)
        
        logs.forEach(log => {
            const logDate = new Date(log.created_at).toISOString().split('T')[0]
            if (trendMap[logDate] !== undefined) trendMap[logDate]++
        })

        const maxTrip = Math.max(...Object.values(trendMap), 1) // หาค่าสูงสุดเพื่อทำความสูงกราฟ
        setDailyTrend(Object.entries(trendMap).map(([date, count]) => ({
            date: new Date(date).toLocaleDateString('th-TH', {weekday:'short'}),
            count,
            height: (count / maxTrip) * 100 // % ความสูง
        })))

        // --- 2. Vehicle Type Analysis ---
        const typeMap = {}
        cars.forEach(c => {
            const type = c.car_type || 'ทั่วไป'
            if (!typeMap[type]) typeMap[type] = { total: 0, active: 0 }
            typeMap[type].total++
            if (c.status === 'busy') typeMap[type].active++
        })
        setCarTypeStats(Object.entries(typeMap).map(([name, val]) => ({ name, ...val })))

        // --- 3. Time Analysis (Morning vs Afternoon) ---
        let morning = 0, afternoon = 0
        logs.forEach(log => {
            const hour = new Date(log.created_at).getHours()
            if (hour < 12) morning++
            else afternoon++
        })
        setTimeStats({ morning, afternoon })

        // --- 4. Location & Driver Analysis (Existing) ---
        const locMap = {}
        const driverMap = {}
        
        logs.forEach(log => {
          // Loc
          const loc = log.location || 'ไม่ระบุ'
          locMap[loc] = (locMap[loc] || 0) + 1
          
          // Driver
          const driver = log.driver_name || 'ไม่ระบุ'
          if (!driverMap[driver]) driverMap[driver] = { trips: 0, distance: 0 }
          driverMap[driver].trips++
          driverMap[driver].distance += (log.end_mileage - log.start_mileage)
        })

        setLocationStats(Object.entries(locMap)
          .map(([name, count]) => ({ name, count, percent: (count / logs.length) * 100 }))
          .sort((a, b) => b.count - a.count).slice(0, 5))

        setDriverStats(Object.entries(driverMap)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.trips - a.trips).slice(0, 5))

        // --- 5. Car Table Data ---
        const carMapStats = {}
        cars.forEach(c => {
            carMapStats[c.id] = { plate: c.plate_number, model: c.model, trips: 0, distance: 0, cost: 0 }
        })
        logs.forEach(log => {
            if (carMapStats[log.car_id]) {
                carMapStats[log.car_id].trips++
                carMapStats[log.car_id].distance += (log.end_mileage - log.start_mileage)
                carMapStats[log.car_id].cost += (log.fuel_cost || 0)
            }
        })
        setCarStats(Object.values(carMapStats).sort((a, b) => b.distance - a.distance))
      }
      
      if (recents) setRecentLogs(recents)
      setLoading(false)
    }

    fetchData()
  }, [])

  if (loading) return <div className="min-h-screen flex flex-col items-center justify-center bg-[#F5F3F7] text-[#742F99]"><div className="w-10 h-10 border-4 border-[#742F99] border-t-transparent rounded-full animate-spin mb-4"></div>กำลังวิเคราะห์ข้อมูล...</div>

  return (
    <div className="min-h-screen bg-[#F5F3F7] font-sarabun text-gray-800 pb-12">
      
      {/* 🟣 Header Bar */}
      <div className="bg-gradient-to-r from-[#591d79] to-[#742F99] shadow-lg px-6 py-4 sticky top-0 z-50 flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
           <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm border border-white/10">
             <img src="/pea_logo.png" className="h-8 w-8 object-contain" alt="Logo" />
           </div>
           <div>
             <h1 className="text-xl font-bold leading-none tracking-wide">PEA INTELLIGENCE</h1>
             <p className="text-[10px] text-purple-200 mt-0.5 opacity-90 tracking-wider">DASHBOARD & ANALYTICS</p>
           </div>
        </div>
        <button onClick={() => window.close()} className="text-xs bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition-all text-white backdrop-blur-md border border-white/20">
            ปิดหน้าต่าง
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* === 1. Top KPI Stats (Grid 4) === */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
           {/* Card 1: Active Status */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden group">
              <div className="absolute right-0 top-0 h-full w-1.5 bg-[#742F99]"></div>
              <div>
                 <p className="text-gray-500 text-xs uppercase tracking-wide">สถานะยานพาหนะ</p>
                 <div className="flex items-baseline gap-2 mt-1">
                    <h2 className="text-3xl font-bold text-[#742F99]">{stats.activeCars}</h2>
                    <span className="text-xs text-gray-400">คัน (ไม่ว่าง)</span>
                 </div>
                 <p className="text-[10px] text-green-500 mt-1">● ว่างพร้อมใช้ {stats.availableCars} คัน</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🚗</div>
           </div>

           {/* Card 2: Total Distance */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden group">
              <div className="absolute right-0 top-0 h-full w-1.5 bg-[#F3B236]"></div>
              <div>
                 <p className="text-gray-500 text-xs uppercase tracking-wide">ระยะทางสะสม</p>
                 <h2 className="text-3xl font-bold text-gray-800">{stats.totalDistance.toLocaleString()}</h2>
                 <p className="text-[10px] text-gray-400 mt-1">กิโลเมตร</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-50 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">🛣️</div>
           </div>

           {/* Card 3: Trips */}
           <div className="bg-gradient-to-br from-[#742F99] to-[#5b237a] p-5 rounded-2xl shadow-lg text-white flex justify-between items-center">
              <div>
                 <p className="text-purple-200 text-xs uppercase tracking-wide">เที่ยววิ่งทั้งหมด</p>
                 <h2 className="text-3xl font-bold mt-1">{stats.totalTrips.toLocaleString()}</h2>
                 <p className="text-[10px] opacity-70 mt-1">งานสำเร็จ</p>
              </div>
              <div className="text-4xl opacity-20">🚩</div>
           </div>

           {/* Card 4: Efficiency */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
              <div className="flex justify-between items-end mb-2">
                 <p className="text-gray-500 text-xs uppercase tracking-wide">ความคุ้มค่า</p>
                 <span className="text-xl font-bold text-[#742F99]">{stats.avgCostPerKm.toFixed(2)} <span className="text-xs font-normal text-gray-400">บ./กม.</span></span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                 <div className="bg-gradient-to-r from-green-400 to-[#F3B236] h-full rounded-full" style={{width: `${Math.min(stats.avgCostPerKm * 10, 100)}%`}}></div>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-right">รวมค่าเชื้อเพลิง ฿{stats.totalFuelCost.toLocaleString()}</p>
           </div>
        </div>

        {/* === 2. Advanced Charts Section === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Chart 1: Daily Usage Trend (CSS Bar Chart) */}
           <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-[#742F99] flex items-center gap-2">
                    <span className="bg-purple-100 p-1.5 rounded-lg text-sm">📈</span> แนวโน้มการใช้งาน 7 วันล่าสุด
                 </h3>
              </div>
              
              {/* Graph Container */}
              <div className="h-48 flex items-end justify-between gap-2 px-2">
                 {dailyTrend.map((day, i) => (
                    <div key={i} className="flex flex-col items-center w-full group cursor-pointer">
                       {/* Tooltip on hover */}
                       <div className="mb-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs bg-gray-800 text-white px-2 py-1 rounded absolute -mt-8">
                          {day.count} เที่ยว
                       </div>
                       {/* Bar */}
                       <div 
                          className="w-full max-w-[40px] bg-[#F3B236] rounded-t-lg transition-all duration-1000 group-hover:bg-[#742F99] relative"
                          style={{ height: `${day.height}%`, minHeight: '4px' }}
                       ></div>
                       {/* Label */}
                       <p className="text-xs text-gray-400 mt-2 font-medium">{day.date}</p>
                    </div>
                 ))}
              </div>
           </div>

           {/* Chart 2: Usage by Time of Day (Donut Representation) */}
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
              <h3 className="font-bold text-gray-700 flex items-center gap-2 mb-4">
                 <span className="bg-orange-100 p-1.5 rounded-lg text-sm">🌞</span> ช่วงเวลาการใช้รถ
              </h3>
              
              <div className="flex items-center gap-6">
                 {/* Morning Bar */}
                 <div className="flex-1 text-center">
                    <div className="h-32 bg-gray-100 rounded-2xl relative overflow-hidden flex items-end justify-center mx-auto w-16">
                       <div className="w-full bg-[#F3B236] transition-all duration-1000" style={{ height: `${(timeStats.morning / (timeStats.morning + timeStats.afternoon || 1)) * 100}%` }}></div>
                       <span className="absolute bottom-2 text-xs font-bold text-white drop-shadow-md">{timeStats.morning}</span>
                    </div>
                    <p className="text-xs font-bold text-gray-600 mt-3">ช่วงเช้า</p>
                    <p className="text-[10px] text-gray-400">00:00 - 11:59</p>
                 </div>

                 <div className="text-gray-300 font-bold">VS</div>

                 {/* Afternoon Bar */}
                 <div className="flex-1 text-center">
                    <div className="h-32 bg-gray-100 rounded-2xl relative overflow-hidden flex items-end justify-center mx-auto w-16">
                       <div className="w-full bg-[#742F99] transition-all duration-1000" style={{ height: `${(timeStats.afternoon / (timeStats.morning + timeStats.afternoon || 1)) * 100}%` }}></div>
                       <span className="absolute bottom-2 text-xs font-bold text-white drop-shadow-md">{timeStats.afternoon}</span>
                    </div>
                    <p className="text-xs font-bold text-gray-600 mt-3">ช่วงบ่าย</p>
                    <p className="text-[10px] text-gray-400">12:00 - 23:59</p>
                 </div>
              </div>
           </div>
        </div>

        {/* === 3. Vehicle & Driver Breakdown === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Left: Vehicle Types */}
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">ประเภทรถ</h3>
              <div className="space-y-4">
                 {carTypeStats.map((type, idx) => (
                    <div key={idx}>
                       <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-600">{type.name}</span>
                          <span className="font-bold text-[#742F99]">{type.active}/{type.total} <span className="text-[10px] font-normal text-gray-400">ใช้งาน</span></span>
                       </div>
                       <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                          <div className="bg-[#742F99] h-full" style={{ width: `${(type.active / type.total) * 100}%` }}></div>
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* Middle: Top Locations */}
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">พื้นที่ใช้งานสูงสุด</h3>
              <div className="space-y-3">
                 {locationStats.map((loc, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
                       <span className="text-gray-600 truncate w-[70%]">{idx+1}. {loc.name}</span>
                       <span className="bg-purple-50 text-[#742F99] px-2 py-0.5 rounded text-xs font-bold">{loc.count}</span>
                    </div>
                 ))}
              </div>
           </div>

           {/* Right: Top Drivers */}
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase">ผู้ขับขี่ดีเด่น</h3>
              <div className="space-y-3">
                 {driverStats.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold ${idx===0?'bg-[#F3B236]': 'bg-gray-200 text-gray-500'}`}>{idx+1}</div>
                          <div className="text-sm text-gray-700">{d.name}</div>
                       </div>
                       <div className="text-xs font-bold text-gray-400">{d.trips} งาน</div>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        {/* === 4. Recent Feed & Car Table === */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           
           {/* Recent Feed */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                 <span className="text-[#F3B236] animate-pulse">●</span> รายการล่าสุด (Real-time)
              </h3>
              <div className="space-y-0">
                 {recentLogs.map((log) => (
                    <div key={log.id} className="flex gap-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors px-2 -mx-2 rounded-lg">
                       <div className="mt-1">
                          <div className={`w-2 h-2 rounded-full ${log.is_completed ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                       </div>
                       <div className="flex-1">
                          <div className="flex justify-between">
                             <span className="text-sm font-bold text-[#742F99]">{log.cars?.plate_number}</span>
                             <span className="text-[10px] text-gray-400">{new Date(log.created_at).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} น.</span>
                          </div>
                          <p className="text-xs text-gray-600 mt-0.5">
                             {log.driver_name} <span className="text-gray-400 mx-1">➜</span> {log.location}
                          </p>
                          {log.is_completed && (
                             <p className="text-[10px] text-green-600 mt-1 bg-green-50 inline-block px-1.5 rounded">
                                จบงาน: {log.end_mileage - log.start_mileage} กม.
                             </p>
                          )}
                       </div>
                    </div>
                 ))}
              </div>
           </div>

           {/* Car Table (Mini) */}
           <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100">
                 <h3 className="font-bold text-gray-700 text-sm">ประสิทธิภาพรายคัน (Top 5)</h3>
              </div>
              <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-400 bg-white border-b">
                    <tr>
                       <th className="px-4 py-2">ทะเบียน</th>
                       <th className="px-4 py-2 text-right">ระยะทาง</th>
                       <th className="px-4 py-2 text-right">น้ำมัน (บ.)</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {carStats.slice(0, 5).map((c) => (
                       <tr key={c.plate}>
                          <td className="px-4 py-3 font-medium text-[#742F99]">{c.plate}</td>
                          <td className="px-4 py-3 text-right">{c.distance.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{c.cost.toLocaleString()}</td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </div>

        </div>
      </div>
    </div>
  )
}