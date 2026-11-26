import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';
const api='http://127.0.0.1:'+(process.env.PORT||8787);
const proxy=Object.fromEntries(['/api','/v1','/agent/segment','/agent/track'].map(p=>[p,{target:api,changeOrigin:false}]));
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',proxy,fs:{deny:['.env','.env.*','**/.git/**','**/.howmuch/**','*.pem','*.key']}},preview:{host:'127.0.0.1',proxy}});
