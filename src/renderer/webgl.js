// WebGL2 back end of the glyph batch: one program, one dynamic buffer, two textures (atlas, castle).

const GL = { ok: false };
(function initGL() {
  const c = document.getElementById('g');
  const gl = c.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: true });
  if (!gl) { GL.ctx2 = c.getContext('2d', { alpha: false }); return; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, `#version 300 es
      layout(location=0) in vec2 a_p; layout(location=1) in vec2 a_t; layout(location=2) in float a_a;
      uniform vec2 u_cam, u_view;
      out vec2 v_uv; out float v_a;
      void main() {
        vec2 q = (a_p - u_cam) / u_view * 2.0 - 1.0;
        gl_Position = vec4(q.x, -q.y, 0.0, 1.0);
        v_uv = a_t; v_a = a_a;
      }`));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `#version 300 es
      precision mediump float; uniform sampler2D u_tex; in vec2 v_uv; in float v_a; out vec4 o;
      void main() { o = texture(u_tex, v_uv) * v_a; }`));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { GL.ctx2 = null; return; }
  gl.useProgram(prog);
  const UL = {}, U = n => UL[n] || (UL[n] = gl.getUniformLocation(prog, n));  // looked up once: each lookup is a sync round trip
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const vb = gl.createBuffer(), eb = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vb);
  for (const l of [0, 1, 2]) gl.enableVertexAttribArray(l);
  const attrs = (start) => { const B = start * 80; gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 20, B); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, B + 8); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, B + 16); };
  let ecap = 0, vcap = 0;
  const indices = (n) => { // two triangles per glyph, shared by every frame
    if (n <= ecap) return; ecap = Math.max(n, ecap * 2, 16384);
    const d = new Uint32Array(ecap * 6);
    for (let i = 0; i < ecap; i++) { const v = i * 4, o = i * 6; d[o] = v; d[o + 1] = v + 1; d[o + 2] = v + 2; d[o + 3] = v + 1; d[o + 4] = v + 3; d[o + 5] = v + 2; }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, d, gl.STATIC_DRAW);
  };
  const mkTex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); return t; };
  const atlasT = mkTex(), castT = mkTex();
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
    attrs(0);
    gl.drawElements(gl.TRIANGLES, count * 6, gl.UNSIGNED_INT, start * 24);
  };
  GL.flush = (camx, camy, castle) => {
    gl.clearColor(12 / 255, 12 / 255, 12 / 255, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.uniform2f(U('u_cam'), camx, camy); gl.uniform2f(U('u_view'), W, H);
    gl.uniform1i(U('u_tex'), 0);
    // castle quads go after the glyphs in the buffer, then are drawn first
    const ext = castle ? (castle.flash > 0.02 ? 2 : 1) : 0;
    if (castle) { gput(CAST, castle.x, castle.y, castle.a); if (ext === 2) gput(CAST, castle.x, castle.y, castle.flash); }
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    if (vcap < GB.buf.length) { vcap = GB.buf.length; gl.bufferData(gl.ARRAY_BUFFER, vcap * 4, gl.DYNAMIC_DRAW); }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, GB.buf, 0, GB.n * 20);
    indices(GB.n); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, eb);
    const gn = GB.n - ext;
    if (castle) { draw(gn, 1, castT, false); if (ext === 2) draw(gn + 1, 1, castT, true); }
    draw(0, gn, atlasT, false);
  };
  GL.ok = true;
})();
