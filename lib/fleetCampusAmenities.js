// Shared, testable decorative footprints; all furniture stays behind the bays.
export const CAMPUS_GARDENS = [
  ...[5.5,15.5,36,46].map((x,n)=>({id:'north-'+n,x,z:-14.6,width:6.2,depth:2.6,tone:n})),
  ...[6,18,30,39].map((x,n)=>({id:'south-'+n,x,z:11.4,width:6.2,depth:2.2,tone:n+1})),
]
export const CAMPUS_TABLES = [
  {x:7,z:-11.8,color:'#d5b07c'}, {x:38,z:-11.8,color:'#96b7aa'},
  {x:46,z:11.5,color:'#a797c1'},
]

// A restrained landscape palette, like a physical architectural scale model.
// These are decorative meshes only: no moving paths, slots or real-world data.
export const LANDSCAPE = {
  limestone:'#d9d4c5', joint:'#aaa99a', timber:'#a17d52', bronze:'#59635b',
  gravel:'#b8b5a1', soil:'#5e6750', leaf:['#456448','#6f8551','#9aa579','#5b774b','#7f9564','#3d5e45'],
  reed:'#bcac7a', flower:'#d6c286', light:'#f1deb0',
}

const part = (at,size,color,rotation) => ({at,size,color,...(rotation?{rotation}:{})})

// Position-based deformation keeps duplicate UV-seam/pole vertices coincident.
// Radius is capped at one so the planting clearance bounds remain conservative.
export function landscapeCrownPoint(x,y,z) {
  const radius=.9+.055*Math.sin(x*13+y*7+z*9)+.045*Math.cos(z*15-x*8+y*11)
  return [x*radius,y*radius,z*radius]
}

// Stable, local variation avoids a nursery-like line of identical tree spheres.
// It never depends on a clock/random source, keeping refreshes visually calm.
const variation=(seed)=>{const value=Math.sin(seed*12.9898+78.233)*43758.5453;return value-Math.floor(value)}

// Three batches for the whole landscape: hardscape, organic foliage, and tapered
// trunks/branches. No per-tree geometries, textures or per-frame matrix updates.
export function gardenDetails(gardens=CAMPUS_GARDENS) {
  const hardscape=[],planting=[],branches=[]
  for(const garden of gardens) {
    const {x,z,width,depth,tone}=garden
    const local=(at,size,color,rotation)=>part([x+at[0],at[1],z+at[2]],size,color,rotation)
    hardscape.push(local([0,.09,0],[width,.18,depth],LANDSCAPE.limestone))
    hardscape.push(local([0,.19,0],[width-.18,.045,depth-.18],LANDSCAPE.gravel))
    // Real inset edging and a dark planting pocket give the beds visible depth.
    hardscape.push(local([0,.22,0],[width-.34,.045,depth-.34],LANDSCAPE.soil))
    for(const edge of [-1,1]) {
      hardscape.push(local([0,.22,edge*(depth/2-.06)],[width,.08,.1],LANDSCAPE.limestone))
      hardscape.push(local([edge*(width/2-.06),.22,0],[.1,.08,depth],LANDSCAPE.limestone))
    }
    for(let n=0;n<8;n++) {
      const along=-width/2+.42+n*(width-.84)/7,jitter=(variation(tone*17+n)-.5)*.1
      planting.push(local([along,.32+jitter,-depth*.28+jitter],[.29+jitter,.16,.24],LANDSCAPE.leaf[(tone+n)%6],[0,n*.7,0]))
      planting.push(local([along+.06,.34-jitter,depth*.28-jitter],[.29,.17,.23],LANDSCAPE.leaf[(tone+n+1)%6],[0,n*.6,0]))
    }
    for(const [n,along] of [-1.7,1.65].entries()) {
      const seed=tone*13+n*7+x*.17+z*.31,height=2.6+variation(seed)*.85,offset=(variation(seed+1)-.5)*.18
      const lean=(variation(seed+2)-.5)*.11,spread=.65+variation(seed+3)*.13
      branches.push(local([along,1.2,offset],[.085,2.05,.085],'#877253',[0,0,lean]))
      // An asymmetric Y-branch is exposed below the foliage, unlike a sphere on
      // a stick. A smaller companion crown varies the paired garden silhouette.
      for(const sign of [-1,1]) branches.push(local([along+sign*.2,1.88,offset],[.045,1.12,.045],'#8a7658',[0,0,sign*-.43+lean]))
      for(let crown=0;crown<8;crown++) {
        const angle=crown*2.39996+variation(seed+4)*Math.PI
        const radius=.16+variation(seed+crown+5)*.26
        const level=(crown%3-1)*.31
        planting.push(local([along+Math.cos(angle)*radius,height+level,offset+Math.sin(angle)*radius*.56],
          [spread*(.7+variation(seed+crown)*.25),.53+variation(seed+crown+2)*.25,.48+variation(seed+crown+7)*.12],
          LANDSCAPE.leaf[(tone+n+crown)%6],[0,angle,0]))
      }
      planting.push(local([along-.09,height+.57,offset],[spread*.66,.53,.44],LANDSCAPE.leaf[(tone+n+2)%6],[0,seed,.16]))
    }
    // Low sculptural shrubs, tiny pale flowers and reed tufts, all below sight
    // lines to the fleet bays and safely contained by the existing bed bounds.
    for(const along of [-.58,.1,.76]) {
      planting.push(local([along,.48,.03],[.46,.35,.43],LANDSCAPE.leaf[(tone+2)%6],[0,along,0]))
      planting.push(local([along,.69,.05],[.06,.07,.06],LANDSCAPE.flower))
    }
    for(const sign of [-1,1]) {
      for(let blade=0;blade<5;blade++) {
        const tilt=(blade-2)*.13
        hardscape.push(local([sign*(width/2-.42)+tilt*.3,.49,tilt],
          [.024,.5+((blade+tone)%3)*.12,.025],blade%2?LANDSCAPE.reed:LANDSCAPE.leaf[2],[tilt,0,tilt]))
      }
      for(let stone=0;stone<3;stone++) planting.push(local([sign*(width/2-.55)+stone*.11,.28,-.25],
        [.15,.07,.12],stone%2?'#c5c0a8':'#d7d0b9'))
    }
  }
  return {hardscape,planting,branches}
}

export function fenceDetails(length) {
  const parts=[]
  for(const y of [.34,1.1]) parts.push(part([0,y,0],[.065,.065,length],LANDSCAPE.bronze))
  const bays=Math.max(1,Math.ceil(length/1.6))
  for(let n=0;n<=bays;n++) {
    const z=-length/2+n*length/bays
    parts.push(part([0,.08,z],[.24,.16,.24],LANDSCAPE.limestone))
    parts.push(part([0,.69,z],[.09,1.3,.09],LANDSCAPE.bronze))
    if(n<bays) for(let picket=1;picket<5;picket++) parts.push(part([0,.73,z+length/bays*picket/5],[.035,.82,.035],LANDSCAPE.bronze))
  }
  return parts
}
