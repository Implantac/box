# Operação, falhas, responsabilidades e backups

## Acesso e uso da demonstração

Sem senha ou cadastro: abra `/painel` para gestão e `/cliente` para o portal fictício. Os avisos deixam claro que não há operação real. Os dados ficam em memória e `sessionStorage`; o modo conectado não usa esse armazenamento para guardar dados de clientes.

A sessão normalmente desaparece ao fechar a aba/janela; também pode ser limpa no navegador ou pelo botão **Reiniciar demonstração**. O navegador pode restaurar abas ou copiar o estado inicial ao duplicar uma aba. Não há sincronização entre abas/dispositivos, nem promessa de persistência. A exportação da sessão é um JSON fictício para exploração, não possui importação na interface e **não é backup do banco**.

### Roteiro de demonstração

1. Landing → simular solicitação → ver no CRM. A preferência de período é anotada; não cria confirmação de agenda.
2. Cliente e veículo → nova OS → queixa → diagnóstico → orçamento v1 → disponibilizar.
3. Portal do cliente → conferir versão/condições → confirmar aprovação/recusa.
4. A versão atual aprovada permite execução. Uma versão adicional preserva a anterior e pausa o fluxo para nova autorização.
5. Registrar parcial/estorno e custo. Esses botões não cobram nem devolvem dinheiro em banco real.
6. Conteúdo → editar/adaptar legenda → revisão de direitos → proprietário aprova → simulação por destino. A falha parcial é intencionalmente demonstrável e não implica acesso às redes.

## Rotina se um ambiente conectado for homologado

| Quando | Quem deve assumir | Rotina |
|---|---|---|
| Antes da abertura | Responsável operacional designado | Conferir agenda/solicitações, pendências de autorização e próximos contatos |
| Por atendimento | Recepção + técnico responsável | Verificar relato versus diagnóstico, versão autorizada, itens, checklist e previsão; registrar alterações/retornos |
| Fechamento diário | Financeiro autorizado | Conferir lançamentos/estornos/custos e documentos; não confundir registro no sistema com liquidação bancária |
| Diariamente, política a definir | Administrador da infraestrutura | Saúde da aplicação/banco, backups, espaço, limites, logs sem dados pessoais e alertas |
| Periodicamente | Responsável de conteúdo | Direitos, autorização de imagens, versão aprovada e resultado real de cada destino quando existir adaptador |
| Mensalmente ou conforme risco | Responsável técnico + de dados | Acessos individuais, atualizações, custos, retenção, restauração isolada e revisão de incidentes |

**Nenhuma dessas pessoas foi nomeada ou contratada nesta entrega.** Não há suporte contínuo, SLA, plantão, monitoramento externo ou rotina de backup contratados automaticamente.

## Falhas e ação segura

| Sintoma | Procedimento |
|---|---|
| Demonstração vazia/estado estranho | Exportar sessão fictícia se necessário e reiniciar a demo; não usar dados reais para testar |
| 401 / sessão expirada | Entrar novamente; não compartilhar conta ou token |
| 403 / MFA / sem vínculo | Concluir MFA ou pedir ao administrador verificar vínculo/papel; não alterar payload para contornar |
| Código TOTP não funciona | Verificar horário do dispositivo e fator correto; recuperação somente por procedimento administrativo verificado |
| 409 / dados mudaram | Atualizar, conferir a versão e reaplicar conscientemente; não reenviar cegamente um pagamento com novo ID |
| 422 / validação | Corrigir campos conforme o erro; verificar cliente/veículo, etapa, versão, saldo ou horário |
| 429 / tentativas | Aguardar a janela e investigar tentativas/proxy; não remover limites para resolver |
| 503 / ambiente sem configuração | Verificar modos iguais, variáveis no servidor, origem HTTPS e status do provedor; nunca publicar segredo para depurar |
| Proxy/502 ou assets quebrados | Conferir processo Node, pasta de build/standalone, cópia de public/static, porta e logs de infraestrutura sem corpos de requisição |
| Banco indisponível | Interromper operações dependentes, comunicar indisponibilidade e executar plano de recuperação. Não mostrar sucesso ou criar um modo offline improvisado |
| Post “simulado” | Não existe envio real a recuperar. Na futura integração, reconciliar com o provedor antes de reenviar para evitar duplicatas |

`/api/health` verifica modo/configuração parcial e responde `databaseConnection: not-used` na demo ou `not-probed` conectado. **Não executa consulta de prontidão do banco** e não garante existência de workspace, MFA, SMTP ou acesso à rede. Monitoramento real precisa verificação sintética autenticada própria, sem colocar credenciais em URL/logs.

## Custos e compromissos

- Nenhuma despesa recorrente foi autorizada ou contratada nesta execução.
- A demo não exige Supabase ou provedor social. Pode usar hospedagem Node/Docker compatível já disponível, após verificar recursos/custo.
- Domínio, VPS/serviço Node, banco/Auth/SMTP, armazenamento/egress, backup, monitoramento e manutenção podem gerar cobrança se adotados. Confirmar oferta atual, impostos, moeda, franquias, excedentes e forma de cancelamento **antes de contratar**.
- Os preços do plano documental são referências de consulta, não orçamento aprovado nem garantia de valor atual. Não foi validado checkout/limites do plano Hostinger específico.
- O plano Vercel Hobby consultado tem finalidade pessoal/não comercial; não presumir permissão/capacidade comercial. Nenhum upgrade foi feito.
- Não habilitar publicação social, WhatsApp oficial ou dados reais só por conectar uma ferramenta. Precisam escopo, autorização e custo próprios.

## Backups: o que foi realmente provado

`tests/restore.test.ts` cria um snapshot gzip de **PGlite local**, abre uma instância independente e verifica registros, vínculos, RLS, isolamento de cliente e proibição de apagar auditoria. Isso valida uma restauração local de teste, **não** backup do Supabase hospedado, recuperação de Auth, objetos de storage, PITR, RPO/RTO ou desastre da hospedagem.

O código-fonte, lockfile e migrações acompanham o ZIP. Não há banco real nesta demonstração e nenhum dump remoto foi produzido. Scripts de migração não são backup de dados.

## Política proposta para um destino futuro

Definir e aprovar antes do uso real, com o responsável técnico:

1. Inventário do que precisa recuperar: app/versão, banco, Auth, vínculos, auditoria, configuração/segredos em cofre e mídia privada se implementada.
2. Frequência, retenção, criptografia, separação de contas/acessos, localização dos dados, responsáveis e testes. RPO de 24h e RTO de 8h do plano anterior são **metas propostas**, não resultados medidos ou SLA.
3. Backups do provedor conforme plano e uma cópia independente protegida. Não confiar em um único ZIP no mesmo servidor.
4. Cópia somente por operador autorizado, com privilégios mínimos, usando gerenciador de segredos, `PGSERVICE`/`PGPASSFILE` ou mecanismo oficial. Não colocar senha na linha de comando/histórico, no chat ou no código.
5. Verificar documentação atual do Supabase para backup/restore, schemas internos/Auth, roles e storage. Um `pg_dump` só do schema público **não** recupera contas nem arquivos; copiar apenas metadados de storage não copia os objetos.
6. Guardar checksum, data, versão da aplicação/esquema e evidência de teste, sem incluir dados pessoais em relatório público.

Exemplo técnico **restrito às tabelas da aplicação**, para complementar e não substituir backup completo do provedor (requer PostgreSQL client compatível e serviço `box_homologacao` configurado com segurança):

```bash
umask 077
mkdir -p backups
pg_dump --dbname='service=box_homologacao' --format=custom \
  --no-owner --no-privileges \
  --table=public.box_workspaces --table=public.box_members \
  --table=public.box_records --table=public.box_audit \
  --file=backups/box-app.dump
sha256sum backups/box-app.dump > backups/box-app.dump.sha256
```

Esse comando não foi executado contra serviço remoto; o arquivo contém dados potencialmente pessoais e deve ser criptografado e enviado a destino autorizado, não ao repositório. Ele não inclui funções/migrações nem Auth e não é uma cópia completa. As pastas `backups` estão excluídas do empacotamento por padrão.

## Exercício de restauração no destino

1. Provisionar destino **isolado** dedicado e conferir autorização/custo. Nunca usar `--clean` ou restaurar em cima da origem ativa para testar.
2. Seguir o restore oficial compatível do provedor para banco/Auth/roles, segredos e objetos; aplicar a versão de esquema correta. Se usar cópia restrita de tabelas, preparar Auth e migrações compatíveis antes da carga de dados.
3. Comparar contagens por categoria, vínculos, versões/respostas, recebimentos/estornos e auditoria. Testar proprietário, técnico e pelo menos dois clientes também pela API.
4. Verificar consistência dos objetos privados e links temporários se existirem. Não publicar mídia original.
5. Medir tempo de recuperação e perda máxima de dados; registrar o resultado e aprovação do responsável, sem inventar RPO/RTO.
6. Simular troca do aplicativo sem enviar mensagens/cobranças/posts. Reativar integrações somente após reconciliação e aprovação.
7. Eliminar a cópia de teste segundo a retenção aprovada. Documentar falhas e repetir até cumprir os critérios.

**Estado atual:** este exercício remoto permanece pendente. Somente a restauração PGlite local foi validada.
