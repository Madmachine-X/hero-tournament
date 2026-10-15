const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/shots3';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(2200);
  // 바로 저장 데이터 구성 후 이어하기
  await page.evaluate(() => {
    const d = window.__dbg;
    d.startNew(); d.Dialog.play([], null);
    document.querySelector('#dialog').hidden = true;
    const G = d.G;
    G.stage = 'act1';
    ['eulji','sunsin','sejong','gwanggaeto','gamchan','yusin','gaesomun','gyeonhwon','heojun','gyebaek','gildong'].forEach(h => addHero(h, 8));
    const wpn = { sunsin: 'u_sunsin', sejong: 'u_sejong', eulji: 'u_eulji', gamchan: 'u_gamchan', gangrim: 'u_gangrim' };
    for (const h in wpn) { giveItem(wpn[h]); const m = equipItem(h, 'w1', wpn[h]); }
    saveGame();
  });
  await page.evaluate(() => continueGame());
  await page.waitForTimeout(800);
  // 영웅 상세 화면
  await page.click('[data-tab="heroes"]');
  await page.click('[data-hero="sunsin"]');
  await page.click('[data-slot="w2"]');
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/hero-detail.png' });

  const battleWith = async (party, enemyCity) => {
    await page.evaluate(([party, city]) => {
      startBattle({ title: '시험 전투', theme: CITIES[city].theme || 'field', type: 'attack', party, enemy: enemyForce(city), onEnd: () => showScreen('scr-map') });
    }, [party, enemyCity]);
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__dbg.Battle.fastForward(4, false));
  };
  const shot = async (hid, k, name, wait = 0.5, real = 250) => {
    await page.evaluate(([h, k]) => window.__dbg.Battle.debugCast(h, k), [hid, k]);
    await page.evaluate((w) => window.__dbg.Battle.fastForward(w, false), wait);
    await page.waitForTimeout(real);
    await page.screenshot({ path: OUT + `/sk-${name}.png` });
  };
  await battleWith(['sunsin', 'sejong', 'eulji', 'gamchan'], 'pyongyang');
  await page.evaluate(() => { const B = window.__dbg.Battle.state(); B.paused = false; });
  await shot('sunsin', 1, 'geobuk', 1.0, 200);
  await page.evaluate(() => window.__dbg.Battle.fastForward(2.5, false));
  await shot('sejong', 0, 'hunmin', 0.25, 100);
  await shot('sejong', 1, 'banpo', 0.9, 150);
  await page.evaluate(() => window.__dbg.Battle.fastForward(2, false));
  await shot('eulji', 1, 'salsu', 0.7, 100);
  await shot('gamchan', 1, 'nakseong', 1.4, 100);
  await shot('sunsin', 0, 'hakik', 0.45, 60);
  const r = await page.evaluate(() => window.__dbg.Battle.fastForward(60, true));
  console.log('battle1', JSON.stringify(r));
  await page.waitForSelector('#br-ok'); await page.click('#br-ok'); await page.waitForTimeout(500);

  await battleWith(['gwanggaeto', 'gyeonhwon', 'gaesomun', 'gildong'], 'gyeongju');
  await page.evaluate(() => { const G = window.__dbg.G; });
  await shot('gwanggaeto', 1, 'musa', 0.5, 100);
  await shot('gyeonhwon', 1, 'baekho', 0.8, 100);
  await shot('gaesomun', 1, 'bigeom', 0.5, 80);
  await shot('gildong', 1, 'bunsin', 0.3, 80);
  await shot('gaesomun', 0, 'odo', 0.4, 60);
  const r2 = await page.evaluate(() => window.__dbg.Battle.fastForward(60, true));
  console.log('battle2', JSON.stringify(r2));
  await page.waitForSelector('#br-ok'); await page.click('#br-ok'); await page.waitForTimeout(500);

  await battleWith(['yusin', 'heojun', 'gyebaek', 'gangrim'], 'jeonju');
  await shot('yusin', 1, 'samhan', 0.35, 60);
  await shot('gyebaek', 1, 'ochon', 0.4, 80);
  await shot('gangrim', 1, 'jeokpae', 0.5, 80);
  await shot('heojun', 1, 'guguep', 0.4, 80);
  const r3 = await page.evaluate(() => window.__dbg.Battle.fastForward(60, true));
  console.log('battle3', JSON.stringify(r3));
  console.log('ERRORS', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
