import { type Command, type Role, type Workspace, type OrderStatus, ROLE_LABELS, id } from './model';
import { latestQuote, netPaid, quoteTotal } from './format';

export const MODULE_ROLES: Record<string, Role[]> = {
 inicio: ['owner', 'reception', 'technician', 'finance', 'marketing'],
 ordens: ['owner', 'reception', 'technician'], clientes: ['owner', 'reception'], agenda: ['owner', 'reception', 'technician'],
 atendimentos: ['owner', 'reception'], orcamentos: ['owner', 'reception', 'finance'], financeiro: ['owner', 'finance'],
 conteudo: ['owner', 'marketing'], relatorios: ['owner', 'finance'], configuracoes: ['owner']
};
export const canSee = (role: Role, module: string) => (MODULE_ROLES[module] || []).includes(role);
export const canMoney = (role: Role) => role === 'owner' || role === 'finance';
const ALLOWED: Record<Command['type'], Role[]> = {
 create_customer: ['owner', 'reception'], create_order: ['owner', 'reception'], transition_order: ['owner', 'reception', 'technician'],
 create_quote: ['owner', 'reception'], set_quote_status: ['owner', 'reception', 'customer'], create_appointment: ['owner', 'reception'], set_appointment_status: ['owner', 'reception'],
 record_payment: ['owner', 'finance'], record_cost: ['owner', 'finance'], create_lead: ['owner', 'reception'], set_lead_status: ['owner', 'reception'],
 save_post: ['owner', 'marketing'], approve_post: ['owner'], simulate_post: ['owner', 'marketing'], cancel_post_schedule: ['owner', 'marketing'], update_settings: ['owner']
};
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
 recepcao: ['diagnostico', 'cancelada'], diagnostico: ['aguardando_aprovacao', 'cancelada'], aguardando_aprovacao: ['execucao', 'aguardando_pecas', 'diagnostico', 'cancelada'],
 aguardando_pecas: ['execucao', 'diagnostico', 'cancelada'], execucao: ['testes', 'aguardando_pecas', 'diagnostico', 'cancelada'], testes: ['pronto', 'execucao'], pronto: ['entregue', 'testes'], entregue: [], cancelada: []
};
function ensure(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function integer(value: number, name: string, min = 0, max = 100000000) { ensure(Number.isSafeInteger(value) && value >= min && value <= max, `${name}: valor inválido.`); }
function text(value: string, name: string, min = 1, max = 3000) { ensure(typeof value === 'string' && value.trim().length >= min && value.length <= max, `${name}: confira o preenchimento.`); }
export function applyCommand(input: Workspace, command: Command, role: Role, options: { portfolio: boolean; customerId?: string; expectedRevision?: number; actorName?: string } = { portfolio: true }): Workspace {
 ensure(ALLOWED[command.type]?.includes(role), 'Este perfil não tem permissão para essa ação.');
 if (options.expectedRevision !== undefined) ensure(input.revision === options.expectedRevision, 'Os dados mudaram. Atualize antes de tentar novamente.');
 const s = structuredClone(input); const c = command; const now = new Date().toISOString(); let entityId = ''; let action = c.type.replaceAll('_', ' ');
 switch (c.type) {
  case 'create_customer': {
   text(c.customer.name, 'Nome', 3, 120); ensure(!s.customers.some(x => x.id === c.customer.id), 'Cadastro já existe.');
   if (c.customer.email) ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.customer.email), 'E-mail inválido.');
   if (options.portfolio) ensure(!c.customer.email || c.customer.email.endsWith('@example.com'), 'Na demonstração, use somente e-mail @example.com.');
   s.customers.unshift(c.customer); entityId = c.customer.id;
   if (c.vehicle) { ensure(c.vehicle.customerId === c.customer.id, 'Vínculo de veículo inválido.'); integer(c.vehicle.year, 'Ano', 1900, 2100); integer(c.vehicle.km, 'Quilometragem', 0, 3000000); text(c.vehicle.model, 'Modelo', 2, 120); s.vehicles.unshift(c.vehicle); }
   action = 'Cliente e veículo cadastrados'; break;
  }
  case 'create_order': {
   ensure(s.customers.some(x => x.id === c.order.customerId), 'Selecione um cliente válido.');
   const vehicle = s.vehicles.find(x => x.id === c.order.vehicleId && x.customerId === c.order.customerId); ensure(vehicle, 'Veículo não pertence ao cliente.');
   text(c.order.complaint, 'Queixa', 5); ensure(/^\d{4}-\d{2}-\d{2}$/.test(c.order.dueDate), 'Previsão inválida.');
   ensure(!s.orders.some(o => o.id === c.order.id || o.number === c.order.number), 'Número de OS já utilizado.');
   const customer = s.customers.find(x => x.id === c.order.customerId)!;
   if (c.order.returnOf) ensure(s.orders.some(x => x.id === c.order.returnOf && x.customerId === c.order.customerId && x.vehicleId === c.order.vehicleId && ['entregue','cancelada'].includes(x.status)), 'Retorno precisa se vincular a uma OS encerrada.');
   s.orders.unshift({ ...c.order, status: 'recepcao', customerName: customer.name, vehicleLabel: `${vehicle.model} ${vehicle.year}`, checklist: [], createdAt: now });
   entityId = c.order.id; action = c.order.returnOf ? 'OS de retorno aberta sem alterar a original' : 'Ordem de serviço aberta'; break;
  }
  case 'transition_order': {
   const o = s.orders.find(o => o.id === c.id); ensure(o, 'OS não encontrada.');
   ensure(!['entregue','cancelada'].includes(o.status), 'OS encerrada é preservada. Abra um retorno.');
   if (role === 'technician') ensure(o.technician === (options.actorName || 'Lucas • demo'), 'Técnico só pode alterar uma OS atribuída a ele.');
   if (c.status !== o.status) {
    ensure(TRANSITIONS[o.status].includes(c.status), 'Essa mudança de etapa não é permitida.');
    if (['execucao', 'aguardando_pecas'].includes(c.status)) ensure(latestQuote(s.quotes, o.id)?.status === 'aprovado', 'A versão atual do orçamento precisa estar aprovada antes da execução.');
    if (c.status === 'cancelada') text(c.note || '', 'Motivo do cancelamento', 5, 500);
    if (c.status === 'pronto') ensure((c.checklist || o.checklist).includes('Teste final realizado'), 'Registre o teste final no checklist antes de liberar para entrega.');
   }
   o.status = c.status; if (c.status === 'cancelada') o.cancellationReason = c.note; if (c.diagnosis !== undefined) { text(c.diagnosis, 'Diagnóstico', 0, 3000); o.diagnosis = c.diagnosis; }
   if (c.checklist) { ensure(c.checklist.length <= 10 && c.checklist.every(x => x.length < 120), 'Checklist inválido.'); o.checklist = c.checklist; }
   entityId = o.id; action = `OS atualizada: ${c.status}${c.note ? ' • motivo registrado' : ''}`; break;
  }
  case 'create_quote': {
   const o = s.orders.find(o => o.id === c.quote.orderId); ensure(o && !['entregue','cancelada'].includes(o.status), 'Selecione uma OS aberta.');
   ensure(!s.quotes.some(q=>q.id===c.quote.id), 'Orçamento já existe.');
   ensure(c.quote.items.length > 0 && c.quote.items.length <= 30, 'Adicione de 1 a 30 itens.');
   c.quote.items.forEach(item => { text(item.description, 'Item', 3, 200); integer(item.quantity, 'Quantidade', 1, 999); integer(item.unitCents, 'Preço'); });
   integer(c.quote.discountCents, 'Desconto'); ensure(quoteTotal(c.quote) > 0, 'Total deve ser maior que zero.');
   const last = latestQuote(s.quotes, o.id); ensure(c.quote.version === (last?.version || 0) + 1, 'Versão desatualizada. Reabra o orçamento.');
   s.quotes.unshift({ ...c.quote, status: 'rascunho', createdAt: now, respondedAt: undefined, evidence: undefined });
   o.currentQuoteId=c.quote.id;o.currentQuoteVersion=c.quote.version;
   if (['aguardando_pecas','execucao','testes','pronto'].includes(o.status)) o.status = 'aguardando_aprovacao';
   entityId = c.quote.id; action = `Orçamento v${c.quote.version} preservado`; break;
  }
  case 'set_quote_status': {
   const q = s.quotes.find(q => q.id === c.id); ensure(q, 'Orçamento não encontrado.');
   ensure(!['entregue','cancelada'].includes(s.orders.find(o=>o.id===q.orderId)?.status || ''), 'Atendimento encerrado não recebe nova autorização.');
   ensure(latestQuote(s.quotes, q.orderId)?.id === q.id, 'Esta versão foi substituída. Use a versão mais recente.');
   ensure(q.status !== 'aprovado' && q.status !== 'recusado', 'Resposta já registrada. Para alterar itens, crie uma nova versão.');
   if (role === 'customer') {
    const o = s.orders.find(o => o.id === q.orderId); ensure(o?.customerId === options.customerId, 'Orçamento não pertence ao cliente autenticado.');
    ensure(q.status === 'enviado' && ['aprovado','recusado'].includes(c.status), 'Orçamento ainda não está disponível para resposta.');
   } else if (['aprovado','recusado'].includes(c.status)) text(c.evidence || '', 'Evidência da autorização ou recusa', 10, 1000);
   ensure(['enviado','aprovado','recusado'].includes(c.status), 'Estado de orçamento inválido.');
   q.status = c.status;
   if (c.status !== 'enviado') { q.respondedAt = now; q.evidence = role === 'customer' ? options.portfolio ? 'Resposta fictícia registrada no portal demonstrativo à versão exibida.' : 'Resposta registrada pelo cliente autenticado à versão exibida.' : c.evidence; }
   entityId = q.id; action = `Orçamento v${q.version}: ${c.status}`; break;
  }
  case 'create_appointment': {
   const a = c.appointment; const customer = s.customers.find(x => x.id === a.customerId); ensure(customer, 'Cliente inválido.');
   ensure(Number.isFinite(Date.parse(a.startsAt)), 'Data ou horário inválido.'); integer(a.duration, 'Duração', 15, 480); text(a.service, 'Serviço', 3, 200);
   ensure(!s.appointments.some(x => x.status !== 'cancelado' && x.technician === a.technician && Date.parse(x.startsAt) < Date.parse(a.startsAt) + a.duration*60000 && Date.parse(x.startsAt) + x.duration*60000 > Date.parse(a.startsAt)), 'Esse responsável já tem um horário reservado nesse intervalo.');
   ensure(!s.appointments.some(x=>x.id===a.id), 'Agendamento já existe.');
   s.appointments.push({ ...a, customerName: customer.name }); entityId = a.id; action = 'Horário reservado na agenda'; break;
  }
  case 'set_appointment_status': { const a = s.appointments.find(x => x.id === c.id); ensure(a, 'Agendamento não encontrado.'); ensure(!['cancelado','concluido','faltou'].includes(a.status), 'Registro encerrado. Crie nova reserva com verificação de conflito.'); a.status = c.status; entityId = a.id; action = `Agendamento: ${c.status}`; break; }
  case 'record_payment': {
   const p = c.payment; ensure(s.orders.some(x => x.id === p.orderId), 'OS inválida.'); integer(p.amountCents, 'Valor', 1); ensure(['pix','cartao','dinheiro'].includes(p.method), 'Forma de pagamento inválida.');
   const existing=s.payments.find(x=>x.id===p.id); if(existing){ensure(existing.orderId===p.orderId&&existing.amountCents===p.amountCents&&existing.kind===p.kind&&existing.method===p.method&&existing.note===p.note, 'Identificador já usado em outro lançamento.');return input;}
   ensure(['recebimento','estorno'].includes(p.kind), 'Tipo de lançamento inválido.');
   const paid = netPaid(s.payments, p.orderId); const quote = latestQuote(s.quotes, p.orderId);
   if (p.kind === 'estorno') { text(p.note, 'Motivo do estorno', 5, 500); ensure(p.amountCents <= paid, 'Estorno maior que o valor recebido.'); }
   else { ensure(quote?.status === 'aprovado', 'Recebimento exige orçamento atual aprovado.'); ensure(p.amountCents <= quoteTotal(quote) - paid, 'O valor ultrapassa o saldo do atendimento.'); }
   s.payments.unshift({ ...p, createdAt: now }); entityId = p.id; action = p.kind === 'estorno' ? 'Estorno registrado sem apagar o recebimento' : 'Recebimento registrado'; break;
  }
  case 'record_cost': { const existing=s.costs.find(x=>x.id===c.cost.id);if(existing){ensure(existing.orderId===c.cost.orderId&&existing.amountCents===c.cost.amountCents&&existing.description===c.cost.description, 'Identificador já usado em outro lançamento.');return input;}ensure(s.orders.some(x => x.id === c.cost.orderId), 'OS inválida.'); integer(c.cost.amountCents, 'Custo', 1); text(c.cost.description, 'Descrição', 3, 200); s.costs.push({ ...c.cost, createdAt: now }); entityId = c.cost.id; action = 'Custo registrado'; break; }
  case 'create_lead': { text(c.lead.name, 'Nome', 3, 120); text(c.lead.note, 'Descrição', 5, 1000); s.leads.unshift({ ...c.lead, status: 'novo', createdAt: now }); entityId = c.lead.id; action = 'Contato adicionado à fila demonstrativa'; break; }
  case 'set_lead_status': { const l = s.leads.find(x => x.id === c.id); ensure(l, 'Contato não encontrado.'); l.status = c.status; if (c.nextAction !== undefined) l.nextAction = c.nextAction.slice(0, 250); entityId = l.id; action = `Contato: ${c.status}`; break; }
  case 'save_post': {
   text(c.post.title, 'Título', 3, 120); text(c.post.caption, 'Legenda', 10, 2200); ensure(c.post.channels.length > 0, 'Escolha pelo menos uma rede.');
   for(const [channel,variant]of Object.entries(c.post.variants||{})){ensure(['instagram','facebook','youtube'].includes(channel),'Destino de variante inválido.');text(variant||'','Legenda específica',0,2200);}
   ensure(!(c.post.mediaKind === 'imagem' && c.post.channels.includes('youtube')), 'YouTube Shorts exige vídeo, não imagem estática.');
   const existing = s.posts.find(p => p.id === c.post.id);
   const post = { ...c.post, revision: existing ? existing.revision + 1 : 1, approvedRevision: undefined, status: 'rascunho' as const, deliveries: [], scheduledAt: undefined };
   if (existing) s.posts[s.posts.indexOf(existing)] = post; else s.posts.unshift(post);
   entityId = post.id; action = 'Conteúdo salvo; revisão necessária'; break;
  }
  case 'approve_post': { const p = s.posts.find(p => p.id === c.id); ensure(p, 'Conteúdo não encontrado.'); ensure(p.rightsConfirmed, 'Confirme os direitos e a revisão de dados antes de aprovar.'); p.approvedRevision = p.revision; p.status = 'aprovado'; entityId = p.id; action = `Conteúdo v${p.revision} aprovado`; break; }
  case 'simulate_post': {
   ensure(options.portfolio, 'Simulação indisponível em ambiente conectado.'); const p = s.posts.find(p => p.id === c.id); ensure(p, 'Conteúdo não encontrado.');
   ensure(p.approvedRevision === p.revision && p.rightsConfirmed, 'A versão atual do conteúdo precisa estar aprovada.');
   if (c.scheduleAt) { ensure(Date.parse(c.scheduleAt) > Date.now(), 'Escolha um horário futuro.'); p.scheduledAt = c.scheduleAt; p.status = 'agendado_demo'; action = 'Agendamento demonstrativo registrado; não há envio real'; }
   else {
    p.deliveries = p.channels.map(channel => { const old = p.deliveries.find(d => d.channel === channel && d.status === 'simulado'); return old || { channel, status: channel === c.failChannel ? 'falha_simulada' as const : 'simulado' as const, message: channel === c.failChannel ? 'Falha provocada para demonstrar a recuperação. Nenhuma rede foi acessada.' : 'Simulação concluída. Nenhuma publicação foi enviada.', at: now }; });
    p.status = p.deliveries.some(d => d.status === 'falha_simulada') ? 'parcial_demo' : 'simulado'; action = 'Envio por rede simulado (sem publicação externa)';
   }
   entityId = p.id; break;
  }
  case 'cancel_post_schedule': { const p = s.posts.find(x => x.id === c.id); ensure(p?.status === 'agendado_demo', 'Não há agendamento demonstrativo para cancelar.'); p.status = 'aprovado'; p.scheduledAt = undefined; entityId = p.id; action = 'Agendamento demonstrativo cancelado'; break; }
  case 'update_settings': { text(c.settings.heroTitle, 'Título', 10, 120); text(c.settings.heroSubtitle, 'Descrição', 10, 350); text(c.settings.brandName, 'Marca', 3, 80); s.settings = { ...c.settings, location: c.settings.location.slice(0, 80) }; entityId = 'settings'; action = 'Conteúdo institucional atualizado'; break; }
 }
 s.revision += 1; s.audit.unshift({ id: id(), action, actor: `${options.actorName || ROLE_LABELS[role]}${options.portfolio ? ' • demonstração' : ''}`, entityId, at: now }); s.audit = s.audit.slice(0, 250);
 return s;
}
