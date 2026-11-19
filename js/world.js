import * as THREE from 'three';
import { tileTextures, floorRunes, sealTexture, planetTexture, ringTexture, softDot } from './textures.js';

export const ARENA_R = 23;

// ---- tiny 3D value noise for the baked sky ----
function hash(x, y, z) { let h = x * 374761393 + y * 668265263 + z * 2147483647; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) & 0xffff) / 0xffff; }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
}
function fbm(x, y, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2.03; a *= 0.5; } return s; }

function bakeSky(W = 1024, H = 512) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI; const cy = Math.sin(lat), cl = Math.cos(lat);
    for (let x = 0; x < W; x++) {
      const lon = x / W * Math.PI * 2; const dx = cl * Math.cos(lon), dz = cl * Math.sin(lon), dy = cy;
      const h = Math.max(0, dy);
      // base gradient: electric blue near horizon -> deep navy at zenith
      let r = 2 + 12 * Math.pow(1 - h, 7), gg = 6 + 45 * Math.pow(1 - h, 6), b = 20 + 120 * Math.pow(1 - h, 5);
      if (dy < 0) { const k = Math.min(1, -dy * 4); r *= 1 - k * 0.7; gg *= 1 - k * 0.7; b *= 1 - k * 0.6; }
      // nebula
      const n = fbm(dx * 2.2 + 3, dy * 2.2, dz * 2.2), n2 = fbm(dx * 4 + 9, dy * 4 + 2, dz * 4);
      const band = Math.exp(-Math.pow((dy - 0.25 - 0.25 * Math.sin(lon * 1.0 + 1)) * 3.0, 2));
      const neb = Math.max(0, n - 0.42) * 3.2 * band;
      r += neb * (60 + 120 * n2); gg += neb * (90 + 40 * n2); b += neb * 255;
      const neb2 = Math.max(0, n2 - 0.55) * 2.5 * (0.4 + band);
      r += neb2 * 140; gg += neb2 * 50; b += neb2 * 200; // purple wisps
      const i = (y * W + x) * 4; d[i] = Math.min(255, r); d[i + 1] = Math.min(255, gg); d[i + 2] = Math.min(255, b); d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // stars
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * W, y = Math.pow(Math.random(), 1.4) * H * 0.56, s = Math.random();
    g.fillStyle = `rgba(${200 + s * 55},${220 + s * 35},255,${0.3 + s * 0.7})`;
    g.fillRect(x, y, s > 0.97 ? 2 : 1, s > 0.97 ? 2 : 1);
  }
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * W, y = Math.random() * H * 0.45;
    const gr = g.createRadialGradient(x, y, 0, x, y, 5); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(120,180,255,0)');
    g.fillStyle = gr; g.fillRect(x - 5, y - 5, 10, 10);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping;
  return t;
}

function jitter(geo, amt) {
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + (Math.random() - .5) * amt, p.getY(i) + (Math.random() - .5) * amt, p.getZ(i) + (Math.random() - .5) * amt);
  geo.computeVertexNormals(); return geo;
}

export function buildWorld(scene, renderer, quality) {
  const W = { update: null, lights: [] };
  const sky = bakeSky(quality.low ? 768 : 1024, quality.low ? 384 : 512);
  scene.background = sky;
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromEquirectangular(sky).texture; pm.dispose();
  scene.environment = env;
  scene.environmentIntensity = 0.45;
  scene.fog = new THREE.FogExp2(0x071a44, 0.0065);

  scene.add(new THREE.HemisphereLight(0x3a6dff, 0x050a18, 0.35));
  const moon = new THREE.DirectionalLight(0x9fc8ff, 0.9); moon.position.set(40, 60, -30); scene.add(moon);

  // ---- ringed planet (top-right of the default view) ----
  const planet = new THREE.Group();
  const pMat = new THREE.MeshStandardMaterial({ map: planetTexture(), emissive: 0x2a0d55, emissiveIntensity: 0.6, roughness: 0.8, fog: false });
  const pl = new THREE.Mesh(new THREE.SphereGeometry(26, 48, 32), pMat); pl.rotation.z = 0.35; planet.add(pl);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(27.5, 48, 32), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ n=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); v=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'varying vec3 n; varying vec3 v; void main(){ float f=pow(1.-abs(dot(n,v)),2.5); gl_FragColor=vec4(vec3(0.7,0.35,1.6)*f*1.6,f); }'
  })); planet.add(atm);
  const ringGeo = new THREE.RingGeometry(34, 58, 96, 1);
  const uv = ringGeo.attributes.uv, pos = ringGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const r = Math.hypot(pos.getX(i), pos.getY(i)); uv.setXY(i, (r - 34) / 24, 0.5); }
  const rings = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, color: new THREE.Color(1.3, 1.1, 1.6) }));
  rings.rotation.x = Math.PI / 2 - 0.32; rings.rotation.y = 0.35; planet.add(rings);
  planet.position.set(110, 62, -230); scene.add(planet);
  const sun = new THREE.PointLight(0xb070ff, 0, 0); planet.add(sun);

  // ---- arena ----
  const tt = tileTextures();
  const floorMat = new THREE.MeshStandardMaterial({ map: tt.map, roughnessMap: tt.rough, roughness: 0.9, metalness: 0.6, envMapIntensity: 1.0 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R + 3, 72), floorMat); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x1b2438, roughness: 0.75, metalness: 0.2 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85, metalness: 0.1 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(ARENA_R + 3, ARENA_R - 2, 5, 72, 1, true), darkStone); base.position.y = -2.5; scene.add(base);
  const under = new THREE.Mesh(jitter(new THREE.ConeGeometry(ARENA_R - 2, 22, 18, 4), 3), darkStone); under.rotation.x = Math.PI; under.position.y = -16; scene.add(under);
  const glowBlue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.4, 3.2) });
  const glowCyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.5, 2.2) });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R + 2.9, 0.08, 6, 128), glowBlue); rim.rotation.x = Math.PI / 2; rim.position.y = 0.05; scene.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(ARENA_R + 2.9, 0.06, 6, 128), glowBlue); rim2.rotation.x = Math.PI / 2; rim2.position.y = -4.6; scene.add(rim2);

  // floor rune circles
  const runeTex = floorRunes();
  const runeMat = new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.1, 0.45, 1.2), fog: false });
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_R * 2 + 2, ARENA_R * 2 + 2), runeMat); runes.rotation.x = -Math.PI / 2; runes.position.y = 0.03; scene.add(runes);
  const runes2 = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), runeMat.clone()); runes2.material.color = new THREE.Color(0.3, 1.0, 2.2); runes2.rotation.x = -Math.PI / 2; runes2.position.y = 0.035; scene.add(runes2);

  // ---- ruins: pillars, arches, temple ----
  const pillarGeo = new THREE.CylinderGeometry(0.75, 0.85, 1, 10);
  const capGeo = new THREE.BoxGeometry(2.1, 0.5, 2.1);
  const bandGeo = new THREE.TorusGeometry(0.82, 0.06, 6, 20);
  function pillar(x, z, h, broken) {
    const g = new THREE.Group();
    const p = new THREE.Mesh(pillarGeo, stoneMat); p.scale.y = h; p.position.y = h / 2; g.add(p);
    const b1 = new THREE.Mesh(capGeo, darkStone); b1.position.y = 0.25; g.add(b1);
    if (!broken) { const c = new THREE.Mesh(capGeo, darkStone); c.position.y = h + 0.25; g.add(c); }
    else { const top = new THREE.Mesh(jitter(new THREE.CylinderGeometry(0.75, 0.75, 0.8, 8), 0.5), stoneMat); top.position.y = h + 0.2; top.rotation.z = 0.3; g.add(top); }
    for (const hy of [h * 0.3, h * 0.72]) { const b = new THREE.Mesh(bandGeo, glowBlue); b.rotation.x = Math.PI / 2; b.position.y = hy; g.add(b); }
    g.position.set(x, 0, z); scene.add(g); return g;
  }
  function arch(ang, r, w, h) {
    const cx = Math.sin(ang) * r, cz = Math.cos(ang) * r;
    const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = ang + Math.PI / 2;
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, h, 1.6), stoneMat); p.position.set(s * w / 2, h / 2, 0); g.add(p);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 1.6), glowCyan); win.position.set(s * w / 2, h * 0.55, 0.81); g.add(win);
      const win2 = win.clone(); win2.position.z = -0.81; win2.rotation.y = Math.PI; g.add(win2); }
    const top = new THREE.Mesh(new THREE.TorusGeometry(w / 2, 0.7, 6, 18, Math.PI), stoneMat); top.position.y = h; g.add(top);
    const glow = new THREE.Mesh(new THREE.TorusGeometry(w / 2 - 0.72, 0.07, 6, 30, Math.PI), glowBlue); glow.position.y = h; g.add(glow);
    const key = new THREE.Mesh(new THREE.OctahedronGeometry(0.45), glowCyan); key.position.y = h + w / 2 + 0.2; key.scale.y = 1.6; g.add(key);
    scene.add(g); return g;
  }
  const PR = ARENA_R + 4.5;
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2 + 0.17;
    if (i % 3 === 1) continue;
    pillar(Math.sin(a) * PR, Math.cos(a) * PR, 6 + Math.random() * 6, Math.random() < 0.4);
  }
  [Math.PI * 0.82, Math.PI * 1.18, Math.PI * 0.5, Math.PI * 1.5, Math.PI * 1.0].forEach((a, i) => arch(a, PR + 2.5 + (i === 4 ? 6 : 0), 7 + (i === 4 ? 3 : 0), 7 + (i === 4 ? 4 : 0)));

  // temple complex on the far side
  function temple(x, z, s, rotY) {
    const g = new THREE.Group(); g.position.set(x, -1, z); g.rotation.y = rotY; g.scale.setScalar(s);
    for (let i = 0; i < 3; i++) { const st = new THREE.Mesh(new THREE.BoxGeometry(18 - i * 2, 1, 10 - i * 1.4), darkStone); st.position.y = i + 0.5; g.add(st); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(12, 9, 6), stoneMat); body.position.y = 7.5; g.add(body);
    for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.55, 9, 8), stoneMat); c.position.set(-6.25 + i * 2.5, 7.5, 3.6); g.add(c); }
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 15, 3, 1), darkStone); roof.rotation.z = Math.PI / 2; roof.rotation.y = 0; roof.scale.set(1, 1, 0.5); roof.position.y = 13; roof.rotation.x = Math.PI / 2; g.add(roof);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 2.2), glowCyan); w.position.set(-4.2 + i * 2.8, 5.5 + r * 3.6, 3.02); g.add(w); }
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.2), glowBlue); door.position.set(0, 5.1, 3.03); g.add(door);
    const spire = new THREE.Mesh(new THREE.OctahedronGeometry(1.2), glowCyan); spire.scale.y = 2.5; spire.position.y = 19; g.add(spire);
    scene.add(g); return g;
  }
  temple(0, -52, 1.25, 0); temple(-40, -40, 0.9, Math.PI / 4); temple(42, -38, 0.9, -Math.PI / 4); temple(-50, 10, 0.8, Math.PI / 2); temple(50, 14, 0.8, -Math.PI / 2);
  // towers with glowing window slits
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.6 + i / 8 * Math.PI * 0.8, r = 62 + Math.random() * 20, h = 18 + Math.random() * 22;
    const t = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, h, 8), darkStone); t.position.set(Math.sin(a) * r, h / 2 - 6, Math.cos(a) * r); scene.add(t);
    for (let k = 0; k < 4; k++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.6), glowCyan); const wa = Math.random() * 6.28; w.position.set(t.position.x + Math.sin(wa) * 2.55, 2 + Math.random() * (h - 10), t.position.z + Math.cos(wa) * 2.55); w.rotation.y = wa; scene.add(w); }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(2.6, 5, 8), darkStone); tip.position.set(t.position.x, h - 6 + 2.5, t.position.z); scene.add(tip);
  }

  // ---- crystals ----
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0x48d8ff, emissive: 0x18a0ff, emissiveIntensity: 1.8, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.92 });
  const crystalGeo = new THREE.OctahedronGeometry(0.5, 0);
  function cluster(x, y, z, s) {
    const g = new THREE.Group(); g.position.set(x, y, z);
    const n = 3 + (Math.random() * 4 | 0);
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(crystalGeo, crystalMat); const h = (1.2 + Math.random() * 2.6) * s;
      c.scale.set(0.5 * s, h, 0.5 * s); c.position.set((Math.random() - .5) * 1.4 * s, h * 0.35, (Math.random() - .5) * 1.4 * s);
      c.rotation.set((Math.random() - .5) * 0.8, Math.random() * 3, (Math.random() - .5) * 0.8); g.add(c);
    }
    scene.add(g); return g;
  }
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2 + 0.4; cluster(Math.sin(a) * (ARENA_R + 2), 0, Math.cos(a) * (ARENA_R + 2), 0.9 + Math.random() * 0.6); }
  const nL = quality.low ? 2 : 4;
  for (let i = 0; i < nL; i++) {
    const a = Math.PI + (i - (nL - 1) / 2) * (2.4 / nL);
    const l = new THREE.PointLight(0x3ab8ff, 12, 18, 2); l.position.set(Math.sin(a) * (ARENA_R + 1), 2.5, Math.cos(a) * (ARENA_R + 1)); scene.add(l);
  }

  // ---- floating islands ----
  const islands = [];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x1a2236, roughness: 0.9, flatShading: true });
  const grassTop = new THREE.MeshStandardMaterial({ color: 0x14304a, roughness: 0.8, flatShading: true, emissive: 0x041a30 });
  for (let i = 0; i < (quality.low ? 9 : 14); i++) {
    const a = Math.PI + (Math.random() - 0.5) * Math.PI * 1.9, r = 40 + Math.random() * 55, s = 1 + Math.random() * 2.4;
    const g = new THREE.Group();
    const rock = new THREE.Mesh(jitter(new THREE.ConeGeometry(3, 6, 7, 3), 0.9), rockMat); rock.rotation.x = Math.PI; rock.position.y = -3; g.add(rock);
    const top = new THREE.Mesh(jitter(new THREE.CylinderGeometry(3.2, 3, 0.8, 7), 0.4), grassTop); g.add(top);
    if (Math.random() < 0.8) { const c = cluster(0, 0, 0, 0.6); scene.remove(c); c.position.set((Math.random() - .5) * 2, 0.3, (Math.random() - .5) * 2); g.add(c); }
    if (Math.random() < 0.35) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 3, 8), stoneMat); p.position.set(1, 1.8, 0.5); g.add(p); }
    g.scale.setScalar(s); g.position.set(Math.sin(a) * r, -4 + Math.random() * 30, Math.cos(a) * r); g.rotation.y = Math.random() * 6;
    g.userData = { by: g.position.y, ph: Math.random() * 6, sp: 0.3 + Math.random() * 0.4 };
    scene.add(g); islands.push(g);
  }

  // ---- the floating 13 seal with the rose ----
  const seal = new THREE.Group();
  const sealMat = new THREE.MeshBasicMaterial({ map: sealTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, color: new THREE.Color(0.35, 1.1, 2.6), fog: false });
  const sealMesh = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), sealMat); seal.add(sealMesh);
  const sealOuter = new THREE.Mesh(new THREE.PlaneGeometry(31, 31), runeMat.clone()); sealOuter.material.color = new THREE.Color(0.15, 0.55, 1.4); sealOuter.material.side = THREE.DoubleSide; seal.add(sealOuter);
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ map: softDot('#1a6cff'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false })); halo.position.z = -0.5; seal.add(halo);
  // rose
  const rose = new THREE.Group();
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xc8102e, emissive: 0x8a0018, emissiveIntensity: 1.3, roughness: 0.45, side: THREE.DoubleSide });
  const petalGeo = new THREE.SphereGeometry(1, 12, 8, 0, Math.PI, 0, Math.PI * 0.6);
  for (let L = 0; L < 5; L++) {
    const n = 4 + L, open = 0.15 + L * 0.28, sz = 0.35 + L * 0.17;
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(petalGeo, petalMat); p.scale.set(sz, sz * 1.15, sz * 0.75);
      const pg = new THREE.Group(); pg.rotation.y = i / n * Math.PI * 2 + L * 0.6; p.rotation.x = -open; p.position.z = 0.05 + L * 0.06; pg.add(p); rose.add(pg);
    }
  }
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x1f9a3a, emissive: 0x0c5a1c, emissiveIntensity: 0.9, roughness: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 3; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), leafMat); lf.scale.set(0.55, 0.08, 1.3); const lg = new THREE.Group(); lg.rotation.y = i / 3 * Math.PI * 2 + 0.5; lf.position.set(0, -0.35, 1.3); lf.rotation.x = 0.25; lg.add(lf); rose.add(lg); }
  rose.rotation.x = Math.PI / 2 - 0.35; rose.position.z = 0.9; rose.scale.setScalar(2.1);
  seal.add(rose);
  const roseLight = new THREE.PointLight(0xff2244, 25, 10, 1.5); roseLight.position.z = 3; seal.add(roseLight);
  seal.position.set(0, 12.5, -36); seal.scale.setScalar(0.85); seal.rotation.x = 0.12; scene.add(seal);
  const sealLight = new THREE.PointLight(0x2a7cff, 25, 40, 1.6); sealLight.position.set(0, 10, -30); scene.add(sealLight);

  // ---- ambient sparks rising ----
  const N = quality.low ? 260 : 600;
  const sg = new THREE.BufferGeometry(), sp = new Float32Array(N * 3), sv = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 40; sp[i * 3] = Math.sin(a) * r; sp[i * 3 + 1] = Math.random() * 25; sp[i * 3 + 2] = Math.cos(a) * r; sv[i] = 0.4 + Math.random() * 1.2; }
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const sparks = new THREE.Points(sg, new THREE.PointsMaterial({ map: softDot('#5fd8ff'), size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.6, 1.4, 2.4) }));
  scene.add(sparks);

  W.seal = seal; W.runes = runes;
  W.update = (dt, t) => {
    sealMesh.rotation.z += dt * 0.05; sealOuter.rotation.z -= dt * 0.03;
    seal.position.y = 12.5 + Math.sin(t * 0.6) * 0.4; rose.rotation.z += dt * 0.15;
    runes.rotation.z += dt * 0.015; runes2.rotation.z -= dt * 0.06;
    sealMat.color.setRGB(0.35, 1.1 + Math.sin(t * 1.3) * 0.15, 2.6 + Math.sin(t * 1.3) * 0.3);
    planet.rotation.y += dt * 0.01;
    for (const g of islands) { g.position.y = g.userData.by + Math.sin(t * g.userData.sp + g.userData.ph) * 0.8; }
    const p = sg.attributes.position.array;
    for (let i = 0; i < N; i++) { p[i * 3 + 1] += sv[i] * dt; p[i * 3] += Math.sin(t + i) * dt * 0.2; if (p[i * 3 + 1] > 25) p[i * 3 + 1] = 0; }
    sg.attributes.position.needsUpdate = true;
  };
  return W;
}
