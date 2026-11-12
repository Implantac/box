import {describe,it,expect,vi,afterEach} from 'vitest';
import {getFiscalProvider,type FiscalProvider} from '@/lib/server/fiscal-provider';
import {executeClaimedFiscalJob,type ClaimedFiscalJob} from '@/lib/server/fiscal-processing';
import {applyCommand} from '@/lib/domain';
import {createSeed,sid} from '@/lib/seed';
import {id} from '@/lib/model';
const fixture=()=>({name:'contract-fixture-not-a-real-provider',configured:true,submit:vi.fn().mockResolvedValue({status:'pending',providerReference:'fixture'}),consult:vi.fn().mockResolvedValue({status:'unknown'}),cancel:vi.fn().mockResolvedValue({status:'pending',providerReference:'fixture'}),artifacts:vi.fn().mockRejectedValue(new Error('No real artifacts'))} satisfies FiscalProvider);
function job():ClaimedFiscalJob{const s=applyCommand(createSeed(),{type:'prepare_fiscal_document',id:id(),orderId:sid(42),model:'nfse'},'owner',{portfolio:false});return {id:id(),workspaceId:sid(200),document:s.fiscalDocuments[0],action:'submit',consultRequired:false,idempotencyKey:'stable-fixture-key'};}
afterEach(()=>vi.unstubAllEnvs());
describe('contrato de provedor: fixtures locais, nenhuma emissão real',()=>{
 it('nenhuma variável habilita um conector inexistente',async()=>{vi.stubEnv('BOX_FISCAL_ENABLED','true');const provider=getFiscalProvider();expect(provider.configured).toBe(false);await expect(provider.submit(job().document,{workspaceId:sid(200),idempotencyKey:'fixture'})).rejects.toMatchObject({code:'FISCAL_PROVIDER_NOT_CONFIGURED'});await expect(provider.artifacts({workspaceId:sid(200),documentId:id(),environment:'homologacao',providerReference:'fixture'})).rejects.toMatchObject({code:'FISCAL_PROVIDER_NOT_CONFIGURED'});});
 it('primeiro envio usa a chave estável, sem gerar outra identidade',async()=>{const p=fixture();const j=job();expect(await executeClaimedFiscalJob(j,p)).toMatchObject({status:'pending'});expect(p.submit).toHaveBeenCalledWith(j.document,{workspaceId:j.workspaceId,idempotencyKey:j.idempotencyKey});expect(p.consult).not.toHaveBeenCalled();});
 it('retry de resultado incerto ou lease recuperado consulta, não reenvia',async()=>{const p=fixture();const j={...job(),consultRequired:true};await executeClaimedFiscalJob(j,p);expect(p.submit).not.toHaveBeenCalled();expect(p.consult).toHaveBeenCalledWith({workspaceId:j.workspaceId,idempotencyKey:j.idempotencyKey,environment:'homologacao',providerReference:undefined});});
 it('timeout e erro de transporte são incertos, não rejeição',async()=>{const p=fixture();p.submit.mockRejectedValue(new Error('timeout: não expor payload ou segredo'));expect(await executeClaimedFiscalJob(job(),p)).toEqual({status:'unknown'});});
 it('não transforma resposta incompleta em autorização',async()=>{const p=fixture();p.submit.mockResolvedValue({status:'authorized'});expect(await executeClaimedFiscalJob(job(),p)).toEqual({status:'unknown'});});
 it('bloqueia documento de demonstração antes de qualquer I/O',async()=>{const p=fixture();const j=job();j.document.environment='demonstracao';await expect(executeClaimedFiscalJob(j,p)).rejects.toThrow('DEMO_DOCUMENT_FORBIDDEN');expect(p.submit).not.toHaveBeenCalled();});
 it('cancelamento é ação separada, sem estorno ou reenvio do documento',async()=>{const p=fixture();const j={...job(),action:'cancel' as const,providerReference:'fixture',reason:'Cancelamento fictício do contrato.'};await executeClaimedFiscalJob(j,p);expect(p.cancel).toHaveBeenCalledOnce();expect(p.submit).not.toHaveBeenCalled();});
 it('resposta de operação diferente nunca vira sucesso',async()=>{const p=fixture();p.submit.mockResolvedValue({status:'canceled',protocol:'fixture',providerReference:'fixture'});expect(await executeClaimedFiscalJob(job(),p)).toEqual({status:'unknown'});});
});
