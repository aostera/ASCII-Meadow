// Bind the REAL source player's glyph-space foot/8-way pose to an opt-in
// native Three.js skeletal rig without replacing its original ASCII artwork.
export function sourceActorFoot(e,CW,CH){
 if(!e||![e.x,e.y,CW,CH].every(Number.isFinite)||CW<=0||CH<=0)
  throw Error('Invalid original actor position or glyph size');
 return [e.x*CW,(e.y+.7)*CH];
}
export function projectOriginalActor(e,CW,CH,pitch,sourceGlyphHeight){
 const [sx,sy]=sourceActorFoot(e,CW,CH);
 const c=Math.cos(pitch),s=Math.sin(pitch);
 if(c<=0||!Number.isFinite(sourceGlyphHeight)||sourceGlyphHeight<=0)
  throw Error('Invalid pitch or original sprite height');
 // Visual diagnostic only: this source-camera plane is NOT collision depth.
 return {position:[-sx,-sy*c,-sy*s],
  scale:sourceGlyphHeight/(8.9*c),sourceScreen:[sx,sy]};
}
export function headingForSourceD8(d8){
 const d=((Math.round(d8)%8)+8)%8;
 return Math.PI-d*Math.PI/4;
}
export function sourceKnightMotion(e,previous,dt,CW,CH){
 if(!e||!(dt>0)||!Number.isFinite(dt))throw Error('Invalid native rig clock');
 const [sx,sy]=sourceActorFoot(e,CW,CH);
 let speed=0;
 if(previous){
  const moved=Math.hypot(sx-previous.sx,sy-previous.sy);
  speed=moved/dt>0.5?Math.min(30,moved/dt/10):0;
 }
 if(e.moving||e.walk>.5)speed=Math.max(speed,e.run>.5?15:8);
 const jumping=(e.jump||0)>0;
 return {movement:{
   speed,run:(e.run||0)>.5,
   jump:jumping&&!previous?.jumping,
   heading:headingForSourceD8(e.d8||0)
  },sample:{sx,sy,jumping,d8:e.d8||0,sourceX:e.x,sourceY:e.y}};
}
