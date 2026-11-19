import * as THREE from 'three';
import { coatEmissive, heroRing, coatCloth, coatBackTexture } from './textures.js';

const PAL = {
  hero: { glow: [0.35, 1.5, 3.2], soft: [0.25, 1.1, 2.4], eye: [1, 3, 4], mem: 0x0fb83a, memE: 0x0a9a2c, memEdge: 0x7dff9a, hair: 0x06070c, streak: 0x1a6cff, skin: 0xb88a78, sword: [0.6, 2.2, 4.0], coat: 0x0a0c14, light: 0x48c8ff },
  shade: { glow: [3.0, 0.35, 0.25], soft: [2.2, 0.25, 0.2], eye: [4, 0.6, 0.4], mem: 0x6a0614, memE: 0x50000c, memEdge: 0xff5a5a, hair: 0x0c0204, streak: 0xff2a1a, skin: 0x5a4a52, sword: [4, 0.6, 0.4], coat: 0x100406, light: 0xff4a3a },
};

function wing(side, mats, P) {
  const g = new THREE.Group();
  const W = new THREE.Vector2(1.55, 1.35);
  const tips = [new THREE.Vector2(3.9, 2.3), new THREE.Vector2(4.3, 0.6), new THREE.Vector2(3.8, -1.1), new THREE.Vector2(2.7, -2.3), new THREE.Vector2(1.2, -2.6)];
  const shape = new THREE.Shape(); shape.moveTo(0, 0.15); shape.lineTo(W.x, W.y); shape.lineTo(tips[0].x, tips[0].y);
  const edge = [new THREE.Vector3(tips[0].x, tips[0].y, 0)];
  for (let i = 1; i < tips.length; i++) {
    const a = tips[i - 1], b = tips[i];
    const mid = a.clone().add(b).multiplyScalar(0.5), dir = mid.clone().sub(W).multiplyScalar(0.74).add(W);
    shape.quadraticCurveTo(dir.x, dir.y, b.x, b.y);
    for (let k = 1; k <= 5; k++) { const t = k / 5; const p = a.clone().multiplyScalar((1 - t) * (1 - t)).add(dir.clone().multiplyScalar(2 * t * (1 - t))).add(b.clone().multiplyScalar(t * t)); edge.push(new THREE.Vector3(p.x, p.y, 0)); }
  }
  shape.lineTo(0.2, -0.7);
  const geo = new THREE.ShapeGeometry(shape, 8);
  // vertex colours: deep green at the arm, bright toward the scalloped edge
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), cA = new THREE.Color(P.mem).multiplyScalar(0.2), cB = new THREE.Color(P.mem).multiplyScalar(1.05), cC = new THREE.Color(P.memEdge);
  for (let i = 0; i < pos.count; i++) {
    const d = Math.hypot(pos.getX(i) - W.x, pos.getY(i) - W.y) / 3.2;
    const c = d < 0.6 ? cA.clone().lerp(cB, d / 0.6) : cB.clone().lerp(cC, Math.min(1, (d - 0.6) / 0.5) * 0.9);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.add(new THREE.Mesh(geo, mats.membrane));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(edge), 110, 0.04, 4, false), mats.edge));
  const bone = (a, b, r, mat = mats.bone, z = 0.025) => {
    const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.4, r, len, 6), mat);
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, z); m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2; g.add(m);
  };
  bone(new THREE.Vector2(0, 0.1), W, 0.12);
  tips.forEach(t => bone(W, t, 0.065));
  // veins: glowing blue energy channels running from the shoulder joint to every
  // tip, riding proud of the membrane (both faces) so they read as light, not struts
  tips.forEach(t => { bone(W, t, 0.034, mats.vein, 0.05); bone(W, t, 0.034, mats.vein, -0.05); });
  tips.forEach((t, i) => { if (i) { const mid = tips[i - 1].clone().add(t).multiplyScalar(0.5).sub(W).multiplyScalar(0.7).add(W); bone(W, mid, 0.02, mats.vein, 0.05); } });
  const spikeGeo = new THREE.ConeGeometry(0.09, 0.78, 5);
  const addSpike = (p, ang, s = 1, mat = mats.bone) => { const sp = new THREE.Mesh(spikeGeo, mat); sp.position.set(p.x, p.y, 0.03); sp.rotation.z = ang; sp.scale.setScalar(s); g.add(sp); };
  // the leading edge bristles with glowing storm-crystals, as in the concept art
  addSpike(new THREE.Vector2(W.x + 0.1, W.y + 0.35), -0.25, 1.9, mats.edge); addSpike(new THREE.Vector2(0.8, 1.0), 0.35, 1.3, mats.edge); addSpike(new THREE.Vector2(1.15, 1.2), 0.1, 1.1, mats.edge);
  addSpike(new THREE.Vector2(0.42, 0.58), 0.55, 0.8, mats.edge); addSpike(new THREE.Vector2(2.6, 1.85), -0.1, 0.9, mats.edge);
  // a crystal knuckle burning at the wing joint
  const knuckle = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mats.edge); knuckle.position.set(W.x, W.y, 0.04); knuckle.scale.set(1, 1.7, 1); g.add(knuckle);
  // glowing hooks at every wingtip
  tips.forEach(t => { const d = t.clone().sub(W).normalize(); addSpike(t.clone().add(d.clone().multiplyScalar(0.28)), Math.atan2(d.y, d.x) - Math.PI / 2, 1.15, mats.edge); });
  addSpike(new THREE.Vector2(W.x, W.y + 0.25), 0, 0.9, mats.edge);
  if (side < 0) g.scale.x = -1;
  return g;
}

export function buildHero(scene, opts = {}) {
  const P = PAL[opts.palette || 'hero'];
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const GL = new THREE.Color(...P.glow);
  const em = coatEmissive();
  const cloth = coatCloth();
  const coatMat = new THREE.MeshStandardMaterial({ color: P.coat, roughness: 0.9, roughnessMap: cloth, metalness: 0.3, emissive: new THREE.Color(...P.soft), emissiveMap: em, emissiveIntensity: 0.6, side: THREE.DoubleSide });
  const skirtMat = coatMat.clone(); skirtMat.emissiveMap = coatEmissive(false); skirtMat.emissiveIntensity = 0.38;
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 0.5, metalness: 0.45 });
  const leatherMat = new THREE.MeshStandardMaterial({ color: 0x14151c, roughness: 0.35, metalness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: P.hair, roughness: 0.35, metalness: 0.35 });
  const hairBlue = new THREE.MeshStandardMaterial({ color: 0x0a1a3a, emissive: P.streak, emissiveIntensity: 1.4, roughness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: GL });
  const mats = {
    membrane: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, emissive: P.memE, emissiveIntensity: 0.45, roughness: 0.45, transparent: true, opacity: 0.94, side: THREE.DoubleSide }),
    edge: new THREE.MeshBasicMaterial({ color: new THREE.Color(...P.soft).multiplyScalar(1.0) }),
    bone: new THREE.MeshStandardMaterial({ color: 0x050609, roughness: 0.4, metalness: 0.5, envMapIntensity: 0.3 }),
    vein: new THREE.MeshBasicMaterial({ color: new THREE.Color(...P.soft).multiplyScalar(0.8), transparent: true, opacity: 0.95 }),
  };
  const M = (geo, mat, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  // ---- legs (hip -> knee) ----
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.15, 1.12, 0);
    M(new THREE.CylinderGeometry(0.1, 0.085, 0.55, 8), darkMat, hip, 0, -0.27, 0);
    const knee = new THREE.Group(); knee.position.y = -0.55; hip.add(knee);
    M(new THREE.CylinderGeometry(0.085, 0.075, 0.5, 8), darkMat, knee, 0, -0.25, 0);
    const boot = M(new THREE.BoxGeometry(0.17, 0.3, 0.2), leatherMat, knee, 0, -0.42, 0.02);
    M(new THREE.BoxGeometry(0.16, 0.1, 0.32), leatherMat, knee, 0, -0.52, 0.07);
    M(new THREE.BoxGeometry(0.18, 0.025, 0.21), glow, knee, 0, -0.29, 0.02);
    body.add(hip); legs.push({ hip, knee });
  }
  // ---- torso ----
  const torso = new THREE.Group(); torso.position.y = 1.2; body.add(torso);
  torso.scale.set(1.06, 1.02, 0.95); // broader shoulders, shallower chest: an anime silhouette
  const chestPts = [[0.22, 0], [0.26, 0.12], [0.29, 0.35], [0.31, 0.55], [0.24, 0.72], [0.12, 0.78]].map(p => new THREE.Vector2(...p));
  M(new THREE.LatheGeometry(chestPts, 16), coatMat, torso);
  // the coat's back panel: black cloth bearing the glowing "13" sigil, worn
  // proud of the torso so it reads from behind in any light (mantle covers its top)
  const backTex = coatBackTexture();
  const backMat = new THREE.MeshStandardMaterial({ map: backTex, emissive: new THREE.Color(...P.soft), emissiveMap: backTex, emissiveIntensity: 1.7, roughness: 0.85, roughnessMap: cloth, metalness: 0.2, side: THREE.DoubleSide });
  M(new THREE.CylinderGeometry(0.335, 0.30, 0.62, 12, 1, true, Math.PI - 0.75, 1.5), backMat, torso, 0, 0.30, 0);
  // mantle over shoulders
  const mantle = M(new THREE.CylinderGeometry(0.3, 0.42, 0.28, 16, 1, true, 0, Math.PI * 2), coatMat, torso, 0, 0.62, -0.01); mantle.scale.z = 0.8;
  M(new THREE.TorusGeometry(0.42, 0.018, 6, 24), glow, torso, 0, 0.48, 0).rotation.x = Math.PI / 2;
  // high collar
  const collar = M(new THREE.CylinderGeometry(0.17, 0.22, 0.3, 14, 1, true, Math.PI * 0.2, Math.PI * 1.6), coatMat, torso, 0, 0.88, -0.02);
  M(new THREE.TorusGeometry(0.17, 0.012, 6, 18, Math.PI * 1.6), glow, torso, 0, 1.03, -0.02).rotation.set(Math.PI / 2, 0, Math.PI * 0.7);
  // lapels + chest glow seams
  for (const s of [-1, 1]) {
    const lap = M(new THREE.BoxGeometry(0.1, 0.55, 0.03), leatherMat, torso, s * 0.09, 0.42, 0.27); lap.rotation.z = s * 0.25; lap.rotation.x = -0.1;
    M(new THREE.BoxGeometry(0.012, 0.55, 0.035), glow, torso, s * 0.14, 0.42, 0.275).rotation.z = s * 0.25;
  }
  // belt + 13 buckle
  M(new THREE.TorusGeometry(0.235, 0.035, 6, 20), leatherMat, torso, 0, 0.06, 0).rotation.x = Math.PI / 2;
  const buckle = M(new THREE.OctahedronGeometry(0.06), glow, torso, 0, 0.06, 0.24); buckle.scale.set(1, 1.3, 0.4);
  // coat tails: 6 flaps hanging from the waist
  const flaps = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2;
    if (i === 0) continue; // open in front
    const f = new THREE.Group(); f.position.y = 1.25; f.rotation.y = a;
    const len = i === 3 ? 1.25 : (i === 2 || i === 4 ? 1.15 : 1.0);
    M(new THREE.CylinderGeometry(0.25, 0.48, len, 6, 1, true, -Math.PI / 6 - 0.02, Math.PI / 3 + 0.04), skirtMat, f, 0, -len / 2, 0);
    // the long centre tail of the coat, hanging over the back flap like the art
    if (i === 3) M(new THREE.PlaneGeometry(0.44, len * 0.98, 1, 4), skirtMat, f, 0, -len * 0.49, 0.5);
    // hem glow
    const hem = M(new THREE.TorusGeometry(0.48, 0.012, 4, 8, Math.PI / 3), glow, f, 0, -len + 0.01, 0); hem.rotation.set(Math.PI / 2, 0, Math.PI / 2 - Math.PI / 6);
    body.add(f); flaps.push({ f, i, v: 0, a: 0 });
  }
  // ---- arms ----
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.36, 0.62, 0); torso.add(sh);
    const pad = M(new THREE.SphereGeometry(0.15, 12, 8), coatMat, sh); pad.scale.set(1.2, 0.8, 1.15);
    M(new THREE.ConeGeometry(0.035, 0.22, 5), mats.bone, sh, s * 0.12, 0.08, 0).rotation.z = -s * 1.0;
    M(new THREE.CylinderGeometry(0.08, 0.075, 0.42, 8), coatMat, sh, 0, -0.24, 0);
    const el = new THREE.Group(); el.position.y = -0.45; sh.add(el);
    M(new THREE.CylinderGeometry(0.075, 0.09, 0.38, 8), coatMat, el, 0, -0.19, 0);
    M(new THREE.TorusGeometry(0.09, 0.016, 6, 14), glow, el, 0, -0.36, 0).rotation.x = Math.PI / 2;
    const hand = new THREE.Group(); hand.position.y = -0.44; el.add(hand);
    M(new THREE.BoxGeometry(0.1, 0.12, 0.12), leatherMat, hand);
    M(new THREE.BoxGeometry(0.105, 0.02, 0.05), glow, hand, 0, -0.03, 0.05);
    arms.push({ sh, el, hand, s });
  }
  // spectral sword in the right hand
  const sword = new THREE.Group(); arms[1].hand.add(sword); sword.position.set(0, -0.04, 0); sword.rotation.x = Math.PI / 2;
  M(new THREE.CylinderGeometry(0.025, 0.025, 0.22, 6), leatherMat, sword, 0, 0, 0);
  M(new THREE.BoxGeometry(0.34, 0.04, 0.06), mats.bone, sword, 0, 0.12, 0);
  const bladeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...P.sword), transparent: true, opacity: 1 });
  const blade = M(new THREE.CylinderGeometry(0.012, 0.06, 1.35, 4), bladeMat, sword, 0, 0.82, 0); blade.scale.z = 0.35;
  const sheathMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...P.sword).multiplyScalar(0.25), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const sheath = M(new THREE.CylinderGeometry(0.03, 0.12, 1.45, 4), sheathMat, sword, 0, 0.82, 0); sheath.scale.z = 0.5;
  // ---- head ----
  const head = new THREE.Group(); head.position.y = 0.98; torso.add(head);
  M(new THREE.CylinderGeometry(0.065, 0.075, 0.16, 8), skinMat, head, 0, -0.1, 0);
  const skull = M(new THREE.SphereGeometry(0.16, 18, 14), skinMat, head, 0, 0.06, 0); skull.scale.set(0.9, 1.04, 0.98);
  const jaw = M(new THREE.SphereGeometry(0.12, 12, 8), skinMat, head, 0, -0.02, 0.03); jaw.scale.set(0.85, 0.75, 0.95);
  M(new THREE.ConeGeometry(0.018, 0.05, 4), skinMat, head, 0, 0.03, 0.155).rotation.x = Math.PI / 2;
  M(new THREE.BoxGeometry(0.05, 0.008, 0.01), new THREE.MeshBasicMaterial({ color: 0x2a1010 }), head, 0, -0.035, 0.135);
  const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(...P.eye) });
  for (const s of [-1, 1]) {
    const eye = M(new THREE.SphereGeometry(0.026, 8, 6), eyeMat, head, s * 0.055, 0.07, 0.14); eye.scale.set(1.5, 0.65, 0.5); eye.rotation.z = s * 0.15;
    M(new THREE.BoxGeometry(0.07, 0.014, 0.014), hairMat, head, s * 0.058, 0.11, 0.142).rotation.z = -s * 0.28;
    M(new THREE.BoxGeometry(0.01, 0.07, 0.01), glow, head, s * 0.085, 0.0, 0.13).rotation.z = s * 0.35;
    M(new THREE.BoxGeometry(0.008, 0.04, 0.01), glow, head, s * 0.065, -0.01, 0.138).rotation.z = s * 0.2;
    // beast ears: tall, dark-furred, tipped and lined with the storm's glow
    const earG = new THREE.Group(); earG.position.set(s * 0.105, 0.21, -0.01); earG.rotation.z = -s * 0.30; earG.rotation.x = -0.07; head.add(earG);
    M(new THREE.ConeGeometry(0.058, 0.32, 5), hairMat, earG, 0, 0.05, 0);
    M(new THREE.ConeGeometry(0.030, 0.20, 4), glow, earG, 0, 0.01, 0.032);
    M(new THREE.SphereGeometry(0.016, 6, 5), glow, earG, 0, 0.22, 0);
    // curved ridged horn
    const horn = new THREE.Group(); horn.position.set(s * 0.085, 0.18, 0.0); horn.rotation.set(-0.35, 0, -s * 0.45); head.add(horn);
    let parent = horn, r = 0.05;
    for (let k = 0; k < 5; k++) {
      const seg = new THREE.Group(); M(new THREE.CylinderGeometry(r * 0.78, r, 0.1, 7), hairMat, seg, 0, 0.05, 0);
      M(new THREE.TorusGeometry(r * 0.95, r * 0.15, 4, 10), mats.bone, seg, 0, 0.01, 0).rotation.x = Math.PI / 2;
      seg.position.y = k ? 0.1 : 0; seg.rotation.x = k ? -0.38 : 0; seg.rotation.z = k ? -s * 0.08 : 0; parent.add(seg); parent = seg; r *= 0.78;
    }
    M(new THREE.ConeGeometry(r, 0.14, 6), hairMat, parent, 0, 0.17, 0);
  }
  M(new THREE.BoxGeometry(0.012, 0.05, 0.01), glow, head, 0, 0.15, 0.145);
  // spiky hair: cap, crown spikes, back spikes, bangs
  const cap = M(new THREE.SphereGeometry(0.172, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), hairMat, head, 0, 0.075, -0.01); cap.scale.set(0.95, 1.05, 1.02);
  const spike = new THREE.ConeGeometry(0.055, 0.34, 5);
  const add = (dir, len, mat, off = 0.13) => {
    const v = new THREE.Vector3(...dir).normalize();
    const m = new THREE.Mesh(spike, mat); m.position.copy(v).multiplyScalar(off).add(new THREE.Vector3(0, 0.1, -0.01));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); m.scale.set(1, len, 1); head.add(m);
  };
  for (let i = 0; i < 22; i++) { const th = i / 22 * Math.PI * 2, up = 0.35 + (i % 3) * 0.22; add([Math.sin(th) * 0.9, up + 0.2, Math.cos(th) * 0.9 - 0.45], 0.9 + (i * 37 % 10) / 14, i % 6 === 0 ? hairBlue : hairMat); }
  for (let i = 0; i < 9; i++) { const th = (i / 8 - 0.5) * 2.2; add([Math.sin(th), 0.15 - Math.abs(th) * 0.05, -1], 1.2 + (i % 2) * 0.3, i % 4 === 1 ? hairBlue : hairMat); }
  [[0, 1, 0.1], [0.35, 1, -0.1], [-0.35, 1, -0.1], [0.15, 1.1, -0.4], [-0.15, 1.1, -0.4]].forEach((d, i) => add(d, 1.25, i === 1 ? hairBlue : hairMat));
  for (let i = 0; i < 6; i++) { const x = (i / 5 - 0.5) * 0.24; const m = new THREE.Mesh(spike, i === 2 ? hairBlue : hairMat); m.position.set(x, 0.16, 0.12); m.rotation.set(Math.PI * 0.82, 0, -x * 2.5); m.scale.set(0.8, 0.6 + (i % 2) * 0.2, 0.8); head.add(m); }
  // ---- wings ----
  const wingRoot = new THREE.Group(); wingRoot.position.set(0, 0.55, -0.22); torso.add(wingRoot);
  const wings = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.x = s * 0.12; wingRoot.add(piv);
    const w = wing(s, mats, P); w.scale.set(s * 0.78, 0.78, 0.78); piv.add(w); wings.push({ piv, s, m: w, k: 0.78 });
  }
  // ---- ground ring + light + crackling lightning ----
  const ringMat = new THREE.MeshBasicMaterial({ map: heroRing(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(...P.soft).multiplyScalar(0.8) });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; root.add(ring);
  const light = opts.noLight ? null : new THREE.PointLight(P.light, 4, 8, 2); if (light) { light.position.set(0, 2.8, 0); root.add(light); }
  const bolts = [];
  const boltMat = new THREE.LineBasicMaterial({ color: new THREE.Color(...P.glow).multiplyScalar(1.1), transparent: true });
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(30), 3));
    const l = new THREE.Line(geo, boltMat); l.frustumCulled = false; root.add(l); bolts.push({ l, t: 0 });
  }
  function regen(b) {
    const p = b.l.geometry.attributes.position.array;
    const a0 = Math.random() * 6.28, r0 = 0.5 + Math.random() * 0.6, y0 = 0.3 + Math.random() * 2.2;
    let x = Math.sin(a0) * r0, y = y0, z = Math.cos(a0) * r0;
    const dx = (Math.random() - .5) * 0.25, dy = (Math.random() - .3) * 0.25, dz = (Math.random() - .5) * 0.25;
    for (let i = 0; i < 10; i++) { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; x += dx + (Math.random() - .5) * 0.18; y += dy + (Math.random() - .5) * 0.18; z += dz + (Math.random() - .5) * 0.18; }
    b.l.geometry.attributes.position.needsUpdate = true; b.t = 0.05 + Math.random() * 0.1; b.l.visible = Math.random() < 0.55;
  }
  scene.add(root);

  // ---- animation ----
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  // attack keyframes [windup, strike] for the right arm: sh x,y,z, el x, torso y
  const ATK = [
    { a: [-2.5, 0.2, 0.9, -1.2, 0.6], b: [-0.6, -0.9, -0.6, -0.15, -0.7] },
    { a: [-1.4, -1.2, -0.9, -0.3, -0.8], b: [-1.5, 0.9, 1.3, -0.1, 0.8] },
    { a: [-1.6, 0, 1.45, 0, 0], b: [-1.6, 0, 1.45, 0, 0] },
  ];
  let t = 0, swordA = 0, flyPh = 0;
  const H = {
    root, ring, light, wings, body, torso, head, sword, P,
    update(dt, st) {
      t += dt;
      const run = st.moveAmt || 0, ph = t * 11;
      // reset base pose
      body.position.set(0, Math.sin(t * 2.2) * 0.025 * (1 - run) + Math.abs(Math.sin(ph)) * 0.08 * run, 0);
      body.rotation.set(run * 0.18, 0, 0);
      torso.rotation.set(0, Math.sin(ph) * 0.12 * run, 0);
      head.rotation.set(-run * 0.12, 0, 0);
      for (let i = 0; i < 2; i++) {
        const L = legs[i], s = i ? -1 : 1;
        L.hip.rotation.set(Math.sin(ph) * 0.85 * run * s, 0, 0);
        L.knee.rotation.x = Math.max(0, -Math.sin(ph + (i ? Math.PI : 0) - 0.6)) * 1.1 * run;
      }
      for (const a of arms) {
        a.sh.rotation.set(-Math.sin(ph) * 0.6 * run * a.s + Math.sin(t * 2) * 0.04, 0, a.s * (0.12 + Math.sin(t * 2.2) * 0.03));
        a.el.rotation.x = -0.25 - run * 0.6;
      }
      let flare = 0, wingFold = 0, swordWant = st.combat ? 1 : 0;
      if (st.atkIdx >= 0) {
        swordWant = 1;
        const K = ATK[st.atkIdx], p = st.atkP, R = arms[1];
        let v;
        if (p < 0.35) v = K.a.map((x, j) => x * ease(p / 0.35));
        else { const k = ease(Math.min(1, (p - 0.35) / 0.3)); v = K.a.map((x, j) => lerp(x, K.b[j], k)); }
        R.sh.rotation.set(v[0], v[1], v[2]); R.el.rotation.x = v[3]; torso.rotation.y = v[4];
        arms[0].sh.rotation.set(-0.5, 0, -0.5); arms[0].el.rotation.x = -1.0;
        body.rotation.x = 0.12;
        if (st.atkIdx === 2) { const k = Math.min(1, Math.max(0, (p - 0.2) / 0.6)); body.rotation.y = -ease(k) * Math.PI * 2; body.position.y += Math.sin(Math.min(1, p) * Math.PI) * 0.5; flare = 0.6; }
        else flare = 0.25;
        legs[0].hip.rotation.x = -0.35; legs[1].hip.rotation.x = 0.3; legs[1].knee.rotation.x = 0.3;
      } else body.rotation.y = 0;
      if (st.cast > 0) {
        const c = st.cast;
        for (const a of arms) { a.sh.rotation.set(-2.7 * c, 0, a.s * 0.35 * c); a.el.rotation.x = -0.2; }
        head.rotation.x = -0.3 * c; flare = Math.max(flare, c);
      }
      if (st.dash) {
        body.rotation.x = 0.55; body.position.y += 0.15;
        for (const a of arms) { a.sh.rotation.set(0.9, 0, a.s * 0.4); a.el.rotation.x = -0.3; }
        legs[0].hip.rotation.x = 0.6; legs[1].hip.rotation.x = 0.9; legs[0].knee.rotation.x = 0.9; legs[1].knee.rotation.x = 1.2;
        wingFold = 1;
      }
      if (st.hitT > 0) { const k = st.hitT / 0.3; body.rotation.x -= 0.45 * k; head.rotation.x -= 0.4 * k; for (const a of arms) a.sh.rotation.z += a.s * 0.5 * k; }
      if (st.victory) {
        const R = arms[1]; R.sh.rotation.set(-2.9, 0, 0.25); R.el.rotation.x = -0.1; arms[0].sh.rotation.set(-0.3, 0, -0.6);
        head.rotation.x = -0.25; flare = -0.35; swordWant = 1;
      }
      let dead = 0;
      if (st.deadT >= 0) {
        dead = Math.min(1, st.deadT / 0.6); const d2 = Math.min(1, Math.max(0, (st.deadT - 0.7) / 0.6));
        legs.forEach(L => { L.hip.rotation.x = -1.4 * dead; L.knee.rotation.x = 2.2 * dead; });
        body.position.y = -0.55 * dead; body.rotation.x = 0.5 * dead + 1.0 * d2; body.rotation.z = 0.5 * d2;
        for (const a of arms) { a.sh.rotation.set(0.2, 0, a.s * 0.25); a.el.rotation.x = -0.1; }
        head.rotation.x = 0.6 * dead; swordWant = 0;
      }
      // ---- flight pose: body pitches into the wind, legs trail, coat streams ----
      const fly = st.fly || 0, glide = st.glide || 0;
      if (fly > 0.01 && st.atkIdx < 0 && !st.dash && !dead) {
        body.rotation.x += fly * (0.16 + run * 0.4);
        legs[0].hip.rotation.x += fly * 0.55; legs[1].hip.rotation.x += fly * 0.55;
        legs[0].knee.rotation.x += fly * 0.4; legs[1].knee.rotation.x += fly * 0.4;
        head.rotation.x -= fly * 0.18;
      }
      // coat tail spring physics (in flight the tails stream hard behind him)
      for (const fl of flaps) {
        const back = fl.i === 3 ? 1 : (fl.i === 2 || fl.i === 4) ? 0.7 : 0.3;
        const target = -(run * 0.55 * back + (st.dash ? 0.9 * back : 0) + fly * 1.15 * back) - Math.sin(t * 1.7 + fl.i) * 0.03 - fly * Math.sin(t * 9 + fl.i * 1.7) * 0.06 * back + (st.atkIdx === 2 ? -0.8 : 0) + (dead ? 0.3 : 0);
        fl.v += ((target - fl.a) * 60 - fl.v * 9) * dt; fl.a += fl.v * dt; fl.f.rotation.x = fl.a;
      }
      // wings: on the ground in combat they TUCK — swept back, folded behind the
      // shoulders and shrunk — so they never block the view ahead. Their full
      // concept-art span belongs to flight, idle and menus: there they spread
      // to full size with a complete flap cycle, locking into a glide at speed.
      if (fly > 0.02) flyPh += dt * (5.4 + (st.climb ? 2.4 : 0)) * (1 - glide * 0.55);
      const flap = Math.sin(t * (2.0 + run * 2.6)), flapF = Math.sin(flyPh);
      const tuck = (st.combat && !st.showcase) ? 1 : 0;
      for (const w of wings) {
        const kWant = st.showcase ? 1.04 : (0.72 - tuck * 0.1) + fly * 0.3;
        w.k += (kWant - w.k) * Math.min(1, dt * 5);
        w.m.scale.set(w.s * w.k, w.k, w.k);
        const yBase = (st.showcase ? 0.38 : 0.92) + run * 0.3 + wingFold * 0.6 + tuck * 0.5 * (1 - fly) - flare * 0.45 + flap * 0.14;
        const yFly = 0.34 + glide * 0.3 + flapF * 0.1;
        w.piv.rotation.y = w.s * (yBase * (1 - fly) + yFly * fly) + (dead ? w.s * 0.8 : 0);
        const zAmp = 0.17 * (1 - fly) + fly * 0.6 * (1 - glide * 0.8);
        w.piv.rotation.z = w.s * (0.02 + flap * 0.17 * (1 - fly) + flapF * zAmp + flare * 0.2 + fly * 0.08) - (dead ? w.s * 0.5 : 0);
        w.piv.rotation.x = 0.12 + run * 0.2 + wingFold * 0.25 + tuck * 0.3 * (1 - fly) + fly * (0.22 + glide * 0.35);
      }
      // sword fade
      swordA += ((swordWant ? 1 : 0) - swordA) * Math.min(1, dt * (swordWant ? 14 : 2.5));
      sword.visible = swordA > 0.02; sword.scale.set(1, Math.max(0.01, swordA), 1); bladeMat.opacity = swordA;
      ring.rotation.z += dt * 0.6; ring.visible = st.deadT < 0 && fly < 0.4;
      if (light) light.intensity = 4 + Math.sin(t * 13) * 1 + (st.atkIdx >= 0 ? 5 : 0) + fly * 2;
      for (const b of bolts) { b.t -= dt; if (b.t <= 0) regen(b); if (st.deadT >= 0) b.l.visible = false; }
    }
  };
  return H;
}
