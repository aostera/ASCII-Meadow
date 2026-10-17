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
 const jumping=(e.jump||0)>0;
 // Exactly as in the production-map adapter: input intent cannot be
 // substituted for distance. Held Walk/Run against collision, airborne
 // movement and map teleports must NOT animate phantom ground steps.
 const moved=previous?Math.hypot(sx-previous.sx,sy-previous.sy):0;
 const pxPerMetre=Number.isFinite(e.pxPerMetre)&&e.pxPerMetre>0?
   e.pxPerMetre:24;
 const movedMetres=moved/pxPerMetre;
 // The first grounded frame may still carry jump-arc map displacement.
 // Do not convert it into a phantom walk/run stride on touchdown.
 const validStep=Boolean(previous)&&!jumping&&!previous?.jumping&&
   Boolean(e.moving||(e.walk||0)>.5)&&
   movedMetres<.20&&movedMetres/dt<12;
 const speed=validStep&&moved>.001?
   Math.min(36,moved/dt/10):0;
 return {movement:{
   speed,run:(e.run||0)>.5,
   jump:jumping&&!previous?.jumping,
   heading:headingForSourceD8(e.d8||0)
  },sample:{sx,sy,jumping,d8:e.d8||0,sourceX:e.x,sourceY:e.y}};
}
