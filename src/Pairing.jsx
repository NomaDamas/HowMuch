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
      setMessage('같은 Wi-Fi의 휴대폰으로 스캔하세요. 코드는 5분 동안 한 번 사용할 수 있습니다.');
    }catch{setToken('');setMessage('휴대폰 데모 서버를 실행하고 로컬 인증서를 휴대폰에서 신뢰해 주세요.')}finally{setBusy(false)}
  }
  async function accept(){
    setBusy(true);try{const r=await post('/v1/pairing/exchange',{sessionId:invite[0],token:invite[1]});if(!r.ok)throw Error();setClient(true);setOpen(false);location.reload();}catch{setMessage('이미 사용했거나 만료된 QR입니다. PC에서 새 코드를 발급하세요.')}finally{setBusy(false)}
  }
  async function revoke(){if(!sid)return;const r=await fetch('/v1/pairing/sessions/'+encodeURIComponent(sid),{method:'DELETE'});if(r.ok){setSid('');setToken('');setMessage('이 연결을 해제했습니다.')}}
  const desktop=!invite && location.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(location.hostname);
  useEffect(()=>{if(requested){setOpen(true);if(desktop&&!token)issue()}},[requested]);
  return <>{open&&<div role="dialog" aria-modal="true" aria-label="휴대폰 연결" style={{position:'fixed',inset:0,zIndex:90,display:'grid',placeItems:'center',background:'#1119'}}><section style={{width:'min(86vw,320px)',padding:24,borderRadius:20,color:'#182018',background:'#fff',whiteSpace:'normal',textAlign:'left',lineHeight:1.5}}><h2>휴대폰 연결</h2>{desktop?<>{token&&<img width="224" height="224" src={token} alt="휴대폰 카메라 연결 QR"/>}<p>{message}</p>{sid&&<button type="button" onClick={revoke}>연결 해제</button>} <button type="button" disabled={busy} onClick={issue}>새 QR</button></>:<><p>{invite?'이 기기를 아래 서버에 연결해 카메라로 선택한 물체를 조사할까요?':'PC의 휴대폰 연결 버튼에서 새 QR을 스캔하세요.'}</p><strong>{location.origin}</strong><p>{message}</p>{invite&&!client&&<button type="button" disabled={busy} onClick={accept}>이 서버에 연결</button>}</>} <button type="button" onClick={()=>{setOpen(false);onClose()}}>닫기</button></section></div>}</>
}
