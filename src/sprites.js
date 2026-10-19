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

  function knockBg(im) {
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
    const isDarkBg = (r, g, b) => {
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const span = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum < 52 && span < 42) return true;
      if (lum < 62 && span < 18) return true;
      return false;
    };
    /* 1) 마젠타 키는 전체에 적용 — 보라 사각 잔상 방지 */
    for (let p = 0; p < d.length; p += 4) {
      if (isMagenta(d[p], d[p + 1], d[p + 2])) d[p + 3] = 0;
    }
    const isBg = (p) => {
      if (d[p + 3] === 0) return true;
      return isDarkBg(d[p], d[p + 1], d[p + 2]);
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
    /* 2) 키잉 가장자리 1px 침식 — jpg 핑크 헤일로 제거 */
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) alpha[i] = d[i * 4 + 3];
    for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
      const n = yy * w + xx;
      if (alpha[n] === 0) continue;
      if (!alpha[n - 1] || !alpha[n + 1] || !alpha[n - w] || !alpha[n + w]) {
        const p = n * 4;
        if (isMagenta(d[p], d[p + 1], d[p + 2]) || isDarkBg(d[p], d[p + 1], d[p + 2])) d[p + 3] = 0;
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
    keyed[key] = knockBg(im);
    return keyed[key];
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
    SHEET_IDS.forEach((id) => loadImg(sheets, id, `img/sheets/${id}.jpg`));
    FX_IDS.forEach((id) => loadImg(fx, id, `img/fx/${id}.jpg`));
  }

  function frameOf(u, t) {
    if (u.swing > 0) {
      const k = 1 - Math.max(0, Math.min(1, u.swing / 0.22));
      if (k < 0.28) return 1;
      if (k < 0.72) return 2;
      return 3;
    }
    const moving = Math.hypot(u.vx || 0, u.vy || 0) > 8 && (u.stun || 0) <= 0;
    if (moving) return Math.floor(t * 14 + (u.bob || 0) * 3) % 2;
    return Math.sin(t * 3.2 + (u.bob || 0)) > 0.62 ? 1 : 0;
  }

  function blitSheet(c, spr, frame, x, y, h, dir, stunT) {
    const fw = spr.width / FRAMES, fh = spr.height;
    const w = h * (fw / fh);
    c.save();
    c.translate(x, y);
    c.scale(dir, 1);
    if (stunT) c.rotate(Math.sin(stunT) * 0.05);
    c.drawImage(spr, fw * frame, 0, fw, fh, -w / 2, -h, w, h);
    c.restore();
    return { w, h };
  }

  function drawActor(c, u, t) {
    const id = u.generic ? 'generic' : (u.hid || 'generic');
    const spr = sheetOf(id) || sheetOf('generic');
    if (!spr) return false;
    const dir = Math.cos(u.face || 0) >= 0 ? 1 : -1;
    const spd = Math.hypot(u.vx || 0, u.vy || 0);
    const moving = spd > 8 && (u.stun || 0) <= 0;
    const bob = moving ? Math.abs(Math.sin(t * 18 + (u.bob || 0))) * 2.2 : Math.sin(t * 2.8 + (u.bob || 0)) * 0.65;
    const sc = u.boss ? 1.18 : 1;
    const hh = 92 * sc;
    const fr = frameOf(u, t);
    const sw = u.swing > 0 ? Math.sin((1 - Math.min(1, u.swing / 0.22)) * Math.PI) * 6 : 0;
    const lean = moving ? Math.min(0.12, spd / 900) * dir : 0;
    const stun = u.stun > 0 ? t * 22 : 0;
    c.save();
    c.translate(u.x, u.y + 10);
    c.rotate(lean);
    c.translate(-u.x, -(u.y + 10));
    c.translate(dir * sw, -bob);
    /* 어두운 시트도 전장에서 보이게: 은은한 실루엣 → 본체 (키잉 실패 시 보라 번짐 약화) */
    c.save();
    c.globalAlpha = 0.28;
    c.filter = 'brightness(1.9) contrast(0.85)';
    blitSheet(c, spr, fr, u.x, u.y + 11, hh, dir, stun);
    c.restore();
    c.filter = 'contrast(1.22) brightness(1.32) saturate(1.15)';
    blitSheet(c, spr, fr, u.x, u.y + 10, hh, dir, stun);
    c.filter = 'none';
    if (u.flash > 0) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = Math.min(0.75, u.flash * 4);
      blitSheet(c, spr, fr, u.x, u.y + 10, hh, dir, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }
    /* 이동 잔상 — 전투 밀도감 */
    if (moving && spd > 40) {
      c.globalAlpha = 0.18;
      blitSheet(c, spr, fr, u.x - dir * 7, u.y + 10, hh * 0.98, dir, 0);
      c.globalAlpha = 0.1;
      blitSheet(c, spr, fr, u.x - dir * 14, u.y + 10, hh * 0.96, dir, 0);
      c.globalAlpha = 1;
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
