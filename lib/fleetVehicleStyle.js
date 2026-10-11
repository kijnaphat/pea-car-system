// Display-only models/paint. Never infer a vehicle's actual paint or operational state.
export const VEHICLE_STYLES = {
  bucket: { label: 'รถกระเช้า', colors: ['#ed791f', '#d65516'], wheels: 6 },
  crane: { label: 'รถเครน', colors: ['#e8ad20', '#cb8515'], wheels: 6 },
  drill: { label: 'รถขุดเจาะ', colors: ['#ba4b44', '#da6554'], wheels: 6 },
  heavy_truck: { label: 'รถบรรทุกใหญ่ / 6 ล้อ', colors: ['#28699c', '#3b85b6'], wheels: 6 },
  light_truck: { label: 'รถบรรทุกเล็ก', colors: ['#39a878', '#228663'], wheels: 4 },
  covered_truck: { label: 'รถบรรทุกมีหลังคา', colors: ['#609494', '#387577'], wheels: 4 },
  pickup: { label: 'รถกระบะ', colors: ['#cc4664', '#498daa', '#ad556e', '#267b91'], wheels: 4 },
  van: { label: 'รถตู้โดยสาร', colors: ['#6480c3', '#4560a0'], wheels: 4 },
  ev: { label: 'รถ EV', colors: ['#8746bf', '#ae62d2'], wheels: 4 },
  motorcycle: { label: 'รถจักรยานยนต์ / รถทดสอบ', colors: ['#527688'], wheels: 2 },
  generic: { label: 'รถไม่ระบุรูปแบบ', colors: ['#718697'], wheels: 4 },
}

export const FLEET_PAINTS = {
  owned:{color:'#ed861f',label:'รถ กฟภ. · สีส้ม'},
  rental:{color:'#929ba5',label:'รถเช่า · สีเทา'},
  electric:{color:'#3aafd7',label:'รถ EV · สีฟ้า'},
  unknown:{color:'#748a9b',label:'ยังไม่ระบุกรรมสิทธิ์'},
}

export function vehiclePaint(car={}) {
  if(car.ambient && /^#[0-9a-f]{6}$/i.test(car.color||'')) return {color:car.color,paintCategory:'customer',paintLabel:'รถลูกค้าจำลอง'}
  const type=String(car.car_type||'').normalize('NFKC').toLowerCase()
  const owner=String(car.ownership_type||'').normalize('NFKC').trim().toLowerCase()
  const category=String(car.fuel_type||'').trim().toUpperCase()==='EV'||/\bev\b|รถไฟฟ้า|electric/.test(type)?'electric'
    :/รถเช่า|rental|leased|lease/.test(owner)?'rental'
    :/รถของการไฟฟ้า|กฟภ|pea|owned/.test(owner)?'owned':'unknown'
  return {color:FLEET_PAINTS[category].color,paintCategory:category,paintLabel:FLEET_PAINTS[category].label}
}

export function vehicleStyle(car = {}) {
  const type = String(car.car_type || '').normalize('NFKC').trim().toLowerCase()
  let kind = 'generic'
  if (/กระเช้า|aerial|bucket/.test(type)) kind = 'bucket'
  else if (/เครน|crane/.test(type)) kind = 'crane'
  else if (/ขุดเจาะ|drill/.test(type)) kind = 'drill'
  else if (/รถตู้|van|minibus/.test(type)) kind = 'van'
  else if (/กระบะ|pickup/.test(type)) kind = 'pickup'
  else if (/หลังคา|covered/.test(type) && /บรรทุก|truck/.test(type)) kind = 'covered_truck'
  else if (/บรรทุก|truck|ฮอทไลน์|hotline/.test(type)) kind = /6\s*ล้อ|6\s*ตัน|7[.,]5\s*ตัน|heavy|6\s*wheel/.test(type) ? 'heavy_truck' : 'light_truck'
  else if (/\bev\b|รถไฟฟ้า|electric/.test(type) || String(car.fuel_type || '').trim().toUpperCase() === 'EV') kind = 'ev'
  else if (/จักรยานยนต์|motorcycle|scooter|test_car/.test(type)) kind = 'motorcycle'
  const style = VEHICLE_STYLES[kind]
  return { kind, ...style, ...vehiclePaint(car) }
}
