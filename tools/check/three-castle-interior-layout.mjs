// Pure floor plan test: every named room is reachable on foot from the gate,
// doorways are genuinely open and walls cannot be crossed at run speed.
import assert from 'node:assert/strict';
import {CASTLE_ROOMS,CASTLE_SPAWN,castleMove,castleWalkable,castleNearExit} from '../../experiments/three/castle-interior-layout.mjs';
const step=.5,x0=-30,z0=-32,nx=122,nz=118;
const key=(ix,iz)=>iz*nx+ix;
const ixy=(x,z)=>[Math.round((x-x0)/step),Math.round((z-z0)/step)];
const start=ixy(CASTLE_SPAWN.x,CASTLE_SPAWN.z),queue=[start],seen=new Set([key(...start)]);
for(let at=0;at<queue.length;at++){
 const [ix,iz]=queue[at];
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const j=ix+dx,k=iz+dz;
  if(j<0||k<0||j>=nx||k>=nz||seen.has(key(j,k)))continue;
  if(!castleWalkable(x0+j*step,z0+k*step))continue;
  seen.add(key(j,k));queue.push([j,k]);
 }
}
for(const room of CASTLE_ROOMS){
 const midX=(room.x0+room.x1)/2,midZ=(room.z0+room.z1)/2;
 const [i,j]=ixy(midX,midZ);
 assert(seen.has(key(i,j)),room.id+' cannot be reached from castle gate');
}
for(const p of [{x:0,z:0},{x:-18,z:7},{x:22,z:0}]){
 const a=castleMove(p,200,0);
 assert(a.x<31,'Run-speed collision bypassed the exterior walls');
}
assert(!castleWalkable(15,5),'Solid wall outside hallway must block');
assert(castleWalkable(0,-19),'North arch must be open');
assert(castleNearExit(0,24.1),'Exit must be reached through vestibule');
assert(!castleNearExit(0,0),'Exit must not trigger in main hall');
console.log('PASS castle: connected',CASTLE_ROOMS.length,'rooms, door passage and collision/exit contract');
