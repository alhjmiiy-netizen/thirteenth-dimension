// ---------------- static game data ----------------
export const PALETTES = {
  azure:   { name: 'azure',   zenith: [1, 4, 17],  horizon: [9, 42, 148], neb: [60, 90, 255], neb2: [140, 50, 200], glow: [0.3, 1.4, 3.2], glow2: [0.3, 1.5, 2.2], rune: [0.1, 0.45, 1.2], crystal: 0x48d8ff, crystalE: 0x18a0ff, light: 0x3ab8ff, fog: 0x030a1e, planet: [120, 60, 190], seal: [0.35, 1.1, 2.6], spark: [0.6, 1.4, 2.4], floor: [6, 9, 22] },
  crimson: { name: 'crimson', zenith: [16, 3, 8],  horizon: [120, 26, 40], neb: [255, 70, 60], neb2: [255, 140, 40], glow: [3.0, 0.7, 0.35], glow2: [2.4, 0.9, 0.4], rune: [1.1, 0.25, 0.12], crystal: 0xff6a3a, crystalE: 0xd02a10, light: 0xff5a2a, fog: 0x14040a, planet: [200, 70, 50], seal: [2.6, 0.7, 0.4], spark: [2.4, 0.9, 0.4], floor: [16, 8, 10] },
  violet:  { name: 'violet',  zenith: [8, 3, 20],  horizon: [70, 30, 140], neb: [170, 80, 255], neb2: [40, 220, 200], glow: [1.6, 0.6, 3.2], glow2: [0.6, 2.2, 2.0], rune: [0.6, 0.25, 1.3], crystal: 0xb27bff, crystalE: 0x7a2aff, light: 0xa060ff, fog: 0x0b0418, planet: [60, 170, 160], seal: [1.6, 0.7, 2.8], spark: [1.4, 0.8, 2.6], floor: [12, 8, 20] },
  seal:    { name: 'seal',    zenith: [2, 4, 14],  horizon: [20, 40, 110], neb: [80, 120, 255], neb2: [255, 60, 90], glow: [0.4, 1.4, 3.2], glow2: [2.6, 1.6, 0.6], rune: [0.15, 0.5, 1.3], crystal: 0x7fe8ff, crystalE: 0x1a8cff, light: 0x5fc8ff, fog: 0x02050f, planet: [150, 60, 200], seal: [0.5, 1.3, 3.0], spark: [2.2, 0.5, 0.7], floor: [6, 8, 16] },
};

export const REALMS = [
  { id: 0, name: 'Azure Sanctum', sub: 'Realm I', pal: 'azure', blurb: 'The shattered outer seal. Abyssal knights pour through the broken gate.' },
  { id: 1, name: 'Crimson Eclipse', sub: 'Realm II', pal: 'crimson', blurb: 'A burning sky where the Legion forges its shields and hounds.' },
  { id: 2, name: 'Violet Abyss', sub: 'Realm III', pal: 'violet', blurb: 'The drowned heart of the dimension, where the Warlords wait.' },
  { id: 3, name: 'The Thirteenth Seal', sub: 'Finale', pal: 'seal', blurb: 'Your own shadow guards the last seal.' },
];

// k=knight h=hound c=caster s=shield w=wisp
const K = 'knight', H = 'hound', C = 'caster', S = 'shield', W = 'wisp';
export const STAGES = [
  null,
  { id: 1, realm: 0, name: 'The Shattered Gate', type: 'waves', waves: [[K, K, K], [K, K, K, K]], par: 120, rec: 1, reward: 40, tutorial: true, pos: [10, 62] },
  { id: 2, realm: 0, name: 'Rune Courtyard', type: 'waves', waves: [[K, K, H, H], [K, C, K, H, H]], par: 130, rec: 2, reward: 50, pos: [30, 38] },
  { id: 3, realm: 0, name: 'Hall of Echoes', type: 'survive', survive: 60, pool: [K, K, H, C], cap: 6, par: 999, rec: 3, reward: 60, pos: [52, 66] },
  { id: 4, realm: 0, name: "The Warlord's Throne", type: 'boss', boss: 'warlord', adds: [K, K], par: 180, rec: 4, reward: 120, relic: 'heart', pos: [78, 40] },
  { id: 5, realm: 1, name: 'Ember Steps', type: 'waves', waves: [[H, H, H, K], [S, K, K, C], [H, H, S, C]], par: 160, rec: 5, reward: 80, pos: [10, 40] },
  { id: 6, realm: 1, name: 'Eclipse Bridge', type: 'waves', waves: [[S, S, K, C], [W, W, K, H, H], [S, C, C, W, W]], par: 170, rec: 6, reward: 90, pos: [32, 66] },
  { id: 7, realm: 1, name: 'Burning Archive', type: 'survive', survive: 75, pool: [K, H, S, C, W], cap: 7, par: 999, rec: 7, reward: 100, pos: [55, 36] },
  { id: 8, realm: 1, name: 'The Hollow Seraph', type: 'boss', boss: 'seraph', adds: [], par: 200, rec: 8, reward: 180, relic: 'feather', pos: [80, 60] },
  { id: 9, realm: 2, name: 'Violet Wastes', type: 'waves', waves: [[K, K, S, H, H], [C, C, W, W, K], [S, S, H, H, C, K]], par: 190, rec: 9, reward: 120, pos: [10, 60] },
  { id: 10, realm: 2, name: 'Shade Gardens', type: 'waves', waves: [[H, H, H, H, W], [S, S, C, C, K], [K, K, K, S, W, W, H]], par: 200, rec: 10, reward: 130, pos: [32, 36] },
  { id: 11, realm: 2, name: 'Abyss Chorus', type: 'survive', survive: 90, pool: [K, H, S, C, W, H], cap: 8, par: 999, rec: 11, reward: 150, pos: [55, 64] },
  { id: 12, realm: 2, name: 'Twin Warlords', type: 'boss', boss: 'twins', adds: [], par: 240, rec: 12, reward: 240, relic: 'crowns', pos: [80, 38] },
  { id: 13, realm: 3, name: 'The Thirteenth Seal', type: 'boss', boss: 'shade', adds: [], par: 300, rec: 13, reward: 400, relic: 'sigil', pos: [50, 50] },
];
export const STAGE_COUNT = 13;
export function stageScale(id) { return { hp: 1 + 0.24 * (id - 1), dmg: 1 + 0.13 * (id - 1) }; }

export const ENEMY_INFO = {
  knight: { name: 'Abyssal Knight', hp: 90, dmg: 22, speed: 3.4, range: 2.0, wind: 0.55, exp: 20, shards: 3, r: 0.6, h: 2.6 },
  hound: { name: 'Rift Hound', hp: 55, dmg: 18, speed: 6.5, range: 7, wind: 0.6, exp: 14, shards: 2, r: 0.6, h: 1.5 },
  caster: { name: 'Hex Warlock', hp: 70, dmg: 22, speed: 3.0, range: 12, wind: 0.8, exp: 22, shards: 4, r: 0.55, h: 2.7 },
  shield: { name: 'Bulwark', hp: 170, dmg: 28, speed: 2.4, range: 2.6, wind: 0.75, exp: 30, shards: 5, r: 0.8, h: 2.9 },
  wisp: { name: 'Cinder Wisp', hp: 38, dmg: 42, speed: 4.2, range: 2.6, wind: 1.0, exp: 10, shards: 2, r: 0.5, h: 1.8 },
  warlord: { name: 'Abyssal Warlord', hp: 1700, dmg: 48, speed: 2.7, range: 4.4, wind: 0.95, exp: 300, shards: 60, r: 1.6, h: 6.0, boss: true },
  seraph: { name: 'The Hollow Seraph', hp: 2000, dmg: 40, speed: 3.0, range: 14, wind: 1.0, exp: 500, shards: 90, r: 1.2, h: 5.5, boss: true },
  shade: { name: 'The Thirteenth Shade', hp: 1650, dmg: 38, speed: 5.0, range: 3, wind: 0.6, exp: 900, shards: 150, r: 0.8, h: 2.8, boss: true },
};

export const SKILLS = {
  lightning: { name: 'Lightning Burst', icon: 'lightning', mp: 30, cd: 6, cost: 0, req: null, branch: 0, tier: 0, desc: 'Call storm bolts down on up to 6 nearby foes.' },
  nova: { name: 'Frost Nova', icon: 'nova', mp: 35, cd: 10, cost: 160, req: { skill: 'lightning', stage: 5 }, branch: 0, tier: 1, desc: 'Freeze every enemy around you for 2.5s.' },
  blades: { name: 'Phase Blades', icon: 'blades', mp: 18, cd: 4, cost: 90, req: { stage: 2 }, branch: 1, tier: 0, desc: 'Fling a fan of 5 spectral blades that pierce.' },
  vortex: { name: 'Void Vortex', icon: 'vortex', mp: 45, cd: 12, cost: 140, req: { skill: 'blades', stage: 3 }, branch: 1, tier: 1, desc: 'Open a rift that drags enemies in and detonates.' },
  gale: { name: 'Dragon Gale', icon: 'gale', mp: 25, cd: 7, cost: 150, req: { stage: 4 }, branch: 2, tier: 0, desc: 'One wingbeat: a cone blast that hurls enemies back.' },
  judgment: { name: 'Thirteenth Judgment', icon: 'judgment', mp: 90, cd: 30, cost: 420, req: { skill: 'nova', skill2: 'vortex', stage: 9 }, branch: 2, tier: 1, desc: 'Ultimate. 13 sealing strikes rain on the battlefield.' },
};
export const SKILL_RANK_COST = [0, 120, 260]; // cost to go to rank 2 and 3
export const SKILL_RANK_MULT = [1, 1.35, 1.75];

export const STATS = {
  vit: { name: 'Vitality', desc: '+8% max HP', max: 10 },
  pow: { name: 'Power', desc: '+7% attack', max: 10 },
  mana: { name: 'Arcana', desc: '+8% MP, +10% MP regen', max: 10 },
  prec: { name: 'Precision', desc: '+3% critical chance', max: 10 },
  guard: { name: 'Guard', desc: '-4% damage taken', max: 8 },
};
export function statCost(rank) { return Math.round(40 * Math.pow(1.45, rank) / 5) * 5; }

export const RELICS = {
  rose: { name: 'Rose of the Seal', price: 150, desc: 'Heal 3% max HP on every kill.' },
  storm: { name: 'Storm Sigil', price: 200, desc: 'Lightning Burst, Frost Nova and Judgment deal +30% damage.' },
  cloak: { name: 'Shade Cloak', price: 180, desc: 'Dodge cooldown -35%. Perfect dodges restore 20 MP.' },
  fang: { name: 'Crimson Fang', price: 220, desc: 'Critical hits deal +50% damage.' },
  lens: { name: 'Void Lens', price: 200, desc: 'Vortex and Phase Blades deal +30% damage. Vortex pulls harder.' },
  heart: { name: "Warlord's Heart", price: 0, drop: 4, desc: '+20% max HP. Your Aegis shield regenerates twice as fast.' },
  feather: { name: 'Seraph Feather', price: 0, drop: 8, desc: '+40% MP regeneration. Skills cost 10% less.' },
  crowns: { name: 'Twin Crowns', price: 0, drop: 12, desc: 'Your 3rd combo strike hits twice.' },
  sigil: { name: 'The Thirteenth Sigil', price: 0, drop: 13, desc: 'Every 13th hit deals 13x damage.' },
};

export const TUTORIAL = [
  { id: 'move', touch: 'Drag the left stick to move', desk: 'Move with W A S D' },
  { id: 'attack', touch: 'Tap the big star button to attack', desk: 'Attack with J or left-click' },
  { id: 'combo', touch: 'Hold attack for a 3-hit combo. The third hit unleashes lightning', desk: 'Hold J for a 3-hit combo. The third hit unleashes lightning' },
  { id: 'dodge', touch: 'Tap the wing button to dodge. You are invincible mid-dodge', desk: 'Press Space to dodge. You are invincible mid-dodge' },
  { id: 'skill', touch: 'Use Lightning Burst (top skill button)', desk: 'Press K to cast Lightning Burst' },
  { id: 'camera', touch: 'Drag anywhere on the right side to turn the camera. Tab locks on', desk: 'Drag the mouse or use ← → to turn the camera. Tab locks on' },
  { id: 'fly', touch: 'Tap the green wing-arrow button to FLY — tap again to land. Flying costs nothing! Hold it in the air to rise; the down button descends. Clear the stage!', desk: 'Press F to FLY — F again to land. Flying costs nothing! In the air: Space rises, Shift descends. Clear the stage!' },
];
