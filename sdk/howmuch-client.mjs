export class HowMuchClient {
 constructor(endpoint='http://127.0.0.1:8787'){this.origin=new URL(endpoint).origin}
 async research(input,signal){return this.post('/api/research',input,signal)}
 async startJob(input,signal){return this.post('/api/jobs',input,signal)}
 async *events(id,signal){
  const r=await fetch(this.origin+'/api/jobs/'+encodeURIComponent(id)+'/events',{signal});if(!r.ok)throw Error('HowMuch: '+r.status);
  let buf=''; const stream=r.body.pipeThrough(new TextDecoderStream());for await(const chunk of stream){
   buf+=chunk;let boundary;while((boundary=buf.indexOf('\n\n'))!==-1){const event=buf.slice(0,boundary);buf=buf.slice(boundary+2);const data=event.split('\n').find(line=>line.startsWith('data: '));if(data)yield JSON.parse(data.slice(6));}
  }
 }
 async post(path,input,signal){const r=await fetch(this.origin+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input),signal});if(!r.ok)throw Error('HowMuch: '+r.status);return r.json()}
}
