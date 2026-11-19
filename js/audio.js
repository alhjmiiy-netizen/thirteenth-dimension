// Synthesized, heavy cinematic SFX (no samples). Every sound layers a sub boom,
// a noise body and distortion through a shared reverb + compressor.
let ctx = null, master, comp, verb, verbGain, dry, musicGain, noiseBuf;

function makeDist(k) {
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i * 2 / n - 1; c[i] = (1 + k) * x / (1 + k * Math.abs(x)); }
  return c;
}
function impulse(sec, decay) {
  const len = ctx.sampleRate * sec, b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}
let sfxBus, vol = { master: 0.9, music: 0.6, sfx: 0.9 };
export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.25;
  master = ctx.createGain(); master.gain.value = vol.master;
  comp.connect(master); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(comp);
  dry = ctx.createGain(); dry.gain.value = 1; dry.connect(sfxBus);
  verb = ctx.createConvolver(); verb.buffer = impulse(2.8, 2.6);
  verbGain = ctx.createGain(); verbGain.gain.value = 0.38;
  verb.connect(verbGain); verbGain.connect(sfxBus);
  musicGain = ctx.createGain(); musicGain.gain.value = vol.music * 0.5; musicGain.connect(comp);
  const len = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  initMusic();
  if (pendingTrack) playMusic(pendingTrack);
}
export function setVolumes(v) {
  Object.assign(vol, v);
  if (!ctx) return;
  master.gain.setTargetAtTime(vol.master, ctx.currentTime, 0.05);
  sfxBus.gain.setTargetAtTime(vol.sfx, ctx.currentTime, 0.05);
  musicGain.gain.setTargetAtTime(vol.music * 0.5, ctx.currentTime, 0.05);
}
export function audioReady() { return !!ctx; }

function out(node, wet = 0.4) {
  node.connect(dry);
  const s = ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(verb);
}
function env(g, t, a, peak, dec, sus = 0.0001) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dec);
}
// sub boom: sine with pitch drop
function boom(t, f0, f1, dur, vol, wet = 0.3) {
  const o = ctx.createOscillator(), g = ctx.createGain(), sh = ctx.createWaveShaper();
  o.type = 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  sh.curve = makeDist(4);
  env(g, t, 0.005, vol, dur);
  o.connect(sh); sh.connect(g); out(g, wet); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, type, f0, f1, q, vol, wet = 0.4, attack = 0.004, dist = 0) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  s.playbackRate.value = 0.7 + Math.random() * 0.6;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, attack, vol, dur);
  let last = f;
  s.connect(f);
  if (dist) { const sh = ctx.createWaveShaper(); sh.curve = makeDist(dist); f.connect(sh); last = sh; }
  last.connect(g); out(g, wet);
  s.start(t, Math.random()); s.stop(t + attack + dur + 0.05);
}
function tone(t, type, f0, f1, dur, vol, wet = 0.4, attack = 0.01, lp = 0, dist = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  let last = o;
  if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 2; last.connect(f); last = f; }
  if (dist) { const sh = ctx.createWaveShaper(); sh.curve = makeDist(dist); last.connect(sh); last = sh; }
  env(g, t, attack, vol, dur);
  last.connect(g); out(g, wet); o.start(t); o.stop(t + attack + dur + 0.05);
}

const last = {};
export function sfx(name, p = 1) {
  if (!ctx) return;
  const now = ctx.currentTime;
  // rate-limit spammy sounds so the mix stays punchy rather than mushy
  const lim = { hit: 0.045, edeath: 0.06, eswing: 0.08 }[name] || 0;
  if (lim && last[name] && now - last[name] < lim) return;
  last[name] = now;
  const t = now + 0.005;
  switch (name) {
    case 'slash': // heavy blade whoosh + sub push
      noise(t, 0.28, 'bandpass', 3200 * p, 380, 1.4, 0.9, 0.35, 0.02);
      noise(t, 0.18, 'lowpass', 900, 200, 0.7, 0.5, 0.2, 0.01);
      boom(t, 140, 50, 0.22, 0.6, 0.15);
      if (p > 1.1) { noise(t + 0.04, 0.6, 'highpass', 4000, 1800, 0.7, 0.35, 0.6, 0.002, 30); boom(t + 0.03, 90, 30, 0.5, 1.0, 0.3); }
      break;
    case 'hit': // crunchy armor impact
      boom(t, 180, 45, 0.25, 0.9, 0.2);
      noise(t, 0.16, 'bandpass', 2400, 600, 1.2, 1.0, 0.25, 0.002, 20);
      tone(t, 'square', 320 + Math.random() * 120, 90, 0.12, 0.25, 0.3, 0.002, 2400, 8);
      break;
    case 'crit':
      boom(t, 220, 35, 0.45, 1.1, 0.3);
      noise(t, 0.4, 'highpass', 6000, 2000, 0.8, 0.6, 0.6, 0.002, 40);
      tone(t, 'sawtooth', 1200, 300, 0.3, 0.2, 0.7, 0.002, 5000, 6);
      break;
    case 'lightning': { // crackling thunder burst
      boom(t, 120, 28, 1.1, 1.2, 0.45);
      for (let i = 0; i < 7; i++) noise(t + i * 0.035 + Math.random() * 0.02, 0.12, 'highpass', 5000, 2500, 0.7, 0.55, 0.5, 0.001, 50);
      noise(t + 0.05, 1.6, 'lowpass', 1200, 80, 0.8, 0.9, 0.7, 0.03, 4);
      tone(t, 'sawtooth', 2000, 60, 0.5, 0.25, 0.5, 0.002, 6000, 20);
      break; }
    case 'dash':
      noise(t, 0.4, 'bandpass', 400, 5000, 2.5, 0.8, 0.5, 0.05);
      boom(t, 70, 160, 0.25, 0.6, 0.3);
      tone(t, 'sawtooth', 120, 900, 0.3, 0.15, 0.5, 0.02, 3000, 3);
      break;
    case 'vortex':
      tone(t, 'sawtooth', 45, 180, 2.2, 0.5, 0.6, 0.3, 700, 6);
      tone(t, 'sawtooth', 46.5, 175, 2.2, 0.4, 0.6, 0.3, 700, 6);
      noise(t, 2.4, 'bandpass', 200, 2400, 4, 0.7, 0.7, 0.4);
      boom(t, 90, 25, 1.4, 1.1, 0.5);
      break;
    case 'eswing': // enemy heavy swing
      noise(t, 0.3, 'bandpass', 1500, 250, 1.2, 0.45, 0.3, 0.04);
      break;
    case 'hurt': // player takes damage
      boom(t, 110, 35, 0.45, 1.2, 0.3);
      noise(t, 0.25, 'lowpass', 1600, 150, 1, 0.9, 0.3, 0.002, 30);
      tone(t, 'square', 90, 40, 0.3, 0.3, 0.2, 0.002, 600, 10);
      break;
    case 'edeath': // armor shatters + abyss boom
      boom(t, 160, 22, 0.9, 1.2, 0.5);
      noise(t, 0.7, 'bandpass', 5000, 400, 0.9, 0.7, 0.6, 0.002, 25);
      for (let i = 0; i < 4; i++) tone(t + i * 0.03, 'triangle', 1800 + Math.random() * 2400, 600, 0.25, 0.1, 0.8, 0.002);
      break;
    case 'bolt': // enemy red orb launch
      tone(t, 'sawtooth', 600, 90, 0.4, 0.25, 0.5, 0.01, 1800, 8);
      noise(t, 0.3, 'bandpass', 900, 300, 2, 0.3, 0.4, 0.02);
      break;
    case 'roar': // boss roar
      tone(t, 'sawtooth', 95, 48, 1.8, 0.7, 0.6, 0.15, 900, 12);
      tone(t, 'sawtooth', 71, 36, 1.8, 0.6, 0.6, 0.15, 700, 12);
      noise(t, 1.8, 'bandpass', 500, 180, 3, 0.9, 0.6, 0.15, 10);
      boom(t, 60, 20, 1.6, 1.3, 0.6);
      break;
    case 'slam': // boss ground slam
      boom(t, 80, 18, 1.5, 1.5, 0.6);
      noise(t, 1.2, 'lowpass', 2500, 60, 0.7, 1.0, 0.6, 0.002, 30);
      break;
    case 'horn': { // wave start: war horn + drums
      [55, 82.5, 110].forEach((f, i) => tone(t, 'sawtooth', f, f * 0.98, 1.8, 0.28, 0.7, 0.25, 900, 2));
      for (let i = 0; i < 3; i++) { boom(t + i * 0.32, 110, 38, 0.6, 1.2, 0.5); noise(t + i * 0.32, 0.2, 'lowpass', 1200, 200, 1, 0.5, 0.4, 0.002); }
      break; }
    case 'level': {
      boom(t, 100, 30, 1.2, 1.2, 0.5);
      [261.6, 329.6, 392, 523.2, 659.2].forEach((f, i) => tone(t + i * 0.06, 'sawtooth', f, f * 1.003, 1.6, 0.13, 0.8, 0.05, 3500));
      noise(t, 1.6, 'highpass', 3000, 9000, 0.7, 0.3, 0.8, 0.3);
      break; }
    case 'potion':
      [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.07, 'triangle', f, f * 1.01, 0.8, 0.22, 0.8, 0.01));
      noise(t, 0.7, 'bandpass', 800, 6000, 3, 0.35, 0.7, 0.05);
      boom(t, 80, 160, 0.4, 0.4, 0.4);
      break;
    case 'nomp':
      tone(t, 'square', 140, 90, 0.18, 0.2, 0.2, 0.005, 800);
      break;
    case 'dodge':
      noise(t, 0.3, 'bandpass', 700, 4000, 2.2, 0.6, 0.4, 0.03);
      tone(t, 'sine', 300, 900, 0.2, 0.2, 0.4, 0.01);
      break;
    case 'perfect':
      [880, 1318, 1760].forEach((f, i) => tone(t + i * 0.04, 'triangle', f, f, 0.9, 0.18, 0.9, 0.005));
      boom(t, 60, 200, 0.5, 0.6, 0.6);
      noise(t, 0.8, 'highpass', 6000, 3000, 0.7, 0.3, 0.9, 0.01);
      break;
    case 'block':
      tone(t, 'square', 1400, 900, 0.18, 0.25, 0.5, 0.001, 5000, 4);
      tone(t, 'triangle', 2600, 2200, 0.35, 0.15, 0.6, 0.001);
      boom(t, 200, 80, 0.15, 0.5, 0.2);
      break;
    case 'explode':
      boom(t, 140, 20, 1.2, 1.4, 0.5);
      noise(t, 1.0, 'lowpass', 4000, 100, 0.8, 1.0, 0.6, 0.002, 30);
      break;
    case 'beam':
      tone(t, 'sawtooth', 220, 110, 1.2, 0.3, 0.6, 0.05, 1500, 10);
      noise(t, 1.2, 'bandpass', 2000, 600, 3, 0.5, 0.6, 0.05);
      boom(t, 90, 30, 0.8, 0.9, 0.4);
      break;
    case 'teleport':
      tone(t, 'sine', 200, 1600, 0.35, 0.3, 0.7, 0.01);
      noise(t, 0.4, 'bandpass', 500, 5000, 5, 0.4, 0.7, 0.02);
      break;
    case 'freeze':
      for (let i = 0; i < 6; i++) tone(t + i * 0.025, 'triangle', 2400 + Math.random() * 2000, 1500, 0.5, 0.1, 0.8, 0.002);
      noise(t, 1.0, 'highpass', 3000, 8000, 0.7, 0.5, 0.8, 0.01);
      boom(t, 120, 40, 0.6, 0.9, 0.4);
      break;
    case 'blades':
      for (let i = 0; i < 3; i++) noise(t + i * 0.04, 0.25, 'bandpass', 5000, 1200, 3, 0.45, 0.4, 0.005);
      tone(t, 'sawtooth', 900, 300, 0.25, 0.12, 0.4, 0.005, 4000);
      break;
    case 'gale':
      noise(t, 0.9, 'bandpass', 200, 1800, 1.5, 1.0, 0.5, 0.08);
      boom(t, 70, 30, 0.9, 1.2, 0.4);
      break;
    case 'judgment':
      boom(t, 50, 18, 2.5, 1.5, 0.7);
      [65.4, 98, 130.8, 196].forEach(f => tone(t, 'sawtooth', f, f, 2.5, 0.16, 0.8, 0.3, 1800, 3));
      noise(t, 2.5, 'bandpass', 300, 3000, 1, 0.6, 0.8, 0.5);
      break;
    case 'coin':
      tone(t, 'triangle', 1318, 1318, 0.12, 0.12, 0.5, 0.002); tone(t + 0.07, 'triangle', 1760, 1760, 0.3, 0.12, 0.6, 0.002);
      break;
    case 'star':
      boom(t, 120, 40, 0.5, 0.9, 0.4);
      [784, 1046, 1318].forEach((f, i) => tone(t + i * 0.05, 'triangle', f, f, 0.7, 0.16, 0.8, 0.005));
      break;
    case 'unlock':
      boom(t, 100, 30, 0.8, 1, 0.5);
      [392, 523, 659, 784].forEach((f, i) => tone(t + i * 0.07, 'sawtooth', f, f, 1, 0.1, 0.8, 0.01, 3000));
      break;
    case 'back':
      boom(t, 120, 50, 0.2, 0.5, 0.3); noise(t, 0.15, 'bandpass', 1500, 500, 2, 0.25, 0.5, 0.005);
      break;
    case 'step':
      boom(t, 70, 40, 0.18, 0.5, 0.15);
      break;
    case 'ui':
      boom(t, 160, 60, 0.25, 0.6, 0.3);
      noise(t, 0.2, 'bandpass', 3000, 900, 2, 0.3, 0.5, 0.005);
      break;
    case 'victory': {
      boom(t, 90, 25, 2, 1.4, 0.6);
      [130.8, 196, 261.6, 329.6, 392].forEach((f, i) => tone(t + 0.1, 'sawtooth', f, f, 3, 0.14, 0.8, 0.4, 2500));
      break; }
    case 'defeat':
      boom(t, 70, 18, 2.5, 1.5, 0.7);
      [65.4, 77.8, 98].forEach(f => tone(t, 'sawtooth', f, f * 0.9, 3, 0.2, 0.8, 0.3, 600, 3));
      break;
  }
}


// ---------------- music: step sequencer with three synth scores ----------------
let mus = null, pendingTrack = null;
const N2F = n => 440 * Math.pow(2, (n - 69) / 12);
function initMusic() {
  mus = { track: null, step: 0, next: 0, gain: null, timer: null };
  mus.timer = setInterval(schedule, 25);
}
const TRACKS = {
  // tempo, steps per bar 16, chord roots (midi) per bar
  menu: { bpm: 72, chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]], arp: true, drums: 'soft', bass: 'drone' },
  stage: { bpm: 118, chords: [[45, 48, 52], [41, 45, 48], [43, 47, 50], [40, 44, 47]], arp: true, drums: 'drive', bass: 'pulse' },
  boss: { bpm: 142, chords: [[40, 43, 47], [40, 43, 47], [41, 44, 48], [39, 43, 46]], arp: false, drums: 'heavy', bass: 'dist', stabs: true },
  victory: { bpm: 96, chords: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], arp: true, drums: 'soft', bass: 'drone', once: 2 },
};
export function playMusic(name) {
  if (!ctx) { pendingTrack = name; return; }
  if (mus.track === name) return;
  const old = mus.gain; if (old) { old.gain.setTargetAtTime(0, ctx.currentTime, 0.6); setTimeout(() => old.disconnect(), 3000); }
  mus.track = name; mus.step = 0; mus.next = ctx.currentTime + 0.1; mus.bars = 0;
  if (!name) { mus.gain = null; return; }
  const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, ctx.currentTime, 0.8); g.connect(musicGain);
  const send = ctx.createGain(); send.gain.value = 0.35; g.connect(send); send.connect(verb);
  mus.gain = g;
}
function mnote(t, type, f, dur, v, lp = 3000, q = 1, atk = 0.01, dist = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain(), fl = ctx.createBiquadFilter();
  o.type = type; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.value = lp; fl.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let last = o; o.connect(fl); last = fl;
  if (dist) { const sh = ctx.createWaveShaper(); sh.curve = makeDist(dist); fl.connect(sh); last = sh; }
  last.connect(g); g.connect(mus.gain); o.start(t); o.stop(t + dur + 0.05);
}
function mkick(t, v, f0 = 140) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
  o.connect(g); g.connect(mus.gain); o.start(t); o.stop(t + 0.45);
}
function mnoise(t, dur, type, f, v) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f;
  const g = ctx.createGain(); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl); fl.connect(g); g.connect(mus.gain); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function schedule() {
  if (!ctx || !mus || !mus.track || !mus.gain) return;
  const T = TRACKS[mus.track], spb = 60 / T.bpm / 4;
  while (mus.next < ctx.currentTime + 0.12) {
    const t = mus.next, st = mus.step % 16, bar = Math.floor(mus.step / 16), ch = T.chords[bar % T.chords.length];
    // pad at bar start
    if (st === 0) {
      if (T.once && bar >= T.once * T.chords.length) { mus.track = null; return; }
      const len = spb * 16 + 0.3;
      ch.forEach(n => { mnote(t, 'sawtooth', N2F(n + 12), len, 0.045, 900, 1, 0.6); mnote(t, 'sawtooth', N2F(n + 12) * 1.006, len, 0.04, 900, 1, 0.6); });
      if (T.bass === 'drone') mnote(t, 'triangle', N2F(ch[0] - 12), len, 0.18, 400, 1, 0.4);
    }
    if (T.bass === 'pulse' && st % 2 === 0) mnote(t, 'sawtooth', N2F(ch[0] - 12), spb * 1.6, 0.13, 500 + (st % 8 === 0 ? 400 : 0), 4, 0.005);
    if (T.bass === 'dist' && st % 1 === 0) mnote(t, 'sawtooth', N2F(ch[0] - 12 + (st === 14 ? 3 : 0)), spb * 0.9, 0.09, 700, 3, 0.003, 6);
    if (T.arp && st % 2 === 0) { const n = ch[(st / 2) % 3] + 24 + (st >= 8 ? 12 : 0) * (mus.track === 'menu' ? 0 : 1); mnote(t, 'triangle', N2F(n), spb * 3, mus.track === 'menu' ? 0.05 : 0.04, 4000, 1, 0.005); }
    if (T.stabs && (st === 0 || st === 6 || st === 12)) ch.forEach(n => mnote(t, 'sawtooth', N2F(n + 12), spb * 2, 0.06, 2200, 2, 0.005, 2));
    // drums
    if (T.drums === 'soft') { if (st === 0) mkick(t, 0.5, 90); if (st === 8 && bar % 2) mkick(t, 0.3, 80); }
    if (T.drums === 'drive') {
      if (st % 4 === 0) mkick(t, 0.75); if (st === 4 || st === 12) { mnoise(t, 0.18, 'bandpass', 1800, 0.35); mkick(t, 0.2, 220); }
      if (st % 2 === 1) mnoise(t, 0.04, 'highpass', 8000, 0.08);
    }
    if (T.drums === 'heavy') {
      if (st % 4 === 0 || st === 3 || st === 11) mkick(t, 0.85); if (st === 4 || st === 12) { mnoise(t, 0.22, 'bandpass', 1500, 0.45); mkick(t, 0.25, 240); }
      mnoise(t, 0.03, 'highpass', 9000, st % 2 ? 0.05 : 0.09);
      if (st === 0 && bar % 2 === 0) mnoise(t, 1.2, 'highpass', 5000, 0.12);
    }
    mus.next += spb; mus.step++;
  }
}
