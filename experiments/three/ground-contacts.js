// Shared prototype ground-footprint test. Never edits terrain or map source.
// Rotated rectangles preserve genuine arch openings because each pier has its own
// footprint; do not replace an entire gothic facade with one big blocker.
export class GroundContacts {
  constructor() { this.items=[]; }
  clear() { this.items.length=0; }
  circle(x,z,r) { this.items.push({type:0,x,z,r}); }
  rect(x,z,w,d,yaw=0) {
    this.items.push({type:1,x,z,w,d,c:Math.cos(yaw),s:Math.sin(yaw)});
  }
  ruin(x,z,yaw,metadata) {
    const c=Math.cos(yaw),s=Math.sin(yaw);
    for(const v of metadata.rectangles){
      this.rect(x+v.x*c+v.z*s,z-v.x*s+v.z*c,v.w,v.d,yaw);
    }
  }
  sample(x,z,range=1.8) {
    let nearest=range+1,fx=0,fz=0;
    for(const shape of this.items){
      // Exact signed distance to circle / oriented rectangle.
      let dx=x-shape.x,dz=z-shape.z,dist=0;
      if(shape.type===0)dist=Math.hypot(dx,dz)-shape.r;
      else {
        const lx=dx*shape.c-dz*shape.s,lz=dx*shape.s+dz*shape.c;
        const ox=Math.abs(lx)-shape.w/2,oz=Math.abs(lz)-shape.d/2;
        dist=Math.hypot(Math.max(ox,0),Math.max(oz,0))+
          Math.min(Math.max(ox,oz),0);
        const ux=ox>0?Math.sign(lx)*ox:0,uz=oz>0?Math.sign(lz)*oz:0;
        if(ux||uz){dx=ux*shape.c+uz*shape.s;dz=-ux*shape.s+uz*shape.c;}
        else if(ox>oz){dx=Math.sign(lx)*shape.c;dz=-Math.sign(lx)*shape.s;}
        else {dx=Math.sign(lz)*shape.s;dz=Math.sign(lz)*shape.c;}
      }
      if(dist<nearest){
        nearest=dist;
        const len=Math.hypot(dx,dz)||1;
        fx=dx/len;fz=dz/len;
      }
    }
    if(nearest===range+1)return {blocked:false,pushX:0,pushZ:0};
    const falloff=Math.max(0,1-Math.max(0,nearest)/range);
    return {blocked:nearest<0.045,pushX:fx*falloff,pushZ:fz*falloff};
  }
}
