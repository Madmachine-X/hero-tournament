const { chromium } = require('playwright');
const path = require('path');
const OUT = process.env.OUT || '/tmp/claude-0/shots';
require('fs').mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(2200);
  await page.screenshot({ path: OUT + '/01-title.png' });

  const advanceDialogs = async (max = 60) => {
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
      await page.evaluate(() => window.__dbg.Dialog.advance());
      await page.evaluate(() => window.__dbg.Dialog.advance());
      await page.waitForTimeout(30);
    }
  };

  await page.click('#ti-new');
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/02-story.png' });
  await advanceDialogs(); // p1, p2, p3a
  // 국가 선택
  await page.waitForSelector('[data-n="kr"]');
  await page.screenshot({ path: OUT + '/03-nation.png' });
  await page.click('[data-n="kr"]');
  await advanceDialogs(); // p3b, p4
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/04-tutorial.png' });
  // 튜토리얼 전투
  let r = await page.evaluate(() => window.__dbg.Battle.fastForward(150));
  console.log('tutorial', JSON.stringify(r));
  await page.waitForSelector('#br-ok', { timeout: 5000 });
  await page.screenshot({ path: OUT + '/05-result.png' });
  await page.click('#br-ok');
  await advanceDialogs(); // eulji
  await page.waitForTimeout(400);
  await advanceDialogs(); // intro
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + '/06-map.png' });

  const fight = async (cityId, name, extraSec = 0) => {
    await page.evaluate((c) => window.__dbg.launchAttack(c), cityId);
    await page.waitForSelector('[data-go]');
    await page.click('[data-go]');
    await page.waitForTimeout(1500 + extraSec);
    await page.screenshot({ path: OUT + `/b-${name}-start.png` });
    let res = null;
    for (let i = 0; i < 8; i++) {
      res = await page.evaluate(() => window.__dbg.Battle.fastForward(30));
      if (res && res.over) break;
    }
    console.log(cityId, JSON.stringify(res));
    await page.waitForSelector('#br-ok', { timeout: 5000 });
    await page.screenshot({ path: OUT + `/b-${name}-end.png` });
    await page.click('#br-ok');
    await page.waitForTimeout(1600);
    await advanceDialogs();
    await page.waitForTimeout(300);
    await advanceDialogs();
    await page.evaluate(() => { document.querySelector('#modal').hidden = true; });
  };

  await fight('gangneung', 'gangneung');
  await page.evaluate(() => window.__dbg.endTurn());
  await page.screenshot({ path: OUT + '/07-after-gangneung.png' });
  const s1 = await page.evaluate(() => ({ owned: Object.entries(window.__dbg.G.cities).filter(([k, v]) => v.owner === 'player').map(([k]) => k), heroes: window.__dbg.G.roster, sol: window.__dbg.G.soldiers, gold: window.__dbg.G.gold, lv: window.__dbg.G.roster.map(h => window.__dbg.G.heroes[h].level) }));
  console.log('state', JSON.stringify(s1));

  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
