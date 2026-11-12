# Validação — versão 1.1.0 local e pública

## Evolução local 1.2.0

Os resultados atuais estão separados em `VALIDACAO-1.2.md`. Incluem fiscal/preflight/SQL/API e navegador local, não publicação remota nem homologação de provedor. As evidências 1.0/1.1/1.1.1 abaixo são históricas e não aprovam automaticamente o código 1.2.


> **Registro histórico da 1.1.0.** Para os resultados da correção visual 1.1.1 (273 testes locais, 96 E2E e matriz de oito telas), consulte [Ajuste visual 1.1.1](AJUSTE-VISUAL-1.1.1.md).

**Data:** 12/11/2026. Produto: build de produção em modo `portfolio`, Node.js **22.23.5**, npm **10.8.2**, Chromium do Playwright. A evolução **foi publicada com autorização** no projeto dedicado `box-portfolio`, a partir do ZIP validado, e passou **92/92 testes remotos**. O GitHub continua na 1.0; nenhum banco remoto foi criado/migrado. Resultados locais, publicação atual e histórico 1.0 estão separados abaixo.

Não é certificação, auditoria completa, teste de carga ou homologação comercial.

## Resultado final da evolução

| Verificação | Resultado executado | Evidência |
|---|---|---|
| TypeScript | Passou após as alterações finais | `npm run typecheck`; também repetido na instalação limpa |
| Testes locais | **273/273, 10 arquivos** | `qa/vitest-v1.1.{json,log}` |
| Build de produção | Passou; servidor standalone iniciado na porta 3001 | `qa/build-v1.1.log`, `scripts/start.mjs` |
| Navegador desktop + celular emulado | **92/92**, zero falha, pulo ou flaky na execução final | `qa/playwright-v1.1.{json,log}` |
| Rotas por requisição HTTP local | **26 retornaram 200**; API privada 403 e caminho inexistente 404, conforme esperado | `qa/http-smoke-v1.1.json` |
| Acessibilidade automatizada | Zero violações de axe nos cenários executados WCAG 2 A/AA e 2.1 AA | 21 rotas × 2 perfis e janelas/estados selecionados |
| Instalação limpa | `npm ci` e `npm run check` passaram, incluindo os mesmos 273 testes e build | `qa/instalacao-limpa-v1.1.log` |
| Dependências | npm audit reportou **0 alertas conhecidos**, 149 dependências na metainformação | `dependency-audit-v1.1.json`; não é garantia futura |
| Restauração | Snapshot PGlite carregado em instância independente, com vínculos/RLS e os novos documentos | `tests/restore.test.ts` |
| Fotografia do fonte validado | Hashes de 83 arquivos de fonte, testes, migrações e configurações | `qa/resumo-v1.1.json`; o empacotador verifica esses hashes |

**Execuções finais:** Vitest iniciou em **17:05:19 UTC**, duração reportada **18,47 s**. Playwright iniciou em **17:08:09 UTC**, duração **161,21 s**. A validação limpa final começou em **17:08:08 UTC**, em outra pasta, sem dependências ou build anteriores. Houve sobreposição dessas duas validações locais; não comparar seus tempos como benchmark.

### Distribuição dos 273 testes locais

| Arquivo | Casos | Foco |
|---|---:|---|
| `domain.test.ts` | 39 | Regras da base, permissões, OS/orçamentos, agenda e histórico |
| `format-validation.test.ts` | 35 | Centavos, CSV protegido, datas, contratos e limites |
| `database.test.ts` | 47 | Migrações, RLS, papéis, vínculos e imutabilidade da base |
| `api.test.ts` | 30 | Handlers HTTP com identidade de teste e RPC/RLS local, novos fluxos e erros |
| `restore.test.ts` | 1 | Restauração independente de PGlite, incluindo peças/serviços/comissões/repasses |
| `quote-visibility.test.ts` | 2 | Versão atual sem rascunho privado e revisão das variantes de conteúdo |
| `auth-boundary.test.ts` | 13 | Origem, MIME, bytes/blocos, modo/configuração, erros e rate-limit |
| `workshop.test.ts` | 53 | Estoque, autorização, disponibilidade, execução e comissão em centavos |
| `workshop-database.test.ts` | 42 | SQL/RLS/RPC novos, permissões, MFA, imutabilidade e revisão |
| `workspace-search.test.ts` | 11 | Busca, acentos, recortes e limites por perfil/vínculo |

A suíte cresceu de 155 para 273 casos. As expectativas de acesso técnico foram ajustadas para permitir acompanhar OS com **item próprio**, sem liberar a edição geral de OS alheia. Não reutilizar o número histórico como se fosse prova dos módulos novos.

## O que os novos testes cobrem

- Saldo físico, reserva pendente e disponibilidade; ajuste não consome reserva nem torna saldo negativo.
- Peça exige código único; unidade fica preservada após movimento; quantidades inteiras e motivos são obrigatórios.
- Reserva depende de OS aberta, peça vinculada e versão atual aprovada, sem exceder o autorizado/disponível.
- Baixa não é repetida, custo é fotografado e devolução não excede a baixa original nem usa o novo custo cadastral.
- Nova versão libera reservas e pausa serviços abertos; quantidade já consumida não pode desaparecer sem devolução pertinente.
- Disponibilidade considera agenda, execução, alocações e ausências. Uma execução atrasada não fica livre automaticamente.
- Alocação exige item de mão de obra aprovado, um responsável e horário sem conflito. Início exige OS em execução.
- Técnico só altera seu serviço; pode acompanhar OS de outro responsável sem ganhar edição de diagnóstico/etapa geral.
- Percentual exclui peças, rateia desconto por maior resto e arredonda em centavos; fixo é pelo item inteiro; nenhuma comissão é permitida.
- Regra e base são fotografadas; mudar padrão não altera o histórico. Só conclusão gera comissão, sem efetuar pagamento.
- Parciais/estornos respeitam saldos e preservam lançamentos; repasses não duplicam o custo já gerado.
- Revisão/cancelamento conserva previsões anteriores, serviços concluídos e comissões já geradas.
- Documentos de comissão não aparecem para recepção/técnico/marketing/cliente; SELECT e RPC diretos também foram exercitados.
- Documento operacional e seu retry não carregam exceção financeira privada. Tentativas com exceção são autorizadas **antes** de comparar duplicidade, evitando um teste de valores privados por retry.
- Entry point antigo e helpers internos não podem contornar os controles; helpers de vínculo expostos não confirmam dados sem MFA.
- Requisições HTTP exercitam entrada/retry, reserva/liberação/baixa/devolução, alocação/conclusão, parcial/estorno, erros de papel, quantidade, migração ausente e revisão antiga.
- Busca localiza registros por campos previstos, ignora acentos, limita resultados e respeita o perfil. Termos não vão a URLs ou analytics; os recortes usam IDs.

### Limite do teste de concorrência

A função SQL bloqueia a linha do workspace e exige revisão esperada. Duas solicitações com a mesma revisão, enfileiradas em **PGlite de conexão única**, confirmaram somente uma e a outra retornou `40001`; o HTTP transforma revisão antiga em 409.

Isso testa a regra de revisão na fila local. **Não foi ensaiada concorrência multiconexão real**, disputa de locks/deadlock ou carga em PostgreSQL/Supabase hospedado. Antes de operação real, repetir reservas, baixas, repasses, horários e versões em conexões/transações independentes.

### Limite dos testes de API e banco

Os handlers HTTP são reais, mas **a identidade Auth é substituída por fixture**. O banco local PGlite usa funções JWT/Auth fictícias. Cada chamada simulada recupera sua transação em caso de erro, reproduzindo a separação entre requisições; isso não é PostgREST remoto.

As três migrações foram executadas na fixture. Não foram comprovados Supabase Auth/TOTP/cookies/SMTP/PostgREST, rede, configuração, backups de Auth/Storage ou restauração externa. Cadastrar mecânico não cria login, vínculo de conta ou usuário real.

## Navegador e acessibilidade

Chromium desktop **1440 × 1000 CSS px** e Pixel 7 emulado **390 × 844 CSS px**. Não é Safari/iPhone ou aparelho físico.

A bateria final reúne os fluxos da base e **11 jornadas novas em cada perfil**, além das três novas rotas:

1. Cadastro de peça → entrada → ajuste motivado → edição de custo/unidade histórica.
2. Bloqueio de etapa com serviço/reserva pendentes → liberação → reserva → baixa → devolução e avanço.
3. Reserva e serviço bloqueados na própria OS sem aprovação, sem redirecionar silenciosamente para outra OS.
4. Alocação fixa → início/pausa/retomada/conclusão → repasse parcial/estorno sem custo duplicado.
5. Regra fixa/nenhuma/percentual e histórico de comissão intacto.
6. Disponibilidade, ausência/cancelamento motivado e conflito visível sem criar registro.
7. Técnico executa item próprio em OS de outro principal; etapa/diagnóstico geral continuam bloqueados.
8. Adicional → liberação/pausa → aprovação → revisão do vínculo e nova previsão, sem apagar a anterior.
9. Busca desktop/móvel → peça/profissional/serviço/comissão corretos e bloqueio por perfil.
10. CSV de estoque e comissão respeita o recorte.
11. Código duplicado mantém o formulário aberto, sem novo cadastro ou mensagem fictícia de sucesso.

Também foram repetidos landing→CRM, cliente/veículo/OS/orçamento, portal/aprovação, recebimento parcial, agenda, adicionais, conteúdo por rede e falha/recuperação simulada, reset/isolamento de sessão, menu/teclado, 404/noindex e bloqueio das APIs reais no portfólio.

As 21 rotas tiveram resposta 200, H1, ausência de overflow horizontal da **página** e axe sem violações nos cenários selecionados. Tabelas largas têm rolagem própria intencional e acesso por teclado. Não houve erros JavaScript/recursos quebrados nos cenários monitorados. Capturas finais: `qa/{desktop,mobile}-chromium-painel-{estoque,mecanicos,comissoes}.png`.

**Axe não avalia tudo:** não houve auditoria humana completa, estudo de leitores de tela, todas as combinações de zoom/estado/dispositivo ou certificação WCAG.

## Revisões intermediárias resolvidas

- A primeira passagem SQL devolvia validação antes da autorização em uma OS alheia; a checagem de papel/vínculo foi antecipada e a regressão passou.
- A ampliação dos testes HTTP identificou que a fixture de transação única permanecia abortada após um erro esperado. Foi corrigida com savepoint por chamada; não era prova de falha de transação do PostgREST hospedado.
- A primeira bateria dos novos formulários teve **20/22**: os dois seletores do botão “Registrar indisponibilidade” eram ambíguos entre página e modal. O teste foi escopado à janela correta e a suíte completa passou **92/92**, repetida depois da revisão final de privacidade.
- O retry operacional foi separado da comissão privada e a autorização da exceção antecipada, com regressões no domínio, SQL e HTTP. Helpers de vínculo também foram verificados sem MFA.

Logs intermediários permanecem no workspace para rastreio; o ZIP inclui evidências finais selecionadas, não rascunhos/falhas já resolvidas.

## Desempenho: histórico 1.0, não nova medição 1.1

**Não houve nova campanha de desempenho nesta evolução.** As 18 medições anteriores são apenas referência histórica: build local sem CDN, três contextos frios por rota/perfil, cache desabilitado, latência de 150 ms, download 1,6 Mbps, upload 750 kbps e CPU 4× via CDP. Medianas, não p75 de usuários reais.

| Perfil/rota, base 1.0 | FCP | LCP | CLS | Maior interação amostrada |
|---|---:|---:|---:|---:|
| Desktop / site | 1,144 s | 2,124 s | 0,0013 | 88 ms |
| Desktop / painel | 1,084 s | 2,384 s | 0,0220 | 32 ms |
| Desktop / portal | 1,076 s | 1,076 s | 0,0006 | 168 ms |
| Celular / site | 1,136 s | 2,144 s | 0,0849 | 96 ms |
| Celular / painel | 1,092 s | 2,408 s | **0,1013** | 40 ms |
| Celular / portal | 1,100 s | 1,100 s | 0,0018 | 104 ms |

O CLS móvel histórico do painel ficou acima de 0,1; uma amostra LCP chegou a **2,560 s**. Não foi declarado aprovado. Interações amostradas por Event Timing não são INP de campo. Não há nota Lighthouse, teste de carga ou comprovação de Core Web Vitals de campo. Evidência antiga: `qa/desempenho-laboratorio.json`. Script: `scripts/medir-desempenho.mjs`.

## Publicação autorizada 1.1.0

- Público: **https://box-portfolio-orpin.vercel.app**. Projeto `box-portfolio/prj_s2lz8fMNbxGAR6qJye5KHu5gxBFc`; equipe `team_1A1MXMKRlbBUFJJTs5xjNKrk`; plano Hobby atual.
- Deployment **`dpl_FJeBwpr2YfyojHSV53HdXexGV7k4`**, origem **CLI**, produção **READY/PROMOTED** em 12/11/2026. Build remoto com Node.js **22.x** por `engines.node`; o padrão 26.x do projeto não prevaleceu.
- Fonte: `projeto/` do ZIP 1.1 entregue, SHA-256 `d330a9895739c2909b6fdb920be988039fdc9af4c48d46f260f1a480a7a40071`. **83 hashes conferidos**, sem mudança de código/testes para esta publicação. ZIPs 1.0/1.1 intactos.
- HTTPS anônimo e certificado/hostname verificados: **26 rotas com 200**, workspace 403 e inexistente 404 esperados; noindex/robots preservados. Health **1.1.0 / portfolio / not-used / disabled**. Evidência: `qa/vercel-https-v1.1.json`.
- Smoke passou: novas telas, landing→CRM fictício, aprovação no portal e navegação móvel; zero erro JavaScript observado. `qa/deploy-v1.1.0-smoke.{json,log}`.
- **92/92 E2E remotos**, zero falha/pulo/flaky, início **18:33:51.880 UTC**, duração **170,76 s**, desktop 1440×1000 e Pixel 7 emulado 390×844. Inclui as 11 jornadas novas por perfil e axe selecionado. `qa/playwright-deploy-v1.1.{json,log}`; capturas `qa/*-deploy-v1.1-*.png`.
- **GitHub não atualizado:** `Implantac/box/main` continua em `f261c49b4c302f9894dce1f1b04cc2966890f746`. Não atribuir esse commit à nova publicação. Deploy automático Git permanece desabilitado; redeployar `main` antes da sincronização pode voltar à 1.0.
- SSO preservado: os aliases técnicos continuam 302 para login; sem bypass ou desativação. Sessão temporária do CLI encerrada; diretório de autenticação removido. `qa/vercel-protection-v1.1.json`, `qa/vercel-session-cleanup-v1.1.json`.
- Registro consolidado: `qa/publicacao-v1.1.json`. Os relatórios e esta atualização documental são posteriores ao ZIP, não um novo pacote ou deploy. `qa/resumo-v1.1.json` preserva a fotografia **local pré-publicação**.

O teste público confirma o portfólio e seus bloqueios, não Auth/MFA/PostgREST/SMTP remotos, concorrência multiconexão, Docker/Hostinger, pagamentos ou backup externo. Nenhuma migração remota, dado real, novo projeto ou contratação.

## Histórico separado da base 1.0 e publicação anterior

- Base local: **155 testes/7 arquivos**, build/instalação limpa e **64/64 E2E** em 66,87 s. Relatórios preservados: `qa/vitest-final.json`, `qa/playwright-base-v1.0.json`, `qa/playwright-execucao.log` e `qa/instalacao-limpa.log`. O relatório de navegador base foi preservado a partir do ZIP 1.0, sem alterar esse ZIP.
- Antes da publicação, 23 destinos internos retornaram 200: `qa/links-e-https.json`. A prévia temporária E2B exigiu token de tráfego por HTTPS direto; não houve tentativa de contorno. Isso não é falha da aplicação nem prova de link público.
- Publicação anterior autorizada: **https://box-portfolio-orpin.vercel.app**, projeto dedicado **`box-portfolio`**, Hobby atual, commit **`f261c49b4c302f9894dce1f1b04cc2966890f746`**, deployment **`dpl_EkWdWfCcz7vBgUdDAuMy29uH9xs3`**, READY/PROMOTED, Node.js 22.x.
- HTTPS anônimo, certificado, noindex e health da base 1.0 verificados. Alguns aliases técnicos continuam protegidos; a proteção não foi removida. Evidências: `qa/vercel-{https,smoke}.json`.
- **64/64 testes remotos**, zero pulo/falha/flaky na execução final anterior, início **16:06:48 UTC**, duração **81,71 s**; `qa/playwright-vercel.{json,log}`. A primeira passagem 63/64 por foco antes da hidratação foi corrigida no teste e repetida; os 64 são históricos, não os 92 da 1.1.

**A 1.1 foi publicada manualmente, mas não enviada ao GitHub.** Nenhum SQL remoto foi aplicado, projeto Supabase criado, dado real migrado ou serviço pago contratado. AGROTECH/`box-oficina-portfolio` foram preservados. O deploy automático Git continua desabilitado; não presumir que push publica.

## Pendências externas e limites

Docker/Compose/Caddy/Hostinger, DNS/domínio próprio fora do domínio Vercel publicado, Auth/MFA/cookies/SMTP/PostgREST remotos, concorrência multiconexão, backups/restauração remotos, monitoramento, carga e outros dispositivos ainda precisam de homologação. Custos e responsáveis devem ser confirmados antes da contratação/uso.

Formulários reais, mensagens, redes, pagamentos e anexos privados não estão ativos. O produto continua um **portfólio funcional não comercial e uma base conectada a homologar**, não uma operação comercial certificada. O plano de 46 itens não foi declarado concluído.
