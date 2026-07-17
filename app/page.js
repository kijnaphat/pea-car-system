'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useSearchParams, useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import PageSkeleton from '@/app/components/PageSkeleton'

const BANNER_SLIDE_COUNT = 4

// --- Main Component ---
export default function App() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f3fa] flex items-center justify-center"><div className="w-8 h-8 border-[2.5px] border-[#d9cadd] border-t-[#4b1560] rounded-full animate-spin"/></div>}>
      <MainApp />
    </Suspense>
  )
}
function MainApp() {
  const searchParams = useSearchParams()
  const carId = searchParams.get('car_id') 

  // 1. ถ้ามี car_id -> ไปหน้าฟอร์ม
  if (carId) {
    return <CarActionForm carId={carId} />
  }

  // 2. ถ้าไม่มี -> ไปหน้า Home
  return <CarSelector />
}

// ==========================================
// 1. หน้าแสดงผล (Home)
// ==========================================
function CarSelector() {
  const router = useRouter()
  const [cars, setCars] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInstructions, setShowInstructions] = useState(false)
  const [activeBanner, setActiveBanner] = useState(0)
  const [activeNews, setActiveNews] = useState(0)
  const [selectedNews, setSelectedNews] = useState(null)
  const [newsExpanded, setNewsExpanded] = useState(true)
  const bannerViewportRef = useRef(null)
  const bannerRef = useRef(null)
  const bannerPositionRef = useRef(1)
  const bannerTouchStartRef = useRef(null)
  const newsRef = useRef(null)
  
  // State สำหรับ Modal โทรออก
  const [callModal, setCallModal] = useState({ isOpen: false, driverName: '', phone: '', loading: false, error: '' })
  
  // 🌟 State สำหรับ Modal รายละเอียดรถ
  const [carDetailModal, setCarDetailModal] = useState(null)

  const fetchCars = async () => {
    try {
      const { data: carsDataRaw } = await supabase.from('cars').select('*')
      const { data: activeLogs } = await supabase
        .from('trip_logs')
        .select('car_id, start_time, driver_name, location') // ดึง location ด้วย
        .eq('is_completed', false)

      if (carsDataRaw) {
        // กรองรถที่ถูกซ่อนออกไป
        const carsData = carsDataRaw.filter(car => car.is_visible !== false)

        const activatedResults = await Promise.all(
          carsData.map(async (car) => {
            const { count } = await supabase
              .from('trip_logs')
              .select('car_id', { count: 'exact', head: true })
              .eq('car_id', Number(car.id))

            let lastLog = null
            if (car.status !== 'busy') {
              const { data } = await supabase
                .from('trip_logs')
                .select('*')
                .eq('car_id', Number(car.id))
                .eq('is_completed', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
              if (data) lastLog = data
            }

            return { count, lastLog }
          })
        )

        const mergedCars = carsData.map((car, i) => {
          const log = activeLogs?.find(l => Number(l.car_id) === Number(car.id))
          const isActivated = (activatedResults[i]?.count ?? 0) > 0
          const lastLog = activatedResults[i]?.lastLog
          return { ...car, activeLog: log, lastLog, isActivated }
        })

        const driverNames = mergedCars
          .map(c => c.status === 'busy' ? c.activeLog?.driver_name : c.lastLog?.driver_name)
          .filter(Boolean);
        const uniqueDrivers = [...new Set(driverNames)];
        
        let staffMap = {};
        if (uniqueDrivers.length > 0) {
          const { data: staffData } = await supabase
            .from('staff')
            .select('full_name, position')
            .in('full_name', uniqueDrivers);
          
          if (staffData) {
            staffData.forEach(s => staffMap[s.full_name] = s.position);
          }
        }

        const finalCars = mergedCars.map(car => {
          const dName = car.status === 'busy' ? car.activeLog?.driver_name : car.lastLog?.driver_name;
          return { ...car, driverPosition: dName ? staffMap[dName] : null };
        });

        finalCars.sort((a, b) => {
            if (a.status === 'busy' && b.status !== 'busy') return -1 
            if (a.status !== 'busy' && b.status === 'busy') return 1  
            return a.plate_number.localeCompare(b.plate_number)
        })

        setCars(finalCars)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const moveBannerTo = (position, animate = true) => {
    const viewport = bannerViewportRef.current
    const track = bannerRef.current
    const item = track?.children[position]
    if (!viewport || !track || !item) return

    const centeredOffset = item.offsetLeft - (viewport.clientWidth - item.offsetWidth) / 2
    track.style.transition = animate ? 'transform 560ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none'
    track.style.transform = `translate3d(${-centeredOffset}px, 0, 0)`
    track.style.opacity = '1'
    bannerPositionRef.current = position
    setActiveBanner((position - 1 + BANNER_SLIDE_COUNT) % BANNER_SLIDE_COUNT)
  }

  useEffect(() => {
    fetchCars()
    const interval = setInterval(fetchCars, 5000) 
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (loading) return

    const placeBanner = () => moveBannerTo(bannerPositionRef.current, false)
    const frame = requestAnimationFrame(placeBanner)
    window.addEventListener('resize', placeBanner)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', placeBanner)
    }
  }, [loading])

  useEffect(() => {
    if (loading) return

    const interval = setInterval(() => {
      const track = bannerRef.current
      if (!track) return

      let nextPosition = bannerPositionRef.current + 1
      if (nextPosition >= track.children.length) {
        moveBannerTo(1, false)
        nextPosition = 2
      }
      moveBannerTo(nextPosition, true)
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [loading])

  // ฟังก์ชันคลิกปุ่มโทร
  const handleCallClick = async (e, driverName) => {
    if (e) e.stopPropagation();
    setCallModal({ isOpen: true, driverName, phone: '', loading: true, error: '' });
    try {
        const { data, error } = await supabase.from('staff').select('phone').eq('full_name', driverName).single();
        if (data && data.phone) {
            setCallModal({ isOpen: true, driverName, phone: data.phone, loading: false, error: '' });
        } else {
            setCallModal({ isOpen: true, driverName, phone: '', loading: false, error: 'ไม่พบเบอร์โทรศัพท์ในระบบ' });
        }
    } catch (err) {
        setCallModal({ isOpen: true, driverName, phone: '', loading: false, error: 'เกิดข้อผิดพลาดในการค้นหาเบอร์โทร' });
    }
  }

  const getCarImage = (car) => {
    const type = car.car_type || ''
    if (car.car_type?.toUpperCase() === 'รถ EV') return '/mg.png'
    if (car.car_type?.toUpperCase() === 'รถ EV ทดเเทน') return '/mg2.png'
    if (type.startsWith('รถกระเช้า')) return '/aerial_lift.png'
    if (type.startsWith('รถบรรทุก 2 ตันเเก้ไฟ')) return '/2_ton_truck.png'
    if (type.startsWith('รถเครน')) return '/crane.png'
    if (type.startsWith('รถตู้โดยสาร') || type.startsWith('รถตู้')) return '/van.png'
    if (type.startsWith('รถกระบะ')) return '/truck.png'
    if (type.startsWith('รถบรรทุก 2')) return '/2ton.png'
    if (type.startsWith('รถบรรทุก 1 ตันแก้ไฟ')) return '/1ton.png'
    if (type.startsWith('รถบรรทุก 6 ตัน ฮอทไลน์')) return '/hotline.png'
    if (type.startsWith('รถบรรทุกขุดเจาะ')) return '/3ton.png'
    if (type.startsWith('รถบรรทุก 7.5 ตัน ติดเครนแข็ง')) return '/75ton.png'
    if (type.startsWith('รถบรรทุก 6 ล้อ')) return '/hotline_6.png'
    if (type.startsWith('รถบรรทุก 6 ตัน')) return '/6ton.png'
    if (type.startsWith('รถบรรทุก 3 ตันส่วนบุคคล')) return '/3ton_2.png'
    if (type.startsWith('TEST_CAR')) return '/scooter.png'
    return null 
  }

  if (loading) return <PageSkeleton variant="home" />

  const busyCars = cars.filter(c => c.status === 'busy')
  const availableCars = cars.filter(c => c.status !== 'busy')
  const activeCars = cars.filter(c => c.isActivated)
  const evCars = cars.filter(c => c.fuel_type?.toUpperCase() === 'EV' || c.car_type?.toUpperCase().includes('EV'))
  const today = new Date()
  const signatureStart = today.getDate() <= 5
    ? new Date(today.getFullYear(), today.getMonth() - 1, 28)
    : new Date(today.getFullYear(), today.getMonth(), 28)
  const signatureEnd = today.getDate() <= 5
    ? new Date(today.getFullYear(), today.getMonth(), 5)
    : new Date(today.getFullYear(), today.getMonth() + 1, 5)
  const formatThaiDate = (date) => date.toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' })
  const signaturePeriod = `${formatThaiDate(signatureStart)} – ${formatThaiDate(signatureEnd)}`
  const signatureDeadline = formatThaiDate(signatureEnd)
  const signatureMonth = signatureStart.toLocaleDateString('th-TH', { month:'long', year:'numeric' })
  const bannerSlides = [
    { eyebrow:'PEA FLEET', title:'ระบบรถ PEA ใหม่!', accent:'จัดการง่ายกว่าเดิม', button:'ดูคู่มือเลย !!', icon:'ph:car-profile-duotone', background:'linear-gradient(115deg,#4b156d 0%,#762789 58%,#9139a6 100%)', iconBg:'#ffdd00', iconColor:'#4b156d', guideType:'overview' },
    { eyebrow:'SCAN & GO', title:'สแกนก่อนใช้รถ', accent:'บันทึกได้ในไม่กี่ขั้นตอน', button:'ดูวิธีสแกน', icon:'ph:qr-code-duotone', background:'linear-gradient(115deg,#5a1f75 0%,#7f2b8f 55%,#a34db0 100%)', iconBg:'#ffdd00', iconColor:'#571b70', detailIndex:1 },
    { eyebrow:'MONTHLY SIGN', title:'ลงชื่อประจำเดือน', accent:signaturePeriod, button:'ดูรายละเอียด', icon:'ph:pencil-line-duotone', background:'linear-gradient(115deg,#40155f 0%,#69277e 55%,#8d3fa1 100%)', iconBg:'#ffea5c', iconColor:'#4b156d', detailIndex:0 },
    { eyebrow:'PEA SAFETY', title:'ตรวจรถก่อนออกงาน', accent:'ปลอดภัยทุกเส้นทาง', button:'รายการตรวจรถ', icon:'ph:shield-check-duotone', background:'linear-gradient(115deg,#55206f 0%,#7c2f8d 56%,#963ca7 100%)', iconBg:'#ffdd00', iconColor:'#4b156d', detailIndex:2 }
  ]
  const loopedBannerSlides = [bannerSlides[bannerSlides.length - 1], ...bannerSlides, bannerSlides[0], bannerSlides[1]]
  const newsItems = [
    {
      title:'ลงชื่อประจำเดือน', badge:'สำคัญ', icon:'ph:pencil-line-duotone', iconBg:'#f1e6f4', iconColor:'#702082',
      copy:`เปิดลงชื่อรับรองการใช้รถรอบเดือน${signatureMonth} ตั้งแต่ ${signaturePeriod} กรุณาดำเนินการให้ครบภายใน ${signatureDeadline}`, meta:'ระบบลงชื่อผู้ใช้งานรถ', period:`รอบเดือน${signatureMonth} · ${signaturePeriod}`,
      detail:`การลงชื่อประจำเดือนรอบ ${signatureMonth} เปิดตั้งแต่ ${signaturePeriod} เพื่อยืนยันความถูกต้องของประวัติการใช้รถ ผู้ขับและผู้ควบคุมควรตรวจสอบรายการเดินทาง เลขไมล์ และข้อมูลการรับ–คืนรถก่อนลงชื่อทุกครั้ง ระบบจะคำนวณรอบเดือนและเปลี่ยนวันที่ให้อัตโนมัติ`,
      steps:['เปิดรายงานของรถคันที่รับผิดชอบ',`ตรวจสอบรายการเดินทางและเลขไมล์รอบเดือน${signatureMonth}`,`ลงชื่อผู้ขับรถและผู้ควบคุมให้ครบภายใน ${signatureDeadline}`,'ตรวจสอบสถานะว่าบันทึกลายเซ็นสำเร็จแล้ว'],
      note:`หากข้อมูลการเดินทางไม่ถูกต้อง ให้แจ้งผู้ดูแลระบบก่อนหมดเขต ${signatureDeadline}`
    },
    {
      title:'สแกน QR ประจำรถ', badge:'Hot !', icon:'ph:qr-code-duotone', iconBg:'#fff7bf', iconColor:'#702082',
      copy:'สแกน QR Code ก่อนนำรถออก คืนรถ หรือชาร์จรถทุกครั้ง เพื่ออัปเดตสถานะให้ถูกต้อง', meta:'คู่มือการใช้งาน', period:'ใช้งานทุกครั้งก่อนและหลังใช้รถ',
      detail:'QR Code ของรถแต่ละคันเชื่อมกับข้อมูลรถโดยตรง ช่วยลดการเลือกทะเบียนผิดและทำให้สถานะรถบนหน้า Home เป็นปัจจุบัน',
      steps:['เปิดกล้องหรือหน้าเครื่องสแกน QR','สแกน QR Code ที่ติดอยู่กับรถ','ตรวจสอบทะเบียนรถและชื่อผู้ใช้งาน','กรอกข้อมูลนำรถออก คืนรถ หรือเริ่ม–หยุดชาร์จให้ครบ'],
      note:'ห้ามใช้ QR Code ของรถคันอื่นแทน แม้เป็นรถประเภทเดียวกัน'
    },
    {
      title:'ตรวจรถก่อนออกงาน', badge:'Safety', icon:'ph:shield-check-duotone', iconBg:'#f1e6f4', iconColor:'#702082',
      copy:'ตรวจยาง ไฟส่องสว่าง น้ำมัน และอุปกรณ์ประจำรถก่อนออกปฏิบัติงานทุกครั้ง', meta:'มาตรฐานความปลอดภัย PEA', period:'ตรวจทุกครั้งก่อนนำรถออก',
      detail:'ผู้ขับควรตรวจสภาพพื้นฐานก่อนออกปฏิบัติงาน เพื่อป้องกันอุบัติเหตุและลดความเสียหายระหว่างเดินทาง',
      steps:['ตรวจยาง ลมยาง และร่องรอยการรั่วซึม','ตรวจไฟหน้า ไฟเลี้ยว ไฟเบรก และสัญญาณเตือน','ตรวจระดับเชื้อเพลิงหรือแบตเตอรี่ EV','ตรวจอุปกรณ์นิรภัยและอุปกรณ์ประจำรถ'],
      note:'หากพบความผิดปกติให้งดใช้รถ และแจ้งผู้ดูแลรถทันที'
    },
    {
      title:'คืนรถให้เรียบร้อย', badge:'แจ้งเตือน', icon:'ph:car-profile-duotone', iconBg:'#fff7bf', iconColor:'#702082',
      copy:'จอดรถในพื้นที่ที่กำหนด เก็บกุญแจ และบันทึกเลขไมล์ล่าสุดก่อนจบรายการ', meta:'การคืนรถและปิดงาน', period:'ดำเนินการทันทีหลังจบภารกิจ',
      detail:'การคืนรถอย่างครบถ้วนทำให้รถพร้อมสำหรับผู้ใช้งานคนถัดไป และช่วยให้รายงานระยะทาง เชื้อเพลิง และสถานะรถถูกต้อง',
      steps:['จอดรถในช่องที่กำหนดและดับเครื่อง','เก็บสัมภาระและตรวจความเรียบร้อยภายในรถ','บันทึกเลขไมล์ เชื้อเพลิง หรือแบตเตอรี่ล่าสุด','สแกน QR เพื่อยืนยันคืนรถและนำกุญแจเก็บที่จุดรับคืน'],
      note:'ตรวจสอบว่าหน้า Home แสดงสถานะ “ว่างพร้อมใช้” ก่อนออกจากพื้นที่'
    }
  ]
  const systemOverviewGuide = {
    title:'ระบบรถ PEA ทำอะไรได้บ้าง?', badge:'คู่มือ', icon:'ph:car-profile-duotone',
    period:'คู่มือภาพรวมสำหรับผู้ใช้งาน PEA FLEET',
    kicker:'คู่มือระบบรถ PEA',
    sectionTitle:'ฟังก์ชันที่ใช้งานได้',
    detail:'เว็บแอป PEA FLEET ช่วยให้ผู้ใช้งานตรวจสอบและจัดการรถส่วนกลางได้จากหน้าเดียว ตั้งแต่เลือกดูรถที่ว่าง บันทึกการนำรถออก ไปจนถึงคืนรถและติดตามข้อมูลการใช้งานให้เป็นปัจจุบัน',
    steps:[
      'ดูจำนวนรถทั้งหมด พร้อมสถานะว่าง กำลังใช้งาน และรถ EV แบบเรียลไทม์',
      'ค้นหาและดูรายละเอียดรถ เช่น ทะเบียน ประเภทรถ ผู้ใช้งานล่าสุด และเวลาอัปเดต',
      'สแกน QR ประจำรถเพื่อบันทึกการนำรถออก คืนรถ หรือเริ่ม–หยุดชาร์จรถ EV',
      'บันทึกผู้ขับ ประเภทงาน พื้นที่ปฏิบัติงาน เลขไมล์ น้ำมัน และระดับแบตเตอรี่',
      'ตรวจสอบประวัติการเดินทาง รายงานการใช้รถ และลงชื่อรับรองประจำเดือน'
    ],
    note:'เลือกเมนูหรือสแกน QR ที่ติดอยู่กับรถเพื่อเริ่มใช้งาน ระบบจะแสดงแบบฟอร์มให้ตรงกับสถานะของรถโดยอัตโนมัติ'
  }

  const renderCarRow = (car) => {
    const carImageSrc = getCarImage(car)
    const isEV = car.fuel_type?.toUpperCase() === 'EV' || car.car_type?.toUpperCase().includes('EV')
    const isBusy = car.status === 'busy'
    const logData = isBusy ? car.activeLog : car.lastLog
    const driverName = logData?.driver_name
    const returnTime = car.lastLog?.end_time || car.lastLog?.updated_at || car.lastLog?.created_at || car.lastLog?.start_time
    const timeSource = isBusy ? car.activeLog?.start_time : returnTime
    const timeString = timeSource
      ? `${isBusy ? 'ออก' : 'คืน'} ${new Date(timeSource).toLocaleDateString('th-TH', {day:'numeric', month:'short'})} ${new Date(timeSource).toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} น.`
      : null

    return (
      <article key={car.id} onClick={() => setCarDetailModal({ car, timeString, logData })}
        className="flex items-center gap-3 py-4 border-b border-[#edf0ee] last:border-b-0 cursor-pointer active:bg-[#f8faf8] transition-colors">
        <div className={`w-14 h-14 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border border-black/[0.05] ${isBusy ? 'bg-[#fff0ed]' : isEV ? 'bg-[#edf3ff]' : 'bg-[#eefaf2]'}`}>
          {carImageSrc
            ? <img src={carImageSrc} alt={car.car_type} className={`w-full h-full object-cover ${!car.isActivated ? 'grayscale opacity-40' : ''}`}/>
            : <Icon icon="ph:car-profile-duotone" width="30" height="30" className={isBusy ? 'text-[#ff6680]' : 'text-[#14c767]'} />}
        </div>
        <div className="min-w-0 flex-1">
          <span className={`inline-flex mb-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${isBusy ? 'bg-[#ffe8ed] text-[#ef476f]' : isEV ? 'bg-[#eee8ff] text-[#7258d8]' : 'bg-[#e2f9eb] text-[#109b4b]'}`}>{isBusy ? 'กำลังใช้งาน' : isEV ? 'รถ EV' : 'พร้อมใช้งาน'}</span>
          <h3 className="text-[18px] font-bold tracking-[-.35px] truncate">{car.plate_number}</h3>
          <p className="text-[11px] text-[#6e7771] truncate">{car.car_type}</p>
          <p className="mt-0.5 text-[10px] text-[#9aa19c] truncate flex items-center gap-1"><Icon icon={driverName ? 'ph:user-circle' : 'ph:map-pin'} width="12" height="12" />{driverName || logData?.location || 'ยังไม่มีข้อมูลการใช้งาน'}</p>
        </div>
        <div className="text-right flex-shrink-0 min-w-[92px]">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${isBusy ? 'bg-[#ffe7ee] text-[#ed4d75]' : 'bg-[#dffbec] text-[#10a951]'}`}><span className={`w-1.5 h-1.5 rounded-full ${isBusy ? 'bg-[#ed4d75]' : 'bg-[#17c965]'}`}/>{isBusy ? 'ไม่ว่าง' : 'ว่างพร้อมใช้'}</span>
          <p className="mt-2 text-[9px] text-[#a2a9a4] max-w-[92px] truncate">{timeString || 'อัปเดตล่าสุด'}</p>
          <Icon icon="ph:caret-right-bold" width="16" height="16" className="ml-auto mt-1 text-[#a4aaa6]" />
        </div>
      </article>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8f3fa] font-sarabun pb-28 lg:pb-10 lg:bg-[#f3edf5] text-[#241c27]" style={{WebkitFontSmoothing:'antialiased'}}>
      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
        .animate-slideUp { animation: slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
        @keyframes floatCar { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-5px) rotate(-1deg); } }
        .float-car { animation: floatCar 4s ease-in-out infinite; }
        .hide-scrollbar { scrollbar-width:none; }
        .hide-scrollbar::-webkit-scrollbar { display:none; }
      `}</style>

      <header className="bg-white">
        <div className="max-w-[620px] lg:max-w-[1280px] mx-auto px-5 lg:px-8 pt-3 pb-2 sm:pt-5 sm:pb-3 lg:py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-[12px] sm:rounded-[14px] bg-white border border-[#eadfed] p-1 sm:p-1.5 flex items-center justify-center shadow-sm overflow-hidden"><img src="/pea_logo.png" alt="ตราสัญลักษณ์การไฟฟ้าส่วนภูมิภาค PEA" className="w-full h-full object-contain" /></div>
            <div className="min-w-0"><p className="text-[8px] sm:text-[9px] font-bold text-[#702082] tracking-[.12em]">การไฟฟ้าส่วนภูมิภาค</p><h1 className="text-[17px] sm:text-[21px] font-bold tracking-[-.7px] truncate">สวัสดี ผู้ใช้งาน PEA!</h1></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push('/dashboard')} className="hidden lg:inline-flex items-center gap-2 rounded-full bg-[#f3eaf5] px-4 py-2.5 text-[13px] font-bold text-[#702082] transition-transform hover:-translate-y-0.5" aria-label="เปิดแดชบอร์ด"><Icon icon="ph:chart-pie-slice-duotone" width="19" height="19" />Dashboard</button>
            <a href="https://lin.ee/7xXA4J2" target="_blank" rel="noopener noreferrer" className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-black active:scale-90 transition-transform" aria-label="ติดต่อผ่าน LINE">
              <Icon icon="ph:chat-circle-dots-bold" width="27" height="27" />
              <span className="absolute top-1 right-1 w-3 h-3 rounded-full bg-[#ffdd00] border-2 border-white"/>
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-[620px] lg:max-w-[1280px] mx-auto bg-white overflow-hidden lg:rounded-[30px] lg:shadow-[0_14px_45px_rgba(75,21,96,.10)]">
        <section>
          <div ref={bannerViewportRef}
            onTouchStart={(e) => { bannerTouchStartRef.current = e.touches[0]?.clientX ?? null }}
            onTouchEnd={(e) => {
              if (bannerTouchStartRef.current === null) return
              const endX = e.changedTouches[0]?.clientX ?? bannerTouchStartRef.current
              const distance = bannerTouchStartRef.current - endX
              bannerTouchStartRef.current = null
              if (Math.abs(distance) < 35) return
              const nextPosition = Math.max(0, Math.min(BANNER_SLIDE_COUNT + 1, bannerPositionRef.current + (distance > 0 ? 1 : -1)))
              moveBannerTo(nextPosition, true)
            }}
            className="overflow-hidden touch-pan-y lg:px-6 lg:pt-6">
          <div ref={bannerRef} onTransitionEnd={(e) => {
            if (e.target !== e.currentTarget || e.propertyName !== 'transform') return
            if (bannerPositionRef.current === 0) moveBannerTo(BANNER_SLIDE_COUNT, false)
            if (bannerPositionRef.current === BANNER_SLIDE_COUNT + 1) moveBannerTo(1, false)
          }} className="flex gap-3 px-5 lg:px-0 opacity-0 will-change-transform">
            {loopedBannerSlides.map((slide, index) => (
              <article key={`${slide.title}-${index}`} className="relative overflow-hidden h-[128px] sm:h-[150px] lg:h-[210px] min-w-[90%] sm:min-w-[88%] lg:min-w-full rounded-[19px] sm:rounded-[22px] lg:rounded-[26px] px-5 sm:px-6 lg:px-10 py-3 sm:py-4 lg:py-7 text-white" style={{background:slide.background, boxShadow:'0 8px 24px rgba(73,20,88,.16)'}}>
                <div className="absolute -left-20 -top-20 w-52 h-52 rounded-full border border-white/20"/>
                <div className="absolute -right-12 -bottom-20 w-48 h-48 rounded-full bg-white/10"/>
                <div className="relative z-10 max-w-[70%]">
                  <p className="text-[8px] sm:text-[9px] font-bold tracking-[.16em] text-[#ffea6a] mb-1">{slide.eyebrow}</p>
                  <h2 className="text-[18px] sm:text-[23px] lg:text-[32px] font-bold leading-[1.1] tracking-[-.7px]">{slide.title}<br/><span className="text-[#ffea4d] text-[14px] sm:text-[18px] lg:text-[23px]">{slide.accent}</span></h2>
                  <button onClick={() => setSelectedNews(slide.guideType === 'overview' ? systemOverviewGuide : {...newsItems[slide.detailIndex], index:slide.detailIndex})} className="mt-1.5 sm:mt-2 bg-[#ffdd00] text-[#4b156d] rounded-full px-3.5 sm:px-4 py-1 sm:py-1.5 text-[9px] sm:text-[10px] font-bold active:scale-95 transition-transform inline-flex items-center gap-1.5"><Icon icon="ph:arrow-right-bold" width="11" height="11" />{slide.button}</button>
                </div>
                <div className="absolute right-3 bottom-0 w-[38%] h-full flex items-center justify-center float-car">
                  <div className="w-16 h-16 sm:w-22 sm:h-22 rounded-full shadow-[0_12px_28px_rgba(37,5,49,.3)] flex items-center justify-center rotate-[-5deg]" style={{background:slide.iconBg,color:slide.iconColor}}><Icon icon={slide.icon} width="44" height="44" /></div>
                </div>
              </article>
            ))}
          </div>
          </div>
          <div className="flex justify-center gap-2 py-2 sm:py-2.5 lg:py-4">{bannerSlides.map((slide, index) => <button key={slide.title} onClick={() => moveBannerTo(index + 1, true)} aria-label={`ไปแบนเนอร์หน้า ${index + 1}`} className={`h-1.5 rounded-full transition-all ${activeBanner === index ? 'w-5 sm:w-6 bg-[#702082]' : 'w-1.5 sm:w-2 bg-[#d9cddd]'}`}/>)}</div>
        </section>

        <section className="pb-3 sm:pb-4">
          <div className="flex gap-2 sm:gap-3 overflow-x-auto hide-scrollbar px-5 lg:px-6 pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {[
              {label:'รถทั้งหมด', value:cars.length, sub:'ในระบบ', icon:'ph:car-profile-duotone', accent:'#702082'},
              {label:'พร้อมใช้งาน', value:availableCars.length, sub:'คัน', icon:'ph:check-circle-duotone', accent:'#8b3c98'},
              {label:'กำลังใช้งาน', value:busyCars.length, sub:'คัน', icon:'ph:steering-wheel-duotone', accent:'#d29f00'},
              {label:'รถ EV', value:evCars.length, sub:'คัน', icon:'ph:lightning-duotone', accent:'#702082'}
            ].map(stat => <div key={stat.label} className="min-w-[118px] sm:min-w-[138px] lg:min-w-0 h-[82px] sm:h-[96px] lg:h-[110px] bg-white rounded-[16px] sm:rounded-[19px] p-2.5 sm:p-3 lg:p-4 border border-[#eee3f1]" style={{boxShadow:'0 6px 22px rgba(91,35,104,.08)'}}><div className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[11px] font-bold whitespace-nowrap"><span className="w-5 h-5 sm:w-6 sm:h-6 rounded-[7px] sm:rounded-[8px] bg-[#f5edf7] flex items-center justify-center"><Icon icon={stat.icon} width="14" height="14" style={{color:stat.accent}} /></span>{stat.label}</div><p className="mt-1 sm:mt-1.5 text-[18px] sm:text-[21px] lg:text-[28px] font-bold leading-tight" style={{color:stat.accent}}>{stat.value} <span className="text-[10px] sm:text-[12px]">{stat.sub}</span></p><p className="mt-0.5 text-[8px] sm:text-[10px] text-[#8b7f8e] flex items-center gap-1"><Icon icon="ph:lightning-fill" width="9" height="9" className="text-[#d3a900]"/>PEA Fleet</p></div>)}
          </div>
        </section>

        <section className="relative pt-3 sm:pt-4 pb-4 sm:pb-5 overflow-hidden" style={{background:'linear-gradient(155deg,#fbf6fc 0%,#ead8ef 55%,#ffe97a 140%)'}}>
          <div className="absolute -right-24 bottom-0 w-80 h-80 rounded-full border border-white/35"/>
          <div className="relative px-5 flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2.5 sm:gap-3"><span className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#702082] text-[#ffdd00] flex items-center justify-center"><Icon icon="ph:newspaper-clipping-duotone" width="22" height="22" /></span><div><h2 className="text-[20px] sm:text-[24px] font-bold leading-tight text-[#4b1560]">ข่าวสาร PEA</h2><p className="text-[9px] sm:text-[10px] text-[#765c7c]">เลื่อนเพื่อดูข่าวทั้งหมด 4 เรื่อง</p></div></div>
            <button onClick={() => setNewsExpanded(value => !value)} className="flex items-center gap-1.5 text-[11px] font-bold active:scale-95 transition-transform" aria-expanded={newsExpanded} aria-controls="pea-news-content">
              <span className="w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm">4</span>
              <Icon icon={newsExpanded ? 'ph:caret-up-bold' : 'ph:caret-down-bold'} width="20" height="20" />
            </button>
          </div>
          {newsExpanded && <div id="pea-news-content" className="animate-fadeIn">
          <div ref={newsRef} onScroll={(e) => {
            const track = e.currentTarget
            const center = track.scrollLeft + track.clientWidth / 2
            const items = Array.from(track.children)
            const nearest = items.reduce((best, item, index) => Math.abs((item.offsetLeft + item.offsetWidth / 2) - center) < best.distance ? {index, distance:Math.abs((item.offsetLeft + item.offsetWidth / 2) - center)} : best, {index:0, distance:Infinity})
            setActiveNews(nearest.index)
          }} className="relative flex gap-3 overflow-x-auto snap-x snap-mandatory hide-scrollbar px-5 lg:px-6 pb-2 lg:grid lg:grid-cols-2 lg:overflow-visible">
            {newsItems.map((news, index) => (
              <article key={news.title} className="snap-center min-w-[90%] sm:min-w-[88%] lg:min-w-0 bg-white rounded-[21px] sm:rounded-[25px] px-4 sm:px-5 py-4 sm:py-5 border border-[#eee3f1]" style={{boxShadow:'0 9px 28px rgba(91,35,104,.09)'}}>
                <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3"><div className="flex items-center gap-2 min-w-0"><span className="w-9 h-9 sm:w-10 sm:h-10 rounded-[11px] sm:rounded-[12px] flex items-center justify-center flex-shrink-0" style={{background:news.iconBg,color:news.iconColor}}><Icon icon={news.icon} width="21" height="21" /></span><div className="min-w-0"><span className="block text-[15px] sm:text-[17px] font-bold truncate">{news.title}</span><span className="text-[8px] sm:text-[9px] text-[#919793]">ข่าวที่ {index + 1} จาก 4</span></div></div><span className="bg-[#ffad2f] rounded-full px-2.5 sm:px-3 py-1 text-[9px] sm:text-[10px] font-bold whitespace-nowrap">{news.badge}</span></div>
                <p className="text-[12px] sm:text-[14px] leading-[1.55] sm:leading-[1.65] min-h-[56px] sm:min-h-[70px]">{news.copy}</p>
                <button onClick={() => setSelectedNews({...news, index})} className="mt-1.5 sm:mt-2 text-[11px] sm:text-[12px] font-semibold text-[#702082] underline underline-offset-2 inline-flex items-center gap-1">{news.meta} · อ่านเพิ่มเติม <Icon icon="ph:arrow-right" width="12" height="12" /></button>
              </article>
            ))}
          </div>
          <div className="relative flex justify-center gap-1.5 mt-2 sm:mt-3 lg:hidden">{[0,1,2,3].map((index) => <button key={index} onClick={() => { const track = newsRef.current; const item = track?.children[index]; if (track && item) track.scrollTo({left:item.offsetLeft - (track.clientWidth - item.offsetWidth) / 2,behavior:'smooth'}) }} aria-label={`ไปข่าวหน้า ${index + 1}`} className={`h-1.5 rounded-full transition-all ${activeNews === index ? 'w-5 bg-[#702082]' : 'w-1.5 bg-white/90'}`}/>)}</div>
          </div>}
        </section>

        <section className="relative -mt-1 bg-white rounded-t-[32px] px-5 lg:px-6 pt-6 pb-4">
          <div className="flex items-center justify-between"><div className="flex items-center gap-2"><h2 className="text-[25px] font-bold tracking-[-.7px] text-[#4b1560]">รายการรถ</h2><Icon icon="ph:info-duotone" width="21" height="21" className="text-[#702082]" /></div><button onClick={() => router.push('/dashboard')} className="w-10 h-10 rounded-full bg-[#f3eaf5] text-[#702082] flex items-center justify-center" aria-label="เปิดแดชบอร์ด"><Icon icon="ph:chart-pie-slice-duotone" width="22" height="22" /></button></div>
          <div className="flex items-center justify-between mt-6 mb-1 text-[13px] text-[#646a66]"><span>{cars.length} รายการ</span><span>สถานะล่าสุด</span></div>
          {cars.length === 0 ? <div className="py-14 text-center text-[#939b95]"><Icon icon="ph:car-profile-duotone" width="52" height="52" className="mx-auto mb-2"/><p>ยังไม่มีรถในระบบ</p></div> : <div className="lg:grid lg:grid-cols-2 lg:gap-x-8">{busyCars.map(renderCarRow)}{availableCars.map(renderCarRow)}</div>}
          <p className="text-center text-[10px] text-[#b5bcb7] mt-5">PEA Fleet System v2.26 · เปิดใช้งาน {activeCars.length} คัน</p>
        </section>

        <footer className="bg-white px-5 lg:px-6 pt-2 pb-7">
          <a
            href="https://github.com/kijnaphat"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between gap-4 rounded-[22px] border border-[#eadfed] bg-gradient-to-r from-[#faf5fb] to-[#fffbea] px-4 py-4 transition-all active:scale-[.98]"
            aria-label="เปิด GitHub Profile ของ Kijnaphat Suksod"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-[14px] bg-[#702082] text-[#ffdd00] flex items-center justify-center flex-shrink-0 shadow-sm">
                <Icon icon="ph:github-logo-fill" width="24" height="24" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[.12em] text-[#702082]">DEVELOPED BY</p>
                <p className="text-[16px] font-bold text-[#2d2030] truncate">Kijnaphat Suksod</p>
                <p className="text-[11px] text-[#817385]">github.com/kijnaphat · Profile</p>
              </div>
            </div>
            <Icon icon="ph:arrow-up-right-bold" width="20" height="20" className="text-[#702082] flex-shrink-0 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </footer>
      </main>

      {/* ── Modal รายละเอียดข่าวสาร ── */}
      {selectedNews && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="news-detail-title">
          <button className="absolute inset-0 bg-[#24102b]/55 backdrop-blur-sm" onClick={() => setSelectedNews(null)} aria-label="ปิดรายละเอียดข่าว"/>
          <div className="relative w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-[#fbf8fc] rounded-t-[30px] sm:rounded-[30px] shadow-[0_-12px_60px_rgba(55,15,66,.28)] animate-slideUp">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#4b1560] via-[#702082] to-[#913aa1] px-6 pt-5 pb-7 text-white">
              <div className="absolute -right-16 -bottom-24 w-60 h-60 rounded-full bg-white/10"/>
              <div className="sm:hidden w-10 h-1 rounded-full bg-white/35 mx-auto mb-5"/>
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="w-[52px] h-[52px] min-w-[52px] rounded-[16px] bg-[#ffdd00] text-[#4b1560] flex items-center justify-center shadow-lg"><Icon icon={selectedNews.icon} width="29" height="29" /></span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold tracking-[.14em] text-[#ffea71]">{selectedNews.kicker || `ข่าวสาร PEA · เรื่องที่ ${selectedNews.index + 1} จาก 4`}</p>
                    <h2 id="news-detail-title" className="text-[23px] font-bold tracking-[-.5px] leading-tight mt-1">{selectedNews.title}</h2>
                  </div>
                </div>
                <button onClick={() => setSelectedNews(null)} className="w-9 h-9 rounded-full bg-white/15 border border-white/15 flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform" aria-label="ปิด"><Icon icon="ph:x-bold" width="16" height="16" /></button>
              </div>
              <div className="relative mt-5 inline-flex items-center gap-2 bg-white/12 border border-white/15 rounded-full px-3.5 py-2 text-[11px] font-semibold"><Icon icon="ph:calendar-check-duotone" width="17" height="17" className="text-[#ffdd00]" />{selectedNews.period}</div>
            </div>

            <div className="px-5 sm:px-6 py-6 space-y-5">
              <section className="bg-white rounded-[22px] p-5 border border-[#eee3f1] shadow-[0_6px_24px_rgba(91,35,104,.06)]">
                <div className="flex items-center gap-2 mb-2 text-[#702082]"><Icon icon="ph:info-duotone" width="20" height="20" /><h3 className="text-[15px] font-bold">รายละเอียด</h3></div>
                <p className="text-[14px] leading-[1.75] text-[#5f5462]">{selectedNews.detail}</p>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-3 text-[#4b1560]"><Icon icon="ph:list-checks-duotone" width="21" height="21" /><h3 className="text-[16px] font-bold">{selectedNews.sectionTitle || 'ขั้นตอนที่ควรดำเนินการ'}</h3></div>
                <div className="space-y-2.5">
                  {selectedNews.steps.map((step, index) => (
                    <div key={step} className="flex items-start gap-3 bg-white rounded-[17px] px-4 py-3.5 border border-[#eee3f1]">
                      <span className="w-7 h-7 rounded-full bg-[#702082] text-[#ffdd00] flex items-center justify-center text-[11px] font-bold flex-shrink-0">{index + 1}</span>
                      <p className="text-[13px] leading-relaxed text-[#3f3542] pt-1">{step}</p>
                    </div>
                  ))}
                </div>
              </section>

              <div className="flex items-start gap-3 bg-[#fff8cf] border border-[#f1d95b] rounded-[18px] px-4 py-4 text-[#5a4710]">
                <Icon icon="ph:warning-circle-duotone" width="22" height="22" className="text-[#b78d00] flex-shrink-0" />
                <div><p className="text-[12px] font-bold mb-0.5">ข้อควรทราบ</p><p className="text-[12px] leading-relaxed">{selectedNews.note}</p></div>
              </div>

              <button onClick={() => setSelectedNews(null)} className="w-full bg-[#702082] text-white rounded-[17px] py-4 text-[15px] font-bold flex items-center justify-center gap-2 active:scale-[.98] transition-transform shadow-[0_8px_22px_rgba(112,32,130,.22)]"><Icon icon="ph:check-circle-duotone" width="20" height="20" className="text-[#ffdd00]" />รับทราบ</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal รายละเอียดรถแบบขยาย (แบบ Full Screen เหมือนหน้าฟอร์ม ไม่ต้องเลื่อนจอ) ── */}
      {carDetailModal && (() => {
        const { car, timeString, logData } = carDetailModal
        const carImageSrc = getCarImage(car)
        const isBusy = car.status === 'busy'
        const driverName = logData?.driver_name
        const isEV = car.fuel_type?.toUpperCase() === 'EV' || car.car_type?.toUpperCase().includes('EV')

        // ปรับเป็น Gradient และ overlay เพื่อให้อ่านข้อความง่ายขึ้น เหมือนในรูป
        const imgBgGradient = 'linear-gradient(to bottom, #eadfed 0%, #4b1560 100%)' // Blue to Dark

        return (
          <div className="fixed inset-0 z-[999] bg-[#f8f3fa] flex flex-col animate-slideUp">
            
            {/* ── ส่วนบน: รูปภาพและทะเบียน (Hero 45% ของจอ) ── */}
            <div className="relative w-full h-[45%] flex flex-col justify-end px-5 pb-8 overflow-hidden" style={{ background: imgBgGradient }}>
              
              {/* Dark Gradient Overlay for text readability ( bottom gradient to black ) */}
              <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[#4b1560]/90 via-[#4b1560]/40 to-transparent z-10 pointer-events-none" />

              {/* Nav Buttons (ปรับชิดขอบบน) */}
              <div className="absolute top-0 left-0 w-full px-4 pt-4 sm:pt-6 flex justify-between items-center z-30">
                <button onClick={() => setCarDetailModal(null)}
                  className="flex items-center gap-1.5 text-[15px] font-medium text-white active:opacity-60 transition-opacity"
                  style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>
                  <Icon icon="ph:caret-left-bold" width="18" height="18" />
                  กลับ
                </button>
                <button onClick={() => window.open(`/report?car_id=${car.id}`,'_blank')}
                  className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-white active:scale-90 transition-all border border-white/30"
                  style={{ background:'rgba(255,255,255,0.2)', backdropFilter:'blur(10px)' }}>
                  <Icon icon="ph:printer-duotone" width="20" height="20" />
                </button>
              </div>

              {/* Car Image (ขยายรูปให้เต็มช่อง) */}
              <div className="absolute inset-0 z-0 pointer-events-none">
                 {carImageSrc 
                   ? <img src={carImageSrc} alt={car.car_type} className={`w-full h-full object-cover ${!car.isActivated ? 'grayscale opacity-35' : ''}`} />
                   : <div className="flex items-center justify-center w-full h-full"><Icon icon="ph:car-profile-duotone" width="120" height="120" className="text-white/50" /></div>
                 }
              </div>

              {/* Info Text (จัดวาง Model เหนือทะเบียน) */}
              <div className="relative z-20 w-full flex items-end justify-between">
                <div>
                  <p className="text-white/90 text-[13px] font-medium mb-1 drop-shadow-sm">
                    {car.model || 'ยานพาหนะ'} · {car.car_type}
                  </p>
                  <h1 className="text-white text-[32px] font-bold tracking-tight leading-none drop-shadow-md">
                    {car.plate_number}
                  </h1>
                </div>
                
                {/* Status Tag สีแดง/เขียว */}
                <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold px-3 py-1.5 rounded-full text-white shadow-sm mb-1 ${
                  !car.isActivated ? 'bg-[#aeaeb2]' 
                  : isBusy ? 'bg-[#ff3b30]' 
                  : 'bg-[#34c759]' 
                }`}>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isBusy ? 'bg-white/80 animate-pulse' : 'bg-white'}`}/>
                  {!car.isActivated ? 'Inactive' : isBusy ? (isEV ? 'กำลังชาร์จ' : 'ใช้งานอยู่') : (isEV ? 'พร้อมชาร์จ' : 'ว่างพร้อมใช้')}
                </span>
              </div>
            </div>

            {/* ── ส่วนล่าง: Bottom Sheet ข้อมูล (55% ของจอ) ── */}
            <div className="relative -mt-5 rounded-t-[24px] bg-[#f8f9fa] flex-1 flex flex-col z-30 px-5 pt-3 pb-6 shadow-[0_-4px_20px_rgba(0,0,0,0.15)]">
              
              {/* Drag Handle */}
              <div className="flex justify-center mb-5">
                <div className="w-10 h-1 rounded-full bg-[#d9cadd]"/>
              </div>

              {/* Title Header */}
              <div className="flex items-center gap-3 mb-4 px-1">
                <div className={`w-[42px] h-[42px] rounded-[14px] flex items-center justify-center ${car.status === 'busy' ? 'bg-[#ff3b30]' : 'bg-[#34c759]'}`}>
                  <Icon icon={isBusy ? "ph:steering-wheel-fill" : "ph:car-fill"} width="24" height="24" className="text-white" />
                </div>
                <p className="text-[20px] font-bold text-[#4b1560] tracking-[-0.4px]">
                  {isBusy ? 'ข้อมูลการใช้งาน' : 'รายละเอียดรถยนต์'}
                </p>
              </div>

              {/* Data Card (Single White Card) */}
              <div className="bg-white rounded-[20px] px-5 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#f8f3fa] flex flex-col">
                
                {/* Driver Row: สีฟ้า */}
                <div className="flex items-center gap-4 py-4">
                  <div className="w-10 h-10 rounded-full bg-[#f0f8ff] border border-[#eadfed] flex items-center justify-center flex-shrink-0">
                    <Icon icon="ph:user-circle-bold" width="22" height="22" className="text-[#702082]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#8e8e93] font-medium mb-0.5">ผู้ขับขี่</p>
                    <p className="text-[15px] text-[#4b1560] font-bold truncate">{driverName ? driverName : 'ไม่มีข้อมูลผู้ขับ'}</p>
                  </div>
                </div>

                <div className="h-px w-full bg-[#f8f3fa]" />

                {/* Location / Task Row: สีม่วง */}
                <div className="flex items-center gap-4 py-4">
                  <div className="w-10 h-10 rounded-full bg-[#faf5ff] border border-[#ebd7ff] flex items-center justify-center flex-shrink-0">
                    <Icon icon="ph:briefcase-bold" width="22" height="22" className="text-[#8b3c98]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-[#8e8e93] font-medium mb-0.5">ประเภทงาน / สถานที่</p>
                    <p className="text-[15px] text-[#4b1560] font-bold leading-snug line-clamp-2">{logData?.location ? logData.location : 'ไม่ระบุงาน'}</p>
                  </div>
                </div>

                {/* Time Row: สีเขียว */}
                {timeString && (
                  <>
                    <div className="h-px w-full bg-[#f8f3fa]" />
                    <div className="flex items-center gap-4 py-4">
                      <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${isBusy ? 'bg-[#f0fdf4] border-[#d4f5e0]' : 'bg-[#f8f3fa] border-[#eadfed]'}`}>
                        <Icon icon={isBusy ? "ph:clock-bold" : "ph:clock-counter-clockwise-bold"} width="22" height="22" className={isBusy ? 'text-[#34c759]' : 'text-[#8e8e93]'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-[#8e8e93] font-medium mb-0.5">{isBusy ? 'เวลาออกรถ' : 'เวลาคืนรถ'}</p>
                        <p className="text-[15px] text-[#4b1560] font-bold">{timeString}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons (ชิดด้านล่างสุด) */}
              <div className="mt-auto pt-4 flex gap-3">
                <button onClick={() => window.open(`/report?car_id=${car.id}`,'_blank')}
                  className="flex-[0.45] bg-white border-[1.5px] border-[#eadfed] py-[16px] rounded-[16px] flex items-center justify-center gap-2 text-[15px] font-bold text-[#4b1560] shadow-sm active:bg-[#f8f3fa] transition-all">
                  <Icon icon="ph:printer-duotone" width="22" height="22" className="text-[#8b3c98]" />
                  พิมพ์รายงาน
                </button>
                {driverName && car.driverPosition !== 'ผจก.' && (
                  <button onClick={(e) => { setCarDetailModal(null); handleCallClick(e, driverName); }}
                    className={`flex-[0.55] py-[16px] rounded-[16px] flex items-center justify-center gap-2 text-[15px] font-bold text-white shadow-md active:scale-[0.98] transition-all bg-[#34c759] active:bg-[#28a745]`}>
                    <Icon icon="ph:phone-call-duotone" width="22" height="22" />
                    โทรหาผู้ขับ
                  </button>
                )}
              </div>

            </div>
          </div>
        )
      })()}

      {/* ── Modal คู่มือ (Bottom Sheet) ── */}
      {showInstructions && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40"
               style={{backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)'}}
               onClick={() => setShowInstructions(false)}/>
          <div className="relative w-full max-w-[440px] bg-[#f8f3fa] rounded-t-[26px] sm:rounded-[26px] z-10 max-h-[92vh] flex flex-col overflow-hidden animate-slideUp"
               style={{boxShadow:'0 -4px 60px rgba(0,0,0,0.22)'}}>
            <div className="sm:hidden flex justify-center pt-3 pb-0">
              <div className="w-9 h-1 rounded-full bg-[#c7c7cc]"/>
            </div>
            <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-black/[0.06]">
              <span className="text-[18px] font-semibold text-[#4b1560] tracking-[-0.4px]">คู่มือการใช้งาน</span>
              <button onClick={() => setShowInstructions(false)}
                className="w-[28px] h-[28px] rounded-full bg-[#eadfed] flex items-center justify-center text-[13px] text-[#5f4664] font-semibold active:bg-[#d1d1d6] transition-colors">
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-3">
              <div className="bg-white rounded-[16px] overflow-hidden"
                   style={{boxShadow:'0 1px 4px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.06)'}}>
                <div className="px-4 py-3 border-b border-[#f8f3fa] flex items-center gap-2">
                  <Icon icon="ph:car-profile-duotone" width="22" height="22" className="text-[#ff3b30]" />
                  <span className="text-[15px] font-semibold text-[#4b1560]">รถยนต์ทั่วไป (น้ำมัน)</span>
                </div>
                <div className="px-4 py-4 space-y-3.5">
                  <div>
                    <p className="text-[13px] font-semibold text-[#4b1560] mb-1">การนำรถออก</p>
                    <p className="text-[13px] text-[#765c7c] leading-relaxed">
                      สแกน QR Code → กรอกรหัสพนักงาน → เลขไมล์เริ่มต้น → เลือกแผนก/ประเภทงาน/พื้นที่ → <span className="font-semibold text-[#4b1560]">ยืนยันนำรถออก</span>
                    </p>
                  </div>
                  <div className="border-t border-[#f8f3fa] pt-3.5">
                    <p className="text-[13px] font-semibold text-[#4b1560] mb-1">การคืนรถ</p>
                    <p className="text-[13px] text-[#765c7c] leading-relaxed">
                      สแกน QR Code → เลขไมล์ล่าสุด (จบงาน) → เลือกว่ามีการเติมน้ำมันหรือไม่ (ระบุลิตร/บาท) → <span className="font-semibold text-[#4b1560]">ยืนยันคืนรถ</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[16px] overflow-hidden"
                   style={{boxShadow:'0 1px 4px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.06)'}}>
                <div className="px-4 py-3 border-b border-[#f8f3fa] flex items-center gap-2">
                  <Icon icon="ph:lightning-duotone" width="22" height="22" className="text-[#702082]" />
                  <span className="text-[15px] font-semibold text-[#4b1560]">รถยนต์ไฟฟ้า (EV)</span>
                </div>
                <div className="px-4 py-4 space-y-3.5">
                  <div>
                    <p className="text-[13px] font-semibold text-[#4b1560] mb-1">การเริ่มชาร์จ</p>
                    <p className="text-[13px] text-[#765c7c] leading-relaxed">
                      สแกน QR Code → กรอกรหัสพนักงาน → เลขไมล์ → ระบุ %แบตก่อนชาร์จ → เลือกสถานีชาร์จ → <span className="font-semibold text-[#4b1560]">ยืนยันเริ่มชาร์จ</span>
                    </p>
                  </div>
                  <div className="border-t border-[#f8f3fa] pt-3.5">
                    <p className="text-[13px] font-semibold text-[#4b1560] mb-1">การเลิกชาร์จ (นำที่ชาร์จออก)</p>
                    <p className="text-[13px] text-[#765c7c] leading-relaxed">
                      สแกน QR Code → ระบุ %แบตเตอรี่ล่าสุด (หลังชาร์จ) → <span className="font-semibold text-[#4b1560]">ยืนยันเลิกชาร์จ</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 pt-3 pb-8 border-t border-black/[0.05]">
              <button onClick={() => setShowInstructions(false)}
                className="w-full bg-[#4b1560] text-white text-[16px] font-semibold py-4 rounded-[16px] active:bg-[#702082] transition-colors tracking-[-0.2px]">
                รับทราบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal โทรออกหาคนขับ ── */}
      {callModal.isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setCallModal({...callModal, isOpen: false})}/>
            <div className="relative w-full max-w-[320px] bg-white rounded-[24px] p-6 z-10 shadow-2xl flex flex-col items-center text-center animate-slideUp">
                <div className="w-16 h-16 bg-[#edfbf0] rounded-full flex items-center justify-center mb-4">
                  <Icon icon="ph:phone-call-duotone" width="36" height="36" className="text-[#34c759]" />
                </div>
                <h3 className="text-[18px] font-semibold text-[#4b1560] mb-1">โทรหาผู้ขับขี่</h3>
                <p className="text-[14px] text-[#765c7c] mb-4">{callModal.driverName}</p>
                
                {callModal.loading ? (
                <div className="w-6 h-6 border-2 border-[#d9cadd] border-t-[#702082] rounded-full animate-spin my-4"/>
                ) : callModal.error ? (
                <p className="text-[14px] text-[#ff3b30] font-medium bg-[#fff2f0] px-4 py-2 rounded-lg mb-4 w-full">{callModal.error}</p>
                ) : (
                <p className="text-[20px] font-bold text-[#4b1560] tracking-wider mb-6 bg-[#f8f3fa] px-6 py-3 rounded-xl w-full">{callModal.phone}</p>
                )}

                <div className="flex gap-3 w-full">
                <button onClick={() => setCallModal({...callModal, isOpen: false})}
                    className="flex-1 py-3 bg-[#f8f3fa] text-[#4b1560] rounded-[14px] font-medium active:bg-[#eadfed] transition-colors">
                    ยกเลิก
                </button>
                <button 
                    onClick={() => { window.location.href = `tel:${callModal.phone}`; setCallModal({...callModal, isOpen: false}); }}
                    disabled={!callModal.phone}
                    className={`flex-1 py-3 rounded-[14px] font-medium transition-colors ${callModal.phone ? 'bg-[#34c759] text-white active:bg-[#248a3d]' : 'bg-[#eadfed] text-[#aeaeb2] cursor-not-allowed'}`}>
                    โทรออก
                </button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// 🎨 Component: กระดานเซ็นชื่อ (Signature Pad)
// ==========================================
function SignatureModal({ isOpen, onClose, onSave, title, onVerifySuccess }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [empId, setEmpId] = useState('');
  const [staffInfo, setStaffInfo] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) { setEmpId(''); setStaffInfo(null); setError(''); }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && staffInfo && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#1e3a8a'; 
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = 'auto'; }
  }, [isOpen, staffInfo]);

  if (!isOpen) return null;

  const verifyEmp = async () => {
    if (!empId) return;
    setIsLoading(true); setError('');
    try {
        const { data } = await supabase.from('staff').select('id, full_name, position').eq('staff_code', empId).single();
        if (data) {
            setStaffInfo(data);
            if (onVerifySuccess) onVerifySuccess(); 
        }
        else setError('❌ ไม่พบรหัสพนักงานในระบบ');
    } catch (err) { setError('❌ ไม่พบรหัสพนักงานในระบบ'); }
    setIsLoading(false);
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); 
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => { setIsDrawing(false); };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    const base64Text = canvas.toDataURL('image/png');
    
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (base64Text === blank.toDataURL()) {
        alert("กรุณาเซ็นชื่อก่อนบันทึกครับ");
        return;
    }
    onSave(base64Text, staffInfo.full_name, staffInfo.position, staffInfo.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center"
         style={{background:'rgba(0,0,0,0.45)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)'}}>
      <div className="bg-[#f8f3fa] w-full max-w-md rounded-t-[24px] sm:rounded-[24px] overflow-hidden flex flex-col"
           style={{boxShadow:'0 24px 80px rgba(0,0,0,0.3)', WebkitFontSmoothing:'antialiased'}}>
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-9 h-[4px] rounded-full bg-[#c7c7cc]"/>
        </div>
        <div className="px-5 pt-4 pb-4 flex items-center justify-between border-b border-[rgba(0,0,0,0.06)]">
          <span className="text-[17px] font-semibold text-[#4b1560] tracking-[-0.3px] flex items-center gap-2">
            <Icon icon="ph:pen-nib-duotone" width="22" height="22" className="text-[#702082]" /> {title}
          </span>
          <button onClick={onClose} className="w-[28px] h-[28px] rounded-full bg-[#eadfed] flex items-center justify-center text-[13px] text-[#702082] font-semibold active:bg-[#d1d1d6] transition-colors">✕</button>
        </div>
        <div className="mx-5 mt-3 flex items-center gap-2 bg-[#f3eaf5] rounded-[10px] px-3 py-2">
          <Icon icon="ph:calendar-dots-duotone" width="20" height="20" className="text-[#ff9f0a]" />
          <span className="text-[12px] font-medium text-[#702082]">เซ็นได้เฉพาะวันที่ 28–5 ของรอบเดือน</span>
        </div>
        <div className="p-5">
          {!staffInfo ? (
            <div className="space-y-4">
              <div className="text-center space-y-1 mb-2">
                <div className="w-16 h-16 rounded-full bg-[#eadfed] flex items-center justify-center mx-auto mb-3">
                  <Icon icon="ph:shield-check-duotone" width="34" height="34" className="text-[#34c759]" />
                </div>
                <h3 className="text-[17px] font-semibold text-[#4b1560] tracking-[-0.3px]">ยืนยันตัวตน</h3>
                <p className="text-[13px] text-[#765c7c]">กรอกรหัสพนักงานของคุณ</p>
              </div>
              <input type="text" value={empId} onChange={e => setEmpId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && verifyEmp()}
                className="w-full bg-white text-[#4b1560] text-[20px] font-semibold tracking-[0.2em] text-center px-4 py-3.5 rounded-[14px] outline-none"
                style={{boxShadow:'0 0 0 0.5px rgba(0,0,0,0.12)', fontFamily:'monospace'}}
                placeholder="XXXXXX" />
              {error && <p className="text-[13px] text-[#ff3b30] text-center font-medium">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={onClose}
                  className="flex-1 py-3.5 rounded-[14px] bg-[#eadfed] text-[#4b1560] text-[15px] font-medium active:bg-[#d1d1d6] transition-colors">
                  ยกเลิก
                </button>
                <button onClick={verifyEmp} disabled={isLoading}
                  className={`flex-1 py-3.5 rounded-[14px] text-white text-[15px] font-medium transition-colors ${isLoading ? 'bg-[#aeaeb2]' : 'bg-[#4b1560] active:bg-[#702082]'}`}>
                  {isLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-[14px] px-4 py-3 flex items-center justify-between"
                   style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.08)'}}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-[7px] h-[7px] rounded-full bg-[#34c759]"/>
                    <span className="text-[14px] font-semibold text-[#4b1560]">{staffInfo.full_name}</span>
                  </div>
                  <p className="text-[12px] text-[#765c7c] mt-0.5 ml-[15px]">{staffInfo.position}</p>
                </div>
                <button onClick={() => setStaffInfo(null)}
                  className="text-[12px] text-[#702082] font-medium active:opacity-60">เปลี่ยน</button>
              </div>
              <p className="text-[12px] text-[#765c7c] text-center">ใช้นิ้วเซ็นชื่อในกรอบด้านล่าง</p>
              <div className="bg-white rounded-[14px] p-3 flex justify-center"
                   style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.08)'}}>
                <canvas ref={canvasRef} width={300} height={140}
                  className="rounded-[10px] cursor-crosshair touch-none"
                  style={{border:'1.5px dashed #d9cadd', touchAction:'none', background:'#fafafa'}}
                  onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
              </div>
              <div className="flex gap-3">
                <button onClick={clearCanvas}
                  className="flex-1 py-3.5 rounded-[14px] bg-[#eadfed] text-[#4b1560] text-[15px] font-medium active:bg-[#d1d1d6] transition-colors">
                  ลบ / เขียนใหม่
                </button>
                <button onClick={handleSave}
                  className="flex-1 py-3.5 rounded-[14px] bg-[#4b1560] text-white text-[15px] font-medium active:bg-[#702082] transition-colors">
                  บันทึก
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 📄 Component: หน้าตารายงาน
// ==========================================
function ReportPage() {
  const searchParams = useSearchParams()
  const carId = searchParams.get('car_id')
  
  const [car, setCar] = useState(null)
  const [logs, setLogs] = useState([])
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7))
  const [today, setToday] = useState(new Date())

  const [fromText, setFromText] = useState('')
  const [toText, setToText] = useState('')
  const [dearText, setDearText] = useState('')

  const [driverSigText, setDriverSigText] = useState(null)
  const [driverName, setDriverName] = useState('')
  const [driverPos, setDriverPos] = useState('')

  const [controllerSigText, setControllerSigText] = useState(null)
  const [controllerName, setControllerName] = useState('')
  const [controllerPos, setControllerPos] = useState('')

  const [sigModal, setSigModal] = useState({ isOpen: false, target: null, title: '' })

  const [signableMonth, setSignableMonth] = useState(null);
  const [canSignAny, setCanSignAny] = useState(false);
  const [isCurrentMonthSignable, setIsCurrentMonthSignable] = useState(false);

  useEffect(() => {
     const d = today;
     const date = d.getDate();
     let allowedMonth = null;

     if (date >= 28) {
         const y = d.getFullYear();
         const m = String(d.getMonth() + 1).padStart(2, '0');
         allowedMonth = `${y}-${m}`;
     } else if (date <= 5) {
         let y = d.getFullYear();
         let m = d.getMonth();
         if (m === 0) {
             y -= 1;
             m = 12;
         }
         allowedMonth = `${y}-${String(m).padStart(2, '0')}`;
     }

     setSignableMonth(allowedMonth);
     setCanSignAny(allowedMonth !== null);
     setIsCurrentMonthSignable(allowedMonth === selectedMonth);

  }, [today, selectedMonth]);

  const [scale, setScale] = useState(1);
  const A4_WIDTH_PX = 1123; 

  useEffect(() => {
    const handleResize = () => {
      const availableWidth = window.innerWidth - 16; 
      if (availableWidth < A4_WIDTH_PX) setScale(availableWidth / A4_WIDTH_PX);
      else setScale(1);
    };
    handleResize(); 
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchData = async () => {
    if (!carId) return

    const [year, month] = selectedMonth.split('-')
    const startDate = `${year}-${month}-01T00:00:00`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${month}-${lastDay}T23:59:59`

    const { data: c } = await supabase.from('cars').select('*').eq('id', carId).single()
    setCar(c)

    const { data: l } = await supabase.from('trip_logs')
      .select('*').eq('car_id', carId).eq('is_completed', true)
      .gte('start_time', startDate).lte('start_time', endDate)
      .order('start_time', { ascending: true })
    setLogs(l || [])

    const { data: sigData } = await supabase
      .from('report_signatures')
      .select('*')
      .eq('car_id', Number(carId))
      .eq('report_month', selectedMonth)
      .single()

    if (sigData) {
        setDriverSigText(sigData.driver_sig || null)
        setDriverName(sigData.driver_name || '')
        setDriverPos(sigData.driver_pos || '')
        setControllerSigText(sigData.controller_sig || null)
        setControllerName(sigData.controller_name || '')
        setControllerPos(sigData.controller_pos || '')
    } else {
        setDriverSigText(null); setDriverName(''); setDriverPos('');
        setControllerSigText(null); setControllerName(''); setControllerPos('');
    }
  }

  useEffect(() => {
    if (carId) fetchData()
    setToday(new Date())
  }, [carId, selectedMonth])

  const saveSignatureToDB = async (target, base64Text, fetchedName, fetchedPos, staffId = null) => {
    try {
        const { data: existing } = await supabase.from('report_signatures').select('id').eq('car_id', Number(carId)).eq('report_month', selectedMonth).single()

        const payload = {}
        if (target === 'driver') {
            payload.driver_sig = base64Text; payload.driver_name = fetchedName; payload.driver_pos = fetchedPos;
            payload.driver_staff_id = staffId;
            setDriverSigText(base64Text); setDriverName(fetchedName); setDriverPos(fetchedPos);
        } else {
            payload.controller_sig = base64Text; payload.controller_name = fetchedName; payload.controller_pos = fetchedPos;
            payload.controller_staff_id = staffId;
            setControllerSigText(base64Text); setControllerName(fetchedName); setControllerPos(fetchedPos);
        }

        if (existing) {
            await supabase.from('report_signatures').update(payload).eq('id', existing.id)
        } else {
            await supabase.from('report_signatures').insert([{ ...payload, car_id: Number(carId), report_month: selectedMonth }])
        }
    } catch (err) { alert('เกิดข้อผิดพลาดในการบันทึกลายเซ็น: ' + err.message) }
  }

  const handleDeleteSig = async (target) => {
      if(!confirm('ต้องการลบลายเซ็นนี้ใช่หรือไม่?')) return;
      await saveSignatureToDB(target, null, '', '', null);
  }

  const openSigModal = (target, title) => {
      if (!canSignAny) {
          alert('⚠️ นอกเวลาอนุญาต (ระบบให้เซ็นเอกสารได้เฉพาะวันที่ 28 ถึง 5 ของเดือนเท่านั้นครับ)');
          return;
      }
      setSigModal({ isOpen: true, target, title });
  }

  const extractTaskOnly = (locationString) => {
      if (!locationString) return '';
      const match = locationString.match(/\[.*? - (.*?)\]/);
      return match ? match[1].trim() : locationString;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: '2-digit' }) : ''
  const formatThaiMonth = (d) => d ? new Date(d).toLocaleDateString('th-TH', { month: 'long' }) : ''
  const formatThaiYear = (d) => d ? new Date(d).getFullYear() + 543 : ''
  const reportDate = new Date(`${selectedMonth}-01`)

  const totalDistance = logs.reduce((sum, log) => sum + (log.end_mileage - log.start_mileage), 0)
  const totalFuelLiters = logs.reduce((sum, log) => sum + (Number(log.fuel_liters) || 0), 0)
  const totalFuelCost = logs.reduce((sum, log) => sum + (Number(log.fuel_cost) || 0), 0)
  const kmPerLiter = (totalDistance > 0 && totalFuelLiters > 0) ? (totalDistance / totalFuelLiters).toFixed(2) : ''
  const startMonthMileage = logs.length > 0 ? logs[0].start_mileage : 0;
  const endMonthMileage = logs.length > 0 ? logs[logs.length - 1].end_mileage : 0;
  const isEVCar = car?.fuel_type?.toUpperCase() === 'EV' || car?.plate_number?.includes('6ขฆ-6169') || car?.plate_number?.includes('6ขฆ 6169');

  const ITEMS_PER_PAGE = 10;
  const pages = [];
  let currentIndex = 0;
  if (logs.length === 0) {
      pages.push([]);
  } else {
      while (currentIndex < logs.length) {
          let remaining = logs.length - currentIndex;
          if (remaining <= 10) {
              pages.push(logs.slice(currentIndex, currentIndex + remaining));
              currentIndex += remaining;
          } else {
              pages.push(logs.slice(currentIndex, currentIndex + 11));
              currentIndex += 11;
          }
      }
      if (pages.length > 0 && pages[pages.length - 1].length === 11) {
          pages.push([]);
      }
  }

  const CheckboxCell = ({ checked, text, showDots = true }) => (
    <div className="flex items-center justify-start px-1 h-full w-full">
        <div className="w-3.5 h-3.5 border border-black flex-shrink-0 flex items-center justify-center text-[12px] leading-none mr-1 relative bg-white">
            {checked && <span className="absolute -top-[1px] font-normal">✓</span>}
        </div>
        <div className="truncate text-[10px] leading-none flex-grow text-left">
           {checked && text ? text : (showDots ? '........................' : '')}
        </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-gray-500 flex flex-col items-center pb-12 print:bg-white print:p-0 font-sarabun text-black relative overflow-x-hidden ${isEVCar ? 'pt-[260px]' : 'pt-[380px]'} xl:pt-8`}>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          body { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            background: white !important; 
            margin: 0; 
            padding: 0; 
            overflow: visible !important;
          }
          html { background: white; overflow: visible !important; }
          .print\\:hidden { display: none !important; }
          .print-container { 
            width: 100% !important; 
            display: block !important; 
            padding: 0 !important; 
            margin: 0 !important; 
            background: white !important; 
          }
          .page-wrapper { 
            width: 297mm !important; 
            height: 210mm !important; 
            margin: 0 auto !important; 
            padding: 0 !important;
            box-shadow: none !important; 
            border: none !important;
            border-radius: 0 !important; 
            page-break-after: always !important;
            page-break-inside: avoid !important;
            background: white !important;
            transform: none !important;
          }
          .page-inner { 
            width: 297mm !important; 
            height: 210mm !important; 
            transform: none !important; 
            position: relative !important; 
            padding: 8mm 12mm 10mm 12mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
        }
      `}</style>

      <SignatureModal 
        isOpen={sigModal.isOpen} title={sigModal.title}
        onClose={() => setSigModal({ isOpen: false, target: null, title: '' })}
        onSave={(base64Text, fetchedName, fetchedPos, staffId) => saveSignatureToDB(sigModal.target, base64Text, fetchedName, fetchedPos, staffId)}
        onVerifySuccess={() => {
            if (signableMonth && selectedMonth !== signableMonth) {
                setSelectedMonth(signableMonth);
            }
        }}
      />

      {/* ── Settings Panel ── */}
      <div className="w-full fixed top-0 left-0 xl:w-[300px] xl:top-4 xl:left-auto xl:right-4 print:hidden z-50"
           style={{WebkitFontSmoothing:'antialiased'}}>
        <div className="bg-[rgba(245,245,247,0.92)] backdrop-blur-2xl border-b border-[rgba(0,0,0,0.1)] xl:border xl:border-[rgba(0,0,0,0.08)] xl:rounded-[20px] xl:shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(0,0,0,0.06)]">
            <span className="text-[15px] font-semibold text-[#4b1560] tracking-[-0.3px]">เอกสาร</span>
            <button onClick={() => window.print()}
              className="bg-[#4b1560] text-white text-[13px] font-medium px-4 py-1.5 rounded-full flex items-center gap-1.5 active:bg-[#702082] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
              พิมพ์
            </button>
          </div>

          <div className="px-4 py-2 border-b border-[rgba(0,0,0,0.06)]">
            {!canSignAny ? (
              <div className="flex items-center gap-2 bg-[#fff3cd] rounded-[10px] px-3 py-2">
                <Icon icon="ph:lock-key-duotone" width="16" height="16" className="text-[#856404]" />
                <span className="text-[11px] font-medium text-[#856404]">นอกเวลาอนุญาต (28–5 ของเดือน)</span>
              </div>
            ) : selectedMonth !== signableMonth ? (
              <div className="flex items-center gap-2 bg-[#f3eaf5] rounded-[10px] px-3 py-2">
                <Icon icon="ph:info-duotone" width="16" height="16" className="text-[#702082]" />
                <span className="text-[11px] font-medium text-[#702082]">จะสลับไปเดือน {signableMonth}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-[#edfbf0] rounded-[10px] px-3 py-2">
                <span className="w-[7px] h-[7px] rounded-full bg-[#34c759] flex-shrink-0"/>
                <span className="text-[11px] font-medium text-[#248a3d]">แก้ไขลายเซ็นได้</span>
              </div>
            )}
          </div>

          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[13px] text-[#4b1560] font-medium">เดือน</span>
              <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                className="text-[13px] text-[#702082] font-medium bg-transparent border-none outline-none cursor-pointer" />
            </div>

            {!isEVCar && (
              <div className="bg-white rounded-[12px] overflow-hidden" style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.08)'}}>
                {[
                  { label: 'จาก', val: fromText, set: setFromText, ph: 'แผนก...' },
                  { label: 'ถึง',  val: toText,  set: setToText,  ph: 'หัวหน้า...' },
                  { label: 'เรียน', val: dearText, set: setDearText, ph: 'ผจก...' },
                ].map(({ label, val, set, ph }, i, arr) => (
                  <div key={label} className={`flex items-center px-3 py-2 gap-3 ${i < arr.length-1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''}`}>
                    <span className="text-[12px] text-[#765c7c] w-8 flex-shrink-0">{label}</span>
                    <input type="text" value={val} onChange={e => set(e.target.value)} placeholder={ph}
                      className="flex-1 text-[12px] text-[#4b1560] bg-transparent border-none outline-none placeholder:text-[#c7c7cc]" />
                  </div>
                ))}
              </div>
            )}

            <div>
              <p className="text-[11px] text-[#765c7c] font-medium mb-2 tracking-[-0.1px]">ลายเซ็น</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white rounded-[12px] overflow-hidden flex flex-col items-center py-2 px-1 relative" style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.08)', minHeight:'70px'}}>
                  <span className="text-[10px] text-[#765c7c] mb-1.5">{isEVCar ? 'ผู้รายงาน' : 'ผู้ขับรถ'}</span>
                  {driverSigText ? (
                    <>
                      <img src={driverSigText} alt="sig" className="h-7 object-contain" />
                      {isCurrentMonthSignable && (
                        <button onClick={() => handleDeleteSig('driver')}
                          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#ff3b30] flex items-center justify-center text-white text-[8px] font-bold">✕</button>
                      )}
                    </>
                  ) : (
                    <button onClick={() => openSigModal('driver', isEVCar ? 'เซ็นชื่อผู้รายงาน' : 'เซ็นชื่อผู้ขับ')}
                      className={`text-[11px] font-medium px-3 py-1 rounded-full border transition-colors ${canSignAny ? 'border-[#702082] text-[#702082] active:bg-[#f3eaf5]' : 'border-[#d9cadd] text-[#aeaeb2] cursor-not-allowed'}`}>
                      + เซ็น
                    </button>
                  )}
                </div>

                <div className="bg-white rounded-[12px] overflow-hidden flex flex-col items-center py-2 px-1 relative" style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.08)', minHeight:'70px'}}>
                  <span className="text-[10px] text-[#765c7c] mb-1.5">ผู้ควบคุม</span>
                  {controllerSigText ? (
                    <>
                      <img src={controllerSigText} alt="sig" className="h-7 object-contain" />
                      {isCurrentMonthSignable && (
                        <button onClick={() => handleDeleteSig('controller')}
                          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#ff3b30] flex items-center justify-center text-white text-[8px] font-bold">✕</button>
                      )}
                    </>
                  ) : (
                    <button onClick={() => openSigModal('controller', 'เซ็นชื่อผู้ควบคุม')}
                      className={`text-[11px] font-medium px-3 py-1 rounded-full border transition-colors ${canSignAny ? 'border-[#702082] text-[#702082] active:bg-[#f3eaf5]' : 'border-[#d9cadd] text-[#aeaeb2] cursor-not-allowed'}`}>
                      + เซ็น
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full flex flex-col items-center gap-6 print:block print:w-auto print-container">
          {pages.map((pageLogs, pageIndex) => {
            const isLastPage = pageIndex === pages.length - 1;
            const targetRows = isLastPage ? 10 : 11;
            const emptyRows = Array.from({ length: Math.max(0, targetRows - pageLogs.length) });

            return (
              <div key={pageIndex} className="page-wrapper relative shadow-2xl xl:shadow-xl rounded-md bg-white overflow-hidden" style={{ width: `${A4_WIDTH_PX * scale}px`, height: `${794 * scale}px` }}>
                <div className="page-inner absolute top-0 left-0 bg-white box-border flex flex-col font-normal text-black" style={{ width: `${A4_WIDTH_PX}px`, height: `794px`, padding: '25px 38px 30px 38px', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                    
                    {/* ========================================= */}
                    {/* ⚡ REPORT FORM: EV */}
                    {/* ========================================= */}
                    {isEVCar ? (
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="mb-1">
                                    <h1 className="text-lg font-normal text-center">รายงานการอัดประจุไฟฟ้าสำหรับรถยนต์ไฟฟ้า (EV)</h1>
                                    <div className="h-4"></div> 
                                    <div className="flex flex-wrap justify-center items-end text-[13px] font-normal leading-loose whitespace-nowrap px-1">
                                        <span>รายงานการอัดประจุไฟฟ้าสำหรับรถยนต์ไฟฟ้า (EV) ประจำเดือน</span>
                                        <div className="border-b border-dotted border-black px-2 min-w-[80px] text-center mx-1">{formatThaiMonth(reportDate)}</div>
                                        <span>พ.ศ.</span>
                                        <div className="border-b border-dotted border-black px-2 min-w-[50px] text-center mx-1">{formatThaiYear(reportDate)}</div>
                                        <span>หน่วยงาน</span>
                                        <div className="border-b border-dotted border-black px-2 min-w-[100px] text-center mx-1">กฟส.กพส.</div>
                                        <span>หมายเลขทะเบียน</span>
                                        <div className="border-b border-dotted border-black px-2 min-w-[100px] text-center mx-1">{car?.plate_number}</div>
                                    </div>
                                </div>

                                <table className="w-full border-collapse border border-black text-[11px] font-normal">
                                    <thead>
                                        <tr className="text-center h-[25px] font-normal">
                                            <th rowSpan={3} className="border border-black w-[8%] font-normal">วันที่</th>
                                            <th rowSpan={3} className="border border-black w-[15%] font-normal">หน่วยงานที่ใช้</th>
                                            <th rowSpan={3} className="border border-black w-[10%] font-normal">เลขไมล์(กม.)</th>
                                            <th colSpan={2} className="border border-black w-[10%] font-normal">% แบตเตอรี่</th>
                                            <th colSpan={6} className="border border-black font-normal">สถานีอัดประจุรถยนต์ไฟฟ้า</th>
                                        </tr>
                                        <tr className="text-center h-[25px] font-normal">
                                            <th rowSpan={2} className="border border-black w-[5%] font-normal">ก่อน</th>
                                            <th rowSpan={2} className="border border-black w-[5%] font-normal">หลัง</th>
                                            <th colSpan={4} className="border border-black font-normal">สถานีชาร์จของ PEA Volta</th>
                                            <th colSpan={2} className="border border-black font-normal">สถานีชาร์จนอกเครือข่าย<br/>PEA Volta</th>
                                        </tr>
                                        <tr className="text-center h-[35px] font-normal">
                                            <th className="border border-black w-[5%] text-[10px] font-normal">สนญ.</th>
                                            <th className="border border-black w-[10%] text-[10px] font-normal">กฟก. (ระบุ)</th>
                                            <th className="border border-black w-[10%] text-[10px] font-normal">บางจาก (ระบุ)</th>
                                            <th className="border border-black w-[10%] text-[10px] font-normal">PEA Volta อื่น ๆ (ระบุ)</th>
                                            <th className="border border-black w-[5%] text-[10px] font-normal">Wall<br/>Charge</th>
                                            <th className="border border-black w-[12%] text-[10px] font-normal">สถานีชาร์จ อื่น ๆ (ระบุ)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageLogs.map((log, i) => {
                                            const stName = log.station_name || '';
                                            const stType = log.station_type || '';
                                            const getDetail = (text) => text.includes(':') ? text.split(':')[1].trim() : text;
                                            const isHQ = stName.includes('สำนักงานใหญ่') || stName.includes('HQ');
                                            const isKFK = stName.includes('กฟก.');
                                            const isBangchak = stName.includes('บางจาก');
                                            const isPEAOther = stName.includes('PEA Volta');
                                            const isWall = stName.includes('Wall Charge');
                                            const isOther = !isHQ && !isKFK && !isBangchak && !isPEAOther && !isWall && stType === 'OTHER';

                                            return (
                                                <tr key={i} className="h-[28px] text-center font-normal align-middle">
                                                    <td className="border border-black">{formatDate(log.start_time)}</td>
                                                    <td className="border border-black text-center px-1 truncate max-w-[150px]">กฟส.กพส.</td>
                                                    <td className="border border-black text-right px-1">{log.end_mileage.toLocaleString()}</td>
                                                    <td className="border border-black">{log.battery_before || '-'}</td>
                                                    <td className="border border-black">{log.battery_after || '-'}</td>
                                                    <td className="border border-black text-center align-middle p-0"><div className="flex justify-center"><CheckboxCell checked={isHQ} showDots={false} /></div></td>
                                                    <td className="border border-black p-0 align-middle"><CheckboxCell checked={isKFK} text={getDetail(stName)} /></td>
                                                    <td className="border border-black p-0 align-middle"><CheckboxCell checked={isBangchak} text={getDetail(stName)} /></td>
                                                    <td className="border border-black p-0 align-middle"><CheckboxCell checked={isPEAOther} text={getDetail(stName)} /></td>
                                                    <td className="border border-black text-center align-middle p-0"><div className="flex justify-center"><CheckboxCell checked={isWall} showDots={false} /></div></td>
                                                    <td className="border border-black p-0 align-middle"><CheckboxCell checked={isOther} text={getDetail(stName)} /></td>
                                                </tr>
                                            )
                                        })}
                                        {emptyRows.map((_, i) => (
                                            <tr key={`empty-${i}`} className="h-[28px] font-normal">
                                                <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                                <td className="border border-black"></td><td className="border border-black"></td>
                                                <td className="border border-black p-0 align-middle"><div className="flex justify-center"><CheckboxCell checked={false} showDots={false} /></div></td>
                                                <td className="border border-black p-0 align-middle"><CheckboxCell checked={false} /></td>
                                                <td className="border border-black p-0 align-middle"><CheckboxCell checked={false} /></td>
                                                <td className="border border-black p-0 align-middle"><CheckboxCell checked={false} /></td>
                                                <td className="border border-black p-0 align-middle"><div className="flex justify-center"><CheckboxCell checked={false} showDots={false} /></div></td>
                                                <td className="border border-black p-0 align-middle"><CheckboxCell checked={false} /></td>
                                            </tr>
                                        ))}
                                        {isLastPage && (
                                            <tr className="h-[30px] font-normal text-[11px] align-middle bg-gray-50 print:bg-transparent">
                                                <td colSpan={3} className="border border-black text-right pr-2">รวม</td>
                                                <td colSpan={2} className="border border-black text-center text-black"></td>
                                                <td colSpan={6} className="border border-black text-center text-black"></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                                
                                <div className="mt-1 text-[10px] font-normal">
                                    หมายเหตุ : สถานีชาร์จ อื่น ๆ เช่น EA Anywhere , EV Station , MEA EV , EGAT และ Emergency charger
                                </div>
                            </div>
                            
                            <div className="mt-auto pb-2 flex justify-between items-end px-4 font-normal">
                                <div className="text-sm">
                                    <p className="mb-2">เลขไมล์ต้นเดือน................<span className="font-normal ml-2">{startMonthMileage.toLocaleString()}</span>........................</p>
                                    <p>เลขไมล์ปลายเดือน..............<span className="font-normal ml-2">{endMonthMileage.toLocaleString()}</span>........................</p>
                                </div>
                                
                                <div className="flex gap-x-28">
                                    <div className="text-sm text-center flex flex-col items-center w-[250px]">
                                        <div className="flex items-end justify-center w-full relative h-12 mb-1">
                                            <span className="mr-2">(ลงชื่อ)</span>
                                            <div className="border-b border-dotted border-black w-full h-full flex items-end justify-center pb-1">
                                                {driverSigText && <img src={driverSigText} alt="signature" className="max-h-12 max-w-full object-contain" />}
                                            </div>
                                        </div>
                                        <div className="flex w-full justify-center items-end my-1">
                                            ( <div className="border-b border-dotted border-black w-full mx-1 h-5 text-center font-normal">{driverName}</div> )
                                        </div>
                                        <div className="flex w-full justify-center items-end">
                                            <div className="w-full text-center h-5">{driverPos}</div>
                                        </div>
                                        <p className="mt-1">ผู้รายงาน/เบอร์โทร</p>
                                    </div>

                                    <div className="text-sm text-center flex flex-col items-center w-[250px]">
                                        <div className="flex items-end justify-center w-full relative h-12 mb-1">
                                            <span className="mr-2">(ลงชื่อ)</span>
                                            <div className="border-b border-dotted border-black w-full h-full flex items-end justify-center pb-1">
                                                {controllerSigText && <img src={controllerSigText} alt="signature" className="max-h-12 max-w-full object-contain" />}
                                            </div>
                                        </div>
                                        <div className="flex w-full justify-center items-end my-1">
                                            ( <div className="border-b border-dotted border-black w-full mx-1 h-5 text-center font-normal">{controllerName}</div> )
                                        </div>
                                        <div className="flex w-full justify-center items-end">
                                            <div className="w-full text-center h-5">{controllerPos}</div>
                                        </div>
                                        <p className="mt-1">ผู้ควบคุม</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ========================================= */
                        /* 🚙 REPORT FORM: STANDARD (รถน้ำมัน) */
                        /* ========================================= */
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-end mb-1 font-normal">
                                    <div className="w-[280px] flex justify-start pl-10">
                                        <div className="flex flex-col items-center">
                                            <img src="/pea_logo.png" alt="PEA Logo" className="h-12 mb-1 object-contain" />
                                            <div className="text-[16px] font-bold leading-tight">การไฟฟ้าส่วนภูมิภาค</div>
                                            <div className="text-[9px] text-gray-600 uppercase leading-none tracking-tighter">Provincial Electricity Authority</div>
                                        </div>
                                    </div>
                                    <div className="text-center flex-grow pb-[2px]">
                                        <div className="text-[14px]">การไฟฟ้าส่วนภูมิภาค</div>
                                        <div className="text-[14px]">แบบฟอร์มรายงานการใช้ยานพาหนะหรือเครื่องจักร</div>
                                    </div>
                                    <div className="w-[280px] text-right text-[13px] pb-[2px]">
                                        หน้าที่ {pageIndex + 1} / {pages.length}
                                    </div>
                                </div>

                                <div className="text-[13px] space-y-1 mt-1 font-normal">
                                    <div className="grid grid-cols-3 w-full items-center">
                                        <div className="flex items-center pl-10">จาก <div className={`border-b border-dotted border-black w-[100px] ml-1 text-center font-normal ${fromText ? 'text-black' : 'text-transparent'}`}>{fromText || '.'}</div></div>
                                        <div className="flex items-center justify-center whitespace-nowrap">ถึง (หัวหน้าหน่วยงาน) <div className={`border-b border-dotted border-black w-[150px] ml-1 text-center font-normal ${toText ? 'text-black' : 'text-transparent'}`}>{toText || '.'}</div></div>
                                        <div></div>
                                    </div>
                                    <div className="grid grid-cols-3 w-full items-center">
                                        <div className="flex items-center pl-10">เรื่อง <span className="ml-5 font-normal">รายงานการใช้ยานพาหนะหรือเครื่องจักร</span></div>
                                        <div className="flex items-center justify-center whitespace-nowrap">วันที่ <span className="border-b border-dotted border-black w-8 text-center mx-1">{today.getDate()}</span> เดือน <span className="border-b border-dotted border-black w-24 text-center mx-1">{formatThaiMonth(today)}</span> ปี <span className="border-b border-dotted border-black w-16 text-center mx-1">{formatThaiYear(today)}</span></div>
                                        <div></div>
                                    </div>
                                    <div className="flex items-center pl-10">เรียน <span className="ml-5">หัวหน้าหน่วยงาน</span> <div className={`border-b border-dotted border-black w-[100px] ml-1 text-center font-normal ${dearText ? 'text-black' : 'text-transparent'}`}>{dearText || '.'}</div></div>
                                    <div className="flex flex-wrap pt-0.5 items-end leading-relaxed pl-10">
                                        <span className="ml-12">รายงานการใช้ยานพาหนะ ประจำเดือน</span> <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1">{formatThaiMonth(reportDate)}</span> พ.ศ. <span className="border-b border-dotted border-black min-w-[50px] text-center mx-1">{formatThaiYear(reportDate)}</span> หมายเลขทะเบียน <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1 font-normal">{car?.plate_number}</span> รหัส <span className="border-b border-dotted border-black min-w-[60px] text-center mx-1"></span> ประเภท <span className="border-b border-dotted border-black min-w-[100px] text-center mx-1 font-normal">{car?.car_type}</span> ชนิด <span className="border-b border-dotted border-black min-w-[60px] text-center mx-1"></span>
                                    </div>
                                    <div className="flex items-center gap-3 pt-0.5 text-[12px] pl-10 font-normal">
                                        <span>ชนิดเชื้อเพลิง</span>
                                        {['แก๊สโซฮอล์ 95', 'แก๊สโซฮอล์ 91', 'แก๊สโซฮอล์ E20', 'แก๊สโซฮอล์ E85', 'ดีเซล'].map(f => (
                                            <div key={f} className="flex items-center gap-1 font-normal">
                                                <div className="w-3.5 h-3.5 border border-black flex items-center justify-center text-[11px] relative">{car?.fuel_type === f && <span className="absolute -top-1 font-normal">✓</span>}</div> <span>{f}</span>
                                            </div>
                                        ))}
                                        <span className="ml-2 font-normal">น้ำมันหล่อลื่น จำนวน ................. ลิตร</span>
                                    </div>
                                    <div className="flex items-center pt-0.5 text-[12px] pl-10 font-normal">
                                        อัตราสิ้นเปลืองเชื้อเพลิงยานพาหนะ <span className="border-b border-dotted border-black w-[130px] text-center mx-1 font-normal text-black">{kmPerLiter}</span> กิโลเมตร/ลิตร, <span className="ml-2 font-normal">เครื่องจักร ..................... ลิตร/ชั่วโมง</span>
                                    </div>
                                </div>

                                <table className="w-full border-collapse border border-black mt-2 text-[12px] font-normal">
                                    <thead>
                                        <tr className="text-center h-[40px] bg-gray-50 print:bg-transparent font-normal">
                                        <th className="border border-black w-[10%] font-normal">วันที่</th><th className="border border-black w-[14%] font-normal px-1">ชื่อ-ตำแหน่ง<br/>หน่วยงานที่ใช้</th><th className="border border-black w-[14%] font-normal px-1">สถานที่ปฏิบัติงาน</th>
                                        <th className="border border-black w-[12%] p-0 font-normal"><div className="h-[20px] flex items-center justify-center border-b border-black text-[11px]">เลขระยะทาง</div><div className="h-[20px] flex divide-x divide-black text-[11px]"><div className="w-1/2 flex items-center justify-center text-[10px]">ไป</div><div className="w-1/2 flex items-center justify-center text-[10px]">กลับ</div></div></th>
                                        <th className="border border-black w-[7%] font-normal text-[10px]">ชั่วโมงการ<br/>ทำงาน</th><th className="border border-black w-[8%] font-normal text-[10px]">น้ำมันที่เติม<br/>(ลิตร)</th><th className="border border-black w-[8%] font-normal text-[10px]">จำนวนเงิน<br/>(บาท)</th><th className="border border-black w-[11%] font-normal text-[11px]">รายการซ่อม</th><th className="border border-black w-[8%] font-normal text-[10px]">จำนวนเงิน<br/>(บาท)</th><th className="border border-black w-[8%] font-normal text-[11px]">หมายเหตุ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageLogs.map((log, i) => (
                                        <tr key={i} className="h-[26px] align-middle font-normal">
                                            <td className="border border-black text-center">{formatDate(log.start_time)}</td><td className="border border-black px-1 text-center truncate max-w-[120px]">{log.driver_name}</td>
                                            
                                            <td className="border border-black px-1 text-center truncate max-w-[120px]">
                                                {extractTaskOnly(log.location)}
                                            </td>

                                            <td className="border border-black p-0 h-full font-normal"><div className="flex divide-x divide-black h-[26px]"><div className="w-1/2 flex items-center justify-center">{log.start_mileage}</div><div className="w-1/2 flex items-center justify-center">{log.end_mileage}</div></div></td>
                                            <td className="border border-black text-center"></td><td className="border border-black text-center">{log.fuel_liters ? Number(log.fuel_liters).toFixed(2) : ''}</td><td className="border border-black text-right px-1">{log.fuel_cost > 0 ? Number(log.fuel_cost).toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                        </tr>
                                        ))}
                                        {emptyRows.map((_, i) => (
                                        <tr key={`empty-${i}`} className="h-[26px] font-normal">
                                            <td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black p-0 h-full"><div className="flex divide-x divide-black h-[26px]"><div className="w-1/2"></div><div className="w-1/2"></div></div></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td><td className="border border-black"></td>
                                        </tr>
                                        ))}
                                        {isLastPage && (
                                            <tr className="h-[30px] font-normal text-[11px] align-middle bg-gray-50 print:bg-transparent">
                                                <td colSpan={3} className="border border-black text-right pr-2">รวม</td><td className="border border-black text-center text-black">{totalDistance > 0 ? totalDistance.toLocaleString() + ' กม.' : '-'}</td><td className="border border-black"></td><td className="border border-black text-center text-black">{totalFuelLiters > 0 ? totalFuelLiters.toFixed(2) : ''}</td><td className="border border-black text-right px-1 text-black">{totalFuelCost > 0 ? totalFuelCost.toLocaleString(undefined, {minimumFractionDigits: 2}) : ''}</td><td className="border border-black"></td><td className="border border-black text-right px-1"></td><td className="border border-black"></td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                <div className="mt-1 pl-12 text-[13px] font-normal">จึงเรียนเพื่อโปรดทราบ</div>
                            </div>
                            
                            <div className="mt-auto pb-2 flex justify-center items-center w-full font-normal text-[13px]">
                                <div className="flex gap-x-28">
                                    <div className="flex flex-col items-center w-[280px]">
                                        <div className="flex w-full items-end h-12 mb-1">
                                            ลงชื่อ 
                                            <div className="border-b border-dotted border-black flex-grow ml-2 h-full relative flex items-end justify-center pb-1">
                                                {driverSigText && <img src={driverSigText} alt="signature" className="max-h-12 max-w-full object-contain" />}
                                            </div>
                                        </div>
                                        <div className="flex w-full items-end my-1">
                                            ( <div className="border-b border-dotted border-black flex-grow mx-1 h-5 text-center font-normal">{driverName}</div> )
                                        </div>
                                        <div className="flex w-full items-end">
                                            ตำแหน่ง <div className="border-b border-dotted border-black flex-grow ml-1 h-5 text-center font-normal">{driverPos}</div>
                                        </div>
                                        <div className="mt-2 text-center font-normal">ผู้ขับยานพาหนะ</div>
                                    </div>

                                    <div className="flex flex-col items-center w-[280px]">
                                        <div className="flex w-full items-end h-12 mb-1">
                                            ลงชื่อ 
                                            <div className="border-b border-dotted border-black flex-grow ml-2 h-full relative flex items-end justify-center pb-1">
                                                {controllerSigText && <img src={controllerSigText} alt="signature" className="max-h-12 max-w-full object-contain" />}
                                            </div>
                                        </div>
                                        <div className="flex w-full items-end my-1">
                                            ( <div className="border-b border-dotted border-black w-full mx-1 h-5 text-center font-normal">{controllerName}</div> )
                                        </div>
                                        <div className="flex w-full items-end">
                                            ตำแหน่ง <div className="border-b border-dotted border-black flex-grow ml-1 h-5 text-center font-normal">{controllerPos}</div>
                                        </div>
                                        <div className="mt-2 text-center font-normal">ผู้ควบคุม</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-8 left-8 text-[10px] font-normal">{isEVCar ? '' : 'ยพ.6-ป.46'}</div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}

// ==========================================
// 2. หน้าฟอร์มบันทึก (Action Form) - อัปเดตใหม่
// ==========================================
function CarActionForm({ carId }) {
  const router = useRouter()
  const [car, setCar] = useState(null)
  const [activeLog, setActiveLog] = useState(null)

  const getCarImage = (c) => {
    if (!c) return null
    const type = c.car_type || ''
    if (type.toUpperCase() === 'รถ EV') return '/mg.png'
    if (type.toUpperCase() === 'รถ EV ทดเเทน') return '/mg2.png'
    if (type.startsWith('รถกระเช้า')) return '/aerial_lift.png'
    if (type.startsWith('รถบรรทุก 2 ตันเเก้ไฟ')) return '/2_ton_truck.png'
    if (type.startsWith('รถเครน')) return '/crane.png'
    if (type.startsWith('รถตู้โดยสาร') || type.startsWith('รถตู้')) return '/van.png'
    if (type.startsWith('รถกระบะ')) return '/truck.png'
    if (type.startsWith('รถบรรทุก 2')) return '/2ton.png'
    if (type.startsWith('รถบรรทุก 1 ตันแก้ไฟ')) return '/1ton.png'
    if (type.startsWith('รถบรรทุก 6 ตัน ฮอทไลน์')) return '/hotline.png'
    if (type.startsWith('รถบรรทุกขุดเจาะ')) return '/3ton.png'
    if (type.startsWith('รถบรรทุก 7.5 ตัน ติดเครนแข็ง')) return '/75ton.png'
    if (type.startsWith('รถบรรทุก 6 ล้อ')) return 'hotline_6.png'
    if (type.startsWith('รถบรรทุก 6 ตัน')) return '/6ton.png'
    if (type.startsWith('รถบรรทุก 3 ตันส่วนบุคคล')) return '/3ton_2.png'
    if (type.startsWith('TEST_CAR')) return '/scooter.png'
    return null
  }

  // Inputs
  const [employeeId, setEmployeeId] = useState('')
  const [staffName, setStaffName] = useState('') 
  const [staffPosition, setStaffPosition] = useState('') 
  const [staffError, setStaffError] = useState(false)
  const [mileage, setMileage] = useState('')
  const [isMileageLocked, setIsMileageLocked] = useState(false)
  
  const [departmentsList, setDepartmentsList] = useState([])
  const [areasList, setAreasList] = useState([])

  const [selectedDept, setSelectedDept] = useState('')
  const [selectedTask, setSelectedTask] = useState('')
  const [customTask, setCustomTask] = useState('') 
  
  // ให้พื้นที่สามารถเพิ่มได้หลายอัน
  const [selectedAreas, setSelectedAreas] = useState([{ type: '', custom: '' }])

  const [selectModal, setSelectModal] = useState({ isOpen: false, type: '', title: '', options: [], targetIndex: null })

  const openSelectModal = (type, targetIndex = null) => {
    if (type === 'task') {
      const deptData = departmentsList.find(d => d.name === selectedDept);
      setSelectModal({ isOpen: true, type: 'task', title: 'เลือกประเภทงาน', options: deptData ? deptData.tasks : [], targetIndex: null });
    } else if (type === 'area') {
      setSelectModal({ isOpen: true, type: 'area', title: 'เลือกพื้นที่ปฏิบัติงาน', options: areasList, targetIndex });
    }
  }

  useEffect(() => {
    const fetchDropdownData = async () => {
      try {
        const { data: deptData, error: deptError } = await supabase.from('departments').select(`id, name, tasks(name)`);
        if (deptError) console.error("Supabase Dept Error:", deptError);
        if (deptData && deptData.length > 0) {
          const formatted = deptData.map(d => {
            let tasks = d.tasks ? d.tasks.map(t => t.name) : [];
            tasks = tasks.filter(t => t !== 'งานอื่นๆ' && t !== 'อื่นๆ');
            tasks.unshift('อื่นๆ'); 
            return { name: d.name, tasks };
          });
          setDepartmentsList(formatted);
        }

        const { data: areaData, error: areaError } = await supabase.from('operation_areas').select('name');
        if (areaError) console.error("Supabase Area Error:", areaError);
        if (areaData && areaData.length > 0) {
          let areas = areaData.map(a => a.name);
          areas = areas.filter(a => a !== 'อื่นๆ');
          areas.unshift('อื่นๆ'); 
          setAreasList(areas);
        }
      } catch (err) {
        console.error("Fetch Data Failed:", err);
      }
    };
    fetchDropdownData();
  }, []);
  
  const [endMileage, setEndMileage] = useState('')
  const [fuelLiters, setFuelLiters] = useState('')
  const [fuelCost, setFuelCost] = useState('')
  const [hasRefueled, setHasRefueled] = useState(null)

  const [battBefore, setBattBefore] = useState('')
  const [battAfter, setBattAfter] = useState('')
  const [stationType, setStationType] = useState('PEA') 
  const [subStationType, setSubStationType] = useState('') 
  const [stationName, setStationName] = useState('') 
  
  const [loading, setLoading] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  const [isSignReminderDismissed, setIsSignReminderDismissed] = useState(false)
  const [showReturnConfirm, setShowReturnConfirm] = useState(false)

  const kfkList = ['กฟจ.นฐ.', 'กฟส.นช.', 'กฟส.บลน.', 'กฟจ.สพ.', 'กฟส.อมง.', 'กฟส.ศปจ.', 'กฟจ.สค.','กฟส.กทบ.','กฟจ.กจ.','กฟส.ทมง.','กฟส.ทมก.','กฟส.สขบ.'];
  const otherBrandList = ['EA Anywhere', 'EV Station', 'MEA EV', 'EGAT', 'Emergency charger'];

  const peaOptions = [
      { id: 'HQ', label: 'สำนักงานใหญ่ (สนญ.)', inputType: 'none' },
      { id: 'PEA_OFFICE', label: 'กฟก. (เลือกสาขา)', inputType: 'dropdown_kfk' }, 
      { id: 'BANGCHAK', label: 'บางจาก (ระบุ)', inputType: 'text' },
      { id: 'PEA_OTHER', label: 'PEA Volta อื่น ๆ (ระบุ)', inputType: 'text' },
  ]
  const otherOptions = [
      { id: 'WALL', label: 'Wall Charge', inputType: 'none' },
      { id: 'OTHER_BRAND', label: 'สถานีชาร์จ อื่น ๆ (เลือก)', inputType: 'dropdown_other' }, 
  ]

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const { data: c } = await supabase.from('cars').select('*').eq('id', carId).single()
      if (c) {
        setCar(c)
        const isThisCarEV = c?.fuel_type?.toUpperCase() === 'EV';

        if (c.status === 'available') {
           const { data: l } = await supabase.from('trip_logs')
             .select('end_mileage')
             .eq('car_id', carId)
             .eq('is_completed', true)
             .order('created_at', { ascending: false })
             .limit(1)
             .single()
           
           if (isThisCarEV) {
               setMileage('')
               setIsMileageLocked(false)
           } else if (l?.end_mileage) {
               setMileage(l.end_mileage.toString())
               setIsMileageLocked(true)
           } else {
               setMileage('0')
           }
        } else {
           const { data: l } = await supabase.from('trip_logs').select('*').eq('car_id', carId).eq('is_completed', false).limit(1).single()
           if (l) setActiveLog(l)
        }
      }
    }
    fetchData()
  }, [carId])

  const checkStaff = async () => {
    if (employeeId.length < 4) return
    const { data, error } = await supabase
      .from('staff')
      .select(`full_name, position, departments ( name )`)
      .eq('staff_code', employeeId)
      .single()

    if (data) {
        setStaffName(data.full_name); 
        setStaffPosition(data.position); 
        setStaffError(false);

        if (data.departments?.name) {
          if (selectedDept !== data.departments.name) {
            setSelectedDept(data.departments.name);
            setSelectedTask(''); 
            setCustomTask('');
          }
        }
    } else {
        setStaffName(''); 
        setStaffPosition(''); 
        setStaffError(true);
        setSelectedDept('');
    }
  }

  const resetStaff = () => {
    setStaffName('');
    setEmployeeId('');
    setStaffPosition('');
    setStaffError(false);
  }

  const handleTakeOut = async () => {
    const isEV = car?.fuel_type?.toUpperCase() === 'EV';
    
    if (!staffName) return alert('กรุณาระบุรหัสพนักงานให้ถูกต้องก่อน');
    if (!mileage) return alert('กรุณากรอกเลขไมล์เริ่มต้น');

    if (isEV) {
        if (!battBefore) return alert('กรุณากรอก % แบตเตอรี่ก่อนชาร์จ')
        if (!subStationType) return alert('กรุณาระบุประเภทสถานีชาร์จ')
        
        const selectedOption = (stationType === 'PEA' ? peaOptions : otherOptions).find(o => o.id === subStationType);
        if (selectedOption?.inputType !== 'none' && !stationName) {
            return alert('กรุณาระบุชื่อสถานี/สาขาให้ครบถ้วน')
        }
    } else {
        if (!selectedDept || !selectedTask) {
            return alert('กรุณาเลือก แผนก และ ประเภทงาน ให้ครบถ้วน')
        }
        if (selectedTask === 'อื่นๆ' && !customTask) return alert('กรุณาระบุประเภทงานอื่นๆ')
        
        // เช็คความครบถ้วนของพื้นที่ปฏิบัติงาน (หลายพื้นที่)
        const hasEmptyAreaType = selectedAreas.some(a => !a.type);
        if (hasEmptyAreaType) return alert('กรุณาเลือกพื้นที่ปฏิบัติงานให้ครบ หรือลบช่องที่ไม่ได้ใช้ออก');
        
        const hasMissingCustom = selectedAreas.some(a => a.type === 'อื่นๆ' && !a.custom);
        if (hasMissingCustom) return alert('กรุณาระบุพื้นที่ปฏิบัติงานอื่นๆ ให้ครบถ้วน');
    }
    
    setLoading(true)

    try {
      const { data: latestCar } = await supabase.from('cars').select('status').eq('id', carId).single()
      if (latestCar.status === 'busy') {
         alert('⚠️ รถคันนี้เพิ่งถูกบุคคลอื่นทำรายการนำออกไปแล้วครับ')
         window.location.href = '/'
         return
      }

      const { data: activeTrips } = await supabase
          .from('trip_logs')
          .select(`car_id, cars ( plate_number )`)
          .eq('driver_name', staffName)
          .eq('is_completed', false);

      if (activeTrips && activeTrips.length > 0) {
          const busyPlate = activeTrips[0].cars?.plate_number || 'รถคันเดิม';
          alert(`⚠️ ไม่อนุญาตให้ทำรายการ!\nคุณ ${staffName} ยังไม่ได้ทำรายการคืนรถทะเบียน [ ${busyPlate} ]\n\nกรุณาสแกนเพื่อคืนรถคันเดิมให้เรียบร้อยก่อนครับ`);
          setLoading(false);
          return;
      }

      let finalLocation = ''
      let finalStationName = ''
      let finalStationType = ''
      let finalBattBefore = null

      if (isEV) {
        const selectedOption = (stationType === 'PEA' ? peaOptions : otherOptions).find(o => o.id === subStationType)
        const label = selectedOption ? selectedOption.label.replace(/ \(.+\)/, '') : ''
        finalStationName = (selectedOption?.inputType !== 'none' && stationName) ? `${label}: ${stationName}` : label
        finalLocation = finalStationName
        finalStationType = stationType
        finalBattBefore = parseInt(battBefore)
      } else {
        const actualTask = selectedTask === 'อื่นๆ' ? customTask : selectedTask;
        const actualAreas = selectedAreas.map(a => a.type === 'อื่นๆ' ? a.custom : a.type);
        finalLocation = `[${selectedDept} - ${actualTask}] ${actualAreas.join(', ')}`;
      }

      const { data: result, error } = await supabase.rpc('take_car_out', {
        p_car_id:          Number(carId),
        p_driver_name:     staffName,
        p_driver_position: staffPosition,
        p_start_mileage:   parseInt(mileage || 0),
        p_location:        finalLocation,
        p_battery_before:  finalBattBefore,
        p_station_type:    finalStationType || null,
        p_station_name:    finalStationName || null,
      })

      if (error) throw error
      if (result?.error) { alert('⚠️ ' + result.error); setLoading(false); return }

      if (isEV) {
        alert(`✅ บันทึกเริ่มการชาร์จสำเร็จ!\nเมื่อชาร์จเสร็จ กรุณาสแกน QR เพื่อนำที่ชาร์จออก`)
      } else {
        alert(`✅ บันทึกสำเร็จ!\nเดินทางปลอดภัยครับ คุณ ${staffName}`)
      }
      window.location.href = '/'

    } catch (err) {
      alert('Error: ' + err.message)
      setLoading(false)
    }
  }

  const handleReturn = async (skipConfirm = false) => {
    const isEV = car?.fuel_type?.toUpperCase() === 'EV';
    const startM = parseFloat(activeLog.start_mileage)

    if (isEV) {
        if (!battAfter) return alert('กรุณากรอก % แบตเตอรี่หลังชาร์จ')
        if (activeLog.battery_before && parseInt(battAfter) <= parseInt(activeLog.battery_before)) {
            return alert('❌ ข้อมูลผิดพลาด!\nเปอร์เซ็นต์แบตเตอรี่ "หลังชาร์จ" ต้องมากกว่า "ก่อนชาร์จ"')
        }
    } else {
        if (!endMileage) return alert('กรุณากรอกเลขไมล์ล่าสุด (จบงาน)')
        const endM = parseFloat(endMileage)
        if (endM < startM) {
            return alert(`❌ เลขไมล์ผิดพลาด!\nเลขไมล์จบ (${endM}) น้อยกว่า เลขไมล์เริ่ม (${startM})`)
        }
        if (hasRefueled === true && (!fuelLiters || !fuelCost)) {
             return alert('กรุณากรอกข้อมูล ปริมาณน้ำมัน (ลิตร) และ จำนวนเงิน (บาท) ให้ครบถ้วน')
        }
        if (skipConfirm !== true) {
            setShowReturnConfirm(true);
            return;
        }
    }

    setLoading(true)

    try {
      const { data: result, error } = await supabase.rpc('return_car', {
        p_car_id:       Number(carId),
        p_end_mileage:  isEV ? null : parseInt(endMileage),
        p_fuel_liters:  (!isEV && hasRefueled && fuelLiters) ? parseFloat(fuelLiters) : 0,
        p_fuel_cost:    (!isEV && hasRefueled && fuelCost) ? parseFloat(fuelCost) : 0,
        p_battery_after: isEV ? parseInt(battAfter) : null,
      })

      if (error) throw error
      if (result?.error) { alert('⚠️ ' + result.error); setLoading(false); return }

      alert('✅ บันทึกข้อมูลเรียบร้อย ขอบคุณครับ!')
      window.location.href = '/'
    } catch (err) {
      alert('Error: ' + err.message)
      setLoading(false)
    }
  }

  if (!car) return (
    <div className="min-h-screen bg-[#f8f3fa] flex items-center justify-center" style={{WebkitFontSmoothing:'antialiased'}}>
      <div className="w-8 h-8 border-[2.5px] border-[#d9cadd] border-t-[#4b1560] rounded-full animate-spin"/>
    </div>
  )

  const isEV = car?.fuel_type?.toUpperCase() === 'EV';
  const currentDay = currentTime.getDate();
  const isSigningPeriod = currentDay >= 28 || currentDay <= 5;
  const showSignReminder = isSigningPeriod && !isSignReminderDismissed && car.status === 'available';

  return (
    <div className="min-h-screen bg-[#f8f3fa] font-sarabun pb-16" style={{WebkitFontSmoothing:'antialiased'}}>
      <style>{`
        * { -webkit-font-smoothing: antialiased; }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeDown { animation: fadeDown 0.3s ease-out forwards; }
      `}</style>

      {/* ── Popup เซ็นเอกสาร ── */}
      {showSignReminder && (
        <div className="fixed inset-0 z-[998] flex items-end sm:items-center justify-center"
             style={{background:'rgba(0,0,0,0.45)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)'}}>
          <div className="bg-[#f8f3fa] w-full max-w-[380px] rounded-t-[24px] sm:rounded-[24px] p-6 text-center"
               style={{boxShadow:'0 24px 80px rgba(0,0,0,0.3)'}}>
            <div className="flex justify-center mb-3">
              <Icon icon="ph:signature-duotone" width="56" height="56" className="text-[#702082]" />
            </div>
            <h3 className="text-[20px] font-semibold text-[#4b1560] mb-2 tracking-[-0.4px]">ถึงเวลาเซ็นเอกสาร</h3>
            <p className="text-[14px] text-[#765c7c] mb-6 leading-relaxed">
              อยู่ในช่วงเวลาเซ็นเอกสารประจำเดือน<br/>อย่าลืมเข้าไปเซ็นชื่อที่หน้ารายงาน (ไอคอน <Icon icon="ph:printer-duotone" width="16" height="16" className="inline text-[#8b3c98]" />)
            </p>
            <button onClick={() => setIsSignReminderDismissed(true)}
              className="w-full bg-[#4b1560] text-white py-4 rounded-[16px] text-[16px] font-semibold active:bg-[#702082] transition-colors">
              รับทราบ
            </button>
          </div>
        </div>
      )}

      {/* ── Popup ยืนยันเลขไมล์ ── */}
      {showReturnConfirm && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center"
             style={{background:'rgba(0,0,0,0.45)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)'}}>
          <div className="bg-[#f8f3fa] w-full max-w-[380px] rounded-t-[24px] sm:rounded-[24px] p-6"
               style={{boxShadow:'0 24px 80px rgba(0,0,0,0.3)'}}>
            <div className="flex justify-center mb-3">
              <Icon icon="ph:map-pin-line-duotone" width="56" height="56" className="text-[#ff3b30]" />
            </div>
            <h3 className="text-[20px] font-semibold text-[#4b1560] mb-4 tracking-[-0.4px] text-center">ตรวจสอบเลขไมล์</h3>
            <div className="bg-white rounded-[16px] p-4 mb-5 space-y-3"
                 style={{boxShadow:'0 1px 3px rgba(0,0,0,0.06), 0 0 0 0.5px rgba(0,0,0,0.08)'}}>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#765c7c]">ไมล์ก่อนเดินทาง</span>
                <span className="text-[14px] font-semibold text-[#4b1560]">{parseFloat(activeLog?.start_mileage).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[14px] text-[#765c7c]">ไมล์ล่าสุด (จบงาน)</span>
                <span className="text-[14px] font-semibold text-[#4b1560]">{parseFloat(endMileage).toLocaleString()}</span>
              </div>
              <div className="border-t border-[#f8f3fa] pt-3 flex justify-between items-center">
                <span className="text-[14px] text-[#4b1560] font-semibold">ระยะทาง</span>
                <span className="text-[20px] font-bold text-[#34c759]">{(parseFloat(endMileage) - parseFloat(activeLog?.start_mileage)).toLocaleString()} <span className="text-[13px] font-normal text-[#765c7c]">กม.</span></span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowReturnConfirm(false); handleReturn(true); }}
                className="flex-1 bg-[#4b1560] text-white py-4 rounded-[16px] text-[16px] font-semibold active:bg-[#702082] transition-colors">
                ยืนยัน
              </button>
              <button onClick={() => setShowReturnConfirm(false)}
                className="flex-1 bg-[#eadfed] text-[#4b1560] py-4 rounded-[16px] text-[16px] font-semibold active:bg-[#d1d1d6] transition-colors">
                แก้ไข
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Nav (transparent over hero) ── */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[52px] flex items-center px-5">
        <button onClick={() => window.location.href = '/'}
          className="flex items-center gap-1.5 text-[15px] font-medium active:opacity-60 transition-opacity"
          style={{color: getCarImage(car) ? 'white' : '#702082', textShadow: getCarImage(car) ? '0 1px 4px rgba(0,0,0,0.3)' : 'none'}}>
          <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
            <path d="M8 1L1 7.5L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          กลับ
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => window.open(`/report?car_id=${car.id}`, '_blank')}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] transition-all active:scale-90"
            style={{background:'rgba(255,255,255,0.2)', backdropFilter:'blur(10px)'}}>
            <Icon icon="ph:printer-duotone" width="20" height="20" className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className={`relative w-full overflow-hidden`}
           style={{height:'55vh', minHeight:'280px', maxHeight:'380px'}}>
        {getCarImage(car) ? (
          <>
            <img src={getCarImage(car)} alt={car.car_type}
              className="absolute inset-0 w-full h-full object-cover"/>
            <div className="absolute inset-0"
                 style={{background:'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)'}}/>
          </>
        ) : (
          <div className={`absolute inset-0 flex items-center justify-center ${
            isEV ? 'bg-gradient-to-b from-[#a8d4ff] to-[#eadfed]'
            : car.status === 'busy' ? 'bg-gradient-to-b from-[#ffb3ae] to-[#ffe5e3]'
            : 'bg-gradient-to-b from-[#a8f0c4] to-[#d4f5e0]'
          }`}>
            <span className="flex items-center justify-center" style={{filter:'drop-shadow(0 8px 24px rgba(0,0,0,0.12))'}}>
              {isEV ? <Icon icon="ph:lightning-duotone" width="100" height="100" className="text-[#702082]" /> : <Icon icon="ph:car-profile-duotone" width="100" height="100" className="text-[#34c759]" />}
            </span>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-white/70 text-[13px] font-medium mb-1"
                 style={{textShadow:'0 1px 4px rgba(0,0,0,0.4)'}}>
                {car.model} · {car.car_type}
              </p>
              <h1 className="text-white text-[34px] font-bold tracking-[-1px] leading-none"
                  style={{textShadow:'0 2px 12px rgba(0,0,0,0.3)'}}>
                {car.plate_number}
              </h1>
            </div>
            <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border ${
              car.status === 'busy'
                ? 'bg-[rgba(255,59,48,0.15)] text-white border-[rgba(255,255,255,0.3)]'
                : 'bg-[rgba(52,199,89,0.2)] text-white border-[rgba(255,255,255,0.3)]'
            }`} style={{backdropFilter:'blur(12px)', textShadow:'none'}}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${car.status === 'busy' ? 'bg-[#ff6b63] animate-pulse' : 'bg-[#4cd964]'}`}/>
              {car.status === 'busy' ? (isEV ? 'กำลังชาร์จ' : 'กำลังใช้งาน') : (isEV ? 'พร้อมชาร์จ' : 'ว่างพร้อมใช้')}
            </span>
          </div>
        </div>
      </div>

      {/* ── Form Sheet ── */}
      <div className="relative -mt-5 rounded-t-[28px] bg-[#f8f3fa] pb-16 min-h-[50vh]"
           style={{boxShadow:'0 -4px 20px rgba(0,0,0,0.08)'}}>

        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#c7c7cc]"/>
        </div>

        <div className="px-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-[14px] flex items-center justify-center ${
              car.status === 'available'
                ? isEV ? 'bg-[#702082]' : 'bg-[#34c759]'
                : 'bg-[#ff3b30]'
            }`}>
              {car.status === 'available' ? (isEV ? <Icon icon="ph:lightning-duotone" width="24" height="24" className="text-white" /> : <Icon icon="ph:car-profile-duotone" width="24" height="24" className="text-white" />) : (isEV ? <Icon icon="ph:plug-duotone" width="24" height="24" className="text-white" /> : <Icon icon="ph:arrow-bend-down-left-duotone" width="24" height="24" className="text-white" />)}
            </div>
            <div>
              <p className="text-[18px] font-bold text-[#4b1560] tracking-[-0.4px]">
                {car.status === 'available' ? (isEV ? 'เริ่มชาร์จรถ' : 'นำรถออก') : (isEV ? 'นำที่ชาร์จออก' : 'คืนรถ')}
              </p>
              {car.status === 'busy' && (
                <p className="text-[12px] text-[#765c7c]">เวลา {currentTime.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'})} น.</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 space-y-3">
          {car.status === 'available' ? (
            <>
              {/* ================================== */}
              {/* 🟢 STEP 1: รหัสพนักงาน (บังคับทำก่อน) */}
              {/* ================================== */}
              <div className="bg-white rounded-[20px] px-5 py-4"
                   style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                <div className="flex justify-between items-center mb-3">
                  <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em]">1. ระบุตัวตนผู้ขับขี่</p>
                  {staffName && (
                    <button onClick={resetStaff} className="text-[12px] font-medium text-[#702082] active:opacity-60">
                      เปลี่ยนรหัส
                    </button>
                  )}
                </div>

                {!staffName ? (
                  <>
                    <input type="text" value={employeeId}
                      onChange={e => { setEmployeeId(e.target.value); setStaffError(false); }}
                      onBlur={checkStaff} 
                      onKeyDown={e => e.key === 'Enter' && checkStaff()}
                      placeholder="กรอกรหัสพนักงาน แล้วกด Enter"
                      className={`w-full px-4 py-3.5 rounded-[14px] text-[17px] font-medium outline-none transition-all ${
                        staffError ? 'bg-[#fff2f0] border-[1.5px] border-[#ff3b30] text-[#d70015]'
                        : 'bg-[#f8f3fa] border-[1.5px] border-transparent focus:bg-white focus:border-[#702082]'
                      }`}/>
                    {staffError && (
                      <div className="flex items-center gap-2 mt-3 bg-[#fff2f0] px-3 py-2.5 rounded-[12px]">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="9" fill="#ff3b30"/><path d="M6 6l6 6M12 6l-6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        <span className="text-[13px] font-medium text-[#d70015]">ไม่พบรหัสพนักงานนี้</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center gap-3 bg-[#edfbf0] px-4 py-3 rounded-[14px] animate-fadeDown">
                    <div className="w-10 h-10 rounded-full bg-[#34c759]/20 flex items-center justify-center">
                      <Icon icon="ph:user-circle-check-duotone" width="24" height="24" className="text-[#34c759]" />
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-[#1a7f37]">{staffName}</p>
                      <p className="text-[12px] text-[#248a3d]">{staffPosition}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ================================== */}
              {/* 🟢 STEP 2: เลขไมล์ และ รายละเอียดงาน (จะโชว์ก็ต่อเมื่อมี staffName แล้ว) */}
              {/* ================================== */}
              {!staffName ? (
                 <div className="flex flex-col items-center justify-center py-10 opacity-50">
                    <span className="mb-2 drop-shadow-sm">
                      <Icon icon="ph:lock-key-duotone" width="48" height="48" className="text-[#c7c7cc]" />
                    </span>
                    <p className="text-[14px] font-medium text-[#765c7c]">กรุณาระบุรหัสพนักงานเพื่อทำรายการต่อ</p>
                 </div>
              ) : (
                <div className="space-y-3 animate-fadeDown">
                  {/* เลขไมล์ */}
                  <div className="bg-white rounded-[20px] px-5 py-4"
                       style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em]">
                        {isEV ? '2. เลขไมล์ล่าสุด' : '2. เลขไมล์เริ่มต้น'}
                      </p>
                      {isMileageLocked && (
                        <span className="text-[11px] font-medium text-[#702082] flex items-center gap-1 bg-[#f3eaf5] px-2 py-0.5 rounded-full">
                          <Icon icon="ph:lock-key-duotone" width="14" height="14" className="text-[#702082]" /> ต่อเนื่อง
                        </span>
                      )}
                    </div>
                    <input type="number" value={mileage} readOnly={isMileageLocked}
                      onChange={e => setMileage(e.target.value)}
                      placeholder="000000"
                      className={`w-full px-4 py-3 rounded-[14px] text-[28px] font-mono font-bold tracking-wider outline-none transition-all text-center ${
                        isMileageLocked
                          ? 'bg-[#f8f3fa] text-[#aeaeb2] cursor-not-allowed border-[1.5px] border-transparent'
                          : 'bg-[#f8f3fa] text-[#4b1560] border-[1.5px] border-transparent focus:bg-white focus:border-[#702082]'
                      }`}/>
                  </div>

                  {isEV ? (
                    <>
                      {/* %แบต */}
                      <div className="bg-white rounded-[20px] px-5 py-4"
                       style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                        <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em] mb-3">3. แบตเตอรี่ก่อนชาร์จ</p>
                        <div className="relative flex items-center justify-center">
                          <input type="number" value={battBefore} onChange={e => setBattBefore(e.target.value)}
                            placeholder="0" min="0" max="100"
                            className="w-full px-4 py-3 rounded-[14px] text-[28px] font-mono font-bold text-center outline-none bg-[#f8f3fa] border-[1.5px] border-transparent focus:bg-white focus:border-[#702082] transition-all text-[#4b1560]"/>
                          <span className="absolute right-5 text-[20px] font-bold text-[#aeaeb2]">%</span>
                        </div>
                      </div>

                      {/* สถานี */}
                      <div className="bg-white rounded-[20px] overflow-hidden"
                           style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                        <div className="px-5 pt-4 pb-3">
                          <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em] mb-3">4. ประเภทสถานีชาร์จ</p>
                          <div className="grid grid-cols-2 gap-2">
                            {['PEA','OTHER'].map(t => (
                              <button key={t} onClick={() => { setStationType(t); setSubStationType(''); setStationName(''); }}
                                className={`py-3.5 rounded-[14px] text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.97] ${
                                  stationType === t ? 'bg-[#4b1560] text-white' : 'bg-[#f8f3fa] text-[#5f4664]'
                                }`}>
                                {t === 'PEA' ? <><Icon icon="ph:lightning-duotone" width="18" height="18" className={stationType === 'PEA' ? 'text-white' : 'text-[#702082]'}/> PEA Volta</> : <><Icon icon="ph:plug-duotone" width="18" height="18" className={stationType === 'OTHER' ? 'text-white' : 'text-[#ff9f0a]'}/> แบรนด์อื่น</>}
                              </button>
                            ))}
                          </div>
                        </div>
                        {(stationType === 'PEA' ? peaOptions : otherOptions).map((opt) => (
                          <button key={opt.id} onClick={() => { setSubStationType(opt.id); setStationName(''); }}
                            className={`w-full flex items-center justify-between px-5 py-4 text-[15px] font-medium transition-colors ${
                              subStationType === opt.id ? 'bg-[#f0f9ff] text-[#702082]' : 'text-[#4b1560]'
                            }`}
                            style={{borderTop:'0.5px solid rgba(60,60,67,0.08)'}}>
                            {opt.label}
                            {subStationType === opt.id && (
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#702082"/><path d="M6 10l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            )}
                          </button>
                        ))}
                      </div>

                      {(() => {
                        const sel = (stationType === 'PEA' ? peaOptions : otherOptions).find(o => o.id === subStationType);
                        if (!sel || sel.inputType === 'none') return null;
                        return (
                          <div className="bg-white rounded-[20px] px-5 py-4"
                               style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                            <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em] mb-3">รายละเอียด</p>
                            {sel.inputType === 'text' ? (
                              <input type="text" value={stationName} onChange={e => setStationName(e.target.value)} placeholder="ระบุชื่อสถานี..."
                                className="w-full px-4 py-3.5 rounded-[14px] text-[16px] outline-none bg-[#f8f3fa] border-[1.5px] border-transparent focus:bg-white focus:border-[#702082] transition-all"/>
                            ) : (
                              <select value={stationName} onChange={e => setStationName(e.target.value)}
                                className="w-full px-4 py-3.5 rounded-[14px] text-[16px] outline-none bg-[#f8f3fa] border-[1.5px] border-transparent">
                                <option value="" disabled>-- กรุณาเลือก --</option>
                                {(sel.inputType === 'dropdown_kfk' ? kfkList : otherBrandList).map(k => <option key={k} value={k}>{k}</option>)}
                              </select>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  ) : (
                    /* สถานที่ (รูปแบบ Modern App UI) */
                    <div className="bg-white rounded-[20px] overflow-hidden"
                         style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                      <div className="px-5 pt-4 pb-3 border-b border-[rgba(0,0,0,0.05)]">
                        <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em]">3. รายละเอียดการปฏิบัติงาน</p>
                      </div>
                      
                      <div className="px-5 py-4 space-y-5">
                        
                        {/* แผนก */}
                        <div>
                          <p className="text-[13px] font-medium text-[#4b1560] mb-2.5">แผนก</p>
                          <div className={`w-full px-4 py-3.5 rounded-[14px] border-[1.5px] flex items-center justify-between transition-colors ${
                            selectedDept ? 'bg-[#edfbf0] border-[#34c759]' : 'bg-[#f8f3fa] border-transparent'
                          }`}>
                            <span className={`text-[15px] ${selectedDept ? 'text-[#1a7f37] font-semibold' : 'text-[#aeaeb2] font-medium'}`}>
                              {selectedDept || 'กรุณากรอกรหัสพนักงาน...'}
                            </span>
                            {selectedDept && (
                              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="9" fill="#34c759"/><path d="M5 9l3 3 5-5.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            )}
                          </div>
                        </div>

                        {/* เลือกงาน */}
                        <div className={`transition-opacity ${!selectedDept ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                          <p className="text-[13px] font-medium text-[#4b1560] mb-2.5">ประเภทงาน</p>
                          <button onClick={() => openSelectModal('task')}
                            className={`w-full flex items-center justify-between px-4 py-3.5 rounded-[14px] text-[15px] outline-none border-[1.5px] transition-all ${
                              selectedTask ? 'bg-[#f0f9ff] border-[#702082] text-[#702082]' : 'bg-[#f8f3fa] border-transparent text-[#765c7c]'
                            }`}>
                            <span className="truncate">{selectedTask || '-- แตะเพื่อเลือกงาน --'}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                          </button>
                          {selectedTask === 'อื่นๆ' && (
                            <div className="mt-2 animate-fadeIn relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2">
                                <Icon icon="ph:pencil-line-duotone" width="20" height="20" className="text-[#702082]" />
                              </span>
                              <input type="text" value={customTask} onChange={e => setCustomTask(e.target.value)}
                                placeholder="ระบุประเภทงาน..." autoFocus
                                className="w-full pl-11 pr-4 py-3.5 rounded-[14px] text-[15px] outline-none bg-white border-[1.5px] border-[#702082] transition-all text-[#4b1560] shadow-[0_2px_8px_rgba(0,113,227,0.1)]"/>
                            </div>
                          )}
                        </div>

                        {/* เลือกพื้นที่หลายจุด */}
                        <div className="pt-3 border-t border-[rgba(0,0,0,0.05)]">
                          <div className="flex items-center justify-between mb-2.5">
                            <p className="text-[13px] font-medium text-[#4b1560]">พื้นที่ปฏิบัติงาน</p>
                            <button onClick={() => setSelectedAreas([...selectedAreas, { type: '', custom: '' }])}
                              className="text-[12px] font-semibold text-[#702082] bg-[#f3eaf5] px-2.5 py-1 rounded-full active:scale-95 transition-all">
                              + เพิ่มพื้นที่
                            </button>
                          </div>
                          
                          <div className="space-y-3">
                            {selectedAreas.map((area, index) => (
                              <div key={index} className="flex gap-2">
                                <div className="flex-1 space-y-2">
                                  <button onClick={() => openSelectModal('area', index)}
                                    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-[14px] text-[15px] outline-none border-[1.5px] transition-all ${
                                      area.type ? 'bg-[#f0f9ff] border-[#702082] text-[#702082]' : 'bg-[#f8f3fa] border-transparent text-[#765c7c]'
                                    }`}>
                                    <span className="truncate">{area.type || '-- แตะเพื่อเลือกพื้นที่ --'}</span>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                  </button>
                                  {area.type === 'อื่นๆ' && (
                                    <div className="animate-fadeIn relative">
                                      <span className="absolute left-4 top-1/2 -translate-y-1/2">
                                        <Icon icon="ph:map-pin-plus-duotone" width="20" height="20" className="text-[#ff3b30]" />
                                      </span>
                                      <input type="text" value={area.custom} 
                                        onChange={e => {
                                          const newA = [...selectedAreas];
                                          newA[index].custom = e.target.value;
                                          setSelectedAreas(newA);
                                        }}
                                        placeholder="ระบุสถานที่..." autoFocus
                                        className="w-full pl-11 pr-4 py-3.5 rounded-[14px] text-[15px] outline-none bg-white border-[1.5px] border-[#702082] transition-all text-[#4b1560] shadow-[0_2px_8px_rgba(0,113,227,0.1)]"/>
                                    </div>
                                  )}
                                </div>
                                {selectedAreas.length > 1 && (
                                  <button onClick={() => {
                                      const newA = [...selectedAreas];
                                      newA.splice(index, 1);
                                      setSelectedAreas(newA);
                                    }}
                                    className="w-[48px] h-auto flex items-center justify-center bg-[#fff2f0] text-[#ff3b30] rounded-[14px] flex-shrink-0 active:scale-95 transition-all">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* 🟢 ปุ่มยืนยัน */}
                  <button onClick={handleTakeOut} disabled={loading}
                    className={`w-full py-[18px] rounded-[20px] text-[17px] font-semibold tracking-[-0.3px] transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                      loading ? 'bg-[#aeaeb2] text-white cursor-not-allowed' : 'text-white'
                    }`}
                    style={!loading ? {
                      background:'linear-gradient(135deg, #4b1560 0%, #702082 100%)',
                      boxShadow:'0 4px 20px rgba(0,0,0,0.25)'
                    } : {}}>
                    {loading ? 'กำลังบันทึก...' : (isEV ? <><Icon icon="ph:lightning-duotone" width="22" height="22"/> ยืนยันเริ่มชาร์จ</> : 'ยืนยันนำรถออก')}
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* ข้อมูลผู้ใช้รถ (ใช้สำหรับตอนคืนรถ เหมือนเดิม) */}
              <div className="bg-white rounded-[20px] px-5 py-4 flex items-center gap-4"
                   style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                <div className="w-11 h-11 rounded-full bg-[#fff2f0] flex items-center justify-center flex-shrink-0">
                  <span className="w-3 h-3 rounded-full bg-[#ff3b30] animate-pulse"/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-semibold text-[#4b1560] truncate">{activeLog?.driver_name}</p>
                  {isEV ? (
                    <p className="text-[12px] text-[#765c7c] flex items-center gap-1">
                      <Icon icon="ph:battery-charging-duotone" width="16" height="16" className="text-[#34c759]" /> {activeLog?.battery_before}% · 
                      <Icon icon="ph:map-pin-duotone" width="16" height="16" className="text-[#ff3b30]" /> {activeLog?.station_name}
                    </p>
                  ) : (
                    <p className="text-[12px] text-[#765c7c]">ออกที่ไมล์ {activeLog?.start_mileage?.toLocaleString()}</p>
                  )}
                </div>
              </div>

              {isEV ? (
                <div className="bg-white rounded-[20px] px-5 py-4"
                     style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                  <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em] mb-3">แบตเตอรี่หลังชาร์จ</p>
                  <div className="relative">
                    <input type="number" value={battAfter} onChange={e => setBattAfter(e.target.value)}
                      placeholder="0" min="0" max="100"
                      className="w-full px-4 py-4 rounded-[14px] text-[36px] font-mono font-bold text-center outline-none bg-[#f8f3fa] border-[1.5px] border-transparent focus:bg-white focus:border-[#702082] transition-all text-[#4b1560]"/>
                    <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[24px] font-bold text-[#aeaeb2]">%</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-[20px] px-5 py-4"
                       style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                    <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em] mb-3">เลขไมล์ล่าสุด (จบงาน)</p>
                    <input type="number" value={endMileage} onChange={e => setEndMileage(e.target.value)}
                      placeholder="000000"
                      className="w-full px-4 py-3 rounded-[14px] text-[28px] font-mono font-bold tracking-wider text-center outline-none bg-[#f8f3fa] border-[1.5px] border-transparent focus:bg-white focus:border-[#702082] transition-all text-[#4b1560]"/>
                  </div>

                  <div className="bg-white rounded-[20px] overflow-hidden"
                       style={{boxShadow:'0 1px 1px rgba(0,0,0,0.03), 0 4px 16px rgba(0,0,0,0.06)'}}>
                    <div className="px-5 pt-4 pb-3">
                      <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em] mb-3">มีการเติมน้ำมันหรือไม่?</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[{v:true,l:'เติมน้ำมัน',i:'gas-pump-duotone'},{v:false,l:'ไม่ได้เติม',i:''}].map(item => (
                          <button key={String(item.v)} onClick={() => { setHasRefueled(item.v); setFuelLiters(''); setFuelCost(''); }}
                            className={`py-3.5 rounded-[14px] text-[14px] font-semibold flex justify-center items-center gap-1.5 transition-all active:scale-[0.97] ${
                              hasRefueled === item.v ? 'bg-[#4b1560] text-white' : 'bg-[#f8f3fa] text-[#5f4664]'
                            }`}>
                            {item.i && <Icon icon={`ph:${item.i}`} width="20" height="20" className={hasRefueled === item.v ? 'text-white' : 'text-[#ff9f0a]'} />} {item.l}
                          </button>
                        ))}
                      </div>
                    </div>
                    {hasRefueled === true && (
                      <div className="px-5 pb-4 grid grid-cols-2 gap-3 border-t border-[rgba(0,0,0,0.05)] pt-4">
                        <div>
                          <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em] mb-2">ปริมาณ (ลิตร)</p>
                          <input type="number" value={fuelLiters} onChange={e => setFuelLiters(e.target.value)} placeholder="0.00"
                            className="w-full px-3 py-3.5 rounded-[14px] text-[18px] font-mono font-semibold text-center outline-none bg-[#f8f3fa] border-[1.5px] border-transparent focus:bg-white focus:border-[#702082] transition-all"/>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-[#765c7c] uppercase tracking-[0.07em] mb-2">จำนวนเงิน (บาท)</p>
                          <input type="number" value={fuelCost} onChange={e => setFuelCost(e.target.value)} placeholder="0"
                            className="w-full px-3 py-3.5 rounded-[14px] text-[18px] font-mono font-semibold text-center outline-none bg-[#f8f3fa] border-[1.5px] border-transparent focus:bg-white focus:border-[#702082] transition-all"/>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              <button onClick={() => handleReturn(false)} disabled={loading || (!isEV && hasRefueled === null)}
                className={`w-full py-[18px] rounded-[20px] text-[17px] font-semibold tracking-[-0.3px] transition-all active:scale-[0.98] ${
                  loading ? 'bg-[#aeaeb2] text-white cursor-not-allowed'
                  : (!isEV && hasRefueled === null) ? 'bg-[#eadfed] text-[#aeaeb2] cursor-not-allowed'
                  : 'text-white'
                }`}
                style={(!loading && !(!isEV && hasRefueled === null)) ? {
                  background:'linear-gradient(135deg, #4b1560 0%, #702082 100%)',
                  boxShadow:'0 4px 20px rgba(0,0,0,0.25)'
                } : {}}>
                {loading ? 'กำลังบันทึก...' : (isEV ? 'ยืนยันเลิกชาร์จ  →' : 'ยืนยันคืนรถ  →')}
              </button>

              {!isEV && hasRefueled === null && (
                <p className="text-center text-[12px] text-[#ff3b30] font-medium -mt-1">กรุณาเลือกก่อนว่ามีการเติมน้ำมันหรือไม่</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal แบบ List เลือกอย่างเดียว ── */}
      {selectModal.isOpen && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40"
               style={{backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)'}}
               onClick={() => setSelectModal({ ...selectModal, isOpen: false })}/>
          
          <div className="relative w-full max-w-[440px] bg-[#f8f3fa] rounded-t-[24px] sm:rounded-[24px] z-10 max-h-[75vh] flex flex-col overflow-hidden animate-slideUp"
               style={{boxShadow:'0 -4px 60px rgba(0,0,0,0.22)'}}>
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 bg-white border-b border-[rgba(0,0,0,0.05)] z-10">
              <span className="text-[17px] font-semibold text-[#4b1560] tracking-[-0.4px]">{selectModal.title}</span>
              <button onClick={() => setSelectModal({ ...selectModal, isOpen: false })}
                className="w-[28px] h-[28px] rounded-full bg-[#eadfed] flex items-center justify-center text-[13px] text-[#5f4664] font-bold active:bg-[#d1d1d6]">
                ✕
              </button>
            </div>

            {/* List ตัวเลือก */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectModal.options.map((opt) => {
                  const isSelected = (selectModal.type === 'task' ? selectedTask : selectedAreas[selectModal.targetIndex]?.type) === opt;
                  const isOther = opt === 'อื่นๆ' || opt === 'งานอื่นๆ';
                  
                  return (
                    <button key={opt}
                      onClick={() => {
                        if (selectModal.type === 'task') { 
                            setSelectedTask(opt); 
                            setCustomTask(''); 
                        } else if (selectModal.type === 'area') { 
                            const newA = [...selectedAreas];
                            newA[selectModal.targetIndex].type = opt;
                            newA[selectModal.targetIndex].custom = '';
                            setSelectedAreas(newA);
                        }
                        setSelectModal({ ...selectModal, isOpen: false });
                      }}
                      className={`w-full flex items-center justify-between px-5 py-4 rounded-[14px] bg-white text-left transition-all active:scale-[0.98] ${
                        isSelected ? 'border-[1.5px] border-[#702082] shadow-[0_2px_8px_rgba(0,113,227,0.12)]' : 'border-[1.5px] border-transparent shadow-sm'
                      }`}>
                      <div className="flex items-center gap-3">
                        {isOther && <Icon icon="ph:pencil-line-duotone" width="22" height="22" className="text-[#ff9f0a]" />}
                        <span className={`text-[15px] ${isSelected ? 'text-[#702082] font-semibold' : isOther ? 'text-[#ff9f0a] font-medium' : 'text-[#4b1560]'}`}>
                          {opt}
                        </span>
                      </div>
                      {isSelected && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="12" fill="#702082"/><path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                  )
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
