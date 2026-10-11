// Display-only traffic reservations. Never writes a trip, status, location or log.
export const TRAFFIC_SPEED = 2.3 // scene units / second, not real-world km/h
export const TRAFFIC_HEADWAY = 2.5
const SAMPLE_SECONDS = .08
const SAFETY_MARGIN = 1.1
const WIDTH = 2.05 // Includes the existing crane's folded outrigger.
const LENGTH = 3.65

const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z)
const toward = (a,b,d) => {
  const t = d / distance(a,b)
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}
}

export function trafficPath(parking,end,direction) {
  const lane = direction==='depart' ? 3.05 : .95
  const points = [{x:parking.x,z:parking.z},{x:parking.x,z:parking.z+2.5},
    {x:lane,z:parking.z+2.5},{x:lane,z:end+3}]
  if(direction==='return') points.reverse()
  const samples = [points[0]]
  for(let i=1;i<points.length-1;i++) {
    const corner=points[i],radius=Math.min(.55,distance(points[i-1],corner)/3,distance(corner,points[i+1])/3)
    const entry=toward(corner,points[i-1],radius),exit=toward(corner,points[i+1],radius)
    samples.push(entry)
    for(let n=1;n<=12;n++) {
      const t=n/12,s=1-t
      samples.push({x:s*s*entry.x+2*s*t*corner.x+t*t*exit.x,z:s*s*entry.z+2*s*t*corner.z+t*t*exit.z})
    }
  }
  samples.push(points.at(-1))
  let length=0
  const nodes=samples.map((p,i)=>{if(i) length+=distance(p,samples[i-1]);return {...p,distance:length}})
  return {nodes,length,duration:length/TRAFFIC_SPEED}
}

export function trafficPose(path,seconds) {
  const d=Math.max(0,Math.min(path.length,seconds*TRAFFIC_SPEED))
  const nodes=path.nodes
  let lo=1,hi=nodes.length-1
  while(lo<hi) {const mid=(lo+hi)>>1;if(nodes[mid].distance<d) lo=mid+1;else hi=mid}
  const a=nodes[lo-1],b=nodes[lo],t=(d-a.distance)/(b.distance-a.distance || 1)
  return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:Math.atan2(b.x-a.x,b.z-a.z)}
}

// Separating-axis test for oriented vehicle footprints, not just center points.
export function trafficOverlaps(a,b,margin=0) {
  const dx=b.x-a.x,dz=b.z-a.z
  if(Math.hypot(dx,dz)>Math.hypot(WIDTH+margin,LENGTH+margin)) return false
  const axes=pose=>[{x:Math.cos(pose.yaw),z:-Math.sin(pose.yaw)},{x:Math.sin(pose.yaw),z:Math.cos(pose.yaw)}]
  const aa=axes(a),bb=axes(b)
  const radius=(basis,axis)=> (WIDTH+margin)/2*Math.abs(basis[0].x*axis.x+basis[0].z*axis.z)
    +(LENGTH+margin)/2*Math.abs(basis[1].x*axis.x+basis[1].z*axis.z)
  return [...aa,...bb].every(axis=>Math.abs(dx*axis.x+dz*axis.z)<radius(aa,axis)+radius(bb,axis))
}

function reservationsConflict(a,b) {
  const start=Math.max(a.start,b.start),end=Math.min(a.end,b.end)
  if(end<=start) return false
  const steps=Math.ceil((end-start)/SAMPLE_SECONDS)
  for(let i=0;i<=steps;i++) {
    const t=start+(end-start)*i/steps
    if(trafficOverlaps(trafficPose(a.path,t-a.start),trafficPose(b.path,t-b.start),SAFETY_MARGIN)) return true
  }
  return false
}

export function createFleetTraffic() {
  let time=0,vehicles=new Map(),tasks=[],lastStart=-TRAFFIC_HEADWAY
  const seen=new Set()
  return {
    setFleet(fleet) {
      vehicles=new Map(fleet.filter(car=>car.parking).map(car=>[String(car.id),car]))
      tasks=tasks.filter(task=>vehicles.has(task.carId))
    },
    enqueue(moves,end) {
      for(const move of moves) {
        const id=String(move.carId),car=vehicles.get(id)
        if(!car || !move.key || seen.has(move.key) || !['depart','return'].includes(move.direction)) continue
        seen.add(move.key)
        const path=trafficPath(car.parking,end,move.direction)
        const priorEnd=Math.max(time,...tasks.filter(task=>task.carId===id).map(task=>task.end+.4))
        let start=Math.max(time,lastStart+TRAFFIC_HEADWAY,priorEnd)
        let task={...move,carId:id,path,start,end:start+path.duration}
        // A bounded space/time reservation: if a merge is occupied, wait in the
        // slot (or outside the entrance) instead of allowing another mesh through.
        const lastEnd=Math.max(time,...tasks.map(item=>item.end))
        while(start<lastEnd && tasks.some(item=>reservationsConflict(task,item))) {
          start+=.4;task={...task,start,end:start+path.duration}
        }
        tasks.push(task);lastStart=start
      }
      while(seen.size>2048) seen.delete(seen.values().next().value)
    },
    advance(delta) {
      time+=Math.max(0,Math.min(.1,delta))
      tasks=tasks.filter(task=>task.end>=time-1)
    },
    pose(id) {
      const key=String(id),car=vehicles.get(key)
      if(!car) return null
      const current=tasks.find(task=>task.carId===key && task.start<=time && task.end>time)
      if(current) return {...trafficPose(current.path,time-current.start),visible:true,moving:true,key:current.key}
      const next=tasks.find(task=>task.carId===key && task.start>time)
      return {x:car.parking.x,z:car.parking.z,yaw:0,visible:next ? next.direction==='depart' : car.status!=='on_trip',moving:false,waiting:!!next}
    },
    clear(moves=[]) {for(const move of moves) seen.add(move.key);tasks=[];lastStart=time-TRAFFIC_HEADWAY},
    busy() {return tasks.some(task=>task.end>time)},
    // Read-only snapshots for deterministic simulation tests and diagnostics.
    reservations() {return tasks.map(({path,...task})=>({...task,duration:path.duration}))},
    now() {return time},
  }
}
