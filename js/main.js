import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world.js';
import { buildHero } from './hero.js';
import { makeEnemy, animateEnemy } from './enemies.js';
import { makeFX } from './fx.js';
import { drawPortrait, drawIcon, drawRelic } from './textures.js';
import { initAudio, setVolumes, sfx, playMusic } from './audio.js';
import { createGame } from './game.js';
import { STAGES, REALMS, ENEMY_INFO, SKILLS, SKILL_RANK_COST, STATS, statCost, RELICS } from './data.js';
import { freshSave, loadSave, writeSave, deleteSave, loadSettings, writeSettings, expToNext, totalStars, relicSlots, playerStats } from './save.js';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const isTouch = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
if (!isTouch) document.body.classList.add('desk');
const params = new URLSearchParams(location.search);
const settings = loadSettings();
let save = loadSave();
const qName = params.get('q') || (settings.quality === 'auto' ? (isTouch ? 'low' : 'high') : settings.quality);
const quality = { low: qName === 'low', reflect: qName === 'high' };
const fmt = n => Math.round(n).toLocaleString('en-US');
const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

await Promise.race([document.fonts.load('800 40px Cinzel'), new Promise(r => setTimeout(r, 1500))]);

// ---------------------------------------------------------------- renderer
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
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h);
  bloom.resolution.set(w / 2, h / 2);
  camera.aspect = w / h; camera.fov = w / h < 1.2 ? 70 : 56; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const world = buildWorld(scene, renderer, quality);
const hero = buildHero(scene);
const fx = makeFX(scene, quality);
world.setPalette('azure');

// pre-compile every enemy shader so the first spawn of a type never hitches
try {
  const tmp = [];
  for (const k of ['knight', 'hound', 'caster', 'shield', 'wisp', 'warlord', 'warlord2', 'seraph', 'shade']) { try { const e = makeEnemy(k, scene); e.root.position.set(0, 0, -6); tmp.push(e); } catch (err) { console.warn('prewarm', k, err); } }
  renderer.compile(scene, camera);
  for (const e of tmp) scene.remove(e.root);
} catch (e) { console.warn(e); }

setVolumes(settings);
playMusic('menu');

// ---------------------------------------------------------------- game
let mode = 'menu', prevMode = null, curStage = 1, selStage = 1, selRealm = 0, finishTimer = null;
const game = createGame({ scene, camera, world, hero, fx, isTouch, settings, onFinish: r => { clearTimeout(finishTimer); finishTimer = setTimeout(() => showResults(r), r.won ? 300 : 900); } });
drawPortrait($('#portrait'));

// ---------------------------------------------------------------- screens
function show(id) {
  $$('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  $('#hud').classList.toggle('hidden', !(mode === 'stage' || mode === 'paused'));
}
function toast(msg, t = 1.8) { const el = $('#toast'); el.innerHTML = msg; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), t * 1000); }
let confirmCb = null;
function confirmBox(txt, cb, yes = 'CONFIRM') { $('#confirmTxt').innerHTML = txt; $('#confirmYes').textContent = yes; confirmCb = cb; $('#confirm').classList.add('on'); }
$('#confirmNo').onclick = () => { sfx('back'); $('#confirm').classList.remove('on'); confirmCb = null; };
$('#confirmYes').onclick = () => { sfx('ui'); $('#confirm').classList.remove('on'); const c = confirmCb; confirmCb = null; c && c(); };
const click = (sel, fn, snd = 'ui') => { $(sel).addEventListener('click', e => { initAudio(); sfx(snd); fn(e); }); };

// ---------- menu
function goMenu() {
  if (game.S) game.stop();
  mode = 'menu'; world.setPalette('azure'); playMusic('menu'); resetHero();
  const has = !!save;
  $('#continueBtn').classList.toggle('hidden', !has);
  $('#newBtn').classList.toggle('primary', !has);
  if (has) $('#continueInfo').textContent = `Lv ${save.lv} · Stage ${Math.min(13, save.unlocked)} · ★ ${totalStars(save)}/39`;
  show('menu');
}
click('#continueBtn', () => goMap());
click('#newBtn', () => {
  const start = () => { save = freshSave(); writeSave(save); goIntro(); };
  if (save) confirmBox('Start a new game?<br><small>Your current save (Lv ' + save.lv + ', ★ ' + totalStars(save) + ') will be erased.</small>', start, 'ERASE & START'); else start();
});
let settingsReturn = 'menu';
click('#settingsBtn', () => { settingsReturn = 'menu'; openSettings(); });
click('#creditsBtn', () => show('credits'));
click('#creditsBack', () => show('menu'), 'back');

// ---------- settings
function openSettings() {
  for (const el of $$('[data-set]')) {
    const k = el.dataset.set;
    if (el.type === 'checkbox') el.checked = !!settings[k]; else el.value = settings[k];
    const o = el.parentElement.querySelector('output'); if (o) o.textContent = fmtSet(k, settings[k]);
  }
  $('#ctrlTable').innerHTML = (isTouch ? [
    ['Left stick', 'Move'], ['Star button', 'Attack · hold for 3-hit combo'], ['Wing button', 'Dodge (invincible) · dodge just before a hit for slow-mo'],
    ['Skill buttons', 'Your 3 equipped skills'], ['Red heart', 'Potion'], ['Crosshair', 'Lock on to the nearest enemy'], ['Drag screen', 'Turn the camera'],
  ] : [
    ['W A S D', 'Move'], ['J / left mouse', 'Attack · hold for 3-hit combo'], ['Space / Shift', 'Dodge · perfect dodge = slow-mo'], ['K L U  or  1 2 3', 'Skills'],
    ['Q', 'Potion'], ['Tab / middle mouse', 'Lock on'], ['Mouse drag / ← →', 'Camera'], ['Esc / P', 'Pause'],
  ]).map(([a, b]) => `<b>${a}</b><span>${b}</span>`).join('');
  show('settings');
}
function fmtSet(k, v) { return k === 'sens' || k === 'shake' ? (+v).toFixed(1) + '×' : Math.round(v * 100) + '%'; }
for (const el of $$('[data-set]')) el.addEventListener('input', () => {
  const k = el.dataset.set;
  settings[k] = el.type === 'checkbox' ? el.checked : el.tagName === 'SELECT' ? el.value : +el.value;
  const o = el.parentElement.querySelector('output'); if (o) o.textContent = fmtSet(k, settings[k]);
  writeSettings(settings); setVolumes(settings);
  if (k === 'sfx') sfx('coin');
  if (k === 'quality') { pr = Math.min(devicePixelRatio, settings.quality === 'low' ? 1.25 : (isTouch ? 1.5 : 1.75)); resize(); toast('Reflections update the next time the game loads'); }
});
$$('#settings .tabs button').forEach(b => b.addEventListener('click', () => { sfx('ui'); $$('#settings .tabs button').forEach(x => x.classList.toggle('on', x === b)); $$('#settings .pane').forEach(p => p.classList.toggle('on', p.id === b.dataset.tab)); }));
click('#settingsBack', () => { if (settingsReturn === 'pause') show('pause'); else show('menu'); }, 'back');
click('#resetSaveBtn', () => confirmBox('Erase all progress?<br><small>Levels, shards, skills, relics and stars will be lost.</small>', () => { deleteSave(); save = null; toast('Save erased'); goMenu(); }, 'ERASE'));

// ---------- story intro
const STORY = [
  { t: 'Beyond the twelve known dimensions lies a <span class="hl">thirteenth</span>, sealed by a hexagram and a single rose.', shot: 'seal' },
  { t: 'For an age the Seal held. Then the <span class="rd">Abyssal Legion</span> came, and the outer gates began to break.', shot: 'legion' },
  { t: 'You are the <span class="hl">Heir of the Thirteenth</span>: horned, winged, and bound to the storm.', shot: 'hero' },
  { t: 'Your own shadow, the <span class="rd">Thirteenth Shade</span>, waits at the last seal wearing your face.', shot: 'shade' },
  { t: 'Cross the four realms. Break the Legion. <span class="hl">Restore the Seal.</span>', shot: 'behind' },
];
let introI = 0, introT = 0, introChars = 0, introLegion = [];
function goIntro() {
  mode = 'intro'; introI = 0; introT = 0; introChars = 0; world.setPalette('seal'); resetHero(); playMusic('menu');
  show('intro'); setIntroText();
}
function setIntroText() { $('#introText').innerHTML = ''; introChars = 0; introT = 0; }
function introStep() {
  const full = STORY[introI].t.replace(/<[^>]+>/g, '').length;
  if (introChars < full) { introChars = 1e9; return; }
  introI++; sfx('ui');
  if (introI >= STORY.length) return endIntro();
  if (STORY[introI].shot === 'legion') spawnLegion(); else if (STORY[introI].shot === 'shade') spawnShade(); else clearLegion();
  setIntroText();
}
function spawnLegion() {
  clearLegion(); world.setPalette('crimson');
  for (let i = 0; i < 5; i++) { const e = makeEnemy(i === 2 ? 'warlord' : 'knight', scene); const a = (i - 2) * 0.38; e.root.position.set(Math.sin(a) * 9, 0, -Math.cos(a) * 9 + 2); e.root.rotation.y = Math.atan2(-e.root.position.x, 6 - e.root.position.z); e.state = 'idle'; introLegion.push(e); }
}
function spawnShade() {
  clearLegion(); world.setPalette('violet');
  const e = makeEnemy('shade', scene); e.root.position.set(0, 0, -2); e.root.rotation.y = 0.15; e.state = 'idle'; introLegion.push(e);
}
function clearLegion() { for (const e of introLegion) scene.remove(e.root); introLegion = []; if (mode === 'intro') world.setPalette('seal'); }
function endIntro() {
  clearLegion();
  if (save) { save.seenIntro = true; writeSave(save); }
  selStage = save ? Math.min(13, save.unlocked) : 1; goMap();
}
$('#intro').addEventListener('click', e => { if (e.target.id === 'skipIntro') return; initAudio(); introStep(); });
click('#skipIntro', () => endIntro(), 'back');
function renderIntroText() {
  const html = STORY[introI].t; let out = '', n = 0, inTag = false;
  for (const ch of html) { if (ch === '<') inTag = true; if (inTag) { out += ch; if (ch === '>') inTag = false; continue; } if (n >= introChars) break; out += ch; n++; }
  // close any open span
  if ((out.match(/<span/g) || []).length > (out.match(/<\/span>/g) || []).length) out += '</span>';
  $('#introText').innerHTML = out;
}

// ---------- map
function realmOfStage(id) { return STAGES[id].realm; }
function goMap() {
  if (game.S) game.stop();
  if (!save) { save = freshSave(); writeSave(save); }
  mode = 'map'; playMusic('menu'); resetHero();
  if (!STAGES[selStage] || selStage > save.unlocked) selStage = Math.min(13, save.unlocked);
  selRealm = realmOfStage(selStage);
  renderMap(); show('map');
}
function stageUnlocked(id) { return id <= save.unlocked; }
function starStr(n) { return '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>'; }
function renderMap() {
  $('#mapLv').textContent = save.lv; $('#mapStars').textContent = totalStars(save); $('#mapShards').textContent = fmt(save.shards);
  const realm = REALMS[selRealm]; world.setPalette(realm.pal);
  const rc = { azure: '#4cc6ff', crimson: '#ff6a4a', violet: '#b27bff', seal: '#7fe8ff' }[realm.pal];
  $('#realmTabs').innerHTML = REALMS.map(r => {
    const ids = STAGES.filter(s => s && s.realm === r.id).map(s => s.id), first = ids[0], locked = first > save.unlocked;
    const st = ids.reduce((a, i) => a + ((save.stages[i] || {}).stars || 0), 0);
    const c = { azure: '#4cc6ff', crimson: '#ff6a4a', violet: '#b27bff', seal: '#7fe8ff' }[r.pal];
    return `<button data-r="${r.id}" class="${r.id === selRealm ? 'on' : ''} ${locked ? 'locked' : ''}" style="--rc:${c}">${locked ? '🔒 ' : ''}${r.name}<small>${r.sub} · ★ ${st}/${ids.length * 3}</small></button>`;
  }).join('');
  $$('#realmTabs button').forEach(b => b.onclick = () => {
    const r = +b.dataset.r, first = STAGES.find(s => s && s.realm === r).id;
    if (first > save.unlocked) { sfx('nomp'); toast(`Clear Stage ${first - 1} to open ${REALMS[r].name}`); return; }
    sfx('ui'); selRealm = r; const ids = STAGES.filter(s => s && s.realm === r).map(s => s.id); selStage = Math.min(Math.max(...ids.filter(stageUnlocked)), ids[ids.length - 1]); renderMap();
  });
  const rv = $('#realmView'); rv.style.setProperty('--rbg', rc + '33'); rv.style.setProperty('--rc', rc);
  const stages = STAGES.filter(s => s && s.realm === selRealm);
  $('#mapPaths').innerHTML = stages.slice(1).map((s, i) => { const a = stages[i].pos, b = s.pos, lit = stageUnlocked(s.id); return `<line x1="${a[0]}%" y1="${a[1]}%" x2="${b[0]}%" y2="${b[1]}%" stroke="${lit ? rc : '#2a3a5a'}" stroke-width="${lit ? 3 : 2}" stroke-dasharray="${lit ? '0' : '6 6'}" opacity="0.8"/>`; }).join('');
  $('#mapNodes').innerHTML = stages.map(s => {
    const rec = save.stages[s.id], lk = !stageUnlocked(s.id);
    return `<button class="node ${s.type === 'boss' ? 'boss' : ''} ${lk ? 'locked' : ''} ${s.id === selStage ? 'sel' : ''} ${!lk && !rec ? 'next' : ''}" data-s="${s.id}" style="left:${s.pos[0]}%;top:${s.pos[1]}%">
      <span class="lb">${s.type === 'boss' ? '☠ ' : ''}${s.name}</span><span class="dm"></span><span class="nm">${lk ? '🔒' : s.id}</span><span class="st">${rec ? starStr(rec.stars) : lk ? '' : 'NEW'}</span></button>`;
  }).join('');
  $$('#mapNodes .node').forEach(n => n.onclick = () => { const id = +n.dataset.s; if (!stageUnlocked(id)) { sfx('nomp'); toast(`Clear Stage ${id - 1} first`); return; } sfx('ui'); selStage = id; renderMap(); });
  $('#realmBlurb').textContent = realm.blurb;
  renderStageCard();
}
function stageObjective(s) { return s.type === 'waves' ? `Defeat all ${s.waves.length} waves` : s.type === 'survive' ? `Survive for ${s.survive} seconds` : `Defeat ${s.boss === 'twins' ? 'the Twin Warlords' : ENEMY_INFO[s.boss].name}`; }
function renderStageCard() {
  const s = STAGES[selStage], rec = save.stages[s.id];
  const foes = new Set(); if (s.waves) s.waves.flat().forEach(k => foes.add(k)); if (s.pool) s.pool.forEach(k => foes.add(k)); if (s.boss) foes.add(s.boss === 'twins' ? 'warlord' : s.boss); if (s.adds) s.adds.forEach(k => foes.add(k));
  const c2 = s.type === 'survive' ? `Defeat ${Math.round(s.survive / 3)}+ enemies` : `Clear in under ${mmss(s.par)}`;
  const st = rec ? rec.stars : 0;
  const low = save.lv < s.rec;
  $('#stageCard').innerHTML = `
    <div class="tag2">${REALMS[s.realm].sub} · Stage ${s.id} · ${s.type === 'boss' ? 'Boss' : s.type === 'survive' ? 'Survival' : 'Waves'}</div>
    <h3>${s.name}</h3>
    <div class="ln"><span>Objective</span><b>${stageObjective(s)}</b></div>
    <div class="ln"><span>Recommended</span><b style="color:${low ? '#ff8a7a' : '#9fffb0'}">Lv ${s.rec}${low ? ' (you are ' + save.lv + ')' : ''}</b></div>
    <div class="foes">${[...foes].map(k => `<span>${ENEMY_INFO[k].name}</span>`).join('')}</div>
    <div class="starsL"><div class="${st >= 1 ? 'ok' : ''}">★ Clear the stage</div><div class="${st >= 2 ? 'ok' : ''}">★ ${c2}</div><div class="${st >= 3 ? 'ok' : ''}">★ Finish above 50% HP</div></div>
    <div class="ln"><span>Reward</span><b class="sh">◆ ${s.reward}${rec ? '' : ' ×1.5 first clear'}</b></div>
    ${s.relic ? `<div class="ln"><span>Relic</span><b style="color:#ffe27a">${save.relics.includes(s.relic) ? '✓ ' : ''}${RELICS[s.relic].name}</b></div>` : ''}
    ${rec ? `<div class="ln"><span>Best</span><b>${starStr(rec.stars).replace('<i>', '<i style="color:#334;font-style:normal">')} · ${mmss(rec.best)}</b></div>` : ''}
    <button class="btn primary" id="beginBtn">${rec ? 'REPLAY' : 'BEGIN'}</button>`;
  $('#beginBtn').onclick = () => { initAudio(); sfx('horn'); startStage(s.id); };
}
click('#mapMenu', () => goMenu(), 'back');
click('#mapSanctum', () => goSanctum());

// ---------- sanctum
let sanTab = 'skills', selSkill = 'lightning';
function goSanctum() { if (game.S) game.stop(); mode = 'sanctum'; playMusic('menu'); resetHero(); renderSanctum(); show('sanctum'); }
function canPay(n) { return save.shards >= n; }
function pay(n) { save.shards -= n; writeSave(save); sfx('coin'); }
function reqMet(k) {
  const r = SKILLS[k].req; if (!r) return true;
  if (r.skill && !save.skills[r.skill]) return false; if (r.skill2 && !save.skills[r.skill2]) return false;
  if (r.stage && !save.stages[r.stage]) return false; return true;
}
function reqText(k) {
  const r = SKILLS[k].req; if (!r) return ''; const p = [];
  if (r.skill) p.push(SKILLS[r.skill].name); if (r.skill2) p.push(SKILLS[r.skill2].name); if (r.stage) p.push('Clear Stage ' + r.stage);
  return 'Requires: ' + p.join(' + ');
}
function renderSanctum() {
  $('#sanLv').textContent = save.lv; $('#sanShards').textContent = fmt(save.shards);
  const ps = playerStats(save), nx = expToNext(save.lv);
  $('#heroInfo').innerHTML = `<div class="hn">The Heir</div><div>Level ${save.lv} · EXP ${fmt(save.exp)} / ${fmt(nx)}</div><div class="xb"><i style="width:${save.exp / nx * 100}%"></i></div>
    <div class="sg"><span>Health</span><b>${fmt(ps.maxHp)}</b><span>Mana</span><b>${fmt(ps.maxMp)}</b><span>Attack</span><b>${fmt(ps.atk)}</b><span>Aegis shield</span><b>${fmt(ps.maxSh)}</b><span>Critical</span><b>${Math.round(ps.crit * 100)}%</b><span>Guard</span><b>${Math.round(ps.guard * 100)}%</b></div>`;
  $$('#sanctum .tabs button').forEach(b => b.classList.toggle('on', b.dataset.stab === sanTab));
  const C = $('#sanContent');
  if (sanTab === 'skills') {
    const br = ['STORM', 'VOID', 'DRAGON'];
    C.innerHTML = `<div class="equipRow">EQUIPPED ${[0, 1, 2].map(i => `<button class="slot" data-slot="${i}"><canvas width="96" height="96"></canvas><small>${isTouch ? '' : 'KLU'[i]}</small></button>`).join('')}</div>
      <div class="tree">${br.map(b => `<div class="bh">${b}</div>`).join('')}
      ${[0, 1].map(tier => [0, 1, 2].map(b => { const k = Object.keys(SKILLS).find(x => SKILLS[x].branch === b && SKILLS[x].tier === tier); const S = SKILLS[k], r = save.skills[k] || 0;
        return `<button class="snode ${r ? 'owned' : reqMet(k) ? '' : 'locked'} ${k === selSkill ? 'sel' : ''}" data-k="${k}"><canvas width="96" height="96"></canvas><div><b>${S.name}</b><span class="pips">${r ? '◆'.repeat(r) + '◇'.repeat(3 - r) : reqMet(k) ? '◆ ' + S.cost : '🔒'}</span></div></button>`; }).join('')).join('')}</div>
      <div class="detail" id="skDetail"></div>`;
    $$('.slot').forEach(s => { const k = save.equip[+s.dataset.slot]; drawIcon(s.querySelector('canvas'), k ? SKILLS[k].icon : 'empty'); s.onclick = () => { if (!save.skills[selSkill]) return; equipSkill(selSkill, +s.dataset.slot); }; });
    $$('.snode').forEach(n => { drawIcon(n.querySelector('canvas'), SKILLS[n.dataset.k].icon); n.onclick = () => { sfx('ui'); selSkill = n.dataset.k; renderSanctum(); }; });
    const S = SKILLS[selSkill], r = save.skills[selSkill] || 0;
    let act = '';
    if (!r) act = reqMet(selSkill) ? `<button class="btn small primary" id="skBuy" ${canPay(S.cost) ? '' : 'disabled'}>UNLOCK · ◆ ${S.cost}</button>` : `<span style="color:#ff8a7a">${reqText(selSkill)}</span>`;
    else if (r < 3) act = `<button class="btn small primary" id="skBuy" ${canPay(SKILL_RANK_COST[r]) ? '' : 'disabled'}>RANK ${r + 1} · ◆ ${SKILL_RANK_COST[r]}</button>`;
    else act = '<span style="color:#ffe27a">MAX RANK</span>';
    const eqAt = save.equip.indexOf(selSkill);
    $('#skDetail').innerHTML = `<h4>${S.name} ${r ? `<small style="color:#ffe27a">Rank ${r}</small>` : ''}</h4><div>${S.desc}</div><div style="color:#9fdcff">MP ${S.mp} · Cooldown ${S.cd}s · Damage ×${[1, 1.35, 1.75][Math.max(0, r - 1)]}${r < 3 ? ` → ×${[1, 1.35, 1.75][r]}` : ''}</div>
      <div class="row">${act}${r ? [0, 1, 2].map(i => `<button class="btn small ${eqAt === i ? 'primary' : ''}" data-eq="${i}">${eqAt === i ? '✓ ' : ''}SLOT ${i + 1}</button>`).join('') : ''}</div>`;
    const buy = $('#skBuy'); if (buy) buy.onclick = () => { const c = r ? SKILL_RANK_COST[r] : S.cost; if (!canPay(c)) return; pay(c); save.skills[selSkill] = r + 1; if (!r) { sfx('unlock'); const e = save.equip.indexOf(null); if (e >= 0) save.equip[e] = selSkill; toast(`${S.name} unlocked!`); } else toast(`${S.name} → Rank ${r + 1}`); writeSave(save); renderSanctum(); };
    $$('[data-eq]').forEach(b => b.onclick = () => equipSkill(selSkill, +b.dataset.eq));
  } else if (sanTab === 'stats') {
    C.innerHTML = Object.entries(STATS).map(([k, s]) => {
      const r = save.stats[k], cost = statCost(r), mx = r >= s.max;
      return `<div class="statRow"><div class="nm"><b>${s.name}</b>${s.desc}</div><div class="pp">${Array.from({ length: s.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div>
        ${mx ? '<span style="color:#ffe27a">MAX</span>' : `<button class="btn small ${canPay(cost) ? 'primary' : ''}" data-st="${k}" ${canPay(cost) ? '' : 'disabled'}>◆ ${cost}</button>`}</div>`;
    }).join('') + '<p class="note" style="margin-top:8px">Shards (◆) drop from every enemy and from clearing stages. Higher stars pay a bonus.</p>';
    $$('[data-st]').forEach(b => b.onclick = () => { const k = b.dataset.st, c = statCost(save.stats[k]); if (!canPay(c)) return; pay(c); save.stats[k]++; sfx('level'); writeSave(save); renderSanctum(); });
  } else {
    const ns = relicSlots(save);
    C.innerHTML = `<div class="relicSlots">${[0, 1, 2].map(i => `<button class="rslot ${i >= ns ? 'lockd' : ''}" data-rs="${i}" title="${i >= ns ? 'Clear Stage 8 to unlock' : ''}"><canvas width="128" height="128"></canvas></button>`).join('')}</div>
      <p class="note" style="text-align:center;margin-bottom:8px">${ns < 3 ? 'Third relic slot unlocks after Stage 8. ' : ''}Tap a relic you own to equip or remove it.</p>
      <div class="relicGrid">${Object.entries(RELICS).map(([k, r]) => { const own = save.relics.includes(k), eq = save.relicEquip.includes(k);
        return `<button class="rcard ${own ? '' : 'no'} ${eq ? 'eq' : ''}" data-rl="${k}"><canvas width="128" height="128"></canvas><div><b>${r.name}</b>${r.desc}<br>${own ? (eq ? '<span style="color:#ffe27a">EQUIPPED</span>' : '<span style="color:#9fdcff">Owned</span>') : r.price ? `<span class="sh">◆ ${r.price}</span>` : `<span style="color:#ff8a7a">Boss drop · Stage ${r.drop}</span>`}</div></button>`; }).join('')}</div>`;
    $$('.rslot').forEach(s => drawRelic(s.querySelector('canvas'), save.relicEquip[+s.dataset.rs]));
    $$('.rslot').forEach(s => s.onclick = () => { const i = +s.dataset.rs; if (save.relicEquip[i]) { save.relicEquip[i] = null; sfx('back'); writeSave(save); renderSanctum(); } });
    $$('.rcard').forEach(c => { drawRelic(c.querySelector('canvas'), c.dataset.rl); c.onclick = () => {
      const k = c.dataset.rl, r = RELICS[k];
      if (!save.relics.includes(k)) {
        if (!r.price) { sfx('nomp'); toast(`Defeat the Stage ${r.drop} boss to claim it`); return; }
        if (!canPay(r.price)) { sfx('nomp'); toast('Not enough shards'); return; }
        confirmBox(`Buy ${r.name} for ◆ ${r.price}?`, () => { pay(r.price); save.relics.push(k); sfx('unlock'); const e = save.relicEquip.findIndex((x, i) => !x && i < relicSlots(save)); if (e >= 0) save.relicEquip[e] = k; writeSave(save); renderSanctum(); }, 'BUY');
        return;
      }
      const at = save.relicEquip.indexOf(k);
      if (at >= 0) { save.relicEquip[at] = null; sfx('back'); }
      else { const e = save.relicEquip.findIndex((x, i) => !x && i < relicSlots(save)); if (e < 0) { sfx('nomp'); toast('All relic slots are full: tap an equipped slot to remove one'); return; } save.relicEquip[e] = k; sfx('unlock'); }
      writeSave(save); renderSanctum();
    }; });
  }
}
function equipSkill(k, slot) {
  const prev = save.equip.indexOf(k);
  if (prev === slot) { if (save.equip.filter(Boolean).length > 1) { save.equip[slot] = null; sfx('back'); } }
  else { if (prev >= 0) save.equip[prev] = save.equip[slot]; save.equip[slot] = k; sfx('unlock'); }
  writeSave(save); renderSanctum();
}
$$('#sanctum .tabs button').forEach(b => b.addEventListener('click', () => { sfx('ui'); sanTab = b.dataset.stab; renderSanctum(); }));
click('#sanBack', () => goMap(), 'back');

// ---------- stage
function startStage(id) {
  clearTimeout(finishTimer);
  if (game.S) game.stop();
  curStage = id; selStage = id; mode = 'stage';
  hero.root.visible = true;
  game.startStage(id, save);
  show(null);
  perf.acc = 0; perf.n = 0;
}
function pause(on) {
  if (on && mode === 'stage') { mode = 'paused'; const S = game.S; $('#pauseInfo').textContent = `Stage ${S.id} · ${S.info.name} · ${mmss(S.t)}`; show('pause'); input.atk = false; game.input.atk = false; }
  else if (!on && mode === 'paused') { mode = 'stage'; show(null); }
}
click('#pauseBtn', () => pause(true));
click('#resumeBtn', () => pause(false));
click('#restartBtn', () => confirmBox('Restart this stage?', () => startStage(curStage), 'RESTART'));
click('#pauseSettings', () => { settingsReturn = 'pause'; openSettings(); });
click('#quitBtn', () => confirmBox('Quit to the map?<br><small>Progress in this stage will be lost.</small>', () => goMap(), 'QUIT'));

// ---------- results
function showResults(r) {
  if (mode !== 'stage' && mode !== 'paused') return;
  mode = 'results';
  $('#resTitle').textContent = r.won ? 'VICTORY' : 'DEFEAT'; $('#resTitle').classList.toggle('red', !r.won);
  $('#resSub').textContent = `Stage ${r.stage.id} · ${r.stage.name}${r.won && r.first ? ' · FIRST CLEAR' : ''}`;
  const stars = $$('#resStars span'); stars.forEach(s => s.classList.remove('on'));
  stars.forEach((s, i) => { if (i < r.stars) setTimeout(() => { s.classList.add('on'); sfx('star', 1 + i * 0.12); }, 500 + i * 380); });
  $('#resStars').style.display = r.won ? '' : 'none';
  const nx = expToNext(save.lv);
  $('#resGrid').innerHTML = [
    ['TIME', mmss(r.time)], ['KILLS', r.kills], ['DAMAGE', fmt(r.dmg)], ['TAKEN', fmt(r.taken)],
    ['MAX COMBO', r.combo], ['EXP', '+' + fmt(r.exp)], ['SHARDS', '◆ ' + fmt(r.shards), 'gold'], ['LEVEL', `${save.lv}${r.levels ? ` <small style="color:#9fffb0">+${r.levels}</small>` : ''}`],
  ].map(([a, b, c]) => `<div class="${c || ''}"><b>${b}</b>${a}</div>`).join('');
  $('#resCrit').innerHTML = r.won ? [{ label: 'Clear the stage', ok: true }, r.crit2, r.crit3].map(c => `<div class="${c.ok ? 'ok' : ''}">${c.ok ? '★' : '☆'} ${c.label}</div>`).join('')
    + (r.bonus ? `<div style="color:#ffe6a0">Clear bonus ◆ ${r.bonus}</div>` : '')
    + (r.relic ? `<div style="color:#ffe27a;font-size:1.2em">RELIC CLAIMED: ${RELICS[r.relic].name}</div>` : '')
    + (r.stage.id < 13 && save.unlocked > r.stage.id ? `<div style="color:#9fdcff">Stage ${r.stage.id + 1} unlocked</div>` : r.stage.id === 13 ? '<div style="color:#7fe8ff;font-size:1.2em">THE SEAL IS RESTORED. Thank you for playing.</div>' : '')
    : `<div>The Legion overwhelmed you.${r.shards ? ` You still keep the ◆ ${r.shards} shards you found.` : ''} Upgrade in the Sanctum or replay earlier stages for EXP, then try again.</div><div style="color:#9fdcff">EXP to next level: ${fmt(nx - save.exp)}</div>`;
  $('#resContinue').textContent = r.won ? (r.stage.id < 13 ? 'NEXT STAGE ▸' : 'MAP') : 'MAP';
  $('#resContinue').dataset.next = r.won && r.stage.id < 13 ? r.stage.id + 1 : '';
  if (r.won && r.stage.id < 13) selStage = r.stage.id + 1;
  show('results');
}
click('#resRetry', () => startStage(curStage));
click('#resSanctum', () => goSanctum());
click('#resContinue', () => { const n = +$('#resContinue').dataset.next; if (n) selStage = n; goMap(); });

// ---------------------------------------------------------------- input
const keys = {};
const input = game.input;
addEventListener('pointerdown', () => initAudio(), { capture: true });
addEventListener('keydown', e => {
  initAudio();
  if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (mode === 'stage') {
    const c = e.code;
    if (c === 'KeyJ') { input.atk = true; game.attack(); }
    if (c === 'Space' || c === 'ShiftLeft' || c === 'ShiftRight') game.dodge();
    if (c === 'KeyK' || c === 'Digit1') game.skill(0);
    if (c === 'KeyL' || c === 'Digit2') game.skill(1);
    if (c === 'KeyU' || c === 'Digit3') game.skill(2);
    if (c === 'KeyQ' || c === 'Digit4') game.potion();
    if (c === 'Tab' || c === 'KeyF') game.toggleLock();
    if (c === 'Escape' || c === 'KeyP') pause(true);
  } else if (mode === 'paused' && (e.code === 'Escape' || e.code === 'KeyP')) { if ($('#settings').classList.contains('on')) show('pause'); else pause(false); }
  else if (mode === 'intro' && (e.code === 'Space' || e.code === 'Enter')) introStep();
  else if (mode === 'intro' && e.code === 'Escape') endIntro();
  else if (e.code === 'Escape') {
    if ($('#confirm').classList.contains('on')) { $('#confirm').classList.remove('on'); return; }
    if (mode === 'menu' && !$('#menu').classList.contains('on')) { sfx('back'); show('menu'); }
    else if (mode === 'sanctum') { sfx('back'); goMap(); } else if (mode === 'map') { sfx('back'); goMenu(); }
  }
});
addEventListener('keyup', e => { keys[e.code] = false; if (e.code === 'KeyJ') input.atk = mouseAtk; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; input.atk = false; });
// joystick (floats within its pad)
const stick = $('#stick'), knob = $('#knob');
let stickId = null, stickV = { x: 0, y: 0 };
function stickMove(e) {
  const r = stick.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width * 0.42;
  let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  const m = Math.hypot(dx, dy) / R; stickV = m < 0.12 ? { x: 0, y: 0 } : { x: dx / R, y: -dy / R };
}
stick.addEventListener('pointerdown', e => { e.preventDefault(); stickId = e.pointerId; stick.setPointerCapture(e.pointerId); stickMove(e); });
stick.addEventListener('pointermove', e => { if (e.pointerId === stickId) stickMove(e); });
const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; stickV = { x: 0, y: 0 }; knob.style.transform = ''; };
stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
function holdBtn(el, down, up) {
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('press'); try { el.setPointerCapture(e.pointerId); } catch (_) { } if (mode === 'stage') down(); });
  const end = () => { el.classList.remove('press'); up && up(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
}
holdBtn($('#atkBtn'), () => { input.atk = true; game.attack(); }, () => { input.atk = false; });
holdBtn($('#dodgeBtn'), () => game.dodge());
holdBtn($('#sk1'), () => game.skill(0)); holdBtn($('#sk2'), () => game.skill(1)); holdBtn($('#sk3'), () => game.skill(2));
holdBtn($('#potBtn'), () => game.potion());
holdBtn($('#lockBtn'), () => game.toggleLock());
// camera drag on canvas (+ mouse attack)
const drags = new Map(); let mouseAtk = false;
canvas.addEventListener('pointerdown', e => {
  drags.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: 0 });
  canvas.setPointerCapture(e.pointerId);
  if (mode !== 'stage') return;
  if (e.pointerType === 'mouse' && e.button === 0) { mouseAtk = true; input.atk = true; game.attack(); }
  if (e.pointerType === 'mouse' && e.button === 1) { e.preventDefault(); game.toggleLock(); }
  if (e.pointerType === 'mouse' && e.button === 2) game.dodge();
});
canvas.addEventListener('pointermove', e => {
  const d = drags.get(e.pointerId); if (!d) return;
  const dx = e.clientX - d.x, dy = e.clientY - d.y; d.x = e.clientX; d.y = e.clientY; d.moved += Math.abs(dx) + Math.abs(dy);
  if (d.moved > 14 && mouseAtk && e.pointerType === 'mouse') { mouseAtk = false; input.atk = !!keys.KeyJ; }
  if (mode === 'stage') game.rotateCam(dx, dy);
});
const dragEnd = e => { drags.delete(e.pointerId); if (e.pointerType === 'mouse' && mouseAtk) { mouseAtk = false; input.atk = !!keys.KeyJ; } };
canvas.addEventListener('pointerup', dragEnd); canvas.addEventListener('pointercancel', dragEnd);
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'stage') pause(true); });
function readMove() {
  let x = stickV.x, y = stickV.y;
  if (keys.KeyW) y += 1; if (keys.KeyS) y -= 1; if (keys.KeyA) x -= 1; if (keys.KeyD) x += 1;
  const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
  input.mx = x; input.my = y;
}

// ---------------------------------------------------------------- background cameras
function resetHero() { hero.root.visible = true; hero.root.position.set(0, 0, 6); hero.root.rotation.set(0, Math.PI, 0); }
const idleSt = { showcase: true, moveAmt: 0, atkIdx: -1, atkP: 0, cast: 0, dash: false, hitT: 0, deadT: -1, victory: false, combat: false };
const camPos = new THREE.Vector3(0, 6, 20), camLook = new THREE.Vector3(0, 3, 0), wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
function orbit(c, yaw, dist, h, side, lookY) {
  wantPos.set(c.x + Math.sin(yaw) * dist, h, c.z + Math.cos(yaw) * dist);
  wantLook.set(c.x - Math.cos(yaw) * side, lookY, c.z + Math.sin(yaw) * side);
}
const INTRO_SHOTS = {
  seal: t => { wantPos.set(Math.sin(t * 0.08) * 6, 7 + t * 0.15, 16 - t * 0.6); wantLook.set(0, 11, -30); },
  legion: t => { wantPos.set(Math.sin(t * 0.1) * 4, 3.2, 10 - t * 0.3); wantLook.set(0, 2.4, -6); },
  hero: t => { orbit(hero.root.position, 0.3 + t * 0.06, 4.6 - t * 0.08, 2.4, 0, 2.2); },
  shade: t => { wantPos.set(Math.sin(0.25 + t * 0.04) * (4.6 - t * 0.1), 2.3, -2 + Math.cos(0.25 + t * 0.04) * (4.6 - t * 0.1)); wantLook.set(0, 2.1, -2); },
  behind: t => { orbit(hero.root.position, Math.PI * 0 + t * 0.05, 7 + t * 0.2, 2.2 + t * 0.15, -1.2, 4 + t * 0.4); },
};
let lastBgMode = null, lastShot = null;
function bgCamera(dt, t) {
  const hp = hero.root.position;
  let k = 2;
  hero.root.visible = mode !== 'map';
  if (mode === 'menu') { orbit(hp, Math.PI * 0.18 + Math.sin(t * 0.08) * 0.25, 7.5, 2.6, innerWidth / innerHeight > 1.2 ? 2.6 : 0, 2.6); hero.root.rotation.y = Math.PI * 0.18 + 0.3; }
  else if (mode === 'sanctum') { orbit(hp, 0.1 + Math.sin(t * 0.1) * 0.15, 6.2, 2.4, innerWidth / innerHeight > 1.2 ? -2.6 : 0, 2.2); hero.root.rotation.y = 0.2; }
  else if (mode === 'map') { const a = t * 0.04; wantPos.set(Math.sin(a) * 34, 24, Math.cos(a) * 34); wantLook.set(0, 5, 0); k = 1; }
  else if (mode === 'intro') { introT += dt; INTRO_SHOTS[STORY[introI] ? STORY[introI].shot : 'behind'](introT); k = 2.5; hero.root.visible = ['hero', 'behind'].includes(STORY[introI] ? STORY[introI].shot : 'behind'); if (STORY[introI] && STORY[introI].shot !== 'behind' && STORY[introI].shot !== 'hero') hero.root.rotation.y = Math.PI; else hero.root.rotation.y = STORY[introI] && STORY[introI].shot === 'hero' ? 0.3 : Math.PI; }
  const shotKey = mode + (mode === 'intro' ? introI : '');
  if (shotKey !== lastBgMode && dt > 0) { lastBgMode = shotKey; k = 1000; }
  camPos.lerp(wantPos, Math.min(1, dt * k)); camLook.lerp(wantLook, Math.min(1, dt * k));
  camera.position.copy(camPos); camera.lookAt(camLook);
}

// ---------------------------------------------------------------- loop
let last = performance.now(), time = 0;
const perf = { acc: 0, n: 0, done: false };
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; time += dt;
  if (mode === 'paused') { composer.render(); return; }
  if (mode === 'stage' || mode === 'results') {
    if (mode === 'stage') { if (!window.TD || !window.TD.bot) readMove(); } else { input.mx = input.my = 0; input.atk = false; }
    if (!isTouch && mode === 'stage') { if (keys.ArrowLeft) game.rotateCam(-6, 0); if (keys.ArrowRight) game.rotateCam(6, 0); }
    game.update(dt, time);
    if (mode === 'stage' && !perf.done) { perf.acc += dt; perf.n++; if (perf.n > 150) { perf.done = true; if (perf.acc / perf.n > 1 / 36 && pr > 1) { pr = 1; resize(); } } }
  } else {
    hero.update(dt, idleSt);
    for (const e of introLegion) { try { animateEnemy(e, dt, time); } catch (_) { } }
    bgCamera(dt, time);
    if (mode === 'intro') {
      const full = STORY[introI] ? STORY[introI].t.replace(/<[^>]+>/g, '').length : 0;
      if (introChars < full) { const before = introChars | 0; introChars = Math.min(full, introChars + dt * 38); if ((introChars | 0) !== before && (introChars | 0) % 3 === 0) sfx('step', 0.4); renderIntroText(); }
      else if (introChars > full && introChars < 1e9) { introChars = full; }
      else if (introChars >= 1e9) { introChars = full + 0.0001; renderIntroText(); introChars = full; }
    }
  }
  world.update(dt, time);
  fx.update(dt);
  composer.render();
}
camPos.set(0, 8, 24);
resetHero(); goMenu();
requestAnimationFrame(frame);
$('#loading').classList.add('gone'); setTimeout(() => $('#loading').remove(), 700);

// ---------------------------------------------------------------- test hooks
window.TD = {
  game, camera, hero, get save() { return save; }, get mode() { return mode; }, get S() { return game.S; },
  startStage, goMap, goSanctum, goMenu, goIntro, showResults, pause,
  grant: (shards = 0, lv = 0) => { save.shards += shards; save.lv = Math.max(save.lv, lv); writeSave(save); },
  unlockAll: () => { save.unlocked = 13; for (let i = 1; i <= 12; i++) save.stages[i] = save.stages[i] || { stars: 2, best: 150 }; writeSave(save); },
};
