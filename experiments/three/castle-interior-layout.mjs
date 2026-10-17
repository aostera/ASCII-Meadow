// Source-independent castle interior geometry and movement contracts.
// Coordinates are metres in the native Three scene: x=left/right, z=north/south.
// A real ground-floor plan, two upper tower landings and a connected gallery
// on each side. Decorations with solid footprints match COLLIDERS below.
export const CASTLE_ROOMS=Object.freeze([
 {id:'nave',name:'Зал мёртвых королей',x0:-11,x1:11,z0:-18,z1:18},
 {id:'gate',name:'Привратный проход',x0:-4,x1:4,z0:18,z1:25},
 {id:'altar',name:'Осквернённый алтарь',x0:-8,x1:8,z0:-31,z1:-18},
 {id:'westPassage',name:'Западный переход',x0:-18,x1:-11,z0:-3,z1:3},
 {id:'eastPassage',name:'Восточный переход',x0:11,x1:18,z0:-3,z1:3},
 {id:'westTower',name:'Западная башня',x0:-29,x1:-18,z0:-9,z1:9},
 {id:'eastTower',name:'Восточная башня',x0:18,x1:29,z0:-9,z1:9},
 {id:'crypt',name:'Погребальная часовня',x0:-25,x1:-11,z0:10,z1:22},
 {id:'armory',name:'Оружейная',x0:11,x1:25,z0:10,z1:22}
]);
export const CASTLE_UPPER_ROOMS=Object.freeze([
 {id:'westLoft',name:'Верхний ярус западной башни',x0:-28.5,x1:-18.5,z0:-8.5,z1:8.5},
 {id:'westGallery',name:'Западная галерея',x0:-18.5,x1:-11.5,z0:-2.6,z1:2.6},
 {id:'eastLoft',name:'Верхний ярус восточной башни',x0:18.5,x1:28.5,z0:-8.5,z1:8.5},
 {id:'eastGallery',name:'Восточная галерея',x0:11.5,x1:18.5,z0:-2.6,z1:2.6}
]);
export const CASTLE_UPPER_HEIGHT=7.5;
export const CASTLE_SPAWN=Object.freeze({x:0,z:16.6});
export const CASTLE_EXIT=Object.freeze({x:0,z:24.1,r:1.75});
export const CASTLE_STAIRS=Object.freeze([
 {id:'west',x:-25,z:-2,r:3.4,label:'Западная винтовая лестница'},
 {id:'east',x:25,z:-2,r:3.4,label:'Восточная винтовая лестница'}
]);
export const CASTLE_DOORS=Object.freeze([
 {x:0,z:18,r:3.3,axis:'z'},{x:0,z:-18,r:3.3,axis:'z'},
 {x:-11,z:0,r:3.2,axis:'x'},{x:11,z:0,r:3.2,axis:'x'},
 {x:-18,z:0,r:3.2,axis:'x'},{x:18,z:0,r:3.2,axis:'x'},
 {x:-11,z:13,r:2.8,axis:'x'},{x:11,z:13,r:2.8,axis:'x'}
]);
const UPPER_DOORS=Object.freeze([
 {x:-18.5,z:0,r:2.3,axis:'x'},{x:18.5,z:0,r:2.3,axis:'x'}
]);
// Low-resolution obstacles genuinely block the knight. Corresponding models
// are in CastleInterior.build(); central aisle and every doorway are free.
export const CASTLE_OBSTACLES=Object.freeze([
 ...[-11,-3,5].flatMap(z=>[-8.5,8.5].map(x=>({x,z,hw:.65,hd:.65}))),
 ...[-9,0,9].flatMap(z=>[-6,6].map(x=>({x,z,hw:2,hd:.7}))),
 {x:0,z:-27,hw:2.5,hd:1.1},
 {x:-21,z:17,hw:1.1,hd:2.1},{x:-16,z:17,hw:1.1,hd:2.1},
 {x:16,z:18.5,hw:1.1,hd:.65},{x:21,z:18.5,hw:1.1,hd:.65}
]);
const inRoom=(room,x,z,r)=>x>=room.x0+r&&x<=room.x1-r&&z>=room.z0+r&&z<=room.z1-r;
const inDoor=(door,x,z,r)=>door.axis==='x'
 ?Math.abs(x-door.x)<=1+r&&Math.abs(z-door.z)<=door.r-r
 :Math.abs(z-door.z)<=1+r&&Math.abs(x-door.x)<=door.r-r;
export function castleWalkable(x,z,r=.55,level=0){
 if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(r)||r<0)return false;
 if(level!==0&&level!==1)return false;
 const rooms=level?CASTLE_UPPER_ROOMS:CASTLE_ROOMS;
 const doors=level?UPPER_DOORS:CASTLE_DOORS;
 const floor=rooms.some(p=>inRoom(p,x,z,r))||doors.some(d=>inDoor(d,x,z,r));
 if(!floor)return false;
 return level===1||!CASTLE_OBSTACLES.some(o=>
   Math.abs(x-o.x)<o.hw+r&&Math.abs(z-o.z)<o.hd+r);
}
export function castleMove(pos,dx,dz,r=.55,level=0){
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.25));
 let{x,z}=pos;
 for(let i=0;i<n;i++){
  const nx=x+dx/n,nz=z+dz/n;
  if(castleWalkable(nx,nz,r,level)){x=nx;z=nz}
  else{
   if(castleWalkable(nx,z,r,level))x=nx;
   if(castleWalkable(x,nz,r,level))z=nz;
  }
 }
 return{x,z};
}
export function castleLocation(x,z,level=0){
 const rooms=level===1?CASTLE_UPPER_ROOMS:CASTLE_ROOMS;
 return rooms.find(p=>x>=p.x0-.15&&x<=p.x1+.15&&z>=p.z0-.15&&z<=p.z1+.15)?.name||'Каменные переходы';
}
export function castleNearExit(x,z,level=0){
 return level===0&&Math.hypot(x-CASTLE_EXIT.x,z-CASTLE_EXIT.z)<CASTLE_EXIT.r;
}
export function castleNearbyStair(x,z,level=0){
 if(level!==0&&level!==1)return null;
 return CASTLE_STAIRS.find(s=>Math.hypot(x-s.x,z-s.z)<s.r)||null;
}
