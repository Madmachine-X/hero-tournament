'use strict';
/* ===== 뼈대(컷아웃) 애니메이션: 조각 그림을 관절에 붙여 매 프레임 각도로 움직인다 =====
   레이맨 레전드처럼 장면 그림 없이도 걷기·공격·숨쉬기가 부드럽게 이어진다.
   지금은 무명(hero) 시험판만 있다. 다른 장수는 기존 4장면 시트를 쓴다. */
const Rig = (() => {
  /* 조각 위치(아틀라스 좌표)와 관절(pivot)·붙는 점(at)은 조각 기준 좌표 */
  const DEFS = {
    hero: {
      src: 'img/rig/hero.png',
      height: 480, /* 서 있을 때 머리끝~발끝 (아틀라스 단위) */
      leg: 191,    /* 엉덩이~발바닥 */
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
    if (!im) { im = new Image(); im.src = src; imgs[src] = im; }
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
  /* 공격 열쇠 자세 (각도: 0 = 아래, 음수 = 앞쪽으로 들어 올림).
     칼의 실제 방향 = 윗팔 + 아래팔 + 칼 각도 */
  const K = {
    /* 적 앞에서 칼을 앞으로 겨눈 자세 */
    stance: { uarmF: -0.7, farmF: -0.9, sword: 2.63, uarmB: -0.5, farmB: -0.8, thighF: -0.25, thighB: 0.25, kneeF: 0.15, kneeB: 0.3, bodyY: 8, lean: 0.08, head: 0.02, sx: 1, sy: 1 },
    /* 치기 직전: 칼을 머리 뒤로 젖히고 몸을 웅크린다 */
    wind: { uarmF: -2.9, farmF: -0.6, sword: 1.63, uarmB: -1.1, farmB: -0.6, thighF: -0.3, thighB: 0.3, kneeF: 0.25, kneeB: 0.4, bodyY: 12, lean: -0.13, head: -0.06, sx: 1.04, sy: 0.95 },
    /* 내려벤 순간: 앞다리를 내딛고 체중을 싣는다 */
    hit: { uarmF: -0.3, farmF: -0.15, sword: 2.63, uarmB: 0.6, farmB: -0.4, thighF: -0.5, thighB: 0.42, kneeF: 0.1, kneeB: 0.55, bodyY: 15, lean: 0.25, head: 0.1, sx: 1.07, sy: 0.93 },
    /* 살짝 더 나갔다가 */
    over: { uarmF: 0.1, farmF: -0.1, sword: 2.62, uarmB: 0.7, farmB: -0.35, thighF: -0.5, thighB: 0.42, kneeF: 0.1, kneeB: 0.55, bodyY: 14, lean: 0.29, head: 0.12, sx: 1.03, sy: 0.97 },
  };
  const KEYS = Object.keys(K.stance);
  function blend(P, B, k) { if (k <= 0) return; for (const key of KEYS) P[key] = lerp(P[key], B[key], k); }
  function snap(P) { const o = {}; for (const key of KEYS) o[key] = P[key]; return o; }
  const STRIKE = 0.07, OVER = 0.13, BACK = 0.34;


  /* 자세 계산: 상태(대기·걷기·공격·피격)를 섞어 관절 각도를 만든다 (라디안, 0 = 아래로 늘어뜨림, 음수 = 앞으로) */
  function pose(u, t) {
    const ph = u.walkPh || 0;
    const w = u.walkW || 0; /* 걷기 섞임 정도 0..1 */
    const s = Math.sin(ph), c2 = Math.cos(ph);
    const br = Math.sin(t * 2.1 + (u.bob || 0));
    const swing = 0.42 * s * w;
    const P = {
      /* 다리를 벌린 만큼 엉덩이가 내려가야 발이 땅에 붙어 있다 */
      bodyY: (DEFS[u.hid].leg || 191) * (1 - Math.cos(swing)) + br * 1.5 * (1 - w),
      lean: 0.06 * w + br * 0.012,
      head: -0.03 * w + Math.sin(t * 2.1 + 0.6 + (u.bob || 0)) * 0.03,
      thighF: -swing, thighB: swing,
      kneeF: Math.max(0, c2) * 0.7 * w, kneeB: Math.max(0, -c2) * 0.7 * w,
      uarmF: 0.12 + 0.3 * s * w + br * 0.03, uarmB: 0.05 - 0.3 * s * w - br * 0.03,
      farmF: -0.35 - 0.15 * w, farmB: -0.2 - 0.25 * w * (0.5 - 0.5 * s),
      sword: 1.55, skirt: Math.sin(ph * 2) * 0.03 * w + br * 0.01,
      sx: 1, sy: 1 + br * 0.008,
    };
    /* 발이 닿는 순간 살짝 눌렸다 펴진다 */
    const land = Math.pow(Math.abs(s), 8) * w;
    P.sy -= land * 0.03; P.sx += land * 0.015;

    /* 적이 칼끝 거리에 있으면 겨눔 자세 → 다음 공격이 다가올수록 칼을 젖혀 든다 */
    blend(P, K.stance, ease(u.stanceW || 0));
    const rest = snap(P);
    const wu = (u.stanceW || 0) > 0.5 && !(u.atkE >= 0) ? clamp01(1 - (u.atkT || 0) / 0.28) : 0;
    blend(P, K.wind, ease(wu));
    /* 공격 순간부터: 젖힌 자세 → 내려베기(빠르게) → 더 나감 → 돌아옴 */
    const e = u.atkE;
    if (e >= 0) {
      if (e < STRIKE) { const k = e / STRIKE; Object.assign(P, snap(P)); blend(P, K.wind, 1); blend(P, K.hit, k * k); }
      else if (e < OVER) { blend(P, K.hit, 1); blend(P, K.over, ease((e - STRIKE) / (OVER - STRIKE))); }
      else { blend(P, K.over, 1); blend(P, rest, ease((e - OVER) / (BACK - OVER))); }
    }
    /* 맞았을 때: 뒤로 젖혀지며 납작 */
    if (u.flash > 0) { const h = Math.min(1, u.flash * 6); P.lean -= 0.16 * h; P.head -= 0.15 * h; P.sy *= 1 - 0.05 * h; P.sx *= 1 + 0.04 * h; }
    if (u.stun > 0) P.head += Math.sin(t * 9) * 0.12;
    return P;
  }

  function part(c, im, p) {
    c.drawImage(im, p.r[0], p.r[1], p.r[2], p.r[3], -p.pv[0], -p.pv[1], p.r[2], p.r[3]);
  }
  function at(c, from, pt) { c.translate(pt[0] - from.pv[0], pt[1] - from.pv[1]); }

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
    u.walkPh = (u.walkPh || 0) + spd * dt * 0.1;
    u.walkW = (u.walkW || 0) + ((moving ? 1 : 0) - (u.walkW || 0)) * Math.min(1, dt * 8);
    /* 전투 쪽에서 공격이 새로 시작되면(swing 값이 다시 올라가면) 내려베기를 처음부터 재생 */
    if ((u.swing || 0) > (u.lastSwing || 0) + 0.01) { u.atkE = 0; u.trail = []; }
    else if (u.atkE >= 0) { u.atkE += dt; if (u.atkE > BACK) u.atkE = -1; }
    u.lastSwing = u.swing || 0;
    const near = u.reachT != null && t - u.reachT < 0.3 && !moving;
    u.stanceW = clamp01((u.stanceW || 0) + (near ? 1 : -1) * dt * 5);
    const P = pose(u, t);
    const k = hPx / d.height;
    const torso = Pp.torso;
    c.save();
    c.translate(u.x, gy);
    c.scale(dir * k * P.sx, k * P.sy);
    /* 원점 = 엉덩이 (다리 길이만큼 위) */
    c.translate(0, -d.leg + P.bodyY);
    const drawLeg = (side) => {
      const th = Pp['thigh' + side], sh = Pp['shin' + side];
      c.save();
      c.rotate(P.lean * 0.3);
      c.translate(side === 'F' ? 4 : -4, 0);
      c.rotate(P['thigh' + side]);
      part(c, im, th);
      at(c, th, th.knee);
      c.rotate(P['knee' + side]);
      part(c, im, sh);
      c.restore();
    };
    /* 팔: 몸통 기준 어깨에서 시작. 갑옷이 있으면 어깨받이·팔찌를 같은 뼈에 덧입힌다 */
    const drawArm = (side, withSword) => {
      const ua = Pp['uarm' + side], fa = Pp['farm' + side];
      const ang = -P.lean + P['uarm' + side];
      c.save();
      at(c, torso, torso['sh' + side]);
      if (withSword && c.getTransform) u.shW = c.getTransform().transformPoint({ x: 0, y: 0 });
      c.rotate(ang);
      part(c, im, ua);
      c.save();
      at(c, ua, ua.elbow);
      c.rotate(P['farm' + side]);
      if (withSword && WP) {
        const bl = WP.P.blade;
        c.save(); at(c, fa, fa.grip); c.rotate(P.sword); part(c, WP.im, bl);
        if (u.atkE >= 0 && u.atkE < OVER + 0.04 && c.getTransform) {
          const tip = c.getTransform().transformPoint({ x: bl.tip[0] - bl.pv[0], y: bl.tip[1] - bl.pv[1] });
          (u.trail || (u.trail = [])).push({ tip, sh: u.shW, t });
        }
        c.restore();
      }
      part(c, im, fa);
      if (AR) { c.save(); at(c, fa, fa.cuff); part(c, AR.im, AR.P['brc' + side]); c.restore(); }
      c.restore();
      c.restore();
    };
    /* 그리는 순서: 뒷팔(몸 뒤) → 다리 → 머리 → 몸통(갑옷이면 갑옷 몸통) → 앞팔(칼) */
    c.save(); c.rotate(P.lean); drawArm('B', false); c.restore();
    drawLeg('B');
    drawLeg('F');
    c.save();
    c.rotate(P.lean);
    c.save(); at(c, torso, torso.neck); c.rotate(P.head); part(c, im, Pp.head); c.restore();
    if (AR) part(c, AR.im, AR.P.torso); else part(c, im, torso);
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
    if (Math.abs(da) > 2) da = Math.sign(da) * 2; /* 꼬리는 칼끝 뒤쪽 일부만 */
    if (Math.abs(da) < 0.2) return;
    a0 = a1 - da;
    const ccw = da < 0;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'lighter';
    const g = c.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 1.05);
    g.addColorStop(0, 'rgba(120,230,255,0)'); g.addColorStop(0.8, `rgba(150,235,255,${0.3 * life})`); g.addColorStop(1, `rgba(240,253,255,${0.75 * life})`);
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r * 1.04, a0, a1, ccw);
    c.arc(cx, cy, r * 0.7, a1, a0, !ccw);
    c.closePath(); c.fill();
    c.restore();
  }

  return { has, draw, warm };
})();
