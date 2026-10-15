const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/shots2';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(2200);
  const adv = async (max = 80) => {
    for (let i = 0; i < max; i++) {
      const st = await page.evaluate(() => {
        const d = document.querySelector('#dialog');
        if (d.hidden) return 'closed';
        if (!document.querySelector('#dlg-input').hidden) return 'input';
        if (!document.querySelector('#dlg-choices').hidden) return 'choice';
        return 'line';
      });
      if (st === 'closed') return;
      if (st === 'input') { await page.fill('#dlg-name-in', '한별'); await page.click('#dlg-input button'); continue; }
      if (st === 'choice') { await page.click('#dlg-choices .btn'); continue; }
      await page.evaluate(() => { window.__dbg.Dialog.advance(); window.__dbg.Dialog.advance(); });
      await page.waitForTimeout(20);
    }
  };
  const closeModal = () => page.evaluate(() => { document.querySelector('#modal').hidden = true; });
  await page.click('#ti-new'); await page.waitForTimeout(200);
  await adv(); await page.click('[data-n="kr"]'); await adv(); await page.waitForTimeout(800);
  await page.evaluate(() => window.__dbg.Battle.fastForward(150));
  await page.waitForSelector('#br-ok'); await page.click('#br-ok'); await adv(); await page.waitForTimeout(300); await adv();
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/map0.png' });

  const fight = async (cityId) => {
    await page.evaluate(() => { window.__dbg.G.ap = 1; });
    await page.evaluate((c) => window.__dbg.launchAttack(c), cityId);
    await page.waitForSelector('[data-go]');
    await page.click('[data-go]');
    await page.waitForTimeout(900);
    let res = null;
    for (let i = 0; i < 10; i++) { res = await page.evaluate(() => window.__dbg.Battle.fastForward(30)); if (res && res.over) break; }
    await page.waitForSelector('#br-ok', { timeout: 8000 });
    const win = await page.evaluate(() => document.querySelector('.br-card').classList.contains('win'));
    await page.click('#br-ok');
    await page.waitForTimeout(1500);
    await adv(); await page.waitForTimeout(200); await adv(); await page.waitForTimeout(200); await adv();
    await closeModal();
    const lv = await page.evaluate(() => window.__dbg.G.roster.map(h => h + ':' + window.__dbg.G.heroes[h].level).join(' '));
    console.log(cityId, win ? 'WIN' : 'LOSE', 't=' + Math.round(res.t), 'ally', res.ally, 'enemy', res.enemy, '|', lv, 'sol', await page.evaluate(() => window.__dbg.G.soldiers));
    return win;
  };
  const turns = async (n) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__dbg.endTurn()); await closeModal(); await adv(); } };

  const prep = async () => page.evaluate(() => {
    const G = window.__dbg.G;
    // 밤에 낙성대에서 강감찬 영입
    if (!G.roster.includes('gamchan')) { G.phase = 3; G.ap = 1; window.__dbg.finishEvent('ev_gamchan'); document.querySelector('#modal').hidden = true; }
    // 장터: 찰갑, 옥가락지 정도
    G.roster.forEach(h => { const e = G.heroes[h].equip; if (e.armor === 'a_dopo' && G.gold >= 200) { G.gold -= 200; G.inv.push('a_chalgap'); } });
  });
  for (const c of ['gangneung', 'jeonju', 'tongyeong', 'pyongyang', 'gyeongju']) {
    await prep();
    let ok = false;
    for (let tries = 0; tries < 3 && !ok; tries++) {
      ok = await fight(c);
      await turns(4);
      await page.evaluate(() => { const G = window.__dbg.G; G.roster.forEach(h => G.heroes[h].hp = 1); G.soldiers = Math.max(G.soldiers, 60); });
    }
  }
  await page.waitForTimeout(500);
  await adv();
  await page.screenshot({ path: OUT + '/map-final.png' });
  const st = await page.evaluate(() => ({ owned: Object.values(window.__dbg.G.cities).map(c => c.owner).join(','), roster: window.__dbg.G.roster.join(','), places: window.__dbg.G.places.join(','), inv: window.__dbg.G.inv.join(','), gold: window.__dbg.G.gold }));
  console.log(JSON.stringify(st, null, 1));
  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
