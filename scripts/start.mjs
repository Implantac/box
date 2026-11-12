import {cp,access} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
// Lê segredos locais somente no servidor. Variáveis da plataforma têm precedência.
for(const name of ['.env.local','.env'])if(existsSync(name))process.loadEnvFile(name);
const root=process.cwd();const standalone=resolve(root,'.next/standalone');
try{await access(resolve(standalone,'server.js'));}catch{console.error('Build não encontrado. Execute npm run build antes de iniciar.');process.exit(1);}
await cp(resolve(root,'public'),resolve(standalone,'public'),{recursive:true});
await cp(resolve(root,'.next/static'),resolve(standalone,'.next/static'),{recursive:true});
const child=spawn(process.execPath,[resolve(standalone,'server.js')],{cwd:standalone,stdio:'inherit',env:{...process.env,NODE_ENV:'production',HOSTNAME:process.env.BOX_BIND_HOST||'0.0.0.0',PORT:process.env.PORT||'3000',NEXT_TELEMETRY_DISABLED:'1'}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>{process.exitCode=code??1;});
child.on('error',()=>{console.error('Não foi possível iniciar o servidor. Verifique a instalação e os registros da hospedagem.');process.exitCode=1;});
