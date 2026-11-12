# Evolução 1.1 — peças, equipe e comissões

Pedido: estoque de peças, disponibilidade dos mecânicos e serviços/comissão por mecânico. O usuário escolheu **percentual da mão de obra ou valor fixo por serviço, com opção sem comissão**. Continua portfólio não comercial, sem dados reais, contratação ou integrações externas.

## Menor fluxo integrado desta evolução

1. Cadastrar peças e registrar entradas/ajustes com motivo, saldo físico, reservas e disponível. Quantidades inteiras por unidade, kit ou frasco; fracionamento e compras completas ficam fora desta etapa.
2. Vincular peças a itens do orçamento. Reservar somente a quantidade autorizada na versão atual aprovada, baixar reservas, liberar sobras e devolver material não utilizado sem apagar movimentos.
3. Cadastrar mecânicos operacionais (isso não cria contas Auth), registrar indisponibilidades e alocar itens de mão de obra aprovados, considerando conflitos com a agenda e outras alocações.
4. Registrar início, pausa, retomada e conclusão por mecânico. Um item de serviço tem um responsável; vários profissionais na mesma OS usam itens distintos. Não há rateio automático de um único item entre profissionais.
5. Usar regra padrão por mecânico e permitir exceção por serviço para o proprietário. Comissão fotografada na alocação, gerada na conclusão e baixa manual demonstrativa com parciais e estornos. Nenhuma transferência financeira é feita.

## Regras demonstrativas transparentes — não são política salarial aprovada para uso real

- Percentual em pontos-base e moeda em centavos. A base é somente o item de mão de obra, após a parcela proporcional do desconto global. Peças não entram na base. O arredondamento do desconto preserva exatamente o total do orçamento.
- Valor fixo corresponde ao item de serviço atribuído inteiro, não a cada unidade nem à OS inteira. A regra padrão pode ser sem comissão. Alterações de regra não reescrevem serviços anteriores.
- A conclusão gera a comissão na demo, independentemente do recebimento do cliente; a baixa é outro registro manual. A regra real de competência, elegibilidade e repasse deve ser definida com o responsável antes de qualquer uso operacional. Isto não é folha de pagamento, cálculo trabalhista ou análise jurídica/contábil.
- Nova versão do orçamento libera reservas pendentes e pausa serviços não concluídos até revisão do vínculo com a nova aprovação. Serviços e comissões já concluídos não são duplicados só porque houve nova versão.
- Cancelar OS libera reservas e cancela serviços não concluídos, preservando histórico. Serviços concluídos e comissões geradas não somem. Uma comissão incorreta exige cancelamento motivado separado; repasses devem ser estornados antes.
- Custo de peça é uma **referência informada**, fotografada na baixa; devolução usa o mesmo custo. Não é método contábil de estoque, custo médio ou cálculo fiscal. Recebimentos de mercadoria não geram automaticamente contas a pagar.
- O financeiro mostra custos manuais, consumo líquido de peças e comissões geradas separadamente. Repasses não descontam a comissão duas vezes. Não cadastrar manualmente o mesmo custo de estoque/comissão novamente.
- A disponibilidade informa apenas o que está registrado. Não inventa horários de trabalho, não garante capacidade, presença física ou produtividade. A referência da demo é fixa e indicada na tela. Serviço em execução não fica livre automaticamente ao terminar o tempo previsto.

## Segurança e compatibilidade

Recepção cuida de peças e alocações, mas não recebe documentos de comissão. Técnico acompanha somente seus serviços; marketing e cliente não recebem os novos dados privados. Novos controles conectados dependem da nova migração e homologação com usuários reais separados, sempre primeiro com dados fictícios. A migração e os testes locais não substituem Supabase Auth/MFA/PostgREST remotos.

Sessões antigas do portfólio devem ser preservadas: novos módulos iniciam sem inventar serviços ou comissões retroativos. O pacote continua portátil para Node.js 22 ou Docker compatível. Não substituir projetos alheios. O destino autorizado de eventual atualização é somente `box-portfolio`; AGROTECH permanece preservado.

## Fora desta etapa

Compras/fornecedores completos, fiscal, inventário fracionado, lotes/validade, folha/pagamento real, ponto/jornada, divisão de um item entre mecânicos, comissão sobre faturamento total, assinaturas e sincronização externa. Não reclassificar os 46 itens do planejamento como concluídos.

## Estado da entrega 1.1.0

Implementados na fonte local os três módulos e sua integração com OS, orçamento, agenda, visão geral, busca desktop/móvel, financeiro e relatórios. O pacote contém a terceira migração completa, três migrações executadas na fixture PGlite, RBAC/MFA, validação SQL/HTTP, revisão, auditoria, imutabilidade e retries. Os resultados finais estão em `VALIDACAO.md` e nos relatórios `qa/*v1.1*`; não reutilizar os 64 testes remotos antigos como prova destes módulos.

O técnico também acompanha a OS quando executa um item próprio, sem ganhar permissão de alterar a etapa/diagnóstico geral se não for o responsável principal. A regra financeira do serviço não fica no documento operacional visível à recepção. Comparações de retry não permitem adivinhar exceções privadas; chamadas com exceção exigem proprietário antes dessa comparação.

**Publicado com autorização:** versão 1.1.0 em https://box-portfolio-orpin.vercel.app, somente no projeto dedicado `box-portfolio`, deployment `dpl_FJeBwpr2YfyojHSV53HdXexGV7k4`, a partir do ZIP validado. **92/92 testes remotos** passaram em desktop/celular emulado, além dos 273 locais e 92 E2E locais. **O GitHub continua na 1.0** e não houve migração Supabase remota, contratação ou uso de dados reais. AGROTECH, proteção SSO e históricos anteriores foram preservados. SQL/RLS locais, acessibilidade automática e fila PGlite não equivalem a Auth remoto, auditoria humana completa ou concorrência multiconexão. Registro: `qa/publicacao-v1.1.json`.

## Pontos de atenção operacionais

- Um novo cadastro de mecânico é somente operacional. O vínculo de conta precisa ser provisionado administrativamente antes do uso conectado; nome/conta existentes não são editáveis pelo formulário.
- A apuração usa a data de geração, ou criação para previsões. Os totais de repasse na apuração pertencem às comissões selecionadas; a aba de repasses filtra a data dos lançamentos. Não confundir isso com fluxo de caixa por competência contábil.
- Sessões 1.0 preservadas não recebem serviços/comissões históricos inventados. Reiniciar a demo é opcional e explícito para apresentar a nova seed.

