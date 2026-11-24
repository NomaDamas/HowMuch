// UTF-8 chunks may split a JSON line (or a Korean character) at any byte.
export async function readResearch(response, onPhase) {
  if (!response.headers.get('content-type')?.includes('application/x-ndjson')) return response.json();
  const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();
  let pending='',result;
  const consume=line=>{
    if (!line.trim()) return;
    const event=JSON.parse(line);
    if (event.error) throw Error('가격 조사에 실패했습니다: '+String(event.error).slice(0,100));
    if (event.result) result=event.result;
    if (event.phase==='researching' || event.phase==='identifying' || event.phase==='progress' || event.phase==='preliminary') onPhase?.(event);
  };
  try {
    while(true){const next=await reader.read();if(next.done)break;
      pending+=next.value;if(pending.length>1_000_000)throw Error('가격 응답 크기 초과');
      const lines=pending.split('\n');pending=lines.pop();lines.forEach(consume);
    }
    consume(pending);if(!result)throw Error('가격 조사 연결이 중단됐습니다.');return result;
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
