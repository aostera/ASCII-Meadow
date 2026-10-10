// Camera: hovers above the knight, drifts after him, and keeps the visible cell window (VX0..VY1).

// ---------- camera: hovers above the knight and drifts after him ----------
let camX = 0, camY = 0, VX0 = 0, VX1 = 0, VY0 = 0, VY1 = 0;
function updateCamera(dt, snap) {
  const tx = Math.max(0, Math.min(COLS - VC, player.x - VC / 2));
  const near = Math.max(0, Math.min(1, 1 - (player.y - (cathedral.gateRow || 0)) / (VR * 2)));  // by the castle, look up at it
  const ty = Math.max(0, Math.min(ROWS - VR, player.y - liftPx(player) / CH - VR * (0.72 + 0.18 * near)));
  const k = snap ? 1 : 1 - Math.exp(-dt * 3.5);
  camX += (tx - camX) * k; camY += (ty - camY) * k;
  VX0 = Math.max(0, Math.floor(camX) - 1); VX1 = Math.min(COLS - 1, Math.ceil(camX + VC) + 1);
  VY0 = Math.max(0, Math.floor(camY) - 2); VY1 = Math.min(ROWS - 1, Math.ceil(camY + VR) + 3);
}
