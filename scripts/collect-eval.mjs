#!/usr/bin/env node
// Builds eval/cases.json from public Danawa price-comparison pages: product photo + lowest listed price (KRW).
// Polite: one request per 1.5 s, public pages only, browser-like UA, no login. Sites that block bots (e.g. Coupang 403)
// are skipped, not circumvented. Photos are catalogue images, easier than hand-held camera frames, so scores are an upper bound.
import { mkdirSync, writeFileSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
// [search query, any-of model words the VLM identity should contain]
const queries = [
  ['에어팟 프로 2', ['airpods', '에어팟']], ['갤럭시 버즈3 프로', ['buds', '버즈']], ['소니 WH-1000XM5', ['1000xm5', 'wh-1000']],
  ['로지텍 MX Master 3S', ['mx master', '3s']], ['닌텐도 스위치 OLED', ['switch', '스위치']], ['다이슨 에어랩', ['airwrap', '에어랩']],
  ['나이키 에어포스 1 07', ['air force', '에어포스']], ['뉴발란스 530', ['530', 'new balance']], ['아디다스 삼바 OG', ['samba', '삼바']],
  ['샤오미 로봇청소기', ['xiaomi', '샤오미', 'robot']], ['애플워치 SE 2', ['watch', '워치']], ['캐논 EOS R50', ['r50']],
  ['레고 테크닉 포르쉐', ['lego', '레고', 'porsche', '포르쉐']], ['스탠리 퀜처 텀블러', ['stanley', '스탠리', 'quencher']], ['삼성 SSD 990 PRO', ['990', 'ssd']],
  ['키크론 K2 키보드', ['k2', 'keychron', '키크론']], ['조브 기록 폴라 헤드폰', ['headphone', '헤드폰']]
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (u, bin) => { const r = await fetch(u, { headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw Error(r.status + ' ' + u); return bin ? Buffer.from(await r.arrayBuffer()) : r.text(); };
const ld = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { return null; } }).filter(Boolean);
mkdirSync('eval/images', { recursive: true });
const cases = [];
for (const [q, modelAny] of queries) {
  try {
    const list = ld(await get('https://search.danawa.com/dsearch.php?query=' + encodeURIComponent(q)))
      .find(x => x['@type'] === 'ItemList')?.itemListElement?.[0];
    if (!list) throw Error('no result'); await sleep(1500);
    const product = ld(await get(list.url)).find(x => x['@type'] === 'Product');
    const price = Number(product?.offers?.lowPrice), photo = (Array.isArray(product?.image) ? product.image[0] : product?.image);
    if (!price || !photo) throw Error('no price/photo'); await sleep(1500);
    const file = `eval/images/${cases.length + 1}.jpg`;
    writeFileSync(file, await get(photo.replace(/shrink=\d+:\d+/, 'shrink=500:500'), true)); await sleep(1000);
    cases.push({ name: product.name, query: q, source: list.url, image: file, observedLowPrice: price, expect: { modelAny, minPrice: Math.round(price * .6), maxPrice: Math.round(price * 1.6) } });
    console.log('ok', q, price);
  } catch (e) { console.log('skip', q, e.message); }
}
writeFileSync('eval/cases.json', JSON.stringify(cases, null, 2));
console.log(`${cases.length}/${queries.length} cases written to eval/cases.json`);
