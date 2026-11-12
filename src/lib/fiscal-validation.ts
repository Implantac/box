import { z } from 'zod';
import { FISCAL_STATES } from './fiscal-model';
const text=(max:number)=>z.string().trim().max(max);
const optionalPattern=(pattern:RegExp,max:number)=>text(max).refine(v=>!v||pattern.test(v),'Formato fiscal inválido.');
export const fiscalAddressSchema=z.strictObject({street:text(120),number:text(20),complement:text(80),district:text(80),city:text(100),state:z.union([z.literal(''),z.enum(FISCAL_STATES)]),cityCode:optionalPattern(/^\d{7}$/,7),zip:optionalPattern(/^\d{8}$/,8)});
export const fiscalPartySchema=z.strictObject({legalName:text(120),taxId:optionalPattern(/^(?:\d{11}|[A-Z0-9]{12}\d{2})$/,14),email:z.union([z.literal(''),z.email().max(254)]),stateRegistration:text(30),municipalRegistration:text(30),address:fiscalAddressSchema});
export const fiscalIssuerSchema=fiscalPartySchema.extend({taxRegime:z.enum(['nao_definido','simples_nacional','simples_excesso','regime_normal'])});
export const fiscalClassificationSchema=z.strictObject({sourceIndex:z.number().int().min(0).max(29),ncm:optionalPattern(/^\d{8}$/,8),cfop:optionalPattern(/^\d{4}$/,4),cstOrCsosn:optionalPattern(/^\d{2,3}$/,3),origin:optionalPattern(/^[0-8]$/,1),serviceCode:text(30),municipalServiceCode:text(30),taxationCode:text(30)});
export const fiscalCommandSchemas=[
 z.strictObject({type:z.literal('save_fiscal_issuer'),issuer:fiscalIssuerSchema}),
 z.strictObject({type:z.literal('save_fiscal_recipient'),recipient:z.strictObject({id:z.uuid(),customerId:z.uuid(),party:fiscalPartySchema})}),
 z.strictObject({type:z.literal('prepare_fiscal_document'),id:z.uuid(),orderId:z.uuid(),model:z.enum(['nfe','nfse'])}),
 z.strictObject({type:z.literal('classify_fiscal_document'),id:z.uuid(),classifications:z.array(fiscalClassificationSchema).min(1).max(30).refine(v=>new Set(v.map(x=>x.sourceIndex)).size===v.length)}),
 z.strictObject({type:z.literal('discard_fiscal_document'),id:z.uuid(),reason:z.string().trim().min(5).max(255)}),
 z.strictObject({type:z.literal('simulate_fiscal_result'),id:z.uuid(),outcome:z.enum(['autorizada','rejeitada','resultado_incerto'])}),
 z.strictObject({type:z.literal('reconcile_fiscal_demo'),id:z.uuid(),outcome:z.enum(['autorizada','rejeitada'])}),
 z.strictObject({type:z.literal('cancel_fiscal_demo'),id:z.uuid(),reason:z.string().trim().min(5).max(255)})
] as const;
