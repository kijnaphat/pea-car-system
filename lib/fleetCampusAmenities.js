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
  gravel:'#b8b5a1', soil:'#5e6750', leaf:['#536b4a','#718657','#8f9a6a','#657d58'],
  reed:'#bcac7a', flower:'#d6c286', light:'#f1deb0',
}

const part = (at,size,color,rotation) => ({at,size,color,...(rotation?{rotation}:{})})

// All repeated landscape pieces are built once and rendered as two instanced
// batches for the whole site, rather than one mesh per blade, shrub or stone.
export function gardenDetails(gardens=CAMPUS_GARDENS) {
  const hardscape=[],planting=[]
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
      const along=-width/2+.42+n*(width-.84)/7
      planting.push(local([along,.37,-depth*.28],[.35,.2,.28],LANDSCAPE.leaf[(tone+n)%4]))
      planting.push(local([along+.06,.37,depth*.28],[.3,.2,.25],LANDSCAPE.leaf[(tone+n+1)%4]))
    }
    for(const [n,along] of [-1.7,1.65].entries()) {
      const offset=n?-.08:.08,height=2.9+(tone%3)*.18
      hardscape.push(local([along,1.08,offset],[.13,1.8,.13],'#8f8063'))
      hardscape.push(local([along-.17,1.65,offset],[.065,.85,.065],'#8f8063',[0,0,-.35]))
      hardscape.push(local([along+.18,1.62,offset],[.065,.8,.065],'#8f8063',[0,0,.4]))
      for(let crown=0;crown<5;crown++) {
        const angle=crown*Math.PI*2/5
        planting.push(local([along+Math.cos(angle)*.3,height+Math.sin(angle*2)*.2,offset+Math.sin(angle)*.22],
          [.73,.85,.65],LANDSCAPE.leaf[(tone+n+crown)%4]))
      }
      planting.push(local([along,height+.46,offset],[.66,.66,.59],LANDSCAPE.leaf[(tone+n+2)%4]))
    }
    // Low sculptural shrubs, tiny pale flowers and reed tufts, all below sight
    // lines to the fleet bays and safely contained by the existing bed bounds.
    for(const along of [-.58,.1,.76]) {
      planting.push(local([along,.48,.03],[.46,.35,.43],LANDSCAPE.leaf[(tone+2)%4]))
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
  return {hardscape,planting}
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
