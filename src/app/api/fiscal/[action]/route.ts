import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authContext, config, errorResult, HttpError, jsonBody, requireOrigin } from '@/lib/server/auth';
import { rateLimit } from '@/lib/server/rate-limit';
import { getFiscalProvider } from '@/lib/server/fiscal-provider';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'};
const requestSchema=z.strictObject({documentId:z.uuid(),revision:z.number().int().positive(),reason:z.string().trim().min(5).max(255).optional()});
/** Fronteira de ativação, deliberadamente bloqueada até conector + produtor/worker homologados. */
export async function POST(request:Request,context:{params:Promise<{action:string}>}){try{
 requireOrigin(request);const {client,session,user}=await authContext();
 if(!['owner','finance'].includes(session.role))throw new HttpError('Este perfil não pode operar documentos fiscais.',403,'FORBIDDEN');
 rateLimit('fiscal:'+user.id,30);const {action}=await context.params;
 if(!['submit','consult','cancel'].includes(action))throw new HttpError('Operação fiscal não encontrada.',404,'NOT_FOUND');
 const parsed=requestSchema.safeParse(await jsonBody(request));if(!parsed.success)throw new HttpError('Dados fiscais inválidos.',422,'VALIDATION_ERROR');
 const {data,error}=await client.rpc('box_read_workspace',{p_workspace:config().workspace});
 if(error||data?.schemaVersion!==4||!Array.isArray(data?.fiscalDocuments))throw new HttpError('Migração fiscal não confirmada. Verifique o ambiente dedicado.',503,'DATABASE_UNAVAILABLE');
 if(data.revision!==parsed.data.revision)throw new HttpError('Dados alterados. Atualize antes de tentar novamente.',409,'REVISION_CONFLICT');
 if(!data.fiscalDocuments.some((d:{id:string})=>d.id===parsed.data.documentId))throw new HttpError('Documento indisponível para esta conta.',403,'FORBIDDEN');
 if(!getFiscalProvider().configured)throw new HttpError('Nenhuma nota foi enviada. O conector fiscal e o processamento real ainda precisam ser implementados e homologados.',503,'FISCAL_PROVIDER_NOT_CONFIGURED');
 throw new HttpError('Processamento fiscal não implantado. Não há liberação automática por variável de ambiente.',503,'FISCAL_DISPATCH_NOT_DEPLOYED');
}catch(e){const r=errorResult(e);return NextResponse.json({error:r.error,code:r.code},{status:r.status,headers});}}
