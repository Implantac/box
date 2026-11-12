import { describe,it,expect,beforeEach } from 'vitest';
import { applyCommand,canSee,TRANSITIONS } from '@/lib/domain';
import { createSeed,sid } from '@/lib/seed';
import { latestQuote,quoteTotal,netPaid } from '@/lib/format';
import { id,type Command,type Role,type Workspace } from '@/lib/model';
let state:Workspace;
beforeEach(()=>{state=createSeed();});
const run=(c:Command,r:Role='owner',opts:Record<string,unknown>={})=>{state=applyCommand(state,c,r,{portfolio:true,...opts});return state;};
const quote=(orderId=sid(41),version=1)=>({id:id(),orderId,version,status:'rascunho' as const,items:[{description:'Avaliação fictícia',kind:'servico' as const,quantity:1,unitCents:10000}],discountCents:0,terms:'Condições fictícias sem validade comercial.',createdAt:new Date().toISOString()});
describe('perfis e revisões',()=>{
 it.each(['reception','technician','finance','marketing','customer'] as Role[])('bloqueia configurações para %s',role=>{expect(()=>run({type:'update_settings',settings:state.settings},role)).toThrow(/permissão/);});
 it('a demo não representa login e limita módulos por foco',()=>{expect(canSee('marketing','ordens')).toBe(false);expect(canSee('technician','financeiro')).toBe(false);expect(canSee('customer','inicio')).toBe(false);});
 it('rejeita revisão antiga sem alterar estado',()=>{expect(()=>run({type:'update_settings',settings:state.settings},'owner',{expectedRevision:0})).toThrow(/mudaram/);expect(state.revision).toBe(1);});
 it('não modifica o objeto de entrada',()=>{const original=createSeed();const next=applyCommand(original,{type:'update_settings',settings:{...original.settings,brandName:'Marca demonstrativa'}},'owner');expect(original.settings.brandName).not.toBe(next.settings.brandName);expect(next.revision).toBe(original.revision+1);});
});
describe('OS e autorização',()=>{
 it('separa queixa de diagnóstico',()=>{const before=state.orders[0].complaint;run({type:'transition_order',id:sid(41),status:'diagnostico',diagnosis:'Evidência técnica fictícia.'});expect(state.orders[0].complaint).toBe(before);expect(state.orders[0].diagnosis).toMatch(/Evidência/);});
 it('impede salto de etapa',()=>{expect(()=>run({type:'transition_order',id:sid(41),status:'entregue'})).toThrow(/etapa/);});
 it('bloqueia execução sem versão atual aprovada',()=>{expect(()=>run({type:'transition_order',id:sid(43),status:'execucao'})).toThrow(/aprovada/);});
 it('permite resposta do cliente vinculado, preserva evidência e libera execução',()=>{run({type:'set_quote_status',id:sid(62),status:'aprovado'},'customer',{customerId:sid(3)});expect(state.quotes.find(q=>q.id===sid(62))?.respondedAt).toBeTruthy();run({type:'transition_order',id:sid(43),status:'execucao'});expect(state.orders.find(o=>o.id===sid(43))?.status).toBe('execucao');});
 it('bloqueia resposta de outro cliente',()=>{expect(()=>run({type:'set_quote_status',id:sid(62),status:'aprovado'},'customer',{customerId:sid(1)})).toThrow(/pertence/);});
 it('recusa é preservada e impede nova resposta na mesma versão',()=>{run({type:'set_quote_status',id:sid(62),status:'recusado'},'customer',{customerId:sid(3)});expect(()=>run({type:'set_quote_status',id:sid(62),status:'aprovado'},'customer',{customerId:sid(3)})).toThrow(/Resposta/);});
 it('exige evidência para autorização registrada pela recepção',()=>{expect(()=>run({type:'set_quote_status',id:sid(62),status:'aprovado'},'reception')).toThrow(/Evidência/);});
 it('adicional cria nova versão e pausa execução até nova aprovação',()=>{const prior=structuredClone(state.quotes.find(q=>q.orderId===sid(42))!);run({type:'create_quote',quote:quote(sid(42),2)});expect(latestQuote(state.quotes,sid(42))?.status).toBe('rascunho');expect(state.quotes.find(q=>q.id===prior.id)).toEqual(prior);expect(state.orders.find(o=>o.id===sid(42))?.status).toBe('aguardando_aprovacao');expect(()=>run({type:'transition_order',id:sid(42),status:'execucao'})).toThrow(/aprovada/);});
 it('orçamento histórico não recebe resposta',()=>{run({type:'create_quote',quote:quote(sid(43),2)});expect(()=>run({type:'set_quote_status',id:sid(62),status:'aprovado',evidence:'Evidência fictícia suficiente.'})).toThrow(/substituída/);});
 it('pronto exige teste final',()=>{expect(()=>run({type:'transition_order',id:sid(46),status:'pronto',checklist:[]})).toThrow(/teste final/);});
 it('salva motivo de cancelamento e bloqueia reescrita',()=>{expect(()=>run({type:'transition_order',id:sid(41),status:'cancelada'})).toThrow(/Motivo/);run({type:'transition_order',id:sid(41),status:'cancelada',note:'Cancelamento fictício solicitado.'});expect(state.orders[0].cancellationReason).toMatch(/solicitado/);expect(()=>run({type:'transition_order',id:sid(41),status:'cancelada',diagnosis:'Apagar evidência'})).toThrow(/encerrada/);});
 it('técnico só altera ordem atribuída',()=>{expect(()=>run({type:'transition_order',id:sid(42),status:'testes'},'technician',{actorName:'Lucas • demo'})).toThrow(/atribuída/);});
 it('retorno é outra OS sem alterar original e não permite trocar veículo',()=>{const original=structuredClone(state.orders.find(o=>o.id===sid(48))!);run({type:'create_order',order:{...original,id:id(),number:'OS-2026-0050',returnOf:original.id,status:'recepcao'}});expect(state.orders.find(o=>o.id===original.id)).toEqual(original);expect(state.orders[0].returnOf).toBe(original.id);expect(()=>run({type:'create_order',order:{...state.orders[1],id:id(),number:'OS-2026-0051',returnOf:original.id}})).toThrow(/Retorno/);});
 it('atendimento entregue não aceita autorização nova',()=>{const q=state.quotes.find(q=>q.orderId===sid(48))!;q.status='enviado';expect(()=>run({type:'set_quote_status',id:q.id,status:'aprovado',evidence:'Evidência fictícia suficiente.'})).toThrow(/encerrado/);});
 it('não há transição de reabertura destrutiva',()=>{expect(TRANSITIONS.entregue).toEqual([]);expect(TRANSITIONS.cancelada).toEqual([]);});
});
describe('agenda',()=>{
 const ap=()=>({...createSeed().appointments[0],id:id(),startsAt:'2026-11-12T09:00:00-03:00'});
 it('bloqueia sobreposição do responsável',()=>{expect(()=>run({type:'create_appointment',appointment:ap()})).toThrow(/reservado/);});
 it('aceita intervalo adjacente',()=>{run({type:'create_appointment',appointment:{...ap(),startsAt:'2026-11-12T09:30:00-03:00'}});expect(state.appointments).toHaveLength(6);});
 it('pedido de horário não vira confirmação automaticamente',()=>{run({type:'create_appointment',appointment:{...ap(),status:'solicitado',startsAt:'2026-11-15T09:30:00-03:00'}});expect(state.appointments.at(-1)?.status).toBe('solicitado');});
 it('não reativa registro cancelado por bypass de conflito',()=>{run({type:'set_appointment_status',id:sid(81),status:'cancelado'});expect(()=>run({type:'set_appointment_status',id:sid(81),status:'confirmado'})).toThrow(/encerrado/);});
});
describe('financeiro',()=>{
 const payment=(amountCents=10000)=>({id:id(),orderId:sid(42),amountCents,method:'pix' as const,kind:'recebimento' as const,note:'Sinal fictício',createdAt:new Date().toISOString()});
 it('parcial reduz saldo sem alterar orçamento',()=>{const p=payment();const total=quoteTotal(latestQuote(state.quotes,p.orderId)!);run({type:'record_payment',payment:p},'finance');expect(netPaid(state.payments,p.orderId)).toBe(60000);expect(quoteTotal(latestQuote(state.quotes,p.orderId)!)).toBe(total);});
 it('não duplica ID de recebimento',()=>{const p=payment();run({type:'record_payment',payment:p});const rev=state.revision;run({type:'record_payment',payment:p});expect(state.revision).toBe(rev);expect(state.payments.filter(x=>x.id===p.id)).toHaveLength(1);});
 it('não reutiliza ID com outro valor',()=>{const p=payment();run({type:'record_payment',payment:p});expect(()=>run({type:'record_payment',payment:{...p,amountCents:20000}})).toThrow(/Identificador/);});
 it('não recebe acima do saldo',()=>{expect(()=>run({type:'record_payment',payment:payment(999999)})).toThrow(/saldo/);});
 it('estorno mantém lançamento e exige motivo e limite',()=>{const p=payment();expect(()=>run({type:'record_payment',payment:{...p,kind:'estorno',note:''}})).toThrow(/Motivo/);expect(()=>run({type:'record_payment',payment:{...p,kind:'estorno',amountCents:60000,note:'Motivo fictício'}})).toThrow(/maior/);run({type:'record_payment',payment:{...p,kind:'estorno',note:'Cancelamento fictício'}});expect(state.payments).toHaveLength(3);expect(netPaid(state.payments,p.orderId)).toBe(40000);});
 it('não duplica custo',()=>{const c={...state.costs[0],id:id()};run({type:'record_cost',cost:c});run({type:'record_cost',cost:c});expect(state.costs.filter(x=>x.id===c.id)).toHaveLength(1);});
});
describe('conteúdo demonstrativo',()=>{
 it('alteração invalida aprovação',()=>{const p=state.posts[0];run({type:'save_post',post:{...p,caption:p.caption+' Novo texto.'}},'marketing');expect(state.posts[0].status).toBe('rascunho');expect(state.posts[0].approvedRevision).toBeUndefined();expect(()=>run({type:'simulate_post',id:p.id})).toThrow(/aprovada/);});
 it('aprovação exige direitos e é exclusiva do proprietário',()=>{expect(()=>run({type:'approve_post',id:sid(142)})).toThrow(/direitos/);expect(()=>run({type:'approve_post',id:sid(141)},'marketing')).toThrow(/permissão/);});
 it('imagem não é vídeo Shorts',()=>{expect(()=>run({type:'save_post',post:{...state.posts[0],mediaKind:'imagem'}})).toThrow(/Shorts/);});
 it('falha parcial é por rede e reenvio não duplica sucesso',()=>{run({type:'simulate_post',id:sid(141),failChannel:'facebook'});const first=structuredClone(state.posts[0].deliveries[0]);expect(state.posts[0].status).toBe('parcial_demo');run({type:'simulate_post',id:sid(141)});expect(state.posts[0].status).toBe('simulado');expect(state.posts[0].deliveries[0]).toEqual(first);expect(state.posts[0].deliveries).toHaveLength(3);});
 it('não simula sucesso em modo conectado',()=>{expect(()=>applyCommand(state,{type:'simulate_post',id:sid(141)},'owner',{portfolio:false})).toThrow(/indisponível/);});
 it('agenda e cancela sem envio externo',()=>{run({type:'simulate_post',id:sid(141),scheduleAt:new Date(Date.now()+3600000).toISOString()});expect(state.posts[0].status).toBe('agendado_demo');run({type:'cancel_post_schedule',id:sid(141)});expect(state.posts[0].status).toBe('aprovado');});
});
