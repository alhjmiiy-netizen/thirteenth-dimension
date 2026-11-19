import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld, ARENA_R } from './world.js';
import { buildHero } from './hero.js';
import { makeEnemy, animateEnemy, setFlash, updateHpBar, KINDS } from './enemies.js';
import { makeFX } from './fx.js';
import { drawPortrait, drawIcon } from './textures.js';
import { initAudio, sfx, startMusic, musicIntense, setSound, soundOn } from './audio.js';

const $ = s => document.querySelector(s);
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (!isTouch) document.body.classList.add('desk');
const params = new URLSearchParams(location.search);
const quality = { low: params.get('q') === 'low' || (isTouch && Math.min(screen.width, screen.height) < 500 && params.get('q') !== 'high') };

await Promise.race([document.fonts.load('800 40px Cinzel'), new Promise(r => setTimeout(r, 1500))]);

// ---------- renderer ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
let pr = Math.min(devicePixelRatio, quality.low ? 1.25 : (isTouch ? 1.5 : 1.75));
renderer.setPixelRatio(pr);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(56, innerWidth / innerHeight, 0.1, 800);
const camFill = new THREE.DirectionalLight(0xbcd4ff, 1.1); camFill.position.set(0.3, 0.6, 1); camera.add(camFill); camera.add(camFill.target); camFill.target.position.set(0, 0, -1); scene.add(camera);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.7, 0.35, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h; camera.fov = w / h < 1.2 ? 70 : 56; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const world = buildWorld(scene, renderer, quality);
const hero = buildHero(scene);
const fx = makeFX(scene, quality);

// ---------- HUD setup ----------
drawPortrait($('#portrait'));
drawIcon($('#atkBtn canvas'), 'atk'); drawIcon($('#sk1 canvas'), 's1'); drawIcon($('#sk2 canvas'), 's2'); drawIcon($('#sk3 canvas'), 's3'); drawIcon($('#potBtn canvas'), 'pot');
const helpHTML = isTouch
  ? 'Left stick: <b>move</b> · Big button: <b>attack</b> (hold for combos) · Drag the screen: <b>turn camera</b><br>⚡ Lightning Burst · ⟫ Phase Dash · 🌀 Void Vortex · ❤ Potion'
  : '<b>WASD</b> move · <b>J</b> / <b>Space</b> / left-click attack (hold for combos) · <b>K</b> Lightning Burst · <b>Shift</b> / <b>L</b> Phase Dash · <b>U</b> Void Vortex · <b>Q</b> Potion<br>Drag with the mouse (or <b>←/→</b>) to turn the camera · <b>Esc</b> pause';
$('#helpTxt').innerHTML = helpHTML; $('#helpTxt2').innerHTML = helpHTML;

// ---------- game state ----------
const SK = [
  { name: 'Lightning Burst', mp: 45, cd: 6 },
  { name: 'Phase Dash', mp: 15, cd: 2.5 },
  { name: 'Void Vortex', mp: 70, cd: 12 },
];
let S; // game state
function newState() {
  return {
    mode: 'title', wave: 0, endless: false, kills: 0, time: 0, pending: [], spawnT: 0, betweenT: 0,
    P: { pos: new THREE.Vector3(0, 0, 8), heading: Math.PI, hp: 850, maxHp: 850, mp: 320, maxMp: 320, sh: 200, maxSh: 200, shT: 0,
      lv: 12, exp: 1240, next: 2000, atk: 52, potions: 3, combo: 0, comboT: 0, atkT: -1, atkDur: 0.3, atkHit: false, queued: false,
      dashT: 0, dashDir: new THREE.Vector3(), dashHit: new Set(), inv: 0, cd: [0, 0, 0], castT: 0, moveAmt: 0, dead: false },
    enemies: [], projectiles: [], vortices: [], boss: null,
  };
}
S = newState();
window.TD = { get S() { return S; }, start: () => startGame(), sfx, spawn: (k, x, z) => { const e = spawnEnemy(k); e.root.position.set(x, 0, z); e.state = 'approach'; e.t = 0; e.cd = 99; e.root.rotation.y = Math.atan2(S.P.pos.x - x, S.P.pos.z - z); return e; }, clearPending: () => { S.pending = []; }, killAll: () => S.enemies.forEach(e => { if (e.state !== 'dead' && e.state !== 'spawn') damageEnemy(e, 1e7); }), hurt: n => { S.P.inv = 0; hurtPlayer(n); }, cam: (y, p, d) => { camYaw = y; camPitch = p; camDist = d; } };

// ---------- input ----------
const keys = {};
const input = { x: 0, y: 0, atk: false };
let camYaw = 0, camPitch = 0.3, camDist = 8.6;
addEventListener('keydown', e => {
  if (e.repeat) { keys[e.code] = true; return; }
  keys[e.code] = true; initAudio();
  if (S.mode === 'play') {
    if (e.code === 'KeyK' || e.code === 'Digit1') useSkill(0);
    if (e.code === 'KeyL' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Digit2') useSkill(1);
    if (e.code === 'KeyU' || e.code === 'Digit3') useSkill(2);
    if (e.code === 'KeyQ' || e.code === 'Digit4') usePotion();
    if (e.code === 'Escape' || e.code === 'KeyP') pause(true);
    if (e.code === 'Space') e.preventDefault();
  } else if (S.mode === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) pause(false);
  else if (S.mode === 'title' && (e.code === 'Enter' || e.code === 'Space')) startGame();
});
addEventListener('keyup', e => { keys[e.code] = false; });
// joystick
const stick = $('#stick'), knob = $('#knob');
let stickId = null, stickV = { x: 0, y: 0 };
function stickMove(e) {
  const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width * 0.42;
  let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  const m = Math.hypot(dx, dy) / R; stickV = m < 0.12 ? { x: 0, y: 0 } : { x: dx / R, y: -dy / R };
}
stick.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; stickV = { x: 0, y: 0 }; knob.style.transform = ''; };
stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
// buttons
function holdBtn(el, down, up) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); initAudio(); el.classList.add('press'); el.setPointerCapture(e.pointerId); down(); });
  const end = () => { el.classList.remove('press'); up && up(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
}
holdBtn($('#atkBtn'), () => { input.atk = true; tryAttack(); }, () => { input.atk = false; });
holdBtn($('#sk1'), () => useSkill(0)); holdBtn($('#sk2'), () => useSkill(1)); holdBtn($('#sk3'), () => useSkill(2));
holdBtn($('#potBtn'), () => usePotion());
$('#pauseBtn').addEventListener('click', () => { sfx('ui'); pause(true); });
// camera drag on canvas (+ mouse attack)
const drags = new Map(); let mouseAtk = false;
canvas.addEventListener('pointerdown', e => {
  initAudio();
  drags.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
  canvas.setPointerCapture(e.pointerId);
  if (e.pointerType === 'mouse' && e.button === 0 && S.mode === 'play') { mouseAtk = true; tryAttack(); }
});
canvas.addEventListener('pointermove', e => {
  const d = drags.get(e.pointerId); if (!d) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
  if (d.moved > 10) mouseAtk = false;
  camYaw -= dx * 0.006; camPitch = Math.min(0.85, Math.max(0.12, camPitch + dy * 0.003));
});
const dragEnd = e => { drags.delete(e.pointerId); if (e.pointerType === 'mouse') mouseAtk = false; };
canvas.addEventListener('pointerup', dragEnd); canvas.addEventListener('pointercancel', dragEnd);
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && S.mode === 'play') pause(true); });

// ---------- screens ----------
function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
$('#startBtn').addEventListener('click', () => startGame());
$('#resumeBtn').addEventListener('click', () => pause(false));
$('#restartBtn').addEventListener('click', () => startGame());
$('#retryBtn').addEventListener('click', () => startGame());
$('#againBtn').addEventListener('click', () => startGame());
$('#endlessBtn').addEventListener('click', () => { sfx('ui'); S.endless = true; S.mode = 'play'; S.betweenT = 0; show(null); $('#hud').classList.remove('hidden'); nextWave(); });
$('#soundBtn').addEventListener('click', () => { setSound(!soundOn()); $('#soundBtn').textContent = 'SOUND: ' + (soundOn() ? 'ON' : 'OFF'); sfx('ui'); });
$('#qualBtn').addEventListener('click', () => { pr = pr > 1 ? 1 : Math.min(devicePixelRatio, 1.75); renderer.setPixelRatio(pr); resize(); $('#qualBtn').textContent = 'QUALITY: ' + (pr > 1 ? 'HIGH' : 'LOW'); sfx('ui'); });
$('#qualBtn').textContent = 'QUALITY: ' + (pr > 1 ? 'HIGH' : 'LOW');
function pause(on) {
  if (on && S.mode === 'play') { S.mode = 'paused'; show('pause'); }
  else if (!on && S.mode === 'paused') { S.mode = 'play'; show(null); sfx('ui'); last = performance.now(); }
}

function clearField() {
  for (const e of S.enemies) scene.remove(e.root);
  for (const p of S.projectiles) scene.remove(p.m);
  fx.clearAll();
}
function startGame() {
  initAudio(); startMusic(); sfx('ui');
  if (S) clearField();
  S = newState(); S.mode = 'play';
  hero.root.position.copy(S.P.pos); hero.root.rotation.y = S.P.heading; camYaw = 0; camPitch = 0.3;
  show(null); $('#hud').classList.remove('hidden'); $('#bossBar').classList.add('hidden');
  hudDirty = true; nextWave();
}

// ---------- waves ----------
function waveList(n) {
  if (n === 1) return Array(6).fill('knight');
  if (n === 2) return ['knight', 'knight', 'caster', 'knight', 'caster', 'knight', 'caster', 'knight'];
  if (n === 3) return ['brute', 'knight', 'knight', 'knight', 'knight'];
  const l = []; for (let i = 0; i < 4 + n; i++) l.push(i % 3 === 2 ? 'caster' : 'knight');
  if (n % 3 === 0) l.unshift('brute');
  return l;
}
function nextWave() {
  S.wave++;
  const list = waveList(S.wave);
  S.pending = list.slice(); S.spawnT = 1.4; S.waveScale = S.wave <= 3 ? 1 : 1 + 0.2 * (S.wave - 3);
  const bossWave = list.includes('brute');
  banner(bossWave ? `WAVE ${S.wave}<small>THE ABYSSAL WARLORD APPROACHES</small>` : `WAVE ${S.wave}<small>${S.wave === 1 ? 'THE ABYSSAL LEGION' : 'MORE KNIGHTS EMERGE'}</small>`, bossWave);
  sfx(bossWave ? 'roar' : 'horn'); musicIntense(true);
  hudDirty = true;
}
let bannerT = 0;
function banner(html, red) { const b = $('#banner'); b.innerHTML = html; b.classList.toggle('red', !!red); b.classList.add('on'); bannerT = 2.2; }
function spawnEnemy(kind) {
  const e = makeEnemy(kind, scene, S.waveScale);
  let p;
  for (let tries = 0; tries < 20; tries++) {
    const a = Math.random() * Math.PI * 2, r = kind === 'brute' ? 12 : 9 + Math.random() * 9;
    p = new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r);
    if (p.distanceTo(S.P.pos) > 8) break;
  }
  if (kind === 'brute') { p.set(0, 0, -12); if (p.distanceTo(S.P.pos) < 8) p.set(-S.P.pos.x * 0.6, 0, -S.P.pos.z * 0.6 - 0.1).setLength(12); }
  e.root.position.copy(p); e.root.position.y = -3; e.state = 'spawn'; e.t = 0;
  e.root.rotation.y = Math.atan2(S.P.pos.x - p.x, S.P.pos.z - p.z);
  fx.shock(p, kind === 'brute' ? 7 : 3, 0xff3322, 0.8); fx.burst(p.clone().setY(0.3), kind === 'brute' ? 80 : 30, 0xff3322, 5, 0.9, 2, 2, 1);
  updateHpBar(e);
  S.enemies.push(e);
  if (kind === 'brute') { S.boss = e; $('#bossBar').classList.remove('hidden'); }
  return e;
}

// ---------- combat helpers ----------
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
function fwd(h) { return tmp.set(Math.sin(h), 0, Math.cos(h)); }
let shake = 0, hitstop = 0;
function damageEnemy(e, base, opts = {}) {
  if (e.state === 'dead' || e.state === 'spawn') return false;
  const crit = Math.random() < (opts.crit ?? 0.15);
  const dmg = Math.round(base * (0.9 + Math.random() * 0.2) * (crit ? 1.8 : 1));
  e.hp -= dmg; updateHpBar(e);
  e.flashT = 0.05; setFlash(e, true);
  const hp = e.root.position.clone(); hp.y += e.K.h * 0.6;
  dmgNum(hp, dmg, crit ? 'crit' : '');
  fx.burst(hp, crit ? 16 : 8, crit ? 0xffd060 : 0x3fb8ff, 7, 0.4, -9);
  fx.burst(hp, 6, 0xff3322, 4, 0.4, -9);
  sfx(crit ? 'crit' : 'hit');
  if (crit) { hitstop = Math.max(hitstop, 0.05); shake = Math.max(shake, 0.25); }
  if (opts.kb && e.kind !== 'brute') {
    tmp2.copy(e.root.position).sub(opts.from || S.P.pos).setY(0).normalize();
    e.vel.addScaledVector(tmp2, opts.kb);
    if (e.state === 'windup' && e.kind !== 'caster') { e.state = 'stagger'; e.t = 0; }
    else if (e.state !== 'strike') { e.state = 'stagger'; e.t = 0; }
  }
  if (e.hp <= 0) killEnemy(e);
  return true;
}
function killEnemy(e) {
  e.state = 'dead'; e.t = 0; S.kills++;
  const p = e.root.position.clone(); p.y += e.K.h * 0.5;
  const big = e.kind === 'brute';
  fx.burst(p, big ? 220 : 60, 0xff3a22, big ? 14 : 8, big ? 1.6 : 0.9, -5, big ? 4 : 1.5);
  fx.burst(p, big ? 140 : 40, 0x4fc8ff, big ? 12 : 6, 1.2, 3, 2, 1);
  fx.shock(e.root.position, big ? 14 : 4, 0xff4422, 0.6);
  sfx('edeath'); if (big) { sfx('slam'); shake = 1.2; hitstop = 0.15; }
  gainExp(Math.round(e.K.exp * (S.waveScale || 1)));
  hudDirty = true;
}
function gainExp(n) {
  const P = S.P; P.exp += n;
  const p = P.pos.clone(); p.y += 2.8; dmgNum(p, `+${n} EXP`, 'lvl', 0.7);
  while (P.exp >= P.next) {
    P.exp -= P.next; P.lv++; P.next = Math.round(2000 * Math.pow(1.18, P.lv - 12) / 10) * 10;
    P.maxHp += 60; P.maxMp += 15; P.atk += 6; P.hp = P.maxHp; P.mp = P.maxMp; P.sh = P.maxSh;
    banner(`LEVEL ${P.lv}<small>POWER OF THE THIRTEENTH RISES</small>`); sfx('level');
    fx.burst(P.pos.clone().setY(0.5), 120, 0xb66bff, 8, 1.4, 4, 2, 1); fx.shock(P.pos, 10, 0xb66bff, 0.8);
    dmgNum(P.pos.clone().setY(3.3), 'LEVEL UP!', 'lvl');
  }
  hudDirty = true;
}
function hurtPlayer(dmg, from) {
  const P = S.P; if (P.dead || P.inv > 0 || P.dashT > 0) return;
  dmg = Math.round(dmg * (0.9 + Math.random() * 0.2));
  let rest = dmg;
  if (P.sh > 0) { const a = Math.min(P.sh, rest * 0.7); P.sh -= a; rest -= a; }
  P.hp -= rest; P.shT = 3.5; P.inv = 0.25;
  dmgNum(P.pos.clone().setY(2.4), `-${dmg}`, 'hurt');
  sfx('hurt'); shake = Math.max(shake, 0.45);
  $('#vignette').classList.add('hurt'); setTimeout(() => $('#vignette').classList.remove('hurt'), 220);
  fx.burst(P.pos.clone().setY(1.5), 20, 0xff3322, 6, 0.5, -8);
  if (from) { tmp2.copy(P.pos).sub(from).setY(0).normalize(); P.pos.addScaledVector(tmp2, 0.5); }
  hudDirty = true;
  if (P.hp <= 0) { P.hp = 0; die(); }
}
function die() {
  S.P.dead = true; S.mode = 'over'; musicIntense(false); sfx('defeat');
  fx.burst(S.P.pos.clone().setY(1.5), 150, 0x4fc8ff, 10, 1.5, -2, 2);
  setTimeout(() => { $('#overTxt').textContent = `Reached wave ${S.wave} · Level ${S.P.lv} · ${S.kills} enemies destroyed`; show('over'); }, 1300);
}
function nearestEnemy(maxD, from = S.P.pos) {
  let best = null, bd = maxD;
  for (const e of S.enemies) { if (e.state === 'dead' || e.state === 'spawn') continue; const d = e.root.position.distanceTo(from) - e.K.r; if (d < bd) { bd = d; best = e; } }
  return best;
}

// ---------- player actions ----------
function tryAttack() {
  const P = S.P; if (S.mode !== 'play' || P.dead || P.dashT > 0) return;
  if (P.atkT >= 0) { if (P.atkT > P.atkDur * 0.45) P.queued = true; return; }
  P.combo = P.comboT > 0 ? (P.combo + 1) % 3 : 0;
  P.atkDur = P.combo === 2 ? 0.42 : 0.28; P.atkT = 0; P.atkHit = false; P.queued = false;
  const t = nearestEnemy(6.5);
  if (t) P.heading = Math.atan2(t.root.position.x - P.pos.x, t.root.position.z - P.pos.z);
  sfx('slash', P.combo === 2 ? 1.3 : 1 + P.combo * 0.06);
}
function attackHit() {
  const P = S.P, f = fwd(P.heading).clone(), heavy = P.combo === 2;
  const c = P.pos.clone().setY(1.2);
  fx.arc(c, P.heading, heavy ? 3.6 : 2.9, heavy ? 0x9fe8ff : 0x4fb8ff, P.combo === 1 ? -1 : 1, P.combo === 1 ? 0.25 : -0.15);
  let any = false;
  for (const e of S.enemies) {
    if (e.state === 'dead' || e.state === 'spawn') continue;
    tmp2.copy(e.root.position).sub(P.pos).setY(0); const d = tmp2.length() - e.K.r;
    const inArc = d < (heavy ? 3.6 : 3.0) && (d < 0.6 || tmp2.normalize().dot(f) > 0.25);
    const inRing = heavy && d < 3.8;
    if (inArc || inRing) { any = damageEnemy(e, P.atk * (heavy ? 1.9 : 1 + P.combo * 0.15), { kb: heavy ? 9 : 4 }) || any; if (heavy && any) fx.bolt(P.pos.clone().setY(1.4), e.root.position.clone().setY(1.4), [0.5, 1.4, 2.8], 0.05, 0.18); }
  }
  if (heavy) { fx.shock(P.pos, 8, 0x5fd8ff, 0.4); fx.ringBurst(P.pos, 40, 0x5fd8ff, 10); shake = Math.max(shake, 0.3); sfx('lightning'); }
  if (any) { hitstop = Math.max(hitstop, heavy ? 0.07 : 0.03); shake = Math.max(shake, heavy ? 0.35 : 0.12); }
}
function useSkill(i) {
  const P = S.P; if (S.mode !== 'play' || P.dead) return;
  const sk = SK[i];
  if (P.cd[i] > 0) return;
  if (P.mp < sk.mp) { sfx('nomp'); return; }
  P.mp -= sk.mp; P.cd[i] = sk.cd; hudDirty = true;
  if (i === 0) { // Lightning Burst: sky bolts on up to 6 foes + nova
    P.castT = 0.45; sfx('lightning'); shake = 0.7; hitstop = 0.06;
    fx.shock(P.pos, 11, 0x3fb8ff, 0.5); fx.ringBurst(P.pos, 40, 0x3fb8ff, 14);
    fx.bolt(P.pos.clone().setY(14), P.pos.clone().addScaledVector(fwd(P.heading), 1.5).setY(0.2), [0.7, 1.7, 3.2], 0.1, 0.25);
    const targets = S.enemies.filter(e => e.state !== 'dead' && e.state !== 'spawn' && e.root.position.distanceTo(P.pos) < 11).sort((a, b) => a.root.position.distanceTo(P.pos) - b.root.position.distanceTo(P.pos)).slice(0, 6);
    targets.forEach((e, k) => setTimeout(() => {
      if (e.state === 'dead') return;
      const top = e.root.position.clone().setY(16).add(new THREE.Vector3((Math.random() - .5) * 4, 0, (Math.random() - .5) * 4));
      fx.bolt(top, e.root.position.clone().setY(0.2), [0.7, 1.7, 3.2], 0.12, 0.28);
      fx.bolt(P.pos.clone().setY(1.6), e.root.position.clone().setY(1.4), [0.5, 1.4, 2.8], 0.05, 0.18);
      fx.shock(e.root.position, 3, 0x7fe8ff, 0.35);
      damageEnemy(e, P.atk * 2.6, { kb: 6, crit: 0.25 });
    }, 60 + k * 70));
    for (const e of S.enemies) if (e.state !== 'dead' && e.root.position.distanceTo(P.pos) < 4 + e.K.r && !targets.includes(e)) damageEnemy(e, P.atk * 1.5, { kb: 8 });
  } else if (i === 1) { // Phase Dash
    const d = moveVec.lengthSq() > 0.01 ? moveVec.clone().normalize() : fwd(P.heading).clone();
    P.dashDir.copy(d); P.dashT = 0.22; P.dashHit.clear(); P.heading = Math.atan2(d.x, d.z);
    P.atkT = -1; sfx('dash'); fx.burst(P.pos.clone().setY(1.2), 30, 0x4dffd2, 5, 0.5, 0, 1.5);
  } else if (i === 2) { // Void Vortex
    const t = nearestEnemy(12);
    const c = t ? t.root.position.clone().setY(0) : P.pos.clone().addScaledVector(fwd(P.heading), 5);
    if (c.length() > ARENA_R - 2) c.setLength(ARENA_R - 2);
    P.castT = 0.4; sfx('vortex'); shake = 0.3;
    fx.vortex(c, 3.6);
    S.vortices.push({ c, t: 0, tick: 0 });
  }
}
function usePotion() {
  const P = S.P; if (S.mode !== 'play' || P.dead || P.potions <= 0 || (P.hp >= P.maxHp && P.mp >= P.maxMp)) return;
  P.potions--; const h = Math.round(P.maxHp * 0.45); P.hp = Math.min(P.maxHp, P.hp + h); P.mp = Math.min(P.maxMp, P.mp + P.maxMp * 0.3);
  sfx('potion'); dmgNum(P.pos.clone().setY(2.6), `+${h}`, 'heal'); fx.burst(P.pos.clone().setY(0.3), 60, 0x6dff8a, 4, 1.1, 5, 2, 1);
  hudDirty = true;
}

// ---------- damage numbers ----------
const dmgLayer = $('#dmgLayer'), nums = [];
function dmgNum(pos, text, cls = '', life = 0.9) {
  let n = nums.find(n => n.t <= 0);
  if (!n) { if (nums.length > 40) return; const el = document.createElement('div'); dmgLayer.appendChild(el); n = { el, t: 0, pos: new THREE.Vector3() }; nums.push(n); }
  n.el.className = 'dmg ' + cls; n.el.textContent = text; n.pos.copy(pos); n.pos.x += (Math.random() - .5) * 0.6; n.t = n.life = life; n.el.style.display = '';
}
const proj = new THREE.Vector3();
function updateNums(dt) {
  for (const n of nums) {
    if (n.t <= 0) continue; n.t -= dt;
    if (n.t <= 0) { n.el.style.display = 'none'; continue; }
    n.pos.y += dt * 1.6;
    proj.copy(n.pos).project(camera);
    if (proj.z > 1) { n.el.style.display = 'none'; continue; }
    const x = (proj.x * 0.5 + 0.5) * innerWidth, y = (-proj.y * 0.5 + 0.5) * innerHeight, k = n.t / n.life;
    const sc = k > 0.8 ? 1 + (k - 0.8) * 3 : 1;
    n.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) scale(${sc})`; n.el.style.opacity = Math.min(1, k * 2.5);
  }
}

// ---------- HUD ----------
let hudDirty = true;
const fmt = n => Math.round(n).toLocaleString('en-US');
const el = { hp: $('.bar.hp i'), sh: $('.bar.sh i'), mp: $('.bar.mp i'), hpT: $('#hpTxt'), mpT: $('#mpTxt'), lvl: $('#lvl'), exp: $('#expBar i'), expT: $('#expTxt'), wave: $('#waveTxt'), en: $('#enemyTxt'), obj: $('#objTxt'), pot: $('#potTxt'), boss: $('#bossBar .bb i') };
const skEls = [1, 2, 3].map(i => ({ b: $('#sk' + i), cd: $('#sk' + i + ' .cd'), t: $('#sk' + i + ' em') }));
function updateHUD() {
  const P = S.P;
  el.hp.style.width = (P.hp / P.maxHp * 100) + '%'; el.sh.style.width = (P.sh / P.maxSh * 100) + '%'; el.mp.style.width = (P.mp / P.maxMp * 100) + '%';
  el.hpT.textContent = `${fmt(Math.ceil(P.hp))}/${fmt(P.maxHp)}`; el.mpT.textContent = `${fmt(P.mp)}/${fmt(P.maxMp)}`;
  skEls.forEach((s, i) => {
    const c = P.cd[i]; s.cd.style.setProperty('--p', (c / SK[i].cd * 100) + '%'); s.t.textContent = c > 0 ? Math.ceil(c) : '';
    s.b.classList.toggle('nomp', P.mp < SK[i].mp);
  });
  if (S.boss) el.boss.style.width = Math.max(0, S.boss.hp / S.boss.maxHp * 100) + '%';
  if (!hudDirty) return; hudDirty = false;
  el.lvl.textContent = 'Lv. ' + P.lv;
  el.exp.style.width = (P.exp / P.next * 100) + '%'; el.expT.textContent = `EXP ${fmt(P.exp)} / ${fmt(P.next)}`;
  const alive = S.enemies.filter(e => e.state !== 'dead').length + S.pending.length;
  el.wave.textContent = 'Wave ' + Math.max(1, S.wave); el.en.textContent = alive;
  el.obj.textContent = S.endless ? `Survive the endless legion (Wave ${S.wave})` : `Defeat all enemies (Wave ${Math.max(1, S.wave)}/3)`;
  el.pot.textContent = 'x' + P.potions;
}

// ---------- update ----------
const moveVec = new THREE.Vector3();
function updatePlayer(dt) {
  const P = S.P;
  let ix = stickV.x, iy = stickV.y;
  if (keys.KeyA) ix -= 1; if (keys.KeyD) ix += 1; if (keys.KeyW) iy += 1; if (keys.KeyS) iy -= 1;
  if (keys.ArrowUp) iy += 1; if (keys.ArrowDown) iy -= 1;
  if (keys.ArrowLeft) camYaw += dt * 2.2; if (keys.ArrowRight) camYaw -= dt * 2.2;
  const m = Math.min(1, Math.hypot(ix, iy));
  const f = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)), r = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
  moveVec.set(0, 0, 0).addScaledVector(f, iy).addScaledVector(r, ix); if (moveVec.lengthSq() > 1) moveVec.normalize();
  if (P.dead) return;
  if (P.dashT > 0) {
    P.dashT -= dt; P.pos.addScaledVector(P.dashDir, 40 * dt);
    fx.burst(P.pos.clone().setY(1.2), 4, 0x4dffd2, 1.5, 0.35, 0, 1.5);
    for (const e of S.enemies) if (!P.dashHit.has(e) && e.state !== 'dead' && e.root.position.distanceTo(P.pos) < 1.8 + e.K.r) { P.dashHit.add(e); damageEnemy(e, P.atk * 1.3, { kb: 5 }); }
  } else {
    const slow = P.atkT >= 0 ? 0.35 : 1;
    P.pos.addScaledVector(moveVec, 7.2 * slow * dt);
    if (m > 0.1 && P.atkT < 0) { const target = Math.atan2(moveVec.x, moveVec.z); let d = target - P.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); P.heading += d * Math.min(1, dt * 14); }
  }
  P.moveAmt += ((P.dashT > 0 ? 1 : m * (P.atkT >= 0 ? 0.3 : 1)) - P.moveAmt) * Math.min(1, dt * 10);
  if (P.pos.length() > ARENA_R) P.pos.setLength(ARENA_R);
  // attack timeline
  if (P.atkT >= 0) {
    P.atkT += dt;
    if (!P.atkHit && P.atkT >= P.atkDur * 0.4) { P.atkHit = true; attackHit(); }
    if (P.atkT >= P.atkDur) { P.atkT = -1; P.comboT = 0.55; if (P.queued || input.atk || keys.KeyJ || keys.Space || mouseAtk) tryAttack(); }
  } else if (P.comboT > 0) P.comboT -= dt;
  if ((input.atk || keys.KeyJ || keys.Space || mouseAtk) && P.atkT < 0) tryAttack();
  for (let i = 0; i < 3; i++) if (P.cd[i] > 0) P.cd[i] = Math.max(0, P.cd[i] - dt);
  P.mp = Math.min(P.maxMp, P.mp + dt * 9);
  if (P.shT > 0) P.shT -= dt; else P.sh = Math.min(P.maxSh, P.sh + dt * 30);
  if (P.inv > 0) P.inv -= dt; if (P.castT > 0) P.castT -= dt;
  hero.root.position.copy(P.pos); hero.root.rotation.y = P.heading;
}

function updateEnemies(dt, time) {
  const P = S.P;
  for (const e of S.enemies) {
    e.t += dt; const pos = e.root.position;
    if (e.state === 'dead') {
      e.root.position.y -= dt * 1.5; e.body.rotation.x += dt * 1.2; e.root.scale.multiplyScalar(1 - dt * 0.8);
      if (e.t > 0.9) { scene.remove(e.root); e.removed = true; }
      continue;
    }
    if (e.state === 'spawn') { pos.y = Math.min(0, -3 + e.t * 4); if (e.t > 0.8) { e.state = 'approach'; e.t = 0; pos.y = 0; } animateEnemy(e, dt, time); continue; }
    tmp.copy(P.pos).sub(pos).setY(0); const d = tmp.length(); const dir = tmp.normalize().clone();
    const K = e.K; e.cd -= dt;
    const enr = e.enraged ? 1.35 : 1;
    let want = 0;
    if (e.state === 'approach') {
      if (e.kind === 'caster') {
        if (d > 11) want = 1; else if (d < 7) want = -1;
        if (e.cd <= 0 && d < 17 && !P.dead) { e.state = 'windup'; e.t = 0; }
      } else {
        if (d > K.range * 0.8 + 0.6) want = 1;
        if (e.cd <= 0 && d < K.range + 0.4 && !P.dead) {
          e.state = 'windup'; e.t = 0;
          if (e.kind === 'brute') { e.slamAt = pos.clone().addScaledVector(dir, 3.2).setY(0); fx.telegraph(e.slamAt, 4.6, K.wind / enr); }
        }
      }
      const ty = Math.atan2(dir.x, dir.z); let dd = ty - e.root.rotation.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); e.root.rotation.y += dd * Math.min(1, dt * 6);
      pos.addScaledVector(dir, want * K.speed * enr * dt);
      if (P.dead) want = 0;
    } else if (e.state === 'windup') {
      if (e.kind !== 'brute') { const ty = Math.atan2(dir.x, dir.z); let dd = ty - e.root.rotation.y; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); e.root.rotation.y += dd * Math.min(1, dt * 4); }
      if (e.t >= K.wind / enr) {
        e.state = 'strike'; e.t = 0; e.struck = false;
        if (e.kind === 'caster') {
          const m = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.6, 0.3) }));
          m.position.copy(pos).setY(1.6); scene.add(m);
          S.projectiles.push({ m, v: dir.clone().multiplyScalar(12), t: 0, dmg: K.dmg * e.dmgScale });
          sfx('bolt');
        } else sfx('eswing');
      }
    } else if (e.state === 'strike') {
      if (!e.struck && e.t > 0.1) {
        e.struck = true;
        if (e.kind === 'brute') {
          sfx('slam'); shake = Math.max(shake, 0.9); fx.shock(e.slamAt, 10, 0xff3322, 0.6); fx.ringBurst(e.slamAt, 50, 0xff4422, 12); fx.burst(e.slamAt.clone().setY(0.3), 60, 0x334466, 8, 1, -12, 3, 1);
          if (P.pos.distanceTo(e.slamAt) < 4.6) hurtPlayer(K.dmg * e.dmgScale * enr, e.slamAt);
        } else if (e.kind === 'knight') {
          const facing = new THREE.Vector3(Math.sin(e.root.rotation.y), 0, Math.cos(e.root.rotation.y));
          if (d < K.range + 0.7 && facing.dot(dir) > 0.3) hurtPlayer(K.dmg * e.dmgScale, pos);
        }
      }
      if (e.t > 0.4) { e.state = 'recover'; e.t = 0; }
    } else if (e.state === 'recover') {
      if (e.t > (e.kind === 'brute' ? 0.7 / enr : 0.5)) { e.state = 'approach'; e.t = 0; e.cd = (e.kind === 'caster' ? 2.6 : e.kind === 'brute' ? 1.6 : 1.1) + Math.random() * 1.2; }
    } else if (e.state === 'stagger') {
      if (e.t > 0.3) { e.state = 'approach'; e.t = 0; e.cd = Math.max(e.cd, 0.4); }
    }
    // knockback velocity
    pos.addScaledVector(e.vel, dt); e.vel.multiplyScalar(Math.pow(0.002, dt));
    e.moveAmt = (e.moveAmt || 0) + ((Math.abs(want) > 0 ? 1 : 0) - (e.moveAmt || 0)) * Math.min(1, dt * 8);
    // boss enrage
    if (e.kind === 'brute' && !e.enraged && e.hp < e.maxHp * 0.5) {
      e.enraged = true; sfx('roar'); shake = 1; banner('THE WARLORD IS ENRAGED<small>KNIGHTS ANSWER HIS CALL</small>', true);
      S.pending.push('knight', 'knight', 'knight'); S.spawnT = 0.6; hudDirty = true;
      fx.shock(pos, 16, 0xff2211, 0.9);
    }
    animateEnemy(e, dt, time);
  }
  S.enemies = S.enemies.filter(e => !e.removed);
  // separation
  const L = S.enemies;
  for (let i = 0; i < L.length; i++) {
    const a = L[i]; if (a.state === 'dead' || a.state === 'spawn') continue;
    for (let j = i + 1; j < L.length; j++) {
      const b = L[j]; if (b.state === 'dead' || b.state === 'spawn') continue;
      tmp.copy(b.root.position).sub(a.root.position).setY(0); const d = tmp.length(), min = a.K.r + b.K.r;
      if (d < min && d > 0.001) { tmp.multiplyScalar((min - d) / d * 0.5); const wa = a.kind === 'brute' ? 0.1 : 1, wb = b.kind === 'brute' ? 0.1 : 1; a.root.position.addScaledVector(tmp, -wa); b.root.position.addScaledVector(tmp, wb); }
    }
    tmp.copy(a.root.position).sub(S.P.pos).setY(0); const d = tmp.length(), min = a.K.r + 0.45;
    if (d < min && d > 0.001) a.root.position.addScaledVector(tmp, (min - d) / d);
    if (a.root.position.length() > ARENA_R) a.root.position.setLength(ARENA_R);
  }
  // projectiles
  for (const p of S.projectiles) {
    p.t += dt; p.m.position.addScaledVector(p.v, dt);
    fx.burst(p.m.position, 2, 0xff4422, 0.6, 0.3, 0, 0.5);
    if (!P.dead && p.m.position.distanceTo(tmp.copy(P.pos).setY(1.4)) < 0.9) { hurtPlayer(p.dmg, p.m.position); p.dead = true; fx.burst(p.m.position, 25, 0xff4422, 6, 0.5); }
    if (p.t > 2.2) p.dead = true;
    if (p.dead) scene.remove(p.m);
  }
  S.projectiles = S.projectiles.filter(p => !p.dead);
  // vortices
  for (const v of S.vortices) {
    v.t += dt; v.tick -= dt;
    for (const e of S.enemies) {
      if (e.state === 'dead' || e.state === 'spawn') continue;
      tmp.copy(v.c).sub(e.root.position).setY(0); const d = tmp.length();
      if (d < 8 && d > 0.3) e.root.position.addScaledVector(tmp.normalize(), (e.kind === 'brute' ? 1 : 6) * dt);
    }
    if (v.tick <= 0) { v.tick = 0.3; for (const e of S.enemies) if (e.state !== 'dead' && e.root.position.distanceTo(v.c) < 3.5 + e.K.r) damageEnemy(e, S.P.atk * 0.55, { crit: 0.05 }); fx.burst(v.c.clone().setY(1.2), 14, 0xa46bff, 5, 0.6, 0, 3); }
    if (v.t > 3.4 && !v.boom) { v.boom = true; sfx('lightning'); shake = 0.6; fx.shock(v.c, 12, 0xa46bff, 0.6); fx.burst(v.c.clone().setY(1), 90, 0xa46bff, 12, 1, -4, 2); for (const e of S.enemies) if (e.state !== 'dead' && e.root.position.distanceTo(v.c) < 5 + e.K.r) damageEnemy(e, S.P.atk * 3, { kb: 10, from: v.c }); }
  }
  S.vortices = S.vortices.filter(v => v.t < 3.6);
}

function updateWaves(dt) {
  if (S.pending.length) {
    S.spawnT -= dt;
    if (S.spawnT <= 0) { spawnEnemy(S.pending.shift()); S.spawnT = 0.45; hudDirty = true; }
    return;
  }
  const alive = S.enemies.filter(e => e.state !== 'dead').length;
  if (alive === 0 && S.betweenT <= 0 && S.wave > 0) {
    S.betweenT = 3; musicIntense(false);
    if (S.boss) { S.boss = null; $('#bossBar').classList.add('hidden'); }
    if (S.wave >= 3 && !S.endless) {
      S.betweenT = 99; sfx('victory'); banner('VICTORY<small>THE LEGION IS BROKEN</small>');
      setTimeout(() => { if (S.mode !== 'play') return; S.mode = 'win'; $('#winTxt').textContent = `Level ${S.P.lv} · ${S.kills} enemies destroyed · ${Math.floor(S.time / 60)}m ${Math.floor(S.time % 60)}s`; show('win'); }, 2200);
    } else {
      banner('WAVE CLEARED<small>+1 POTION</small>'); sfx('level'); S.P.potions = Math.min(5, S.P.potions + 1); hudDirty = true;
    }
  }
  if (S.betweenT > 0) { S.betweenT -= dt; if (S.betweenT <= 0 && S.betweenT > -1 && (S.wave < 3 || S.endless)) nextWave(); }
}

// ---------- camera ----------
const camTarget = new THREE.Vector3(), camLook = new THREE.Vector3();
let titleT = 0;
function updateCamera(dt) {
  const P = S.P;
  if (S.mode === 'title') {
    titleT += dt * 0.12;
    const yaw = Math.sin(titleT) * 0.5;
    camera.position.set(P.pos.x + Math.sin(yaw) * 7.5, 3.2, P.pos.z + Math.cos(yaw) * 7.5);
    camera.lookAt(P.pos.x + 1.2, 4.2, P.pos.z - 10);
    return;
  }
  const cp = Math.cos(camPitch);
  camTarget.set(P.pos.x + Math.sin(camYaw) * cp * camDist + Math.cos(camYaw) * 1.5, P.pos.y + 1.5 + Math.sin(camPitch) * camDist, P.pos.z + Math.cos(camYaw) * cp * camDist - Math.sin(camYaw) * 1.5);
  camera.position.lerp(camTarget, Math.min(1, dt * 8));
  const f = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)), r = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
  camLook.copy(P.pos).addScaledVector(f, 5).addScaledVector(r, 3.4).setY(2.4);
  if (shake > 0) { camera.position.x += (Math.random() - .5) * shake * 0.5; camera.position.y += (Math.random() - .5) * shake * 0.5; shake = Math.max(0, shake - dt * 2.5); }
  camera.lookAt(camLook);
}

// ---------- main loop ----------
let last = performance.now(), time = 0, perfAcc = 0, perfN = 0, perfChecked = false;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.mode === 'play') { perfAcc += dt; perfN++; if (!perfChecked && perfN > 120) { perfChecked = true; if (perfAcc / perfN > 1 / 38 && pr > 1) { pr = 1; renderer.setPixelRatio(pr); resize(); $('#qualBtn').textContent = 'QUALITY: LOW'; } } }
  if (S.mode === 'paused') { composer.render(); return; }
  let gdt = dt;
  if (hitstop > 0) { hitstop -= dt; gdt = dt * 0.08; }
  time += gdt;
  if (S.mode === 'play') { S.time += gdt; updatePlayer(gdt); updateEnemies(gdt, time); updateWaves(gdt); }
  else if (S.mode === 'over') updateEnemies(gdt, time);
  const P = S.P;
  hero.root.visible = !P.dead;
  hero.update(gdt, { moveAmt: S.mode === 'play' ? P.moveAmt : 0, atk: P.atkT >= 0 ? { p: P.atkT / P.atkDur, side: P.combo === 1 ? -1 : 1 } : null, dash: P.dashT > 0, cast: P.castT > 0 ? Math.sin(P.castT / 0.45 * Math.PI) : 0 });
  world.update(gdt, time);
  fx.update(gdt);
  updateCamera(dt);
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('#banner').classList.remove('on'); }
  if (S.mode !== 'title') { updateHUD(); updateNums(dt); }
  composer.render();
}
updateCamera(0);
requestAnimationFrame(frame);
$('#loading').classList.add('gone'); setTimeout(() => $('#loading').remove(), 700);
if (params.get('autostart')) startGame();
