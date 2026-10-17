// Exports the ORIGINAL Tripo skinned hero + REVIEW-ONLY baked pose reference.
// Authored runtime animation is not in the source GLB: sample the actual
// unchanged 40 bones at 60Hz and produce separate named animation channels.
// NEVER replace source GLB or assert the still-broken shoulder rig is approved.
'use strict';
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const out=path.resolve(process.cwd(),'artifacts','ashen-blender-handoff');
fs.mkdirSync(out,{recursive:true});
const base=(process.argv[2]||'http://127.0.0.1:8181').replace(/\/$/,'');
(async()=>{
 const browser=await chromium.launch({headless:true,args:[
   '--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 try{
  const page=await browser.newPage({acceptDownloads:true,viewport:{width:900,height:650}});
  page.on('pageerror',error=>console.error('BROWSER:',String(error)));
  const r=await page.goto(base+'/experiments/three/ashen-tripo-animation-workshop.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  if(r.status()!==200)throw Error('Original rig workshop missing');
  await page.waitForFunction(()=>{
    const lab=window.__ASHEN_ANIMATION_LAB__;
    return lab&&(lab.ready||lab.error);
  },undefined,{timeout:110000});
  const preparing=await page.evaluate(async()=>{
    const THREE=await import('three');
    const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js');
    const lab=window.__ASHEN_ANIMATION_LAB__;
    if(lab.error||!lab.model)throw Error('Source Tripo rig not loaded: '+lab.error);
    if(lab.paletteActive)throw Error('Unapproved vertex palette must be OFF');
    const root=lab.model;
    const skins=[];
    root.traverse(n=>{if(n.isSkinnedMesh)skins.push(n)});
    if(!skins.length)throw Error('No source skinned meshes');
    const bones=skins[0].skeleton.bones;
    if(bones.length!==40)throw Error('Expected original 40 joints; found '+bones.length);
    if(new Set(bones.map(b=>b.uuid)).size!==40)throw Error('Duplicated source bones');
    const nameSet=new Set(bones.map(b=>b.name));
    if(nameSet.size!==40)throw Error('Duplicate bone names in Tripo GLB: '+[...nameSet].join(','));
    const sword=[];root.traverse(o=>{if(o.userData?.weapon==='detached')sword.push(o)});
    if(sword.length!==1)throw Error('Expected the independently wrist-bound sword');
    const all=[...bones,sword[0]];
    const outputs=[],meta={model:'original Tripo 40-bone skinned knight',
       originalFile:'experiments/three/assets/ashen-vow/ashen_tripo_v2_skeleton_lod.glb',
       approval:'REVIEW_ONLY_DO_NOT_SHIP',frameRate:60,boneCount:bones.length,
       skeletonBoneNames:bones.map(b=>b.name),geometryObjects:skins.length};
    const fps=60;
    for(const cfg of [
      {name:'REVIEW_ONLY__Idle',frames:90,speed:0,run:false},
      {name:'REVIEW_ONLY__Walk',frames:120,speed:8,run:false},
      {name:'REVIEW_ONLY__Run',frames:120,speed:15,run:true},
      {name:'REVIEW_ONLY__Jump',frames:90,speed:8,run:false,jump:true}
    ]){
      // Run the exact same original 40-bone animated rig, including the
      // imperfect v22 arm solver, so Claude can compare and correct it.
      // A 90-frame idle reset avoids uncontrolled transition from Run.
      for(let i=0;i<90;i++)
        root.userData.animate(1/fps,{speed:0,run:false,heading:0,inspectSoles:false},
          (i+1)/fps);
      const times=[],quats=all.map(()=>[]),positions=all.map(()=>[]);
      for(let i=0;i<cfg.frames;i++){
        const t=i/fps;
        const motion={speed:cfg.speed,run:cfg.run,heading:0,inspectSoles:false};
        if(cfg.jump)motion.jumpClipTime=t*1.49/(cfg.frames/fps);
        root.userData.animate(1/fps,motion,t);
        times.push(t);
        for(let j=0;j<all.length;j++){
          const q=all[j].quaternion,p=all[j].position;
          quats[j].push(q.x,q.y,q.z,q.w);
          positions[j].push(p.x,p.y,p.z);
        }
      }
      const tracks=[];
      for(let j=0;j<all.length;j++){
        const id=all[j].uuid;
        tracks.push(new THREE.QuaternionKeyframeTrack(id+'.quaternion',times,quats[j]));
        // Track source bone positions (pelvis/upper spine) as well as
        // original wrist sword; do not bake camera/game coordinates.
        tracks.push(new THREE.VectorKeyframeTrack(id+'.position',times,positions[j]));
      }
      outputs.push(new THREE.AnimationClip(cfg.name,times[times.length-1],tracks));
      meta[cfg.name]={frames:cfg.frames,tracks:tracks.length,duration:times[times.length-1]};
    }
    // GLTFExporter resolves bone UUID targets via PropertyBinding and
    // exports the exact same mesh, actual skin, materials and 4 clips.
    const exporter=new GLTFExporter();
    const glb=await exporter.parseAsync(root,{
      binary:true,animations:outputs,trs:true,onlyVisible:true,
      maxTextureSize:2048,includeCustomExtensions:false
    });
    if(!(glb instanceof ArrayBuffer)||glb.byteLength<1000000)
      throw Error('Invalid GLB export '+glb?.byteLength);
    const blob=new Blob([glb],{type:'model/gltf-binary'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='ashen_tripo_v22_REVIEW_ONLY_motion_bake.glb';
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},2000);
    meta.exportBytes=glb.byteLength;
    meta.animationCount=outputs.length;
    meta.exportedAt=new Date().toISOString();
    return meta;
  });
  const download=await page.waitForEvent('download',{timeout:120000});
  if(!download.suggestedFilename().endsWith('.glb'))
    throw Error('Browser did not export .glb: '+download.suggestedFilename());
  const file=path.join(out,'ashen_tripo_v22_REVIEW_ONLY_motion_bake.glb');
  await download.saveAs(file);
  const actual=fs.statSync(file).size;
  if(actual!==preparing.exportBytes)throw Error('GLB transfer size mismatch');
  fs.writeFileSync(path.join(out,'bake_manifest.json'),
    JSON.stringify(preparing,null,2)+'\n');
  console.log('EXPORTED AUTHENTIC TRIPO GLB WITH REFERENCE CLIPS',
    JSON.stringify({bytes:actual,bones:preparing.boneCount,
      animations:preparing.animationCount,safety:preparing.approval}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
