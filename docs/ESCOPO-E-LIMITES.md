# Escopo desta versão de portfólio

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
| Financeiro | Recebimento parcial, estorno motivado, custo por OS, saldo e CSV | Registro, não cobrança Pix/cartão/boleto; sem fiscal/conciliação bancária/contas a pagar/contabilidade |
| Conteúdo | Rascunho, legenda base e específica por rede, prévia, direitos/revisão, aprovação, calendário e simulação de falha parcial | Sem upload/vídeo reproduzível, OAuth, contas conectadas, fila, job automático, webhook ou postagem real |
| Relatórios | Cálculos do estado da sessão e CSV; definições explícitas | Não são métricas de redes, analytics, prova de resultado ou lucro contábil |
| Configurações | Quatro campos do site, matriz de acesso e histórico | Contas/convites/recuperação são provisionamento administrativo, não tela de administração completa |
| Arquitetura | Next/TypeScript, app standalone, Docker/Compose escritos, duas migrações, adaptador Supabase | App portátil para Node/Docker; PostgreSQL puro sem Auth/PostgREST não substitui a stack conectada |
| Qualidade | Testes automatizados locais e no navegador, limites documentados | Não substitui homologação de integrações, acessibilidade completa, pentest ou teste de carga |

## O que é deliberadamente simulado

- Toda operação feita pela demonstração: não é atendimento, orçamento, autorização, receita ou resultado de negócio real.
- Agendamento social e resultado por rede, inclusive falha/recuperação, são estados locais com rótulo explícito. Nenhuma rede é acessada.
- Arte de vídeo é um cartão ilustrativo com ícone: **não existe arquivo de vídeo gerado, editado ou publicado**.
- Perfis e seleção de cliente não são contas reais.
- Exportação JSON da sessão não é dump de banco ou backup externo.

## Integrações não ativadas

- **Supabase remoto:** nenhum projeto Box criado, nenhum SQL executado remotamente, nenhuma chave lida/reutilizada.
- **Vercel:** projeto separado criado, mas primeiro deployment e acesso público dependem de controles não expostos pelo conector; sem publicação permanente verificada.
- Redes sociais, WhatsApp oficial, e-mail, banco de pagamentos, SMTP, agenda externa e métricas reais não estão conectados.
- Sem armazenamento privado de anexos, CDN de mídia, autorização de imagem de cliente, rotina de entrega publicitária ou publicação em contas da oficina.

## Evoluções fora do primeiro produto útil

Permanecem planejamento/P1/P2: estoque/compras completo, contas a pagar, fiscal, automações de mensagens, publicação social real com reconciliação, vídeo longo e outras redes, importação de dados, assinatura jurídica, permissão por arquivo, offline/sincronização, multiunidade, monitoramento e recuperação operacional remotos, administração completa de usuários e direitos LGPD.

O plano documental com **46 itens** é uma visão de evolução; não foi reclassificado como concluído. A proposta Laravel/Vue anterior era uma alternativa de arquitetura documental. A implementação usa Next.js/TypeScript + Supabase/PostgreSQL para este menor fluxo, sem impor hospedagem proprietária.

## Dados comerciais não confirmados

Não foram publicados endereço, telefone, WhatsApp, horário de atendimento, preços reais, garantias, certificados, marcas atendidas, avaliações ou resultados. A região de Apucarana/PR é referência do conceito, não prova de sede atual. Os veículos na demo são registros inventados e não um catálogo de marcas atendidas.

O emblema e ilustrações não são fotografia da oficina, equipe, fachada ou serviço. Não representam autorização comercial de marca de terceiros. Antes de um uso público oficial, validar direitos, textos, dados de contato, fotos e responsabilidade pelo atendimento.
