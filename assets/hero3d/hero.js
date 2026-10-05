/* tb-hero3d — WebGL neural network for the homepage first screen.
   Scoped to .tb-hero3d; theme state is stored on the hero element, not <html>.
   No external requests; all assets local.
*/
requestAnimationFrame(() => requestAnimationFrame(() => {
  'use strict';
  const hero = document.querySelector('.tb-hero3d');
  if (!hero) return;
  const canvas = hero.querySelector('canvas');
  let light = hero.dataset.theme === 'light';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let gl;
  try {
    gl = canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, powerPreference: 'low-power'
    });
  } catch (_) { return; }
  if (!gl) return;

  const vertex = `
    attribute vec2 p;
    attribute float a;
    attribute float s;
    varying float alpha;
    void main() {
      gl_Position = vec4(p, 0., 1.);
      gl_PointSize = s;
      alpha = a;
    }`;
  const fragment = `
    precision mediump float;
    uniform vec3 color;
    uniform float dots;
    uniform float lightTheme;
    varying float alpha;
    void main() {
      float opacity = alpha;
      vec3 tint = color;
      if (dots > 0.5) {
        float d = length(gl_PointCoord - 0.5) * 2.;
        if (d > 1.) discard;
        float halo = exp(-4.5 * d * d) * (1. - smoothstep(.65, 1., d));
        float core = 1. - smoothstep(.035, .26, d);
        float glow = .16 * halo + .84 * core;
        float ink = .12 * halo + .88 * (1. - smoothstep(.10, .48, d));
        opacity *= mix(glow, ink, lightTheme);
        tint = mix(color, vec3(1., .97, .98),
          (1. - lightTheme) * (1. - smoothstep(.01, .12, d)) * .95);
      }
      opacity = clamp(opacity, 0., 1.);
      gl_FragColor = vec4(tint * opacity, opacity);
    }`;
  function shader(type, source) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('Shader compilation failed');
    return s;
  }
  let program;
  try {
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
  } catch (_) { return; }
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  const setBlend = () => gl.blendFuncSeparate(gl.ONE, light ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE,
    gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  setBlend();
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [name, size, offset] of [['p', 2, 0], ['a', 1, 8], ['s', 1, 12]]) {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 16, offset);
  }
  const color = gl.getUniformLocation(program, 'color');
  const dots = gl.getUniformLocation(program, 'dots');
  const lightLoc = gl.getUniformLocation(program, 'lightTheme');
  gl.uniform1f(lightLoc, light ? 1 : 0);
  // Listen for hero-scoped theme change events
  document.addEventListener('tb-hero3d-theme', () => {
    light = hero.dataset.theme === 'light';
    setBlend(); gl.uniform1f(lightLoc, light ? 1 : 0);
  });
  const pink = [.933333, .643137, .733333];
  const charcoal = [.098039, .101961, .113725];
  const mobile = matchMedia('(max-width:600px)').matches;
  const count = mobile ? 1400 : 4200;
  const cometCount = mobile ? 24 : 32;
  const tailLength = 7;
  const groupCount = 9;
  const arcSegments = 20;
  const nodes = [], edges = [];
  const groupEdges = Array.from({ length: groupCount }, () => []);
  let seed = 9147;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const centers = Array.from({ length: groupCount }, (_, i) => {
    const y = 1 - 2 * (i + .5) / groupCount, a = i * 2.39996, r = Math.sqrt(1 - y * y);
    return [r * Math.cos(a), y, r * Math.sin(a)];
  });
  const order = [0];
  while (order.length < groupCount) {
    const p = centers[order[order.length - 1]];
    let next = -1, nearest = Infinity;
    centers.forEach((q, i) => {
      if (order.includes(i)) return;
      const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
      if (d < nearest) { nearest = d; next = i; }
    });
    order.push(next);
  }
  const rank = new Int8Array(groupCount);
  order.forEach((group, index) => { rank[group] = index; });
  for (let i = 0; i < count; i++) {
    const y = 1 - 2 * (i + .5) / count, a = i * 2.399963;
    const r = Math.sqrt(1 - y * y), radius = .94 + rand() * .085;
    const p = [r * Math.cos(a) * radius, y * radius, r * Math.sin(a) * radius];
    let group = 0, best = -Infinity;
    centers.forEach((c, j) => {
      const d = p[0] * c[0] + p[1] * c[1] + p[2] * c[2];
      if (d > best) { best = d; group = j; }
    });
    nodes.push({ p, group, weight: rand(), scatter: [(rand() - .5) * 4.5,
      (rand() - .5) * 3.6, (rand() - .5) * 2.6], x: 0, y: 0, z: 0, near: 0 });
  }
  const anchors = mobile ? 135 : 220;
  for (let i = 0; i < anchors; i++) for (let j = i + 1; j < anchors; j++) {
    const a = Math.floor(i * count / anchors), b = Math.floor(j * count / anchors);
    const p = nodes[a].p, q = nodes[b].p;
    if (Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < .40) {
      const edge = [a, b]; edges.push(edge); groupEdges[nodes[a].group].push(edge);
    }
  }
  const arcs = order.map((group, i) => {
    const a = centers[group], b = centers[order[(i + 1) % groupCount]];
    return Array.from({ length: arcSegments + 1 }, (_, j) => {
      const t = j / arcSegments;
      const p = a.map((v, k) => v + (b[k] - v) * t);
      const length = Math.hypot(...p), radius = 1.02 + Math.sin(t * Math.PI) * .09;
      return { p: p.map(v => v / length * radius), x: 0, y: 0, z: 0 };
    });
  });
  const hubs = centers.map(p => ({ p, x: 0, y: 0, z: 0 }));
  const pointData = new Float32Array(count * 4);
  const lineData = new Float32Array((edges.length + 32) * 8);
  const arcData = new Float32Array(groupCount * arcSegments * 8);
  const cometData = new Float32Array((cometCount * tailLength + tailLength) * 4);
  const hubData = new Float32Array(groupCount * 4);
  const glow = new Float32Array(groupCount);
  const source = { x: 0, y: 0, z: 0 };
  let width = 1, height = 1, dpr = 1, visible = true, lost = false;
  let frame = 0, time = 0, last = 0, rx = 0, ry = 0, targetX = 0, targetY = 0, frames = 0;
  let staticDrawn = false;
  const pointer = { x: -10, y: -10, active: false };

  function draw(data, n, mode, isDots, rgb) {
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, n * 4), gl.DYNAMIC_DRAW);
    gl.uniform3fv(color, rgb); gl.uniform1f(dots, isDots);
    gl.drawArrays(mode, 0, n);
  }
  function render() {
    frames++;
    gl.clear(gl.COLOR_BUFFER_BIT);
    rx += (targetX - rx) * .055; ry += (targetY - ry) * .055;
    const angle = time * .075 + rx * .42, tilt = -.16 + ry * .25;
    const ca = Math.cos(angle), sa = Math.sin(angle), ct = Math.cos(tilt), st = Math.sin(tilt);
    const small = width <= 600;
    const scale = small ? Math.min(width * .54, height * .37) : Math.min(width * .28, height * .38);
    const cx = width * (small ? .65 : .73), cy = height * (small ? .68 : .49);
    const intro = motion.matches ? 1 : Math.min(time / 1.5, 1);
    const convergence = 1 - Math.pow(1 - intro, 3);
    const networkReveal = motion.matches ? 1 : Math.max(0, (intro - .35) / .65);
    const cycle = (motion.matches ? .72 : Math.max(0, time - 1.5) / 1.35) % groupCount;
    const current = Math.floor(cycle), phase = cycle - current;
    for (let g = 0; g < groupCount; g++) {
      const age = (cycle - rank[g] + groupCount) % groupCount;
      glow[g] = age < 1 ? .65 + .35 * Math.sin(age * Math.PI)
        : age < 1.7 ? .65 * (1 - (age - 1) / .7)
        : age > 8.65 ? (age - 8.65) / .35 * .65 : 0;
    }
    function project(p, out) {
      const xx = p[0] * ca + p[2] * sa, zz = p[2] * ca - p[0] * sa;
      const yy = p[1] * ct - zz * st, depth = zz * ct + p[1] * st;
      const perspective = 3.6 / (3.6 - depth);
      out.x = (cx + xx * scale * perspective) / width * 2 - 1;
      out.y = 1 - (cy + yy * scale * perspective) / height * 2;
      out.z = depth;
      return perspective;
    }
    let pi = 0, li = 0, ai = 0, ci = 0, hi = 0;
    for (const n of nodes) {
      const p = n.p;
      source.x = n.scatter[0] + (p[0] - n.scatter[0]) * convergence;
      source.y = n.scatter[1] + (p[1] - n.scatter[1]) * convergence;
      source.z = n.scatter[2] + (p[2] - n.scatter[2]) * convergence;
      const xx = source.x * ca + source.z * sa, zz = source.z * ca - source.x * sa;
      const yy = source.y * ct - zz * st, depth = zz * ct + source.y * st;
      const perspective = 3.6 / (3.6 - depth);
      n.x = (cx + xx * scale * perspective) / width * 2 - 1;
      n.y = 1 - (cy + yy * scale * perspective) / height * 2; n.z = depth;
      n.near = pointer.active ? Math.max(0, 1 - Math.hypot(
        (n.x - pointer.x) * width / height, n.y - pointer.y) / .42) : 0;
      const g = glow[n.group] * networkReveal;
      const front = Math.max(0, Math.min(1, (depth + 1) / 2));
      pointData[pi++] = n.x; pointData[pi++] = n.y;
      pointData[pi++] = Math.min(1, (light ? .36 : .32) + front * .28 + g * .36 + n.near * .65);
      pointData[pi++] = (light ? 2.7 + n.weight * 1.8 + g * 2.4 + n.near * 4.5
        : 4.8 + n.weight * 2.9 + g * 5.5 + n.near * 9) * dpr * perspective;
    }
    function line(data, offset, a, b, alpha) {
      data[offset++] = a.x; data[offset++] = a.y; data[offset++] = alpha; data[offset++] = 1;
      data[offset++] = b.x; data[offset++] = b.y; data[offset++] = alpha; data[offset++] = 1;
      return offset;
    }
    for (const [aIndex, bIndex] of edges) {
      const a = nodes[aIndex], b = nodes[bIndex];
      const alpha = (light ? .20 : .08) + (a.z + 1) * .065 + glow[a.group] * .32
        + Math.max(a.near, b.near) * .5;
      li = line(lineData, li, a, b, Math.min(.9, alpha) * networkReveal);
    }
    if (pointer.active) {
      let connected = 0;
      for (const n of nodes) {
        if (n.near < .5 || n.z < 0) continue;
        li = line(lineData, li, n, pointer, n.near * .8);
        if (++connected === 32) break;
      }
    }
    arcs.forEach((arc, i) => {
      for (const p of arc) project(p.p, p);
      const previous = (current + groupCount - 1) % groupCount;
      const strength = i === current ? .95 : i === previous ? (1 - phase) * .35 : 0;
      for (let j = 0; j < arcSegments; j++) {
        const arrival = Math.max(0, Math.min(1, (phase * 1.7 - j / arcSegments) * 5));
        const alpha = i === current ? strength * arrival : strength;
        ai = line(arcData, ai, arc[j], arc[j + 1], alpha * networkReveal);
      }
    });
    function point(out, offset, x, y, alpha, size) {
      out[offset++] = x; out[offset++] = y; out[offset++] = alpha;
      out[offset++] = size * dpr; return offset;
    }
    for (let i = 0; i < cometCount; i++) {
      const group = order[(current + (i % 4 === 0 ? 1 : 0)) % groupCount];
      const pool = groupEdges[group].length ? groupEdges[group] : edges;
      if (!pool.length) continue;
      const edge = pool[(i * 13) % pool.length], a = nodes[edge[0]], b = nodes[edge[1]];
      const t = (time * .72 + i * .618034) % 1;
      for (let tail = tailLength - 1; tail >= 0; tail--) {
        const u = t - tail * .045;
        if (u < 0) continue;
        const fade = Math.pow(1 - tail / tailLength, 1.65);
        ci = point(cometData, ci, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u,
          fade * networkReveal, (light ? 7 : 15) * (.45 + fade * .55));
      }
    }
    const handoff = arcs[current];
    for (let tail = tailLength - 1; tail >= 0; tail--) {
      const u = Math.min(1, phase * 1.7) - tail * .022;
      if (u < 0) continue;
      const segment = Math.min(arcSegments - 1, Math.floor(u * arcSegments));
      const f = u * arcSegments - segment, a = handoff[segment], b = handoff[segment + 1];
      const fade = 1 - tail / tailLength;
      ci = point(cometData, ci, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f,
        fade * networkReveal, (light ? 12 : 24) * (.4 + fade * .6));
    }
    hubs.forEach((hub, i) => {
      project(hub.p, hub);
      hi = point(hubData, hi, hub.x, hub.y, (.3 + glow[i] * .7) * networkReveal,
        light ? 7 + glow[i] * 13 : 14 + glow[i] * 34);
    });
    draw(lineData, li / 4, gl.LINES, 0, light ? charcoal : pink);
    draw(pointData, pi / 4, gl.POINTS, 1, light ? charcoal : pink);
    draw(arcData, ai / 4, gl.LINES, 0, pink);
    draw(hubData, hi / 4, gl.POINTS, 1, pink);
    draw(cometData, ci / 4, gl.POINTS, 1, pink);
    hero.classList.add('ready');
    hero.dataset.frames = String(frames);
  }
  function tick(now) {
    frame = 0;
    if (document.hidden || !visible || motion.matches || lost) return;
    if (last) time += Math.min((now - last) / 1000, .05);
    last = now; render(); frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    if (lost || document.hidden || !visible) return;
    if (motion.matches) {
      if (!staticDrawn) {
        rx = ry = targetX = targetY = 0; pointer.active = false;
        render(); staticDrawn = true;
      }
    } else { staticDrawn = false; frame = requestAnimationFrame(tick); }
  }
  function resize() {
    const rect = hero.getBoundingClientRect();
    const ratio = Math.min(devicePixelRatio || 1, 2);
    if (width === rect.width && height === rect.height && dpr === ratio) return;
    width = rect.width; height = rect.height; dpr = ratio;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    staticDrawn = false; sync();
  }
  hero.addEventListener('pointermove', event => {
    if (motion.matches || (event.pointerType === 'touch' && event.buttons === 0)) return;
    const r = hero.getBoundingClientRect();
    pointer.x = (event.clientX - r.left) / width * 2 - 1;
    pointer.y = 1 - (event.clientY - r.top) / height * 2;
    pointer.active = true; targetX = pointer.x; targetY = pointer.y;
  }, { passive: true });
  function reset() { pointer.active = false; targetX = targetY = 0; }
  hero.addEventListener('pointerleave', reset);
  hero.addEventListener('pointerup', e => { if (e.pointerType === 'touch') reset(); });
  hero.addEventListener('pointercancel', reset);
  document.addEventListener('visibilitychange', sync);
  motion.addEventListener('change', () => { staticDrawn = false; sync(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(hero);
  }
  new ResizeObserver(resize).observe(hero);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; cancelAnimationFrame(frame);
    hero.classList.remove('ready');
  });
  hero.dataset.particles = String(count);
  hero.dataset.comets = String(cometCount);
  resize();
}));
