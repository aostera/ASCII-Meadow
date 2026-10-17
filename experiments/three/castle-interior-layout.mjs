// Native-only castle layout. Real connected rooms and passable arch openings.
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
export const CASTLE_SPAWN=Object.freeze({x:0,z:21.5});
export const CASTLE_EXIT=Object.freeze({x:0,z:24.1,r:1.75});
export const CASTLE_DOORS=Object.freeze([
{x:0,z:18,r:3.3},{x:0,z:-18,r:3.3},
{x:-11,z:0,r:3.2},{x:11,z:0,r:3.2},
{x:-18,z:0,r:3.2},{x:18,z:0,r:3.2},
{x:-11,z:13,r:2.8},{x:11,z:13,r:2.8}
]);
export function castleWalkable(x,z,r=.55){
 if(!Number.isFinite(x)||!Number.isFinite(z))return false;
 if(CASTLE_ROOMS.some(p=>x>=p.x0+r&&x<=p.x1-r&&z>=p.z0+r&&z<=p.z1-r))return true;
 return CASTLE_DOORS.some(d=>Math.abs(x-d.x)<=d.r-r&&Math.abs(z-d.z)<=1+r);
}
export function castleMove(pos,dx,dz,r=.55){
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.35));
 let{x,z}=pos;
 for(let i=0;i<n;i++){
  const nx=x+dx/n,nz=z+dz/n;
  if(castleWalkable(nx,nz,r)){x=nx;z=nz}
  else{if(castleWalkable(nx,z,r))x=nx;if(castleWalkable(x,nz,r))z=nz}
 }
 return{x,z};
}
export function castleLocation(x,z){
 return CASTLE_ROOMS.find(p=>x>=p.x0-.15&&x<=p.x1+.15&&z>=p.z0-.15&&z<=p.z1+.15)?.name||'Каменные переходы';
}
export function castleNearExit(x,z){
 return Math.hypot(x-CASTLE_EXIT.x,z-CASTLE_EXIT.z)<CASTLE_EXIT.r;
}
