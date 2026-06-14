'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

// ── Apple-style helpers ──
const ACard = ({ children, className = '' }) => (
  <div className={`bg-white rounded-[20px] overflow-hidden ${className}`}
       style={{boxShadow:'0 1px 0 rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.07)'}}>
    {children}
  </div>
)

const SectionLabel = ({ title, subtitle }) => (
  <div className="mb-4">
    <h3 className="text-[13px] font-semibold text-[#1d1d1f] tracking-[-0.2px]">{title}</h3>
    {subtitle && <p className="text-[11px] text-[#6e6e73] mt-0.5">{subtitle}</p>}
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

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  })

  // State เก็บข้อมูลดิบ
  const [rawLogs, setRawLogs] = useState([])
  const [carsList, setCarsList] = useState([])
  const [repairLogs, setRepairLogs] = useState([]) 
  
  // State สำหรับแสดงผล Dashboard
  const [globalStats, setGlobalStats] = useState({
    totalDistance: 0, totalTrips: 0, fuelSavings: 0, activeRate: 0, availableCars: 0, totalCars: 0, busyCars: 0, avgTripDist: 0, ecoScore: 0
  })

  const [gasolineStats, setGasolineStats] = useState({ cost: 0, distance: 0, efficiency: 0, fuelLiters: 0 })
  const [evStats, setEvStats] = useState({ distance: 0, charges: 0, avgGain: 0, carbonSaved: 0 })

  const [analytics, setAnalytics] = useState({
    dailyTrend: [], hourlyTrend: [], topLocations: [], driverStats: [], fleetTable: [], carDriverHistory: []
  })

  const [printData, setPrintData] = useState([])
  const [printReasons, setPrintReasons] = useState({})
  const [showPrintModal, setShowPrintModal] = useState(false)

  const handleClose = () => {
    window.close()
    setTimeout(() => { if (!window.closed) router.push('/') }, 100)
  }

  const handlePrint = () => {
    window.print()
  }

  // ✅ 1. ดึงข้อมูลและกรองวันที่จาก Database โดยตรง (Future-Proof สำหรับข้อมูล 500k records)
  useEffect(() => {
    const fetchFilteredData = async () => {
      setLoading(true)
      try {
        // ดึงรถและประวัติซ่อม
        const { data: cars } = await supabase.from('cars').select('*')
        const { data: repairs } = await supabase.from('repair_logs').select('*')
        if (cars) setCarsList(cars)
        if (repairs) setRepairLogs(repairs)

        // กำหนดวันที่เริ่มต้นและสิ้นสุด ตาม Filter ที่เลือก
        const now = new Date()
        let startDate = new Date(0)
        let endDate = new Date()
        let isAllTime = timeFilter === 'all'

        if (timeFilter === 'week') {
          const day = now.getDay()
          const diff = now.getDate() - day + (day === 0 ? -6 : 1)
          startDate = new Date(now.setDate(diff))
          startDate.setHours(0,0,0,0)
          endDate = new Date(startDate)
          endDate.setDate(startDate.getDate() + 6)
          endDate.setHours(23,59,59,999)
        } else if (timeFilter === 'month') {
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          startDate.setHours(0,0,0,0)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
          endDate.setHours(23,59,59,999)
        } else if (timeFilter === 'select_month' && selectedMonth) {
          const [year, month] = selectedMonth.split('-')
          startDate = new Date(year, parseInt(month) - 1, 1)
          startDate.setHours(0,0,0,0)
          endDate = new Date(year, parseInt(month), 0)
          endDate.setHours(23,59,59,999)
        } else if (timeFilter === 'custom') {
          startDate = new Date(customStartDate)
          startDate.setHours(0,0,0,0)
          endDate = new Date(customEndDate)
          endDate.setHours(23,59,59,999)
        }

        // ดึงข้อมูล trip_logs แบบ Pagination ทีละ 1000 แถว
        let allLogs = []
        let hasMore = true
        let from = 0
        const step = 1000

        while (hasMore) {
          let query = supabase
            .from('trip_logs')
            .select('*, cars(*)')
            .eq('is_completed', true)
            .order('start_time', { ascending: false })
            .range(from, from + step - 1)

          // แนบ Filter วันที่ไปกับ Query ถ้าไม่ใช่โหมดดึงทั้งหมด
          if (!isAllTime) {
            query = query.gte('start_time', startDate.toISOString())
                         .lte('start_time', endDate.toISOString())
          }

          const { data: logsChunk, error } = await query

          if (error) {
            console.error('Error fetching logs:', error)
            break
          }

          if (logsChunk && logsChunk.length > 0) {
            allLogs = [...allLogs, ...logsChunk]
            if (logsChunk.length < step) {
              hasMore = false // ข้อมูลหมดแล้ว
            } else {
              from += step // ขยับไปดึง 1000 แถวถัดไป
            }
          } else {
            hasMore = false
          }
        }

        setRawLogs(allLogs)

      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    // Trigger การดึงข้อมูลใหม่ทุกครั้งที่ผู้ใช้เปลี่ยน Filter เวลา
    fetchFilteredData()
  }, [timeFilter, selectedMonth, customStartDate, customEndDate])

  // ✅ 2. ประมวลผลข้อมูล (ไม่ต้องกรองวันที่ซ้ำแล้ว เพราะ Database กรองมาให้แล้ว)
  useEffect(() => {
    if (carsList.length === 0) return

    // rawLogs ตอนนี้คือข้อมูลที่ถูกกรองช่วงเวลามาเรียบร้อยแล้ว
    const filteredLogs = rawLogs 

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

    const pData = []

    const fleetData = carsList.map((c, index) => {
        const cLogs = filteredLogs.filter(l => l.car_id === c.id)
        const totalD = cLogs.reduce((s, l) => s + (l.end_mileage - l.start_mileage), 0)
        const totalC = cLogs.reduce((s, l) => s + (l.fuel_cost || 0), 0)
        const totalL = cLogs.reduce((s, l) => s + (l.fuel_liters || 0), 0)
        const chargeCount = cLogs.filter(l => l.battery_after > 0 || l.fuel_liters > 0).length
        const isEV = c.fuel_type?.toUpperCase() === 'EV' || c.plate_number.includes('6ขฆ')

        const cRepairs = repairLogs.filter(r => r.car_id === c.id) 
        const totalRepairCost = cRepairs.reduce((s, r) => s + (r.cost || 0), 0)
        const repairCount = cRepairs.length

        const startMil = cLogs.length > 0 ? Math.min(...cLogs.map(l => l.start_mileage)) : '-'
        const endMil = cLogs.length > 0 ? Math.max(...cLogs.map(l => l.end_mileage)) : '-'

        pData.push({
          no: index + 1,
          plate: c.plate_number,
          brand: c.model || '-',
          type: c.car_type || '-', 
          budget: c.budget || '-',
          plan: c.department || '-',
          startMil: startMil,
          endMil: endMil,
          dist: totalD,
          mainUsage: c.usage_type || '-',
          remark: repairCount > 0 ? `ซ่อม ${repairCount} ครั้ง (${totalRepairCost.toLocaleString()} บ.)` : 'FD'
        })

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
          model: c.model,
          repairCount: repairCount,
          repairCost: totalRepairCost
        }
    }).sort((a,b) => b.dist - a.dist)

    setPrintData(pData) 

    const driverMap = {}
    const locMap = {}
    const hourlyMap = Array(24).fill(0)

    filteredLogs.forEach(l => {
      if (!driverMap[l.driver_name]) driverMap[l.driver_name] = { trips: 0, dist: 0, cars: new Set() }
      driverMap[l.driver_name].trips++
      driverMap[l.driver_name].dist += (l.end_mileage - l.start_mileage)
      if (l.cars?.plate_number) driverMap[l.driver_name].cars.add(l.cars.plate_number)

      if (l.location && l.location !== '-') {
          locMap[l.location] = (locMap[l.location] || 0) + 1
      }
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

  }, [rawLogs, carsList, repairLogs])

  if (loading) return (
    <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center" style={{WebkitFontSmoothing:'antialiased'}}>
      <div className="w-8 h-8 border-[2.5px] border-[#d2d2d7] border-t-[#1d1d1f] rounded-full animate-spin"/>
    </div>
  )

  const maxTrend  = Math.max(...analytics.dailyTrend.map(d => d.val), 1);
  const maxHourly = Math.max(...analytics.hourlyTrend.map(d => d.val), 1);
  const maxLoc    = Math.max(...analytics.topLocations.map(l => l.count), 1);

  const Card = ({ children, className = '', style = {} }) => (
    <div className={`bg-white rounded-[22px] overflow-hidden ${className}`}
         style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 20px rgba(0,0,0,0.07)', ...style}}>
      {children}
    </div>
  )
  const Label = ({ children }) => (
    <p className="text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.06em] mb-1">{children}</p>
  )

  const getReportTitleDate = () => {
    if (timeFilter === 'month') return new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    if (timeFilter === 'select_month') return new Date(`${selectedMonth}-01`).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    if (timeFilter === 'custom') return `${customStartDate} ถึง ${customEndDate}`;
    if (timeFilter === 'week') return 'สัปดาห์นี้';
    return 'ทั้งหมด';
  }

  return (
    <>
      <style>{`
        * { -webkit-font-smoothing: antialiased; }
        .st::-webkit-scrollbar{width:3px}
        .st::-webkit-scrollbar-thumb{background:#d2d2d7;border-radius:6px}
        input[type=date]::-webkit-calendar-picker-indicator,
        input[type=month]::-webkit-calendar-picker-indicator {opacity:.4;cursor:pointer}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .4s ease both}

        .reason-input {
          width: 100%;
          min-width: 80px;
          text-align: center;
          background: transparent;
          border: 1px dashed #c7c7cc;
          border-radius: 6px;
          padding: 4px;
          outline: none;
          font-size: 11px;
          transition: border-color 0.2s, background-color 0.2s;
        }
        .reason-input:focus {
          border-color: #0071e3;
          background: #f5f5f7;
        }

        .print-area { display: none; }

        @media print {
          .no-print { display: none !important; }
          .print-area { 
            display: block !important; 
            font-family: 'Sarabun', sans-serif; 
            width: 100%;
          }
          @page { size: landscape; margin: 15mm; }
          body { 
            background: white !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact;
          }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          table.report-table {
            width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px;
          }
          table.report-table th, table.report-table td {
            border: 1px solid #000; padding: 4px 6px; text-align: center;
          }
          table.report-table th.no-border-print {
            border: none !important; background-color: transparent !important;
          }
          table.report-table th {
            font-weight: bold; background-color: #f2f2f2 !important; 
          }
          .text-left { text-align: left !important; }
          .reason-input {
            border: none !important; background: transparent !important; padding: 0 !important; color: black !important;
          }
          .reason-input::placeholder { color: transparent; }
        }
      `}</style>

      {/* ── Modal สั่งพิมพ์ ── */}
      {showPrintModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 no-print fu">
          <div className="bg-white rounded-[24px] w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#e5e5ea] flex justify-between items-center bg-[#f9f9fb]">
              <div>
                <h3 className="text-[17px] font-semibold text-[#1d1d1f] tracking-[-0.3px]">📄 จัดการเอกสารเตรียมพิมพ์</h3>
                <p className="text-[12px] text-[#6e6e73] mt-0.5">คลิกที่ช่อง "สาเหตุ" เพื่อพิมพ์ข้อความได้โดยตรง จากนั้นกดยืนยันสั่งพิมพ์</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 text-[13px] font-medium text-[#6e6e73] hover:text-[#1d1d1f] transition-colors">
                  ยกเลิก
                </button>
                <button onClick={handlePrint}
                  className="flex items-center gap-1.5 text-[13px] font-medium bg-[#0071e3] text-white px-5 py-2 rounded-[10px] shadow-sm hover:bg-[#0077ed] active:scale-[0.98] transition-all">
                  🖨️ ยืนยันสั่งพิมพ์
                </button>
              </div>
            </div>

            <div className="overflow-auto p-6 bg-white st">
              <table className="w-full border-collapse font-sarabun text-[11px]" style={{ minWidth: '1000px' }}>
                <thead>
                  <tr>
                    <th colSpan="14" className="border-0 bg-transparent py-4 text-center">
                      <h2 style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'Sarabun, sans-serif' }}>
                        บัญชีรถยนต์การไฟฟ้าส่วนภูมิภาคเขต ก.3 การไฟฟ้าส่วนภูมิภาคสาขากำแพงแสน ประจำเดือน {getReportTitleDate()}
                      </h2>
                    </th>
                  </tr>
                  <tr>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[4%]">อันดับที่</th>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[9%]">หมายเลขทะเบียน</th>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[7%]">ยี่ห้อ</th>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[12%]">ชนิดและลักษณะ</th>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[5%]">งบ</th>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[6%]">ประจำแผนก</th>
                    <th colSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5">เลขไมล์</th>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[6%]">รวมระยะทาง<br/>กม.</th>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[16%]">ประเภทการใช้งานส่วนใหญ่</th>
                    <th colSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5">ความครบถ้วน</th>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[12%]">สาเหตุ</th>
                    <th rowSpan="2" className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[6%]">หมายเหตุ</th>
                  </tr>
                  <tr>
                    <th className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[6%]">เริ่ม</th>
                    <th className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[6%]">สิ้นสุด</th>
                    <th className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[4%]">ครบถ้วน</th>
                    <th className="border border-[#d2d2d7] bg-[#f2f2f7] p-1.5 w-[4%]">ไม่ครบ</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.map((row, idx) => {
                    const customReason = printReasons[row.plate] || '';
                    const isComplete = !customReason; 
                    return (
                      <tr key={idx}>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">{row.no}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center font-medium">{row.plate}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">{row.brand}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">{row.type}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">{row.budget}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">{row.plan}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">{row.startMil}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">{row.endMil}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">{row.dist > 0 ? row.dist : ''}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-left">{row.mainUsage}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center font-bold">{isComplete ? '/' : ''}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center font-bold">{!isComplete ? '/' : ''}</td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">
                          <input 
                            type="text"
                            className="reason-input"
                            placeholder="คลิกพิมพ์สาเหตุ..."
                            value={customReason}
                            onChange={(e) => setPrintReasons(prev => ({ ...prev, [row.plate]: e.target.value }))}
                          />
                        </td>
                        <td className="border border-[#d2d2d7] p-1.5 text-center">{row.remark}</td>
                      </tr>
                    )
                  })}
                  {printData.length === 0 && (
                    <tr><td colSpan="14" className="border border-[#d2d2d7] text-center p-8">ไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard ปกติ ── */}
      <div className="no-print min-h-screen bg-[#f2f2f7] font-sarabun pb-24" style={{WebkitFontSmoothing:'antialiased'}}>
        <nav className="sticky top-0 z-50 h-[52px] border-b border-black/[0.06]"
             style={{background:'rgba(242,242,247,0.88)', backdropFilter:'saturate(180%) blur(24px)', WebkitBackdropFilter:'saturate(180%) blur(24px)'}}>
          <div className="max-w-[1440px] mx-auto px-5 h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img src="/pea_logo.png" className="h-7 w-auto object-contain" alt="PEA" onError={(e) => e.target.style.display = 'none'}/>
              <span className="text-[16px] font-semibold text-[#1d1d1f] tracking-[-0.3px]">Fleet Dashboard</span>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex bg-[#dddde0] rounded-[10px] p-[3px] gap-[2px]">
                {[['week','สัปดาห์'],['month','เดือนนี้'],['select_month','เลือกเดือน'],['custom','กำหนดเอง'],['all','ทั้งหมด']].map(([tf,label]) => (
                  <button key={tf} onClick={() => setTimeFilter(tf)}
                    className={`px-3.5 py-[5px] text-[12px] font-medium rounded-[8px] transition-all ${
                      timeFilter===tf ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#6e6e73] hover:text-[#3c3c43]'
                    }`}>{label}</button>
                ))}
              </div>
              
              {timeFilter==='select_month' && (
                <div className="flex items-center gap-2 bg-white px-3 py-[5px] rounded-[10px] border border-[#e5e5ea] text-[11px] font-mono"
                     style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                  <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="outline-none bg-transparent text-[#1d1d1f]"/>
                </div>
              )}

              {timeFilter==='custom' && (
                <div className="flex items-center gap-2 bg-white px-3 py-[5px] rounded-[10px] border border-[#e5e5ea] text-[11px] font-mono"
                     style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                  <input type="date" value={customStartDate} onChange={e=>setCustomStartDate(e.target.value)} className="outline-none bg-transparent text-[#1d1d1f]"/>
                  <span className="text-[#c7c7cc]">→</span>
                  <input type="date" value={customEndDate} onChange={e=>setCustomEndDate(e.target.value)} className="outline-none bg-transparent text-[#1d1d1f]"/>
                </div>
              )}

              <div className="w-px h-5 bg-[#d2d2d7] mx-1"/>
              
              <button onClick={() => setShowPrintModal(true)}
                className="flex items-center gap-1.5 text-[12px] font-medium bg-[#1d1d1f] text-white px-4 py-1.5 rounded-[8px] shadow-sm hover:bg-[#3a3a3c] transition-colors border border-transparent">
                🖨️ สั่งพิมพ์
              </button>

              <button onClick={() => router.push('/')}
                className="flex items-center gap-1.5 text-[13px] text-[#0071e3] active:opacity-50 transition-opacity ml-2">
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6l5 5" stroke="#0071e3" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                หน้าหลัก
              </button>
              <button onClick={handleClose} className="text-[13px] text-[#ff3b30] active:opacity-50 transition-opacity">ปิด</button>
            </div>
          </div>
        </nav>

        <div className="max-w-[1440px] mx-auto px-5 pt-6 space-y-4">
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 fu" style={{animationDelay:'0ms'}}>
            <div className="col-span-2 xl:col-span-1 rounded-[22px] p-5 flex flex-col justify-between min-h-[140px]"
                 style={{background:'#1d1d1f', boxShadow:'0 4px 24px rgba(0,0,0,0.18)'}}>
              <div className="w-10 h-10 rounded-[12px] bg-white/10 flex items-center justify-center text-[20px]">🛣️</div>
              <div>
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-[0.06em] mb-0.5">ระยะทางสะสม</p>
                <p className="text-[32px] font-bold text-white leading-none tracking-[-1px]">
                  {globalStats.totalDistance.toLocaleString()}
                  <span className="text-[16px] font-normal text-white/50 ml-1">กม.</span>
                </p>
                <p className="text-[11px] text-white/40 mt-1">{globalStats.totalTrips} ภารกิจ · ~{globalStats.avgTripDist} กม./รอบ</p>
              </div>
            </div>

            <Card className="p-5 flex flex-col justify-between min-h-[140px]">
              <div className="w-10 h-10 rounded-[12px] bg-[#fff4e0] flex items-center justify-center text-[20px]">⛽</div>
              <div>
                <Label>น้ำมันรวม</Label>
                <p className="text-[28px] font-bold text-[#1d1d1f] leading-none tracking-[-0.8px]">
                  {gasolineStats.fuelLiters.toLocaleString(undefined,{maximumFractionDigits:1})}
                  <span className="text-[14px] font-normal text-[#6e6e73] ml-1">ลิตร</span>
                </p>
                <p className="text-[11px] text-[#aeaeb2] mt-1">฿{gasolineStats.cost.toLocaleString()} · {gasolineStats.efficiency} บ./กม.</p>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between min-h-[140px]" style={{background:'linear-gradient(135deg,#edfbf0 0%,#d4f5e0 100%)'}}>
              <div className="w-10 h-10 rounded-[12px] bg-white/60 flex items-center justify-center text-[20px]">🌱</div>
              <div>
                <Label>ลด CO₂</Label>
                <p className="text-[28px] font-bold text-[#1a7f37] leading-none tracking-[-0.8px]">
                  {evStats.carbonSaved}
                  <span className="text-[14px] font-normal text-[#1a7f37]/60 ml-1">kg</span>
                </p>
                <p className="text-[11px] text-[#1a7f37]/60 mt-1">EV Ratio {globalStats.ecoScore}%</p>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between min-h-[140px]" style={{background:'linear-gradient(135deg,#f0eeff 0%,#e5dbff 100%)'}}>
              <div className="w-10 h-10 rounded-[12px] bg-white/60 flex items-center justify-center text-[20px]">💰</div>
              <div>
                <Label>ประหยัดได้</Label>
                <p className="text-[28px] font-bold text-[#5e35b1] leading-none tracking-[-0.8px]">
                  ฿{Number(globalStats.fuelSavings).toLocaleString()}
                </p>
                <p className="text-[11px] text-[#5e35b1]/60 mt-1">เทียบกับใช้น้ำมัน</p>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 fu" style={{animationDelay:'60ms'}}>
            <Card className="p-5">
              <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.3px] mb-0.5">ฝูงรถ</p>
              <p className="text-[12px] text-[#6e6e73] mb-4">ทั้งหมด {globalStats.totalCars} คัน</p>
              <div className="space-y-2.5">
                {[
                  {label:'ว่างพร้อมใช้', val:globalStats.availableCars, c:'#34c759', bg:'rgba(52,199,89,0.08)', pulse:false},
                  {label:'กำลังใช้งาน', val:globalStats.busyCars,    c:'#ff3b30', bg:'rgba(255,59,48,0.08)', pulse:true},
                ].map((s,i)=>(
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-[14px]" style={{background:s.bg}}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-[9px] h-[9px] rounded-full flex-shrink-0 ${s.pulse?'animate-pulse':''}`} style={{background:s.c, boxShadow:`0 0 0 3px ${s.c}22`}}/>
                      <span className="text-[14px] font-medium text-[#1d1d1f]">{s.label}</span>
                    </div>
                    <span className="text-[22px] font-bold text-[#1d1d1f] leading-none">{s.val}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.05)]">
                <div className="flex justify-between text-[11px] text-[#6e6e73] mb-2">
                  <span>Utilisation rate</span><span className="font-semibold text-[#1d1d1f]">{globalStats.activeRate}%</span>
                </div>
                <div className="h-2 bg-[#e5e5ea] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{width:`${globalStats.activeRate}%`, background:'linear-gradient(90deg,#0071e3,#34aadc)'}}/>
                </div>
              </div>
            </Card>

            <Card className="p-5 lg:col-span-2">
              <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.3px] mb-4">📍 ปลายทางยอดนิยม</p>
              <div className="space-y-3.5">
                {analytics.topLocations.length===0
                  ? <p className="text-[12px] text-[#aeaeb2] text-center py-6">ไม่มีข้อมูล</p>
                  : analytics.topLocations.map((loc,i)=>(
                    <div key={i} className="flex items-center gap-3.5">
                      <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                            style={{background:['#ff9500','#aeaeb2','#d2d2d7'][i]||'#e5e5ea', color:i>=2?'#6e6e73':'white'}}>
                        {i+1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1.5">
                          <span className="text-[13px] font-medium text-[#1d1d1f] truncate">{loc.name}</span>
                          <span className="text-[12px] text-[#6e6e73] ml-3 flex-shrink-0">{loc.count} ครั้ง</span>
                        </div>
                        <div className="h-[5px] bg-[#f2f2f7] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                               style={{width:`${(loc.count/maxLoc)*100}%`, background:i===0?'linear-gradient(90deg,#ff9500,#ffcc00)':'linear-gradient(90deg,#0071e3,#34aadc)'}}/>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-5 gap-3 fu" style={{animationDelay:'120ms'}}>
            <Card className="p-5 xl:col-span-3">
              <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.3px] mb-0.5">📅 ความถี่การใช้งาน</p>
              <p className="text-[12px] text-[#6e6e73] mb-5">จำนวนภารกิจรายวัน</p>
              <div className="h-44 flex items-end gap-2 pb-1">
                {analytics.dailyTrend.length===0
                  ? <p className="text-[12px] text-[#aeaeb2] m-auto">ไม่มีข้อมูล</p>
                  : analytics.dailyTrend.map((d,i)=>{
                    const pct = (d.val/maxTrend)*100;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                        {d.val>0 && (
                          <span className="text-[10px] font-semibold text-[#1d1d1f] mb-1 opacity-0 group-hover:opacity-100 transition-opacity">{d.val}</span>
                        )}
                        <div className="w-full rounded-t-[7px] transition-all duration-500 group-hover:opacity-90"
                             style={{height:`${Math.max(pct,2)}%`, background:`linear-gradient(180deg, #0071e3 0%, #34aadc ${100-pct}%)`}}/>
                        <span className="text-[9px] text-[#aeaeb2] mt-1.5 whitespace-nowrap">{d.label}</span>
                      </div>
                    )
                  })}
              </div>
            </Card>

            <Card className="p-5 xl:col-span-2">
              <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.3px] mb-0.5">⏰ ช่วงเวลาหนาแน่น</p>
              <p className="text-[12px] text-[#6e6e73] mb-5">รายชั่วโมง</p>
              <div className="h-44 flex items-end gap-[3px]">
                {analytics.hourlyTrend.length===0
                  ? <p className="text-[12px] text-[#aeaeb2] m-auto">ไม่มีข้อมูล</p>
                  : analytics.hourlyTrend.map((d,i)=>{
                    const pct=(d.val/maxHourly)*100;
                    const isPeak=pct>65;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                        <div className="w-full rounded-t-[3px] transition-all duration-500"
                             style={{height:`${Math.max(pct,1.5)}%`, background:isPeak?'linear-gradient(180deg,#ff9500,#ffcc00)':'linear-gradient(180deg,#34c759 0%,#30d158 100%)', opacity:0.5+(pct/200)}}/>
                        <span className="text-[8px] text-[#c7c7cc] mt-1">{i%6===0?d.label:''}</span>
                      </div>
                    )
                  })}
              </div>
            </Card>
          </div>

          <Card className="fu" style={{animationDelay:'180ms'}}>
            <div className="px-6 py-5 border-b border-[rgba(0,0,0,0.05)] flex items-baseline justify-between">
              <div>
                <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.3px]">รายงานสรุปรายคัน</p>
                <p className="text-[12px] text-[#6e6e73] mt-0.5">ระยะทาง เชื้อเพลิง และประสิทธิภาพ</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[rgba(0,0,0,0.05)]">
                    {['ทะเบียน / รุ่น','สถานะ','ภารกิจ','ระยะทาง','เชื้อเพลิง','ประสิทธิภาพ', 'รายการซ่อม', 'ค่าซ่อม'].map(h=>(
                      <th key={h} className="px-6 py-3 text-left text-[11px] font-semibold text-[#6e6e73] uppercase tracking-[0.05em] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analytics.fleetTable.map((c,i)=>(
                    <tr key={i} className="border-b border-[rgba(0,0,0,0.04)] last:border-0 transition-colors hover:bg-[#f9f9fb]">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center text-[17px] flex-shrink-0"
                               style={{background:c.type==='EV'?'#edfbf0':'#fff4e0'}}>{c.type==='EV'?'⚡':'⛽'}</div>
                          <div>
                            <p className="text-[14px] font-semibold text-[#1d1d1f] leading-tight">{c.plate}</p>
                            <p className="text-[11px] text-[#aeaeb2]">{c.model}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-[5px] rounded-full ${
                          c.status==='available'?'bg-[rgba(52,199,89,0.12)] text-[#1a7f37]':'bg-[rgba(255,59,48,0.10)] text-[#d70015]'
                        }`}>
                          <span className={`w-[6px] h-[6px] rounded-full ${c.status==='available'?'bg-[#34c759]':'bg-[#ff3b30] animate-pulse'}`}/>
                          {c.status==='available'?'ว่าง':'ใช้งาน'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[14px] font-semibold text-[#1d1d1f]">{c.trips}<span className="text-[11px] font-normal text-[#6e6e73] ml-1">รอบ</span></td>
                      <td className="px-6 py-4 text-[14px] font-semibold text-[#1d1d1f]">{c.dist.toLocaleString()}<span className="text-[11px] font-normal text-[#6e6e73] ml-1">กม.</span></td>
                      <td className="px-6 py-4">
                        {c.type==='EV'
                          ? <span className="text-[12px] font-medium text-[#0071e3]">⚡ {c.refillCount} ครั้ง</span>
                          : <div>
                              <span className="text-[13px] font-medium text-[#1d1d1f]">{c.fuelLiters.toFixed(1)} L</span>
                              {c.fuelCost>0 && <span className="text-[11px] text-[#6e6e73] ml-2">฿{c.fuelCost.toLocaleString(undefined,{minimumFractionDigits:0})}</span>}
                            </div>
                        }
                      </td>
                      <td className="px-6 py-4">
                        {c.type==='EV'
                          ? <span className="text-[11px] font-semibold bg-[rgba(52,199,89,0.12)] text-[#1a7f37] px-2.5 py-[5px] rounded-full">EV</span>
                          : <span className="text-[13px] font-semibold text-[#1d1d1f]">{c.efficiency}<span className="text-[10px] font-normal text-[#6e6e73] ml-1">บ./กม.</span></span>
                        }
                      </td>
                      
                      <td className="px-6 py-4">
                        {c.repairCount > 0 ? (
                          <span className="text-[13px] font-medium text-[#d70015] flex items-center gap-1">
                            🔧 {c.repairCount} ครั้ง
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#aeaeb2]">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {c.repairCost > 0 ? (
                          <span className="text-[13px] font-semibold text-[#d70015]">
                            ฿{c.repairCost.toLocaleString(undefined,{minimumFractionDigits:0})}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#aeaeb2]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {analytics.fleetTable.length===0 && (
                    <tr><td colSpan={8} className="text-center py-12 text-[13px] text-[#aeaeb2]">ไม่มีข้อมูลในช่วงเวลานี้</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 fu" style={{animationDelay:'240ms'}}>
            <Card className="p-5">
              <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.3px] mb-4">🏆 รถยอดนิยม</p>
              <div>
                {analytics.fleetTable.filter(c=>c.dist>0).slice(0,3).map((c,i)=>(
                  <div key={i} className="flex items-center gap-3.5 py-3 border-b border-[rgba(0,0,0,0.04)] last:border-0">
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-bold text-white"
                         style={{background:['linear-gradient(135deg,#ffcc00,#ff9500)','linear-gradient(135deg,#d2d2d7,#aeaeb2)','linear-gradient(135deg,#f4a460,#cd853f)'][i]}}>
                      {i+1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#1d1d1f] truncate">{c.plate}</p>
                      <p className="text-[11px] text-[#aeaeb2] truncate">{c.model}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[14px] font-semibold text-[#1d1d1f]">{c.dist.toLocaleString()} <span className="text-[10px] font-normal text-[#6e6e73]">กม.</span></p>
                      <p className="text-[11px] text-[#aeaeb2]">{c.trips} รอบ</p>
                    </div>
                  </div>
                ))}
                {analytics.fleetTable.filter(c=>c.dist>0).length===0 && (
                  <p className="text-[12px] text-[#aeaeb2] text-center py-6">ยังไม่มีรถออกวิ่ง</p>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.3px] mb-4">👨‍✈️ ผู้ขับดีเด่น</p>
              <div className="max-h-[240px] overflow-y-auto st">
                {analytics.driverStats.map((d,i)=>(
                  <div key={i} className="flex items-center gap-3.5 py-3 border-b border-[rgba(0,0,0,0.04)] last:border-0">
                    <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-bold"
                         style={{
                           background:i===0?'linear-gradient(135deg,#ffcc00,#ff9500)':i===1?'linear-gradient(135deg,#d2d2d7,#aeaeb2)':i===2?'linear-gradient(135deg,#f4a460,#cd853f)':'#f2f2f7',
                           color:i<=2?'white':'#6e6e73'
                         }}>
                      {i+1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[#1d1d1f] truncate">{d.name}</p>
                      <p className="text-[10px] text-[#aeaeb2] truncate">{d.carsUsed}</p>
                    </div>
                    <span className="text-[13px] font-semibold text-[#1d1d1f] flex-shrink-0">{d.dist.toLocaleString()} <span className="text-[10px] font-normal text-[#6e6e73]">กม.</span></span>
                  </div>
                ))}
                {analytics.driverStats.length===0 && <p className="text-[12px] text-[#aeaeb2] text-center py-6">ไม่มีข้อมูล</p>}
              </div>
            </Card>

            <Card className="p-5">
              <p className="text-[15px] font-semibold text-[#1d1d1f] tracking-[-0.3px] mb-4">🔍 ใครขับคันไหน</p>
              <div className="max-h-[240px] overflow-y-auto st space-y-0">
                {analytics.carDriverHistory.map((c,i)=>(
                  <div key={i} className="py-3 border-b border-[rgba(0,0,0,0.04)] last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[14px] font-semibold text-[#1d1d1f]">{c.plate}</span>
                      <span className="text-[11px] text-[#6e6e73] bg-[#f2f2f7] px-2.5 py-[3px] rounded-full">{c.totalTrips} งาน</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.drivers.split(', ').map((dl,idx)=>(
                        <span key={idx} className="text-[10px] text-[#6e6e73] bg-[#f2f2f7] px-2.5 py-[3px] rounded-full">{dl}</span>
                      ))}
                    </div>
                  </div>
                ))}
                {analytics.carDriverHistory.length===0 && <p className="text-[12px] text-[#aeaeb2] text-center py-6">ไม่มีข้อมูล</p>}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ── พิมพ์ ── */}
      <div className="print-area">
        <table className="report-table">
          <thead>
            <tr>
              <th colSpan="14" className="no-border-print" style={{ paddingBottom: '20px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, fontFamily: 'Sarabun, sans-serif' }}>
                  บัญชีรถยนต์การไฟฟ้าส่วนภูมิภาคเขต ก.3 การไฟฟ้าส่วนภูมิภาคสาขากำแพงแสน ประจำเดือน {getReportTitleDate()}
                </h2>
              </th>
            </tr>
            <tr>
              <th rowSpan="2" style={{width: '4%'}}>อันดับที่</th>
              <th rowSpan="2" style={{width: '9%'}}>หมายเลขทะเบียน</th>
              <th rowSpan="2" style={{width: '7%'}}>ยี่ห้อ</th>
              <th rowSpan="2" style={{width: '12%'}}>ชนิดและลักษณะ</th>
              <th rowSpan="2" style={{width: '5%'}}>งบ</th>
              <th rowSpan="2" style={{width: '6%'}}>ระวางแผน</th>
              <th colSpan="2">เลขไมล์</th>
              <th rowSpan="2" style={{width: '6%'}}>รวมระยะทาง<br/>กม.</th>
              <th rowSpan="2" style={{width: '16%'}}>ประเภทการใช้งานส่วนใหญ่</th>
              <th colSpan="2">ความครบถ้วน</th>
              <th rowSpan="2" style={{width: '12%'}}>สาเหตุ</th>
              <th rowSpan="2" style={{width: '6%'}}>หมายเหตุ</th>
            </tr>
            <tr>
              <th style={{width: '6%'}}>เริ่ม</th>
              <th style={{width: '6%'}}>สิ้นสุด</th>
              <th style={{width: '4%'}}>ครบถ้วน</th>
              <th style={{width: '4%'}}>ไม่ครบ</th>
            </tr>
          </thead>
          <tbody>
            {printData.map((row, idx) => {
              const customReason = printReasons[row.plate] || '';
              const isComplete = !customReason;

              return (
                <tr key={idx}>
                  <td>{row.no}</td>
                  <td>{row.plate}</td>
                  <td>{row.brand}</td>
                  <td>{row.type}</td>
                  <td>{row.budget}</td>
                  <td>{row.plan}</td>
                  <td>{row.startMil}</td>
                  <td>{row.endMil}</td>
                  <td>{row.dist > 0 ? row.dist : ''}</td>
                  <td className="text-left">{row.mainUsage}</td>
                  
                  <td>{isComplete ? '/' : ''}</td>
                  <td>{!isComplete ? '/' : ''}</td>
                  
                  <td>
                    <span className="no-print">{customReason}</span>
                    <span className="print-area">{customReason}</span>
                  </td>
                  
                  <td>{row.remark}</td>
                </tr>
              )
            })}
            {printData.length === 0 && (
              <tr>
                <td colSpan="14" style={{ textAlign: 'center', padding: '20px' }}>ไม่มีข้อมูลในช่วงเวลาที่เลือก</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}