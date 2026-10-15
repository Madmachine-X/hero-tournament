const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/shots7';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(2000);
  const adv = async (max = 80) => { for (let i = 0; i < max; i++) { const st = await page.evaluate(() => { const d = document.querySelector('#dialog'); if (d.hidden) return 'c'; if (!document.querySelector('#dlg-input').hidden) return 'in'; if (!document.querySelector('#dlg-choices').hidden) return 'ch'; return 'l'; }); if (st === 'c') return; if (st === 'in') { await page.fill('#dlg-name-in', '한별'); await page.click('#dlg-input button'); continue; } if (st === 'ch') { await page.click('#dlg-choices .btn'); continue; } await page.evaluate(() => { window.__dbg.Dialog.advance(); window.__dbg.Dialog.advance(); }); await page.waitForTimeout(15); } };
  await page.click('#ti-new'); await page.waitForTimeout(200); await adv(); await page.click('[data-n="kr"]'); await adv(); await page.waitForTimeout(800);
  let r = await page.evaluate(() => window.__dbg.Battle.fastForward(300));
  console.log('tutorial', JSON.stringify(r));
  await page.waitForSelector('#br-ok'); await page.click('#br-ok'); await adv(); await page.waitForTimeout(300); await adv(); await page.waitForTimeout(400);
  // 내정 UI
  await page.evaluate(() => { UI.sel = { type: 'city', id: 'seoul' }; renderPanel(); });
  await page.click('[data-cmd="agri"]');
  await page.waitForTimeout(100);
  await page.screenshot({ path: OUT + '/cmd-picker.png' });
  await page.click('.cmdpick');
  await page.click('[data-cmd="draft"]'); await page.click('.cmdpick');
  await page.click('[data-cmd="train"]'); await page.click('.cmdpick');
  await page.waitForTimeout(100);
  await page.screenshot({ path: OUT + '/city-after.png' });
  console.log('seoul', JSON.stringify(await page.evaluate(() => window.__dbg.G.cities.seoul)), 'gold', await page.evaluate(() => window.__dbg.G.gold), 'free', await page.evaluate(() => freeHeroes().length));
  await page.evaluate(() => window.__dbg.endTurn()); await page.evaluate(() => closeModal());

  const closeAll = async () => { await adv(); await page.waitForTimeout(150); await adv(); await page.evaluate(() => closeModal()); };
  const fight = async (cityId) => {
    await page.evaluate((c) => window.__dbg.launchAttack(c), cityId);
    const ok = await page.$('#modal:not([hidden]) [data-go]');
    if (!ok) { console.log('no attack modal for', cityId); return false; }
    if (!(await ok.isVisible())) { await page.screenshot({ path: OUT + '/stuck-' + cityId + '.png' }); console.log('STUCK', cityId, await page.evaluate(() => [document.querySelector('#modal').hidden, document.querySelector('#modal-card').innerText.slice(0,300), document.querySelector('#dialog').hidden, [...document.querySelectorAll('.screen')].filter(e=>!e.hidden).map(e=>e.id)].join(' | '))); return false; }
    if (cityId === 'jeonju') await page.screenshot({ path: OUT + '/party-pick.png' });
    await page.click('#modal:not([hidden]) [data-go]');
    await page.waitForTimeout(800);
    if (cityId === 'jeonju') { await page.evaluate(() => window.__dbg.Battle.fastForward(12)); await page.waitForTimeout(100); await page.screenshot({ path: OUT + '/battle-mid.png' }); }
    let res, maxT = 0;
    for (let i = 0; i < 20; i++) { res = await page.evaluate(() => window.__dbg.Battle.fastForward(30)); maxT = res.t; if (res.over) break; }
    const sq = await page.evaluate(() => { const B = window.__dbg.Battle.state(); return B.squads.map(q => (q.team ? 'E' : 'A') + Math.round(q.morale) + (q.leader && q.leader.captain ? '*' : '')).join(' '); });
    await page.waitForSelector('#br-ok', { timeout: 8000 });
    const win = await page.evaluate(() => document.querySelector('.br-card').classList.contains('win'));
    const txt = await page.evaluate(() => document.querySelector('.br-stats').innerText.replace(/\n/g, ' '));
    await page.click('#br-ok'); await page.waitForTimeout(400);
    if (await page.$('#modal:not([hidden]) [data-gok]')) { if (!globalThis._gshot) { globalThis._gshot = 1; await page.screenshot({ path: OUT + '/garrison.png' }); } await page.click('[data-gok]'); }
    await page.waitForTimeout(1500); await closeAll();
    const dist = await page.evaluate(() => ownedCities().map(c => c + ':' + heroesIn(c).length).join(' '));
    console.log('  heroes', dist);
    console.log(cityId, win ? 'WIN' : 'LOSE', 't=' + Math.round(maxT), '|', txt, '| squads', sq);
    return win;
  };
  const prep = async () => page.evaluate(() => {
    const G = window.__dbg.G;
    // 서울과 아군 도시에서 남는 영웅으로 징병/훈련
    for (const c of ownedCities()) { for (const h of freeIn(c).slice(0, 2)) { doCommand(G.cities[c].troops < 200 ? 'draft' : 'train', h, c); } }
  });
  const turns = async (n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__dbg.endTurn()); await page.waitForTimeout(30); const m = await page.$('#modal:not([hidden]) [data-a="auto"]'); if (m) await m.click(); await closeAll(); } };
  await page.evaluate(() => { const G = window.__dbg.G; G.phase = NIGHT; window.__dbg.finishEvent('ev_gamchan'); closeModal(); });
  for (const c of ['gangneung', 'jeonju', 'tongyeong', 'pyongyang', 'gyeongju']) {
    let ok = false;
    for (let k = 0; k < 4 && !ok; k++) {
      await turns(1); await prep(); await turns(1);
      await page.evaluate((t) => { const G = window.__dbg.G; const src = neighbors(t).find(n => G.cities[n].owner === 'player'); if (!src) return; if (freeIn(src).length < 3) { for (const c of ownedCities()) { if (c === src) continue; const hs = freeIn(c); while (hs.length > 2 && freeIn(src).length < 4) { const h = hs.pop(); G.heroes[h].city = src; } } } }, c);
      if (c === 'jeonju' && k === 0) { await page.evaluate(() => { UI.sel = { type: 'city', id: 'seoul' }; renderPanel(); }); await page.screenshot({ path: OUT + '/city-card.png' }); }
      ok = await fight(c);
      await page.evaluate(() => { const G = window.__dbg.G; G.roster.forEach(h => G.heroes[h].hp = 1); G.gold += 300; G.food += 300; });
    }
  }
  // 영웅 없이 방어
  await page.evaluate(() => { window.__dbg.G.cities.pyongyang.owner = 'goguryeo'; window.__dbg.G.cities.pyongyang.troops = 200; window.__dbg.G.day = 9; window.__dbg.maybeEnemyAttack(true); });
  await page.waitForTimeout(200);
  if (await page.$('[data-a="fight"]')) {
    await page.click('[data-a="fight"]');
    await page.evaluate(() => { document.querySelectorAll('.pick-hero.on').forEach(b => b.click()); });
    await page.waitForTimeout(100);
    await page.screenshot({ path: OUT + '/defend-pick.png' });
    await page.click('[data-go]'); await page.waitForTimeout(1200);
    await page.screenshot({ path: OUT + '/defend-noheroes.png' });
    let rr; for (let i = 0; i < 10; i++) { rr = await page.evaluate(() => window.__dbg.Battle.fastForward(30)); if (rr.over) break; }
    console.log('defend no heroes', JSON.stringify(rr));
    await page.waitForSelector('#br-ok'); await page.click('#br-ok'); await page.waitForTimeout(300);
  }
  const st = await page.evaluate(() => ({ owners: Object.entries(window.__dbg.G.cities).map(([k, v]) => k + ':' + v.owner + ':' + v.troops).join(' '), roster: window.__dbg.G.roster.length, gold: window.__dbg.G.gold, food: window.__dbg.G.food, day: window.__dbg.G.day }));
  console.log(JSON.stringify(st));
  await page.screenshot({ path: OUT + '/map-end.png' });
  console.log('ERRORS', errors.join('\n') || 'none');
  await browser.close();
})();
