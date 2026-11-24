// Run with node scripts/ui-browser.mjs  (HOWMUCH_SHOTS=dir saves screenshots).
// Checks the user-facing behaviour: English default, star gate, swipe/tap-to-close sheets, language switch,
// hidden scrollbars, the object filter bar, compact card (model + price), and the person card without a "play price" label.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const shots = process.env.HOWMUCH_SHOTS;
const server = await createServer({ cacheDir: 'node_modules/.vite-howmuch-ui', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
let browser;
try {
  await server.listen(); browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 }, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
  await ctx.addInitScript(() => {
    window.__cameraStarts = 0;
    const c = document.createElement('canvas'); c.width = 480; c.height = 720; const g = c.getContext('2d');
    window.__hide = false; setInterval(() => { g.fillStyle = '#384858'; g.fillRect(0, 0, 480, 720); if (window.__hide) return; g.fillStyle = '#c9d4de'; g.fillRect(120, 250, 150, 150); g.fillStyle = '#e8b34a'; g.fillRect(320, 420, 100, 100); }, 100);
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { window.__cameraStarts++; return c.captureStream(10); } });
  });
  let kind = 'product';
  const sel = (x, y, k) => ({ x, y, width: .2, height: .2, kind: k, polygon: [{ x, y }, { x: x + .2, y }, { x: x + .2, y: y + .2 }, { x, y: y + .2 }] });
  await page.route('**/agent/segment', r => { const p = r.request().postDataJSON(); const second = p.point && p.point.x > .6; r.fulfill({ json: { selections: [second ? sel(.66, .56, 'product') : sel(.25, .33, kind)], selection: second ? sel(.66, .56, 'product') : sel(.25, .33, kind), model: 'stub' } }); });
  const now = () => new Date().toISOString();
  await page.route('**/api/research', r => { const n = Math.random() < 2 ? 1 : 0; const o = (i, p, t) => ({ id: 'offer-' + i, title: t, url: `https://shop${i}.example.org/p/${i}`, merchant: `shop${i}.example.org`, condition: 'new', availability: 'in_stock', price: p, currency: 'KRW', checkedAt: now(), evidence: ['seen'], confidence: .8 });
    const offers = [o(0, 446310, 'Nintendo Switch OLED White'), o(1, 452000, 'Nintendo Switch OLED')];
    r.fulfill({ json: { status: 'complete', pricingMode: 'exact_model', candidates: [{ name: 'Nintendo Switch OLED', brand: 'Nintendo', model: 'Switch OLED', confidence: .9 }], identity: { brand: 'Nintendo', model: 'Switch OLED', brandEvidence: ['visual-search inferred: Nintendo'], modelEvidence: ['visual-search inferred: Switch OLED'], inferred: true }, offers, lowest: 'offer-0', highest: 'offer-1', representative: { min: 446310, median: 449155, max: 452000, currency: 'KRW', condition: 'new', basis: 'item_only', sampleCount: 2 }, tools: ['agent_web_search'], startedAt: now(), completedAt: now() } }); });
  let starMode = 501;
  await page.route('**/api/github/star/start', r => r.fulfill({ status: starMode, json: { error: 'github_oauth_not_configured' } }));
  await page.route('https://github.com/**', r => r.fulfill({ status: 200, body: 'repo' }));

  // 1. Star gate first: English by default, camera not started yet
  await page.goto(server.resolvedUrls.local[0]);
  const gate = page.getByRole('dialog', { name: 'Give HowMuch a star' }); await gate.waitFor();
  assert.equal(await page.evaluate(() => window.__cameraStarts), 0, 'camera must not start before the star prompt is dealt with');
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  if (shots) await page.screenshot({ path: shots + '/ui-1-stargate.png' });
  // not configured: the star button opens the repository, then asks to confirm; confirming records it
  const popup = ctx.waitForEvent('page'); await page.getByRole('button', { name: 'Star HowMuch on GitHub' }).click(); (await popup).close();
  await page.getByText('I starred it').waitFor();
  await page.getByRole('button', { name: 'Star HowMuch on GitHub' }).click();
  await gate.waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => localStorage.getItem('howmuch-starred')), '1');
  await page.waitForFunction(() => window.__cameraStarts === 1);
  // once starred the gate is gone for good
  await page.reload(); await page.waitForFunction(() => window.__cameraStarts === 1 && !document.querySelector('.stargate'));
  assert.equal(await page.locator('.stargate').count(), 0);

  // 2. Camera screen: no attribution/footer text, English labels, nothing about remembering the phone orientation
  const text = await page.locator('main').innerText();
  for (const gone of ['NomaDamas', '조회한 판매처', 'FIELD LENS', '카메라로 돌아가기', 'Back to camera', 'remember']) assert.ok(!text.includes(gone), 'removed text still shown: ' + gone);
  await page.getByRole('button', { name: 'Auto' }).waitFor(); await page.getByRole('button', { name: 'Touch · Draw' }).click();
  await page.getByText('Tap or circle an object').waitFor();
  assert.match(await page.locator('.brand').innerText(), /HowMuch/);

  // 3. Select two objects: card shows only the model and the price; the filter bar lists both
  await page.mouse.click(110, 270); await page.locator('.card[data-phase="complete"]').waitFor();
  await page.mouse.click(300, 470); await page.waitForFunction(() => document.querySelectorAll('.card[data-phase="complete"]').length === 2, null, { timeout: 15000 }).catch(async e => { if (shots) await page.screenshot({ path: shots + '/ui-debug.png' }); console.log('cards:', await page.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.dataset.phase + '@' + Math.round(c.getBoundingClientRect().x) + ',' + Math.round(c.getBoundingClientRect().y)))); throw e; });
  const card = await page.locator('.card').first().innerText();
  assert.match(card, /Nintendo Switch OLED/); assert.match(card, /₩446,310/); assert.doesNotMatch(card, /compared|Verified|Details/);
  assert.equal(await page.locator('.itembar .chip').count(), 3, 'All + two objects');
  if (shots) await page.screenshot({ path: shots + '/ui-2-two-objects.png' });
  await page.locator('.itembar .chip').nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 1);   // filter: only that object stays
  await page.getByRole('button', { name: 'All' }).click();
  await page.waitForFunction(() => document.querySelectorAll('.card').length === 2);

  // 4. Detail sheet: model and price only; everything else behind "Details"; hidden scrollbar; swipe down closes
  await page.locator('.card').first().click();
  const sheet = page.getByRole('dialog'); await sheet.waitFor();
  assert.match(await sheet.innerText(), /₩446,310/); assert.doesNotMatch(await sheet.innerText(), /shop0\.example\.org/);
  assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sheet')).scrollbarWidth), 'none');
  await page.getByRole('button', { name: 'Details' }).click(); await page.getByText('shop0.example.org').waitFor();
  if (shots) await page.screenshot({ path: shots + '/ui-3-detail.png' });
  const box = await page.locator('.grab').boundingBox();
  const cdp = await ctx.newCDPSession(page);
  const touch = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: 195, y }] });
  await touch('touchStart', box.y + 10); for (const d of [20, 60, 120, 180]) await touch('touchMove', box.y + 10 + d); await touch('touchEnd');
  await sheet.waitFor({ state: 'detached' });
  // tap outside closes too
  await page.locator('.card').first().click(); await sheet.waitFor(); await page.mouse.click(195, 20); await sheet.waitFor({ state: 'detached' });

  // 5. Settings: language switch (English -> Korean), fun mode switch, attribution only here
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('HowMuch by NomaDamas MinXing').waitFor();
  await page.getByRole('button', { name: '한국어' }).click();
  await page.getByRole('dialog', { name: '설정' }).waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('howmuch-lang')), 'ko');
  if (shots) await page.screenshot({ path: shots + '/ui-4-settings-ko.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '자동' }).waitFor();

  // 6. Person: no "play price" wording
  kind = 'person'; await page.getByRole('button', { name: '터치·그리기' }).click(); await page.mouse.click(110, 150);
  await page.locator('.card[data-phase="person"]').waitFor();
  const person = await page.locator('.card[data-phase="person"]').innerText();
  assert.match(person, /₩/); for (const bad of ['놀이', 'play', 'Play']) assert.ok(!person.includes(bad), 'person card says ' + bad);
  // 7. Head turn: the cut-out must not vanish. Phone orientation is pumped as sensor events (rotation only, no walking).
  await page.evaluate(() => { DeviceOrientationEvent.requestPermission = async () => 'granted'; });
  if (await page.getByRole('button', { name: 'Spatial memory' }).getAttribute('aria-pressed') !== 'true') await page.getByRole('button', { name: 'Spatial memory' }).click();
  await page.waitForFunction(() => document.querySelector('button[aria-label="Spatial memory"]').getAttribute('aria-pressed') === 'true');
  await page.evaluate(() => { window.__alpha = 0; setInterval(() => dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: window.__alpha, beta: 90, gamma: 0 })), 40); });
  await page.waitForTimeout(700);                                   // outline points are stored as world directions while tracked
  await page.evaluate(() => { window.__hide = true; });             // the object leaves the picture (tracking is lost)
  await page.waitForFunction(() => document.querySelectorAll('.contours.ghost path').length >= 1, null, { timeout: 20000 }).catch(async e => { console.log('debug', JSON.stringify(await page.evaluate(() => ({ cards: [...document.querySelectorAll('.card')].map(c => c.dataset.phase), compass: document.querySelector('button[aria-label="Spatial memory"],button[aria-label="Spatial memory"]')?.getAttribute('aria-pressed'), ghostLayer: document.querySelectorAll('.ghost-layer').length, ghostSvg: document.querySelectorAll('.contours.ghost').length, hasDOE: typeof DeviceOrientationEvent + "/" + typeof DeviceOrientationEvent.requestPermission, chips: [...document.querySelectorAll('.chip-price')].map(c => c.innerText) })))); throw e; });
  assert.ok(await page.locator('.ghost-tag').count() >= 1, 'a tag names the lost object');
  if (shots) await page.screenshot({ path: shots + '/ui-5-ghost-outline.png' });
  await page.evaluate(() => { window.__alpha = 100; });             // turn the phone far to one side
  await page.waitForFunction(() => document.querySelectorAll('.contours.ghost path').length === 0 && document.querySelectorAll('.ghost-arrow').length >= 1, null, { timeout: 10000 });
  await page.evaluate(() => { window.__alpha = 0; });               // turn back: the outline returns on the same plane
  await page.waitForFunction(() => document.querySelectorAll('.contours.ghost path').length >= 1, null, { timeout: 10000 });
  // 8. Phones and the app shell never see the star prompt on load; the camera just starts
  for (const [label, ua] of [['iPhone Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'], ['app shell', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 HowMuchApp']]) {
    const pctx = await browser.newContext({ viewport: { width: 390, height: 780 }, userAgent: ua });
    await pctx.addInitScript(() => { window.__cameraStarts = 0; const c = document.createElement('canvas'); c.width = 480; c.height = 720; c.getContext('2d').fillRect(0, 0, 480, 720); Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { window.__cameraStarts++; return c.captureStream(10); } }); });
    const phone = await pctx.newPage(); await phone.goto(server.resolvedUrls.local[0]);
    await phone.waitForFunction(() => window.__cameraStarts === 1, null, { timeout: 15000 });
    assert.equal(await phone.locator('.stargate').count(), 0, label + ' must not show the star prompt');
    await pctx.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: star gate before camera, English default, Korean switch, compact card, filter bar, details behind a toggle, swipe/tap close, hidden scrollbars, no attribution on camera, person card without play-price wording, outline persists when the object is lost or the phone turns and returns, no star prompt on phones or the app shell.');
} finally { await browser?.close(); await server.close(); }
