import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { DEFAULT_ORBIT, MIN_ELEVATION, MAX_ELEVATION, cameraView, cameraOffset, captureOrbit } from '../lib/fleetCamera.js'

test('camera can turn around the full campus with no azimuth clamp',()=>{
  let previous={reset:1,zoom:1.08,turn:0,tilt:0},memory={...DEFAULT_ORBIT}
  for(let n=1;n<=24;n++) {
    const next={...previous,turn:n}
    memory=cameraView(memory,previous,next);previous=next
    const offset=cameraOffset(memory)
    assert.ok(offset.y>0)
    assert.ok(Object.values(offset).every(Number.isFinite))
  }
  assert.ok(Math.abs(memory.azimuth-DEFAULT_ORBIT.azimuth-Math.PI*4)<1e-10)
})
test('gesture angle, zoom and pan persist through ordinary refreshes and button zoom',()=>{
  const view={reset:1,zoom:1.08,turn:0,tilt:0}
  const memory=captureOrbit({...DEFAULT_ORBIT},{azimuth:2.4,polar:1.0,zoomFactor:1.7,target:[10,0,8]})
  assert.deepEqual(cameraView(memory,view,{...view}),memory)
  const zoomed=cameraView(memory,view,{...view,zoom:1.28})
  assert.equal(zoomed.azimuth,2.4)
  assert.equal(zoomed.elevation,memory.elevation)
  assert.deepEqual(zoomed.target,[10,0,8])
  assert.ok(Math.abs(zoomed.zoomFactor-1.7*1.28/1.08)<1e-10)
})
test('top view preserves the previous 3D angle; reset restores the campus overview',()=>{
  const view={reset:1,zoom:1.08,turn:2,tilt:0},memory={...DEFAULT_ORBIT,azimuth:3,elevation:.4,zoomFactor:2,target:[10,0,5]}
  const top=cameraView(memory,view,{...view,top:true})
  const captured=captureOrbit(top,{azimuth:0,polar:0,zoomFactor:2,target:[10,0,5]},true)
  assert.equal(captured.azimuth,3)
  assert.equal(captured.elevation,.4)
  assert.ok(cameraOffset(captured,true).y>60)
  const reset=cameraView(captured,view,{...view,reset:2,zoom:1.08,turn:0})
  assert.deepEqual(reset,{...DEFAULT_ORBIT,target:null})
})
test('elevation can move from near-ground to bird view but never underneath the floor',()=>{
  const before={reset:1,zoom:1.08,tilt:0}
  assert.equal(cameraView({...DEFAULT_ORBIT},before,{...before,tilt:-100}).elevation,MIN_ELEVATION)
  assert.equal(cameraView({...DEFAULT_ORBIT},before,{...before,tilt:100}).elevation,MAX_ELEVATION)
})
test('controls support mouse/touch navigation and do not depend on snapshot object identities',()=>{
  const scene=readFileSync(new URL('../app/dashboard/components/FleetScene.js',import.meta.url),'utf8')
  assert.ok(scene.includes('MOUSE.ROTATE'))
  assert.ok(scene.includes('TOUCH.DOLLY_PAN'))
  assert.ok(scene.includes('minPolarAngle={top'))
  assert.ok(scene.includes('focusX,focusZ,minX,maxX,minZ,maxZ,maxY,invalidate]'))
  assert.doesNotMatch(scene,/\[camera, size.width, size.height, view, focus, bounds/)
  const ui=readFileSync(new URL('../app/dashboard/components/FleetDigitalTwin.js',import.meta.url),'utf8')
  for(const name of ['หมุนกล้องซ้าย','หมุนกล้องขวา','ยกมุมกล้องขึ้น','ลดมุมกล้องลง','โหมดลากเพื่อเลื่อนแผนที่','คืนมุมมองสำนักงาน']) assert.ok(ui.includes(name))
})
