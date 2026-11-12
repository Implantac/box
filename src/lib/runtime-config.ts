// Sem leitura de segredos no navegador. Recebe valores apenas para validação; nunca os devolve no relatório.
export type EnvironmentValues=Record<string,string|undefined>;
export interface ConfigurationIssue {code:string;message:string}
export function inspectRuntimeConfiguration(env:EnvironmentValues){
 const mode=env.APP_MODE||'portfolio';const publicMode=env.NEXT_PUBLIC_APP_MODE||'portfolio';const issues:ConfigurationIssue[]=[];
 const issue=(code:string,message:string)=>issues.push({code,message});
 if(!['portfolio','connected'].includes(mode)||mode!==publicMode)issue('MODE_MISMATCH','Os modos de cliente e servidor não correspondem. Refaça a configuração e o build.');
 if(mode==='connected'){
  if(!env.SUPABASE_URL||!env.SUPABASE_PUBLISHABLE_KEY||!env.BOX_WORKSPACE_ID||!env.APP_ORIGIN)issue('NOT_CONFIGURED','Ambiente conectado não configurado. Consulte o guia de implantação.');
  const url=(value:string|undefined,https:boolean)=>{try{const u=new URL(value||'');return !u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&u.origin!=='null'&&(https?u.protocol==='https:':['https:','http:'].includes(u.protocol));}catch{return false;}};
  if(env.SUPABASE_URL&&!url(env.SUPABASE_URL,true))issue('INVALID_DATABASE_URL','Configuração do servidor inválida: URL do banco deve ser uma origem HTTPS, sem credenciais, caminho ou parâmetros.');
  if(env.APP_ORIGIN&&!url(env.APP_ORIGIN,false))issue('INVALID_ORIGIN_CONFIG','Configuração do servidor inválida: APP_ORIGIN deve ser a origem exata, sem caminho, credenciais ou parâmetros.');
  if(env.APP_ORIGIN&&env.NODE_ENV==='production'&&!env.APP_ORIGIN.startsWith('https://'))issue('HTTPS_REQUIRED','HTTPS obrigatório no modo conectado.');
  if(env.BOX_WORKSPACE_ID&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(env.BOX_WORKSPACE_ID))issue('INVALID_WORKSPACE','Configuração do servidor inválida: workspace precisa de UUID válido.');
  const key=env.SUPABASE_PUBLISHABLE_KEY||'';let privileged=key.startsWith('sb_secret_');
  if(key.split('.').length===3){try{const payload=key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');const role=JSON.parse(atob(payload)).role;privileged=privileged||role==='service_role'||role==='supabase_admin';}catch{/* O provedor validará a chave; aqui não se prova sua validade. */}}
  if(privileged)issue('PRIVILEGED_KEY','Chave privilegiada proibida no aplicativo web. Utilize uma chave publicável do projeto dedicado.');
 }
 return {mode:mode==='connected'?'connected' as const:'portfolio' as const,configured:issues.length===0,issues};
}
