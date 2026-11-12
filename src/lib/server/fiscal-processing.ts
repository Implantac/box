import 'server-only';
import type { FiscalDocument } from '../fiscal-model';
import {fiscalProviderResultSchema,type FiscalProvider,type FiscalProviderResult} from './fiscal-provider';
export interface ClaimedFiscalJob {id:string;workspaceId:string;idempotencyKey:string;action:'submit'|'cancel';consultRequired:boolean;document:FiscalDocument;providerReference?:string;reason?:string}
/** Um job precisa ter sido reservado atomicamente na outbox ANTES desta chamada. Não é um worker implantado. */
export async function executeClaimedFiscalJob(job:ClaimedFiscalJob,provider:FiscalProvider):Promise<FiscalProviderResult>{
 if(!provider.configured)throw new Error('FISCAL_PROVIDER_NOT_CONFIGURED');
 if(job.document.environment==='demonstracao')throw new Error('DEMO_DOCUMENT_FORBIDDEN');
 if(!job.idempotencyKey||!job.workspaceId)throw new Error('INVALID_JOB');
 try{
  let result:FiscalProviderResult;
  if(job.consultRequired)result=await provider.consult({workspaceId:job.workspaceId,idempotencyKey:job.idempotencyKey,environment:job.document.environment,providerReference:job.providerReference});
  else if(job.action==='cancel'){
   if(!job.providerReference||!job.reason||job.reason.trim().length<5)throw new Error('INVALID_CANCELLATION');
   result=await provider.cancel({workspaceId:job.workspaceId,idempotencyKey:job.idempotencyKey,document:job.document,providerReference:job.providerReference,reason:job.reason});
  }else result=await provider.submit(job.document,{workspaceId:job.workspaceId,idempotencyKey:job.idempotencyKey});
  const parsed=fiscalProviderResultSchema.safeParse(result);if(!parsed.success)return {status:'unknown'};result=parsed.data;
  if(result.status==='authorized'&&job.document.model==='nfe'&&!/^[0-9]{44}$/.test(result.accessKey||''))return {status:'unknown'};
  // A resposta do adaptador só vira autorização com evidência mínima; XML/assinatura ainda devem ser homologados.
  if(result.status==='authorized'&&(!result.number||!result.protocol||!result.providerReference))return {status:'unknown'};
  if(result.status==='canceled'&&(!result.protocol||!result.providerReference))return {status:'unknown'};
  if((job.action==='submit'&&result.status==='canceled')||(job.action==='cancel'&&result.status==='authorized'))return {status:'unknown'};
  return result;
 }catch{return {status:'unknown'};} // Timeout/erro de transporte não é rejeição nem autorização. Consultar antes de reenviar.
}
