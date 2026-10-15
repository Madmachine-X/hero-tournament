const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(1200);
  await p.click('#ti-new'); await p.waitForTimeout(200);
  for (let i=0;i<300;i++){ const c = await p.evaluate(()=>{const d=document.querySelector('#dialog'); if(d.hidden) return 1; if(!document.querySelector('#dlg-input').hidden) return 2; if(!document.querySelector('#dlg-choices').hidden) return 3; window.__dbg.Dialog.advance(); return 0;}); if(c===1){ const k = await p.$('[data-n="kr"]'); if (k && await k.isVisible()) { await k.click(); continue; } break;} if(c===2){await p.fill('#dlg-name-in','한별'); await p.click('#dlg-input button');} if(c===3) await p.click('#dlg-choices .btn'); }
  await p.waitForTimeout(800); await p.evaluate(() => window.__dbg.Battle.fastForward(6)); await p.waitForTimeout(200);
  await p.screenshot({ path: '/tmp/claude-0/shots7/mobile-battle.png' }); await b.close();
})();
