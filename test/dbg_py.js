const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../index.html')); await page.waitForTimeout(1500);
  const target = process.argv[2] || 'pyongyang';
  await page.evaluate((t) => {
    const d = window.__dbg; newGame && (window.G = d.G);
  }, target).catch(()=>{});
  await page.click('#ti-new'); await page.waitForTimeout(200);
  for (let i=0;i<200;i++){ const c = await page.evaluate(()=>{const d=document.querySelector('#dialog'); if(d.hidden) return 1; if(!document.querySelector('#dlg-input').hidden){return 2;} if(!document.querySelector('#dlg-choices').hidden) return 3; window.__dbg.Dialog.advance(); return 0;}); if(c===1) break; if(c===2){await page.fill('#dlg-name-in','한별'); await page.click('#dlg-input button');} if(c===3) await page.click('#dlg-choices .btn'); }
  await page.click('[data-n="kr"]').catch(()=>{});
  for (let i=0;i<200;i++){ const c = await page.evaluate(()=>{const d=document.querySelector('#dialog'); if(d.hidden) return 1; window.__dbg.Dialog.advance(); return 0;}); if(c===1) break; }
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__dbg.Battle.fastForward(300)); await page.click('#br-ok'); 
  for (let i=0;i<200;i++){ const c = await page.evaluate(()=>{const d=document.querySelector('#dialog'); if(d.hidden) return 1; window.__dbg.Dialog.advance(); return 0;}); if(c===1) break; await page.waitForTimeout(5);}
  await page.waitForTimeout(500);
  await page.evaluate(() => closeModal());
  const info = await page.evaluate((t) => { const G = window.__dbg.G;
    for (const c of Object.keys(G.cities)) if (c !== t && c!=='gyeongju' && c!=='pyongyang') G.cities[c].owner = 'player';
    for (let i=0;i<2;i++) makeOfficer('mil', 6, 'seoul', 't');
    G.roster.forEach(h => { G.heroes[h].city = 'seoul'; G.heroes[h].acted = false; G.heroes[h].hp = 1; G.heroes[h].level = Math.max(G.heroes[h].level, 6); });
    G.cities.seoul.troops = 300; G.cities.seoul.train = 70; G.food = 5000;
    return { roster: G.roster.length, enemy: JSON.stringify(enemyForce(t, { party: 5 })).slice(0, 600) };
  }, target);
  console.log(info);
  await page.evaluate((t) => window.__dbg.launchAttack(t), target);
  await page.click('#modal:not([hidden]) [data-go]'); await page.waitForTimeout(500);
  for (let s = 0; s < 30; s++) {
    const r = await page.evaluate(() => window.__dbg.Battle.fastForward(3));
    const st = await page.evaluate(() => { const B = window.__dbg.Battle.state(); const hs = B.units.filter(u => u.kind === 'hero'); return 't' + Math.round(B.t) + ' ' + hs.map(u => (u.team ? 'E:' : 'A:') + (u.name||u.id||'?').slice(0,3) + Math.round(u.hp) + '/' + Math.round(u.maxHp) + (u.dead ? 'x' : '')).join(' ') + ' | sq ' + B.squads.map(q => (q.team ? 'E' : 'A') + Math.round(q.morale) + ':' + (q.size||0)).join(' '); });
    console.log(st); if (r.over) break;
  }
  await browser.close();
})();
