'use strict';
/* ===== 뼈대(컷아웃) 애니메이션: 조각 그림을 관절에 붙여 매 프레임 각도로 움직인다 =====
   레이맨 레전드처럼 장면 그림 없이도 걷기·공격·숨쉬기가 부드럽게 이어진다.
   지금은 무명(hero) 시험판만 있다. 다른 장수는 기존 4장면 시트를 쓴다. */
const RigLab = (() => {
  const BASE = '../';
  /* 조각 위치(아틀라스 좌표)와 관절(pivot)·붙는 점(at)은 조각 기준 좌표 */
  const DEFS = {
    hero: {
      src: 'lab/hero-lab.png',
      height: 477, /* 서 있을 때 머리끝~발끝 (아틀라스 단위) */
      leg: 229,    /* 엉덩이~발바닥 (다리 배율 반영) */
      /* 조각별 배율: 머리는 줄이고 팔다리는 길게 늘려 7등신 정도로 */
      scale: { head: 0.72, torso: 0.9, leg: [1.0, 1.2], arm: [1.0, 1.15] }, /* [가로, 세로] */
      parts: {
        head: { r: [103, 0, 105, 117], pv: [51.1, 103.1] },
        torso: { r: [0, 0, 101, 259], pv: [50.9, 208.0], neck: [49.5, 12.3], shF: [31.3, 54.8], shB: [22.9, 53.7], belt: [60.7, 153.5] },
        uarmF: { r: [554, 0, 48, 96], pv: [27.1, 11.6], elbow: [24.0, 82.2] },
        uarmB: { r: [604, 0, 48, 96], pv: [27.1, 11.6], elbow: [24.0, 82.2] },
        farmF: { r: [826, 0, 43, 84], pv: [13.6, 4.7], grip: [31.0, 73.6], cuff: [18.6, 23.3] },
        farmB: { r: [871, 0, 43, 84], pv: [13.6, 4.7], grip: [31.0, 73.6], cuff: [18.6, 23.3] },
        thighF: { r: [382, 0, 85, 108], pv: [47.0, 5.5], knee: [35.6, 98.0] },
        shinF: { r: [210, 0, 85, 110], pv: [35.6, 11.4] },
        shin2F: { r: [654, 0, 85, 86], pv: [35.6, 11.4], ankle: [32.8, 79.8] },
        footF: { r: [916, 0, 85, 32], pv: [32.8, 2.7] },
        thighB: { r: [469, 0, 83, 108], pv: [46.1, 5.5], knee: [34.7, 98.0] },
        shinB: { r: [297, 0, 83, 109], pv: [34.7, 11.4] },
        shin2B: { r: [741, 0, 83, 86], pv: [34.7, 11.4], ankle: [32.4, 79.8] },
        footB: { r: [0, 261, 83, 31], pv: [32.4, 2.7] },
      },
    },
    /* 저승차사: 무명과 같은 뼈대·같은 동작, 그림 조각만 다르다 */
    gangrim: {
      src: 'lab/gangrim-lab.png',
      height: 477, leg: 222,
      scale: { head: 0.63, torso: 0.9, leg: [1.0, 1.2], arm: [1.0, 1.15] },
      sole: [-16, 43, 27], /* 발목 기준 뒤꿈치 x, 발끝 x, 발바닥 y */
      parts: {
        head: { r: [122, 0, 237, 271], pv: [113.9, 189.4] },
        torso: { r: [0, 0, 120, 306], pv: [62.7, 211.2], neck: [55.4, 15.8], shF: [27.1, 70.0], shB: [21.8, 68.6], belt: [82.5, 168.3] },
        uarmF: { r: [814, 0, 46, 97], pv: [22.5, 11.4], elbow: [28.5, 80.4] },
        uarmB: { r: [862, 0, 46, 97], pv: [22.5, 11.4], elbow: [28.5, 80.4] },
        farmF: { r: [483, 0, 96, 103], pv: [42.4, 14.3], grip: [60.9, 83.2], cuff: [45.2, 35.2] },
        farmB: { r: [581, 0, 96, 103], pv: [42.4, 14.3], grip: [60.9, 83.2], cuff: [45.2, 35.2] },
        thighF: { r: [361, 0, 61, 112], pv: [36.8, 8.8], knee: [31.5, 95.2] },
        thighB: { r: [424, 0, 57, 112], pv: [34.3, 8.8], knee: [29.4, 95.2] },
        shin2F: { r: [679, 0, 65, 100], pv: [24.5, 15.7], ankle: [21.7, 91.7] },
        footF: { r: [910, 0, 65, 32], pv: [21.7, 8.4] },
        shin2B: { r: [746, 0, 66, 100], pv: [26.2, 15.7], ankle: [23.1, 91.7] },
        footB: { r: [0, 308, 66, 31], pv: [23.1, 8.4] },
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
  /* ===== 실제 사람 동작(모션캡처) 재생 =====
     MOCAP(mocap.js): CMU 모션캡처에서 뽑은 옆모습 관절 각도. 30장/초.
     키: lean 몸 기울기, head, t/k/f = 허벅지·무릎·발목, u/a = 윗팔·아래팔, sw = 칼(앞손 기준), rx = 엉덩이 앞뒤 이동 */
  const M = typeof MOCAP !== 'undefined' ? MOCAP : null;
  /* 걷기: 일정한 속도로 나아가는 부분을 빼서 한 바퀴가 이음매 없이 반복되게 */
  if (M && !M.walk.rxD) {
    const R = M.walk.rx, n = R.length, per = R[n - 1] + (R[n - 1] - R[n - 2]);
    M.walk.rxD = true; M.walk.rx = R.map((v, i) => v - per * i / n);
    /* 칼 그림은 위를 향한 상태가 0이라, 팔다리(아래가 0) 기준 각도에서 반 바퀴 돌린다 */
    for (const c of [M.guard, M.strike]) c.sw = c.sw.map((v) => v + Math.PI);
    /* 실제 배우가 낮은 곳을 벨 때 허리를 많이 숙여서, 게임에선 숙임을 조금 줄인다 */
    M.strike.lean = M.strike.lean.map((v) => v > 0.25 ? 0.25 + (v - 0.25) * 0.55 : v);
  }
  const CK = ['lean', 'head', 'tF', 'kF', 'fF', 'tB', 'kB', 'fB', 'uF', 'aF', 'uB', 'aB', 'sw', 'rx'];
  function sample(clip, f, loop) {
    const n = clip.lean.length;
    if (loop) f = ((f % n) + n) % n; else f = Math.max(0, Math.min(n - 1, f));
    const i = Math.floor(f), j = loop ? (i + 1) % n : Math.min(n - 1, i + 1), k = f - i;
    const o = {};
    for (const key of CK) { const A = clip[key]; o[key] = A[i] + (A[j] - A[i]) * k; }
    return o;
  }
  function mix(P, Q, k) { if (k <= 0) return; for (const key of CK) P[key] = lerp(P[key], Q[key], k); }
  const IDLE = { lean: 0.03, head: 0, tF: -0.06, kF: 0.08, fF: 0, tB: 0.08, kB: 0.05, fB: 0, uF: 0.1, aF: -0.45, uB: 0.06, aB: -0.25, sw: 1.55, rx: 0 };
  /* 공격 시간(초): 젖힌 칼이 맞는 순간(impact)까지, 맞은 뒤 칼이 바닥까지, 다시 겨눔으로 */
  /* 베기 시간표(초) — 액션 게임 공식: 준비는 짧게 모았다가, 휘두르기는 몇 프레임 만에 번개처럼,
     맞는 순간 아주 잠깐 멈추고(히트스톱), 끝자세에서 잠깐 버텼다가 돌아온다 */
  /* 베기 시간표(초) */
  const PRE = 0.42;                       /* 모으기 + 들어 올리기 + 멈춤 */
  const T_SW = 0.05, T_HOLD = 0.34, BACK = 0.62; /* 내려베기 0.05초 → 0.34초까지 버팀 → 0.62초에 겨눔으로 */
  const OVER = 0.09;                      /* 칼 궤적은 휘두르는 동안과 직후만 */
  /* 칼 각도: sw = (칼이 향하는 방향) + π − uF − aF. 방향: 0 = 아래, −π/2 = 앞, ±π = 위, +π/2(= −3π/2) = 뒤 */
  const bladeTo = (o, dir) => { o.sw = dir + Math.PI - o.uF - o.aF; return o; };
  const KP = {
    /* 낮게 웅크려 칼끝을 앞·아래로 */
    ready: bladeTo({ lean: 0.2, head: -0.08, tF: -0.5, kF: 0.7, fF: -0.2, tB: 0.42, kB: 0.4, fB: -0.6, uF: -0.2, aF: -0.55, uB: -0.2, aB: -0.6, rx: 0 }, -0.95),
    /* 칼을 허리 뒤로 당겨 모은다 */
    wind: bladeTo({ lean: 0.1, head: -0.02, tF: -0.42, kF: 0.75, fF: -0.33, tB: 0.36, kB: 0.6, fB: -0.7, uF: 0.55, aF: -1.55, uB: 0.3, aB: -1.2, rx: -0.9 }, -1.65),
    /* 머리 위로 높이 들어 칼끝이 뒤를 향한다 (몸을 쭉 편다) */
    raise: bladeTo({ lean: -0.1, head: 0.06, tF: -0.3, kF: 0.3, fF: 0, tB: 0.28, kB: 0.2, fB: -0.3, uF: -2.75, aF: -0.45, uB: -2.5, aB: -0.5, rx: -0.5 }, -4.35),
    /* 앞다리를 깊게 내디디며 내려벤 순간 */
    hit: bladeTo({ lean: 0.48, head: -0.22, tF: -1.0, kF: 1.0, fF: 0, tB: 0.75, kB: 0.02, fB: -0.45, uF: -0.75, aF: -0.1, uB: 0.6, aB: -0.3, rx: 2.2 }, -1.0),
    /* 칼이 더 내려가며 무게가 실린다 */
    sink: bladeTo({ lean: 0.56, head: -0.25, tF: -1.1, kF: 1.15, fF: -0.05, tB: 0.78, kB: 0.02, fB: -0.4, uF: -0.5, aF: -0.08, uB: 0.7, aB: -0.3, rx: 2.5 }, -0.6),
  };

  /* 걷기 한 주기(8칸): 0 = 이 다리가 앞에서 뒤꿈치로 딛는 순간, 0.5 = 뒤에서 발끝으로 밀어내는 순간 */
  const WK = {
    thigh: [-0.42, -0.32, -0.03, 0.2, 0.35, 0.25, -0.25, -0.55],
    knee: [0.05, 0.3, 0.08, 0.05, 0.25, 0.75, 1.1, 0.55],
    foot: [-0.25, 0, 0, 0.2, 0.5, 0.9, 0.6, -0.1], /* 발의 기울기(땅 기준): 음수 = 발끝 들림, 양수 = 뒤꿈치 들림 */
  };
  const WALK_LEN = 318; /* 한 주기에 나아가는 거리 (아틀라스 단위) */
  /* 주기 곡선을 부드럽게 잇는다 (Catmull-Rom) */
  function cyc(A, ph) {
    const n = A.length, x = (((ph % 1) + 1) % 1) * n, i = Math.floor(x), k = x - i;
    const p0 = A[(i + n - 1) % n], p1 = A[i % n], p2 = A[(i + 1) % n], p3 = A[(i + 2) % n];
    return 0.5 * (2 * p1 + (p2 - p0) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k * k + (3 * p1 - p0 - 3 * p2 + p3) * k * k * k);
  }

  function pose(u, t) {
    const br = Math.sin(t * 2.1 + (u.bob || 0));
    const P = Object.assign({}, IDLE);
    P.lean += br * 0.012; P.head += Math.sin(t * 2.1 + 0.6 + (u.bob || 0)) * 0.025; P.uF += br * 0.02;
    P.hipX = 0;
    const w = u.walkW || 0;
    if (w > 0) {
      /* 걷기: 애니메이션 교본의 네 자세(딛기 → 눌림 → 엇갈림 → 밀기)를 한 다리씩 반 박자 어긋나게 돌린다 */
      const p = u.walkPh || 0, c1 = Math.cos(2 * Math.PI * p), c2 = Math.cos(4 * Math.PI * p);
      const Q = Object.assign({}, IDLE);
      const leg = (ph, tag) => {
        const t = cyc(WK.thigh, ph), k = Math.max(0, cyc(WK.knee, ph)), fw = cyc(WK.foot, ph);
        Q['t' + tag] = t; Q['k' + tag] = k; Q['f' + tag] = fw - (t + k);
      };
      leg(p, 'F'); leg(p + 0.5, 'B');
      Q.lean = 0.07 + 0.015 * c2; Q.head = -0.04 - 0.01 * c2; Q.rx = 0;
      /* 팔은 같은 쪽 다리와 반대로. 칼 든 팔은 조금만 흔든다 */
      Q.uF = 0.08 + 0.2 * c1; Q.aF = -0.4 - 0.1 * (0.5 - 0.5 * c1); Q.sw = 1.5;
      Q.uB = 0.05 - 0.4 * c1; Q.aB = -0.18 - 0.3 * (0.5 + 0.5 * c1);
      mix(P, Q, w);
    }
    const sw = u.stanceW || 0;
    /* ===== 겨눔·베기: 손으로 설계한 열쇠 자세 (액션 게임식) =====
       낮게 웅크린 겨눔 → 칼을 뒤로 당겨 모음 → 머리 위로 들어 잠깐 멈춤 → 한순간에 내려벰 → 깊게 내디딘 자세로 버팀 */
    P.sk = -1;
    if (sw > 0) {
      const G = Object.assign({}, KP.ready);
      G.uF += br * 0.02; G.sw += br * 0.02; G.lean += br * 0.008; G.kF += br * 0.02; G.kB += br * 0.02;
      let Q = G;
      const e = u.atkE, aT = u.atkT == null ? 9 : u.atkT;
      const tw = (A, B2, k) => { const o = {}; for (const key of CK) o[key] = lerp(A[key], B2[key], k); return o; };
      if (e >= 0) {
        if (e < T_SW) { const k = e / T_SW; Q = tw(KP.raise, KP.hit, k * k); P.sk = k; }
        else if (e < T_HOLD) { const k = clamp01((e - T_SW) / 0.08); Q = tw(KP.hit, KP.sink, 1 - (1 - k) * (1 - k)); P.sk = 1; }
        else { const k = smooth((e - T_HOLD) / (BACK - T_HOLD)); Q = tw(KP.sink, G, k); P.sk = 1 - k; }
      } else if (sw > 0.5 && aT < PRE) {
        const k = 1 - aT / PRE; /* 0 → 1 */
        if (k < 0.45) Q = tw(G, KP.wind, smooth(k / 0.45));
        else if (k < 0.8) Q = tw(KP.wind, KP.raise, smooth((k - 0.45) / 0.35));
        else Q = KP.raise; /* 들어 올린 채 잠깐 멈춤 */
        P.sk = 0;
      }
      mix(P, Q, ease(sw));
    }
    /* 한 손 베기: 반대쪽 팔은 칼을 쥐지 않는다. 겨눌 땐 가슴 앞에 두고, 벨 때는 뒤로 뻗어 균형을 잡는다 (방패를 들 팔) */
    if (u.grip === 'one' && sw > 0) {
      let uB = -0.3, aB = -1.0;
      if (P.sk >= 0) { const k = smooth(P.sk); uB = lerp(-0.75, 0.8, k); aB = lerp(-0.7, -0.3, k); }
      const k2 = ease(sw);
      P.uB = lerp(P.uB, uB, k2); P.aB = lerp(P.aB, aB, k2);
    }
    P.hipX = P.rx * (M ? M.unit : 15);
    if (u.flash > 0) { const h = Math.min(1, u.flash * 6); P.lean -= 0.16 * h; P.head -= 0.15 * h; P.hipX -= 8 * h; }
    if (u.stun > 0) P.head += Math.sin(t * 9) * 0.12;
    /* 옛 이름과 맞춤 (팔 그리기 코드가 쓰는 이름) */
    P.uarmF = P.uF; P.farmF = P.aF; P.uarmB = P.uB; P.farmB = P.aB; P.sword = P.sw;
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
    u.walkPh = (u.walkPh || 0) + spd * dt / (WALK_LEN * k0);
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
    /* 원점 = 엉덩이 (높이는 다리 그리기 직전에 정해짐) */

    /* 다리: 허벅지 → 정강이 → 발(발목 관절). 땅에 닿는 높이는 아래에서 계산 */
    const lsx = LS.length ? LS[0] : LS, lsy = LS.length ? LS[1] : LS;
    const legPts = (side) => {
      const th = Pp['thigh' + side], sh = Pp['shin2' + side];
      const L1 = (th.knee[1] - th.pv[1]) * lsy, L2 = (sh.ankle[1] - sh.pv[1]) * lsy;
      const a1 = P['t' + side], a2 = a1 + P['k' + side], a3 = a2 + P['f' + side];
      const kx = -Math.sin(a1) * L1, ky = Math.cos(a1) * L1;
      const ax = kx - Math.sin(a2) * L2, ay = ky + Math.cos(a2) * L2;
      /* 발바닥: 뒤꿈치·발끝 (발목 기준, 발이 평평할 때) */
      const sole = (x, y) => [ax + x * Math.cos(a3) - y * Math.sin(a3), ay + x * Math.sin(a3) + y * Math.cos(a3)];
      const so = d.sole || [-16, 50, 30];
      return [sole(so[0], so[2]), sole(so[1], so[2])];
    };
    const low = Math.max(...legPts('F').map((q) => q[1]), ...legPts('B').map((q) => q[1]));
    P.hipH = low;
    c.translate(P.hipX, -P.hipH);
    const drawLeg = (side) => {
      const th = Pp['thigh' + side], sh = Pp['shin2' + side], ft = Pp['foot' + side];
      c.save();
      c.translate(side === 'F' ? 4 : -4, 0);
      c.rotate(P['t' + side]);
      part(c, im, th, LS);
      at(c, th, th.knee, LS);
      c.rotate(P['k' + side]);
      part(c, im, sh, LS);
      at(c, sh, sh.ankle, LS);
      c.rotate(P['f' + side]);
      part(c, im, ft, LS);
      c.restore();
    };
    /* 팔: 몸통 기준 어깨에서 시작. 갑옷이 있으면 어깨받이·팔찌를 같은 뼈에 덧입힌다 */
    /* mode: 'all' 팔 전체, 'upper' 윗팔만, 'fore' 아래팔·손만 */
    const drawArm = (side, withSword, mode = 'all') => {
      const ua = Pp['uarm' + side], fa = Pp['farm' + side];
      const ang = -P.lean + P['uarm' + side];
      c.save();
      at(c, torso, torso['sh' + side], TS);
      if (withSword && c.getTransform) u.shW = c.getTransform().transformPoint({ x: 0, y: 0 });
      c.rotate(ang);
      if (mode !== 'fore') part(c, im, ua, AS);
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
      if (mode !== 'upper') {
        part(c, im, fa, AS);
        if (AR) { c.save(); at(c, fa, fa.cuff, AS); part(c, AR.im, AR.P['brc' + side], AS); c.restore(); }
      }
      c.restore();
      c.restore();
    };
    /* 양손 잡기: 겨눔·공격 중에는 뒷손이 칼자루(앞손 바로 아래)를 함께 쥔다 → 두 팔 IK */
    const two = u.grip === 'one' ? 0 : Math.max(u.stanceW || 0, u.atkE >= 0 ? 1 : 0);
    if (two > 0.01) {
      const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
      const asx = AS.length ? AS[0] : AS, asy = AS.length ? AS[1] : AS;
      const uaF = Pp.uarmF, faF = Pp.farmF, uaB = Pp.uarmB, faB = Pp.farmB;
      const a1 = -P.lean + P.uarmF, a2 = a1 + P.farmF;
      const sF = [(torso.shF[0] - torso.pv[0]) * TS, (torso.shF[1] - torso.pv[1]) * TS];
      const e = rot((uaF.elbow[0] - uaF.pv[0]) * asx, (uaF.elbow[1] - uaF.pv[1]) * asy, a1);
      const g = rot((faF.grip[0] - faF.pv[0]) * asx, (faF.grip[1] - faF.pv[1]) * asy, a2);
      const hd = rot(0, 46, a2 + P.sword); /* 칼자루를 따라 앞손에서 주먹 하나 반 아래 */
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
    /* 반대쪽 팔은 항상 몸통·앞팔보다 뒤에 있다. 몸 밖으로 나온 부분만 보인다 */
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
    const life = u.atkE < OVER ? 1 : 1 - (u.atkE - OVER) / 0.1;
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
    if (Math.abs(da) > 1.9) da = Math.sign(da) * 1.9; /* 꼬리는 칼끝 뒤쪽 일부만 */
    if (Math.abs(da) < 0.2) return;
    a0 = a1 - da;
    const ccw = da < 0;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    const g = c.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.05);
    g.addColorStop(0, 'rgba(120,230,255,0)'); g.addColorStop(0.55, `rgba(170,235,255,${0.25 * life})`); g.addColorStop(0.9, `rgba(255,255,255,${0.95 * life})`); g.addColorStop(1, `rgba(120,200,255,${0.9 * life})`);
    c.fillStyle = g;
    /* 초승달: 칼끝 쪽이 두껍고 꼬리로 갈수록 가늘어진다 */
    c.beginPath();
    const N = 18;
    for (let i = 0; i <= N; i++) { const a = a0 + da * i / N; c.lineTo(cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05); }
    for (let i = N; i >= 0; i--) { const a = a0 + da * i / N, rr = r * (1.05 - 0.5 * Math.pow(i / N, 1.5)); c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    c.closePath(); c.fill();
    c.restore();
  }

  return { has, draw, warm };
})();
