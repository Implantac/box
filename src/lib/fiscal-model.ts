export type FiscalModel = 'nfe' | 'nfse';
export type FiscalEnvironment = 'demonstracao' | 'homologacao' | 'producao';
export type FiscalStatus = 'rascunho' | 'em_processamento' | 'autorizada' | 'rejeitada' | 'resultado_incerto' | 'cancelamento_pendente' | 'cancelada' | 'descartada';
export interface FiscalAddress { street:string; number:string; complement:string; district:string; city:string; state:string; cityCode:string; zip:string }
export interface FiscalParty { legalName:string; taxId:string; email:string; stateRegistration:string; municipalRegistration:string; address:FiscalAddress }
export interface FiscalIssuer extends FiscalParty { taxRegime:'nao_definido'|'simples_nacional'|'simples_excesso'|'regime_normal' }
export interface FiscalRecipient { id:string; customerId:string; party:FiscalParty }
export interface FiscalClassification { sourceIndex:number; ncm:string; cfop:string; cstOrCsosn:string; origin:string; serviceCode:string; municipalServiceCode:string; taxationCode:string }
export interface FiscalLine { sourceIndex:number; description:string; kind:'peca'|'servico'; quantity:number; unitCents:number; discountCents:number; totalCents:number; classification:FiscalClassification }
export interface FiscalEvent { id:string; at:string; action:string; message:string }
export interface FiscalDocument {
 id:string; orderId:string; orderNumber:string; customerId:string; quoteId:string; quoteVersion:number;
 model:FiscalModel; environment:FiscalEnvironment; status:FiscalStatus; issuer:FiscalIssuer; recipient:FiscalParty;
 items:FiscalLine[]; totalCents:number; createdAt:string; updatedAt:string; events:FiscalEvent[];
}
export interface FiscalData { fiscalIssuer:FiscalIssuer|null; fiscalRecipients:FiscalRecipient[]; fiscalDocuments:FiscalDocument[] }
export type FiscalCommand =
 | {type:'save_fiscal_issuer';issuer:FiscalIssuer}
 | {type:'save_fiscal_recipient';recipient:FiscalRecipient}
 | {type:'prepare_fiscal_document';id:string;orderId:string;model:FiscalModel}
 | {type:'classify_fiscal_document';id:string;classifications:FiscalClassification[]}
 | {type:'discard_fiscal_document';id:string;reason:string}
 | {type:'simulate_fiscal_result';id:string;outcome:'autorizada'|'rejeitada'|'resultado_incerto'}
 | {type:'reconcile_fiscal_demo';id:string;outcome:'autorizada'|'rejeitada'}
 | {type:'cancel_fiscal_demo';id:string;reason:string};
export const FISCAL_MODELS:Record<FiscalModel,string>={nfe:'NF-e · peças',nfse:'NFS-e · serviços'};
export const FISCAL_STATUS:Record<FiscalStatus,{label:string;tone:string}>={rascunho:{label:'Rascunho',tone:'neutral'},em_processamento:{label:'Em processamento',tone:'blue'},autorizada:{label:'Autorizada',tone:'green'},rejeitada:{label:'Rejeitada',tone:'red'},resultado_incerto:{label:'Resultado incerto',tone:'amber'},cancelamento_pendente:{label:'Cancelamento pendente',tone:'amber'},cancelada:{label:'Cancelada',tone:'neutral'},descartada:{label:'Rascunho descartado',tone:'neutral'}};
export const FISCAL_STATES=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] as const;
export const emptyFiscalAddress=():FiscalAddress=>({street:'',number:'',complement:'',district:'',city:'',state:'',cityCode:'',zip:''});
export const emptyFiscalParty=():FiscalParty=>({legalName:'',taxId:'',email:'',stateRegistration:'',municipalRegistration:'',address:emptyFiscalAddress()});
export const emptyFiscalIssuer=():FiscalIssuer=>({...emptyFiscalParty(),taxRegime:'nao_definido'});
export const emptyFiscalData=():FiscalData=>({fiscalIssuer:null,fiscalRecipients:[],fiscalDocuments:[]});
export const emptyClassification=(sourceIndex:number):FiscalClassification=>({sourceIndex,ncm:'',cfop:'',cstOrCsosn:'',origin:'',serviceCode:'',municipalServiceCode:'',taxationCode:''});
export function upgradeFiscal<T extends object>(s:T):T&FiscalData{return {...emptyFiscalData(),...s};}
