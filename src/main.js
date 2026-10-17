'use strict';
/* ===== 화면 흐름, 전략 UI, 영웅/장비/상점 ===== */
const UI = {
  tab: 'info', sel: null, heroView: null, equipSlot: null, cmd: null, cmdHero: null,
  formation: (() => { try { return localStorage.getItem('chyw-form') || 'eorin'; } catch (e) { return 'eorin'; } })(),
  forms: (() => { try { return JSON.parse(localStorage.getItem('chyw-hero-forms') || '{}') || {}; } catch (e) { return {}; } })(),
};
function heroFormOf(h) { return FORMATIONS[UI.forms[h]] ? UI.forms[h] : (UI.formation || 'eorin'); }
function setHeroForm(h, f) {
  if (!FORMATIONS[f]) return;
  UI.forms[h] = f;
  UI.formation = f;
  try { localStorage.setItem('chyw-hero-forms', JSON.stringify(UI.forms)); localStorage.setItem('chyw-form', f); } catch (err) {}
}
const SLOT_LABEL = { w1: '무기 1', w2: '무기 2', armor: '갑옷', acc0: '장신구 1', acc1: '장신구 2', acc2: '장신구 3', acc3: '장신구 4' };
const DANGER = { gangneung: 1, jeonju: 2, tongyeong: 2, pyongyang: 3, gyeongju: 3, seoul: 1 };

function showScreen(id) {
  $$('.screen').forEach((s) => { s.hidden = s.id !== id; });
  if (id === 'scr-map') { MapView.start(); requestAnimationFrame(() => MapView.resize()); }
  else MapView.stop();
  if (id === 'scr-battle') requestAnimationFrame(() => Battle.resize());
}
function setScene(name) {
  const s = $('#scr-story');
  s.dataset.scene = name;
  $('#story-mark').textContent = { river: '黃泉', hall: '十王廳', mirror: '業鏡臺', seoul: '漢陽' }[name] || '';
}

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 3200);
  setTimeout(() => t.remove(), 3700);
}
function openModal(html, bind, cls = '') {
  const card = $('#modal-card');
  card.className = 'modal-card ' + cls;
  card.innerHTML = html;
  $('#modal').hidden = false;
  if (bind) bind(card);
}
function closeModal() { $('#modal').hidden = true; }

function medallion(id, size = '') {
  const d = HEROES[id];
  return `<span class="medal ${size}" style="--c:${d.color}"><img src="img/portraits/${id}.jpg" alt="" onload="this.classList.add('ok')" onerror="this.remove()"><span>${esc(d.glyph)}</span></span>`;
}
function itemLine(it) {
  const bits = [];
  for (const k of ['atk', 'def', 'hp', 'int', 'agi', 'cdr']) if (it[k]) bits.push(`${STAT_LABEL[k]} ${it[k] > 0 ? '+' : ''}${it[k]}`);
  return bits.join(' · ');
}
function itemKind(it) {
  if (it.slot === 'weapon') return `${WTYPE_LABEL[it.wtype] || '무기'} · ${it.hands === 2 ? '양손' : it.hands === 'off' ? '보조' : '한손'}`;
  if (it.slot === 'armor') return '갑옷';
  if (it.slot === 'acc') return it.kind;
  return '귀중품';
}

/* ---------- 상단 ---------- */
function renderTop() {
  $('#t-day').textContent = `${G.day}일차`;
  $('#t-phase').textContent = phaseName();
  $('#t-phase').dataset.phase = PHASES[G.phase].id;
  $('#t-gold').textContent = G.gold.toLocaleString('ko-KR');
  $('#t-food').textContent = G.food.toLocaleString('ko-KR');
  $('#t-sol').textContent = totalTroops().toLocaleString('ko-KR');
  $('#t-karma').textContent = G.karma;
  $('#t-heroes').textContent = `${namedCount()}/13 · 장수 ${G.roster.length}`;
  const free = freeHeroes().length;
  $('#t-ap').textContent = `행동 ${free}/${G.roster.length}`;
  $('#t-ap').classList.toggle('spent', !free);
  const mapEl = $('#scr-map');
  if (mapEl) mapEl.dataset.phase = PHASES[G.phase].id;
}

/* ---------- 패널 ---------- */
function renderPanel() {
  $$('#tabs [data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === UI.tab));
  const body = $('#panel-body');
  if (UI.tab === 'info') body.innerHTML = UI.sel ? (UI.sel.type === 'city' ? cityCard(UI.sel.id) : placeCard(UI.sel.id)) : overview();
  else if (UI.tab === 'heroes') body.innerHTML = UI.heroView ? heroDetail(UI.heroView) : heroList();
  else if (UI.tab === 'items') body.innerHTML = itemsView();
  else body.innerHTML = rumorView();
  renderCmdRail();
}
function renderAll() { renderTop(); renderPanel(); MapView.redrawRegions(); }
const CMD_GLYPH = { agri: "農", comm: "商", wall: "城", loyal: "仁", draft: "兵", train: "鍊", search: "才", move: "運", relocate: "遷", rest: "息", scout: "聞" };
function renderCmdRail() {
  const rail = $("#cmdrail");
  if (!rail) return;
  const phase = PHASES[G.phase].id;
  const map = $("#scr-map");
  if (map) map.dataset.phase = phase;
  rail.dataset.phase = phase;
  const sel = UI.sel && UI.sel.type === "city" ? UI.sel.id : null;
  const seal = $("#cmdrail-seal"), cityEl = $("#cmdrail-city"), noteEl = $("#cmdrail-note"), btns = $("#cmdrail-btns"), picker = $("#cmdrail-picker");
  if (!sel) {
    rail.hidden = true;
    if (btns) btns.innerHTML = "";
    if (picker) picker.innerHTML = "";
    return;
  }
  rail.hidden = false;
  const st = G.cities[sel], f = FACTIONS[st.owner], mine = st.owner === "player";
  if (seal) { seal.textContent = f.glyph; seal.style.setProperty("--c", f.color); }
  if (cityEl) cityEl.textContent = CITIES[sel].name + (mine ? "" : " · " + f.name);
  if (mine) {
    const cmds = isNight() ? ["rest", "scout", "relocate"] : ["agri", "comm", "wall", "loyal", "draft", "train", "search", "move", "relocate"];
    if (noteEl) noteEl.textContent = isNight() ? "야간 · 휴식 · 소문 · 기습" : ("내정 · 이 도시 장수에게 맡깁니다 · 행동 가능 " + freeIn(sel).length + "명");
    let html = cmds.map(function(k) {
      const on = UI.cmd === k ? ' on' : '';
      return '<button class="cmd' + on + '" data-cmd="' + k + '"><i class="cmd-glyph">' + (CMD_GLYPH[k] || '令') + '</i><span>' + COMMANDS[k].name + '</span></button>';
    }).join("");
    if (isNight() && G.market && G.market.city === sel) html += '<button class="cmd market" data-act="market"><i class="cmd-glyph">市</i><span>비밀 장터</span></button>';
    else if (!isNight()) html += '<button class="cmd" data-act="shop"><i class="cmd-glyph">市</i><span>장터</span></button>';
    if (btns) { btns.className = "cmds" + (isNight() ? " night" : ""); btns.innerHTML = html; }
    if (picker) picker.innerHTML = UI.cmd ? commandPicker(sel) : "";
  } else {
    const adj = adjacentToPlayer(sel);
    const free = neighbors(sel).filter(function(n) { return G.cities[n].owner === "player"; }).reduce(function(a, n) { return a + freeIn(n).length; }, 0);
    if (noteEl) noteEl.textContent = adj && free ? (isNight() ? "야간 기습 가능" : "출병 가능") : "아직 칠 수 없습니다";
    if (btns) {
      btns.className = "cmds";
      btns.innerHTML = '<button class="btn primary' + (isNight() ? ' raid' : '') + '" data-act="attack" ' + (adj && free ? '' : 'disabled') + '>' + (isNight() ? '야간 기습' : '출병') + '</button>';
    }
    if (picker) picker.innerHTML = "";
  }
}


function overview() {
  const owned = ownedCities().length;
  const rows = Object.keys(CITIES).map((id) => {
    const st = G.cities[id], f = FACTIONS[st.owner];
    const here = st.owner === 'player' ? heroesIn(id).length : 0;
    return `<button class="row" data-city="${id}"><span class="chip" style="--c:${f.color}">${f.glyph}</span><span class="row-main">${CITIES[id].name}</span><span class="row-sub">${st.owner === 'player' ? `아군 · 장수 ${here}${here < 2 ? ' ⚠' : ''}${st.auto ? ' · 위임' : ''}` : f.name} · 병력 ${st.troops}</span></button>`;
  }).join('');
  const gIn = ownedCities().reduce((a, c) => a + cityGold(c), 0), fIn = ownedCities().reduce((a, c) => a + cityFood(c), 0);
  return `<div class="card">
    <p class="eyebrow">1막 · 고향의 혼</p>
    <h3 class="h-display">한반도 여섯 도시를 차지하라</h3>
    <div class="progress"><i style="width:${(owned / 6) * 100}%"></i></div>
    <p class="muted">${owned} / 6 도시 · 이름난 영웅 ${namedCount()} / 13 · 장수 ${G.roster.length}명 · 숨겨진 장소 ${G.places.length}곳</p>
    <dl class="kv small"><div><dt>매일 아침 금</dt><dd>+${gIn}</dd></div><div><dt>매일 아침 군량</dt><dd>+${fIn} / 병사 먹이 -${foodUpkeep()}</dd></div></dl>
  </div>
  ${phaseCard()}
  <div class="list">${rows}</div>
  <p class="hint">영웅은 머무는 도시에서만 일합니다. 도시마다 2~3명을 두고, 모자라면 인재 탐색이나 이동으로 채우세요. ⚠ 표시는 장수가 2명보다 적은 도시입니다.</p>`;
}

function statBar(label, v, max = 100) {
  return `<div class="sbar"><span>${label}</span><i><b style="width:${Math.round((v / max) * 100)}%"></b></i><em>${v}</em></div>`;
}

function cityCard(id) {
  const c = CITIES[id], st = G.cities[id], f = FACTIONS[st.owner];
  const mine = st.owner === 'player';
  let body = '';
  if (mine) {
    const cmds = isNight() ? ['rest', 'scout', 'relocate'] : ['agri', 'comm', 'wall', 'loyal', 'draft', 'train', 'search', 'move', 'relocate'];
    const here = heroesIn(id);
    body = `<div class="sbars">${statBar('농업', st.agri)}${statBar('상업', st.comm)}${statBar('성벽', st.wall)}${statBar('민심', st.loyal)}${statBar('훈련', st.train)}</div>
      <dl class="kv small">
        <div><dt>병력</dt><dd>${st.troops} / 400</dd></div>
        <div><dt>매일 아침</dt><dd>금 +${cityGold(id)} · 군량 +${cityFood(id)}</dd></div>
      </dl>
      <p class="label">주둔 장수 <span class="muted small">${here.length}명 · 행동 가능 ${freeIn(id).length}${here.length < 2 ? ' · 2~3명을 두는 것이 좋습니다' : ''}</span></p>
      <div class="stationed">${here.map((h) => `<button class="st-hero ${G.heroes[h].acted ? 'spent' : ''}" data-hero-go="${h}" title="${esc(HEROES[h].title)}">${medallion(h, 'sm')}<span>${esc(heroName(h))}</span></button>`).join('') || '<span class="muted small">아무도 없습니다. 다른 도시에서 이동시키세요.</span>'}</div>
      <button class="auto-toggle ${st.auto ? 'on' : ''}" data-auto="${id}">${st.auto ? '위임 중 · 턴이 끝날 때 남은 장수가 알아서 내정합니다' : '위임하기 · 턴이 끝날 때 남은 장수가 알아서 내정'}</button>
      <p class="hint">내정과 장터는 위쪽 명령 막대에서 고릅니다.</p>`;
  } else {
    const heads = [];
    if (st.boss) heads.push(`<span class="foe">${medallion(st.boss, 'sm')}${HEROES[st.boss].name}</span>`);
    if (c.bossGeneric && st.owner === c.owner) heads.push(`<span class="foe"><span class="chip" style="--c:${f.color}">${f.glyph}</span>${c.bossGeneric}</span>`);
    if (st.owner === c.owner) (c.captains || []).forEach((n) => heads.push(`<span class="foe"><span class="chip" style="--c:${f.color}">${f.glyph}</span>${n}</span>`));
    const adj = adjacentToPlayer(id);
    const free = neighbors(id).filter((n) => G.cities[n].owner === 'player').reduce((a, n) => a + freeIn(n).length, 0);
    body = `<div class="sbars">${statBar('성벽', st.wall)}${statBar('훈련', st.train)}</div>
      <dl class="kv small">
        <div><dt>병력</dt><dd>${st.troops}${st.scouted === G.day ? ' <small class="gold">정탐</small>' : ''}</dd></div>
        <div><dt>위험도</dt><dd class="danger">${'◆'.repeat(DANGER[id] || 1)}${'◇'.repeat(3 - (DANGER[id] || 1))}</dd></div>
      </dl>
      <p class="label">지키는 장수</p><div class="foes">${heads.join('') || '<span class="muted">없음 (혼불 대장이 지휘)</span>'}</div>
            ${!adj ? '<p class="hint">이웃한 아군 도시가 없어 아직 칠 수 없습니다.</p>' : !free ? '<p class="hint">이웃한 아군 도시에 행동할 수 있는 장수가 없습니다.</p>' : '<p class="hint">이웃한 아군 도시에 있는 장수만 출병할 수 있습니다. 이기면 출병한 장수가 그 도시에 주둔합니다.</p>'}`;
  }
  const nb = neighbors(id).map((n) => CITIES[n].name).join(', ');
  return `<div class="card city">
    <div class="card-head"><span class="seal" style="--c:${f.color}">${f.glyph}</span>
      <div><h3 class="h-display">${c.name} <small>${c.hanja}</small></h3><p class="muted">${mine ? `${esc(G.name)} 맹주의 땅` : f.name}</p></div>
      <button class="x" data-act="desel" aria-label="닫기">×</button></div>
    ${body}
    <p class="muted small">이어진 길: ${nb}</p>
  </div>`;
}

/* 명령을 맡을 영웅 고르기: 삼국지처럼 능력치에 따른 예상 효과를 보여 준다 */
function commandPicker(cityId) {
  const cmd = UI.cmd, meta = COMMANDS[cmd], st = G.cities[cityId];
  const free = freeIn(cityId);
  if (cmd === 'relocate' && UI.cmdHero) {
    const dests = ownedCities().filter((d) => d !== cityId);
    return `<div class="picker"><p class="label">${esc(heroName(UI.cmdHero))}을(를) 어디로 보낼까요?</p>
      ${dests.length ? dests.map((d) => `<div class="move-row"><b>${CITIES[d].name}</b><span class="muted small">장수 ${heroesIn(d).length}명 · 병력 ${G.cities[d].troops}</span><button class="btn sm" data-reloc="${d}">보내기</button></div>`).join('') : '<p class="muted small">다른 아군 도시가 없습니다.</p>'}
      <button class="btn ghost sm" data-act="cmdcancel">취소</button></div>`;
  }
  if (cmd === 'move' && UI.cmdHero) {
    const dests = neighbors(cityId).filter((n) => G.cities[n].owner === 'player');
    const half = Math.floor(st.troops / 2);
    return `<div class="picker"><p class="label">${esc(heroName(UI.cmdHero))}이(가) 병력을 옮깁니다</p>
      ${dests.length ? dests.map((d) => `<div class="move-row"><b>${CITIES[d].name}</b><span class="muted small">병력 ${G.cities[d].troops}</span>
        <button class="btn sm" data-move="${d}" data-n="50" ${st.troops >= 50 ? '' : 'disabled'}>50</button>
        <button class="btn sm" data-move="${d}" data-n="${half}" ${half > 0 ? '' : 'disabled'}>절반 ${half}</button>
        <button class="btn sm" data-move="${d}" data-n="${st.troops}" ${st.troops > 0 ? '' : 'disabled'}>전부</button></div>`).join('') : '<p class="muted small">이웃한 아군 도시가 없습니다.</p>'}
      <button class="btn ghost sm" data-act="cmdcancel">취소</button></div>`;
  }
  const rows = free.map((h) => {
    const s = computeStats(h);
    let eff = '', cost = { gold: 0, food: 0 };
    if (cmd === 'rest') eff = `체력 ${Math.round(G.heroes[h].hp * 100)}% → 100%`;
    else if (cmd === 'scout') eff = '소문 듣기';
    else if (cmd === 'move' || cmd === 'relocate') eff = '';
    else if (cmd === 'search') { cost = commandCost(cmd, h, cityId); eff = `발견 확률 ${commandGain(cmd, h, cityId)}%`; }
    else {
      const g = commandGain(cmd, h, cityId);
      cost = commandCost(cmd, h, cityId);
      eff = cmd === 'draft' ? `병사 +${g}` : `${meta.label} +${Math.min(g, 100 - st[meta.key])}`;
    }
    const costTxt = [cost.gold ? `금 ${cost.gold}` : '', cost.food ? `군량 ${cost.food}` : ''].filter(Boolean).join(' · ');
    const ok = canAfford(cost);
    const key = cmd === 'search' || cmd === 'scout' ? s.int : cmd === 'draft' ? s.lea : cmd === 'agri' ? Math.round(s.int * 0.6 + s.lea * 0.4) : cmd === 'comm' || cmd === 'loyal' ? s.int : cmd === 'wall' ? Math.round(s.lea * 0.6 + s.str * 0.4) : cmd === 'train' ? Math.round((s.str + s.lea) / 2) : 0;
    return { h, eff, costTxt, ok, key };
  }).sort((a, b) => b.key - a.key);
  return `<div class="picker"><p class="label">${meta.name} <span class="muted small">${meta.desc}${meta.stat ? ` · ${meta.stat}이 높을수록 효과가 큽니다` : ''}</span></p>
    ${rows.length ? rows.map((r) => `<button class="pick-hero cmdpick" data-doer="${r.h}" ${r.ok ? '' : 'disabled'}>${medallion(r.h)}<span><b>${esc(heroName(r.h))}</b><span class="muted small">${r.key ? `${meta.stat} ${r.key} · ` : ''}${r.costTxt || '비용 없음'}</span></span><em class="gold">${r.eff}</em></button>`).join('')
      : '<p class="muted small">이 도시에 이번 턴 행동할 수 있는 장수가 없습니다.</p>'}
    <button class="btn ghost sm" data-act="cmdcancel">닫기</button></div>`;
}

function placeCard(id) {
  const p = PLACES[id];
  const region = CITIES[p.region];
  const owned = G.cities[p.region].owner === 'player';
  const evs = p.events.map((ev) => `<li class="${G.done[ev] ? 'done' : ''}">${G.done[ev] ? '해결함' : '아직 모름'}</li>`).join('');
  const allDone = p.events.every((ev) => G.done[ev]);
  return `<div class="card place">
    <div class="card-head"><span class="seal violet">?</span>
      <div><h3 class="h-display">${p.name}</h3><p class="muted">${region.name} 일대 · 숨겨진 장소</p></div>
      <button class="x" data-act="desel" aria-label="닫기">×</button></div>
    <blockquote class="rumor">${esc(p.hint)}</blockquote>
    <ul class="evs">${evs}</ul>
    <div class="actions">
      <button class="btn primary" data-act="explore" ${owned && !allDone ? '' : 'disabled'}>탐색 <small>성공하면 행동 1</small></button>
    </div>
    ${owned ? '' : `<p class="hint">${region.name}을(를) 먼저 차지해야 갈 수 있습니다.</p>`}
    <p class="hint">지금 시간대: ${phaseName()}. 조건이 맞지 않으면 행동력은 쓰이지 않습니다.</p>
  </div>`;
}

function heroList() {
  const byCity = {};
  G.roster.forEach((id) => { (byCity[G.heroes[id].city] = byCity[G.heroes[id].city] || []).push(id); });
  const row = (id) => {
    const h = G.heroes[id], s = computeStats(id), d = HEROES[id];
    return `<button class="hero-row" data-hero="${id}">
      ${medallion(id)}
      <span class="hr-main"><b>${esc(heroName(id))}</b><span class="muted">${d.title} · Lv ${h.level} · 무${computeStats(id).str} 통${computeStats(id).lea} 지${computeStats(id).int}</span>
        <span class="bar"><i style="width:${Math.round(h.hp * 100)}%"></i></span></span>
      <span class="hr-side">${h.acted ? '<em class="spent">행동 완료</em>' : '<em class="free">행동 가능</em>'}${s.style}${s.hiddenOn ? '<em class="gold">특수기</em>' : ''}</span>
    </button>`;
  };
  const groups = Object.keys(byCity).map((c) => `<p class="label">${CITIES[c] ? CITIES[c].name : c} <span class="muted small">${byCity[c].length}명</span></p><div class="list">${byCity[c].map(row).join('')}</div>`).join('');
  const missing = 13 - namedCount();
  return `${groups}
    ${missing ? `<p class="hint">아직 만나지 못한 이름난 영웅이 ${missing}명 있습니다. 도시를 차지하고 소문을 따라가 보세요.</p>` : ''}`;
}

function heroDetail(id) {
  const h = G.heroes[id], s = computeStats(id), d = HEROES[id];
  const sk = SKILLS[d.skill];
  let hiddenHtml = '';
  if (d.hidden) {
    const hs = SKILLS[d.hidden], wpn = ITEMS[d.weapon];
    if (s.hiddenOn) hiddenHtml = `<div class="skill hid on"><b>${hs.name}</b><span class="tag gold">발동 중</span><p>${hs.desc}</p></div>`;
    else if (G.seen[d.weapon]) hiddenHtml = `<div class="skill hid"><b>${hs.name}</b><span class="tag">봉인</span><p>${hs.desc}</p><p class="muted small">「${wpn.name}」을(를) 장착하면 열립니다.</p></div>`;
    else hiddenHtml = `<div class="skill hid"><b>숨겨진 특수기 ???</b><span class="tag">봉인</span><p class="muted">어딘가에 이 영웅의 고유 무기가 잠들어 있다.</p></div>`;
  }
  const slots = ['w1', 'w2', 'armor', 'acc0', 'acc1', 'acc2', 'acc3'].map((sl) => {
    const iid = getSlot(h.equip, sl), it = ITEMS[iid];
    const locked = sl === 'w2' && ITEMS[h.equip.w1] && ITEMS[h.equip.w1].hands === 2;
    return `<button class="slot ${UI.equipSlot === sl ? 'on' : ''} ${it && it.unique ? 'uniq' : ''} ${locked ? 'locked' : ''}" data-slot="${sl}">
      <span class="slot-k">${SLOT_LABEL[sl]}</span><span class="slot-v">${it ? esc(it.name) : locked ? '양손무기 사용 중' : '비어 있음'}</span>
      ${it ? `<span class="slot-s">${itemLine(it)}</span>` : ''}</button>`;
  }).join('');
  let picker = '';
  if (UI.equipSlot) {
    const sl = UI.equipSlot;
    const cur = getSlot(h.equip, sl);
    const cands = [...new Set(G.inv)].filter((iid) => slotAccepts(sl, iid));
    const w1two = sl === 'w2' && ITEMS[h.equip.w1] && ITEMS[h.equip.w1].hands === 2;
    picker = `<div class="picker"><p class="label">${SLOT_LABEL[sl]}에 장착할 물건</p>
      ${w1two ? '<p class="hint">무기 1에 양손무기를 들고 있어 비워 둡니다. 한손무기로 바꾸면 쌍무기나 검방을 쓸 수 있습니다.</p>' : ''}
      ${!w1two && cands.length ? cands.map((iid) => { const it = ITEMS[iid]; const n = G.inv.filter((x) => x === iid).length;
        return `<button class="pick ${it.unique ? 'uniq' : ''}" data-equip="${iid}"><b>${esc(it.name)}${n > 1 ? ` ×${n}` : ''}</b><span class="muted small">${itemKind(it)} · ${itemLine(it)}${it.owner ? ` · ${HEROES[it.owner].name} 전용 특수기` : ''}</span></button>`; }).join('') : !w1two ? '<p class="muted small">맞는 물건이 소지품에 없습니다.</p>' : ''}
      ${cur ? '<button class="btn ghost" data-act="unequip">벗기</button>' : ''}</div>`;
  }
  return `<div class="hero-detail">
    <button class="back" data-act="heroback">← 영웅 목록</button>
    <div class="hd-head">${medallion(id, 'lg')}<div><p class="eyebrow">${d.era} · ${d.title}</p><h3 class="h-display">${esc(heroName(id))}</h3>
      <p class="muted">Lv ${h.level} · 경험 ${h.exp}/${needExp(h.level)}</p><span class="bar"><i style="width:${Math.round(h.hp * 100)}%"></i></span></div></div>
    <p class="bio">${esc(d.bio)}</p>
    <div class="stats">
      <div><span>무력</span><b>${s.str}</b></div><div><span>통솔</span><b>${s.lea}</b></div><div><span>지력</span><b>${s.int}</b></div>
      <div><span>민첩</span><b>${s.agi}</b></div><div><span>체력</span><b>${s.vit}</b></div>
    </div>
    <dl class="kv small">
      <div><dt>공격 / 방어</dt><dd>${s.atk} / ${s.def}</dd></div>
      <div><dt>최대 체력</dt><dd>${s.maxHp}</dd></div>
      <div><dt>기술력</dt><dd>${s.sp}</dd></div>
      <div><dt>전투 방식</dt><dd>${s.style}${s.ranged ? ' (원거리)' : ''}</dd></div>
      <div><dt>부대 정원</dt><dd>${s.squad}명</dd></div>
    </dl>
    <p class="label">기술</p>
    <div class="skill"><b>${sk.name}</b><span class="tag">고유 기술</span><p>${sk.desc}</p></div>
    ${hiddenHtml}
    <p class="label">장비 <span class="muted small">무기 2에는 한손무기(쌍무기)나 방패(검방)를 낍니다. 장신구는 종류 상관없이 4개까지.</span></p>
    <div class="slots">${slots}</div>
    ${picker}
  </div>`;
}

function itemsView() {
  const groups = { weapon: '무기', armor: '갑옷', acc: '장신구' };
  let html = '';
  for (const g in groups) {
    const ids = [...new Set(G.inv)].filter((i) => ITEMS[i].slot === g);
    if (!ids.length) continue;
    html += `<p class="label">${groups[g]}</p><div class="list">${ids.map((i) => {
      const it = ITEMS[i], n = G.inv.filter((x) => x === i).length;
      return `<div class="item ${it.unique ? 'uniq' : ''}"><b>${esc(it.name)}${n > 1 ? ` ×${n}` : ''}</b><span class="muted small">${itemKind(it)} · ${itemLine(it)}</span>${it.desc ? `<span class="small desc">${esc(it.desc)}</span>` : ''}</div>`;
    }).join('')}</div>`;
  }
  if (G.keys.length) html += `<p class="label">귀중품</p><div class="list">${G.keys.map((k) => `<div class="item key"><b>${ITEMS[k].name}</b><span class="small desc">${ITEMS[k].desc}</span></div>`).join('')}</div>`;
  return html || '<p class="muted">소지품이 비어 있습니다. 장착한 장비는 영웅 화면에서 볼 수 있습니다.</p>';
}

function rumorView() {
  const places = G.places.map((id) => {
    const p = PLACES[id], done = p.events.every((ev) => G.done[ev]);
    return `<button class="row rumor-row ${done ? 'done' : ''}" data-place="${id}"><span class="chip violet">${done ? '✓' : '?'}</span><span class="row-main">${p.name}<span class="muted small">${esc(p.hint)}</span></span></button>`;
  }).join('');
  const log = G.log.slice(0, 12).map((l) => `<li><span class="muted">${l.day}일 ${PHASES[l.phase].name}</span> ${esc(l.text)}</li>`).join('');
  return `<p class="label">들은 소문</p><div class="list">${places}</div>
    ${log ? `<p class="label">기록</p><ul class="log">${log}</ul>` : ''}`;
}

/* ---------- 패널 입력 ---------- */
function onPanelClick(e) {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.city) { UI.sel = { type: 'city', id: b.dataset.city }; MapView.setSel(UI.sel); renderPanel(); return; }
  if (b.dataset.place) { UI.sel = { type: 'place', id: b.dataset.place }; MapView.setSel(UI.sel); UI.tab = 'info'; renderPanel(); return; }
  if (b.dataset.hero) { UI.heroView = b.dataset.hero; UI.equipSlot = null; renderPanel(); return; }
  if (b.dataset.slot) { UI.equipSlot = UI.equipSlot === b.dataset.slot ? null : b.dataset.slot; renderPanel(); return; }
  if (b.dataset.equip) {
    const msg = equipItem(UI.heroView, UI.equipSlot, b.dataset.equip);
    if (msg) toast(msg, msg.includes('특수기') ? 'gold' : '');
    UI.equipSlot = null; saveGame(); renderPanel(); return;
  }
  const id = UI.sel && UI.sel.id;
  if (b.dataset.auto) { const c = G.cities[b.dataset.auto]; c.auto = !c.auto; toast(c.auto ? `${CITIES[b.dataset.auto].name}을(를) 위임했습니다. 턴이 끝날 때 남은 장수가 내정합니다.` : '위임을 풀었습니다.'); saveGame(); renderPanel(); return; }
  if (b.dataset.heroGo) { UI.tab = 'heroes'; UI.heroView = b.dataset.heroGo; UI.equipSlot = null; renderPanel(); return; }
  if (b.dataset.reloc) {
    const h = UI.cmdHero;
    G.heroes[h].city = b.dataset.reloc; G.heroes[h].acted = true;
    const msg = `${heroName(h)}이(가) ${CITIES[b.dataset.reloc].name}(으)로 이동했습니다.`;
    toast(msg); logEvent(msg);
    UI.cmd = null; UI.cmdHero = null; saveGame(); renderAll(); return;
  }
  if (b.dataset.cmd) { UI.cmd = UI.cmd === b.dataset.cmd ? null : b.dataset.cmd; UI.cmdHero = null; renderPanel(); return; }
  if (b.dataset.doer) {
    const h = b.dataset.doer;
    if (UI.cmd === 'move' || UI.cmd === 'relocate') { UI.cmdHero = h; renderPanel(); return; }
    const r = doCommand(UI.cmd, h, id);
    toast(r.msg, r.ok ? (r.found ? 'gold' : '') : 'warn');
    if (r.ok) { logEvent(r.msg); saveGame(); }
    renderAll(); return;
  }
  if (b.dataset.move) {
    const n = Math.min(+b.dataset.n, G.cities[id].troops);
    G.cities[id].troops -= n;
    const d = G.cities[b.dataset.move];
    d.train = Math.round((d.train * d.troops + G.cities[id].train * n) / Math.max(1, d.troops + n));
    d.troops += n;
    G.heroes[UI.cmdHero].acted = true;
    const msg = `${heroName(UI.cmdHero)}이(가) 병력 ${n}을 ${CITIES[b.dataset.move].name}(으)로 옮겼습니다.`;
    toast(msg); logEvent(msg);
    UI.cmd = null; UI.cmdHero = null; saveGame(); renderAll(); return;
  }
  const act = b.dataset.act;
  if (!act) return;
  if (act === 'desel') { UI.sel = null; UI.cmd = null; MapView.setSel(null); renderPanel(); }
  else if (act === 'cmdcancel') { UI.cmd = null; UI.cmdHero = null; renderPanel(); }
  else if (act === 'heroback') { UI.heroView = null; UI.equipSlot = null; renderPanel(); }
  else if (act === 'unequip') { unequip(UI.heroView, UI.equipSlot); UI.equipSlot = null; saveGame(); renderPanel(); }
  else if (act === 'shop') openShop();
  else if (act === 'market') openMarket();
  else if (act === 'attack') launchAttack(id);
  else if (act === 'explore') explore(id);
}

/* ---------- 상점 ---------- */
function openShop(mode = 'buy') {
  const stock = [...new Set(ownedCities().flatMap((c) => CITIES[c].shop || []))];
  const buy = stock.map((i) => { const it = ITEMS[i];
    return `<div class="shop-row"><div><b>${esc(it.name)}</b><span class="muted small">${itemKind(it)} · ${itemLine(it)}</span></div>
      <button class="btn" data-buy="${i}" ${G.gold >= it.price ? '' : 'disabled'}>${it.price}냥</button></div>`; }).join('');
  const sellIds = [...new Set(G.inv)].filter((i) => !ITEMS[i].unique);
  const sell = sellIds.map((i) => { const it = ITEMS[i], n = G.inv.filter((x) => x === i).length, pr = Math.floor((it.price || 100) / 2);
    return `<div class="shop-row"><div><b>${esc(it.name)}${n > 1 ? ` ×${n}` : ''}</b><span class="muted small">${itemLine(it)}</span></div>
      <button class="btn" data-sell="${i}">${pr}냥에 팔기</button></div>`; }).join('');
  openModal(`<div class="modal-head"><h3 class="h-display">장터</h3><span class="gold">${G.gold.toLocaleString('ko-KR')}냥</span><button class="x" data-close>×</button></div>
    <div class="seg"><button class="${mode === 'buy' ? 'on' : ''}" data-mode="buy">사기</button><button class="${mode === 'sell' ? 'on' : ''}" data-mode="sell">팔기</button></div>
    <div class="shop">${mode === 'buy' ? buy || '<p class="muted">살 물건이 없습니다.</p>' : sell || '<p class="muted">팔 물건이 없습니다. 고유 무기는 팔 수 없습니다.</p>'}</div>
    <p class="hint">도시를 더 차지하면 그 도시의 특산 장비가 장터에 나옵니다.</p>`, (card) => {
    card.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.close !== undefined) { closeModal(); renderAll(); return; }
      if (b.dataset.mode) { openShop(b.dataset.mode); return; }
      if (b.dataset.buy) { const it = ITEMS[b.dataset.buy]; G.gold -= it.price; G.inv.push(b.dataset.buy); toast(`${it.name}을(를) 샀습니다.`); saveGame(); openShop('buy'); renderTop(); }
      if (b.dataset.sell) { const it = ITEMS[b.dataset.sell]; G.inv.splice(G.inv.indexOf(b.dataset.sell), 1); G.gold += Math.floor((it.price || 100) / 2); saveGame(); openShop('sell'); renderTop(); }
    };
  }, 'wide');
}

/* ---------- 시간대 안내와 야간 비밀 장터 ---------- */
function phaseCard() {
  if (!isNight()) return `<div class="phase-card day"><b>${phaseName()}</b><span>내정과 출병을 할 수 있는 시간입니다. 남은 행동 ${freeHeroes().length}</span></div>`;
  const m = G.market;
  return `<div class="phase-card night"><b>야간</b><span>백성이 잠들었습니다. 휴식, 소문 탐색, 야간 기습을 할 수 있습니다.</span>
    ${m ? `<button class="btn sm market" data-act="market">비밀 장터 · ${CITIES[m.city].name} <small>오늘 밤만</small></button>` : ''}</div>`;
}
const MARKET_GEAR = ['m_gamtu', 'm_yeouiju', 'm_gatkkeun', 'm_heukdo', 'a_yongrin', 'w_heukgak', 'w_woldo', 'a_dujeong', 'n_yeomju', 'w_ungeom'];
const MARKET_DEALS = [
  { id: 'food', name: '군량 암거래', desc: '군량 300을 몰래 들여온다.', price: 180 },
  { id: 'merc', name: '떠돌이 혼불 용병', desc: '장터가 선 도시에 병사 30명이 합류한다 (훈련 50).', price: 200 },
  { id: 'spy', name: '밀정의 지도', desc: '아직 모르는 숨겨진 장소 하나를 알려 준다.', price: 150 },
  { id: 'elixir', name: '환혼단', desc: '모든 영웅의 체력을 가득 채운다.', price: 160 },
];
function maybeMarket() {
  const owned = ownedCities();
  if (!owned.length || G.day < 2) return;
  const chance = 0.25 + (G.marketTip || 0) * 0.35;
  if (Math.random() > chance) return;
  G.marketTip = 0;
  const gear = MARKET_GEAR.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  const deals = MARKET_DEALS.slice().sort(() => Math.random() - 0.5).slice(0, 2).map((d) => d.id);
  G.market = { day: G.day, city: pick(owned), gear, deals, bought: [], fresh: true };
  logEvent(`${CITIES[G.market.city].name} 뒷골목에 도깨비 비밀 장터가 섰다.`);
}
function marketNotice() {
  const m = G.market; if (!m) return;
  openModal(`<div class="modal-head"><h3 class="h-display">도깨비 비밀 장터</h3></div>
    <p>${CITIES[m.city].name} 뒷골목에 푸른 등불이 줄지어 켜졌습니다. 도깨비들이 오늘 밤에만 장을 엽니다.</p>
    <p class="muted small">장터에서는 영웅의 행동을 쓰지 않습니다. 날이 밝으면 사라집니다.</p>
    <div class="actions"><button class="btn primary" data-a="go">둘러보기</button><button class="btn" data-a="no">나중에</button></div>`, (card) => {
    card.onclick = (e) => { const b = e.target.closest('[data-a]'); if (!b) return; closeModal(); if (b.dataset.a === 'go') openMarket(); };
  }, 'narrow');
}
function marketPrice(i) { const it = ITEMS[i]; return it.market ? it.price : Math.round(it.price * 0.8); }
function openMarket() {
  const m = G.market;
  if (!m || !isNight()) { toast('비밀 장터는 이미 걷혔습니다.'); return; }
  const gear = m.gear.map((i) => { const it = ITEMS[i], pr = marketPrice(i), done = m.bought.includes(i);
    return `<div class="shop-row"><div><b>${esc(it.name)}</b>${it.market ? ' <small class="gold">장터 한정</small>' : ' <small class="muted">2할 싸게</small>'}<span class="muted small">${itemKind(it)} · ${itemLine(it)}</span></div>
      <button class="btn" data-mbuy="${i}" ${!done && G.gold >= pr ? '' : 'disabled'}>${done ? '팔림' : pr + '냥'}</button></div>`; }).join('');
  const deals = m.deals.map((id) => { const d = MARKET_DEALS.find((x) => x.id === id), done = m.bought.includes(id);
    return `<div class="shop-row"><div><b>${d.name}</b><span class="muted small">${d.desc}</span></div>
      <button class="btn" data-mdeal="${id}" ${!done && G.gold >= d.price ? '' : 'disabled'}>${done ? '팔림' : d.price + '냥'}</button></div>`; }).join('');
  openModal(`<div class="modal-head"><h3 class="h-display">도깨비 비밀 장터 <small class="muted">${CITIES[m.city].name} · 오늘 밤만</small></h3><span class="gold">${G.gold.toLocaleString('ko-KR')}냥</span><button class="x" data-close>×</button></div>
    <p class="muted small">"한 번 판 물건은 다시 안 들여와. 살 거면 지금 사." 물건마다 하나씩만 팝니다.</p>
    <p class="label">물건</p><div class="shop">${gear}</div>
    <p class="label">거래</p><div class="shop">${deals}</div>`, (card) => {
    card.onclick = (e) => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.close !== undefined) { closeModal(); renderAll(); return; }
      if (b.dataset.mbuy) { const i = b.dataset.mbuy; G.gold -= marketPrice(i); G.inv.push(i); m.bought.push(i); toast(`${ITEMS[i].name}을(를) 샀습니다.`, 'gold'); }
      if (b.dataset.mdeal) {
        const d = MARKET_DEALS.find((x) => x.id === b.dataset.mdeal);
        G.gold -= d.price; m.bought.push(d.id);
        if (d.id === 'food') G.food += 300;
        if (d.id === 'merc') { const c = G.cities[m.city]; if (c.owner === 'player') { c.train = Math.round((c.train * c.troops + 50 * 30) / (c.troops + 30)); c.troops += 30; } }
        if (d.id === 'spy') { const hid = Object.keys(PLACES).filter((p) => !G.places.includes(p)); if (hid.length) { const p = pick(hid); G.places.push(p); toast(`밀정의 지도: ${PLACES[p].name}`, 'violet'); } else G.gold += d.price; }
        if (d.id === 'elixir') G.roster.forEach((h) => { G.heroes[h].hp = 1; });
        toast(`${d.name} 거래를 마쳤습니다.`, 'gold');
        logEvent(`비밀 장터: ${d.name}`);
      }
      saveGame(); renderTop(); openMarket();
    };
  }, 'wide');
}

/* ---------- 출진 ---------- */
const SQUAD = 20;
/* opts: { only: 고를 수 있는 영웅, troops: 쓸 수 있는 병력, allowEmpty, food: 병사당 군량, note } */
function choosePartyThen(title, cb, onCancel, opts = {}) {
  const pool = (opts.only || G.roster).slice().sort((a, b) => G.heroes[b].level - G.heroes[a].level || G.heroes[b].hp - G.heroes[a].hp);
  const MAXP = 10;
  const picked = new Set(pool.filter((h) => G.heroes[h].hp > 0.3).slice(0, MAXP));
  if (!picked.size && !opts.allowEmpty) pool.slice(0, MAXP).forEach((h) => picked.add(h));
  const draw = () => {
    const troops = opts.troops != null ? opts.troops : 0;
    const sent = picked.size ? Math.min(troops, picked.size * SQUAD) : opts.allowEmpty ? Math.min(troops, 60) : 0;
    const foodCost = Math.ceil(sent * (opts.food || 0));
    const short = foodCost > G.food;
    openModal(`<div class="modal-head"><h3 class="h-display">${esc(title)}</h3><button class="x" data-close>×</button></div>
      ${opts.note ? `<p class="muted small">${opts.note}</p>` : ''}
      <p class="muted">함께 갈 영웅을 ${MAXP}명까지 고르세요. 영웅 한 명이 혼불 병사 ${SQUAD}명을 이끕니다. 고른 영웅마다 혼불 진형을 따로 정합니다. (${picked.size}/${MAXP})</p>
      ${opts.formation && opts.enemyCity ? `<p class="muted small">적은 ${FORMATIONS[FACTION_FORMATION[G.cities[opts.enemyCity].owner]].name}으로 맞섭니다.</p>` : ''}
      <div class="party">${pool.map((h) => { const s = computeStats(h), hp = G.heroes[h].hp, on = picked.has(h), hf = heroFormOf(h);
        const chips = on && opts.formation ? `<span class="hero-forms">${Object.keys(FORMATIONS).map((k) => `<button type="button" class="form-chip ${hf === k ? 'on' : ''}" data-hform="${h}" data-form="${k}">${FORMATIONS[k].name}</button>`).join('')}</span>` : '';
        return `<div class="pick-hero ${on ? 'on' : ''}" data-h="${h}">${medallion(h)}<span><b>${esc(heroName(h))}</b><span class="muted small">Lv ${G.heroes[h].level} · 통솔 ${s.lea} (사기 ${Math.round(clamp(30 + s.lea * 2.5, 10, 100))}) · ${s.style}${on && opts.formation ? ` · 혼불 ${FORMATIONS[hf].name}` : ''}</span><span class="bar"><i style="width:${Math.round(hp * 100)}%"></i></span></span>${s.hiddenOn ? '<em class="gold small">특수기</em>' : ''}${chips}</div>`; }).join('') || '<p class="muted small">고를 수 있는 영웅이 없습니다.</p>'}</div>
      <p class="muted small">출전 병력 ${sent}명 (쓸 수 있는 병력 ${troops})${foodCost ? ` · 군량 ${foodCost} 소모` : ''}${!picked.size && opts.allowEmpty ? ' · 영웅 없이 나가면 혼불 대장이 지휘합니다' : ''}</p>
      ${short ? '<p class="hint" style="color:#f08b72">군량이 모자랍니다. 개간으로 군량을 늘리거나 인원을 줄이세요.</p>' : ''}
      <div class="actions"><button class="btn primary" data-go ${(picked.size || opts.allowEmpty) && !short && (sent > 0 || picked.size) ? '' : 'disabled'}>출진</button></div>`, (card) => {
      card.onclick = (e) => {
        const chip = e.target.closest('[data-hform]');
        if (chip) { setHeroForm(chip.dataset.hform, chip.dataset.form); draw(); return; }
        const row = e.target.closest('[data-h]');
        if (row) { const h = row.dataset.h; if (picked.has(h)) picked.delete(h); else if (picked.size < MAXP) picked.add(h); else toast(`${MAXP}명까지만 데려갈 수 있습니다.`); draw(); return; }
        const b = e.target.closest('button');
        if (!b || b.disabled) return;
        if (b.dataset.close !== undefined) { closeModal(); if (onCancel) onCancel(); return; }
        if (b.dataset.go !== undefined) { closeModal(); cb([...picked], sent, foodCost); }
      };
    });
  };
  draw();
}

function startBattle(cfg) {
  cfg.seed = (G.day * 7 + G.phase * 13 + (cfg.title || '').length * 3) % 97 + 1;
  G.stats.battles++;
  showScreen('scr-battle');
  requestAnimationFrame(() => Battle.start(cfg));
}

function applyBattle(res, party, markActed = true) {
  const ups = [];
  party.forEach((h) => {
    if (!G.heroes[h]) return;
    if (res.heroes[h] != null) G.heroes[h].hp = res.heroes[h];
    if (markActed) G.heroes[h].acted = true;
    const lv = grantExp(h, (res.win ? 60 : 20) + (res.exp[h] || 0));
    if (lv.length) ups.push(`${heroName(h)} Lv ${lv[lv.length - 1]}`);
  });
  if (res.win) G.stats.wins++;
  if (ups.length) setTimeout(() => toast('레벨 업: ' + ups.join(', '), 'gold'), 400);
}

function launchAttack(cityId) {
  const srcs = neighbors(cityId).filter((n) => G.cities[n].owner === 'player' && G.cities[n].troops > 0 && freeIn(n).length).sort((a, b) => freeIn(b).length - freeIn(a).length || G.cities[b].troops - G.cities[a].troops);
  if (!srcs.length) { toast('병력과 행동 가능한 장수가 함께 있는 이웃 도시가 없습니다.'); return; }
  const go = (srcIdx) => {
    const src = srcs[srcIdx];
    const st = G.cities[src];
    const note = `${CITIES[src].name}에서 출발 · 장수 ${freeIn(src).length}명 · 병력 ${st.troops} · 훈련 ${st.train}` + (srcs.length > 1 ? ` <button class="btn sm" data-switch>다른 도시에서 출발</button>` : '');
    const raid = isNight();
    choosePartyThen(`${CITIES[cityId].name} ${raid ? '야간 기습' : '공략'}`, (party, sent, foodCost) => {
      st.troops -= sent;
      G.food -= foodCost;
      const enemy = enemyForce(cityId, { party: party.length });
      if (raid) { enemy.extraSquads = 0; enemy.moraleAdj = -20; enemy.surprised = true; }
      startBattle({ title: `${CITIES[cityId].name} ${raid ? '야간 기습' : '공략전'}`, theme: CITIES[cityId].theme || 'field', type: 'attack', party, enemy,
        playerSoldiers: sent, playerTrain: st.train, wall: { team: 1, value: G.cities[cityId].wall * (raid ? 0.5 : 1) }, formation: UI.formation, forms: Object.fromEntries(party.map((h) => [h, heroFormOf(h)])),
        onEnd: (res) => afterAttack(cityId, src, res, party) });
    }, null, { only: freeIn(src), troops: st.troops, food: 0.5, note: note + (raid ? '<br><b class="gold">야간 기습</b> · 잠든 적은 사기가 20 낮고, 성벽 효과가 절반이며, 혼불 지원 부대를 내보내지 못합니다.' : ''), formation: true, enemyCity: cityId });
    const sw = $('#modal-card [data-switch]');
    if (sw) sw.onclick = (e) => { e.stopPropagation(); closeModal(); go((srcIdx + 1) % srcs.length); };
  };
  go(0);
}

const LOOT = ['r_eun', 'r_ok', 'n_hobak', 'b_bujeok', 'w_hwando', 'a_chalgap', 'n_hobal', 'r_honbul', 'b_norigae', 'w_ungeom', 'a_suui', 'n_yeomju'];
function afterAttack(cityId, srcId, res, party) {
  applyBattle(res, party);
  showScreen('scr-map');
  const st = G.cities[cityId];
  if (!res.win) {
    G.cities[srcId].troops += res.survivors;
    st.troops = Math.max(10, res.enemyLeft);
    logEvent(`${CITIES[cityId].name} 공략 실패 (살아 돌아온 병사 ${res.survivors})`);
    toast(`${CITIES[cityId].name} 공략에 실패했습니다. 병사 ${res.survivors}명이 ${CITIES[srcId].name}(으)로 돌아왔습니다.`, 'warn');
    renderAll(); saveGame();
    return;
  }
  st.train = G.cities[srcId].train;
  const alive = party.filter((h) => G.heroes[h]);
  if (alive.length <= 1) { alive.forEach((h) => { G.heroes[h].city = cityId; }); captureCity(cityId, res); return; }
  chooseGarrison(cityId, srcId, alive, () => captureCity(cityId, res));
}

/* 점령 뒤 남길 장수 고르기: 나머지는 출발 도시로 돌아간다 */
function chooseGarrison(cityId, srcId, party, done) {
  const stay = new Set(party.slice(0, Math.min(3, Math.max(2, Math.ceil(party.length / 2)))));
  const draw = () => {
    const back = party.length - stay.size, srcLeft = heroesIn(srcId).filter((h) => !party.includes(h)).length + back;
    openModal(`<div class="modal-head"><h3 class="h-display">${CITIES[cityId].name} 주둔 장수</h3></div>
      <p class="muted">새 도시를 다스릴 장수를 고르세요. 고르지 않은 장수는 ${CITIES[srcId].name}(으)로 돌아갑니다. 도시마다 2~3명이 있어야 내정이 돌아갑니다.</p>
      <div class="party">${party.map((h) => { const s = computeStats(h); return `<button class="pick-hero ${stay.has(h) ? 'on' : ''}" data-g="${h}">${medallion(h)}<span><b>${esc(heroName(h))}</b><span class="muted small">Lv ${G.heroes[h].level} · 무 ${s.str} · 통 ${s.lea} · 지 ${s.int}</span></span><em class="small ${stay.has(h) ? 'gold' : 'muted'}">${stay.has(h) ? '주둔' : '귀환'}</em></button>`; }).join('')}</div>
      <p class="muted small">${CITIES[cityId].name} ${stay.size}명 · ${CITIES[srcId].name} ${srcLeft}명${stay.size < 2 || srcLeft < 2 ? ' <span style="color:#f0b45a">· 2명 미만인 도시는 내정이 느려집니다</span>' : ''}</p>
      <div class="actions"><button class="btn primary" data-gok ${stay.size ? '' : 'disabled'}>정하기</button></div>`, (card) => {
      card.onclick = (e) => {
        const b = e.target.closest('button'); if (!b || b.disabled) return;
        if (b.dataset.g) { const h = b.dataset.g; if (stay.has(h)) stay.delete(h); else stay.add(h); draw(); return; }
        if (b.hasAttribute('data-gok')) {
          party.forEach((h) => { G.heroes[h].city = stay.has(h) ? cityId : srcId; });
          closeModal(); done();
        }
      };
    });
  };
  draw();
}

function captureCity(cityId, res) {
  const st = G.cities[cityId];
  const from = st.owner, boss = st.boss, lv = CITIES[cityId].level;
  st.owner = 'player'; st.boss = null;
  const surrender = res ? Math.floor((res.reserve || 0) * 0.5) : 0;
  st.troops = (res ? res.survivors : 0) + surrender;
  st.loyal = Math.max(20, st.loyal - 20);
  MapView.spread(cityId, from);
  const gold = 120 + lv * 35, food = 150 + lv * 40;
  G.gold += gold; G.food += food;
  const drops = [pick(LOOT)];
  if (lv >= 4) drops.push(pick(LOOT));
  if (cityId === 'pyongyang' || cityId === 'gyeongju') drops.push(Math.random() < 0.5 ? 'a_yongrin' : 'a_dujeong');
  drops.forEach(giveItem);
  const reveal = (CITY_REVEALS[cityId] || []).slice();
  if (ownedCities().length >= 2 && !G.places.includes('jiphyeon')) reveal.push('jiphyeon');
  reveal.forEach((p) => { if (!G.places.includes(p)) G.places.push(p); });
  G.joinCity = cityId;
  const turn = makeOfficer(Math.random() < 0.5 ? 'civil' : 'mil', Math.max(2, lv + 1), cityId, '투항한 관리');
  G.heroes[turn].acted = true;
  logEvent(`${CITIES[cityId].name}을(를) 차지했다. 금 ${gold}, 군량 ${food}, ${drops.map((d) => ITEMS[d].name).join(', ')}. ${HEROES[turn].name}이(가) 투항했다.${surrender ? ` 성 안 병사 ${surrender}명이 항복해 합류했다.` : ''}`);
  renderAll();

  const seq = [];
  if (cityId === 'gangneung') { giveItem('k_sansam'); seq.push((n) => Dialog.play(SCRIPT.gangneung, n)); }
  if (cityId === 'tongyeong') seq.push((n) => Dialog.play(SCRIPT.tongyeong, () => { addHero('sunsin', null, 'tongyeong'); G.heroes.sunsin.acted = true; toast('이순신이 합류했습니다.', 'gold'); n(); }));
  if (boss && BOSS_LINES[boss]) seq.push((n) => bossChoice(boss, n));
  seq.push((n) => {
    toast(`${CITIES[cityId].name} 점령 · 금 ${gold}, 군량 ${food}, ${drops.map((d) => ITEMS[d].name).join(', ')} · ${HEROES[turn].name} 투항`, 'gold');
    if (reveal.length) setTimeout(() => toast(`새 소문: ${reveal.map((p) => PLACES[p].name).join(', ')}`, 'violet'), 700);
    n();
  });
  const run = () => { const f = seq.shift(); if (f) f(run); else { renderAll(); saveGame(); if (ownedCities().length === 6) setTimeout(finale, 900); } };
  setTimeout(run, 1200);
}

function bossChoice(boss, cb) {
  const L = BOSS_LINES[boss];
  Dialog.play([{ who: boss, text: L[0], choices: [
    { label: '등용한다', then: [{ who: boss, text: L[1] }], do: () => { addHero(boss, null, G.joinCity); G.heroes[boss].acted = true; G.done['rec_' + boss] = true; logEvent(`${HEROES[boss].name}을(를) 등용했다.`); } },
    { label: '놓아준다 (업 +1)', then: [{ who: boss, text: L[2] }], do: () => { G.karma += 1; giveItem('r_sinui'); G.done['rel_' + boss] = true; logEvent(`${HEROES[boss].name}을(를) 놓아주었다.`); } },
  ] }], cb);
}

/* ---------- 숨겨진 장소 ---------- */
function explore(placeId) {
  const pl = PLACES[placeId];
  if (G.cities[pl.region].owner !== 'player') { toast(`${CITIES[pl.region].name}을(를) 먼저 차지해야 합니다.`); return; }
  const evId = pl.events.find((ev) => !G.done[ev] && (!EVENTS[ev].after || G.done[EVENTS[ev].after]));
  if (!evId) { toast('이곳에서는 더 찾을 것이 없습니다.'); return; }
  const ev = EVENTS[evId];
  const why = ev.need();
  if (why) {
    openModal(`<div class="modal-head"><h3 class="h-display">${pl.name}</h3><button class="x" data-close>×</button></div>
      <blockquote class="rumor">${esc(why)}</blockquote><p class="hint">조건이 맞지 않아 아무도 행동을 쓰지 않았습니다.</p>
      <div class="actions"><button class="btn" data-close>돌아가기</button></div>`, (card) => { card.onclick = (e) => { if (e.target.closest('[data-close]')) closeModal(); }; });
    return;
  }
  const free = freeIn(pl.region);
  if (!free.length) { toast(`${CITIES[pl.region].name}에 이번 턴 행동할 수 있는 장수가 없습니다.`); return; }
  openModal(`<div class="modal-head"><h3 class="h-display">${pl.name} 탐색</h3><button class="x" data-close>×</button></div>
    <p class="muted">${CITIES[pl.region].name}에 있는 장수 가운데 누구를 보낼까요? 보낸 장수는 이번 턴 행동을 씁니다.</p>
    <div class="party">${free.map((h) => `<button class="pick-hero" data-ex="${h}">${medallion(h)}<span><b>${esc(heroName(h))}</b><span class="muted small">Lv ${G.heroes[h].level}</span></span></button>`).join('')}</div>`, (card) => {
    card.onclick = (e) => {
      if (e.target.closest('[data-close]')) { closeModal(); return; }
      const b = e.target.closest('[data-ex]');
      if (!b) return;
      closeModal();
      G.heroes[b.dataset.ex].acted = true;
      renderTop();
      Dialog.play(ev.lines, () => {
        if (ev.battle) {
          choosePartyThen(ev.battle.title, (party) => {
            startBattle({ title: ev.battle.title, theme: ev.battle.theme, type: 'duel', party, enemy: ev.battle.enemy(), playerSoldiers: 0, onEnd: (res) => {
              applyBattle(res, party, false);
              showScreen('scr-map');
              if (res.win) Dialog.play(ev.winLines || [], () => finishEvent(evId));
              else { toast('"다시 오너라." 계백이 칼을 거둔다.'); renderAll(); saveGame(); }
            } });
          }, () => { renderAll(); }, { note: '결투에는 병사 없이 영웅만 나갑니다.', troops: 0 });
          return;
        }
        finishEvent(evId);
      });
    };
  });
}

function finishEvent(evId) {
  G.done[evId] = true;
  const pl = Object.values(PLACES).find((p) => p.events.includes(evId));
  if (pl) G.joinCity = pl.region;
  const msg = EVENTS[evId].reward();
  logEvent(msg);
  renderAll(); saveGame();
  const newHero = G.roster[G.roster.length - 1];
  const isHero = /합류/.test(msg);
  openModal(`<div class="reward">${isHero ? medallion(newHero, 'xl') : '<span class="seal big gold">寶</span>'}
    <p class="reward-msg">${esc(msg)}</p><button class="btn primary" data-close>확인</button></div>`,
    (card) => { card.onclick = (e) => { if (e.target.closest('[data-close]')) closeModal(); }; }, 'narrow');
}

/* ---------- 턴 ---------- */
function endTurn() {
  if (Dialog.active() || !$('#modal').hidden) return;
  const autoLog = [];
  ownedCities().forEach((c) => { if (G.cities[c].auto) autoLog.push(...autoDomestic(c)); });
  if (autoLog.length) { autoLog.forEach(logEvent); setTimeout(() => toast(`위임 내정 ${autoLog.length}건 · 소문 탭 기록에서 볼 수 있습니다`), 300); }
  const wasNight = isNight();
  G.phase = (G.phase + 1) % PHASES.length;
  let extra = '';
  if (wasNight && G.market) { G.market = null; }
  if (isNight()) maybeMarket();
  if (G.phase === 0) {
    G.day++;
    const gIn = ownedCities().reduce((a, c) => a + cityGold(c), 0);
    const fIn = ownedCities().reduce((a, c) => a + cityFood(c), 0);
    const up = foodUpkeep();
    G.gold += gIn; G.food += fIn - up;
    extra = ` · 금 +${gIn}, 군량 +${fIn - up}`;
    if (G.food < 0) {
      G.food = 0;
      ownedCities().forEach((c) => { const st = G.cities[c]; st.troops = Math.floor(st.troops * 0.95); st.loyal = Math.max(0, st.loyal - 5); });
      setTimeout(() => toast('군량이 바닥나 병사들이 흩어지고 민심이 떨어졌습니다.', 'warn'), 500);
    }
    enemyDomestic();
  }
  G.roster.forEach((h) => { G.heroes[h].hp = Math.min(1, G.heroes[h].hp + 0.1); G.heroes[h].acted = false; });
  UI.cmd = null; UI.cmdHero = null;
  renderAll(); saveGame();
  toast(`${G.day}일차 ${phaseName()}${extra}${isNight() ? ' · 내정은 쉬고 휴식·기습·소문 탐색을 할 수 있습니다' : ''}`);
  if (G.market && G.market.day === G.day && G.market.fresh) { G.market.fresh = false; setTimeout(() => marketNotice(), 700); }
  maybeEnemyAttack();
}

/* 컴퓨터 세력의 내정: 매일 아침 병력을 모으고 조련한다 */
function enemyDomestic() {
  const notes = [];
  for (const id in G.cities) {
    const st = G.cities[id];
    if (st.owner === 'player') continue;
    const lv = CITIES[id].level;
    const add = 6 + lv * 3;
    st.troops = Math.min(320, st.troops + add);
    st.train = Math.min(90, st.train + 2);
    if (Math.random() < 0.3) st.wall = Math.min(90, st.wall + 2);
    notes.push(`${FACTIONS[st.owner].name}이(가) ${CITIES[id].name}에서 병사를 모았다 (병력 ${st.troops})`);
  }
  if (notes.length) { const n = pick(notes); logEvent('적 동향: ' + n); setTimeout(() => toast('적 동향 · ' + n, 'violet'), 900); }
}

function maybeEnemyAttack(force) {
  if (!force) {
    if (G.phase === 0 || G.day < 3 || G.attackDay === G.day) return;
    if (Math.random() > 0.3) return;
  }
  const cand = [];
  for (const id in G.cities) {
    const st = G.cities[id];
    if (st.owner === 'player' || st.owner === 'ghost' || st.troops < 60) continue;
    neighbors(id).forEach((n) => { if (G.cities[n].owner === 'player' && (force || st.troops * 0.6 > G.cities[n].troops * 0.6)) cand.push([id, n]); });
  }
  if (!cand.length) return;
  const [src, tgt] = pick(cand);
  G.attackDay = G.day;
  const owner = G.cities[src].owner, fac = FACTIONS[owner];
  const preview = enemyForce(tgt, { attacker: src, faction: owner });
  G.cities[src].troops = Math.max(0, G.cities[src].troops - preview.send);
  const T = G.cities[tgt];
  openModal(`<div class="modal-head warn"><h3 class="h-display">${isNight() ? '적의 야습' : '적의 침공'}</h3></div>
    <p><b style="color:${fac.color}">${fac.name}</b>이(가) ${CITIES[src].name}에서 병력 ${preview.send}으로 <b>${CITIES[tgt].name}</b>을(를) 칩니다.</p>
    <p class="muted small">${CITIES[tgt].name} 병력 ${T.troops} · 훈련 ${T.train} · 성벽 ${T.wall}. 직접 지휘하면 실시간 전투로 막습니다. 방어 전투는 영웅의 행동을 쓰지 않습니다.</p>
    <div class="actions"><button class="btn primary" data-a="fight">직접 지휘</button><button class="btn" data-a="auto">자동 방어</button></div>`, (card) => {
    card.onclick = (e) => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      closeModal();
      if (b.dataset.a === 'fight') {
        choosePartyThen(`${CITIES[tgt].name} 방어`, (party, sent) => {
          T.troops -= sent;
          const enemy = enemyForce(tgt, { attacker: src, faction: owner, party: party.length });
          enemy.soldiers = preview.send;
          startBattle({ title: `${CITIES[tgt].name} 방어전`, theme: CITIES[tgt].theme || 'ruin', type: 'defend', party, enemy,
            playerSoldiers: sent, playerTrain: T.train, wall: { team: 0, value: T.wall }, formation: UI.formation, forms: Object.fromEntries(party.map((h) => [h, heroFormOf(h)])), onEnd: (res) => {
              applyBattle(res, party, false);
              showScreen('scr-map');
              if (res.win) { T.troops += res.survivors; G.cities[src].troops += 0; toast(`${CITIES[tgt].name}을(를) 지켜 냈습니다.`, 'gold'); logEvent(`${CITIES[tgt].name} 방어 성공`); }
              else { T.troops += res.survivors; loseCity(tgt, src, Math.max(10, res.enemyLeft)); }
              renderAll(); saveGame();
            } });
        }, () => autoDefend(src, tgt, preview.send), { only: heroesIn(tgt), troops: T.troops, allowEmpty: true, formation: true, note: `${CITIES[tgt].name} 병력 ${T.troops}으로 막습니다. 영웅 없이 나가면 혼불 대장이 지휘합니다.` });
      } else autoDefend(src, tgt, preview.send);
    };
  });
}

function autoDefend(src, tgt, send) {
  const T = G.cities[tgt], S = G.cities[src];
  const lv = G.roster.map((h) => G.heroes[h].level).sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0);
  const p = T.troops * (0.5 + T.train / 100) * (1 + T.wall / 200) + lv * 8;
  const e = send * (0.5 + S.train / 100) + CITIES[src].level * 20;
  const win = Math.random() < p / (p + e);
  if (win) {
    const loss = Math.round(send * 0.3 * (0.5 + Math.random() * 0.5));
    T.troops = Math.max(0, T.troops - loss);
    S.troops += Math.round(send * 0.3);
    toast(`${CITIES[tgt].name} 자동 방어 성공 · 병사 ${loss}명을 잃었습니다.`, 'gold');
    logEvent(`${CITIES[tgt].name} 자동 방어 성공`);
  } else {
    T.troops = Math.round(T.troops * 0.3);
    loseCity(tgt, src, Math.round(send * 0.6));
  }
  renderAll(); saveGame();
}

function loseCity(tgt, src, occupy = 30) {
  const owner = G.cities[src].owner;
  const T = G.cities[tgt];
  // 살아남은 병사는 이웃한 아군 도시로 물러난다
  const back = neighbors(tgt).find((n) => G.cities[n].owner === 'player');
  if (back) G.cities[back].troops += T.troops;
  const fallback = back || ownedCities().find((c) => c !== tgt);
  heroesIn(tgt).forEach((h) => { if (fallback) G.heroes[h].city = fallback; });
  T.owner = owner;
  T.troops = occupy;
  logEvent(`${CITIES[tgt].name}을(를) 빼앗겼다.`);
  toast(`${CITIES[tgt].name}을(를) 빼앗겼습니다.${back ? ` 남은 병사는 ${CITIES[back].name}(으)로 물러났습니다.` : ''}`, 'warn');
  renderAll(); saveGame();
  if (!ownedCities().length) {
    openModal(`<div class="reward"><span class="seal big">亡</span><p class="reward-msg">모든 도시를 잃었다. 혼은 다시 황천 나루로 돌아간다.</p>
      <button class="btn primary" data-restart>처음부터</button></div>`, (card) => { card.onclick = (e) => { if (e.target.closest('[data-restart]')) { closeModal(); clearSave(); startNew(); } }; }, 'narrow');
  }
}

/* ---------- 엔딩 ---------- */
function finale() {
  if (G.done.finale) return;
  G.done.finale = true;
  saveGame();
  Dialog.play(SCRIPT.finale, () => {
    const evTotal = Object.keys(EVENTS).length;
    const evDone = Object.keys(EVENTS).filter((e) => G.done[e]).length;
    openModal(`<div class="reward"><p class="eyebrow">1막 「고향의 혼」 완료</p><h3 class="h-display big">한반도 통일</h3>
      <dl class="kv">
        <div><dt>걸린 날</dt><dd>${G.day}일</dd></div>
        <div><dt>만난 영웅</dt><dd>${namedCount()} / 13 (장수 ${G.roster.length})</dd></div>
        <div><dt>숨겨진 사건</dt><dd>${evDone} / ${evTotal}</dd></div>
        <div><dt>업</dt><dd>${G.karma}</dd></div>
        <div><dt>전투</dt><dd>${G.stats.wins}승 / ${G.stats.battles}전</dd></div>
      </dl>
      <p class="muted">프로토타입은 여기까지입니다. 계속 둘러보며 남은 영웅과 고유 무기를 찾을 수 있습니다.</p>
      <div class="actions"><button class="btn primary" data-close>계속 둘러보기</button><button class="btn" data-restart>처음부터</button></div></div>`,
    (card) => { card.onclick = (e) => {
      if (e.target.closest('[data-close]')) closeModal();
      if (e.target.closest('[data-restart]')) { closeModal(); clearSave(); startNew(); }
    }; }, 'narrow');
  });
}

/* ---------- 서막 ---------- */
function nationSelect(cb) {
  const ns = [['한국', '韓', true], ['중국', '中', false], ['일본', '日', false], ['몽골', '蒙', false], ['프랑스', '佛', false], ['이집트', '埃', false]];
  openModal(`<div class="modal-head"><h3 class="h-display">업경대 · 태초 국가 선택</h3></div>
    <p class="muted">돌아갈 땅을 고르세요. 고른 나라에서 첫 영웅들을 만나고 이야기가 시작됩니다.</p>
    <div class="nations">${ns.map(([n, g, on]) => `<button class="nation ${on ? '' : 'locked'}" ${on ? 'data-n="kr"' : 'disabled'}><span class="ng">${g}</span><b>${n}</b><span class="small muted">${on ? '이번 프로토타입' : '다음 업데이트'}</span></button>`).join('')}</div>`, (card) => {
    card.onclick = (e) => { if (e.target.closest('[data-n]')) { closeModal(); cb(); } };
  });
}

function startNew() {
  newGame();
  UI.sel = null; UI.heroView = null; UI.tab = 'info';
  showScreen('scr-story');
  setScene('river');
  Dialog.play(SCRIPT.p1, () => {
    setScene('hall');
    Dialog.play(SCRIPT.p2, () => {
      setScene('mirror');
      Dialog.play(SCRIPT.p3a, () => nationSelect(() => Dialog.play(SCRIPT.p3b, () => {
        setScene('seoul');
        Dialog.play(SCRIPT.p4, tutorialBattle);
      })));
    });
  });
}

function tutorialBattle() {
  startBattle({
    title: '거울 세계 · 서울', theme: 'ruin', type: 'tutorial', tutorial: true, formation: 'eorin', forms: { hero: heroFormOf('hero'), gangrim: heroFormOf('gangrim') }, party: ['hero', 'gangrim'], playerSoldiers: 40, playerTrain: 45,
    enemy: { heroes: [{ generic: true, name: '무명 십부장', level: 2, faction: 'ghost', skill: 'ghostfire' }], soldiers: 14, level: 1, faction: 'ghost' },
    onEnd: (res) => {
      applyBattle(res, ['hero', 'gangrim'], false);
      showScreen('scr-story');
      setScene('seoul');
      if (!res.win) { G.roster.forEach((h) => { G.heroes[h].hp = 1; }); Dialog.play([{ who: 'gangrim', text: '정신 차려! 다시 간다.' }], tutorialBattle); return; }
      Dialog.play(SCRIPT.eulji, () => {
        addHero('eulji', 5, 'seoul');
        G.stage = 'act1';
        G.roster.forEach((h) => { G.heroes[h].hp = 1; G.heroes[h].acted = false; });
        showScreen('scr-map');
        renderAll();
        saveGame();
        Dialog.play(SCRIPT.intro, () => saveGame());
      });
    },
  });
}

function continueGame() {
  const s = loadSave();
  if (!s) return;
  G = s;
  if (G.stage === 'act1' && G.v === 3) { G.phase = [0, 0, 1, 2][G.phase] || 0; G.v = 4; }
  if (G.stage !== 'act1' || G.v !== 4) { startNew(); return; }
  registerOfficers();
  showScreen('scr-map');
  renderAll();
  toast(`${G.day}일차 ${phaseName()} · 이어서 시작합니다`);
}

function howTo() {
  openModal(`<div class="modal-head"><h3 class="h-display">조작법</h3><button class="x" data-close>×</button></div>
    <div class="howto">
      <p class="label">전투</p>
      <ul><li><kbd>클릭</kbd> 땅을 누르면 이동, 적을 누르면 공격, 아군 영웅을 누르면 그 영웅을 조종</li>
      <li><kbd>W A S D</kbd> 또는 방향키로 직접 이동</li>
      <li><kbd>Q</kbd> 고유 기술 · <kbd>E</kbd> 숨겨진 특수기 (고유 무기 장착 시)</li>
      <li><kbd>1</kbd> 따라와 · <kbd>2</kbd> 돌격 · <kbd>3</kbd> 대기 · <kbd>4</kbd> 후퇴</li>
      <li><kbd>Tab</kbd> 조종할 영웅 바꾸기 · <kbd>Space</kbd> 일시정지</li>
      <li><kbd>F</kbd> 속도 1×·2×·3× · <kbd>R</kbd> 자동 전투 (화면 위 버튼으로도 가능)</li></ul>
      <p class="muted small">조종하지 않는 영웅은 부대 명령을 따르며 기술을 알아서 씁니다. 화면 아래 영웅 카드의 버튼으로도 기술을 쓸 수 있습니다.</p>
      <p class="label">국가 운영</p>
      <ul><li>하루는 오전 → 오후 → 야간으로 흐릅니다. 영웅마다 시간대마다 한 번 행동합니다.</li>
      <li>오전·오후: 개간·상업·성벽·선정·징병·훈련·인재 탐색·수송 같은 내정과 출병, 장터.</li>
      <li>야간: 휴식(체력 모두 회복), 소문 탐색(숨겨진 장소·적 정탐·재물), 야간 기습(적 사기 -20, 성벽 효과 절반, 적 지원 부대 없음). 가끔 도깨비들이 비밀 장터를 엽니다.</li>
      <li>매일 아침 상업에서 금, 농업에서 군량이 들어오고 병사들이 군량을 먹습니다. 출병에는 병사당 군량 0.5가 듭니다.</li>
      <li>출병에는 영웅을 최대 10명, 영웅마다 병사 20명씩 데려갑니다. 부대 사기는 영웅의 통솔력을 따릅니다.</li>
      <li>숨겨진 장소는 시간대, 동료 영웅, 귀중품 같은 조건이 맞아야 열립니다.</li></ul>
    </div><div class="actions"><button class="btn primary" data-close>닫기</button></div>`,
  (card) => { card.onclick = (e) => { if (e.target.closest('[data-close]')) closeModal(); }; });
}

/* ---------- 시작 ---------- */
function boot() {
  Dialog.init();
  Battle.init();
  MapView.init((h) => {
    if (!h || !UI.sel || h.id !== UI.sel.id) { UI.cmd = null; UI.cmdHero = null; }
    UI.sel = h; UI.tab = 'info';
    renderPanel();
    if (h && window.innerWidth < 860) $('#panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#panel-body').addEventListener('click', onPanelClick);
  const railEl = $('#cmdrail');
  if (railEl) railEl.addEventListener('click', onPanelClick);
  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    UI.tab = b.dataset.tab;
    if (UI.tab !== 'heroes') { UI.heroView = null; UI.equipSlot = null; }
    renderPanel();
  });
  $('#btn-end').addEventListener('click', endTurn);
  $('#btn-help').addEventListener('click', howTo);
  $('#btn-title').addEventListener('click', () => { saveGame(); refreshTitle(); showScreen('scr-title'); });
  $('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && $('#modal-card').querySelector('[data-close]')) { closeModal(); renderAll(); } });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !$('#modal').hidden && $('#modal-card').querySelector('[data-close]')) { closeModal(); if (G) renderAll(); }
  });
  $('#ti-new').addEventListener('click', () => {
    if (loadSave()) {
      openModal(`<div class="reward"><p class="reward-msg">저장된 진행을 지우고 처음부터 시작할까요?</p>
        <div class="actions"><button class="btn primary" data-yes>새로 시작</button><button class="btn" data-close>취소</button></div></div>`,
      (card) => { card.onclick = (e) => { if (e.target.closest('[data-yes]')) { closeModal(); clearSave(); startNew(); } else if (e.target.closest('[data-close]')) closeModal(); }; }, 'narrow');
    } else startNew();
  });
  $('#ti-cont').addEventListener('click', continueGame);
  $('#ti-help').addEventListener('click', howTo);
  refreshTitle();
  showScreen('scr-title');
}
function refreshTitle() {
  const s = loadSave();
  const ok = !!(s && s.stage === 'act1' && (s.v === 3 || s.v === 4));
  $('#ti-cont').hidden = !ok;
  $('#ti-save').textContent = ok ? `${s.name} 맹주 · ${s.day}일차 · 영웅 ${s.roster.length}명` : '';
}

const startFn = () => {
  let booted = false;
  const go = () => { if (!booted) { booted = true; boot(); } };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
  setTimeout(go, 1800);
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startFn); else startFn();

/* 테스트 도구 */
window.__dbg = { get G() { return G; }, Battle, MapView, endTurn, captureCity, explore, finishEvent, maybeEnemyAttack, startNew, tutorialBattle, launchAttack, Dialog };
