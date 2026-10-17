// Authoritative route contract, shared with castle interior, never the source map.
// Test BFS connectivity and collisions across both fully physical storeys.
import assert from 'node:assert/strict';
import {
 CASTLE_ROOMS,CASTLE_UPPER_ROOMS,CASTLE_SPAWN,CASTLE_STAIRS,
 castleMove,castleWalkable,castleNearExit,castleNearbyStair
} from '../../experiments/three/castle-interior-layout.mjs';
const step=.25,x0=-31,z0=-33,nx=250,nz=240;
const key=(ix,iz)=>iz*nx+ix;
const ixy=(x,z)=>[Math.round((x-x0)/step),Math.round((z-z0)/step)];
function reachable(start,level){
 const initial=ixy(start.x,start.z),queue=[initial],seen=new Set([key(...initial)]);
 assert(castleWalkable(start.x,start.z,.55,level),'Spawn is inside masonry');
 for(let i=0;i<queue.length;i++){
  const[ix,iz]=queue[i];
  for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
   const j=ix+dx,k=iz+dz;
   if(j<0||k<0||j>=nx||k>=nz||seen.has(key(j,k)))continue;
   if(!castleWalkable(x0+j*step,z0+k*step,.55,level))continue;
   seen.add(key(j,k));queue.push([j,k]);
  }
 }
 return seen;
}
function checkRooms(rooms,seen){
 for(const room of rooms){
  const [i,j]=ixy((room.x0+room.x1)/2,(room.z0+room.z1)/2);
  assert(seen.has(key(i,j)),room.id+' has no walkable route from stairs/gate');
 }
}
checkRooms(CASTLE_ROOMS,reachable(CASTLE_SPAWN,0));
for(const stair of CASTLE_STAIRS){
 assert(castleNearbyStair(stair.x,stair.z,0)?.id===stair.id,'Missing lower stair');
 assert(castleNearbyStair(stair.x,stair.z,1)?.id===stair.id,'Missing upper stair');
 checkRooms(CASTLE_UPPER_ROOMS.filter(p=>p.id.startsWith(stair.id)),
  reachable({x:stair.x,z:stair.z},1));
}
for(const p of [{x:0,z:0},{x:-18,z:7},{x:22,z:0}]){
 const a=castleMove(p,200,0);
 assert(a.x<31,'Run-speed collision bypassed exterior walls');
}
for(const obstacle of [{x:6,z:0},{x:-6,z:-9},{x:-8.5,z:-3},
 {x:0,z:-27},{x:-21,z:17},{x:16,z:18.5}]){
 assert(!castleWalkable(obstacle.x,obstacle.z),'Furniture/pillar is not collidable');
}
assert(!castleWalkable(15,5),'Solid wall outside hallway must block');
assert(castleWalkable(0,-19),'North arch must be open');
assert(castleNearExit(0,24.1,0),'Ground-floor exit missing');
assert(!castleNearExit(0,24.1,1),'Upper floor cannot teleport outdoors');
assert(!castleNearExit(0,0),'Exit must not trigger in main hall');
for(const level of [0,1])
 for(const p of [{x:-50,z:0},{x:50,z:0},{x:0,z:100}]){
  const a=castleMove({x:level?-25:0,z:0},p.x,p.z,.55,level);
  assert(castleWalkable(a.x,a.z,.55,level),'Substepped move escaped floor');
 }
console.log('PASS castle: 9 connected main rooms, 4 upper rooms, 2 functional stair destinations, obstruction/exit contracts');
