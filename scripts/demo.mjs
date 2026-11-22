import {spawn,spawnSync} from 'node:child_process';
import {networkInterfaces} from 'node:os';
import {isIPv4} from 'node:net';
import {resolve} from 'node:path';
const phone=process.argv.includes('--phone');
const privateIp=s=>isIPv4(s)&&/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(s);
const ip=process.env.HOWMUCH_LAN_IP||Object.values(networkInterfaces()).flat().find(x=>!x.internal&&privateIp(x.address))?.address;
const env={...process.env,RESEARCH_AGENT_ENDPOINT:process.env.RESEARCH_AGENT_ENDPOINT||'http://127.0.0.1:'+(process.env.AGENT_PORT||8791)+'/agent/research'};
const buildenv=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASS)/i.test(k)));
if(phone){
 if(!ip||!privateIp(ip))throw Error('Set HOWMUCH_LAN_IP to the private IPv4 of the Wi-Fi interface.');
 for(const [cmd,args] of [['sh',['scripts/dev-cert.sh',ip]],['npm',['run','build']]]){
  const run=spawnSync(cmd,args,{stdio:'inherit',env:buildenv});if(run.status!==0)process.exit(1);
 }
 env.HOWMUCH_PHONE_ORIGIN='https://'+ip+':'+(process.env.HOWMUCH_PHONE_PORT||8443);
 env.HOWMUCH_TLS_CERT=resolve('.howmuch/tls/'+ip+'.pem');env.HOWMUCH_TLS_KEY=resolve('.howmuch/tls/'+ip+'.key');
 console.log('Trust only .howmuch/tls/ca.crt on the phone. Open http://localhost:5173 on desktop; choose Settings → QR.');
}
const children=[];
function start(cmd,args,vars){const c=spawn(cmd,args,{stdio:'inherit',env:vars});children.push(c);c.on('error',()=>stop(1));c.on('exit',code=>stop(code??1));}
let stopping=false;function stop(code){if(stopping)return;stopping=true;for(const c of children)c.kill('SIGTERM');process.exitCode=code;}
process.on('SIGINT',()=>stop(0));process.on('SIGTERM',()=>stop(0));
start(process.execPath,['--import','./scripts/warm-segmentation.mjs','server/agent-runtime.mjs'],env);
start(process.execPath,['server/analyze.mjs'],env);
start(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],buildenv);
