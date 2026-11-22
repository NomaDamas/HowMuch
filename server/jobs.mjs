import {randomUUID} from 'node:crypto';
export function jobStore(now=Date.now){
 const jobs=new Map();function trim(){for(const [id,j] of jobs)if(j.finished && j.finished+300000<=now())jobs.delete(id)}
 return {
 start(owner,run){trim();if(jobs.size>=32)return null;const id=randomUUID(),job={owner,listeners:new Set(),events:[]};jobs.set(id,job);
 const emit=(status,extra)=>{const e={jobId:id,sequence:job.events.length+1,status,...extra};job.events.push(e);for(const fn of job.listeners)fn(e)};
 emit('queued');Promise.resolve().then(()=>{emit('running');return run()}).then(result=>{job.finished=now();emit('completed',{result})},()=>{job.finished=now();emit('failed',{error:'research_failed'})});return id;},
 get(id,owner){trim();const j=jobs.get(id);return j?.owner===owner?j:null}};
}
