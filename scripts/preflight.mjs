import {existsSync,readFileSync} from 'node:fs';
import {inspectRuntimeConfiguration} from '../src/lib/runtime-config.ts';
import {readinessChecklist} from '../src/lib/readiness.ts';
for(const file of ['.env.local','.env'])if(existsSync(file))process.loadEnvFile(file);
const args=process.argv.slice(2);const target=args.includes('--target=connected')?'connected':'portfolio';
const configuration=inspectRuntimeConfiguration({...process.env,NODE_ENV:'production'});
const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
const report={version,target,configured:configuration.configured,mode:configuration.mode,configurationIssues:configuration.issues,productionApproved:false,fiscalIssuance:'disabled',checks:readinessChecklist(configuration.mode,configuration.configured)};
if(target==='connected'&&configuration.mode!=='connected'){report.configured=false;report.configurationIssues.push({code:'TARGET_MODE_MISMATCH',message:'Para avaliar a operação conectada, configure os dois modos como connected em um ambiente separado.'});}
console.log(args.includes('--json')?JSON.stringify(report,null,2):[`BOX ${version} — pré-verificação ${target}`,`Configuração: ${report.configured?'estruturalmente válida':'com bloqueios'}`,`Operação real: NÃO HOMOLOGADA. Emissão fiscal: BLOQUEADA.`,...report.configurationIssues.map(i=>'BLOQUEIO: '+i.message),...report.checks.map(c=>`${c.status==='implemented'?'CÓDIGO':c.status==='blocked'?'BLOQUEIO':'HOMOLOGAR'} — ${c.label}: ${c.detail}`)].join('\n'));
// Exit 0 comprova apenas a configuração do portfólio. Operação real exige evidências e um conector não entregue.
process.exitCode=target==='connected'?2:configuration.configured&&configuration.mode==='portfolio'?0:1;
