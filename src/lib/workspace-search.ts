import type { Role, Workspace } from './model';
import { canSee } from './domain';

export interface WorkspaceSearchResult {
 id: string;
 kind: 'order' | 'part' | 'mechanic' | 'service' | 'commission' | 'fiscal';
 label: string;
 detail: string;
 href: string;
}
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');

/** Busca somente no workspace já autorizado. A filtragem da UI não substitui RLS. */
export function searchWorkspace(
 state: Workspace,
 role: Role,
 query: string,
 actor: { portfolio: boolean; name?: string; userId?: string } = { portfolio: true }
): WorkspaceSearchResult[] {
 const term = normalized(query.trim());
 if (term.length < 2) return [];
 const words = term.split(/\s+/);
 const matches = (...values: (string | undefined)[]) => {
  const text = normalized(values.filter(Boolean).join(' '));
  return words.every(word => text.includes(word));
 };
 const own = state.mechanics.find(m => actor.portfolio ? m.name === 'Lucas • demo' : Boolean(actor.userId && m.userId === actor.userId));
 const ownService = (mechanicId: string) => role !== 'technician' || mechanicId === own?.id;
 const groups: WorkspaceSearchResult[][] = [];
 if (canSee(role, 'ordens')) groups.push(state.orders.filter(o =>
  (role !== 'technician' || o.technician === (actor.portfolio ? 'Lucas • demo' : actor.name) || state.services.some(t => t.orderId === o.id && ownService(t.mechanicId))) &&
  matches(o.number, o.vehicleLabel, o.customerName)
 ).slice(0, 3).map(o => ({ id: o.id, kind: 'order', label: o.number, detail: o.vehicleLabel, href: `/painel/ordens/${o.id}` })));
 if (canSee(role, 'estoque')) groups.push(state.parts.filter(p => matches(p.sku, p.name, p.location)).slice(0, 3).map(p => ({
  id: p.id, kind: 'part', label: `Peça · ${p.sku}`, detail: p.name, href: `/painel/estoque?registro=${p.id}`
 })));
 if (canSee(role, 'mecanicos')) {
  groups.push(state.mechanics.filter(m => ownService(m.id) && matches(m.name)).slice(0, 3).map(m => ({
   id: m.id, kind: 'mechanic', label: 'Mecânico', detail: m.name, href: `/painel/mecanicos?mecanico=${m.id}`
  })));
  groups.push(state.services.filter(t => {
   const order = state.orders.find(o => o.id === t.orderId);
   return ownService(t.mechanicId) && matches(t.description, order?.number, order?.vehicleLabel, state.mechanics.find(m => m.id === t.mechanicId)?.name);
  }).slice(0, 3).map(t => ({
   id: t.id, kind: 'service', label: `Serviço · ${state.orders.find(o => o.id === t.orderId)?.number || 'OS'}`, detail: t.description, href: `/painel/mecanicos?servico=${t.id}`
  })));
 }
 if (canSee(role, 'comissoes')) groups.push(state.commissions.filter(c => matches('comissão', c.description, state.mechanics.find(m => m.id === c.mechanicId)?.name, state.orders.find(o => o.id === c.orderId)?.number)).slice(0, 3).map(c => ({
  id: c.id, kind: 'commission', label: `Comissão · ${c.status}`, detail: c.description, href: `/painel/comissoes?registro=${c.id}`
 })));
 if (canSee(role,'fiscal')) groups.push(state.fiscalDocuments.filter(d=>matches(d.orderNumber,d.recipient.legalName,d.id,'nota fiscal',d.model==='nfe'?'NF-e':'NFS-e')).slice(0,3).map(d=>({id:d.id,kind:'fiscal',label:`${d.model==='nfe'?'NF-e':'NFS-e'} · ${d.orderNumber}`,detail:'Documento '+d.environment+' · sem envio automático',href:`/painel/fiscal?documento=${d.id}`})));
 // Intercala categorias para que uma lista extensa de OS não oculte os novos módulos.
 const results: WorkspaceSearchResult[] = [];
 for (let index = 0; index < 3; index++) for (const group of groups) if (group[index] && results.length < 8) results.push(group[index]);
 return results;
}
