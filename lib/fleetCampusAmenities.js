// Shared, testable decorative footprints; all furniture stays behind the bays.
export const CAMPUS_GARDENS = [
  ...[5.5,15.5,36,46].map((x,n)=>({id:'north-'+n,x,z:-14.6,width:6.2,depth:2.6,tone:n})),
  ...[6,18,30,39].map((x,n)=>({id:'south-'+n,x,z:11.4,width:6.2,depth:2.2,tone:n+1})),
]
export const CAMPUS_TABLES = [
  {x:7,z:-11.8,color:'#d5b07c'}, {x:38,z:-11.8,color:'#96b7aa'},
  {x:46,z:11.5,color:'#a797c1'},
]
