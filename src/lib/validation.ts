import { z } from 'zod';
import { workshopCommandSchemas } from './workshop-validation';
import { fiscalCommandSchemas } from './fiscal-validation';
const uuid=z.uuid();
const date=z.iso.date();
const datetime=z.iso.datetime({offset:true});
const text=(min=0,max=3000)=>z.string().trim().min(min).max(max);
const cents=z.number().int().min(0).max(100000000);
const orderStatus=z.enum(['recepcao','diagnostico','aguardando_aprovacao','aguardando_pecas','execucao','testes','pronto','entregue','cancelada']);
const channel=z.enum(['instagram','facebook','youtube']);
export const customerSchema=z.strictObject({id:uuid,name:text(3,120),email:z.union([z.literal(''),z.email().max(254)]),phone:text(0,40),notes:text(0,1000),createdAt:datetime});
export const vehicleSchema=z.strictObject({id:uuid,customerId:uuid,model:text(2,120),year:z.number().int().min(1900).max(2100),plate:text(0,16),km:z.number().int().min(0).max(3000000)});
const orderSchema=z.strictObject({id:uuid,number:text(3,40),customerId:uuid,customerName:text(0,120),vehicleId:uuid,vehicleLabel:text(0,160),status:z.literal('recepcao'),complaint:text(5,3000),diagnosis:text(0,3000),technician:text(2,120),dueDate:date,createdAt:datetime,returnOf:uuid.optional(),checklist:z.array(text(1,120)).max(10)});
const quoteSchema=z.strictObject({id:uuid,orderId:uuid,version:z.number().int().positive().max(10000),status:z.literal('rascunho'),items:z.array(z.strictObject({id:z.string().min(1).max(80).regex(/^(?:[0-9a-fA-F-]{36}|legacy:[0-9a-fA-F-]{36}:\d{1,2})$/).optional(),partId:uuid.optional(),description:text(3,200),kind:z.enum(['peca','servico']),quantity:z.number().int().min(1).max(999),unitCents:cents})).min(1).max(30),discountCents:cents,terms:text(10,2000),createdAt:datetime});
const appointmentSchema=z.strictObject({id:uuid,customerId:uuid,customerName:text(0,120),vehicleLabel:text(1,160),service:text(3,200),startsAt:datetime,duration:z.number().int().min(15).max(480),technician:text(2,120),status:z.enum(['solicitado','confirmado'])});
const paymentSchema=z.strictObject({id:uuid,orderId:uuid,amountCents:cents.positive(),method:z.enum(['pix','cartao','dinheiro']),kind:z.enum(['recebimento','estorno']),note:text(0,500),createdAt:datetime});
const costSchema=z.strictObject({id:uuid,orderId:uuid,description:text(3,200),amountCents:cents.positive(),createdAt:datetime});
const leadSchema=z.strictObject({id:uuid,name:text(3,120),phone:text(0,40),vehicle:text(0,160),note:text(5,1000),source:text(1,100),status:z.literal('novo'),createdAt:datetime,nextAction:text(0,250)});
const postSchema=z.strictObject({id:uuid,title:text(3,120),caption:text(10,2200),variants:z.partialRecord(channel,text(0,2200)).optional(),mediaKind:z.enum(['imagem','video']),visual:z.enum(['gear','care','team']),channels:z.array(channel).min(1).max(3).refine(x=>new Set(x).size===x.length),revision:z.number().int().positive(),approvedRevision:z.number().int().positive().optional(),rightsConfirmed:z.boolean(),status:z.enum(['rascunho','aprovado','agendado_demo','simulado','parcial_demo']),scheduledAt:datetime.optional(),deliveries:z.array(z.strictObject({channel,status:z.enum(['simulado','falha_simulada','requer_conexao']),message:text(0,500),at:datetime})).max(3),createdAt:datetime});
export const settingsSchema=z.strictObject({heroTitle:text(10,120),heroSubtitle:text(10,350),brandName:text(3,80),location:text(0,80)});
export const commandSchema=z.discriminatedUnion('type',[
 z.strictObject({type:z.literal('create_customer'),customer:customerSchema,vehicle:vehicleSchema.optional()}),
 z.strictObject({type:z.literal('create_order'),order:orderSchema}),
 z.strictObject({type:z.literal('transition_order'),id:uuid,status:orderStatus,note:text(0,500).optional(),diagnosis:text(0,3000).optional(),checklist:z.array(text(1,120)).max(10).optional()}),
 z.strictObject({type:z.literal('create_quote'),quote:quoteSchema}),
 z.strictObject({type:z.literal('set_quote_status'),id:uuid,status:z.enum(['enviado','aprovado','recusado']),evidence:text(0,1000).optional()}),
 z.strictObject({type:z.literal('create_appointment'),appointment:appointmentSchema}),
 z.strictObject({type:z.literal('set_appointment_status'),id:uuid,status:z.enum(['solicitado','confirmado','concluido','cancelado','faltou'])}),
 z.strictObject({type:z.literal('record_payment'),payment:paymentSchema}),z.strictObject({type:z.literal('record_cost'),cost:costSchema}),
 z.strictObject({type:z.literal('create_lead'),lead:leadSchema}),
 z.strictObject({type:z.literal('set_lead_status'),id:uuid,status:z.enum(['novo','em_contato','convertido','perdido']),nextAction:text(0,250).optional()}),
 z.strictObject({type:z.literal('save_post'),post:postSchema}),z.strictObject({type:z.literal('approve_post'),id:uuid}),
 z.strictObject({type:z.literal('simulate_post'),id:uuid,failChannel:channel.optional(),scheduleAt:datetime.optional()}),z.strictObject({type:z.literal('cancel_post_schedule'),id:uuid}),
 z.strictObject({type:z.literal('update_settings'),settings:settingsSchema}),
 ...workshopCommandSchemas,
 ...fiscalCommandSchemas
]);
export const workspaceRequestSchema=z.strictObject({revision:z.number().int().positive().max(2147483000),command:commandSchema});
export const loginSchema=z.strictObject({email:z.email().max(254),password:z.string().min(8).max(256)});
export const verifyMfaSchema=z.strictObject({factorId:uuid,code:z.string().regex(/^\d{6}$/)});
