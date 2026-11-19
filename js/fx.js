import * as THREE from 'three';
import { softDot, heroRing } from './textures.js';

// Pooled additive particle system + one-off effects (arcs, bolts, rings).
export function makeFX(scene, quality) {
  const N = quality.low ? 900 : 1800;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const vel = new Float32Array(N * 3), life = new Float32Array(N), maxLife = new Float32Array(N), grav = new Float32Array(N), base = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: softDot('#ffffff'), size: 0.32, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  pts.frustumCulled = false; scene.add(pts);
  let cursor = 0;
  const C = new THREE.Color();
  function burst(p, n, color, speed = 6, lifeT = 0.6, g = -6, spread = 1, up = 0.5) {
    C.set(color);
    const k = Array.isArray(color) ? null : null;
    for (let j = 0; j < n; j++) {
      const i = cursor; cursor = (cursor + 1) % N;
      pos[i * 3] = p.x + (Math.random() - .5) * 0.3 * spread; pos[i * 3 + 1] = p.y + (Math.random() - .5) * 0.3 * spread; pos[i * 3 + 2] = p.z + (Math.random() - .5) * 0.3 * spread;
      const th = Math.random() * 6.28, ph = Math.acos(Math.random() * 2 - 1), s = speed * (0.3 + Math.random() * 0.7);
      vel[i * 3] = Math.sin(ph) * Math.cos(th) * s; vel[i * 3 + 1] = Math.abs(Math.cos(ph)) * s * up + Math.cos(ph) * s * (1 - up); vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * s;
      life[i] = maxLife[i] = lifeT * (0.5 + Math.random() * 0.5); grav[i] = g;
      const b = 1.5 + Math.random() * 1.5; base[i * 3] = C.r * b; base[i * 3 + 1] = C.g * b; base[i * 3 + 2] = C.b * b;
    }
  }
  function ringBurst(p, n, color, speed, y = 0.2) {
    C.set(color);
    for (let j = 0; j < n; j++) {
      const i = cursor; cursor = (cursor + 1) % N; const a = j / n * 6.28;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y + y; pos[i * 3 + 2] = p.z;
      vel[i * 3] = Math.cos(a) * speed; vel[i * 3 + 1] = Math.random() * 1.5; vel[i * 3 + 2] = Math.sin(a) * speed;
      life[i] = maxLife[i] = 0.5 + Math.random() * 0.3; grav[i] = 0;
      base[i * 3] = C.r * 2.5; base[i * 3 + 1] = C.g * 2.5; base[i * 3 + 2] = C.b * 2.5;
    }
  }

  // ---- slash arcs ----
  const arcTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 16; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, 'rgba(160,230,255,0.9)'); gr.addColorStop(1, '#fff'); g.fillStyle = gr; g.fillRect(0, 0, 256, 16); const t = new THREE.CanvasTexture(c); return t; })();
  const items = [];
  function arc(center, heading, radius, color, side, tilt = 0) {
    const geo = new THREE.RingGeometry(radius * 0.45, radius, 32, 1, 0, Math.PI * 1.2);
    const uv = geo.attributes.uv, p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getY(i), p.getX(i)); let u = (a < 0 ? a + Math.PI * 2 : a) / (Math.PI * 1.2); if (side < 0) u = 1 - u; const r = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, u * Math.min(1, (r - radius * 0.45) / (radius * 0.55) * 1.6), 0.5); }
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: arcTex, color: new THREE.Color(color).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.copy(center); m.rotation.order = 'YXZ'; m.rotation.y = heading; m.rotation.x = -Math.PI / 2 + tilt; m.rotation.z = -Math.PI * 1.1;
    scene.add(m); items.push({ m, t: 0, life: 0.22, kind: 'arc', s0: 0.85 });
  }
  const ringTex = heroRing();
  function shock(center, radius, color, life = 0.45) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(color).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(center); m.position.y = 0.08; scene.add(m);
    items.push({ m, t: 0, life, kind: 'shock', r: radius });
  }
  function telegraph(center, radius, life) {
    const m = new THREE.Mesh(new THREE.RingGeometry(radius * 0.92, radius, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.1), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.05, 0.02), transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.add(fill); m.rotation.x = -Math.PI / 2; m.position.copy(center); m.position.y = 0.1; scene.add(m);
    items.push({ m, t: 0, life, kind: 'tele', fill });
  }
  // jagged ribbon bolt from a to b
  function bolt(a, b, color = [1, 2.6, 4], width = 0.12, life = 0.25) {
    const segs = 14, pts = [];
    const d = b.clone().sub(a), len = d.length();
    for (let i = 0; i <= segs; i++) { const t = i / segs; const p = a.clone().addScaledVector(d, t); if (i && i < segs) p.add(new THREE.Vector3((Math.random() - .5), (Math.random() - .5), (Math.random() - .5)).multiplyScalar(len * 0.09)); pts.push(p); }
    const g = new THREE.Group();
    for (const ax of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)]) {
      const vs = [];
      for (let i = 0; i < segs; i++) {
        const p0 = pts[i], p1 = pts[i + 1], w = width * (1 - i / segs * 0.5);
        const o = ax.clone().multiplyScalar(w);
        vs.push(p0.x - o.x, p0.y - o.y, p0.z - o.z, p0.x + o.x, p0.y + o.y, p0.z + o.z, p1.x + o.x, p1.y + o.y, p1.z + o.z,
          p0.x - o.x, p0.y - o.y, p0.z - o.z, p1.x + o.x, p1.y + o.y, p1.z + o.z, p1.x - o.x, p1.y - o.y, p1.z - o.z);
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vs, 3));
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(...color), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    }
    scene.add(g); items.push({ m: g, t: 0, life, kind: 'bolt' });
  }
  function vortex(center, life) {
    const g = new THREE.Group(); g.position.copy(center);
    const mats = [];
    for (let i = 0; i < 2; i++) {
      const mat = new THREE.MeshBasicMaterial({ map: ringTex, color: i ? new THREE.Color(1.8, 0.6, 3.2) : new THREE.Color(0.5, 1.4, 3.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9 - i * 3, 9 - i * 3), mat); m.rotation.x = -Math.PI / 2; m.position.y = 0.1 + i * 0.6; g.add(m); mats.push(mat);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.6, 3.5) })); core.position.y = 1.4; g.add(core);
    const light = new THREE.PointLight(0x9a5cff, 40, 14, 1.4); light.position.y = 2; g.add(light);
    scene.add(g); items.push({ m: g, t: 0, life, kind: 'vortex', mats, core });
    return g;
  }

  function update(dt) {
    for (let i = 0; i < N; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) { pos[i * 3 + 1] = -999; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; continue; }
      vel[i * 3 + 1] += grav[i] * dt;
      vel[i * 3] *= 0.98; vel[i * 3 + 2] *= 0.98;
      pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.05) { pos[i * 3 + 1] = 0.05; vel[i * 3 + 1] *= -0.3; }
      const k = life[i] / maxLife[i];
      col[i * 3] = base[i * 3] * k; col[i * 3 + 1] = base[i * 3 + 1] * k; col[i * 3 + 2] = base[i * 3 + 2] * k;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]; it.t += dt; const k = it.t / it.life;
      if (k >= 1) { scene.remove(it.m); it.m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.dispose) o.material.dispose(); }); items.splice(i, 1); continue; }
      if (it.kind === 'arc') { it.m.material.opacity = 1 - k; it.m.scale.setScalar(it.s0 + k * 0.4); }
      else if (it.kind === 'shock') { const s = it.r * (0.2 + 0.8 * Math.pow(k, 0.5)); it.m.scale.set(s, s, 1); it.m.material.opacity = 1 - k; }
      else if (it.kind === 'tele') { it.fill.scale.setScalar(k); it.m.material.opacity = 0.6 + Math.sin(it.t * 30) * 0.4; }
      else if (it.kind === 'bolt') { it.m.children.forEach(c => c.material.opacity = (1 - k) * (Math.random() < 0.8 ? 1 : 0.3)); }
      else if (it.kind === 'vortex') { it.m.children[0].rotation.z += dt * 4; it.m.children[1].rotation.z -= dt * 7; const s = Math.min(1, it.t * 4) * (k > 0.9 ? (1 - k) * 10 : 1); it.m.scale.setScalar(Math.max(0.01, s)); it.core.scale.setScalar(1 + Math.sin(it.t * 20) * 0.15); }
    }
  }
  return { burst, ringBurst, arc, shock, telegraph, bolt, vortex, update, clearAll() { for (const it of items) scene.remove(it.m); items.length = 0; life.fill(0); for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999; } };
}
