'use strict';
/* ===== 전장 그림: 그래픽 에셋 (시트 4프레임 + 스킬 FX) ===== */
const Art = (() => {
  const FRAMES = 4;
  const portraits = Object.create(null);
  const sheets = Object.create(null);
  const fx = Object.create(null);
  const keyed = Object.create(null);
  const HERO_IDS = typeof HERO_ORDER !== 'undefined' ? HERO_ORDER : [];
  const SHEET_IDS = HERO_IDS.concat(['generic']);
  const FX_IDS = ['orbs', 'rope', 'seal', 'wave', 'turtle', 'hangul', 'cavalry', 'meteor', 'slash', 'tiger', 'heal', 'arrows', 'swords'];
  const SKILL_FX = {
    honbul: 'orbs', ghostfire: 'orbs', orat: 'rope', jeokpae: 'seal',
    cheongcheon: 'wave', salsu: 'wave', tide: 'wave',
    hakik: 'arrows', hwasal: 'arrows', jucheon: 'arrows', goguryeo: 'arrows', geobuk: 'turtle',
    hunmin: 'hangul', banpo: 'hangul',
    gaema: 'cavalry', musa: 'cavalry', madol: 'cavalry', pyeonggang: 'cavalry',
    nakseong: 'meteor', geomgi: 'slash', samhan: 'slash', chukji: 'slash',
    odo: 'swords', bigeom: 'swords',
    maengho: 'tiger', baekho: 'tiger',
    donguibogam: 'heal', guguep: 'heal', gyeolsa: 'heal', ochon: 'heal', bunsin: 'orbs',
  };

  function loadImg(map, id, src) {
    if (map[id]) return map[id];
    const im = new Image();
    im.src = src;
    map[id] = im;
    return im;
  }

  function ok(im) { return !!(im && im.complete && im.naturalWidth); }

  function knockBg(im, sheet) {
    const w = im.naturalWidth || im.width, h = im.naturalHeight || im.height;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.drawImage(im, 0, 0);
    const img = x.getImageData(0, 0, w, h);
    const d = img.data;
    const isMagenta = (r, g, b) => {
      /* jpg 압축된 핫핑크/보라 키 색 — 전역 제거 (테두리 flood만으로는 남음) */
      if (r < 130 || b < 110) return false;
      if (g > 165) return false;
      if (r + b < g * 2.05 + 40) return false;
      return (r > g + 25 && b > g + 15) || (r > 200 && b > 180 && g < 140);
    };
    /* 1) 마젠타 키는 전체에 적용 — 보라 사각 잔상 방지 */
    for (let p = 0; p < d.length; p += 4) {
      if (isMagenta(d[p], d[p + 1], d[p + 2])) d[p + 3] = 0;
    }
    /* 테두리가 대부분 마젠타면 마젠타 배경 시트 — 어두운 옷(저승사자 흑의 등)을 배경으로 오인해 지우지 않는다 */
    let magEdge = 0, edgeN = 0;
    const tally = (xx, yy) => { edgeN++; if (d[(yy * w + xx) * 4 + 3] === 0) magEdge++; };
    for (let xx = 0; xx < w; xx += 4) { tally(xx, 0); tally(xx, h - 1); }
    for (let yy = 0; yy < h; yy += 4) { tally(0, yy); tally(w - 1, yy); }
    const magentaSheet = magEdge > edgeN * 0.6;
    /* 검은 배경 시트: 테두리 배경색보다 조금만 밝은 픽셀까지만 배경으로 본다 (검은 옷이 지워지지 않게) */
    const lums = [];
    for (let xx = 0; xx < w; xx += 8) { for (const yy of [0, h - 1]) { const p = (yy * w + xx) * 4; lums.push(0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]); } }
    lums.sort((a, b) => a - b);
    const bgLum = lums[Math.floor(lums.length / 2)] || 0;
    const isDarkBg = (r, g, b) => {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const span = Math.max(r, g, b) - Math.min(r, g, b);
      if (sheet) return lum < bgLum + 9 && span < 16;
      return (lum < 52 && span < 42) || (lum < 62 && span < 18);
    };
    const isBg = (p) => {
      if (d[p + 3] === 0) return true;
      return !magentaSheet && isDarkBg(d[p], d[p + 1], d[p + 2]);
    };
    const seen = new Uint8Array(w * h);
    const stack = [];
    const push = (xx, yy) => {
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) return;
      const n = yy * w + xx;
      if (seen[n] || !isBg(n * 4)) return;
      seen[n] = 1; stack.push(n);
    };
    for (let xx = 0; xx < w; xx++) { push(xx, 0); push(xx, h - 1); }
    for (let yy = 0; yy < h; yy++) { push(0, yy); push(w - 1, yy); }
    while (stack.length) {
      const n = stack.pop();
      const xx = n % w, yy = (n / w) | 0;
      d[n * 4 + 3] = 0;
      push(xx - 1, yy); push(xx + 1, yy); push(xx, yy - 1); push(xx, yy + 1);
    }
    /* 1-b) 검은 배경 시트: 좁은 틈으로 스며든 배경 제거를 되돌린다 (갑옷 속 어두운 부분이 구멍 나지 않게).
       배경 영역을 3px 깎은 뒤 테두리에서 닿는 곳만 진짜 배경으로 보고 다시 3px 넓힌다. */
    if (sheet && !magentaSheet) {
      const RAD = 3, N = w * h;
      const box = (src, all) => {
        const tmp = new Uint8Array(N), out = new Uint8Array(N);
        for (let yy = 0; yy < h; yy++) {
          let run = 0;
          const row = yy * w;
          const pre = new Int32Array(w + 1);
          for (let xx = 0; xx < w; xx++) pre[xx + 1] = pre[xx] + src[row + xx];
          for (let xx = 0; xx < w; xx++) {
            const a = Math.max(0, xx - RAD), b = Math.min(w, xx + RAD + 1);
            run = pre[b] - pre[a];
            tmp[row + xx] = all ? (run === b - a ? 1 : 0) : (run > 0 ? 1 : 0);
          }
        }
        const pre = new Int32Array(h + 1);
        for (let xx = 0; xx < w; xx++) {
          for (let yy = 0; yy < h; yy++) pre[yy + 1] = pre[yy] + tmp[yy * w + xx];
          for (let yy = 0; yy < h; yy++) {
            const a = Math.max(0, yy - RAD), b = Math.min(h, yy + RAD + 1);
            const run = pre[b] - pre[a];
            out[yy * w + xx] = all ? (run === b - a ? 1 : 0) : (run > 0 ? 1 : 0);
          }
        }
        return out;
      };
      const er = box(seen, true);
      const reach = new Uint8Array(N);
      const st = [];
      const pr = (xx, yy) => { const n = yy * w + xx; if (er[n] && !reach[n]) { reach[n] = 1; st.push(n); } };
      for (let xx = 0; xx < w; xx++) { pr(xx, 0); pr(xx, h - 1); }
      for (let yy = 0; yy < h; yy++) { pr(0, yy); pr(w - 1, yy); }
      while (st.length) {
        const n = st.pop(), xx = n % w, yy = (n / w) | 0;
        if (xx > 0) pr(xx - 1, yy); if (xx < w - 1) pr(xx + 1, yy); if (yy > 0) pr(xx, yy - 1); if (yy < h - 1) pr(xx, yy + 1);
      }
      const bgF = box(reach, false);
      for (let n = 0; n < N; n++) if (seen[n] && !bgF[n]) d[n * 4 + 3] = 255;
    }
    /* 2) 키잉 가장자리 1px 침식 — jpg 핑크 헤일로 제거 */
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3];
    for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
      const n = yy * w + xx;
      if (alpha[n] === 0) continue;
      if (!alpha[n - 1] || !alpha[n + 1] || !alpha[n - w] || !alpha[n + w]) {
        const p = n * 4;
        if (isMagenta(d[p], d[p + 1], d[p + 2]) || (!magentaSheet && isDarkBg(d[p], d[p + 1], d[p + 2]))) d[p + 3] = 0;
        else if (d[p] > 160 && d[p + 2] > 140 && d[p + 1] < 170) d[p + 3] = 0;
      }
    }
    x.putImageData(img, 0, 0);
    return cv;
  }

  function keyedImg(map, id, raw) {
    const key = map + ':' + id;
    if (keyed[key]) return keyed[key];
    const im = raw[id];
    if (!ok(im)) return null;
    let cv = knockBg(im, map === 'sheet');
    if (map === 'sheet') cv = bakeSheet(cv);
    keyed[key] = cv;
    return cv;
  }

  /* 시트 준비(한 번만): 밝기 보정을 미리 구워 두고, 프레임마다 발 위치를 재 둔다.
     매 프레임 canvas filter를 쓰면 전투가 크게 느려지고, 그림 아래 빈칸 때문에 캐릭터가 떠 보였다. */
  function bakeSheet(src) {
    /* 전장 크기에 맞게 미리 줄여 둔다: 큰 그림을 매번 크게 줄이면 지글거리고 느리다 */
    let cur = src;
    while (cur.height > 420) {
      const half = document.createElement('canvas');
      half.width = Math.round(cur.width / 2); half.height = Math.round(cur.height / 2);
      const hx = half.getContext('2d');
      hx.imageSmoothingQuality = 'high';
      hx.drawImage(cur, 0, 0, half.width, half.height);
      cur = half;
    }
    const w = cur.width, h = cur.height;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    try { x.filter = 'contrast(1.12) brightness(1.18) saturate(1.08)'; } catch (e) {}
    x.drawImage(cur, 0, 0);
    x.filter = 'none';
    const d = x.getImageData(0, 0, w, h).data;
    const fw = Math.floor(w / FRAMES);
    const meta = { top: [], bot: [], cx: [] };
    for (let f = 0; f < FRAMES; f++) {
      let top = -1, bot = -1;
      for (let yy = 0; yy < h; yy++) {
        let n = 0;
        for (let xx = f * fw; xx < (f + 1) * fw; xx += 2) if (d[(yy * w + xx) * 4 + 3] > 80) n++;
        if (n >= 2) { if (top < 0) top = yy; bot = yy; }
      }
      if (top < 0) { top = 0; bot = h - 1; }
      /* 발 중심: 아래쪽 10% 줄의 불투명 픽셀 평균 x */
      const y0 = Math.max(top, bot - Math.round((bot - top) * 0.1));
      let sx = 0, n = 0;
      for (let yy = y0; yy <= bot; yy++) for (let xx = f * fw; xx < (f + 1) * fw; xx++) if (d[(yy * w + xx) * 4 + 3] > 80) { sx += xx - f * fw; n++; }
      meta.top.push(top); meta.bot.push(bot); meta.cx.push(n ? sx / n : fw / 2);
    }
    meta.fw = fw; meta.h0 = Math.max(20, meta.bot[0] - meta.top[0]);
    cv.meta = meta;
    return cv;
  }

  function sheetOf(id) {
    const sid = id && SHEET_IDS.indexOf(id) >= 0 ? id : 'generic';
    loadImg(sheets, sid, `img/sheets/${sid}.jpg`);
    return keyedImg('sheet', sid, sheets) || (sid !== 'generic' ? sheetOf('generic') : null);
  }
  function fxOf(id) {
    if (!id) return null;
    loadImg(fx, id, `img/fx/${id}.jpg`);
    return keyedImg('fx', id, fx);
  }
  function warm() {
    if (typeof Rig !== 'undefined') Rig.warm();
    SHEET_IDS.forEach((id) => loadImg(sheets, id, `img/sheets/${id}.jpg`));
    FX_IDS.forEach((id) => loadImg(fx, id, `img/fx/${id}.jpg`));
  }

  /* 프레임: 0 대기, 1 걸음, 2 준비, 3 공격 */
  function frameOf(u, t, moving) {
    if (u.swing > 0) return 1 - Math.min(1, u.swing / 0.22) < 0.4 ? 2 : 3;
    if (moving) return Math.floor(t * 6 + (u.bob || 0)) % 2;
    return 0;
  }

  function blitFrame(c, spr, f, scale) {
    const m = spr.meta, fh = spr.height;
    c.drawImage(spr, m.fw * f, 0, m.fw, fh, -m.cx[f] * scale, -m.bot[f] * scale, m.fw * scale, fh * scale);
  }

  function drawActor(c, u, t) {
    if (!u.generic && u.hid && typeof Rig !== 'undefined' && Rig.has(u.hid)) {
      const cf = Math.cos(u.face || 0);
      if (!u.dirS) u.dirS = cf >= 0 ? 1 : -1;
      else if (cf > 0.3) u.dirS = 1;
      else if (cf < -0.3) u.dirS = -1;
      const gy = u.y + (u.r || 12) * 0.75;
      const hh = 76 * (u.boss ? 1.18 : 1);
      u.topY = gy - hh - 4;
      Rig.draw(c, u, t, gy, u.dirS, hh);
      if (u.flash > 0) {
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha *= Math.min(0.5, u.flash * 2.5);
        Rig.draw(c, u, t, gy, u.dirS, hh); c.restore();
      }
      return true;
    }
    const id = u.generic ? 'generic' : (u.hid || 'generic');
    const spr = sheetOf(id) || sheetOf('generic');
    if (!spr || !spr.meta) return false;
    /* 좌우 방향은 확실히 돌아섰을 때만 바꾼다 (앞뒤로 깜빡이지 않게) */
    const cf = Math.cos(u.face || 0);
    if (!u.dirS) u.dirS = cf >= 0 ? 1 : -1;
    else if (cf > 0.3) u.dirS = 1;
    else if (cf < -0.3) u.dirS = -1;
    const dir = u.dirS;
    const spd = Math.hypot(u.vx || 0, u.vy || 0);
    const moving = spd > 12 && (u.stun || 0) <= 0;
    const fr = frameOf(u, t, moving);
    const hh = 64 * (u.boss ? 1.18 : 1);
    const scale = hh / spr.meta.h0;
    const gy = u.y + (u.r || 12) * 0.75; /* 그림자 중심 = 발 위치 */
    const bob = moving ? Math.abs(Math.sin((t * 6 + (u.bob || 0)) * Math.PI)) * 1.6 : 0;
    const breathe = moving ? 1 : 1 + Math.sin(t * 2.2 + (u.bob || 0)) * 0.012;
    const lunge = u.swing > 0 ? Math.sin((1 - Math.min(1, u.swing / 0.22)) * Math.PI) * 4 : 0;
    const hitSq = u.flash > 0 ? 1 - Math.min(0.06, u.flash * 0.4) : 1;
    u.topY = gy - hh - 4;
    c.save();
    c.translate(u.x + dir * lunge, gy - bob);
    if (moving) c.rotate(Math.min(0.05, spd / 2400) * dir);
    if (u.stun > 0) c.rotate(Math.sin(t * 22) * 0.05);
    c.scale(dir, breathe * hitSq);
    blitFrame(c, spr, fr, scale);
    if (u.flash > 0) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha *= Math.min(0.6, u.flash * 3);
      blitFrame(c, spr, fr, scale);
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
    return true;
  }

  function blitFx(c, name, x, y, w, h, rot, dir, alpha) {
    const im = fxOf(name);
    if (!im) return false;
    c.save();
    c.translate(x, y);
    if (rot) c.rotate(rot);
    c.scale(dir == null ? 1 : dir, 1);
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.drawImage(im, -w / 2, -h / 2, w, h);
    c.restore();
    return true;
  }

  function skillFx(id) {
    if (SKILL_FX[id]) return SKILL_FX[id];
    const m = typeof SKILLS !== 'undefined' ? SKILLS[id] : null;
    const base = m && (m.cast || m.upgradeOf);
    if (base && SKILL_FX[base]) return SKILL_FX[base];
    return 'slash';
  }

  return { portraits, ok, drawActor, blitFx, skillFx, fxOf, sheetOf, warm };
})();

const Sprites = (() => {
  const LOOKS = {};
  function lookOf(u) { return LOOKS[u && u.hid] || {}; }
  function hero(c, u, t) { Art.drawActor(c, u, t); }
  function hexA(hex, a) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    if (Number.isNaN(n)) return `rgba(139,149,166,${a})`;
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  const wispCache = new Map();
  function wispSprite(color) {
    if (wispCache.has(color)) return wispCache.get(color);
    const S = 48;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S * 1.3;
    const c = cv.getContext('2d');
    const cx = S / 2, cy = S * 0.78;
    const glow = c.createRadialGradient(cx, cy, 2, cx, cy, S * 0.48);
    glow.addColorStop(0, hexA(color, 0.5)); glow.addColorStop(1, hexA(color, 0));
    c.fillStyle = glow; c.fillRect(0, 0, S, S * 1.3);
    const body = c.createRadialGradient(cx, cy + 2, 1, cx, cy, S * 0.3);
    body.addColorStop(0, '#ffffff'); body.addColorStop(0.35, hexA(color, 0.95)); body.addColorStop(1, hexA(color, 0.15));
    c.fillStyle = body;
    c.beginPath();
    c.moveTo(cx, cy - S * 0.62);
    c.bezierCurveTo(cx + S * 0.08, cy - S * 0.38, cx + S * 0.26, cy - S * 0.22, cx + S * 0.24, cy);
    c.arc(cx, cy, S * 0.24, 0, Math.PI);
    c.bezierCurveTo(cx - S * 0.26, cy - S * 0.2, cx - S * 0.06, cy - S * 0.3, cx, cy - S * 0.62);
    c.fill();
    c.fillStyle = 'rgba(10,12,16,0.85)';
    c.beginPath(); c.ellipse(cx - 4, cy - 1, 2, 3, 0, 0, Math.PI * 2); c.ellipse(cx + 4, cy - 1, 2, 3, 0, 0, Math.PI * 2); c.fill();
    wispCache.set(color, cv);
    return cv;
  }
  function wisp(c, u, t) {
    const col = u.team === 0 && u.kind === 'soldier' ? '#7fd3e6' : u.summon === 'ghostsol' ? '#e6edf5' : (u.color && u.color.length === 7 ? u.color : '#8b95a6');
    const img = wispSprite(col);
    const sw = u.swing > 0 ? Math.sin((u.swing / 0.2) * Math.PI) : 0;
    const fl = 1 + Math.sin(t * 11 + (u.bob || 0) * 3) * 0.07;
    const k = (u.r / 7) * (u.stype === 'cavalry' ? 1.1 : 1);
    const w = 22 * k, h = 28.6 * k * fl;
    const lx = u.x + Math.cos(u.face || 0) * sw * 5, ly = u.y + Math.sin(u.face || 0) * sw * 5;
    const sp = Math.hypot(u.vx || 0, u.vy || 0);
    if (sp > 10) {
      const bx = -(u.vx || 0) / sp, by = -(u.vy || 0) / sp;
      c.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 3; i++) {
        c.globalAlpha = 0.18 / i;
        c.drawImage(img, lx + bx * i * 5 - w / 2, ly + by * i * 5 - h * 0.78, w, h);
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    c.globalCompositeOperation = 'lighter';
    c.drawImage(img, lx - w / 2, ly - h * 0.78, w, h);
    if (u.flash > 0) { c.globalAlpha = 0.7; c.drawImage(img, lx - w / 2, ly - h * 0.78, w, h); c.globalAlpha = 1; }
    c.globalCompositeOperation = 'source-over';
    if (u.stype === 'archer') {
      c.strokeStyle = hexA(col, 0.8); c.lineWidth = 1.2;
      c.beginPath(); c.arc(lx + Math.cos(u.face || 0) * 5, ly - 3 + Math.sin(u.face || 0) * 5, 5, (u.face || 0) - 1.1, (u.face || 0) + 1.1); c.stroke();
    } else if (sw > 0.2) {
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.4;
      c.beginPath(); c.arc(lx, ly - 2, 10, (u.face || 0) - 0.8, (u.face || 0) + 0.8); c.stroke();
    }
  }
  return { hero, wisp, lookOf, LOOKS };
})();
