// A skinned glTF knight that plays its own baked clips (no JS bone posing). The Group returned
// faces local +Z with the feet at y=0; userData.animate(dt, movement) picks and blends clips:
//   movement = {speed (source px/s / 10), run, heading (rad), jumpClipTime (s, optional)}
// The caller owns the jump height (the source game's arc): it passes jumpClipTime and the clip is
// frozen at that time, so the load / take-off / landing meet the game's own jump phases.
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const FADE = .18;

export function createClipKnight(THREE, {
  url, clips = ['Idle', 'Walk', 'Run', 'Jump'], modelHeight = 1, rigHeight = 8.9,
  forward = '+Z', clipSpeed = {Walk: 1, Run: 3}, once = ['Jump'], onLoad, onError,
} = {}) {
  const root = new THREE.Group();
  root.name = 'glTF clip knight';
  const holder = new THREE.Group();
  root.add(holder);
  const st = {loaded: false, error: null, started: performance.now(), bytes: 0, total: null, mixer: null, actions: {}, current: null, model: null,
    motion: 'idle', clip: null, timeScale: 1};
  root.userData.gltf = st;
  root.userData.pxPerUnit = null;            // source sprite pixels per model unit, set by the caller

  new GLTFLoader().load(url, gltf => {
    if (root.userData.disposed) return;
    const model = gltf.scene;
    model.scale.setScalar(rigHeight / modelHeight);
    // glTF from Blender keeps Blender's forward: +X forward becomes +X here; turn it to +Z
    if (forward === '+X') model.rotation.y = -Math.PI / 2;
    model.traverse(o => { if (o.isSkinnedMesh) o.frustumCulled = false; });
    holder.add(model);
    root.userData.prepareModel?.(model);
    st.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const a = st.mixer.clipAction(clip);
      if (once.includes(clip.name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      st.actions[clip.name] = a;
    }
    const missing = clips.filter(n => !st.actions[n]);
    if (missing.length) {
      st.error = 'GLB is missing clips ' + missing.join(',');
      onError?.(Error(st.error));
      return;
    }
    st.model = model;
    st.loaded = true;
    play('Idle', 0);
    onLoad?.(root);
  }, ev => { st.bytes = ev.loaded; st.total = ev.total || null; }, err => {
    st.error = String(err?.message || err);
    onError?.(err);
  });

  function play(name, fade = FADE, time = null) {
    const next = st.actions[name];
    if (!next) return;
    if (st.current === next) {
      if (time !== null) next.time = time;
      return;
    }
    next.reset();
    if (time !== null) next.time = time;
    next.enabled = true;
    next.setEffectiveWeight(1);
    next.play();
    if (st.current && fade > 0) st.current.crossFadeTo(next, fade, false);
    else if (st.current) st.current.stop();
    st.current = next;
    st.clip = name;
  }

  root.userData.animate = (dt, movement) => {
    dt = Math.min(.05, Math.max(0, dt));
    if (!st.loaded) return 'idle';
    const target = movement.heading === undefined ? root.rotation.y : movement.heading;
    root.rotation.y += Math.atan2(Math.sin(target - root.rotation.y),
      Math.cos(target - root.rotation.y)) * Math.min(1, dt * 11);
    if (typeof movement.jumpClipTime === 'number' && st.actions.Jump) {
      play('Jump', .08, movement.jumpClipTime);
      st.actions.Jump.timeScale = 0;
      st.motion = 'jump';
    } else {
      const speed = movement.speed || 0;
      const moving = speed > .01;
      if (moving) {
        const name = movement.run ? 'Run' : 'Walk';
        play(name);
        // the clip's cadence follows the real ground speed once the sprite scale is known
        let ts = 1;
        if (root.userData.pxPerUnit > 0) {
          const ups = speed * 10 / root.userData.pxPerUnit;
          ts = Math.min(2.5, Math.max(.5, ups / clipSpeed[name]));
        }
        st.actions[name].timeScale = ts;
        st.timeScale = ts;
        st.motion = movement.run ? 'run' : 'walk';
      } else {
        play('Idle');
        st.actions.Idle.timeScale = 1;
        st.timeScale = 1;
        st.motion = 'idle';
      }
    }
    st.mixer.update(dt);
    return st.motion;
  };

  root.userData.dispose = () => {
    root.userData.disposed = true;
    if (st.mixer) { st.mixer.stopAllAction(); if (st.model) st.mixer.uncacheRoot(st.model); }
    root.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); }
    });
  };
  return root;
}
