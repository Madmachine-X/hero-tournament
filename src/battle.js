'use strict';
/* ===== 퍼스트퀸식 실시간 부대 전투 ===== */
const Battle = (() => {
  const W = 2000, H = 1100;
  let B = null, cv = null, ctx = null, DPR = 1, raf = 0, lastT = 0, vw = 1, vh = 1, VS = 1;
  let active = false;
  const SQUAD = 20;
  const DMG_SCALE = 0.27; /* 전투 템포: 낮을수록 길게 싸운다 */
  const prefs = { speed: 1, auto: false };
  const keys = {};

  /* ---------- 소리: 음원 파일 없이 Web Audio로 직접 만든다 ---------- */
  const Sfx = (() => {
    let ac = null, master = null, noiseBuf = null, drumT = 0, muteFF = false;
    let on = (() => { try { return localStorage.getItem('chyw-sound') !== 'off'; } catch (e) { return true; } })();
    const last = {};
    function ready() {
      if (!on || muteFF) return false;
      try {
        if (!ac) {
          const AC = window.AudioContext || window.webkitAudioContext;
          if (!AC) return false;
          ac = new AC();
          master = ac.createGain(); master.gain.value = 0.55; master.connect(ac.destination);
          noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
          const d = noiseBuf.getChannelData(0);
          for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (ac.state === 'suspended') ac.resume();
        return ac.state !== 'closed';
      } catch (e) { return false; }
    }
    // 같은 소리가 너무 자주 겹치지 않게 (초당 몇 번까지만)
    function gate(name, gap) { const t = performance.now(); if (last[name] && t - last[name] < gap) return false; last[name] = t; return true; }
    function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    function noise(t, dur, peak, type, freq, q, a = 0.004) {
      const src = ac.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
      const g = ac.createGain(); env(g, t, a, peak, dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
      return f;
    }
    function tone(t, dur, peak, type, f0, f1, a = 0.005) {
      const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const g = ac.createGain(); env(g, t, a, peak, dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    function drum(t, big) {
      tone(t, big ? 0.7 : 0.4, big ? 0.9 : 0.5, 'sine', big ? 110 : 140, big ? 38 : 50, 0.003);
      noise(t, 0.12, big ? 0.35 : 0.18, 'lowpass', 600, 0.7);
    }
    const P = {
      // 칼 부딪힘: 짧은 금속성 잡음
      clash(big) {
        if (!gate('clash', big ? 40 : 75)) return;
        const t = ac.currentTime;
        noise(t, big ? 0.16 : 0.08, big ? 0.32 : 0.12, 'bandpass', 2600 + Math.random() * 1800, 6);
        tone(t, big ? 0.22 : 0.1, big ? 0.08 : 0.03, 'triangle', 1800 + Math.random() * 900, 900);
      },
      crit() { if (!gate('crit', 90)) return; const t = ac.currentTime; noise(t, 0.25, 0.4, 'highpass', 3000, 1); tone(t, 0.35, 0.12, 'square', 2400, 600); },
      arrow() { if (!gate('arrow', 110)) return; const f = noise(ac.currentTime, 0.18, 0.05, 'bandpass', 1800, 3, 0.05); f.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.18); },
      // 기술: 낮게 울리는 굉음과 쓸어 올라가는 소리
      skill(big) {
        if (!gate('skill', 250)) return;
        const t = ac.currentTime;
        tone(t, big ? 1.4 : 0.7, big ? 0.7 : 0.4, 'sawtooth', big ? 70 : 110, big ? 35 : 55, 0.01);
        const f = noise(t, big ? 1.1 : 0.6, big ? 0.35 : 0.2, 'bandpass', 400, 2, 0.08); f.frequency.exponentialRampToValueAtTime(big ? 5000 : 3000, t + (big ? 1.0 : 0.5));
        if (big) { drum(t, true); tone(t + 0.05, 1.6, 0.12, 'sine', 523, 520, 0.02); tone(t + 0.05, 1.6, 0.08, 'sine', 784, 780, 0.02); }
      },
      // 영웅 쓰러짐: 징 소리
      fall(boss) {
        const t = ac.currentTime;
        drum(t, true);
        [1, 2.76, 5.4].forEach((m, i) => tone(t, boss ? 3 : 2, (boss ? 0.22 : 0.14) / (i + 1), 'sine', (boss ? 92 : 120) * m, (boss ? 88 : 116) * m, 0.01));
      },
      // 첫 격돌
      impact() { const t = ac.currentTime; drum(t, true); noise(t, 0.9, 0.5, 'lowpass', 900, 0.5, 0.01); for (let i = 0; i < 4; i++) P.clash(true); },
      // 출진 북 세 번 + 함성
      start() {
        const t = ac.currentTime + 0.05;
        drum(t, true); drum(t + 0.32, false); drum(t + 0.56, true);
        const f = noise(t + 0.5, 1.4, 0.16, 'bandpass', 700, 1.5, 0.25); f.frequency.linearRampToValueAtTime(1100, t + 1.6);
      },
      win() { const t = ac.currentTime; [0, 0.18, 0.36].forEach((d, i) => drum(t + d, i === 2)); [392, 523, 659, 784].forEach((fq, i) => tone(t + 0.4 + i * 0.12, 1.4, 0.13, 'triangle', fq)); },
      lose() { const t = ac.currentTime; drum(t, true); [330, 277, 220].forEach((fq, i) => tone(t + 0.3 + i * 0.3, 1.2, 0.12, 'triangle', fq, fq * 0.97)); },
      ui() { if (!gate('ui', 60)) return; tone(ac.currentTime, 0.06, 0.08, 'triangle', 900, 700); },
    };
    function play(name, ...a) { if (ready()) try { P[name](...a); } catch (e) {} }
    // 전투 중 깔리는 북소리: 남은 병력이 적을수록, 위기일수록 빨라진다
    function tick(dt, tense) {
      if (!ready()) return;
      drumT -= dt;
      if (drumT > 0) return;
      const t = ac.currentTime;
      drum(t, false); drum(t + (tense ? 0.18 : 0.26), false);
      drumT = tense ? 0.75 : 1.15;
    }
    return {
      play, tick,
      get on() { return on; },
      toggle() { on = !on; try { localStorage.setItem('chyw-sound', on ? 'on' : 'off'); } catch (e) {} if (!on && ac) ac.suspend(); else ready(); return on; },
      quiet(v) { muteFF = v; },
      reset() { drumT = 1.6; },
    };
  })();
  let uid = 0;
  const hud = { cards: [] };
  const ORDERS = [
    { id: 'form', name: '진형 유지 이동', key: '1' },
    { id: 'charge', name: '돌격', key: '2' },
    { id: 'follow', name: '따라와', key: '3' },
    { id: 'skirmish', name: '각개전투', key: '4' },
    { id: 'hold', name: '대기', key: '5' },
    { id: 'retreat', name: '후퇴', key: '6' },
  ];
  const FONT_GLYPH = '"Noto Serif KR", "Song Myung", serif';
  const FONT_BRUSH = '"Nanum Brush Script", "Song Myung", serif';
  const FONT_NUM = '"Gowun Dodum", system-ui, sans-serif';

  /* ---------- 준비 ---------- */
  function init() {
    cv = $('#bcv');
    ctx = cv.getContext('2d');
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    cv.addEventListener('pointerdown', onPointer);
    cv.addEventListener('wheel', (e) => { if (!B) return; e.preventDefault(); B.zoom = clamp((B.zoom || 1) * (e.deltaY > 0 ? 0.9 : 1.1), 0.55, 1.7); }, { passive: false });
    $('#b-mini').addEventListener('pointerdown', (e) => {
      if (!B || !B.ctrl || !B.ctrl.alive) return;
      const r = e.currentTarget.getBoundingClientRect();
      B.moveTo = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; B.attackTarget = null;
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    $('#b-pause').addEventListener('click', togglePause);
    $('#b-auto').addEventListener('click', () => { if (!B) return; B.autoCtrl = !B.autoCtrl; prefs.auto = B.autoCtrl; syncButtons(); });
    $('#b-speed').addEventListener('click', (e) => { const b = e.target.closest('[data-sp]'); if (b && B) { B.speed = +b.dataset.sp; prefs.speed = B.speed; syncButtons(); } });
    $('#b-sound').addEventListener('click', () => { Sfx.toggle(); Sfx.play('ui'); syncButtons(); });
    $('#b-skip').addEventListener('click', skipBattle);
    $('#b-retreat').addEventListener('click', () => { if (B && !B.over) finish(false, true); });
    const ob = $('#b-orders');
    ob.innerHTML = ORDERS.map((o) => `<button class="ord" data-ord="${o.id}"><kbd>${o.key}</kbd>${o.name}</button>`).join('');
    ob.addEventListener('click', (e) => { const b = e.target.closest('[data-ord]'); if (b) setOrder(b.dataset.ord); });
    const fb = $('#b-forms');
    if (fb) fb.addEventListener('click', (e) => { const b = e.target.closest('[data-bform]'); if (b) setBattleForm(b.dataset.bform); });
    $('#b-tip').addEventListener('click', () => { $('#b-tip').hidden = true; });
  }

  function resize() {
    if (!cv) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.getBoundingClientRect();
    vw = Math.max(1, r.width); vh = Math.max(1, r.height);
    cv.width = Math.round(vw * DPR); cv.height = Math.round(vh * DPR);
    VS = clamp(Math.min(vw / 920, vh / 580), 0.72, 1.5);
  }

  function mkUnit(o) {
    return Object.assign({
      id: ++uid, alive: true, down: false, vx: 0, vy: 0, face: 0, atkT: Math.random() * 0.8,
      stun: 0, fear: 0, fearX: 0, fearY: 0, slowT: 0, burnT: 0, burnD: 0, burnTick: 0, burnSrc: null,
      buffT: 0, buffAtk: 0, buffDef: 0, invuln: 0, flash: 0, ttl: 0, skills: [], r: 7, swing: 0,
      orbit: 0, orbitA: 0, orbitTick: 0, dash: null, rout: false, bob: Math.random() * 6, squadN: 0, pounce: 0,
    }, o);
  }

  function heroUnit(hid, team, x, y, level, equip) {
    const s = level != null ? statsFrom(hid, level, equip) : computeStats(hid);
    const d = HEROES[hid];
    const eq = equip || G.heroes[hid].equip;
    const w1 = ITEMS[eq.w1], w2 = ITEMS[eq.w2];
    const u = mkUnit({
      team, kind: 'hero', hid, name: team === 0 ? heroName(hid) : d.name, glyph: d.glyph, color: d.color, x, y, r: 12,
      maxHp: s.maxHp, hp: s.maxHp, atk: s.atk, def: s.def, sp: s.sp, spd: s.spd, atkCd: s.atkCd, range: s.range, ranged: s.ranged,
      cdr: s.cdr, squad: s.squad, style: s.style, hiddenOn: s.hiddenOn, lea: s.lea, level: level != null ? level : G.heroes[hid].level,
      w1: w1 ? w1.wtype : null, w2: w2 ? w2.wtype : null,
    });
    u.skills = [{ id: d.skill, t: 1.5 + Math.random() * 2, hidden: false }];
    if (d.hidden) u.skills.push({ id: d.hidden, t: team === 0 ? 3 : 15, hidden: true });
    return u;
  }

  function genericUnit(spec, x, y) {
    const L = spec.level, f = FACTIONS[spec.faction] || FACTIONS.ghost, boss = !!spec.boss;
    const u = mkUnit({
      team: 1, kind: 'hero', generic: true, name: spec.name, glyph: f.glyph, color: f.color, x, y, r: boss ? 14 : 12,
      maxHp: Math.round((250 + L * 42) * (boss ? 1.4 : 1)), atk: Math.round((11 + L * 2.4) * (boss ? 1.15 : 1)),
      def: Math.round(5 + L * 1.3), sp: Math.round(26 + L * 3.4), spd: 96, atkCd: 0.95, range: 20, level: L,
      ghost: spec.faction === 'ghost' || spec.faction === 'sea', boss, w1: 'sword', lea: 10 + L,
    });
    u.hp = u.maxHp;
    u.skills = spec.skill ? [{ id: spec.skill, t: 3 + Math.random() * 3, hidden: false }] : [];
    return u;
  }

  function soldierUnit(team, leader, stype, L, x, y, faction, train = 50) {
    const tf = 0.7 + (train / 100) * 0.6;
    const hp = Math.round((34 + L * 5) * 2.4 * (stype === 'cavalry' ? 1.25 : 1));
    return mkUnit({
      team, kind: 'soldier', leader, stype, x, y, r: stype === 'cavalry' ? 8 : 7, maxHp: hp, hp,
      atk: (3 + L * 0.7) * (stype === 'archer' ? 0.85 : 1) * tf, def: (2 + L * 0.6) * tf,
      spd: stype === 'cavalry' ? 128 : 92, atkCd: stype === 'archer' ? 1.6 : 1.4,
      range: stype === 'archer' ? 125 : 14, ranged: stype === 'archer',
      color: (FACTIONS[faction] || FACTIONS.ghost).color, ghost: faction === 'ghost' || faction === 'sea', level: L,
      slot: leader ? leader.squadN++ : 0,
    });
  }

  /* ---------- 시작 ---------- */
  function start(cfg) {
    if (typeof Art !== 'undefined' && Art.warm) Art.warm();
    resize();
    uid = 0;
    B = {
      cfg, t: 0, units: [], proj: [], fx: [], parts: [], texts: [], timers: [], over: false,
      order: 'form', ctrl: null, cam: { x: 560, y: H / 2 }, shake: 0, slowT: 0, moveTo: null, attackTarget: null,
      ground: makeGround(cfg.theme || 'field', cfg.seed || 1), mist: [], lost: 0, kills: 0, exp: {}, captured: [],
      holdPos: {}, checkT: 0.5, paused: false, autoCtrl: prefs.auto, speed: prefs.speed, routing: false, flash: 0, darken: 0, phase: G.phase,
    };
    for (let i = 0; i < 9; i++) B.mist.push({ x: rand(0, W), y: rand(0, H), r: rand(160, 320), vx: rand(6, 18) });

    const party = cfg.party;
    const px = cfg.type === 'defend' ? 620 : 380;
    B.form = [FORMATIONS[cfg.formation] ? cfg.formation : 'eorin', FORMATIONS[cfg.enemy.formation] ? cfg.enemy.formation : 'bangwon'];
    const pHeroes = party.map((hid, i) => {
      const { x, y } = heroLine(i, party.length, px, 1);
      const u = heroUnit(hid, 0, x, y);
      u.form = (cfg.forms && FORMATIONS[cfg.forms[hid]]) ? cfg.forms[hid] : B.form[0];
      u.hp = Math.max(0.3, G.heroes[hid].hp) * u.maxHp;
      B.units.push(u);
      B.exp[hid] = 0;
      return u;
    });
    // 아군 혼불이 영웅별 진형을 만든다
    let pool = Math.max(0, Math.floor(cfg.playerSoldiers || 0));
    const pL = pHeroes.length ? Math.round(pHeroes.reduce((a, u) => a + u.level, 0) / pHeroes.length) : Math.max(2, (cfg.enemy.level || 3) - 1);
    pHeroes.forEach((h) => {
      const n = Math.min(SQUAD, pool);
      pool -= n;
      const ut = (computeStats(h.hid).unit) || HEROES[h.hid].unit;
      for (let k = 0; k < n; k++) {
        let st = 'melee';
        if (ut === 'archer') st = k % 2 ? 'archer' : 'melee';
        else if (ut === 'cavalry') st = k % 3 === 2 ? 'melee' : 'cavalry';
        else if (k % 4 === 3) st = 'archer';
        const off = formOffset(h.form, k, n, 1);
        const so = soldierUnit(0, h, st, pL, h.x + off.x, h.y + off.y, 'player', cfg.playerTrain);
        so.formOx = off.x; so.formOy = off.y;
        B.units.push(so);
      }
    });
    // 영웅 없이 나선 병사(혼불 대장이 이끈다)
    if (!pHeroes.length) {
      const n = Math.min(pool, 60);
      for (let k = 0; k < n; k++) B.units.push(soldierUnit(0, null, k % 4 === 3 ? 'archer' : 'melee', pL || 3, px + rand(-60, 60), H / 2 + rand(-140, 140), 'player', cfg.playerTrain));
    }
    // 적
    const E = cfg.enemy;
    const ex = cfg.type === 'defend' ? 1520 : 1620;
    const eHeroes = E.heroes.map((spec, i) => {
      const { x: hx, y } = heroLine(i, E.heroes.length, ex, -1);
      let u;
      if (spec.generic) u = genericUnit(spec, hx, y);
      else {
        u = heroUnit(spec.id, 1, hx, y, spec.level, HERO_GEAR[spec.id]);
        u.boss = !!spec.boss; u.recruit = !!spec.recruit; u.r = 14;
        u.maxHp = Math.round(u.maxHp * 1.3); u.hp = u.maxHp; u.atk = Math.round(u.atk * 0.8); u.sp = Math.round(u.sp * 0.85);
      }
      u.faction = E.faction;
      u.form = B.form[1];
      B.units.push(u);
      return u;
    });
    const fac = E.faction;
    /* 적도 장수 한 명당 20명. 남는 병사는 혼불 대장 부대(최대 2개)로 나오고 나머지는 성 안에 남는다 */
    const nLed = Math.min(E.soldiers, eHeroes.length * SQUAD);
    const nSol = Math.min(E.soldiers, nLed + SQUAD * (E.extraSquads != null ? E.extraSquads : 2));
    B.reserve = Math.max(0, E.soldiers - nSol);
    for (let k = 0; k < nSol; k++) {
      const lead = k < nLed && eHeroes.length ? eHeroes[k % eHeroes.length] : null;
      let st = 'melee';
      if (fac === 'goguryeo' && k % 3 === 0) st = 'cavalry';
      else if (fac === 'silla' && k % 3 === 0) st = 'archer';
      else if (fac === 'sea' && k % 5 === 0) st = 'archer';
      else if (fac === 'baekje' && k % 6 === 0) st = 'archer';
      const grp = Math.floor((k - nLed) / SQUAD);
      const bx = lead ? lead.x : ex + 90, by = lead ? lead.y : H / 2 + (grp % 2 ? 1 : -1) * (120 + grp * 60);
      const slot = lead ? lead.squadN : k;
      const off = formOffset(lead ? lead.form : B.form[1], slot, SQUAD, -1);
      const so = soldierUnit(1, lead, st, E.level, bx + off.x, by + off.y, fac, E.train != null ? E.train : 50);
      so.formOx = off.x; so.formOy = off.y;
      B.units.push(so);
    }
    // 성벽: 지키는 쪽 방어력
    if (cfg.wall && cfg.wall.value) {
      const k = 1 + cfg.wall.value / 200;
      B.units.forEach((u) => { if (u.team === cfg.wall.team) u.def *= k; });
    }
    if (E.nightRaid) {
      B.units.forEach((u) => { if (u.team === 0) { u.atk = Math.round(u.atk * 0.9); u.spd *= 0.92; } });
    }
    B.units.forEach((u) => { u.spd *= fmodU(u, 'spd'); u.def *= fmodU(u, 'def'); });
    B.init = [B.units.filter((u) => u.team === 0).length, B.units.filter((u) => u.team === 1).length];
    gridInit();
    // 부대와 사기: 이끄는 영웅의 통솔력을 따른다
    B.squads = [];
    const trainOf = (tm) => (tm === 0 ? cfg.playerTrain : E.train);
    const tAdj = (tm) => ((trainOf(tm) == null ? 50 : trainOf(tm)) - 50) * 0.2 + (tm === 1 ? (E.moraleAdj || 0) : 0);
    B.units.filter((u) => u.kind === 'hero').forEach((h) => {
      const sq = { team: h.team, leader: h, morale: clamp(30 + h.lea * 2.5 + tAdj(h.team), 10, 100) };
      h.sq = sq; B.squads.push(sq);
    });
    B.units.forEach((u) => { if (u.kind === 'soldier' && u.leader && u.leader.sq) u.leader.sq.size = (u.leader.sq.size || 0) + 1; });
    B.units.filter((u) => u.kind === 'soldier').forEach((so) => { if (so.leader && so.leader.sq) so.sq = so.leader.sq; });
    B.sent = B.units.filter((u) => u.team === 0 && u.kind === 'soldier').length;
    [0, 1].forEach((tm) => {
      const loose = B.units.filter((u) => u.kind === 'soldier' && u.team === tm && !u.sq);
      for (let i = 0; i < loose.length; i += SQUAD) {
        const grp = loose.slice(i, i + SQUAD);
        const sq = { team: tm, leader: null, morale: clamp(45 + (trainOf(tm) == null ? 50 : trainOf(tm)) * 0.3 + (tm === 1 ? (E.moraleAdj || 0) : 0), 10, 100) };
        grp.forEach((u) => { u.sq = sq; });
        sq.size = grp.length;
        B.squads.push(sq);
        promote(sq, true);
      }
    });
    B.ctrl = pHeroes[0] || B.units.find((u) => u.team === 0 && u.captain) || null;
    captureAllyForm();
    const bannerText = cfg.type === 'defend' ? '수성!' : cfg.type === 'duel' ? '결투!' : '출진!';
    B.fx.push({ t: 0, dur: 1.5, layer: 'screen', draw(c, f) {
      const k = f.t / f.dur;
      c.globalAlpha = k < 0.15 ? k / 0.15 : k > 0.7 ? (1 - k) / 0.3 : 1;
      c.font = `${Math.min(vw, 900) * 0.16 * (1.15 - Math.min(0.15, k * 0.5))}px ${FONT_BRUSH}`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 8; c.strokeStyle = 'rgba(6,5,4,0.9)'; c.strokeText(bannerText, vw / 2, vh * 0.42);
      c.fillStyle = '#f3e3b8'; c.shadowColor = '#c8402f'; c.shadowBlur = 30; c.fillText(bannerText, vw / 2, vh * 0.42);
      c.shadowBlur = 0; c.globalAlpha = 1;
    } });
    B.shake = 4;
    B.punch = 0; B.focus = null; B.clashed = false; B.ciT = { mini: 0, boss: 0 };
    Sfx.reset(); Sfx.play('start');
    buildHud();
    $('#b-name').textContent = cfg.title || '전투';
    syncFormHud();
    $('#b-phase').textContent = PHASES[G.phase].name + (cfg.enemy.surprised ? ' 기습' : '');
    $('#b-result').hidden = true;
    $('#b-tip').hidden = !cfg.tutorial;
    if (cfg.tutorial) B.tipT = 14;
    active = true;
    lastT = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    syncButtons();
  }

  /* 영웅은 세로로 나란히, 혼불이 진형을 만든다. side 1 = 왼쪽(아군), -1 = 오른쪽(적) */
  function heroLine(i, n, baseX, side) {
    const spread = Math.min(150, (H - 220) / Math.max(1, n));
    return { x: baseX, y: H / 2 + (i - (n - 1) / 2) * spread };
  }
  function formOffset(f, i, n, side) {
    const mid = (n - 1) / 2, k = i - mid;
    if (f === 'hakik') return { x: side * (10 + Math.abs(k) * 6), y: k * 11 };
    if (f === 'eorin') return { x: side * (38 - Math.abs(k) * 5), y: k * 9 };
    if (f === 'bangwon') {
      const a = (i / Math.max(1, n)) * Math.PI * 2 - Math.PI / 2;
      return { x: Math.cos(a) * 44, y: Math.sin(a) * 38 };
    }
    if (f === 'jangsa') return { x: side * (8 + (i % 2) * 16), y: k * 12 };
    return { x: side * 22, y: k * 10 };
  }
  function formOf(u) {
    if (!u) return B.form[0];
    if (u.form && FORMATIONS[u.form]) return u.form;
    if (u.leader && u.leader.form && FORMATIONS[u.leader.form]) return u.leader.form;
    if (u.sq && u.sq.leader && u.sq.leader.form) return u.sq.leader.form;
    return B.form[u.team] || 'eorin';
  }
  function fmodU(u, key) { const f = FORMATIONS[formOf(u)]; return f && f[key] != null ? f[key] : 1; }
  function fmod(team, key) { const f = FORMATIONS[B.form[team]]; return f && f[key] != null ? f[key] : 1; }

  function slotPos(i, n, baseX, side) {
    const col = Math.floor(i / 5), j = i % 5;
    const cn = Math.min(5, n - col * 5);
    const gap = Math.min(150, (H - 200) / Math.max(1, cn));
    return { x: baseX - side * col * 95, y: H / 2 + (j - (cn - 1) / 2) * gap + (col % 2) * 40 };
  }

  function stop() { active = false; cancelAnimationFrame(raf); B = null; }

  /* ---------- 루프 ---------- */
  function loop(ts) {
    if (!active) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (ts - lastT) / 1000));
    lastT = ts;
    if (!B) return;
    if (!B.paused) {
      if (B.slowT > 0) B.slowT -= dt;
      let rem = dt * (B.speed || 1) * (B.slowT > 0 ? 0.3 : 1);
      while (rem > 1e-6 && B && !B.paused) { const d = Math.min(rem, 1 / 30); step(d); rem -= d; }
      if (B && !B.over) {
        const a = B.units.filter((u) => u.team === 0 && u.alive).length, e = B.units.filter((u) => u.team === 1 && u.alive).length;
        Sfx.tick(dt, a < e * 0.7 || B.units.some((u) => u.boss && u.alive && u.team === 1));
      }
    }
    if (B.tipT > 0) { B.tipT -= dt; if (B.tipT <= 0) $('#b-tip').hidden = true; }
    render();
    updateHud();
  }

  function step(dt) {
    if (!B) return;
    B.t += dt;
    for (let i = B.timers.length - 1; i >= 0; i--) {
      const tm = B.timers[i];
      tm.t -= dt;
      if (tm.t <= 0) { B.timers.splice(i, 1); tm.fn(); }
    }
    gridBuild();
    const us = B.units;
    for (const u of us) if (u.alive) tick(u, dt);
    for (const u of us) if (u.alive) think(u, dt);
    physics(dt);
    updProj(dt);
    for (let i = B.fx.length - 1; i >= 0; i--) {
      const f = B.fx[i];
      f.t += dt;
      if (f.upd) f.upd(dt, f);
      if (f.t >= f.dur) B.fx.splice(i, 1);
    }
    updParts(dt);
    if (!B.over) { B.checkT -= dt; if (B.checkT <= 0) { B.checkT = 0.25; checkEnd(); } }
    if (B.t % 2 < dt) B.units = B.units.filter((u) => u.alive || u.kind === 'hero');
    camera(dt);
    B.shake = Math.max(0, B.shake - dt * 20);
    B.flash = Math.max(0, B.flash - dt * 2.5);
    B.darken = Math.max(0, B.darken - dt * 0.5);
    B.punch = Math.max(0, (B.punch || 0) - dt * 1.6);
    for (const m of B.mist) { m.x += m.vx * dt; if (m.x - m.r > W) m.x = -m.r; }
  }
  const later = (t, fn) => B.timers.push({ t, fn });
  /* 카메라 펀치: 큰 순간에 화면이 살짝 당겨졌다 돌아온다 */
  function zoomNow() { return VS * (B.zoom || 1) * (1 + 0.16 * easeOut(Math.min(1, B.punch || 0))); }
  function punch(k, x, y, hold = 0.9) {
    B.punch = Math.max(B.punch || 0, k);
    if (x != null) B.focus = { x, y, t: hold };
  }

  function tick(u, dt) {
    u.atkT -= dt;
    u.flash = Math.max(0, u.flash - dt);
    u.swing = Math.max(0, u.swing - dt);
    for (const s of u.skills) s.t -= dt * (1 + (u.cdr || 0) / 100);
    if (u.stun > 0) u.stun -= dt;
    if (u.fear > 0) u.fear -= dt;
    if (u.slowT > 0) u.slowT -= dt;
    if (u.invuln > 0) u.invuln -= dt;
    if (u.pounce > 0) u.pounce -= dt;
    if (u.buffT > 0) { u.buffT -= dt; if (u.buffT <= 0) { u.buffAtk = 0; u.buffDef = 0; } }
    if (u.burnT > 0) {
      u.burnT -= dt; u.burnTick -= dt;
      if (u.burnTick <= 0) { u.burnTick = 0.5; hit(u.burnSrc, u, u.burnD * 0.5, { pure: true, color: '#ffae5c', quiet: u.kind !== 'hero' }); }
      if (Math.random() < dt * 12) spark(u.x + rand(-5, 5), u.y - 4, '#ff8a3c', 1);
    }
    if (u.orbit > 0) {
      u.orbit -= dt; u.orbitA += dt * 9; u.orbitTick -= dt;
      if (u.orbitTick <= 0) {
        u.orbitTick = 0.22;
        for (const o of foesNear(u, u.x, u.y, 60)) hit(u, o, u.atk * 0.5, { quiet: o.kind !== 'hero' });
      }
    }
    if (u.ttl > 0) {
      u.ttl -= dt;
      if (u.ttl <= 0) { u.alive = false; burst(u.x, u.y, 14, u.color, 90, 3, 0.6, true); }
    }
  }

  /* ---------- 판단 ---------- */
  function setVel(u, dx, dy, mul = 1) {
    const d = Math.hypot(dx, dy) || 1;
    const sp = u.spd * mul * (u.slowT > 0 ? 0.5 : 1);
    u.vx = (dx / d) * sp; u.vy = (dy / d) * sp;
  }
  function moveTo(u, x, y, mul = 1) {
    const dx = x - u.x, dy = y - u.y;
    if (dx * dx + dy * dy < 25) { u.vx = u.vy = 0; return true; }
    setVel(u, dx, dy, mul);
    return false;
  }
  function stopU(u) { u.vx = u.vy = 0; }

  function engage(u, t) {
    const d = dist(u, t) - u.r - t.r;
    if (d > u.range) { moveTo(u, t.x, t.y); return; }
    stopU(u);
    u.face = Math.atan2(t.y - u.y, t.x - u.x);
    if (u.atkT <= 0) { attack(u, t); u.atkT = u.atkCd * (0.9 + Math.random() * 0.2); }
  }

  const TYPE_MULT = {
    melee: { cavalry: 1.6 }, cavalry: { archer: 1.7, melee: 0.85 }, archer: { melee: 1.15, cavalry: 0.8 },
  };
  function utype(u) { return u.kind === 'soldier' ? u.stype : u.ranged ? 'archer' : 'hero'; }
  function attackMult(u, t) {
    let m = (TYPE_MULT[utype(u)] || {})[utype(t)] || 1;
    if (!u.ranged) {
      const dx = u.x - t.x, dy = u.y - t.y, d = Math.hypot(dx, dy) || 1;
      const dot = (Math.cos(t.face) * dx + Math.sin(t.face) * dy) / d;
      let fl = dot < -0.45 ? 1.5 : dot < 0.45 ? 1.25 : 1;
      if (fl > 1) fl = 1 + (fl - 1) * fmodU(u, 'flank');
      m *= fl;
      if (fl >= 1.4 && t.sq) t.sq.morale = Math.max(0, t.sq.morale - 0.12 * fmodU(t, 'moraleLoss'));
      if (fl > 1 && u.kind === 'hero' && Math.random() < 0.25) floatText(t.x, t.y - 34, fl >= 1.4 ? '배후!' : '측면!', '#ffcf7a', 13);
    } else m *= fmodU(u, 'ranged');
    if (B.t < 20) m *= fmodU(u, 'openAtk');
    return m;
  }
  function attack(u, t) {
    const atk = u.atk * (1 + u.buffAtk) * (u.sq && u.kind === 'soldier' ? 0.8 + u.sq.morale / 250 : 1) * attackMult(u, t);
    if (u.ranged) {
      const d = Math.hypot(t.x - u.x, t.y - u.y);
      if (u.kind === 'hero' || Math.random() < 0.12) Sfx.play('arrow');
      B.proj.push({ type: 'arrow', x: u.x, y: u.y - 4, sx: u.x, sy: u.y, t, lx: t.x, ly: t.y, sp: 420, dmg: atk, src: u, team: u.team, life: 2.4, a: u.face, total: Math.max(30, d), delay: u.kind === 'soldier' ? Math.random() * 0.25 : 0 });
    } else {
      u.swing = 0.2;
      if (!B.clashed) firstClash(u, t);
      Sfx.play('clash', u.kind === 'hero');
      hit(u, t, atk, { quiet: t.kind !== 'hero' && u.kind !== 'hero' });
      if (u.kind === 'hero' || u.summon === 'tiger') {
        slashFx(t.x, t.y - 8, u.face, u.color, u.kind === 'hero' ? 20 : 24);
        spark(t.x, t.y - 6, u.color, 5);
        for (let i = 0; i < 3; i++) B.parts.push({ x: t.x, y: t.y - 6, vx: Math.cos(u.face) * rand(40, 120) + rand(-30, 30), vy: rand(-60, 10), grav: 260, life: 0.45, max: 0.45, size: rand(1.5, 3), color: 'rgba(20,10,10,0.85)' });
      }
    }
  }

  /* 두 군대가 처음 맞부딪히는 순간: 잠깐 멈추고 크게 흔든다 */
  function firstClash(u, t) {
    B.clashed = true;
    const x = (u.x + t.x) / 2, y = (u.y + t.y) / 2;
    B.slowT = Math.max(B.slowT, 0.32);
    B.shake = Math.max(B.shake, 9);
    punch(0.7, x, y, 0.7);
    for (let i = 0; i < 40; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(60, 220);
      B.parts.push({ x: x + rand(-40, 40), y: y + rand(-20, 20), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.5, life: rand(0.5, 1.1), max: 1.1, size: rand(4, 9), color: 'rgba(120,104,82,0.45)', drag: 2.5 });
    }
    ring(x, y, 10, 160, 0.6, 'rgba(243,227,184,0.7)', 4);
    floatText(x, y - 40, '격돌!', '#ffe08a', 52, true);
    Sfx.play('impact');
  }

  function think(u, dt) {
    if (u.dash) { dashStep(u, dt); return; }
    if (u.stun > 0) { stopU(u); return; }
    if (u.fear > 0) { setVel(u, u.x - u.fearX, u.y - u.fearY, 0.85); return; }
    if (u.rout) {
      setVel(u, u.team === 1 ? 1 : -1, rand(-0.3, 0.3), 1.15);
      if (u.x > W - 6 || u.x < 6) { u.alive = false; u.fled = true; }
      return;
    }
    if (u === B.ctrl && !B.autoCtrl) {
      if (keyVec() || B.attackTarget || (B.moveTo && B.order !== 'form')) { ctrlThink(u); return; }
      if (B.order !== 'form') { ctrlThink(u); return; }
    }
    if (u.kind === 'hero' || u.captain) {
      if (u.team === 0) allyThink(u); else enemyThink(u);
      u.aiT = (u.aiT || 0) - dt;
      if (u.aiT <= 0) { u.aiT = 0.2; aiSkills(u); }
      return;
    }
    if (u.kind === 'soldier') { soldierThink(u, dt); return; }
    summonThink(u);
  }

  function keyVec() {
    let x = 0, y = 0;
    if (keys.KeyW || keys.ArrowUp) y -= 1;
    if (keys.KeyS || keys.ArrowDown) y += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1;
    if (keys.KeyD || keys.ArrowRight) x += 1;
    return x || y ? { x, y } : null;
  }

  function ctrlThink(u) {
    const kv = keyVec();
    if (kv) { B.moveTo = null; B.attackTarget = null; setVel(u, kv.x, kv.y); u.face = Math.atan2(kv.y, kv.x); return; }
    if (B.attackTarget && B.attackTarget.alive) { engage(u, B.attackTarget); return; }
    B.attackTarget = null;
    if (B.moveTo) { if (moveTo(u, B.moveTo.x, B.moveTo.y)) B.moveTo = null; return; }
    const t = nearestFoe(u, u.range + 70);
    if (t) engage(u, t); else stopU(u);
  }

  const FORM = Array.from({ length: 12 }, (_, i) => { const row = Math.floor(i / 3), col = i % 3; return [-70 - row * 60, (col - 1) * 78 + (row % 2) * 24]; });
  function captureAllyForm() {
    const hs = B.units.filter((u) => u.team === 0 && (u.kind === 'hero' || u.captain) && u.alive);
    if (!hs.length) { B.formCx = 380; B.formCy = H / 2; return; }
    const cx = hs.reduce((a, u) => a + u.x, 0) / hs.length;
    const cy = hs.reduce((a, u) => a + u.y, 0) / hs.length;
    B.formCx = cx; B.formCy = cy;
    hs.forEach((u) => { u.formHx = u.x - cx; u.formHy = u.y - cy; });
  }
  function formOrigin() {
    const c = B.ctrl && B.ctrl.alive ? B.ctrl : null;
    if (c && !B.autoCtrl && keyVec()) return { x: c.x - (c.formHx || 0), y: c.y - (c.formHy || 0) };
    if (B.moveTo) return { x: B.moveTo.x, y: B.moveTo.y };
    const lead = c || B.units.find((u) => u.team === 0 && (u.kind === 'hero' || u.captain) && u.alive);
    const t = lead ? nearestFoe(lead, 99999) : null;
    if (t) return { x: t.x - 200, y: B.formCy != null ? B.formCy : H / 2 };
    return { x: B.formCx != null ? B.formCx : 380, y: B.formCy != null ? B.formCy : H / 2 };
  }
  function allyThink(u) {
    const o = u === B.ctrl && B.order === 'follow' ? 'charge' : B.order;
    if (o === 'retreat') {
      const t = nearestFoe(u, u.r + u.range + 4);
      if (t && Math.random() < 0.02) engage(u, t);
      else moveTo(u, 90, clamp(u.y, 120, H - 120));
      return;
    }
    if (o === 'hold') {
      const hp = B.holdPos[u.id] || (B.holdPos[u.id] = { x: u.x, y: u.y });
      const t = nearestFoe(u, Math.max(u.range + 40, 170));
      if (t) engage(u, t); else moveTo(u, hp.x, hp.y);
      return;
    }
    if (o === 'form') {
      const origin = formOrigin();
      const ax = origin.x + (u.formHx || 0), ay = origin.y + (u.formHy || 0);
      const t = nearestFoe(u, Math.max(u.range + 40, 120));
      if (t && dist(u, t) < u.range + 28) engage(u, t);
      else if (Math.hypot(ax - u.x, ay - u.y) > 18) marchTo(u, ax, ay);
      else stopU(u);
      return;
    }
    if (o === 'skirmish' || o === 'charge' || !B.ctrl || !B.ctrl.alive) {
      const t = nearestFoe(u, 99999);
      if (t) { if (dist(u, t) > (o === 'skirmish' ? 90 : 260)) marchTo(u, t.x, t.y); else engage(u, t); } else stopU(u);
      return;
    }
    const c = B.ctrl;
    const idx = B.units.filter((x) => x.team === 0 && x.kind === 'hero' && x !== c && x.alive).indexOf(u);
    const f = FORM[Math.max(0, idx) % FORM.length];
    const ax = c.x + f[0], ay = c.y + f[1];
    const t = nearestFoe(u, 230);
    if (t && dist(t, c) < 340) engage(u, t);
    else if (Math.hypot(ax - u.x, ay - u.y) > 26) moveTo(u, ax, ay);
    else stopU(u);
  }

  /* 병사 걸음에 맞춰 전진: 부대가 함께 부딪히도록 */
  function marchTo(u, x, y) {
    const lagging = B.units.some((o) => o.leader === u && o.alive && !o.rout && dist(o, u) > 90);
    moveTo(u, x, y, lagging ? 0.55 : Math.min(1, 96 / u.spd));
  }
  function enemyTemper(u) {
    const src = (u.leader && u.leader.alive) ? u.leader : u;
    const id = src.hid;
    if (['gaesomun', 'gyeonhwon', 'gyebaek', 'gwanggaeto', 'gildong'].includes(id)) return 'rush';
    if (['yusin', 'sunsin'].includes(id)) return 'form';
    if (['eulji', 'sejong', 'heojun', 'gamchan'].includes(id)) return 'hold';
    const fac = src.faction || (B.cfg.enemy && B.cfg.enemy.faction);
    if (fac === 'goguryeo' || fac === 'baekje') return 'rush';
    if (fac === 'silla') return 'form';
    if (fac === 'sea') return 'skirmish';
    return 'hold';
  }
  function enemyThink(u) {
    const attackerSide = B.cfg.type === 'defend';
    const home = u.home || (u.home = { x: u.x, y: u.y });
    if (B.cfg.enemy.surprised && B.t < (B.cfg.enemy.surpriseT || 5)) { const n = nearestFoe(u, 100); if (n) engage(u, n); else stopU(u); return; }
    const temper = enemyTemper(u);
    if (attackerSide || temper === 'rush') {
      const t = nearestFoe(u, 99999);
      if (t) { if (dist(u, t) > 200) marchTo(u, t.x, t.y); else engage(u, t); } else stopU(u);
      return;
    }
    if (temper === 'hold') {
      const t = nearestFoe(u, 280, home) || nearestFoe(u, 220);
      if (t) engage(u, t); else moveTo(u, home.x, home.y);
      return;
    }
    if (temper === 'skirmish') {
      const t = nearestFoe(u, 99999);
      if (!t) { stopU(u); return; }
      if (dist(u, t) < 170) engage(u, t);
      else marchTo(u, (home.x + t.x) * 0.55, t.y);
      return;
    }
    const t = nearestFoe(u, 99999);
    if (!t) { stopU(u); return; }
    if (dist(u, t) < 210) engage(u, t);
    else marchTo(u, t.x + 210, home.y);
  }

  function soldierThink(u, dt) {
    const L = u.leader;
    const lok = L && L.alive;
    const ord = u.team === 0 ? B.order : 'charge';
    if (u.team === 0 && ord === 'retreat') { moveTo(u, 70, clamp(u.y, 100, H - 100)); return; }
    u.retT = (u.retT || 0) - dt;
    if (u.tgt && u.tgt.alive && !u.tgt.rout && u.retT > 0) { engage(u, u.tgt); return; }
    u.retT = 0.3 + Math.random() * 0.2;
    u.tgt = null;
    if (u.team === 0 && (ord === 'charge' || ord === 'skirmish')) {
      const chase = nearestFoe(u, 99999);
      if (chase) { u.tgt = chase; engage(u, chase); return; }
    }
    let t = nearestFoe(u, u.ranged ? u.range + 20 : 85);
    // 지휘관 곁을 크게 벗어나지 않는다 (궁수는 사거리 안에서)
    if (!t && lok) t = nearestFoe(u, ord === 'hold' ? 120 : u.ranged ? u.range + 40 : 170, L);
    if (!t && !lok) t = nearestFoe(u, 99999);
    if (t) { u.tgt = t; engage(u, t); return; }
    if (lok) {
      const ox = u.formOx, oy = u.formOy;
      let tx, ty;
      if (ox != null && oy != null) { tx = L.x + ox; ty = L.y + oy; }
      else {
        const a = ((u.slot % 10) / 10) * Math.PI * 2 + Math.floor(u.slot / 10) * 0.3;
        const rr = 32 + Math.floor(u.slot / 10) * 18;
        const back = u.team === 0 ? -1 : 1;
        tx = L.x + Math.cos(a) * rr + back * 18; ty = L.y + Math.sin(a) * rr;
      }
      if (Math.hypot(tx - u.x, ty - u.y) > 10) moveTo(u, tx, ty); else stopU(u);
    } else stopU(u);
  }

  function summonThink(u) {
    const t = nearestFoe(u, 99999);
    if (!t) { stopU(u); return; }
    if (u.summon === 'tiger' && u.pounce <= 0 && dist(u, t) > 90 && dist(u, t) < 380) {
      u.pounce = 1.6;
      const a = Math.atan2(t.y - u.y, t.x - u.x);
      u.dash = { vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, t: Math.min(0.45, dist(u, t) / 760), hit: new Set(), dmg: u.atk * 1.5, knock: 50 };
      return;
    }
    engage(u, t);
  }

  function dashStep(u, dt) {
    const d = u.dash;
    u.vx = d.vx; u.vy = d.vy; u.face = Math.atan2(d.vy, d.vx);
    d.t -= dt;
    for (const o of foesNear(u, u.x, u.y, u.r + 18)) {
      if (d.hit.has(o.id)) continue;
      d.hit.add(o.id);
      hit(u, o, d.dmg, { knock: d.knock || 70 });
    }
    if (Math.random() < 0.7) B.parts.push({ x: u.x, y: u.y + 6, vx: rand(-30, 30), vy: rand(-30, 0), life: 0.5, max: 0.5, size: rand(4, 9), color: 'rgba(150,130,100,0.35)' });
    if (Math.random() < 0.5) B.parts.push({ x: u.x, y: u.y, vx: 0, vy: 0, life: 0.25, max: 0.25, size: u.r, ring: u.color });
    if (d.t <= 0) u.dash = null;
  }

  /* ---------- 탐색 도구 ---------- */
  function nearestFoe(u, maxD, from = u) {
    let best = null, bd = maxD * maxD;
    const fx = from.x, fy = from.y, tm = u.team;
    if (grid && maxD <= 260) {
      const r = Math.ceil(maxD / CELL);
      const gx = clamp(Math.floor(fx / CELL), 0, GW - 1), gy = clamp(Math.floor(fy / CELL), 0, GH - 1);
      for (let yy = Math.max(0, gy - r); yy <= Math.min(GH - 1, gy + r); yy++) for (let xx = Math.max(0, gx - r); xx <= Math.min(GW - 1, gx + r); xx++) for (const o of grid[yy * GW + xx]) {
        if (!o.alive || o.team === tm || o.rout) continue;
        const dx = o.x - fx, dy = o.y - fy, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    }
    for (const o of B.units) {
      if (!o.alive || o.team === tm || o.rout) continue;
      const dx = o.x - fx, dy = o.y - fy, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }
  function foes(u) { return B.units.filter((o) => o.alive && o.team !== u.team && !o.rout); }
  function friends(u) { return B.units.filter((o) => o.alive && o.team === u.team); }
  function foesNear(u, x, y, r) { return B.units.filter((o) => o.alive && o.team !== u.team && Math.hypot(o.x - x, o.y - y) < r + o.r); }
  function nearestN(u, n, maxD) {
    return foes(u).map((o) => [dist(u, o), o]).filter((a) => a[0] < maxD).sort((a, b) => a[0] - b[0]).slice(0, n).map((a) => a[1]);
  }
  function densest(u, maxD, r = 100) {
    const fs = foes(u).filter((o) => dist(u, o) < maxD);
    if (!fs.length) return null;
    let best = fs[0], bc = -1;
    for (const a of fs) {
      let c = 0;
      for (const b of fs) if (Math.hypot(a.x - b.x, a.y - b.y) < r) c += b.kind === 'hero' ? 3 : 1;
      if (c > bc) { bc = c; best = a; }
    }
    return { x: best.x, y: best.y, n: bc, u: best };
  }

  /* ---------- 피해 ---------- */
  function hit(src, t, amt, o = {}) {
    if (!t || !t.alive || t.invuln > 0) return 0;
    let d = o.pure ? amt : (amt * 40) / (40 + t.def * (1 + t.buffDef));
    d *= (0.9 + Math.random() * 0.2) * DMG_SCALE;
    let crit = false;
    if (!o.pure && src && src.kind === 'hero' && Math.random() < 0.08) { d *= 1.6; crit = true; Sfx.play('crit'); B.slowT = Math.max(B.slowT, 0.07); B.shake = Math.max(B.shake, 3); }
    t.hp -= d;
    t.flash = 0.12;
    if (o.stun) t.stun = Math.max(t.stun, t.boss ? o.stun * 0.5 : o.stun);
    if (o.slow) t.slowT = Math.max(t.slowT, o.slow);
    if (o.knock) knock(t, o.kx != null ? o.kx : src ? src.x : t.x - 1, o.ky != null ? o.ky : src ? src.y : t.y, o.knock);
    if (o.burn) { t.burnT = o.burn; t.burnD = o.burnD || amt * 0.25; t.burnSrc = src; }
    if (!o.quiet && (t.kind === 'hero' || d >= 25 || crit)) {
      const col = o.color || (t.team === 0 ? '#ff8f7a' : crit ? '#ffe08a' : '#f3ead6');
      floatText(t.x + rand(-6, 6), t.y - t.r - 8, Math.round(d) + (crit ? '!' : ''), col, crit ? 17 : t.kind === 'hero' ? 14 : 12);
    }
    if (t.hp <= 0) kill(t, src);
    return d;
  }

  function knock(t, fx, fy, power) {
    const m = t.boss ? 0.25 : t.kind === 'hero' ? 0.5 : t.kind === 'summon' ? 0.4 : 1;
    let dx = t.x - fx, dy = t.y - fy;
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    t.x = clamp(t.x + dx * power * m, 20, W - 20);
    t.y = clamp(t.y + dy * power * m, 20, H - 20);
  }

  function ownerOf(src) {
    if (!src) return null;
    if (src.kind === 'hero') return src;
    return src.owner || src.leader || null;
  }

  function stain(x, y, r, col) {
    const g = B.ground.getContext('2d');
    g.globalAlpha = 0.22;
    g.fillStyle = col;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(x + rand(-r, r) * 0.6, y + rand(-r, r) * 0.3 + 4, r * rand(0.4, 1), r * rand(0.2, 0.45), rand(0, 3), 0, Math.PI * 2); g.fill(); }
    g.globalAlpha = 1;
  }
  function kill(t, src) {
    t.hp = 0;
    t.alive = false;
    stain(t.x, t.y, t.kind === 'hero' ? 16 : 8, t.kind === 'hero' ? '#2a0806' : t.team === 0 ? '#0c2830' : '#200a08');
    const ow = ownerOf(src);
    if (ow && ow.team === 0 && ow.hid && B.exp[ow.hid] != null) B.exp[ow.hid] += t.kind === 'hero' ? 50 : 6;
    if (t.kind === 'hero') {
      t.down = true;
      B.parts.push({ x: t.x, y: t.y - 10, vx: 0, vy: -38, life: 1.6, max: 1.6, size: 20, glyph: t.glyph, color: t.color, glow: true });
      burst(t.x, t.y, 26, t.color, 140, 3, 0.9, true);
      floatText(t.x, t.y - 34, t.team === 0 ? '퇴각' : '격파', t.team === 0 ? '#ff8f7a' : '#ffe08a', 18, true);
      if (t.team === 1 && t.recruit) B.captured.push(t.hid);
      if (t === B.ctrl) switchCtrl();
      B.shake = Math.max(B.shake, t.boss ? 12 : 6);
      B.slowT = Math.max(B.slowT, t.boss ? 0.9 : 0.35);
      punch(t.boss ? 1 : 0.55, t.x, t.y, t.boss ? 1.4 : 0.8);
      if (t.boss) { B.flash = Math.max(B.flash, 0.7); ring(t.x, t.y, 10, 260, 0.9, t.color, 6); }
      Sfx.play('fall', !!t.boss);
    } else {
      burst(t.x, t.y, t.ghost ? 10 : 6, t.ghost ? '#b9c6d8' : '#5b4a3c', 70, 2.4, 0.5, t.ghost);
    }
    if (t.team === 0 && t.kind === 'soldier') B.lost++;
    if (t.sq) {
      const sq = t.sq;
      if (t.kind === 'soldier' && !t.captain) sq.morale = Math.max(0, sq.morale - (24 / Math.max(10, sq.size || 20)) * fmodU(sq.leader || t, 'moraleLoss'));
      if (t === sq.leader) {
        sq.morale = Math.max(0, sq.morale - 22 * fmodU(sq.leader || t, 'moraleLoss'));
        B.squads.forEach((o) => {
          if (o === sq) return;
          if (o.team === t.team) o.morale = Math.max(0, o.morale - 5);
          else o.morale = Math.min(100, o.morale + 6);
        });
        later(0.4, () => resolveSquad(sq));
      }
    }
    if (t.team === 1 && t.kind !== 'summon') B.kills++;
  }

  function switchCtrl() {
    const n = B.units.find((u) => u.team === 0 && u.kind === 'hero' && u.alive) || B.units.find((u) => u.team === 0 && u.captain && u.alive);
    if (n) { B.ctrl = n; B.attackTarget = null; B.moveTo = null; }
  }

  /* ---------- 물리 ---------- */
  const CELL = 48, GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
  let grid = null;
  function gridInit() { grid = Array.from({ length: GW * GH }, () => []); }
  function gridBuild() {
    if (!grid) gridInit();
    for (const c of grid) c.length = 0;
    for (const u of B.units) {
      if (!u.alive) continue;
      const gx = clamp(Math.floor(u.x / CELL), 0, GW - 1), gy = clamp(Math.floor(u.y / CELL), 0, GH - 1);
      grid[gy * GW + gx].push(u);
    }
  }
  function physics(dt) {
    const us = B.units.filter((u) => u.alive);
    for (const a of us) {
      const gx = clamp(Math.floor(a.x / CELL), 0, GW - 1), gy = clamp(Math.floor(a.y / CELL), 0, GH - 1);
      for (let yy = Math.max(0, gy - 1); yy <= Math.min(GH - 1, gy + 1); yy++) for (let xx = Math.max(0, gx - 1); xx <= Math.min(GW - 1, gx + 1); xx++) for (const b of grid[yy * GW + xx]) {
        if (b.id <= a.id || !b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const min = a.r + b.r;
        if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
        const d = Math.hypot(dx, dy);
        if (d >= min || d < 0.001) continue;
        const ma = a.kind === 'soldier' ? 1 : 3, mb = b.kind === 'soldier' ? 1 : 3;
        const push = (min - d) * 0.5;
        const nx = dx / d, ny = dy / d;
        a.x -= nx * push * (mb / (ma + mb)) * 2 * 0.6; a.y -= ny * push * (mb / (ma + mb)) * 2 * 0.6;
        b.x += nx * push * (ma / (ma + mb)) * 2 * 0.6; b.y += ny * push * (ma / (ma + mb)) * 2 * 0.6;
      }
    }
    for (const u of us) {
      u.x = clamp(u.x + u.vx * dt, 16, W - 16);
      u.y = clamp(u.y + u.vy * dt, 16, H - 16);
      if ((u.vx || u.vy) && !u.dash && u.stun <= 0) {
        const tgtFace = Math.atan2(u.vy, u.vx);
        if (u.atkT > u.atkCd * 0.6 || u.kind !== 'hero') u.face = tgtFace;
      }
    }
  }

  function camera(dt) {
    let tx, ty;
    if (B.ctrl && B.ctrl.alive) { tx = B.ctrl.x + 60; ty = B.ctrl.y; }
    else {
      const p = B.units.filter((u) => u.team === 0 && u.alive);
      if (!p.length) return;
      tx = p.reduce((a, u) => a + u.x, 0) / p.length; ty = p.reduce((a, u) => a + u.y, 0) / p.length;
    }
    if (B.focus && B.focus.t > 0) { B.focus.t -= dt; tx = tx * 0.35 + B.focus.x * 0.65; ty = ty * 0.35 + B.focus.y * 0.65; }
    const k = 1 - Math.exp(-dt * 4);
    B.cam.x += (tx - B.cam.x) * k;
    B.cam.y += (ty - B.cam.y) * k;
    const Z = zoomNow();
    const hw = vw / (2 * Z), hh = vh / (2 * Z);
    B.cam.x = hw * 2 >= W ? W / 2 : clamp(B.cam.x, hw, W - hw);
    B.cam.y = hh * 2 >= H ? H / 2 : clamp(B.cam.y, hh, H - hh);
  }

  /* ---------- 투사체 ---------- */
  function updProj(dt) {
    for (const p of B.proj) {
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.life -= dt;
      if (p.type === 'arrow' || p.type === 'orb') {
        if (p.t.alive && p.type === 'orb') { p.lx = p.t.x; p.ly = p.t.y; }
        const dx = p.lx - p.x, dy = p.ly - p.y, d = Math.hypot(dx, dy), stepD = p.sp * dt;
        p.a = Math.atan2(dy, dx);
        if (d <= stepD + 6) {
          if (p.type === 'orb') { if (p.t.alive) { hit(p.src, p.t, p.dmg, { burn: 3, burnD: p.dmg * 0.3 }); burst(p.lx, p.ly, 12, p.color, 120, 3, 0.45, true); } }
          else {
            // 곡사: 떨어진 자리 근처의 적이 맞는다
            let tg = p.t.alive && Math.hypot(p.t.x - p.lx, p.t.y - p.ly) < 22 ? p.t : null;
            if (!tg) { const f = B.units.find((o) => o.alive && o.team !== p.team && Math.hypot(o.x - p.lx, o.y - p.ly) < o.r + 8); tg = f || null; }
            if (tg) hit(p.src, tg, p.dmg, { quiet: tg.kind !== 'hero' });
            else if (Math.random() < 0.3) B.parts.push({ x: p.lx, y: p.ly, vx: 0, vy: -10, life: 0.4, max: 0.4, size: 2, color: 'rgba(120,105,80,0.5)' });
          }
          p.dead = true;
        } else {
          p.x += (dx / d) * stepD; p.y += (dy / d) * stepD;
          if (p.type === 'orb' && Math.random() < 0.8) B.parts.push({ x: p.x, y: p.y, vx: rand(-15, 15), vy: rand(-25, 0), life: 0.35, max: 0.35, size: rand(2, 5), color: p.color, glow: true });
        }
      } else if (p.type === 'cres') {
        const stepD = p.sp * dt;
        p.x += Math.cos(p.a) * stepD; p.y += Math.sin(p.a) * stepD; p.trav += stepD;
        for (const o of foesNear(p.src, p.x, p.y, p.size)) {
          if (p.hit.has(o.id)) continue;
          p.hit.add(o.id);
          hit(p.src, o, p.dmg, { knock: 26 });
          spark(o.x, o.y, p.color, 6);
        }
        if (Math.random() < 0.9) B.parts.push({ x: p.x + rand(-p.size, p.size) * 0.4, y: p.y + rand(-p.size, p.size) * 0.4, vx: 0, vy: 0, life: 0.3, max: 0.3, size: rand(2, 4), color: p.color, glow: true });
        if (p.trav > p.range) p.dead = true;
      }
      if (p.life <= 0) p.dead = true;
    }
    B.proj = B.proj.filter((p) => !p.dead);
  }

  /* ---------- 입자, 글자 ---------- */
  function updParts(dt) {
    for (const p of B.parts) {
      p.life -= dt;
      p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      if (p.grav) p.vy += p.grav * dt;
      if (p.drag) { p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt; }
      if (p.vr) p.rot = (p.rot || 0) + p.vr * dt;
    }
    B.parts = B.parts.filter((p) => p.life > 0);
    if (B.parts.length > 1400) B.parts.splice(0, B.parts.length - 1400);
    for (const t of B.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 1 - 2 * dt; }
    B.texts = B.texts.filter((t) => t.life > 0);
  }
  function burst(x, y, n, color, sp, size, life, glow) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(sp * 0.3, sp);
      B.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.5, life), max: life, size: rand(size * 0.5, size), color, glow, drag: 3 });
    }
  }
  function spark(x, y, color, n) { burst(x, y, n, color, 90, 2.5, 0.35, true); }
  function floatText(x, y, txt, color, size, brush) {
    B.texts.push({ x, y, txt: String(txt), color, size, life: brush ? 1.3 : 0.8, max: brush ? 1.3 : 0.8, vy: brush ? -26 : -46, brush });
  }
  function label(u, text) { floatText(u.x, u.y - u.r - 26, text, u.color, 30, true); }
  function ring(x, y, r0, r1, dur, color, width = 3, layer = 'top') {
    B.fx.push({ t: 0, dur, layer, draw(c, f) {
      const k = f.t / f.dur;
      c.globalAlpha = 1 - k; c.strokeStyle = color; c.lineWidth = width * (1 - k * 0.5);
      c.beginPath(); c.arc(x, y, r0 + (r1 - r0) * easeOut(k), 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
    } });
  }
  function glyphFx(x, y, g, color, size, dur, rise = 30) {
    const fxName = (g === '藥' || g === '回生') ? 'heal' : (g === '虎' || g === '白虎') ? 'tiger' : (g === '縛') ? 'rope' : 'hangul';
    B.fx.push({ t: 0, dur, layer: 'top', draw(c, f) {
      const k = f.t / f.dur;
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
      const yy = y - k * rise;
      const sz = size * (1.8 + k * 0.4);
      if (!Art.blitFx(c, fxName, x, yy, sz, sz, 0, 1, a)) {
        c.globalAlpha = a;
        c.font = `900 ${size * (0.9 + k * 0.2)}px ${FONT_GLYPH}`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = color; c.shadowBlur = 24; c.fillStyle = color;
        c.fillText(g, x, yy);
        c.shadowBlur = 0; c.globalAlpha = 1;
      }
    } });
  }
  function slashFx(x, y, a, color, r) {
    B.fx.push({ t: 0, dur: 0.22, layer: 'top', draw(c, f) {
      const k = f.t / f.dur;
      if (!Art.blitFx(c, 'slash', x, y, r * 2.2, r * 2.2, a, 1, 1 - k)) {
        c.globalAlpha = 1 - k; c.strokeStyle = color; c.lineWidth = 3 * (1 - k) + 1;
        c.beginPath(); c.arc(x - Math.cos(a) * 6, y - Math.sin(a) * 6, r, a - 1.1 + k * 0.6, a + 0.4 + k * 0.6); c.stroke();
        c.globalAlpha = 1;
      }
    } });
  }
  const easeOut = (k) => 1 - Math.pow(1 - k, 3);

  /* ---------- 스킬 시전 ---------- */
  function aiSkills(u) {
    for (const s of u.skills) {
      if (s.t > 0) continue;
      if (s.hidden && !u.hiddenOn) continue;
      const meta = SKILLS[s.id];
      if (!meta) continue;
      let ok = false;
      if (meta.ai === 'target') ok = !!nearestFoe(u, 300);
      else if (meta.ai === 'aoe') { const d = densest(u, 360, 110); ok = !!d && d.n >= 3; }
      else if (meta.ai === 'global') ok = foes(u).filter((o) => o.kind !== 'summon').length >= 4 || foes(u).some((o) => o.kind === 'hero' && dist(u, o) < 520);
      else if (meta.ai === 'heal') ok = friends(u).some((o) => o.hp < o.maxHp * 0.6 && dist(u, o) < 230);
      else if (meta.ai === 'revive') ok = B.units.some((o) => o.team === u.team && o.kind === 'hero' && o.down) || friends(u).filter((o) => o.kind === 'hero' && o.hp < o.maxHp * 0.4).length >= 2;
      else if (meta.ai === 'buff') ok = !!nearestFoe(u, 200);
      if (ok && cast(u, s)) return true;
    }
    return false;
  }

  function cast(u, s) {
    const fn = SK[s.id];
    if (!fn || !u.alive || u.stun > 0) return false;
    const ok = fn(u);
    if (ok) {
      s.t = SKILLS[s.id].cd * 1.3;
      const big = s.hidden || u.boss;
      Sfx.play('skill', big);
      punch(big ? 1 : 0.4, u.x, u.y, big ? 1 : 0.5);
      if (s.hidden) cutin(u, SKILLS[s.id].name);
      else {
        label(u, SKILLS[s.id].name);
        // 보스 기술은 큰 컷인, 아군 영웅 기술은 짧은 띠 (너무 잦지 않게)
        if (u.boss && B.t > B.ciT.boss) { B.ciT.boss = B.t + 6; cutin(u, SKILLS[s.id].name); }
        else if (u.team === 0 && u.kind === 'hero' && B.t > B.ciT.mini) { B.ciT.mini = B.t + 3; cutin(u, SKILLS[s.id].name, true); }
      }
    }
    return ok;
  }

  function manualCast(u, k) {
    if (!B || B.over || !u || !u.alive) return;
    const s = u.skills[k];
    if (!s) return;
    if (s.hidden && !u.hiddenOn) {
      floatText(u.x, u.y - 40, '고유 무기가 필요하다', '#c9bfa8', 14);
      return;
    }
    if (s.t > 0) { floatText(u.x, u.y - 40, '준비 중', '#c9bfa8', 13); return; }
    if (u.stun > 0) return;
    if (!cast(u, s)) floatText(u.x, u.y - 40, '대상이 없다', '#c9bfa8', 13);
  }

  const ciQ = [];
  let ciOn = false;
  function cutin(u, name, mini) {
    if (B.ffwd) return;
    ciQ.push({ u, name, mini });
    pumpCutin();
  }
  function pumpCutin() {
    if (ciOn || !ciQ.length || !B) return;
    const job = ciQ.shift();
    ciOn = true;
    const u = job.u, name = job.name, mini = job.mini;
    if (mini) { B.darken = Math.max(B.darken, 0.35); B.slowT = Math.max(B.slowT, 0.25); }
    else { B.slowT = 0.85; B.flash = 0.6; B.darken = Math.max(B.darken, 0.6); }
    const el = $('#cutin');
    const d = document.createElement('div');
    d.className = 'ci' + (u.team === 1 ? ' foe' : '') + (mini ? ' mini' : '');
    d.style.setProperty('--c', u.color);
    const face = u.hid ? `<img class="ci-face" src="${portraitSrc(u.hid)}" alt="">` : `<div class="ci-glyph">${esc(u.glyph)}</div>`;
    d.innerHTML = `<div class="ci-band">${face}<div class="ci-text"><span class="ci-hero">${esc(u.name)}</span><span class="ci-skill">${esc(name)}</span></div></div>`;
    el.appendChild(d);
    setTimeout(() => { d.remove(); ciOn = false; pumpCutin(); }, mini ? 1000 : 1500);
  }

  const HANGUL = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ';
  const SEOMUN = '나랏말싸미듕귁에달아문자와로서르사맛디아니할쎄';

  const SK = {
    honbul(u) { return orbs(u, 3, u.sp * 1.1, '#7fd3e6'); },
    ghostfire(u) { return orbs(u, 2, u.sp * 0.9, '#9fb6ff'); },

    orat(u) {
      const fs = foes(u).filter((o) => dist(u, o) < 330);
      if (!fs.length) return false;
      const t = fs.find((o) => o.kind === 'hero') || fs.sort((a, b) => dist(u, a) - dist(u, b))[0];
      hit(u, t, u.sp * 1.0, { stun: 3 });
      const sx = t.x, sy = t.y, ex = u.x + (t.x - u.x) * 0.3, ey = u.y + (t.y - u.y) * 0.3;
      if (!t.boss) B.fx.push({ t: 0, dur: 0.3, upd(dt, f) { const k = f.t / f.dur; t.x = sx + (ex - sx) * k; t.y = sy + (ey - sy) * k; } });
      B.fx.push({ t: 0, dur: 0.9, layer: 'top', draw(c, f) {
        const k = f.t / f.dur;
        const mx = (u.x + t.x) / 2, my = (u.y + t.y) / 2;
        const ang = Math.atan2(t.y - u.y, t.x - u.x);
        const len = dist(u, t);
        Art.blitFx(c, 'rope', mx, my, Math.max(80, len), 28, ang, 1, 1 - k * k);
      } });
      glyphFx(t.x, t.y - 24, '縛', '#e0503c', 26, 1.1);
      return true;
    },

    jeokpae(u) {
      const fs = foes(u).filter((o) => dist(u, o) < 340);
      if (!fs.length) return false;
      fs.forEach((o) => { hit(u, o, u.sp * 0.6, { burn: 6, burnD: u.sp * 0.35, slow: 6, quiet: o.kind !== 'hero' }); glyphFx(o.x, o.y - 22, '赤', '#ff4a36', 16, 1.4, 16); });
      sealFx(u.x, u.y, 340, '#d23c2c', '冥');
      B.shake = Math.max(B.shake, 6); B.darken = 0.5;
      return true;
    },

    cheongcheon(u) { return wave(u, u.sp * 1.2, '#7cc6f2', 250); },
    tide(u) { return wave(u, u.sp * 1.0, '#6f8fd8', 220); },

    salsu(u) {
      const dir = u.team === 0 ? 1 : -1;
      const v = (W + 300) / 1.5;
      const hitSet = new Set();
      B.shake = Math.max(B.shake, 10);
      B.fx.push({ t: 0, dur: 1.9, layer: 'top', upd(dt, f) {
        const front = dir > 0 ? -150 + v * f.t : W + 150 - v * f.t;
        for (const o of foes(u)) {
          if (hitSet.has(o.id)) continue;
          if ((dir > 0 && o.x < front) || (dir < 0 && o.x > front)) {
            hitSet.add(o.id);
            hit(u, o, u.sp * 2.2, { stun: 1.6, knock: 70, kx: o.x - dir * 10, ky: o.y, quiet: o.kind !== 'hero' });
          }
        }
        for (let i = 0; i < 6; i++) B.parts.push({ x: front + rand(-20, 20) * dir, y: rand(0, H), vx: dir * rand(60, 260), vy: rand(-120, -20), grav: 260, life: 0.7, max: 0.7, size: rand(2, 5), color: '#dff4ff', glow: true });
        B.shake = Math.max(B.shake, 4);
      }, draw(c, f) {
        const front = dir > 0 ? -150 + v * f.t : W + 150 - v * f.t;
        const back = front - dir * 420;
        const g = c.createLinearGradient(back, 0, front, 0);
        g.addColorStop(0, 'rgba(40,110,170,0)'); g.addColorStop(0.7, 'rgba(60,140,200,0.45)'); g.addColorStop(1, 'rgba(200,236,255,0.85)');
        c.fillStyle = g;
        c.fillRect(Math.min(back, front), 0, Math.abs(front - back), H);
        c.strokeStyle = 'rgba(235,250,255,0.9)'; c.lineWidth = 6;
        c.beginPath();
        for (let y = 0; y <= H; y += 20) { const x = front + Math.sin(y * 0.04 + f.t * 14) * 14 * dir; if (y) c.lineTo(x, y); else c.moveTo(x, y); }
        c.stroke();
      } });
      return true;
    },

    hakik(u) {
      const d = densest(u, 580, 110);
      if (!d) return false;
      const a = Math.atan2(d.y - u.y, d.x - u.x), px = -Math.sin(a), py = Math.cos(a);
      for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
        const sx = u.x + px * side * (26 + i * 13) - Math.cos(a) * i * 7, sy = u.y + py * side * (26 + i * 13) - Math.sin(a) * i * 7;
        const tx = d.x + rand(-48, 48), ty = d.y + rand(-48, 48);
        const cx = (sx + tx) / 2 + px * side * 140, cy = (sy + ty) / 2 + py * side * 140;
        arcArrow(sx, sy, cx, cy, tx, ty, 0.12 + i * 0.035, 0.55, u.color, () => {
          for (const o of foesNear(u, tx, ty, 30)) hit(u, o, u.sp * 0.32, { quiet: o.kind !== 'hero' });
          spark(tx, ty, '#ffd9a0', 3);
        });
        B.parts.push({ x: sx, y: sy, vx: 0, vy: -8, life: 0.9, max: 0.9, size: 10, glyph: '弓', color: u.color, glow: true });
      }
      return true;
    },

    geobuk(u) {
      const dir = u.team === 0 ? 1 : -1;
      const d = densest(u, 3000, 150);
      const ship = { x: dir > 0 ? -170 : W + 170, y: d ? clamp(d.y, 120, H - 120) : u.y, dir, fireT: 0, hit: new Set() };
      B.shake = Math.max(B.shake, 8);
      B.fx.push({ t: 0, dur: 3.9, layer: 'top', upd(dt) {
        ship.x += dir * 520 * dt;
        ship.fireT -= dt;
        for (const o of foes(u)) {
          if (ship.hit.has(o.id)) continue;
          if (Math.abs(o.x - ship.x) < 78 && Math.abs(o.y - ship.y) < 44) { ship.hit.add(o.id); hit(u, o, u.sp * 1.6, { knock: 90, kx: o.x, ky: ship.y, quiet: o.kind !== 'hero' }); }
        }
        if (ship.fireT <= 0 && ship.x > -60 && ship.x < W + 60) {
          ship.fireT = 0.1;
          const cands = foes(u).filter((o) => Math.abs(o.x - ship.x) < 240 && Math.abs(o.y - ship.y) < 280);
          const t = cands.length ? pick(cands) : null;
          const side = t ? Math.sign(t.y - ship.y) || 1 : Math.random() < 0.5 ? -1 : 1;
          const ex = t ? t.x + rand(-14, 14) : ship.x + rand(-120, 120), ey = t ? t.y + rand(-14, 14) : ship.y + side * rand(80, 230);
          const sx = ship.x + rand(-50, 50), sy = ship.y + side * 26;
          for (let i = 0; i < 8; i++) B.parts.push({ x: sx, y: sy, vx: rand(-40, 40), vy: side * rand(40, 160), life: 0.25, max: 0.25, size: rand(3, 6), color: '#ffd27a', glow: true });
          cannonball(sx, sy, ex, ey, 0.32, () => {
            for (const o of foesNear(u, ex, ey, 56)) hit(u, o, u.sp * 0.85, { knock: 30, kx: ex, ky: ey, quiet: o.kind !== 'hero' });
            explosion(ex, ey, 56);
          });
        }
        const hx = ship.x + dir * 96, hy = ship.y;
        for (let i = 0; i < 5; i++) B.parts.push({ x: hx, y: hy, vx: dir * rand(180, 360), vy: rand(-50, 50), life: 0.45, max: 0.45, size: rand(4, 9), color: pick(['#ff6a2a', '#ffb347', '#ffd78a']), glow: true, drag: 2 });
        for (const o of foes(u)) {
          const fx = (o.x - hx) * dir;
          if (fx > 0 && fx < 150 && Math.abs(o.y - hy) < 40 && Math.random() < 0.08) hit(u, o, u.sp * 0.25, { burn: 3, burnD: u.sp * 0.25, quiet: true });
        }
        B.shake = Math.max(B.shake, 2.5);
      }, draw(c) { drawTurtle(c, ship, B.t); } });
      return true;
    },

    hunmin(u) {
      const fs = foes(u).filter((o) => dist(u, o) < 240);
      if (!fs.length) return false;
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2 + rand(-0.05, 0.05);
        B.parts.push({ x: u.x, y: u.y, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, life: 0.62, max: 0.62, size: 22, glyph: HANGUL[i % HANGUL.length], color: '#ffe08a', glow: true, vr: rand(-4, 4) });
      }
      ring(u.x, u.y, 10, 250, 0.6, '#ffe08a', 4);
      fs.forEach((o) => later(dist(u, o) / 400, () => {
        if (!o.alive) return;
        hit(u, o, u.sp * 0.85, { stun: 2 });
        B.parts.push({ x: o.x, y: o.y - 18, vx: 0, vy: -20, life: 0.8, max: 0.8, size: 16, glyph: pick(HANGUL), color: '#fff0b8', glow: true });
      }));
      return true;
    },

    banpo(u) {
      const fs = foes(u).filter((o) => o.kind !== 'summon');
      if (!fs.length) return false;
      B.darken = 0.7;
      B.fx.push({ t: 0, dur: 2.6, layer: 'screen', draw(c, f) {
        const k = f.t / f.dur;
        c.globalAlpha = Math.sin(k * Math.PI) * 0.16;
        c.fillStyle = '#ffe9a8';
        c.font = `900 ${Math.min(vw, vh) * 0.42}px ${FONT_GLYPH}`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('訓民正音', vw / 2, vh / 2);
        c.globalAlpha = 1;
      } });
      fs.forEach((o, i) => {
        const ch = SEOMUN[i % SEOMUN.length];
        const delay = 0.15 + Math.random() * 1.1;
        const ox = rand(-50, 50);
        B.fx.push({ t: -delay, dur: 0.5, layer: 'top', fired: false, upd(dt, f) {
          if (f.t >= 0.45 && !f.fired) {
            f.fired = true;
            if (o.alive) hit(u, o, u.sp * 1.4, { stun: 3.5, quiet: o.kind !== 'hero' });
            burst(o.x, o.y, 12, '#ffe08a', 140, 3, 0.5, true);
            for (let k = 0; k < 6; k++) B.parts.push({ x: o.x, y: o.y, vx: rand(-80, 80), vy: rand(-40, 20), life: 0.6, max: 0.6, size: rand(3, 6), color: 'rgba(20,16,12,0.7)' });
          }
        }, draw(c, f) {
          if (f.t < 0) return;
          const k = Math.min(1, f.t / 0.45);
          const x = o.x + ox * (1 - k), y = o.y - 340 * (1 - k * k);
          c.font = `900 ${38 - k * 8}px ${FONT_GLYPH}`;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.shadowColor = '#ffd36b'; c.shadowBlur = 22; c.fillStyle = '#fff4cc';
          c.fillText(ch, x, y);
          c.shadowBlur = 0;
        } });
      });
      B.shake = Math.max(B.shake, 6);
      return true;
    },

    gaema(u) {
      const d = densest(u, 440, 90);
      if (!d) return false;
      const a = Math.atan2(d.y - u.y, d.x - u.x);
      u.dash = { vx: Math.cos(a) * 820, vy: Math.sin(a) * 820, t: 0.38, hit: new Set(), dmg: u.atk * 2.0, knock: 70 };
      ring(u.x, u.y, 8, 50, 0.35, u.color, 3);
      return true;
    },

    musa(u) {
      const dir = u.team === 0 ? 1 : -1;
      const d = densest(u, 3000, 160);
      const cy = d ? d.y : H / 2;
      B.shake = Math.max(B.shake, 8);
      for (let i = 0; i < 8; i++) {
        const y = clamp(cy + (i - 3.5) * 48, 40, H - 40);
        const st = { x: dir > 0 ? -140 - i * 30 : W + 140 + i * 30, y, hit: new Set() };
        B.fx.push({ t: 0, dur: 3.4, layer: 'top', upd(dt) {
          st.x += dir * 640 * dt;
          for (const o of foesNear(u, st.x, st.y, 30)) {
            if (st.hit.has(o.id)) continue;
            st.hit.add(o.id);
            hit(u, o, u.atk * 2.0, { knock: 60, kx: st.x - dir * 20, ky: st.y, quiet: o.kind !== 'hero' });
          }
          if (Math.random() < 0.6) B.parts.push({ x: st.x - dir * 20, y: st.y + 10, vx: -dir * rand(20, 60), vy: rand(-20, 0), life: 0.5, max: 0.5, size: rand(5, 10), color: 'rgba(160,140,110,0.3)' });
        }, draw(c) { drawHorseman(c, st.x, st.y, dir, u.color, B.t + i); } });
      }
      return true;
    },

    hwasal(u) {
      const d = densest(u, 540, 110);
      if (!d) return false;
      const cx = d.x, cy = d.y;
      B.fx.push({ t: 0, dur: 2.3, layer: 'ground', draw(c, f) {
        c.globalAlpha = 0.35 * (1 - f.t / f.dur); c.strokeStyle = u.color; c.lineWidth = 2; c.setLineDash([6, 6]);
        c.beginPath(); c.arc(cx, cy, 100, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      } });
      for (let k = 0; k < 22; k++) later(k * 0.09, () => {
        for (let j = 0; j < 3; j++) {
          const tx = cx + rand(-95, 95), ty = cy + rand(-95, 95);
          arcArrow(tx - 110, ty - 260, tx - 50, ty - 160, tx, ty, 0, 0.3, '#e9dcc0', () => {
            for (const o of foesNear(u, tx, ty, 22)) hit(u, o, u.sp * 0.17, { quiet: o.kind !== 'hero' });
          });
        }
      });
      return true;
    },

    nakseong(u) {
      const fs = foes(u).filter((o) => o.kind !== 'summon');
      if (!fs.length) return false;
      const ts = fs.filter((o) => o.kind === 'hero');
      while (ts.length < 7) ts.push(pick(fs));
      B.darken = 0.9;
      for (let i = 0; i < 7; i++) later(0.2 + i * 0.32, () => {
        const t = ts[i];
        const tx = t.x + rand(-10, 10), ty = t.y + rand(-10, 10);
        B.fx.push({ t: 0, dur: 0.5, layer: 'top', done: false, upd(dt, f) {
          const k = f.t / f.dur;
          const x = tx - 280 * (1 - k), y = ty - 560 * (1 - k);
          for (let q = 0; q < 4; q++) B.parts.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-30, 30), vy: rand(-60, -10), life: 0.5, max: 0.5, size: rand(4, 10), color: pick(['#bfe0ff', '#ffffff', '#8cbcff']), glow: true });
          if (k > 0.96 && !f.done) {
            f.done = true;
            for (const o of foesNear(u, tx, ty, 72)) hit(u, o, u.sp * 2.0, { burn: 3, burnD: u.sp * 0.3, knock: 40, kx: tx, ky: ty, quiet: o.kind !== 'hero' });
            explosion(tx, ty, 80, '#bfe0ff');
            crater(tx, ty, 60);
            B.shake = Math.max(B.shake, 9);
          }
        }, draw(c, f) {
          const k = f.t / f.dur;
          const x = tx - 280 * (1 - k), y = ty - 560 * (1 - k);
          if (!Art.blitFx(c, 'meteor', x, y, 70, 110, 0.5, 1, 0.95)) {
            const g = c.createRadialGradient(x, y, 2, x, y, 26);
            g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, 'rgba(160,210,255,0.9)'); g.addColorStop(1, 'rgba(120,170,255,0)');
            c.fillStyle = g; c.beginPath(); c.arc(x, y, 26, 0, Math.PI * 2); c.fill();
          }
        } });
      });
      return true;
    },

    geomgi(u) {
      const t = nearestFoe(u, 440);
      if (!t) return false;
      const a = Math.atan2(t.y - u.y, t.x - u.x);
      B.proj.push({ type: 'cres', x: u.x, y: u.y, a, sp: 640, range: 470, dmg: u.atk * 1.7, src: u, team: u.team, size: 26, color: u.color, hit: new Set(), trav: 0, life: 2 });
      return true;
    },

    samhan(u) {
      const d = densest(u, 600, 120) || (nearestFoe(u, 700) && { x: nearestFoe(u, 700).x, y: nearestFoe(u, 700).y });
      if (!d) return false;
      const a = Math.atan2(d.y - u.y, d.x - u.x);
      [-0.32, 0, 0.32].forEach((da, i) => later(i * 0.12, () => {
        B.proj.push({ type: 'cres', x: u.x, y: u.y, a: a + da, sp: 720, range: 760, dmg: u.atk * 2.8, src: u, team: u.team, size: 48, color: u.color, hit: new Set(), trav: 0, life: 2, big: true });
        B.shake = Math.max(B.shake, 5);
      }));
      B.flash = 0.5;
      return true;
    },

    odo(u) {
      if (!nearestFoe(u, 170)) return false;
      u.orbit = 3; u.orbitTick = 0;
      return true;
    },

    bigeom(u) {
      const fs = foes(u).filter((o) => o.kind !== 'summon').sort((a, b) => (b.kind === 'hero') - (a.kind === 'hero') || dist(u, a) - dist(u, b)).slice(0, 5);
      if (!fs.length) return false;
      fs.forEach((t0, i) => {
        const sw = { x: u.x, y: u.y, t: t0, n: 0, cd: 0.25 + i * 0.08, a: 0, back: false };
        B.fx.push({ t: 0, dur: 3.2, layer: 'top', upd(dt, f) {
          if (sw.back) { const dx = u.x - sw.x, dy = u.y - sw.y; const dd = Math.hypot(dx, dy) || 1; sw.x += (dx / dd) * 700 * dt; sw.y += (dy / dd) * 700 * dt; sw.a = Math.atan2(dy, dx); if (dd < 20) f.t = f.dur; return; }
          if (!sw.t.alive) { const n = nearestFoe(u, 900, sw); if (n) sw.t = n; else { sw.back = true; return; } }
          const dx = sw.t.x - sw.x, dy = sw.t.y - sw.y, dd = Math.hypot(dx, dy) || 1;
          sw.a = Math.atan2(dy, dx) + Math.sin(f.t * 20) * 0.4;
          if (dd > 26) { sw.x += (dx / dd) * 760 * dt; sw.y += (dy / dd) * 760 * dt; }
          sw.cd -= dt;
          if (sw.cd <= 0 && dd < 40) {
            sw.cd = 0.3; sw.n++;
            hit(u, sw.t, u.atk * 1.2);
            slashFx(sw.t.x, sw.t.y, sw.a, '#ff5a5a', 22);
            if (sw.n >= 3) sw.back = true;
          }
          B.parts.push({ x: sw.x, y: sw.y, vx: 0, vy: 0, life: 0.2, max: 0.2, size: 3, color: '#ff8a8a', glow: true });
        }, draw(c) { drawSword(c, sw.x, sw.y, sw.a, '#ffdede', 18); } });
      });
      return true;
    },

    maengho(u) {
      const fs = foes(u).filter((o) => dist(u, o) < 215);
      if (!fs.length) return false;
      fs.forEach((o) => { hit(u, o, u.atk * 0.7, { quiet: o.kind !== 'hero' }); if (o.alive) { o.fear = o.boss ? 1.2 : 2.5; o.fearX = u.x; o.fearY = u.y; } });
      for (let i = 0; i < 3; i++) later(i * 0.1, () => ring(u.x, u.y, 14, 230, 0.55, '#ffb35c', 5));
      glyphFx(u.x, u.y - 40, '虎', '#ffb35c', 64, 1.2, 40);
      B.shake = Math.max(B.shake, 7);
      return true;
    },

    baekho(u) {
      const L = u.level || 5;
      const dir = u.team === 0 ? 1 : -1;
      const tg = mkUnit({ team: u.team, kind: 'summon', summon: 'tiger', owner: u, x: u.x + dir * 50, y: u.y, r: 18, maxHp: 520 + L * 30, hp: 520 + L * 30,
        atk: u.atk * 1.3, def: 20, spd: 210, atkCd: 0.7, range: 22, ttl: 8, color: '#eef4ff', face: dir > 0 ? 0 : Math.PI });
      B.units.push(tg);
      explosion(tg.x, tg.y, 70, '#cfe2ff');
      glyphFx(tg.x, tg.y - 50, '白虎', '#dfeaff', 40, 1.4, 30);
      B.shake = Math.max(B.shake, 6);
      return true;
    },

    donguibogam(u) {
      const fs = friends(u).filter((o) => dist(u, o) < 235);
      if (!fs.some((o) => o.hp < o.maxHp * 0.9 || o.stun > 0)) return false;
      fs.forEach((o) => {
        const add = Math.min(o.maxHp - o.hp, o.maxHp * 0.3);
        o.hp += add; o.stun = 0;
        if (o.kind === 'hero' && add > 1) floatText(o.x, o.y - 26, '+' + Math.round(add), '#8ff0b0', 14);
        for (let k = 0; k < 4; k++) B.parts.push({ x: o.x + rand(-10, 10), y: o.y + rand(-4, 8), vx: rand(-14, 14), vy: rand(-60, -30), life: 0.9, max: 0.9, size: rand(3, 6), color: pick(['#8ff0b0', '#c8ffd8', '#5fd08a']), glow: true });
      });
      ring(u.x, u.y, 20, 235, 0.7, '#8ff0b0', 4);
      glyphFx(u.x, u.y - 40, '藥', '#8ff0b0', 40, 1.1, 30);
      return true;
    },

    guguep(u) {
      B.flash = 0.8;
      B.units.forEach((o) => {
        if (o.team !== u.team) return;
        if (o.kind === 'hero' && o.down) {
          o.down = false; o.alive = true; o.hp = o.maxHp * 0.5; o.invuln = 2; o.stun = 0;
          floatText(o.x, o.y - 36, '회생', '#c8ffd8', 22, true);
          pillar(o.x, o.y, '#a6f5c4');
        } else if (o.alive) {
          o.hp = o.maxHp; o.stun = 0; o.invuln = 1.2;
          if (o.kind === 'hero') pillar(o.x, o.y, '#e8ffd0');
        }
      });
      glyphFx(u.x, u.y - 50, '回生', '#c8ffd8', 46, 1.6, 40);
      return true;
    },

    gyeolsa(u) {
      const fs = friends(u).filter((o) => dist(u, o) < 185);
      fs.forEach((o) => { o.buffAtk = Math.max(o.buffAtk, 0.4); o.buffDef = Math.max(o.buffDef, 0.3); o.buffT = 8; });
      ring(u.x, u.y, 20, 185, 0.6, '#ff5a3c', 5);
      glyphFx(u.x, u.y - 40, '決', '#ff6a4a', 48, 1.1, 30);
      return true;
    },

    ochon(u) {
      const L = u.level || 5;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const s = mkUnit({ team: u.team, kind: 'summon', summon: 'ghostsol', owner: u, x: u.x + Math.cos(a) * 70, y: u.y + Math.sin(a) * 70, r: 8,
          maxHp: 130 + L * 10, hp: 130 + L * 10, atk: 10 + L * 1.6, def: 6, spd: 112, atkCd: 1.0, range: 16, ttl: 15, color: '#d6dde6' });
        B.units.push(s);
        burst(s.x, s.y, 8, '#d6dde6', 60, 3, 0.6, true);
      }
      friends(u).forEach((o) => { o.buffAtk = Math.max(o.buffAtk, 0.3); o.buffDef = Math.max(o.buffDef, 0.2); o.buffT = 10; });
      ring(u.x, u.y, 30, 260, 0.9, '#ff5a3c', 6);
      glyphFx(u.x, u.y - 60, '五千', '#ff8a6a', 48, 1.6, 40);
      B.shake = Math.max(B.shake, 6);
      return true;
    },

    gyeokryeo(u) {
      const fs = friends(u).filter((o) => dist(u, o) < 170);
      fs.forEach((o) => { o.buffAtk = Math.max(o.buffAtk, 0.2); o.buffT = Math.max(o.buffT, 6); });
      if (u.sq) u.sq.morale = Math.min(100, u.sq.morale + 8);
      ring(u.x, u.y, 14, 170, 0.6, '#ffd36b', 3);
      glyphFx(u.x, u.y - 46, '勵', '#ffd36b', 34, 1, 24);
      return true;
    },

    chukji(u) {
      const fs = foes(u).filter((o) => dist(u, o) < 470).sort((a, b) => (b.kind === 'hero') - (a.kind === 'hero') || dist(u, a) - dist(u, b));
      const t = fs[0];
      if (!t) return false;
      B.parts.push({ x: u.x, y: u.y, vx: 0, vy: 0, life: 0.5, max: 0.5, size: 12, glyph: u.glyph, color: u.color, glow: true });
      burst(u.x, u.y, 12, u.color, 100, 3, 0.4, true);
      const a = Math.atan2(t.y - u.y, t.x - u.x);
      u.x = clamp(t.x + Math.cos(a) * (t.r + u.r + 6), 16, W - 16);
      u.y = clamp(t.y + Math.sin(a) * (t.r + u.r + 6), 16, H - 16);
      u.face = a + Math.PI;
      hit(u, t, u.atk * 2.6);
      slashFx(t.x, t.y, a + Math.PI, '#bffff0', 28);
      burst(t.x, t.y, 14, '#bffff0', 160, 3, 0.4, true);
      return true;
    },

    bunsin(u) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        const cl = mkUnit({ team: u.team, kind: 'summon', summon: 'clone', owner: u, hid: u.hid, generic: u.generic, face: u.face, glyph: u.glyph, color: u.color, x: u.x + Math.cos(a) * 46, y: u.y + Math.sin(a) * 46, r: 11,
          maxHp: u.maxHp * 0.35, hp: u.maxHp * 0.35, atk: u.atk * 0.6, def: u.def * 0.6, spd: u.spd, atkCd: u.atkCd, range: u.range, ttl: 10, w1: u.w1, w2: u.w2 });
        B.units.push(cl);
        burst(cl.x, cl.y, 14, 'rgba(220,240,235,0.6)', 70, 6, 0.6, false);
      }
      glyphFx(u.x, u.y - 46, '分身', u.color, 40, 1.2, 30);
      return true;
    },
  };

  function orbs(u, n, dmg, color) {
    const ts = nearestN(u, n, 440);
    if (!ts.length) return false;
    ts.forEach((t, i) => B.proj.push({ type: 'orb', x: u.x, y: u.y - 8, t, lx: t.x, ly: t.y, sp: 330, dmg, src: u, team: u.team, color, delay: i * 0.12, life: 3 }));
    return true;
  }

  function wave(u, dmg, color, range) {
    const d = densest(u, 360, 110);
    if (!d) return false;
    const a = Math.atan2(d.y - u.y, d.x - u.x);
    const fs = foes(u).filter((o) => {
      const dd = dist(u, o);
      if (dd > range) return false;
      let da = Math.atan2(o.y - u.y, o.x - u.x) - a;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      return Math.abs(da) < 0.7;
    });
    fs.forEach((o) => later((dist(u, o) / range) * 0.35, () => hit(u, o, dmg, { knock: 70, slow: 3, quiet: o.kind !== 'hero' })));
    const ox = u.x, oy = u.y;
    B.fx.push({ t: 0, dur: 0.6, layer: 'top', draw(c, f) {
      const k = f.t / f.dur;
      const d = range * Math.min(1, k * 1.15);
      Art.blitFx(c, 'wave', ox + Math.cos(a) * d * 0.45, oy + Math.sin(a) * d * 0.45, range * 1.1, range * 0.55, a, 1, 1 - k);
    } });
    for (let i = 0; i < 26; i++) {
      const aa = a + rand(-0.7, 0.7), s = rand(200, 420);
      B.parts.push({ x: ox, y: oy, vx: Math.cos(aa) * s, vy: Math.sin(aa) * s, life: 0.55, max: 0.55, size: rand(2, 5), color: '#dff4ff', glow: true, drag: 1.5 });
    }
    return true;
  }

  function arcArrow(sx, sy, cx, cy, tx, ty, delay, dur, color, onLand) {
    B.fx.push({ t: -delay, dur, layer: 'top', landed: false, upd(dt, f) {
      if (f.t >= dur * 0.98 && !f.landed) { f.landed = true; onLand(); }
    }, draw(c, f) {
      if (f.t < 0) return;
      const k = Math.min(1, f.t / dur), q = 1 - k;
      const x = q * q * sx + 2 * q * k * cx + k * k * tx, y = q * q * sy + 2 * q * k * cy + k * k * ty;
      const dx = 2 * q * (cx - sx) + 2 * k * (tx - cx), dy = 2 * q * (cy - sy) + 2 * k * (ty - cy);
      const a = Math.atan2(dy, dx);
      Art.blitFx(c, 'arrows', x, y, 36, 18, a, 1, 0.95);
    } });
  }

  function cannonball(sx, sy, ex, ey, dur, onLand) {
    B.fx.push({ t: 0, dur, layer: 'top', landed: false, upd(dt, f) { if (f.t >= dur * 0.97 && !f.landed) { f.landed = true; onLand(); } }, draw(c, f) {
      const k = Math.min(1, f.t / dur);
      const x = sx + (ex - sx) * k, y = sy + (ey - sy) * k - Math.sin(k * Math.PI) * 60;
      c.fillStyle = '#1a1a1a'; c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,190,110,0.6)'; c.lineWidth = 1; c.stroke();
    } });
  }

  function explosion(x, y, r, color = '#ffb347') {
    burst(x, y, 22, color, r * 3, 5, 0.55, true);
    burst(x, y, 10, 'rgba(40,34,28,0.6)', r * 1.6, 9, 0.9, false);
    B.fx.push({ t: 0, dur: 0.35, layer: 'top', draw(c, f) {
      const k = f.t / f.dur;
      const g = c.createRadialGradient(x, y, 1, x, y, r * (0.6 + k * 0.6));
      g.addColorStop(0, `rgba(255,250,220,${0.9 * (1 - k)})`); g.addColorStop(0.5, `rgba(255,170,80,${0.6 * (1 - k)})`); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * (0.6 + k * 0.6), 0, Math.PI * 2); c.fill();
    } });
  }
  function crater(x, y, r) {
    B.fx.push({ t: 0, dur: 5, layer: 'ground', draw(c, f) {
      c.globalAlpha = 0.5 * (1 - f.t / f.dur);
      const g = c.createRadialGradient(x, y, 2, x, y, r);
      g.addColorStop(0, 'rgba(10,8,6,0.9)'); g.addColorStop(0.7, 'rgba(40,30,20,0.5)'); g.addColorStop(1, 'rgba(40,30,20,0)');
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
    } });
  }
  function pillar(x, y, color) {
    B.fx.push({ t: 0, dur: 1.1, layer: 'top', draw(c, f) {
      const k = f.t / f.dur;
      const g = c.createLinearGradient(x, y - 220, x, y);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, color);
      c.globalAlpha = 1 - k; c.fillStyle = g; c.fillRect(x - 14 * (1 - k * 0.5), y - 220, 28 * (1 - k * 0.5), 220); c.globalAlpha = 1;
    } });
  }
  function sealFx(x, y, r, color, g) {
    B.fx.push({ t: 0, dur: 1.4, layer: 'ground', draw(c, f) {
      const k = f.t / f.dur;
      const a = (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) * 0.9;
      const rr = r * easeOut(Math.min(1, k * 2));
      Art.blitFx(c, 'seal', x, y, rr * 2, rr * 2, k * 0.4, 1, a);
    } });
  }

  /* ---------- 그림 ---------- */
  function drawTurtle(c, s, t) {
    if (Art.blitFx(c, 'turtle', s.x, s.y, 220, 110, 0, s.dir, 0.95)) return;
    c.save();
    c.translate(s.x, s.y);
    c.scale(s.dir, 1);
    // 물살
    c.fillStyle = 'rgba(220,240,255,0.22)';
    for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(-110 - i * 26, 0, 30 + i * 6, 26 + i * 4, 0, 0, Math.PI * 2); c.fill(); }
    // 노
    c.strokeStyle = '#2a1c12'; c.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const ox = -60 + i * 17, sw = Math.sin(t * 10 + i * 0.6) * 10;
      c.beginPath(); c.moveTo(ox, -26); c.lineTo(ox + sw, -50); c.stroke();
      c.beginPath(); c.moveTo(ox, 26); c.lineTo(ox + sw, 50); c.stroke();
    }
    // 선체
    c.fillStyle = '#3d2a1b'; c.strokeStyle = '#1a110a'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-96, 0); c.bezierCurveTo(-90, -34, 70, -36, 98, 0); c.bezierCurveTo(70, 36, -90, 34, -96, 0); c.fill(); c.stroke();
    c.strokeStyle = '#b8402f'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-86, -18); c.bezierCurveTo(-40, -30, 50, -30, 88, -12); c.stroke();
    c.beginPath(); c.moveTo(-86, 18); c.bezierCurveTo(-40, 30, 50, 30, 88, 12); c.stroke();
    // 덮개(거북 등)
    c.fillStyle = '#26302a'; c.strokeStyle = '#11160f'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(-4, 0, 74, 22, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(160,190,160,0.35)'; c.lineWidth = 1;
    for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(-70 + (i + 3) * 20, -18); c.lineTo(-60 + (i + 3) * 20, 18); c.stroke(); }
    c.fillStyle = '#c9c2b0';
    for (let i = 0; i < 18; i++) { const px = -64 + i * 7.5, py = Math.sin(i * 1.7) * 9; c.beginPath(); c.moveTo(px - 2, py + 2); c.lineTo(px, py - 4); c.lineTo(px + 2, py + 2); c.fill(); }
    // 용머리
    c.fillStyle = '#c0392b'; c.strokeStyle = '#5e1a12'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(100, 0, 16, 11, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(104, -5, 2.6, 0, Math.PI * 2); c.arc(104, 5, 2.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#2a0d08'; c.beginPath(); c.ellipse(114, 0, 4, 6, 0, 0, Math.PI * 2); c.fill();
    // 깃발
    c.fillStyle = '#d23c2c'; c.beginPath(); c.moveTo(-84, -8); c.lineTo(-84, -40); c.lineTo(-64 + Math.sin(t * 8) * 3, -34); c.lineTo(-84, -28); c.fill();
    c.fillStyle = '#e8c050'; c.beginPath(); c.moveTo(-84, 8); c.lineTo(-84, 40); c.lineTo(-64 + Math.sin(t * 8 + 1) * 3, 34); c.lineTo(-84, 28); c.fill();
    c.restore();
  }

  function drawHorseman(c, x, y, dir, color, t) {
    if (Art.blitFx(c, 'cavalry', x, y, 90, 56, 0, dir, 0.92)) return;
    c.save();
    c.translate(x, y); c.scale(dir, 1);
    c.globalAlpha = 0.85;
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 46);
    g.addColorStop(0, hexA(color, 0.45)); g.addColorStop(1, hexA(color, 0));
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 46, 0, Math.PI * 2); c.fill();
    const bob = Math.sin(t * 22) * 2;
    c.fillStyle = '#2a2633'; c.strokeStyle = color; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(0, 4 + bob, 22, 9, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.ellipse(22, -4 + bob, 9, 5, -0.5, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#2a2633'; c.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const lx = -14 + i * 9, sw = Math.sin(t * 22 + i) * 6; c.beginPath(); c.moveTo(lx, 10 + bob); c.lineTo(lx + sw, 22); c.stroke(); }
    c.fillStyle = '#3a3546'; c.strokeStyle = color; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, -10 + bob, 7, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#d9d2ff'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-4, -8 + bob); c.lineTo(40, -14 + bob); c.stroke();
    c.restore();
  }

  function drawSword(c, x, y, a, color, len) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.shadowColor = '#ff5a5a'; c.shadowBlur = 12;
    c.strokeStyle = color; c.lineWidth = 3;
    c.beginPath(); c.moveTo(-len * 0.4, 0); c.lineTo(len * 0.6, 0); c.stroke();
    c.strokeStyle = '#8a6a3a'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(-len * 0.4, -5); c.lineTo(-len * 0.4, 5); c.stroke();
    c.restore();
  }

  function hexA(hex, a) {
    if (hex.startsWith('rgba')) return hex;
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function shade(hex, k) {
    const h = hex.replace('#', '');
    const n = parseInt(h, 16);
    const r = Math.round(((n >> 16) & 255) * k), g = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
    return `rgb(${r},${g},${b})`;
  }

  function drawWeapon(c, u, wt, side) {
    if (!wt) return;
    const sw = u.swing > 0 ? Math.sin((u.swing / 0.2) * Math.PI) * 1.2 : 0;
    const a = u.face + side * 0.55 - sw * side;
    const bx = u.x + Math.cos(a) * u.r * 0.8, by = u.y + Math.sin(a) * u.r * 0.8;
    c.lineCap = 'round';
    if (wt === 'shield') {
      const sa = u.face + side * 1.0;
      c.fillStyle = '#4a3a28'; c.strokeStyle = '#c9a85c'; c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(u.x + Math.cos(sa) * (u.r + 2), u.y + Math.sin(sa) * (u.r + 2), 4, 8, sa, 0, Math.PI * 2); c.fill(); c.stroke();
      return;
    }
    if (wt === 'bow') {
      c.strokeStyle = '#a8865a'; c.lineWidth = 2;
      c.beginPath(); c.arc(u.x + Math.cos(u.face) * (u.r - 2), u.y + Math.sin(u.face) * (u.r - 2), u.r * 0.9, u.face - 1.2, u.face + 1.2); c.stroke();
      return;
    }
    const len = wt === 'spear' || wt === 'glaive' ? 28 : wt === 'dagger' ? 10 : wt === 'fan' || wt === 'brush' || wt === 'talisman' ? 9 : 17;
    const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
    c.strokeStyle = wt === 'brush' ? '#6b4a2a' : wt === 'talisman' ? '#d23c2c' : '#d8d6cf';
    c.lineWidth = wt === 'glaive' || wt === 'spear' ? 2 : 2.4;
    c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
    if (wt === 'glaive') { c.fillStyle = '#e8e4da'; c.beginPath(); c.arc(ex, ey, 4, a - 1.6, a + 1.2); c.fill(); }
    if (wt === 'fan') { c.fillStyle = 'rgba(240,236,224,0.85)'; c.beginPath(); c.moveTo(bx, by); c.arc(bx, by, 11, a - 0.5, a + 0.5); c.fill(); }
    if (wt === 'brush') { c.fillStyle = '#111'; c.beginPath(); c.arc(ex, ey, 2.6, 0, Math.PI * 2); c.fill(); }
  }

  function drawUnit(c, u) {
    const t = B.t;
    if (!u.alive) {
      if (u.kind === 'hero' && u.down) {
        c.globalAlpha = 0.45;
        c.fillStyle = '#0d0c0b'; c.beginPath(); c.ellipse(u.x, u.y + 4, u.r * 1.2, u.r * 0.6, 0, 0, Math.PI * 2); c.fill();
        c.font = `900 ${u.r}px ${FONT_GLYPH}`; c.fillStyle = u.color; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(u.glyph, u.x, u.y + 3);
        c.globalAlpha = 1;
      }
      return;
    }
    const ghost = u.ghost || u.summon === 'ghostsol';
    let alpha = 1;
    if (ghost) alpha = 0.78 + Math.sin(t * 6 + u.bob) * 0.12;
    if (u.summon === 'clone') alpha = 0.55;
    if (u.ttl > 0 && u.ttl < 1) alpha *= u.ttl;
    if (u.invuln > 0 && Math.floor(t * 16) % 2) alpha *= 0.6;
    c.globalAlpha = alpha;
    // 그림자
    c.fillStyle = 'rgba(0,0,0,0.45)';
    c.beginPath(); c.ellipse(u.x, u.y + u.r * 0.75, u.r * 1.05, u.r * 0.42, 0, 0, Math.PI * 2); c.fill();
    if (u.summon === 'tiger') { drawTiger(c, u, t); c.globalAlpha = 1; drawStatus(c, u, t); hpBar(c, u, 34); return; }

    if (u.kind === 'hero' || u.summon === 'clone') {
      const g = c.createRadialGradient(u.x, u.y + 6, 2, u.x, u.y + 6, u.r * 2.4);
      g.addColorStop(0, hexA(u.color, u.boss ? 0.5 : 0.34)); g.addColorStop(1, hexA(u.color, 0));
      c.fillStyle = g; c.beginPath(); c.ellipse(u.x, u.y + 6, u.r * 2.4, u.r * 1.3, 0, 0, Math.PI * 2); c.fill();
      if (u === B.ctrl) {
        c.strokeStyle = '#e8c050'; c.lineWidth = 1.6; c.setLineDash([5, 4]); c.lineDashOffset = -t * 20;
        c.beginPath(); c.ellipse(u.x, u.y + 8, u.r + 9, (u.r + 9) * 0.45, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      }
      if (u.buffT > 0) {
        c.strokeStyle = `rgba(255,90,60,${0.5 + Math.sin(t * 10) * 0.2})`; c.lineWidth = 2;
        c.beginPath(); c.ellipse(u.x, u.y + 8, u.r + 5, (u.r + 5) * 0.45, 0, 0, Math.PI * 2); c.stroke();
      }
      if (u.orbit > 0) {
        Art.blitFx(c, 'swords', u.x, u.y - 8, 90, 90, u.orbitA, 1, 0.9);
      }
      if (u.flash > 0) c.filter = 'brightness(2.6)';
      Sprites.hero(c, u, t);
      c.filter = 'none';
      c.globalAlpha = 1;
      if (u.kind === 'hero') {
        hpBar(c, u, 30);
        c.font = `600 10px ${FONT_NUM}`; c.fillStyle = u.team === 0 ? 'rgba(236,228,207,0.9)' : 'rgba(255,190,180,0.9)';
        c.textAlign = 'center'; c.textBaseline = 'top';
        c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.7)';
        c.strokeText(u.name, u.x, u.y + u.r + 9); c.fillText(u.name, u.x, u.y + u.r + 9);
      }
      drawStatus(c, u, t);
      return;
    }
    // 졸병과 결사대 혼령: 혼불
    if (u.captain) {
      const col = u.team === 0 ? '#7fd3e6' : (u.color || '#e0503c');
      c.strokeStyle = '#4a3a28'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(u.x - 6, u.y + 4); c.lineTo(u.x - 6, u.y - 34); c.stroke();
      const wv = Math.sin(t * 6 + u.bob) * 2;
      c.fillStyle = col; c.globalAlpha = 0.9;
      c.beginPath(); c.moveTo(u.x - 6, u.y - 34); c.lineTo(u.x + 10 + wv, u.y - 31); c.lineTo(u.x + 8 + wv, u.y - 20); c.lineTo(u.x - 6, u.y - 22); c.closePath(); c.fill();
      c.globalAlpha = 1;
      c.font = `900 9px ${FONT_GLYPH}`; c.fillStyle = '#0c0b0a'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('將', u.x + 2 + wv * 0.5, u.y - 27);
      if (u === B.ctrl) { c.strokeStyle = '#e8c050'; c.lineWidth = 1.4; c.setLineDash([4, 3]); c.beginPath(); c.ellipse(u.x, u.y + 6, 18, 8, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
    }
    Sprites.wisp(c, u, t);
    c.globalAlpha = 1;
    if (u.hp < u.maxHp) hpBar(c, u, 14);
    drawStatus(c, u, t);
  }

  function drawTiger(c, u, t) {
    if (Art.blitFx(c, 'tiger', u.x, u.y, 100, 64, u.face, 1, 0.95)) return;
    c.save(); c.translate(u.x, u.y); c.rotate(u.face);
    const g = c.createRadialGradient(0, 0, 4, 0, 0, 50);
    g.addColorStop(0, 'rgba(200,225,255,0.4)'); g.addColorStop(1, 'rgba(200,225,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 50, 0, Math.PI * 2); c.fill();
    const step = Math.sin(t * 16) * 4;
    c.strokeStyle = '#d7dde8'; c.lineWidth = 4; c.lineCap = 'round';
    [[-12, -9], [-12, 9], [12, -9], [12, 9]].forEach(([lx, ly], i) => { c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + (i % 2 ? step : -step), ly * 1.6); c.stroke(); });
    c.fillStyle = '#f2f5fa'; c.strokeStyle = '#8a95a8'; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(0, 0, 22, 11, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = '#1b1d22'; c.lineWidth = 2.2;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 7, -10); c.quadraticCurveTo(i * 7 + 3, 0, i * 7, 10); c.stroke(); }
    c.fillStyle = '#f2f5fa'; c.beginPath(); c.arc(24, 0, 9, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#8a95a8'; c.stroke();
    c.fillStyle = '#7fd3ff'; c.shadowColor = '#7fd3ff'; c.shadowBlur = 8;
    c.beginPath(); c.arc(28, -3.5, 1.8, 0, Math.PI * 2); c.arc(28, 3.5, 1.8, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    c.strokeStyle = '#d7dde8'; c.lineWidth = 3; c.beginPath(); c.moveTo(-22, 0); c.quadraticCurveTo(-34, Math.sin(t * 6) * 10, -40, -6); c.stroke();
    c.restore();
  }

  function hpBar(c, u, w) {
    const k = clamp(u.hp / u.maxHp, 0, 1);
    const y = u.kind === 'hero' ? u.y - (u.boss ? 62 : 55) : u.y - u.r - 13;
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(u.x - w / 2 - 1, y - 1, w + 2, u.kind === 'hero' ? 5 : 3);
    c.fillStyle = u.team === 0 ? (k > 0.35 ? '#7fd3e6' : '#ffb35c') : '#e0503c';
    c.fillRect(u.x - w / 2, y, w * k, u.kind === 'hero' ? 3 : 1.6);
  }

  function drawStatus(c, u, t) {
    if (u.stun > 0) {
      c.fillStyle = '#ffe08a';
      const sy = u.kind === 'hero' ? u.y - 48 : u.y - u.r - 10;
      for (let i = 0; i < 3; i++) { const a = t * 5 + (i / 3) * Math.PI * 2; c.beginPath(); c.arc(u.x + Math.cos(a) * 9, sy + Math.sin(a) * 3, 1.8, 0, Math.PI * 2); c.fill(); }
    }
    if (u.fear > 0) { c.font = `700 12px ${FONT_NUM}`; c.fillStyle = '#d7a6ff'; c.textAlign = 'center'; c.fillText('!', u.x, u.y - u.r - 6); }
    if (u.slowT > 0 && u.kind === 'hero') { c.fillStyle = 'rgba(140,200,255,0.8)'; c.fillRect(u.x - 8, u.y + u.r + 2, 16, 1.5); }
  }

  /* ---------- 지면 ---------- */
  function makeGround(theme, seed) {
    let s = seed * 9301 + 49297;
    const R = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const g = document.createElement('canvas');
    g.width = W; g.height = H;
    const c = g.getContext('2d');
    const pal = {
      field: ['#1e2219', '#13150f'], mist: ['#1a2023', '#101416'], north: ['#20242a', '#121519'],
      coast: ['#1f2119', '#131510'], ruin: ['#211f1b', '#141311'],
    }[theme] || ['#1e2219', '#13150f'];
    const lg = c.createLinearGradient(0, 0, W, H);
    lg.addColorStop(0, pal[0]); lg.addColorStop(1, pal[1]);
    c.fillStyle = lg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 240; i++) {
      const x = R() * W, y = R() * H, r = 30 + R() * 150;
      const rg = c.createRadialGradient(x, y, 0, x, y, r);
      const light = R() < 0.35;
      rg.addColorStop(0, light ? 'rgba(120,110,90,0.07)' : 'rgba(0,0,0,0.16)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    for (let i = 0; i < 3500; i++) { c.fillStyle = `rgba(${R() < 0.5 ? '200,190,160' : '0,0,0'},${0.04 + R() * 0.06})`; c.fillRect(R() * W, R() * H, 1.4, 1.4); }
    // 길
    c.strokeStyle = 'rgba(130,112,84,0.08)'; c.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      c.lineWidth = 90 - k * 18;
      c.beginPath(); c.moveTo(-20, H * 0.52);
      c.bezierCurveTo(W * 0.3, H * (0.3 + R() * 0.1), W * 0.6, H * (0.72 - R() * 0.1), W + 20, H * 0.46);
      c.stroke();
    }
    // 풀
    c.strokeStyle = 'rgba(110,120,80,0.22)'; c.lineWidth = 1;
    for (let i = 0; i < 900; i++) { const x = R() * W, y = R() * H; c.beginPath(); c.moveTo(x, y); c.lineTo(x + R() * 4 - 2, y - 3 - R() * 4); c.stroke(); }
    if (theme === 'coast') {
      const wg = c.createLinearGradient(0, 0, 0, 170);
      wg.addColorStop(0, '#0e2430'); wg.addColorStop(0.8, 'rgba(20,52,66,0.85)'); wg.addColorStop(1, 'rgba(20,52,66,0)');
      c.fillStyle = wg; c.fillRect(0, 0, W, 170);
      c.strokeStyle = 'rgba(170,210,225,0.18)';
      for (let i = 0; i < 40; i++) { const x = R() * W, y = R() * 130; c.beginPath(); c.arc(x, y, 14 + R() * 20, Math.PI * 1.15, Math.PI * 1.85); c.stroke(); }
    }
    if (theme === 'north') { c.fillStyle = 'rgba(230,236,245,0.18)'; for (let i = 0; i < 1500; i++) c.fillRect(R() * W, R() * H, 2, 2); }
    // 장식
    const deco = theme === 'mist' ? ['pine', 'pine', 'pine', 'mound', 'jang', 'rock'] : theme === 'ruin' ? ['wall', 'wall', 'rock', 'jang', 'dead'] : theme === 'coast' ? ['rock', 'rock', 'sotdae', 'dead', 'mound'] : ['dead', 'pine', 'jang', 'sotdae', 'mound', 'rock', 'cairn'];
    for (let i = 0; i < 46; i++) {
      const x = R() * W, y = (theme === 'coast' ? 190 : 30) + R() * (H - (theme === 'coast' ? 220 : 60));
      if (x > 320 && x < W - 320 && y > 260 && y < H - 260 && R() < 0.7) continue;
      drawDeco(c, deco[Math.floor(R() * deco.length)], x, y, 0.8 + R() * 0.6, R);
    }
    const vg = c.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    return g;
  }

  function drawDeco(c, kind, x, y, s, R) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(0, 4, 16, 5, 0, 0, Math.PI * 2); c.fill();
    if (kind === 'pine') {
      c.fillStyle = '#121a14'; c.strokeStyle = '#1e2c22'; c.lineWidth = 1;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(0, -48 + i * 12); c.lineTo(-16 + i * 2, -18 + i * 10); c.lineTo(16 - i * 2, -18 + i * 10); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = '#2a2018'; c.fillRect(-2, 0, 4, 6);
    } else if (kind === 'dead') {
      c.strokeStyle = '#2b241c'; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, 4); c.lineTo(2, -30); c.stroke();
      c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(1, -16); c.lineTo(-12, -28); c.moveTo(2, -22); c.lineTo(14, -34); c.moveTo(-8, -24); c.lineTo(-10, -36); c.stroke();
    } else if (kind === 'jang') {
      for (const ox of [-7, 7]) {
        c.fillStyle = '#3a2e22'; c.fillRect(ox - 4, -34, 8, 38);
        c.fillStyle = '#8a3324'; c.fillRect(ox - 4, -34, 8, 4);
        c.fillStyle = '#e8dcc0'; c.fillRect(ox - 3, -26, 2, 2); c.fillRect(ox + 1, -26, 2, 2); c.fillRect(ox - 2, -20, 4, 1.5);
      }
    } else if (kind === 'sotdae') {
      c.strokeStyle = '#3a2e22'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 4); c.lineTo(0, -44); c.stroke();
      c.fillStyle = '#3a2e22'; c.beginPath(); c.ellipse(3, -46, 7, 3, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(9, -47); c.lineTo(13, -46); c.lineTo(9, -45); c.fill();
    } else if (kind === 'mound') {
      c.fillStyle = '#20251b'; c.strokeStyle = '#2f3527'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, -2, 20, 11, 0, Math.PI, 0); c.lineTo(20, 2); c.lineTo(-20, 2); c.fill(); c.stroke();
      c.fillStyle = '#4a463e'; c.fillRect(-3, -6, 6, 8);
    } else if (kind === 'rock') {
      c.fillStyle = '#2c2c2a'; c.strokeStyle = '#3c3b37'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(-14, 3); c.lineTo(-10, -8); c.lineTo(0, -12); c.lineTo(12, -6); c.lineTo(14, 3); c.closePath(); c.fill(); c.stroke();
    } else if (kind === 'cairn') {
      c.fillStyle = '#3a3833';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.ellipse(0, -i * 6, 10 - i * 2, 4, 0, 0, Math.PI * 2); c.fill(); }
    } else if (kind === 'wall') {
      c.fillStyle = '#2b2925'; c.strokeStyle = '#3d3a33'; c.lineWidth = 1;
      c.fillRect(-26, -16, 52, 16); c.strokeRect(-26, -16, 52, 16);
      c.fillStyle = '#1c1b18'; c.beginPath(); c.moveTo(-30, -16); c.lineTo(0, -26); c.lineTo(30, -16); c.fill();
    }
    c.restore();
  }

  /* ---------- 렌더 ---------- */
  function render() {
    const c = ctx;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.fillStyle = '#08090a'; c.fillRect(0, 0, vw, vh);
    const shx = (Math.random() - 0.5) * B.shake * 2, shy = (Math.random() - 0.5) * B.shake * 2;
    const Z = zoomNow();
    const ox = vw / 2 - B.cam.x * Z + shx, oy = vh / 2 - B.cam.y * Z + shy;
    c.setTransform(DPR * Z, 0, 0, DPR * Z, DPR * ox, DPR * oy);
    c.drawImage(B.ground, 0, 0);
    if (B.moveTo && B.ctrl) {
      c.strokeStyle = 'rgba(232,192,80,0.6)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(B.moveTo.x, B.moveTo.y, 8 + Math.sin(B.t * 8) * 2, 0, Math.PI * 2); c.stroke();
    }
    if (B.attackTarget && B.attackTarget.alive) {
      const a = B.attackTarget;
      c.strokeStyle = 'rgba(224,80,60,0.85)'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(a.x, a.y, a.r + 6, 0, Math.PI * 2); c.stroke();
    }
    for (const f of B.fx) if (f.layer === 'ground' && f.draw && f.t >= 0) f.draw(c, f);
    const order = B.units.slice().sort((a, b) => a.y - b.y);
    for (const u of order) if (!u.alive) drawUnit(c, u);
    for (const u of order) if (u.alive) drawUnit(c, u);
    for (const p of B.proj) {
      if (p.delay > 0) continue;
      if (p.type === 'arrow') {
        const rem = Math.hypot(p.lx - p.x, p.ly - p.y), tot = p.total || 100;
        const k = clamp(1 - rem / tot, 0, 1), arcH = tot * 0.22;
        const hgt = Math.sin(k * Math.PI) * arcH;
        const gx = Math.cos(p.a), gy = Math.sin(p.a);
        const ang = Math.atan2(gy * tot - Math.cos(k * Math.PI) * Math.PI * arcH, gx * tot);
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(p.x - 2, p.y - 0.5, 4, 1);
        Art.blitFx(c, 'arrows', p.x, p.y - hgt, 32, 16, ang, 1, 0.95);
      } else if (p.type === 'orb') {
        if (!Art.blitFx(c, 'orbs', p.x, p.y, 28, 28, B.t * 4, 1, 0.95)) {
          c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, 13);
          g.addColorStop(0, '#ffffff'); g.addColorStop(0.35, p.color); g.addColorStop(1, 'rgba(0,0,0,0)');
          c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 13, 0, Math.PI * 2); c.fill();
          c.globalCompositeOperation = 'source-over';
        }
      } else if (p.type === 'cres') {
        if (!Art.blitFx(c, 'slash', p.x, p.y, p.size * 2.4, p.size * 2.4, p.a, 1, 0.9)) {
          c.save(); c.translate(p.x, p.y); c.rotate(p.a);
          c.globalCompositeOperation = 'lighter';
          c.shadowColor = p.color; c.shadowBlur = p.big ? 30 : 16;
          c.fillStyle = hexA(p.color, 0.85);
          c.beginPath(); c.arc(0, 0, p.size, -1.25, 1.25); c.arc(-p.size * 0.35, 0, p.size * 0.82, 1.15, -1.15, true); c.fill();
          c.restore();
        }
      }
    }
    for (const f of B.fx) if (f.layer === 'top' && f.draw && f.t >= 0) f.draw(c, f);
    for (const p of B.parts) {
      const k = clamp(p.life / p.max, 0, 1);
      if (p.ring) { c.globalAlpha = k * 0.5; c.strokeStyle = p.ring; c.lineWidth = 2; c.beginPath(); c.arc(p.x, p.y, p.size, 0, Math.PI * 2); c.stroke(); continue; }
      c.globalAlpha = k;
      if (p.glow) c.globalCompositeOperation = 'lighter';
      if (p.glyph) {
        c.save(); c.translate(p.x, p.y); if (p.rot) c.rotate(p.rot);
        c.font = `900 ${p.size}px ${FONT_GLYPH}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.shadowColor = p.color; c.shadowBlur = 12; c.fillStyle = p.color; c.fillText(p.glyph, 0, 0);
        c.restore();
      } else {
        c.fillStyle = p.color; c.beginPath(); c.arc(p.x, p.y, p.size * (0.4 + 0.6 * k), 0, Math.PI * 2); c.fill();
      }
      c.globalCompositeOperation = 'source-over';
    }
    c.globalAlpha = 1;
    for (const tx of B.texts) {
      const k = clamp(tx.life / tx.max, 0, 1);
      c.globalAlpha = Math.min(1, k * 2);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      if (tx.brush) {
        c.font = `${tx.size}px ${FONT_BRUSH}`;
        c.lineWidth = 4; c.strokeStyle = 'rgba(8,6,4,0.85)'; c.strokeText(tx.txt, tx.x, tx.y);
        c.fillStyle = tx.color; c.fillText(tx.txt, tx.x, tx.y);
      } else {
        c.font = `700 ${tx.size}px ${FONT_NUM}`;
        c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(tx.txt, tx.x, tx.y);
        c.fillStyle = tx.color; c.fillText(tx.txt, tx.x, tx.y);
      }
    }
    c.globalAlpha = 1;
    // 안개
    for (const m of B.mist) {
      const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
      g.addColorStop(0, 'rgba(200,210,215,0.05)'); g.addColorStop(1, 'rgba(200,210,215,0)');
      c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y, m.r, 0, Math.PI * 2); c.fill();
    }
    // 화면 효과
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    const tint = ['rgba(0,0,0,0)', 'rgba(190,100,40,0.12)', 'rgba(8,16,48,0.42)'][B.phase] || 'rgba(0,0,0,0)';
    c.fillStyle = tint; c.fillRect(0, 0, vw, vh);
    if (B.darken > 0) { c.fillStyle = `rgba(4,6,14,${B.darken * 0.45})`; c.fillRect(0, 0, vw, vh); }
    const vg = c.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
    c.fillStyle = vg; c.fillRect(0, 0, vw, vh);
    for (const f of B.fx) if (f.layer === 'screen' && f.draw && f.t >= 0) f.draw(c, f);
    if (B.flash > 0) { c.fillStyle = `rgba(255,248,230,${B.flash * 0.35})`; c.fillRect(0, 0, vw, vh); }
    drawMini();
    if (B.paused && !B.over) {
      c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, vw, vh);
      c.font = `48px ${FONT_BRUSH}`; c.fillStyle = '#ece4cf'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('일시정지', vw / 2, vh / 2);
    }
  }

  function drawMini() {
    const m = $('#b-mini');
    if (!m) return;
    const mw = m.clientWidth, mh = m.clientHeight;
    if (m.width !== Math.round(mw * DPR)) { m.width = Math.round(mw * DPR); m.height = Math.round(mh * DPR); }
    const g = m.getContext('2d');
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    g.fillStyle = 'rgba(10,10,12,0.85)'; g.fillRect(0, 0, mw, mh);
    const sx = mw / W, sy = mh / H;
    for (const u of B.units) {
      if (!u.alive) continue;
      const hero = u.kind === 'hero' || u.captain;
      g.fillStyle = u.team === 0 ? (hero ? '#e8f8ff' : '#5fb8cc') : (hero ? '#ffd0c8' : '#c0503c');
      const r = hero ? 2.4 : 1.1;
      g.fillRect(u.x * sx - r, u.y * sy - r, r * 2, r * 2);
    }
    const Z = zoomNow();
    g.strokeStyle = 'rgba(232,192,80,0.8)'; g.lineWidth = 1;
    g.strokeRect((B.cam.x - vw / 2 / Z) * sx, (B.cam.y - vh / 2 / Z) * sy, (vw / Z) * sx, (vh / Z) * sy);
  }

  /* ---------- 입력 ---------- */
  function onKey(e) {
    if (!active || !B || B.over) return;
    if (!$('#dialog').hidden || !$('#modal').hidden) return;
    const code = e.code;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(code)) e.preventDefault();
    if (e.type === 'keyup') { keys[code] = false; return; }
    if (e.repeat) { keys[code] = true; return; }
    keys[code] = true;
    if (code === 'KeyQ') manualCast(B.ctrl, 0);
    else if (code === 'KeyE') manualCast(B.ctrl, 1);
    else if (code === 'Tab') cycleCtrl();
    else if (code === 'Space') togglePause();
    else if (code === 'KeyF') { B.speed = B.speed >= 3 ? 1 : B.speed + 1; prefs.speed = B.speed; syncButtons(); }
    else if (code === 'KeyM') { Sfx.toggle(); syncButtons(); }
    else if (code === 'KeyR') { B.autoCtrl = !B.autoCtrl; prefs.auto = B.autoCtrl; syncButtons(); }
    else if (/^Digit[1-6]$/.test(code)) setOrder(ORDERS[+code.slice(5) - 1].id);
  }

  function onPointer(e) {
    if (!active || !B || B.over) return;
    const r = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const Z = zoomNow();
    const wx = B.cam.x + (sx - vw / 2) / Z, wy = B.cam.y + (sy - vh / 2) / Z;
    let best = null, bd = 1e9;
    for (const u of B.units) {
      if (!u.alive) continue;
      const d = Math.hypot(u.x - wx, u.y - wy);
      if (d < u.r + 12 && d < bd) { bd = d; best = u; }
    }
    if (best && best.team !== 0) { B.attackTarget = best; B.moveTo = null; return; }
    if (best && best.team === 0 && best.kind === 'hero') { setCtrl(best); return; }
    B.moveTo = { x: clamp(wx, 16, W - 16), y: clamp(wy, 16, H - 16) };
    B.attackTarget = null;
  }

  function setCtrl(u) {
    if (!u || !u.alive) return;
    B.ctrl = u; B.attackTarget = null; B.moveTo = null;
  }
  function cycleCtrl() {
    const hs = B.units.filter((u) => u.team === 0 && u.kind === 'hero' && u.alive);
    if (!hs.length) return;
    const i = hs.indexOf(B.ctrl);
    setCtrl(hs[(i + 1) % hs.length]);
  }
  function setOrder(o) {
    if (!B) return;
    B.order = o;
    B.holdPos = {};
    if (o === 'form') captureAllyForm();
    $$('#b-orders .ord').forEach((b) => b.classList.toggle('on', b.dataset.ord === o));
    const name = ORDERS.find((x) => x.id === o).name;
    if (B.ctrl) floatText(B.ctrl.x, B.ctrl.y - 46, name + '!', '#e8c050', 26, true);
  }
  function syncFormHud() {
    if (!B) return;
    const hs = B.units.filter((u) => u.team === 0 && u.kind === 'hero' && u.alive);
    const pNames = [...new Set(hs.map((h) => (FORMATIONS[h.form] || FORMATIONS.eorin).name))];
    const formEl = $('#b-form');
    if (formEl) formEl.textContent = `${pNames.join('·') || FORMATIONS[B.form[0]].name} vs ${FORMATIONS[B.form[1]].name}`;
    const fb = $('#b-forms');
    if (!fb) return;
    const cur = (B.ctrl && B.ctrl.form) || B.form[0];
    fb.innerHTML = Object.keys(FORMATIONS).map((k) => `<button class="form-chip ${cur === k ? 'on' : ''}" data-bform="${k}">${FORMATIONS[k].name}</button>`).join('');
  }
  function setBattleForm(fid) {
    if (!B || !FORMATIONS[fid]) return;
    const h = (B.ctrl && B.ctrl.alive && B.ctrl.kind === 'hero') ? B.ctrl : B.units.find((u) => u.team === 0 && u.kind === 'hero' && u.alive);
    if (!h) { B.form[0] = fid; syncFormHud(); return; }
    h.form = fid;
    B.form[0] = fid;
    if (h.hid && typeof setHeroForm === 'function') setHeroForm(h.hid, fid);
    const sols = B.units.filter((u) => u.leader === h && u.alive);
    sols.forEach((so, i) => {
      const off = formOffset(fid, i, sols.length, 1);
      so.formOx = off.x; so.formOy = off.y;
    });
    captureAllyForm();
    syncFormHud();
    floatText(h.x, h.y - 50, FORMATIONS[fid].name + '!', '#e8c050', 24, true);
  }
  /* 결판 내기: 남은 전투를 자동으로 끝까지 빠르게 돌린다 */
  function skipBattle() {
    if (!B || B.over || B.skipping) return;
    B.skipping = true; B.paused = false; B.autoCtrl = true;
    $('#cutin').innerHTML = '';
    syncButtons();
    const cur = B;
    const run = () => {
      if (B !== cur) return;
      fastForward(6);
      if (B.over) { Sfx.play(B.win ? 'win' : 'lose'); B.skipping = false; syncButtons(); return; }
      setTimeout(run, 16);
    };
    run();
  }

  function togglePause() { if (!B || B.over) return; B.paused = !B.paused; syncButtons(); }
  function syncButtons() {
    if (!B) return;
    $('#b-pause').textContent = B.paused ? '계속' : '일시정지';
    $('#b-auto').classList.toggle('on', B.autoCtrl);
    $('#b-sound').textContent = Sfx.on ? '소리 켜짐' : '소리 꺼짐';
    $('#b-sound').classList.toggle('on', Sfx.on);
    $('#b-skip').disabled = !!(B.over || B.skipping);
    $('#b-skip').textContent = B.skipping ? '결판 내는 중…' : '결판 내기';
    $('#b-auto').textContent = B.autoCtrl ? '자동 전투 켜짐' : '자동 전투';
    $$('#b-speed [data-sp]').forEach((b) => b.classList.toggle('on', +b.dataset.sp === B.speed));
    $$('#b-orders .ord').forEach((b) => b.classList.toggle('on', b.dataset.ord === B.order));
  }

  /* ---------- HUD ---------- */
  function buildHud() {
    const box = $('#b-heroes');
    const hs = B.units.filter((u) => u.team === 0 && u.kind === 'hero');
    box.innerHTML = hs.map((u, i) => {
      const s0 = SKILLS[u.skills[0].id];
      const s1 = u.skills[1] ? SKILLS[u.skills[1].id] : null;
      return `<div class="bh" data-i="${i}" style="--c:${u.color}">
        <button class="bh-face" data-act="ctrl" aria-label="${esc(u.name)} 조종"><span>${esc(u.glyph)}</span></button>
        <div class="bh-info"><div class="bh-name">${esc(u.name)} <small class="bh-mor"></small></div><div class="bh-hp"><i></i></div></div>
        <button class="bh-sk" data-act="sk0" title="${esc(s0.desc)}"><span class="cd"></span><em>Q</em>${esc(s0.name)}</button>
        ${s1 ? `<button class="bh-sk hid ${u.hiddenOn ? '' : 'locked'}" data-act="sk1" title="${u.hiddenOn ? esc(s1.desc) : '고유 무기를 장착하면 열린다'}"><span class="cd"></span><em>E</em>${u.hiddenOn ? esc(s1.name) : '봉인됨'}</button>` : ''}
      </div>`;
    }).join('');
    hud.cards = $$('.bh', box).map((el, i) => ({ el, u: hs[i], hp: $('.bh-hp i', el), sk: $$('.bh-sk', el), mor: $('.bh-mor', el) }));
    box.onclick = (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const card = hud.cards[+b.closest('.bh').dataset.i];
      if (!card) return;
      if (b.dataset.act === 'ctrl') setCtrl(card.u);
      else manualCast(card.u, b.dataset.act === 'sk0' ? 0 : 1);
    };
  }

  function squadMembersCount(q) { let n = q.leader && q.leader.alive ? 1 : 0; for (const u of B.units) if (u.sq === q && u.alive && !u.rout) n++; return n; }
  function updateHud() {
    if (!B) return;
    const a = B.units.filter((u) => u.team === 0 && u.alive && u.kind !== 'summon').length;
    const e = B.units.filter((u) => u.team === 1 && u.alive && u.kind !== 'summon').length;
    $('#b-ally').textContent = a;
    $('#b-enemy').textContent = e;
    const avgM = (tm) => { const qs = B.squads.filter((q) => q.team === tm && squadMembersCount(q) > 0); return qs.length ? Math.round(qs.reduce((x, q) => x + q.morale, 0) / qs.length) : 0; };
    $('#b-mor-a').textContent = avgM(0);
    $('#b-mor-e').textContent = avgM(1);
    $('#b-bar-ally').style.width = `${(a / Math.max(1, a + e)) * 100}%`;
    for (const card of hud.cards) {
      const u = card.u;
      card.hp.style.width = `${clamp(u.hp / u.maxHp, 0, 1) * 100}%`;
      if (card.mor && u.sq) card.mor.textContent = `사기 ${Math.round(u.sq.morale)}`;
      card.el.classList.toggle('down', !u.alive);
      card.el.classList.toggle('ctrl', u === B.ctrl);
      card.sk.forEach((btn, k) => {
        const s = u.skills[k];
        if (!s) return;
        const p = clamp(s.t / (SKILLS[s.id].cd * 1.3), 0, 1);
        btn.style.setProperty('--p', p.toFixed(3));
        btn.classList.toggle('ready', p <= 0 && u.alive && (!s.hidden || u.hiddenOn));
      });
    }
  }

  /* ---------- 종료 ---------- */
  const MORALE_HOLD = 45;
  function squadMembers(sq) { return B.units.filter((u) => u.sq === sq && u.alive && u.kind === 'soldier' && !u.rout); }

  /* 사기가 버티면 혼불 하나가 대장이 된다 */
  function promote(sq, quiet) {
    const mem = squadMembers(sq);
    if (!mem.length) return null;
    const cx = mem.reduce((a, u) => a + u.x, 0) / mem.length, cy = mem.reduce((a, u) => a + u.y, 0) / mem.length;
    let s = mem[0], bd = 1e12;
    for (const o of mem) { const d = (o.x - cx) ** 2 + (o.y - cy) ** 2 - o.hp * 4; if (d < bd) { bd = d; s = o; } }
    s.captain = true; s.r = 10; s.maxHp = Math.round(s.maxHp * 3); s.hp = s.maxHp; s.atk *= 2; s.def += 4; s.spd = 100;
    s.name = '혼불 대장'; s.glyph = '將'; s.sp = 24 + (s.level || 3) * 3.5; s.leader = null; s.ranged = false; s.range = 16;
    if (s.stype === 'archer') s.stype = 'melee';
    s.skills = [{ id: 'ghostfire', t: 2, hidden: false }];
    s.squadN = 0;
    sq.leader = s;
    mem.forEach((o) => { if (o !== s) { o.leader = s; o.slot = s.squadN++; } });
    if (!quiet) {
      floatText(s.x, s.y - 44, `혼불 대장! 사기 ${Math.round(sq.morale)}`, sq.team === 0 ? '#7fd3e6' : '#ff9a8a', 26, true);
      ring(s.x, s.y, 6, 70, 0.6, sq.team === 0 ? '#7fd3e6' : '#ff9a8a', 3);
    }
    if (sq.team === 0 && (!B.ctrl || !B.ctrl.alive)) B.ctrl = s;
    return s;
  }

  /* 사기가 꺾이면 그 부대는 도망친다 */
  function routSquad(sq) {
    const mem = squadMembers(sq);
    if (!mem.length) return;
    mem.forEach((u) => { u.rout = true; u.leader = null; });
    const a = mem[0];
    floatText(a.x, a.y - 30, `사기 ${Math.round(sq.morale)} · 도주!`, sq.team === 0 ? '#ff9a8a' : '#ffe08a', 26, true);
  }

  function resolveSquad(sq) {
    if (!B || B.over) return;
    if (!squadMembers(sq).length) return;
    if (sq.morale >= MORALE_HOLD) promote(sq);
    else routSquad(sq);
    if (sq.team === 0 && (!B.ctrl || !B.ctrl.alive)) switchCtrl();
  }

  function rout(team) {
    B.routing = true;
    B.units.forEach((u) => { if (u.team === team && u.alive && u.kind !== 'summon') u.rout = true; });
    const anchor = B.ctrl && B.ctrl.alive ? B.ctrl : B.units.find((u) => u.alive) || { x: W / 2, y: H / 2 };
    floatText(anchor.x + 60, anchor.y - 70, team === 1 ? '적이 무너진다!' : '아군이 무너진다!', team === 1 ? '#ffe08a' : '#ff9a8a', 40, true);
    later(1.6, () => finish(team === 1));
  }

  function checkEnd() {
    const live = (tm) => B.units.filter((u) => u.team === tm && u.alive && u.kind !== 'summon' && !u.rout);
    const p = live(0), e = live(1);
    if (B.routing) return;
    if (!p.length) { finish(false); return; }
    if (!e.length) { finish(true); return; }
    // 이끌 자가 하나도 없으면 남은 병사는 흩어진다
    if (!e.some((u) => u.kind === 'hero' || u.captain)) { rout(1); return; }
    if (!p.some((u) => u.kind === 'hero' || u.captain)) rout(0);
  }

  function finish(win, retreat) {
    if (!B || B.over) return;
    B.over = true;
    B.win = win;
    Sfx.play(win ? 'win' : 'lose');
    const pSol = B.units.filter((u) => u.team === 0 && u.kind === 'soldier' && u.alive).length + B.units.filter((u) => u.team === 0 && u.kind === 'soldier' && u.fled).length;
    const eSol = B.units.filter((u) => u.team === 1 && u.kind === 'soldier' && u.alive && !u.rout).length;
    const sent = B.sent || 0;
    const survivors = retreat ? Math.round(pSol * 0.7) : win ? pSol : Math.round(pSol * 0.5);
    const res = { win, retreat: !!retreat, sent, survivors, lost: sent - survivors, enemyLeft: win ? 0 : eSol + (B.reserve || 0), kills: B.kills, exp: Object.assign({}, B.exp), captured: B.captured.slice(), reserve: B.reserve || 0, heroes: {} };
    B.units.filter((u) => u.team === 0 && u.kind === 'hero').forEach((u) => { res.heroes[u.hid] = u.alive ? Math.max(0.05, u.hp / u.maxHp) : 0.15; });
    setTimeout(() => showResult(res), win ? 1300 : 700);
  }

  function showResult(res) {
    if (!B) return;
    const el = $('#b-result');
    const title = res.win ? '승리' : res.retreat ? '퇴각' : '패배';
    const caps = res.captured.map((h) => HEROES[h].name);
    el.innerHTML = `<div class="br-card ${res.win ? 'win' : 'lose'}">
      <div class="br-title">${title}</div>
      <dl class="br-stats">
        <div><dt>쓰러뜨린 적</dt><dd>${res.kills}</dd></div>
        <div><dt>아군 병사</dt><dd>${res.sent}명 중 ${res.survivors}명 생존</dd></div>
        <div><dt>사로잡은 영웅</dt><dd>${caps.length ? esc(caps.join(', ')) : '없음'}</dd></div>
      </dl>
      <button class="btn primary" id="br-ok">계속</button></div>`;
    el.hidden = false;
    $('#br-ok').onclick = () => {
      el.hidden = true;
      const cfg = B.cfg;
      stop();
      cfg.onEnd(res);
    };
  }

  /* 테스트용: 실시간 대기 없이 전투를 진행 */
  function fastForward(sec, autoAll = true) {
    if (!B) return null;
    if (autoAll) B.autoCtrl = true;
    const n = Math.round(sec * 30);
    B.ffwd = true; Sfx.quiet(true);
    try { for (let i = 0; i < n && !B.over; i++) step(1 / 30); } finally { B.ffwd = false; Sfx.quiet(false); }
    return { over: B.over, t: B.t, ally: B.units.filter((u) => u.team === 0 && u.alive).length, enemy: B.units.filter((u) => u.team === 1 && u.alive).length };
  }
  function state() { return B; }

  function debugCast(hid, k) {
    if (!B) return false;
    const u = B.units.find((x) => x.hid === hid && x.team === 0 && x.alive && x.kind === 'hero');
    if (!u || !u.skills[k]) return false;
    u.skills[k].t = 0;
    manualCast(u, k);
    return true;
  }
  return { init, start, stop, resize, fastForward, state, setOrder, debugCast };
})();
