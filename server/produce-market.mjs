import { chromium } from 'playwright';
const catalog=[
 ['사과','apple',400,411,'05'],['배','pear',400,412],['복숭아','peach',400,413],['포도','grape',400,414],['감귤','mandarin',400,415],['단감','persimmon',400,416],['바나나','banana',400,418],['파인애플','pineapple',400,420],['오렌지','orange',400,421],['레몬','lemon',400,424],['체리','cherry',400,425],['망고','mango',400,428],['아보카도','avocado',400,430],['블루베리','blueberry',400,429],['키위','kiwi',400,437],
 ['배추','napa cabbage',200,211],['양배추','cabbage',200,212],['시금치','spinach',200,213],['상추','lettuce',200,214],['오이','cucumber',200,223],['호박','squash',200,224],['토마토','tomato',200,225],['당근','carrot',200,232],['양파','onion',200,245],['딸기','strawberry',200,226],['감자','potato',100,152],['고구마','sweet potato',100,151]
];
export function commodityFor(plan){
  if(plan.kind!=='product'||!['fresh_produce','produce'].includes(plan.marketKind))return null;
  const k=String(plan.commodity||'').trim().toLowerCase();return catalog.find(([ko,en])=>ko===k||en===k)||null;
}
const cities=['서울','부산','대구','인천','광주','대전','울산','수원','춘천','청주','전주','창원','제주','성남','의정부','고양','포항','천안','김해','순천','안동'];
export function produceSource(c){const u=new URL('https://www.kamis.or.kr/customer/price/retail/item.do');for(const [k,v] of Object.entries({action:'priceinfo',productrankcode:'1',itemcategorycode:c[2],itemcode:c[3],...(c[4]?{kindcode:c[4]}:{})}))u.searchParams.set(k,v);return u.href;}
export function readMarketDom(){
  const t=document.querySelector('table[id^="itemTable_"]');if(!t)return null;
  const section=t.closest('section');let s=section?.previousElementSibling;
  while(s && !s.querySelector('h3.s_tit6'))s=s.previousElementSibling;
  if(!s)return null;
  const heads=[...s.querySelectorAll('h3')].map(x=>x.textContent.replace(/\s+/g,' ').trim());
  const header=[...t.rows[0].cells].map(c=>c.innerText.replace(/\s+/g,' ').trim());
  const records=[];let city='';
  for(const row of [...t.rows].slice(1)){
    const label=row.querySelector('td.cell_tit1[rowspan]');if(label)city=label.innerText.trim();
    const shop=row.querySelector('td.cell_tit2');if(!city||!shop)continue;
    const vals=[...row.cells].slice([...row.cells].indexOf(shop)+1).map(c=>c.textContent.trim());
    records.push({city,shop:shop.textContent.trim(),values:vals});
  }
  return {heads,header,records,ref:document.querySelector('#regday')?.value,currency:s.querySelector('.unit')?.textContent};
}
export function parseProduce(data,c,region='전국',now=new Date()){
  if(!data||!Array.isArray(data.heads)||!data.heads.some(h=>h.split(/\s*\/\s*/).map(s=>s.trim().replace(/,$/,'')).includes(c[0]))||!/단위\s*:\s*원/.test(data.currency||''))return null;
  if(region!=='전국'&&!cities.includes(region))return null;
  const u=data.heads.join(' ').match(/단위\s*:\s*(\d+(?:\.\d+)?)\s*(kg|g|개|포기|단|송이|묶음|통|박스)/i);
  if(!u||Number(u[1])<=0||!/^\d{4}-\d{2}-\d{2}$/.test(data.ref))return null;
  const header=data.header[1]?.match(/(\d{1,2})\/(\d{1,2})/);if(!header)return null;
  const month=+header[1],year=+data.ref.slice(0,4)-(month>+data.ref.slice(5,7)?1:0);
  const date=year+'-'+String(month).padStart(2,'0')+'-'+header[2].padStart(2,'0'),age=now-Date.parse(date+'T00:00:00+09:00');
  if(!Number.isFinite(age)||age<0||age>8*86400000)return null;
  const quantity=Number(u[1]),unit=u[2].toLowerCase(),url=produceSource(c),title=data.heads.filter(h=>!h.includes('단위')).join(' ').replace(/,\s*$/,'');
  const samples=data.records.filter(r=>(region==='전국'||region===r.city)&&r.city&&r.shop&&/^\d[\d,]*$/.test(r.values[0])).map(r=>({title,source:'aT KAMIS · '+r.shop,region:r.city,quantity,unit,price:Number(r.values[0].replaceAll(',','')),currency:'KRW',url,observedAt:date,checkedAt:now.toISOString()})).filter(r=>r.price>0);
  if(!samples.length)return null;
  const prices=samples.map(r=>r.price).sort((a,b)=>a-b),m=Math.floor(prices.length/2);
  return {commodity:c[0],region,currency:'KRW',quantity,unit,min:prices[0],max:prices.at(-1),median:prices.length%2?prices[m]:(prices[m-1]+prices[m])/2,samples};
}
export async function readProduce(c,region='전국',signal){
  signal?.throwIfAborted();
  const browser=await chromium.launch({headless:true});
  const cancel=()=>{void browser.close().catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    signal?.throwIfAborted();
    const ctx=await browser.newContext({javaScriptEnabled:false,serviceWorkers:'block'});
    const url=produceSource(c);
    await ctx.route('**/*',async route=>{
      if(route.request().method()!=='GET'||route.request().url()!==url)return route.abort();
      try{const reply=await route.fetch({maxRedirects:0,timeout:15000});if(reply.status()!==200)return route.abort();await route.fulfill({response:reply});}catch{await route.abort().catch(()=>{});}
    });
    const page=await ctx.newPage();await page.goto(url,{waitUntil:'domcontentloaded',timeout:18000});
    return parseProduce(await page.evaluate(readMarketDom),c,region);
  }finally{signal?.removeEventListener('abort',cancel);await browser.close().catch(()=>{});}
}
