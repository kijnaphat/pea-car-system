import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8')
test('3D slot meshes and projected labels share the displayed-only slot selector',()=>{
  const scene=read('app/dashboard/components/FleetScene.js'),dashboard=read('app/dashboard/components/FleetDigitalTwin.js')
  assert.ok(scene.includes('displayedParkingSlots(vehicles)'))
  assert.ok(dashboard.includes('labels && displayedParkingSlots(vehicles).map'))
  assert.doesNotMatch(scene,/siteParkingSlots\(vehicles\)/)
  assert.doesNotMatch(dashboard,/siteParkingSlots\(vehicles\)/)
  const admin=read('app/admin/page.js')
  const toggle=admin.slice(admin.indexOf('const toggleCarVisibility'),admin.indexOf('const handlePreSubmit'))
  assert.ok(toggle.indexOf('markFleetChanged()')>toggle.indexOf('if (error) throw error'))
  assert.ok(admin.includes("if (table === 'cars') markFleetChanged()"))
})

test('bottom dock uses restrained translucent material, readable labels and keeps QR-only hiding',()=>{
  const css=read('app/globals.css'),dock=css.slice(css.indexOf('.kpn-dock {'),css.indexOf('.kpn-dock-active {'))
  assert.match(dock,/background: rgba\(255,255,255,\.92\)/)
  assert.match(dock,/-webkit-backdrop-filter: blur\(12px\)/)
  assert.ok(dock.indexOf('-webkit-backdrop-filter:')<dock.indexOf('\n  backdrop-filter:'),'standard property must follow Safari prefix so the minifier retains both')
  assert.match(dock,/@supports not/)
  const nav=read('app/components/GlobalBottomNav.js')
  assert.ok(nav.includes('if (isVehicleWorkflow) return null'))
  assert.ok(nav.includes("aria-current={item.active ? 'page' : undefined}"))
  assert.ok(nav.includes('<span className="leading-none">{item.label}</span>'))
  const active=css.slice(css.indexOf('.kpn-dock-icon-active {'),css.indexOf('.kpn-dock-icon-inactive {'))
  assert.doesNotMatch(active,/radial-gradient|#c9ff48/)
})
