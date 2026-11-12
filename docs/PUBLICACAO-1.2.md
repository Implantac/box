# Publicação Box 1.2.0 — 12/11/2026

**GitHub e Vercel atualizados. Supabase adiado por escolha explícita do usuário.**

Endereço público: **https://box-portfolio-orpin.vercel.app**

A atualização externa foi autorizada depois da entrega do ZIP 1.2. Isso não autoriza operação real, emissão fiscal, contratação de planos ou alteração de outros projetos.

## Resultado por plataforma

| Plataforma | Resultado confirmado |
|---|---|
| GitHub | `Implantac/box`, branch `main`, atualizado para a fonte 1.2.0, preservando o histórico por push fast-forward, sem force push. |
| Vercel | Projeto existente `box-portfolio`, deployment `dpl_988RpaNgPKMfggoCttBBHRm22FYj`, **READY / PROMOTED**, com o endereço principal atribuído. |
| Supabase | **Pendente por escolha do usuário.** Nenhum projeto criado, nenhum SQL executado remotamente e nenhuma migração aplicada. |

### Rastreabilidade do código publicado

- Commit de execução: [`20c7dda337e0071ec2fd0ac0b71f33fe13894437`](https://github.com/Implantac/box/commit/20c7dda337e0071ec2fd0ac0b71f33fe13894437).
- Pai preservado: `f261c49b4c302f9894dce1f1b04cc2966890f746`, fonte 1.0 anterior.
- O commit de execução contém os **240 arquivos do projeto** extraídos do pacote 1.2 entregue, com conteúdo idêntico; os **135 hashes de fonte** foram conferidos.
- O commit posterior que inclui este registro altera apenas README, documentação e evidências. Não muda o código de execução, dependências, ativos, testes ou migrações do deployment.
- A Vercel foi acionada explicitamente com o SHA completo, não com uma referência antiga ou ambígua ao `main`.
- Pronto em **12/11/2026, 20:51:54 UTC**. Runtime efetivo **Node.js 22.x**, Next.js **16.4.6**. O `engines.node` do pacote prevaleceu sobre a configuração padrão do projeto; não foi necessário mudar essa configuração.
- Plano Hobby, proteção SSO e deploy Git automático desabilitado foram preservados. Nenhum novo projeto Vercel ou plano pago foi contratado.

## Verificação executada

### GitHub Actions

[Execução 43304260129](https://github.com/Implantac/box/actions/runs/43304260129): **success**.

- Instalação limpa, preflight de portfólio, TypeScript e build aprovados.
- **347/347 testes**, em 14 arquivos.
- **122/122 E2E** no runner, em desktop e celular, sem falhas, pulos ou testes instáveis.

Os avisos do runner sobre migração de `ubuntu-latest` e runtime interno das actions v4 não reprovaram a execução. São manutenção futura do workflow, não alteração do runtime Node 22 da aplicação.

### Site público, sem autenticação ou bypass

- Saúde: `version: 1.2.0`, `mode: portfolio`, `applicationReady: true`.
- **122/122 E2E públicos**, duração aproximada de 3 min 39 s, sem falhas, pulos ou testes instáveis.
- **28 rotas com HTTP 200**: 27 páginas renderizadas e `/api/health`.
- **8 tamanhos da home** e **16 combinações** das páginas fiscal/preparação, sem transbordamento horizontal; logo inteira e sem obstruções.
- Sem erros de JavaScript ou de carregamento dos ativos nas verificações.
- HTTPS com validação do certificado, `noindex` e cabeçalhos de segurança conferidos.
- Logo preservada: SHA256 `65336cbd26e0abf4a18ad313fca271084c1488400674c7280db6e32208074959`.
- `/api/workspace` e as ações fiscais remotas retornaram **403** no portfólio. Rota inexistente, `.env` e caminho SQL não público retornaram **404**.
- Formulário fictício → CRM, aprovação fictícia de orçamento, navegação móvel, estoque/equipe/comissões e fluxos fiscais simulados passaram. Nenhum atendimento, pagamento, mensagem ou documento fiscal real foi criado.

## Supabase: pendência deliberada, não atualização concluída

A consulta autorizada encontrou apenas **AGROTECH** e **VELT**, sem projeto exclusivo do Box. O usuário escolheu **“Deixar o Supabase pendente”**.

As migrações `001` a `004` estão versionadas em `supabase/migrations/`, mas **não foram aplicadas em nenhum projeto remoto**. AGROTECH e VELT não foram reutilizados, pausados, apagados ou alterados. O portfólio funciona sem esse banco: `databaseConnection: not-used` e `databaseVerified: false`.

A etapa futura exige um destino Box dedicado, confirmação de plano/cota e autorização apropriada antes de provisionar ou aplicar SQL. Auth/MFA/SMTP/PostgREST, RLS remoto e backup/restauração independentes ainda precisam de homologação.

## Limites preservados

- `productionApproved: false` e `fiscalIssuance: disabled`.
- NF-e de peças e NFS-e de serviços são preparação/simulação **SEM VALIDADE FISCAL**.
- Sem provedor real, certificado, worker fiscal implantado ou artefatos oficiais.
- Redes sociais, mensagens, pagamentos e captação pública reais continuam desligados.
- Sem migração de dados pessoais reais, liberação comercial ou declaração de todos os 46 itens do plano concluídos.
- Testes automatizados e publicação não equivalem a homologação fiscal, auditoria integral ou operação real.

## Evidências

- [Recibo consolidado](qa/publicacao-v1.2.json).
- [GitHub Actions](qa/github-actions-v1.2.json) e [E2E do runner](qa/github-actions-playwright-v1.2.json).
- [Deployment Vercel](qa/vercel-ready-v1.2.json).
- [Verificação HTTP/saúde](qa/http-deploy-v1.2.json) e [fluxos de smoke](qa/deploy-v1.2.0-smoke.json).
- [122 E2E públicos](qa/playwright-deploy-v1.2.json).
- [Oito layouts da home](qa/layout-deploy-v1.2.json) e [páginas/16 layouts novos](qa/paginas-deploy-v1.2.json).
- [Decisão Supabase e hashes das migrações](qa/supabase-pendente-v1.2.json).
- [Home desktop publicada](qa/visual-v1.2/publico-desktop.png) e [home móvel publicada](qa/visual-v1.2/publico-mobile.png).
- [Fiscal publicado](qa/visual-v1.2/fiscal-1440.png) e [preparação publicada](qa/visual-v1.2/ativacao-390.png).

## Histórico e pacote portátil

Os ZIPs 1.0, 1.1, 1.1.1 e 1.2 e os guias já entregues não foram reescritos. O pacote 1.2 continua com **20.664.983 bytes**, 244 entradas e SHA256:

`a80382a08e2ac912c718306132efca880fc8dc8b4c2c23b08c54741d816d5674`

Os relatórios locais `resumo-v1.2.json`, `estado-publicacao-v1.2.json`, o guia de preparação entregue e o README dentro do ZIP registram o momento **anterior** à autorização/publicação. Seus estados “não publicado”, site 1.1.1 e GitHub 1.0 foram preservados como fotografia histórica; este registro posterior descreve o estado remoto atual. O histórico 1.0–1.1.1 continua disponível no Git e nas evidências anteriores.
