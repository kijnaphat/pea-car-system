// Camera-only state: independent from polling, vehicle records and animation.
export const DEFAULT_ORBIT = { azimuth: Math.atan2(4,40), elevation: Math.atan2(58,Math.hypot(4,40)), zoomFactor: 1 }
export const MIN_ELEVATION = Math.PI/18
export const MAX_ELEVATION = Math.PI*85/180
export const clampElevation = value => Math.max(MIN_ELEVATION,Math.min(MAX_ELEVATION,value))

export function cameraView(memory,previous,next) {
  if(!previous || next.reset!==previous.reset) return {...DEFAULT_ORBIT,target:null}
  return {...memory,
    azimuth:memory.azimuth+((next.turn||0)-(previous.turn||0))*Math.PI/6,
    elevation:clampElevation(memory.elevation+((next.tilt||0)-(previous.tilt||0))*Math.PI/18),
    zoomFactor:memory.zoomFactor*(next.zoom||1.08)/(previous.zoom||1.08)}
}

export function cameraOffset(orbit,top=false) {
  const radius=Math.hypot(4,58,40)
  if(top) return {x:0,y:radius,z:.001}
  const flat=radius*Math.cos(orbit.elevation)
  return {x:Math.sin(orbit.azimuth)*flat,y:Math.sin(orbit.elevation)*radius,z:Math.cos(orbit.azimuth)*flat}
}

export function captureOrbit(memory,{azimuth,polar,zoomFactor,target},top=false) {
  return {...memory,...(!top ? {azimuth,elevation:clampElevation(Math.PI/2-polar)} : {}),zoomFactor,target}
}
