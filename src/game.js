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

/* 침공·장터·보상처럼 겹치는 이벤트는 하나씩만 연다 */
const EventQ = (() => {
  const jobs = [];
  function blocked() {
    if (typeof Dialog !== 'undefined' && Dialog.active()) return true;
    const m = $('#modal');
    return !!(m && !m.hidden);
  }
  function push(job) { jobs.push(job); kick(); }
  function kick() {
    if (blocked() || !jobs.length) return;
    const job = jobs.shift();
    job();
  }
  return { push, kick };
})();

function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }

function newGame() {
  G = {
    v: 6, name: '무명', day: 1, phase: 0, gold: 600, food: 900, karma: 0,
    cities: {}, roster: [], heroes: {}, inv: ['r_ok', 'w_deungpae'], keys: [],
    places: [], done: {}, seen: {}, log: [], stats: { battles: 0, wins: 0 },
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
    job: civil ? 'sage' : 'sword', unit: civil ? 'archer' : 'melee', skill: civil ? 'ghostfire' : 'gyeokryeo', hidden: null, weapon: null, officer: true,
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
function heroesIn(city) { return G.roster.filter((h) => G.heroes[h].city === city && !G.heroes[h].travel); }
function freeIn(city) { return heroesIn(city).filter((h) => !G.heroes[h].acted); }
function cityHops(a, b) {
  if (a === b) return 0;
  const q = [a], dist = { [a]: 0 };
  while (q.length) {
    const cur = q.shift();
    for (const n of neighbors(cur)) {
      if (dist[n] != null) continue;
      dist[n] = dist[cur] + 1;
      if (n === b) return dist[n];
      q.push(n);
    }
  }
  return 99;
}
function travelers() { return G.roster.filter((h) => G.heroes[h].travel); }
function cityCap(id) { return (CITIES[id] && CITIES[id].cap) || 9; }
function cityPop(id) {
  return G.roster.filter((h) => {
    const hh = G.heroes[h];
    if (hh.travel) return hh.travel.to === id;
    return hh.city === id;
  }).length;
}
function citiesOverCap() { return ownedCities().filter((c) => cityPop(c) > cityCap(c)); }
function stationedOrInbound(id) {
  return G.roster.filter((h) => {
    const hh = G.heroes[h];
    if (hh.travel) return hh.travel.to === id;
    return hh.city === id;
  });
}
function dismissHero(id, asCancel) {
  if (id === 'hero' || !G.heroes[id]) return { ok: false, msg: '맹주는 해고할 수 없습니다.' };
  const who = heroName(id);
  const h = G.heroes[id];
  const city = h.travel ? h.travel.from : h.city;
  ['w1', 'w2', 'armor', 'acc0', 'acc1', 'acc2', 'acc3'].forEach((sl) => unequip(id, sl));
  if (!asCancel && G.cities[city] && G.cities[city].owner === 'player') {
    const drop = isOfficer(id) ? 8 : 14;
    G.cities[city].loyal = Math.max(0, G.cities[city].loyal - drop);
  }
  G.roster = G.roster.filter((x) => x !== id);
  delete G.heroes[id];
  if (G.officers && G.officers[id]) { delete G.officers[id]; delete HEROES[id]; }
  if (asCancel) return { ok: true, msg: `${who} 등용을 취소했습니다.` };
  return { ok: true, msg: `${who}을(를) 해고했습니다.${city && CITIES[city] ? ` ${CITIES[city].name} 민심이 떨어졌습니다.` : ''}` };
}
function namedCount() { return G.roster.filter((h) => !isOfficer(h)).length; }

function heroName(id) { return id === 'hero' ? G.name : HEROES[id].name; }

function addHero(id, lv, city) {
  if (!lv) {
    const lvls = G.roster.map((h) => G.heroes[h].level);
    lv = lvls.length ? Math.max(...lvls) : 3;
  }
  const gear = HERO_GEAR[id] || {};
  const home = city || (G.joinCity && G.cities[G.joinCity] && G.cities[G.joinCity].owner === 'player' ? G.joinCity : ownedCities()[0] || 'seoul');
  G.heroes[id] = { level: lv, exp: 0, hp: 1, acted: false, tired: false, nightWork: false, city: home, job: (HEROES[id] && HEROES[id].job) || 'sword', equip: { w1: gear.w1 || null, w2: gear.w2 || null, armor: gear.armor || null, acc: [null, null, null, null] } };
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

function jobIdOf(hid) {
  if (G && G.heroes && G.heroes[hid] && JOBS[G.heroes[hid].job]) return G.heroes[hid].job;
  if (HEROES[hid] && JOBS[HEROES[hid].job]) return HEROES[hid].job;
  return 'sword';
}
function heroJob(hid) { return JOBS[jobIdOf(hid)] || JOBS.sword; }
function jobWepText(jid) { return (JOBS[jid].wtypes || []).map((t) => WTYPE_LABEL[t] || t).join('·'); }
function jobAllowsHero(jid, hid) {
  const n = JOBS[jid];
  if (!n) return false;
  if (n.unique || n.hero) return n.hero === hid;
  if (n.heroes && n.heroes.includes(hid)) return true;
  if (isOfficer(hid) && n.shared && n.tier === 1) return true;
  return false;
}
function availablePromos(hid) {
  const h = G.heroes[hid];
  if (!h) return [];
  const cur = heroJob(hid);
  const d = HEROES[hid] || {};
  return (cur.next || []).filter((jid) => {
    const n = JOBS[jid];
    if (!jobAllowsHero(jid, hid)) return false;
    if ((n.needLv || 0) > h.level) return false;
    if (n.needWeapon && d.weapon && !ownsItem(d.weapon)) return false;
    return true;
  });
}
function canWield(hid, itemId) {
  const it = ITEMS[itemId];
  if (!it || it.slot !== 'weapon') return true;
  if (it.owner) return it.owner === hid;
  const types = heroJob(hid).wtypes || [];
  return types.includes(it.wtype);
}
function stripMisfitWeapons(hid) {
  const e = G.heroes[hid].equip;
  ['w1', 'w2'].forEach((sl) => {
    const id = e[sl];
    if (id && !canWield(hid, id)) { G.inv.push(id); e[sl] = null; }
  });
}
function promoteJob(hid, jid) {
  if (!availablePromos(hid).includes(jid)) return { ok: false, msg: '아직 이 직업을 얻을 수 없습니다.' };
  G.heroes[hid].job = jid;
  stripMisfitWeapons(hid);
  return { ok: true, msg: `${heroName(hid)}이(가) 「${JOBS[jid].name}」(으)로 승급했습니다.` };
}
function jobNeedHint(hid, jid) {
  const n = JOBS[jid], h = G.heroes[hid], d = HEROES[hid] || {};
  const bits = [];
  if ((n.needLv || 0) > (h ? h.level : 0)) bits.push(`Lv ${n.needLv}`);
  if (n.needWeapon && d.weapon && !ownsItem(d.weapon)) bits.push(`「${ITEMS[d.weapon].name}」`);
  return bits.length ? bits.join(' · ') + ' 필요' : '';
}
function nextJobHints(hid) {
  const cur = heroJob(hid);
  return (cur.next || []).filter((jid) => jobAllowsHero(jid, hid)).map((jid) => {
    const n = JOBS[jid];
    return { id: jid, name: n.name, unique: !!n.unique, shared: !!n.shared, ready: availablePromos(hid).includes(jid), need: jobNeedHint(hid, jid) };
  });
}
function ensureJobs() {
  if (!G || !G.heroes) return;
  G.roster.forEach((id) => {
    const h = G.heroes[id];
    if (!h) return;
    if (!JOBS[h.job]) h.job = (HEROES[id] && HEROES[id].job) || 'sword';
    stripMisfitWeapons(id);
  });
}
function ensureCities() {
  if (!G || !G.cities) return;
  for (const id in CITIES) {
    if (G.cities[id]) continue;
    const c = CITIES[id];
    G.cities[id] = { owner: c.owner, agri: c.agri, comm: c.comm, wall: c.wall, loyal: c.loyal, troops: c.troops, train: c.train, boss: c.boss || null };
  }
  if (!G.foeFound) G.foeFound = {};
}

function statsFrom(id, level, equip, tired) {
  const d = HEROES[id];
  const job = heroJob(id);
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
  atk *= job.atk || 1;
  def *= job.def || 1;
  const maxHp = Math.round(160 + vit * 13 + level * 15 + b.hp);
  const sp = Math.round(10 + int * 2);
  let spd = Math.round(78 + agi * 1.6);
  spd = Math.round(spd * (job.spd || 1));
  const range = ranged ? 150 : w1 && (w1.wtype === 'spear' || w1.wtype === 'glaive') ? 30 : 20;
  const cdr = Math.min(40, b.cdr);
  const squad = 3 + Math.floor(lea / 4);
  const hiddenOn = !!(d.weapon && (equip.w1 === d.weapon || equip.w2 === d.weapon));
  return { str, lea, int, agi, vit, atk: Math.round(atk), def: Math.round(def), atkCd, maxHp, sp, spd, range, ranged, cdr, squad, style, hiddenOn, tired: !!tired, job: job.name, jobId: jobIdOf(id), unit: job.unit };
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
  if (it.slot === 'weapon' && !canWield(hid, itemId)) {
    if (it.owner && it.owner !== hid) return `${HEROES[it.owner].name}만 찰 수 있는 무기입니다.`;
    return `${heroJob(hid).name}은(는) ${WTYPE_LABEL[it.wtype] || it.wtype}을(를) 찰 수 없습니다.`;
  }
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
function freeHeroes() { return G.roster.filter((h) => !G.heroes[h].acted && !G.heroes[h].travel); }

/* 내정 효과 미리 계산: 영웅 능력치를 따른다 */
function commandGain(cmd, hid, cityId) {
  const s = computeStats(hid), c = G.cities[cityId];
  if (cmd === 'agri') return 2 + Math.floor((s.int * 0.6 + s.lea * 0.4) / 7);
  if (cmd === 'comm') return 2 + Math.floor(s.int / 6);
  if (cmd === 'wall') return 2 + Math.floor((s.lea * 0.6 + s.str * 0.4) / 7);
  if (cmd === 'loyal') return 2 + Math.floor(s.int / 7);
  if (cmd === 'train') return 3 + Math.floor((s.str + s.lea) / 11);
  if (cmd === 'draft') return Math.max(0, Math.min(20 + s.lea * 2, 400 - c.troops));
  if (cmd === 'search') {
    const found = c.owner === 'player' ? G.roster.length : ((G.foeFound && G.foeFound[c.owner]) || 0);
    return Math.round(Math.max(10, Math.min(85, 25 + s.int * 2 + c.loyal * 0.2 - found * 3.5)));
  }
  return 0;
}
function commandCost(cmd, hid, cityId) {
  const m = COMMANDS[cmd].cost;
  if (m.goldPer) return { gold: Math.ceil(commandGain(cmd, hid, cityId) * m.goldPer), food: 0 };
  return { gold: m.gold || 0, food: m.food || 0 };
}
function isNight() { return G.phase === NIGHT; }
function cmdAllowed(cmd) { const w = COMMANDS[cmd].when || 'day'; return w === 'any' || (w === 'night') === isNight(); }

function publicPlaceEvents(id) {
  return PLACES[id].events.filter((ev) => !EVENTS[ev].scoutBy && !G.done[ev] && (!EVENTS[ev].after || G.done[EVENTS[ev].after]));
}
function pendingWeaponScout(hid) {
  return Object.keys(EVENTS).find((id) => {
    const ev = EVENTS[id];
    if (ev.scoutBy !== hid || G.done[id]) return false;
    if (ev.after && !G.done[ev.after]) return false;
    const pid = Object.keys(PLACES).find((p) => PLACES[p].events.includes(id));
    if (pid && G.cities[PLACES[pid].region].owner !== 'player') return false;
    return true;
  });
}
/* 소문 탐색: 지력이 높을수록 쓸 만한 소문을 듣는다. 고유 무기는 그 장군이 직접 들을 때만 이어진다. */
function scoutRumor(hid, cityId) {
  const wev = pendingWeaponScout(hid);
  if (wev) return { ok: true, event: wev, msg: `${heroName(hid)}이(가) 고유 무기의 소문을 따라갔습니다.` };
  const s = computeStats(hid), who = heroName(hid);
  const luck = Math.random() * 100 + s.int * 1.2;
  const hidden = Object.keys(PLACES).filter((p) => !G.places.includes(p) && publicPlaceEvents(p).length);
  const owned = ownedCities();
  const tied = hidden.filter((p) => owned.includes(PLACES[p].region));
  const near = hidden.filter((p) => PLACES[p].region === cityId || neighbors(cityId).includes(PLACES[p].region));
  if (hidden.length && luck > (tied.length ? 45 : 70)) {
    const p = pick(tied.length ? tied : near.length ? near : hidden);
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
function startRelocate(hid, dest, opts) {
  const h = G.heroes[hid];
  const from = h.city;
  const hops = Math.max(1, cityHops(from, dest));
  if (!(opts && opts.skipCap) && cityPop(dest) >= cityCap(dest)) return { ok: false, hops, msg: `${CITIES[dest].name}은(는) 인재 정원이 가득합니다 (${cityPop(dest)}/${cityCap(dest)}).` };
  h.acted = true;
  markNightWork(hid);
  if (hops <= 1) {
    h.city = dest;
    h.travel = null;
    return { ok: true, hops, msg: `${heroName(hid)}이(가) ${CITIES[dest].name}(으)로 이동했습니다.` };
  }
  h.travel = { from, to: dest, left: hops };
  return { ok: true, hops, msg: `${heroName(hid)}이(가) ${CITIES[from].name}에서 ${CITIES[dest].name}(으)로 길을 떠났습니다. ${hops}턴 뒤에 도착합니다.` };
}
function transferTroops(from, dest, n) {
  n = Math.max(0, Math.min(n | 0, G.cities[from].troops));
  if (!n) return 0;
  const S = G.cities[from], D = G.cities[dest];
  S.troops -= n;
  D.train = Math.round((D.train * D.troops + S.train * n) / Math.max(1, D.troops + n));
  D.troops += n;
  return n;
}
function executeMarch(from, dest, heroIds, troops) {
  if (!from || !dest || from === dest) return { ok: false, msg: '다른 아군 도시를 고르세요.' };
  if (!G.cities[dest] || G.cities[dest].owner !== 'player') return { ok: false, msg: '아군 도시로만 보낼 수 있습니다.' };
  const adj = neighbors(from).includes(dest);
  const ids = [...new Set(heroIds || [])].filter((h) => G.heroes[h] && G.heroes[h].city === from && !G.heroes[h].acted && !G.heroes[h].travel);
  let n = Math.max(0, Math.min(troops | 0, G.cities[from].troops));
  if (!adj) n = 0;
  if (!ids.length && n <= 0) return { ok: false, msg: '보낼 장수나 병력을 고르세요.' };
  if (ids.length && cityPop(dest) + ids.length > cityCap(dest)) return { ok: false, msg: `${CITIES[dest].name} 인재 정원이 부족합니다 (${cityPop(dest)}/${cityCap(dest)}).` };
  let escort = null;
  if (!ids.length && n) {
    escort = freeIn(from)[0];
    if (!escort) return { ok: false, msg: '병력을 보낼 장수가 없습니다.' };
  }
  const bits = [];
  ids.forEach((h) => {
    const r = startRelocate(h, dest, { skipCap: true });
    if (r.ok) bits.push(heroName(h));
  });
  if (n) transferTroops(from, dest, n);
  if (escort) { G.heroes[escort].acted = true; markNightWork(escort); }
  const hops = Math.max(1, cityHops(from, dest));
  const msg = `${CITIES[from].name} → ${CITIES[dest].name}` +
    (bits.length ? ` · 장수 ${bits.join(', ')}${hops > 1 ? ` (${hops}턴)` : ''}` : '') +
    (n ? ` · 병력 ${n}` : !adj && (troops | 0) > 0 ? ' · 병력은 이웃 도시로만 옮깁니다' : '');
  return { ok: true, msg };
}
function tickTravel(wasNight) {
  const arrived = [];
  G.roster.forEach((id) => {
    const hh = G.heroes[id];
    if (!hh.travel) return;
    if (wasNight) hh.nightWork = true;
    hh.travel.left--;
    if (hh.travel.left > 0) return;
    let dest = hh.travel.to;
    if (!G.cities[dest] || G.cities[dest].owner !== 'player') dest = ownedCities()[0] || dest;
    hh.city = dest;
    arrived.push(id);
    hh.travel = null;
  });
  return arrived;
}
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
    addFoundCaptains(heroes, sst, owner, src.level);
    addExtraCaptains(heroes, opts.party, owner, src.level + 1);
    const send = Math.max(20, Math.round(sst.troops * 0.6));
    return { heroes, soldiers: send, level: src.level, faction: owner, formation: FACTION_FORMATION[owner] || 'bangwon', train: sst.train, send };
  }
  if (st.boss) heroes.push({ id: st.boss, level: lv + 1, boss: true, recruit: true });
  if (c.bossGeneric && st.owner === CITIES[cityId].owner) heroes.push({ generic: true, name: c.bossGeneric, level: lv + 2, faction: owner, skill: c.bossSkill, boss: true });
  (c.captains || []).forEach((n) => heroes.push({ generic: true, name: n, level: lv + 1, faction: owner, skill: 'ghostfire' }));
  if (!heroes.length) heroes.push({ generic: true, name: '망령장', level: lv + 1, faction: owner, skill: 'ghostfire' });
  addFoundCaptains(heroes, st, owner, lv);
  addExtraCaptains(heroes, opts.party, owner, lv + 1);
  return { heroes, soldiers: Math.max(10, st.troops), level: lv, faction: owner, formation: FACTION_FORMATION[owner] || 'bangwon', train: st.train };
}

function addFoundCaptains(heroes, st, owner, level) {
  const n = Math.min(4, st.found || 0);
  const names = { goguryeo: '고구려 신진장', baekje: '후백제 신진장', silla: '신라 신진장', ghost: '무명 신진장', sea: '탐라 신진장' };
  for (let i = 0; i < n; i++) heroes.push({ generic: true, name: (names[owner] || '신진 망령장') + (n > 1 ? ' ' + (i + 1) : ''), level: level + 1, faction: owner, skill: i % 2 ? 'tide' : 'ghostfire' });
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
