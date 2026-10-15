const { chromium } = require('playwright'); const path = require('path');
const OUT = '/tmp/claude-0/shots8'; require('fs').mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const p = await b.newPage({ viewport: { width: 1360, height: 820 } });
  const errors = []; p.on('pageerror', e => errors.push(e.message + '\n' + e.stack));
  await p.goto('file://' + path.resolve(__dirname, '../index.html')); await p.waitForTimeout(1500);
  const adv = async () => { for (let i=0;i<300;i++){ const c = await p.evaluate(()=>{const d=document.querySelector('#dialog'); if(d.hidden) return 1; if(!document.querySelector('#dlg-input').hidden) return 2; if(!document.querySelector('#dlg-choices').hidden) return 3; window.__dbg.Dialog.advance(); return 0;}); if(c===1){ const k = await p.$('[data-n="kr"]'); if (k && await k.isVisible()) { await k.click(); continue; } return;} if(c===2){await p.fill('#dlg-name-in','한별'); await p.click('#dlg-input button');} if(c===3) await p.click('#dlg-choices .btn'); await p.waitForTimeout(5);} };
  await p.click('#ti-new'); await p.waitForTimeout(200); await adv(); await p.waitForTimeout(600);
  await p.evaluate(() => window.__dbg.Battle.fastForward(300)); await p.waitForSelector('#br-ok'); await p.click('#br-ok'); await adv(); await p.waitForTimeout(300); await adv(); await p.waitForTimeout(300);
  await p.evaluate(() => closeModal());
  const ph = async () => p.evaluate(() => window.__dbg.G.day + '일 ' + phaseName() + ' (' + window.__dbg.G.phase + ')');
  console.log('start', await ph());
  const seq = [];
  for (let i = 0; i < 4; i++) { await p.evaluate(() => { window.__dbg.endTurn(); }); await p.waitForTimeout(50); await p.evaluate(() => { const m = document.querySelector('#modal:not([hidden]) [data-a="auto"]'); if (m) m.click(); closeModal(); }); await adv(); seq.push(await ph()); }
  console.log('cycle', seq.join(' → '));
  // go to night
  while (!(await p.evaluate(() => isNight()))) { await p.evaluate(() => window.__dbg.endTurn()); await p.evaluate(() => { const m = document.querySelector('#modal:not([hidden]) [data-a="auto"]'); if (m) m.click(); closeModal(); }); await adv(); }
  console.log('now', await ph());
  const r = await p.evaluate(() => { const h = freeIn('seoul'); return [doCommand('agri', h[0], 'seoul').msg, doCommand('scout', h[0], 'seoul').msg, doCommand('rest', h[1], 'seoul').msg]; });
  console.log('night cmds:\n ' + r.join('\n '));
  await p.evaluate(() => { const G = window.__dbg.G; G.gold += 2000; G.day = Math.max(G.day, 2); G.marketTip = 5; G.market = null; maybeMarket(); G.market.fresh = false; UI.sel = { type: 'city', id: 'seoul' }; renderAll(); });
  await p.screenshot({ path: OUT + '/night-city.png' });
  await p.evaluate(() => { UI.sel = null; renderAll(); }); await p.screenshot({ path: OUT + '/night-overview.png' });
  await p.evaluate(() => marketNotice()); await p.screenshot({ path: OUT + '/market-notice.png' });
  await p.click('#modal [data-a="go"]'); await p.waitForTimeout(100); await p.screenshot({ path: OUT + '/market.png' });
  await p.click('#modal [data-mdeal]'); await p.click('#modal [data-mbuy]'); await p.waitForTimeout(100);
  console.log('market', await p.evaluate(() => JSON.stringify(window.__dbg.G.market)));
  await p.evaluate(() => closeModal());
  // night raid gangneung
  await p.evaluate(() => { window.__dbg.G.roster.forEach(h => { window.__dbg.G.heroes[h].acted = false; window.__dbg.G.heroes[h].city = 'seoul'; }); UI.sel = { type: 'city', id: 'gangneung' }; renderAll(); });
  await p.screenshot({ path: OUT + '/raid-card.png' });
  await p.evaluate(() => window.__dbg.launchAttack('gangneung'));
  await p.screenshot({ path: OUT + '/raid-pick.png' });
  await p.click('#modal:not([hidden]) [data-go]'); await p.waitForTimeout(600);
  await p.evaluate(() => window.__dbg.Battle.fastForward(6)); await p.waitForTimeout(100);
  await p.screenshot({ path: OUT + '/raid-battle.png' });
  console.log('raid morale', await p.evaluate(() => window.__dbg.Battle.state().squads.map(q => (q.team ? 'E' : 'A') + Math.round(q.morale)).join(' ')));
  let rr; for (let i = 0; i < 10; i++) { rr = await p.evaluate(() => window.__dbg.Battle.fastForward(30)); if (rr.over) break; }
  console.log('raid result', JSON.stringify(rr));
  await p.waitForSelector('#br-ok'); await p.click('#br-ok'); await p.waitForTimeout(500);
  if (await p.$('#modal:not([hidden]) [data-gok]')) await p.click('[data-gok]');
  await p.waitForTimeout(1500); await adv();
  // next morning: market gone
  await p.evaluate(() => { closeModal(); window.__dbg.endTurn(); closeModal(); }); await adv();
  console.log('morning', await ph(), 'market', await p.evaluate(() => window.__dbg.G.market));
  await p.evaluate(() => { UI.sel = { type: 'city', id: 'seoul' }; renderAll(); }); await p.screenshot({ path: OUT + '/morning-city.png' });
  console.log('ERRORS', errors.join('\n') || 'none'); await b.close();
})();
