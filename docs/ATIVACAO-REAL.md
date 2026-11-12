# Do portfólio à operação real — roteiro 1.2.0

**Situação atual: código preparatório, não liberação de produção.** O usuário escolheu NF-e de peças e NFS-e de serviços, sem provedor definido. O padrão continua `portfolio`. O site publicado continua 1.1.1; este fonte 1.2.0 não foi publicado remotamente.

## 1. O que pode ser aproveitado sem refazer o projeto

- App Node.js 22/Next, standalone, servidor de mesma origem, HTTPS por proxy ou plataforma compatível.
- Adaptador de banco/Auth, contas individuais, cookies HttpOnly, MFA obrigatório, permissões no servidor/SQL e RLS.
- Fluxo integrado de clientes/OS/orçamentos/agenda/recebimentos/estoque/equipe/comissões demonstrativas.
- Área fiscal com cadastros, rascunhos por OS/versão aprovada, separação de itens, desconto exato, snapshots e histórico.
- Quarta migração para persistência fiscal conectada; tabelas e contratos privados de outbox com lease/fencing e recuperação por consulta. Nenhum produtor/worker externo ativo.
- Validação estrutural de configuração, rejeição de chave privilegiada no app web e checklist operacional que não promete homologação.

Não há botão ou variável que transforme automaticamente o portfólio em operação comercial. Páginas institucionais, privacidade, termos e procedimentos ainda precisam refletir a empresa real. Os 46 itens do plano não foram integralmente entregues.

## 2. Responsáveis e decisões antes de contratar

Preencher em documento privado, sem senhas: responsável operacional; responsável técnico; contador; responsável por privacidade; cidade/UF real; CNPJ/inscrições/regime; quais serviços/peças e operações fiscais; domínio autorizado; hospedagem Node/Docker; ambiente dedicado; provedor fiscal; orçamento aprovado; RPO/RTO/retenção; escopo dos canais reais.

Não reutilizar banco/projeto de outro negócio. Não substituir AGROTECH. Não contratar planos nem habilitar cobranças sem autorização. Configuração do app não implementa captação pública, mensagens, redes ou pagamento real.

## 3. Homologação conectada, ainda com registros de teste

1. Criar ambiente dedicado autorizado com Auth/PostgreSQL/PostgREST compatíveis; confirmar limites/custo e disponibilidade.
2. Configurar e-mail/SMTP e recuperação de acesso no provedor. Desabilitar cadastro aberto. URLs de redirecionamento devem ser as origens autorizadas. Não existe recuperação pública completa no aplicativo.
3. Fazer backup do estado anterior e restauração em ambiente isolado. Aplicar somente migrações pendentes em ordem: `001_box_core`, `002_validation_and_public_content`, `003_inventory_team_commissions`, **`004_fiscal_readiness`**. Não reaplicar SQLs sobre banco compartilhado.
4. Provisionar o primeiro administrador com `supabase/provisionar-admin.sql`; criar Auth individual e vínculo de cada membro. Técnico operacional não é conta Auth. Renomeações/vínculos históricos seguem as restrições de `IMPLANTACAO.md`.
5. Configurar variáveis privadas do `.env.example` por canal seguro; nunca usar service role no app web. Preencher as duas variáveis de modo com `connected`, origem HTTPS exata e UUID real do workspace. Não enviar tokens/certificados no chat.
6. Executar `npm --silent run preflight -- --target=connected --json`. **Exit 2 é esperado nesta versão:** o relatório é preparatório e a emissão real permanece bloqueada. Mesmo configuração estrutural válida não testa credenciais ou autoriza produção.
7. Rebuild com o modo conectado, instalar em ambiente separado e acessar via HTTPS. Habilitar TOTP, testar duas contas de cliente e todos os papéis via UI **e chamadas diretas à API/PostgREST**.
8. Verificar `/api/health`: `applicationReady` significa configuração estrutural, não banco homologado. Em `/painel/ativacao`, só o proprietário pode verificar a presença das estruturas fiscais pela conexão autenticada. Não há dados sensíveis/valores de variáveis no relatório.
9. Executar a matriz de `HOMOLOGACAO-REAL-MODELO.md` e guardar evidências privadas. Não usar dados pessoais reais nesta fase.

## 4. Fechar a integração fiscal após escolher o provedor

Veja `FISCAL-CONTRATO.md`. Trabalho externo ainda necessário, não apenas preencher credenciais:

- Confirmar atendimento ao município/UF, regime, documentos e operações reais; validação do contador.
- Implementar o adaptador com emissão, consulta por referência/idempotência, cancelamento e artefatos, conforme leiaute/contrato vigente. Validar assinatura, código/tributação, retenções, arredondamentos e mudanças tributárias aplicáveis.
- Configurar credenciais/certificado em cofre do ambiente correto, com validade/renovação/rotação e escopo mínimo.
- Implementar o produtor autorizado da outbox e o runner do worker separado; conceder somente funções necessárias a uma identidade de serviço restrita. **O app web não recebe chave privilegiada.** Não expor `box_fiscal_claim_jobs`/`complete_job` a `authenticated`.
- Reservar job antes da chamada; usar a mesma chave; timeout/crash exige consulta e reconciliação, não segunda emissão. Resultados não são inferidos a partir de HTTP 200.
- Implementar armazenamento privado de XML/PDF com hash, retenção, autorização de download e auditoria. O espelho HTML da demo não pode ser convertido em DANFE por mudança de título.
- Receber webhook somente após implementar validação criptográfica do corpo bruto, antirreplay e roteamento por workspace/ambiente; confirmar pela consulta canônica. Não há endpoint de webhook ligado nesta entrega.
- Homologar os casos de autorização/rejeição/duplicidade/timeout/consulta/cancelamento/artefatos e políticas de indisponibilidade. Não há prazo ou regra de cancelamento presumido.

O endpoint `/api/fiscal/{submit,consult,cancel}` autentica, autoriza, valida origem/revisão/vínculo e **retorna 503 sem enviar**, mesmo se alguém criar uma variável `BOX_FISCAL_ENABLED=true`. Implementar o provedor sozinho não libera o produtor/worker ou o aceite de produção.

## 5. Operação, segurança e recuperação

- Fazer build em diretório/imagem versionada. Não rodar como root. Proteger arquivos de configuração, usar HTTPS, supervisor e reinício controlado. Exemplo Linux em `deploy/box.service.example`, não executado/homologado aqui.
- Para o standalone direto, copiar `public/` e `.next/static/` para `.next/standalone/` antes de ativar a unidade. O `npm run start` faz essa cópia automaticamente na instalação Node normal. Não confundir app Node com publicação estática PHP/FTP.
- Dimensionar por teste de carga. Adicionar limites distribuídos na borda: o rate limit em memória do app é apenas suplementar por instância.
- Definir métricas, alertas de erro/idade da fila/certificado/backup e monitoramento de saúde. Nunca registrar corpo de documento, CPF/CNPJ, token, senha ou certificado em logs públicos.
- `scripts/backup-encrypted.sh` é um **exemplo opt-in**: requer `pg_dump`, `age`, serviço PostgreSQL e destino fora do projeto. Gera dump cifrado e checksum, não envia a nuvem nem comprova restauração. Não foi executado contra banco real. Copiar para destino independente e testar acesso/recuperação.
- Restauração: somente em banco isolado, com versão/roles compatíveis. Validar registros, funções, vínculos, RLS, Auth/Storage e integridade antes de planejar retorno. Dump de PostgreSQL não substitui configuração Auth/SMTP, arquivos de Storage ou segredos do cofre.
- Offboarding: revogar sessões/acesso no Auth e vínculo de membro por administração autorizada; preservar documentos e autoria. Não compartilhar contas nem alterar histórico para retirar um colaborador.
- Validar LGPD, retenção, direitos do titular, termos, dados comerciais e direitos de marca/imagem. Não há parecer jurídico ou contábil neste pacote.

## 6. Liberação real e retorno

Somente depois de todas as evidências e aceite dos responsáveis:

1. Preparar backup independente e plano de retorno; congelar uma versão de fonte/lockfile/migrações/configuração (sem segredos no repositório).
2. Validar permissões/HTTPS e credenciais **do ambiente de produção**, separados da homologação. Não copiar notas de teste como reais nem reiniciar numeração sem procedimento do provedor/contador.
3. Autorizar explicitamente o escopo e a primeira operação controlada; confirmar os artefatos no destino oficial antes de ampliar uso.
4. Monitorar e treinar equipe em rejeição, resultado incerto e cancelamento. Nota cancelada não significa estorno bancário/devolução automática de peça.
5. Em problema, interromper novas emissões; preservar jobs e chaves, consultar resultados pendentes. Voltar o app apenas se for compatível com o esquema atual. Não apagar notas, jobs, tabelas ou certificados para “desfazer” uma emissão.

**Bloqueios atuais explícitos:** conector fiscal/tributação/artefatos/runner e webhook reais, infraestrutura e Auth remotos, restauração externa, concorrência multiconexão/carga, monitoramento operacional, dados/termos legais e aceite do responsável. A conclusão de testes locais não remove esses bloqueios.
