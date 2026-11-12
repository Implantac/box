import type { Workspace, WorkOrder, Quote } from './model';
import { emptyWorkshop, type WorkshopData, type ServiceTask, type CommissionPolicy } from './workshop-model';
import { quoteNetItems, serviceKey, commissionAmount } from './workshop';
const sid=(n:number)=>`d0000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function workshopCatalog():WorkshopData{
 const createdAt='2026-11-12T11:00:00Z';
 const data=emptyWorkshop();
 const names=['Kit de filtro • demonstração','Fluido ilustrativo • frasco de 1 L','Kit de vedação • demonstração','Elemento filtrante • demonstração','Conjunto de fixação • demonstração','Insumo de limpeza • demonstração'];
 const stocks=[8,12,2,0,6,4],costs=[9500,4500,3200,6500,1800,2200],minimums=[3,5,3,2,3,1];
 data.parts=names.map((name,i)=>({id:sid(401+i),sku:`BOX-DEMO-${String(i+1).padStart(3,'0')}`,name,unit:i===0||i===2?'kit' as const:i===1||i===5?'frasco' as const:'un' as const,location:`A${i<3?'1':'2'} · ${i+1}`,minimum:minimums[i],referenceCostCents:costs[i],createdAt}));
 data.stockMovements=data.parts.filter((_,i)=>stocks[i]>0).map(p=>{const i=data.parts.indexOf(p);return {id:sid(421+i),partId:p.id,kind:'entrada' as const,quantity:stocks[i],unitCostCents:p.referenceCostCents,reason:'Saldo de abertura fictício do portfólio.',createdAt:'2026-11-09T11:00:00Z'};});
 data.mechanics=['Lucas • demo','Marina • demo','Rafael • demo','Camila • demo'].map((name,i)=>({id:sid(451+i),name,active:true,note:'Perfil fictício. Não representa integrante real da Box.',createdAt}));
 data.commissionRules=data.mechanics.map((m,i)=>({id:sid(461+i),mechanicId:m.id,mode:i===3?'sem' as const:i===2?'fixo' as const:'percentual' as const,value:[1000,1250,6000,0][i],createdAt}));
 return data;
}
export function createWorkshopSeed(orders:WorkOrder[],quotes:Quote[]):WorkshopData{
 const d=workshopCatalog();
 const configs=[{order:42,mechanic:1,plannedAt:'2026-11-12T11:30:00-03:00',duration:120,status:'em_execucao' as const},{order:45,mechanic:0,plannedAt:'2026-11-12T09:30:00-03:00',duration:60,status:'concluido' as const},{order:46,mechanic:2,plannedAt:'2026-11-12T09:00:00-03:00',duration:60,status:'concluido' as const},{order:48,mechanic:1,plannedAt:'2026-11-10T13:00:00-03:00',duration:90,status:'concluido' as const}];
 for(const [i,c]of configs.entries()){
  const o=orders.find(o=>o.id===sid(c.order));const q=quotes.find(q=>q.orderId===o?.id);if(!o||!q)continue;
  const t:ServiceTask={id:sid(481+i),orderId:o.id,mechanicId:d.mechanics[c.mechanic].id,quoteId:q.id,itemIndex:0,serviceKey:serviceKey(o.id,0,q),description:q.items[0].description,plannedAt:c.plannedAt,duration:c.duration,status:c.status,startedAt:c.plannedAt,createdAt:c.plannedAt,history:[{status:'planejado',at:c.plannedAt,note:'Alocação fictícia de demonstração.'},{status:'em_execucao',at:c.plannedAt,note:'Início fictício.'}],...(c.status==='concluido'?{completedAt:new Date(Date.parse(c.plannedAt)+c.duration*60000).toISOString()}: {})};
  if(t.completedAt)t.history.push({status:'concluido',at:t.completedAt,note:'Conclusão fictícia, sem serviço real.'});d.services.push(t);
  const rule:CommissionPolicy=d.commissionRules[c.mechanic];const baseCents=quoteNetItems(q)[0];d.commissions.push({description:t.description,id:sid(491+i),serviceId:t.id,orderId:o.id,mechanicId:t.mechanicId,quoteId:q.id,baseCents,mode:rule.mode,value:rule.value,amountCents:commissionAmount(baseCents,rule),status:c.status==='concluido'?'gerada':'prevista',createdAt:c.plannedAt,...(t.completedAt?{earnedAt:t.completedAt}:{})});
 }
 d.absences.push({id:sid(471),mechanicId:d.mechanics[2].id,startsAt:'2026-11-12T12:00:00-03:00',endsAt:'2026-11-12T14:00:00-03:00',reason:'Indisponibilidade fictícia para explorar o controle de equipe.',status:'ativa',createdAt:'2026-11-12T11:00:00Z'});
 const golf=quotes.find(q=>q.orderId===sid(42));if(golf)d.stockMovements.push({id:sid(441),partId:d.parts[0].id,kind:'reserva',quantity:1,unitCostCents:0,reason:'Reserva fictícia do item autorizado no Golf.',orderId:sid(42),quoteId:golf.id,createdAt:'2026-11-12T11:00:00Z'});
 const finished=quotes.find(q=>q.orderId===sid(48));if(finished){d.stockMovements.push({id:sid(442),partId:d.parts[1].id,kind:'reserva',quantity:1,unitCostCents:0,reason:'Reserva histórica fictícia.',orderId:sid(48),quoteId:finished.id,createdAt:'2026-11-10T13:00:00Z'});d.stockMovements.push({id:sid(443),partId:d.parts[1].id,kind:'consumo',quantity:1,unitCostCents:d.parts[1].referenceCostCents,reason:'Baixa fictícia vinculada ao atendimento histórico.',orderId:sid(48),quoteId:finished.id,referenceId:sid(442),createdAt:'2026-11-10T13:10:00Z'});}
 d.commissionPayments.push({id:sid(501),commissionId:sid(494),kind:'repasse',amountCents:5000,note:'Repasse parcial fictício, sem transferência financeira.',createdAt:'2026-11-11T14:00:00Z'});
 return d;
}
/** Migração da sessão antiga sem serviços, reservas ou comissões retroativos inventados. */
export function upgradeWorkshop(state:Workspace):Workspace{
 const fields=Object.keys(emptyWorkshop()) as (keyof WorkshopData)[];
 if(fields.every(k=>Array.isArray(state[k])))return state;
 const base=workshopCatalog();
 const names=[...new Set([...state.orders.map(o=>o.technician),...state.appointments.map(a=>a.technician)])];
 for(const name of names)if(name&&!base.mechanics.some(m=>m.name===name))base.mechanics.push({id:crypto.randomUUID(),name,active:true,note:'Cadastro preservado da sessão anterior de portfólio.',createdAt:'2026-11-12T11:00:00Z'});
 const patch=Object.fromEntries(fields.map(k=>[k,Array.isArray(state[k])?state[k]:base[k]])) as unknown as WorkshopData;
 return {...state,...patch};
}
