'use strict';
/* ===== 들판 전투 (Unity 시제품 'Party Quest' 방식을 웹으로 옮김) =====
   - 리더 한 명을 직접 조종(WASD). 적에게 다가가면 저절로 벤다(부딪혀 공격)
   - 나머지 동료는 리더 뒤에 대열을 짓고 작전(1 따라와 · 2 돌격 · 3 대기 · 4 후퇴)에 따라 알아서 싸운다
   - Tab/Q 로 조종할 영웅을 바꾼다. 쓰러지면 다음 영웅으로 자동 전환
   - 들판 곳곳의 동료(머리 위 '!')에게 다가가면 합류. 혼천 샘에서 회복·부활
   - 적을 쓰러뜨린 영웅이 경험치를 얻어 레벨업. 혼석(점수)·회복약(H) 줍기
   - 목표: 북동쪽 산성의 흑귀 장군 격파
   그림은 게임과 같은 것: 무명·저승차사 = 뼈대(Rig), 다른 영웅·귀졸 = 시트, 혼불 = 불꽃 */
const Field = (() => {
  const M = 40; /* 1미터 = 40 */
  const MAP_W = 110, MAP_H = 70;
  const W = MAP_W * M, H = MAP_H * M;
  const TUN = {
    accel: 40 * M, radius: 0.42 * M, separation: 8 * M,
    formBack: 1.5 * M, formGap: 1.15 * M,
    followEngage: 3.5 * M, followLeash: 7 * M, chargeRange: 14 * M, retreatMul: 1.2,
    aggro: 7.5 * M, leash: 16 * M, meleeReach: 0.35 * M,
    recruitR: 2.5 * M, springR: 2.4 * M, springHps: 5,
    potionHeal: 15, startPotions: 3, expPerLv: 12, lvHp: 4, lvAtk: 1,
    hpShow: 2.5, viewH: 12.5 * M,
  };
  const ORDER_NAMES = ['', '따라와', '돌격', '대기', '후퇴'];
  const ORDER_DESC = ['', '리더를 따라 싸운다', '보이는 적에게 돌격!', '그 자리를 지킨다', '싸우지 않고 리더 곁으로'];
  /* Unity 좌표(아래가 0)를 화면 좌표(위가 0, 단위 px)로 */
  const P = (x, y) => ({ x: x * M, y: (MAP_H - y) * M });

  /* ---------- 결정적 난수 (매번 같은 지도) ---------- */
  let seed = 7;
  const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const rr = (a, b) => a + (b - a) * rnd();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  let cv, c, S, raf = 0, last = 0, onEnd = null;
  const keys = new Set();
  let pressed = [];

  /* ---------- 유닛 정의 ---------- */
  /* kind: sword 검 · bow 활 · heavy 중검 · mage 술사(부채 바람·치유) · spear 창 | grub 혼불 · brute 귀졸 · imp 도깨비불(원거리) · boss 장군 */
  const RANGED = { bow: 1, mage: 1, imp: 1 };
  function def(o) { return Object.assign({ def: 1, size: 1, range: 0, exp: 0, gems: 0 }, o); }
  const PARTY = [
    { hid: 'hero', role: '검객', kind: 'sword', hp: 30, atk: 6, def: 3, speed: 5.5, cd: 0.6, at: [14, 15] },
    { hid: 'gangrim', role: '술사', kind: 'mage', hp: 22, atk: 7, def: 1, speed: 5.2, range: 6, cd: 1.3, at: [12.5, 14] },
    { hid: 'yusin', role: '장수', kind: 'heavy', hp: 42, atk: 8, def: 5, speed: 4.9, range: 0.1, cd: 0.95, at: [15.5, 14] },
    { hid: 'gamchan', role: '궁수', kind: 'bow', hp: 24, atk: 6, def: 1, speed: 5.6, range: 7, cd: 0.9, at: [21, 37], waiting: true },
    { hid: 'gyebaek', role: '창수', kind: 'spear', hp: 32, atk: 6, def: 4, speed: 5.3, range: 0.6, cd: 0.7, at: [23, 37.5], waiting: true },
    { hid: 'sunsin', role: '궁수', kind: 'bow', hp: 24, atk: 6, def: 1, speed: 5.6, range: 7, cd: 0.85, at: [69, 8], waiting: true },
    { hid: 'gyeonhwon', role: '장수', kind: 'heavy', hp: 45, atk: 9, def: 5, speed: 4.8, range: 0.1, cd: 1.0, at: [71, 8.5], waiting: true },
  ];
  const FOES = {
    grub: { name: '혼불', kind: 'grub', hp: 14, atk: 4, def: 1, speed: 3.8, cd: 0.9, exp: 4, gems: 2, color: '#ff6b57' },
    brute: { name: '귀졸', kind: 'brute', hp: 36, atk: 7, def: 3, speed: 3.2, range: 0.1, cd: 1.2, exp: 10, gems: 5, size: 1.5 },
    imp: { name: '도깨비불', kind: 'imp', hp: 12, atk: 4, def: 0, speed: 3.6, range: 6, cd: 1.6, exp: 5, gems: 2, size: 0.9, color: '#ffb340' },
    boss: { name: '흑귀 장군', kind: 'boss', hp: 160, atk: 10, def: 4, speed: 3.4, range: 0.2, cd: 1.0, exp: 50, gems: 20, size: 2.2 },
  };

  /* ---------- 상태 ---------- */
  let F = null;
  function nameOf(hid) { return (typeof HEROES !== 'undefined' && HEROES[hid] && HEROES[hid].name) || hid; }

  function mkUnit(d, team, p) {
    const gear = (typeof HERO_GEAR !== 'undefined' && d.hid && HERO_GEAR[d.hid]) || {};
    return {
      d, team, hid: d.hid, name: d.name || nameOf(d.hid),
      x: p.x, y: p.y, vx: 0, vy: 0, dx: 0, dy: 0, homeX: p.x, homeY: p.y,
      mdx: 1, mdy: 0, /* 리더가 마지막으로 걸은 방향 (대열 방향) */
      r: TUN.radius * (d.size || 1), hp: d.hp, maxHp: d.hp, atk: d.atk, df: d.def || 0,
      level: 1, exp: 0, alive: true, waiting: !!d.waiting, controlled: false,
      cool: rnd() * d.cd, healCool: 0, swing: 0, flash: 0, hpShow: 0, t: rnd() * 10, face: 0, bob: rnd() * 6,
      armorId: gear.armor || null, w1Id: gear.w1 || null, generic: d.kind === 'brute' || d.kind === 'boss', boss: d.kind === 'boss',
      wisp: d.kind === 'grub' || d.kind === 'imp', color: d.color,
    };
  }
  const ranged = (u) => !!RANGED[u.d.kind];
  const hostile = (a, b) => b.alive && !b.waiting && b.team !== a.team;

  /* ---------- 지도 ---------- */
  const PATHS = [
    [[12, 12], [28, 18], [46, 20], [60, 21], [72, 30], [86, 40], [96, 46], [96, 58]],
    [[28, 18], [30, 34], [38, 48], [46, 52], [62, 48], [80, 44], [96, 46]],
    [[60, 21], [70, 9]],
  ].map((p) => p.map(([x, y]) => P(x, y)));
  function nearPath(p, r) {
    for (const path of PATHS) for (let s = 0; s < path.length - 1; s++) {
      const a = path[s], b = path[s + 1], abx = b.x - a.x, aby = b.y - a.y;
      const k = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby), 0, 1);
      if (Math.hypot(p.x - (a.x + abx * k), p.y - (a.y + aby * k)) < r * M) return true;
    }
    return false;
  }
  /* Unity 사각형 (x0, y0, 너비, 높이; 아래가 0) → 화면 사각형 */
  const R = (x, y, w, h) => ({ x: x * M, y: (MAP_H - y - h) * M, w: w * M, h: h * M });

  function buildMap() {
    const circles = [], rects = [], props = [];
    const spring = P(12, 12);
    /* 강 (다리 두 곳) */
    rects.push(R(44, -10, 4, 28), R(44, 22, 4, 28), R(44, 54, 4, 30));
    /* 초가집 */
    for (const [x, y, roof] of [[5, 18, '#b48a4e'], [19, 5, '#a8834a'], [5, 5, '#bf9555']]) {
      const p = P(x, y);
      rects.push(R(x - 1.8, y - 0.2, 3.6, 1.6));
      props.push({ type: 'house', x: p.x, y: p.y + 0.2 * M, roof });
    }
    /* 산성: 남쪽 성벽 가운데가 성문 */
    const walls = [[86, 94, 46, 47], [98, 106, 46, 47], [86, 106, 65, 66], [86, 87, 46, 66], [105, 106, 46, 66]];
    for (const [x0, x1, y0, y1] of walls) {
      const r = R(x0, y0, x1 - x0, y1 - y0); rects.push(r);
      props.push({ type: 'wall', x: r.x, y: r.y + r.h, w: r.w, h: r.h, r });
    }
    for (const x of [93.5, 98.5]) { const p = P(x, 47.6); props.push({ type: 'torch', x: p.x, y: p.y + 2, t: x }); }
    const tree = (p) => { circles.push({ x: p.x, y: p.y, r: 0.55 * M }); props.push({ type: 'tree', x: p.x, y: p.y, s: rr(0.9, 1.25), v: Math.floor(rnd() * 3), t: rnd() * 6 }); };
    const rock = (p) => { circles.push({ x: p.x, y: p.y, r: 0.6 * M }); props.push({ type: 'rock', x: p.x, y: p.y, s: rr(0.85, 1.2) }); };
    for (let x = 0; x <= MAP_W; x += 2.3) { tree(P(x, 0.3 + rnd())); tree(P(x, MAP_H - 0.3 - rnd())); }
    for (let y = 2; y <= MAP_H - 2; y += 2.3) { tree(P(0.3 + rnd(), y)); tree(P(MAP_W - 0.3 - rnd(), y)); }
    const clusters = [[8, 30], [18, 52], [36, 60], [38, 28], [54, 34], [56, 8], [66, 60], [84, 18], [76, 46], [102, 30], [26, 6], [10, 62]];
    const blocked = (ux, uy) => { const p = P(ux, uy); return nearPath(p, 2.6) || Math.abs(ux - 46) < 3.5 || Math.hypot(p.x - spring.x, p.y - spring.y) < 6 * M || (ux > 84 && uy > 44); };
    for (const [cx0, cy0] of clusters) for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, rad = Math.sqrt(rnd()) * 4.5, ux = cx0 + Math.cos(a) * rad, uy = cy0 + Math.sin(a) * rad;
      if (!blocked(ux, uy)) tree(P(ux, uy));
    }
    for (let i = 0; i < 25; i++) { const ux = rr(3, MAP_W - 3), uy = rr(3, MAP_H - 3); if (!blocked(ux, uy)) rock(P(ux, uy)); }
    return { circles, rects, props, spring };
  }

  /* 땅 그림은 한 번만 그려 둔다 (절반 해상도) */
  function bakeGround(map) {
    const k = 0.5, g = document.createElement('canvas');
    g.width = W * k; g.height = H * k;
    const x = g.getContext('2d');
    x.scale(k, k);
    x.fillStyle = '#6b7848'; x.fillRect(0, 0, W, H);
    seed = 99;
    for (let i = 0; i < 260; i++) {
      const px = rnd() * W, py = rnd() * H, r = rr(2, 5.5) * M, light = rnd() < 0.5;
      const gr = x.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, light ? 'rgba(150,160,95,0.35)' : 'rgba(55,70,40,0.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    /* 길 */
    for (const [w, col] of [[3.6, 'rgba(95,80,50,0.55)'], [2.4, '#a8946a']]) {
      x.strokeStyle = col; x.lineWidth = w * M; x.lineCap = 'round'; x.lineJoin = 'round';
      for (const path of PATHS) { x.beginPath(); path.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y))); x.stroke(); }
    }
    for (let i = 0; i < 900; i++) { /* 길 위 자갈 */
      const px = rnd() * W, py = rnd() * H; if (!nearPath({ x: px, y: py }, 1)) continue;
      x.fillStyle = rnd() < 0.5 ? 'rgba(70,58,40,0.35)' : 'rgba(210,195,160,0.35)'; x.beginPath(); x.ellipse(px, py, rr(2, 5), rr(1.5, 3), 0, 0, 7); x.fill();
    }
    /* 풀포기 */
    for (let i = 0; i < 2600; i++) {
      const px = rnd() * W, py = rnd() * H; if (nearPath({ x: px, y: py }, 1.4)) continue;
      x.strokeStyle = rnd() < 0.5 ? 'rgba(45,62,32,0.7)' : 'rgba(140,155,85,0.6)'; x.lineWidth = 2;
      x.beginPath(); for (let b = -1; b <= 1; b++) { x.moveTo(px + b * 3, py); x.lineTo(px + b * 6, py - rr(8, 14)); } x.stroke();
    }
    for (let i = 0; i < 260; i++) { /* 들꽃 */
      const px = rnd() * W, py = rnd() * H; if (nearPath({ x: px, y: py }, 1.4)) continue;
      x.fillStyle = ['#d9c6e0', '#e8d98a', '#c9d6ea', '#e9e2d0'][Math.floor(rnd() * 4)];
      x.beginPath(); x.arc(px, py, 3.5, 0, 7); x.fill();
    }
    /* 강 */
    const rx = 46 * M;
    x.fillStyle = '#56663c'; x.fillRect(rx - 2.6 * M, 0, 5.2 * M, H);
    x.fillStyle = '#3a6276'; x.fillRect(rx - 2 * M, 0, 4 * M, H);
    x.fillStyle = 'rgba(120,170,190,0.45)'; x.fillRect(rx - 1.2 * M, 0, 2.4 * M, H);
    /* 다리 */
    for (const uy of [20, 52]) {
      const by = (MAP_H - uy) * M;
      for (let px = 43.4 * M; px <= 48.6 * M; px += 0.55 * M) {
        x.fillStyle = '#7a5a3a'; x.fillRect(px - 0.25 * M, by - 2.1 * M, 0.5 * M, 4.2 * M);
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px + 0.2 * M, by - 2.1 * M, 0.06 * M, 4.2 * M);
      }
      x.fillStyle = '#4e3824'; x.fillRect(rx - 2.8 * M, by - 2.2 * M, 5.6 * M, 0.25 * M); x.fillRect(rx - 2.8 * M, by + 1.95 * M, 5.6 * M, 0.25 * M);
    }
    /* 산성 마당 */
    const fr = R(86, 46, 20, 20);
    x.fillStyle = '#7b766c'; x.fillRect(fr.x, fr.y, fr.w, fr.h);
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2;
    for (let yy = fr.y; yy < fr.y + fr.h; yy += 0.9 * M) for (let xx = fr.x + ((yy / (0.9 * M)) % 2) * 0.6 * M; xx < fr.x + fr.w; xx += 1.2 * M) x.strokeRect(xx, yy, 1.2 * M, 0.9 * M);
    /* 혼천 샘 */
    const sp = map.spring;
    const gl = x.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 3.6 * M);
    gl.addColorStop(0, 'rgba(140,235,255,0.55)'); gl.addColorStop(1, 'rgba(140,235,255,0)');
    x.fillStyle = gl; x.fillRect(sp.x - 4 * M, sp.y - 4 * M, 8 * M, 8 * M);
    x.fillStyle = '#9b9486'; x.beginPath(); x.ellipse(sp.x, sp.y, 2.3 * M, 1.7 * M, 0, 0, 7); x.fill();
    x.fillStyle = '#4fb6cf'; x.beginPath(); x.ellipse(sp.x, sp.y, 2.0 * M, 1.45 * M, 0, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.4)'; x.beginPath(); x.ellipse(sp.x - 0.6 * M, sp.y - 0.4 * M, 1 * M, 0.5 * M, 0, 0, 7); x.fill();
    return g;
  }

  /* 소나무 그림 (세 가지) */
  const treeImgs = [];
  function treeImg(v) {
    if (treeImgs[v]) return treeImgs[v];
    const g = document.createElement('canvas'); g.width = 160; g.height = 200;
    const x = g.getContext('2d');
    seed = 300 + v * 17;
    x.fillStyle = '#4a3526'; x.beginPath(); x.moveTo(74, 196); x.lineTo(78, 90); x.lineTo(84, 90); x.lineTo(88, 196); x.fill();
    const leaf = ['#2f4a33', '#38523a', '#2b4430'][v], hi = ['#4f6e48', '#5a7a4f', '#4a6844'][v];
    for (let i = 0; i < 4; i++) {
      const cy = 150 - i * 34, w = 70 - i * 12;
      x.fillStyle = leaf; x.beginPath(); x.ellipse(80 + rr(-6, 6), cy, w, 22, 0, 0, 7); x.fill();
      x.fillStyle = hi; x.beginPath(); x.ellipse(70 + rr(-4, 4), cy - 8, w * 0.55, 10, 0, 0, 7); x.fill();
    }
    treeImgs[v] = g; return g;
  }

  /* ---------- 시작 ---------- */
  function start(canvas, opts = {}) {
    stop();
    cv = canvas; c = cv.getContext('2d'); onEnd = opts.onEnd || null;
    seed = 7;
    const map = buildMap();
    F = {
      t: 0, time: 0, endTime: 0, map, ground: null, order: 1, gems: 0, gemTotal: 0, potions: TUN.startPotions,
      kills: 0, hits: 0, ctrlHits: 0, cleared: false, defeated: false, banner: '', bannerT: 0, springTick: 0,
      allies: [], enemies: [], shots: [], pickups: [], floats: [], parts: [], cam: { x: 0, y: 0, vx: 0, vy: 0 }, ctrl: null, boss: null,
      shake: 0,
    };
    F.ground = bakeGround(map);
    seed = 11;
    for (const d of PARTY) F.allies.push(mkUnit(def(d), 0, P(d.at[0], d.at[1])));
    F.ctrl = F.allies[0]; F.ctrl.controlled = true;
    const squad = (ux, uy, grubs, brutes, imps) => {
      const n = grubs + brutes + imps, cp = P(ux, uy);
      for (let i = 0; i < n; i++) {
        const p = { x: cp.x + Math.cos(i * 2.1) * 1.6 * M, y: cp.y - Math.sin(i * 2.1) * 1.6 * M };
        const k = i < grubs ? 'grub' : i < grubs + brutes ? 'brute' : 'imp';
        F.enemies.push(mkUnit(def(FOES[k]), 1, p));
      }
    };
    squad(28, 19, 3, 0, 0); squad(32, 35, 2, 0, 1);
    squad(58, 22, 2, 1, 0); squad(62, 47, 2, 0, 2);
    squad(78, 30, 3, 1, 0); squad(76, 58, 0, 2, 1);
    squad(96, 52, 2, 2, 2);
    F.boss = mkUnit(def(FOES.boss), 1, P(96, 59)); F.enemies.push(F.boss);
    const gem = (ux, uy) => F.pickups.push(mkPickup(P(ux, uy), false, false));
    for (let i = 0; i < 6; i++) gem(20 + i * 1.2, 15.5 + Math.sin(i) * 0.6);
    for (let i = 0; i < 6; i++) gem(52 + i * 1.2, 20);
    for (let i = 0; i < 6; i++) gem(30 + Math.cos(i) * 1.5, 44 + Math.sin(i) * 1.5);
    for (let i = 0; i < 6; i++) gem(84 + i * 1.2, 12);
    for (const [ux, uy] of [[36, 9], [66, 36], [88, 24], [54, 62]]) F.pickups.push(mkPickup(P(ux, uy), true, false));
    for (const e of F.enemies) F.gemTotal += e.d.gems;
    for (const p of F.pickups) if (!p.potion) F.gemTotal++;
    F.cam.x = F.ctrl.x; F.cam.y = F.ctrl.y;
    if (typeof Art !== 'undefined' && Art.warm) Art.warm();
    for (const u of F.allies) portrait(u.hid);
    banner('목표: 북동쪽 산성의 흑귀 장군을 쓰러뜨려라', 3.5);
    window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKeyUp);
    cv.addEventListener('pointerdown', onPointer);
    window.addEventListener('blur', clearKeys);
    last = performance.now();
    raf = requestAnimationFrame(loop);
    return F;
  }
  function stop() {
    cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', clearKeys);
    if (cv) cv.removeEventListener('pointerdown', onPointer);
    keys.clear();
  }

  const portraits = {};
  function portrait(hid) {
    if (!hid) return null;
    if (!portraits[hid]) { const im = new Image(); im.src = `img/portraits/${hid}.jpg`; portraits[hid] = im; }
    const im = portraits[hid]; return im.complete && im.naturalWidth ? im : null;
  }

  /* ---------- 입력 ---------- */
  const SCRIPT = { on: false, mx: 0, my: 0 };
  function clearKeys() { keys.clear(); }
  function onKey(e) {
    if (!F) return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'tab'].includes(k)) e.preventDefault();
    if (!keys.has(k)) pressed.push(k);
    keys.add(k);
    sfx.unlock();
  }
  function onKeyUp(e) { keys.delete(e.key.toLowerCase()); }
  function moveVec() {
    if (SCRIPT.on) return { x: SCRIPT.mx, y: SCRIPT.my };
    let x = 0, y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    const m = Math.hypot(x, y); return m > 1 ? { x: x / m, y: y / m } : { x, y };
  }
  let hudButtons = [];
  function onPointer(e) {
    sfx.unlock();
    const rc = cv.getBoundingClientRect(), px = (e.clientX - rc.left) * (cv.width / rc.width) / S.ui, py = (e.clientY - rc.top) * (cv.height / rc.height) / S.ui;
    for (const b of hudButtons) if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { pressed.push(b.key); return; }
  }

  /* ---------- 효과음 (WebAudio로 짧게 합성) ---------- */
  const sfx = (() => {
    let ac = null;
    function unlock() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); }
    function tone(f0, f1, dur, type = 'square', vol = 0.06, noise = false) {
      if (!ac) return;
      const t = ac.currentTime, g = ac.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); g.connect(ac.destination);
      if (noise) {
        const b = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = ac.createBufferSource(); s.buffer = b;
        const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = f0; s.connect(f); f.connect(g); s.start(t); return;
      }
      const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
      o.connect(g); o.start(t); o.stop(t + dur);
    }
    return {
      unlock,
      hit: () => { tone(1800, 0, 0.09, 'square', 0.08, true); tone(220, 90, 0.08, 'triangle', 0.07); },
      hurt: () => tone(300, 120, 0.15, 'sawtooth', 0.05),
      swish: () => tone(2400, 0, 0.12, 'square', 0.03, true),
      gem: (k = 0) => tone(1200 + k * 60, 1700 + k * 60, 0.08, 'sine', 0.04),
      potion: () => { tone(500, 900, 0.18, 'sine', 0.06); },
      level: () => { tone(520, 520, 0.1, 'square', 0.04); setTimeout(() => tone(660, 660, 0.1, 'square', 0.04), 90); setTimeout(() => tone(880, 880, 0.18, 'square', 0.04), 180); },
      recruit: () => { tone(440, 880, 0.25, 'triangle', 0.06); },
      order: () => tone(700, 1000, 0.07, 'triangle', 0.05),
      kill: () => tone(900, 200, 0.2, 'triangle', 0.05),
      win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, 0.3, 'triangle', 0.06), i * 140)); },
      lose: () => { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, f * 0.95, 0.35, 'sawtooth', 0.04), i * 200)); },
    };
  })();

  /* ---------- 보조 ---------- */
  function banner(s, t = 2) { F.banner = s; F.bannerT = t; }
  function floatText(x, y, s, col, size = 22) { F.floats.push({ x, y, s, col, t: 0.9, size }); }
  function burst(x, y, n, col, sp, life, rise = 0, size = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = sp * (0.4 + Math.random() * 0.6);
      F.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - rise, t: life * (0.6 + Math.random() * 0.4), life, col, size });
    }
  }
  function joined() { return F.allies.filter((u) => !u.waiting); }
  function nearest(from, list, maxD, ax = from.x, ay = from.y) {
    let best = null, bd = maxD;
    for (const o of list) { if (!hostile(from, o)) continue; const d = Math.hypot(ax - o.x, ay - o.y); if (d < bd) { bd = d; best = o; } }
    return best;
  }
  function reach(a, b) { return ranged(a) ? a.d.range * M : a.r + b.r + TUN.meleeReach + a.d.range * M; }

  function switchControl() {
    const party = joined(), idx = party.indexOf(F.ctrl);
    for (let k = 1; k < party.length; k++) {
      const u = party[(idx + k) % party.length];
      if (!u.alive) continue;
      F.ctrl.controlled = false; F.ctrl = u; u.controlled = true;
      sfx.order(); banner(`${u.name}(${u.d.role}) 조종`);
      return;
    }
  }

  function tryAttack(a, b) {
    if (!b) return;
    const d = dist(a, b), rc = reach(a, b);
    if (d < rc * 1.25) a.reachT = F.t; /* 겨눔 자세 유지 */
    if (a.cool > 0 || d > rc) return;
    a.cool = a.d.cd; a.swing = 0.25;
    a.face = Math.atan2(b.y - a.y, b.x - a.x);
    const dmg = Math.max(1, a.atk - Math.floor(b.df / 2)) + Math.floor(Math.random() * 3);
    if (ranged(a)) { F.shots.push(mkShot(a, b, dmg)); sfx.swish(); }
    else {
      /* 칼이 실제로 닿는 순간에 피해 (뼈대 베기 동작과 맞춤) */
      const delay = a.hid && typeof Rig !== 'undefined' && Rig.has(a.hid) ? 0.42 : 0.12;
      a.pending = { b, dmg, t: delay };
      sfx.swish();
    }
  }

  function hit(a, b, dmg) {
    if (!b.alive) return;
    b.hp -= dmg; b.flash = 0.12; b.hpShow = TUN.hpShow;
    const n = Math.hypot(b.x - a.x, b.y - a.y) || 1, push = (b.d.kind === 'boss' ? 0.08 : 0.25) * M;
    b.x += (b.x - a.x) / n * push; b.y += (b.y - a.y) / n * push; resolve(b);
    burst(b.x, b.y - 0.6 * M * (b.d.size || 1), 5, '#fff2a8', 160, 0.25, 40, 3);
    floatText(b.x, b.y - 1.9 * M * Math.min(1.6, b.d.size || 1), String(dmg), b.team === 0 ? '#ff8a7a' : '#ffffff');
    if (b.team === 0) sfx.hurt(); else sfx.hit();
    if (a.team === 0) { F.hits++; if (a.controlled) F.ctrlHits++; }
    if (b === F.boss || a.controlled || b.controlled) F.shake = Math.max(F.shake, 0.12);
    if (b.hp > 0) return;
    b.hp = 0; b.alive = false;
    burst(b.x, b.y - 0.5 * M, 16, b.wisp ? b.color : '#9aa3b8', 260, 0.4, 60, 4);
    burst(b.x, b.y - 0.5 * M, 8, '#ffffff', 120, 0.5, -60, 3);
    if (b.team === 1) {
      F.kills++; gainExp(a, b.d.exp);
      for (let i = 0; i < b.d.gems; i++) F.pickups.push(mkPickup(b, false, true));
      if (Math.random() < 0.12) F.pickups.push(mkPickup(b, true, true));
      sfx.kill();
      if (b === F.boss) { F.cleared = true; F.endTime = F.time; sfx.win(); burst(b.x, b.y - M, 50, '#ffe28a', 400, 1.2, 80, 5); banner('흑귀 장군 격파!', 99); }
    } else {
      banner(`${b.name} 쓰러짐!`);
      if (b === F.ctrl) switchControl();
      if (!joined().some((u) => u.alive) && !F.defeated) { F.defeated = true; F.endTime = F.time; sfx.lose(); banner('파티 전멸...', 99); }
    }
  }

  function gainExp(u, n) {
    if (!u.alive && u.team !== 0) return;
    u.exp += n;
    while (u.exp >= TUN.expPerLv * u.level) {
      u.exp -= TUN.expPerLv * u.level; u.level++;
      u.maxHp += TUN.lvHp; u.atk += TUN.lvAtk; if (u.level % 2 === 0) u.df++;
      u.hp = Math.min(u.maxHp, u.hp + Math.floor(u.maxHp / 2));
      burst(u.x, u.y - 0.8 * M, 16, '#ffe36a', 160, 0.6, 120, 4);
      sfx.level();
      floatText(u.x, u.y - 2.4 * M, 'LEVEL UP!', '#ffe36a', 26);
    }
  }

  function mkShot(a, b, dmg) {
    const sx = a.x + Math.cos(a.face) * 0.4 * M, sy = a.y;
    const speed = (a.d.kind === 'bow' ? 16 : 10) * M;
    const dx = b.x - sx, dy = b.y - sy, n = Math.hypot(dx, dy) || 1;
    return { owner: a, x: sx, y: sy, vx: dx / n * speed, vy: dy / n * speed, life: (a.d.range + 2) * M / speed, dmg, kind: a.d.kind, done: false };
  }

  function mkPickup(p, potion, magnet) {
    const o = { x: p.x, y: p.y, potion, magnet, done: false, t: Math.random() * 6, h: 0, hv: 0, vx: 0, vy: 0, delay: 0 };
    if (magnet) { const a = Math.random() * 7, v = Math.random() * 3 * M; o.vx = Math.cos(a) * v; o.vy = Math.sin(a) * v; o.hv = rr(5, 8) * M; o.delay = 0.45; }
    return o;
  }

  /* ---------- 충돌 ---------- */
  function resolve(u) {
    const m = F.map;
    for (const o of m.circles) {
      const dx = u.x - o.x, dy = u.y - o.y, min = o.r + u.r, d = Math.hypot(dx, dy);
      if (d < min) { const k = d > 0.01 ? min / d : 1; u.x = o.x + (d > 0.01 ? dx * k : 0); u.y = o.y + (d > 0.01 ? dy * k : -min); }
    }
    for (const b of m.rects) {
      const qx = clamp(u.x, b.x, b.x + b.w), qy = clamp(u.y, b.y, b.y + b.h);
      const dx = u.x - qx, dy = u.y - qy, d = Math.hypot(dx, dy);
      if (d < u.r) {
        if (d > 0.01) { u.x = qx + dx / d * u.r; u.y = qy + dy / d * u.r; }
        else { /* 사각형 안: 가장 가까운 변으로 밀어낸다 */
          const l = u.x - b.x, r = b.x + b.w - u.x, t = u.y - b.y, bt = b.y + b.h - u.y, mn = Math.min(l, r, t, bt);
          if (mn === l) u.x = b.x - u.r; else if (mn === r) u.x = b.x + b.w + u.r; else if (mn === t) u.y = b.y - u.r; else u.y = b.y + b.h + u.r;
        }
      }
    }
    u.x = clamp(u.x, M * 0.5, W - M * 0.5); u.y = clamp(u.y, M * 0.5, H - M * 0.5);
  }

  /* ---------- 생각 ---------- */
  function thinkParty(dt) {
    const ctrl = F.ctrl;
    if (ctrl.alive) {
      const mv = moveVec();
      ctrl.dx = mv.x * ctrl.d.speed * M; ctrl.dy = mv.y * ctrl.d.speed * M;
      if (Math.hypot(mv.x, mv.y) > 0.2) { const n = Math.hypot(mv.x, mv.y); ctrl.mdx = mv.x / n; ctrl.mdy = mv.y / n; }
      /* 부딪혀 공격: 조종하는 영웅은 닿는 적을 저절로 벤다 */
      tryAttack(ctrl, nearest(ctrl, F.enemies, ranged(ctrl) ? ctrl.d.range * M : 3 * M));
    }
    const party = joined(); let slot = 0;
    for (const u of party) {
      if (!u.alive || u.controlled) continue;
      const row = Math.floor(slot / 3), col = (slot % 3) - 1; slot++;
      const bx = ctrl.mdx, by = ctrl.mdy, sx = -by, sy = bx;
      const tight = F.order === 4 ? 0.7 : 1;
      const back = (TUN.formBack + row * TUN.formGap) * tight, side = col * TUN.formGap * tight;
      const slotX = ctrl.x - bx * back + sx * side, slotY = ctrl.y - by * back + sy * side;
      let speed = u.d.speed * M, target = null, gx = slotX, gy = slotY;
      if (F.order === 1) {
        target = nearest(u, F.enemies, TUN.followEngage + (ranged(u) ? u.d.range * M : 0));
        if (target && Math.hypot(u.x - slotX, u.y - slotY) > TUN.followLeash) target = null;
      } else if (F.order === 2) target = nearest(u, F.enemies, TUN.chargeRange);
      else if (F.order === 3) { gx = u.homeX; gy = u.homeY; target = nearest(u, F.enemies, ranged(u) ? u.d.range * M : 2.5 * M, u.homeX, u.homeY); }
      else speed *= TUN.retreatMul;

      if (u.d.kind === 'mage' && u.healCool <= 0) { /* 술사: 가장 다친 동료를 치유 */
        let hurt = null, worst = 0.6;
        for (const o of party) if (o.alive && dist(o, u) < 6 * M && o.hp / o.maxHp < worst) { worst = o.hp / o.maxHp; hurt = o; }
        if (hurt) {
          const h = Math.min(8 + u.level, hurt.maxHp - hurt.hp); hurt.hp += h; u.healCool = 3.5; u.swing = 0.25;
          floatText(hurt.x, hurt.y - 2 * M, '+' + h, '#8dff8d');
          burst(hurt.x, hurt.y - 0.6 * M, 12, '#9dffb0', 120, 0.5, 120, 4);
          sfx.potion();
        }
      }
      if (target) {
        const d = dist(u, target), rc = reach(u, target);
        if (d > rc * 0.85) { gx = target.x; gy = target.y; }
        else if (ranged(u) && d < 2 * M) { gx = u.x + (u.x - target.x) / d * M; gy = u.y + (u.y - target.y) / d * M; }
        else { gx = u.x; gy = u.y; }
        tryAttack(u, target);
      }
      const tx = gx - u.x, ty = gy - u.y, tm = Math.hypot(tx, ty);
      if (tm > 0.25 * M) { const s = speed * clamp(tm / (1.2 * M) + 0.3, 0, 1); u.dx = tx / tm * s; u.dy = ty / tm * s; } else { u.dx = u.dy = 0; }
    }
    for (const u of F.allies) if (u.waiting) { u.dx = u.dy = 0; }
  }

  function thinkEnemies() {
    for (const e of F.enemies) {
      if (!e.alive) continue;
      const aggro = TUN.aggro * (e.hpShow > 0 ? 2 : 1);
      let target = nearest(e, F.allies, aggro);
      if (target && Math.hypot(target.x - e.homeX, target.y - e.homeY) > TUN.leash && e.hpShow <= 0) target = null;
      let gx = e.homeX + Math.sin(e.t * 0.5) * 1.2 * M, gy = e.homeY - Math.cos(e.t * 0.37) * 1.2 * M;
      const speed = (target ? e.d.speed : e.d.speed * 0.35) * M;
      if (target) {
        const d = dist(e, target), rc = reach(e, target);
        if (d > rc * 0.85) { gx = target.x; gy = target.y; } else { gx = e.x; gy = e.y; }
        tryAttack(e, target);
      }
      const tx = gx - e.x, ty = gy - e.y, tm = Math.hypot(tx, ty);
      if (tm > 0.2 * M) { e.dx = tx / tm * speed; e.dy = ty / tm * speed; } else { e.dx = e.dy = 0; }
    }
  }

  function moveAll(dt) {
    const all = F.allies.filter((u) => u.alive).concat(F.enemies.filter((e) => e.alive));
    for (const u of all) {
      u.cool -= dt; u.healCool -= dt; u.swing = Math.max(0, u.swing - dt); u.flash -= dt; u.hpShow -= dt; u.t += dt;
      if (u.pending) { u.pending.t -= dt; if (u.pending.t <= 0) { const p = u.pending; u.pending = null; if (u.alive && p.b.alive && dist(u, p.b) < reach(u, p.b) * 1.5) hit(u, p.b, p.dmg); } }
      const ax = u.dx - u.vx, ay = u.dy - u.vy, am = Math.hypot(ax, ay), step = TUN.accel * dt;
      if (am <= step) { u.vx = u.dx; u.vy = u.dy; } else { u.vx += ax / am * step; u.vy += ay / am * step; }
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (Math.abs(u.vx) > 0.3 * M && u.swing <= 0) u.face = Math.atan2(u.vy, u.vx);
    }
    /* 몸끼리 밀어내기 (큰 몸이 더 세게 민다) */
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      const a = all[i], b = all[j], dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r;
      if (Math.abs(dx) > min || Math.abs(dy) > min) continue;
      const m = Math.hypot(dx, dy); if (m >= min) continue;
      const nx = m > 0.01 ? dx / m : Math.random() - 0.5, ny = m > 0.01 ? dy / m : Math.random() - 0.5;
      const push = Math.min(min - m, TUN.separation * dt * 2);
      let wa = (b.d.size || 1) / ((a.d.size || 1) + (b.d.size || 1));
      if (a.waiting) wa = 0; if (b.waiting) wa = 1;
      a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * (1 - wa); b.y += ny * push * (1 - wa);
    }
    for (const u of all) resolve(u);
  }

  /* ---------- 한 프레임 ---------- */
  function step(dt) {
    F.t += dt;
    const playing = !F.cleared && !F.defeated;
    if (playing) F.time += dt;
    const keysNow = pressed; pressed = [];
    if (!playing && keysNow.some((k) => k === 'enter' || k === 'restart')) { if (onEnd) onEnd({ win: F.cleared }); start(cv, { onEnd }); return; }
    if (playing) {
      for (const k of keysNow) {
        const o = { '1': 1, '2': 2, '3': 3, '4': 4 }[k];
        if (o && o !== F.order) {
          F.order = o;
          if (o === 3) for (const u of F.allies) { u.homeX = u.x; u.homeY = u.y; }
          sfx.order(); banner(`작전: ${ORDER_NAMES[o]} — ${ORDER_DESC[o]}`);
        }
        if (k === 'tab' || k === 'q') switchControl();
        if (k.startsWith('pick:')) { /* 카드 클릭 = 그 영웅 조종 */
          const a = F.allies[+k.slice(5)];
          if (a && a.alive && !a.waiting && a !== F.ctrl) { F.ctrl.controlled = false; F.ctrl = a; a.controlled = true; sfx.order(); banner(`${a.name}(${a.d.role}) 조종`); }
        }
        if ((k === 'h' || k === 'e') && F.ctrl.alive) {
          const u = F.ctrl;
          if (F.potions > 0 && u.hp < u.maxHp) {
            F.potions--; const h = Math.min(TUN.potionHeal, u.maxHp - u.hp); u.hp += h;
            floatText(u.x, u.y - 2 * M, '+' + h, '#8dff8d'); burst(u.x, u.y - 0.6 * M, 12, '#9dffb0', 120, 0.5, 120, 4); sfx.potion();
          } else banner(F.potions === 0 ? '회복약이 없다' : '체력이 가득하다', 1.2);
        }
      }
      thinkParty(dt); thinkEnemies(dt);
    } else { for (const u of F.allies.concat(F.enemies)) { u.dx = u.dy = 0; } }
    moveAll(dt);

    /* 화살·바람·불덩이 */
    for (const s of F.shots) {
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.kind !== 'bow' && Math.random() < dt * 30) F.parts.push({ x: s.x, y: s.y - 0.6 * M, vx: 0, vy: -10, t: 0.25, life: 0.25, col: s.kind === 'mage' ? '#bfeaff' : '#ff9a4a', size: 4 });
      if (s.life <= 0) { s.done = true; continue; }
      const targets = s.owner.team === 0 ? F.enemies : F.allies;
      for (const u of targets) if (hostile(s.owner, u) && Math.hypot(u.x - s.x, u.y - s.y) < u.r + 0.35 * M) { hit(s.owner, u, s.dmg); s.done = true; break; }
    }
    F.shots = F.shots.filter((s) => !s.done);

    /* 줍기 */
    for (const p of F.pickups) {
      let near = null, nd = 1e9;
      for (const u of F.allies) if (u.alive && !u.waiting) { const d = Math.hypot(u.x - p.x, u.y - p.y); if (d < nd) { nd = d; near = u; } }
      p.t += dt;
      if (p.magnet) {
        p.delay -= dt;
        if (p.delay > 0) { p.x += p.vx * dt; p.y += p.vy * dt; p.hv -= 25 * M * dt; p.h = Math.max(0, p.h + p.hv * dt); }
        else if (near) { p.h = Math.max(0, p.h - dt * 3 * M); const sp = (7 + -p.delay * 25) * M * dt, d = Math.max(nd, 0.001); const k = Math.min(1, sp / d); p.x += (near.x - p.x) * k; p.y += (near.y - p.y) * k; nd = Math.hypot(near.x - p.x, near.y - p.y); }
      }
      if (!near || (p.magnet && p.delay > 0) || nd > 0.9 * M) continue;
      p.done = true;
      burst(p.x, p.y - 0.5 * M, 5, p.potion ? '#ff9db0' : '#9fe6ff', 90, 0.25, 30, 3);
      if (p.potion) { F.potions++; floatText(p.x, p.y - M, '회복약 +1', '#ff9db0'); sfx.potion(); }
      else { F.gems++; sfx.gem(F.gems % 8); }
    }
    F.pickups = F.pickups.filter((p) => !p.done);

    /* 동료 합류 · 혼천 샘 */
    const ctrl = F.ctrl;
    for (const u of F.allies) if (u.waiting && ctrl.alive && dist(u, ctrl) < TUN.recruitR) {
      u.waiting = false; u.homeX = u.x; u.homeY = u.y;
      banner(`${u.name}(${u.d.role})이(가) 동료가 되었다!`, 3); sfx.recruit();
      burst(u.x, u.y - 0.8 * M, 18, '#fff1a0', 200, 0.5, 80, 4);
    }
    F.springTick -= dt;
    if (F.springTick <= 0) {
      F.springTick = 1 / TUN.springHps;
      let revived = false;
      const sp = F.map.spring;
      for (const u of F.allies) {
        if (u.waiting) continue;
        if (!u.alive && ctrl.alive && dist(ctrl, sp) < TUN.springR) {
          u.alive = true; u.hp = u.maxHp; const a = Math.random() * 7; u.x = sp.x + Math.cos(a) * 2.5 * M; u.y = sp.y + Math.sin(a) * 2.5 * M; u.vx = u.vy = 0; resolve(u); revived = true;
        } else if (u.alive && u.hp < u.maxHp && dist(u, sp) < TUN.springR + 1.5 * M) {
          u.hp++; if (Math.random() < 0.3) burst(u.x, u.y - 0.6 * M, 1, '#9dffd0', 60, 0.4, 80, 3);
        }
      }
      if (revived) { banner('샘물의 힘으로 동료가 부활했다!'); sfx.recruit(); }
    }

    for (const f of F.floats) { f.t -= dt; f.y -= dt * 1.2 * M; }
    F.floats = F.floats.filter((f) => f.t > 0);
    for (const p of F.parts) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; }
    F.parts = F.parts.filter((p) => p.t > 0);
    F.enemies = F.enemies.filter((e) => e.alive || e === F.boss);
    F.bannerT -= dt; F.shake = Math.max(0, F.shake - dt);

    /* 카메라: 걷는 방향으로 조금 앞서서 부드럽게 따라간다 */
    const vw = cv.width / S.k, vh = cv.height / S.k;
    let tx = ctrl.x + ctrl.vx * 0.35, ty = ctrl.y + ctrl.vy * 0.35 - 0.6 * M;
    tx = clamp(tx, vw / 2 - M, W + M - vw / 2); ty = clamp(ty, vh / 2 - M, H + M - vh / 2);
    smoothDamp(F.cam, 'x', 'vx', tx, 0.25, dt); smoothDamp(F.cam, 'y', 'vy', ty, 0.25, dt);
  }
  function smoothDamp(o, k, vk, target, time, dt) {
    const om = 2 / time, x = om * dt, e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const ch = o[k] - target, tmp = (o[vk] + om * ch) * dt;
    o[vk] = (o[vk] - om * tmp) * e; o[k] = target + (ch + tmp) * e;
  }

  function loop(ts) {
    raf = requestAnimationFrame(loop);
    if (!F) return;
    const dt = Math.min(1 / 30, Math.max(0, (ts - last) / 1000)); last = ts;
    sizeCanvas();
    step(dt);
    if (F) render();
  }
  function sizeCanvas() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    S = { k: cv.height / TUN.viewH, ui: cv.height / 720 };
  }

  /* ---------- 그리기 ---------- */
  function render() {
    const k = S.k, cw = cv.width, ch = cv.height, vw = cw / k, vh = ch / k;
    const sh = F.shake > 0 ? (Math.random() - 0.5) * 6 : 0;
    const ox = F.cam.x - vw / 2 + sh, oy = F.cam.y - vh / 2 + sh;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2e3a26'; c.fillRect(0, 0, cw, ch);
    c.setTransform(k, 0, 0, k, -ox * k, -oy * k);
    c.imageSmoothingEnabled = true;
    c.drawImage(F.ground, 0, 0, W, H);
    /* 흐르는 물결 */
    c.fillStyle = 'rgba(220,240,255,0.25)';
    for (let i = 0; i < 40; i++) { const y = ((i * 197 - F.t * 1.5 * M) % H + H) % H, x = 46 * M + Math.sin(i * 3.3) * 1.3 * M; if (y > oy - 40 && y < oy + vh + 40) { c.beginPath(); c.ellipse(x, y, 0.25 * M, 0.7 * M, 0, 0, 7); c.fill(); } }
    /* 샘 반짝임 */
    const sp = F.map.spring;
    c.fillStyle = `rgba(200,250,255,${0.25 + 0.15 * Math.sin(F.t * 3)})`; c.beginPath(); c.ellipse(sp.x, sp.y, 1.4 * M, 0.9 * M, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(200,250,255,0.7)'; c.font = `bold ${0.5 * M}px sans-serif`; c.textAlign = 'center'; c.fillText('혼천 샘', sp.x, sp.y + 2.4 * M);

    /* 깊이 순서대로 (발 위치 y) */
    const inView = (x, y, pad = 4 * M) => x > ox - pad && x < ox + vw + pad && y > oy - pad && y < oy + vh + pad * 1.5;
    const list = [];
    for (const p of F.map.props) if (p.type === 'wall' ? true : inView(p.x, p.y)) list.push({ y: p.y, p });
    for (const u of F.allies) if (u.alive && inView(u.x, u.y)) list.push({ y: u.y, u });
    for (const u of F.enemies) if (u.alive && inView(u.x, u.y)) list.push({ y: u.y, u });
    for (const p of F.pickups) if (inView(p.x, p.y)) list.push({ y: p.y, pk: p });
    list.sort((a, b) => a.y - b.y);
    /* 그림자·조종 표시는 먼저 (땅에 붙어 있게) */
    for (const it of list) if (it.u) {
      const u = it.u, s = u.d.size || 1;
      c.fillStyle = 'rgba(20,25,15,0.4)'; c.beginPath(); c.ellipse(u.x, u.y + u.r * 0.75, 0.55 * M * s, 0.22 * M * s, 0, 0, 7); c.fill();
      if (u.controlled) {
        c.strokeStyle = `rgba(255,220,90,${0.55 + Math.sin(F.t * 5) * 0.25})`; c.lineWidth = 3;
        c.beginPath(); c.ellipse(u.x, u.y + u.r * 0.75, 0.8 * M, 0.34 * M, 0, 0, 7); c.stroke();
      }
      if (u.boss) {
        const g = c.createRadialGradient(u.x, u.y, 0, u.x, u.y, 2.4 * M);
        g.addColorStop(0, `rgba(200,30,40,${0.35 + 0.1 * Math.sin(F.t * 4)})`); g.addColorStop(1, 'rgba(200,30,40,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(u.x, u.y, 2.4 * M, 1.1 * M, 0, 0, 7); c.fill();
      }
    }
    for (const it of list) {
      if (it.p) drawProp(it.p);
      else if (it.u) drawUnit(it.u);
      else drawPickup(it.pk);
    }
    /* 날아가는 것들 */
    for (const s of F.shots) drawShot(s);
    c.globalCompositeOperation = 'lighter';
    for (const p of F.parts) { c.globalAlpha = Math.max(0, p.t / p.life); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size, 0, 7); c.fill(); }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    /* 체력 막대 · 말풍선 */
    for (const it of list) if (it.u) overlay(it.u);
    for (const f of F.floats) {
      c.globalAlpha = clamp(f.t * 2, 0, 1); c.font = `900 ${f.size}px sans-serif`; c.textAlign = 'center';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,0.75)'; c.strokeText(f.s, f.x, f.y); c.fillStyle = f.col; c.fillText(f.s, f.x, f.y);
    }
    c.globalAlpha = 1;
    c.setTransform(1, 0, 0, 1, 0, 0);
    /* 가장자리 어둡게 */
    const vg = c.createRadialGradient(cw / 2, ch / 2, ch * 0.35, cw / 2, ch / 2, ch * 0.95);
    vg.addColorStop(0, 'rgba(10,14,20,0)'); vg.addColorStop(1, 'rgba(10,14,20,0.55)');
    c.fillStyle = vg; c.fillRect(0, 0, cw, ch);
    hud();
  }

  function drawProp(p) {
    if (p.type === 'tree') {
      const im = treeImg(p.v), s = p.s * 1.25, sw = Math.sin(F.t * 1.6 + p.t) * 0.02;
      c.fillStyle = 'rgba(15,25,10,0.4)'; c.beginPath(); c.ellipse(p.x + 0.3 * M, p.y, 1.3 * M * s, 0.5 * M * s, 0, 0, 7); c.fill();
      c.save(); c.translate(p.x, p.y + 4); c.rotate(sw); c.drawImage(im, -80 * s * 0.5, -196 * s * 0.5, 160 * s * 0.5, 200 * s * 0.5); c.restore();
    } else if (p.type === 'rock') {
      const s = p.s;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(p.x, p.y, 0.9 * M * s, 0.3 * M * s, 0, 0, 7); c.fill();
      c.fillStyle = '#77736a'; c.beginPath(); c.ellipse(p.x, p.y - 0.4 * M * s, 0.75 * M * s, 0.55 * M * s, 0, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.ellipse(p.x - 0.25 * M * s, p.y - 0.65 * M * s, 0.35 * M * s, 0.2 * M * s, 0, 0, 7); c.fill();
    } else if (p.type === 'house') {
      const x = p.x, y = p.y;
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(x + 0.3 * M, y, 2.5 * M, 0.7 * M, 0, 0, 7); c.fill();
      c.fillStyle = '#d8cdb3'; c.fillRect(x - 1.8 * M, y - 2.2 * M, 3.6 * M, 2.2 * M); /* 흙벽 */
      c.fillStyle = '#5a4030'; c.fillRect(x - 1.8 * M, y - 2.2 * M, 0.15 * M, 2.2 * M); c.fillRect(x + 1.65 * M, y - 2.2 * M, 0.15 * M, 2.2 * M); c.fillRect(x - 0.1 * M, y - 2.2 * M, 0.15 * M, 2.2 * M);
      c.fillStyle = '#4a3324'; c.fillRect(x + 0.4 * M, y - 1.4 * M, 0.7 * M, 1.4 * M); /* 문 */
      c.fillStyle = '#f2d98e'; c.fillRect(x - 1.2 * M, y - 1.5 * M, 0.6 * M, 0.5 * M);
      c.fillStyle = p.roof; c.beginPath(); /* 초가 지붕 */
      c.moveTo(x - 2.3 * M, y - 2.0 * M); c.quadraticCurveTo(x, y - 4.2 * M, x + 2.3 * M, y - 2.0 * M); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(80,55,25,0.5)'; c.lineWidth = 2;
      for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(x - 2.2 * M + i * 0.15 * M, y - 2.0 * M - i * 0.4 * M); c.quadraticCurveTo(x, y - 3.9 * M + i * 0.1 * M, x + 2.2 * M - i * 0.15 * M, y - 2.0 * M - i * 0.4 * M); c.stroke(); }
    } else if (p.type === 'wall') {
      const r = p.r, hh = 1.8 * M;
      c.fillStyle = '#5d5a55'; c.fillRect(r.x, r.y - hh, r.w, r.h + hh); /* 성벽 몸 */
      c.fillStyle = '#6f6b64'; c.fillRect(r.x, r.y + r.h - hh * 0.9, r.w, hh * 0.9); /* 앞면 */
      c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2;
      for (let yy = r.y + r.h - hh * 0.9; yy < r.y + r.h; yy += 0.45 * M) { c.beginPath(); c.moveTo(r.x, yy); c.lineTo(r.x + r.w, yy); c.stroke(); }
      c.fillStyle = '#3c3a38'; /* 여장 */
      if (r.w > r.h) for (let x = r.x + 0.2 * M; x < r.x + r.w - 0.3 * M; x += 1.1 * M) c.fillRect(x, r.y - hh - 0.45 * M, 0.6 * M, 0.5 * M);
      else for (let y = r.y - hh; y < r.y + r.h - hh; y += 1.1 * M) c.fillRect(r.x + 0.1 * M, y - 0.45 * M, r.w - 0.2 * M, 0.5 * M);
    } else if (p.type === 'torch') {
      c.fillStyle = '#3a2a1c'; c.fillRect(p.x - 3, p.y - 1.8 * M, 6, 1.8 * M);
      const fl = 1 + Math.sin(F.t * 9 + p.t) * 0.12;
      c.globalCompositeOperation = 'lighter';
      const g = c.createRadialGradient(p.x, p.y - 1.9 * M, 0, p.x, p.y - 1.9 * M, 1.2 * M * fl);
      g.addColorStop(0, 'rgba(255,200,110,0.9)'); g.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y - 1.9 * M, 1.2 * M * fl, 0, 7); c.fill();
      c.globalCompositeOperation = 'source-over';
    }
  }

  function drawUnit(u) {
    const s = u.d.size || 1;
    if (u.wisp) {
      Sprites.wisp(c, { x: u.x, y: u.y, r: 9 * s, team: 1, kind: 'wisp', color: u.color, swing: u.swing, face: u.face, bob: u.bob, vx: u.vx, vy: u.vy, flash: u.flash, stype: u.d.kind === 'imp' ? 'archer' : '' }, F.t);
      return;
    }
    /* 게임 전투와 같은 그리기 (무명·저승차사 = 뼈대, 나머지 = 시트) */
    const big = u.d.kind === 'boss' ? 1.45 : u.d.kind === 'brute' ? 1.15 : 1;
    const gy = u.y + u.r * 0.75;
    c.save();
    if (big !== 1) { c.translate(u.x, gy); c.scale(big, big); c.translate(-u.x, -gy); }
    if (u.boss) c.filter = 'hue-rotate(85deg) saturate(1.7) brightness(0.85)';
    const ok = Art.drawActor(c, u, F.t);
    c.filter = 'none';
    c.restore();
    if (!ok) { c.fillStyle = u.team ? '#c55' : '#7cd'; c.beginPath(); c.arc(u.x, u.y - 0.8 * M, 0.45 * M * s, 0, 7); c.fill(); }
  }

  function overlay(u) {
    const s = u.d.size || 1, top = u.y - (u.wisp ? 1.3 * M * s : 2.2 * M * (u.d.kind === 'boss' ? 1.5 : u.d.kind === 'brute' ? 1.15 : 1));
    if (u.waiting) { /* 합류를 기다리는 동료: 머리 위 ! */
      const by = top - 0.5 * M + Math.sin(F.t * 5) * 0.12 * M;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(u.x, by, 0.32 * M, 0, 7); c.fill();
      c.fillStyle = '#e8742f'; c.font = `900 ${0.5 * M}px sans-serif`; c.textAlign = 'center'; c.fillText('!', u.x, by + 0.18 * M);
      c.fillStyle = 'rgba(255,240,180,0.95)'; c.font = `bold ${0.36 * M}px sans-serif`; c.fillText(u.name, u.x, u.y + 1.0 * M);
      return;
    }
    const bar = u.hpShow > 0 || (u.controlled && u.hp < u.maxHp) || (u.team === 0 && u.hp < u.maxHp * 0.999);
    if (!bar || u.boss) return;
    const w = 0.95 * M, f = u.hp / u.maxHp;
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(u.x - w / 2, top, w, 6);
    c.fillStyle = u.team === 0 ? `hsl(${f * 120},70%,55%)` : '#ff6a5a'; c.fillRect(u.x - w / 2 + 1, top + 1, (w - 2) * f, 4);
  }

  function drawPickup(p) {
    const y = p.y - (p.potion ? 0.45 : 0.5) * M - p.h - Math.sin(p.t * 3) * 0.1 * M;
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(p.x, p.y, 0.25 * M, 0.1 * M, 0, 0, 7); c.fill();
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(p.x, y, 0, p.x, y, 0.55 * M);
    g.addColorStop(0, p.potion ? 'rgba(255,110,140,0.6)' : 'rgba(110,200,255,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(p.x, y, 0.55 * M, 0, 7); c.fill();
    c.globalCompositeOperation = 'source-over';
    if (p.potion) { /* 호리병 */
      c.fillStyle = '#c84a5e'; c.beginPath(); c.arc(p.x, y + 4, 0.2 * M, 0, 7); c.fill(); c.beginPath(); c.arc(p.x, y - 0.18 * M, 0.12 * M, 0, 7); c.fill();
      c.fillStyle = '#6b4a2a'; c.fillRect(p.x - 3, y - 0.36 * M, 6, 5);
    } else { /* 혼석 */
      const w = 0.21 * M * Math.cos(p.t * 3.2), h = 0.26 * M;
      c.fillStyle = '#67c3f2'; c.beginPath(); c.moveTo(p.x, y - h); c.lineTo(p.x + w, y); c.lineTo(p.x, y + h); c.lineTo(p.x - w, y); c.closePath(); c.fill();
      c.fillStyle = 'rgba(230,248,255,0.8)'; c.beginPath(); c.moveTo(p.x, y - h); c.lineTo(p.x + w * 0.4, y - h * 0.2); c.lineTo(p.x, y); c.closePath(); c.fill();
    }
  }

  function drawShot(s) {
    const y = s.y - 0.6 * M, a = Math.atan2(s.vy, s.vx);
    c.save(); c.translate(s.x, y); c.rotate(a);
    if (s.kind === 'bow') {
      c.strokeStyle = '#8a6a44'; c.lineWidth = 3; c.beginPath(); c.moveTo(-0.35 * M, 0); c.lineTo(0.3 * M, 0); c.stroke();
      c.fillStyle = '#dfe6ee'; c.beginPath(); c.moveTo(0.42 * M, 0); c.lineTo(0.28 * M, -5); c.lineTo(0.28 * M, 5); c.fill();
    } else {
      c.globalCompositeOperation = 'lighter';
      const col = s.kind === 'mage' ? '170,230,255' : '255,140,60';
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 0.6 * M);
      g.addColorStop(0, `rgba(${col},0.95)`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g;
      if (s.kind === 'mage') { c.beginPath(); c.ellipse(0, 0, 0.7 * M, 0.3 * M, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(240,250,255,0.8)'; c.lineWidth = 2; c.beginPath(); c.arc(-0.2 * M, 0, 0.4 * M, -1, 1); c.stroke(); }
      else { c.beginPath(); c.arc(0, 0, 0.6 * M, 0, 7); c.fill(); }
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }

  /* ---------- 화면 정보 (HUD) ---------- */
  function box(x, y, w, h, col, r = 8) { c.fillStyle = col; c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); c.fill(); }
  function text(s, x, y, col = '#fff', size = 18, align = 'left', weight = 700) {
    c.font = `${weight} ${size}px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif`; c.textAlign = align; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(0,0,0,0.7)'; c.fillText(s, x + 1.5, y + 1.5); c.fillStyle = col; c.fillText(s, x, y);
  }
  function hud() {
    const u = S.ui, Wd = cv.width / u;
    c.setTransform(u, 0, 0, u, 0, 0);
    hudButtons = [];
    /* 목표 · 작전 · 기록 (왼쪽 위) */
    box(16, 16, 392, 112, 'rgba(14,16,24,0.65)');
    text('목표: 북동쪽 산성의 흑귀 장군 격파', 28, 36, '#ffd36a', 17);
    for (let i = 1; i <= 4; i++) {
      const bx = 28 + (i - 1) * 92, by = 52, on = i === F.order;
      box(bx, by, 86, 30, on ? 'rgba(255,205,80,0.95)' : 'rgba(255,255,255,0.12)', 6);
      text(`${i} ${ORDER_NAMES[i]}`, bx + 43, by + 15, on ? '#2a1a08' : '#fff', 16, 'center');
      hudButtons.push({ x: bx, y: by, w: 86, h: 30, key: String(i) });
    }
    const tm = F.cleared || F.defeated ? F.endTime : F.time;
    text(`◆ ${F.gems}/${F.gemTotal}    회복약 ${F.potions}    처치 ${F.kills}    ${String(Math.floor(tm / 60)).padStart(2, '0')}:${String(Math.floor(tm % 60)).padStart(2, '0')}`, 28, 108, '#e8f4ff', 16);

    /* 작은 지도 */
    const mm = { x: 16, y: 136, w: 220, h: 140 };
    box(mm.x, mm.y, mm.w, mm.h, 'rgba(14,16,24,0.65)', 6);
    const mx = (x) => mm.x + x / W * mm.w, my = (y) => mm.y + y / H * mm.h;
    c.fillStyle = 'rgba(90,150,200,0.8)'; c.fillRect(mx(44 * M), mm.y, 4 / MAP_W * mm.w, mm.h);
    const fr = R(86, 46, 20, 20); c.fillStyle = 'rgba(160,150,140,0.7)'; c.fillRect(mx(fr.x), my(fr.y), fr.w / W * mm.w, fr.h / H * mm.h);
    const dot = (x, y, col, r) => { c.fillStyle = col; c.beginPath(); c.arc(mx(x), my(y), r / 2, 0, 7); c.fill(); };
    dot(F.map.spring.x, F.map.spring.y, '#8ff', 6);
    for (const e of F.enemies) if (e.alive) dot(e.x, e.y, e === F.boss ? '#ffcc33' : '#ff5a5a', e === F.boss ? 7 : 4);
    for (const a of F.allies) if (a.alive) dot(a.x, a.y, a.waiting ? '#ffe066' : a.controlled ? '#fff' : '#66ff88', a.controlled ? 6 : 4);
    /* 시야 사각형 */
    const vw = cv.width / S.k, vh = cv.height / S.k;
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1; c.strokeRect(mx(F.cam.x - vw / 2), my(F.cam.y - vh / 2), vw / W * mm.w, vh / H * mm.h);

    /* 동료 카드 (오른쪽) */
    F.allies.forEach((a, n) => {
      const y = 16 + n * 56, x = Wd - 256;
      if (a.waiting) { box(x, y, 240, 50, 'rgba(14,16,24,0.35)'); text('? ? ?', x + 64, y + 25, 'rgba(255,255,255,0.4)', 18); return; }
      if (a.controlled) box(x - 2, y - 2, 244, 54, 'rgba(255,215,90,0.95)', 9);
      box(x, y, 240, 50, a.controlled ? 'rgba(14,16,24,0.88)' : 'rgba(14,16,24,0.65)');
      const im = portrait(a.hid);
      c.save(); c.beginPath(); c.arc(x + 27, y + 25, 20, 0, 7); c.clip();
      if (im) { const s = Math.min(im.naturalWidth, im.naturalHeight); c.globalAlpha = a.alive ? 1 : 0.35; c.drawImage(im, (im.naturalWidth - s) / 2, 0, s, s, x + 7, y + 5, 40, 40); c.globalAlpha = 1; }
      else { c.fillStyle = '#556'; c.fillRect(x + 7, y + 5, 40, 40); }
      c.restore();
      text(`${a.name}`, x + 56, y + 14, '#fff', 16);
      text(`${a.d.role} Lv${a.level}`, x + 56 + c.measureText(a.name).width + 8, y + 15, '#c9d3e0', 12, 'left', 500);
      const f = a.hp / a.maxHp;
      box(x + 56, y + 28, 120, 12, 'rgba(0,0,0,0.55)', 3);
      box(x + 57, y + 29, 118 * f, 10, `hsl(${f * 120},70%,52%)`, 3);
      text(a.alive ? `${a.hp}/${a.maxHp}` : '쓰러짐', x + 182, y + 34, a.alive ? '#fff' : '#ff9a9a', 12, 'left', 500);
      hudButtons.push({ x, y, w: 240, h: 50, key: 'pick:' + n });
    });

    /* 보스 체력 */
    const b = F.boss;
    if (b && b.alive && dist(b, F.ctrl) < 16 * M) {
      const bw = 500, bx = Wd / 2 - bw / 2, by = 720 - 70;
      text('흑귀 장군', Wd / 2, by - 16, '#ffcf6a', 18, 'center');
      box(bx, by, bw, 20, 'rgba(0,0,0,0.6)', 4); box(bx + 2, by + 2, (bw - 4) * b.hp / b.maxHp, 16, '#d8343f', 3);
    }
    /* 조작 안내 */
    text('WASD 이동(적에게 닿으면 공격)  ·  1~4 작전  ·  Tab 영웅 바꾸기  ·  H 회복약', 20, 720 - 20, 'rgba(255,255,255,0.75)', 13, 'left', 500);
    /* 알림 */
    if (F.bannerT > 0 && !(F.cleared || F.defeated)) {
      c.globalAlpha = clamp(F.bannerT * 2, 0, 1);
      box(Wd / 2 - 300, 150, 600, 44, 'rgba(10,12,18,0.6)', 10); text(F.banner, Wd / 2, 172, '#fff', 20, 'center');
      c.globalAlpha = 1;
    }
    if (F.cleared || F.defeated) {
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, Wd, 720);
      text(F.cleared ? '승리!' : '패배...', Wd / 2, 300, F.cleared ? '#ffe28a' : '#ff8a8a', 56, 'center', 900);
      text(`처치 ${F.kills}   ◆ ${F.gems}/${F.gemTotal}   시간 ${Math.floor(F.endTime)}초`, Wd / 2, 360, '#fff', 20, 'center');
      box(Wd / 2 - 110, 400, 220, 44, 'rgba(255,205,80,0.95)', 10); text('다시 하기 (Enter)', Wd / 2, 422, '#2a1a08', 18, 'center');
      hudButtons.push({ x: Wd / 2 - 110, y: 400, w: 220, h: 44, key: 'restart' });
    }
  }

  /* 시험용 */
  const debug = {
    state: () => F, script: SCRIPT, press: (k) => pressed.push(k),
    teleport: (ux, uy) => { const p = P(ux, uy); for (const u of joined()) { u.x = p.x + rr(-M, M); u.y = p.y + rr(-M, M); } F.cam.x = p.x; F.cam.y = p.y; },
    step: (sec, h = 1 / 60) => { sizeCanvas(); for (let t = 0; t < sec; t += h) step(h); render(); },
    pause: () => { cancelAnimationFrame(raf); raf = 0; },
  };
  return { start, stop, debug, M };
})();
