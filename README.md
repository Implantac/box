# BOX Experience
## Portfólio integrado de oficina — fonte 1.2.0

**Projeto independente, não comercial. Todos os atendimentos, pessoas, veículos, valores e resultados demonstrativos são fictícios. Não é o canal oficial da oficina.**

Site institucional + landing page + portal do cliente + workspace operacional + estoque + equipe/serviços + comissões opcionais + central de conteúdo. Identidade proposta em grafite, preto e dourado, com o emblema conceitual escolhido na conversa.

> **Evolução local 1.2.0 — preparação para operação real:** módulo de NF-e/NFS-e por OS, cadastros/snapshots/classificações, simulações explícitas e checklist operacional. **Não publicada nesta etapa.** O site público continua na 1.1.1 e o GitHub na 1.0. O provedor não foi escolhido: conector, processamento/artefatos reais e homologação ainda são bloqueios. Veja [Ativação real](docs/ATIVACAO-REAL.md), [Contrato fiscal](docs/FISCAL-CONTRATO.md) e [Validação 1.2](docs/VALIDACAO-1.2.md).

> **Versão 1.1.1 publicada e validada:** https://box-portfolio-orpin.vercel.app. Logo inteira e em destaque, mensagem abaixo da apresentação e distribuição responsiva da página inicial. **273 testes locais, 96 E2E locais, 96 E2E públicos e oito tamanhos de layout passaram.** Confira [Ajuste visual 1.1.1](docs/AJUSTE-VISUAL-1.1.1.md). O GitHub continua na 1.0; esta publicação veio do ZIP validado.

> **Histórico da versão 1.1.0, publicada com autorização em 12/11/2026:** https://box-portfolio-orpin.vercel.app. Publicação manual a partir do ZIP validado, com **92/92 testes remotos**. **O GitHub continua na versão 1.0**; esta publicação não veio de um novo commit. Consulte [Validação](docs/VALIDACAO.md) e o [registro da publicação](docs/qa/publicacao-v1.1.json). O ZIP entregue permanece intacto e contém a documentação do momento pré-publicação.

## Comece pela experiência

| Caminho | O que explorar |
|---|---|
| `/` | Site institucional e formulário fictício integrado ao CRM |
| `/cambio-automatico` | Landing page conceitual, sem diagnóstico ou preço de reparo |
| `/bio` | Links para site, landing, gestão e portal |
| `/painel` | Visão geral integrada e navegação operacional |
| `/painel/ordens` | Queixa, diagnóstico, versões, execução, peças e serviços da OS |
| `/painel/estoque` | Cadastro, mínimo, físico/reservado/disponível e histórico de movimentos |
| `/painel/mecanicos` | Disponibilidade, agenda/alocações, indisponibilidades e serviços por profissional |
| `/painel/comissoes` | Regras opcionais, apuração, registro de repasses parciais e estornos |
| `/painel/financeiro` | Recebimentos e custos manuais, peças líquidas e comissões geradas |
| `/painel/fiscal` | Rascunhos NF-e/NFS-e por OS, snapshots e resultados simulados SEM VALIDADE FISCAL |
| `/painel/ativacao` | Checklist de preparação: código/configuração não equivale a produção homologada |
| `/painel/conteudo` | Preparação, revisão e simulação por rede, sem publicação externa |
| `/cliente` | Atendimento fictício, orçamento e confirmação de resposta |
| `/guia` | Orientação resumida de instalação |
| `/privacidade` | Limites da demonstração e armazenamento de sessão |

### Visita guiada

1. Na landing, clique **Simular solicitação**. Veja o contato no CRM; nenhuma mensagem ou reserva real é feita.
2. No painel, abra uma OS. Queixa e diagnóstico são separados.
3. No portal, aprove o orçamento fictício de Clara. Volte à OS do Corolla e avance para **Em execução**.
4. Nessa OS, **aloque o item de serviço** a um mecânico disponível. É possível usar percentual da mão de obra, valor fixo pelo item ou nenhuma comissão. Inicie, pause/retome e conclua.
5. Na OS do Golf, use a reserva de peça fictícia existente: baixe ou libere. Somente material não utilizado pode ser devolvido, com referência à baixa original.
6. Em **Comissões**, confira a previsão/geração e registre um parcial/estorno fictício. Não há transferência bancária.
7. Crie uma nova versão de orçamento: a anterior permanece, as reservas pendentes são liberadas e serviços abertos precisam revisar o vínculo depois da aprovação.
8. Na central de conteúdo, simule uma falha parcial no Facebook e a recuperação. Nenhuma rede é acessada.
9. Use a busca do cabeçalho ou **Ctrl/⌘ + K**. No celular, toque na lupa. A busca respeita o perfil e não coloca o texto pesquisado na URL.
10. Em **Notas fiscais**, prepare NF-e das peças e NFS-e dos serviços de uma OS aprovada. Simule rejeição ou resultado incerto; consulte antes de simular autorização/cancelamento. Não há emissão real.
11. Em **Preparação real**, confira os requisitos de acesso, banco, fiscal, infraestrutura, backup e aceite. Nada é ativado por essa tela.
12. Em configurações, exporte ou reinicie sua sessão. Trocar o perfil apenas demonstra visões; não é autenticação.

### Regras claras dos novos controles

- Reserva exige **OS aberta e versão atual aprovada**, com peça vinculada ao cadastro; descrição livre não movimenta estoque.
- Entrada, ajuste, reserva, baixa, liberação e devolução são registros distintos. A unidade fica preservada após o primeiro movimento. O custo é referência, fotografada na baixa, não custo médio contábil.
- Disponibilidade considera agenda, alocações, execução e indisponibilidades cadastradas. Não comprova presença, jornada ou produtividade. Execução não termina sozinha pelo tempo previsto.
- Cada item de serviço tem um responsável. Uma OS pode ter vários serviços/profissionais; não há divisão automática de um único item.
- A base percentual **exclui peças** e considera o desconto proporcional em centavos. Fixo é pelo item inteiro. A regra fica preservada na alocação; só a conclusão gera comissão.
- Repasse é registro separado e aceita parciais/estornos. Não paga ninguém nem duplica o custo financeiro da comissão.
- A regra de geração/repasse é demonstrativa, **não política salarial aprovada, folha ou cálculo trabalhista**.

Veja os detalhes em [Evolução: estoque e equipe](docs/EVOLUCAO-ESTOQUE-E-EQUIPE.md).

## Instalar sem Vercel

**Runtime validado: Node.js 22.23.5.** Instalação limpa, TypeScript, testes e build foram executados; evidências em `docs/qa/`. Requer processo Node contínuo; não é site estático para upload por FTP.

```bash
npm ci
npm run build
npm run start
```

Abra `http://localhost:3000`. O padrão é `portfolio`, sem credenciais. O início prepara o output standalone e escuta em `0.0.0.0`; `PORT` pode ser definido pela hospedagem. O backend conectado não é necessário para explorar a demonstração.

Com Docker Compose:

```bash
docker compose up -d --build
```

O exemplo expõe somente `127.0.0.1:3000` **na máquina da hospedagem**. Coloque um proxy HTTPS na frente; exemplo em `deploy/Caddyfile.example`. O Dockerfile/Compose/Caddy são fornecidos, mas não foram executados neste ambiente sem Docker.

**Hostinger ou outro fornecedor:** uma VPS ou oferta Node compatível pode hospedar a aplicação. O plano exato e seu preço atual não foram confirmados nem contratados. PHP/FTP sozinho não executa esta stack. DNS, HTTPS, reinício, limites e recursos precisam de validação no destino.

A portabilidade é do **servidor da aplicação**. O adaptador conectado usa Supabase Auth + PostgreSQL/PostgREST. Para sair também do Supabase, hospede a stack correspondente ou implemente outro adaptador; PostgreSQL puro não substitui Auth/PostgREST.

## Dois modos, sem confusão

| Portfólio, padrão | Conectado, base de homologação |
|---|---|
| Dados fictícios na memória/sessionStorage | Banco dedicado e autenticação |
| Perfis demonstrativos, sem senha | Conta individual, cookie HttpOnly e MFA |
| Sessões de visitantes independentes não compartilham alterações | Papel/vínculos verificados no servidor e no banco |
| Sem envio ou cobrança externa | Redes, mensagens, pagamentos e captação pública continuam bloqueados |
| Pronto para explorar | Código e quatro migrações presentes; ambiente real ainda precisa configurar e validar |

**Não use dados pessoais reais em nenhum modo desta entrega.** A referência da demo é fixa em **12/11/2026, 12h UTC−3** para os novos controles. A disponibilidade consulta os registros, não a presença real da equipe.

Recarga completa volta o perfil para proprietário; o estado fictício continua na sessão. Navegação interna mantém o perfil. A sessão anterior da versão 1.0 é preservada e ampliada sem inventar serviços/comissões retroativos. Para ver todos os cenários novos da base, exporte a sessão se desejar e use **Reiniciar demonstração** conscientemente. Não há importação de JSON ou sincronização entre abas/dispositivos.

Cadastrar um mecânico **não cria conta Auth**, convite ou vínculo empregatício. O vínculo individual de uma conta no modo conectado exige provisionamento administrativo separado; nome/conta de um cadastro existente não são reescritos pelo formulário.

## Documentação e verificação

- [Preparação para operação real](docs/ATIVACAO-REAL.md)
- [Contrato fiscal e limites](docs/FISCAL-CONTRATO.md)
- [Matriz de homologação ainda não preenchida](docs/HOMOLOGACAO-REAL-MODELO.md)
- [Validação local 1.2](docs/VALIDACAO-1.2.md)
- [Implantação e atualização](docs/IMPLANTACAO.md)
- [Segurança e matriz de acesso](docs/SEGURANCA.md)
- [Operação, falhas e backups](docs/OPERACAO-E-BACKUPS.md)
- [Escopo e limites](docs/ESCOPO-E-LIMITES.md)
- [Regras de estoque, equipe e comissões](docs/EVOLUCAO-ESTOQUE-E-EQUIPE.md)
- [Resultados reais de validação](docs/VALIDACAO.md)
- [Créditos e licenças](docs/LICENCAS-E-MARCA.md)
- Migrações ordenadas: `supabase/migrations/20261112000{1,2,3,4}_*.sql`
- Primeiro administrador: `supabase/provisionar-admin.sql`, procedimento separado, não automático.

```bash
npm run preflight
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Os testes de banco usam PGlite e identidades fictícias; os HTTP substituem a identidade Auth e executam RPC/RLS reais **no banco local**. Não provam Supabase Auth, cookies/TOTP/SMTP/PostgREST remotos, carga, concorrência multiconexão ou backup externo. A revisão de versão foi testada em fila local de conexão única, não em tráfego simultâneo de um PostgreSQL hospedado.

## Publicação e custos

Nenhum plano pago foi contratado, banco alheio reaproveitado, dado real migrado ou conta social conectada. Infraestrutura, domínio, banco/Auth/SMTP, backups e manutenção podem gerar custos no destino; confirmar a oferta atual e obter autorização antes de contratar.

**Publicação atual, versão 1.1.1:** https://box-portfolio-orpin.vercel.app — mesmo projeto dedicado `box-portfolio`, plano Hobby, deployment `dpl_F2C2uUAyeViorNM44AfjpFHTViJJ`, **READY/PROMOTED**, Node.js 22.x. Envio manual do ZIP 1.1.1 validado; 93 hashes conferidos. **96/96 testes remotos**, oito tamanhos sem obstrução/corte da logo e 26 rotas com 200. Nenhuma mudança nas regras de negócio. Registro em [publicação 1.1.1](docs/qa/publicacao-v1.1.1.json).

**Histórico da publicação 1.1.0:** https://box-portfolio-orpin.vercel.app — projeto dedicado **`box-portfolio`**, Hobby atual, deployment `dpl_FJeBwpr2YfyojHSV53HdXexGV7k4`, **READY/PROMOTED**, Node.js 22.x. HTTPS, noindex, 26 rotas com 200 e **92/92 testes remotos** foram verificados em 12/11/2026. O fonte foi extraído do ZIP 1.1 entregue, sem alterar seus 83 arquivos validados. O repositório `Implantac/box/main` permanece no commit 1.0 `f261c49b4c302f9894dce1f1b04cc2966890f746`; os registros anteriores de 64 testes foram preservados como histórico.

**Preserve `box-oficina-portfolio`: ele está ligado ao AGROTECH e não é o destino do Box.** A criação do novo `box-portfolio` foi autorizada separadamente. AGROTECH e seus vínculos não foram alterados. Alguns aliases técnicos continuam protegidos por autenticação; não há necessidade de remover essa proteção para acessar o domínio principal público.

O deploy automático Git continua desabilitado. **Sincronizar o repositório com a versão escolhida para publicação ainda é uma pendência**: redeployar o `main` antigo pode voltar o site para a 1.0. Um próximo envio deve conferir fonte/commit/destino/HTTPS/fluxos. A prévia integrada da Arena é temporária e separada da publicação Vercel. A sessão temporária do Vercel CLI foi encerrada depois do envio.

O plano documental com 46 itens continua sendo planejamento: **não há declaração de todos os 46 concluídos**, auditoria completa ou sistema comercial homologado.
