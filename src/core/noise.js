// Hash and value noise used by the terrain, the grass, the fog and the flora.

// ---------- noise ----------
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const sm = t => t * t * (3 - 2 * t);
function vnoise(x, y) {   // hash() and sm() written out: the fog and the clouds call this tens of thousands of times a frame
  const xi = Math.floor(x), yi = Math.floor(y), u = x - xi, v = y - yi, xf = u * u * (3 - 2 * u), yf = v * v * (3 - 2 * v);
  const x0 = xi * 374761393, x1 = (xi + 1) * 374761393, y0 = yi * 668265263, y1 = (yi + 1) * 668265263;
  let h = (x0 + y0) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); const a = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  h = (x1 + y0) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); const b = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  h = (x0 + y1) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); const c = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  h = (x1 + y1) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); const d = ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
