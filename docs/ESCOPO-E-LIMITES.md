# Escopo do fonte 1.2.0 — portfólio e preparação conectada

A 1.2 prepara fiscal e ativação responsável, sem emissão real ou publicação remota nesta etapa. Ver `PREPARACAO-OPERACAO-REAL.md`, `ATIVACAO-REAL.md` e `FISCAL-CONTRATO.md`. A home 1.1.1 foi preservada. O site público permanece 1.1.1; o GitHub permanece 1.0.

**Histórico 1.1.1:** ajustou a apresentação da página inicial e preservou funcionalidades 1.1.0. Ver `AJUSTE-VISUAL-1.1.1.md`.

A ampliação foi implementada e publicada com autorização em 12/11/2026 no projeto dedicado `box-portfolio`, a partir do ZIP validado. **O GitHub permanece na 1.0**; não houve push nem migração remota. Histórico e pacotes anteriores preservados.

## Menor fluxo integrado entregue

| Área | Implementado no portfólio | Modo conectado / limite |
|---|---|---|
| Identidade | Grafite/preto/dourado, emblema 3D conceitual escolhido, tipografia local | Proposta, sem alegar adoção oficial, registro ou exclusividade |
| Site e landing | Páginas responsivas, formulário fictício cria contato no CRM da sessão, período preferido | Somente quatro campos institucionais lidos via RPC pública; captação real bloqueada |
| CRM | Fila, origem, situação e próxima ação | CRUD de criação/situação por papel; convertido é um marcador, não conversão automática em cliente |
| Clientes/veículos | Cadastro conjunto, busca/listagem e vínculo com OS | Sem importação, prontuário jurídico ou edição/exclusão geral de cadastros |
| Agenda | Reserva por responsável/intervalo, solicitado ou confirmado, encerramentos e conflitos | Pedido não é confirmação automática; não sincroniza Google Agenda nem envia lembrete |
| OS | Queixa separada do diagnóstico, atribuição, etapas/checklist, cancelamento motivado e retorno vinculado | Reabertura é nova OS, não reescrita de entregue/cancelada; não diagnostica automaticamente |
| Orçamento | Itens em centavos, desconto, condições, versões, disponibilização e resposta preservadas | Cliente vinculado só responde versão atual enviada; adicional pausa execução e exige nova autorização |
| Portal | Atendimento fictício selecionável, itens/condições e confirmação de aprovação/recusa | Seleção pública só na demo; conectado depende de Auth/MFA/vínculo, sem consulta por placa |
| Estoque | Peças, mínimo, entradas/ajustes motivados, físico/reservado/disponível, reserva/baixa/liberação/devolução por OS e CSV | Quantidades inteiras, custo de referência preservado; sem compras completas, nota fiscal de entrada, lotes ou custo médio |
| Equipe e serviços | Cadastros operacionais, disponibilidade por agenda/execução/alocações/ausências, serviços por mecânico e histórico | Não cria Auth, jornada/ponto ou produtividade; um responsável por item; não divide um item entre profissionais |
| Comissões opcionais | Percentual de mão de obra após desconto proporcional, fixo por item ou nenhuma; previsão/geração e parciais/estornos | Regra demonstrativa, não política salarial/folha; peças fora da base, nenhum pagamento automático |
| Busca integrada | OS/veículos, peças, profissionais, serviços e comissões conforme o perfil; recortes por ID e acesso móvel | Só busca o estado autorizado já disponível; não indexa notas internas/segredos nem envia termos a analytics |
| Financeiro | Recebimento parcial, estorno motivado, custo por OS, saldo e CSV; peças líquidas e comissões geradas integradas sem duplicar repasses | Registro, não cobrança Pix/cartão/boleto; sem emissão automática/conciliação bancária/contas a pagar/contabilidade |
| Fiscal | Cadastros preparatórios, snapshots NF-e/NFS-e por OS/versão aprovada, classificações sem tributos, simulação/consulta/cancelamento/descarte, CSV e espelho sem validade | Quarta migração para cadastros/rascunhos conectados; RLS/MFA/revisão e outbox privada. Sem conector real, produtor/runner, tributos, XML/PDF oficial, webhooks ou homologação fiscal |
| Preparação real | Checklist por área e diagnóstico estrutural sem segredos; pré-verificação CLI e roteiro de homologação/backup/retorno | Não é atestado. Infra/Auth/restauração/carga/contabilidade/privacidade e aceite ainda precisam de evidência no destino |
| Conteúdo | Rascunho, legenda base e específica por rede, prévia, direitos/revisão, aprovação, calendário e simulação de falha parcial | Sem upload/vídeo reproduzível, OAuth, contas conectadas, fila, job automático, webhook ou postagem real |
| Relatórios | Cálculos do estado da sessão e CSV; definições explícitas | Não são métricas de redes, analytics, prova de resultado ou lucro contábil |
| Configurações | Quatro campos do site, matriz de acesso e histórico | Contas/convites/recuperação são provisionamento administrativo, não tela de administração completa |
| Arquitetura | Next/TypeScript, app standalone, Docker/Compose escritos, quatro migrações, adaptador Supabase | App portátil para Node/Docker; PostgreSQL puro sem Auth/PostgREST não substitui a stack conectada |
| Qualidade | Testes automatizados locais e no navegador, limites documentados | Não substitui homologação de integrações, acessibilidade completa, pentest ou teste de carga |

## O que é deliberadamente simulado

- Emissão/autorização, rejeição, timeout, consulta e cancelamento fiscais na demo são simulações, sem acesso a provedor e sem chave/protocolo/XML oficial. O espelho HTML e o CSV são SEM VALIDADE FISCAL.
- Toda operação feita pela demonstração: não é atendimento, orçamento, autorização, receita ou resultado de negócio real.
- Agendamento social e resultado por rede, inclusive falha/recuperação, são estados locais com rótulo explícito. Nenhuma rede é acessada.
- Arte de vídeo é um cartão ilustrativo com ícone: **não existe arquivo de vídeo gerado, editado ou publicado**.
- Perfis e seleção de cliente não são contas reais.
- Exportação JSON da sessão não é dump de banco ou backup externo.

## Hospedagem e integrações externas

- **Supabase remoto:** nenhum projeto Box criado, nenhum SQL executado remotamente, nenhuma chave lida/reutilizada.
- **Vercel, versão atual 1.1.1:** portfólio em **https://box-portfolio-orpin.vercel.app**, projeto dedicado `box-portfolio`, plano Hobby atual. Deployment `dpl_F2C2uUAyeViorNM44AfjpFHTViJJ`, READY/PROMOTED, Node.js 22.x, **96/96 testes públicos**, oito tamanhos de layout e HTTPS verificados em 12/11/2026. Estoque/equipe/comissões preservados; revisão da home sem alterar regras de negócio. **GitHub ainda na 1.0**; deploy automático Git desabilitado. AGROTECH/`box-oficina-portfolio`, SSO e registros anteriores preservados. Nenhuma contratação. Ver `qa/publicacao-v1.1.1.json`.
- Redes sociais, WhatsApp oficial, e-mail, banco de pagamentos, SMTP, agenda externa e métricas reais não estão conectados.
- Sem armazenamento privado de anexos, CDN de mídia, autorização de imagem de cliente, rotina de entrega publicitária ou publicação em contas da oficina.

## Evoluções fora do primeiro produto útil

Permanecem planejamento/P1/P2: compras/fornecedores e estoque avançado (fracionamento, lotes/validade), contas a pagar, emissão fiscal real completa (conector/tributação/artefatos/worker e homologação), automações de mensagens, publicação social real com reconciliação, vídeo longo e outras redes, importação de dados, assinatura jurídica, permissão por arquivo, offline/sincronização, multiunidade, monitoramento e recuperação operacional remotos, administração completa de usuários e direitos LGPD.

O plano documental com **46 itens** é uma visão de evolução; não foi reclassificado como concluído. A proposta Laravel/Vue anterior era uma alternativa de arquitetura documental. A implementação usa Next.js/TypeScript + Supabase/PostgreSQL para este menor fluxo, sem impor hospedagem proprietária.

## Dados comerciais não confirmados

Não foram publicados endereço, telefone, WhatsApp, horário de atendimento, preços reais, garantias, certificados, marcas atendidas, avaliações ou resultados. A região de Apucarana/PR é referência do conceito, não prova de sede atual. Os veículos na demo são registros inventados e não um catálogo de marcas atendidas.

O emblema e ilustrações não são fotografia da oficina, equipe, fachada ou serviço. Não representam autorização comercial de marca de terceiros. Antes de um uso público oficial, validar direitos, textos, dados de contato, fotos e responsabilidade pelo atendimento.
