// Conservative pure glyph viewport clip, no scene, brightness or alpha edits.
export function glyphClipWindow(camX,camY,width,height,zoom,paddingPx=4){
 if(!(width>0&&height>0&&zoom>0))throw Error('Invalid source viewport');
 const p=paddingPx/zoom;
 return {left:camX-p,top:camY-p,
  right:camX+width/zoom+p,bottom:camY+height/zoom+p};
}
export function packVisibleGlyphs(source,start,count,rects,ids,clip=null){
 if(start<0||count<0||(start+count)*6>source.length)
   throw Error('Glyph source range outside source batch');
 if(rects.length<count*4||ids.length<count*2)
   throw Error('Insufficient glyph instance capacity');
 let visible=0;
 for(let i=0;i<count;i++){
  const s=(start+i)*6;
  const x0=source[s],y0=source[s+1],x1=source[s+2],y1=source[s+3];
  if(clip&&(x1<clip.left||x0>clip.right||y1<clip.top||y0>clip.bottom))
   continue;
  const j=visible*4,k=visible*2;
  rects[j]=x0;rects[j+1]=y0;rects[j+2]=x1;rects[j+3]=y1;
  ids[k]=source[s+4];ids[k+1]=source[s+5];
  visible++;
 }
 return visible;
}
