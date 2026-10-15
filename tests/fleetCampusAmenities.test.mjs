import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CAMPUS_GARDENS, gardenDetails, fenceDetails } from '../lib/fleetCampusAmenities.js'

test('architectural planting is deterministic, finite and contained in the approved garden footprints',()=>{
  const details=gardenDetails()
  assert.deepEqual(details,gardenDetails())
  assert.ok(details.hardscape.length>150)
  assert.ok(details.planting.length>200)
  assert.ok(details.hardscape.length+details.planting.length<800,'bounded offline detail budget')
  for(const garden of CAMPUS_GARDENS) {
    const {hardscape,planting}=gardenDetails([garden])
    for(const part of [...hardscape,...planting]) {
      assert.ok([...part.at,...part.size,...(part.rotation||[])].every(Number.isFinite))
      assert.ok(part.size.every(n=>n>0))
      // Foliage geometry has a unit radius, so use the full scale as its bound.
      const radius=planting.includes(part)?1:.5
      assert.ok(Math.abs(part.at[0]-garden.x)+part.size[0]*radius<=garden.width/2+.001)
      assert.ok(Math.abs(part.at[2]-garden.z)+part.size[2]*radius<=garden.depth/2+.001)
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
  assert.ok(source.includes('<StaticParts parts={detail.planting} foliage/>'))
  assert.ok(source.includes('fenceDetails(length)'))
  assert.doesNotMatch(source,/fetch\(|supabase|setInterval|Date\.now|Math\.random/)
})
