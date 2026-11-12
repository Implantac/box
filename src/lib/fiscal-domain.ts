import type { Role, Workspace } from './model';
import { type FiscalCommand, type FiscalDocument } from './fiscal-model';
import { fiscalCommandSchemas } from './fiscal-validation';
import { buildFiscalDocument, fiscalSourceCurrent, validTaxId } from './fiscal';
export const FISCAL_PERMISSIONS:Record<FiscalCommand['type'],Role[]>={save_fiscal_issuer:['owner'],save_fiscal_recipient:['owner','finance'],prepare_fiscal_document:['owner','finance'],classify_fiscal_document:['owner','finance'],discard_fiscal_document:['owner','finance'],simulate_fiscal_result:['owner','finance'],reconcile_fiscal_demo:['owner','finance'],cancel_fiscal_demo:['owner','finance']};
export function isFiscalCommand(c:{type:string}):c is FiscalCommand{return Object.hasOwn(FISCAL_PERMISSIONS,c.type);}
const ensure=(condition:unknown,message:string)=>{if(!condition)throw new Error(message);};
export function mutateFiscal(s:Workspace,c:FiscalCommand,options:{portfolio:boolean;now:string}):{entityId:string;action:string;duplicate?:boolean}{
 const schema=fiscalCommandSchemas.find(schema=>schema.shape.type.value===c.type);ensure(schema?.safeParse(c).success,'Confira os dados, formatos e limites do cadastro fiscal.');
 if(c.type==='save_fiscal_issuer'||c.type==='save_fiscal_recipient'){
  const p=c.type==='save_fiscal_issuer'?c.issuer:c.recipient.party;
  ensure(!p.taxId||validTaxId(p.taxId),'CPF/CNPJ com dígitos verificadores inválidos.');
  ensure(c.type!=='save_fiscal_issuer'||!p.taxId||p.taxId.length===14,'O emitente precisa de CNPJ.');
  if(options.portfolio){ensure(!p.taxId,'Não informe CPF/CNPJ no portfólio. Deixe o documento vazio.');ensure(!p.email||p.email.endsWith('@example.com'),'Use somente e-mail @example.com na demonstração.');}
  if(c.type==='save_fiscal_issuer'){s.fiscalIssuer=structuredClone(c.issuer);return {entityId:'fiscal-issuer',action:'Cadastro do emitente atualizado; snapshots anteriores preservados'};}
  ensure(s.customers.some(x=>x.id===c.recipient.customerId)||s.orders.some(o=>o.customerId===c.recipient.customerId),'Cliente não disponível neste workspace.');
  const current=s.fiscalRecipients.find(r=>r.customerId===c.recipient.customerId);ensure(!current||current.id===c.recipient.id,'O cadastro fiscal desse cliente já existe.');
  ensure(!s.fiscalRecipients.some(r=>r.id===c.recipient.id&&r.customerId!==c.recipient.customerId),'Identificador já utilizado por outro cadastro fiscal.');
  s.fiscalRecipients=s.fiscalRecipients.filter(r=>r.id!==c.recipient.id);s.fiscalRecipients.unshift(structuredClone(c.recipient));return {entityId:c.recipient.id,action:'Cadastro fiscal do destinatário atualizado; snapshots preservados'};
 }
 if(c.type==='prepare_fiscal_document'){
  const existing=s.fiscalDocuments.find(d=>d.id===c.id);if(existing){ensure(existing.orderId===c.orderId&&existing.model===c.model,'Identificador fiscal já usado por outro pedido.');return {entityId:existing.id,action:'',duplicate:true};}
  s.fiscalDocuments.unshift(buildFiscalDocument(s,c.id,c.orderId,c.model,options.portfolio?'demonstracao':'homologacao',options.now));return {entityId:c.id,action:'Rascunho fiscal preparado; não transmitido'};
 }
 const d=s.fiscalDocuments.find(d=>d.id===c.id);ensure(d,'Documento não encontrado.');const document=d as FiscalDocument;
 const event=(action:string,message:string)=>{document.updatedAt=options.now;document.events.push({id:crypto.randomUUID(),at:options.now,action,message});};
 ensure(document.events.length<100,'Limite de eventos do demonstrativo atingido. Preserve este histórico.');
 if(c.type==='classify_fiscal_document'){
  ensure(['rascunho','rejeitada'].includes(document.status),'Somente um rascunho ou rejeição pode receber classificação.');
  ensure(c.classifications.length===document.items.length&&document.items.every(i=>c.classifications.some(x=>x.sourceIndex===i.sourceIndex)),'Classifique exatamente os itens deste documento.');
  for(const item of document.items){const classification=c.classifications.find(x=>x.sourceIndex===item.sourceIndex)!;ensure(document.model==='nfe'?!classification.serviceCode&&!classification.municipalServiceCode&&!classification.taxationCode:!classification.ncm&&!classification.cfop&&!classification.cstOrCsosn&&!classification.origin,'Classificação de outro modelo fiscal não é permitida.');item.classification=structuredClone(classification);}
  event('classificado','Classificações informadas; sem cálculo nem validação tributária.');return {entityId:document.id,action:'Classificação do rascunho registrada'};
 }
 if(c.type==='discard_fiscal_document'){
  ensure(['rascunho','rejeitada'].includes(document.status),'Documento autorizado ou incerto não pode ser descartado. Consulte ou cancele pelo fluxo próprio.');document.status='descartada';event('descartado',c.reason);return {entityId:document.id,action:'Rascunho fiscal descartado com motivo; histórico preservado'};
 }
 ensure(options.portfolio&&document.environment==='demonstracao','Simulações fiscais são exclusivas do portfólio; emissão real permanece bloqueada.');
 if(c.type==='cancel_fiscal_demo'){ensure(document.status==='autorizada','Somente uma autorização simulada pode ser cancelada nesta demonstração.');document.status='cancelada';event('cancelamento_simulado','Cancelamento SIMULADO: '+c.reason);return {entityId:document.id,action:'Cancelamento fiscal simulado; sem estorno ou devolução automática'};}
 if(c.type==='reconcile_fiscal_demo'){ensure(document.status==='resultado_incerto','Consulte apenas documentos com resultado incerto.');document.status=c.outcome;event('consulta_simulada',`Consulta SIMULADA: ${c.outcome}. Nenhum provedor foi acessado.`);return {entityId:document.id,action:'Consulta de resultado fiscal simulada'};}
 ensure(['rascunho','rejeitada'].includes(document.status),'Não reenvie um resultado incerto ou uma autorização. Consulte o registro existente.');
 ensure(fiscalSourceCurrent(s,document),'O orçamento mudou ou deixou de estar aprovado. Preserve o rascunho e prepare a versão atual.');
 document.status=c.outcome;event('resultado_simulado',c.outcome==='resultado_incerto'?'Timeout SIMULADO. Resultado desconhecido: consultar antes de reenviar.':`Resultado SIMULADO: ${c.outcome}. SEM VALIDADE FISCAL; nenhum envio externo.`);
 return {entityId:document.id,action:'Resultado fiscal simulado, sem emissão externa'};
}
