# Fiscal 1.2 — contrato substituível e limites

## 1. Rascunhos e demonstração

- `/painel/fiscal`: proprietário e financeiro. Emitente só é alterado pelo proprietário; destinatários por proprietário/financeiro.
- A OS deve existir e não estar cancelada; a versão mais recente do orçamento deve estar aprovada. O pedido contém somente IDs/modelo: valores, versão e snapshots são construídos no domínio/SQL, não aceitos do navegador.
- `nfe` contém apenas itens `peca`; `nfse`, apenas `servico`. Desconto global rateado proporcionalmente pelo maior resto, em centavos, com a mesma regra usada no banco. Não é cálculo de imposto nem determinação jurídica de como cada operação deve ser tributada.
- Um documento ativo por OS/versão/modelo. Retry do mesmo ID é idempotente; outro ID não duplica. Cancelamento/descarte mantém histórico e permite novo preparo. Documento de versão anterior não é reescrito.
- Emitente e destinatário são fotografados no preparo. Atualizar cadastro não altera snapshots; descarte motivado e novo rascunho permitem revisar a fotografia. Classificações podem ser alteradas somente em rascunho/rejeição, sem editar valores/itens.
- A demo não aceita CPF/CNPJ preenchido e permite só e-mail `@example.com`. Cadastros parciais não validam empresa/endereço. O backend conectado valida formatos, limites e dígitos de CPF/CNPJ numérico/alfanumérico, não regularidade cadastral. O cálculo alfanumérico segue ASCII−48/módulo11 e o exemplo público da Receita [1](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/cnpj/cnpj-alfanumerico.pdf).
- Os campos de classificação são **preparatórios**, não mapeamento completo de tributos: não há alíquota padrão, cálculo de ICMS/ISS/IBS/CBS, retenção, geração/assinatura/validação de XML oficial ou garantia de conformidade.

## 2. Estados sem falso sucesso

Apenas no portfólio e com `environment=demonstracao`:

```
rascunho → autorizada (SIMULAÇÃO) → cancelada (SIMULAÇÃO)
rascunho → rejeitada (SIMULAÇÃO) → revisão → nova tentativa simulada
rascunho → resultado_incerto → consulta simulada → autorizada/rejeitada
rascunho/rejeitada → descartada, com motivo
```

Não reenviar ou descartar resultado incerto. Simulação não gera chave de acesso, protocolo oficial, número fiscal ou XML. A exportação HTML é um **espelho SEM VALIDADE FISCAL**, sem script e com conteúdo escapado. Não é DANFE/DANFSE, recibo ou cobrança. CSV também não é documento fiscal.

O SQL conectado não aceita nenhum comando de simulação, mesmo do proprietário e em chamada direta. Rascunhos conectados começam em **homologação**. Não há formulário para ativar produção.

## 3. Interface do provedor

`src/lib/server/fiscal-provider.ts`, somente servidor:

- `submit(snapshot, {workspaceId,idempotencyKey})`
- `consult({workspaceId,idempotencyKey,environment,providerReference?})`
- `cancel({workspaceId,idempotencyKey,document,reason,providerReference})`
- `artifacts({workspaceId,documentId,environment,providerReference})`

O provedor padrão é `DisabledFiscalProvider`. **Não faz requisição externa.** Não aceita URL/token informado pelo navegador. Mudar variáveis não instala emissor. Resultados do conector passam por validação estrita; resposta incompleta/erro de transporte é `unknown`, nunca autorização/rejeição presumida. Para NF-e, evidência mínima inclui a chave de 44 dígitos, mas isso sozinho não comprova autenticidade fiscal.

`executeClaimedFiscalJob` é núcleo de contrato, não daemon implantado. Recebe um job já reservado atomicamente. Em recuperação/resultado pendente/incerto chama `consult`, sem novo `submit`. Cancelamento é uma ação separada; resposta de tipo incompatível não vira sucesso.

## 4. Persistência e processamento futuro

Migração `202611120004_fiscal_readiness.sql`:

- `box_fiscal_issuers`, `box_fiscal_recipients`, `box_fiscal_documents`, com SELECT sujeito a RLS. Sem escrita direta para papéis da aplicação.
- `box_command` exige membro, AAL2, papel, revisão/bloqueio do workspace, limites/formato/vínculos e auditoria. O entrypoint anterior fica privado.
- `box_read_workspace` inclui estruturas fiscais e `schemaVersion=4`; o GET do app rejeita esquema antigo. Perfis não autorizados recebem arrays vazios e emitente nulo.
- `box_fiscal_jobs`: outbox privada, unicidade por documento/ação e chave, estado, tentativa, lease e resultado. Navegador não lê/escreve/reserva/conclui jobs.
- `box_fiscal_claim_jobs`: reserva com `FOR UPDATE SKIP LOCKED`, token de lease e expiração. Recuperação exige consulta.
- `box_fiscal_complete_job`: token de fencing impede conclusão por lease antigo; resultado mínimo validado, atualização de status/histórico e revisão. Não armazena XML/PDF nem valida assinatura.

**Ainda implementar/provisionar depois de escolher o provedor:** produtor autorizado transacional que valide todos os requisitos e crie job/chave estável; repositório/runner do worker e identidade de menor privilégio; transporte/credenciais/mTLS quando exigidos; revisão controlada após rejeição real; armazenamento privado de artefatos com hash e retenção; webhook autenticado/antirreplay e reconciliação. Não conceder funções internas genericamente a `authenticated`. Nenhuma service role faz parte do app web.

Os testes usam fixtures e PGlite **em uma conexão**. Demonstram transições, unicidade e fencing locais, não execução de worker, emissão oficial, carga ou concorrência de um PostgreSQL remoto. Nenhum job de emissão foi criado num serviço real.

## 5. Homologação e fontes técnicas

A seleção do provedor deve confirmar município/UF e operação reais, leiautes e notas técnicas vigentes, ambientes separados, limites, idempotência, consulta após timeout, cancelamento, artefatos, segurança e suporte. Não há provedor/município/regime escolhido por inferência do nome “Apucarana”.

Referências oficiais consultadas em 12/11/2026, para orientar a implementação posterior, não como prova de homologação:

- [Portal NF-e: manuais, esquemas, notas técnicas e serviços](https://www.nfe.fazenda.gov.br/portal/principal.aspx). Não foram fixados endpoints estaduais ou versão de XML por suposição.
- [Portal NFS-e: APIs de produção restrita e produção](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/apis-prod-restrita-e-producao), página consultada com atualização indicada em 20/08/2026. A disponibilidade nacional não comprova habilitação da empresa nem dispensa parâmetros municipais.
- Receita Federal, CNPJ alfanumérico e cálculo de dígitos: [1](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/cnpj/cnpj-alfanumerico.pdf).

Ver `ATIVACAO-REAL.md` e a matriz `HOMOLOGACAO-REAL-MODELO.md`. Credenciais/certificados jamais devem ser enviados pelo chat.
