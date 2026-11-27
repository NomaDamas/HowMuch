import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
const digest=v=>createHash('sha256').update(String(v||'')).digest('hex');
const INVITE_MS=300000, CLIENT_MS=7*24*3600e3;
/**
 * Pairing: a one-time invite (5 min) is exchanged for a client token. A paired phone stays paired for 7 days from its last
 * use, and with `file` the paired phones (only hashes of their tokens) survive a server restart, so a restart or a pause
 * during a demo never makes the phone ask for pairing again.
 */
export function pairingStore(now=Date.now,{file,clientMs=CLIENT_MS}={}){
 const sessions=new Map();
 if(file){try{for(const [id,s] of Object.entries(JSON.parse(readFileSync(file,'utf8'))))if(s?.client&&s.expiresAt>now())sessions.set(id,{client:s.client,expiresAt:s.expiresAt})}catch{/* first run or unreadable: start empty */}}
 function save(){if(!file)return;try{mkdirSync(dirname(file),{recursive:true});const out={};for(const [id,s] of sessions)if(s.client)out[id]={client:s.client,expiresAt:s.expiresAt};writeFileSync(file,JSON.stringify(out),{mode:0o600});chmodSync(file,0o600)}catch{/* persistence is best effort */}}
 function trim(){let changed=false;for(const [id,s] of sessions)if(s.expiresAt<=now()){sessions.delete(id);changed=true}if(changed)save()}
 return {
 create(){trim();while(sessions.size>=32){const old=[...sessions].find(([,v])=>!v.client)||[...sessions][0];sessions.delete(old[0]);save()} const sessionId=randomUUID(),token=randomBytes(24).toString('base64url'),expiresAt=now()+INVITE_MS; sessions.set(sessionId,{token:digest(token),expiresAt});return {sessionId,token,expiresAt}},
 exchange(id,token){trim();const s=sessions.get(id);if(!s?.token||s.token!==digest(token))return null;delete s.token;const clientToken=randomBytes(32).toString('base64url');s.client=digest(clientToken);s.expiresAt=now()+clientMs;save();return {id,clientToken,expiresAt:s.expiresAt}},
 valid(id,token){trim();const s=sessions.get(id);if(!s||s.client!==digest(token))return false;const next=now()+clientMs;if(next-s.expiresAt>3600e3){s.expiresAt=next;save()}return true},
 revoke(id){sessions.delete(id);save()}};
}
