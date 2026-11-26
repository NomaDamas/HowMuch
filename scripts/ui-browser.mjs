// Run with node scripts/ui-browser.mjs  (HOWMUCH_SHOTS=dir saves screenshots).
// Checks the user-facing behaviour: English default, star gate, swipe/tap-to-close sheets, language switch,
// hidden scrollbars, the object filter bar, compact card (model + price), and the person card without a "play price" label.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
const shots = process.env.HOWMUCH_SHOTS;
const server = await createServer({ cacheDir: 'node_modules/.vite-howmuch-ui', server: { host: '127.0.0.1', port: 0, hmr: false, watch: null }, logLevel: 'error' });
let browser;
// SAFETY: tests must never press a real star. Every context answers the star endpoints itself; specific scenarios override it.
const newCtx = async opts => { const c = await browser.newContext(opts); await c.route('**/agent/track', r => r.fulfill({ json: { track: { ok: false } } })); await c.route('**/api/github/**', r => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 501, json: { enabled: false } })); return c; };
try {
  await server.listen(); browser = await chromium.launch();
  const ctx = await newCtx({ viewport: { width: 390, height: 780 }, hasTouch: true, deviceScaleFactor: 2 });
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
    const pctx = await newCtx({ viewport: { width: 390, height: 780 }, userAgent: ua });
    await pctx.addInitScript(() => { window.__cameraStarts = 0; const c = document.createElement('canvas'); c.width = 480; c.height = 720; c.getContext('2d').fillRect(0, 0, 480, 720); Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { window.__cameraStarts++; return c.captureStream(10); } }); });
    const phone = await pctx.newPage(); await phone.goto(server.resolvedUrls.local[0]);
    await phone.waitForFunction(() => window.__cameraStarts === 1, null, { timeout: 15000 });
    assert.equal(await phone.locator('.stargate').count(), 0, label + ' must not show the star prompt');
    await pctx.close();
  }
  // 9. Real star actions on screen, always after the user's tap: signed-in gh, sign-in on screen, and Settings on a phone
  const camStub = () => { window.__cameraStarts = 0; const c = document.createElement('canvas'); c.width = 480; c.height = 720; const g = c.getContext('2d'); setInterval(() => { g.fillStyle = '#384858'; g.fillRect(0, 0, 480, 720); g.fillStyle = '#c9d4de'; g.fillRect(120, 250, 150, 150); }, 100); Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { window.__cameraStarts++; return c.captureStream(10); } }); };
  const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 HowMuchApp';
  const signedIn = { enabled: true, installed: true, signedIn: true, user: 'octo', starred: false, oauth: false };
  {   // A) gh signed in: the button names the account; nothing is sent until the tap
    const c = await newCtx({ viewport: { width: 390, height: 780 } }); await c.addInitScript(camStub); const p = await c.newPage(); let posted = null;
    await p.route('**/api/github/star/status', r => r.fulfill({ json: signedIn }));
    await p.route('**/api/github/star/local', r => { posted = r.request().postDataJSON(); r.fulfill({ json: { starred: true, user: 'octo' } }); });
    await p.goto(server.resolvedUrls.local[0]); await p.getByText('Star as @octo').waitFor();
    assert.equal(posted, null, 'nothing is starred before the tap');
    if (shots) await p.screenshot({ path: shots + '/ui-6-star-as.png' });
    await p.getByRole('button', { name: 'Star HowMuch on GitHub' }).click();
    await p.waitForFunction(() => localStorage.getItem('howmuch-starred') === '1'); assert.deepEqual(posted, { confirm: true });
    await p.locator('.stargate').waitFor({ state: 'detached' }); await c.close();
  }
  {   // B) gh not signed in: one tap starts the sign-in, the code is shown, then the account appears
    const c = await newCtx({ viewport: { width: 390, height: 780 } }); await c.addInitScript(camStub); const p = await c.newPage(); let loggedIn = 0, polls = 0;
    await p.route('**/api/github/star/status', r => { if (loggedIn) polls++; r.fulfill({ json: loggedIn && polls >= 1 ? signedIn : { enabled: true, installed: true, signedIn: false, starred: false, oauth: false } }); });
    await p.route('**/api/github/star/login', r => { loggedIn = 1; r.fulfill({ json: { code: 'ABCD-1234', url: 'https://github.com/login/device' } }); });
    await p.goto(server.resolvedUrls.local[0]); await p.getByText('Sign in with GitHub to star').waitFor();
    await p.getByRole('button', { name: 'Star HowMuch on GitHub' }).click();
    await p.getByText('ABCD-1234').waitFor(); await p.getByText('Star as @octo').waitFor({ timeout: 15000 }); await c.close();
  }
  {   // C) a phone (app shell) never prompts on load, but Settings can star for real
    const c = await newCtx({ viewport: { width: 390, height: 780 }, userAgent: IPHONE }); await c.addInitScript(camStub); const p = await c.newPage(); let posted = null;
    await p.route('**/api/github/star/status', r => r.fulfill({ json: signedIn }));
    await p.route('**/api/github/star/local', r => { posted = r.request().postDataJSON(); r.fulfill({ json: { starred: true, user: 'octo' } }); });
    await p.goto(server.resolvedUrls.local[0]); await p.waitForFunction(() => window.__cameraStarts === 1);
    assert.equal(await p.locator('.stargate').count(), 0);
    await p.getByRole('button', { name: 'Settings' }).click(); await p.getByRole('button', { name: 'Star on GitHub' }).click();
    await p.getByText('Star as @octo').waitFor(); assert.equal(posted, null);
    await p.getByRole('button', { name: 'Star HowMuch on GitHub' }).click();
    await p.waitForFunction(() => localStorage.getItem('howmuch-starred') === '1'); assert.deepEqual(posted, { confirm: true });
    await p.getByRole('dialog').waitFor({ state: 'detached' }); await c.close();
  }
  // 10. Pairing QR: opens the HowMuch app directly (howmuch://open?url=...) or the browser, switchable on the desktop dialog
  {
    const c = await newCtx({ viewport: { width: 390, height: 780 } }); await c.addInitScript(camStub); const p = await c.newPage();
    await p.route('**/v1/pairing/sessions', r => r.fulfill({ status: 201, json: { sessionId: 's1', expiresAt: new Date(Date.now() + 3e5).toISOString(), url: 'https://192.168.0.3:8443/#pair=s1.tok' } }));
    await c.addInitScript(() => { try { localStorage.setItem('howmuch-starred', '1'); } catch {} });
    await p.goto(server.resolvedUrls.local[0]);
    await p.getByRole('button', { name: 'Settings' }).click(); await p.getByRole('button', { name: 'Connect phone (QR)' }).click();
    const qr = p.getByRole('img'); await qr.waitFor(); const appQr = await qr.getAttribute('src');
    await p.getByRole('button', { name: 'Browser' }).click();
    await p.waitForFunction(old => document.querySelector('img')?.getAttribute('src') !== old, appQr);
    await p.getByRole('button', { name: 'HowMuch app' }).click();
    await p.waitForFunction(old => document.querySelector('img')?.getAttribute('src') === old, appQr);
    await c.close();
  }
  // 11. No motion sensors (a laptop): losing the track must not make the cut-out vanish at once; it is held, then released
  {
    const c = await newCtx({ viewport: { width: 390, height: 780 } });
    await c.addInitScript(() => { try { localStorage.setItem('howmuch-starred', '1'); } catch {} window.__hide = false; const cv = document.createElement('canvas'); cv.width = 480; cv.height = 720; const g = cv.getContext('2d');
      setInterval(() => { g.fillStyle = '#384858'; g.fillRect(0, 0, 480, 720); if (window.__hide) return; g.fillStyle = '#c9d4de'; g.fillRect(120, 250, 150, 150); }, 100);
      Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => cv.captureStream(10) }); });
    const p = await c.newPage();
    await p.route('**/agent/segment', r => r.fulfill({ json: { selections: [sel(.25, .33, 'product')], selection: sel(.25, .33, 'product'), model: 'stub' } }));
    await p.route('**/api/research', () => {});   // research never answers: only the outline behaviour is under test
    await p.goto(server.resolvedUrls.local[0]); await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2); await p.getByRole('button', { name: 'Touch · Draw' }).click(); await p.mouse.click(110, 270);
    await p.waitForFunction(() => document.querySelectorAll('.contours path').length >= 1);
    await p.waitForTimeout(500); await p.evaluate(() => { window.__hide = true; });
    await p.waitForFunction(() => document.querySelectorAll('.contours.ghost path').length >= 1, null, { timeout: 15000 });   // held, not vanished
    await p.waitForFunction(() => document.querySelectorAll('.contours.ghost path').length === 0, null, { timeout: 20000 });  // released after a few seconds
    await c.close();
  }
  // 12. Live work state: while the agents research, the card and the detail sheet show what they are really doing
  {
    const c = await newCtx({ viewport: { width: 390, height: 780 }, userAgent: IPHONE }); await c.addInitScript(camStub); const p = await c.newPage(); let polls = 0;
    await p.route('**/agent/segment', r => r.fulfill({ json: { selections: [sel(.25, .33, 'product')], selection: sel(.25, .33, 'product'), model: 'stub' } }));
    await p.route('**/api/jobs', r => r.fulfill({ status: 202, json: { jobId: 'j1', status: '/api/jobs/j1', events: '/api/jobs/j1/events' } }));
    const ev = (extra, status = 'running') => ({ jobId: 'j1', sequence: polls, status, ...extra });
    const idStep = { kind: 'identified', text: 'Nintendo Switch OLED' }, q = { kind: 'search', text: 'Switch OLED lowest price', agent: 0 };
    await p.route('**/api/jobs/j1', r => { polls++; const t0 = now();
      const done = { status: 'complete', pricingMode: 'exact_model', candidates: [{ name: 'Nintendo Switch OLED', brand: 'Nintendo', model: 'Switch OLED', confidence: .9 }], identity: { brand: 'Nintendo', model: 'Switch OLED', brandEvidence: ['visual-search inferred: Nintendo'], modelEvidence: ['visual-search inferred: Switch OLED'], inferred: true },
        offers: [{ id: 'offer-0', title: 'Nintendo Switch OLED White', url: 'https://shop0.example.org/p/0', merchant: 'shop0.example.org', condition: 'new', availability: 'in_stock', price: 446310, currency: 'KRW', checkedAt: t0, evidence: ['seen'], confidence: .8 }],
        lowest: 'offer-0', highest: 'offer-0', representative: { min: 446310, median: 446310, max: 446310, currency: 'KRW', condition: 'new', basis: 'item_only', sampleCount: 1 }, tools: ['agent_web_search'], startedAt: t0, completedAt: t0 };
      r.fulfill({ json: polls === 1 ? ev({ candidate: { name: 'Nintendo Switch OLED' }, activity: [idStep] })
        : polls === 2 ? ev({ preliminary: { price: 450000, count: 3 }, activity: [idStep, q, { kind: 'open', text: 'enuri.com', agent: 1 }] })
        : polls === 3 ? ev({ activity: [idStep, q, { kind: 'open', text: 'enuri.com', agent: 1 }, { kind: 'agentDone', n: 6, agent: 0 }, { kind: 'agentDone', n: 5, agent: 1 }, { kind: 'compare', n: 11 }] })
        : polls < 6 ? ev({ activity: [idStep, { kind: 'compare', n: 11 }] }) : ev({ result: done }, 'completed') }); });
    await p.goto(server.resolvedUrls.local[0]); await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2); await p.getByRole('button', { name: 'Touch · Draw' }).click(); await p.mouse.click(110, 270);
    await p.waitForFunction(() => /Identified: Nintendo Switch OLED/.test(document.querySelector('.card .card-sub')?.innerText || ''), null, { timeout: 15000 }).catch(async e => { console.log('debug polls=' + polls, JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.dataset.phase + ' | ' + c.innerText.replace(/\\n/g, ' / '))))); throw e; });   // the name arrives first
    await p.waitForFunction(() => /Preliminary . 3 listings/.test(document.querySelector('.card .card-sub')?.innerText || ''), null, { timeout: 15000 });               // then what the agents do
    await p.waitForFunction(() => /~₩450,000/.test(document.querySelector('.card')?.innerText || ''), null, { timeout: 15000 });   // preliminary price while the agents still work
    await p.locator('.card').first().click();
    const work = p.locator('.work'); await work.waitFor();
    assert.match(await work.innerText(), /Working on it/);
    await p.waitForFunction(() => /Searching .Switch OLED lowest price./.test(document.querySelector('.work .feed')?.innerText || '') || /Comparing 11 listings/.test(document.querySelector('.work .feed')?.innerText || ''), null, { timeout: 15000 });
    if (shots) await p.screenshot({ path: shots + '/ui-7-working.png' });
    await p.waitForFunction(() => document.querySelectorAll('.work .stage.on').length >= 3, null, { timeout: 15000 });    // identify, search, compare lit by real events
    await p.waitForFunction(() => /₩446,310/.test(document.querySelector('.sheet')?.innerText || ''), null, { timeout: 20000 });  // the same sheet turns into the answer
    assert.equal(await p.locator('.work').count(), 0); await c.close();
  }
  // 13. Settings > Advanced: the image search switch (off by default, disabled when the server has no key) and what a request carries
  {
    const c = await newCtx({ viewport: { width: 390, height: 780 }, userAgent: IPHONE }); await c.addInitScript(camStub); const p = await c.newPage(); const sent = [];
    let available = true;
    await p.route('**/api/image-search/status', r => r.fulfill({ json: { available } }));
    await p.route('**/agent/segment', r => r.fulfill({ json: { selections: [sel(.25, .33, 'product')], selection: sel(.25, .33, 'product'), model: 'stub' } }));
    await p.route('**/api/jobs', r => { sent.push(r.request().postDataJSON()); r.fulfill({ status: 202, json: { jobId: 'j9', status: '/api/jobs/j9', events: '/api/jobs/j9/events' } }); });
    await p.route('**/api/jobs/j9', r => r.fulfill({ json: { jobId: 'j9', sequence: 1, status: 'running' } }));
    await p.goto(server.resolvedUrls.local[0]); await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2);
    await p.getByRole('button', { name: 'Settings' }).click();
    await p.getByText('Advanced').click();
    const sw = p.getByRole('switch', { name: 'Image search (Google)' });
    await sw.waitFor(); assert.equal(await sw.getAttribute('aria-checked'), 'false', 'off by default'); assert.match(await p.locator('.advanced .note').innerText(), /Sends the cut-out photo to Google/);
    await p.keyboard.press('Escape'); await p.getByRole('button', { name: 'Touch · Draw' }).click(); await p.mouse.click(110, 270);
    for (let i = 0; i < 80 && !sent.length; i++) await p.waitForTimeout(100);
    assert.equal(sent.length, 1); assert.equal('imageSearch' in sent[0], false, 'nothing about image search is sent while it is off');
    await p.getByRole('button', { name: 'Settings' }).click(); await p.getByText('Advanced').click(); await p.getByRole('switch', { name: 'Image search (Google)' }).click();
    assert.equal(await p.evaluate(() => localStorage.getItem('howmuch-imagesearch')), '1'); await c.close();
    // once on (remembered), the next request asks the server for the image search
    const c1 = await newCtx({ viewport: { width: 390, height: 780 }, userAgent: IPHONE }); await c1.addInitScript(camStub); await c1.addInitScript(() => localStorage.setItem('howmuch-imagesearch', '1')); const p1 = await c1.newPage(); sent.length = 0;
    await p1.route('**/agent/segment', r => r.fulfill({ json: { selections: [sel(.25, .33, 'product')], selection: sel(.25, .33, 'product'), model: 'stub' } }));
    await p1.route('**/api/jobs', r => { sent.push(r.request().postDataJSON()); r.fulfill({ status: 202, json: { jobId: 'j9', status: '/api/jobs/j9', events: '/api/jobs/j9/events' } }); });
    await p1.route('**/api/jobs/j9', r => r.fulfill({ json: { jobId: 'j9', sequence: 1, status: 'running' } }));
    await p1.goto(server.resolvedUrls.local[0]); await p1.waitForFunction(() => document.querySelector('video')?.readyState >= 2); await p1.getByRole('button', { name: 'Touch · Draw' }).click(); await p1.mouse.click(110, 270);
    for (let i = 0; i < 80 && !sent.length; i++) await p1.waitForTimeout(100);
    assert.equal(sent.length, 1); assert.equal(sent[0].imageSearch, true); await c1.close();
    // server without a key: the switch is disabled and says why
    available = false; const c2 = await newCtx({ viewport: { width: 390, height: 780 }, userAgent: IPHONE }); await c2.addInitScript(camStub); const p2 = await c2.newPage();
    await p2.route('**/api/image-search/status', r => r.fulfill({ json: { available: false } }));
    await p2.goto(server.resolvedUrls.local[0]); await p2.getByRole('button', { name: 'Settings' }).click(); await p2.getByText('Advanced').click();
    assert.equal(await p2.getByRole('switch', { name: 'Image search (Google)' }).isDisabled(), true); await p2.getByText(/GOOGLE_VISION_API_KEY/).waitFor(); await c2.close();
  }
  // 14. Live following by server video object segmentation: the outline follows the answers, a lost object falls back, removing ends the session
  {
    const c = await newCtx({ viewport: { width: 390, height: 780 }, userAgent: IPHONE }); await c.addInitScript(camStub); const p = await c.newPage(); const calls = [];
    const ring = (x, y) => [{ x, y }, { x: x + .2, y }, { x: x + .2, y: y + .2 }, { x, y: y + .2 }];
    let step = 0, lose = false;
    await p.route('**/agent/segment', r => r.fulfill({ json: { selections: [sel(.25, .33, 'product')], selection: sel(.25, .33, 'product'), model: 'stub' } }));
    await p.route('**/api/research', () => {});
    await p.route('**/agent/track', r => { const b = r.request().postDataJSON(); calls.push(b.op);
      if (b.op === 'start') return r.fulfill({ json: { track: { ok: true } } });
      if (b.op === 'end') return r.fulfill({ json: { track: { ok: true } } });
      if (lose) return r.fulfill({ json: { track: { ok: true, tracked: false, reason: 'lost' } } });
      step++; const x = Math.min(.7, .25 + step * .02), y = .33; r.fulfill({ json: { track: { ok: true, tracked: true, score: 8, selection: { x, y, width: .2, height: .2, polygon: ring(x, y), contours: [ring(x, y)] } } } }); });
    await p.goto(server.resolvedUrls.local[0]); await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2); await p.getByRole('button', { name: 'Touch · Draw' }).click(); await p.mouse.click(110, 270);
    await p.waitForFunction(() => document.querySelectorAll('.contours path').length >= 1);
    const firstX = await p.evaluate(() => { const d = document.querySelector('.contours path')?.getAttribute('d') || ''; return Number(d.match(/M([\d.]+)/)?.[1]); });
    await p.waitForFunction(() => true); for (let i = 0; i < 100 && step < 8; i++) await p.waitForTimeout(100);
    assert.ok(step >= 8, 'frames are sent to the server while the object is followed (' + step + ')'); assert.equal(calls[0], 'start');
    const laterX = await p.evaluate(() => { const d = document.querySelector('.contours path')?.getAttribute('d') || ''; return Number(d.match(/M([\d.]+)/)?.[1]); });
    assert.ok(laterX > firstX + .1, 'the outline moved with the server answers: ' + firstX + ' -> ' + laterX);
    lose = true; for (let i = 0; i < 30; i++) await p.waitForTimeout(100);   // the server loses the object: no crash, no more frames
    const before = calls.length; await p.waitForTimeout(800); assert.ok(calls.length - before <= 1, 'after a loss no more frames are sent');
    await c.close();
  }
  // 15. Removing an object ends its server session
  {
    const c = await newCtx({ viewport: { width: 390, height: 780 }, userAgent: IPHONE }); await c.addInitScript(camStub); const p = await c.newPage(); const calls = [];
    await p.route('**/agent/segment', r => r.fulfill({ json: { selections: [sel(.25, .33, 'product')], selection: sel(.25, .33, 'product'), model: 'stub' } }));
    await p.route('**/api/research', () => {});
    await p.route('**/agent/track', r => { const b = r.request().postDataJSON(); calls.push(b.op); r.fulfill({ json: { track: b.op === 'step' ? { ok: true, tracked: true, selection: sel(.25, .33, 'product') } : { ok: true } } }); });
    await p.goto(server.resolvedUrls.local[0]); await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2); await p.getByRole('button', { name: 'Touch · Draw' }).click(); await p.mouse.click(110, 270);
    for (let i = 0; i < 60 && !calls.includes('step'); i++) await p.waitForTimeout(100);
    const rm = p.locator('.job-chip-x').first(); await rm.waitFor(); await rm.click();
    assert.equal(await p.locator('.job-chip-x').count(), 0, 'the chip is gone');
    for (let i = 0; i < 30 && !calls.includes('end'); i++) await p.waitForTimeout(100);
    assert.ok(calls.includes('end'), 'the session is ended when the object is removed: ' + calls.join(',')); await c.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: star gate before camera, English default, Korean switch, compact card, filter bar, details behind a toggle, swipe/tap close, hidden scrollbars, no attribution on camera, person card without play-price wording, outline persists when the object is lost or the phone turns and returns, no star prompt on phones or the app shell, real star actions only after a tap (signed-in gh, on-screen sign-in, Settings on a phone), pairing QR switchable between the app link and the browser link, outline held without motion sensors, live work state (name first, then the real agent actions).');
} finally { await browser?.close(); await server.close(); }
