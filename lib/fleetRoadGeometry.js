// One unioned road footprint. Curbs are its outer boundary, never interior seams.
import polygonClipping from 'polygon-clipping'
import { SITE, SITE_ROADS, SITE_CHARGING } from './fleetSiteLayout.js'
import { CHARGING_ACCESS_X, chargingAisle } from './fleetCharging.js'

const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)
const towards=(a,b,d)=>{const t=d/distance(a,b);return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t}}
export function roundedPolyline(points,radius=8,steps=20) {
  const out=[points[0]]
  for(let i=1;i<points.length-1;i++) {
    const corner=points[i],r=Math.min(radius,distance(points[i-1],corner)/3,distance(corner,points[i+1])/3)
    const a=towards(corner,points[i-1],r),b=towards(corner,points[i+1],r)
    out.push(a)
    for(let n=1;n<=steps;n++) {const t=n/steps,s=1-t;out.push({x:s*s*a.x+2*s*t*corner.x+t*t*b.x,z:s*s*a.z+2*s*t*corner.z+t*t*b.z})}
  }
  out.push(points.at(-1));return out
}
export function ribbon(points,width) {
  const edges=[-1,1].map(sign=>points.map((p,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)]
    const length=distance(a,b)
    return [p.x-sign*(b.z-a.z)/length*width/2,p.z+sign*(b.x-a.x)/length*width/2]
  }))
  return [edges[0].concat(edges[1].reverse())]
}
function softenRing(ring) {
  const points=ring.slice(0,-1).map(([x,z])=>({x,z})),out=[]
  points.forEach((p,i)=>{
    const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length]
    const cross=(p.x-a.x)*(b.z-p.z)-(p.z-a.z)*(b.x-p.x)
    // Concave junction corners gain a smooth fillet; no corner fills over bays.
    if(cross>=-.01) {out.push([p.x,p.z]);return}
    const r=Math.min(2,distance(a,p)/3,distance(p,b)/3),entry=towards(p,a,r),exit=towards(p,b,r)
    out.push([entry.x,entry.z])
    for(let n=1;n<=12;n++) {const t=n/12,s=1-t;out.push([s*s*entry.x+2*s*t*p.x+t*t*exit.x,s*s*entry.z+2*s*t*p.z+t*t*exit.z])}
  })
  return [...out,out[0]]
}
export function roadNetwork(overflowAisles=[],chargingRows=1) {
  const main=roundedPolyline([{...SITE.entrance},{x:SITE.roadStart,z:0},{x:SITE.roadEnd,z:0}])
  const routes=[{key:'spine',points:main,width:8.8},...SITE_ROADS.filter(r=>!['main','approach'].includes(r.key)).map(r=>({...r,points:r.from&&[{x:r.from[0],z:r.from[1]},{x:r.to[0],z:r.to[1]}]}))]
  if(overflowAisles.length) {
    routes.push({key:'rear-access',width:3.8,points:[{x:SITE.exit.x,z:0},{x:SITE.exit.x,z:Math.max(...overflowAisles)}]})
    overflowAisles.forEach(z=>routes.push({key:'rear-'+z,width:5.2,points:[{x:0,z},{x:SITE.exit.x,z}]}))
  }
  const polygons=routes.map(r=>ribbon(r.points,r.width))
  // Charging forecourt connects to the main road; extra roofs remain left of P31+.
  polygons.push(ribbon([{x:SITE_CHARGING.x,z:4.2},{x:SITE_CHARGING.x,z:9+(chargingRows-1)*SITE_CHARGING.rowSpacing}],SITE_CHARGING.width+1))
  const access=[{x:CHARGING_ACCESS_X,z:3},{x:CHARGING_ACCESS_X,z:chargingAisle({z:9+(chargingRows-1)*SITE_CHARGING.rowSpacing})}]
  polygons.push(ribbon(access,2.2))
  const surface=polygonClipping.union(...polygons).map(poly=>poly.map(softenRing))
  const pavement=polygonClipping.union(...routes.map(r=>ribbon(r.points,r.width+.5)),ribbon([{x:SITE_CHARGING.x,z:4.2},{x:SITE_CHARGING.x,z:9+(chargingRows-1)*SITE_CHARGING.rowSpacing}],SITE_CHARGING.width+1.5),ribbon(access,2.7)).map(poly=>poly.map(softenRing))
  return {routes,surface,pavement}
}
export function samplePolyline(points,d) {
  for(let i=1;i<points.length;i++) {const a=points[i-1],b=points[i],length=distance(a,b)
    if(d<=length) {const t=d/length;return {x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:Math.atan2(b.x-a.x,b.z-a.z)}}
    d-=length
  }
  const a=points.at(-2),b=points.at(-1);return {...b,yaw:Math.atan2(b.x-a.x,b.z-a.z)}
}
export function roadDashes(route) {
  const length=route.points.slice(1).reduce((n,p,i)=>n+distance(p,route.points[i]),0),dashes=[]
  for(let d=1.5;d<length-.6;d+=3) {
    const p=samplePolyline(route.points,d)
    // Clear both T junctions rather than painting a stop/edge line across them.
    if([{...SITE.entrance},{...SITE.exit},{x:SITE.exit.x,z:0}].some(j=>distance(p,j)<4.5)) continue
    if(distance(p,{x:-35,z:-17.55})<1.6) continue
    dashes.push(p)
  }
  return dashes
}
export function pointInRoad(point,surface) {
  const inside=ring=>{let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [x,z]=ring[i],[xx,zz]=ring[j]
    if((z>point.z)!==(zz>point.z) && point.x<(xx-x)*(point.z-z)/(zz-z)+x) hit=!hit
  }return hit}
  return surface.some(poly=>inside(poly[0])&&!poly.slice(1).some(inside))
}
