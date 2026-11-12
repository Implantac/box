import 'server-only';
import {z} from 'zod';
import type { FiscalDocument, FiscalEnvironment } from '../fiscal-model';
export type FiscalProviderResult=
 | {status:'pending';providerReference:string}
 | {status:'authorized';providerReference:string;number:string;protocol:string;accessKey?:string}
 | {status:'rejected';code:string}
 | {status:'canceled';providerReference:string;protocol:string}
 | {status:'unknown'};
export const fiscalProviderResultSchema=z.discriminatedUnion('status',[
 z.strictObject({status:z.literal('pending'),providerReference:z.string().min(1).max(120)}),
 z.strictObject({status:z.literal('authorized'),providerReference:z.string().min(1).max(120),number:z.string().min(1).max(40),protocol:z.string().min(1).max(120),accessKey:z.string().min(1).max(120).optional()}),
 z.strictObject({status:z.literal('rejected'),code:z.string().min(1).max(80)}),
 z.strictObject({status:z.literal('canceled'),providerReference:z.string().min(1).max(120),protocol:z.string().min(1).max(120)}),
 z.strictObject({status:z.literal('unknown')})
]);
export interface FiscalProvider {
 readonly name:string;readonly configured:boolean;
 submit(document:FiscalDocument,context:{workspaceId:string;idempotencyKey:string}):Promise<FiscalProviderResult>;
 consult(context:{workspaceId:string;idempotencyKey:string;environment:Exclude<FiscalEnvironment,'demonstracao'>;providerReference?:string}):Promise<FiscalProviderResult>;
 cancel(context:{workspaceId:string;idempotencyKey:string;document:FiscalDocument;reason:string;providerReference:string}):Promise<FiscalProviderResult>;
 // Implementação futura deve validar MIME/tamanho/hash e usar armazenamento privado, não URL pública arbitrária.
 artifacts(context:{workspaceId:string;documentId:string;environment:Exclude<FiscalEnvironment,'demonstracao'>;providerReference:string}):Promise<{xml:Uint8Array;pdf?:Uint8Array}>;
 // Webhooks ficam desligados até validação criptográfica, replay, workspace e consulta canônica serem homologados.
}
export class FiscalProviderUnavailable extends Error {readonly code='FISCAL_PROVIDER_NOT_CONFIGURED';constructor(){super('Provedor fiscal não implementado/configurado. Nenhum documento foi transmitido.');}}
export class DisabledFiscalProvider implements FiscalProvider {
 readonly name='none';readonly configured=false;
 async submit():Promise<never>{throw new FiscalProviderUnavailable();}
 async consult():Promise<never>{throw new FiscalProviderUnavailable();}
 async cancel():Promise<never>{throw new FiscalProviderUnavailable();}
 async artifacts():Promise<never>{throw new FiscalProviderUnavailable();}
}
/** Falha fechada. Nenhuma variável, URL ou nome informado pelo navegador instala um emissor. */
export const getFiscalProvider=():FiscalProvider=>new DisabledFiscalProvider();
