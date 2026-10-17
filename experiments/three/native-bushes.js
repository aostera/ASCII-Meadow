// Native-only contact interaction for the ORIGINAL authored Gothic bush.
// Branch groups bend with delayed springs around passing animals/people.
// Backing and leaves travel together and follow a nonuniform crown profile;
// a body in the crown shakes it, it never cuts it open.
// No change to authored glyph IDs, luminance, alpha, map or source assets.
const nativeOriginalUpdateFlora=updateFlora;
const nativeOriginalDrawFlora=drawFlora;
const NATIVE_BUSH_OPEN_SPEED=10.5,NATIVE_BUSH_CLOSE_SPEED=3.2;
const NATIVE_BUSH_TWIGS=9;
const nativeClamp=(n,a,b)=>Math.max(a,Math.min(b,n));

function nativeBushApproach(current,target,dt){
  if(!(dt>0))return current;
  const rate=target>current?NATIVE_BUSH_OPEN_SPEED:NATIVE_BUSH_CLOSE_SPEED;
  return nativeClamp(current+(target-current)*
    (1-Math.exp(-Math.min(dt,.08)*rate)),0,1);
}
function nativeBushLeafShift(localX,openingCenter,radius,strength){
  if(!(strength>0)||!(radius>0))return 0;
  const dx=localX-openingCenter;
  const reach=nativeClamp(1-Math.abs(dx)/(radius*.9),0,1);
  const smooth=reach*reach*(3-2*reach);
  return (dx<0?-1:1)*radius*.29*strength*smooth;
}
function nativeBushContact(f,actor,CW,CH){
  if(!f||!actor||!f.v||f.v.type!=='bush')return 0;
  const rad=Math.max(2,f.v.R/CW);
  const dx=Math.abs((actor.x-f.x)/rad);
  const py=(actor.y+.7)*CH,rootY=f.br*CH;
  const ry=Math.max(CH*2.5,f.v.crownH*.38);
  const dy=Math.abs(py-(rootY-f.v.crownH*.14))/ry;
  const d=Math.hypot(dx,dy);
  if(d>=1)return 0;
  return Math.pow(1-d,.65)*Math.min(1,actor.moving?1:.9);
}
function nativeBushActors(){return ents}

function nativeBushTwigIndex(localX,radius){
  return nativeClamp(Math.floor((localX/radius*.5+.5)*NATIVE_BUSH_TWIGS),
    0,NATIVE_BUSH_TWIGS-1);
}
// Every branch has a separate damped spring. A contact slightly off-centre
// leaves the opposite part of the crown moving by a different amount.
function nativeBushSpring(position,velocity,target,dt){
  const step=Math.min(.05,Math.max(0,dt));
  const k=target===0?42:85;
  const damping=target===0?9:6;
  const v=(velocity+(target-position)*k*step)*Math.exp(-damping*step);
  return [nativeClamp(position+v*step,-1.6,1.6),v];
}
// The crown is never cut open: an actor in the bush shakes it. Each stride
// kicks a few nearby boughs (an impulse into their springs), the crown
// trembles while the actor keeps moving, leans a little away from the body,
// and rings down with damped oscillation once it has passed.
const NATIVE_BUSH_KICK=6.5,NATIVE_BUSH_STRIDE=.24;
function nativeBushBranchShift(f,x,yFactor){
  const R=Math.max(4,f.v.R),branches=f.nativeTwigs;
  if(!branches)return 0;
  const normalized=nativeClamp((x/R+1)*.5,0,1)*(NATIVE_BUSH_TWIGS-1);
  const lo=Math.floor(normalized),hi=Math.min(NATIVE_BUSH_TWIGS-1,lo+1);
  const blend=normalized-lo,smooth=blend*blend*(3-2*blend);
  const bend=branches[lo]*(1-smooth)+branches[hi]*smooth;
  // The woody lower stalk stays anchored, the mid-crown and soft upper tips
  // swing.
  const h=nativeClamp(yFactor,0,1);
  const flex=Math.pow(Math.sin(Math.PI*(h*.83+.07)),.75);
  return bend*R*.36*flex;
}
updateFlora=function(dt){
  nativeOriginalUpdateFlora(dt);
  if(!(dt>0))return;
  const lo=floraLowerBound(VY0-40),hi=VY1+FLMAXR+40;
  const actors=nativeBushActors();
  for(let i=lo;i<flora.length&&flora[i].br<=hi;i++){
    const f=flora[i];if(f.v.type!=='bush')continue;
    let target=0,source=null;
    const R=Math.max(4,f.v.R),reach=R/CW+3;
    for(const a of actors){
      if(Math.abs(a.x-f.x)>reach||
         Math.abs(a.y+.7-f.br)>f.v.crownH/CH+4)continue;
      const c=nativeBushContact(f,a,CW,CH);
      if(c>target){target=c;source=a}
    }
    f.nativePart=nativeBushApproach(f.nativePart||0,target,dt);
    // How fast the actor in the crown is actually moving (cells/s, 0..1).
    let stride=0;
    if(source){
      f.nativePartCenter=(source.x-f.x)*CW;
      const last=f.nativeSource===source?f.nativeSourceAt:null;
      if(last)stride=nativeClamp(Math.hypot(source.x-last[0],
        (source.y-last[1])*CH/CW)/dt/9,0,1);
      f.nativeSource=source;f.nativeSourceAt=[source.x,source.y];
      // The source rustle (single leaves twitching) for every actor, not
      // only the knight.
      f.rust=Math.max(f.rust||0,target*stride);
    }else{f.nativeSource=null;f.nativeSourceAt=null}
    const twigs=f.nativeTwigs||(f.nativeTwigs=new Float32Array(NATIVE_BUSH_TWIGS));
    const velocity=f.nativeTwigVel||(f.nativeTwigVel=new Float32Array(NATIVE_BUSH_TWIGS));
    // A stride lands every NATIVE_BUSH_STRIDE seconds of movement.
    let kick=false;
    if(source&&stride>.05){
      f.nativeStride=(f.nativeStride||0)+dt*stride;
      if(f.nativeStride>=NATIVE_BUSH_STRIDE){f.nativeStride-=NATIVE_BUSH_STRIDE;kick=true}
    }
    const step=Math.floor((f.nativeKicks=(f.nativeKicks||0)+(kick?1:0)));
    for(let j=0;j<NATIVE_BUSH_TWIGS;j++){
      const branchX=(j/(NATIVE_BUSH_TWIGS-1)*2-1)*R*.88;
      let force=0;
      if(source){
        const gap=branchX-f.nativePartCenter;
        const falloff=Math.max(0,1-Math.abs(gap)/(R*.88));
        const spread=gap<-R*.025?-1:gap>R*.025?1:(j<NATIVE_BUSH_TWIGS/2?-1:1);
        const shoulder=.65+.35*Math.cos((j*2.3+f.ph)*.9);
        // A slight lean away from the body; the motion comes from kicks.
        force=spread*target*falloff*shoulder*.2;
        if(kick){
          const r=hash(j+step*17,Math.floor(f.ph*1000));
          velocity[j]+=(r-.5)*2*NATIVE_BUSH_KICK*target*(.35+.65*falloff)*
            (.6+.4*stride);
        }
      }
      const spring=nativeBushSpring(twigs[j],velocity[j],force,dt);
      twigs[j]=spring[0];velocity[j]=spring[1];
    }
    if(!source&&f.nativePart<.003){
      f.nativePart=0;
      if(!twigs.some(x=>Math.abs(x)>.012)){f.nativePartCenter=0;f.nativeStride=0}
    }
  }
};
drawFlora=function(f){
  if(f.v.type!=='bush'||!f.nativeTwigs||
    !(f.nativePart>.003||f.nativeTwigs.some(x=>Math.abs(x)>.012))){
    nativeOriginalDrawFlora(f);
    return;
  }
  const v=f.v,bx=Math.round(f.x)*CW,by=f.br*CH;
  const H=v.crownH,fw=v.fw,fh=v.fh,R=Math.max(4,v.R);
  const lean=(f.sw||0)*2;
  const rs=Math.min(1,(f.rust||0)+(f.flut||0)*.3);
  const tick=Math.floor(t*9),fade=f.fade===undefined?1:f.fade;
  const L=v.list,runs=v.runs;

  // A moved bush should never leave behind a full-width unbent dark
  // rectangle. Reconstruct short dark backing tiles that follow the same
  // independent bough positions; this also preserves the original holes.
  for(let k=0;k<runs.length;k+=3){
    const y=runs[k],hf=nativeClamp(-y*fh/H,0,1);
    const sw=lean*hf*Math.sqrt(hf);
    const from=runs[k+1],to=runs[k+2];
    for(let cell=from;cell<to;cell+=2){
      const n=Math.min(2,to-cell),local=(cell+n*.5)*fw+sw;
      const shift=nativeBushBranchShift(f,local,hf);
      // A slightly ragged silhouette, instead of one straight crop.
      grect(bx+cell*fw+sw+shift-.3,by+y*fh-.3,
        n*fw+.6,fh+.6,.97*fade);
    }
  }
  for(let k=0;k<L.length;k+=4){
    const hf=nativeClamp(-L[k+1]*fh/H,0,1);
    const j=rs>.02&&hash(k,tick)<rs*.3?1:0;
    const x=L[k]*fw+lean*hf*Math.sqrt(hf)+
      j*(hash(k+7,tick)-.5)*2.4;
    const shift=nativeBushBranchShift(f,x,hf);
    gput(L[k+2],bx+x+shift,
      by+L[k+1]*fh+j*(hash(k,tick+3)-.5)*1.6,
      fade*L[k+3]*.01*(1-j*.45));
  }
};
window.__ASCII_NATIVE_BUSHES__={
  approach:nativeBushApproach,shift:nativeBushLeafShift,
  contact:nativeBushContact,spring:nativeBushSpring,
  branchShift:nativeBushBranchShift,sourceDraw:nativeOriginalDrawFlora,
  get counts(){return {
    active:flora.filter(f=>f.v.type==='bush'&&
      (f.nativePart>.05||f.nativeTwigs?.some(x=>Math.abs(x)>.05))).length,
    total:flora.filter(f=>f.v.type==='bush').length
  }}
};
