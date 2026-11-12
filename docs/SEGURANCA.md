# Segurança, privacidade e acesso

## Fronteira desta entrega

Portfólio não comercial. A seleção de perfil e cliente na demonstração é um recurso de exploração, **não autenticação nem isolamento de segurança dentro da mesma sessão fictícia**. Não introduzir dados reais. Não há consulta pública por placa, anexos de OS, gateway de pagamento, disparos, analytics ou rastreadores externos.

O código conectado é uma base de homologação, não um ambiente comercial certificado. Não foi executado contra Supabase hospedado; login real, TOTP, recuperação, PostgREST, RLS remota e configuração de cookies/proxy exigem testes no destino.

## Controles implementados no código conectado

- Supabase Auth por conta individual; nenhuma senha em texto no código. O armazenamento/hash de senha é responsabilidade do Auth, não `sessionStorage`.
- Sessão consultada no servidor por `getUser()`. Cookies HttpOnly, SameSite=Lax e Secure em produção.
- MFA TOTP/nível `aal2` exigido pelo app **e pelas funções/políticas SQL**, inclusive para chamadas diretas ao banco com JWT.
- Vínculo `box_members` obtido do servidor, não do papel enviado pelo navegador. Sem autocadastro/autopromoção.
- RLS e chaves compostas por workspace; cliente acessa somente registros próprios; técnico somente OS/agenda atribuídas; marketing somente conteúdo.
- Escrita direta revogada para `anon` e `authenticated`; comandos transacionais validados por RPC com papel e vínculos verificados.
- Funções privilegiadas com `search_path` vazio, nomes qualificados e grants explícitos. Funções de leitura operam sob RLS.
- Bloqueio de linha do workspace e revisão esperada para concorrência. Conflito devolve 409; a interface pede atualização, sem sobrescrever silenciosamente.
- Orçamentos versionados, respostas preservadas, pagamentos/estornos append-only. Versão nova invalida a aprovação anterior para execução; post editado exige nova revisão.
- Validação Zod no HTTP e validação/restrições no SQL. JSON limitado a 40.000 bytes, inclusive por leitura em blocos; parâmetros SQL, sem concatenação de valores do cliente.
- Mutação HTTP exige origem exata configurada e `application/json`; sem liberação CORS ampla. Essa defesa não substitui a autorização SQL para PostgREST direto.
- Limites complementares em memória por instância, com hashes efêmeros e sem registrar IP/e-mail. **Não distribuídos**: configurar limites do Auth e proxy no destino. Só confiar em `x-forwarded-for` reescrito por proxy autorizado.
- Respostas privadas com `Cache-Control: private, no-store`; erros inesperados não devolvem detalhes internos. Auditoria registra ator, operação, ID e horário, não senha/token/corpo de formulário. Auditoria não pode ser apagada pelo papel autenticado.
- Noindex em páginas/headers/robots. Noindex **não é controle de acesso**.
- CSP restringe scripts/arquivos/conexões; permite inline para o framework. Modo conectado acrescenta `frame-ancestors 'none'`; portfólio permite o preview em iframe. Essa CSP não equivale a política estrita com nonces nem elimina risco de XSS.

Chaves privilegiadas não são exigidas nem incluídas. A chave publicável do Supabase é usada no servidor; permissões continuam essenciais mesmo para uma chave não secreta. Segredos ficam no gerenciador de ambiente da hospedagem, nunca no repositório, ZIP, browser, URL ou logs.

## Permissões de dados no banco

| Papel | Leitura | Escrita por comando |
|---|---|---|
| Proprietário | Todo o workspace e auditoria | Operações do workspace, inclusive aprovação de conteúdo e quatro campos do site |
| Recepção | Clientes, veículos, OS, orçamentos, agenda, CRM | Cadastros, OS, orçamento/resposta com evidência, agenda, CRM |
| Técnico | OS e agenda atribuídas ao seu nome individual | Acompanhamento/etapas da OS atribuída |
| Financeiro | OS, orçamentos, recebimentos e custos | Recebimentos, estornos e custos; não aprova orçamento como cliente |
| Conteúdo | Posts revisáveis | Criar/editar rascunho; aprovação exclusiva do proprietário |
| Cliente | Próprio cadastro/veículos/OS e versões disponibilizadas | Aprovar/recusar a versão atual enviada, sem editar valores ou histórico |

A matriz de módulos da interface não substitui a matriz de dados. A resposta de workspace já é filtrada no banco no modo conectado. As informações institucionais não sigilosas do workspace são legíveis por seus membros. A RPC pública do site retorna **somente** título, subtítulo, nome de apresentação e região; não retorna agenda, OS, contatos, auditoria ou conteúdo privado.

As atribuições técnicas usam `display_name` com unicidade, não um UUID de técnico em cada OS. Mudanças de nome exigem manutenção dos vínculos. Esta é uma limitação conhecida a evoluir, não uma integração de RH completa.

## Matriz obrigatória antes de uso real

Em homologação dedicada e por quem administra o destino:

1. Criar proprietário, recepção, técnico, financeiro, marketing e **dois clientes diferentes**, todos individuais. Testar conta sem vínculo.
2. Confirmar bloqueio de sessão ausente, expirada, revogada, sem MFA e com MFA válido; testar login errado, TOTP inválido/expirado, logout e recuperação administrativa.
3. Verificar atributos dos cookies no HTTPS final e ausência de tokens em URL/logs; testar renovação pelo proxy.
4. Pela API e PostgREST, tentar ler outro workspace, ler outra OS, trocar `customer_id`, papel ou workspace no JSON, escrever tabelas diretamente, executar comando fora do papel e acessar orçamento rascunho.
5. Repetir autorizações com cliente errado/versão antiga/OS encerrada. Tentar alterar itens após aprovação. Preservar recusas e evidência de quem respondeu.
6. Submeter duas versões ou horários simultâneos; confirmar conflito e ausência de duplicata. Testar envio duplicado de lançamento e ID reutilizado com valor diferente.
7. Forçar indisponibilidade de banco/rede, 401/403/409/422/429/503 e conferir mensagem e ausência de sucesso falso.
8. Validar origem, limites do corpo, formato JSON, carga, CSP, cookies, cache, headers e proxy confiável no endereço real.
9. Restaurar backup em destino separado e comparar vínculos, permissões, conteúdo, auditoria e Auth. Não testar restaurando por cima da origem.
10. Aprovar conteúdo comercial, retenção, atendimento aos titulares, canais e responsáveis. Só depois considerar um escopo de produção, com autorização separada.

## LGPD e retenção

A demonstração usa dados inventados e armazenamento de sessão no próprio navegador. A exportação fictícia é manual e identificada. Limpar dados do site/reiniciar a demo remove a sessão local; pode haver cópias em downloads ou abas duplicadas. Duplicar uma aba pode copiar `sessionStorage` inicialmente, comportamento do navegador, sem sincronização posterior.

Uma versão real exigirá: finalidade/base legal, minimização, aviso adequado, controles de acesso, prazos por categoria, canal para titulares, registro de pedidos, resposta a incidentes e procedimentos de exclusão/anonimização compatíveis com obrigações de retenção. A aplicação não implementa um gerenciador completo de solicitações LGPD, assinatura jurídica ou retenção automática.

Anexos/mídia privada não foram implementados. Não improvisar upload em bucket público ou expor arquivos de OS para viabilizar postagem. Um escopo futuro precisa bucket privado, autorização por objeto, URLs temporárias e derivados publicitários somente após revisão e autorização.

## Vulnerabilidades e incidentes

- Manter dependências/runtime atualizados e avaliar alertas. Zero alertas conhecidos em uma execução de `npm audit` não é auditoria nem garantia futura.
- Não compartilhar credenciais pelo chat. Alteração de segredos e recuperação de MFA devem usar os painéis oficiais e canal verificado.
- Em incidente, restringir acesso, revogar sessões/tokens afetados, preservar evidências sem ampliar vazamento e acionar o responsável técnico e de dados. Notificações legais dependem da análise aplicável, não de automação presente neste portfólio.
- Ainda não há pentest independente, teste de carga/capacidade, HA, monitoramento de incidentes ou SLA contratado.
