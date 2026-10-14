// Experimental native-world interaction: authored bushes physically open in
// front of the walking knight, NPCs and cattle, then spring back. No changes
// to alpha, brightness, source sprite glyphs or MEADOW_MAP.
//
// This file runs only on native.html. The original flora source retains
// authority for ALL plants outside a live actor's contact radius.
const nativeOriginalUpdateFlora=updateFlora;
const nativeOriginalDrawFlora=drawFlora;
const NATIVE_BUSH_OPEN_SPEED=10.5;
const NATIVE_BUSH_CLOSE_SPEED=3.2;

// Pure helpers exposed for deterministic unit/browser checks. Local x is
// the authored glyph's x-offset (px) relative to the bush root.
function nativeBushApproach(current,target,dt) {
  if(!(dt>0))return current;
  const rate=target>current?NATIVE_BUSH_OPEN_SPEED:NATIVE_BUSH_CLOSE_SPEED;
  const next=current+(target-current)*(1-Math.exp(-Math.min(dt,.08)*rate));
  return Math.max(0,Math.min(1,next));
}
function nativeBushLeafShift(localX,openingCenter,radius,strength){
  if(!(strength>0)||!(radius>0))return 0;
  // Split around the person, not the root: a knight moving off-centre
  // leaves the far side almost unchanged.
  const dx=localX-openingCenter;
  const reach=Math.max(0,1-Math.abs(dx)/(radius*.9));
  const feather=reach*reach*(3-2*reach);
  const sign=dx<0?-1:1;
  return sign*radius*.29*strength*feather;
}
function nativeBushContact(f,actor,CW,CH) {
  if(!f||!actor||!f.v||f.v.type!=='bush')return 0;
  const rad=Math.max(2, f.v.R/CW);
  const dx=Math.abs((actor.x-f.x)/rad);
  const py=(actor.y+.7)*CH, rootY=f.br*CH;
  // Contact occupies the lower half of this particular bush: passing far
  // above its crown or walking on a separate row cannot bend it.
  const ry=Math.max(CH*2.5,f.v.crownH*.38);
  const dy=Math.abs(py-(rootY-f.v.crownH*.14))/ry;
  const d=Math.hypot(dx,dy);
  if(d>=1)return 0;
  return Math.pow(1-d,0.65)*Math.min(1.0,actor.moving?1:.9);
}
function nativeBushActors(){
  const all=[...ents];
  if(typeof cows!=='undefined')for(const cow of cows)all.push(cow);
  return all;
}
updateFlora=function(dt){
  nativeOriginalUpdateFlora(dt);
  if(!(dt>0))return;
  const actors=nativeBushActors(),lo=floraLowerBound(VY0-40),
    hi=VY1+FLMAXR+40;
  for(let i=lo;i<flora.length&&flora[i].br<=hi;i++){
    const f=flora[i];
    if(f.v.type!=='bush')continue;
    let target=0,source=null;
    const reach=f.v.R/CW+3;
    for(const actor of actors){
      if(Math.abs(actor.x-f.x)>reach||Math.abs(actor.y+.7-f.br)>f.v.crownH/CH+4)continue;
      const c=nativeBushContact(f,actor,CW,CH);
      if(c>target){target=c;source=actor}
    }
    const amount=nativeBushApproach(f.nativePart||0,target,dt);
    f.nativePart=amount;
    // When the character leaves, keep the remembered opening point until
    // the bush closes. Each update follows the nearest contacting body.
    if(source)f.nativePartCenter=(source.x-f.x)*CW;
    if(!source&&amount<.003){f.nativePart=0;f.nativePartCenter=0}
  }
};

drawFlora=function(f){
  if(f.v.type!=='bush'||!(f.nativePart>.003)){
    nativeOriginalDrawFlora(f);
    return;
  }
  const v=f.v,bx=Math.round(f.x)*CW,by=f.br*CH,
    H=v.crownH,fw=v.fw,fh=v.fh;
  const center=f.nativePartCenter||0;
  const R=Math.max(4,v.R),opening=f.nativePart;
  // Match every bit of source opacity and wind behavior: only x-coordinates
  // change while a body passes. No cuts to RGB, alpha, luminance or atlas.
  const lean=(f.sw||0)*2;
  const rs=Math.min(1,(f.rust||0)+(f.flut||0)*.3);
  const tick=Math.floor(t*9);
  const fade=f.fade===undefined?1:f.fade;
  const L=v.list,Rn=v.runs;

  for(let k=0;k<Rn.length;k+=3){
    const hf=Math.max(0,-Rn[k]*fh/H);
    const sw=lean*hf*Math.sqrt(hf);
    const left=bx+Rn[k+1]*fw+sw-.3;
    const right=bx+Rn[k+2]*fw+sw+.3;
    // Dark backing is also physically parted; otherwise the solid source
    // rectangle would still paint OVER the character through the leaf gap.
    const cut=R*.205*opening*Math.max(.2,1-hf*.75);
    const a=bx+center-cut,b=bx+center+cut;
    const leftEnd=Math.min(right,a);
    const rightStart=Math.max(left,b);
    if(leftEnd>left)grect(left,by+Rn[k]*fh-.3,leftEnd-left,fh+.6,.97*fade);
    if(right>rightStart)grect(rightStart,by+Rn[k]*fh-.3,right-rightStart,fh+.6,.97*fade);
  }
  for(let k=0;k<L.length;k+=4){
    const hf=Math.max(0,-L[k+1]*fh/H);
    const j=rs>.02&&hash(k,tick)<rs*.3?1:0;
    const originalX=L[k]*fw+lean*hf*Math.sqrt(hf)+
      j*(hash(k+7,tick)-.5)*2.4;
    const shift=nativeBushLeafShift(originalX,center,R,opening);
    gput(L[k+2],bx+originalX+shift,
      by+L[k+1]*fh+j*(hash(k,tick+3)-.5)*1.6,
      fade*L[k+3]*.01*(1-j*.45));
  }
};
window.__ASCII_NATIVE_BUSHES__={
  approach:nativeBushApproach,
  shift:nativeBushLeafShift,
  contact:nativeBushContact,
  sourceDraw:nativeOriginalDrawFlora,
  get counts(){return {
    active:flora.filter(f=>f.v.type==='bush'&&(f.nativePart||0)>.05).length,
    total:flora.filter(f=>f.v.type==='bush').length
  }}
};
