// Native-only sculpted ground shadow edges for source castle and ruins.
// The original 3D raycasts are authoritative. This refines just their hard,
// single-cell shadow boundaries immediately after architectural rays, BEFORE
// foliage/stones add their own shadows. The editor snapshots bshadeCastle
// after this exact pass: rebuild, move, undo and redo remain consistent.
// No global brightness, alpha, light direction, character shadow or map edits.
const nativeSourceBuildForShadows=buildWorld;
const nativeShadowClamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function nativeShadowEdgeFilter(source,width,height,x,y) {
  const i=y*width+x;
  const v=source[i];
  if(x<2||y<2||x>=width-2||y>=height-2)return v;
  let min=v,max=v,sum=0,total=0;
  // Baked masonry darkening has abrupt box-like silhouettes on the source
  // cell grid. Feather only actual HIGH-CONTRAST boundaries; keep deep stone
  // contact and interior shadow level unchanged.
  for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
    const a=source[(y+dy)*width+x+dx];
    min=Math.min(min,a);max=Math.max(max,a);
    const weight=dx===0&&dy===0?7:
      Math.abs(dx)+Math.abs(dy)<=1?4:
      Math.abs(dx)<=1&&Math.abs(dy)<=1?2:1;
    sum+=a*weight;total+=weight;
  }
  if(max-min<.095)return v;
  const filtered=sum/total;
  // Asymmetric per-cell antialiasing breaks rectangular silhouette steps
  // without inventing dark outlines or flattening the centre of a shadow.
  const edge=nativeShadowClamp((max-min-.095)/.23,0,1);
  return nativeShadowClamp(v*(1-edge*.79)+filtered*(edge*.79),0,.7);
}
function nativeSoftShadowPatch(x0,y0,x1,y1){
  const xa=Math.max(4,Math.floor(x0)),ya=Math.max(4,Math.floor(y0));
  const xb=Math.min(COLS-5,Math.ceil(x1)),yb=Math.min(ROWS-5,Math.ceil(y1));
  if(xb<=xa||yb<=ya)return 0;
  const padding=3,w=xb-xa+1+padding*2,h=yb-ya+1+padding*2;
  const src=new Float32Array(w*h);
  for(let y=0;y<h;y++){
    const wy=ya-padding+y;
    const from=wy*COLS+xa-padding;
    src.set(bshade.subarray(from,from+w),y*w);
  }
  let edits=0;
  for(let y=ya;y<=yb;y++)for(let x=xa;x<=xb;x++){
    const sx=x-xa+padding,sy=y-ya+padding;
    const from=src[sy*w+sx],to=nativeShadowEdgeFilter(src,w,h,sx,sy);
    const edge=Math.min(x-xa,y-ya,xb-x,yb-y);
    const taper=nativeShadowClamp(edge/3,0,1);
    const result=from+(to-from)*taper;
    if(Math.abs(result-from)>.0001){bshade[y*COLS+x]=result;edits++}
  }
  return edits;
}
function nativeSoftenGothicShadows(){
  if(!bshade||!bshade.length||!cathedral?.cv)return 0;
  const C=cathedral;
  const margin=Math.ceil((210*WS)/CW)+10;
  let edits=nativeSoftShadowPatch(C.cx0-margin,C.cy0-margin,
    C.cx0+C.BW+margin,C.cy0+C.BH+margin);
  // Ruin rays already exclude missing walls and open arch spans. Feather the
  // actual penumbra at the boundary of those shadows, not each ruin's box.
  for(const r of ruins){
    const extra=Math.ceil((r.height*.8*WS)/CW)+12;
    edits+=nativeSoftShadowPatch(r.x0-extra,r.y0-extra,
      r.x1+extra,r.y1+extra);
  }
  return edits;
}
let nativeShadowEdits=0,nativeShadowBakes=0;
buildWorld=function(){
  // The source first resets bshade to zero and raycasts castle/ruin solids.
  // This hook runs exactly once for each architecture rebuild, *before*
  // source buildFlora/rebuildFlora add forest shadows and make bshadeCastle.
  const result=nativeSourceBuildForShadows();
  nativeShadowEdits=nativeSoftenGothicShadows();
  nativeShadowBakes++;
  return result;
};
window.__ASCII_NATIVE_SHADOWS__={
  edgeFilter:nativeShadowEdgeFilter,
  get changedCells(){return nativeShadowEdits},
  get bakes(){return nativeShadowBakes},
  get phase(){return 'after-buildWorld-before-buildFlora'},
  refine:nativeSoftenGothicShadows,
  sourceBuildWorld:nativeSourceBuildForShadows
};
