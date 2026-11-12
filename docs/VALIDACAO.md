# Validação da entrega

**Data:** 12/11/2026. **Produto testado:** build de produção, modo `portfolio`, Node.js 22.23.5, Chromium do Playwright. Resultados locais, não certificação/auditoria completa nem homologação comercial.

## Resumo comprovado

| Verificação | Resultado | Evidência |
|---|---|---|
| TypeScript | Passou | `npm run typecheck`, repetido após as alterações finais |
| Testes locais | **155 passaram, 7 arquivos** | `qa/vitest-final.json` |
| Build de produção | Passou | `npm run build` e execução standalone por `scripts/start.mjs` |
| Navegador desktop + celular emulado | **64 passaram**, sem falha, pulo ou flaky nessa execução | `qa/playwright-final.json`, `qa/playwright-execucao.log` |
| Acessibilidade automatizada | Zero violações nos testes executados de WCAG 2 A/AA e 2.1 AA | 18 rotas × 2 perfis + 2 janelas/estados × 2 perfis |
| Links coletados | **23 destinos internos retornaram 200**, âncoras verificadas existentes | `qa/links-e-https.json` |
| Dependências | Zero alertas conhecidos reportados pelo npm audit dessa execução | `dependency-audit-final.json`; não inclui revisão manual completa ou garantia futura |
| Restauração | Snapshot gzip PGlite local carregado e verificado em instância independente | `tests/restore.test.ts` |
| Desempenho | 18 carregamentos de laboratório, com condições explícitas | `qa/desempenho-laboratorio.json` |

**Portabilidade adicional:** foi feita uma instalação limpa em outra pasta, sem `node_modules` ou `.next` anteriores. `npm ci` (Node 22.23.5 / npm 10.8.2) e `npm run check` passaram, incluindo os mesmos 155 testes e build. Evidência: `qa/instalacao-limpa.log`. Isso não é teste do container Docker ou da Hostinger.

### Distribuição dos 155 testes locais

- Domínio: **39** — permissões, revisão, transições, autorizações, adicionais, cancelamento, retorno, agenda, financeiros e simulação social.
- Formatação/contratos: **35** — centavos, CSV protegido, datas, payloads e limites.
- Banco/RLS: **47** — migrações, papéis, isolamento, comandos, imutabilidade, vínculos e validação.
- API: **18** — handlers HTTP com autenticação substituída por fixture, executando RPC/RLS no PostgreSQL local.
- Restauração: **1** — PGlite local independente; não Supabase remoto.
- Visibilidade/variantes: **2** — ponteiro da versão atual sem expor rascunho ao cliente; editar legenda específica invalida aprovação.
- Fronteira HTTP/configuração: **13** — limite por bytes/em blocos, UTF-8, origem, MIME, HTTPS, modo, erro genérico, rate-limit e variantes.

Os handlers de API são reais, mas **a identidade de autenticação nesses testes é mockada**. O banco é PGlite com funções de JWT/Auth fictícias. Isso prova regras locais de PostgreSQL/RLS e comportamento dos handlers sob a fixture; não prova cookies, Supabase Auth/PostgREST/TOTP/SMTP, rede ou configuração de um projeto hospedado.

## O que o navegador validou

Perfis: Chromium desktop **1440 × 1000 CSS px** e Pixel 7 emulado **390 × 844 CSS px**. Não equivale a testar Safari/iPhone ou dispositivos físicos.

- 18 rotas de site, landing, links, privacidade, login/segurança/guia, painel/módulos e portal com resposta 200, H1 e ausência de overflow horizontal da página.
- Formulário público fictício → CRM, período preferido e outra sessão independente sem o novo contato.
- Cadastro de cliente/veículo → OS → orçamento pelo formulário.
- Portal → aprovação da versão → liberação da execução → recebimento parcial.
- Adicional → nova versão/pausa da OS e histórico anterior preservado.
- Bloqueio de execução sem aprovação e conflito de agenda com erro visível.
- Falha parcial por rede e recuperação simulada sem tráfego externo.
- Legenda específica por destino, fallback para a base, exportação do texto correto e revisão obrigatória após editar.
- Post somente para Facebook não mostra/exporta uma prévia de Instagram por engano.
- Perfis demonstrativos, reset da sessão, busca por teclado, menu móvel e estados de erro fechados das APIs reais no portfólio.
- Modais com nome acessível, foco contido, Escape e retorno do foco ao botão de origem.
- Noindex, robots, 404 e ausência de scripts de terceiros nas páginas verificadas.
- A fixture principal verifica erros de JavaScript e recursos quebrados; não houve ocorrência nessa execução.

A primeira revisão encontrou contraste e regiões com rolagem sem acesso por teclado. Foram corrigidos. A revisão de foco encontrou retorno ao botão de origem faltante; também foi corrigido e o teste passou. Rótulos de formulário agora separam o texto de ajuda via `aria-describedby`.

**Limite da acessibilidade:** axe não avalia tudo. Não houve auditoria humana completa, estudo com leitores de tela, todos os estados de todas as telas, todas as combinações de zoom/idioma/dispositivo ou certificação WCAG.

## Medição de desempenho — laboratório, não campo

Método: build de produção em servidor local, sem CDN; 3 contextos frios por rota/perfil, cache desabilitado; 150 ms de latência, download de 1,6 Mbps, upload de 750 kbps e CPU desacelerada 4× via CDP. Valores de carregamento abaixo são **medianas**, não p75 de usuários reais.

| Perfil | Rota | FCP | LCP | CLS, quatro casas | Maior duração observada nas interações amostradas |
|---|---|---:|---:|---:|---:|
| Desktop | Site `/` | 1,144 s | 2,124 s | 0,0013 | 88 ms |
| Desktop | Painel | 1,084 s | 2,384 s | 0,0220 | 32 ms |
| Desktop | Portal | 1,076 s | 1,076 s | 0,0006 | 168 ms |
| Celular emulado | Site `/` | 1,136 s | 2,144 s | 0,0849 | 96 ms |
| Celular emulado | Painel | 1,092 s | 2,408 s | **0,1013** | 40 ms |
| Celular emulado | Portal | 1,100 s | 1,100 s | 0,0018 | 104 ms |

A estabilidade visual do painel no celular (**0,1013**) ficou ligeiramente acima da referência de 0,1 e continua um ponto de melhoria, especialmente na troca inicial de fonte/layout. Uma das três amostras móveis de LCP do painel chegou a **2,560 s**; não declarar que toda amostra ficou abaixo de 2,5 s.

As interações são poucas ações fictícias e usam Event Timing com limiar de 16 ms. **Não são INP de campo**, não provam o comportamento no uso prolongado e não justificam uma nota Lighthouse ou promessa de aprovação nos Core Web Vitals. Não houve teste de carga, capacidade, disponibilidade ou rede Supabase.

Script para repetir, com o servidor de produção em execução:

```bash
node scripts/medir-desempenho.mjs
```

## Rede, URL e publicação

- O servidor standalone local respondeu e os fluxos foram exercitados por HTTP na porta 3000.
- A URL HTTPS direta da prévia temporária foi consultada. A infraestrutura E2B retornou **403, exigindo token de acesso ao tráfego**. Não foi tentado contornar essa proteção, ler/publicar token ou anunciar o link como público. A visualização integrada da Arena é gerenciada pela plataforma.
- O projeto Vercel separado foi inspecionado: sem deployments, com proteção de deployment e Node remoto originalmente 26.x. O conector informa que o primeiro deploy exige controles (`projectSettings`) que não expõe. Nenhuma implantação permanente foi concluída ou verificada.
- Não há URL pública definitiva/HTTPS de hospedagem final comprovados, domínio adquirido ou projeto Box Supabase criado.

## Pendências de homologação externa

Docker/Compose/Caddy não foram executados neste ambiente, que não tem Docker. Ainda pendem hospedagem final, DNS/HTTPS/proxy, login/MFA/cookies/Auth remotos, SMTP/recuperação, PostgREST/RLS remotos, backups/restauração remotos, monitoramento, carga e matrizes adicionais por usuário.

Formulários reais, mensagens, redes, pagamentos e storage de anexos não estão ativos. O guia de implantação explica essa separação. O produto é um portfólio funcional e uma base conectada a homologar, **não uma operação comercial certificada**.
