// Skinned glTF knight (the Masked Knight from blender/anim_knight.py) behind the same
// contract as knight-rig.js: a Group whose userData.animate(dt, movement, now) returns
// 'idle' | 'walk' | 'run' | 'jump', facing local +Z with the feet at y=0, about 8.9 units tall.
// The GLB loads asynchronously; until it arrives (or if it fails) the procedural rig passed
// as `fallback` is shown, so callers keep a synchronous API.
//
// Clips in the GLB (24 fps, all in place, cloak simulation baked into 63 cloak bones):
//   Idle 48 f loop, Walk 32 f loop (0.62 m/s), Run 20 f loop (1.9 m/s),
//   Jump 36 f once (take-off f9, touch-down f23), Crouch 24 f once.
// The jump height stays with this module (same arc constants as knight-rig.js); the Jump clip
// is time-mapped so its take-off and touch-down meet the arc's.
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const KNIGHT_GLB_URL = new URL('./assets/knight/masked_knight.glb', import.meta.url).href;
export const KNIGHT_CLIPS = ['Idle', 'Walk', 'Run', 'Jump', 'Crouch'];
const MODEL_HEIGHT = 1.90;          // metres, top of the head in the GLB
const RIG_HEIGHT = 8.9;             // units expected by source-motion.mjs projection
const CLIP_SPEED = {Walk: .62, Run: 1.9};       // m/s the baked locomotion clips cover
const JUMP_TAKEOFF = 9 / 24, JUMP_LAND = 23 / 24;
const JUMP_V = 8.8, GRAVITY = 23;   // knight-rig.js arc, rig units
const FADE = .18;

export function createGltfKnight(THREE, {url = KNIGHT_GLB_URL, fallback = null, onLoad, onError} = {}) {
  const root = new THREE.Group();
  root.name = 'Masked Knight (glTF)';
  const holder = new THREE.Group();          // carries the jump height
  root.add(holder);
  let backup = fallback ? fallback() : null;
  if (backup) root.add(backup);
  const st = {
    loaded: false, error: null, mixer: null, actions: {}, current: null, model: null,
    air: 0, vy: 0, landed: -1, motion: 'idle', clip: null, timeScale: 1,
  };
  root.userData.gltf = st;
  root.userData.footprint = {radius: .85, height: 8.3};
  root.userData.pxPerMeter = null;           // set by the caller from the source sprite height

  const applyLayers = obj => obj.traverse(o => { o.layers.mask = root.layers.mask; });

  new GLTFLoader().load(url, gltf => {
    if (root.userData.disposed) return;
    const model = gltf.scene;
    model.scale.setScalar(RIG_HEIGHT / MODEL_HEIGHT);
    model.traverse(o => {
      if (o.isSkinnedMesh) o.frustumCulled = false;    // bounds are the bind pose only
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
    });
    holder.add(model);
    applyLayers(model);
    st.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const a = st.mixer.clipAction(clip);
      if (clip.name === 'Jump' || clip.name === 'Crouch') {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      }
      st.actions[clip.name] = a;
    }
    const missing = KNIGHT_CLIPS.filter(n => !st.actions[n]);
    if (missing.length) throw Error('Knight GLB is missing clips ' + missing.join(','));
    st.model = model;
    st.loaded = true;
    if (backup) {
      root.remove(backup);
      backup.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      backup = null;
    }
    play('Idle', 0);
    onLoad?.(root);
  }, undefined, err => {
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

  root.userData.animate = (dt, movement, now) => {
    dt = Math.min(.05, Math.max(0, dt));
    if (!st.loaded) return backup ? backup.userData.animate(dt, movement, now) : 'idle';
    const speed = movement.speed || 0;
    const moving = speed > .01;
    const run = moving && !!movement.run;
    // heading: same smoothing as the procedural rig
    const targetYaw = movement.heading === undefined ? root.rotation.y : movement.heading;
    const delta = Math.atan2(Math.sin(targetYaw - root.rotation.y), Math.cos(targetYaw - root.rotation.y));
    root.rotation.y += delta * Math.min(1, dt * 11);
    // jump arc in rig units
    if (movement.jump && st.air <= .001 && st.vy <= 0) st.vy = JUMP_V;
    const airborne = st.air > 0 || st.vy > 0;
    if (airborne) {
      st.air += st.vy * dt;
      st.vy -= GRAVITY * dt;
      if (st.air <= 0) { st.air = 0; st.vy = 0; st.landed = 0; }
    }
    holder.position.y = st.air;
    if (st.air > 0 || st.vy > 0) {
      // map the arc onto the clip between take-off and touch-down
      const up = JUMP_V - st.vy;                   // velocity lost so far
      const k = Math.min(1, Math.max(0, up / (2 * JUMP_V)));
      play('Jump', .08, JUMP_TAKEOFF + k * (JUMP_LAND - JUMP_TAKEOFF));
      st.actions.Jump.timeScale = 0;
      st.motion = 'jump';
    } else if (st.landed >= 0 && !moving && st.current === st.actions.Jump &&
               st.actions.Jump.time < st.actions.Jump.getClip().duration - 1e-3) {
      st.actions.Jump.timeScale = 1;               // absorb and recover after touch-down
      st.landed += dt;
      st.motion = 'jump';
    } else {
      st.landed = -1;
      if (moving) {
        const name = run ? 'Run' : 'Walk';
        play(name);
        // match the clip cadence to the real ground speed when the sprite scale is known
        let ts = 1;
        if (root.userData.pxPerMeter > 0) {
          const mps = speed * 10 / root.userData.pxPerMeter;
          ts = Math.min(2.5, Math.max(.5, mps / CLIP_SPEED[name]));
        }
        st.actions[name].timeScale = ts;
        st.timeScale = ts;
        st.motion = run ? 'run' : 'walk';
      } else {
        play('Idle');
        st.actions.Idle.timeScale = 1;
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
