import * as THREE from 'three';
import { ENEMY_INFO } from './data.js';
import { buildHero } from './hero.js';

let G = null;
function shared() {
  if (G) return G;
  const rim = (mat, c, p) => { mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    totalEmissiveRadiance += vec3(${c}) * pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), ${p});`); }; return mat; };
  G = {
    armor: rim(new THREE.MeshStandardMaterial({ color: 0x263252, metalness: 0.8, roughness: 0.28, envMapIntensity: 2.6, emissive: 0x0c1226 }), '0.75, 0.1, 0.14', '4.0'),
    armor2: rim(new THREE.MeshStandardMaterial({ color: 0x141a2c, metalness: 0.75, roughness: 0.38, envMapIntensity: 2 }), '0.45, 0.06, 0.1', '4.0'),
    gold: rim(new THREE.MeshStandardMaterial({ color: 0x6b5327, metalness: 0.9, roughness: 0.3, envMapIntensity: 2.2 }), '0.6, 0.2, 0.05', '3.0'),
    trim: new THREE.MeshStandardMaterial({ color: 0x3a1418, metalness: 0.8, roughness: 0.3, emissive: 0x500808, emissiveIntensity: 1.5 }),
    red: new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.5, 0.3) }),
    redSoft: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.15, 0.1), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
    robe: rim(new THREE.MeshStandardMaterial({ color: 0x0c0a12, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }), '0.55, 0.12, 0.3', '3.0'),
    fur: rim(new THREE.MeshStandardMaterial({ color: 0x131022, roughness: 0.8, metalness: 0.1, flatShading: true }), '0.8, 0.12, 0.1', '3.0'),
    bone: new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.6 }),
    flash: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.45, 0.9) }),
    frost: new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x2a8cff, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.85 }),
    seraphWing: new THREE.MeshStandardMaterial({ color: 0x2a0410, emissive: 0x6a0010, emissiveIntensity: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.9, roughness: 0.5 }),
    box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 12, 8), cone: new THREE.ConeGeometry(1, 1, 6), cyl: new THREE.CylinderGeometry(1, 1, 1, 8), oct: new THREE.OctahedronGeometry(1),
    hpBg: new THREE.SpriteMaterial({ color: 0x050000, depthTest: false, transparent: true, opacity: 0.8, fog: false, toneMapped: false }),
    hpFill: new THREE.SpriteMaterial({ color: new THREE.Color(1.6, 0.12, 0.08), depthTest: false, fog: false, toneMapped: false }),
    disk: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.1, 0.05), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  return G;
}
function part(geo, mat, sx, sy, sz, x, y, z, parent, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m; }
function grp(parent, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// ---------------- humanoid knight family ----------------
function buildKnight(kind) {
  const g = shared();
  const root = new THREE.Group(), body = grp(root);
  const caster = kind === 'caster', shield = kind === 'shield';
  const wide = shield ? 1.25 : 1;
  const legs = [];
  if (!caster) {
    for (const s of [-1, 1]) {
      const hip = grp(body, s * 0.17 * wide, 0.95, 0);
      part(g.box, g.armor, 0.2 * wide, 0.5, 0.24, 0, -0.25, 0, hip);
      const knee = grp(hip, 0, -0.5, 0);
      part(g.box, g.armor2, 0.19 * wide, 0.45, 0.22, 0, -0.2, 0, knee);
      part(g.box, g.armor, 0.24 * wide, 0.14, 0.38, 0, -0.42, 0.05, knee);
      part(g.sph, g.armor, 0.12, 0.1, 0.12, 0, 0, 0.1, knee);
      legs.push({ hip, knee });
    }
    part(g.box, g.armor2, 0.62 * wide, 0.32, 0.36, 0, 1.0, 0, body);
    // tabard
    part(g.box, g.trim, 0.3, 0.55, 0.02, 0, 0.85, 0.2, body);
  } else {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.65, 1.4, 12, 1, true), g.robe); skirt.position.y = 0.72; body.add(skirt);
    part(g.cyl, g.red, 0.66, 0.015, 0.66, 0, 0.05, 0, body);
  }
  const chest = grp(body, 0, 1.5, 0);
  part(g.box, g.armor, 0.7 * wide, 0.72, 0.44, 0, 0, 0, chest);
  part(g.box, g.armor2, 0.5 * wide, 0.3, 0.06, 0, 0.12, 0.22, chest, 0.15);
  part(g.box, g.trim, 0.72 * wide, 0.06, 0.46, 0, -0.32, 0, chest);
  const core = part(g.sph, g.red, 0.09, 0.09, 0.05, 0, 0.08, 0.26, chest);
  for (const s of [-1, 1]) part(g.box, g.red, 0.02, 0.5, 0.02, s * 0.35 * wide, 0, 0.21, chest);
  // cape
  const cape = new THREE.Mesh(new THREE.PlaneGeometry(0.7 * wide, 1.5, 1, 4), g.robe); cape.position.set(0, -0.45, -0.24); chest.add(cape);
  for (const s of [-1, 1]) {
    part(g.sph, g.armor, 0.25 * wide, 0.18, 0.25, s * 0.45 * wide, 0.33, 0, chest);
    part(g.cone, g.armor2, 0.06, 0.32, 0.06, s * 0.53 * wide, 0.52, 0, chest, 0, 0, -s * 0.5);
    part(g.cone, g.armor2, 0.05, 0.24, 0.05, s * 0.4 * wide, 0.5, -0.1, chest, 0, 0, -s * 0.2);
  }
  const head = grp(chest, 0, 0.6, 0);
  if (!caster) {
    part(g.box, g.armor, 0.32, 0.38, 0.34, 0, 0.04, 0, head);
    part(g.box, g.armor2, 0.34, 0.06, 0.36, 0, -0.02, 0, head);
    part(g.box, g.armor2, 0.06, 0.2, 0.34, 0, 0.3, -0.02, head); // crest
    for (const s of [-1, 1]) part(g.cone, g.armor2, 0.05, 0.36, 0.05, s * 0.18, 0.3, -0.02, head, 0, 0, -s * 0.7);
  } else {
    part(g.cone, g.robe, 0.3, 0.55, 0.32, 0, 0.14, -0.04, head);
    part(g.sph, g.armor2, 0.17, 0.2, 0.15, 0, 0.0, 0.02, head);
  }
  const eyes = [part(g.box, g.red, 0.1, 0.04, 0.02, -0.075, 0.05, 0.175, head), part(g.box, g.red, 0.1, 0.04, 0.02, 0.075, 0.05, 0.175, head)];
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(chest, s * 0.46 * wide, 0.25, 0);
    part(g.box, g.armor, 0.17 * wide, 0.5, 0.18, 0, -0.27, 0, sh);
    const el = grp(sh, 0, -0.52, 0);
    part(g.box, g.armor2, 0.19 * wide, 0.42, 0.2, 0, -0.2, 0, el);
    part(g.box, g.armor, 0.22 * wide, 0.12, 0.22, 0, -0.4, 0, el);
    arms.push({ sh, el });
  }
  let weapon = null, shieldM = null;
  if (kind === 'knight' || shield) {
    weapon = grp(arms[1].el, 0, -0.42, 0.05);
    part(g.box, g.armor2, 0.06, 0.25, 0.06, 0, 0, 0, weapon);
    part(g.box, g.gold, 0.32, 0.05, 0.08, 0, 0.13, 0, weapon);
    const bl = shield ? 0.9 : 1.3;
    part(g.box, g.armor, shield ? 0.14 : 0.1, bl, 0.025, 0, 0.15 + bl / 2, 0, weapon);
    part(g.box, g.red, 0.015, bl * 0.95, 0.03, 0, 0.15 + bl / 2, 0, weapon);
    weapon.rotation.x = Math.PI / 2;
  }
  if (shield) {
    shieldM = grp(arms[0].el, 0.05, -0.3, 0.25);
    part(g.box, g.armor, 0.85, 1.5, 0.1, 0, 0, 0, shieldM);
    part(g.box, g.gold, 0.9, 0.08, 0.12, 0, 0.72, 0, shieldM); part(g.box, g.gold, 0.9, 0.08, 0.12, 0, -0.72, 0, shieldM);
    part(g.oct, g.red, 0.15, 0.25, 0.05, 0, 0.1, 0.07, shieldM);
    part(g.box, g.red, 0.6, 0.02, 0.03, 0, -0.3, 0.06, shieldM);
  }
  if (caster) {
    const staff = grp(arms[1].el, 0, -0.42, 0.05);
    part(g.cyl, g.armor2, 0.03, 2.1, 0.03, 0, 0.3, 0, staff);
    part(g.oct, g.gold, 0.12, 0.2, 0.12, 0, 1.38, 0, staff);
    weapon = part(g.sph, g.red, 0.15, 0.15, 0.15, 0, 1.6, 0, staff);
    staff.rotation.x = Math.PI / 2;
  }
  return {
    root, body, legs, arms, head, eyes, core, weapon, shieldM, chest, cape,
    animate(e, dt, time) {
      const run = e.moveAmt || 0, ph = time * 9 + e.phase;
      body.position.y = caster ? 0.25 + Math.sin(time * 2 + e.phase) * 0.12 : Math.abs(Math.sin(ph)) * 0.05 * run;
      legs.forEach((L, i) => { const s = i ? -1 : 1; L.hip.rotation.x = Math.sin(ph) * 0.7 * run * s; L.knee.rotation.x = Math.max(0, Math.sin(ph * s)) * 0.8 * run; });
      let r0 = -Math.sin(ph) * 0.5 * run, r1 = Math.sin(ph) * 0.5 * run;
      chest.rotation.set(0, 0, 0);
      if (shield && e.state !== 'stagger' && !e.guardBroken) { r0 = -1.2; arms[0].el.rotation.x = -0.6; arms[0].sh.rotation.y = 0.5; }
      if (e.state === 'windup') { const k = Math.min(1, e.t / e.windT); r1 = -2.6 * k; if (caster) { r1 = -1.8 * k; } chest.rotation.x = -0.15 * k; chest.rotation.y = 0.3 * k; }
      else if (e.state === 'strike') { const k = Math.min(1, e.t / 0.16); r1 = -2.6 + 3.3 * k; chest.rotation.x = 0.3 * k; chest.rotation.y = 0.3 - 0.6 * k; if (shield) { r0 = -1.6; } }
      else if (e.state === 'stagger') { chest.rotation.x = -0.35 * Math.max(0, 1 - e.t / 0.3); r0 = 0.4; r1 = 0.4; }
      arms[0].sh.rotation.x = r0; arms[1].sh.rotation.x = r1;
      arms[0].sh.rotation.z = -0.15; arms[1].sh.rotation.z = 0.15;
      if (!shield) arms[0].el.rotation.x = -0.3;
      cape.rotation.x = 0.15 + run * 0.4 + Math.sin(time * 3 + e.phase) * 0.05;
      const glow = e.state === 'windup' ? 1.6 + Math.sin(time * 40) * 0.6 : 1;
      core.scale.set(0.09 * glow, 0.09 * glow, 0.05 * glow);
      eyes.forEach(m => m.scale.x = 0.1 * (e.state === 'windup' ? 1.5 : 1));
      if (caster && weapon) weapon.scale.setScalar(0.15 * (e.state === 'windup' ? 1 + Math.min(1, e.t / e.windT) * 1.5 : 1));
    }
  };
}

// ---------------- rift hound ----------------
function buildHound() {
  const g = shared();
  const root = new THREE.Group(), body = grp(root, 0, 0.8, 0);
  part(g.box, g.fur, 0.5, 0.45, 1.2, 0, 0, 0, body);
  part(g.box, g.fur, 0.56, 0.5, 0.5, 0, 0.08, 0.35, body);
  for (let i = 0; i < 6; i++) part(g.cone, g.armor2, 0.06, 0.32 - i * 0.03, 0.06, 0, 0.3, 0.45 - i * 0.18, body, -0.5);
  const head = grp(body, 0, 0.1, 0.72);
  part(g.box, g.fur, 0.36, 0.3, 0.42, 0, 0, 0.05, head);
  const jaw = grp(head, 0, -0.1, 0.1); part(g.box, g.armor2, 0.3, 0.08, 0.38, 0, -0.03, 0.1, jaw);
  for (const s of [-1, 1]) { part(g.cone, g.bone, 0.03, 0.12, 0.03, s * 0.1, 0.02, 0.27, jaw, Math.PI); part(g.cone, g.armor2, 0.05, 0.3, 0.05, s * 0.13, 0.22, -0.08, head, -0.6, 0, -s * 0.3); }
  const eyes = [part(g.box, g.red, 0.07, 0.03, 0.02, -0.1, 0.06, 0.27, head), part(g.box, g.red, 0.07, 0.03, 0.02, 0.1, 0.06, 0.27, head)];
  const core = part(g.sph, g.red, 0.12, 0.08, 0.12, 0, -0.18, 0.1, body);
  const legs = [];
  [[-1, 0.4], [1, 0.4], [-1, -0.45], [1, -0.45]].forEach(([s, z]) => { const L = grp(body, s * 0.22, -0.15, z); part(g.box, g.fur, 0.12, 0.65, 0.14, 0, -0.32, 0, L); part(g.box, g.armor2, 0.14, 0.08, 0.2, 0, -0.65, 0.04, L); legs.push(L); });
  const tail = grp(body, 0, 0.1, -0.6); part(g.box, g.fur, 0.08, 0.08, 0.6, 0, 0, -0.3, tail, 0.4);
  return {
    root, body, legs: [], arms: [], head, eyes, core, weapon: null,
    animate(e, dt, time) {
      const run = Math.max(e.moveAmt || 0, e.state === 'strike' ? 1.5 : 0), ph = time * 14 + e.phase;
      legs.forEach((L, i) => L.rotation.x = Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * 0.7 * run);
      body.position.y = 0.8 + Math.abs(Math.sin(ph)) * 0.08 * run;
      body.rotation.x = e.state === 'windup' ? 0.25 : e.state === 'strike' ? -0.15 : 0;
      jaw.rotation.x = e.state === 'windup' || e.state === 'strike' ? 0.5 : Math.sin(time * 3) * 0.05;
      tail.rotation.y = Math.sin(time * 6 + e.phase) * 0.4;
      core.scale.setScalar(e.state === 'windup' ? 0.16 : 0.1);
    }
  };
}

// ---------------- cinder wisp ----------------
function buildWisp() {
  const g = shared();
  const root = new THREE.Group(), body = grp(root, 0, 1.4, 0);
  const shell = part(g.oct, g.armor2, 0.42, 0.42, 0.42, 0, 0, 0, body);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; part(g.cone, g.armor2, 0.07, 0.4, 0.07, Math.cos(a) * 0.42, Math.sin(a * 2) * 0.1, Math.sin(a) * 0.42, body, 0, -a, Math.PI / 2); }
  const core = part(g.sph, g.red, 0.24, 0.24, 0.24, 0, 0, 0, body);
  const halo = part(g.sph, g.redSoft, 0.55, 0.55, 0.55, 0, 0, 0, body);
  const eyes = [part(g.box, g.red, 0.12, 0.03, 0.02, -0.1, 0.1, 0.38, body), part(g.box, g.red, 0.12, 0.03, 0.02, 0.1, 0.1, 0.38, body)];
  return {
    root, body, legs: [], arms: [], head: body, eyes, core, weapon: null,
    animate(e, dt, time) {
      body.position.y = 1.4 + Math.sin(time * 3 + e.phase) * 0.2;
      shell.rotation.y += dt * 2; body.rotation.y += dt * 0.6;
      const k = e.state === 'windup' ? Math.min(1, e.t / e.windT) : 0;
      const pulse = 1 + Math.sin(time * (8 + k * 30)) * (0.1 + k * 0.25);
      core.scale.setScalar(0.24 * pulse * (1 + k * 0.6)); halo.scale.setScalar(0.55 * pulse * (1 + k));
    }
  };
}

// ---------------- warlord (brute) ----------------
function buildWarlord(variant) {
  const g = shared();
  const root = new THREE.Group(), body = grp(root);
  const legs = [];
  for (const s of [-1, 1]) { const hip = grp(body, s * 0.3, 0.9, 0); part(g.box, g.armor, 0.32, 0.5, 0.36, 0, -0.22, 0, hip); const knee = grp(hip, 0, -0.45, 0); part(g.box, g.armor2, 0.34, 0.45, 0.4, 0, -0.18, 0, knee); part(g.box, g.armor2, 0.38, 0.2, 0.5, 0, -0.4, 0.06, knee); legs.push({ hip, knee }); }
  const chest = grp(body, 0, 1.55, 0);
  part(g.box, g.armor, 1.3, 1.0, 0.8, 0, 0, 0, chest, 0.15);
  part(g.box, g.armor2, 1.0, 0.4, 0.7, 0, -0.55, 0, chest);
  part(g.box, variant ? g.gold : g.trim, 1.32, 0.08, 0.82, 0, -0.35, 0, chest, 0.15);
  const core = part(g.sph, g.red, 0.24, 0.24, 0.12, 0, 0.05, 0.42, chest);
  for (let i = 0; i < 5; i++) part(g.box, g.red, 0.03, 0.22, 0.02, Math.sin(i * 1.25) * 0.36, 0.05 + Math.cos(i * 1.25) * 0.36, 0.41, chest, 0, 0, -i * 1.25);
  for (const s of [-1, 1]) {
    part(g.sph, g.armor, 0.48, 0.36, 0.46, s * 0.82, 0.5, 0, chest);
    for (let k = 0; k < 3; k++) part(g.cone, g.armor2, 0.08, 0.55, 0.08, s * (0.7 + k * 0.15), 0.85, -0.15 + k * 0.15, chest, 0, 0, -s * (0.3 + k * 0.2));
  }
  const head = grp(chest, 0, 0.62, 0.2);
  part(g.box, g.armor, 0.42, 0.4, 0.44, 0, 0.05, 0, head);
  if (variant) part(g.box, g.gold, 0.46, 0.12, 0.48, 0, 0.3, 0, head);
  const eyes = [part(g.box, g.red, 0.12, 0.035, 0.02, -0.09, 0.07, 0.225, head), part(g.box, g.red, 0.12, 0.035, 0.02, 0.09, 0.07, 0.225, head)];
  for (const s of [-1, 1]) part(g.cone, g.armor2, 0.08, 0.6, 0.08, s * 0.28, 0.3, 0, head, 0, 0, -s * 1.0);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(chest, s * 0.85, 0.25, 0);
    part(g.box, g.armor, 0.32, 0.65, 0.34, 0, -0.35, 0, sh);
    const el = grp(sh, 0, -0.7, 0);
    part(g.box, g.armor2, 0.36, 0.55, 0.38, 0, -0.25, 0, el);
    part(g.box, g.armor, 0.48, 0.38, 0.48, 0, -0.65, 0, el);
    part(g.box, g.red, 0.5, 0.04, 0.5, 0, -0.5, 0, el);
    arms.push({ sh, el });
  }
  // great hammer in right hand
  const weapon = grp(arms[1].el, 0, -0.75, 0.1);
  part(g.cyl, g.armor2, 0.06, 2.0, 0.06, 0, 0.6, 0, weapon);
  part(g.box, g.armor, 0.9, 0.55, 0.55, 0, 1.6, 0, weapon);
  part(g.box, g.red, 0.92, 0.06, 0.57, 0, 1.6, 0, weapon);
  weapon.rotation.x = Math.PI / 2;
  root.scale.setScalar(2.1);
  return {
    root, body, legs, arms, head, eyes, core, weapon, chest,
    animate(e, dt, time) {
      const run = e.moveAmt || 0, ph = time * 7 + e.phase;
      body.position.y = Math.abs(Math.sin(ph)) * 0.04 * run;
      legs.forEach((L, i) => { const s = i ? -1 : 1; L.hip.rotation.x = Math.sin(ph) * 0.6 * run * s; L.knee.rotation.x = Math.max(0, Math.sin(ph * s)) * 0.6 * run; });
      let r0 = -Math.sin(ph) * 0.4 * run, r1 = Math.sin(ph) * 0.4 * run;
      chest.rotation.set(0, 0, 0);
      const atk = e.atk || 'slam';
      if (e.state === 'windup') {
        const k = Math.min(1, e.t / e.windT);
        if (atk === 'sweep') { r1 = -1.6 * k; chest.rotation.y = 1.0 * k; arms[1].sh.rotation.z = 1.2 * k; }
        else if (atk === 'charge') { chest.rotation.x = 0.4 * k; r0 = r1 = 0.6 * k; }
        else { r0 = r1 = -2.8 * k; chest.rotation.x = -0.25 * k; }
      } else if (e.state === 'strike') {
        const k = Math.min(1, e.t / 0.15);
        if (atk === 'sweep') { r1 = -1.6; chest.rotation.y = 1.0 - 2.2 * k; arms[1].sh.rotation.z = 1.2; }
        else if (atk === 'charge') { chest.rotation.x = 0.5; r0 = r1 = 0.8; }
        else { r0 = r1 = -2.8 + 3.4 * k; chest.rotation.x = 0.45 * k; }
      } else { arms[1].sh.rotation.z = 0.15; }
      arms[0].sh.rotation.x = r0; arms[1].sh.rotation.x = r1; arms[0].sh.rotation.z = -0.15;
      const glow = e.state === 'windup' ? 1.6 + Math.sin(time * 40) * 0.6 : (e.enraged ? 1.3 + Math.sin(time * 8) * 0.2 : 1);
      core.scale.set(0.24 * glow, 0.24 * glow, 0.12 * glow);
    }
  };
}

// ---------------- hollow seraph ----------------
function buildSeraph() {
  const g = shared();
  const root = new THREE.Group(), body = grp(root, 0, 1.6, 0);
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.95, 2.4, 14, 3, true), g.robe); robe.position.y = 0; body.add(robe);
  const chest = grp(body, 0, 1.35, 0);
  part(g.box, g.gold, 0.8, 0.6, 0.45, 0, 0, 0, chest);
  const core = part(g.oct, g.red, 0.16, 0.24, 0.08, 0, 0.02, 0.24, chest);
  const head = grp(chest, 0, 0.6, 0);
  part(g.sph, g.bone, 0.2, 0.24, 0.2, 0, 0, 0, head);
  part(g.box, g.armor2, 0.36, 0.08, 0.3, 0, 0.05, 0.02, head);
  const eyes = [part(g.box, g.red, 0.26, 0.03, 0.02, 0, 0.05, 0.19, head)];
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 32), g.red); halo.position.set(0, 0.35, -0.15); head.add(halo);
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(chest, s * 0.48, 0.15, 0);
    part(g.box, g.robe, 0.2, 0.7, 0.2, 0, -0.35, 0, sh);
    const el = grp(sh, 0, -0.7, 0); part(g.box, g.gold, 0.16, 0.45, 0.16, 0, -0.2, 0, el);
    part(g.sph, g.red, 0.12, 0.12, 0.12, 0, -0.5, 0, el);
    arms.push({ sh, el });
  }
  const wings = [];
  for (let i = 0; i < 4; i++) {
    const s = i % 2 ? 1 : -1, up = i < 2 ? 1 : 0;
    const piv = grp(chest, s * 0.2, 0.2 - (1 - up) * 0.4, -0.25);
    const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(2.2, 1.6 * (up ? 1 : 0.2)); sh.lineTo(2.6, 0.4 - (1 - up)); sh.lineTo(1.8, -0.2 - (1 - up)); sh.lineTo(2.0, -0.8 - (1 - up)); sh.lineTo(0.8, -0.6 - (1 - up) * 0.6); sh.closePath();
    const w = new THREE.Mesh(new THREE.ShapeGeometry(sh), g.seraphWing); w.scale.x = s * (up ? 1.2 : 0.9); w.scale.y = up ? 1.2 : 0.9; piv.add(w);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.04), g.red); edge.position.set(s * 1.2 * (up ? 1.2 : 0.9), (up ? 0.9 : -0.2), 0.01); edge.rotation.z = s * (up ? 0.62 : -0.1); piv.add(edge);
    wings.push({ piv, s, up });
  }
  root.scale.setScalar(1.6);
  return {
    root, body, legs: [], arms, head, eyes, core, weapon: null, chest,
    animate(e, dt, time) {
      body.position.y = 1.6 + Math.sin(time * 1.6) * 0.25;
      halo.rotation.z += dt * 2;
      wings.forEach((w, i) => { w.piv.rotation.y = w.s * (0.4 + Math.sin(time * 2.4 + i) * 0.25); w.piv.rotation.z = w.s * Math.sin(time * 2.4 + i * 0.5) * 0.12; });
      let lift = 0;
      if (e.state === 'windup') lift = Math.min(1, e.t / e.windT);
      arms.forEach(a => { a.sh.rotation.x = -0.3 - lift * 2.2; a.sh.rotation.z = (a === arms[0] ? -1 : 1) * (0.3 + lift * 0.5); });
      robe.scale.x = robe.scale.z = 1 + Math.sin(time * 3) * 0.04;
      core.scale.set(0.16 * (1 + lift), 0.24 * (1 + lift), 0.08);
    }
  };
}

// ---------------- the thirteenth shade (mirror of the hero) ----------------
function buildShade(scene) {
  const h = buildHero(scene, { palette: 'shade', noLight: true });
  scene.remove(h.root);
  const core = h.body; // for flash/fx positioning
  return {
    root: h.root, body: h.body, legs: [], arms: [], head: h.head, eyes: [], core: new THREE.Object3D(), weapon: h.sword, hero: h,
    animate(e, dt, time) {
      const st = { moveAmt: e.moveAmt || 0, atkIdx: -1, atkP: 0, cast: 0, dash: false, hitT: 0, deadT: e.state === 'dead' ? e.t : -1, combat: true };
      if (e.state === 'windup') { if (e.atk === 'rain' || e.atk === 'pull' || e.atk === 'judg') st.cast = Math.min(1, e.t / e.windT); else { st.atkIdx = 0; st.atkP = Math.min(0.34, e.t / e.windT * 0.34); } }
      if (e.state === 'strike') { if (e.atk === 'dash') st.dash = true; else if (e.atk === 'slash') { st.atkIdx = e.combo % 3; st.atkP = Math.min(1, 0.35 + e.t / 0.35); } else st.cast = 1 - Math.min(1, e.t / 0.4); }
      if (e.state === 'stagger') st.hitT = Math.max(0, 0.3 - e.t);
      h.update(dt, st);
    }
  };
}

const BUILD = { knight: () => buildKnight('knight'), caster: () => buildKnight('caster'), shield: () => buildKnight('shield'), hound: buildHound, wisp: buildWisp, warlord: () => buildWarlord(false), warlord2: () => buildWarlord(true), seraph: buildSeraph };

export function makeEnemy(kind, scene, scale = { hp: 1, dmg: 1 }, opts = {}) {
  const g = shared();
  const infoKind = kind === 'warlord2' ? 'warlord' : kind;
  const K = ENEMY_INFO[infoKind];
  const m = kind === 'shade' ? buildShade(scene) : BUILD[kind]();
  const boss = !!K.boss;
  const sc = m.root.scale.x;
  const hpW = boss ? 0 : 1.2;
  let hpBar = null;
  if (!boss) {
    const bg = new THREE.Sprite(g.hpBg); bg.scale.set(hpW + 0.08, 0.16, 1); bg.renderOrder = 10;
    const fill = new THREE.Sprite(g.hpFill); fill.scale.set(hpW, 0.11, 1); fill.renderOrder = 11;
    bg.position.y = fill.position.y = (K.h + 0.3) / sc;
    bg.scale.multiplyScalar(1 / sc); fill.scale.multiplyScalar(1 / sc);
    m.root.add(bg); m.root.add(fill); hpBar = { bg, fill, w: fill.scale.x };
  }
  const disk = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 32), g.disk); disk.rotation.x = -Math.PI / 2; disk.position.y = 0.04 / sc; disk.scale.setScalar(K.r / 0.6 / sc * (boss ? 1.2 : 1)); m.root.add(disk);
  if (!boss && kind !== 'hound') m.root.scale.setScalar(1.12);
  const meshes = []; m.root.traverse(o => { if (o.isMesh) meshes.push(o); });
  scene.add(m.root);
  const hp = Math.round(K.hp * scale.hp * (opts.hpMul || 1));
  return { ...m, kind, info: K, boss, hp, maxHp: hp, hpBar, meshes, state: 'spawn', t: 0, cd: 1 + Math.random(), vel: new THREE.Vector3(), flashT: 0, dmgMul: scale.dmg, phase: Math.random() * 6, frozen: 0 };
}

export function setFlash(e, mode) {
  const g = shared();
  for (const m of e.meshes) {
    if (m.material === g.disk) continue;
    if (mode) { if (!m.userData.orig) m.userData.orig = m.material; m.material = mode === 'frost' ? g.frost : g.flash; }
    else if (m.userData.orig) { m.material = m.userData.orig; m.userData.orig = null; }
  }
}
export function updateHpBar(e) {
  if (!e.hpBar) return;
  const f = Math.max(0.001, e.hp / e.maxHp);
  e.hpBar.fill.scale.x = e.hpBar.w * f; e.hpBar.fill.center.set(0.5 / f, 0.5);
}
export function animateEnemy(e, dt, time) {
  if (e.frozen > 0) return;
  e.animate(e, dt, time);
}
export { shared as enemyShared };
