// Small life of the meadow: butterflies, drifting ash and dew glints.

// butterflies & pollen
const flies = [], motes = [], dew = [];
function seedLife() {
  flies.length = 0; motes.length = 0;
  const nf = Math.round(COLS * ROWS / 4000) + 3;
  for (let k = 0; k < nf; k++) flies.push({ x: Math.random() * COLS, y: HZ + 2 + Math.random() * (ROWS - HZ - 4), vx: 0, vy: 0, ph: Math.random() * 6, c: C_WHITE, hx: Math.random() * COLS, hy: HZ + 2 + Math.random() * (ROWS - HZ - 4) });
  const nm = Math.round(W * H / 9000);
  for (let k = 0; k < nm; k++) motes.push({ x: Math.random() * W, y: Math.random() * H, z: 0.4 + Math.random() * 0.6, ph: Math.random() * 6 });
}
