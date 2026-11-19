import * as THREE from 'three';
import { coatEmissive, heroRing } from './textures.js';

const BLUE = new THREE.Color(0.35, 1.5, 3.2);

function wing(side, mats) {
  // built in the XY plane, x = outward, y = up; then mirrored for the left side
  const g = new THREE.Group();
  const W = new THREE.Vector2(1.5, 1.25);           // wrist
  const tips = [new THREE.Vector2(3.6, 1.9), new THREE.Vector2(3.9, 0.3), new THREE.Vector2(3.3, -1.2), new THREE.Vector2(2.2, -2.1), new THREE.Vector2(0.9, -2.2)];
  const shape = new THREE.Shape(); shape.moveTo(0, 0.15); shape.lineTo(W.x, W.y); shape.lineTo(tips[0].x, tips[0].y);
  const edge = [new THREE.Vector3(0, 0.15, 0), new THREE.Vector3(W.x, W.y, 0), new THREE.Vector3(tips[0].x, tips[0].y, 0)];
  for (let i = 1; i < tips.length; i++) {
    const a = tips[i - 1], b = tips[i];
    const mid = a.clone().add(b).multiplyScalar(0.5), dir = mid.clone().sub(W).multiplyScalar(0.72).add(W); // scallop pulls toward wrist
    shape.quadraticCurveTo(dir.x, dir.y, b.x, b.y);
    for (let k = 1; k <= 4; k++) { const t = k / 4; const p = a.clone().multiplyScalar((1 - t) * (1 - t)).add(dir.clone().multiplyScalar(2 * t * (1 - t))).add(b.clone().multiplyScalar(t * t)); edge.push(new THREE.Vector3(p.x, p.y, 0)); }
  }
  shape.lineTo(0.15, -0.6);
  const mem = new THREE.Mesh(new THREE.ShapeGeometry(shape, 6), mats.membrane); g.add(mem);
  // glowing blue trailing edge
  const curve = new THREE.CatmullRomCurve3(edge);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.02, 4, false), mats.edge));
  // dark spiky bones
  const bone = (a, b, r) => {
    const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r, len, 6), mats.bone);
    m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, 0.02); m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x) - Math.PI / 2; g.add(m);
  };
  bone(new THREE.Vector2(0, 0.1), W, 0.11);
  tips.forEach(t => bone(W, t, 0.06));
  const spikeGeo = new THREE.ConeGeometry(0.07, 0.6, 5);
  const addSpike = (p, ang, s = 1) => { const sp = new THREE.Mesh(spikeGeo, mats.bone); sp.position.set(p.x, p.y, 0.02); sp.rotation.z = ang; sp.scale.setScalar(s); g.add(sp); };
  addSpike(new THREE.Vector2(W.x + 0.1, W.y + 0.3), -0.2, 1.4); addSpike(new THREE.Vector2(0.75, 0.95), 0.3, 1);
  tips.forEach(t => { const d = t.clone().sub(W).normalize(); addSpike(t.clone().add(d.clone().multiplyScalar(0.25)), Math.atan2(d.y, d.x) - Math.PI / 2, 0.9); });
  const claw = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 5), mats.edge); claw.position.set(W.x, W.y + 0.25, 0.04); g.add(claw);
  if (side < 0) g.scale.x = -1;
  return g;
}

export function buildHero(scene) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const em = coatEmissive();
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x0a0c14, roughness: 0.45, metalness: 0.5, emissive: new THREE.Color(0.25, 1.1, 2.4), emissiveMap: em, emissiveIntensity: 0.55, side: THREE.DoubleSide });
  const skirtMat = coatMat.clone(); skirtMat.emissiveMap = coatEmissive(false); skirtMat.emissiveIntensity = 0.35;
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 0.5, metalness: 0.4 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb88a78, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x06070c, roughness: 0.4, metalness: 0.3 });
  const hairBlue = new THREE.MeshStandardMaterial({ color: 0x0a2a6a, emissive: 0x1a6cff, emissiveIntensity: 1.6, roughness: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: BLUE });
  const mats = {
    membrane: new THREE.MeshStandardMaterial({ color: 0x0fb83a, emissive: 0x0a9a2c, emissiveIntensity: 0.5, roughness: 0.55, transparent: true, opacity: 0.94, side: THREE.DoubleSide }),
    edge: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.8, 2.0) }), bone: new THREE.MeshStandardMaterial({ color: 0x050609, roughness: 0.4, metalness: 0.5, envMapIntensity: 0.3 })
  };

  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.13, 0.95, 0);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.9, 8), darkMat); leg.position.y = -0.45; hip.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.3), darkMat); boot.position.set(0, -0.88, 0.05); hip.add(boot);
    const bglow = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.02, 0.31), glow); bglow.position.set(0, -0.82, 0.05); hip.add(bglow);
    body.add(hip); legs.push(hip);
  }
  // long coat (skirt split into flaps that swing)
  const flaps = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group(); f.position.y = 1.3; f.rotation.y = i * Math.PI / 2;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.52, 1.15, 8, 1, true, -Math.PI / 4 + 0.03, Math.PI / 2 - 0.06), skirtMat); m.position.y = -0.57; f.add(m);
    body.add(f); flaps.push(f);
  }
  // fix emblem: back flap is the one that covers -Z (rotation.y = PI)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.62, 16, 1), coatMat); torso.position.y = 1.6; body.add(torso);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 20), glow); belt.rotation.x = Math.PI / 2; belt.position.y = 1.32; body.add(belt);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.28, 12, 1, true, Math.PI * 0.15, Math.PI * 1.7), coatMat); collar.position.y = 2.0; collar.rotation.y = 0; body.add(collar);
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.33, 1.84, 0);
    const pad = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), coatMat); pad.scale.set(1.15, 0.85, 1.1); sh.add(pad);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.42, 8), coatMat); upper.position.y = -0.24; sh.add(upper);
    const elbow = new THREE.Group(); elbow.position.y = -0.45; sh.add(elbow);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.4, 8), coatMat); fore.position.y = -0.2; elbow.add(fore);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.018, 6, 14), glow); cuff.rotation.x = Math.PI / 2; cuff.position.y = -0.38; elbow.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 2.2, 3.5) })); hand.position.y = -0.46; elbow.add(hand);
    body.add(sh); arms.push({ sh, elbow, hand });
  }
  // head
  const head = new THREE.Group(); head.position.y = 2.17; body.add(head);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.15, 8), skinMat); neck.position.y = -0.12; head.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), skinMat); skull.scale.set(0.92, 1.05, 0.98); skull.position.y = 0.05; head.add(skull);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 3, 4) })); eye.position.set(s * 0.055, 0.06, 0.145); eye.scale.set(1.4, 0.7, 0.5); head.add(eye);
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.01), glow); mark.position.set(s * 0.08, -0.02, 0.135); mark.rotation.z = s * 0.3; head.add(mark);
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.17, 4), skinMat); ear.position.set(s * 0.155, 0.06, -0.01); ear.rotation.z = -s * 1.2; ear.rotation.y = s * 0.3; head.add(ear);
    // curved horn: 3 stacked cones
    const horn = new THREE.Group(); horn.position.set(s * 0.09, 0.17, -0.02); horn.rotation.set(-0.5, 0, -s * 0.35); head.add(horn);
    let parent = horn, r = 0.045;
    for (let k = 0; k < 3; k++) { const seg = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, 0.13, 6), hairMat); c.position.y = 0.065; seg.add(c); seg.position.y = k ? 0.13 : 0; seg.rotation.x = k ? -0.45 : 0; parent.add(seg); parent = seg; r *= 0.7; }
    const tip = new THREE.Mesh(new THREE.ConeGeometry(r, 0.12, 6), hairMat); tip.position.y = 0.19; parent.add(tip);
  }
  // spiky hair
  const spike = new THREE.ConeGeometry(0.06, 0.32, 5);
  const dirs = [];
  for (let i = 0; i < 26; i++) {
    const th = (i / 26) * Math.PI * 2, up = 0.25 + (i % 3) * 0.25;
    dirs.push([Math.sin(th) * (1 - up * 0.5), up + 0.25, Math.cos(th) * (1 - up * 0.5) - 0.35]);
  }
  dirs.push([0, 1, -0.3], [0.3, 0.9, 0.2], [-0.3, 0.9, 0.2], [0, 0.6, 0.9], [0.25, 0.4, 0.9], [-0.25, 0.4, 0.9]);
  dirs.forEach((d, i) => {
    const v = new THREE.Vector3(...d).normalize();
    const m = new THREE.Mesh(spike, i % 5 === 0 ? hairBlue : hairMat);
    m.position.copy(v).multiplyScalar(0.14).add(new THREE.Vector3(0, 0.09, 0));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().add(new THREE.Vector3(0, 0.25, -0.35)).normalize());
    m.scale.set(1, 0.8 + (i * 37 % 10) / 15, 1);
    head.add(m);
  });
  // wings
  const wingRoot = new THREE.Group(); wingRoot.position.set(0, 1.8, -0.2); body.add(wingRoot);
  const wings = [];
  for (const s of [-1, 1]) {
    const piv = new THREE.Group(); piv.position.x = s * 0.22; wingRoot.add(piv);
    const w = wing(s, mats); w.scale.multiplyScalar(0.62); if (s < 0) w.scale.x = -0.62; piv.add(w); wings.push({ piv, s });
  }
  // glow ring under feet
  const ringMat = new THREE.MeshBasicMaterial({ map: heroRing(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.3, 1.0, 2.0) });
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; root.add(ring);
  const light = new THREE.PointLight(0x48c8ff, 4, 8, 2); light.position.set(0, 2.8, 0); root.add(light);

  // crackling lightning around the hero
  const bolts = [];
  const boltMat = new THREE.LineBasicMaterial({ color: new THREE.Color(1.2, 2.6, 4), transparent: true });
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
    const l = new THREE.Line(geo, boltMat); l.frustumCulled = false; root.add(l); bolts.push({ l, t: 0 });
  }
  function regen(b) {
    const p = b.l.geometry.attributes.position.array;
    const a0 = Math.random() * 6.28, r0 = 0.5 + Math.random() * 0.6, y0 = 0.3 + Math.random() * 2;
    let x = Math.sin(a0) * r0, y = y0, z = Math.cos(a0) * r0;
    const dx = (Math.random() - .5) * 0.25, dy = (Math.random() - .3) * 0.25, dz = (Math.random() - .5) * 0.25;
    for (let i = 0; i < 10; i++) { p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z; x += dx + (Math.random() - .5) * 0.18; y += dy + (Math.random() - .5) * 0.18; z += dz + (Math.random() - .5) * 0.18; }
    b.l.geometry.attributes.position.needsUpdate = true; b.t = 0.05 + Math.random() * 0.1;
    b.l.visible = Math.random() < 0.6;
  }
  root.position.set(0, 0, 8); root.rotation.y = Math.PI; body.scale.setScalar(1.18);
  scene.add(root);

  let t = 0;
  const H = {
    root, ring, light, wings,
    update(dt, st) {
      t += dt;
      const run = st.moveAmt || 0, ph = t * 11;
      const atk = st.atk; // {p:0..1, side}
      body.position.y = Math.sin(t * 2.2) * 0.03 * (1 - run) + Math.abs(Math.sin(ph)) * 0.08 * run + (st.dash ? 0.25 : 0);
      body.rotation.x = run * 0.22 + (st.dash ? 0.4 : 0);
      legs[0].rotation.x = Math.sin(ph) * 0.8 * run; legs[1].rotation.x = -Math.sin(ph) * 0.8 * run;
      flaps.forEach((f, i) => { const back = i === 2; f.rotation.x = back ? -(run * 0.5 + Math.sin(ph * 0.5 + i) * 0.08 * run + 0.04) : (i === 0 ? Math.sin(ph) * 0.12 * run : 0); f.rotation.z = (i === 1 ? -1 : i === 3 ? 1 : 0) * (Math.sin(t * 2 + i) * 0.04 + run * 0.12); });
      // arms
      for (let i = 0; i < 2; i++) {
        const a = arms[i], s = i ? 1 : -1;
        a.sh.rotation.x = -Math.sin(ph) * 0.7 * run * s + Math.sin(t * 2) * 0.04;
        a.sh.rotation.z = s * (0.12 + Math.sin(t * 2.2) * 0.03);
        a.elbow.rotation.x = -0.3 - run * 0.5;
      }
      if (atk) {
        const p = atk.p, k = Math.sin(Math.min(1, p * 1.3) * Math.PI);
        const a = arms[atk.side > 0 ? 1 : 0], s = atk.side > 0 ? 1 : -1;
        a.sh.rotation.x = -1.4 * k - 0.2; a.sh.rotation.z = s * (0.3 + 1.0 * (1 - p)) ; a.sh.rotation.y = -s * (1.6 * p - 0.8);
        a.elbow.rotation.x = -0.2;
        body.rotation.y = -s * (p - 0.5) * 0.9;
      } else { arms[0].sh.rotation.y = arms[1].sh.rotation.y = 0; body.rotation.y *= 0.8; }
      if (st.cast) { for (const a of arms) { a.sh.rotation.x = -2.6 * st.cast; } }
      // wings: slow powerful flap idle, swept back while running, flared on dash/attack
      const flap = Math.sin(t * (2.2 + run * 2.5));
      const flare = st.dash ? 1 : (atk ? 0.4 : 0);
      for (const w of wings) {
        w.piv.rotation.y = w.s * (0.6 + run * 0.45 - flare * 0.3 + flap * 0.16);
        w.piv.rotation.z = w.s * (0.05 + flap * 0.18 + flare * 0.15);
        w.piv.rotation.x = 0.15 + run * 0.2;
      }
      ring.rotation.z += dt * 0.6;
      light.intensity = 4 + Math.sin(t * 13) * 1 + (atk ? 5 : 0);
      for (const b of bolts) { b.t -= dt; if (b.t <= 0) regen(b); }
    }
  };
  return H;
}
