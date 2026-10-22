import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getCarImage, getLegacyCarImage } from '../lib/carImages.js'
import { CAR_IMAGE_SNAPSHOT, CAR_IMAGE_SNAPSHOT_PROJECT } from '../lib/carImageSnapshot.js'
import { nextVehiclePhoto, recordPhotoFailure, vehiclePhotoKey, vehiclePhotoSources } from '../lib/fleetVehiclePhoto.js'

function withProject(project, callback) {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL
  process.env.NEXT_PUBLIC_SUPABASE_URL = project
  try { return callback() } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous
  }
}

test('selected photos use the existing optimized card variant before local type examples',()=>{
  withProject('https://dqwemzjmzowyxyhbljoe.supabase.co', () => {
  const car={id:7,image_path:'vehicles/a photo.png',car_type:'รถ EV'}
  assert.equal(getCarImage(car,'card'),'/api/car-image?path=vehicles/a%20photo.png&variant=card')
  assert.equal(getLegacyCarImage(car),'/mg.png')
  assert.equal(getCarImage({...car,image_path:null},'card'),'/mg.png')
  assert.equal(getCarImage({id:8,car_type:'unknown'},'card'),null)
  assert.deepEqual(vehiclePhotoSources(car),[
    {src:'/api/car-image?path=vehicles/a%20photo.png&variant=card',actual:true},
    {src:'/mg.png',actual:false},
  ])
  assert.deepEqual(vehiclePhotoSources({...car,image_path:null}),[{src:'/mg.png',actual:false}])
  assert.deepEqual(vehiclePhotoSources({id:8,car_type:'unknown'}),[])
  })
  const helper=readFileSync(new URL('../lib/fleetVehiclePhoto.js',import.meta.url),'utf8')
  assert.ok(helper.includes("getCarImage(car, 'card')"))
  const source=readFileSync(new URL('../app/dashboard/components/FleetVehiclePhoto.js',import.meta.url),'utf8')
  assert.doesNotMatch(source,/getCarImage\(car\)|variant=hero|fetch\(|supabase|Canvas|VehicleShowcase/)
  assert.ok(source.includes('loading="lazy"'))
})

test('photo failures reset by vehicle and image source; failed uploads fall back without claiming type examples are actual photos',()=>{
  const source=readFileSync(new URL('../app/dashboard/components/FleetVehiclePhoto.js',import.meta.url),'utf8')
  assert.ok(source.includes("useState([])"))
  assert.ok(source.includes('key={vehiclePhotoKey(car, choices)}'))
  assert.ok(source.includes('nextVehiclePhoto(choices, failed)'))
  assert.ok(source.includes('onError={() => fail(source.src)}'))
  assert.ok(source.includes('ภาพตัวอย่างตามประเภทรถ'))
  assert.ok(source.includes('ไม่ใช่ภาพยืนยันของรถคันนี้'))
  assert.ok(source.includes('ไม่มีภาพรถที่แสดงได้'))
  const css=readFileSync(new URL('../app/dashboard/components/fleet-twin.css',import.meta.url),'utf8')
  assert.match(css,/\.twin-vehicle-photo-frame\{height:220px/)
  assert.match(css,/\.twin-vehicle-photo-frame>img\{[^}]*object-fit:contain/)
})

test('fallback state moves from uploaded photo to honest type example to placeholder, and resets for another car/source',()=>{
  withProject('https://dqwemzjmzowyxyhbljoe.supabase.co', () => {
  const car={id:7,image_path:'vehicles/a.png',car_type:'รถ EV'},sources=vehiclePhotoSources(car)
  assert.equal(nextVehiclePhoto(sources).actual,true)
  const failed=recordPhotoFailure([],sources[0].src)
  assert.deepEqual(nextVehiclePhoto(sources,failed),{src:'/mg.png',actual:false})
  assert.equal(recordPhotoFailure(failed,sources[0].src),failed,'duplicate load errors are idempotent')
  assert.equal(nextVehiclePhoto(sources,recordPhotoFailure(failed,sources[1].src)),null)
  assert.equal(nextVehiclePhoto([]),null)
  const key=vehiclePhotoKey(car,sources)
  assert.equal(key,vehiclePhotoKey({...car},vehiclePhotoSources({...car})))
  assert.notEqual(key,vehiclePhotoKey({...car,id:8},sources),'another selected car remounts clean image state')
  const updated={...car,image_path:'vehicles/b.png'}
  assert.notEqual(key,vehiclePhotoKey(updated,vehiclePhotoSources(updated)),'a replacement upload also clears old errors')
  })
})

test('paused KPN image paths show existing bundled actual photos or honestly labelled local fallbacks, never a remote URL', () => {
  withProject(CAR_IMAGE_SNAPSHOT_PROJECT, () => {
    const path = Object.keys(CAR_IMAGE_SNAPSHOT)[0]
    assert.deepEqual(vehiclePhotoSources({ id: 7, image_path: path, car_type: 'รถ EV' }), [
      { src: CAR_IMAGE_SNAPSHOT[path].card, actual: true },
      { src: '/mg.png', actual: false },
    ])
    for (const image_path of ['cars/999/main-9999999999999.webp',
      path.replace(/[^/]+$/, 'main-9999999999999.webp'), 'legacy/obsolete.png']) {
      assert.deepEqual(vehiclePhotoSources({ id: 7, image_path, car_type: 'รถ EV' }), [
        { src: '/mg.png', actual: false },
      ], 'a stored path alone must not label the type example as an actual vehicle photo')
      assert.deepEqual(vehiclePhotoSources({ id: 8, image_path, car_type: 'unknown' }), [
        { src: '/car-placeholder.svg', actual: false },
      ])
    }
  })
})
