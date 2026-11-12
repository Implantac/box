import { z } from 'zod';
const uuid=z.uuid();const date=z.iso.datetime({offset:true});const text=(min:number,max:number)=>z.string().trim().min(min).max(max);const qty=z.number().int().min(1).max(100000);const money=z.number().int().min(0).max(100000000);
export const commissionPolicySchema=z.strictObject({mode:z.enum(['sem','percentual','fixo']),value:money}).refine(p=>p.mode==='sem'?p.value===0:p.value>0&&(p.mode!=='percentual'||p.value<=10000),{message:'Comissão: use zero no modelo sem comissão, percentual de até 100% ou valor fixo positivo.'});
export const partSchema=z.strictObject({id:uuid,sku:text(2,40),name:text(3,160),unit:z.enum(['un','kit','frasco']),location:text(0,100),minimum:z.number().int().min(0).max(100000),referenceCostCents:money,createdAt:date});
export const mechanicSchema=z.strictObject({id:uuid,name:text(3,120),active:z.boolean(),note:text(0,250),userId:uuid.optional(),createdAt:date});
const ruleSchema=z.strictObject({id:uuid,mechanicId:uuid,mode:z.enum(['sem','percentual','fixo']),value:money,createdAt:date});
const absenceSchema=z.strictObject({id:uuid,mechanicId:uuid,startsAt:date,endsAt:date,reason:text(5,300),status:z.literal('ativa'),createdAt:date});
export const workshopCommandSchemas=[
 z.strictObject({type:z.literal('save_part'),part:partSchema}),
 z.strictObject({type:z.literal('record_stock'),id:uuid,partId:uuid,kind:z.enum(['entrada','ajuste_entrada','ajuste_saida']),quantity:qty,reason:text(5,300)}),
 z.strictObject({type:z.literal('reserve_part'),id:uuid,orderId:uuid,partId:uuid,quantity:qty}),
 z.strictObject({type:z.literal('consume_reserved_part'),id:uuid,reservationId:uuid,quantity:qty}),
 z.strictObject({type:z.literal('release_reserved_part'),id:uuid,reservationId:uuid,quantity:qty,reason:text(5,300)}),
 z.strictObject({type:z.literal('return_part'),id:uuid,consumptionId:uuid,quantity:qty,reason:text(5,300)}),
 z.strictObject({type:z.literal('save_mechanic'),mechanic:mechanicSchema}),
 z.strictObject({type:z.literal('save_commission_rule'),rule:ruleSchema}),
 z.strictObject({type:z.literal('create_absence'),absence:absenceSchema}),
 z.strictObject({type:z.literal('cancel_absence'),id:uuid,reason:text(5,300)}),
 z.strictObject({type:z.literal('create_service'),service:z.strictObject({id:uuid,orderId:uuid,mechanicId:uuid,quoteId:uuid,itemIndex:z.number().int().min(0).max(29),plannedAt:date,duration:z.number().int().min(15).max(480),appointmentId:uuid.optional()}),commission:commissionPolicySchema.optional()}),
 z.strictObject({type:z.literal('set_service_status'),id:uuid,status:z.enum(['em_execucao','pausado','concluido','cancelado']),note:text(0,300).optional()}),
 z.strictObject({type:z.literal('refresh_service_authorization'),id:uuid}),
 z.strictObject({type:z.literal('record_commission_payment'),id:uuid,commissionId:uuid,kind:z.enum(['repasse','estorno']),amountCents:money.refine(n=>n>0),note:text(5,300)}),
 z.strictObject({type:z.literal('cancel_commission'),id:uuid,reason:text(5,300)})
] as const;
export const workshopCommandSchema=z.discriminatedUnion('type',workshopCommandSchemas);
