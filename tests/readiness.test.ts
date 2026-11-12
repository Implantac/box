import {describe,it,expect,vi,afterEach} from 'vitest';
import {inspectRuntimeConfiguration} from '@/lib/runtime-config';
import {readinessChecklist} from '@/lib/readiness';
import {GET as health} from '@/app/api/health/route';
const good={APP_MODE:'connected',NEXT_PUBLIC_APP_MODE:'connected',NODE_ENV:'production',APP_ORIGIN:'https://box.example.com',SUPABASE_URL:'https://dedicated.example',SUPABASE_PUBLISHABLE_KEY:'fictional-not-a-real-key',BOX_WORKSPACE_ID:'d0000000-0000-4000-8000-000000000200'};
afterEach(()=>vi.unstubAllEnvs());
describe('pré-verificação: presença de variáveis não equivale a homologação',()=>{
 it('portfolio não requer credenciais e não avalia dados secretos',()=>{expect(inspectRuntimeConfiguration({})).toMatchObject({mode:'portfolio',configured:true,issues:[]});});
 it('configuração conectada é apenas estrutural',()=>{expect(inspectRuntimeConfiguration(good)).toMatchObject({configured:true});expect(readinessChecklist('connected',true).find(c=>c.id==='provider')?.status).toBe('blocked');expect(readinessChecklist('connected',true).find(c=>c.id==='backup')?.status).toBe('verify');});
 it.each(['https://box.example/a','https://user:password@box.example','https://box.example?token=secret','not-a-url'])('rejeita origem não exata sem vazar %s',origin=>{const r=inspectRuntimeConfiguration({...good,APP_ORIGIN:origin});expect(r.configured).toBe(false);expect(JSON.stringify(r)).not.toContain(origin);});
 it('bloqueia chave secreta e JWT service_role, sem exibir valores',()=>{const secret='sb_secret_fixture_not_a_real_credential';const jwt='x.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.x';for(const key of [secret,jwt]){const r=inspectRuntimeConfiguration({...good,SUPABASE_PUBLISHABLE_KEY:key});expect(r.issues.some(i=>i.code==='PRIVILEGED_KEY')).toBe(true);expect(JSON.stringify(r)).not.toContain(key);}});
 it('bloqueia HTTP em produção, UUID defeituoso e modos inconsistentes',()=>{for(const values of [{APP_ORIGIN:'http://box.example'},{BOX_WORKSPACE_ID:'-'.repeat(36)},{NEXT_PUBLIC_APP_MODE:'portfolio'},{APP_MODE:'conected'}])expect(inspectRuntimeConfiguration({...good,...values}).configured).toBe(false);});
 it('health nunca afirma operação ou fiscal liberados',async()=>{vi.stubEnv('APP_MODE','portfolio');vi.stubEnv('NEXT_PUBLIC_APP_MODE','portfolio');const r=await health();expect(r.status).toBe(200);expect(await r.json()).toMatchObject({productionApproved:false,fiscalIssuance:'disabled',databaseConnection:'not-used',version:'1.2.0'});});
 it('health falha com modo inválido e nunca devolve configuração privada',async()=>{vi.stubEnv('APP_MODE','conected');vi.stubEnv('NEXT_PUBLIC_APP_MODE','portfolio');vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','nao-expor-este-valor');const r=await health();expect(r.status).toBe(503);expect(await r.text()).not.toContain('nao-expor-este-valor');});
});
