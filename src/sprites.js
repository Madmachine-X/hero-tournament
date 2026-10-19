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
    /* jpg 시트는 검정·짙은 회색 바탕. 너무 약하게 지우면 전장에서 캐릭터가 배경에 묻힌다. */
    const isBg = (p) => {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const span = Math.max(r, g, b) - Math.min(r, g, b);
      /* 마젠타/핑크 키 (jpg 압축 후 분홍빛 포함) */
      if (r > 180 && b > 180 && g < 120 && r + b > g * 2.4) return true;
      if (lum < 52 && span < 42) return true;
      if (lum < 62 && span < 18) return true; /* 연기에 가까운 회색 가장자리 */
      return false;
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
    if (u.swing > 0) return u.swing > 0.08 ? 2 : 3;
    const moving = Math.hypot(u.vx || 0, u.vy || 0) > 8 && (u.stun || 0) <= 0;
    if (moving) return Math.floor(t * 9 + (u.bob || 0)) % 2;
    return Math.sin(t * 2.4 + (u.bob || 0)) > 0.55 ? 1 : 0;
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
    const moving = Math.hypot(u.vx || 0, u.vy || 0) > 8 && (u.stun || 0) <= 0;
    const bob = moving ? Math.abs(Math.sin(t * 13 + (u.bob || 0))) * 1.6 : Math.sin(t * 2.2 + (u.bob || 0)) * 0.5;
    const sc = u.boss ? 1.18 : 1;
    const hh = 92 * sc;
    const fr = frameOf(u, t);
    const sw = u.swing > 0 ? Math.sin((u.swing / 0.2) * Math.PI) * 4 : 0;
    const stun = u.stun > 0 ? t * 20 : 0;
    c.save();
    c.translate(dir * sw, -bob);
    /* 어두운 시트도 전장에서 보이게: 밝은 실루엣 → 본체 */
    c.save();
    c.globalAlpha = 0.55;
    c.filter = 'brightness(2.8) contrast(0.7)';
    blitSheet(c, spr, fr, u.x + 1, u.y + 11, hh, dir, stun);
    blitSheet(c, spr, fr, u.x - 1, u.y + 9, hh, dir, stun);
    c.restore();
    c.filter = 'contrast(1.28) brightness(1.38) saturate(1.2)';
    blitSheet(c, spr, fr, u.x, u.y + 10, hh, dir, stun);
    c.filter = 'none';
    if (u.flash > 0) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.5;
      blitSheet(c, spr, fr, u.x, u.y + 10, hh, dir, 0);
      c.globalAlpha = 1;
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

  function skillFx(id) { return SKILL_FX[id] || 'slash'; }

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
