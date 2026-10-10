// The simulation step. The order is the game's: the knight and the other entities move, the camera
// follows, the grass takes its forces and springs, then cows, world, fires, flora and the small life.
function simulate(dt) {
  t += dt;
  updateKnight(dt);           // entities/knight.js
  updateNpcs(dt);             // entities/entities.js
  updateEntityTimers(dt);     // entities/entities.js

  updateCamera(dt);           // core/camera.js
  applyGrassForces(dt);       // world/grass.js
  updateGusts(dt);            // world/wind.js
  updateGrass(dt);            // world/grass.js

  updateCows(dt);             // entities/cow.js
  updateWorld(dt);            // world/world.js
  castShadows();              // world/shadows.js: after the cows moved and the lightning struck
  for (const b of braziers) updateFire(b, dt);   // world/lights.js
  updateFlora(dt);            // world/flora.js
  updateLife(dt);             // world/life.js
}
