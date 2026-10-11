// Fictional people on pedestrian-only routes; never a real employee or GPS feed.
export const WALKERS = [
  {id:'office-a',path:[[4,-10],[44,-10]],speed:.48,phase:.05,color:'#339d91'},
  {id:'office-b',path:[[7,-12],[47,-12]],speed:.42,phase:.6,color:'#617bc1'},
  {id:'parking-a',path:[[23,13.6],[47,13.6]],speed:.46,phase:.4,color:'#c69f50'},
  {id:'parking-b',path:[[26,14.2],[48,14.2]],speed:.4,phase:.85,color:'#6e9f86'},
  {id:'garden-a',path:[[-51,-2],[-51,5],[-48,10],[-41,12]],speed:.36,phase:.25,color:'#9a79b2'},
  {id:'garden-b',path:[[-54,-7],[-53,0],[-52,7]],speed:.34,phase:.65,color:'#468ab7'},
  {id:'entrance-crew',path:[[-33.4,-27.2],[-27.8,-19.7]],speed:.33,phase:.2,color:'#de9951',helmet:true},
  {id:'charging-crew',path:[[-26,13.7],[-18,13.7]],speed:.32,phase:.7,color:'#37a796',helmet:true},
]

export const STATIC_PEOPLE = [
  {id:'garden-seat-a',x:-44.8,z:7.5,yaw:0,color:'#718bc0',seated:true},
  {id:'garden-seat-b',x:-43.3,z:7.5,yaw:0,color:'#d2a357',seated:true},
  {id:'coffee-a',x:-8.2,z:-13.2,yaw:Math.PI/2,color:'#6389b1'},
  {id:'coffee-b',x:-3.8,z:-13.2,yaw:-Math.PI/2,color:'#b67b9d'},
  {id:'utility-crew',x:23.1,z:-13.6,yaw:Math.PI/2,color:'#db9a4d',helmet:true},
  {id:'gate-guard',x:62,z:-12,yaw:-Math.PI/2,color:'#487b93'},
  {id:'garden-chat-a',x:-47.8,z:4.8,yaw:Math.PI/3,color:'#3a9d88',wave:true},
  {id:'garden-chat-b',x:-46.8,z:4.8,yaw:-Math.PI/3,color:'#b694c1'},
]

export function walkingPose(person,seconds=0) {
  const segments=person.path.slice(1).map((p,i)=>({a:person.path[i],b:p,length:Math.hypot(p[0]-person.path[i][0],p[1]-person.path[i][1])}))
  const length=segments.reduce((n,s)=>n+s.length,0)
  const progress=((seconds*person.speed+person.phase*length*2)%(length*2)+length*2)%(length*2)
  const back=progress>length
  let distance=back ? length*2-progress : progress
  for(const segment of segments) {
    if(distance<=segment.length) {
      const t=distance/segment.length
      return {x:segment.a[0]+(segment.b[0]-segment.a[0])*t,z:segment.a[1]+(segment.b[1]-segment.a[1])*t,
        yaw:Math.atan2(segment.b[0]-segment.a[0],segment.b[1]-segment.a[1])+(back?Math.PI:0),gait:Math.sin(seconds*5.5+person.phase*8)*.42}
    }
    distance-=segment.length
  }
  return {x:person.path[0][0],z:person.path[0][1],yaw:0,gait:0}
}

// At most 10 ambient redraws/second, none while hidden or in reduced-motion mode.
export function startCampusLife(invalidate,{page=globalThis.document,timers=globalThis}={}) {
  let timer,stopped=false
  const stopTimer=()=>{if(timer!==undefined) timers.clearTimeout(timer);timer=undefined}
  const tick=()=>{if(stopped||page.visibilityState!=='visible') return;invalidate();timer=timers.setTimeout(tick,100)}
  const change=()=>{stopTimer();if(page.visibilityState==='visible') tick()}
  page.addEventListener('visibilitychange',change);change()
  return ()=>{stopped=true;stopTimer();page.removeEventListener('visibilitychange',change)}
}
