// WebGL2 back end of the glyph batch: one program and four textures: the glyphs of the frame, the sprite uv
// table, the atlas and the castle.

// Safari on iPad may evict a WebGL context when Safari is backgrounded.
// The entire program and all GPU textures must be recreated on restoration,
// not merely the viewport. CPU-side atlas, glyph buffer and map are preserved.
const GL = { ok: false, lost: false };
function initGL() {
  const c = document.getElementById('g');
  const gl = c.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true });
  if (!gl) { GL.ok = false; GL.ctx2 = c.getContext('2d', { alpha: false }); return; }
  if (gl.isContextLost()) { GL.ok = false; GL.lost = true; return; }
  GL.gl = gl; GL.ctx2 = null;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  // rows of the glyph and sprite textures: 4096 texels, or 2048 where the GPU allows no wider (the least
  // WebGL2 promises)
  const MAXT = gl.getParameter(gl.MAX_TEXTURE_SIZE), TW = MAXT >= 4096 ? 4096 : 2048, TS = TW === 4096 ? 12 : 11;
  const prog = gl.createProgram();
  // No vertex buffers: each glyph is six vertices (two triangles), and the vertex shader reads the glyph's
  // six floats (rectangle x0, y0, x1, y1, sprite, alpha) as two texels of the glyph texture and its uvs from
  // the sprite table. Corners are picked, not interpolated, so positions and uvs match the CPU's exactly.
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, `#version 300 es
      uniform vec2 u_cam, u_view; uniform int u_base; uniform highp sampler2D u_gly, u_spr;
      out vec2 v_uv; out float v_a;
      void main() {
        int g = gl_VertexID / 6, c = gl_VertexID - g * 6, k = c == 3 ? 1 : c == 4 ? 3 : c == 5 ? 2 : c;
        bool hx = (k & 1) == 1, hy = k > 1;
        int i = (g + u_base) * 2;
        vec3 r = texelFetch(u_gly, ivec2(i & ${TW - 1}, i >> ${TS}), 0).xyz, e = texelFetch(u_gly, ivec2((i + 1) & ${TW - 1}, (i + 1) >> ${TS}), 0).xyz;
        int s = int(e.y + 0.5);   // texel one: x0, y0, x1; texel two: y1, sprite, alpha
        vec4 t = texelFetch(u_spr, ivec2(s & ${TW - 1}, s >> ${TS}), 0);
        vec2 q = (vec2(hx ? r.z : r.x, hy ? e.x : r.y) - u_cam) / u_view * 2.0 - 1.0;
        gl_Position = vec4(q.x, -q.y, 0.0, 1.0);
        v_uv = vec2(hx ? t.z : t.x, hy ? t.w : t.y); v_a = e.z;
      }`));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `#version 300 es
      precision mediump float; uniform sampler2D u_tex; in vec2 v_uv; in float v_a; out vec4 o;
      void main() { o = texture(u_tex, v_uv) * v_a; }`));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { GL.ctx2 = null; return; }
  gl.useProgram(prog);
  const UL = {}, U = n => UL[n] || (UL[n] = gl.getUniformLocation(prog, n));  // looked up once: each lookup is a sync round trip
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  let gh = 0, sv = -1;   // rows of the glyph texture allocated, the sprite table version uploaded
  const mkTex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); return t; };
  const atlasT = mkTex(), castT = mkTex();
  const fTex = (unit) => { const t = gl.createTexture(); gl.activeTexture(unit); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
  const glyT = fTex(gl.TEXTURE2);   // the frame's glyphs: two RGB float texels each, TW texels to a row
  const sprT = gl.createTexture();   // the sprite uv table: u0, v0, u1, v1 per texel, TW to a row
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sprT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  const uploadSprites = () => {
    const n = GB.spr.length, w = Math.min(TW, Math.max(1, n)), h = Math.ceil(n / w) || 1, d = new Float32Array(w * h * 4);
    for (let i = 0; i < n; i++) { const q = i * 8, o = i * 4; d[o] = SPF[q + 4]; d[o + 1] = SPF[q + 5]; d[o + 2] = SPF[q + 6]; d[o + 3] = SPF[q + 7]; }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sprT);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, d);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    sv = GB.sv;
  };
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  GL.upload = () => {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, atlasT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, GB.atlasCv);
  };
  GL.uploadCastle = (cvs) => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, castT); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cvs); };
  GL.resize = () => { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); gl.viewport(0, 0, c.width, c.height); };
  const draw = (start, count, tex, add) => {
    if (!count) return;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.blendFunc(gl.ONE, add ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform1i(U('u_base'), start);
    gl.drawArrays(gl.TRIANGLES, 0, count * 6);
  };
  GL.flush = (camx, camy, castle) => {
    gl.clearColor(12 / 255, 12 / 255, 12 / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    if (sv !== GB.sv) uploadSprites();
    gl.uniform2f(U('u_cam'), camx, camy); gl.uniform2f(U('u_view'), W / VZ, H / VZ);
    gl.uniform1i(U('u_tex'), 0); gl.uniform1i(U('u_spr'), 1); gl.uniform1i(U('u_gly'), 2);
    // castle quads go after the glyphs in the buffer, then are drawn first
    const ext = castle ? (castle.flash > 0.02 ? 2 : 1) : 0;
    if (castle) { gput(CAST, castle.x, castle.y, castle.a); if (ext === 2) gput(CAST, castle.x, castle.y, castle.flash); }
    // the glyphs go up as whole rows of the texture (the batch buffer always holds whole rows)
    const cap = Math.min(MAXT, GB.buf.length / (TW * 3)), maxG = cap * TW / 2;
    if (GB.n > maxG) { GB.buf.copyWithin((maxG - ext) * 6, (GB.n - ext) * 6, GB.n * 6); GB.n = maxG; }   // more than the texture holds: the frontmost glyphs go, the castle stays
    const rows = Math.ceil(GB.n * 2 / TW);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, glyT);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (gh !== cap) { gh = cap; gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB32F, TW, gh, 0, gl.RGB, gl.FLOAT, null); }
    if (rows) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, TW, rows, gl.RGB, gl.FLOAT, GB.buf, 0);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    const gn = GB.n - ext;
    if (castle) { draw(gn, 1, castT, false); if (ext === 2) draw(gn + 1, 1, castT, true); }
    draw(0, gn, atlasT, false);
  };
  // Re-upload immutable CPU-side textures after a tab resumes. Safari may
  // discard GPU backing stores even with the original JS world still running.
  GL.refresh = () => {
    if (gl.isContextLost()) { GL.ok = false; GL.lost = true; return false; }
    if (GB.atlasCv) GL.upload();
    sv = -1; // re-upload UV table on the next frame, even if GB.sv did not change
    if (W && H && DPR) GL.resize();
    return true;
  };
  GL.ok = true;
}

initGL();
const gameCanvas = document.getElementById('g');
gameCanvas.addEventListener('webglcontextlost', event => {
  event.preventDefault(); // allow WebKit to emit webglcontextrestored
  GL.lost = true;
  GL.ok = false;
});
gameCanvas.addEventListener('webglcontextrestored', () => {
  try {
    initGL(); // new shaders, VAO and texture handles for the new context
    if (GL.ok && GL.refresh()) GL.lost = false;
  } catch (err) {
    GL.ok = false; GL.lost = true;
    console.error('WebGL2 context restoration failed:', err);
  }
});
