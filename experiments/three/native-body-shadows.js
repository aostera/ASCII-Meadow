// Native-only soft edge for knight, NPC and cow shadows in grass.
// The source shadeCapsule() gives every cell inside 60% of the ellipse the
// full strength (e=(1-q)*2.5 clamped to 1). With CONTACT_S=.7 that cuts grass
// light below the glyph threshold for a whole block of cells, so the blades
// vanish in a hard-edged rectangle at the feet. Here strength falls off
// smoothly with distance from the centre (smoothstep of 1-r): the same capsule, the same
// peak and direction, but the blades fade out towards the rim instead of
// stopping on a cell boundary. Source shadows.js stays unchanged.
const nativeSourceShadeCapsule=shadeCapsule;
let nativeBodyShadowCells=0;
shadeCapsule=function(ax,ay,bx,by,r0,r1,s,fade,ky){
  const r=Math.max(r0,r1);
  const x0=Math.max(SBX0,Math.floor((Math.min(ax,bx)-r)/CW)),x1=Math.min(SBX1-1,Math.ceil((Math.max(ax,bx)+r)/CW));
  const y0=Math.max(SBY0,Math.floor((Math.min(ay,by)-r/ky)/CH)),y1=Math.min(SBY1-1,Math.ceil((Math.max(ay,by)+r/ky)/CH));
  const ux=bx-ax,uy=by-ay,uu=ux*ux+uy*uy;
  for(let y=y0;y<=y1;y++){
    const py=(y+.5)*CH,o=y*COLS;
    for(let x=x0;x<=x1;x++){
      const px=(x+.5)*CW;
      let u=uu>0?((px-ax)*ux+(py-ay)*uy)/uu:0;
      u=u<0?0:u>1?1:u;
      const dx=px-ax-ux*u,dy=(py-ay-uy*u)*ky,rr=r0+(r1-r0)*u;
      const q=(dx*dx+dy*dy)/(rr*rr);
      if(q>=1)continue;
      const e=1-Math.sqrt(q),v=s*e*e*(3-2*e)*(1-fade*u),i=o+x;
      if(v>shadow[i]){shadow[i]=v;nativeBodyShadowCells++}
    }
  }
};
window.__ASCII_NATIVE_BODY_SHADOWS__={
  source:nativeSourceShadeCapsule,
  get cells(){return nativeBodyShadowCells}
};
