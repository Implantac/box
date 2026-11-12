# Implantação e portabilidade

Referência: 12/11/2026. Procedimentos para o responsável técnico. Não enviar senhas, tokens ou arquivos `.env` pelo chat.

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
3. Aplique, em ordem, os dois SQLs de `supabase/migrations/`, em homologação. Use a ferramenta de migrações do provedor ou `psql` com credenciais em arquivo/secret seguro. Não execute em banco compartilhado. Os scripts contêm `BEGIN/COMMIT` e funções exclusivas `box_*`.
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
9. Nomes de responsáveis técnicos devem ser únicos no workspace e estáveis: esta versão associa OS/agenda ao `display_name` da equipe, protegido por índice único para funções técnicas. Renomear um responsável exige procedimento de atualização de vínculos, não apenas editar um nome no banco. IDs estáveis de atribuição são evolução recomendada.
10. Execute a matriz de homologação de `SEGURANCA.md`, incluindo duas contas de cliente e chamadas à API. Valide backup/restauração, sessão, limites, falhas e operação. **Sem essa etapa, não introduza dados reais.**

O backend implementa cadastros, OS, versões/respostas, agenda, lançamentos e conteúdo revisado. A leitura pública do site expõe somente quatro campos institucionais. O formulário público real, redes, pagamentos, e-mail/WhatsApp e anexos permanecem desativados/não implementados: configurar o banco não os ativa.

## 5. Vercel, opção e não dependência

Projeto separado já criado: **`box-oficina-portfolio`**. Não recriar nem modificar outros projetos.

Limitação da conexão disponível: `create_deployment` não expõe `projectSettings` nem a confirmação de autodetecção exigidas no primeiro deploy. A alteração da proteção de deployment também não está exposta. Não foi feita uma tentativa com conteúdo incompleto, nem contornado o controle criando outro projeto.

Para um operador com acesso ao painel/CLI oficial:

1. Abra o projeto existente, confirme equipe e plano pessoal/não comercial. Nenhum upgrade está autorizado automaticamente.
2. Use o fonte deste pacote, selecione Next.js, Node.js 22, build `npm run build`, instalação `npm ci --no-audit --no-fund`, sem diretório estático de saída e sem root adicional.
3. Mantenha `APP_MODE` e `NEXT_PUBLIC_APP_MODE` como `portfolio` nos ambientes desejados. Não coloque credenciais de outros projetos.
4. Conclua o primeiro deploy pelo fluxo oficial, sem inventar domínio ou repositório.
5. Para portfólio público, revise a proteção da Vercel conscientemente. O projeto foi retornado com `all_except_custom_domains`; isso pode impedir acesso anônimo ao endereço Vercel. Não comprar domínio para contornar isso.
6. Verifique a URL HTTPS efetivamente emitida, em sessão anônima, e execute as mesmas verificações de navegação e formulários. Só então declarar a publicação concluída.

O `engines.node` está fixado em `22.x`; o projeto remoto inicialmente retornou Node 26.x. Confirme que o runtime do deployment respeita o manifesto. Não foi anunciado um endereço permanente funcionando.

## 6. Atualizar e voltar atrás

- Gere uma versão identificada do fonte e lockfile, rode a bateria de testes e faça backup antes de migrações.
- Não rode `npm audit fix --force` em produção sem avaliar mudanças.
- Construa a versão nova em pasta/imagem separada, verifique e só depois troque o serviço.
- Reversão do app: voltar à versão anterior apenas se for compatível com o esquema atual.
- Reversão de dados não é apagar tabelas: restaure em ambiente isolado, compare e planeje com o responsável. Não há down migration destrutiva automática.
- Revise dependências e runtime periodicamente. A ausência de alertas no `npm audit` de uma data não garante ausência de vulnerabilidades futuras.
