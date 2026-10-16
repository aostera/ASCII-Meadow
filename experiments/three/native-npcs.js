// Experimental NPC depth integration for the standalone Three game only.
// Before this bridge, NPC body glyphs were painted on the fullscreen 2D
// overlay (#c), meaning they ALWAYS appeared ahead of trees, bushes,
// walls, grass and the knight regardless of world depth.
//
// Preserve source NPC atlas, frame choice, color ramp, animation and footprint;
// place body glyphs into the SAME ordered GB batch as every other character.
// Name/dialogue labels remain in the 2D UI overlay by design.
const nativeSourceEntityDrawer=drawEntity;
const nativeSourceBakeFloraSprites=bakeFloraSprites;
let nativeNpcPalettes=new Map();

function nativeNpcKey(tint){return tint.join(',')}
function nativeNpcSprite(e,tone,code){
  const rows=nativeNpcPalettes.get(nativeNpcKey(e.tint));
  if(!rows)return -1;
  return rows[tone*RAMP.length+code]??-1;
}

function nativeAppendNpcGlyphPalettes(){
  nativeNpcPalettes=new Map();
  const old=GB.atlasCv;
  if(!old)return;
  // Include every registered editor archetype, not only current map NPCs.
  const specs=[...ACTOR_TYPES.values()];
  const unique=[...new Map(specs.map(a=>[nativeNpcKey(a.tint),a.tint])).entries()];
  if(!unique.length)return;
  const k=charDims(player);
  const fw=Math.ceil(k.fcw*DPR)+2,fh=Math.ceil(k.fch*DPR)+2;
  const lines=RAMP.length,toneCount=8;
  const extra=unique.length*(toneCount*fh+2)+2;
  const atlas=document.createElement('canvas');
  atlas.width=Math.max(old.width,fw*lines+4);
  atlas.height=old.height+extra;
  const canvas=atlas.getContext('2d');
  canvas.drawImage(old,0,0);
  canvas.textBaseline='top';
  canvas.font=`600 ${k.ffs*DPR}px ${FONT}`;
  let y=old.height+2;
  for(const [key,tint] of unique){
    const ids=[];
    for(let shade=0;shade<toneCount;shade++){
      const light=.3+.85*shade/(toneCount-1);
      const [r,g,b]=tint;
      canvas.fillStyle=`rgb(${Math.min(255,r*light)|0},${Math.min(255,g*light)|0},${Math.min(255,b*light)|0})`;
      for(let c=0;c<lines;c++){
        const x=c*fw;
        if(c>0)canvas.fillText(RAMP[c],x+1,y+1);
        ids.push(sprite(x,y,fw,fh,fw/DPR,fh/DPR,-1/DPR,-1/DPR));
      }
      y+=fh;
    }
    nativeNpcPalettes.set(key,ids);
    y+=2;
  }
  GB.atlasCv=atlas;
  // Re-normalize all original foliage, castle, creature and authored glyph
  // UVs without changing any source rectangle, RGB or alpha.
  normSprites(atlas.width,atlas.height);
}
bakeFloraSprites=function(){
  nativeSourceBakeFloraSprites();
  nativeAppendNpcGlyphPalettes();
};

drawEntity=function nativeDepthSortedEntity(e){
  if(e.cls==='knight'||e.cls==='cow'||!nativeNpcPalettes.has(nativeNpcKey(e.tint))){
    const start=GB.n;
    nativeSourceEntityDrawer(e);
    // The source knight and cattle already emit original authored glyphs to
    // GB. Tag their exact source batch spans for the same 3D masonry depth as
    // NPCs; this cannot change any character sprite or animation frame.
    if(GB.nativeActorRanges&&GB.n>start){
      let rect=geomOf(e);
      if(e.cls==='cow'){
        const k=charDims(e),gx=e.x*CW,gy=(e.y+.7)*CH-hopPx(e);
        rect={left:gx-CG.fx*k.fcw,top:gy-CG.fy*k.fch,
          w:CG.cols*k.fcw,h:CG.rows*k.fch};
      }
      GB.nativeActorRanges.push({start,end:GB.n,rect,source:e});
    }
    return;
  }
  const batchStart=GB.n;
  const {ffs,fcw,fch,u}=charDims(e);
  const G=geomOf(e),{gx,gy,top}=G;
  const BH=boxH(e);
  const cols=Math.round(BOX_W*u/fcw),rows=Math.round(BH*u/fch);
  const SS=2;
  if(rig.width!==cols*SS||rig.height!==rows*SS){
    rig.width=cols*SS;rig.height=rows*SS;
  }
  rg.setTransform(1,0,0,1,0,0);
  rg.clearRect(0,0,rig.width,rig.height);
  const sx=cols*SS/BOX_W,sy=rows*SS/BH;
  const state=e.aiState==='talk'?'talk':e.walk>.15?'walk':'idle';
  const frame=e.actorType?npcAtlasFrame(e,state):null;
  const atlas=frame&&NPC_ATLASES.get(e.actorType);
  const frameState=atlas&&(atlas.layout.states[state]||atlas.layout.states.idle);
  const authoredDirection=frameState&&frameState.rows.length===8;
  const facing=authoredDirection?1:e.face;
  rg.setTransform(sx*facing,0,0,sy,
    (facing>0?-BOX_X0:BOX_W+BOX_X0)*sx,0);
  if(e.cls==='dwarf'){
    rg.translate(0,100);rg.scale(1.12,.8);rg.translate(0,-100);
  }
  if(frame){
    e.glowM=null;
    const rect=npcAtlasRect(frame);
    rg.drawImage(frame.image,frame.x,frame.y,frame.width,frame.height,
      rect.x,rect.y,rect.w,rect.h);
  }else drawRig(e,pose(e));
  if(e.cls==='dwarf'&&e.glowM)
    e.glowM=[e.glowM[0]*1.12,100-(100-e.glowM[1])*.8];

  const img=rg.getImageData(0,0,rig.width,rig.height).data;
  const left=G.left,W2=rig.width;
  const lv=Array.from({length:8},()=>[]);
  const emit=[];
  const backs=[];
  for(let cy=0;cy<rows;cy++){
    let run=-1;
    for(let cx=0;cx<=cols;cx++){
      let r=0,g=0,a=0;
      if(cx<cols){
        for(let oy=0;oy<SS;oy++)for(let ox=0;ox<SS;ox++){
          const p=((cy*SS+oy)*W2+cx*SS+ox)*4;
          r+=img[p];g+=img[p+1];a+=img[p+3];
        }
        a/=SS*SS*255;
      }
      if(cx===cols||a<.3){
        if(run!==-1){
          backs.push(left+run*fcw-.4,top+cy*fch-.4,
            (cx-run)*fcw+.8,fch+.8);
          run=-1;
        }
        continue;
      }
      if(run===-1)run=cx;
      r/=SS*SS*255*a;g/=SS*SS*255*a;
      const px=left+cx*fcw,py=top+cy*fch;
      if(r>.75&&g<.35){emit.push(px,py);continue}
      const grain=(hash(cx*7+e.cls.length*31,cy*13)-.5)*.16;
      const lit=Math.pow(Math.max(0,r*1.3-.06),.8);
      let v=lit*Math.min(1,a*1.2)+
        BAYER[(cy&3)*4+(cx&3)]*.38+grain;
      if(v<.16)continue;
      v=Math.min(.999,v);
      const ci=1+((v*(RAMP.length-1))|0);
      lv[(v*8)|0].push(px,py,ci);
    }
  }
  // All backing blocks before all visible body glyphs; same authored dark
  // silhouette with only the drawing *layer* changed to world depth.
  for(let j=0;j<backs.length;j+=4)
    grect(backs[j],backs[j+1],backs[j+2],backs[j+3],.94);
  let chars=0;
  for(let k=0;k<8;k++){
    const group=lv[k];
    for(let j=0;j<group.length;j+=3){
      const id=nativeNpcSprite(e,k,Math.min(RAMP.length-1,group[j+2]));
      if(id>=0){gput(id,group[j],group[j+1],1);chars++}
    }
  }
  // Rare glowing source pixels retain their authored light on the UI layer
  // until there is a dedicated emissive glyph material.
  if(emit.length){
    ctx.font=`600 ${ffs}px ${FONT}`;
    ctx.textBaseline='top';
    ctx.fillStyle=e.glowCol||'#fff';
    ctx.shadowColor=e.glowCol||'#fff';
    ctx.shadowBlur=8+Math.sin(t*9)*3;
    for(let j=0;j<emit.length;j+=2)ctx.fillText('@',emit[j],emit[j+1]);
    ctx.shadowBlur=0;
  }
  e.nativeDepthGlyphs=chars;
  // The entire NPC silhouette (not only bright body pixels) receives true
  // source-camera occlusion from stone in the native Three glyph pass.
  // The source actor reference is read-only and never serialized to the map.
  if(GB.nativeActorRanges)
    GB.nativeActorRanges.push({
      start:batchStart,end:GB.n,rect:G,source:e
    });
  drawTag(e,gx,gy);
};
window.__ASCII_NATIVE_NPCS__={
  get paletteCount(){return nativeNpcPalettes.size},
  get glyphs(){return npcs.map(e=>({id:e.actorId,count:e.nativeDepthGlyphs||0}))},
  sourceDrawer:nativeSourceEntityDrawer
};
