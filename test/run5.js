const { chromium } = require('playwright');
const path = require('path');
const OUT = '/tmp/claude-0/shots5';
require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  await page.waitForTimeout(2000);
  const adv = async (max = 60) => { for (let i = 0; i < max; i++) { const st = await page.evaluate(() => document.querySelector('#dialog').hidden ? 'c' : (!document.querySelector('#dlg-choices').hidden ? 'ch' : 'l')); if (st === 'c') return; if (st === 'ch') { await page.click('#dlg-choices .btn'); continue; } await page.evaluate(() => { window.__dbg.Dialog.advance(); window.__dbg.Dialog.advance(); }); await page.waitForTimeout(15); } };
  await page.evaluate(() => { const d = window.__dbg; d.startNew(); document.querySelector('#dialog').hidden = true; const G = d.G; G.stage = 'act1'; addHero('eulji', 5); saveGame(); continueGame(); });
  await page.waitForTimeout(500);
  // 낮에 낙성대: 조건 불충족
  await page.evaluate(() => { UI.sel = { type: 'place', id: 'nakseongdae' }; MapView.setSel(UI.sel); renderPanel(); });
  await page.screenshot({ path: OUT + '/place-card.png' });
  await page.evaluate(() => window.__dbg.explore('nakseongdae'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/place-fail.png' });
  console.log('fail modal:', await page.evaluate(() => document.querySelector('#modal-card').innerText.slice(0, 80)));
  await page.evaluate(() => closeModal());
  // 밤으로
  await page.evaluate(() => { window.__dbg.G.phase = 3; renderAll(); window.__dbg.explore('nakseongdae'); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + '/event-dialog.png' });
  await adv();
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/event-reward.png' });
  console.log('roster', await page.evaluate(() => window.__dbg.G.roster.join(',')));
  await page.evaluate(() => closeModal());
  // 계백 결투 (김유신 필요)
  await page.evaluate(() => { const G = window.__dbg.G; G.cities.jeonju.owner = 'player'; G.places.push('hwangsan'); addHero('yusin', 7); G.ap = 1; window.__dbg.explore('hwangsan'); });
  await adv();
  await page.waitForSelector('[data-go]'); await page.click('[data-go]'); await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + '/duel.png' });
  for (let i = 0; i < 6; i++) { const r = await page.evaluate(() => window.__dbg.Battle.fastForward(30)); if (r.over) break; }
  await page.waitForSelector('#br-ok'); await page.click('#br-ok'); await page.waitForTimeout(400); await adv(); await page.waitForTimeout(300);
  console.log('after duel roster', await page.evaluate(() => window.__dbg.G.roster.join(',')));
  await page.evaluate(() => closeModal());
  // 적 침공
  await page.evaluate(() => { window.__dbg.G.day = 5; window.__dbg.maybeEnemyAttack(true); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + '/invasion.png' });
  await page.click('[data-a="auto"]');
  await page.waitForTimeout(300);
  console.log('after invasion', await page.evaluate(() => Object.entries(window.__dbg.G.cities).map(([k, v]) => k + ':' + v.owner).join(' ')));
  // 영웅 장비 교체: 검방으로
  await page.evaluate(() => { UI.tab = 'heroes'; UI.heroView = 'hero'; UI.equipSlot = 'w2'; renderPanel(); });
  await page.screenshot({ path: OUT + '/equip-picker.png' });
  console.log('ERRORS', errors.join('\n') || 'none');
  await browser.close();
})();
