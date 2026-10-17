'use strict';
/* ===== 전장 그림: 영웅 캐릭터와 혼불 졸병 ===== */
const Art = (() => {
  const portraits = Object.create(null);
  const chars = Object.create(null);
  const keyed = Object.create(null);
  (typeof HERO_ORDER !== 'undefined' ? HERO_ORDER : []).forEach((id) => {
    const p = new Image(); p.src = `img/portraits/${id}.jpg`; portraits[id] = p;
    const c = new Image(); c.src = `img/chars/${id}.jpg`; chars[id] = c;
  });
  function ok(im) { return !!(im && im.complete && im.naturalWidth); }
  function keyedChar(id) {
    if (keyed[id]) return keyed[id];
    const im = chars[id];
    if (!ok(im)) return null;
    const w = im.naturalWidth, h = im.naturalHeight;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.drawImage(im, 0, 0);
    const img = x.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const span = Math.max(r, g, b) - Math.min(r, g, b);
      if (lum < 22 && span < 18) d[i + 3] = 0;
      else if (lum < 38 && span < 22) d[i + 3] = Math.round(d[i + 3] * ((lum - 22) / 16));
    }
    x.putImageData(img, 0, 0);
    keyed[id] = cv;
    return cv;
  }
  return { portraits, chars, ok, keyedChar };
})();

const Sprites = (() => {
  /* 영웅마다 모자, 옷, 갑옷, 등 뒤 소품, 탈것이 다르다 */
  const LOOKS = {
    hero:       { hat: 'hood', hatColor: '#1b2a30', robe: '#1c2c33', trim: '#7fd3e6', pants: '#121a1e', skin: '#cfe6ea', ghostly: true, flame: true, longRobe: true },
    gangrim:    { hat: 'gat', hatColor: '#0a0a0b', robe: '#16161b', trim: '#c4bba8', pants: '#0e0e12', skin: '#d9ccb5', sash: '#b8402f', longRobe: true },
    eulji:      { hat: 'jougwan', hatColor: '#25384a', plume: '#efe7d2', robe: '#2c4f6e', trim: '#5aa7d6', beard: true, longRobe: true },
    sunsin:     { hat: 'helmet', hatColor: '#2b2521', tassel: '#d0402e', robe: '#7a2418', armor: '#3b302a', trim: '#d9ab4a', cape: '#8f2a1f', beard: true },
    sejong:     { hat: 'iksun', hatColor: '#121214', robe: '#a8251c', trim: '#e8c050', emblem: '#e8c050', beard: true, longRobe: true },
    gwanggaeto: { hat: 'helmet', hatColor: '#3a3448', tassel: '#a07ce6', robe: '#3b2f55', armor: '#4a4560', trim: '#a07ce6', mount: true, beard: true },
    gamchan:    { hat: 'boktu', hatColor: '#121214', robe: '#2a4a7a', trim: '#8cbcff', beard: true, small: true, longRobe: true },
    yusin:      { hat: 'helmet', hatColor: '#6b5a2a', tassel: '#c896e2', robe: '#4a2f5a', armor: '#7a6a3a', trim: '#e0c060', cape: '#5a3a6a' },
    gaesomun:   { hat: 'jougwan', hatColor: '#3a1a1a', plume: '#d0383f', robe: '#5a1a1c', armor: '#3a2a2a', trim: '#d0383f', swords: true, beard: true },
    gyeonhwon:  { hat: 'tiger', hatColor: '#e8893a', robe: '#5a3418', armor: '#4a3a2a', trim: '#e8893a', cape: '#c8742e', beard: true },
    heojun:     { hat: 'gat', hatColor: '#121212', robe: '#e6dfcc', trim: '#72d394', pants: '#bfb8a5', medbox: true, beard: true, longRobe: true },
    gyebaek:    { hat: 'helmet', hatColor: '#1e2024', tassel: '#6a6f78', robe: '#2a2c30', armor: '#3a3e44', trim: '#aeb4bc', cape: '#1a1b1e', tattered: true, beard: true },
    gildong:    { hat: 'gat', hatColor: '#0e0e0e', robe: '#1c4a42', trim: '#3fc6a8', mask: true, longRobe: true },
  };

  function ghostLook(color) {
    return { hat: 'helmet', hatColor: shade(color, 0.3), tassel: color, robe: shade(color, 0.28), armor: shade(color, 0.45), trim: color, ghostly: true, faceless: true };
  }
  function lookOf(u) {
    if (u.generic) return u._look || (u._look = ghostLook(u.color.length === 7 ? u.color : '#8b95a6'));
    const base = (HEROES[u.hid] && HEROES[u.hid].look) || LOOKS[u.hid] || LOOKS.hero;
    return base;
  }

  function hexA(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function shade(hex, k) {
    const n = parseInt(hex.replace('#', ''), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `#${[f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  }

  function painted(c, u, t) {
    const spr = Art.keyedChar(u.hid);
    if (!spr) return false;
    const moving = Math.hypot(u.vx, u.vy) > 5 && u.stun <= 0;
    const dir = Math.cos(u.face) >= 0 ? 1 : -1;
    const sw = u.swing > 0 ? Math.sin((u.swing / 0.2) * Math.PI) : 0;
    const ph = t * 13 + u.bob;
    const bob = moving ? Math.abs(Math.sin(ph)) * 1.8 : Math.sin(t * 2.2 + u.bob) * 0.6;
    const sc = (u.boss ? 1.12 : 1) * ((LOOKS[u.hid] || {}).small ? 0.9 : 1) * ((LOOKS[u.hid] || {}).mount ? 1.18 : 1);
    const h = 58 * sc;
    const w = h * (spr.width / spr.height);
    c.save();
    c.translate(u.x + dir * sw * 4, u.y + 10);
    c.scale(dir, 1);
    if (u.stun > 0) c.rotate(Math.sin(t * 20) * 0.05);
    c.translate(0, -bob);
    c.drawImage(spr, -w / 2, -h, w, h);
    if (u.flash > 0) {
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = 0.4;
      c.drawImage(spr, -w / 2, -h, w, h);
    }
    c.restore();
    return true;
  }

  /* ---------- 영웅 ---------- */
  function hero(c, u, t, opts = {}) {
    if (!u.generic && painted(c, u, t)) return;
    const L = lookOf(u);
    const moving = Math.hypot(u.vx, u.vy) > 5 && u.stun <= 0;
    const dir = Math.cos(u.face) >= 0 ? 1 : -1;
    const sw = u.swing > 0 ? Math.sin((u.swing / 0.2) * Math.PI) : 0;
    const ph = t * 13 + u.bob;
    const walk = moving ? Math.sin(ph) : 0;
    const bob = moving ? Math.abs(Math.sin(ph)) * 1.4 : Math.sin(t * 2.2 + u.bob) * 0.5;
    c.save();
    c.translate(u.x + dir * sw * 5, u.y + 8 - (u.stun > 0 ? 0 : 0));
    const sc = 1.28 * (u.boss ? 1.12 : 1) * (L.small ? 0.93 : 1);
    c.scale(dir * sc, sc);
    if (u.stun > 0) c.rotate(Math.sin(t * 20) * 0.05);
    if (L.mount) { horse(c, t, moving, L); c.translate(0, -13); }
    c.translate(0, -bob);
    const ghostly = L.ghostly;

    // 망토
    if (L.cape) {
      const wave = Math.sin(t * 6 + u.bob) * 1.6 + (moving ? -2 : 0);
      c.fillStyle = L.cape;
      c.beginPath();
      c.moveTo(-4, -21); c.quadraticCurveTo(-10 + wave, -12, -11 + wave, -3);
      if (L.tattered) { c.lineTo(-9 + wave, -5); c.lineTo(-7 + wave, -2); c.lineTo(-5, -5); c.lineTo(-3, -2); }
      else c.lineTo(-2, -3);
      c.closePath(); c.fill();
    }
    // 등 뒤 소품
    if (L.swords) {
      c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const a = -2.3 + i * 0.22;
        c.strokeStyle = '#cfcbc0'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(-2, -15); c.lineTo(-2 + Math.cos(a) * 16, -15 + Math.sin(a) * 16); c.stroke();
        c.strokeStyle = '#6b3a20'; c.lineWidth = 2.2;
        c.beginPath(); c.moveTo(-2 + Math.cos(a) * 12, -15 + Math.sin(a) * 12); c.lineTo(-2 + Math.cos(a) * 16, -15 + Math.sin(a) * 16); c.stroke();
      }
    }
    if (L.medbox) {
      c.fillStyle = '#5a3c22'; c.strokeStyle = '#2a1a0e'; c.lineWidth = 1;
      c.fillRect(-11, -21, 6, 10); c.strokeRect(-11, -21, 6, 10);
      c.fillStyle = '#c8402f'; c.fillRect(-9.5, -17.5, 3, 1.2); c.fillRect(-8.6, -18.4, 1.2, 3);
    }
    // 다리 또는 혼령 꼬리
    if (!L.mount) {
      if (ghostly) {
        const g = c.createLinearGradient(0, -8, 0, 2);
        g.addColorStop(0, hexA(L.trim, 0.55)); g.addColorStop(1, hexA(L.trim, 0));
        c.fillStyle = g;
        c.beginPath(); c.moveTo(-7, -8); c.quadraticCurveTo(-4 + Math.sin(t * 7) * 2, 0, 0, 3); c.quadraticCurveTo(4 + Math.sin(t * 7 + 1) * 2, 0, 7, -8); c.closePath(); c.fill();
      } else {
        c.fillStyle = L.pants || '#1a1714';
        c.fillRect(-3.4 + walk * 2, -8, 3, 8);
        c.fillRect(0.6 - walk * 2, -8, 3, 8);
        c.fillStyle = '#0c0b0a';
        c.fillRect(-3.8 + walk * 2, -1.2, 3.8, 1.6);
        c.fillRect(0.4 - walk * 2, -1.2, 3.8, 1.6);
      }
    }
    // 뒷팔과 방패
    c.lineCap = 'round';
    c.strokeStyle = shade(L.robe, 0.8); c.lineWidth = 3.2;
    c.beginPath(); c.moveTo(-3.5, -19); c.lineTo(-6 - walk, -12); c.stroke();
    if (u.w2 === 'shield') {
      c.fillStyle = '#4a3a28'; c.strokeStyle = '#c9a85c'; c.lineWidth = 1.2;
      c.beginPath(); c.ellipse(-7.5, -13, 3.6, 6.4, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#c8402f'; c.beginPath(); c.arc(-7.5, -13, 1.4, 0, Math.PI * 2); c.fill();
    } else if (u.w2) weapon(c, u.w2, -6 - walk, -12, -1.3 + sw * 0.8, true);
    // 몸통
    const hem = L.longRobe ? -1.5 : -5.5, hw = L.longRobe ? 8.5 : 7.5;
    c.fillStyle = L.robe;
    c.beginPath(); c.moveTo(-5.5, -21.5); c.lineTo(5.5, -21.5); c.lineTo(hw, hem); c.lineTo(-hw, hem); c.closePath(); c.fill();
    c.strokeStyle = hexA(L.trim, 0.85); c.lineWidth = 1;
    c.beginPath(); c.moveTo(0.5, -21); c.lineTo(1.5, hem); c.stroke();
    if (L.armor) {
      c.fillStyle = L.armor;
      c.beginPath(); c.moveTo(-5.8, -21); c.lineTo(5.8, -21); c.lineTo(6.5, -9); c.lineTo(-6.5, -9); c.closePath(); c.fill();
      c.strokeStyle = hexA(L.trim, 0.45); c.lineWidth = 0.7;
      for (let y = -19; y < -9; y += 2.4) { c.beginPath(); c.moveTo(-6, y); c.lineTo(6, y); c.stroke(); }
      c.fillStyle = L.armor;
      c.beginPath(); c.ellipse(-5, -20, 3, 2, -0.3, 0, Math.PI * 2); c.ellipse(5, -20, 3, 2, 0.3, 0, Math.PI * 2); c.fill();
    }
    if (L.emblem) { c.fillStyle = L.emblem; c.beginPath(); c.arc(0.5, -15, 2.8, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#7a1a12'; c.lineWidth = 0.6; c.stroke(); }
    if (L.sash) { c.strokeStyle = L.sash; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-5, -20); c.lineTo(5.5, -10); c.stroke(); }
    c.strokeStyle = L.trim; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-6.4, -9.5); c.lineTo(6.4, -9.5); c.stroke();
    // 머리
    const hy = -26.5;
    if (L.faceless) {
      c.fillStyle = '#07080a'; c.beginPath(); c.arc(0, hy, 5.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = L.trim; c.shadowColor = L.trim; c.shadowBlur = 6;
      c.beginPath(); c.arc(1.2, hy, 0.9, 0, Math.PI * 2); c.arc(3.6, hy, 0.9, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    } else {
      c.fillStyle = L.skin || '#e2c39b';
      c.beginPath(); c.arc(0, hy, 5.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#1a1210'; c.beginPath(); c.arc(2.6, hy - 0.4, 0.8, 0, Math.PI * 2); c.fill();
      if (L.beard) { c.fillStyle = '#231a14'; c.beginPath(); c.moveTo(0.5, hy + 2.6); c.quadraticCurveTo(3, hy + 8, 4.8, hy + 2.2); c.closePath(); c.fill(); }
      if (L.mask) { c.fillStyle = '#0c0c0c'; c.fillRect(-2, hy - 1.8, 7.4, 2.4); }
    }
    hat(c, L, hy, t);
    // 앞팔과 무기
    const hx = 6.5 + walk * 0.5, hyy = -13.5;
    c.strokeStyle = L.armor || L.robe; c.lineWidth = 3.2;
    c.beginPath(); c.moveTo(3.5, -19); c.lineTo(hx, hyy); c.stroke();
    const wa = u.w1 === 'bow' ? 0 : -1.15 + sw * 2.1;
    if (u.w1) weapon(c, u.w1, hx, hyy, wa, false, sw, u);
    c.fillStyle = L.skin || '#e2c39b'; c.beginPath(); c.arc(hx, hyy, 1.6, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function hat(c, L, hy, t) {
    const hc = L.hatColor || '#111';
    if (L.hat === 'gat') {
      c.fillStyle = hexA(hc, 0.92);
      c.beginPath(); c.ellipse(0, hy - 4.2, 10.5, 2.3, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-3.6, hy - 4.5); c.lineTo(-3.2, hy - 11); c.quadraticCurveTo(0, hy - 12.4, 3.2, hy - 11); c.lineTo(3.6, hy - 4.5); c.closePath(); c.fill();
      c.fillStyle = '#7a5a3a';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-3.8 + i * 0.6, hy - 2 + i * 2, 0.6, 0, Math.PI * 2); c.fill(); }
    } else if (L.hat === 'iksun') {
      c.fillStyle = hc;
      c.beginPath(); c.arc(0, hy - 2.5, 5.8, Math.PI, 0); c.lineTo(5.8, hy - 1.5); c.lineTo(-5.8, hy - 1.5); c.closePath(); c.fill();
      c.beginPath(); c.ellipse(-4.5, hy - 9.5, 2.2, 3.6, -0.35, 0, Math.PI * 2); c.ellipse(-1, hy - 10.4, 2.2, 3.6, -0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8c050'; c.fillRect(-5.8, hy - 2.4, 11.6, 1);
    } else if (L.hat === 'helmet') {
      c.fillStyle = shade(hc, 0.8);
      c.fillRect(-6.4, hy - 3.2, 2.2, 7);
      c.fillStyle = hc;
      c.beginPath(); c.arc(0, hy - 2.2, 6.2, Math.PI, 0); c.closePath(); c.fill();
      c.strokeStyle = '#c9a85c'; c.lineWidth = 1; c.beginPath(); c.moveTo(-6.6, hy - 2); c.lineTo(6.6, hy - 2); c.stroke();
      c.strokeStyle = '#c9a85c'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, hy - 8.4); c.lineTo(0, hy - 12.5); c.stroke();
      if (L.tassel) { c.fillStyle = L.tassel; c.beginPath(); c.arc(0, hy - 13.2, 2.1, 0, Math.PI * 2); c.fill(); }
    } else if (L.hat === 'jougwan') {
      c.fillStyle = hc;
      c.beginPath(); c.moveTo(-5.4, hy - 2); c.lineTo(5.4, hy - 2); c.lineTo(1, hy - 9.5); c.lineTo(-1, hy - 9.5); c.closePath(); c.fill();
      c.strokeStyle = L.plume || '#eee'; c.lineWidth = 1.8; c.lineCap = 'round';
      const w = Math.sin(t * 4) * 0.8;
      c.beginPath(); c.moveTo(-1.5, hy - 8); c.quadraticCurveTo(-6, hy - 13, -8 + w, hy - 19); c.stroke();
      c.beginPath(); c.moveTo(1.5, hy - 8); c.quadraticCurveTo(5, hy - 14, 5.5 + w, hy - 20); c.stroke();
    } else if (L.hat === 'boktu') {
      c.fillStyle = hc;
      c.beginPath(); c.moveTo(-5, hy - 1.5); c.lineTo(-4.5, hy - 8.5); c.quadraticCurveTo(0, hy - 10.5, 4.5, hy - 8.5); c.lineTo(5, hy - 1.5); c.closePath(); c.fill();
      c.strokeStyle = hc; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-4, hy - 5); c.lineTo(-14, hy - 5.5); c.moveTo(4, hy - 5); c.lineTo(14, hy - 5.5); c.stroke();
    } else if (L.hat === 'hood') {
      c.fillStyle = hc;
      c.beginPath(); c.moveTo(-6.5, hy + 4); c.quadraticCurveTo(-8, hy - 7, 0, hy - 8.5); c.quadraticCurveTo(7, hy - 7, 6.2, hy + 1); c.lineTo(3.8, hy + 1); c.quadraticCurveTo(4.2, hy - 4, 0.5, hy - 5); c.quadraticCurveTo(-3.5, hy - 4, -3.2, hy + 4); c.closePath(); c.fill();
      if (L.flame) {
        const f = Math.sin(t * 9) * 1.2;
        const g = c.createRadialGradient(0, hy - 12, 0, 0, hy - 12, 6);
        g.addColorStop(0, 'rgba(230,252,255,0.95)'); g.addColorStop(0.5, 'rgba(127,211,230,0.7)'); g.addColorStop(1, 'rgba(127,211,230,0)');
        c.fillStyle = g; c.beginPath(); c.moveTo(-3.5, hy - 9); c.quadraticCurveTo(0, hy - 20 - f, 3.5, hy - 9); c.closePath(); c.fill();
      }
    } else if (L.hat === 'tiger') {
      c.fillStyle = hc;
      c.beginPath(); c.arc(0, hy - 1.5, 6.4, Math.PI * 1.05, Math.PI * 0.05); c.lineTo(7, hy + 3); c.lineTo(-7.5, hy + 5); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-5, hy - 5); c.lineTo(-6.5, hy - 9.5); c.lineTo(-2.5, hy - 7); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(2, hy - 7); c.lineTo(4, hy - 10); c.lineTo(5.5, hy - 5); c.closePath(); c.fill();
      c.strokeStyle = '#1a120c'; c.lineWidth = 1.1;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 2.2, hy - 7); c.lineTo(i * 2.2 + 0.8, hy - 3.5); c.stroke(); }
      c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(4.4, hy - 4.5, 0.8, 0, Math.PI * 2); c.fill();
    }
  }

  function weapon(c, wt, x, y, a, back, sw = 0, u = null) {
    c.save(); c.translate(x, y); c.rotate(a);
    c.lineCap = 'round';
    if (wt === 'bow') {
      const pull = sw * 4;
      c.strokeStyle = '#8a6a3e'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(1, -11); c.quadraticCurveTo(8, 0, 1, 11); c.stroke();
      c.strokeStyle = 'rgba(230,220,200,0.7)'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(1, -11); c.lineTo(1 - pull, 0); c.lineTo(1, 11); c.stroke();
      if (sw > 0) { c.strokeStyle = '#e6dcc4'; c.lineWidth = 1; c.beginPath(); c.moveTo(1 - pull, 0); c.lineTo(12, 0); c.stroke(); }
    } else if (wt === 'spear' || wt === 'glaive') {
      c.strokeStyle = '#6b4a2a'; c.lineWidth = 1.8;
      c.beginPath(); c.moveTo(-8, 0); c.lineTo(24, 0); c.stroke();
      c.fillStyle = '#e4e0d6';
      if (wt === 'spear') { c.beginPath(); c.moveTo(24, -2.2); c.lineTo(31, 0); c.lineTo(24, 2.2); c.closePath(); c.fill(); c.fillStyle = '#c8402f'; c.beginPath(); c.arc(23, 2.5, 1.6, 0, Math.PI * 2); c.fill(); }
      else { c.beginPath(); c.moveTo(21, -1); c.quadraticCurveTo(30, -7, 32, 0); c.quadraticCurveTo(28, 2, 21, 2); c.closePath(); c.fill(); }
    } else if (wt === 'fan') {
      c.fillStyle = 'rgba(244,240,228,0.95)';
      c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 9, -0.55, 0.55); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(80,60,40,0.6)'; c.lineWidth = 0.5;
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * 0.25) * 9, Math.sin(i * 0.25) * 9); c.stroke(); }
    } else if (wt === 'brush') {
      c.strokeStyle = '#7a5530'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-3, 0); c.lineTo(13, 0); c.stroke();
      c.fillStyle = '#0d0d0d'; c.beginPath(); c.ellipse(15.5, 0, 3.6, 2, 0, 0, Math.PI * 2); c.fill();
    } else if (wt === 'talisman') {
      c.fillStyle = '#c8302a'; c.fillRect(1, -3, 11, 6);
      c.strokeStyle = '#f2d36b'; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(3, -1.5); c.lineTo(10, -1.5); c.moveTo(3, 0.5); c.lineTo(8, 0.5); c.moveTo(3, 2); c.lineTo(10, 2); c.stroke();
    } else {
      const len = wt === 'dagger' ? 8 : u && u.style === '양손무기' ? 19 : 14;
      c.strokeStyle = '#e8e5dc'; c.lineWidth = wt === 'dagger' ? 1.6 : 2;
      c.beginPath(); c.moveTo(2, 0); c.lineTo(2 + len, 0); c.stroke();
      c.strokeStyle = '#8a6a3a'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(1.5, -2.6); c.lineTo(1.5, 2.6); c.stroke();
      c.strokeStyle = '#3a2614'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(-2, 0); c.lineTo(1.5, 0); c.stroke();
      if (sw > 0.3) {
        c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 5;
        c.beginPath(); c.moveTo(4, 0); c.lineTo(2 + len, 0); c.stroke();
      }
    }
    c.restore();
  }

  function horse(c, t, moving, L) {
    const g = moving ? t * 16 : 0;
    c.strokeStyle = '#1f1b26'; c.lineWidth = 2.4; c.lineCap = 'round';
    [[-9, 0], [-5, 0.6], [6, 0], [10, 0.6]].forEach(([x, o], i) => {
      const s = moving ? Math.sin(g + i * 1.6 + o) * 4 : 0;
      c.beginPath(); c.moveTo(x, -6); c.lineTo(x + s, 0); c.stroke();
    });
    c.fillStyle = '#2b2733'; c.strokeStyle = '#141119'; c.lineWidth = 1;
    c.beginPath(); c.ellipse(0, -9, 14, 5.6, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(10, -12); c.lineTo(15, -19); c.lineTo(19, -17); c.lineTo(14, -9); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(18.5, -18, 4.6, 2.6, 0.5, 0, Math.PI * 2); c.fill();
    c.strokeStyle = hexA(L.trim, 0.55); c.lineWidth = 0.7;
    for (let x = -11; x < 11; x += 2.6) { c.beginPath(); c.arc(x, -9, 2.2, 0.2, Math.PI - 0.2); c.stroke(); }
    c.strokeStyle = '#1a1620'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-14, -10); c.quadraticCurveTo(-19, -8 + Math.sin(t * 8) * 2, -18, -3); c.stroke();
    c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(20.5, -18.6, 0.7, 0, Math.PI * 2); c.fill();
  }

  /* ---------- 혼불 졸병 ---------- */
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
    const fl = 1 + Math.sin(t * 11 + u.bob * 3) * 0.07;
    const k = (u.r / 7) * (u.stype === 'cavalry' ? 1.1 : 1);
    const w = 22 * k, h = 28.6 * k * fl;
    const lx = u.x + Math.cos(u.face) * sw * 5, ly = u.y + Math.sin(u.face) * sw * 5;
    // 꼬리
    const sp = Math.hypot(u.vx, u.vy);
    if (sp > 10) {
      const bx = -u.vx / sp, by = -u.vy / sp;
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
    // 무기 흔적
    if (u.stype === 'archer') {
      c.strokeStyle = hexA(col, 0.8); c.lineWidth = 1.2;
      c.beginPath(); c.arc(lx + Math.cos(u.face) * 5, ly - 3 + Math.sin(u.face) * 5, 5, u.face - 1.1, u.face + 1.1); c.stroke();
    } else if (sw > 0.2) {
      c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 1.4;
      c.beginPath(); c.arc(lx, ly - 2, 10, u.face - 0.8, u.face + 0.8); c.stroke();
    }
  }

  return { hero, wisp, lookOf, LOOKS };
})();
