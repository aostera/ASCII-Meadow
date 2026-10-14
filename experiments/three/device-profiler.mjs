// Real-device, opt-in performance sampling for the existing native Three
// renderer. RAF is display-vsync limited, NOT a claim about unconstrained FPS.
// No extra WebGL contexts, shaders, frame effects, alpha or asset changes.
export function percentile(values,p){
 if(!values.length)return null;
 const sorted=[...values].filter(Number.isFinite).sort((a,b)=>a-b);
 if(!sorted.length)return null;
 return sorted[Math.max(0,Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1))];
}
export function summarizeDeviceFrames(samples,info={}){
 const all=samples.filter(s=>Number.isFinite(s.dt)&&s.dt>0&&s.dt<2000);
 const dt=all.map(s=>s.dt);
 const totalMs=dt.reduce((a,b)=>a+b,0);
 const validCpu=key=>all.map(s=>s[key]).filter(x=>Number.isFinite(x)&&x>=0);
 const upload=validCpu('uploadCpuMs'),render=validCpu('renderCpuMs');
 const glyphs=all.map(s=>s.visibleGlyphs).filter(Number.isFinite);
 const max=all.map(s=>s.originalGlyphs).filter(Number.isFinite);
 const stalls=all.filter(s=>s.dt>50).length;
 return {...info,
  frameCount:all.length,
  sampleSeconds:+(totalMs/1000).toFixed(2),
  observedFps:totalMs?+(all.length/(totalMs/1000)).toFixed(1):null,
  frameMsP50:percentile(dt,.5),frameMsP95:percentile(dt,.95),
  frameMsP99:percentile(dt,.99),frameMsWorst:dt.length?Math.max(...dt):null,
  frameStallsOver50ms:stalls,
  uploadCpuP95Ms:percentile(upload,.95),
  renderCpuP95Ms:percentile(render,.95),
  visibleGlyphMedian:percentile(glyphs,.5),
  originalGlyphMedian:percentile(max,.5),
  // JS renderer.render() CPU is not a GPU timer query.
  caveat:'Actual device RAF/vsync and CPU submission only; not GPU hardware time, uncapped FPS or guaranteed 200+ FPS'
 };
}
export function installDeviceProfiler({getStats,durationMs=10000}={}){
 if(typeof document==='undefined')throw Error('Browser document required');
 if(document.getElementById('ascii-device-profiler'))return null;
 const box=document.createElement('aside');
 box.id='ascii-device-profiler';
 box.style.cssText='position:fixed;bottom:12px;left:12px;z-index:100;max-width:min(430px,calc(100vw - 24px));background:rgba(14,14,14,.96);border:1px solid #777;border-radius:6px;padding:12px;color:#ddd;font:12px/1.55 ui-monospace,monospace;box-shadow:0 8px 28px #000b';
 const header=document.createElement('strong');
 header.textContent='ASCII MEADOW · FPS ТЕСТ НА УСТРОЙСТВЕ';
 const state=document.createElement('p');
 state.style.margin='8px 0';state.textContent='Подготовка измерения…';
 const hint=document.createElement('div');
 hint.style.cssText='color:#999;margin-bottom:7px';
 hint.textContent='Результат ограничен частотой экрана; 200 FPS невозможно наблюдать на дисплее 60/120 Гц.';
 const run=document.createElement('button');run.textContent='Повторить';
 const copy=document.createElement('button');copy.textContent='Скопировать JSON';copy.disabled=true;
 const close=document.createElement('button');close.textContent='Закрыть';
 for(const btn of [run,copy,close]){
  btn.style.cssText='background:#262626;color:#ddd;border:1px solid #555;padding:5px 8px;margin-right:5px;cursor:pointer';
 }
 box.append(header,state,hint,run,copy,close);
 document.body.append(box);
 let active=true,sampling=false,frame=null,last=null,start=null,samples=[],report=null;
 let backgroundInterruptions=0;
 const onVisibility=()=>{if(document.hidden)backgroundInterruptions++};
 document.addEventListener('visibilitychange',onVisibility);
 const tick=(now)=>{
  if(!active||!sampling)return;
  if(start===null){start=now;last=now;frame=requestAnimationFrame(tick);return}
  if(document.hidden){
   last=now;frame=requestAnimationFrame(tick);return;
  }
  const dt=now-last;last=now;
  if(dt>0&&dt<2000){
   const stats=getStats?.()||{};
   samples.push({dt,uploadCpuMs:stats.uploadCpuMs,
     renderCpuMs:stats.renderCpuMs,visibleGlyphs:stats.visibleGlyphs,
     originalGlyphs:stats.glyphs});
  }
  const elapsed=now-start;
  if(elapsed>=durationMs){
   sampling=false;frame=null;
   report=summarizeDeviceFrames(samples,{
     generatedAt:new Date().toISOString(),
     device:navigator.userAgent,
     viewport:[innerWidth,innerHeight],
     dpr:devicePixelRatio,
     backgroundInterruptions,
     approximateHeapBytes:performance.memory?.usedJSHeapSize??null
   });
   state.textContent='Готово: '+report.observedFps+' кадров/с (vsync) · p95 '+
    (report.frameMsP95??0).toFixed(1)+' мс · CPU отправка '+
    (report.renderCpuP95Ms??0).toFixed(2)+' мс · '+report.frameCount+' кадров';
   copy.disabled=false;
   return;
  }
  if(samples.length%20===0)
   state.textContent='Сбор: '+Math.round(elapsed/1000)+'/'+Math.round(durationMs/1000)+
     ' сек · '+samples.length+' кадров';
  frame=requestAnimationFrame(tick);
 };
 const startCapture=()=>{
  if(!active)return;
  if(frame!==null)cancelAnimationFrame(frame);
  last=null;start=null;samples=[];report=null;sampling=true;
  backgroundInterruptions=0;copy.disabled=true;
  state.textContent='Запущено…';
  frame=requestAnimationFrame(tick);
 };
 run.addEventListener('click',startCapture);
 copy.addEventListener('click',async()=>{
  if(!report)return;
  try{
   await navigator.clipboard.writeText(JSON.stringify(report,null,2));
   state.textContent='JSON скопирован · '+report.observedFps+' кадров/с';
  }catch(err){
   state.textContent='Копирование недоступно: '+String(err.message||err);
  }
 });
 const dispose=()=>{
  active=false;sampling=false;if(frame!==null)cancelAnimationFrame(frame);
  document.removeEventListener('visibilitychange',onVisibility);
  box.remove();if(window.__ASCII_DEVICE_PROFILER__===api)
   delete window.__ASCII_DEVICE_PROFILER__;
 };
 close.addEventListener('click',dispose);
 const api={start:startCapture,dispose,get report(){return report},
  get samples(){return samples.length},get running(){return sampling}};
 window.__ASCII_DEVICE_PROFILER__=api;
 startCapture();
 return api;
}
