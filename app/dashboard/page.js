'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import PageSkeleton from '@/app/components/PageSkeleton'

// ── Apple-style helpers ──
const ACard = ({ children, className = '' }) => (
  <div className={`bg-white rounded-[24px] overflow-hidden ${className}`}
       style={{boxShadow:'0 1px 0 rgba(0,0,0,0.04), 0 2px 12px rgba(0,0,0,0.07)'}}>
    {children}
  </div>
)

const SectionLabel = ({ title, subtitle, icon, iconColor, action }) => (
  <div className="mb-4 flex items-start justify-between">
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        {icon && <Icon icon={icon} width="20" height="20" className={iconColor} />}
        <h3 className="text-[15px] font-semibold text-[#4b1560] tracking-[-0.3px]">{title}</h3>
      </div>
      {subtitle && <p className="text-[12px] text-[#765c7c]">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
)

const Label = ({ children }) => (
  <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.06em] mb-1">{children}</p>
)

export default function UltimateDashboard() {
  const router = useRouter()
  
  // State ควบคุมการแสดงผลหน้า UI เลือกหมวดหมู่ 
  const [showWelcome, setShowWelcome] = useState(true)
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState('month')
  const [carCategoryFilter, setCarCategoryFilter] = useState('all')
  
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

  // ✅ เก็บ Range วันที่ปัจจุบันที่ใช้ Filter เพื่อให้วาดกราฟได้ตรงวัน
  const [currentDateRange, setCurrentDateRange] = useState({ start: null, end: null, isAllTime: true })

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
    dailyTrend: [], hourlyTrend: [], topLocations: [], driverStats: [], fleetTable: [], carDriverHistory: [], latestMovements: []
  })

  // ✅ ระบบจัดการการพิมพ์ (Print State)
  const [printData, setPrintData] = useState([])
  const [printReasons, setPrintReasons] = useState({})
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printType, setPrintType] = useState('summary') 

  // ✅ State สำหรับระบบ Query 
  const [showQueryModal, setShowQueryModal] = useState(false)
  const [queryFilters, setQueryFilters] = useState({ plate: '', date: '', name: '', dept: '', job: '', location: '' })
  const [queryResults, setQueryResults] = useState([])

  const processedLogs = useMemo(() => {
    return rawLogs.filter(item => {
        if (!item.cars || item.cars.is_visible === false) return false;
        const isEV = String(item.cars.fuel_type || '').trim().toUpperCase() === 'EV';
        const isRental = String(item.cars.ownership_type || '').trim() === 'รถเช่า' || String(item.cars.ownership_type || '').includes('เช่า');
        if (carCategoryFilter === 'ev') return isEV;
        if (carCategoryFilter === 'rental') return isRental;
        if (carCategoryFilter === 'pea') return !isRental;
        return true; 
    }).map(item => {
        const startM = Number(item.start_mileage) || 0;
        const endM = Number(item.end_mileage) || 0;
        const dist = endM > startM ? endM - startM : 0;

        let job = 'งานทั่วไป';
        let loc = 'ไม่ระบุพื้นที่';
        
        if (item.cars?.fuel_type?.toUpperCase() === 'EV') {
            job = 'ชาร์จรถ EV';
            loc = item.station_name || item.location || 'สถานีชาร์จ';
        } else if (item.location && item.location !== '-') {
            const matchP = item.location.match(/\[.*? - (.*?)\]/);
            job = matchP ? matchP[1].trim() : 'ลงพื้นที่';
            
            const matchA = item.location.match(/\]\s*(.*)/);
            loc = matchA && matchA[1] ? matchA[1].trim() : item.location;
        }

        return {
            plate: item.cars?.plate_number || '-',
            dateRaw: new Date(item.start_time).toISOString().split('T')[0],
            date: new Date(item.start_time).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }),
            name: `${item.driver_name || '-'} ${item.driver_position ? `(${item.driver_position})` : ''}`,
            dept: item.cars?.departments?.name || item.cars?.department || '-',
            job: job,
            location: loc,
            dist: dist,
            fuel: Number(item.fuel_liters) || 0,
            cost: Number(item.fuel_cost) || 0
        };
    });
  }, [rawLogs, carCategoryFilter]);

  const uniquePlates = [...new Set(processedLogs.map(l => l.plate))].filter(Boolean).sort();
  const uniqueDates = [...new Set(processedLogs.map(l => l.dateRaw))].filter(Boolean).sort((a,b) => b.localeCompare(a));
  const uniqueNames = [...new Set(processedLogs.map(l => l.name))].filter(Boolean).sort();
  const uniqueDepts = [...new Set(processedLogs.map(l => l.dept))].filter(Boolean).sort();
  const uniqueJobs = [...new Set(processedLogs.map(l => l.job))].filter(Boolean).sort();
  const uniqueLocs = [...new Set(processedLogs.map(l => l.location))].filter(Boolean).sort();

  const handleExecuteQuery = () => {
    const results = processedLogs.filter(l => {
        if (queryFilters.plate && l.plate !== queryFilters.plate) return false;
        if (queryFilters.date && l.dateRaw !== queryFilters.date) return false;
        if (queryFilters.name && l.name !== queryFilters.name) return false;
        if (queryFilters.dept && l.dept !== queryFilters.dept) return false;
        if (queryFilters.job && l.job !== queryFilters.job) return false;
        if (queryFilters.location && l.location !== queryFilters.location) return false;
        return true;
    });
    setQueryResults(results);
    setShowQueryModal(true); 
  }

  const handlePrint = () => {
    window.print()
  }

  const categories = [
    { id: 'all', iconName: 'ph:car-profile-duotone', title: 'รถทั้งหมด', desc: 'ข้อมูลรถทุกคันในระบบรวมเช่าและ EV', bg: 'bg-[#e5f0ff]', iconBg: '#702082', shadow: 'rgba(0,113,227,0.2)' },
    { id: 'pea', iconName: 'ph:buildings-duotone', title: 'รถ กฟภ.', desc: 'เฉพาะรถยนต์ประจำหน่วยงาน', bg: 'bg-[#f3e5f5]', iconBg: '#8e24aa', shadow: 'rgba(142,36,170,0.2)' },
    { id: 'rental', iconName: 'ph:handshake-duotone', title: 'รถเช่า', desc: 'เฉพาะรถเช่าเหมาสำหรับปฏิบัติงาน', bg: 'bg-[#fff4e0]', iconBg: '#e67e22', shadow: 'rgba(230,126,34,0.2)' },
    { id: 'ev', iconName: 'ph:leaf-duotone', title: 'รถ EV', desc: 'เฉพาะรถยนต์พลังงานไฟฟ้า 100%', bg: 'bg-[#edfbf0]', iconBg: '#1a7f37', shadow: 'rgba(26,127,55,0.2)' }
  ];

  const handleSelectCategory = (categoryId) => {
    setCarCategoryFilter(categoryId);
    setShowWelcome(false); 
  }

  useEffect(() => {
    const fetchFilteredData = async () => {
      setLoading(true)
      try {
        const { data: cars } = await supabase.from('cars').select('*, departments(name)')
        const { data: repairs } = await supabase.from('repair_logs').select('*')
        
        if (cars) {
          const visibleCars = cars.filter(car => car.is_visible !== false)
          setCarsList(visibleCars)
        }
        if (repairs) setRepairLogs(repairs)

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

        // เซ็ต state วันที่ เพื่อใช้วาดกราฟให้ถูกต้อง
        setCurrentDateRange({ start: new Date(startDate), end: new Date(endDate), isAllTime });

        let allLogs = []
        let hasMore = true
        let from = 0
        const step = 1000

        while (hasMore) {
          let query = supabase
            .from('trip_logs')
            .select('*, cars(*, departments(name))')
            .order('start_time', { ascending: false })
            .range(from, from + step - 1)

          if (!isAllTime) {
            query = query.gte('start_time', startDate.toISOString())
                         .lte('start_time', endDate.toISOString())
          }

          const { data: logsChunk, error } = await query

          if (error) break

          if (logsChunk && logsChunk.length > 0) {
            allLogs = [...allLogs, ...logsChunk]
            if (logsChunk.length < step) hasMore = false
            else from += step
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
    fetchFilteredData()
  }, [timeFilter, selectedMonth, customStartDate, customEndDate])

  useEffect(() => {
    if (carsList.length === 0) return

    const parseNum = (val) => {
        if (val === null || val === undefined || val === '') return 0;
        const strVal = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '');
        const parsed = parseFloat(strVal);
        return isNaN(parsed) ? 0 : parsed;
    };

    const isEVCar = (c) => String(c.fuel_type || '').trim().toUpperCase() === 'EV';
    const isRentalCar = (c) => String(c.ownership_type || '').trim() === 'รถเช่า' || String(c.ownership_type || '').includes('เช่า');

    const filteredCarsList = carsList.filter(c => {
      if (carCategoryFilter === 'ev') return isEVCar(c);
      if (carCategoryFilter === 'rental') return isRentalCar(c);
      if (carCategoryFilter === 'pea') return !isRentalCar(c);
      return true; 
    });

    const allowedCarIds = new Set(filteredCarsList.map(c => String(c.id)));
    const evCarIds = new Set(carsList.filter(c => isEVCar(c)).map(c => String(c.id)));
    
    // filteredLogs ใช้เฉพาะรถในหมวดหมู่ที่เลือก
    const filteredLogs = rawLogs.filter(l => allowedCarIds.has(String(l.car_id)));

    // ✅ คำนวณความเคลื่อนไหวล่าสุด
    const latestMovementsList = filteredCarsList.map(c => {
        const cLogs = rawLogs.filter(l => String(l.car_id) === String(c.id));
        if (cLogs.length === 0) {
            return {
                plate: c.plate_number || '-',
                driver: '-',
                startStr: '-',
                endStr: '-',
                duration: '-',
                isCompleted: true,
                dateStr: 'ไม่มีประวัติ',
                timestamp: 0,
                hasData: false
            };
        }
        const latestLog = cLogs[0];
        const start = latestLog.start_time ? new Date(latestLog.start_time) : null;
        const end = latestLog.end_time ? new Date(latestLog.end_time) : null;
        const isCompleted = latestLog.is_completed !== false && end != null;

        let duration = '';
        if (isCompleted && start && end) {
            const diffMins = Math.floor((end - start) / 60000);
            const h = Math.floor(diffMins / 60);
            const m = diffMins % 60;
            duration = h > 0 ? `${h} ชม. ${m} นาที` : `${m} นาที`;
        }

        return {
            plate: c.plate_number || '-',
            driver: latestLog.driver_name || '-',
            startStr: start ? start.toLocaleTimeString('th-TH', { hour: '2-digit', minute:'2-digit' }) : '-',
            endStr: isCompleted ? end.toLocaleTimeString('th-TH', { hour: '2-digit', minute:'2-digit' }) : 'ยังไม่คืน',
            duration: duration,
            isCompleted: isCompleted,
            dateStr: start ? start.toLocaleDateString('th-TH', { day:'2-digit', month:'short' }) : '',
            timestamp: start ? start.getTime() : 0,
            hasData: true
        };
    }).sort((a,b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return b.timestamp - a.timestamp;
    });

    const getLogDistance = (l) => {
        const start = parseNum(l.start_mileage);
        const end = parseNum(l.end_mileage);
        if (end > start) return end - start;
        if (parseNum(l.distance) > 0) return parseNum(l.distance); 
        return 0;
    }

    const fleetData = filteredCarsList.map((c, index) => {
        const cLogs = filteredLogs.filter(l => String(l.car_id) === String(c.id) && l.is_completed !== false);
        const isEV = evCarIds.has(String(c.id));
        
        const validStartLogs = cLogs.filter(l => parseNum(l.start_mileage) > 0);
        const validEndLogs = cLogs.filter(l => parseNum(l.end_mileage) > 0);
        
        const minStartMil = validStartLogs.length > 0 ? Math.min(...validStartLogs.map(l => parseNum(l.start_mileage))) : 0;
        const maxEndMil = validEndLogs.length > 0 ? Math.max(...validEndLogs.map(l => parseNum(l.end_mileage))) : 0;

        let totalD = 0;
        if (maxEndMil > minStartMil && minStartMil > 0) {
            totalD = maxEndMil - minStartMil;
        } else {
            totalD = cLogs.reduce((s, l) => s + getLogDistance(l), 0);
            if (totalD === 0) {
                totalD = parseNum(c.mileage) || parseNum(c.current_mileage) || parseNum(c.distance) || 0;
            }
        }

        const totalC = cLogs.reduce((s, l) => s + parseNum(l.fuel_cost), 0);
        const totalL = cLogs.reduce((s, l) => s + parseNum(l.fuel_liters), 0);
        const chargeCount = cLogs.filter(l => parseNum(l.battery_after) > 0 || parseNum(l.fuel_liters) > 0).length;

        const cRepairs = repairLogs.filter(r => String(r.car_id) === String(c.id));
        const totalRepairCost = cRepairs.reduce((s, r) => s + parseNum(r.cost), 0);
        const repairCount = cRepairs.length;

        const startMil = minStartMil > 0 ? minStartMil : '-';
        const endMil = maxEndMil > 0 ? maxEndMil : '-';

        const purposes = {};
        const locations = {};
        cLogs.forEach(l => {
            let p = 'งานทั่วไป';
            if (isEV) {
                p = 'ชาร์จรถ EV';
            } else if (l.location && l.location !== '-') {
                const matchP = l.location.match(/\[.*? - (.*?)\]/);
                p = matchP ? matchP[1].trim() : l.location;
                if(p.length > 25) p = p.substring(0, 25) + '...';
            }
            purposes[p] = (purposes[p] || 0) + 1;

            let a = 'ไม่ระบุพื้นที่';
            if (isEV) {
                a = l.station_name || l.location || 'สถานีชาร์จ';
            } else if (l.location && l.location !== '-') {
                const matchA = l.location.match(/\]\s*(.*)/);
                a = matchA && matchA[1] ? matchA[1].trim() : l.location;
                if(a.length > 25) a = a.substring(0, 25) + '...';
            }
            locations[a] = (locations[a] || 0) + 1;
        });

        return {
          id: c.id,
          plate: c.plate_number,
          brand: c.model || '-',
          car_type: c.car_type || '-', 
          budget: c.budget || '-',
          plan: c.departments?.name || c.department || '-',
          mainUsage: c.usage_type || '-',
          type: isEV ? 'EV' : 'Gasoline',
          dist: totalD,
          trips: cLogs.length,
          fuelLiters: totalL,
          fuelCost: totalC, 
          efficiency: isEV ? 0 : (totalD > 0 ? (totalC / totalD).toFixed(2) : 0),
          efficiencyLKM: isEV ? 0 : (totalD > 0 ? (totalL / totalD).toFixed(3) : 0),
          refillCount: chargeCount,
          status: c.status,
          model: c.model,
          repairCount: repairCount,
          repairCost: totalRepairCost,
          startMil: startMil,
          endMil: endMil,
          workTypes: Object.entries(purposes).map(([p, count]) => `${p} (${count})`).join(', '),
          areas: Object.entries(locations).map(([a, count]) => `${a} (${count})`).join(', ')
        }
    }).sort((a,b) => a.dist !== b.dist ? b.dist - a.dist : b.trips - a.trips); 

    const pData = fleetData.map((c, index) => ({
        no: index + 1,
        plate: c.plate,
        brand: c.brand,
        type: c.car_type, 
        budget: c.budget,
        plan: c.plan,
        startMil: c.startMil,
        endMil: c.endMil,
        dist: c.dist,
        mainUsage: c.mainUsage,
        remark: c.repairCount > 0 ? `ซ่อม ${c.repairCount} ครั้ง (${c.repairCost.toLocaleString()} บ.)` : '-'
    }));
    setPrintData(pData);

    const completedLogs = filteredLogs.filter(l => l.is_completed !== false);

    const evDist = fleetData.filter(c => c.type === 'EV').reduce((s, c) => s + c.dist, 0);
    const gDist = fleetData.filter(c => c.type !== 'EV').reduce((s, c) => s + c.dist, 0);
    const totalDist = gDist + evDist;
    const totalTrips = completedLogs.length;

    const gasLogs = completedLogs.filter(l => !evCarIds.has(String(l.car_id)));
    const gCost = gasLogs.reduce((s, l) => s + parseNum(l.fuel_cost), 0);
    const gLiters = gasLogs.reduce((s, l) => s + parseNum(l.fuel_liters), 0);

    const evLogs = completedLogs.filter(l => evCarIds.has(String(l.car_id)));
    const evCharges = evLogs.filter(l => parseNum(l.battery_after) > 0);
    const battGains = evCharges.map(l => (parseNum(l.battery_after) - parseNum(l.battery_before)));
    const avgCharge = battGains.length > 0 ? (battGains.reduce((a,b)=>a+b,0)/battGains.length) : 0;

    const driverMap = {}
    const locMap = {}
    const hourlyMap = Array(24).fill(0)

    // ✅ สร้างแกนเวลาอ้างอิงรายวัน ให้แสดงวันในกราฟได้ครบถ้วน
    const trendMap = new Map();
    if (!currentDateRange.isAllTime && currentDateRange.start && currentDateRange.end) {
        let curr = new Date(currentDateRange.start);
        const end = new Date(currentDateRange.end);
        let safety = 0;
        // ป้องกันลูปไม่สิ้นสุด
        while (curr <= end && safety < 366) {
            const yyyy = curr.getFullYear();
            const mm = String(curr.getMonth() + 1).padStart(2, '0');
            const dd = String(curr.getDate()).padStart(2, '0');
            const localDateStr = `${yyyy}-${mm}-${dd}`;
            const label = curr.toLocaleDateString('th-TH', {day: '2-digit', month: 'short'});
            
            trendMap.set(localDateStr, { label, val: 0 });
            curr.setDate(curr.getDate() + 1);
            safety++;
        }
    }

    completedLogs.forEach(l => {
      if (!driverMap[l.driver_name]) driverMap[l.driver_name] = { logs: [], cars: new Set(), purposes: {}, locations: {} }
      driverMap[l.driver_name].logs.push(l);
      if (l.cars?.plate_number) driverMap[l.driver_name].cars.add(l.cars.plate_number)
      
      let p = 'งานทั่วไป';
      if (l.cars?.fuel_type?.toUpperCase() === 'EV') { p = 'ชาร์จรถ EV'; } 
      else if (l.location && l.location !== '-') {
          const match = l.location.match(/\[.*? - (.*?)\]/);
          p = match ? match[1].trim() : l.location;
          if(p.length > 25) p = p.substring(0, 25) + '...';
      }
      driverMap[l.driver_name].purposes[p] = (driverMap[l.driver_name].purposes[p] || 0) + 1;

      let a = 'ไม่ระบุพื้นที่';
      if (l.cars?.fuel_type?.toUpperCase() === 'EV') { a = l.station_name || l.location || 'สถานีชาร์จ'; } 
      else if (l.location && l.location !== '-') {
          const matchA = l.location.match(/\]\s*(.*)/);
          a = matchA && matchA[1] ? matchA[1].trim() : l.location;
          if(a.length > 25) a = a.substring(0, 25) + '...';
      }
      driverMap[l.driver_name].locations[a] = (driverMap[l.driver_name].locations[a] || 0) + 1;

      if (l.location && l.location !== '-') { locMap[l.location] = (locMap[l.location] || 0) + 1 }
      
      // ✅ กราฟรายชั่วโมง
      const hour = new Date(l.start_time).getHours()
      hourlyMap[hour]++

      // ✅ กราฟรายวัน (Map Date)
      const lDate = new Date(l.start_time);
      const yyyy = lDate.getFullYear();
      const mm = String(lDate.getMonth() + 1).padStart(2, '0');
      const dd = String(lDate.getDate()).padStart(2, '0');
      const localDateStr = `${yyyy}-${mm}-${dd}`;
      
      if (currentDateRange.isAllTime) {
          if (!trendMap.has(localDateStr)) {
              trendMap.set(localDateStr, { label: lDate.toLocaleDateString('th-TH', {day: '2-digit', month: 'short', year: '2-digit'}), val: 0 });
          }
          trendMap.get(localDateStr).val += 1;
      } else {
          if (trendMap.has(localDateStr)) {
              trendMap.get(localDateStr).val += 1;
          }
      }
    })
    
    const sortedTrend = Array.from(trendMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(entry => entry[1]);
        
    const sortedHourly = hourlyMap.map((val, label) => ({ label: `${label}:00`, val }))

    const driverList = Object.entries(driverMap).map(([name, data]) => {
      let driverTotalDist = 0;
      const logsByCar = {};
      data.logs.forEach(l => {
          if (!logsByCar[l.car_id]) logsByCar[l.car_id] = [];
          logsByCar[l.car_id].push(l);
      });
      
      Object.keys(logsByCar).forEach(cId => {
          const cLogs = logsByCar[cId];
          const allMils = cLogs.flatMap(l => [parseNum(l.start_mileage), parseNum(l.end_mileage)]).filter(m => m > 0);
          if (allMils.length > 0) {
              const minM = Math.min(...allMils);
              const maxM = Math.max(...allMils);
              if (maxM > minM) { driverTotalDist += (maxM - minM); }
          }
      });

      return {
        name, 
        trips: data.logs.length, 
        dist: driverTotalDist, 
        carsUsed: Array.from(data.cars).join(', '),
        workTypes: Object.entries(data.purposes).map(([p, count]) => `${p} (${count})`).join(', '),
        areas: Object.entries(data.locations).map(([a, count]) => `${a} (${count})`).join(', ')
      }
    }).sort((a,b) => a.dist !== b.dist ? b.dist - a.dist : b.trips - a.trips)

    const topLocationsList = Object.entries(locMap).map(([name, count]) => ({
        name, count
    })).sort((a,b) => b.count - a.count).slice(0, 5)

    const carDriverMap = {}
    filteredCarsList.forEach(c => {
      const cLogs = completedLogs.filter(l => String(l.car_id) === String(c.id))
      if (cLogs.length > 0) {
        const drivers = {}
        cLogs.forEach(l => {
          drivers[l.driver_name] = (drivers[l.driver_name] || 0) + 1
        })
        carDriverMap[c.plate_number] = {
           type: evCarIds.has(String(c.id)) ? 'EV' : 'GAS',
           totalTrips: cLogs.length,
           drivers: Object.entries(drivers).map(([name, count]) => `${name} (${count})`).join(', ')
        }
      }
    })
    const carDriverList = Object.entries(carDriverMap).map(([plate, data]) => ({ plate, ...data })).sort((a,b) => b.totalTrips - a.totalTrips)

    const busy = filteredCarsList.filter(c => c.status === 'busy').length;
    const avail = filteredCarsList.filter(c => c.status === 'available').length;

    setGlobalStats({
      totalDistance: totalDist,
      totalTrips: totalTrips,
      fuelSavings: (evDist * (gCost / (gDist || 1))).toFixed(0),
      activeRate: filteredCarsList.length > 0 ? ((busy / filteredCarsList.length) * 100).toFixed(0) : 0,
      availableCars: avail,
      busyCars: busy,
      totalCars: filteredCarsList.length,
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
      carDriverHistory: carDriverList,
      latestMovements: latestMovementsList
    })

  }, [rawLogs, carsList, repairLogs, carCategoryFilter, currentDateRange])

  // ✅ เปลี่ยนช่องกรอกข้อมูล แก้ไข input type="date" ทะลุเกินขอบจอในมือถือด้วย block, min-w-0, max-w-full, appearance-none, box-border
  const renderField = (key, label, options, iconName, type = 'select') => (
    <div className="flex flex-col gap-1.5 relative min-w-0 w-full">
        <label className="text-[13px] font-semibold text-[#4b1560] ml-1">{label}</label>
        <div className="relative group w-full min-w-0">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#aeaeb2] group-focus-within:text-[#702082] transition-colors z-10">
                <Icon icon={iconName} width="18" height="18" />
            </div>
            {type === 'select' ? (
                <select 
                    value={queryFilters[key]} 
                    onChange={(e) => setQueryFilters(prev => ({...prev, [key]: e.target.value}))}
                    className="w-full min-w-0 bg-[#f9f9fb] border border-[#eadfed] hover:border-[#c7c7cc] rounded-[16px] pl-10 pr-8 py-2.5 text-[14px] text-[#4b1560] outline-none focus:bg-white focus:border-[#702082] focus:ring-4 focus:ring-[#702082]/10 transition-all appearance-none cursor-pointer box-border block"
                    style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238e8e93'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, 
                        backgroundPosition: 'right 0.75rem center', 
                        backgroundRepeat: 'no-repeat', 
                        backgroundSize: '1.2em 1.2em'
                    }}
                >
                    <option value="" className="text-[#765c7c]">ทั้งหมด (อิงตามช่วงเวลาที่กำหนด)</option>
                    {options.map(opt => (
                        <option key={opt} value={opt} className="text-[#4b1560]">{opt}</option>
                    ))}
                </select>
            ) : (
                <input 
                    type="date"
                    value={queryFilters[key]} 
                    onChange={(e) => setQueryFilters(prev => ({...prev, [key]: e.target.value}))}
                    onClick={(e) => {
                        try {
                            if (typeof e.target.showPicker === 'function') {
                                e.target.showPicker();
                            }
                        } catch (err) {}
                    }}
                    className="block w-full min-w-0 max-w-full appearance-none box-border bg-[#f9f9fb] border border-[#eadfed] hover:border-[#c7c7cc] rounded-[16px] pl-10 pr-3 py-2.5 text-[14px] text-[#4b1560] outline-none focus:bg-white focus:border-[#702082] focus:ring-4 focus:ring-[#702082]/10 transition-all cursor-pointer premium-date-input"
                />
            )}
        </div>
    </div>
  );

  if (showWelcome) {
    return (
      <div className="min-h-[100dvh] bg-[#f8f3fa] flex flex-col items-center justify-center p-4 md:p-6 relative font-sarabun overflow-hidden" style={{WebkitFontSmoothing:'antialiased'}}>
        <style>{`
          @keyframes slideUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
          .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
        `}</style>
        
        <div className="max-w-3xl w-full z-10 animate-slide-up flex flex-col items-center">
          <div className="text-center mb-6 md:mb-8 flex-shrink-0">
            <img src="/pea_logo.png" className="h-10 md:h-12 mx-auto mb-3 object-contain" alt="PEA" onError={(e) => e.target.style.display = 'none'}/>
            <h1 className="text-[24px] md:text-[34px] font-bold text-[#4b1560] tracking-[-1px] leading-tight mb-1">
              เลือกระบบจัดการฝูงรถ
            </h1>
            <p className="text-[13px] md:text-[15px] text-[#765c7c]">
              กรุณาเลือกหมวดหมู่รถที่ต้องการดูข้อมูลสถิติ
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-5 w-full flex-shrink-0 px-2 md:px-0">
            {categories.map((cat, index) => (
              <button 
                key={cat.id} 
                onClick={() => handleSelectCategory(cat.id)}
                className="group text-left bg-white p-4 md:p-6 rounded-[20px] md:rounded-[24px] border border-transparent hover:border-[#702082]/30 transition-all duration-300 transform hover:-translate-y-1 active:scale-[0.98] active:translate-y-0 relative overflow-hidden flex flex-col justify-center items-center md:items-start text-center md:text-left h-full min-h-[140px] md:min-h-[180px]"
                style={{boxShadow:'0 4px 20px rgba(0,0,0,0.05)', animationDelay: `${index * 80}ms`}}
              >
                <div className={`w-12 h-12 md:w-14 md:h-14 rounded-[14px] md:rounded-[18px] ${cat.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300 shadow-sm`}
                     style={{boxShadow: `0 6px 12px ${cat.shadow}`, color: cat.iconBg}}>
                  <Icon icon={cat.iconName} width="28" height="28" />
                </div>
                
                <div className="w-full">
                  <h2 className="text-[15px] md:text-[19px] font-bold text-[#4b1560] mb-1 tracking-[-0.3px] group-hover:text-[#702082] transition-colors">{cat.title}</h2>
                  <p className="text-[11px] md:text-[13px] text-[#765c7c] leading-snug line-clamp-2 md:line-clamp-none">{cat.desc}</p>
                </div>
                
                <div className="hidden md:block absolute top-6 right-6 text-[#d9cadd] group-hover:text-[#702082] transition-colors">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
            ))}
          </div>

          <div className="text-center mt-8 md:mt-10 flex-shrink-0">
            <button onClick={() => router.push('/')} className="text-[13px] md:text-[14px] font-medium text-[#702082] hover:underline active:opacity-50">
              กลับสู่หน้าหลัก
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading && !showWelcome) return <PageSkeleton variant="dashboard" />

  const maxTrend  = Math.max(...analytics.dailyTrend.map(d => d.val), 1);
  const maxHourly = Math.max(...analytics.hourlyTrend.map(d => d.val), 1);
  const maxLoc    = Math.max(...analytics.topLocations.map(l => l.count), 1);

  const Card = ({ children, className = '', style = {} }) => (
    <div className={`bg-white rounded-[24px] overflow-hidden ${className}`}
         style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 20px rgba(0,0,0,0.07)', ...style}}>
      {children}
    </div>
  )

  const getReportTitleDate = () => {
    if (timeFilter === 'month') return new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    if (timeFilter === 'select_month') return new Date(`${selectedMonth}-01`).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
    if (timeFilter === 'custom') return `${customStartDate} ถึง ${customEndDate}`;
    if (timeFilter === 'week') return 'สัปดาห์นี้';
    return 'ทั้งหมด';
  }

  const activeCategory = categories.find(c => c.id === carCategoryFilter) || categories[0];

  return (
    <>
      <style>{`
        * { -webkit-font-smoothing: antialiased; }
        .st::-webkit-scrollbar{width:3px; height: 3px;}
        .st::-webkit-scrollbar-thumb{background:#d9cadd;border-radius:6px}
        
        .premium-date-input::-webkit-calendar-picker-indicator {
            display: none;
            -webkit-appearance: none;
        }

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
          border-color: #702082;
          background: #f3eaf5;
        }

        .print-only { display: none; width: 100%; }

        @media print {
          .no-print { display: none !important; }
          .print-only { 
            display: block !important; 
            font-family: 'Sarabun', sans-serif; 
            width: 100%;
          }
          @page { size: landscape; margin: 15mm; }
          body { 
            background: white !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact;
          }
          table { page-break-inside: auto; width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; } 
          tfoot { display: table-footer-group; }
          th, td {
            border: 1px solid #000; padding: 4px 6px; text-align: center;
          }
          th.no-border-print { border: none !important; background-color: transparent !important; }
          th { font-weight: bold; background-color: #f2f2f2 !important; }
          .text-left { text-align: left !important; }
          .reason-input { border: none !important; background: transparent !important; padding: 0 !important; color: black !important; }
          .reason-input::placeholder { color: transparent; }
        }
      `}</style>

      {/* ── โซนสำหรับพิมพ์ PDF เท่านั้น (ไม่แสดงบนหน้าจอ) ── */}
      <div className="print-only">
        {printType === 'summary' && (
          <table>
            <thead>
              <tr>
                <th colSpan="14" className="no-border-print" style={{ paddingBottom: '20px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, fontFamily: 'Sarabun, sans-serif' }}>
                    บัญชี{activeCategory.title}การไฟฟ้าส่วนภูมิภาคเขต ก.3 สาขากำแพงแสน ประจำเดือน {getReportTitleDate()}
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
                    <td style={{textAlign: 'center'}}>{row.dist}</td>
                    <td className="text-left">{row.mainUsage}</td>
                    <td>{isComplete ? '/' : ''}</td>
                    <td>{!isComplete ? '/' : ''}</td>
                    <td>{customReason}</td>
                    <td>{row.remark}</td>
                  </tr>
                )
              })}
              {printData.length === 0 && (
                <tr><td colSpan="14" style={{ textAlign: 'center', padding: '20px' }}>ไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>
              )}
            </tbody>
          </table>
        )}

        {printType === 'query' && (
          <table>
            <thead>
              <tr>
                <th colSpan="10" className="no-border-print" style={{ paddingBottom: '20px' }}>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, fontFamily: 'Sarabun, sans-serif' }}>
                    รายงานผลลัพธ์การค้นหาประวัติการใช้งานรถ ({queryResults.length} รายการ)
                  </h2>
                </th>
              </tr>
              <tr>
                <th style={{width: '5%'}}>ลำดับ</th>
                <th>วันที่</th>
                <th>ทะเบียนรถ</th>
                <th>ชื่อ/ตำแหน่ง</th>
                <th>แผนก</th>
                <th>ประเภทงาน</th>
                <th>สถานที่</th>
                <th>ระยะทาง (กม.)</th>
                <th>น้ำมัน (ลิตร)</th>
                <th>จำนวนเงิน (บ.)</th>
              </tr>
            </thead>
            <tbody>
              {queryResults.map((row, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td>{row.date}</td>
                  <td>{row.plate}</td>
                  <td className="text-left">{row.name}</td>
                  <td>{row.dept}</td>
                  <td>{row.job}</td>
                  <td className="text-left">{row.location}</td>
                  <td>{row.dist}</td>
                  <td>{row.fuel}</td>
                  <td>{row.cost.toLocaleString()}</td>
                </tr>
              ))}
              {queryResults.length === 0 && (
                <tr><td colSpan="10" style={{ textAlign: 'center', padding: '20px' }}>ไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal สั่งพิมพ์ (สำหรับสรุปรายคัน) ── */}
      {showPrintModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 no-print fu">
          <div className="bg-white rounded-[24px] w-full max-w-7xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-4 md:px-6 py-4 border-b border-[#eadfed] flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-[#f9f9fb] shrink-0">
              <div>
                <h3 className="text-[17px] font-semibold text-[#4b1560] tracking-[-0.3px] flex items-center gap-2">
                  <Icon icon="ph:file-text-duotone" width="22" height="22" className="text-[#702082]" />
                  จัดการเอกสารเตรียมพิมพ์
                </h3>
                <p className="text-[12px] text-[#765c7c] mt-0.5">คลิกที่ช่อง "สาเหตุ" เพื่อพิมพ์ข้อความได้โดยตรง จากนั้นกดยืนยันสั่งพิมพ์</p>
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <button onClick={() => setShowPrintModal(false)}
                  className="px-4 py-2 text-[13px] font-medium text-[#765c7c] hover:text-[#4b1560] transition-colors">
                  ยกเลิก
                </button>
                <button onClick={() => { setPrintType('summary'); setTimeout(handlePrint, 100); }}
                  className="flex items-center gap-1.5 text-[13px] font-medium bg-[#702082] text-white px-5 py-2 rounded-[10px] shadow-sm hover:bg-[#0077ed] active:scale-[0.98] transition-all whitespace-nowrap">
                  <Icon icon="ph:printer-duotone" width="18" height="18" /> ยืนยันสั่งพิมพ์
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 md:p-6 bg-white st">
              <table className="w-full border-collapse font-sarabun text-[11px]" style={{ minWidth: '1000px' }}>
                <thead className="sticky top-0 bg-white z-10 shadow-[0_2px_0_rgba(0,0,0,0.1)]">
                  <tr>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[4%]">อันดับที่</th>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[9%]">หมายเลขทะเบียน</th>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[7%]">ยี่ห้อ</th>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[12%]">ชนิดและลักษณะ</th>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[5%]">งบ</th>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[6%]">ประจำแผนก</th>
                    <th colSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5">เลขไมล์</th>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[6%]">รวมระยะทาง<br/>กม.</th>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[16%]">ประเภทการใช้งานส่วนใหญ่</th>
                    <th colSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5">ความครบถ้วน</th>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[12%]">สาเหตุ</th>
                    <th rowSpan="2" className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[6%]">หมายเหตุ</th>
                  </tr>
                  <tr>
                    <th className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[6%] top-[34px]">เริ่ม</th>
                    <th className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[6%] top-[34px]">สิ้นสุด</th>
                    <th className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[4%] top-[34px]">ครบถ้วน</th>
                    <th className="border border-[#d9cadd] bg-[#f8f3fa] p-1.5 w-[4%] top-[34px]">ไม่ครบ</th>
                  </tr>
                </thead>
                <tbody>
                  {printData.map((row, idx) => {
                    const customReason = printReasons[row.plate] || '';
                    const isComplete = !customReason; 
                    return (
                      <tr key={idx}>
                        <td className="border border-[#d9cadd] p-1.5 text-center">{row.no}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center font-medium">{row.plate}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center">{row.brand}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center">{row.type}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center">{row.budget}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center">{row.plan}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center">{row.startMil}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center">{row.endMil}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center">{row.dist}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-left">{row.mainUsage}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center font-bold">{isComplete ? '/' : ''}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center font-bold">{!isComplete ? '/' : ''}</td>
                        <td className="border border-[#d9cadd] p-1.5 text-center">
                          <input 
                            type="text"
                            className="reason-input"
                            placeholder="คลิกพิมพ์สาเหตุ..."
                            value={customReason}
                            onChange={(e) => setPrintReasons(prev => ({ ...prev, [row.plate]: e.target.value }))}
                          />
                        </td>
                        <td className="border border-[#d9cadd] p-1.5 text-center">{row.remark}</td>
                      </tr>
                    )
                  })}
                  {printData.length === 0 && (
                    <tr><td colSpan="14" className="border border-[#d9cadd] text-center p-8">ไม่มีข้อมูลในช่วงเวลาที่เลือก</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal แสดงผลตาราง Query */}
      {showQueryModal && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-6 fu no-print">
          <div className="bg-white rounded-[24px] w-[95vw] h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            
            <div className="flex justify-between items-center px-4 md:px-6 py-4 border-b border-[#eadfed] bg-white shrink-0 z-20">
              <h3 className="text-[17px] font-semibold text-[#4b1560] flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#edf6ff] flex items-center justify-center text-[#702082]">
                    <Icon icon="ph:table-duotone" width="18" height="18" />
                </div>
                ผลลัพธ์การค้นหา ({queryResults.length} รายการ)
              </h3>
              <div className="flex gap-2.5">
                  <button onClick={() => { setPrintType('query'); setTimeout(handlePrint, 100); }} className="flex items-center gap-1.5 px-4 py-1.5 text-[13px] font-medium bg-[#4b1560] text-white rounded-[10px] hover:bg-[#3a3a3c] transition-colors shadow-sm">
                      <Icon icon="ph:printer-duotone" /> พิมพ์เป็น PDF
                  </button>
                  <button onClick={() => setShowQueryModal(false)} className="w-8 h-8 flex items-center justify-center bg-[#f8f3fa] hover:bg-[#eadfed] text-[#765c7c] rounded-full transition-colors active:scale-95">
                      <Icon icon="ph:x-bold" />
                  </button>
              </div>
            </div>

            <div className="flex-1 bg-[#f3eaf5] p-4 md:p-6 overflow-hidden flex flex-col">
              <div className="bg-white rounded-[16px] shadow-sm border border-[rgba(0,0,0,0.03)] overflow-hidden flex-1 flex flex-col">
                  <div className="overflow-auto flex-1 relative st">
                      <table className="w-full border-collapse text-[13px] font-sarabun min-w-[1000px]">
                        <thead className="sticky top-0 z-10 bg-[#f9f9fb] shadow-[0_1px_0_rgba(0,0,0,0.1)]">
                          <tr>
                            {['ลำดับ', 'วันที่', 'ทะเบียนรถ', 'ชื่อ/ตำแหน่ง', 'แผนก', 'ประเภทงาน', 'สถานที่', 'ระยะทาง (กม.)', 'น้ำมัน (ลิตร)', 'จำนวนเงิน (บ.)'].map(h => (
                              <th key={h} className={`px-4 py-3.5 ${h==='ลำดับ' ? 'text-center' : 'text-left'} font-semibold text-[#765c7c] whitespace-nowrap bg-[#f9f9fb]`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.length > 0 ? (
                            queryResults.map((row, idx) => (
                              <tr key={idx} className="border-b border-[rgba(0,0,0,0.04)] last:border-0 hover:bg-[#f8f3fa]/50 transition-colors">
                                <td className="px-4 py-3 text-center text-[#765c7c] font-medium">{idx + 1}</td>
                                <td className="px-4 py-3 text-[#3c3c43] whitespace-nowrap">{row.date}</td>
                                <td className="px-4 py-3 font-semibold text-[#4b1560] whitespace-nowrap">{row.plate}</td>
                                <td className="px-4 py-3 text-[#3c3c43] whitespace-nowrap">{row.name}</td>
                                <td className="px-4 py-3 text-[#3c3c43] whitespace-nowrap">{row.dept}</td>
                                <td className="px-4 py-3 text-[#3c3c43] whitespace-nowrap">{row.job}</td>
                                <td className="px-4 py-3 text-[#3c3c43] min-w-[200px]">{row.location}</td>
                                <td className="px-4 py-3 text-right font-medium text-[#4b1560]">{row.dist}</td>
                                <td className="px-4 py-3 text-right font-medium text-[#4b1560]">{row.fuel}</td>
                                <td className="px-4 py-3 text-right font-semibold text-[#702082]">{row.cost.toLocaleString()}</td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan="10" className="text-center py-12 text-[#aeaeb2]">ไม่พบข้อมูลจากเงื่อนไขที่คุณเลือก</td></tr>
                          )}
                        </tbody>
                      </table>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dashboard ปกติ ── */}
      <div className="no-print min-h-screen bg-[#f8f3fa] font-sarabun pb-24" style={{WebkitFontSmoothing:'antialiased'}}>
        <nav className="sticky top-0 z-50 border-b border-black/[0.06] py-3 md:py-0 md:h-[60px]"
             style={{background:'rgba(248,243,250,0.92)', backdropFilter:'saturate(180%) blur(24px)', WebkitBackdropFilter:'saturate(180%) blur(24px)'}}>
          <div className="max-w-[1440px] mx-auto px-4 md:px-5 h-full flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            <div className="flex items-center justify-between w-full md:w-auto">
              <div className="flex items-center gap-3">
                <img src="/pea_logo.png" className="h-7 w-auto object-contain" alt="PEA" onError={(e) => e.target.style.display = 'none'}/>
                <span className="text-[16px] font-semibold text-[#4b1560] tracking-[-0.3px] hidden sm:block">Fleet Dashboard</span>
                
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-[#eadfed] ml-0 sm:ml-2">
                  <Icon icon={activeCategory.iconName} width="16" height="16" className="text-[#702082]" />
                  <span className="text-[12px] font-semibold text-[#4b1560] whitespace-nowrap">{activeCategory.title}</span>
                </div>
              </div>
              
              <div className="flex md:hidden gap-3 items-center">
                <button onClick={() => setShowWelcome(true)} className="text-[13px] font-medium text-[#702082] active:opacity-50">
                  เปลี่ยนหมวดหมู่
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 overflow-x-auto st pb-1 md:pb-0 w-full md:w-auto whitespace-nowrap">
              <div className="flex bg-[#eadfed] rounded-[10px] p-[3px] gap-[2px] shrink-0">
                {[['week','สัปดาห์'],['month','เดือนนี้'],['select_month','เลือกเดือน'],['custom','กำหนดเอง'],['all','ทั้งหมด']].map(([tf,label]) => (
                  <button key={tf} onClick={() => setTimeFilter(tf)}
                    className={`px-3.5 py-[5px] text-[12px] font-medium rounded-[8px] transition-all ${
                      timeFilter===tf ? 'bg-white text-[#4b1560] shadow-sm' : 'text-[#765c7c] hover:text-[#3c3c43]'
                    }`}>{label}</button>
                ))}
              </div>
              
              {timeFilter==='select_month' && (
                <div className="flex items-center gap-2 bg-white px-3 py-[5px] rounded-[10px] border border-[#eadfed] text-[11px] font-mono shrink-0"
                     style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                  <input type="month" value={selectedMonth} onChange={e=>setSelectedMonth(e.target.value)} className="outline-none bg-transparent text-[#4b1560]"/>
                </div>
              )}

              {timeFilter==='custom' && (
                <div className="flex items-center gap-2 bg-white px-3 py-[5px] rounded-[10px] border border-[#eadfed] text-[11px] font-mono shrink-0"
                     style={{boxShadow:'0 1px 4px rgba(0,0,0,0.07)'}}>
                  <input type="date" value={customStartDate} onChange={e=>setCustomStartDate(e.target.value)} className="outline-none bg-transparent text-[#4b1560]"/>
                  <span className="text-[#c7c7cc]">→</span>
                  <input type="date" value={customEndDate} onChange={e=>setCustomEndDate(e.target.value)} className="outline-none bg-transparent text-[#4b1560]"/>
                </div>
              )}

              <div className="hidden md:block w-px h-5 bg-[#d9cadd] mx-1 shrink-0"/>
              
              <button onClick={() => { setPrintType('summary'); setShowPrintModal(true); }}
                className="flex items-center gap-1.5 text-[12px] font-medium bg-[#4b1560] text-white px-4 py-1.5 rounded-[8px] shadow-sm hover:bg-[#3a3a3c] transition-colors border border-transparent shrink-0">
                <Icon icon="ph:printer-duotone" width="16" height="16" /> สั่งพิมพ์
              </button>

              <button onClick={() => setShowWelcome(true)} 
                className="hidden md:flex items-center gap-1.5 text-[12px] font-medium text-[#4b1560] bg-white border border-[#eadfed] hover:bg-[#f3eaf5] px-3 py-1.5 rounded-[8px] shadow-sm transition-colors shrink-0">
                <Icon icon="ph:squares-four-duotone" width="16" height="16" className="text-[#702082]" /> เปลี่ยนหมวดหมู่
              </button>
            </div>
          </div>
        </nav>

        <div className="max-w-[1440px] mx-auto px-4 md:px-5 pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 fu" style={{animationDelay:'0ms'}}>
            
            <div className="col-span-1 sm:col-span-2 xl:col-span-1 rounded-[24px] p-5 flex flex-col justify-between min-h-[140px] relative overflow-hidden"
                 style={{background:'#4b1560', boxShadow:'0 4px 24px rgba(0,0,0,0.18)'}}>
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
              <div className="w-10 h-10 rounded-[12px] bg-white/10 flex items-center justify-center z-10">
                <Icon icon="ph:road-horizon-duotone" width="24" height="24" className="text-white" />
              </div>
              <div className="mt-4 md:mt-0 z-10">
                <p className="text-[11px] font-semibold text-white/50 uppercase tracking-[0.06em] mb-0.5">ระยะทางสะสม ({activeCategory.title})</p>
                <p className="text-[32px] font-bold text-white leading-none tracking-[-1px]">
                  {globalStats.totalDistance.toLocaleString()}
                  <span className="text-[16px] font-normal text-white/50 ml-1">กม.</span>
                </p>
                <p className="text-[11px] text-white/40 mt-1">{globalStats.totalTrips} ภารกิจ · ~{globalStats.avgTripDist} กม./รอบ</p>
              </div>
            </div>

            {carCategoryFilter === 'ev' ? (
              <Card className="p-5 flex flex-col justify-between min-h-[140px]" style={{background:'linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%)'}}>
                <div className="w-10 h-10 rounded-[12px] bg-white/60 flex items-center justify-center">
                  <Icon icon="ph:lightning-duotone" width="24" height="24" className="text-[#702082]" />
                </div>
                <div className="mt-4 md:mt-0">
                  <Label>สถิติการชาร์จไฟ</Label>
                  <p className="text-[28px] font-bold text-[#702082] leading-none tracking-[-0.8px]">
                    {evStats.charges}
                    <span className="text-[14px] font-normal text-[#702082]/60 ml-1">ครั้ง</span>
                  </p>
                  <p className="text-[11px] text-[#702082]/60 mt-1">ชาร์จเพิ่มเฉลี่ย {evStats.avgGain}% / ครั้ง</p>
                </div>
              </Card>
            ) : (
              <Card className="p-5 flex flex-col justify-between min-h-[140px]">
                <div className="w-10 h-10 rounded-[12px] bg-[#fff4e0] flex items-center justify-center">
                  <Icon icon="ph:gas-pump-duotone" width="24" height="24" className="text-[#e67e22]" />
                </div>
                <div className="mt-4 md:mt-0">
                  <Label>น้ำมันรวม</Label>
                  <p className="text-[28px] font-bold text-[#4b1560] leading-none tracking-[-0.8px]">
                    {gasolineStats.fuelLiters.toLocaleString(undefined,{maximumFractionDigits:1})}
                    <span className="text-[14px] font-normal text-[#765c7c] ml-1">ลิตร</span>
                  </p>
                  <p className="text-[11px] text-[#aeaeb2] mt-1">฿{gasolineStats.cost.toLocaleString()} · {gasolineStats.efficiency} บ./กม.</p>
                </div>
              </Card>
            )}

            <Card className="p-5 flex flex-col justify-between min-h-[140px]" style={{background:'linear-gradient(135deg,#edfbf0 0%,#d4f5e0 100%)'}}>
              <div className="w-10 h-10 rounded-[12px] bg-white/60 flex items-center justify-center">
                <Icon icon="ph:leaf-duotone" width="24" height="24" className="text-[#1a7f37]" />
              </div>
              <div className="mt-4 md:mt-0">
                <Label>ลด CO₂</Label>
                <p className="text-[28px] font-bold text-[#1a7f37] leading-none tracking-[-0.8px]">
                  {evStats.carbonSaved}
                  <span className="text-[14px] font-normal text-[#1a7f37]/60 ml-1">kg</span>
                </p>
                <p className="text-[11px] text-[#1a7f37]/60 mt-1">
                  {carCategoryFilter === 'ev' ? `เทียบเท่าประหยัดน้ำมัน ~${(evStats.carbonSaved / 2.3).toFixed(1)} ลิตร` : `EV Ratio ${globalStats.ecoScore}%`}
                </p>
              </div>
            </Card>

            <Card className="p-5 flex flex-col justify-between min-h-[140px]" style={{background:'linear-gradient(135deg,#f0eeff 0%,#e5dbff 100%)'}}>
              <div className="w-10 h-10 rounded-[12px] bg-white/60 flex items-center justify-center">
                <Icon icon="ph:coins-duotone" width="24" height="24" className="text-[#5e35b1]" />
              </div>
              <div className="mt-4 md:mt-0">
                <Label>ประหยัดได้</Label>
                <p className="text-[28px] font-bold text-[#5e35b1] leading-none tracking-[-0.8px]">
                  ฿{Number(globalStats.fuelSavings).toLocaleString()}
                </p>
                <p className="text-[11px] text-[#5e35b1]/60 mt-1">เทียบกับใช้น้ำมัน</p>
              </div>
            </Card>
          </div>

          {/* ── แถวที่ 2: ฝูงรถ + สถานะการใช้งานล่าสุด ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 fu" style={{animationDelay:'60ms'}}>
            <Card className="p-5">
              <SectionLabel title="ฝูงรถ" subtitle={`ในหมวด ${activeCategory.title} ทั้งหมด ${globalStats.totalCars} คัน`} />
              <div className="space-y-2.5">
                {[
                  {label:'ว่างพร้อมใช้', val:globalStats.availableCars, c:'#34c759', bg:'rgba(52,199,89,0.08)', pulse:false},
                  {label:'กำลังใช้งาน', val:globalStats.busyCars,    c:'#ff3b30', bg:'rgba(255,59,48,0.08)', pulse:true},
                ].map((s,i)=>(
                  <div key={i} className="flex items-center justify-between px-4 py-3 rounded-[14px]" style={{background:s.bg}}>
                    <div className="flex items-center gap-2.5">
                      <span className={`w-[9px] h-[9px] rounded-full flex-shrink-0 ${s.pulse?'animate-pulse':''}`} style={{background:s.c, boxShadow:`0 0 0 3px ${s.c}22`}}/>
                      <span className="text-[14px] font-medium text-[#4b1560]">{s.label}</span>
                    </div>
                    <span className="text-[22px] font-bold text-[#4b1560] leading-none">{s.val}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.05)]">
                <div className="flex justify-between text-[11px] text-[#765c7c] mb-2">
                  <span>Utilisation rate</span><span className="font-semibold text-[#4b1560]">{globalStats.activeRate}%</span>
                </div>
                <div className="h-2 bg-[#eadfed] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{width:`${globalStats.activeRate}%`, background:'linear-gradient(90deg,#702082,#34aadc)'}}/>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <SectionLabel 
                icon="ph:clock-counter-clockwise-duotone" 
                iconColor="text-[#702082]"
                title="สถานะการใช้รถล่าสุด" 
                subtitle="ประวัติการนำรถออกและเวลาคืนรถของรถทุกคัน"
              />
              <div className="space-y-2.5 max-h-[170px] overflow-y-auto st pr-1">
                {analytics.latestMovements && analytics.latestMovements.length > 0 ? analytics.latestMovements.map((m, i) => (
                  <div key={i} className={`flex items-center justify-between p-3 rounded-[12px] border transition-colors ${!m.hasData ? 'bg-white border-[#f8f3fa] opacity-60' : 'bg-[#f9f9fb] border-[rgba(0,0,0,0.03)] hover:bg-[#f8f3fa]'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-[10px] h-[10px] rounded-full flex-shrink-0 ${!m.hasData ? 'bg-[#d9cadd]' : (m.isCompleted ? 'bg-[#34c759]' : 'bg-[#ff3b30] animate-pulse')}`}
                           style={{boxShadow: !m.hasData ? 'none' : (m.isCompleted ? '0 0 0 3px rgba(52,199,89,0.15)' : '0 0 0 3px rgba(255,59,48,0.15)')}} />
                      <div>
                        <p className="text-[14px] font-semibold text-[#4b1560] leading-tight">{m.plate}</p>
                        <p className="text-[11px] text-[#765c7c] mt-0.5">{m.driver}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {m.hasData ? (
                        <>
                            <div className="flex items-center justify-end gap-1.5 text-[12px] font-medium mb-1">
                                <span className="text-[#4b1560] bg-white px-2 py-0.5 rounded-[6px] shadow-sm border border-[#eadfed]">{m.startStr}</span>
                                <Icon icon="ph:arrow-right-bold" className="text-[#c7c7cc]" width="12" />
                                <span className={`px-2 py-0.5 rounded-[6px] shadow-sm border ${m.isCompleted ? 'bg-white border-[#eadfed] text-[#4b1560]' : 'bg-[#fff0f0] border-[#ff3b30]/20 text-[#d70015]'}`}>
                                {m.endStr}
                                </span>
                            </div>
                            <p className="text-[10px] text-[#8e8e93]">
                                {m.dateStr} {m.isCompleted && m.duration ? `· ใช้เวลา ${m.duration}` : ''}
                            </p>
                        </>
                      ) : (
                        <p className="text-[11px] text-[#aeaeb2] mt-1">{m.dateStr}</p>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center py-6 text-[#aeaeb2]">
                    <Icon icon="ph:car-duotone" width="24" height="24" className="mb-2 opacity-50" />
                    <p className="text-[12px]">ยังไม่มีข้อมูลการใช้งาน</p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 fu" style={{animationDelay:'120ms'}}>
            {/* กราฟ 1: ความถี่รายวัน */}
            <Card className="p-5 flex flex-col">
              <SectionLabel 
                icon="ph:calendar-blank-duotone" 
                iconColor="text-[#702082]"
                title={carCategoryFilter === 'ev' ? 'ความถี่การนำรถไปชาร์จ' : 'ความถี่การใช้งาน'} 
                subtitle="จำนวนภารกิจรายวัน"
              />
              <div className="relative flex-1 min-h-[220px] mt-2 flex items-end">
                {/* เส้น Grid (Y-Axis) */}
                <div className="absolute inset-0 flex flex-col justify-between pb-[26px] pointer-events-none z-0">
                  {[3, 2, 1, 0].map((i) => (
                    <div key={i} className="flex items-center w-full h-[1px]">
                      <span className="text-[10px] text-[#aeaeb2] w-[20px] font-medium">{i === 0 ? 0 : Math.ceil((maxTrend / 3) * i)}</span>
                      <div className={`flex-1 border-t ${i === 0 ? 'border-solid border-[#c7c7cc]' : 'border-dashed border-[rgba(0,0,0,0.06)]'} ml-2`}></div>
                    </div>
                  ))}
                </div>
                
                {/* ข้อมูลกราฟ พร้อม Interactive Tooltip */}
                <div className="relative z-10 flex w-full h-full justify-between items-end pl-[28px] pb-1 overflow-x-auto st gap-1">
                  {analytics.dailyTrend.length === 0 ? (
                    <p className="text-[13px] text-[#aeaeb2] m-auto pb-8">ไม่มีข้อมูล</p>
                  ) : (
                    analytics.dailyTrend.map((d, i) => {
                      const pct = maxTrend > 0 ? (d.val / maxTrend) * 100 : 0;
                      return (
                        <div key={i} className="group relative flex-1 flex flex-col items-center justify-end h-full min-w-[36px] hover:bg-black/[0.02] rounded-[8px] transition-colors cursor-pointer py-1">
                          
                          {/* 📌 Hover Tooltip */}
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none z-50 bg-[#4b1560] text-white text-[11px] px-2.5 py-1.5 rounded-[8px] whitespace-nowrap shadow-lg transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 flex flex-col items-center">
                             <span className="font-semibold text-[12px]">{d.val} ครั้ง</span>
                             <span className="text-white/70 text-[10px]">{d.label}</span>
                             <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#4b1560]"></div>
                          </div>

                          {/* ตัวเลขบนแท่ง */}
                          <span className={`text-[12px] font-bold mb-1.5 transition-all ${d.val > 0 ? 'text-[#4b1560] group-hover:text-[#702082]' : 'text-transparent'}`}>
                            {d.val}
                          </span>
                          
                          {/* Container แท่งกราฟ */}
                          <div className="flex flex-col justify-end items-center w-full h-[calc(100%-36px)]">
                             <div className="w-full max-w-[28px] rounded-t-[4px] transition-all duration-500 shadow-sm group-hover:brightness-110 group-hover:scale-y-[1.03] origin-bottom"
                                  style={{
                                    height: `${pct}%`, 
                                    background: 'linear-gradient(180deg, #34aadc 0%, #702082 100%)',
                                    minHeight: d.val > 0 ? '4px' : '0'
                                  }}
                             />
                          </div>
                          
                          {/* ป้ายแกน X */}
                          <span className="text-[11px] font-medium text-[#8e8e93] mt-2 whitespace-nowrap group-hover:text-[#4b1560] transition-colors">
                             {d.label.split(' ')[0]}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </Card>

            {/* กราฟ 2: รายชั่วโมง */}
            <Card className="p-5 flex flex-col">
              <SectionLabel 
                icon="ph:clock-duotone" 
                iconColor="text-[#ff9f0a]"
                title="ช่วงเวลาหนาแน่น" 
                subtitle="รายชั่วโมง"
              />
              <div className="relative flex-1 min-h-[220px] mt-2 flex items-end">
                {/* เส้น Grid (Y-Axis) */}
                <div className="absolute inset-0 flex flex-col justify-between pb-[26px] pointer-events-none z-0">
                  {[3, 2, 1, 0].map((i) => (
                    <div key={i} className="flex items-center w-full h-[1px]">
                      <span className="text-[10px] text-[#aeaeb2] w-[20px] font-medium">{i === 0 ? 0 : Math.ceil((maxHourly / 3) * i)}</span>
                      <div className={`flex-1 border-t ${i === 0 ? 'border-solid border-[#c7c7cc]' : 'border-dashed border-[rgba(0,0,0,0.06)]'} ml-2`}></div>
                    </div>
                  ))}
                </div>

                {/* ข้อมูลกราฟ พร้อม Interactive Tooltip */}
                <div className="relative z-10 flex w-full h-full justify-between items-end pl-[28px] pb-1 overflow-x-auto st gap-[2px]">
                  {analytics.hourlyTrend.length === 0 ? (
                    <p className="text-[13px] text-[#aeaeb2] m-auto pb-8">ไม่มีข้อมูล</p>
                  ) : (
                    analytics.hourlyTrend.map((d, i) => {
                      const pct = maxHourly > 0 ? (d.val / maxHourly) * 100 : 0;
                      const isPeak = pct > 65;
                      return (
                        <div key={i} className="group relative flex-1 flex flex-col items-center justify-end h-full min-w-[20px] hover:bg-black/[0.02] rounded-[6px] transition-colors cursor-pointer py-1">
                          
                          {/* 📌 Hover Tooltip */}
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none z-50 bg-[#4b1560] text-white text-[11px] px-2.5 py-1.5 rounded-[8px] whitespace-nowrap shadow-lg transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 flex flex-col items-center">
                             <span className="font-semibold text-[12px]">{d.val} ครั้ง</span>
                             <span className="text-white/70 text-[10px]">เวลา {d.label}</span>
                             <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#4b1560]"></div>
                          </div>

                          {/* ตัวเลขบนแท่ง */}
                          <span className={`text-[10px] sm:text-[11px] font-bold mb-1.5 transition-all ${d.val > 0 ? (isPeak ? 'text-[#ff3b30] group-hover:brightness-125' : 'text-[#34c759] group-hover:brightness-110') : 'text-transparent'}`}>
                            {d.val}
                          </span>
                          
                          {/* Container แท่งกราฟ */}
                          <div className="flex flex-col justify-end items-center w-full h-[calc(100%-36px)]">
                             <div className="w-full max-w-[14px] rounded-t-[3px] transition-all duration-500 shadow-sm group-hover:brightness-110 group-hover:scale-y-[1.05] origin-bottom"
                                  style={{
                                    height: `${pct}%`, 
                                    background: isPeak ? 'linear-gradient(180deg, #ff6961 0%, #ff3b30 100%)' : 'linear-gradient(180deg, #30d158 0%, #34c759 100%)',
                                    minHeight: d.val > 0 ? '2px' : '0'
                                  }}
                             />
                          </div>
                          
                          {/* ป้ายแกน X */}
                          <span className="text-[9px] font-medium text-[#8e8e93] mt-2 whitespace-nowrap group-hover:text-[#4b1560] transition-colors">
                            {i % 4 === 0 || i === 23 ? d.label.split(':')[0] : ''}
                          </span>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* ── ✅ กล่องค้นหาประวัติ โค้งมนสมบูรณ์ (Rounded Box) ── */}
          <Card className="fu overflow-hidden rounded-[24px]" style={{animationDelay:'150ms', boxShadow:'0 4px 24px rgba(0,0,0,0.06)'}}>
            <div className="px-5 md:px-7 py-6 bg-white">
                <SectionLabel 
                    icon="ph:magnifying-glass-duotone" 
                    iconColor="text-[#702082]"
                    title="ค้นหาประวัติการใช้งานแบบละเอียด" 
                    subtitle="สืบค้นข้อมูลทริปการเดินทางตามเงื่อนไขที่ต้องการ"
                />
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mt-4">
                    {['date', 'plate', 'name', 'dept', 'job', 'location'].map(f => (
                        <div key={f} className="min-w-0 w-full">
                           {renderField(
                               f, 
                               { date: 'วันที่ (ระบุเฉพาะวัน)', plate: 'ทะเบียนรถ', name: 'ชื่อ/ตำแหน่ง', dept: 'แผนก', job: 'ประเภทงาน', location: 'สถานที่' }[f], 
                               { date: [], plate: uniquePlates, name: uniqueNames, dept: uniqueDepts, job: uniqueJobs, location: uniqueLocs }[f], 
                               { date: 'ph:calendar-blank-duotone', plate: 'ph:car-profile-duotone', name: 'ph:user-duotone', dept: 'ph:buildings-duotone', job: 'ph:briefcase-duotone', location: 'ph:map-pin-duotone' }[f], 
                               f === 'date' ? 'date' : 'select'
                           )}
                        </div>
                    ))}
                </div>
                
                <div className="mt-6 pt-5 border-t border-[rgba(0,0,0,0.05)] flex justify-between items-center">
                     <button onClick={() => setQueryFilters({ plate: '', date: '', name: '', dept: '', job: '', location: '' })} 
                             className="px-4 py-2 text-[13px] font-medium text-[#ff3b30] hover:bg-[#fff0f0] rounded-[14px] transition-colors">
                         ล้างค่าทั้งหมด
                     </button>
                     <button onClick={handleExecuteQuery} className="flex items-center gap-1.5 px-6 py-2.5 bg-[#702082] hover:bg-[#0077ed] text-white text-[14px] font-medium rounded-[14px] shadow-sm transition-all active:scale-95">
                         <Icon icon="ph:magnifying-glass-duotone" width="18" height="18" /> ค้นหาข้อมูล
                     </button>
                </div>
            </div>
          </Card>

          <Card className="fu" style={{animationDelay:'180ms'}}>
            <div className="px-4 md:px-6 py-5 border-b border-[rgba(0,0,0,0.05)] flex flex-col md:flex-row md:items-baseline justify-between gap-2">
              <SectionLabel title="รายงานสรุปรายคัน" subtitle="ระยะทาง เชื้อเพลิง และประสิทธิภาพ" />
            </div>
            <div className="overflow-x-auto st">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-[rgba(0,0,0,0.05)]">
                    {['ทะเบียน / รุ่น','สถานะ','ภารกิจ','ระยะทาง','เชื้อเพลิง', carCategoryFilter === 'ev' ? 'ระยะทาง/ชาร์จ' : 'ประสิทธิภาพ', 'รายการซ่อม', 'ค่าซ่อม'].map(h=>(
                      <th key={h} className="px-4 md:px-6 py-3 text-left text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.05em] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analytics.fleetTable.map((c,i)=>(
                    <tr key={i} className="border-b border-[rgba(0,0,0,0.04)] last:border-0 transition-colors hover:bg-[#f9f9fb]">
                      <td className="px-4 md:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-[11px] flex items-center justify-center flex-shrink-0"
                               style={{background:c.type==='EV'?'#edfbf0':'#fff4e0'}}>
                            <Icon icon={c.type==='EV' ? "ph:lightning-duotone" : "ph:gas-pump-duotone"} width="20" height="20" className={c.type==='EV' ? 'text-[#1a7f37]' : 'text-[#e67e22]'} />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-[#4b1560] leading-tight whitespace-nowrap">{c.plate}</p>
                            <p className="text-[11px] text-[#aeaeb2] whitespace-nowrap">{c.model}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-[5px] rounded-full whitespace-nowrap ${
                          c.status==='available'?'bg-[rgba(52,199,89,0.12)] text-[#1a7f37]':'bg-[rgba(255,59,48,0.10)] text-[#d70015]'
                        }`}>
                          <span className={`w-[6px] h-[6px] rounded-full ${c.status==='available'?'bg-[#34c759]':'bg-[#ff3b30] animate-pulse'}`}/>
                          {c.status==='available'?'ว่าง':'ใช้งาน'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 text-[14px] font-semibold text-[#4b1560] whitespace-nowrap">{c.trips}<span className="text-[11px] font-normal text-[#765c7c] ml-1">รอบ</span></td>
                      <td className="px-4 md:px-6 py-4 text-[14px] font-semibold text-[#4b1560] whitespace-nowrap">{c.dist.toLocaleString()}<span className="text-[11px] font-normal text-[#765c7c] ml-1">กม.</span></td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        {c.type==='EV'
                          ? <span className="text-[12px] font-medium text-[#702082] flex items-center gap-1"><Icon icon="ph:lightning-duotone" /> {c.refillCount} ครั้ง</span>
                          : <div>
                              <span className="text-[13px] font-medium text-[#4b1560]">{c.fuelLiters.toFixed(1)} L</span>
                              {c.fuelCost>0 && <span className="text-[11px] text-[#765c7c] ml-2">฿{c.fuelCost.toLocaleString(undefined,{minimumFractionDigits:0})}</span>}
                            </div>
                        }
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        {c.type==='EV'
                          ? <span className="text-[13px] font-semibold text-[#1a7f37]">{c.trips > 0 ? (c.dist / c.trips).toFixed(1) : 0}<span className="text-[10px] font-normal text-[#765c7c] ml-1">กม./ครั้ง</span></span>
                          : <div className="flex flex-col">
                              <span className="text-[13px] font-semibold text-[#4b1560]">{c.efficiency}<span className="text-[10px] font-normal text-[#765c7c] ml-1">บ./กม.</span></span>
                              <span className="text-[11px] text-[#765c7c] mt-0.5">{c.efficiencyLKM} ลิตร/กม.</span>
                            </div>
                        }
                      </td>
                      
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        {c.repairCount > 0 ? (
                          <span className="text-[13px] font-medium text-[#d70015] flex items-center gap-1">
                            <Icon icon="ph:wrench-duotone" width="16" height="16" /> {c.repairCount} ครั้ง
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#aeaeb2]">-</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 fu" style={{animationDelay:'240ms'}}>
            <Card className="p-5">
              <SectionLabel 
                icon="ph:map-pin-duotone" 
                iconColor="text-[#ff3b30]"
                title={carCategoryFilter === 'ev' ? 'สถานีชาร์จยอดนิยม' : 'ปลายทางยอดนิยม'} 
              />
              <div className="space-y-3.5 max-h-[240px] overflow-y-auto st pr-2">
                {analytics.topLocations.length===0
                  ? <p className="text-[12px] text-[#aeaeb2] text-center py-6">ไม่มีข้อมูล</p>
                  : analytics.topLocations.map((loc,i)=>(
                    <div key={i} className="flex items-center gap-3.5">
                      <span className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                            style={{background:['#ff9500','#aeaeb2','#d9cadd'][i]||'#eadfed', color:i>=2?'#765c7c':'white'}}>
                        {i+1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1.5">
                          <span className="text-[13px] font-medium text-[#4b1560] truncate">{loc.name}</span>
                          <span className="text-[12px] text-[#765c7c] ml-3 flex-shrink-0">{loc.count} ครั้ง</span>
                        </div>
                        <div className="h-[5px] bg-[#f8f3fa] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                               style={{width:`${(loc.count/maxLoc)*100}%`, background:i===0?'linear-gradient(90deg,#ff9500,#ffcc00)':'linear-gradient(90deg,#702082,#34aadc)'}}/>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </Card>

            <Card className="p-5">
              <SectionLabel 
                icon="ph:trophy-duotone" 
                iconColor="text-[#ffcc00]" 
                title="รถยอดนิยม" 
              />
              <div className="max-h-[240px] overflow-y-auto st pr-2">
                {analytics.fleetTable.filter(c=>c.dist>0 || c.trips>0).map((c,i)=>(
                  <div key={i} className="flex flex-col py-3 border-b border-[rgba(0,0,0,0.04)] last:border-0">
                    <div className="flex items-center gap-3.5">
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-bold"
                           style={{
                             background: i===0 ? 'linear-gradient(135deg,#ffcc00,#ff9500)' : i===1 ? 'linear-gradient(135deg,#d9cadd,#aeaeb2)' : i===2 ? 'linear-gradient(135deg,#f4a460,#cd853f)' : '#f8f3fa',
                             color: i<=2 ? 'white' : '#765c7c'
                           }}>
                        {i+1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#4b1560] truncate">{c.plate}</p>
                        <p className="text-[11px] text-[#aeaeb2] truncate">{c.model}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[14px] font-semibold text-[#4b1560]">{c.dist.toLocaleString()} <span className="text-[10px] font-normal text-[#765c7c]">กม.</span></p>
                        <p className="text-[11px] text-[#aeaeb2]">{c.trips} รอบ</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-[46px] mt-1.5">
                      {c.workTypes && c.workTypes !== '' ? c.workTypes.split(', ').map((wt,idx)=>(
                        <span key={`wt-${idx}`} className="text-[10px] text-[#765c7c] bg-[#f8f3fa] px-2.5 py-[3px] rounded-full flex items-center gap-1"><Icon icon="ph:briefcase-duotone"/> {wt}</span>
                      )) : null}
                      {c.areas && c.areas !== '' ? c.areas.split(', ').map((ar,idx)=>(
                        <span key={`ar-${idx}`} className="text-[10px] text-[#702082] bg-[#edf6ff] px-2.5 py-[3px] rounded-full flex items-center gap-1"><Icon icon="ph:map-pin-duotone"/> {ar}</span>
                      )) : null}
                    </div>
                  </div>
                ))}
                {analytics.fleetTable.filter(c=>c.dist>0 || c.trips>0).length===0 && (
                  <p className="text-[12px] text-[#aeaeb2] text-center py-6">ยังไม่มีรถออกวิ่ง</p>
                )}
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 fu" style={{animationDelay:'260ms'}}>
            <Card className="p-5">
              <SectionLabel 
                icon="ph:steering-wheel-duotone" 
                iconColor="text-[#8b3c98]"
                title="ผู้ขับดีเด่น" 
              />
              <div className="max-h-[240px] overflow-y-auto st space-y-0">
                {analytics.driverStats.map((d,i)=>(
                  <div key={i} className="py-3 border-b border-[rgba(0,0,0,0.04)] last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold"
                             style={{
                               background:i===0?'linear-gradient(135deg,#ffcc00,#ff9500)':i===1?'linear-gradient(135deg,#d9cadd,#aeaeb2)':i===2?'linear-gradient(135deg,#f4a460,#cd853f)':'#f8f3fa',
                               color:i<=2?'white':'#765c7c'
                             }}>
                          {i+1}
                        </div>
                        <div>
                          <span className="text-[14px] font-semibold text-[#4b1560] block leading-tight">{d.name}</span>
                          {d.carsUsed && <span className="text-[10px] text-[#aeaeb2]">{d.carsUsed}</span>}
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end">
                        <span className="text-[13px] font-semibold text-[#4b1560]">{d.dist.toLocaleString()} <span className="text-[10px] font-normal text-[#765c7c]">กม.</span></span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-[34px]">
                      {d.workTypes && d.workTypes !== '' ? d.workTypes.split(', ').map((wt,idx)=>(
                        <span key={`wt-${idx}`} className="text-[10px] text-[#765c7c] bg-[#f8f3fa] px-2.5 py-[3px] rounded-full flex items-center gap-1"><Icon icon="ph:briefcase-duotone"/> {wt}</span>
                      )) : <span className="text-[10px] text-[#aeaeb2]">ไม่มีข้อมูลงาน</span>}
                      {d.areas && d.areas !== '' ? d.areas.split(', ').map((ar,idx)=>(
                        <span key={`ar-${idx}`} className="text-[10px] text-[#702082] bg-[#edf6ff] px-2.5 py-[3px] rounded-full flex items-center gap-1"><Icon icon="ph:map-pin-duotone"/> {ar}</span>
                      )) : null}
                    </div>
                  </div>
                ))}
                {analytics.driverStats.length===0 && <p className="text-[12px] text-[#aeaeb2] text-center py-6">ไม่มีข้อมูล</p>}
              </div>
            </Card>

            <Card className="p-5">
              <SectionLabel 
                icon={carCategoryFilter === 'ev' ? "ph:plug-duotone" : "ph:magnifying-glass-duotone"} 
                iconColor="text-[#34c759]" 
                title={carCategoryFilter === 'ev' ? 'ใครนำรถไปชาร์จ' : 'ใครขับคันไหน'} 
              />
              <div className="max-h-[240px] overflow-y-auto st space-y-0">
                {analytics.carDriverHistory.map((c,i)=>(
                  <div key={i} className="py-3 border-b border-[rgba(0,0,0,0.04)] last:border-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[14px] font-semibold text-[#4b1560]">{c.plate}</span>
                      <span className="text-[11px] text-[#765c7c] bg-[#f8f3fa] px-2.5 py-[3px] rounded-full">{c.totalTrips} งาน</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.drivers.split(', ').map((dl,idx)=>(
                        <span key={idx} className="text-[10px] text-[#765c7c] bg-[#f8f3fa] px-2.5 py-[3px] rounded-full">{dl}</span>
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
    </>
  )
}
