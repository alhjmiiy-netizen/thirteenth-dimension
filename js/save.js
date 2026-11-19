import { STATS, RELICS, SKILLS } from './data.js';
const KEY = 'td13-save-v1', SKEY = 'td13-settings-v1';

export function freshSave() {
  return {
    v: 1, created: Date.now(), lv: 1, exp: 0, shards: 0,
    stats: Object.fromEntries(Object.keys(STATS).map(k => [k, 0])),
    skills: { lightning: 1 }, equip: ['lightning', null, null],
    relics: [], relicEquip: [null, null, null],
    stages: {}, unlocked: 1, tutorialDone: false, seenIntro: false, playTime: 0, last: 1,
  };
}
export const defaultSettings = () => ({ master: 0.9, music: 0.6, sfx: 0.9, quality: 'auto', sens: 1, invertY: false, shake: 1 });

export function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 1) return Object.assign(freshSave(), s); } catch (e) { }
  return null;
}
export function writeSave(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } }
export function deleteSave() { try { localStorage.removeItem(KEY); } catch (e) { } }
export function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(SKEY)); if (s) return Object.assign(defaultSettings(), s); } catch (e) { }
  return defaultSettings();
}
export function writeSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) { } }

export function expToNext(lv) { return Math.round(60 * Math.pow(1.32, lv - 1) / 5) * 5; }
export function totalStars(s) { return Object.values(s.stages).reduce((a, b) => a + (b.stars || 0), 0); }
export function relicSlots(s) { return (s.stages[8] ? 3 : 2); }
export function hasRelic(s, id) { return s.relicEquip.includes(id); }

// derived player stats from save
export function playerStats(s) {
  const lv = s.lv;
  let hp = 300 + (lv - 1) * 35, mp = 120 + (lv - 1) * 8, atk = 20 + (lv - 1) * 3.5;
  hp *= 1 + 0.08 * s.stats.vit; atk *= 1 + 0.07 * s.stats.pow; mp *= 1 + 0.08 * s.stats.mana;
  if (hasRelic(s, 'heart')) hp *= 1.2;
  return {
    maxHp: Math.round(hp), maxMp: Math.round(mp), atk: Math.round(atk), maxSh: Math.round(hp * 0.25),
    crit: 0.08 + 0.03 * s.stats.prec, critMult: hasRelic(s, 'fang') ? 2.3 : 1.8,
    guard: 0.04 * s.stats.guard, mpRegen: 6 * (1 + 0.1 * s.stats.mana) * (hasRelic(s, 'feather') ? 1.4 : 1),
    mpCost: hasRelic(s, 'feather') ? 0.9 : 1, shRegen: hasRelic(s, 'heart') ? 2 : 1,
  };
}
export { STATS, RELICS, SKILLS };
