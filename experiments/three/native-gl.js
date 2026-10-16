// Dedicated GPU bridge for the experimental native runtime ONLY.
// The original src/renderer/webgl.js is deliberately never loaded here.
// This canvas is the 2D fallback; Three.js owns the only WebGL2 context.
const GL={
  ok:false,lost:false,gl:null,
  ctx2:document.getElementById('g').getContext('2d',{alpha:false}),
  flush(){},
  upload(){},
  uploadCastle(){},
  resize(){
    const g=document.getElementById('g');
    if(typeof W==='number'&&typeof DPR==='number'&&W>0&&DPR>0){
      g.width=Math.round(W*DPR);
      g.height=Math.round(H*DPR);
    }
  },
  refresh(){return true}
};
