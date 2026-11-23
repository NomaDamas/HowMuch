import { t } from './lib/i18n.js';
import React, {useEffect,useState} from 'react';
import QRCode from 'qrcode';
const fragment=()=>location.hash.match(/^#pair=([\w-]+)\.([\w-]+)$/)?.slice(1);
const post=(path,data)=>fetch(path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});
export default function Pairing({open:requested=false,onClose=()=>{}}){
  const [invite]=useState(fragment);
  const [open,setOpen]=useState(Boolean(invite)),[token,setToken]=useState(''),[client,setClient]=useState(false),[sid,setSid]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(invite)history.replaceState(null,'',location.pathname+location.search)},[invite]);
  async function issue(){
    setOpen(true);setMessage('');setBusy(true);
    try{
      if(sid)await fetch('/v1/pairing/sessions/'+encodeURIComponent(sid),{method:'DELETE'});
      const r=await post('/v1/pairing/sessions',{});if(!r.ok)throw Error();
      const body=await r.json();setSid(body.sessionId);setToken(await QRCode.toDataURL(body.url,{width:224,margin:3,errorCorrectionLevel:'M'}));
      setMessage(t('pair.scan'));
    }catch{setToken('');setMessage(t('pair.start'))}finally{setBusy(false)}
  }
  async function accept(){
    setBusy(true);try{const r=await post('/v1/pairing/exchange',{sessionId:invite[0],token:invite[1]});if(!r.ok)throw Error();setClient(true);setOpen(false);location.reload();}catch{setMessage(t('pair.expired'))}finally{setBusy(false)}
  }
  async function revoke(){if(!sid)return;const r=await fetch('/v1/pairing/sessions/'+encodeURIComponent(sid),{method:'DELETE'});if(r.ok){setSid('');setToken('');setMessage(t('pair.revoked'))}}
  const desktop=!invite && location.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  useEffect(()=>{if(requested){setOpen(true);if(desktop&&!token)issue()}},[requested]);
  return <>{open&&<div role="dialog" aria-modal="true" aria-label={t('pair.title')} style={{position:'fixed',inset:0,zIndex:90,display:'grid',placeItems:'center',background:'#1119'}}><section style={{width:'min(86vw,320px)',padding:24,borderRadius:20,color:'#182018',background:'#fff',whiteSpace:'normal',textAlign:'left',lineHeight:1.5}}><h2>{t('pair.title')}</h2>{desktop?<>{token&&<img width="224" height="224" src={token} alt={t('pair.phone')}/>}<p>{message}</p>{sid&&<button type="button" onClick={revoke}>{t('pair.revoke')}</button>} <button type="button" disabled={busy} onClick={issue}>{t('pair.new')}</button></>:<><p>{invite?t('pair.ask'):t('pair.scanNew')}</p><strong>{location.origin}</strong><p>{message}</p>{invite&&!client&&<button type="button" disabled={busy} onClick={accept}>{t('pair.connect')}</button>}</>} <button type="button" onClick={()=>{setOpen(false);onClose()}}>{t('pair.close')}</button></section></div>}</>
}
