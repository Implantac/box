import {beforeAll,beforeEach,afterEach,afterAll,describe,it,expect,vi} from 'vitest';
import type {PGlite} from '@electric-sql/pglite';
import {fixtureDatabase,asUser,users,workspaceId} from './helpers/database';
import {sid,createSeed} from '@/lib/seed';
import {id,type Role} from '@/lib/model';
vi.mock('@/lib/server/auth',async importOriginal=>{const actual=await importOriginal<typeof import('@/lib/server/auth')>();return {...actual,authContext:vi.fn()};});
import {authContext,HttpError} from '@/lib/server/auth';
import {GET,POST} from '@/app/api/workspace/route';
import {GET as readiness} from '@/app/api/readiness/route';
import {POST as fiscalPost} from '@/app/api/fiscal/[action]/route';
let db:PGlite;
const auth=vi.mocked(authContext);
beforeAll(async()=>{vi.stubEnv('APP_MODE','connected');vi.stubEnv('NEXT_PUBLIC_APP_MODE','connected');vi.stubEnv('APP_ORIGIN','https://box.example');vi.stubEnv('SUPABASE_URL','https://dedicado.example');vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','publishable_test_not_a_real_key');vi.stubEnv('BOX_WORKSPACE_ID',workspaceId);db=await fixtureDatabase();},60000);
async function useRole(role:Role){await asUser(db,role);const client={rpc:async(name:string,args:Record<string,unknown>)=>{await db.exec('SAVEPOINT http_request');try{const sql=name==='box_read_workspace'?'SELECT public.box_read_workspace($1) AS data':'SELECT public.box_command($1,$2,$3::jsonb) AS data';const params=name==='box_read_workspace'?[args.p_workspace]:[args.p_workspace,args.p_expected_revision,JSON.stringify(args.p_command)];const result=await db.query<{data:unknown}>(sql,params);await db.exec('RELEASE SAVEPOINT http_request');return{data:result.rows[0].data,error:null};}catch(e){await db.exec('ROLLBACK TO SAVEPOINT http_request;RELEASE SAVEPOINT http_request');return{data:null,error:{code:(e as {code:string}).code}};}}};auth.mockResolvedValue({client,user:{id:users[role]},member:{},session:{role,name:'Usuário fictício',workspaceId,userId:users[role]}} as unknown as Awaited<ReturnType<typeof authContext>>);}
beforeEach(async()=>{await db.exec('BEGIN');await useRole('owner');});
afterEach(async()=>{await db.exec('ROLLBACK;RESET ROLE;');vi.clearAllMocks();});
afterAll(async()=>{await db?.close();vi.unstubAllEnvs();});
const req=(body:unknown,origin='https://box.example')=>new Request('https://box.example/api/workspace',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
describe('API workspace: camada HTTP + banco local com identidade de teste',()=>{
 it('retorna 401 sem autenticação, sem dados',async()=>{auth.mockRejectedValue(new HttpError('Entre com sua conta.',401,'UNAUTHENTICATED'));const r=await GET();expect(r.status).toBe(401);expect((await r.json()).state).toBeUndefined();});
 it.each(['owner','reception','technician','finance','marketing','customer'] as Role[])('GET aplica RLS para %s',async role=>{await useRole(role);const r=await GET();expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toContain('no-store');const data=await r.json();if(role==='customer'){expect(data.state.customers.map((x:{id:string})=>x.id)).toEqual([sid(3)]);expect(data.state.orders).toHaveLength(1);}if(role==='marketing'){expect(data.state.customers).toEqual([]);expect(data.state.orders).toEqual([]);}if(role==='technician')expect(data.state.orders.every((x:{id:string;technician:string})=>x.technician==='Lucas • demo'||data.state.services.some((t:{orderId:string})=>t.orderId===x.id))).toBe(true);});
 it('origem externa é rejeitada antes da escrita',async()=>{const r=await POST(req({revision:1,command:{type:'update_settings',settings:createSeed().settings}},'https://outro.example'));expect(r.status).toBe(403);expect(auth).not.toHaveBeenCalled();});
 it('origem malformada é rejeitada, sem erro interno',async()=>{const r=await POST(req({},'null'));expect(r.status).toBe(403);});
 it('papel e vínculo forjados não entram no contrato',async()=>{const r=await POST(req({revision:1,role:'owner',command:{type:'set_quote_status',id:sid(62),status:'aprovado',customerId:sid(3)}}));expect(r.status).toBe(422);});
 it('técnico não altera OS de outra pessoa pela API',async()=>{await useRole('technician');const r=await POST(req({revision:1,command:{type:'transition_order',id:sid(42),status:'testes'}}));expect(r.status).toBe(403);});
 it('marketing não altera configurações pela API',async()=>{await useRole('marketing');const r=await POST(req({revision:1,command:{type:'update_settings',settings:createSeed().settings}}));expect(r.status).toBe(403);});
 it('revisão antiga vira conflito 409',async()=>{const r=await POST(req({revision:9,command:{type:'update_settings',settings:createSeed().settings}}));expect(r.status).toBe(409);expect((await r.json()).code).toBe('REVISION_CONFLICT');});
 it('cliente aprova somente orçamento vinculado pela identidade do servidor',async()=>{await useRole('customer');const r=await POST(req({revision:1,command:{type:'set_quote_status',id:sid(62),status:'aprovado'}}));expect(r.status).toBe(200);const data=await(await GET()).json();expect(data.state.quotes[0].status).toBe('aprovado');});
 it('cliente não aprova orçamento de outra conta pela API',async()=>{await db.exec('RESET ROLE');await db.query('UPDATE public.box_members SET customer_id=$1 WHERE user_id=$2',[sid(1),users.customer]);await useRole('customer');const r=await POST(req({revision:1,command:{type:'set_quote_status',id:sid(62),status:'aprovado'}}));expect(r.status).toBe(403);});
 it('modo conectado não transforma simulação social em sucesso real',async()=>{const r=await POST(req({revision:1,command:{type:'simulate_post',id:sid(141)}}));expect(r.status).toBe(403);expect((await r.json()).code).toBe('INTEGRATION_DISABLED');});
 it('corpo excedente é rejeitado',async()=>{const r=await POST(req({revision:1,command:{type:'x',text:'a'.repeat(41000)}}));expect(r.status).toBe(413);});
 it('JSON inválido é rejeitado',async()=>{const r=await POST(new Request('https://box.example/api/workspace',{method:'POST',headers:{Origin:'https://box.example','Content-Type':'application/json'},body:'{'}));expect(r.status).toBe(400);});
});

const stockCommand=()=>({type:'record_stock',id:id(),partId:sid(401),kind:'entrada',quantity:2,reason:'Entrada fictícia pela API.'});
describe('API dos controles 1.1',()=>{
 it('GET da recepção não expõe regras, comissões ou repasses',async()=>{await useRole('reception');const r=await GET();const d=await r.json();expect(d.state.parts).toHaveLength(6);expect(d.state.services).toHaveLength(4);expect(d.state.commissions).toEqual([]);expect(d.state.commissionRules).toEqual([]);expect(d.state.commissionPayments).toEqual([]);});
 it('GET do cliente não expõe estoque ou equipe',async()=>{await useRole('customer');const d=await(await GET()).json();expect(d.state.parts).toEqual([]);expect(d.state.services).toEqual([]);expect(d.state.commissions).toEqual([]);});
 it('entrada válida chega ao banco e retry não duplica',async()=>{const command=stockCommand();expect((await POST(req({revision:1,command}))).status).toBe(200);const again=await POST(req({revision:2,command}));expect(again.status).toBe(200);expect((await again.json()).result.duplicate).toBe(true);const d=await(await GET()).json();expect(d.state.stockMovements.filter((m:{id:string})=>m.id===command.id)).toHaveLength(1);});
 it('marketing não movimenta estoque por chamada direta',async()=>{await useRole('marketing');expect((await POST(req({revision:1,command:stockCommand()}))).status).toBe(403);});
 it('quantidade fracionada é 422 antes do banco',async()=>{expect((await POST(req({revision:1,command:{...stockCommand(),quantity:1.5}}))).status).toBe(422);});
 it('técnico não pausa serviço de outro mecânico por API',async()=>{await useRole('technician');expect((await POST(req({revision:1,command:{type:'set_service_status',id:sid(481),status:'pausado',note:'Pausa fictícia.'}}))).status).toBe(403);});
 it('recepção não registra repasse de comissão',async()=>{await useRole('reception');expect((await POST(req({revision:1,command:{type:'record_commission_payment',id:id(),commissionId:sid(494),kind:'repasse',amountCents:1,note:'Repasse fictício.'}}))).status).toBe(403);});
 it('GET não trata ausência da migração nova como workspace pronto',async()=>{auth.mockResolvedValue({client:{rpc:async()=>({data:{revision:1},error:null})},session:{role:'owner'},user:{id:users.owner}} as unknown as Awaited<ReturnType<typeof authContext>>);const r=await GET();expect(r.status).toBe(503);expect((await r.json()).code).toBe('DATABASE_UNAVAILABLE');});
});

async function postCurrent(command:unknown){const snapshot=await(await GET()).json();return POST(req({revision:snapshot.state.revision,command}));}
describe('jornadas operacionais atravessando a camada HTTP',()=>{
 it('liberação, reserva, baixa e devolução mantêm origem e saldo',async()=>{
  expect((await postCurrent({type:'release_reserved_part',id:id(),reservationId:sid(441),quantity:1,reason:'Liberação fictícia antes da nova reserva.'})).status).toBe(200);
  const reservation=id();expect((await postCurrent({type:'reserve_part',id:reservation,orderId:sid(42),partId:sid(401),quantity:1})).status).toBe(200);
  const consumption=id();expect((await postCurrent({type:'consume_reserved_part',id:consumption,reservationId:reservation,quantity:1})).status).toBe(200);
  expect((await postCurrent({type:'return_part',id:id(),consumptionId:consumption,quantity:1,reason:'Devolução fictícia de material não utilizado.'})).status).toBe(200);
  const state=(await(await GET()).json()).state;expect(state.stockMovements.filter((m:{referenceId?:string})=>m.referenceId===consumption)).toHaveLength(1);
 });
 it('alocação, conclusão, parcial e estorno não efetuam transferência externa',async()=>{
  expect((await postCurrent({type:'set_quote_status',id:sid(62),status:'aprovado',evidence:'Aprovação fictícia para fluxo HTTP.'})).status).toBe(200);
  expect((await postCurrent({type:'transition_order',id:sid(43),status:'execucao'})).status).toBe(200);
  const taskId=id();const command={type:'create_service',service:{id:taskId,orderId:sid(43),quoteId:sid(62),mechanicId:sid(454),itemIndex:0,plannedAt:'2026-11-20T12:00:00-03:00',duration:30},commission:{mode:'fixo',value:5000}};
  expect((await postCurrent(command)).status).toBe(200);expect((await postCurrent(command)).status).toBe(200);
  expect((await postCurrent({type:'set_service_status',id:taskId,status:'em_execucao'})).status).toBe(200);
  expect((await postCurrent({type:'set_service_status',id:taskId,status:'concluido'})).status).toBe(200);
  let state=(await(await GET()).json()).state;const commission=state.commissions.find((c:{serviceId:string})=>c.serviceId===taskId);expect(commission).toMatchObject({status:'gerada',amountCents:5000});
  expect((await postCurrent({type:'record_commission_payment',id:id(),commissionId:commission.id,kind:'repasse',amountCents:2000,note:'Repasse fictício parcial.'})).status).toBe(200);
  expect((await postCurrent({type:'record_commission_payment',id:id(),commissionId:commission.id,kind:'estorno',amountCents:500,note:'Estorno fictício parcial.'})).status).toBe(200);
  expect((await postCurrent({type:'record_commission_payment',id:id(),commissionId:commission.id,kind:'repasse',amountCents:3501,note:'Repasse fictício excedente.'})).status).toBe(422);
  state=(await(await GET()).json()).state;expect(state.services.filter((t:{id:string})=>t.id===taskId)).toHaveLength(1);expect(state.commissionPayments.filter((p:{commissionId:string})=>p.commissionId===commission.id)).toHaveLength(2);
 });
 it('um segundo movimento com revisão antiga retorna conflito sem nova entrada',async()=>{
  const first=stockCommand();expect((await POST(req({revision:1,command:first}))).status).toBe(200);const second=stockCommand();expect((await POST(req({revision:1,command:second}))).status).toBe(409);const state=(await(await GET()).json()).state;expect(state.stockMovements.some((m:{id:string})=>m.id===second.id)).toBe(false);
 });
});

describe('privacidade das repetições por HTTP',()=>{
 it('retorna 403 para exceção de comissão mesmo com ID e valores já existentes',async()=>{await postCurrent({type:'set_quote_status',id:sid(62),status:'aprovado',evidence:'Aprovação fictícia para testar privacidade.'});const command={type:'create_service',service:{id:id(),orderId:sid(43),quoteId:sid(62),mechanicId:sid(454),itemIndex:0,plannedAt:'2026-11-20T12:00:00-03:00',duration:30},commission:{mode:'fixo',value:7654}};expect((await postCurrent(command)).status).toBe(200);await useRole('reception');expect((await postCurrent(command)).status).toBe(403);});
});

// Mesma fixture SQL/RLS, sem identidade ou provedor externo real.
describe('API fiscal e preparação operacional 1.2',()=>{
 it('preparo por HTTP persiste em homologação e transmissão real retorna503 sem falso sucesso',async()=>{const documentId=id();expect((await postCurrent({type:'prepare_fiscal_document',id:documentId,orderId:sid(42),model:'nfse'})).status).toBe(200);const snapshot=(await(await GET()).json()).state;const response=await fiscalPost(req({documentId,revision:snapshot.revision}),{params:Promise.resolve({action:'submit'})});expect(response.status).toBe(503);expect(await response.json()).toMatchObject({code:'FISCAL_PROVIDER_NOT_CONFIGURED'});const after=(await(await GET()).json()).state;expect(after.fiscalDocuments[0].status).toBe('rascunho');expect(after.revision).toBe(snapshot.revision);});
 it.each(['simulate_fiscal_result','reconcile_fiscal_demo','cancel_fiscal_demo'])('simulação %s é proibida no endpoint conectado',async type=>{const command=type==='cancel_fiscal_demo'?{type,id:id(),reason:'Motivo fictício.'}:{type,id:id(),outcome:'autorizada'};const r=await postCurrent(command);expect(r.status).toBe(403);expect((await r.json()).code).toBe('INTEGRATION_DISABLED');});
 it('recepção não opera emissão nem consulta preparação operacional',async()=>{await useRole('reception');const r=await fiscalPost(req({documentId:id(),revision:1}),{params:Promise.resolve({action:'submit'})});expect(r.status).toBe(403);expect((await readiness()).status).toBe(403);});
 it('documento não disponível não expõe se existe em outro workspace',async()=>{const r=await fiscalPost(req({documentId:id(),revision:1}),{params:Promise.resolve({action:'consult'})});expect(r.status).toBe(403);});
 it('preparação distingue estruturas do banco e homologação pendente, sem segredos',async()=>{const r=await readiness();expect(r.status).toBe(200);const data=await r.json();expect(data).toMatchObject({databaseVerified:true,productionApproved:false,fiscalIssuance:'disabled'});expect(JSON.stringify(data)).not.toContain('publishable_test_not_a_real_key');expect(JSON.stringify(data)).not.toContain(workspaceId);});
 it('origem externa é bloqueada antes de consultar documentos fiscais',async()=>{auth.mockClear();const r=await fiscalPost(req({documentId:id(),revision:1},'https://evil.example'),{params:Promise.resolve({action:'cancel'})});expect(r.status).toBe(403);expect(auth).not.toHaveBeenCalled();});
});
