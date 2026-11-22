import { createHash, randomBytes, randomUUID } from 'node:crypto';
const digest=v=>createHash('sha256').update(String(v||'')).digest('hex');
export function pairingStore(now=Date.now){
 const sessions=new Map(); function trim(){for(const [id,s] of sessions)if(s.expiresAt<=now())sessions.delete(id)}
 return {
 create(){trim();if(sessions.size>=32)throw Error('capacity'); const sessionId=randomUUID(),token=randomBytes(24).toString('base64url'),expiresAt=now()+300000; sessions.set(sessionId,{token:digest(token),expiresAt});return {sessionId,token,expiresAt}},
 exchange(id,token){trim();const s=sessions.get(id);if(!s?.token||s.token!==digest(token))return null;delete s.token;const clientToken=randomBytes(32).toString('base64url');s.client=digest(clientToken);s.expiresAt=now()+600000;return {id,clientToken,expiresAt:s.expiresAt}},
 valid(id,token){trim();return sessions.get(id)?.client===digest(token)},revoke(id){sessions.delete(id)}};
}
