'use strict';
/* ===== 업경대 전략 지도 (한반도, 혼맥 점령) ===== */
const MapView = (() => {
  const LW = 560, LH = 800, CELL = 4;
  const GW = LW / CELL, GH = LH / CELL;
  const OUTLINE = [[124.37,40.0],[124.9,40.4],[125.5,40.75],[126.1,41.05],[126.7,41.65],[127.2,41.5],[127.8,41.42],[128.05,41.98],[128.6,42.02],[129.05,42.2],[129.45,42.45],[129.75,42.9],[130.15,42.8],[130.4,42.6],[130.68,42.3],[130.3,42.2],[129.85,41.85],[129.65,41.45],[129.72,41.1],[129.35,40.82],[129.15,40.65],[128.85,40.45],[128.55,40.15],[128.15,40.0],[127.75,39.86],[127.55,39.62],[127.45,39.3],[127.42,39.12],[127.62,38.98],[128.0,38.76],[128.35,38.58],[128.6,38.2],[128.92,37.8],[129.2,37.42],[129.4,36.95],[129.43,36.45],[129.57,36.06],[129.45,35.6],[129.22,35.2],[129.05,35.05],[128.75,35.0],[128.48,34.86],[128.1,34.86],[127.78,34.72],[127.42,34.52],[126.92,34.4],[126.55,34.3],[126.3,34.6],[126.38,35.0],[126.48,35.4],[126.68,35.94],[126.55,36.35],[126.18,36.62],[126.38,36.95],[126.78,37.02],[126.62,37.42],[126.55,37.72],[126.18,37.82],[125.8,37.76],[125.45,37.73],[125.12,37.86],[124.72,38.1],[124.98,38.42],[125.32,38.66],[125.15,39.0],[125.36,39.38],[125.02,39.58],[124.68,39.66],[124.45,39.85]];
  const proj = (lon, lat) => ({ x: (lon - 124) * 64 + 40, y: (43 - lat) * 80 - 20 });
  const cityIds = Object.keys(CITIES);
  let cv, ctx, DPR = 1, scale = 1, offX = 0, offY = 0, cw = 1, ch = 1;
  let base = null, region = null, cellCity = null, border = null;
  let sel = null, hover = null, anim = null, raf = 0, running = false, t0 = performance.now();
  let onSelect = () => {};

  function landPath(c) {
    c.beginPath();
    OUTLINE.forEach(([lon, lat], i) => { const p = proj(lon, lat); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); });
    c.closePath();
    const j = proj(126.55, 33.38);
    c.moveTo(j.x + 26, j.y);
    c.ellipse(j.x, j.y, 26, 13, -0.08, 0, Math.PI * 2);
    const ul = proj(130.87, 37.5);
    c.moveTo(ul.x + 4, ul.y);
    c.ellipse(ul.x, ul.y, 4, 3.5, 0, 0, Math.PI * 2);
    const dk = proj(131.87, 37.24);
    c.moveTo(dk.x + 2.2, dk.y);
    c.ellipse(dk.x, dk.y, 2.2, 1.8, 0, 0, Math.PI * 2);
  }

  function init(selectCb) {
    onSelect = selectCb;
    cv = $('#map');
    ctx = cv.getContext('2d');
    // 셀 계산
    const off = document.createElement('canvas');
    off.width = LW; off.height = LH;
    const oc = off.getContext('2d');
    oc.fillStyle = '#fff'; landPath(oc); oc.fill();
    const img = oc.getImageData(0, 0, LW, LH).data;
    cellCity = new Int8Array(GW * GH).fill(-1);
    const cpos = cityIds.map((id) => proj(CITIES[id].lon, CITIES[id].lat));
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const px = gx * CELL + 2, py = gy * CELL + 2;
      if (img[(py * LW + px) * 4 + 3] < 128) continue;
      let bi = 0, bd = 1e9;
      cpos.forEach((p, i) => { const d = (p.x - px) ** 2 + (p.y - py) ** 2; if (d < bd) { bd = d; bi = i; } });
      cellCity[gy * GW + gx] = bi;
    }
    border = new Uint8Array(GW * GH);
    for (let gy = 1; gy < GH - 1; gy++) for (let gx = 1; gx < GW - 1; gx++) {
      const i = gy * GW + gx, v = cellCity[i];
      if (v < 0) continue;
      if ((cellCity[i + 1] >= 0 && cellCity[i + 1] !== v) || (cellCity[i + GW] >= 0 && cellCity[i + GW] !== v)) border[i] = 1;
    }
    base = makeBase();
    region = document.createElement('canvas');
    region.width = LW; region.height = LH;
    redrawRegions();
    cv.addEventListener('pointermove', (e) => { hover = hitTest(e); cv.style.cursor = hover ? 'pointer' : 'default'; });
    cv.addEventListener('pointerleave', () => { hover = null; });
    cv.addEventListener('click', (e) => { const h = hitTest(e); sel = h; onSelect(h); });
    window.addEventListener('resize', resize);
  }

  function makeBase() {
    const b = document.createElement('canvas');
    b.width = LW; b.height = LH;
    const c = b.getContext('2d');
    const sea = c.createLinearGradient(0, 0, LW, LH);
    sea.addColorStop(0, '#0b1418'); sea.addColorStop(1, '#070c10');
    c.fillStyle = sea; c.fillRect(0, 0, LW, LH);
    c.strokeStyle = 'rgba(120,170,190,0.07)'; c.lineWidth = 1;
    for (let y = 10; y < LH; y += 14) {
      c.beginPath();
      for (let x = 0; x <= LW; x += 10) { const yy = y + Math.sin(x * 0.05 + y) * 2; if (x) c.lineTo(x, yy); else c.moveTo(x, yy); }
      c.stroke();
    }
    // 육지
    c.save();
    landPath(c);
    c.fillStyle = '#26221b'; c.fill();
    c.clip();
    for (let i = 0; i < 160; i++) {
      const x = Math.random() * LW, y = Math.random() * LH, r = 8 + Math.random() * 50;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, Math.random() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(120,105,80,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    // 산줄기 (백두대간 언저리)
    const ridge = [[128.2,41.2],[127.6,40.4],[127.3,39.6],[127.9,38.9],[128.4,38.2],[128.7,37.6],[128.9,37.0],[128.6,36.4],[128.0,35.9],[127.7,35.4]];
    c.fillStyle = 'rgba(170,155,120,0.28)';
    c.font = '13px "Noto Serif KR", serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    ridge.forEach(([lo, la], i) => { const p = proj(lo, la); c.fillText('山', p.x + (i % 2 ? 6 : -6), p.y); });
    c.restore();
    c.strokeStyle = 'rgba(215,200,165,0.55)'; c.lineWidth = 1.6;
    landPath(c); c.stroke();
    c.strokeStyle = 'rgba(215,200,165,0.12)'; c.lineWidth = 6;
    landPath(c); c.stroke();
    // 격자 (업경대 눈금)
    c.strokeStyle = 'rgba(217,171,74,0.06)'; c.lineWidth = 1;
    for (let lon = 125; lon <= 130; lon++) { const a = proj(lon, 43), b2 = proj(lon, 33); c.beginPath(); c.moveTo(a.x, 0); c.lineTo(b2.x, LH); c.stroke(); }
    for (let lat = 34; lat <= 42; lat++) { const a = proj(124, lat); c.beginPath(); c.moveTo(0, a.y); c.lineTo(LW, a.y); c.stroke(); }
    return b;
  }

  function ownerColor(cityIdx, ownerOverride) {
    const id = cityIds[cityIdx];
    const owner = ownerOverride && ownerOverride[id] ? ownerOverride[id] : G ? G.cities[id].owner : CITIES[id].owner;
    return FACTIONS[owner].color;
  }

  function redrawRegions(override) {
    const c = region.getContext('2d');
    c.clearRect(0, 0, LW, LH);
    c.globalAlpha = 0.34;
    for (let i = 0; i < cellCity.length; i++) {
      const v = cellCity[i];
      if (v < 0) continue;
      c.fillStyle = ownerColor(v, override);
      c.fillRect((i % GW) * CELL, Math.floor(i / GW) * CELL, CELL, CELL);
    }
    c.globalAlpha = 0.5;
    c.fillStyle = '#0b0a08';
    for (let i = 0; i < border.length; i++) if (border[i] && (i % 2 === 0)) c.fillRect((i % GW) * CELL + 1, Math.floor(i / GW) * CELL + 1, 2, 2);
    c.globalAlpha = 1;
  }

  /* 점령 연출: 도시에서 혼맥이 퍼져 나간다 */
  function spread(cityId, fromOwner) {
    const idx = cityIds.indexOf(cityId);
    const p = proj(CITIES[cityId].lon, CITIES[cityId].lat);
    let maxD = 0;
    for (let i = 0; i < cellCity.length; i++) if (cellCity[i] === idx) {
      const d = Math.hypot((i % GW) * CELL - p.x, Math.floor(i / GW) * CELL - p.y);
      if (d > maxD) maxD = d;
    }
    anim = { idx, p, maxD: maxD + 8, t: 0, dur: 1.6, from: fromOwner, cityId };
    redrawRegions({ [cityId]: fromOwner });
  }

  function hitTest(e) {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left - offX) / scale, y = (e.clientY - r.top - offY) / scale;
    for (const id of cityIds) { const p = proj(CITIES[id].lon, CITIES[id].lat); if (Math.hypot(p.x - x, p.y - y) < 20) return { type: 'city', id }; }
    if (G) for (const id of G.places) { const pl = PLACES[id]; const p = proj(pl.lon, pl.lat); if (Math.hypot(p.x - x, p.y - y) < 14) return { type: 'place', id }; }
    return null;
  }

  function resize() {
    if (!cv) return;
    DPR = Math.min(2, window.devicePixelRatio || 1);
    const r = cv.parentElement.getBoundingClientRect();
    cw = Math.max(1, r.width); ch = Math.max(1, r.height);
    cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
    cv.width = Math.round(cw * DPR); cv.height = Math.round(ch * DPR);
    scale = Math.min(cw / LW, ch / LH) * 0.98;
    offX = (cw - LW * scale) / 2; offY = (ch - LH * scale) / 2;
  }

  function start() { if (running) return; running = true; resize(); raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  function setSel(s) { sel = s; }

  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const t = (ts - t0) / 1000;
    const c = ctx;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.fillStyle = '#070c10'; c.fillRect(0, 0, cw, ch);
    c.setTransform(DPR * scale, 0, 0, DPR * scale, DPR * offX, DPR * offY);
    c.drawImage(base, 0, 0);
    c.drawImage(region, 0, 0);
    if (anim) {
      anim.t += 1 / 60;
      const k = Math.min(1, anim.t / anim.dur);
      const rr = anim.maxD * (1 - Math.pow(1 - k, 2));
      c.save();
      c.beginPath(); c.arc(anim.p.x, anim.p.y, rr, 0, Math.PI * 2); c.clip();
      c.globalAlpha = 0.5;
      c.fillStyle = FACTIONS.player.color;
      for (let i = 0; i < cellCity.length; i++) if (cellCity[i] === anim.idx) c.fillRect((i % GW) * CELL, Math.floor(i / GW) * CELL, CELL, CELL);
      c.restore();
      c.strokeStyle = `rgba(127,211,230,${0.8 * (1 - k)})`; c.lineWidth = 2;
      c.beginPath(); c.arc(anim.p.x, anim.p.y, rr, 0, Math.PI * 2); c.stroke();
      if (k >= 1) { anim = null; redrawRegions(); }
    }
    // 길
    c.setLineDash([3, 5]); c.lineWidth = 1.2;
    for (const [a, b] of ROADS) {
      const pa = proj(CITIES[a].lon, CITIES[a].lat), pb = proj(CITIES[b].lon, CITIES[b].lat);
      const live = sel && sel.type === 'city' && (sel.id === a || sel.id === b);
      c.strokeStyle = live ? 'rgba(232,192,80,0.75)' : 'rgba(220,205,170,0.22)';
      c.beginPath(); c.moveTo(pa.x, pa.y); c.lineTo(pb.x, pb.y); c.stroke();
    }
    c.setLineDash([]);
    // 숨겨진 장소
    if (G) for (const id of G.places) {
      const pl = PLACES[id], p = proj(pl.lon, pl.lat);
      const done = PLACES[id].events.every((ev) => G.done[ev]);
      const on = sel && sel.type === 'place' && sel.id === id;
      c.globalAlpha = done ? 0.45 : 0.85 + Math.sin(t * 3 + p.x) * 0.15;
      c.fillStyle = 'rgba(10,9,8,0.8)';
      c.beginPath(); c.arc(p.x, p.y, 8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = on ? '#e8c050' : done ? '#6f685a' : '#b9a6e8'; c.lineWidth = on ? 2 : 1.2;
      c.stroke();
      c.font = '700 10px "Noto Serif KR", serif'; c.fillStyle = done ? '#a59d8a' : '#d8ccff';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(done ? '✓' : '?', p.x, p.y + 0.5);
      c.globalAlpha = 1;
      if (on || hover && hover.type === 'place' && hover.id === id) {
        c.font = '11px "Gowun Dodum", sans-serif'; c.fillStyle = '#e2d8ff';
        c.fillText(pl.name, p.x, p.y - 15);
      }
    }
    // 도시
    for (const id of cityIds) {
      const ci = CITIES[id], p = proj(ci.lon, ci.lat), st = G ? G.cities[id] : { owner: ci.owner };
      const col = FACTIONS[st.owner].color;
      const on = sel && sel.type === 'city' && sel.id === id;
      const hv = hover && hover.type === 'city' && hover.id === id;
      const g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, 30);
      g.addColorStop(0, hexA2(col, 0.5)); g.addColorStop(1, hexA2(col, 0));
      c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, 30, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0d0c0a'; c.strokeStyle = col; c.lineWidth = on ? 3 : 2;
      c.beginPath(); c.arc(p.x, p.y, 11, 0, Math.PI * 2); c.fill(); c.stroke();
      if (on || hv) {
        c.strokeStyle = 'rgba(232,192,80,0.8)'; c.lineWidth = 1.2; c.setLineDash([4, 3]); c.lineDashOffset = -t * 12;
        c.beginPath(); c.arc(p.x, p.y, 17, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
      }
      c.font = '900 11px "Noto Serif KR", serif'; c.fillStyle = col; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(FACTIONS[st.owner].glyph, p.x, p.y + 0.5);
      c.font = '17px "Song Myung", serif';
      c.lineWidth = 4; c.strokeStyle = 'rgba(8,7,6,0.85)';
      const lx = id === 'pyongyang' || id === 'jeonju' ? p.x - 20 : p.x + 20;
      c.textAlign = id === 'pyongyang' || id === 'jeonju' ? 'right' : 'left';
      c.strokeText(ci.name, lx, p.y); c.fillStyle = '#efe6d0'; c.fillText(ci.name, lx, p.y);
    }
    // 시간대
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    const ph = G ? G.phase : 1;
    const tint = ['rgba(0,0,0,0)', 'rgba(200,110,40,0.09)', 'rgba(6,12,40,0.36)'][ph] || 'rgba(0,0,0,0)';
    c.fillStyle = tint; c.fillRect(0, 0, cw, ch);
    if (ph === NIGHT) {
      c.fillStyle = 'rgba(230,230,255,0.6)';
      for (let i = 0; i < 40; i++) { const x = (i * 97.3) % cw, y = (i * 53.7) % (ch * 0.4); c.globalAlpha = 0.3 + 0.3 * Math.sin(t * 2 + i); c.fillRect(x, y, 1.5, 1.5); }
      c.globalAlpha = 1;
    }
    const vg = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = vg; c.fillRect(0, 0, cw, ch);
  }

  function hexA2(hex, a) {
    const n = parseInt(hex.replace('#', ''), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  return { init, start, stop, resize, redrawRegions, spread, setSel, proj };
})();
