'use strict';
/* ===== 공용 도구와 게임 상태 ===== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SAVE_KEY = 'chyw-save-v1';

let G = null;

function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

function newGame() {
  G = {
    v: 5, name: '무명', day: 1, phase: 0, gold: 600, food: 900, karma: 0,
    cities: {}, roster: [], heroes: {}, inv: ['r_ok', 'w_deungpae'], keys: [],
    places: ['nakseongdae'], done: {}, seen: {}, log: [], stats: { battles: 0, wins: 0 },
    stage: 'prologue', attackDay: 0, officers: {}, offSeq: 0, joinCity: 'seoul',
  };
  for (const id in CITIES) {
    const c = CITIES[id];
    G.cities[id] = { owner: c.owner, agri: c.agri, comm: c.comm, wall: c.wall, loyal: c.loyal, troops: c.troops, train: c.train, boss: c.boss || null };
  }
  addHero('hero', 4, 'seoul');
  addHero('gangrim', 4, 'seoul');
  makeOfficer('civil', 3, 'seoul', '망령 문관');
}

/* ----- 일반 무장(망령 문관·무관): 삼국지의 무명 장수 역할 ----- */
const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const GIVEN = ['문수', '덕배', '석주', '만길', '치원', '경보', '사겸', '득룡', '원보', '순팔', '여흥', '대현', '맹진', '자운', '희도', '승택', '태호', '응보', '세걸', '두천'];
const OFF_COLORS = ['#b8a27a', '#8fa8b8', '#a88f7a', '#9aa68a', '#b08f9a', '#8f9ab0', '#a8a07a', '#9a8fb0'];
function registerOfficers() {
  if (!G || !G.officers) return;
  for (const id in G.officers) { HEROES[id] = G.officers[id]; HERO_GEAR[id] = G.officers[id].gear; }
}
function isOfficer(id) { return !!(G && G.officers && G.officers[id]); }
function makeOfficer(kind, level, city, title) {
  const id = 'o' + (++G.offSeq);
  const r = () => Math.floor(Math.random() * 5);
  const civil = kind === 'civil';
  const stats = civil
    ? { str: 6 + r(), lea: 10 + r(), int: 15 + r() + r(), agi: 9 + r(), vit: 10 + r() }
    : { str: 14 + r() + r(), lea: 13 + r() + r(), int: 7 + r(), agi: 11 + r(), vit: 13 + r() };
  const color = OFF_COLORS[G.offSeq % OFF_COLORS.length];
  const name = SURNAMES[Math.floor(Math.random() * SURNAMES.length)] + GIVEN[Math.floor(Math.random() * GIVEN.length)];
  G.officers[id] = {
    name, title: title || (civil ? '망령 문관' : '망령 무관'), glyph: name[0], color, era: '저승', stats,
    unit: civil ? 'archer' : 'melee', skill: civil ? 'ghostfire' : 'gyeokryeo', hidden: null, weapon: null, officer: true,
    bio: civil ? '이름이 역사에 남지 않은 관리의 혼. 장부와 셈에 밝다.' : '이름이 역사에 남지 않은 무관의 혼. 칼을 놓은 적이 없다.',
    gear: civil ? { w1: 'w_hakuseon', armor: 'a_dopo' } : { w1: 'w_hwando', w2: 'w_deungpae', armor: 'a_chalgap' },
    look: civil ? { hat: 'gat', hatColor: '#141414', robe: color, trim: '#e6dcc4', longRobe: true, beard: Math.random() < 0.6 }
                : { hat: 'helmet', hatColor: '#2a2622', tassel: color, robe: '#3a3028', armor: '#4a4038', trim: color, beard: Math.random() < 0.5 },
  };
  registerOfficers();
  addHero(id, level, city);
  return id;
}

/* 도시별 주둔 영웅 */
function heroesIn(city) { return G.roster.filter((h) => G.heroes[h].city === city); }
function freeIn(city) { return heroesIn(city).filter((h) => !G.heroes[h].acted); }
function namedCount() { return G.roster.filter((h) => !isOfficer(h)).length; }

function heroName(id) { return id === 'hero' ? G.name : HEROES[id].name; }

function addHero(id, lv, city) {
  if (!lv) {
    const lvls = G.roster.map((h) => G.heroes[h].level);
    lv = lvls.length ? Math.max(...lvls) : 3;
  }
  const gear = HERO_GEAR[id] || {};
  const home = city || (G.joinCity && G.cities[G.joinCity] && G.cities[G.joinCity].owner === 'player' ? G.joinCity : ownedCities()[0] || 'seoul');
  G.heroes[id] = { level: lv, exp: 0, hp: 1, acted: false, tired: false, nightWork: false, city: home, equip: { w1: gear.w1 || null, w2: gear.w2 || null, armor: gear.armor || null, acc: [null, null, null, null] } };
  ['w1', 'w2', 'armor'].forEach((k) => { if (gear[k] && ITEMS[gear[k]].unique) G.seen[gear[k]] = true; });
  if (!G.roster.includes(id)) G.roster.push(id);
}

function giveItem(id) {
  if (ITEMS[id].slot === 'key') { if (!G.keys.includes(id)) G.keys.push(id); }
  else G.inv.push(id);
  if (ITEMS[id].unique) G.seen[id] = true;
}

function ownsItem(id) {
  if (G.inv.includes(id) || G.keys.includes(id)) return true;
  return G.roster.some((h) => {
    const e = G.heroes[h].equip;
    return e.w1 === id || e.w2 === id || e.armor === id || e.acc.includes(id);
  });
}

function needExp(lv) { return 40 + lv * 30; }

function sumBonus(items) {
  const b = { atk: 0, def: 0, hp: 0, int: 0, agi: 0, cdr: 0 };
  items.forEach((it) => { if (!it) return; for (const k in b) b[k] += it[k] || 0; });
  return b;
}

function styleOf(equip) {
  const w1 = ITEMS[equip.w1], w2 = ITEMS[equip.w2];
  if (w1) {
    if (w1.hands === 2) return w1.wtype === 'bow' ? '활' : '양손무기';
    if (w2 && w2.hands === 'off') return '검방';
    if (w2) return '쌍무기';
    return '한손무기';
  }
  if (w2) return w2.hands === 'off' ? '방패' : '한손무기';
  return '맨손';
}

function markNightWork(hid) {
  const h = G.heroes[hid];
  if (h && isNight()) h.nightWork = true;
}

function statsFrom(id, level, equip, tired) {
  const d = HEROES[id];
  const base = {};
  for (const k in d.stats) base[k] = d.stats[k] + (level - 1);
  const w1 = ITEMS[equip.w1];
  const items = [w1, ITEMS[equip.w2], ITEMS[equip.armor], ...(equip.acc || []).map((a) => ITEMS[a])];
  const b = sumBonus(items);
  const pen = tired ? 0.8 : 1;
  const str = Math.round(base.str * pen), agi = Math.round((base.agi + b.agi) * pen), int = Math.round((base.int + b.int) * pen), vit = Math.round(base.vit * pen), lea = Math.round(base.lea * pen);
  const ranged = !!(w1 && w1.wtype === 'bow');
  const style = styleOf(equip);
  let atk = 6 + str * 1.3 + b.atk;
  let def = vit * 0.8 + b.def;
  let atkCd = Math.max(0.45, 1.15 - agi * 0.012);
  if (style === '쌍무기') atkCd *= 0.78;
  if (style === '양손무기') atk *= 1.1;
  if (style === '검방') def *= 1.15;
  if (ranged) atk *= 0.85;
  const maxHp = Math.round(160 + vit * 13 + level * 15 + b.hp);
  const sp = Math.round(10 + int * 2);
  const spd = Math.round(78 + agi * 1.6);
  const range = ranged ? 150 : w1 && (w1.wtype === 'spear' || w1.wtype === 'glaive') ? 30 : 20;
  const cdr = Math.min(40, b.cdr);
  const squad = 3 + Math.floor(lea / 4);
  const hiddenOn = !!(d.weapon && (equip.w1 === d.weapon || equip.w2 === d.weapon));
  return { str, lea, int, agi, vit, atk: Math.round(atk), def: Math.round(def), atkCd, maxHp, sp, spd, range, ranged, cdr, squad, style, hiddenOn, tired: !!tired };
}
function computeStats(id) { const h = G.heroes[id]; return statsFrom(id, h.level, h.equip, !!h.tired); }

/* ----- 장비 ----- */
function slotAccepts(slot, itemId) {
  const it = ITEMS[itemId];
  if (!it) return false;
  if (slot === 'w1') return it.slot === 'weapon' && it.hands !== 'off';
  if (slot === 'w2') return it.slot === 'weapon' && (it.hands === 'off' || it.hands === 1);
  if (slot === 'armor') return it.slot === 'armor';
  if (slot.startsWith('acc')) return it.slot === 'acc';
  return false;
}
function getSlot(e, slot) { return slot.startsWith('acc') ? e.acc[+slot.slice(3)] : e[slot]; }
function setSlot(e, slot, v) { if (slot.startsWith('acc')) e.acc[+slot.slice(3)] = v; else e[slot] = v; }

function equipItem(hid, slot, itemId) {
  const e = G.heroes[hid].equip;
  const it = ITEMS[itemId];
  if (!slotAccepts(slot, itemId)) return '그 칸에는 장착할 수 없습니다.';
  if (slot === 'w2') {
    const w1 = ITEMS[e.w1];
    if (w1 && w1.hands === 2) return '양손무기를 들고 있어 보조 무기를 쓸 수 없습니다.';
  }
  const idx = G.inv.indexOf(itemId);
  if (idx < 0) return '소지품에 없는 물건입니다.';
  G.inv.splice(idx, 1);
  const old = getSlot(e, slot);
  if (old) G.inv.push(old);
  setSlot(e, slot, itemId);
  let msg = '';
  if (slot === 'w1' && it.hands === 2 && e.w2) { G.inv.push(e.w2); e.w2 = null; msg = '양손무기라 보조 무기를 내려놓았습니다.'; }
  const s = computeStats(hid);
  if (it.owner === hid && s.hiddenOn) msg = `숨겨진 특수기 「${SKILLS[HEROES[hid].hidden].name}」가 깨어났습니다!`;
  return msg || null;
}
function unequip(hid, slot) {
  const e = G.heroes[hid].equip;
  const old = getSlot(e, slot);
  if (old) { G.inv.push(old); setSlot(e, slot, null); }
}

/* ----- 도시와 경제 ----- */
function ownedCities() { return Object.keys(G.cities).filter((c) => G.cities[c].owner === 'player'); }
function cityGold(id) { const c = G.cities[id]; return Math.round(10 + c.comm * 0.9 * c.loyal / 100); }
function cityFood(id) { const c = G.cities[id]; return Math.round(10 + c.agri * 1.0 * c.loyal / 100); }
function totalTroops() { return ownedCities().reduce((a, c) => a + G.cities[c].troops, 0); }
function foodUpkeep() { return Math.round(totalTroops() * 0.06); }
function freeHeroes() { return G.roster.filter((h) => !G.heroes[h].acted); }

/* 내정 효과 미리 계산: 영웅 능력치를 따른다 */
function commandGain(cmd, hid, cityId) {
  const s = computeStats(hid), c = G.cities[cityId];
  if (cmd === 'agri') return 2 + Math.floor((s.int * 0.6 + s.lea * 0.4) / 7);
  if (cmd === 'comm') return 2 + Math.floor(s.int / 6);
  if (cmd === 'wall') return 2 + Math.floor((s.lea * 0.6 + s.str * 0.4) / 7);
  if (cmd === 'loyal') return 2 + Math.floor(s.int / 7);
  if (cmd === 'train') return 3 + Math.floor((s.str + s.lea) / 11);
  if (cmd === 'draft') return Math.max(0, Math.min(20 + s.lea * 2, 400 - c.troops));
  if (cmd === 'search') return Math.round(Math.min(85, 25 + s.int * 2 + c.loyal * 0.2));
  return 0;
}
function commandCost(cmd, hid, cityId) {
  const m = COMMANDS[cmd].cost;
  if (m.goldPer) return { gold: Math.ceil(commandGain(cmd, hid, cityId) * m.goldPer), food: 0 };
  return { gold: m.gold || 0, food: m.food || 0 };
}
function isNight() { return G.phase === NIGHT; }
function cmdAllowed(cmd) { const w = COMMANDS[cmd].when || 'day'; return w === 'any' || (w === 'night') === isNight(); }

/* 야간 소문 탐색: 지력이 높을수록 쓸 만한 소문을 듣는다 */
function scoutRumor(hid, cityId) {
  const s = computeStats(hid), who = heroName(hid);
  const luck = Math.random() * 100 + s.int * 1.2;
  const hidden = Object.keys(PLACES).filter((p) => !G.places.includes(p));
  if (luck > 70 && hidden.length) {
    const near = hidden.filter((p) => PLACES[p].region === cityId || neighbors(cityId).includes(PLACES[p].region));
    const p = pick(near.length ? near : hidden);
    G.places.push(p);
    return { ok: true, found: true, msg: `${who}이(가) 주막에서 숨겨진 장소의 소문을 들었습니다: ${PLACES[p].name} · "${PLACES[p].hint}"` };
  }
  if (luck > 55 && !G.market) {
    G.marketTip = (G.marketTip || 0) + 1;
    return { ok: true, msg: `${who}이(가) "다음 밤 어딘가에 도깨비 장이 선다"는 귓속말을 들었습니다. (다음 야간 비밀 장터 확률 상승)` };
  }
  const foes = neighbors(cityId).filter((n) => G.cities[n].owner !== 'player');
  if (luck > 35 && foes.length) {
    const f = pick(foes), st = G.cities[f];
    st.scouted = G.day;
    return { ok: true, msg: `${who}의 정탐: ${CITIES[f].name} 병력 ${st.troops}, 훈련 ${st.train}, 성벽 ${st.wall}. 야간 기습을 노려볼 만합니다.` };
  }
  const g = 30 + Math.floor(Math.random() * 50) + s.int;
  G.gold += g;
  return { ok: true, msg: `${who}이(가) 밤 장터 뒷골목에서 떨어진 엽전 ${g}냥을 주웠습니다.` };
}

function canAfford(cost) { return G.gold >= (cost.gold || 0) && G.food >= (cost.food || 0); }

function doCommand(cmd, hid, cityId) {
  const c = G.cities[cityId], h = G.heroes[hid];
  if (h.acted) return { ok: false, msg: '이번 턴에 이미 행동했습니다.' };
  if (!cmdAllowed(cmd)) return { ok: false, msg: COMMANDS[cmd].when === 'night' ? `${COMMANDS[cmd].name} 명령은 야간에만 할 수 있습니다.` : `${COMMANDS[cmd].name} 명령은 오전·오후에만 할 수 있습니다. 백성도 밤에는 잡니다.` };
  if (cmd === 'rest') { h.hp = 1; h.acted = true; h.nightWork = false; grantExp(hid, 3); return { ok: true, msg: `${heroName(hid)}이(가) 밤새 쉬며 기운을 되찾았습니다. 다음날 피로하지 않습니다.` }; }
  if (cmd === 'scout') { h.acted = true; markNightWork(hid); grantExp(hid, 5); return scoutRumor(hid, cityId); }
  const cost = commandCost(cmd, hid, cityId);
  if (!canAfford(cost)) return { ok: false, msg: '금이나 군량이 모자랍니다.' };
  const gain = commandGain(cmd, hid, cityId);
  let msg = '';
  if (cmd === 'search') {
    if (G.roster.length >= 30) return { ok: false, msg: '더는 장수를 거둘 수 없습니다 (최대 30명).' };
    G.gold -= cost.gold || 0;
    h.acted = true;
    markNightWork(hid);
    grantExp(hid, 6);
    if (Math.random() * 100 < gain) {
      const lv = Math.max(2, Math.round(G.roster.reduce((a, x) => a + G.heroes[x].level, 0) / G.roster.length) - 1);
      const nid = makeOfficer(Math.random() < 0.5 ? 'civil' : 'mil', lv, cityId);
      G.heroes[nid].acted = true;
      return { ok: true, found: nid, msg: `${heroName(hid)}이(가) 인재를 찾았습니다: ${HEROES[nid].title} ${HEROES[nid].name}` };
    }
    return { ok: true, msg: `${heroName(hid)}이(가) 인재를 찾지 못했습니다.` };
  }
  if (cmd === 'draft') {
    if (c.loyal < 30) return { ok: false, msg: '민심이 30 아래라 징병할 수 없습니다. 먼저 선정을 하세요.' };
    if (gain <= 0) return { ok: false, msg: '이 도시는 병력이 가득 찼습니다 (최대 400).' };
    c.train = Math.round((c.train * c.troops + 20 * gain) / (c.troops + gain));
    c.troops += gain;
    c.loyal = Math.max(0, c.loyal - 4);
    msg = `${heroName(hid)}이(가) 병사 ${gain}명을 모았습니다. (병력 ${c.troops}, 민심 -4)`;
  } else {
    const key = COMMANDS[cmd].key;
    const before = c[key];
    c[key] = Math.min(100, c[key] + gain);
    msg = `${heroName(hid)}의 ${COMMANDS[cmd].name}: ${COMMANDS[cmd].label} ${before} → ${c[key]}`;
  }
  G.gold -= cost.gold || 0; G.food -= cost.food || 0;
  h.acted = true;
  markNightWork(hid);
  grantExp(hid, 6);
  return { ok: true, msg };
}

function neighbors(id) { return ROADS.filter((r) => r.includes(id)).map((r) => (r[0] === id ? r[1] : r[0])); }
function adjacentToPlayer(id) { return neighbors(id).some((n) => G.cities[n].owner === 'player'); }
function phaseName() { return PHASES[G.phase].name; }

function grantExp(hid, amount) {
  const h = G.heroes[hid];
  if (!h) return [];
  const ups = [];
  h.exp += amount;
  while (h.exp >= needExp(h.level)) { h.exp -= needExp(h.level); h.level++; ups.push(h.level); }
  return ups;
}

function logEvent(text) {
  G.log.unshift({ day: G.day, phase: G.phase, text });
  if (G.log.length > 40) G.log.length = 40;
}

/* 적 부대 구성 */
function enemyForce(cityId, opts = {}) {
  const c = CITIES[cityId], st = G.cities[cityId];
  const lv = c.level + Math.floor((G.day - 1) / 5);
  const heroes = [];
  const owner = opts.faction || st.owner;
  if (opts.attacker) {
    const src = CITIES[opts.attacker];
    const sst = G.cities[opts.attacker];
    if (sst.boss && Math.random() < 0.35) heroes.push({ id: sst.boss, level: src.level + 2, boss: true, recruit: false });
    heroes.push({ generic: true, name: (src.captains && src.captains[0]) || '망령장', level: src.level + 1, faction: owner, skill: 'ghostfire' });
    if (src.bossGeneric) heroes.push({ generic: true, name: src.bossGeneric, level: src.level + 2, faction: owner, skill: src.bossSkill, boss: true });
    addExtraCaptains(heroes, opts.party, owner, src.level + 1);
    const send = Math.max(20, Math.round(sst.troops * 0.6));
    return { heroes, soldiers: send, level: src.level, faction: owner, formation: FACTION_FORMATION[owner] || 'bangwon', train: sst.train, send };
  }
  if (st.boss) heroes.push({ id: st.boss, level: lv + 1, boss: true, recruit: true });
  if (c.bossGeneric && st.owner === CITIES[cityId].owner) heroes.push({ generic: true, name: c.bossGeneric, level: lv + 2, faction: owner, skill: c.bossSkill, boss: true });
  (c.captains || []).forEach((n) => heroes.push({ generic: true, name: n, level: lv + 1, faction: owner, skill: 'ghostfire' }));
  if (!heroes.length) heroes.push({ generic: true, name: '망령장', level: lv + 1, faction: owner, skill: 'ghostfire' });
  addExtraCaptains(heroes, opts.party, owner, lv + 1);
  return { heroes, soldiers: Math.max(10, st.troops), level: lv, faction: owner, formation: FACTION_FORMATION[owner] || 'bangwon', train: st.train };
}

/* 아군이 많이 출전하면 적도 장수를 더 내보낸다 */
function addExtraCaptains(heroes, party, owner, level) {
  const extra = Math.max(0, Math.round(((party || 3) - 4) * 0.5));
  for (let i = 0; i < extra; i++) heroes.push({ generic: true, name: { goguryeo: '고구려 망령장', baekje: '후백제 망령장', silla: '신라 망령장', ghost: '무명 백부장', sea: '망령 수군장' }[owner] || '망령장', level, faction: owner, skill: i % 2 ? 'tide' : 'ghostfire' });
}

/* 위임한 도시: 남는 영웅이 가장 필요한 일을 한다 */
function autoDomestic(cityId) {
  const c = G.cities[cityId];
  const out = [];
  if (isNight()) {
    for (const h of freeIn(cityId)) { if (G.heroes[h].hp < 0.8) { const r = doCommand('rest', h, cityId); if (r.ok) out.push(r.msg); } }
    return out;
  }
  for (const h of freeIn(cityId)) {
    const s = computeStats(h);
    let cmd;
    if (c.loyal < 50) cmd = 'loyal';
    else if (c.troops < 120 && c.loyal >= 40) cmd = 'draft';
    else if (c.train < 60) cmd = 'train';
    else if (c.wall < 60 && s.lea >= s.int) cmd = 'wall';
    else cmd = c.agri <= c.comm ? 'agri' : 'comm';
    if (cmd !== 'draft' && cmd !== 'search' && c[COMMANDS[cmd].key] >= 100) cmd = c.agri < 100 ? 'agri' : c.comm < 100 ? 'comm' : 'train';
    const r = doCommand(cmd, h, cityId);
    if (r.ok) out.push(r.msg);
  }
  return out;
}
