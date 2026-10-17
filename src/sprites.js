'use strict';
/* ===== 전장 그림: 그래픽 에셋 (시트 4프레임 + 스킬 FX) ===== */
const Art = (() => {
  const FRAMES = 4;
  const portraits = Object.create(null);
  const sheets = Object.create(null);
  const fx = Object.create(null);
  const keyed = Object.create(null);
  const HERO_IDS = typeof HERO_ORDER !== 'undefined' ? HERO_ORDER : [];
  const SHEET_IDS = HERO_IDS.concat(['generic', 'wisp']);
  const FX_IDS = ['orbs', 'rope', 'seal', 'wave', 'turtle', 'hangul', 'cavalry', 'meteor', 'slash', 'tiger', 'heal', 'arrows', 'swords'];
  const SKILL_FX = {
    honbul: 'orbs', ghostfire: 'orbs', orat: 'rope', jeokpae: 'seal',
    cheongcheon: 'wave', salsu: 'wave', tide: 'wave',
    hakik: 'arrows', hwasal: 'arrows', geobuk: 'turtle',
    hunmin: 'hangul', banpo: 'hangul',
    gaema: 'cavalry', musa: 'cavalry',
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
    const isBg = (p) => {
      const r = d[p], g = d[p + 1], b = d[p + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const span = Math.max(r, g, b) - Math.min(r, g, b);
      return lum < 38 && span < 30;
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
    const id = u.kind === 'soldier' || u.captain ? 'wisp' : (u.generic ? 'generic' : (u.hid || 'generic'));
    const spr = sheetOf(id) || sheetOf('generic');
    if (!spr) return false;
    const dir = Math.cos(u.face || 0) >= 0 ? 1 : -1;
    const moving = Math.hypot(u.vx || 0, u.vy || 0) > 8 && (u.stun || 0) <= 0;
    const bob = moving ? Math.abs(Math.sin(t * 13 + (u.bob || 0))) * 1.6 : Math.sin(t * 2.2 + (u.bob || 0)) * 0.5;
    const sc = (u.boss ? 1.14 : 1) * (u.kind === 'soldier' ? 0.72 : 1);
    const hh = (u.kind === 'soldier' ? 36 : 70) * sc;
    const fr = frameOf(u, t);
    const sw = u.swing > 0 ? Math.sin((u.swing / 0.2) * Math.PI) * 4 : 0;
    c.save();
    c.translate(dir * sw, -bob);
    blitSheet(c, spr, fr, u.x, u.y + 10, hh, dir, u.stun > 0 ? t * 20 : 0);
    if (u.flash > 0) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.45;
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
  function wisp(c, u, t) { Art.drawActor(c, u, t); }
  return { hero, wisp, lookOf, LOOKS };
})();
