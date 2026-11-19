import * as THREE from 'three';
import { ARENA_R } from './world.js';
import { makeEnemy, animateEnemy, setFlash, updateHpBar } from './enemies.js';
import { STAGES, REALMS, ENEMY_INFO, SKILLS, SKILL_RANK_MULT, RELICS, TUTORIAL, stageScale } from './data.js';
import { playerStats, expToNext, hasRelic, writeSave } from './save.js';
import { sfx, playMusic } from './audio.js';
import { drawIcon } from './textures.js';

const $ = s => document.querySelector(s);
const V = () => new THREE.Vector3();
const tmp = V(), tmp2 = V(), tmp3 = V();
const fwd = h => new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
const angTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export function createGame(env) {
  const { scene, camera, world, hero, fx, isTouch } = env;
  let save = null, settings = env.settings;
  let S = null;
  const cam = { yaw: 0, pitch: 0.3, dist: 9.2, shake: 0 };
  const input = { mx: 0, my: 0, atk: false, rise: 0, sink: 0 };
  let hitstop = 0, slowmo = 0, flyHintDone = false;

  // lock-on markers
  const lockMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const lockRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 4, 1), lockMat); lockRing.rotation.x = -Math.PI / 2; scene.add(lockRing); lockRing.visible = false;
  const softMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.5, 0.3), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const softRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.98, 32, 1), softMat); softRing.rotation.x = -Math.PI / 2; scene.add(softRing); softRing.visible = false;

  // ------------------------------------------------------------ stage setup
  function startStage(id, sv) {
    save = sv;
    clearField();
    const info = STAGES[id], realm = REALMS[info.realm];
    world.setPalette(realm.pal);
    const st = playerStats(save);
    const tutorial = !!info.tutorial && !save.tutorialDone;
    S = {
      id, info, realm, mode: 'intro', t: 0, introT: 0, endT: 0, result: null,
      P: {
        pos: new THREE.Vector3(0, 0, 9), heading: Math.PI, ...st, hp: st.maxHp, mp: st.maxMp, sh: st.maxSh, shT: 0,
        combo: 0, comboT: 0, atkIdx: -1, atkT: 0, atkDur: 0.3, atkHit: false, queued: false,
        dodgeT: 0, dodgeCd: 0, dodgeDir: V(), inv: 0, perfect: false, cd: {}, castT: 0, hitT: 0, deadT: -1, moveAmt: 0, potions: 3, hits13: 0, victory: false,
        fly: 0, flyOn: false, vy: 0, wasAir: false,
      },
      enemies: [], projectiles: [], hazards: [], vortices: [], pblades: [], strikes: [],
      waveIdx: -1, pending: [], spawnT: 0, betweenT: 0, bosses: [], cine: null,
      surviveLeft: info.survive || 0, survSpawnT: 1,
      stats: { kills: 0, dmgDealt: 0, dmgTaken: 0, maxCombo: 0, combo: 0, comboTimer: 0, potions: 0, shards: 0, exp: 0, levels: 0 },
      lock: null, soft: null,
      tut: tutorial ? { step: 0, t: 0, moved: 0, rot: 0, wallT: 0 } : null,
      scale: stageScale(id),
    };
    for (const k of save.equip) if (k) S.P.cd[k] = 0;
    if (!flyHintDone && !tutorial) S.hintT = 3.2;
    hero.root.position.copy(S.P.pos); hero.root.rotation.y = S.P.heading;
    cam.yaw = 0; cam.pitch = 0.3; cam.dist = 9.2;
    camera.position.set(0, 18, -14);
    setupSkillButtons();
    $('#bossBar').classList.add('hidden'); $('#tutBox').classList.add('hidden');
    $('#stageName').textContent = `${realm.sub} · Stage ${id}`;
    hudDirty = true;
    banner(`${info.name}<small>${realm.sub.toUpperCase()} · STAGE ${id} — ${objectiveText(true).toUpperCase()}</small>`, false, 3.2);
    playMusic(info.type === 'boss' ? 'boss' : 'stage');
    sfx('horn');
    updateHUD(true);
  }
  function objectiveText(short) {
    const i = S.info;
    if (i.type === 'waves') return short ? 'Defeat all enemies' : `Defeat all enemies (Wave ${Math.max(1, S.waveIdx + 1)}/${i.waves.length})`;
    if (i.type === 'survive') return short ? `Survive ${i.survive} seconds` : `Survive the onslaught: ${Math.ceil(S.surviveLeft)}s`;
    return short ? `Defeat ${ENEMY_INFO[i.boss === 'twins' ? 'warlord' : i.boss].name}` : `Defeat ${i.boss === 'twins' ? 'the Twin Warlords' : ENEMY_INFO[i.boss].name}`;
  }
  function clearField() {
    if (!S) return;
    for (const e of S.enemies) scene.remove(e.root);
    for (const p of S.projectiles) fx.remove(p.m);
    for (const b of S.pblades) fx.remove(b.m);
    fx.clearAll(); lockRing.visible = softRing.visible = false;
  }
  function stop() { clearField(); S = null; }

  // ------------------------------------------------------------ spawning
  function spawn(kind, pos, opts = {}) {
    const e = makeEnemy(kind, scene, S.scale, opts);
    let p = pos;
    if (!p) {
      for (let tries = 0; tries < 20; tries++) {
        const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 10;
        p = new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r);
        if (p.distanceTo(S.P.pos) > 8) break;
      }
    }
    e.root.position.copy(p); e.root.position.y = e.boss ? 0 : -3; e.state = 'spawn'; e.t = 0; e.windT = e.info.wind;
    e.root.rotation.y = angTo(p, S.P.pos);
    fx.shock(p, e.boss ? 8 : 3, 0xff3322, 0.8); fx.burst(p.clone().setY(0.3), e.boss ? 80 : 26, 0xff3322, 5, 0.9, 2, 2, 1);
    updateHpBar(e);
    if (S.tut && S.tut.step < 3) e.cd = 999;
    S.enemies.push(e); hudDirty = true;
    return e;
  }
  function startWave(i) {
    S.waveIdx = i; S.pending = S.info.waves[i].slice(); S.spawnT = 0.8;
    if (i > 0 && S.waveBannerShown !== i) { S.waveBannerShown = i; banner(`WAVE ${i + 1}<small>OF ${S.info.waves.length}</small>`); sfx('horn'); }
    hudDirty = true;
  }
  function spawnBoss() {
    const b = S.info.boss;
    if (b === 'twins') {
      const a = spawn('warlord', new THREE.Vector3(-6, 0, -8), { hpMul: 0.6 }), c = spawn('warlord2', new THREE.Vector3(6, 0, -8), { hpMul: 0.6 });
      a.bossName = 'Warlord of Dusk'; c.bossName = 'Warlord of Dawn'; S.bosses = [a, c];
    } else {
      const e = spawn(b, new THREE.Vector3(0, 0, -9)); e.bossName = ENEMY_INFO[b].name; S.bosses = [e];
    }
    for (const k of S.info.adds) S.pending.push(k);
    S.spawnT = 2.5;
    S.cine = { t: 0, dur: 2.2, target: S.bosses[0] };
    $('#bossBar').classList.remove('hidden');
    sfx('roar'); cam.shake = 1;
    banner(`${b === 'twins' ? 'THE TWIN WARLORDS' : ENEMY_INFO[b].name.toUpperCase()}<small>${b === 'shade' ? 'YOUR SHADOW REMEMBERS EVERY STRIKE' : b === 'seraph' ? 'THE HOLLOW CHOIR SINGS' : 'BREAKER OF SEALS'}</small>`, true, 2.6);
    hudDirty = true;
  }

  // ------------------------------------------------------------ combat helpers
  function dmgEnemy(e, base, o = {}) {
    if (!e || e.state === 'dead' || e.state === 'spawn' || e.invuln) return false;
    const P = S.P;
    let mult = 1;
    // Bulwark: frontal guard
    if (e.kind === 'shield' && !e.guardBroken && e.state !== 'stagger' && e.frozen <= 0) {
      const facing = fwd(e.root.rotation.y), from = (o.from || P.pos);
      tmp3.copy(from).sub(e.root.position).setY(0).normalize();
      if (facing.dot(tmp3) > 0.35 && !o.pierce) {
        if (o.heavy) { e.guardBroken = 3; dmgNum(e.root.position.clone().setY(3), 'GUARD BREAK', 'crit'); sfx('crit'); }
        else { mult = 0.15; if (!e.blockT || e.blockT < 0) { dmgNum(e.root.position.clone().setY(3), 'BLOCK', 'block'); sfx('block'); e.blockT = 0.3; fx.burst(e.root.position.clone().setY(1.6).addScaledVector(facing, 0.6), 10, 0xffd080, 6, 0.3, -9); } }
      }
    }
    if (e.frozen > 0) mult *= 1.2;
    const crit = Math.random() < (o.crit ?? P.crit);
    P.hits13++;
    let sig = false;
    if (hasRelic(save, 'sigil') && P.hits13 % 13 === 0) { mult *= 13; sig = true; }
    const dmg = Math.max(1, Math.round(base * mult * (0.9 + Math.random() * 0.2) * (crit ? P.critMult : 1)));
    S.stats.dmgDealt += Math.min(dmg, Math.max(0, e.hp));
    e.hp -= dmg; updateHpBar(e);
    S.stats.combo++; S.stats.comboTimer = 2.4; S.stats.maxCombo = Math.max(S.stats.maxCombo, S.stats.combo);
    if (e.frozen <= 0) { e.flashT = 0.05; setFlash(e, 'hit'); }
    const hp = e.root.position.clone(); hp.y += e.info.h * 0.6;
    dmgNum(hp, sig ? `${dmg} ✶13` : dmg, sig ? 'crit' : crit ? 'crit' : '');
    fx.burst(hp, crit ? 16 : 8, crit ? 0xffd060 : 0x3fb8ff, 7, 0.4, -9);
    fx.burst(hp, 5, 0xff3322, 4, 0.4, -9);
    sfx(crit ? 'crit' : 'hit');
    if (crit || sig) { hitstop = Math.max(hitstop, 0.05); cam.shake = Math.max(cam.shake, 0.25 * settings.shake); }
    if (o.kb && !e.boss) {
      tmp2.copy(e.root.position).sub(o.from || P.pos).setY(0).normalize();
      e.vel.addScaledVector(tmp2, o.kb * (e.kind === 'shield' && !e.guardBroken ? 0.3 : 1));
      if (e.state !== 'strike' || o.kb >= 8) { if (e.kind !== 'shield' || e.guardBroken || o.heavy) { e.state = 'stagger'; e.t = 0; } }
    }
    if (e.hp <= 0) killEnemy(e, o);
    else if (e.boss) checkBossPhase(e);
    hudDirty = true;
    return true;
  }
  function killEnemy(e, o = {}) {
    e.state = 'dead'; e.t = 0; S.stats.kills++;
    if (e.frozen > 0) { e.frozen = 0; setFlash(e, false); }
    const p = e.root.position.clone(); p.y += e.info.h * 0.5;
    const big = e.boss;
    fx.burst(p, big ? 220 : 50, 0xff3a22, big ? 14 : 8, big ? 1.6 : 0.9, -5, big ? 4 : 1.5);
    fx.burst(p, big ? 140 : 30, 0x4fc8ff, big ? 12 : 6, 1.2, 3, 2, 1);
    fx.shock(e.root.position, big ? 14 : 4, 0xff4422, 0.6);
    sfx('edeath'); if (big) { sfx('slam'); cam.shake = 1.2 * settings.shake; hitstop = 0.18; slowmo = 1.2; }
    const sh = e.info.shards; S.stats.shards += sh; dmgNum(p.clone().setY(p.y + 0.6), `+${sh} ◆`, 'shard', 0.8);
    if (hasRelic(save, 'rose')) { const h = Math.round(S.P.maxHp * 0.03); S.P.hp = Math.min(S.P.maxHp, S.P.hp + h); }
    gainExp(Math.round(e.info.exp * (1 + 0.1 * (S.id - 1))));
    if (e.kind === 'wisp') { // chain detonation: hurts enemies only when you kill it
      fx.shock(e.root.position, 7, 0xff6a2a, 0.5); fx.burst(e.root.position.clone().setY(1.2), 60, 0xff6a2a, 10, 0.7, -3); sfx('explode');
      for (const o2 of S.enemies) if (o2 !== e && o2.state !== 'dead' && o2.root.position.distanceTo(e.root.position) < 3.2 + o2.info.r) dmgEnemy(o2, 40 * S.scale.dmg + S.P.atk, { kb: 9, from: e.root.position, crit: 0 });
    }
    if (S.lock === e) S.lock = null;
    if (S.bosses.includes(e) && S.info.boss === 'twins') {
      const other = S.bosses.find(b => b !== e && b.state !== 'dead');
      if (other && !other.enraged) { other.enraged = true; other.phase2 = true; banner('THE SURVIVOR RAGES<small>HIS TWIN HAS FALLEN</small>', true); sfx('roar'); }
    }
    hudDirty = true;
  }
  function checkBossPhase(e) {
    if (!e.phase2 && e.hp < e.maxHp * 0.5) {
      e.phase2 = true; e.enraged = true; sfx('roar'); cam.shake = 1 * settings.shake; fx.shock(e.root.position, 16, 0xff2211, 0.9);
      const msg = { warlord: 'THE WARLORD IS ENRAGED<small>PHASE 2 — KNIGHTS ANSWER HIS CALL</small>', warlord2: 'ENRAGED<small>PHASE 2</small>', seraph: 'THE SERAPH WEEPS FIRE<small>PHASE 2 — METEORS INCOMING</small>', shade: 'THE SHADE TEARS THE SEAL<small>PHASE 2 — THE VOID PULLS</small>' }[e.kind];
      banner(msg, true, 2.2);
      if (e.kind === 'warlord' && S.info.boss !== 'twins') { S.pending.push('knight', 'knight', 'hound'); S.spawnT = 0.6; }
      if (e.kind === 'seraph') { S.pending.push('wisp', 'wisp'); S.spawnT = 0.8; }
      hudDirty = true;
    }
  }
  function gainExp(n) {
    S.stats.exp += n; save.exp += n;
    while (save.exp >= expToNext(save.lv)) {
      save.exp -= expToNext(save.lv); save.lv++; S.stats.levels++;
      const st = playerStats(save), P = S.P;
      Object.assign(P, { maxHp: st.maxHp, maxMp: st.maxMp, atk: st.atk, maxSh: st.maxSh });
      P.hp = P.maxHp; P.mp = P.maxMp; P.sh = P.maxSh;
      banner(`LEVEL ${save.lv}<small>POWER OF THE THIRTEENTH RISES</small>`); sfx('level');
      fx.burst(P.pos.clone().setY(0.5), 120, 0xb66bff, 8, 1.4, 4, 2, 1); fx.shock(P.pos, 10, 0xb66bff, 0.8);
      dmgNum(P.pos.clone().setY(3.3), 'LEVEL UP!', 'lvl');
    }
    hudDirty = true;
  }
  function hurtPlayer(dmg, from, o = {}) {
    const P = S.P; if (P.deadT >= 0 || S.mode !== 'play') return false;
    // airborne: ground-bound attacks whiff beneath the Heir. Only attacks flagged
    // air-capable (projectiles, beams, sky-fire, boss leaps) can reach him, and
    // some of those only up to a ceiling (o.airMax).
    if (P.pos.y > 2.3 && (!o.air || (o.airMax && P.pos.y > o.airMax))) return false;
    if (P.dodgeT > 0 || P.inv > 0) {
      if (P.dodgeT > 0 && !P.perfect) {
        P.perfect = true; slowmo = 0.7; sfx('perfect');
        P.mp = Math.min(P.maxMp, P.mp + 15 + (hasRelic(save, 'cloak') ? 20 : 0));
        dmgNum(P.pos.clone().setY(2.8), 'PERFECT DODGE', 'perfect');
        fx.burst(P.pos.clone().setY(1.2), 40, 0x9fe8ff, 6, 0.6, 0, 2);
      }
      return false;
    }
    dmg = Math.round(dmg * (0.9 + Math.random() * 0.2) * (1 - P.guard));
    let rest = dmg;
    if (P.sh > 0) { const a = Math.min(P.sh, rest * 0.6); P.sh -= a; rest -= a; }
    S.stats.dmgTaken += Math.min(dmg, Math.max(0, P.hp) + (dmg - rest));
    P.hp -= rest; P.shT = 3.5; P.inv = 0.3; P.hitT = 0.3;
    dmgNum(P.pos.clone().setY(2.6), `-${dmg}`, 'hurt');
    sfx('hurt'); cam.shake = Math.max(cam.shake, 0.45 * settings.shake);
    const vg = $('#vignette'); vg.classList.add('hurt'); setTimeout(() => vg.classList.remove('hurt'), 220);
    fx.burst(P.pos.clone().setY(1.5), 20, 0xff3322, 6, 0.5, -8);
    if (from) { tmp2.copy(P.pos).sub(from).setY(0).normalize(); P.pos.addScaledVector(tmp2, o.kb || 0.6); }
    P.atkIdx = -1;
    hudDirty = true;
    if (P.hp <= 0) { P.hp = 0; P.deadT = 0; sfx('defeat'); playMusic(null); fx.burst(P.pos.clone().setY(1.5), 150, 0x4fc8ff, 10, 1.5, -2, 2); }
    return true;
  }
  const alive = () => S.enemies.filter(e => e.state !== 'dead');
  function nearest(maxD, from = S.P.pos, filter) {
    let best = null, bd = maxD;
    for (const e of S.enemies) { if (e.state === 'dead' || e.state === 'spawn' || (filter && !filter(e))) continue; const d = e.root.position.distanceTo(from) - e.info.r; if (d < bd) { bd = d; best = e; } }
    return best;
  }
  function target(maxD) { if (S.lock && S.lock.state !== 'dead' && S.lock.root.position.distanceTo(S.P.pos) < maxD + 6) return S.lock; return nearest(maxD); }

  // ------------------------------------------------------------ player actions
  const canAct = () => S && S.mode === 'play' && S.P.deadT < 0 && !S.cine;
  function attack() {
    if (!canAct()) return; const P = S.P;
    if (P.dodgeT > 0) return;
    if (P.atkIdx >= 0) { if (P.atkT > P.atkDur * 0.45) P.queued = true; return; }
    P.combo = P.comboT > 0 ? (P.combo + 1) % 3 : 0;
    P.atkIdx = P.combo; P.atkDur = P.combo === 2 ? 0.46 : 0.3; P.atkT = 0; P.atkHit = 0; P.queued = false;
    const t = target(7); if (t) P.heading = angTo(P.pos, t.root.position);
    sfx('slash', P.combo === 2 ? 1.3 : 1 + P.combo * 0.06);
    if (S.tut && S.tut.step === 1) tutNext();
    if (S.tut && S.tut.step === 2 && P.combo === 2) S.tut.comboDone = true;
  }
  function attackHit(second) {
    const P = S.P, f = fwd(P.heading), heavy = P.combo === 2;
    // sword arcs live at the Heir's own height: from altitude he can only strike
    // tall or flying foes — ground foes must be swooped at (descend to reach them)
    const c = P.pos.clone().setY(P.pos.y + 1.2);
    fx.arc(c, P.heading, heavy ? 3.8 : 3.0, heavy ? 0x9fe8ff : 0x4fb8ff, P.combo === 1 ? -1 : 1, P.combo === 1 ? 0.25 : -0.15);
    let any = false;
    for (const e of S.enemies) {
      if (e.state === 'dead' || e.state === 'spawn') continue;
      if (P.pos.y > e.info.h + 0.9) continue;
      tmp2.copy(e.root.position).sub(P.pos).setY(0); const d = tmp2.length() - e.info.r;
      const inArc = d < (heavy ? 3.6 : 3.0) && (d < 0.6 || tmp2.normalize().dot(f) > 0.2);
      const inRing = heavy && d < 3.8;
      if (inArc || inRing) {
        const hit = dmgEnemy(e, P.atk * (heavy ? 1.9 : 1 + P.combo * 0.15), { kb: heavy ? 9 : 4, heavy });
        any = hit || any;
        if (heavy && hit) fx.bolt(P.pos.clone().setY(1.4), e.root.position.clone().setY(1.4), [0.5, 1.4, 2.8], 0.05, 0.18);
      }
    }
    if (heavy) { fx.shock(P.pos, 8, 0x5fd8ff, 0.4); fx.ringBurst(P.pos, 40, 0x5fd8ff, 10); cam.shake = Math.max(cam.shake, 0.3 * settings.shake); sfx('lightning'); }
    if (any) { hitstop = Math.max(hitstop, heavy ? 0.08 : 0.035); cam.shake = Math.max(cam.shake, (heavy ? 0.35 : 0.12) * settings.shake); }
  }
  function dodge() {
    if (!canAct()) return; const P = S.P;
    if (P.dodgeCd > 0 || P.dodgeT > 0) return;
    const d = moveVec.lengthSq() > 0.01 ? moveVec.clone().normalize() : fwd(P.heading + Math.PI);
    P.dodgeDir.copy(d); P.dodgeT = 0.3; P.inv = 0.38; P.perfect = false; P.atkIdx = -1;
    P.dodgeCd = 0.85 * (hasRelic(save, 'cloak') ? 0.65 : 1);
    P.heading = Math.atan2(d.x, d.z);
    sfx('dodge'); fx.burst(P.pos.clone().setY(1.2), 24, 0x9fe8ff, 4, 0.5, 0, 1.5);
    if (S.tut && S.tut.step === 3) tutNext();
  }
  function potion() {
    if (!canAct()) return; const P = S.P;
    if (P.potions <= 0 || (P.hp >= P.maxHp && P.mp >= P.maxMp)) return;
    P.potions--; S.stats.potions++;
    const h = Math.round(P.maxHp * 0.45); P.hp = Math.min(P.maxHp, P.hp + h); P.mp = Math.min(P.maxMp, P.mp + P.maxMp * 0.3);
    sfx('potion'); dmgNum(P.pos.clone().setY(2.6), `+${h}`, 'heal'); fx.burst(P.pos.clone().setY(0.3), 60, 0x6dff8a, 4, 1.1, 5, 2, 1);
    hudDirty = true;
  }
  function toggleLock() {
    if (!canAct()) return;
    if (S.lock) { S.lock = null; sfx('back'); return; }
    S.lock = nearest(22); if (S.lock) sfx('ui');
  }
  // ------------------------------------------------------------ flight
  // Toggle flight: tap once to take off and stay airborne, tap again to land.
  // Flight costs nothing — no MP, no stamina, no meter.
  const FLY_HOVER = 3.4, FLY_MAX = 9.5;
  function toggleFly() {
    if (!canAct()) return; const P = S.P;
    if (P.dodgeT > 0) return;
    P.flyOn = !P.flyOn;
    flyHintDone = true;
    if (P.flyOn) { sfx('gale', 0.9); fx.ringBurst(P.pos.clone().setY(0.2), 30, 0x5fd8ff, 9); fx.burst(P.pos.clone().setY(0.4), 24, 0x5dff8a, 5, 0.6, 2, 1.5); if (S.tut && S.tut.step === 6) tutNext(); }
    else sfx('dodge', 0.8);
    hudDirty = true;
  }
  const rankMul = k => SKILL_RANK_MULT[(save.skills[k] || 1) - 1];
  function skill(slot) {
    if (!canAct()) return; const P = S.P;
    const k = save.equip[slot]; if (!k) return;
    const sk = SKILLS[k], cost = Math.round(sk.mp * P.mpCost);
    if (P.cd[k] > 0) return;
    if (P.mp < cost) { sfx('nomp'); dmgNum(P.pos.clone().setY(2.6), 'NO MP', 'hurt', 0.6); return; }
    P.mp -= cost; P.cd[k] = sk.cd * (save.skills[k] >= 3 ? 0.85 : 1); hudDirty = true; P.atkIdx = -1;
    const m = rankMul(k);
    const storm = hasRelic(save, 'storm') ? 1.3 : 1, voidB = hasRelic(save, 'lens') ? 1.3 : 1;
    const t = target(12);
    if (S.tut && S.tut.step === 4) tutNext();
    if (k === 'lightning') {
      P.castT = 0.45; sfx('lightning'); cam.shake = 0.7 * settings.shake; hitstop = 0.06;
      fx.shock(P.pos, 11, 0x3fb8ff, 0.5); fx.ringBurst(P.pos, 40, 0x3fb8ff, 14);
      fx.bolt(P.pos.clone().setY(14), P.pos.clone().addScaledVector(fwd(P.heading), 1.5).setY(0.2), [0.7, 1.7, 3.2], 0.1, 0.25);
      const ts = S.enemies.filter(e => e.state !== 'dead' && e.state !== 'spawn' && e.root.position.distanceTo(P.pos) < 11).sort((a, b) => a.root.position.distanceTo(P.pos) - b.root.position.distanceTo(P.pos)).slice(0, 6);
      ts.forEach((e, i) => S.strikes.push({ t: 0.06 + i * 0.07, fn: () => {
        if (e.state === 'dead') return;
        const top = e.root.position.clone().setY(16).add(new THREE.Vector3((Math.random() - .5) * 4, 0, (Math.random() - .5) * 4));
        fx.bolt(top, e.root.position.clone().setY(0.2), [0.7, 1.7, 3.2], 0.12, 0.28);
        fx.shock(e.root.position, 3, 0x7fe8ff, 0.35);
        dmgEnemy(e, P.atk * 2.4 * m * storm, { kb: 6, crit: P.crit + 0.1, heavy: true });
      } }));
      for (const e of S.enemies) if (e.state !== 'dead' && e.root.position.distanceTo(P.pos) < 4 + e.info.r && !ts.includes(e)) dmgEnemy(e, P.atk * 1.4 * m * storm, { kb: 8 });
    } else if (k === 'nova') {
      P.castT = 0.4; sfx('freeze'); cam.shake = 0.5 * settings.shake;
      fx.iceBurst(P.pos, 7, 22); fx.shock(P.pos, 14, 0x9fe8ff, 0.6); fx.ringBurst(P.pos, 50, 0xbff6ff, 12);
      for (const e of S.enemies) if (e.state !== 'dead' && e.state !== 'spawn' && e.root.position.distanceTo(P.pos) < 7 + e.info.r) {
        dmgEnemy(e, P.atk * 1.6 * m * storm, { crit: P.crit });
        if (e.state !== 'dead') { e.frozen = e.boss ? 1.0 : 2.5 + (save.skills.nova - 1) * 0.5; setFlash(e, 'frost'); if (!e.boss) { e.state = 'approach'; e.t = 0; } }
      }
    } else if (k === 'blades') {
      sfx('blades'); P.castT = 0.25;
      if (t) P.heading = angTo(P.pos, t.root.position);
      for (let i = -2; i <= 2; i++) {
        const dir = fwd(P.heading + i * 0.22), mesh = fx.bladeMesh();
        mesh.position.copy(P.pos).setY(P.pos.y + 1.3); mesh.rotation.y = P.heading + i * 0.22;
        S.pblades.push({ m: mesh, v: dir.multiplyScalar(26), t: 0, hit: new Set(), dmg: P.atk * 1.1 * m * voidB });
      }
    } else if (k === 'vortex') {
      const c = t ? t.root.position.clone().setY(0) : P.pos.clone().addScaledVector(fwd(P.heading), 5);
      if (c.length() > ARENA_R - 2) c.setLength(ARENA_R - 2);
      P.castT = 0.4; sfx('vortex'); cam.shake = 0.3 * settings.shake;
      fx.vortex(c, 3.6);
      S.vortices.push({ c, t: 0, tick: 0, dmg: P.atk * m * voidB, pull: hasRelic(save, 'lens') ? 9 : 6 });
    } else if (k === 'gale') {
      if (t) P.heading = angTo(P.pos, t.root.position);
      sfx('gale'); P.castT = 0.3; cam.shake = 0.5 * settings.shake;
      const f = fwd(P.heading); fx.cone(P.pos, f, 9); fx.burst(P.pos.clone().addScaledVector(f, 2).setY(1), 50, 0x5dff7a, 12, 0.6, 0, 2);
      hero.wings.forEach(w => w.piv.rotation.y -= w.s * 0.8);
      for (const e of S.enemies) {
        if (e.state === 'dead' || e.state === 'spawn') continue;
        tmp2.copy(e.root.position).sub(P.pos).setY(0); const d = tmp2.length() - e.info.r;
        if (d < 8.5 && tmp2.normalize().dot(f) > 0.6) dmgEnemy(e, P.atk * 1.8 * m, { kb: 16, heavy: true, pierce: true });
      }
    } else if (k === 'judgment') {
      sfx('judgment'); P.castT = 0.6; P.inv = 2.8; cam.shake = 1 * settings.shake; slowmo = 0.4;
      banner('THIRTEENTH JUDGMENT', false, 1.4);
      for (let i = 0; i < 13; i++) S.strikes.push({ t: 0.25 + i * 0.19, fn: () => {
        const live = S.enemies.filter(e => e.state !== 'dead' && e.state !== 'spawn');
        const e = live.length ? live[(Math.random() * live.length) | 0] : null;
        const p = e ? e.root.position.clone() : S.P.pos.clone().add(new THREE.Vector3((Math.random() - .5) * 14, 0, (Math.random() - .5) * 14));
        fx.pillar(p, [0.8, 1.8, 3.4], 20, 1.0, 0.5); fx.shock(p, 6, 0x9fe8ff, 0.4); fx.bolt(p.clone().setY(20), p.clone().setY(0.1), [0.8, 1.8, 3.4], 0.18, 0.3);
        sfx('lightning'); cam.shake = Math.max(cam.shake, 0.4 * settings.shake);
        for (const o of S.enemies) if (o.state !== 'dead' && o.root.position.distanceTo(p) < 2.6 + o.info.r) dmgEnemy(o, P.atk * 2.2 * m * storm, { kb: 6, heavy: true, pierce: true });
      } });
    }
  }

  // ------------------------------------------------------------ hazards (enemy attacks)
  function hazard(h) {
    h.t = 0; S.hazards.push(h);
    if (h.type === 'circle') fx.telegraph(h.pos, h.r, h.delay);
    else if (h.type === 'line') fx.teleLine(h.pos, h.dir, h.len, h.w, h.delay);
    else if (h.type === 'cone') fx.teleCone(h.pos, h.dir, h.ang, h.r, h.delay);
    return h;
  }
  function hazardHits(h, p) {
    tmp.copy(p).sub(h.pos).setY(0);
    if (h.type === 'circle') return tmp.length() < h.r + 0.3;
    if (h.type === 'line') { const along = tmp.dot(h.dir); if (along < -0.5 || along > h.len + 0.5) return false; return Math.abs(tmp.x * h.dir.z - tmp.z * h.dir.x) < h.w / 2 + 0.3; }
    if (h.type === 'cone') { const d = tmp.length(); if (d > h.r + 0.3) return false; if (d < 0.8) return true; return tmp.normalize().dot(h.dir) > Math.cos(h.ang / 2); }
    return false;
  }
  function updateHazards(dt) {
    for (const h of S.hazards) {
      h.t += dt;
      if (h.type === 'ring') {
        const r = h.maxR * Math.min(1, h.t / h.life);
        if (!h.hit && Math.abs(S.P.pos.distanceTo(h.pos) - r) < 0.7) { if (hurtPlayer(h.dmg, h.pos)) h.hit = true; else if (S.P.dodgeT > 0) h.hit = true; }
        if (h.t >= h.life) h.done = true; continue;
      }
      if (h.src && h.src.state === 'dead' && !h.keep) { h.done = true; continue; }
      if (h.t >= h.delay && !h.done) {
        h.done = true;
        if (hazardHits(h, S.P.pos)) hurtPlayer(h.dmg, h.pos, { kb: h.kb || 0.8, air: h.air, airMax: h.airMax });
        if (h.boom) h.boom(h);
        else { fx.shock(h.pos, (h.r || 3) * 2, 0xff3322, 0.4); fx.burst(h.pos.clone().setY(0.4), 26, 0xff4422, 7, 0.6, -6, 2); sfx('slam'); cam.shake = Math.max(cam.shake, 0.4 * settings.shake); }
      }
    }
    S.hazards = S.hazards.filter(h => !h.done);
  }
  function enemyShot(from, dir, speed, dmg, scale = 1) {
    const m = fx.orbMesh(scale); m.position.copy(from);
    S.projectiles.push({ m, v: dir.clone().normalize().multiplyScalar(speed), t: 0, dmg, r: 0.6 * scale });
  }

  // ------------------------------------------------------------ enemy AI
  function face(e, to, rate, dt) { const ty = angTo(e.root.position, to); e.root.rotation.y += wrap(ty - e.root.rotation.y) * Math.min(1, dt * rate); }
  function windup(e, atk, t) { e.state = 'windup'; e.t = 0; e.atk = atk; e.windT = t; }
  const AI = {
    knight(e, dt, d, dir) {
      const K = e.info, P = S.P;
      if (e.state === 'approach') {
        if (d > K.range * 0.8 + 0.4) e.want = 1;
        face(e, P.pos, 6, dt);
        if (e.cd <= 0 && d < K.range + 0.5) { windup(e, 'slash', K.wind); e.h = hazard({ type: 'cone', pos: e.root.position.clone(), dir: fwd(e.root.rotation.y), ang: 1.7, r: K.range + 0.8, delay: K.wind + 0.08, dmg: K.dmg * e.dmgMul, src: e, boom: () => { } }); sfx('eswing'); }
      } else if (e.state === 'windup' && e.t >= e.windT) { e.state = 'strike'; e.t = 0; }
      else if (e.state === 'strike' && e.t > 0.35) { e.state = 'recover'; e.t = 0; }
      else if (e.state === 'recover' && e.t > 0.5) { e.state = 'approach'; e.cd = 1.1 + Math.random() * 1.2; }
    },
    shield(e, dt, d, dir) {
      const K = e.info, P = S.P;
      if (e.guardBroken > 0) e.guardBroken -= dt;
      if (e.state === 'approach') {
        if (d > K.range) e.want = 0.8;
        face(e, P.pos, 4, dt);
        if (e.cd <= 0 && d < K.range + 1.6) {
          windup(e, 'bash', K.wind); const f = fwd(e.root.rotation.y);
          e.h = hazard({ type: 'line', pos: e.root.position.clone(), dir: f, len: 4.2, w: 1.8, delay: K.wind + 0.18, dmg: K.dmg * e.dmgMul, src: e, kb: 2, boom: () => { } });
          e.chargeDir = f;
        }
      } else if (e.state === 'windup' && e.t >= e.windT) { e.state = 'strike'; e.t = 0; sfx('eswing'); }
      else if (e.state === 'strike') { if (e.t < 0.2) e.root.position.addScaledVector(e.chargeDir, 16 * dt); if (e.t > 0.4) { e.state = 'recover'; e.t = 0; } }
      else if (e.state === 'recover' && e.t > 0.7) { e.state = 'approach'; e.cd = 1.8 + Math.random(); }
    },
    hound(e, dt, d, dir) {
      const K = e.info, P = S.P;
      if (e.state === 'approach') {
        if (d > 7) e.want = 1; else { // circle the hero
          const tang = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(e.phase > 3 ? 1 : -1);
          e.root.position.addScaledVector(tang, K.speed * 0.55 * dt); if (d < 5) e.want = -0.5; e.moveAmt = 0.7;
        }
        face(e, P.pos, 8, dt);
        if (e.cd <= 0 && d < 10) {
          windup(e, 'lunge', K.wind); e.lungeDir = dir.clone();
          e.h = hazard({ type: 'line', pos: e.root.position.clone(), dir: dir.clone(), len: 8.5, w: 1.3, delay: 99, dmg: 0, src: e, boom: () => { } });
        }
      } else if (e.state === 'windup' && e.t >= e.windT) { e.state = 'strike'; e.t = 0; e.hitDone = false; if (e.h) e.h.done = true; sfx('dash'); }
      else if (e.state === 'strike') {
        e.root.position.addScaledVector(e.lungeDir, 24 * dt);
        if (!e.hitDone && e.root.position.distanceTo(P.pos) < 1.3) { e.hitDone = true; hurtPlayer(K.dmg * e.dmgMul, e.root.position); }
        if (e.t > 0.36) { e.state = 'recover'; e.t = 0; }
      } else if (e.state === 'recover' && e.t > 0.7) { e.state = 'approach'; e.cd = 2.2 + Math.random() * 1.5; }
    },
    caster(e, dt, d, dir) {
      const K = e.info, P = S.P;
      e.tpCd = (e.tpCd || 3) - dt;
      if (e.state === 'approach') {
        if (d > 12) e.want = 1; else if (d < 7) e.want = -1;
        face(e, P.pos, 6, dt);
        if (d < 4 && e.tpCd <= 0) { // blink away
          e.tpCd = 6; fx.burst(e.root.position.clone().setY(1.5), 30, 0xff3355, 5, 0.5, 0, 2); sfx('teleport');
          const a = Math.random() * 6.28; e.root.position.set(Math.sin(a) * 15, 0, Math.cos(a) * 15); fx.shock(e.root.position, 3, 0xff3355, 0.4);
        }
        if (e.cd <= 0 && d < 17) windup(e, 'volley', K.wind);
      } else if (e.state === 'windup') { face(e, P.pos, 6, dt); if (e.t >= e.windT) { e.state = 'strike'; e.t = 0; sfx('bolt'); for (const s of [-0.28, 0, 0.28]) { const dd = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), s); dd.y = THREE.MathUtils.clamp((P.pos.y + 1.2 - 1.8) / Math.max(d, 1) * 0.85, -0.4, 1.1); enemyShot(e.root.position.clone().setY(1.8), dd, 10, K.dmg * e.dmgMul); } } }
      else if (e.state === 'strike' && e.t > 0.3) { e.state = 'recover'; e.t = 0; }
      else if (e.state === 'recover' && e.t > 0.5) { e.state = 'approach'; e.cd = 2.6 + Math.random() * 1.4; }
    },
    wisp(e, dt, d, dir) {
      const K = e.info, P = S.P;
      if (e.state === 'approach') {
        e.want = 1; face(e, P.pos, 6, dt);
        if (d < K.range) {
          windup(e, 'blast', K.wind);
          e.h = hazard({ type: 'circle', pos: e.root.position.clone(), r: 3.2, delay: K.wind, dmg: K.dmg * e.dmgMul, src: e, air: true, airMax: 5.5, boom: h => {
            fx.shock(h.pos, 8, 0xff6a2a, 0.5); fx.burst(h.pos.clone().setY(1.2), 70, 0xff6a2a, 10, 0.7, -3); sfx('explode'); cam.shake = Math.max(cam.shake, 0.5 * settings.shake);
            if (e.state !== 'dead') { e.state = 'dead'; e.t = 0; S.stats.kills++; hudDirty = true; }
          } });
        }
      } else if (e.state === 'windup') e.want = 0;
    },
    warlord(e, dt, d, dir) {
      const K = e.info, P = S.P, enr = e.enraged ? 0.78 : 1;
      // anti-camping: a Heir who hovers out of reach gets leapt at
      if (P.pos.y > 3.4 && P.deadT < 0) e.campT = (e.campT || 0) + dt; else e.campT = 0;
      if (e.state === 'approach') {
        if (d > 3.4) e.want = 1;
        face(e, P.pos, 3, dt);
        if (e.cd <= 0) {
          let atk = d < 5 ? (Math.random() < 0.5 ? 'slam' : 'sweep') : (d > 9 ? 'charge' : (Math.random() < 0.4 ? 'charge' : 'slam'));
          if ((e.campT || 0) > 1.6) { atk = 'leap'; e.campT = 0; }
          const f = fwd(e.root.rotation.y), wt = K.wind * enr;
          windup(e, atk, wt);
          if (atk === 'slam') { const c = e.root.position.clone().addScaledVector(dir, 3.3); hazard({ type: 'circle', pos: c, r: 4.6, delay: wt + 0.1, dmg: K.dmg * e.dmgMul, src: e, kb: 2, boom: h => { sfx('slam'); cam.shake = 0.9 * settings.shake; fx.shock(h.pos, 10, 0xff3322, 0.6); fx.ringBurst(h.pos, 50, 0xff4422, 12); fx.burst(h.pos.clone().setY(0.3), 50, 0x334466, 8, 1, -12, 3, 1); if (e.phase2) { fx.ringWave(h.pos, 13, 1.3); S.hazards.push({ type: 'ring', pos: h.pos.clone(), maxR: 13, life: 1.3, t: 0, dmg: K.dmg * e.dmgMul * 0.6 }); } } }); }
          else if (atk === 'sweep') { e.root.rotation.y = angTo(e.root.position, P.pos); hazard({ type: 'cone', pos: e.root.position.clone(), dir: dir.clone(), ang: 2.5, r: 7, delay: wt * 0.85 + 0.1, dmg: K.dmg * e.dmgMul * 0.85, src: e, kb: 2.5, boom: h => { sfx('crit'); cam.shake = 0.6 * settings.shake; fx.arc(h.pos.clone().setY(2), Math.atan2(h.dir.x, h.dir.z), 7, 0xff4422, 1, 0); } }); e.windT = wt * 0.85; }
          else if (atk === 'leap') {
            e.root.rotation.y = angTo(e.root.position, P.pos);
            e.leapFrom = e.root.position.clone(); e.leapTo = P.pos.clone().setY(0);
            hazard({ type: 'circle', pos: e.leapTo.clone(), r: 3.6, delay: wt + 0.55, dmg: K.dmg * e.dmgMul, src: e, kb: 2, air: true, airMax: 99, boom: h => { sfx('slam'); cam.shake = 1 * settings.shake; fx.shock(h.pos, 11, 0xff3322, 0.6); fx.ringBurst(h.pos, 50, 0xff4422, 12); fx.burst(h.pos.clone().setY(0.3), 50, 0x334466, 8, 1, -12, 3, 1); } });
          }
          else { e.root.rotation.y = angTo(e.root.position, P.pos); e.chargeDir = dir.clone(); hazard({ type: 'line', pos: e.root.position.clone(), dir: dir.clone(), len: 15, w: 3, delay: 99, dmg: 0, src: e, boom: () => { } }).isCharge = true; }
        }
      } else if (e.state === 'windup' && e.t >= e.windT) {
        e.state = 'strike'; e.t = 0; e.hitDone = false;
        if (e.atk === 'charge') { sfx('dash'); S.hazards.forEach(h => { if (h.src === e && h.isCharge) h.done = true; }); }
        if (e.atk === 'leap') sfx('dash');
      } else if (e.state === 'strike') {
        if (e.atk === 'leap') {
          const k = Math.min(1, e.t / 0.55);
          e.root.position.lerpVectors(e.leapFrom, e.leapTo, k);
          e.root.position.y = Math.sin(k * Math.PI) * 5.6;
          if (Math.random() < 0.8) fx.burst(e.root.position.clone().setY(e.root.position.y + 1), 3, 0xff4422, 3, 0.4, 0, 2);
          if (k >= 1) { e.root.position.y = 0; e.state = 'recover'; e.t = 0; }
        } else if (e.atk === 'charge') {
          if (e.t < 0.85) { e.root.position.addScaledVector(e.chargeDir, 17 * dt); fx.burst(e.root.position.clone().setY(0.3), 3, 0xff4422, 3, 0.4, 0, 2); if (!e.hitDone && e.root.position.distanceTo(P.pos) < 2.6) { e.hitDone = true; hurtPlayer(K.dmg * e.dmgMul, e.root.position, { kb: 3 }); } }
          if (e.t > 1.0) { e.state = 'recover'; e.t = 0; }
        } else if (e.t > 0.45) { e.state = 'recover'; e.t = 0; }
      } else if (e.state === 'recover' && e.t > 0.8 * enr) { e.state = 'approach'; e.cd = (1.3 + Math.random()) * enr; }
    },
    seraph(e, dt, d, dir) {
      const K = e.info, P = S.P;
      e.tpCd = (e.tpCd ?? 8) - dt;
      if (e.state === 'approach') {
        if (d > 13) e.want = 0.8; else if (d < 8) e.want = -0.8;
        face(e, P.pos, 3, dt);
        if (e.tpCd <= 0) { e.tpCd = 9; sfx('teleport'); fx.burst(e.root.position.clone().setY(3), 60, 0xff3355, 7, 0.7, 0, 3); const a = Math.random() * 6.28; e.root.position.set(Math.sin(a) * 13, 0, Math.cos(a) * 13); fx.pillar(e.root.position, [3, 0.4, 0.5], 16, 2, 0.6); }
        if (e.cd <= 0) {
          const opts = ['spiral', 'lance']; if (e.phase2) opts.push('meteor', 'meteor');
          const atk = opts[(Math.random() * opts.length) | 0];
          windup(e, atk, atk === 'lance' ? 1.1 : 0.8);
          if (atk === 'lance') { const L = hazard({ type: 'line', pos: e.root.position.clone(), dir: dir.clone(), len: 30, w: 2, delay: 1.15, dmg: K.dmg * e.dmgMul * 1.2, src: e, air: true, boom: h => { sfx('beam'); cam.shake = 0.6 * settings.shake; fx.bolt(h.pos.clone().setY(2.5), h.pos.clone().addScaledVector(h.dir, 30).setY(1), [3, 0.4, 0.3], 0.5, 0.5); fx.bolt(h.pos.clone().setY(2.5), h.pos.clone().addScaledVector(h.dir, 30).setY(1), [3, 1, 0.6], 0.2, 0.5); } }); }
          if (atk === 'meteor') { for (let i = 0; i < 6; i++) { const p = P.pos.clone().add(new THREE.Vector3((Math.random() - .5) * (i ? 10 : 0), 0, (Math.random() - .5) * (i ? 10 : 0))); if (p.length() > ARENA_R) p.setLength(ARENA_R); hazard({ type: 'circle', pos: p, r: 2.4, delay: 1.3 + i * 0.12, dmg: K.dmg * e.dmgMul, src: e, keep: true, air: true, boom: h => { fx.pillar(h.pos, [3, 0.5, 0.3], 22, 1.6, 0.5); fx.shock(h.pos, 6, 0xff4422, 0.4); fx.burst(h.pos.clone().setY(0.5), 40, 0xff5a22, 9, 0.7, -8, 2); sfx('explode'); cam.shake = Math.max(cam.shake, 0.4 * settings.shake); } }); } }
        }
      } else if (e.state === 'windup' && e.t >= e.windT) { e.state = 'strike'; e.t = 0; e.shotT = 0; e.spin = Math.random() * 6; }
      else if (e.state === 'strike') {
        if (e.atk === 'spiral') {
          e.shotT -= dt; e.spin += dt * 1.8;
          if (e.shotT <= 0) { e.shotT = 0.16; sfx('bolt'); for (let i = 0; i < (e.phase2 ? 4 : 3); i++) { const a = e.spin + i / (e.phase2 ? 4 : 3) * Math.PI * 2; enemyShot(e.root.position.clone().setY(3.4), new THREE.Vector3(Math.sin(a), THREE.MathUtils.clamp((P.pos.y + 1.2 - 3.4) / 13, -0.3, 0.85), Math.cos(a)), 7.5, K.dmg * e.dmgMul * 0.6, 1.2); } }
          if (e.t > 2.4) { e.state = 'recover'; e.t = 0; }
        } else if (e.t > 0.4) { e.state = 'recover'; e.t = 0; }
      } else if (e.state === 'recover' && e.t > 0.8) { e.state = 'approach'; e.cd = 1.3 + Math.random() * 0.8; }
      if (e.phase2) { e.summonT = (e.summonT ?? 14) - dt; if (e.summonT <= 0 && alive().length < 6) { e.summonT = 16; S.pending.push('wisp', 'wisp'); S.spawnT = 0.3; } }
    },
    shade(e, dt, d, dir) {
      const K = e.info, P = S.P, enr = e.phase2 ? 0.75 : 1;
      if (e.state === 'approach') {
        if (d > 3) e.want = 1;
        face(e, P.pos, 8, dt);
        if (e.cd <= 0) {
          const opts = d < 4 ? ['slash', 'slash', 'dash'] : ['dash', 'rain']; if (e.phase2) opts.push('pull', 'judg');
          const atk = opts[(Math.random() * opts.length) | 0]; e.combo = 0; e.reps = atk === 'dash' ? 3 : atk === 'slash' ? 2 : 1;
          startShade(e, atk, enr);
        }
      } else if (e.state === 'windup' && e.t >= e.windT) { e.state = 'strike'; e.t = 0; e.hitDone = false; if (e.atk === 'dash') { sfx('dash'); S.hazards.forEach(h => { if (h.src === e && h.isCharge) h.done = true; }); } if (e.atk === 'slash') sfx('slash', 1.1); }
      else if (e.state === 'strike') {
        if (e.atk === 'dash') {
          if (e.t < 0.33) { e.root.position.addScaledVector(e.chargeDir, 32 * dt); fx.burst(e.root.position.clone().setY(1.2), 4, 0xff3322, 2, 0.4, 0, 1.5); if (!e.hitDone && e.root.position.distanceTo(P.pos) < 1.6) { e.hitDone = true; hurtPlayer(K.dmg * e.dmgMul, e.root.position, { kb: 1.5 }); } }
          if (e.t > 0.4) { if (--e.reps > 0) startShade(e, 'dash', enr * 0.7); else { e.state = 'recover'; e.t = 0; } }
        } else if (e.atk === 'slash') { if (e.t > 0.35) { e.combo++; if (--e.reps > 0) startShade(e, 'slash', enr * 0.8); else { e.state = 'recover'; e.t = 0; } } }
        else if (e.atk === 'pull') {
          tmp.copy(e.pullC).sub(P.pos).setY(0); if (tmp.length() > 0.5 && P.dodgeT <= 0) P.pos.addScaledVector(tmp.normalize(), 3.2 * dt);
          if (e.t > 2.2) { e.state = 'recover'; e.t = 0; }
        } else if (e.t > 0.5) { e.state = 'recover'; e.t = 0; }
      } else if (e.state === 'recover' && e.t > 0.6 * enr) { e.state = 'approach'; e.cd = (0.9 + Math.random() * 0.7) * enr; }
    },
  };
  AI.warlord2 = AI.warlord;
  function startShade(e, atk, enr) {
    const K = e.info, P = S.P; const dir = tmp3.copy(P.pos).sub(e.root.position).setY(0).normalize().clone();
    windup(e, atk, (atk === 'dash' ? 0.5 : atk === 'slash' ? 0.32 : 0.9) * enr);
    e.root.rotation.y = Math.atan2(dir.x, dir.z);
    if (atk === 'dash') { e.chargeDir = dir; hazard({ type: 'line', pos: e.root.position.clone(), dir, len: 10.5, w: 1.8, delay: 99, dmg: 0, src: e, boom: () => { } }).isCharge = true; }
    if (atk === 'slash') hazard({ type: 'cone', pos: e.root.position.clone(), dir, ang: 2.0, r: 3.6, delay: e.windT + 0.08, dmg: K.dmg * e.dmgMul, src: e, boom: h => fx.arc(h.pos.clone().setY(1.2), Math.atan2(h.dir.x, h.dir.z), 3.4, 0xff3322, 1, 0) });
    if (atk === 'rain') { sfx('bolt'); for (let i = 0; i < 5; i++) { const p = P.pos.clone().add(new THREE.Vector3((Math.random() - .5) * (i ? 9 : 0), 0, (Math.random() - .5) * (i ? 9 : 0))); hazard({ type: 'circle', pos: p, r: 2.2, delay: 1.1 + i * 0.1, dmg: K.dmg * e.dmgMul, src: e, keep: true, air: true, boom: h => { fx.bolt(h.pos.clone().setY(18), h.pos.clone().setY(0.1), [3, 0.4, 0.3], 0.14, 0.3); fx.shock(h.pos, 5, 0xff3322, 0.4); sfx('lightning'); } }); } }
    if (atk === 'pull') { e.pullC = new THREE.Vector3(0, 0, 0); fx.vortex(e.pullC, 3.4); sfx('vortex'); hazard({ type: 'circle', pos: e.pullC.clone(), r: 4.2, delay: 3.0, dmg: K.dmg * e.dmgMul * 1.4, src: e, keep: true, air: true, boom: h => { fx.shock(h.pos, 12, 0xff2a5a, 0.6); fx.burst(h.pos.clone().setY(1), 90, 0xff2a5a, 12, 1, -4, 2); sfx('explode'); cam.shake = 0.8 * settings.shake; } }); }
    if (atk === 'judg') { banner('THIRTEEN SEALS BREAK', true, 1.4); for (let i = 0; i < 13; i++) { const a = i / 13 * Math.PI * 2, r = 3 + (i % 3) * 3.5; const p = P.pos.clone().add(new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)); if (p.length() > ARENA_R) p.setLength(ARENA_R); hazard({ type: 'circle', pos: p, r: 2, delay: 1.0 + i * 0.12, dmg: K.dmg * e.dmgMul * 0.8, src: e, keep: true, air: true, boom: h => { fx.pillar(h.pos, [3, 0.4, 0.4], 18, 1.2, 0.4); sfx('hit'); } }); } }
  }

  function updateEnemies(dt, time) {
    const P = S.P;
    for (const e of S.enemies) {
      e.t += dt; const pos = e.root.position;
      if (e.blockT > 0) e.blockT -= dt;
      if (e.state === 'dead') {
        // death reads as a death: the model plays its fall, a second burst blooms
        // mid-dissolve, and the body shrinks away as it sinks
        animateEnemy(e, dt, time);
        if (!e.deadFx && e.t > 0.22) { e.deadFx = true; fx.burst(pos.clone().setY(Math.max(0.4, pos.y + e.info.h * 0.4)), e.boss ? 90 : 26, 0x4fc8ff, 6, 0.7, -2, 1.5); fx.shock(pos, e.boss ? 9 : 3, 0x7fe8ff, 0.4); }
        pos.y -= dt * 1.5; e.body.rotation.x += dt * 1.2; e.root.scale.multiplyScalar(1 - dt * 0.8);
        if (e.t > 0.9) { scene.remove(e.root); e.removed = true; }
        continue;
      }
      if (e.flashT > 0) { e.flashT -= dt; if (e.flashT <= 0 && e.frozen <= 0) setFlash(e, false); }
      if (e.frozen > 0) { e.frozen -= dt; if (e.frozen <= 0) { setFlash(e, false); fx.burst(pos.clone().setY(1.2), 16, 0xbff6ff, 4, 0.5, -8); } pos.addScaledVector(e.vel, dt); e.vel.multiplyScalar(Math.pow(0.002, dt)); continue; }
      if (e.state === 'spawn') { pos.y = Math.min(0, -3 + e.t * 4); if (e.t > 0.8) { e.state = 'approach'; e.t = 0; pos.y = 0; } animateEnemy(e, dt, time); continue; }
      if (S.cine) { animateEnemy(e, dt, time); continue; }
      tmp.copy(P.pos).sub(pos).setY(0); const d = tmp.length(); const dir = tmp.normalize().clone();
      // tutorial neutering (cd=999) must never outlive the early steps
      if (e.cd > 6 && (!S.tut || S.tut.step >= 3)) e.cd = 1.5;
      e.cd -= dt; e.want = 0;
      if (e.state === 'stagger') { if (e.t > (e.boss ? 0.15 : 0.32)) { e.state = 'approach'; e.t = 0; e.cd = Math.max(e.cd, 0.4); } }
      else if (P.deadT < 0) AI[e.kind](e, dt, d, dir);
      if (e.want) pos.addScaledVector(fwd(e.root.rotation.y).lerp(dir, 0.5).normalize(), e.want * e.info.speed * (e.enraged ? 1.3 : 1) * dt);
      pos.addScaledVector(e.vel, dt); e.vel.multiplyScalar(Math.pow(0.002, dt));
      e.moveAmt = (e.moveAmt || 0) + ((Math.abs(e.want) > 0 ? 1 : 0) - (e.moveAmt || 0)) * Math.min(1, dt * 8);
      animateEnemy(e, dt, time);
    }
    S.enemies = S.enemies.filter(e => !e.removed);
    // separation + bounds
    const L = S.enemies;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (a.state === 'dead' || a.state === 'spawn') continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (b.state === 'dead' || b.state === 'spawn') continue;
        tmp.copy(b.root.position).sub(a.root.position).setY(0); const d = tmp.length(), min = a.info.r + b.info.r;
        if (d < min && d > 0.001) { tmp.multiplyScalar((min - d) / d * 0.5); const wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1; a.root.position.addScaledVector(tmp, -wa); b.root.position.addScaledVector(tmp, wb); }
      }
      tmp.copy(a.root.position).sub(S.P.pos).setY(0); const d = tmp.length(), min = a.info.r + 0.45;
      if (d < min && d > 0.001 && S.P.deadT < 0) a.root.position.addScaledVector(tmp, (min - d) / d);
      if (a.root.position.length() > ARENA_R) a.root.position.setLength(ARENA_R);
      a.root.position.y = Math.max(a.root.position.y, a.state === 'spawn' ? -3 : 0);
    }
    // enemy projectiles
    for (const p of S.projectiles) {
      p.t += dt; p.m.position.addScaledVector(p.v, dt);
      if (Math.random() < 0.5) fx.burst(p.m.position, 1, 0xff4422, 0.6, 0.3, 0, 0.5);
      if (P.deadT < 0 && p.m.position.distanceTo(tmp.copy(P.pos).setY(P.pos.y + 1.4)) < p.r + 0.5) { if (hurtPlayer(p.dmg, p.m.position, { air: true })) { p.dead = true; fx.burst(p.m.position, 20, 0xff4422, 6, 0.5); } }
      if (p.t > 4 || p.m.position.length() > ARENA_R + 6) p.dead = true;
      if (p.dead) fx.remove(p.m);
    }
    S.projectiles = S.projectiles.filter(p => !p.dead);
    // player blades
    for (const b of S.pblades) {
      b.t += dt; b.m.position.addScaledVector(b.v, dt); b.m.rotation.z += dt * 20;
      if (Math.random() < 0.6) fx.burst(b.m.position, 1, 0x4dffd2, 0.5, 0.25, 0, 0.3);
      for (const e of S.enemies) if (!b.hit.has(e) && e.state !== 'dead' && e.state !== 'spawn' && tmp.copy(e.root.position).setY(Math.min(e.info.h * 0.55, Math.max(0.6, b.m.position.y))).distanceTo(b.m.position) < e.info.r + 0.6) { b.hit.add(e); dmgEnemy(e, b.dmg, { kb: 3, from: b.m.position.clone().addScaledVector(b.v, -0.1) }); }
      if (b.t > 0.65) { b.dead = true; fx.remove(b.m); }
    }
    S.pblades = S.pblades.filter(b => !b.dead);
    // vortices
    for (const v of S.vortices) {
      v.t += dt; v.tick -= dt;
      for (const e of S.enemies) {
        if (e.state === 'dead' || e.state === 'spawn') continue;
        tmp.copy(v.c).sub(e.root.position).setY(0); const d = tmp.length();
        if (d < 8 && d > 0.3) e.root.position.addScaledVector(tmp.normalize(), (e.boss ? 0.8 : v.pull) * dt);
      }
      if (v.tick <= 0) { v.tick = 0.3; for (const e of S.enemies) if (e.state !== 'dead' && e.root.position.distanceTo(v.c) < 3.5 + e.info.r) dmgEnemy(e, v.dmg * 0.5, { crit: 0.05 }); fx.burst(v.c.clone().setY(1.2), 14, 0xa46bff, 5, 0.6, 0, 3); }
      if (v.t > 3.4 && !v.boom) { v.boom = true; sfx('lightning'); cam.shake = 0.6 * settings.shake; fx.shock(v.c, 12, 0xa46bff, 0.6); fx.burst(v.c.clone().setY(1), 90, 0xa46bff, 12, 1, -4, 2); for (const e of S.enemies) if (e.state !== 'dead' && e.root.position.distanceTo(v.c) < 5 + e.info.r) dmgEnemy(e, v.dmg * 2.6, { kb: 10, from: v.c, heavy: true }); }
    }
    S.vortices = S.vortices.filter(v => v.t < 3.6);
    // scheduled strikes
    for (const s of S.strikes) { s.t -= dt; if (s.t <= 0 && !s.done) { s.done = true; s.fn(); } }
    S.strikes = S.strikes.filter(s => !s.done);
  }

  // ------------------------------------------------------------ player update
  const moveVec = V();
  function updatePlayer(dt) {
    const P = S.P;
    const ix = input.mx, iy = input.my;
    const m = Math.min(1, Math.hypot(ix, iy));
    const f = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), r = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    moveVec.set(0, 0, 0).addScaledVector(f, iy).addScaledVector(r, ix); if (moveVec.lengthSq() > 1) moveVec.normalize();
    if (P.deadT >= 0) { P.deadT += dt; return; }
    if (S.tut && S.tut.step === 0 && m > 0.2) { S.tut.moved += dt; if (S.tut.moved > 0.35) tutNext(); }
    if (P.dodgeT > 0) {
      P.dodgeT -= dt; P.pos.addScaledVector(P.dodgeDir, 21 * dt);
      if (Math.random() < 0.7) fx.burst(P.pos.clone().setY(P.pos.y + 1.2), 2, 0x9fe8ff, 1.5, 0.35, 0, 1.5);
    } else {
      const slow = P.atkIdx >= 0 ? 0.3 : 1;
      P.pos.addScaledVector(moveVec, 7.4 * slow * (P.fly > 0.5 ? 1.3 : 1) * dt);
      if (m > 0.1 && P.atkIdx < 0) { const tgt = Math.atan2(moveVec.x, moveVec.z); P.heading += wrap(tgt - P.heading) * Math.min(1, dt * 14); }
      if (m > 0.3 && P.atkIdx < 0 && P.pos.y < 0.3) { P.stepT = (P.stepT || 0) - dt; if (P.stepT <= 0) { P.stepT = 0.29; sfx('step'); } }
    }
    P.moveAmt += ((P.dodgeT > 0 ? 1 : m * (P.atkIdx >= 0 ? 0.3 : 1)) - P.moveAmt) * Math.min(1, dt * 10);
    const hl = Math.hypot(P.pos.x, P.pos.z);
    if (hl > ARENA_R) { P.pos.x *= ARENA_R / hl; P.pos.z *= ARENA_R / hl; }
    // ---- flight: spring toward hover height (or the ground when toggled off);
    // rise/sink inputs push beyond it. Flight is free — nothing is ever spent. ----
    P.fly += ((P.flyOn ? 1 : 0) - P.fly) * Math.min(1, dt * 3.4);
    if (P.flyOn || P.pos.y > 0.02) {
      const targetAlt = P.flyOn ? FLY_HOVER : 0;
      let vy = Math.max(-8, Math.min(8, (targetAlt - P.pos.y) * 2.4));
      if (input.rise) vy += 6.5;
      if (input.sink) vy -= 8.5;
      P.vy = vy;
      P.pos.y = Math.max(0, Math.min(FLY_MAX, P.pos.y + vy * dt));
      if (P.pos.y > 0.4) P.wasAir = true;
      if (!P.flyOn && P.pos.y <= 0.02) {
        P.pos.y = 0;
        if (P.wasAir) { P.wasAir = false; fx.ringBurst(P.pos, 22, 0x5fd8ff, 7); fx.burst(P.pos.clone().setY(0.3), 18, 0x8fb8d8, 4, 0.5, -2, 2); sfx('step', 0.7); cam.shake = Math.max(cam.shake, 0.12 * settings.shake); }
      }
    } else P.vy = 0;
    if (P.atkIdx >= 0) {
      P.atkT += dt;
      if (P.atkHit === 0 && P.atkT >= P.atkDur * 0.42) { P.atkHit = 1; attackHit(); }
      if (P.atkHit === 1 && P.combo === 2 && hasRelic(save, 'crowns') && P.atkT >= P.atkDur * 0.7) { P.atkHit = 2; attackHit(true); }
      if (P.atkT >= P.atkDur) { P.atkIdx = -1; P.comboT = 0.55; if (P.queued || input.atk) attack(); }
    } else if (P.comboT > 0) P.comboT -= dt;
    if (input.atk && P.atkIdx < 0) attack();
    for (const k in P.cd) if (P.cd[k] > 0) P.cd[k] = Math.max(0, P.cd[k] - dt);
    if (P.dodgeCd > 0) P.dodgeCd -= dt;
    P.mp = Math.min(P.maxMp, P.mp + dt * P.mpRegen);
    if (P.shT > 0) P.shT -= dt; else P.sh = Math.min(P.maxSh, P.sh + dt * P.maxSh * 0.12 * P.shRegen);
    if (P.inv > 0) P.inv -= dt; if (P.castT > 0) P.castT -= dt; if (P.hitT > 0) P.hitT -= dt;
    if (S.stats.comboTimer > 0) { S.stats.comboTimer -= dt; if (S.stats.comboTimer <= 0) S.stats.combo = 0; }
    hero.root.position.copy(P.pos); hero.root.rotation.y = P.heading;
  }

  // ------------------------------------------------------------ stage flow
  function updateFlow(dt) {
    const i = S.info;
    if (S.mode === 'intro') {
      S.introT += dt;
      if (S.introT > 2.4) { S.mode = 'play'; if (i.type === 'waves') startWave(0); else if (i.type === 'boss') spawnBoss(); else { S.spawnT = 0.5; banner(`SURVIVE<small>${i.survive} SECONDS</small>`); } if (S.tut) { showTut(); S.tut.wallT = performance.now(); } }
      return;
    }
    if (S.mode !== 'play') return;
    if (S.cine) { S.cine.t += dt; if (S.cine.t > S.cine.dur) S.cine = null; return; }
    if (S.P.deadT >= 0) { if (S.P.deadT > 2.2) finish(false); return; }
    // pending spawns
    if (S.pending.length) { S.spawnT -= dt; if (S.spawnT <= 0) { spawn(S.pending.shift()); S.spawnT = 0.45; } }
    const live = alive().length;
    if (i.type === 'waves') {
      if (!S.pending.length && live === 0) {
        if (S.waveIdx + 1 < i.waves.length) { if (S.betweenT <= 0) { S.betweenT = 2.2; banner('WAVE CLEARED'); sfx('level'); } else { S.betweenT -= dt; if (S.betweenT <= 0) startWave(S.waveIdx + 1); } }
        else win();
      }
    } else if (i.type === 'survive') {
      S.surviveLeft -= dt;
      S.survSpawnT -= dt;
      if (S.survSpawnT <= 0 && live + S.pending.length < i.cap) { S.pending.push(i.pool[(Math.random() * i.pool.length) | 0]); S.survSpawnT = Math.max(0.8, 1.8 - (i.survive - S.surviveLeft) / 60); }
      if (S.surviveLeft <= 0) { S.pending = []; for (const e of S.enemies) if (e.state !== 'dead') { fx.burst(e.root.position.clone().setY(1.2), 30, 0x7fe8ff, 6, 0.8); e.state = 'dead'; e.t = 0; } win(); }
      if ((S.surviveLeft | 0) !== (S._lastSec | 0)) { S._lastSec = S.surviveLeft; hudDirty = true; }
    } else if (i.type === 'boss') {
      if (S.bosses.length && S.bosses.every(b => b.state === 'dead')) { for (const e of S.enemies) if (e.state !== 'dead') { e.state = 'dead'; e.t = 0; } S.pending = []; win(); }
    }
    // tutorial step 2 (combo) finishes when a 3rd hit lands; camera step on rotation or time.
    // Safety net: every step also auto-advances after 9 REAL seconds (wall clock, so a
    // low frame rate can never soft-lock the tutorial — or the enemies it neuters).
    if (S.tut) {
      S.tut.t += dt;
      if (performance.now() - (S.tut.wallT || 0) > 9000) tutNext();
      else if (S.tut && S.tut.step === 2 && S.tut.comboDone) tutNext();
      else if (S.tut && S.tut.step === 5 && (S.tut.rot > 0.6 || S.tut.t > 5)) tutNext();
    }
  }
  function win() {
    if (S.mode !== 'play') return;
    S.mode = 'end'; S.endT = 0; S.P.victory = true; S.P.atkIdx = -1;
    banner('STAGE CLEAR<small>THE SEAL HOLDS</small>', false, 2.4); sfx('victory'); playMusic('victory');
    setTimeout(() => { if (S && S.mode === 'end') finish(true); }, 2600);
  }
  function finish(won) {
    if (!S || S.result) return;
    const i = S.info, P = S.P, st = S.stats;
    const time = S.t;
    const hpPct = P.hp / P.maxHp;
    const crit2 = i.type === 'survive' ? { label: `Defeat ${Math.round(i.survive / 3)}+ enemies`, ok: st.kills >= Math.round(i.survive / 3) } : { label: `Clear in under ${Math.floor(i.par / 60)}:${String(i.par % 60).padStart(2, '0')}`, ok: time <= i.par };
    const crit3 = { label: 'Finish above 50% HP', ok: hpPct > 0.5 };
    const stars = won ? 1 + (crit2.ok ? 1 : 0) + (crit3.ok ? 1 : 0) : 0;
    const prev = save.stages[i.id] || { stars: 0 };
    const first = won && !save.stages[i.id];
    let shards = st.shards;
    let bonus = 0;
    if (won) { bonus = Math.round(i.reward * (first ? 1.5 : 1)); bonus += Math.max(0, stars - prev.stars) * 15; }
    shards += bonus;
    save.shards += shards;
    let relic = null;
    if (won) {
      save.stages[i.id] = { stars: Math.max(prev.stars, stars), best: Math.min(prev.best || 1e9, Math.round(time)) };
      save.unlocked = Math.max(save.unlocked, Math.min(13, i.id + 1));
      if (i.relic && !save.relics.includes(i.relic)) { save.relics.push(i.relic); relic = i.relic; const slot = save.relicEquip.indexOf(null); if (slot >= 0 && slot < (save.stages[8] ? 3 : 2)) save.relicEquip[slot] = i.relic; }
      if (i.tutorial) save.tutorialDone = true;
    }
    save.last = i.id; save.playTime += time;
    writeSave(save);
    S.result = { won, stage: i, time, kills: st.kills, dmg: st.dmgDealt, taken: st.dmgTaken, combo: st.maxCombo, stars, prevStars: prev.stars, crit2, crit3, shards, bonus, exp: st.exp, levels: st.levels, relic, first };
    env.onFinish && env.onFinish(S.result);
  }

  // ------------------------------------------------------------ tutorial
  function showTut() {
    const T = TUTORIAL[S.tut.step]; const box = $('#tutBox');
    if (!T) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden'); box.innerHTML = `<b>${S.tut.step + 1}/${TUTORIAL.length}</b> ${isTouch ? T.touch : T.desk}`;
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
  }
  function tutNext() {
    if (!S.tut) return; S.tut.step++; S.tut.t = 0; S.tut.wallT = performance.now(); sfx('coin');
    if (S.tut.step === 3) for (const e of S.enemies) e.cd = 1 + Math.random() * 2;
    if (S.tut.step >= TUTORIAL.length) { $('#tutBox').classList.add('hidden'); S.tut = null; save.tutorialDone = true; return; }
    showTut();
  }

  // ------------------------------------------------------------ camera
  const camTarget = V(), camLook = V();
  function updateCamera(dt) {
    const P = S.P;
    if (S.mode === 'intro') {
      const k = Math.min(1, S.introT / 2.2), e = 1 - Math.pow(1 - k, 3);
      const a = (1 - e) * 1.6;
      camera.position.set(P.pos.x + Math.sin(a) * (8.6 + (1 - e) * 14), 1.5 + 2.6 + (1 - e) * 12, P.pos.z + Math.cos(a) * (8.6 + (1 - e) * 14));
      camera.lookAt(P.pos.x, 2 + (1 - e) * 2, P.pos.z - 4);
      return;
    }
    if (S.cine && S.cine.target) {
      const b = S.cine.target.root.position; tmp.copy(b).sub(P.pos).setY(0).normalize();
      camTarget.copy(P.pos).addScaledVector(tmp, -5).setY(3.2).add(new THREE.Vector3(tmp.z * 3, 0, -tmp.x * 3));
      camera.position.lerp(camTarget, Math.min(1, dt * 4));
      camLook.copy(b).setY(b.y + S.cine.target.info.h * 0.6); camera.lookAt(camLook);
      return;
    }
    if (S.P.victory) { const yaw = (S.t * 0.4) % (Math.PI * 2); camera.position.lerp(tmp.set(P.pos.x + Math.sin(yaw) * 6, P.pos.y + 2.6, P.pos.z + Math.cos(yaw) * 6), Math.min(1, dt * 2)); camera.lookAt(P.pos.x, P.pos.y + 1.8, P.pos.z); return; }
    if (S.lock && S.lock.state !== 'dead') {
      const t = S.lock.root.position; const want = Math.atan2(-(t.x - P.pos.x), -(t.z - P.pos.z));
      cam.yaw += wrap(want - cam.yaw) * Math.min(1, dt * 3);
    } else if (S.lock) S.lock = null;
    // flight: the camera pulls back and rides higher, looking slightly down at the Heir
    const flyK = P.fly || 0, dist = cam.dist + flyK * 4.4;
    const cp = Math.cos(cam.pitch);
    camTarget.set(P.pos.x + Math.sin(cam.yaw) * cp * dist + Math.cos(cam.yaw) * 1.5, P.pos.y + 1.5 + Math.sin(cam.pitch) * dist + flyK * 0.8, P.pos.z + Math.cos(cam.yaw) * cp * dist - Math.sin(cam.yaw) * 1.5);
    camera.position.lerp(camTarget, Math.min(1, dt * 8));
    const f = new THREE.Vector3(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), r = new THREE.Vector3(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    camLook.copy(P.pos).addScaledVector(f, 5).addScaledVector(r, 3.0).setY(P.pos.y + 2.3 - flyK * 0.7);
    if (cam.shake > 0) { camera.position.x += (Math.random() - .5) * cam.shake * 0.5; camera.position.y += (Math.random() - .5) * cam.shake * 0.5; cam.shake = Math.max(0, cam.shake - dt * 2.5); }
    camera.lookAt(camLook);
  }
  function rotateCam(dx, dy) {
    if (!S) return;
    cam.yaw -= dx * 0.006 * settings.sens; cam.pitch = Math.min(0.85, Math.max(0.1, cam.pitch + dy * 0.003 * settings.sens * (settings.invertY ? -1 : 1)));
    if (S.tut) S.tut.rot += Math.abs(dx) * 0.006;
  }

  // ------------------------------------------------------------ HUD
  let hudDirty = true, bannerT = 0, hudT = 0, lastBannerHtml = '', lastBannerAt = -9;
  function banner(html, red, dur = 2.2) {
    // an identical banner re-fired within 4s just refreshes its timer — never re-pops
    const now = performance.now() / 1000;
    if (html === lastBannerHtml && now - lastBannerAt < 4) { bannerT = Math.max(bannerT, dur); return; }
    lastBannerHtml = html; lastBannerAt = now;
    const b = $('#banner'); b.innerHTML = html; b.classList.toggle('red', !!red); b.classList.add('on'); bannerT = dur;
  }
  const dmgLayer = $('#dmgLayer'), nums = [];
  function dmgNum(pos, text, cls = '', life = 0.9) {
    let n = nums.find(n => n.t <= 0);
    if (!n) { if (nums.length > 40) return; const el = document.createElement('div'); dmgLayer.appendChild(el); n = { el, t: 0, pos: V() }; nums.push(n); }
    n.el.className = 'dmg ' + cls; n.el.textContent = text; n.pos.copy(pos); n.pos.x += (Math.random() - .5) * 0.6; n.t = n.life = life; n.el.style.display = '';
  }
  const proj = V();
  function updateNums(dt) {
    for (const n of nums) {
      if (n.t <= 0) continue; n.t -= dt;
      if (n.t <= 0) { n.el.style.display = 'none'; continue; }
      n.pos.y += dt * 1.6; proj.copy(n.pos).project(camera);
      if (proj.z > 1) { n.el.style.display = 'none'; continue; }
      const x = (proj.x * 0.5 + 0.5) * innerWidth, y = (-proj.y * 0.5 + 0.5) * innerHeight, k = n.t / n.life;
      const sc = k > 0.8 ? 1 + (k - 0.8) * 3 : 1;
      n.el.style.transform = `translate(-50%,-50%) translate(${x}px,${y}px) scale(${sc})`; n.el.style.opacity = Math.min(1, k * 2.5);
    }
  }
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const el = {};
  ['hpTxt', 'mpTxt', 'lvl', 'expTxt', 'waveTxt', 'enemyTxt', 'objTxt', 'potTxt', 'comboNum', 'shardTxt', 'bossName', 'bossPhase'].forEach(id => el[id] = $('#' + id));
  el.hp = $('.bar.hp i'); el.sh = $('.bar.sh i'); el.mp = $('.bar.mp i'); el.exp = $('#expBar i'); el.boss = $('#bossBar .bb i'); el.combo = $('#combo'); el.dodge = $('#dodgeBtn .cd');
  let skEls = [];
  function setupSkillButtons() {
    skEls = [0, 1, 2].map(i => {
      const b = $('#sk' + (i + 1)), k = save.equip[i];
      drawIcon(b.querySelector('canvas'), k ? SKILLS[k].icon : 'empty');
      b.classList.toggle('empty', !k);
      return { b, k, cd: b.querySelector('.cd'), t: b.querySelector('em') };
    });
    drawIcon($('#atkBtn canvas'), 'atk'); drawIcon($('#potBtn canvas'), 'pot'); drawIcon($('#dodgeBtn canvas'), 'dodge'); drawIcon($('#lockBtn canvas'), 'lock');
    const fc = $('#flyBtn canvas'), sc = $('#sinkBtn canvas'); if (fc) drawIcon(fc, 'fly'); if (sc) drawIcon(sc, 'sink');
  }
  function updateHUD(force) {
    if (!S) return; const P = S.P;
    el.hp.style.width = (P.hp / P.maxHp * 100) + '%'; el.sh.style.width = (P.sh / P.maxSh * 100) + '%'; el.mp.style.width = (P.mp / P.maxMp * 100) + '%';
    el.hpTxt.textContent = `${fmt(Math.ceil(P.hp))}/${fmt(P.maxHp)}`; el.mpTxt.textContent = `${fmt(P.mp)}/${fmt(P.maxMp)}`;
    for (const s of skEls) { if (!s.k) continue; const c = P.cd[s.k] || 0, mx = SKILLS[s.k].cd; s.cd.style.setProperty('--p', (c / mx * 100) + '%'); s.t.textContent = c > 0 ? Math.ceil(c) : ''; s.b.classList.toggle('nomp', P.mp < SKILLS[s.k].mp * P.mpCost); }
    el.dodge.style.setProperty('--p', (Math.max(0, P.dodgeCd) / 0.85 * 100) + '%');
    if (S.bosses.length) {
      const tot = S.bosses.reduce((a, b) => a + Math.max(0, b.hp), 0), mx = S.bosses.reduce((a, b) => a + b.maxHp, 0);
      el.boss.style.width = (tot / mx * 100) + '%';
    }
    if (S.stats.combo >= 3) { el.combo.classList.add('on'); el.comboNum.textContent = S.stats.combo; } else el.combo.classList.remove('on');
    $('#lockBtn').classList.toggle('on', !!S.lock);
    const fb = $('#flyBtn'); if (fb) fb.classList.toggle('on', !!P.flyOn);
    document.body.classList.toggle('flying', !!P.flyOn);
    // one-time flight hint on non-tutorial stages
    if (!S.tut) {
      const hb = $('#tutBox');
      if (S.hintT > 0 && S.mode === 'play') { hb.classList.remove('hidden'); hb.innerHTML = isTouch ? '<b>FLY</b> Tap the wing button to fly — tap again to land. Flying costs nothing.' : '<b>FLY</b> Press <b>F</b> to fly — Space rises, Shift descends, F lands. Flying costs nothing.'; }
      else if (S.hintT <= 0 && hb.dataset.hint === '1') { hb.classList.add('hidden'); hb.dataset.hint = ''; }
      if (S.hintT > 0) hb.dataset.hint = '1';
    }
    hudT -= 1 / 60;
    if (!hudDirty && !force && hudT > 0) return; hudDirty = false; hudT = 0.5;
    el.lvl.textContent = 'Lv. ' + save.lv;
    const nx = expToNext(save.lv);
    el.exp.style.width = (save.exp / nx * 100) + '%'; el.expTxt.textContent = `EXP ${fmt(save.exp)} / ${fmt(nx)}`;
    const live = alive().length + S.pending.length;
    const i = S.info;
    el.waveTxt.textContent = i.type === 'waves' ? `Wave ${Math.max(1, S.waveIdx + 1)}/${i.waves.length}` : i.type === 'survive' ? `${Math.max(0, Math.ceil(S.surviveLeft))}s left` : 'Boss';
    el.enemyTxt.textContent = live;
    el.objTxt.textContent = objectiveText(false);
    el.potTxt.textContent = 'x' + P.potions;
    el.shardTxt.textContent = fmt(save.shards + S.stats.shards);
    if (S.bosses.length) {
      el.bossName.textContent = i.boss === 'twins' ? 'THE TWIN WARLORDS' : S.bosses[0].bossName.toUpperCase();
      el.bossPhase.textContent = S.bosses.some(b => b.phase2) ? 'PHASE II' : 'PHASE I';
    }
  }

  // ------------------------------------------------------------ main update
  function update(rawDt, time) {
    if (!S) return;
    let dt = rawDt;
    if (hitstop > 0) { hitstop -= rawDt; dt = rawDt * 0.08; }
    else if (slowmo > 0) { slowmo -= rawDt; dt = rawDt * 0.35; }
    S.t += S.mode === 'play' ? dt : 0;
    if (S.mode === 'play' || S.mode === 'end') { if (S.mode === 'play') updatePlayer(dt); updateEnemies(dt, time); updateHazards(dt); }
    else if (S.mode === 'intro') hero.root.position.copy(S.P.pos);
    if (S.mode === 'end') S.endT += dt;
    updateFlow(dt);
    if (S.hintT > 0) S.hintT -= rawDt;
    const P = S.P;
    hero.update(dt, { moveAmt: S.mode === 'play' ? P.moveAmt : 0, atkIdx: P.atkIdx, atkP: P.atkIdx >= 0 ? P.atkT / P.atkDur : 0, dash: P.dodgeT > 0, cast: P.castT > 0 ? Math.sin(Math.min(1, P.castT / 0.45) * Math.PI) : 0, hitT: P.hitT, deadT: P.deadT, victory: P.victory, combat: alive().length > 0 && S.mode === 'play', fly: P.fly || 0, glide: (P.fly > 0.6 && P.moveAmt > 0.75 && Math.abs(P.vy || 0) < 2) ? 1 : 0, climb: (P.vy || 0) > 2.5 });
    // target markers
    S.soft = S.lock ? null : nearest(7);
    lockRing.visible = !!S.lock; softRing.visible = !!S.soft && S.mode === 'play';
    if (S.lock) { lockRing.position.copy(S.lock.root.position).setY(0.12); lockRing.rotation.z += rawDt * 2; lockRing.scale.setScalar(S.lock.info.r * 1.6 + 0.4); }
    if (S.soft) { softRing.position.copy(S.soft.root.position).setY(0.1); softRing.scale.setScalar(S.soft.info.r * 1.4 + 0.3); }
    updateCamera(rawDt);
    if (bannerT > 0) { bannerT -= rawDt; if (bannerT <= 0) $('#banner').classList.remove('on'); }
    updateHUD(); updateNums(rawDt);
  }

  return {
    startStage, stop, update, attack, dodge, skill, potion, toggleLock, toggleFly, rotateCam, input,
    get S() { return S; }, cam,
    debug: {
      killAll: () => S && S.enemies.forEach(e => { if (e.state !== 'dead' && e.state !== 'spawn') dmgEnemy(e, 1e7, { pierce: true }); }),
      hurt: n => { if (S) { S.P.inv = 0; S.P.dodgeT = 0; hurtPlayer(n); } },
      skipIntro: () => { if (S && S.mode === 'intro') S.introT = 99; },
      bossHalf: () => S && S.bosses.forEach(b => { b.hp = b.maxHp * 0.45; checkBossPhase(b); hudDirty = true; }),
      endCine: () => { if (S) S.cine = null; },
      fly: () => toggleFly(),
    },
  };
}
