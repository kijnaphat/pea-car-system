'use client'

import { Component, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Car, LayoutGrid, Route, Zap, Wrench, Search, ZoomIn, ZoomOut, RotateCcw, Tag, Maximize2, Minimize2, QrCode, Play, Pause, ArrowUpRight, X, CalendarDays, Clock, Layers } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { loadFleetSnapshot } from '@/lib/fleetSnapshot'
import { startVisiblePolling } from '@/lib/visiblePolling'
import { FLEET_STATUSES, dayBounds, demoSnapshot, fleetVehicles, movementEvents, replaySnapshot } from '@/lib/fleetDigitalTwin'
import { getCarImage } from '@/lib/carImages'
import { vehicleStyle } from '@/lib/fleetVehicleStyle'
import FleetVehicleGlyph from './FleetVehicleGlyph'
import './fleet-twin.css'

const Scene = dynamic(() => import('./FleetScene'), { ssr: false, loading: () => <div className="twin-loading">กำลังจัดลานรถ 3D…</div> })
const empty = { carsDataRaw: [], activeLogs: [], latestLogs: [], latestCharges: [], parkingSlots: [], maintenanceRecords: [] }
const icons = { available: Car, on_trip: Route, charging: Zap, maintenance: Wrench, unknown: Clock }
const todayThai = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
const timeText = value => value ? new Date(value).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'ยังไม่มีข้อมูล'
const clockText = seconds => `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}`

class SceneBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

function Status({ status }) {
  const info = FLEET_STATUSES[status] || FLEET_STATUSES.unknown
  return <span className="twin-status" style={{ color: info.color }}><i style={{ background: info.color }} />{info.label}</span>
}

export default function FleetDigitalTwin({ onAnalytics }) {
  const [mode, setMode] = useState('live')
  const [snapshot, setSnapshot] = useState(empty)
  const [scene, setScene] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [labels, setLabels] = useState(true)
  const [safeMap, setSafeMap] = useState(false)
  const [expandedMap, setExpandedMap] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [view, setView] = useState({ zoom: 1.08, top: false, reset: 0 })
  const [focus, setFocus] = useState(null)
  const [day, setDay] = useState(todayThai)
  const [replayLogs, setReplayLogs] = useState([])
  const [seconds, setSeconds] = useState(0)
  const [replayMax, setReplayMax] = useState(86399)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(60)
  const [refreshRevision, setRefreshRevision] = useState(0)
  const [sceneEpoch, setSceneEpoch] = useState(0)
  const [clock, setClock] = useState(null)
  const demo = useRef(null); const demoSequence = useRef(0); const seenEvents = useRef(new Set())
  const replayRequest = useRef(0)
  const previousScene = useRef(null)
  const labelsHost = useRef(null)

  const accept = useCallback((next, animate = true) => {
    const vehicles = fleetVehicles(next)
    const moves = animate ? movementEvents(previousScene.current?.vehicles, vehicles).filter(event => {
        if (seenEvents.current.has(event.key)) return false
        seenEvents.current.add(event.key); return true
      }) : []
    const nextScene = { vehicles, moves: [...(animate ? previousScene.current?.moves || [] : []), ...moves].slice(-128) }
    previousScene.current = nextScene
    setScene(nextScene)
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => setReduced(media.matches)
    change(); media.addEventListener('change', change)
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => { media.removeEventListener('change', change); window.clearInterval(timer) }
  }, [])

  useEffect(() => {
    if (mode !== 'live') return
    let cancelled = false
    const refresh = async () => {
      try {
        let storage
        try { storage = window.sessionStorage } catch { /* Optional cache marker. */ }
        const next = await loadFleetSnapshot({ storage, loadFresh: async () => {
          const { data, error: rpcError } = await supabase.rpc('get_public_fleet_snapshot')
          if (rpcError) throw rpcError
          return data
        } })
        if (cancelled) return
        setSnapshot(next); accept(next); setError(''); setBusy(false)
      } catch (err) {
        if (!cancelled) { setError(err.message || 'เชื่อมต่อข้อมูลไม่สำเร็จ'); setBusy(false) }
      }
    }
    const stop = startVisiblePolling(refresh)
    return () => { cancelled = true; stop() }
  }, [mode, accept, refreshRevision])

  useEffect(() => {
    if (mode !== 'replay') return
    const request = ++replayRequest.current
    const load = async () => {
      setBusy(true); setError('')
      try {
        const bounds = dayBounds(day)
        if (!Number.isFinite(bounds.start)) throw new Error('กรุณาเลือกวันที่ให้ถูกต้อง')
        const ids = snapshot.carsDataRaw.map(car => car.id)
        if (!ids.length) throw new Error('รอโหลดข้อมูลรถจริงก่อนเปิดย้อนหลัง')
        const rows = []
        for (let from = 0; ; from += 1000) {
          const { data, error: queryError } = await supabase.from('trip_logs')
            .select('id,car_id,activity_type,parent_trip_log_id,driver_name,driver_position,start_time,end_time,start_mileage,end_mileage,battery_before,battery_after,station_type,station_name,location,is_completed')
            .in('car_id', ids).lt('start_time', new Date(bounds.end).toISOString())
            .or(`end_time.is.null,end_time.gte.${new Date(bounds.start).toISOString()}`)
            .order('start_time', { ascending: true }).order('id', { ascending: true }).range(from, from + 999)
          if (queryError) throw queryError
          rows.push(...data)
          if (data.length < 1000) break
          if (rows.length >= 5000) throw new Error('ประวัติวันนี้มีจำนวนมากเกินขอบเขตการแสดงผล')
        }
        if (request !== replayRequest.current) return
        setReplayLogs(rows); setSeconds(0)
        setReplayMax(Math.min(86399,Math.max(0,Math.floor((Date.now()-bounds.start)/1000))))
        accept(replaySnapshot(snapshot, rows, bounds.start), false)
      } catch (err) { if (request === replayRequest.current) setError(err.message) }
      finally { if (request === replayRequest.current) setBusy(false) }
    }
    load()
    return () => { replayRequest.current++ }
  }, [mode, day, snapshot, accept, refreshRevision])

  useEffect(() => {
    if (!playing || mode !== 'replay' || busy) return
    const timer = window.setInterval(() => {
      setSeconds(previous => Math.min(replayMax, previous + speed))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [playing, mode, busy, speed, replayMax])

  useEffect(() => {
    if (mode !== 'replay' || busy) return
    // Scheduled work updates the derived replay scene, never business rows.
    const timer = window.setTimeout(() => {
      accept(replaySnapshot(snapshot, replayLogs, dayBounds(day).start + seconds * 1000), playing)
      if (seconds>=replayMax) setPlaying(false)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [seconds, replayLogs, snapshot, day, playing, mode, busy, accept, replayMax])

  const switchMode = next => {
    setPlaying(false); setSelectedId(null); setFocus(null); setError(''); seenEvents.current.clear()
    previousScene.current = null; setSceneEpoch(value => value + 1); setRefreshRevision(value => value + 1)
    setScene(null); setMode(next)
    if (next === 'demo') { demo.current = demoSnapshot(); accept(demo.current, false); setBusy(false) }
    else setBusy(true)
  }
  const vehicles = scene?.vehicles || []
  const counts = useMemo(() => vehicles.reduce((all, car) => { all[car.status]++; return all }, { available: 0, on_trip: 0, charging: 0, maintenance: 0, unknown: 0 }), [vehicles])
  const visible = useMemo(() => vehicles.filter(car => (filter === 'all' || car.status === filter) &&
    `${car.plate_number} ${car.model} ${car.driver} ${car.location} ${car.departments?.name} ${car.slotCode}`.toLocaleLowerCase('th-TH').includes(query.trim().toLocaleLowerCase('th-TH'))), [vehicles, filter, query])
  const selected = vehicles.find(car => car.id === selectedId)
  const selectedStyle = selected ? vehicleStyle(selected) : null
  const select = useCallback(id => { setSelectedId(id); setFocus(null) }, [])
  const visibleIds = useMemo(() => visible.map(car=>car.id), [visible])
  const zones = useMemo(() => [...new Set(vehicles.map(car=>car.parking?.zone).filter(Boolean))].map(zone=>({zone,cars:vehicles.filter(car=>car.parking?.zone===zone),x:zone==='A'||zone==='C'?-8:10.5,z:zone==='A'||zone==='B'?-1.5:9})),[vehicles])
  const seekReplay = value => {
    setPlaying(false); setSeconds(value); seenEvents.current.clear(); setSceneEpoch(n=>n+1)
    accept(replaySnapshot(snapshot,replayLogs,dayBounds(day).start+value*1000),false)
  }
  const toggleSafeMap = () => {
    if (previousScene.current) {
      const current={...previousScene.current,moves:[]}
      previousScene.current=current;setScene(current)
    }
    setSafeMap(value=>!value);setSceneEpoch(value=>value+1)
  }
  const demoAction = action => {
    if (!demo.current || mode !== 'demo') return
    if (action === 'reset') { demo.current = demoSnapshot(); seenEvents.current.clear(); setSceneEpoch(value=>value+1); accept(demo.current, false); return }
    const ids = action === 'random' ? vehicles.filter(car => car.status === 'available').slice(0, 3).map(car => car.id)
      : action === 'all' ? vehicles.filter(car => car.status === 'on_trip').map(car => car.id) : selectedId ? [selectedId] : []
    const next = structuredClone(demo.current)
    ids.forEach(id => {
      const car = next.carsDataRaw.find(item => item.id === id)
      if (!car) return
      if ((action === 'out' || action === 'random') && car.status === 'available') {
        car.status = 'busy'
        next.activeLogs.push({ id: `demo-trip-${++demoSequence.current}`, car_id: id, activity_type: 'usage', driver_name: 'ผู้ขับสาธิต', start_time: new Date().toISOString(), start_mileage: 10000, location: 'ภารกิจสาธิต' })
      } else if ((action === 'back' || action === 'all') && car.status === 'busy') {
        const log = next.activeLogs.find(item => item.car_id === id)
        if (!log) return
        car.status = 'available'; next.activeLogs = next.activeLogs.filter(item => item.car_id !== id)
        next.latestLogs = [...next.latestLogs.filter(item => item.car_id !== id), { ...log, end_time: new Date().toISOString(), end_mileage: 10120, is_completed: true }]
      }
    })
    demo.current = next; accept(next)
  }

  const flatMap = <div className="twin-flat-map" role="region" aria-label="ผังลานรถ 2D สำรอง"><div className="twin-flat-office">อาคารสำนักงาน กฟภ. กำแพงแสน</div>
    <div className="twin-flat-grid">{visible.map(car => <button key={car.id} onClick={() => select(car.id)} aria-label={`เลือก ${car.plate_number} ช่อง ${car.slotCode}`} style={{ borderColor: selectedId === car.id ? '#6b21a8' : FLEET_STATUSES[car.status].color }}>
      <FleetVehicleGlyph car={car} size={52} style={{ opacity: car.status === 'on_trip' ? .18 : 1 }} /><strong>{car.slotCode}</strong><span>{car.plate_number}</span><span>{vehicleStyle(car).label}</span>
    </button>)}</div><p>มุมมอง 2D สำรอง · รถที่ออกภารกิจแสดงช่องจอดว่าง</p></div>

  return <section className="fleet-twin" aria-label="ลานรถดิจิทัล">
    <header className="twin-header"><div className="twin-brand"><img src="/pea_logo.png" alt="PEA" /><div><span>PEA SMART CAR</span><strong>Fleet Digital Twin</strong></div></div>
      <label className="twin-search"><Search size={19} /><input aria-label="ค้นหารถในลาน" placeholder="ค้นหาทะเบียนรถ, ผู้ขับ, สถานที่..." value={query} onChange={event => { setQuery(event.target.value); setSelectedId(null) }} /></label>
      <button onClick={onAnalytics} className="twin-analytics"><LayoutGrid size={17} />สถิติและรายงานเดิม<ArrowUpRight size={16} /></button>
    </header>
    <div className="twin-content">
      <div className="twin-topline"><div className="twin-modes" aria-label="โหมดลานรถ">{[['live','สถานะปัจจุบัน'],['replay','ดูย้อนหลัง'],['demo','โหมดสาธิต']].map(([key,label]) => <button key={key} aria-pressed={mode===key} disabled={key==='replay' && !snapshot.carsDataRaw.length} onClick={() => switchMode(key)}>{label}</button>)}</div>
        <span className={`twin-live-badge ${mode==='demo' ? 'is-demo' : ''}`}><i />{mode==='live' ? 'ข้อมูลจริง · ทุก 60 วินาที' : mode==='replay' ? 'REPLAY · ประวัติจริง' : 'DEMO · ไม่บันทึกข้อมูลจริง'}</span>
        <span className="twin-clock"><CalendarDays size={15} />{clock?.toLocaleDateString('th-TH',{timeZone:'Asia/Bangkok',day:'numeric',month:'short',year:'numeric'}) || '—'}<Clock size={15}/>{clock?.toLocaleTimeString('th-TH',{timeZone:'Asia/Bangkok',hour:'2-digit',minute:'2-digit'}) || '—'}</span>
      </div>
      <div className="twin-status-cards">{[['all','ทั้งหมด',LayoutGrid,'#6b21a8',vehicles.length],...Object.entries(FLEET_STATUSES).filter(([key])=>key!=='unknown').map(([key,info])=>[key,info.label,icons[key],info.color,counts[key]])].map(([key,label,Icon,color,count])=> <button key={key} aria-pressed={filter===key} onClick={()=>{setFilter(key);setSelectedId(null)}} style={{'--status-color':color}}><Icon size={23}/><span>{label}</span><strong>{count}</strong></button>)}</div>
      {error && <div className="twin-error" role="alert">{error} · {scene ? 'คงข้อมูลครั้งล่าสุดไว้ ไม่ใช่สถานะสด' : 'ยังไม่สามารถโหลดข้อมูลได้'} <button onClick={()=>switchMode(mode)}>ลองอีกครั้ง</button></div>}
      {mode==='demo' && <div className="twin-demo-controls"><strong>ข้อมูลสาธิต 25 คัน</strong><button disabled={!selected || selected.status!=='available'} onClick={()=>demoAction('out')}>สาธิตเบิกรถ</button><button disabled={!selected || selected.status!=='on_trip'} onClick={()=>demoAction('back')}>สาธิตคืนรถ</button><button onClick={()=>demoAction('random')}>ส่งรถออก 3 คัน</button><button onClick={()=>demoAction('all')}>คืนรถทั้งหมด</button><button onClick={()=>demoAction('reset')}>รีเซ็ตสาธิต</button><span>การสาธิตไม่ส่ง Discord และไม่แก้ฐานข้อมูล</span></div>}
      {mode==='replay' && <div className="twin-replay">
        <label><CalendarDays size={16}/><input aria-label="วันที่ดูย้อนหลัง" type="date" max={todayThai()} value={day} onChange={event=>{setPlaying(false);setDay(event.target.value);setBusy(true);setScene(null);previousScene.current=null;seenEvents.current.clear();setSceneEpoch(n=>n+1)}} /></label>
        <button aria-label={playing?'หยุดย้อนหลัง':'เล่นย้อนหลัง'} disabled={busy || seconds>=replayMax} onClick={()=>setPlaying(value=>!value)}>{playing?<Pause size={17}/>:<Play size={17}/>}</button>
        <strong>{clockText(seconds)}</strong>
        <input aria-label="เวลาในวันย้อนหลัง" type="range" disabled={busy} min="0" max={replayMax} step="60" value={seconds} onChange={event=>seekReplay(Number(event.target.value))} />
        <select aria-label="ความเร็วเล่นย้อนหลัง" value={speed} onChange={event=>setSpeed(Number(event.target.value))}>{[1,10,30,60,120].map(n=><option key={n} value={n}>{n}×</option>)}</select>
        <span>{replayLogs.length} รายการ · ย้อนหลังเฉพาะเที่ยว/ชาร์จ ไม่รวมประวัติซ่อม</span>
      </div>}
      <div className={`twin-workspace${expandedMap ? ' is-map-expanded' : ''}`}>
        <div className="twin-map-panel">
          <div className="twin-map" aria-label="แผนผังสำนักงานจำลองและช่องจอด">
            {busy && !scene ? <div className="twin-loading">กำลังโหลดข้อมูล…</div> : safeMap ? flatMap : <SceneBoundary fallback={flatMap}><Scene key={sceneEpoch} vehicles={vehicles} selectedId={selectedId} onSelect={select} moves={scene?.moves || []} visibleIds={visibleIds} labelsHost={labelsHost} labels={labels} view={view} focus={focus} reducedMotion={reduced} /></SceneBoundary>}
            {!safeMap && <div className="twin-world-labels" ref={labelsHost} aria-hidden="true">
              {labels && vehicles.filter(car=>car.parking).map(car=><span key={car.id} className="twin-slot-label" data-world-x={car.parking.x} data-world-y=".15" data-world-z={car.parking.z+2}>{car.slotCode}</span>)}
              {labels && <><div className="twin-campus-label" data-world-x="-2" data-world-y="8.5" data-world-z="-13"><span>◈</span><div>อาคารสำนักงาน<strong>กฟภ. กำแพงแสน</strong></div></div><div className="twin-charge-label" data-world-x="14.5" data-world-y="4.5" data-world-z="-17"><Zap size={22}/><div>จุดชาร์จ EV<small>พื้นที่จำลอง</small></div></div><div className="twin-gate-label" data-world-x="5.5" data-world-y="2.3" data-world-z={Math.max(20,...vehicles.map(car=>(car.parking?.z||0)+5))+1}>ทางเข้า–ออก</div></>}
              {labels && zones.map(zone=><div key={zone.zone} className="twin-zone-label" data-world-x={zone.x} data-world-y="2.7" data-world-z={zone.z}><span className="twin-zone-symbol"><Car size={21}/></span><div>ลานจอดโซน {zone.zone}<br/><strong>{zone.cars.filter(car=>car.status!=='on_trip').length}/{zone.cars.length}</strong> คัน</div></div>)}
            </div>}
          </div>
          <div className="twin-map-toolbar">
            <button aria-label="ขยายผัง" onClick={()=>setView(value=>({...value,zoom:Math.min(2.5,value.zoom+.2)}))}><ZoomIn size={20}/></button>
            <button aria-label="ย่อผัง" onClick={()=>setView(value=>({...value,zoom:Math.max(.55,value.zoom-.2)}))}><ZoomOut size={20}/></button>
            <button aria-label="คืนมุมมองสำนักงาน" onClick={()=>{setFocus(null);setView({zoom:1.08,top:false,reset:Date.now()})}}><RotateCcw size={19}/></button>
            <button aria-label="แสดงชื่อช่องจอด" aria-pressed={labels} onClick={()=>setLabels(value=>!value)}><Tag size={19}/></button>
            <button aria-label="สลับมุมมองบน 2D และ isometric 3D" aria-pressed={view.top} onClick={()=>setView(value=>({...value,top:!value.top}))}><Layers size={19}/></button>
            <button aria-label="ใช้ผัง 2D สำรอง" aria-pressed={safeMap} onClick={toggleSafeMap}>2D</button>
            <button aria-label={expandedMap ? 'คืนขนาดผังและแสดงรายการรถ' : 'ขยายผังเต็มความกว้าง'} aria-pressed={expandedMap} onClick={()=>setExpandedMap(value=>!value)}>{expandedMap ? <Minimize2 size={19}/> : <Maximize2 size={19}/>}</button>
          </div>
          <span className="twin-map-watermark">ผังสำนักงานจำลอง · ไม่ใช่ GPS</span>
          {selected && <article className="twin-detail" aria-label="ข้อมูลรถที่เลือก"><button className="twin-detail-close" aria-label="ปิดข้อมูลรถ" onClick={()=>{setSelectedId(null);setFocus(null)}}><X size={18}/></button><span className="twin-detail-eyebrow">รถ #{selected.id} · ช่องประจำ {selected.slotCode}</span><h3>{selected.plate_number}</h3><Status status={selected.status}/>
            <div className="twin-car-image">{getCarImage(selected) ? <img src={getCarImage(selected)} alt={selected.model || 'รถที่เลือก'} loading="lazy"/> : <Car size={70}/>}</div>
            <dl><div><dt>รุ่น / ประเภท</dt><dd>{selected.model || '—'} · {selected.car_type || selected.fuel_type}</dd></div><div><dt>{selected.trip?'ผู้ขับปัจจุบัน':'ผู้ใช้งานล่าสุด'}</dt><dd>{selected.driver}</dd></div><div><dt>แผนก</dt><dd>{selected.departments?.name || 'ไม่ระบุ'}</dd></div>{selected.trip && <><div><dt>เวลาออก</dt><dd>{timeText(selected.trip.start_time)}</dd></div><div><dt>งาน / สถานที่บันทึก</dt><dd>{selected.location || 'ไม่ระบุ'}</dd></div></>}{selected.battery!==null && <div><dt>แบตที่บันทึกล่าสุด</dt><dd>{selected.battery}% <small>{timeText(selected.batteryAt)} · ไม่ใช่ค่าปัจจุบันจากเซนเซอร์</small></dd></div>}</dl>
            <div className="twin-model-key"><i style={{background:selectedStyle.color}}/>{selectedStyle.label} · สีจำแนกในผังจำลอง</div>
            {mode==='live' && <p className="twin-qr-only"><QrCode size={19}/><span>เบิก–คืน / บันทึกชาร์จ<br/><strong>สแกน QR Code ที่รถเท่านั้น</strong></span></p>}
            <div className="twin-detail-actions"><button onClick={()=>{setFocus(selected.parking);setView(value=>({...value,zoom:1.35}))}}><Maximize2 size={16}/>โฟกัสช่องจอด</button>{mode==='live' && <Link className="twin-report-link" href={`/report?car_id=${selected.id}`}>รายงานประจำเดือน</Link>}</div>
          </article>}
        </div>
        <aside className="twin-list"><div className="twin-list-heading"><h2>รายการรถยนต์ <span>({vehicles.length})</span></h2><Car size={20}/></div><p className="twin-list-subtitle">แสดง {visible.length} คัน · ดูรายละเอียดเท่านั้น</p><div className="twin-list-scroll">{visible.map(car=><button key={car.id} aria-pressed={car.id===selectedId} onClick={()=>select(car.id)} className="twin-list-car"><span className="twin-list-thumbnail"><FleetVehicleGlyph car={car} size={49}/></span><span className="twin-list-car-info"><strong>{car.plate_number}</strong><small>{car.slotCode} · {vehicleStyle(car).label}</small><small>{car.driver}</small><Status status={car.status}/></span><ArrowUpRight size={15}/></button>)}{!busy && !visible.length && <p className="twin-empty">ไม่พบรถตามเงื่อนไขนี้</p>}</div><div className="twin-list-footer"><span>{counts.unknown ? `${counts.unknown} คันรอตรวจสอบสถานะ` : 'อิงรายการเบิก–คืนรถของระบบ'}</span>{mode==='live' && <small>ข้อมูล ณ {timeText(snapshot.generatedAt)}</small>}</div></aside>
      </div>
      <footer className="twin-footer"><span>โมเดลอิงประเภทรถ · สีใช้จำแนกในผัง ไม่ใช่สีตัวรถจริง · ตำแหน่ง/การเคลื่อนที่เป็นภาพจำลอง ไม่ใช่ GPS</span><label><input type="checkbox" checked={reduced} onChange={event=>setReduced(event.target.checked)}/>ลดการเคลื่อนไหว</label></footer>
    </div>
  </section>
}
