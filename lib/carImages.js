export const CAR_IMAGE_BUCKET = 'car-images'

const LEGACY_IMAGE_RULES = [
  { matches: car => car.car_type?.toUpperCase() === 'รถ EV', image: '/mg.png' },
  { matches: car => car.car_type?.toUpperCase() === 'รถ EV ทดเเทน', image: '/mg2.png' },
  { matches: car => car.car_type?.startsWith('รถกระเช้า'), image: '/aerial_lift.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุก 2 ตันเเก้ไฟ'), image: '/2_ton_truck.png' },
  { matches: car => car.car_type?.startsWith('รถเครน'), image: '/crane.png' },
  { matches: car => car.car_type?.startsWith('รถตู้โดยสาร') || car.car_type?.startsWith('รถตู้'), image: '/van.png' },
  { matches: car => car.car_type?.startsWith('รถกระบะ'), image: '/truck.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุกมีข้างเสริมหลังคา'), image: '/truck.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุก 2'), image: '/2ton.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุก 1 ตันแก้ไฟ'), image: '/1ton.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุก 6 ตัน ฮอทไลน์'), image: '/hotline.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุกขุดเจาะ'), image: '/3ton.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุก 7.5 ตัน ติดเครนแข็ง'), image: '/75ton.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุก 6 ล้อ'), image: '/hotline_6.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุก 6 ตัน'), image: '/6ton.png' },
  { matches: car => car.car_type?.startsWith('รถบรรทุก 3 ตันส่วนบุคคล'), image: '/3ton_2.png' },
  { matches: car => car.car_type?.startsWith('TEST_CAR'), image: '/scooter.png' },
]

export function getLegacyCarImage(car) {
  return LEGACY_IMAGE_RULES.find(rule => rule.matches(car))?.image || null
}

export function getStoredCarImageUrl(imagePath) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!imagePath || !supabaseUrl) return null
  const encodedPath = imagePath.split('/').map(encodeURIComponent).join('/')
  return `${supabaseUrl}/storage/v1/object/public/${CAR_IMAGE_BUCKET}/${encodedPath}`
}

export function getCarImage(car) {
  return getStoredCarImageUrl(car?.image_path) || getLegacyCarImage(car || {})
}
