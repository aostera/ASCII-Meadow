// Optional, controlled on-device A/B/A/B renderer comparison.
// Measures observed display requestAnimationFrame pacing, not unbounded FPS.
// Identical authored game, camera, viewport and assets; only GL.flush changes.
// The real scene keeps simulating (grass/wind/cows), so results are directional.
import {summarizeDeviceFrames} from './device-profiler.mjs';

export const ENGINE_SEQUENCE=['legacy','three','three','legacy'];

export function summarizeEngineComparison(runs,info={}){
  const sequence=runs.map(r=>r.mode);
  const raw={legacy:[],three:[]};
  for(const run of runs){
    if(!Object.hasOwn(raw,run.mode)||!Array.isArray(run.samples))
      throw Error('Unexpected A/B comparison phase');
    raw[run.mode].push(...run.samples);
  }
  const original=summarizeDeviceFrames(raw.legacy);
  const native=summarizeDeviceFrames(raw.three);
  const delta=(a,b)=>a===null||b===null?null:+(b-a).toFixed(2);
  return {
    ...info,sequence,
    original,nativeThree:native,
    threeMinusOriginalP95Ms:delta(original.frameMsP95,native.frameMsP95),
    threeMinusOriginalObservedFps:delta(original.observedFps,native.observedFps),
    methodology:'Two original and two Three periods (ABBA); same running source simulation, viewport and author map; foreground RAF only, display-vsync capped.',
    caveat:'Differences are device/browser and motion-sensitive. RAF is not GPU execution time; no claim of uncapped 200+ FPS or exact per-frame same scene.'
  };
}

export function installEngineComparison({
  selectMode,getMode,getStats,getMapSnapshot,
  durationMs=5000,warmupMs=400
}={}){
  if(typeof document==='undefined')throw Error('Browser required');
  if(document.getElementById('ascii-engine-comparison'))return null;
  if(typeof selectMode!=='function'||typeof getMode!=='function')
    throw Error('Missing renderer switch');
  const previousMode=getMode();
  const originalMap=getMapSnapshot?.()??null;
  const box=document.createElement('aside');
  box.id='ascii-engine-comparison';
  box.style.cssText='position:fixed;left:12px;bottom:12px;z-index:100;max-width:min(440px,calc(100vw - 24px));background:rgba(14,14,14,.96);border:1px solid #777;padding:12px;border-radius:6px;color:#ddd;font:12px/1.55 ui-monospace,monospace;box-shadow:0 8px 28px #000b';
  const title=document.createElement('strong');title.textContent='ASCII MEADOW · СРАВНЕНИЕ ДВИЖКОВ';
  const status=document.createElement('p');status.style.margin='8px 0';
  const hint=document.createElement('div');hint.style.cssText='color:#aaa;margin-bottom:8px';
  hint.textContent='Оригинал → Three.js → Three.js → Оригинал, одинаковый экран. RAF ограничен частотой дисплея. Не двигайте персонажа во время сравнения.';
  const repeat=document.createElement('button');repeat.textContent='Повторить A/B';
  const copy=document.createElement('button');copy.textContent='Скопировать JSON';copy.disabled=true;
  const close=document.createElement('button');close.textContent='Закрыть';
  for(const button of [repeat,copy,close]){
    button.style.cssText='background:#262626;color:#ddd;border:1px solid #555;padding:5px 8px;margin-right:5px;cursor:pointer';
  }
  box.append(title,status,hint,repeat,copy,close);
  document.body.append(box);
  let active=true,running=false,frame=null,last=null,elapsed=0,phase=-1,interruptions=0;
  let samples=[],runs=[],report=null;
  const schedule=()=>{if(active&&running)frame=requestAnimationFrame(tick)};
  const stopFrame=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null};
  const restore=()=>{if(getMode()!==previousMode)selectMode(previousMode)};
  const fail=err=>{
    stopFrame();running=false;restore();
    status.textContent='Ошибка сравнения: '+String(err?.message||err);
    repeat.disabled=false;
  };
  const nextPhase=()=>{
    if(phase>=0)runs.push({mode:ENGINE_SEQUENCE[phase],samples});
    phase++;
    if(phase===ENGINE_SEQUENCE.length){
      stopFrame();running=false;restore();
      report=summarizeEngineComparison(runs,{
        generatedAt:new Date().toISOString(),
        device:navigator.userAgent,
        viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,
        backgroundInterruptions:interruptions,
        mapUnchanged:originalMap===null?null:getMapSnapshot?.()===originalMap
      });
      const a=report.original,b=report.nativeThree;
      status.textContent='Готово · оригинал '+a.observedFps+' FPS / p95 '+a.frameMsP95+
        ' мс · Three '+b.observedFps+' FPS / p95 '+b.frameMsP95+' мс';
      repeat.disabled=false;copy.disabled=false;
      return;
    }
    const mode=ENGINE_SEQUENCE[phase];
    if(selectMode(mode)===false||getMode()!==mode)
      throw Error('Не удалось переключить рендерер '+mode);
    samples=[];last=null;elapsed=0;
    status.textContent='Этап '+(phase+1)+'/4: '+(mode==='three'?'Three.js':'Оригинал')+
      ' · прогрев и измерение…';
    schedule();
  };
  function tick(now){
    frame=null;
    if(!active||!running)return;
    if(getMode()!==ENGINE_SEQUENCE[phase]){
      fail(Error('Режим игры изменился во время измерения; результат отменён'));
      return;
    }
    if(document.hidden){last=null;schedule();return}
    if(last===null){last=now;schedule();return}
    const dt=now-last;last=now;
    // RAF can be paused on tab switch / screen lock. Do not count that as
    // game performance, nor allow a hidden interval to end an entire phase.
    if(!(dt>0&&dt<1000)){schedule();return}
    elapsed+=dt;
    if(elapsed>warmupMs){
      const s=ENGINE_SEQUENCE[phase]==='three'?getStats?.()||{}:{};
      samples.push({dt,uploadCpuMs:s.uploadCpuMs,
        renderCpuMs:s.renderCpuMs,visibleGlyphs:s.visibleGlyphs,
        originalGlyphs:s.glyphs});
    }
    if(elapsed>=warmupMs+durationMs){
      try{nextPhase()}catch(err){fail(err)}
    }else schedule();
  }
  const onVisibility=()=>{if(document.hidden){interruptions++;last=null}};
  document.addEventListener('visibilitychange',onVisibility);
  const start=()=>{
    if(!active)return;
    stopFrame();running=true;phase=-1;samples=[];runs=[];report=null;
    interruptions=0;copy.disabled=true;repeat.disabled=true;
    try{nextPhase()}catch(err){fail(err)}
  };
  const dispose=()=>{
    active=false;running=false;stopFrame();
    document.removeEventListener('visibilitychange',onVisibility);
    restore();box.remove();
    if(window.__ASCII_ENGINE_COMPARE__===api)delete window.__ASCII_ENGINE_COMPARE__;
  };
  repeat.addEventListener('click',start);
  copy.addEventListener('click',async()=>{
    if(!report)return;
    try{
      await navigator.clipboard.writeText(JSON.stringify(report,null,2));
      status.textContent='Результат A/B скопирован: оригинал и Three.js';
    }catch(err){status.textContent='Не удалось скопировать: '+String(err?.message||err)}
  });
  close.addEventListener('click',dispose);
  const api={start,dispose,get report(){return report},
    get running(){return running},get phase(){return phase},
    get sampleCount(){return runs.reduce((n,r)=>n+r.samples.length,0)+samples.length}};
  window.__ASCII_ENGINE_COMPARE__=api;
  start();
  return api;
}
