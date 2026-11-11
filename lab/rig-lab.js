'use strict';
/* ===== 뼈대(컷아웃) 애니메이션: 조각 그림을 관절에 붙여 매 프레임 각도로 움직인다 =====
   레이맨 레전드처럼 장면 그림 없이도 걷기·공격·숨쉬기가 부드럽게 이어진다.
   지금은 무명(hero) 시험판만 있다. 다른 장수는 기존 4장면 시트를 쓴다. */
const RigLab = (() => {
  const BASE = '../';
  /* 조각 위치(아틀라스 좌표)와 관절(pivot)·붙는 점(at)은 조각 기준 좌표 */
  const DEFS = {
    hero: {
      src: 'img/rig/hero.png',
      height: 477, /* 서 있을 때 머리끝~발끝 (아틀라스 단위) */
      leg: 229,    /* 엉덩이~발바닥 (다리 배율 반영) */
      /* 조각별 배율: 머리는 줄이고 팔다리는 길게 늘려 7등신 정도로 */
      scale: { head: 0.72, torso: 0.9, leg: [1.0, 1.2], arm: [1.0, 1.15] }, /* [가로, 세로] */
      parts: {
        head: { r: [103, 0, 105, 117], pv: [51.1, 103.1] },
        torso: { r: [0, 0, 101, 259], pv: [50.9, 208], neck: [49.5, 12.3], shF: [31.3, 54.8], shB: [22.9, 53.7], belt: [60.7, 153.5] },
        uarmF: { r: [554, 0, 48, 96], pv: [27.1, 11.6], elbow: [24, 82.2] },
        uarmB: { r: [604, 0, 48, 96], pv: [27.1, 11.6], elbow: [24, 82.2] },
        farmF: { r: [654, 0, 43, 84], pv: [13.6, 4.7], grip: [31, 73.6], cuff: [18.6, 23.3] },
        farmB: { r: [699, 0, 43, 84], pv: [13.6, 4.7], grip: [31, 73.6], cuff: [18.6, 23.3] },
        thighF: { r: [382, 0, 85, 108], pv: [47, 5.5], knee: [35.6, 98] },
        shinF: { r: [210, 0, 85, 110], pv: [35.6, 11.4] },
        thighB: { r: [469, 0, 83, 108], pv: [46.1, 5.5], knee: [34.7, 98] },
        shinB: { r: [297, 0, 83, 109], pv: [34.7, 11.4] },
      },
    },
  };
  /* 갑옷: 몸과 따로 그린 조각. 몸통은 갑옷 입은 몸통으로 통째로 바꾸고, 팔에는 팔찌를 덧입힌다 (없으면 기본 저고리) */
  const ARMOR = {
    chalgap: {
      src: 'img/rig/armor_chalgap.png',
      parts: {
        torso: { r: [0, 0, 98, 232], pv: [53.9, 207.9] },
        brcF: { r: [100, 0, 30, 60], pv: [19.0, 2.4] },
        brcB: { r: [132, 0, 30, 60], pv: [19.0, 2.4] },
      },
    },
    dujeong: {
      src: 'img/rig/armor_dujeong.png',
      parts: {
        torso: { r: [0, 0, 110, 257], pv: [56.9, 207.9] },
        brcF: { r: [112, 0, 22, 59], pv: [11.0, 2.6] },
        brcB: { r: [136, 0, 22, 59], pv: [11.0, 2.6] },
      },
    },
  };
  const ARMOR_OF = { a_chalgap: 'chalgap', a_yongrin: 'chalgap', a_dujeong: 'dujeong' };
  /* 무기: 손에 쥐는 별도 조각. 지금은 무명의 환도 하나 */
  const WEAPONS = {
    hwando: {
      src: 'img/rig/wpn_hwando.png',
      parts: {
        blade: { r: [0, 0, 32, 254], pv: [20.9, 185.3], tip: [13.3, 0.9] },
      },
    },
  };
  const WEAPON_OF = { w_hwando: 'hwando' };
  const imgs = Object.create(null);
  function img(src) {
    let im = imgs[src];
    if (!im) { im = new Image(); im.src = BASE + src; imgs[src] = im; }
    return im.complete && im.naturalWidth > 0 ? im : null;
  }
  function has(id) { const d = DEFS[id]; return !!(d && img(d.src)); }
  function warm() {
    Object.values(DEFS).forEach((d) => img(d.src));
    Object.values(ARMOR).forEach((d) => img(d.src));
    Object.values(WEAPONS).forEach((d) => img(d.src));
  }
  /* 입은 갑옷·든 무기 → 그림 세트 (그림이 아직 안 불렸으면 없이 그린다) */
  function armorSet(u) { const a = ARMOR[ARMOR_OF[u.armorId]]; const im = a && img(a.src); return im ? { im, P: a.parts } : null; }
  function weaponSet(u) {
    const key = WEAPON_OF[u.w1Id] || ((!u.w1 || u.w1 === 'sword' || u.w1 === 'dagger') ? 'hwando' : 'hwando');
    const w = WEAPONS[key]; const im = w && img(w.src); return im ? { im, P: w.parts } : null;
  }

  const ease = (k) => k * k * (3 - 2 * k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));

  /* 자세 계산: 상태(대기·걷기·공격·피격)를 섞어 관절 각도를 만든다 (라디안, 0 = 아래로 늘어뜨림) */
  const lerp = (a, b, k) => a + (b - a) * k;
  const smooth = (k) => { k = clamp01(k); return k * k * k * (k * (k * 6 - 15) + 10); };
  /* ===== 자세 =====
     다리는 각도 대신 '발 위치'를 정하고 두 관절 역운동학(IK)으로 무릎을 굽힌다.
     그래서 몸이 내려가면 무릎이 자연스럽게 굽고, 디딘 발은 땅에 붙어 있다.
     좌표: 원점 = 엉덩이 바로 아래 땅, x = 앞(+), hipH = 엉덩이 높이, fFx/fBx = 앞·뒷발 x, fFl/fBl = 발 들림 */
  const L = 229;
  const K = {
    idle:   { hipX: 0,  hipH: L * 0.975, fFx: 16, fBx: -14, fFl: 0, fBl: 0, lean: 0.04, head: 0,     uarmF: 0.1,  farmF: -0.45, sword: 1.55, uarmB: 0.06, farmB: -0.25 },
    /* 적 앞에서 칼끝을 겨눈 자세: 다리를 벌리고 무릎을 굽혀 낮춘다 */
    stance: { hipX: -2, hipH: L * 0.9,  fFx: 52, fBx: -46, fFl: 0, fBl: 0, lean: 0.1,  head: 0.04,  uarmF: -0.75, farmF: -0.85, sword: 2.55, uarmB: -0.35, farmB: -0.9 },
    /* 준비: 체중을 뒷발로, 칼을 머리 뒤로 젖힌다 */
    wind:   { hipX: -14, hipH: L * 0.885, fFx: 52, fBx: -46, fFl: 0, fBl: 0, lean: -0.1, head: -0.04, uarmF: -2.85, farmF: -0.75, sword: 1.45, uarmB: -1.2, farmB: -0.7 },
    /* 베기: 앞발을 크게 내딛으며 몸을 앞으로 던진다 */
    hit:    { hipX: 26, hipH: L * 0.84, fFx: 96, fBx: -44, fFl: 0, fBl: 0, lean: 0.22, head: 0.06,  uarmF: -0.35, farmF: -0.1, sword: 2.45, uarmB: 0.55, farmB: -0.35 },
    /* 마무리: 칼이 아래로 빠져나가고 몸이 조금 더 숙여진다 */
    over:   { hipX: 30, hipH: L * 0.83, fFx: 96, fBx: -44, fFl: 0, fBl: 0, lean: 0.27, head: 0.08,  uarmF: 0.3,  farmF: -0.15, sword: 2.6, uarmB: 0.7, farmB: -0.3 },
  };
  const KEYS = Object.keys(K.idle);
  function blend(P, B, k) { if (k <= 0) return; for (const key of KEYS) P[key] = lerp(P[key], B[key], k); }
  function snap(P) { const o = {}; for (const key of KEYS) o[key] = P[key]; return o; }
  /* 공격 시간표(초): 베기 → 마무리 → 겨눔으로 복귀 */
  const STRIKE = 0.09, OVER = 0.18, BACK = 0.5;
  /* 걷기 한 주기: 한 발이 땅을 미는 구간 55%, 공중에서 앞으로 나가는 구간 45% */
  const STRIDE = L * 0.62, DUTY = 0.55, LIFT = L * 0.16;
  function footCycle(q) {
    q = ((q % 1) + 1) % 1;
    if (q < DUTY) return { x: STRIDE / 2 - STRIDE * (q / DUTY), l: 0 };
    const s = (q - DUTY) / (1 - DUTY);
    return { x: -STRIDE / 2 + STRIDE * smooth(s), l: Math.sin(Math.PI * s) * LIFT * (0.6 + 0.4 * (1 - s)) };
  }

  function pose(u, t) {
    const w = u.walkW || 0, p = u.walkPh || 0;
    const br = Math.sin(t * 2.1 + (u.bob || 0));
    const P = snap(K.idle);
    P.hipH += br * 1.2; P.lean += br * 0.01; P.head += Math.sin(t * 2.1 + 0.6 + (u.bob || 0)) * 0.025;
    P.uarmF += br * 0.02; P.uarmB -= br * 0.02;
    if (w > 0) {
      const f = footCycle(p), b = footCycle(p + 0.5);
      const c2 = Math.cos(2 * Math.PI * p);
      /* 발을 디딘 직후 가장 낮고, 두 발이 엇갈릴 때 가장 높다 */
      const Wk = {
        hipX: 0, hipH: L * 0.94 - 7 * Math.cos(4 * Math.PI * (p - 0.06)),
        fFx: f.x, fBx: b.x, fFl: f.l, fBl: b.l,
        lean: 0.1 + 0.02 * Math.cos(4 * Math.PI * p), head: -0.05 - 0.02 * Math.cos(4 * Math.PI * p),
        /* 팔은 같은 쪽 다리와 반대로 흔든다 */
        uarmF: 0.05 + 0.22 * c2, farmF: -0.55 - 0.25 * Math.max(0, -c2), sword: 1.5,
        uarmB: 0.05 - 0.3 * c2, farmB: -0.3 - 0.35 * Math.max(0, c2),
      };
      blend(P, Wk, w);
    }
    blend(P, K.stance, ease(u.stanceW || 0));
    const rest = snap(P);
    const wu = (u.stanceW || 0) > 0.5 && !(u.atkE >= 0) ? clamp01(1 - (u.atkT || 0) / 0.32) : 0;
    blend(P, K.wind, smooth(wu));
    const e = u.atkE;
    if (e >= 0) {
      if (e < STRIKE) {
        const k = e / STRIKE;
        Object.assign(P, snap(K.wind)); blend(P, K.hit, k * k * (3 - 2 * k) * 0.3 + k * k * 0.7);
        P.fFl = Math.sin(Math.PI * k) * 16; /* 앞발을 들어 내딛는다 */
      } else if (e < OVER) { Object.assign(P, snap(K.hit)); blend(P, K.over, smooth((e - STRIKE) / (OVER - STRIKE))); }
      else {
        const k = (e - OVER) / (BACK - OVER);
        Object.assign(P, snap(K.over)); blend(P, rest, smooth(k));
        if (k < 0.6) P.fFl = Math.sin(Math.PI * k / 0.6) * 10; /* 앞발을 다시 끌어온다 */
      }
    }
    if (u.flash > 0) { const h = Math.min(1, u.flash * 6); P.lean -= 0.16 * h; P.head -= 0.15 * h; P.hipX -= 8 * h; }
    if (u.stun > 0) P.head += Math.sin(t * 9) * 0.12;
    return P;
  }
  /* 두 관절 IK: 엉덩이(0,0)에서 발(fx, fy)까지. 각도 0 = 아래, 음수 = 앞. 무릎은 앞으로 굽는다 */
  function legIK(fx, fy, L1, L2) {
    let d = Math.hypot(fx, fy);
    d = Math.min(d, (L1 + L2) * 0.9995);
    d = Math.max(d, Math.abs(L1 - L2) + 1);
    const a = Math.atan2(-fx, fy);
    const al = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const kn = Math.PI - Math.acos(clamp((L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2), -1, 1));
    return { thigh: a - al, knee: kn };
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* s = 조각 크기 배율 (인체 비율 맞춤용, 관절 위치도 같이 늘어난다) */
  function part(c, im, p, s = 1) {
    const sx = s.length ? s[0] : s, sy = s.length ? s[1] : s;
    c.drawImage(im, p.r[0], p.r[1], p.r[2], p.r[3], -p.pv[0] * sx, -p.pv[1] * sy, p.r[2] * sx, p.r[3] * sy);
  }
  function at(c, from, pt, s = 1) {
    const sx = s.length ? s[0] : s, sy = s.length ? s[1] : s;
    c.translate((pt[0] - from.pv[0]) * sx, (pt[1] - from.pv[1]) * sy);
  }

  function draw(c, u, t, gy, dir, hPx, dtHint) {
    const d = DEFS[u.hid];
    const im = img(d.src);
    const Pp = d.parts;
    const AR = armorSet(u), WP = weaponSet(u);
    const spd = Math.hypot(u.vx || 0, u.vy || 0);
    const moving = spd > 12 && (u.stun || 0) <= 0;
    /* 걸음 위상은 실제 이동 거리로 진행: 미끄러지지 않게 */
    const dt = Math.min(0.05, Math.max(0, t - (u.rigT != null ? u.rigT : t)));
    u.rigT = t;
    const k0 = hPx / d.height;
    /* 걸음 위상은 실제 이동 거리로 진행 → 디딘 발이 미끄러지지 않는다 */
    u.walkPh = (u.walkPh || 0) + spd * dt / ((STRIDE / DUTY) * k0);
    u.walkW = (u.walkW || 0) + ((moving ? 1 : 0) - (u.walkW || 0)) * Math.min(1, dt * 8);
    /* 전투 쪽에서 공격이 새로 시작되면(swing 값이 다시 올라가면) 내려베기를 처음부터 재생 */
    if ((u.swing || 0) > (u.lastSwing || 0) + 0.01) { u.atkE = 0; u.trail = []; }
    else if (u.atkE >= 0) { u.atkE += dt; if (u.atkE > BACK) u.atkE = -1; }
    u.lastSwing = u.swing || 0;
    const near = u.reachT != null && t - u.reachT < 0.3 && !moving;
    u.stanceW = clamp01((u.stanceW || 0) + (near ? 1 : -1) * dt * 5);
    const P = pose(u, t);
    const k = k0;
    const torso = Pp.torso;
    const S = d.scale || {}, HS = S.head || 1, TS = S.torso || 1, LS = S.leg || 1, AS = S.arm || 1;
    c.save();
    c.translate(u.x, gy);
    c.scale(dir * k, k);
    /* 원점 = 엉덩이 */
    c.translate(P.hipX, -P.hipH);
    const drawLeg = (side) => {
      const th = Pp['thigh' + side], sh = Pp['shin' + side];
      const sy = LS.length ? LS[1] : LS;
      const L1 = (th.knee[1] - th.pv[1]) * sy, L2 = (sh.r[3] - sh.pv[1] - 4) * sy;
      const hx = side === 'F' ? 5 : -5;
      /* 발 목표(엉덩이 기준) → 무릎 각도 */
      const ik = legIK(P['f' + side + 'x'] - P.hipX - hx, P.hipH - P['f' + side + 'l'], L1, L2);
      c.save();
      c.translate(hx, 0);
      c.rotate(ik.thigh);
      part(c, im, th, LS);
      at(c, th, th.knee, LS);
      c.rotate(ik.knee);
      part(c, im, sh, LS);
      c.restore();
    };
    /* 팔: 몸통 기준 어깨에서 시작. 갑옷이 있으면 어깨받이·팔찌를 같은 뼈에 덧입힌다 */
    const drawArm = (side, withSword) => {
      const ua = Pp['uarm' + side], fa = Pp['farm' + side];
      const ang = -P.lean + P['uarm' + side];
      c.save();
      at(c, torso, torso['sh' + side], TS);
      if (withSword && c.getTransform) u.shW = c.getTransform().transformPoint({ x: 0, y: 0 });
      c.rotate(ang);
      part(c, im, ua, AS);
      c.save();
      at(c, ua, ua.elbow, AS);
      c.rotate(P['farm' + side]);
      if (withSword && WP) {
        const bl = WP.P.blade;
        c.save(); at(c, fa, fa.grip, AS); c.rotate(P.sword); part(c, WP.im, bl);
        if (u.atkE >= 0 && u.atkE < OVER + 0.04 && c.getTransform) {
          const tip = c.getTransform().transformPoint({ x: bl.tip[0] - bl.pv[0], y: bl.tip[1] - bl.pv[1] });
          (u.trail || (u.trail = [])).push({ tip, sh: u.shW, t });
        }
        c.restore();
      }
      part(c, im, fa, AS);
      if (AR) { c.save(); at(c, fa, fa.cuff, AS); part(c, AR.im, AR.P['brc' + side], AS); c.restore(); }
      c.restore();
      c.restore();
    };
    /* 양손 잡기: 겨눔·공격 중에는 뒷손이 칼자루(앞손 바로 아래)를 함께 쥔다 → 두 팔 IK */
    const two = Math.max(u.stanceW || 0, u.atkE >= 0 ? 1 : 0);
    if (two > 0.01) {
      const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      const asx = AS.length ? AS[0] : AS, asy = AS.length ? AS[1] : AS;
      const uaF = Pp.uarmF, faF = Pp.farmF, uaB = Pp.uarmB, faB = Pp.farmB;
      const a1 = -P.lean + P.uarmF, a2 = a1 + P.farmF;
      const sF = [(torso.shF[0] - torso.pv[0]) * TS, (torso.shF[1] - torso.pv[1]) * TS];
      const e = rot((uaF.elbow[0] - uaF.pv[0]) * asx, (uaF.elbow[1] - uaF.pv[1]) * asy, a1);
      const g = rot((faF.grip[0] - faF.pv[0]) * asx, (faF.grip[1] - faF.pv[1]) * asy, a2);
      const hd = rot(0, 26, a2 + P.sword); /* 칼자루 방향으로 조금 아래 */
      const gx = sF[0] + e[0] + g[0] + hd[0], gy2 = sF[1] + e[1] + g[1] + hd[1];
      const sB = [(torso.shB[0] - torso.pv[0]) * TS, (torso.shB[1] - torso.pv[1]) * TS];
      const l1 = (uaB.elbow[1] - uaB.pv[1]) * asy, l2 = Math.hypot((faB.grip[0] - faB.pv[0]) * asx, (faB.grip[1] - faB.pv[1]) * asy);
      const dx = gx - sB[0], dy = gy2 - sB[1];
      const dd = Math.max(1, Math.min(Math.hypot(dx, dy), (l1 + l2) * 0.999));
      const aa = Math.atan2(-dx, dy);
      const al = Math.acos(clamp((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd), -1, 1));
      const kn = Math.PI - Math.acos(clamp((l1 * l1 + l2 * l2 - dd * dd) / (2 * l1 * l2), -1, 1));
      /* 팔꿈치는 아래·뒤로, 아래팔은 앞으로 굽는다 */
      P.uarmB = lerp(P.uarmB, aa + al + P.lean, two); P.farmB = lerp(P.farmB, -kn, two);
    }
    /* 그리는 순서: 뒷팔(몸 뒤) → 다리 → 머리 → 몸통(갑옷이면 갑옷 몸통) → 앞팔(칼) */
    c.save(); c.rotate(P.lean); drawArm('B', false); c.restore();
    drawLeg('B');
    drawLeg('F');
    c.save();
    c.rotate(P.lean);
    c.save(); at(c, torso, torso.neck, TS); c.rotate(P.head); part(c, im, Pp.head, HS); c.restore();
    if (AR) part(c, AR.im, AR.P.torso, TS); else part(c, im, torso, TS);
    drawArm('F', true);
    c.restore();
    c.restore();
    drawTrail(c, u, t);
    return true;
  }

  /* 칼 궤적: 어깨를 중심으로 칼끝이 지나간 각도만큼 초승달 모양 잔상을 남긴다 */
  function drawTrail(c, u, t) {
    const tr = u.trail;
    if (!tr || tr.length < 2 || !(u.atkE >= 0)) return;
    const life = 1 - u.atkE / (OVER + 0.06);
    if (life <= 0) return;
    const last = tr[tr.length - 1], first = tr[0];
    const cx = last.sh.x, cy = last.sh.y;
    const ang = (p) => Math.atan2(p.tip.y - p.sh.y, p.tip.x - p.sh.x);
    const r = Math.hypot(last.tip.x - last.sh.x, last.tip.y - last.sh.y);
    let a0 = ang(first), a1 = ang(last);
    let da = a1 - a0;
    /* 오른쪽을 볼 때는 화면에서 시계 방향(머리 위를 지나 앞으로), 왼쪽을 볼 때는 반대로 돈다 */
    const cw = (u.dirS || 1) > 0;
    while (cw && da < 0) da += Math.PI * 2;
    while (!cw && da > 0) da -= Math.PI * 2;
    if (Math.abs(da) > Math.PI * 1.6) return;
    if (Math.abs(da) > 1.4) da = Math.sign(da) * 1.4; /* 꼬리는 칼끝 뒤쪽 일부만 */
    if (Math.abs(da) < 0.2) return;
    a0 = a1 - da;
    const ccw = da < 0;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.05);
    g.addColorStop(0, 'rgba(120,230,255,0)'); g.addColorStop(0.85, `rgba(150,235,255,${0.12 * life})`); g.addColorStop(1, `rgba(240,253,255,${0.55 * life})`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r * 1.04, a0, a1, ccw);
    c.arc(cx, cy, r * 0.84, a1, a0, !ccw);
    c.closePath(); c.fill();
    c.restore();
  }

  return { has, draw, warm };
})();
