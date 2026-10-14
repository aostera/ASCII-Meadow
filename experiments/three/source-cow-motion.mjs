// An opt-in native cow follows the REAL authored cow simulation. No random
// substitute motion, and absolutely no writes to the game entity / map.
import {projectOriginalActor,headingForSourceD8,sourceActorFoot} from './source-motion.mjs';
export const COW_GRAZE_DOWN=.9,COW_GRAZE_UP=.75;
export const COW_HOP_START=.18,COW_HOP_END=.66;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function sourceCowPose(c,previous,dt,CW,CH,now=0){
 if(!c||!(dt>0)||![CW,CH].every(x=>Number.isFinite(x)&&x>0))
  throw Error('Invalid original cow or clock');
 const [sx,sy]=sourceActorFoot(c,CW,CH);
 const state=['walk','run','hop','graze'].includes(c.state)?c.state:'idle';
 const speed=previous?Math.hypot(sx-previous.sx,sy-previous.sy)/dt:0;
 const locomotion=state==='walk'?1:state==='run'?1.8:0;
 let lower=0;
 if(state==='graze'){
  if(c.gp==='down')lower=clamp((c.at||0)/COW_GRAZE_DOWN,0,1);
  else if(c.gp==='up')lower=1-clamp((c.at||0)/COW_GRAZE_UP,0,1);
  else lower=1;
 }
 const hop=state==='hop'&&c.at>COW_HOP_START&&c.at<COW_HOP_END?
  Math.sin(Math.PI*(c.at-COW_HOP_START)/(COW_HOP_END-COW_HOP_START)):0;
 const sway=state==='graze'&&c.gp==='loop'?
  Math.sin((c.at||0)*Math.PI*5)*.09:0;
 return {
  state,d8:c.d8||0,heading:headingForSourceD8(c.d8||0),
  // Walk and run are authored state flags, not inferred from smoothing.
  speed:locomotion*(speed>0.5?1:0.55),
  gait:locomotion,lowerHead:lower,headSway:sway,hop,
  time:now,sourceFoot:[sx,sy],source:[c.x,c.y],
  sample:{sx,sy,state,d8:c.d8||0}
 };
}
export function projectSourceCow(c,CW,CH,pitch,sourceHeight){
 const loc=projectOriginalActor(c,CW,CH,pitch,sourceHeight);
 return {...loc,sourceHeight};
}
