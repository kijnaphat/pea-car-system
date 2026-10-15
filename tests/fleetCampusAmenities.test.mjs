import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { SphereGeometry } from 'three'
import { CAMPUS_GARDENS, gardenDetails, fenceDetails, landscapeCrownPoint } from '../lib/fleetCampusAmenities.js'

test('architectural planting is deterministic, finite and contained in the approved garden footprints',()=>{
  const details=gardenDetails()
  assert.deepEqual(details,gardenDetails())
  assert.ok(details.hardscape.length>120)
  assert.ok(details.planting.length>200)
  assert.ok(details.branches.length>=48,'round branching structure below the crowns')
  assert.ok(details.hardscape.length+details.planting.length+details.branches.length<800,'bounded offline detail budget')
  for(const garden of CAMPUS_GARDENS) {
    const {hardscape,planting,branches}=gardenDetails([garden])
    for(const part of [...hardscape,...planting,...branches]) {
      assert.ok([...part.at,...part.size,...(part.rotation||[])].every(Number.isFinite))
      assert.ok(part.size.every(n=>n>0))
      // The custom crown stays within its unit sphere even with all rotations.
      const horizontal=planting.includes(part)?Math.max(...part.size):0
      const radius=branches.includes(part)?1:.5
      assert.ok(Math.abs(part.at[0]-garden.x)+(horizontal||part.size[0]*radius)<=garden.width/2+.001)
      assert.ok(Math.abs(part.at[2]-garden.z)+(horizontal||part.size[2]*radius)<=garden.depth/2+.001)
      assert.match(part.color,/^#[\da-f]{6}$/i)
    }
  }
})

test('fence details stay within their original perimeter and are batched',()=>{
  for(const length of [7,9,30]) for(const part of fenceDetails(length)) {
    assert.ok(Math.abs(part.at[2])+part.size[2]/2<=length/2+.13)
    assert.ok(part.at[1]+part.size[1]/2<1.5)
  }
  const source=readFileSync(new URL('../app/dashboard/components/FleetCampusProps.js',import.meta.url),'utf8')
  assert.ok(source.includes('<StaticParts parts={detail.hardscape}/>'))
  assert.ok(source.includes('<LandscapeInstances parts={detail.planting}/>'))
  assert.ok(source.includes('<LandscapeInstances parts={detail.branches} branches/>'))
  assert.ok(source.includes('fenceDetails(length)'))
  assert.doesNotMatch(source,/fetch\(|supabase|setInterval|Date\.now|Math\.random/)
})

test('tree pairs have organic height, rotation and colour variation without changing the garden layout',()=>{
  const details=CAMPUS_GARDENS.map(garden=>gardenDetails([garden]))
  const signatures=new Set(details.map(detail=>JSON.stringify(detail.planting.filter(p=>p.at[1]>2).map(p=>[p.at[1],p.size,p.rotation,p.color]))))
  assert.equal(signatures.size,CAMPUS_GARDENS.length)
  assert.ok(new Set(details.flatMap(d=>d.planting.map(p=>p.color))).size>=6)
  const source=readFileSync(new URL('../app/dashboard/components/FleetCampusProps.js',import.meta.url),'utf8')
  assert.ok(source.includes('new SphereGeometry(1,11,8)'))
  assert.ok(source.includes('geometry.computeVertexNormals()'))
  assert.ok(source.includes('crown?.dispose()'))
  assert.ok(source.includes('export function LandscapeInstances('))
  assert.ok(source.includes('if(branches) return null'))
  assert.doesNotMatch(source,/icosahedronGeometry/)
})

test('organic crown geometry stays inside the unit sphere and UV seams remain coincident',()=>{
  const geometry=new SphereGeometry(1,11,8),positions=geometry.attributes.position
  const duplicates=new Map()
  let matched=0
  for(let n=0;n<positions.count;n++) {
    const point=[positions.getX(n),positions.getY(n),positions.getZ(n)]
    const shaped=landscapeCrownPoint(...point)
    assert.ok(Math.hypot(...shaped)<=1.000001)
    const key=point.map(v=>Math.round(v*1e6)).join(',')
    if(duplicates.has(key)) {
      const previous=duplicates.get(key)
      assert.ok(Math.hypot(...shaped.map((v,i)=>v-previous[i]))<.000001)
      matched++
    } else duplicates.set(key,shaped)
  }
  assert.ok(matched>20,'UV seam and pole duplicate vertices were checked')
  geometry.dispose()
})
