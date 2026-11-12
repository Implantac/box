# Implantação e portabilidade

Referência:12/11/2026. **Código-fonte preparatório 1.2.0, não publicado; site público 1.1.1 e GitHub 1.0.** Roteiro atual em `ATIVACAO-REAL.md`, contrato em `FISCAL-CONTRATO.md`, testes em `VALIDACAO-1.2.md`. Nenhuma operação real foi liberada.

Histórico: fonte e publicação pública **1.1.1**, com a correção visual validada localmente e no site; GitHub ainda **1.0**. Consulte `AJUSTE-VISUAL-1.1.1.md` antes de atualizar. A publicação foi manual a partir do ZIP validado; o histórico anterior foi preservado. Procedimentos para o responsável técnico. Não enviar senhas, tokens ou arquivos `.env` pelo chat.

## 1. Escolher a hospedagem sem contratar por impulso

A aplicação é Next.js 16 / React / TypeScript, com output standalone. Requisitos:

- Node.js **22**, versão usada nos testes, ou Docker compatível.
- Processo contínuo e porta configurável; espaço para dependências e build.
- Reverse proxy HTTPS, domínio/DNS e cabeçalhos compatíveis.
- Saída HTTPS para Supabase apenas se usar o modo conectado.
- Memória e CPU suficientes para o build e a carga, a dimensionar por medição; não há capacidade de usuários ou SLA prometidos.

Uma VPS da Hostinger ou de outro fornecedor pode servir. O nome da hospedagem, sozinho, não garante compatibilidade. PHP/FTP sem Node/Docker não basta. Não foram adquiridos VPS, domínio, certificados pagos ou banco adicional.

## 2. Portfólio com Node

1. Extraia o pacote em uma pasta nova, sem sobrescrever projetos existentes.
2. Instale Node.js 22 e use o `package-lock.json` fornecido.
3. Opcionalmente copie `.env.example` para `.env` e mantenha os dois modos como `portfolio`.
4. Execute:

```bash
npm ci --no-fund
npm run typecheck
npm test
npm run build
npm run start
```

`npm run start` usa `scripts/start.mjs`: copia assets públicos e estáticos para o standalone e inicia `server.js`. Não é necessário `next start` sobre esse output. Use um supervisor da hospedagem/systemd, com usuário sem privilégios e diretório de trabalho na raiz do projeto.

Variáveis de runtime: `PORT=3000` por padrão; `BOX_BIND_HOST=0.0.0.0` por padrão. **Nunca coloque `localhost` no código do navegador para acessar outro servidor.** O frontend usa caminhos relativos da mesma origem.

`NEXT_PUBLIC_APP_MODE` é incorporado ao build. Mudar o modo exige um novo build e o mesmo `APP_MODE` no runtime. O endpoint `/api/health` devolve 503 quando os modos declarados divergem, mas não substitui teste do banco.

## 3. Docker / VPS

```bash
cp .env.example .env
# manter portfolio nos dois modos; nenhuma credencial é necessária
# revisar portas e serviços existentes antes de executar
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 box
```

O Dockerfile usa estágios separados, runtime sem root, sem credenciais no build e sem chave de serviço. O compose restringe a porta a `127.0.0.1` da VPS e limita rotação dos logs. Portas públicas 80/443 e proxy são responsabilidade da implantação.

Exemplo: Caddy instalado no host, utilizando `deploy/Caddyfile.example`. Substitua o domínio de exemplo por um domínio autorizado, configure DNS e valide HTTPS. Não há certificado/domínio já configurado neste pacote. Se usar proxy em outro container, `127.0.0.1` apontará para o próprio container: use uma rede de containers e o nome do serviço `box:3000`, adaptando o exemplo conscientemente.

O container **não foi construído/testado neste ambiente**. Antes de considerar a instalação pronta, construa na VPS/homologação e verifique saúde, reinício, permissões, proxy e assets. A execução standalone nativa foi testada; não é prova de funcionamento do Docker, Caddy ou plano Hostinger.

## 4. Modo conectado: ambiente separado, ainda com dados fictícios

Esse modo não é ativado pela entrega nem requer criar banco para experimentar a demo.

1. Confirme autorização e o custo de um **novo projeto dedicado** do Supabase. Nunca use outro negócio como ambiente de teste. Nenhum projeto Box foi criado no Supabase nesta entrega.
2. Habilite autenticação por e-mail/senha e TOTP. Desabilite cadastro público, configure URLs de origem, SMTP/limites e recuperação por canal verificado no provedor. Não existe tela pública de autocadastro ou recuperação de senha no aplicativo.
3. Aplique, em ordem, os quatro SQLs de `supabase/migrations/`, em homologação: `202611120001_box_core.sql`, `202611120002_validation_and_public_content.sql` , `202611120003_inventory_team_commissions.sql` e `202611120004_fiscal_readiness.sql`. Em um ambiente que já tenha migrações anteriores, aplique somente as pendentes, após backup/restauração de teste e conferência do histórico; não reaplique as anteriores às cegas. Use a ferramenta de migrações do provedor ou `psql` com credenciais em arquivo/secret seguro. Não execute em banco compartilhado. Os scripts contêm `BEGIN/COMMIT` e funções exclusivas `box_*`.
4. Crie no Auth a conta **individual** do primeiro administrador, sem publicar sua senha. Obtenha o UUID real pelo painel do provedor.
5. Leia `supabase/provisionar-admin.sql`. É um procedimento administrativo separado, não executado automaticamente. Ele exige `admin_user_id` existente e `admin_name` e devolve o UUID do novo workspace. Não cria conta Auth nem envia convites.
6. Configure no servidor, por canal seguro:

```dotenv
APP_MODE=connected
NEXT_PUBLIC_APP_MODE=connected
APP_ORIGIN=https://SEU-DOMINIO-VALIDADO
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=CHAVE_PUBLICAVEL_DO_PROJETO_DEDICADO
BOX_WORKSPACE_ID=UUID_REAL_RETORNADO_NO_PROVISIONAMENTO
```

Os valores acima são **modelos, não credenciais utilizáveis**. A aplicação web não utiliza service role. Não copie IDs de clientes ou workspaces alheios. Não reutilize as identidades fictícias dos testes como usuários de produção.

7. Refaça o build, reinicie, use HTTPS e entre em `/entrar`. O primeiro acesso registra TOTP; acessos seguintes exigem o código. MFA é obrigatório também no SQL, inclusive em chamadas diretas às RPCs. Não há opção de desligá-lo por uma variável no app.
8. Cadastre equipe individualmente no Auth e vincule `auth.users` a `box_members` por administração autorizada. Contas de cliente precisam de `customer_id` que exista no mesmo workspace. Não existe autopromoção pelo navegador.
9. Nomes de responsáveis técnicos devem ser únicos no workspace e estáveis: esta versão associa OS/agenda ao `display_name` da equipe, protegido por índice único para funções técnicas. Renomear um responsável exige procedimento de atualização de vínculos, não apenas editar um nome no banco. Os serviços novos usam UUID do cadastro operacional do mecânico, associado opcionalmente a `userId` da conta individual. O cadastro operacional não cria Auth/convite. Para habilitar um técnico conectado, o administrador precisa provisionar a conta e um cadastro já com vínculo válido; nomes devem coincidir com o membro técnico. O formulário preserva nome/conta existentes. Vinculações ou renomeações posteriores exigem migração administrativa planejada; não há botão ou rotina automática para reatribuir históricos.
10. Execute a matriz de homologação de `SEGURANCA.md`, incluindo duas contas de cliente e chamadas à API. Valide backup/restauração, sessão, limites, falhas e operação. **Sem essa etapa, não introduza dados reais.**

O backend implementa cadastros, OS, versões/respostas, agenda, lançamentos, estoque, alocações, indisponibilidades, comissões/repasses e conteúdo revisado. A terceira e a quarta migrações foram aplicadas somente em PGlite local. Os cadastros/rascunhos fiscais conectados são preparatórios; simulações são proibidas no SQL. O conector, produtor/worker e artefatos reais não estão implementados/implantados. Ela não importa clientes, não cria estoque/equipe reais nem executa transferências. O GET do workspace exige schemaVersion 4 e rejeita esquema antigo/incompleto com 503; não preenche arrays vazios para fingir migração concluída. A leitura pública do site expõe somente quatro campos institucionais. O formulário público real, redes, pagamentos, e-mail/WhatsApp e anexos permanecem desativados/não implementados: configurar o banco não os ativa.

## 5. Vercel, opção e não dependência

### Correção visual 1.1.1 publicada e verificada

Mesmo projeto `box-portfolio`, domínio https://box-portfolio-orpin.vercel.app, deployment `dpl_F2C2uUAyeViorNM44AfjpFHTViJJ`, **READY/PROMOTED**, Node.js 22.x. Código-fonte enviado manualmente de `projeto/` do ZIP 1.1.1; 93 hashes conferidos. **96/96 E2E públicos**, oito tamanhos de layout e HTTPS/26 rotas passaram. Logo completa, sem cartão sobreposto; regras operacionais preservadas. Consulte `AJUSTE-VISUAL-1.1.1.md` e `qa/publicacao-v1.1.1.json`. ZIPs anteriores preservados; nenhum banco/contratação ou alteração em AGROTECH. Sessão temporária do CLI encerrada. **GitHub ainda na 1.0**; sincronizar antes de redeployar main.

### Histórico: versão 1.0 publicada e verificada em 12/11/2026

- Projeto autorizado e dedicado: **`box-portfolio`**, equipe `implantacs-projects`, plano Hobby atual.
- Público, sem login: **https://box-portfolio-orpin.vercel.app**.
- Repositório: `https://github.com/Implantac/box`, branch `main`.
- Commit implantado: `f261c49b4c302f9894dce1f1b04cc2966890f746`.
- Deployment: `dpl_EkWdWfCcz7vBgUdDAuMy29uH9xs3`, produção, **READY/PROMOTED**.
- Build `npm run build`; instalação `npm ci --no-audit --no-fund`; Next.js detectado, sem root adicional ou saída estática personalizada. O build remoto usou **Node.js 22.x**, conforme `engines.node`.
- `APP_MODE=portfolio`, `NEXT_PUBLIC_APP_MODE=portfolio` e `NEXT_TELEMETRY_DISABLED=1` nos três ambientes. Não há credenciais de banco ou redes na demo.
- HTTPS com certificado validado, health e fluxos anônimos verificados. **64/64 testes** na URL pública passaram em desktop e celular emulado; evidências em `qa/playwright-vercel.json` e `qa/vercel-smoke.json`.

**Não utilizar `box-oficina-portfolio`: ele está ligado ao AGROTECH.** O usuário determinou preservá-lo e autorizou separadamente criar `box-portfolio`. Não recriar nenhum dos dois nem alterar outros projetos.

A proteção padrão da Vercel foi preservada. Alguns aliases técnicos/deployment redirecionam para login; o domínio principal acima responde publicamente. Não é necessário desativar proteção, obter bypass, comprar domínio ou contratar plano para acessar esse endereço já verificado.

### Histórico: atualização 1.1.0 publicada com autorização

- Mesmo projeto dedicado e domínio público: **`box-portfolio`**, https://box-portfolio-orpin.vercel.app. Não foi criado outro projeto.
- Deployment `dpl_FJeBwpr2YfyojHSV53HdXexGV7k4`, produção **READY/PROMOTED**, origem `cli`, a partir de `projeto/` do ZIP 1.1 entregue.
- SHA-256 do ZIP: `d330a9895739c2909b6fdb920be988039fdc9af4c48d46f260f1a480a7a40071`. Os 83 hashes validados foram conferidos; código não alterado para publicar.
- Build remoto usou **Node.js 22.x** por `engines.node`, apesar do padrão 26.x do projeto; confirmado no deployment e em `qa/vercel-build-v1.1.log`.
- HTTPS anônimo, certificado/noindex, 26 rotas com 200, API privada 403, 404 esperado e **92/92 testes remotos** passaram. Zero falha, pulo ou flaky.
- Proteção SSO intacta; aliases técnicos continuam 302 para login, sem contorno. Sessão temporária do CLI encerrada e seu diretório de autenticação removido.
- Nenhum SQL remoto, banco novo, dados reais, rede social ou contratação.

**O GitHub continua no commit 1.0 acima.** A publicação 1.1 não veio de um novo commit. O vínculo Git continua com **deploy automático desabilitado**. Sincronize o repositório antes de redeployar `main`, para não voltar à versão antiga. Um push isolado não comprova atualização do site. Para novos envios, use somente `box-portfolio` e confirme fonte/commit e modos antes de repetir HTTPS/fluxos. Não alterar AGROTECH.

Para repetir as verificações, com Node.js 22 e as dependências de testes instaladas, use:

```bash
BOX_TEST_URL=https://box-portfolio-orpin.vercel.app node scripts/verificar-deploy.mjs
BOX_TEST_URL=https://box-portfolio-orpin.vercel.app npx playwright test --config=playwright.release.config.ts
```

O script confere a versão do health contra o `package.json` local. Resultados 1.1 em `qa/deploy-v1.1.0-smoke.json`, `qa/vercel-https-v1.1.json`, `qa/playwright-deploy-v1.1.{json,log}` e `qa/publicacao-v1.1.json`. Relatórios remotos 1.0 permanecem em `qa/playwright-vercel.json`. Os arquivos pós-publicação complementam a documentação pré-publicação do ZIP intacto; não foram enviados ao GitHub nem provocaram novo deploy. Nenhum upgrade, domínio pago ou banco foi contratado. Cotas e políticas do plano atual continuam aplicáveis; qualquer mudança paga exige nova autorização.

## 6. Atualizar e voltar atrás

No modo portfólio, a sessão antiga é ampliada sem serviços ou comissões retroativos. Para apresentar a nova base completa, exporte a sessão fictícia se necessário e reinicie explicitamente; não apague sessões de visitantes por uma migração automática. Não há importação/sincronização offline.


- Gere uma versão identificada do fonte e lockfile, rode a bateria de testes e faça backup antes de migrações.
- Não rode `npm audit fix --force` em produção sem avaliar mudanças.
- Construa a versão nova em pasta/imagem separada, verifique e só depois troque o serviço.
- Reversão do app: voltar à versão anterior apenas se for compatível com o esquema atual.
- Reversão de dados não é apagar tabelas: restaure em ambiente isolado, compare e planeje com o responsável. Não há down migration destrutiva automática.
- Revise dependências e runtime periodicamente. A ausência de alertas no `npm audit` de uma data não garante ausência de vulnerabilidades futuras.
