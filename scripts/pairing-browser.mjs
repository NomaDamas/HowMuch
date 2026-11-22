// TLS/QR smoke with real desktop & mobile-size Chromium contexts. No keys/images are logged.
import {createServer as viteServer} from 'vite';
import {chromium} from 'playwright';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createHash,X509Certificate} from 'node:crypto';
import {get} from 'node:https';
import assert from 'node:assert/strict';

const ip='127.0.0.1'; // Distinct HTTPS port from desktop; no Wi-Fi traffic or paid upstream calls.
const free=async host=>{const s=createServer();s.listen(0,host);await once(s,'listening');const port=s.address().port;await new Promise(r=>s.close(r));return port};
const desktopPort=await free('127.0.0.1'),phonePort=await free(ip);
const url='https://'+ip+':'+phonePort;
execFileSync('sh',['scripts/dev-cert.sh',ip],{stdio:'ignore'});
const path='.howmuch/tls/'+ip;
const ca=await readFile('.howmuch/tls/ca.crt');
const cert=new X509Certificate(await readFile(path+'.pem'));
const pin=createHash('sha256').update(cert.publicKey.export({type:'spki',format:'der'})).digest('base64');
const api=spawn(process.execPath,['server/analyze.mjs'],{env:{...process.env,PORT:String(desktopPort),HOWMUCH_PHONE_ORIGIN:url,HOWMUCH_TLS_CERT:path+'.pem',HOWMUCH_TLS_KEY:path+'.key'},stdio:'ignore'});
let vite,browser;
try {
 let ready=false;
 for(let attempt=0;attempt<50;attempt++){try{await new Promise((resolve,reject)=>get(url,{ca},res=>{res.resume();res.statusCode===200?resolve():reject(Error('run npm run build first'))}).on('error',reject));ready=true;break}catch{await new Promise(r=>setTimeout(r,100))}}
 assert.ok(ready,'phone certificate/hostname must validate against local CA');
 const target='http://127.0.0.1:'+desktopPort;
 vite=await viteServer({cacheDir:'node_modules/.vite-howmuch-pairing',configFile:false,server:{host:'127.0.0.1',port:0,proxy:Object.fromEntries(['/api','/v1','/agent'].map(path=>[path,{target,changeOrigin:false}]))},logLevel:'error'});await vite.listen();
 browser=await chromium.launch({args:['--ignore-certificate-errors-spki-list='+pin]});
 const desktop=await browser.newPage();desktop.setDefaultTimeout(6000);await desktop.goto('http://127.0.0.1:'+vite.httpServer.address().port);
 await desktop.getByRole('button',{name:'설정',exact:true}).click();
 await desktop.getByRole('button',{name:'휴대폰 연결 QR'}).click();
 const png=await desktop.getByAltText('휴대폰 카메라 연결 QR').getAttribute('src');
 const python=process.env.HOWMUCH_SAM_PYTHON||'.howmuch/sam/venv/bin/python';
 const decoded=execFileSync(python,['-c','import sys,cv2,numpy as np; data=np.frombuffer(sys.stdin.buffer.read(),dtype=np.uint8); print(cv2.QRCodeDetector().detectAndDecode(cv2.imdecode(data,1))[0])'],{input:Buffer.from(png.split(',')[1],'base64')}).toString().trim();
 assert.equal(new URL(decoded).origin,url);
 const phone=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await phone.goto(decoded);await phone.getByRole('button',{name:'이 서버에 연결'}).waitFor();
 assert.equal(await phone.evaluate(()=>location.hash),'');
 const probe=()=>phone.evaluate(async()=>{const r=await fetch('/api/research',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});return r.status});
 assert.equal(await probe(),401);await Promise.all([phone.waitForEvent('load'),phone.getByRole('button',{name:'이 서버에 연결'}).click()]);
 assert.equal(await probe(),400);await desktop.getByRole('button',{name:'연결 해제'}).click();await desktop.getByText('이 연결을 해제했습니다.').waitFor();assert.equal(await probe(),401);
 console.log('PASS: verified TLS, rendered desktop QR, decoded one-time link, mobile confirm, HttpOnly authorization and revoke.');
}finally{await browser?.close();await vite?.close();api.kill();}
