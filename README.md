# BOX Experience
## Portfólio integrado de oficina — versão 1.0

**Projeto independente, não comercial. Todos os atendimentos, pessoas, veículos, valores e resultados demonstrativos são fictícios. Não é o canal oficial da oficina.**

Site institucional + landing page + portal do cliente + workspace operacional + central de conteúdo. Identidade proposta em grafite, preto e dourado, com o emblema conceitual escolhido na conversa.

## Comece pela experiência

| Caminho | O que explorar |
|---|---|
| `/` | Site institucional e formulário fictício integrado ao CRM |
| `/cambio-automatico` | Landing page conceitual, sem diagnóstico ou preço de reparo |
| `/bio` | Links para site, landing, gestão e portal |
| `/painel` | Visão geral, OS, clientes/veículos, agenda, CRM, orçamentos, financeiro, conteúdo, relatórios e configurações |
| `/cliente` | Atendimento fictício de Clara, orçamento e resposta confirmada |
| `/guia` | Orientação resumida de instalação |
| `/privacidade` | Limites da demonstração e uso do armazenamento de sessão |

### Uma visita guiada de cinco minutos

1. Na landing, clique **Simular solicitação**. Veja o novo registro no CRM; nenhuma mensagem ou reserva real é feita.
2. No painel, abra uma OS. Queixa e diagnóstico são campos separados.
3. No portal, aprove o orçamento fictício de Clara. Volte à OS do Corolla e avance para execução.
4. Crie uma nova versão de orçamento. A versão anterior permanece, e a execução fica aguardando nova aprovação.
5. Na central de conteúdo, abra o primeiro post e marque a falha parcial no Facebook. Simule, veja o resultado por rede e simule a recuperação.
6. Em configurações, exporte ou reinicie sua sessão. Trocar o perfil no cabeçalho apenas demonstra visões; não é autenticação.

## Instalar sem Vercel

**Runtime validado: Node.js 22.** Instalação limpa com `npm ci`, typecheck, 155 testes e build também passaram em uma pasta sem dependências/build anteriores. Requer processo Node contínuo; não é um site estático para upload por FTP.

```bash
npm ci
npm run build
npm run start
```

Abra `http://localhost:3000`. O modo padrão é `portfolio`, sem credenciais. O comando de início prepara o output standalone e escuta em `0.0.0.0`; `PORT` pode ser definido pela hospedagem.

Com Docker Compose:

```bash
docker compose up -d --build
```

O exemplo expõe somente `127.0.0.1:3000` **na máquina da hospedagem**. Coloque um proxy HTTPS na frente; exemplo em `deploy/Caddyfile.example`.

**Hostinger:** uma VPS ou oferta Node com os recursos necessários pode hospedar a aplicação. O plano exato não foi contratado nem validado. Um plano limitado a PHP/FTP não executa esta stack.

A portabilidade é do **servidor da aplicação**. O adaptador conectado usa Supabase Auth + PostgreSQL/PostgREST. Para sair também do Supabase, hospede a stack Supabase ou desenvolva outro adaptador de autenticação/dados; PostgreSQL puro não é substituto direto deste adaptador.

## Dois modos, sem confusão

| Portfólio, padrão | Conectado, homologação |
|---|---|
| Dados fictícios na memória/sessionStorage | Banco dedicado + autenticação real |
| Perfis demonstrativos, sem senha | Conta individual, cookie HttpOnly e MFA |
| Sessão isolada por navegador/aba, não compartilhada entre visitantes independentes | Vínculo e papel verificados no servidor e no banco |
| Sem envio ou cobrança externa | Envios sociais, mensagens, pagamentos e captação pública continuam bloqueados |
| Pronto para explorar nesta entrega | Código e migrações presentes; precisa configurar e validar o ambiente real |

Não use dados pessoais reais em nenhum modo desta entrega de portfólio. A base de demonstração é datada de **12/11/2026**, intencionalmente fixa. Uma recarga completa volta o perfil de exploração para proprietário; o estado fictício continua na sessão. A navegação interna mantém o perfil selecionado.

## Documentação que acompanha o código

- [Implantação e atualização](docs/IMPLANTACAO.md)
- [Segurança e modelo de acesso](docs/SEGURANCA.md)
- [Operação, falhas e backups](docs/OPERACAO-E-BACKUPS.md)
- [Escopo implementado, simulado e pendente](docs/ESCOPO-E-LIMITES.md)
- [Resultados de validação](docs/VALIDACAO.md)
- [Créditos e licenças](docs/LICENCAS-E-MARCA.md)
- Migrações: `supabase/migrations/`
- Provisionamento administrativo separado: `supabase/provisionar-admin.sql`

## Verificação técnica

```bash
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Os testes de banco usam PostgreSQL local via PGlite e identidades fictícias. Os testes de API usam identidade substituída de teste, mantendo RLS/SQL reais no banco local. Isso **não** prova login/MFA, SMTP, rede, limites ou recuperação de um Supabase hospedado.

## Publicação e custos

Nenhum plano pago foi contratado. Nenhum banco de terceiros foi reaproveitado, pausado ou alterado. Não há analytics, pixels ou contas sociais conectadas.

Existe um projeto separado `box-oficina-portfolio` na Vercel, **ainda sem implantação permanente confirmada**. A conexão disponível não expõe as configurações exigidas para o primeiro deploy, nem a alteração da proteção de acesso; veja o procedimento no guia. A prévia do ambiente de trabalho é temporária e gerenciada pela Arena, não hospedagem final. A URL HTTPS direta foi consultada e retornou 403 da infraestrutura E2B exigindo token; não é um endereço público confirmado nem foi tentado contornar essa proteção.

Docker, proxy, DNS e HTTPS precisam ser verificados na hospedagem escolhida. O Dockerfile é fornecido, mas o container não foi construído neste ambiente, que não possui Docker. O servidor standalone foi compilado e executado diretamente.

O plano anterior com 46 itens continua sendo planejamento. Esta versão cobre o menor fluxo integrado de portfólio; **não declara os 46 itens concluídos**, nem representa auditoria de segurança ou sistema comercial homologado.
