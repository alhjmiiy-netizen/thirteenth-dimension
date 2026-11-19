import * as THREE from 'three';

const RED = new THREE.Color(4, 0.5, 0.3);
let G = null;
function shared() {
  if (G) return G;
  G = {
    armor: new THREE.MeshStandardMaterial({ color: 0x2a3042, metalness: 0.8, roughness: 0.3, envMapIntensity: 2.6, emissive: 0x0a0d18 }),
    armor2: new THREE.MeshStandardMaterial({ color: 0x12141c, metalness: 0.75, roughness: 0.4, envMapIntensity: 2 }),
    glowDisk: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.1, 0.05), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    trim: new THREE.MeshStandardMaterial({ color: 0x3a1418, metalness: 0.8, roughness: 0.3, emissive: 0x500808, emissiveIntensity: 1 }),
    red: new THREE.MeshBasicMaterial({ color: RED }),
    robe: new THREE.MeshStandardMaterial({ color: 0x0c0a12, roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }),
    flash: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 3, 3.5) }),
    box: new THREE.BoxGeometry(1, 1, 1),
    sph: new THREE.SphereGeometry(1, 12, 8),
    cone: new THREE.ConeGeometry(1, 1, 6),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
    hpBg: new THREE.SpriteMaterial({ color: 0x050000, depthTest: false, transparent: true, opacity: 0.8, fog: false, toneMapped: false }),
    hpFill: new THREE.SpriteMaterial({ color: new THREE.Color(1.6, 0.12, 0.08), depthTest: false, fog: false, toneMapped: false }),
  };
  const rim = (mat, c, p) => { mat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
    totalEmissiveRadiance += vec3(${c}) * pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), ${p});`); }; };
  rim(G.armor, '0.75, 0.1, 0.14', '4.0'); rim(G.armor2, '0.45, 0.06, 0.1', '4.0');
  return G;
}
function part(geo, mat, sx, sy, sz, x, y, z, parent) { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); parent.add(m); return m; }

function buildKnight(kind) {
  const g = shared();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const caster = kind === 'caster';
  const legs = [];
  if (!caster) {
    for (const s of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(s * 0.17, 0.95, 0); part(g.box, g.armor, 0.2, 0.9, 0.24, 0, -0.45, 0, hip); part(g.box, g.armor2, 0.24, 0.16, 0.36, 0, -0.88, 0.05, hip); part(g.sph, g.armor, 0.13, 0.11, 0.13, 0, -0.45, 0.1, hip); body.add(hip); legs.push(hip); }
    part(g.box, g.armor2, 0.62, 0.3, 0.34, 0, 1.0, 0, body);
  } else {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.6, 1.3, 10, 1, true), g.robe); skirt.position.y = 0.75; body.add(skirt);
  }
  const torso = part(g.box, g.armor, 0.68, 0.72, 0.42, 0, 1.5, 0, body);
  part(g.box, g.trim, 0.7, 0.06, 0.44, 0, 1.18, 0, body);
  const core = part(g.sph, g.red, 0.09, 0.09, 0.05, 0, 1.58, 0.22, body);
  for (const s of [-1, 1]) part(g.box, g.red, 0.02, 0.5, 0.02, s * 0.345, 1.5, 0.2, body);
  part(g.box, g.red, 0.02, 0.3, 0.02, 0, 1.4, 0.215, body);
  // pauldrons with spikes
  for (const s of [-1, 1]) {
    part(g.sph, g.armor, 0.24, 0.18, 0.24, s * 0.44, 1.83, 0, body);
    const sp = part(g.cone, g.armor2, 0.06, 0.3, 0.06, s * 0.52, 2.0, 0, body); sp.rotation.z = -s * 0.5;
  }
  // helmet
  const head = new THREE.Group(); head.position.y = 2.08; body.add(head);
  part(g.box, g.armor, 0.32, 0.38, 0.34, 0, 0.05, 0, head);
  part(g.box, g.armor2, 0.34, 0.06, 0.36, 0, 0.0, 0, head);
  const eyes = [part(g.box, g.red, 0.1, 0.04, 0.02, -0.075, 0.06, 0.175, head), part(g.box, g.red, 0.1, 0.04, 0.02, 0.075, 0.06, 0.175, head)];
  for (const s of [-1, 1]) { const h = part(g.cone, g.armor2, 0.05, 0.32, 0.05, s * 0.17, 0.3, -0.02, head); h.rotation.z = -s * 0.6; }
  if (caster) { const hood = part(g.cone, g.robe, 0.3, 0.5, 0.3, 0, 0.32, -0.05, head); }
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.45, 1.75, 0); body.add(sh);
    part(g.box, g.armor, 0.17, 0.5, 0.18, 0, -0.27, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.52; sh.add(el);
    part(g.box, g.armor2, 0.19, 0.45, 0.2, 0, -0.2, 0, el);
    arms.push({ sh, el });
  }
  let weapon;
  if (!caster) {
    weapon = new THREE.Group(); weapon.position.set(0, -0.42, 0.05); arms[1].el.add(weapon);
    part(g.box, g.armor2, 0.06, 0.25, 0.06, 0, 0, 0, weapon);
    part(g.box, g.armor, 0.3, 0.05, 0.08, 0, 0.13, 0, weapon);
    part(g.box, g.armor, 0.1, 1.3, 0.025, 0, 0.8, 0, weapon);
    part(g.box, g.red, 0.015, 1.25, 0.03, 0, 0.8, 0, weapon);
    weapon.rotation.x = Math.PI / 2;
  } else {
    weapon = part(g.sph, g.red, 0.14, 0.14, 0.14, 0, -0.5, 0.1, arms[1].el);
  }
  return { root, body, legs, arms, head, eyes, core, weapon, torso };
}

function buildBrute() {
  const g = shared();
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const legs = [];
  for (const s of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(s * 0.3, 0.9, 0); part(g.box, g.armor, 0.32, 0.9, 0.36, 0, -0.42, 0, hip); part(g.box, g.armor2, 0.38, 0.2, 0.5, 0, -0.85, 0.06, hip); body.add(hip); legs.push(hip); }
  const torso = part(g.box, g.armor, 1.3, 1.0, 0.8, 0, 1.55, 0, body); torso.rotation.x = 0.15;
  part(g.box, g.armor2, 1.0, 0.4, 0.7, 0, 1.0, 0, body);
  const core = part(g.sph, g.red, 0.24, 0.24, 0.12, 0, 1.6, 0.42, body);
  for (let i = 0; i < 5; i++) { const c = part(g.box, g.red, 0.03, 0.22, 0.02, Math.sin(i * 1.25) * 0.36, 1.6 + Math.cos(i * 1.25) * 0.36, 0.41, body); c.rotation.z = -i * 1.25; }
  for (const s of [-1, 1]) {
    part(g.sph, g.armor, 0.48, 0.36, 0.46, s * 0.82, 2.05, 0, body);
    for (let k = 0; k < 3; k++) { const sp = part(g.cone, g.armor2, 0.08, 0.55, 0.08, s * (0.7 + k * 0.15), 2.4, -0.15 + k * 0.15, body); sp.rotation.z = -s * (0.3 + k * 0.2); }
  }
  const head = new THREE.Group(); head.position.set(0, 2.15, 0.2); body.add(head);
  part(g.box, g.armor, 0.42, 0.4, 0.44, 0, 0.05, 0, head);
  const eyes = [part(g.box, g.red, 0.12, 0.035, 0.02, -0.09, 0.07, 0.225, head), part(g.box, g.red, 0.12, 0.035, 0.02, 0.09, 0.07, 0.225, head)];
  for (const s of [-1, 1]) { const h = part(g.cone, g.armor2, 0.08, 0.6, 0.08, s * 0.28, 0.3, 0, head); h.rotation.z = -s * 1.0; }
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Group(); sh.position.set(s * 0.85, 1.8, 0); body.add(sh);
    part(g.box, g.armor, 0.32, 0.65, 0.34, 0, -0.35, 0, sh);
    const el = new THREE.Group(); el.position.y = -0.7; sh.add(el);
    part(g.box, g.armor2, 0.36, 0.55, 0.38, 0, -0.25, 0, el);
    part(g.box, g.armor, 0.48, 0.38, 0.48, 0, -0.65, 0, el);
    part(g.box, g.red, 0.5, 0.04, 0.5, 0, -0.5, 0, el);
    arms.push({ sh, el });
  }
  root.scale.setScalar(2.1);
  return { root, body, legs, arms, head, eyes, core, weapon: null, torso };
}

export const KINDS = {
  knight: { hp: 380, speed: 3.4, range: 2.0, dmg: 48, wind: 0.55, exp: 180, r: 0.6, h: 2.6 },
  caster: { hp: 300, speed: 3.0, range: 11, dmg: 55, wind: 0.8, exp: 220, r: 0.55, h: 2.7 },
  brute: { hp: 4800, speed: 2.6, range: 4.2, dmg: 110, wind: 1.0, exp: 1600, r: 1.6, h: 6.0 },
};

export function makeEnemy(kind, scene, scale = 1) {
  const g = shared();
  const m = kind === 'brute' ? buildBrute() : buildKnight(kind);
  const K = KINDS[kind];
  const hpW = kind === 'brute' ? 3.2 : 1.2;
  const bg = new THREE.Sprite(g.hpBg); bg.scale.set(hpW + 0.08, 0.16 * (kind === 'brute' ? 1.5 : 1), 1); bg.renderOrder = 10;
  const fill = new THREE.Sprite(g.hpFill); fill.scale.set(hpW, 0.11 * (kind === 'brute' ? 1.5 : 1), 1); fill.renderOrder = 11;
  const hpY = K.h + 0.3; bg.position.y = fill.position.y = hpY / (kind === 'brute' ? 2.1 : 1);
  m.root.add(bg); m.root.add(fill);
  if (kind === 'brute') { bg.scale.multiplyScalar(1 / 2.1); fill.scale.multiplyScalar(1 / 2.1); }
  const disk = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.85, 32), g.glowDisk); disk.rotation.x = -Math.PI / 2; disk.position.y = 0.04; m.root.add(disk);
  if (kind !== 'brute') m.root.scale.setScalar(1.12);
  const meshes = []; m.root.traverse(o => { if (o.isMesh) meshes.push(o); });
  scene.add(m.root);
  const hp = Math.round(K.hp * scale);
  return { ...m, kind, K, hp, maxHp: hp, hpBar: { bg, fill, w: fill.scale.x }, meshes, state: 'spawn', t: 0, cd: 1 + Math.random(), vel: new THREE.Vector3(), flashT: 0, dmgScale: scale, phase: Math.random() * 6, enraged: false };
}

export function setFlash(e, on) {
  const g = shared();
  for (const m of e.meshes) {
    if (m.isSprite) continue;
    if (on) { if (!m.userData.orig) m.userData.orig = m.material; m.material = g.flash; }
    else if (m.userData.orig) { m.material = m.userData.orig; }
  }
}
export function updateHpBar(e) {
  const f = Math.max(0.001, e.hp / e.maxHp);
  e.hpBar.fill.scale.x = e.hpBar.w * f; e.hpBar.fill.center.set(0.5 / f, 0.5);
}

// animate an enemy model given its AI state
export function animateEnemy(e, dt, time) {
  const run = e.moveAmt || 0, ph = time * 9 + e.phase;
  const bob = e.kind === 'caster' ? 0.25 + Math.sin(time * 2 + e.phase) * 0.12 : Math.abs(Math.sin(ph)) * 0.06 * run;
  e.body.position.y = bob;
  if (e.legs.length) { e.legs[0].rotation.x = Math.sin(ph) * 0.7 * run; e.legs[1].rotation.x = -Math.sin(ph) * 0.7 * run; }
  const a = e.arms;
  let r0 = -Math.sin(ph) * 0.5 * run, r1 = Math.sin(ph) * 0.5 * run;
  if (e.state === 'windup') { const k = Math.min(1, e.t / e.K.wind); r1 = -2.6 * k; if (e.kind === 'brute') r0 = -2.6 * k; e.body.rotation.x = -0.15 * k; }
  else if (e.state === 'strike') { const k = Math.min(1, e.t / 0.18); r1 = -2.6 + 3.4 * k; if (e.kind === 'brute') r0 = r1; e.body.rotation.x = 0.35 * k; }
  else e.body.rotation.x *= 0.85;
  a[0].sh.rotation.x = r0; a[1].sh.rotation.x = r1;
  a[0].sh.rotation.z = -0.15; a[1].sh.rotation.z = 0.15;
  const glow = e.state === 'windup' ? 1.6 + Math.sin(time * 40) * 0.6 : 1;
  e.core.scale.setScalar(glow * (e.kind === 'brute' ? 0.24 : 0.09)); e.core.scale.z *= 0.5;
  if (e.flashT > 0) { e.flashT -= dt; if (e.flashT <= 0) setFlash(e, false); }
}
