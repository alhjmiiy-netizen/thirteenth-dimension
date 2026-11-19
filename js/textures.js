import * as THREE from 'three';

function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
function tex(c, rep) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
  return t;
}
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ⟁⌬⍟✶';
function runeText(g, r, size, n, rot = 0) {
  g.save(); g.font = `${size}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < n; i++) {
    const a = rot + i / n * Math.PI * 2;
    g.save(); g.rotate(a); g.translate(0, -r); g.fillText(RUNES[(i * 7 + n) % RUNES.length], 0, 0); g.restore();
  }
  g.restore();
}
function ring(g, r, w) { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); }
function poly(g, r, n, rot, step = 1) {
  g.beginPath();
  for (let i = 0; i <= n; i++) { const a = rot + (i * step) / n * Math.PI * 2; const x = Math.sin(a) * r, y = -Math.cos(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
}

// Wet dark stone tiles (color + roughness in one canvas each)
export function tileTextures(fc = [8, 10, 20]) {
  const S = 512, [c, g] = cv(S), [rc, rg] = cv(S);
  g.fillStyle = '#05080f'; g.fillRect(0, 0, S, S);
  rg.fillStyle = '#ffffff'; rg.fillRect(0, 0, S, S);
  const n = 4, ts = S / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const k = 0.75 + Math.random() * 0.7;
    g.fillStyle = `rgb(${fc[0] * k | 0},${fc[1] * k | 0},${fc[2] * k | 0})`; g.fillRect(x * ts + 3, y * ts + 3, ts - 6, ts - 6);
    // puddles = low roughness
    const v = 70 + Math.random() * 90; rg.fillStyle = `rgb(${v},${v},${v})`; rg.fillRect(x * ts + 3, y * ts + 3, ts - 6, ts - 6);
    for (let k = 0; k < 3; k++) {
      const px = x * ts + Math.random() * ts, py = y * ts + Math.random() * ts, pr = 10 + Math.random() * 40;
      const gr = rg.createRadialGradient(px, py, 0, px, py, pr); gr.addColorStop(0, '#101010'); gr.addColorStop(1, 'rgba(16,16,16,0)');
      rg.fillStyle = gr; rg.fillRect(px - pr, py - pr, pr * 2, pr * 2);
    }
    for (let k = 0; k < 60; k++) { g.fillStyle = `rgba(${Math.random() < .5 ? '120,160,220' : '0,0,0'},${Math.random() * 0.08})`; g.fillRect(x * ts + Math.random() * ts, y * ts + Math.random() * ts, 2 + Math.random() * 8, 1 + Math.random() * 3); }
  }
  g.strokeStyle = '#03060c'; g.lineWidth = 5;
  for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * ts, 0); g.lineTo(i * ts, S); g.stroke(); g.beginPath(); g.moveTo(0, i * ts); g.lineTo(S, i * ts); g.stroke(); }
  rg.strokeStyle = '#ffffff'; rg.lineWidth = 6;
  for (let i = 0; i <= n; i++) { rg.beginPath(); rg.moveTo(i * ts, 0); rg.lineTo(i * ts, S); rg.stroke(); rg.beginPath(); rg.moveTo(0, i * ts); rg.lineTo(S, i * ts); rg.stroke(); }
  const t = tex(c, 14), r = new THREE.CanvasTexture(rc); r.wrapS = r.wrapT = THREE.RepeatWrapping; r.repeat.set(14, 14);
  return { map: t, rough: r };
}

// Concentric rune circles for the arena floor (drawn white, tinted by material)
export function floorRunes() {
  const S = 2048, [c, g] = cv(S); g.translate(S / 2, S / 2);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff';
  const R = S / 2 - 10;
  [[1, 6], [0.97, 2], [0.86, 3], [0.83, 1.5], [0.64, 4], [0.61, 1.5], [0.42, 3], [0.39, 1], [0.2, 3], [0.17, 1.5]].forEach(([r, w]) => ring(g, R * r, w));
  runeText(g, R * 0.915, 46, 52); runeText(g, R * 0.725, 40, 40, 0.1); runeText(g, R * 0.505, 34, 28, 0.2); runeText(g, R * 0.295, 30, 18);
  g.lineWidth = 2; g.globalAlpha = 0.55;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(Math.sin(a) * R * 0.42, Math.cos(a) * R * 0.42); g.lineTo(Math.sin(a) * R * 0.61, Math.cos(a) * R * 0.61); g.stroke(); }
  g.globalAlpha = 0.8; poly(g, R * 0.83, 7, 0, 3); poly(g, R * 0.61, 6, 0); poly(g, R * 0.61, 6, Math.PI / 6);
  const t = tex(c); return t;
}

// The floating hexagram seal with "13"
export function sealTexture() {
  const S = 2048, [c, g] = cv(S); g.translate(S / 2, S / 2);
  const R = S / 2 - 30;
  g.strokeStyle = '#bff3ff'; g.fillStyle = '#e6fbff';
  g.shadowColor = '#5fd8ff'; g.shadowBlur = 18;
  [[1, 10], [0.965, 3], [0.88, 6], [0.855, 2], [0.7, 4], [0.675, 2], [0.36, 5], [0.33, 2]].forEach(([r, w]) => ring(g, R * r, w));
  runeText(g, R * 0.92, 64, 44); runeText(g, R * 0.78, 54, 32, 0.05);
  // hexagram
  g.lineWidth = 9; g.beginPath();
  for (const off of [0, Math.PI]) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = off + i / 3 * Math.PI * 2; const x = Math.sin(a) * R * 0.855, y = -Math.cos(a) * R * 0.855; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  g.lineWidth = 4; poly(g, R * 0.495, 6, Math.PI / 6);
  // 13-point star inner
  g.lineWidth = 3; poly(g, R * 0.675, 13, 0, 5);
  // ornate arcs
  g.lineWidth = 3;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; g.beginPath(); g.arc(Math.sin(a) * R * 0.6, -Math.cos(a) * R * 0.6, R * 0.09, 0, Math.PI * 2); g.stroke(); g.font = '70px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(RUNES[i * 3], Math.sin(a) * R * 0.6, -Math.cos(a) * R * 0.6); }
  // the 13
  g.shadowBlur = 40; g.font = `800 ${R * 0.38}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeText('13', 0, R * 0.47); g.fillText('13', 0, R * 0.47);
  return tex(c);
}

// Sky seal: same geometry language as sealTexture, but the centre is left open
// (a 3D rose sits there) and the "13" rides above the rose, as in the concept art.
export function sealSkyTexture() {
  const S = 2048, [c, g] = cv(S); g.translate(S / 2, S / 2);
  const R = S / 2 - 30;
  g.strokeStyle = '#bff3ff'; g.fillStyle = '#e6fbff';
  g.shadowColor = '#5fd8ff'; g.shadowBlur = 18;
  [[1, 10], [0.965, 3], [0.88, 6], [0.855, 2], [0.7, 4], [0.675, 2]].forEach(([r, w]) => ring(g, R * r, w));
  runeText(g, R * 0.92, 64, 44); runeText(g, R * 0.78, 54, 32, 0.05);
  // hexagram
  g.lineWidth = 9;
  for (const off of [0, Math.PI]) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = off + i / 3 * Math.PI * 2; const x = Math.sin(a) * R * 0.855, y = -Math.cos(a) * R * 0.855; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  g.lineWidth = 4; poly(g, R * 0.495, 6, Math.PI / 6);
  // 13-point star ring (stays outside the open centre)
  g.lineWidth = 3; poly(g, R * 0.675, 13, 0, 5);
  // inner broken ring around the rose
  g.lineWidth = 4; g.setLineDash([R * 0.09, R * 0.05]); ring(g, R * 0.40, 4); g.setLineDash([]);
  // ornate arcs
  g.lineWidth = 3;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + Math.PI / 6; g.beginPath(); g.arc(Math.sin(a) * R * 0.6, -Math.cos(a) * R * 0.6, R * 0.09, 0, Math.PI * 2); g.stroke(); g.font = '70px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(RUNES[i * 3], Math.sin(a) * R * 0.6, -Math.cos(a) * R * 0.6); }
  // the 13, enthroned above the rose
  g.shadowBlur = 44; g.font = `800 ${R * 0.30}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 6; g.strokeText('13', 0, -R * 0.545); g.fillText('13', 0, -R * 0.545);
  return tex(c);
}

// Glow ring under the hero
export function heroRing(fill = true) {
  const S = 512, [c, g] = cv(S); g.translate(S / 2, S / 2);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, S / 2); gr.addColorStop(0, 'rgba(120,220,255,0.55)'); gr.addColorStop(0.5, 'rgba(40,140,255,0.15)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  if (fill) { g.fillStyle = gr; g.fillRect(-S, -S, S * 2, S * 2); }
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8;
  ring(g, 240, 5); ring(g, 222, 2); runeText(g, 200, 26, 20); ring(g, 176, 3); poly(g, 170, 6, 0, 2); poly(g, 170, 6, Math.PI / 6, 2);
  return tex(c);
}

export function softDot(color = '#ffffff') {
  const S = 64, [c, g] = cv(S);
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S); return tex(c);
}

export function planetTexture() {
  const [c, g] = cv(512, 256);
  for (let y = 0; y < 256; y++) {
    const v = Math.sin(y * 0.09) * 0.5 + Math.sin(y * 0.23 + 1) * 0.3 + Math.sin(y * 0.6) * 0.15;
    const r = 120 + v * 60, gg = 60 + v * 30, b = 190 + v * 50;
    g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(0, y, 512, 1);
  }
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(255,200,255,${Math.random() * 0.06})`; g.fillRect(Math.random() * 512, Math.random() * 256, 30 + Math.random() * 120, 2 + Math.random() * 3); }
  return tex(c);
}
export function ringTexture() {
  const [c, g] = cv(512, 8);
  for (let x = 0; x < 512; x++) {
    const a = (0.25 + 0.5 * Math.abs(Math.sin(x * 0.07)) * Math.abs(Math.sin(x * 0.019 + 2))) * Math.min(1, x / 40, (512 - x) / 40);
    g.fillStyle = `rgba(${200 + Math.sin(x * .05) * 40 | 0},${160 + Math.sin(x * .03) * 40 | 0},255,${a})`; g.fillRect(x, 0, 1, 8);
  }
  return tex(c);
}

// Coat: black with glowing circuit lines + 13 emblem (used as emissiveMap)
export function coatEmissive(withEmblem = true) {
  const S = 512, [c, g] = cv(S);
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.shadowColor = '#fff'; g.shadowBlur = 4;
  // circuit traces running down
  for (let i = 0; i < 16; i++) {
    let x = Math.random() * S, y = Math.random() * 60; g.beginPath(); g.moveTo(x, y);
    while (y < S) { if (Math.random() < 0.4) { x += (Math.random() < .5 ? -1 : 1) * 20; } else y += 30 + Math.random() * 40; g.lineTo(x, y); }
    g.stroke(); g.beginPath(); g.arc(x, Math.min(y, S - 6), 5, 0, 7); g.fill();
  }
  // hem glow
  g.fillStyle = '#fff'; g.fillRect(0, S - 10, S, 10);
  // back emblem (u=0.5 is the back of the cylinder when it faces -z... placed at both 0.25 and 0.75 for safety)
  g.lineWidth = 5;
  for (const u of (withEmblem ? [0.5] : [])) {
    const cx = u * S, cy = 120;
    g.beginPath(); g.moveTo(cx, cy - 60); g.lineTo(cx + 55, cy); g.lineTo(cx, cy + 60); g.lineTo(cx - 55, cy); g.closePath(); g.stroke();
    g.font = '800 54px Cinzel, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('13', cx, cy + 3);
  }
  return tex(c);
}

// Coat cloth: greyscale weave + seams, used as a roughnessMap so the black
// coat catches light unevenly like heavy fabric instead of flat plastic.
export function coatCloth() {
  const S = 256, [c, g] = cv(S);
  g.fillStyle = '#8c8c8c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { const v = 100 + Math.random() * 110 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * S, Math.random() * S, 2, 1); }
  for (let x = 0; x < S; x += 3) { g.fillStyle = `rgba(60,60,60,${0.05 + (x % 9 === 0 ? 0.08 : 0)})`; g.fillRect(x, 0, 1, S); }
  for (let y = 0; y < S; y += 3) { g.fillStyle = 'rgba(200,200,200,0.05)'; g.fillRect(0, y, S, 1); }
  g.fillStyle = 'rgba(50,50,50,0.35)'; g.fillRect(0, S * 0.32, S, 3); g.fillRect(0, S * 0.78, S, 3);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// Coat back panel: black cloth with the glowing "13" sigil enthroned in a
// diamond, as in the concept art. Drawn white-hot so it can serve as both
// map (dimmed by material colour) and emissiveMap (tinted by emissive).
export function coatBackTexture() {
  const W = 256, H = 384, [c, g] = cv(W, H);
  g.fillStyle = '#0a0c13'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(140,170,230,${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * H, 2, 1); }
  for (let x = 8; x < W; x += 16) { g.fillStyle = 'rgba(120,160,230,0.05)'; g.fillRect(x, 0, 1, H); }
  const cx = W / 2, cy = H * 0.47;
  g.strokeStyle = '#dff6ff'; g.fillStyle = '#eafcff';
  g.shadowColor = '#39b6ff'; g.shadowBlur = 22;
  // diamond sigil
  g.lineWidth = 5; g.beginPath(); g.moveTo(cx, cy - 92); g.lineTo(cx + 74, cy); g.lineTo(cx, cy + 92); g.lineTo(cx - 74, cy); g.closePath(); g.stroke();
  g.lineWidth = 2; g.beginPath(); g.moveTo(cx, cy - 106); g.lineTo(cx + 86, cy); g.lineTo(cx, cy + 106); g.lineTo(cx - 86, cy); g.closePath(); g.stroke();
  // the 13
  g.font = '800 96px Cinzel, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowBlur = 30; g.fillText('13', cx, cy + 6);
  // corner ticks + rune dots
  g.shadowBlur = 12; g.font = '26px serif';
  g.fillText(RUNES[4], cx, cy - 128); g.fillText(RUNES[17], cx, cy + 130);
  for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 104, cy, 5, 0, 7); g.fill(); }
  // glow seams running down from the sigil
  g.lineWidth = 3; g.shadowBlur = 14;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx + s * 30, cy + 108); g.lineTo(cx + s * 30, H - 26); g.stroke(); g.beginPath(); g.arc(cx + s * 30, H - 20, 4, 0, 7); g.fill(); }
  g.fillRect(14, H - 12, W - 28, 5);
  const t = tex(c); return t;
}

// Stylized HUD portrait of the hero
export function drawPortrait(canvas) {
  const g = canvas.getContext('2d'), S = canvas.width; g.clearRect(0, 0, S, S);
  const bg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2); bg.addColorStop(0, '#16407e'); bg.addColorStop(1, '#030a1c');
  g.fillStyle = bg; g.fillRect(0, 0, S, S);
  const cx = S / 2;
  // horns
  g.fillStyle = '#1a1626';
  [[-1], [1]].forEach(([s]) => { g.beginPath(); g.moveTo(cx + s * 22, 52); g.quadraticCurveTo(cx + s * 52, 30, cx + s * 58, 6); g.quadraticCurveTo(cx + s * 44, 34, cx + s * 30, 62); g.fill(); });
  // neck + coat collar
  g.fillStyle = '#d9b8a6'; g.fillRect(cx - 12, 108, 24, 30);
  g.fillStyle = '#05070d'; g.beginPath(); g.moveTo(cx - 70, S); g.lineTo(cx - 30, 118); g.lineTo(cx, 140); g.lineTo(cx + 30, 118); g.lineTo(cx + 70, S); g.fill();
  g.strokeStyle = '#5fe6ff'; g.lineWidth = 2; g.shadowColor = '#5fe6ff'; g.shadowBlur = 8; g.beginPath(); g.moveTo(cx - 30, 118); g.lineTo(cx - 50, S); g.moveTo(cx + 30, 118); g.lineTo(cx + 50, S); g.stroke(); g.shadowBlur = 0;
  // face
  g.fillStyle = '#e8c9b6'; g.beginPath(); g.moveTo(cx - 30, 60); g.quadraticCurveTo(cx - 32, 105, cx, 122); g.quadraticCurveTo(cx + 32, 105, cx + 30, 60); g.closePath(); g.fill();
  // ears
  g.beginPath(); g.moveTo(cx - 29, 78); g.lineTo(cx - 48, 64); g.lineTo(cx - 28, 92); g.fill();
  g.beginPath(); g.moveTo(cx + 29, 78); g.lineTo(cx + 48, 64); g.lineTo(cx + 28, 92); g.fill();
  // eyes
  g.shadowColor = '#3fd0ff'; g.shadowBlur = 12; g.fillStyle = '#8ff0ff';
  g.beginPath(); g.ellipse(cx - 13, 86, 7, 3.2, -0.15, 0, 7); g.fill(); g.beginPath(); g.ellipse(cx + 13, 86, 7, 3.2, 0.15, 0, 7); g.fill();
  // markings
  g.strokeStyle = '#3fb6ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 22, 92); g.lineTo(cx - 17, 104); g.moveTo(cx + 22, 92); g.lineTo(cx + 17, 104); g.moveTo(cx, 66); g.lineTo(cx, 74); g.stroke(); g.shadowBlur = 0;
  g.fillStyle = '#7a4a40'; g.fillRect(cx - 6, 108, 12, 2);
  // spiky hair
  g.fillStyle = '#07080f';
  const spikes = [[-46, 70], [-40, 40], [-26, 22], [-8, 14], [10, 16], [28, 24], [42, 42], [48, 72]];
  g.beginPath(); g.moveTo(cx - 34, 80);
  spikes.forEach(([x, y], i) => { g.lineTo(cx + x, y); g.lineTo(cx + (x + (spikes[i + 1] || [36])[0]) / 2 * 0.7, 52); });
  g.lineTo(cx + 34, 80); g.lineTo(cx + 26, 60); g.lineTo(cx + 10, 74); g.lineTo(cx, 62); g.lineTo(cx - 14, 76); g.lineTo(cx - 26, 60); g.closePath(); g.fill();
  g.strokeStyle = '#2a8cff'; g.lineWidth = 2; g.shadowColor = '#2a8cff'; g.shadowBlur = 6;
  g.beginPath(); g.moveTo(cx - 26, 22 + 8); g.lineTo(cx - 18, 50); g.moveTo(cx + 10, 18); g.lineTo(cx + 6, 46); g.moveTo(cx + 42, 44); g.lineTo(cx + 30, 58); g.stroke();
}

// Skill icons
const ICOL = { atk: ['#3a9cff', '#06204a'], lightning: ['#7fe8ff', '#06264a'], nova: ['#bff6ff', '#0a2a4a'], blades: ['#4dffd2', '#04262a'], vortex: ['#a46bff', '#1a0640'], gale: ['#5dff8a', '#06301a'], judgment: ['#ffe27a', '#3a2604'], pot: ['#ff5a7e', '#2a0412'], dodge: ['#9fe8ff', '#062040'], lock: ['#ff6a5a', '#2a0606'], fly: ['#5dff8a', '#06301a'], sink: ['#8affc1', '#04281a'], empty: ['#2a3a5a', '#060c1a'] };
export function drawIcon(canvas, kind) {
  const g = canvas.getContext('2d'), S = canvas.width, c = S / 2; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
  const cols = ICOL[kind] || ICOL.empty;
  const bg = g.createRadialGradient(c, c, 0, c, c, c);
  bg.addColorStop(0, cols[0]); bg.addColorStop(0.35, cols[1]); bg.addColorStop(1, '#020611'); g.fillStyle = bg; g.fillRect(0, 0, S, S);
  g.translate(c, c); g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.shadowColor = cols[0]; g.shadowBlur = 10; g.lineCap = 'round'; g.lineJoin = 'round';
  const L = (pts, w = 0.05) => { g.lineWidth = S * w; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)); g.stroke(); };
  if (kind === 'atk') {
    g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, r = i % 2 ? S * 0.14 : S * 0.42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath();
    g.globalAlpha = 0.9; g.fill(); g.globalAlpha = 1; g.fillStyle = '#bff3ff'; g.beginPath(); g.arc(0, 0, S * 0.12, 0, 7); g.fill();
    g.lineWidth = 2; ring(g, S * 0.46, 2);
  } else if (kind === 'lightning') {
    L([[-0.08, -0.36], [0.1, -0.04], [-0.06, 0], [0.1, 0.36]]);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; L([[Math.cos(a) * 0.28, Math.sin(a) * 0.28], [Math.cos(a) * 0.4, Math.sin(a) * 0.4]], 0.025); }
  } else if (kind === 'nova') {
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a); L([[0, 0], [ca * 0.36, sa * 0.36]], 0.04); L([[ca * 0.22 - sa * 0.08, sa * 0.22 + ca * 0.08], [ca * 0.3, sa * 0.3], [ca * 0.22 + sa * 0.08, sa * 0.22 - ca * 0.08]], 0.03); }
  } else if (kind === 'blades') {
    for (let i = -2; i <= 2; i++) { g.save(); g.rotate(i * 0.32); L([[0, 0.3], [0, -0.36]], 0.035); L([[-0.05, 0.18], [0.05, 0.18]], 0.03); g.restore(); }
  } else if (kind === 'vortex') {
    g.lineWidth = S * 0.035; for (let k = 0; k < 3; k++) { g.beginPath(); for (let t = 0; t < 40; t++) { const a = k * 2.09 + t * 0.14, r = t * S * 0.009; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); }
  } else if (kind === 'gale') {
    for (let k = 0; k < 3; k++) { g.lineWidth = S * 0.04; g.beginPath(); g.arc(-S * 0.3, 0, S * (0.25 + k * 0.12), -0.6, 0.6); g.stroke(); }
    L([[-0.34, -0.2], [-0.12, -0.32], [-0.2, -0.1]], 0.03);
  } else if (kind === 'judgment') {
    g.lineWidth = S * 0.03; for (const o of [0, Math.PI]) { g.beginPath(); for (let i = 0; i <= 3; i++) { const a = o + i / 3 * Math.PI * 2; g.lineTo(Math.sin(a) * S * 0.38, -Math.cos(a) * S * 0.38); } g.stroke(); }
    g.font = `800 ${S * 0.3}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('13', 0, S * 0.02);
  } else if (kind === 'pot') {
    g.fillStyle = '#ff3d6e'; g.beginPath(); g.arc(0, S * 0.06, S * 0.2, 0, 7); g.fill(); g.fillStyle = '#ffd0dc'; g.fillRect(-S * 0.06, -S * 0.3, S * 0.12, S * 0.16);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-S * 0.07, 0, S * 0.05, 0, 7); g.fill();
  } else if (kind === 'dodge') {
    g.beginPath(); g.moveTo(-S * 0.3, S * 0.18); g.quadraticCurveTo(-S * 0.1, -S * 0.34, S * 0.34, -S * 0.3); g.quadraticCurveTo(S * 0.1, -S * 0.12, S * 0.26, -S * 0.04); g.quadraticCurveTo(S * 0.02, 0, S * 0.18, S * 0.1); g.quadraticCurveTo(-S * 0.06, S * 0.08, -S * 0.3, S * 0.18); g.fill();
  } else if (kind === 'fly') {
    // spread wing + rising chevron
    g.beginPath(); g.moveTo(-S * 0.34, S * 0.1); g.quadraticCurveTo(-S * 0.12, -S * 0.3, S * 0.36, -S * 0.26); g.quadraticCurveTo(S * 0.08, -S * 0.08, S * 0.3, 0); g.quadraticCurveTo(S * 0.02, -S * 0.02, S * 0.2, S * 0.08); g.quadraticCurveTo(-S * 0.08, S * 0.02, -S * 0.34, S * 0.1); g.fill();
    L([[-0.14, 0.3], [0, 0.16], [0.14, 0.3]], 0.055);
  } else if (kind === 'sink') {
    g.beginPath(); g.moveTo(-S * 0.34, -S * 0.16); g.quadraticCurveTo(-S * 0.12, -S * 0.02, S * 0.36, 0.02); g.quadraticCurveTo(S * 0.08, 0.06, S * 0.3, 0.14); g.quadraticCurveTo(S * 0.02, 0.12, S * 0.2, 0.2); g.quadraticCurveTo(-S * 0.08, 0.14, -S * 0.34, -S * 0.16); g.fill();
    L([[-0.14, -0.3], [0, -0.16], [0.14, -0.3]], 0.055);
  } else if (kind === 'lock') {
    g.lineWidth = S * 0.045; g.beginPath(); g.arc(0, 0, S * 0.24, 0, 7); g.stroke();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; L([[Math.cos(a) * 0.14, Math.sin(a) * 0.14], [Math.cos(a) * 0.38, Math.sin(a) * 0.38]], 0.04); }
  } else if (kind === 'empty') {
    g.globalAlpha = 0.5; ring(g, S * 0.3, 2);
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

const RCOL = { rose: '#ff4a6a', storm: '#7fe8ff', cloak: '#6a7aff', fang: '#ff3a2a', lens: '#b27bff', heart: '#ff7a3a', feather: '#fff2b0', crowns: '#ffd24a', sigil: '#5fc8ff', none: '#2a3a5a' };
export function drawRelic(canvas, id) {
  const g = canvas.getContext('2d'), S = canvas.width, c = S / 2; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S, S);
  const col = RCOL[id] || RCOL.none;
  g.translate(c, c); g.rotate(Math.PI / 4);
  const bg = g.createLinearGradient(-c, -c, c, c); bg.addColorStop(0, '#0c2050'); bg.addColorStop(1, '#030816');
  g.fillStyle = bg; g.fillRect(-S * 0.33, -S * 0.33, S * 0.66, S * 0.66);
  g.strokeStyle = id ? col : '#4a86c8'; g.lineWidth = S * 0.03; g.shadowColor = col; g.shadowBlur = id ? 12 : 0; g.strokeRect(-S * 0.33, -S * 0.33, S * 0.66, S * 0.66);
  g.setTransform(1, 0, 0, 1, c, c); g.fillStyle = col; g.strokeStyle = col; g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = S * 0.04;
  if (!id) { g.globalAlpha = 0.85; g.fillStyle = '#7fb8e8'; g.font = `700 ${S * 0.3}px Rajdhani`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', 0, 0); }
  else if (id === 'rose') { for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * 1.2566); g.beginPath(); g.ellipse(0, -S * 0.09, S * 0.07, S * 0.11, 0, 0, 7); g.fill(); g.restore(); } g.fillStyle = '#ffd0da'; g.beginPath(); g.arc(0, 0, S * 0.05, 0, 7); g.fill(); }
  else if (id === 'storm') { g.beginPath(); g.moveTo(-S * 0.05, -S * 0.22); g.lineTo(S * 0.08, -S * 0.02); g.lineTo(-S * 0.04, 0); g.lineTo(S * 0.07, S * 0.22); g.stroke(); }
  else if (id === 'cloak') { g.beginPath(); g.moveTo(0, -S * 0.2); g.quadraticCurveTo(S * 0.22, 0, S * 0.16, S * 0.2); g.lineTo(-S * 0.16, S * 0.2); g.quadraticCurveTo(-S * 0.22, 0, 0, -S * 0.2); g.fill(); }
  else if (id === 'fang') { g.beginPath(); g.moveTo(-S * 0.12, -S * 0.18); g.quadraticCurveTo(S * 0.18, -S * 0.1, S * 0.02, S * 0.22); g.quadraticCurveTo(S * 0.02, -S * 0.02, -S * 0.12, -S * 0.18); g.fill(); }
  else if (id === 'lens') { g.beginPath(); g.ellipse(0, 0, S * 0.2, S * 0.12, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(0, 0, S * 0.06, 0, 7); g.fill(); }
  else if (id === 'heart') { g.beginPath(); g.moveTo(0, S * 0.18); g.bezierCurveTo(-S * 0.3, -S * 0.02, -S * 0.12, -S * 0.24, 0, -S * 0.08); g.bezierCurveTo(S * 0.12, -S * 0.24, S * 0.3, -S * 0.02, 0, S * 0.18); g.fill(); }
  else if (id === 'feather') { g.beginPath(); g.moveTo(-S * 0.14, S * 0.2); g.quadraticCurveTo(-S * 0.1, -S * 0.1, S * 0.16, -S * 0.22); g.quadraticCurveTo(S * 0.08, S * 0.04, -S * 0.14, S * 0.2); g.fill(); }
  else if (id === 'crowns') { for (const o of [-0.09, 0.09]) { g.beginPath(); const x = o * S; g.moveTo(x - S * 0.1, S * 0.08); g.lineTo(x - S * 0.1, -S * 0.08); g.lineTo(x - S * 0.05, 0); g.lineTo(x, -S * 0.12); g.lineTo(x + S * 0.05, 0); g.lineTo(x + S * 0.1, -S * 0.08); g.lineTo(x + S * 0.1, S * 0.08); g.closePath(); g.globalAlpha = o < 0 ? 0.7 : 1; g.fill(); } g.globalAlpha = 1; }
  else if (id === 'sigil') { g.font = `800 ${S * 0.26}px Cinzel, serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = col; g.shadowBlur = 10; g.fillText('13', 0, S * 0.02); }
  g.setTransform(1, 0, 0, 1, 0, 0);
}
