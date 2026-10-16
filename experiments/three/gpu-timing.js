// Non-blocking real GPU timer queries for WebGL2. This works only when the
// optional EXT_disjoint_timer_query_webgl2 is supported. Never block on GPU.
export class GpuFrameTimer {
  constructor(renderer) {
    this.renderer=renderer;this.pending=[];this.samples=[];this.active=false;
    this.restore();
  }
  restore() {
    this.gl=this.renderer.getContext();
    this.ext=this.gl?.getExtension('EXT_disjoint_timer_query_webgl2')||null;
    this.pending=[];this.samples=[];this.active=false;
  }
  lost() {
    // Queries from a lost context are invalid and must never be polled.
    this.pending=[];this.samples=[];this.active=false;this.ext=null;
  }
  drain() {
    const gl=this.gl,ext=this.ext;
    if(!ext || gl.isContextLost())return;
    if(gl.getParameter(ext.GPU_DISJOINT_EXT)){
      for(const item of this.pending)gl.deleteQuery(item);
      this.pending.length=0;this.samples.length=0;
      return;
    }
    // Return immediately if the GPU has not finished: no gl.finish(),
    // getBufferSubData, forced readback or spinner.
    while(this.pending.length &&
      gl.getQueryParameter(this.pending[0],gl.QUERY_RESULT_AVAILABLE)){
      const query=this.pending.shift();
      const nanoseconds=gl.getQueryParameter(query,gl.QUERY_RESULT);
      gl.deleteQuery(query);
      if(Number.isFinite(nanoseconds)&&nanoseconds>=0){
        this.samples.push(nanoseconds/1e6);
        if(this.samples.length>90)this.samples.shift();
      }
    }
  }
  start() {
    const gl=this.gl,ext=this.ext;
    if(!ext||this.active||this.pending.length>=3||gl.isContextLost())return;
    this.drain();
    if(this.pending.length>=3)return;
    const query=gl.createQuery();
    if(!query)return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
    this.active=true;this.current=query;
  }
  stop() {
    if(!this.active)return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.current);
    this.current=null;this.active=false;
  }
  snapshot() {
    this.drain();
    if(!this.ext)return {supported:false,samples:0,p95ms:null,medianMs:null};
    const data=this.samples.slice().sort((a,b)=>a-b);
    const percentile=p=>data[Math.min(data.length-1,Math.floor((data.length-1)*p))];
    return {supported:true,samples:data.length,
      p95ms:data.length?percentile(.95):null,medianMs:data.length?percentile(.5):null};
  }
}
