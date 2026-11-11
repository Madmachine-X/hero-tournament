'use strict';
/* ===== 뼈대(컷아웃) 애니메이션: 조각 그림을 관절에 붙여 매 프레임 각도로 움직인다 =====
   레이맨 레전드처럼 장면 그림 없이도 걷기·공격·숨쉬기가 부드럽게 이어진다.
   지금은 무명(hero) 시험판만 있다. 다른 장수는 기존 4장면 시트를 쓴다. */
const Rig = (() => {
  /* 조각 위치(아틀라스 좌표)와 관절(pivot)·붙는 점(at)은 조각 기준 좌표 */
  const DEFS = {
    hero: {
      src: 'img/rig/hero.png',
      height: 470, /* 서 있을 때 머리끝~발끝 (아틀라스 단위) */
      parts: {
        sword: { r: [0, 0, 40, 323], pv: [18, 250] },
        skirt: { r: [42, 0, 162, 249], pv: [81, 6] },
        torso: { r: [206, 0, 90, 183], pv: [64, 104], neck: [46, 10], shB: [16, 50], shF: [52, 46], hipB: [54, 128], hipF: [68, 128], belt: [64, 104] },
        head: { r: [298, 0, 112, 177], pv: [52, 138] },
        thighB: { r: [412, 0, 58, 134], pv: [29, 10], knee: [30, 122] },
        thighF: { r: [472, 0, 57, 134], pv: [29, 10], knee: [30, 122] },
        bootB: { r: [531, 0, 55, 115], pv: [21, 6] },
        bootF: { r: [631, 0, 64, 114], pv: [19, 6] },
        farmF: { r: [697, 0, 51, 105], pv: [18, 6], grip: [38, 92] },
        farmB: { r: [750, 0, 53, 104], pv: [17, 6] },
        uarmB: { r: [805, 0, 41, 84], pv: [20, 6], elbow: [22, 76] },
        uarmF: { r: [848, 0, 38, 84], pv: [19, 6], elbow: [21, 76] },
        flame: { r: [588, 0, 41, 115], pv: [20, 108] },
      },
    },
  };
  const imgs = Object.create(null);

  function has(id) {
    const d = DEFS[id];
    if (!d) return false;
    if (!imgs[id]) { const im = new Image(); im.src = d.src; imgs[id] = im; }
    const im = imgs[id];
    return im.complete && im.naturalWidth > 0;
  }
  function warm() { Object.keys(DEFS).forEach(has); }

  const ease = (k) => k * k * (3 - 2 * k);
  const clamp01 = (k) => Math.max(0, Math.min(1, k));

  /* 자세 계산: 상태(대기·걷기·공격·피격)를 섞어 관절 각도를 만든다 (라디안, 0 = 아래로 늘어뜨림) */
  const lerp = (a, b, k) => a + (b - a) * k;
  /* 공격 열쇠 자세: 치켜들기(U) → 한가운데(M) → 내려벤 끝(S) */
  const KU = { uarmF: -2.7, farmF: -0.4, sword: 2.64, lean: -0.08, bodyY: -3, uarmB: -0.5, thighF: -0.1, thighB: 0.05, kneeB: 0, sx: 0.97, sy: 1.05 };
  const KM = { uarmF: -1.5, farmF: -0.2, sword: 3.27, lean: 0.14, bodyY: 3, uarmB: 0.3, thighF: 0.3, thighB: -0.25, kneeB: 0.35, sx: 1.05, sy: 0.95 };
  const KS = { uarmF: -0.5, farmF: -0.2, sword: 2.7, lean: 0.22, bodyY: 6, uarmB: 0.5, thighF: 0.38, thighB: -0.3, kneeB: 0.45, sx: 1.04, sy: 0.96 };
  function mix(P, A, B, k) { for (const key in A) P[key] = lerp(A[key], B[key], k); }

  /* 자세 계산: 상태(대기·걷기·공격·피격)를 섞어 관절 각도를 만든다 (라디안, 0 = 아래로 늘어뜨림, 음수 = 앞으로) */
  function pose(u, t) {
    const ph = u.walkPh || 0;
    const w = u.walkW || 0; /* 걷기 섞임 정도 0..1 */
    const s = Math.sin(ph), c2 = Math.cos(ph);
    const br = Math.sin(t * 2.1 + (u.bob || 0));
    const swing = 0.42 * s * w;
    const P = {
      /* 다리를 벌린 만큼 엉덩이가 내려가야 발이 땅에 붙어 있다 */
      bodyY: 224 * (1 - Math.cos(swing)) + br * 1.5 * (1 - w),
      lean: 0.06 * w + br * 0.012,
      head: -0.03 * w + Math.sin(t * 2.1 + 0.6 + (u.bob || 0)) * 0.03,
      thighF: -swing, thighB: swing,
      kneeF: Math.max(0, c2) * 0.7 * w, kneeB: Math.max(0, -c2) * 0.7 * w,
      uarmF: 0.12 + 0.3 * s * w + br * 0.03, uarmB: 0.05 - 0.3 * s * w - br * 0.03,
      farmF: -0.35 - 0.15 * w, farmB: -0.2 - 0.25 * w * (0.5 - 0.5 * s),
      sword: 2.35, skirt: Math.sin(ph * 2) * 0.03 * w + br * 0.01,
      sx: 1, sy: 1 + br * 0.008,
    };
    /* 발이 닿는 순간 살짝 눌렸다 펴진다 */
    const land = Math.pow(Math.abs(s), 8) * w;
    P.sy -= land * 0.03; P.sx += land * 0.015;

    const sw = u.swingT || 0;
    if (sw > 0) {
      const k = clamp01(1 - sw / 0.4);
      const R = { uarmF: P.uarmF, farmF: P.farmF, sword: P.sword, lean: P.lean, bodyY: P.bodyY, uarmB: P.uarmB, thighF: P.thighF, thighB: P.thighB, kneeB: P.kneeB, sx: P.sx, sy: P.sy };
      if (k < 0.25) mix(P, R, KU, ease(k / 0.25));
      else if (k < 0.38) mix(P, KU, KM, (k - 0.25) / 0.13);
      else if (k < 0.5) mix(P, KM, KS, (k - 0.38) / 0.12);
      else mix(P, KS, R, ease((k - 0.5) / 0.5));
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
    const im = imgs[u.hid];
    const Pp = d.parts;
    const spd = Math.hypot(u.vx || 0, u.vy || 0);
    const moving = spd > 12 && (u.stun || 0) <= 0;
    /* 걸음 위상은 실제 이동 거리로 진행: 미끄러지지 않게 */
    const dt = Math.min(0.05, Math.max(0, t - (u.rigT != null ? u.rigT : t)));
    u.rigT = t;
    u.walkPh = (u.walkPh || 0) + spd * dt * 0.085;
    u.walkW = (u.walkW || 0) + ((moving ? 1 : 0) - (u.walkW || 0)) * Math.min(1, dt * 8);
    /* 전투 쪽에서 공격이 새로 시작되면(swing 값이 다시 올라가면) 휘두르기를 처음부터 재생 */
    if ((u.swing || 0) > (u.lastSwing || 0) + 0.01) u.swingT = 0.4;
    u.lastSwing = u.swing || 0;
    if (u.swingT > 0) u.swingT = Math.max(0, u.swingT - dt);
    const P = pose(u, t);
    const k = hPx / d.height;
    c.save();
    c.translate(u.x, gy);
    c.scale(dir * k * P.sx, k * P.sy);
    /* 엉덩이 위치: 다리 길이만큼 위 */
    c.translate(0, -232 + P.bodyY);
    const torso = Pp.torso;
    const drawLeg = (side) => {
      const th = Pp['thigh' + side], bt = Pp['boot' + side];
      c.save();
      c.rotate(P.lean * 0.3);
      c.translate((side === 'F' ? 6 : -6), 0);
      c.rotate(P['thigh' + side]);
      part(c, im, th);
      at(c, th, th.knee);
      c.rotate(P['knee' + side]);
      part(c, im, bt);
      c.restore();
    };
    const drawArm = (side, withSword) => {
      const ua = Pp['uarm' + side], fa = Pp['farm' + side];
      c.save();
      at(c, torso, torso['sh' + side]);
      c.rotate(-P.lean + P['uarm' + side]);
      part(c, im, ua);
      at(c, ua, ua.elbow);
      c.rotate(P['farm' + side]);
      if (withSword) {
        c.save(); at(c, fa, fa.grip); c.rotate(P.sword); c.scale(0.68, 0.68); part(c, im, Pp.sword); c.restore();
      }
      part(c, im, fa);
      c.restore();
    };
    /* 다리 → 치마 → 몸통·머리 → 팔(소매 구멍을 덮도록 몸통 위) → 칼 든 팔 */
    drawLeg('B');
    drawLeg('F');
    c.save(); c.rotate(P.lean * 0.6 + P.skirt); part(c, im, Pp.skirt); c.restore();
    c.save();
    c.rotate(P.lean);
    part(c, im, torso);
    c.save(); at(c, torso, torso.neck); c.rotate(P.head); part(c, im, Pp.head);
    /* 두건 위 혼불이 일렁인다 */
    c.globalCompositeOperation = 'lighter';
    const fl = Pp.flame;
    c.globalAlpha *= 0.55 + Math.sin(t * 7 + (u.bob || 0)) * 0.15;
    c.translate(-2, -112); c.rotate(Math.sin(t * 5) * 0.12); c.scale(0.45, 0.42 + Math.sin(t * 9) * 0.05);
    part(c, im, fl);
    c.restore();
    drawArm('B', false);
    drawArm('F', true);
    c.restore();
    if (u.flash > 0) {
      /* 피격 번쩍임: 몸 전체를 한 번 더 밝게 */
    }
    c.restore();
    return true;
  }

  return { has, draw, warm };
})();
