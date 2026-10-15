const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/shots6';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const d = window.__dbg; d.startNew(); document.querySelector('#dialog').hidden = true;
    const G = d.G; G.stage = 'act1'; G.soldiers = 90;
    ['eulji','sunsin','sejong','gwanggaeto','gamchan','yusin','gaesomun','gyeonhwon','heojun','gyebaek','gildong'].forEach(h => addHero(h, 7));
    giveItem('u_sunsin'); equipItem('sunsin', 'w1', 'u_sunsin');
    saveGame(); continueGame();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__dbg.launchAttack('pyongyang'));
  await page.waitForSelector('[data-go]');
  await page.screenshot({ path: OUT + '/party.png' });
  await page.click('[data-go]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '/banner.png' });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/start.png' });
  // 성능: 3배속 1초간 프레임 측정
  const perf = await page.evaluate(async () => {
    const B = window.__dbg.Battle.state(); B.speed = 3; B.autoCtrl = true;
    let frames = 0; const t0 = performance.now();
    await new Promise(r => { const f = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
    return { fps: frames / 2, units: B.units.filter(u => u.alive).length };
  });
  console.log('perf', JSON.stringify(perf));
  await page.screenshot({ path: OUT + '/fight.png' });
  // 확대 화면: 캔버스 영역 일부 잘라 보기
  await page.evaluate(() => { const B = window.__dbg.Battle.state(); B.paused = true; });
  await page.screenshot({ path: OUT + '/zoom.png', clip: { x: 300, y: 200, width: 700, height: 420 } });
  await page.evaluate(() => { const B = window.__dbg.Battle.state(); B.paused = false; });
  const r = await page.evaluate(() => window.__dbg.Battle.fastForward(120, true));
  console.log('result', JSON.stringify(r));
  console.log('ERRORS', errors.join('\n') || 'none');
  await browser.close();
})();
