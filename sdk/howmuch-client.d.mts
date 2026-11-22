import type {ResearchRequest, ResearchResult} from './types';
export interface JobEvent { jobId:string; sequence:number; status:'queued'|'running'|'completed'|'failed'; result?:ResearchResult; error?:string }
export class HowMuchClient {
 constructor(endpoint?:string);
 research(input:ResearchRequest,signal?:AbortSignal):Promise<ResearchResult>;
 startJob(input:ResearchRequest,signal?:AbortSignal):Promise<{jobId:string;events:string;status:string}>;
 events(id:string,signal?:AbortSignal):AsyncGenerator<JobEvent>;
}
