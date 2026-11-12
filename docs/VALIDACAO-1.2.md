# Validação local — fonte 1.2.0

Referência: **12/11/2026**. Este relatório é da preparação fiscal e de operação real, **sem publicação 1.2.0, banco remoto ou emissor oficial**. Site público permanece 1.1.1; histórico em `qa/publicacao-v1.1.1.json`.

## Resultado executado

| Verificação | Resultado / alcance |
|---|---|
| Instalação limpa | `npm ci` em pasta separada, sem reutilizar node_modules/build; Node 22.23.5/npm 10.8.2 |
| TypeScript | Typecheck aprovado na instalação limpa |
| Testes locais | **347/347**, 14 arquivos, sem falha ou teste pendente; executados na instalação limpa |
| Build portfólio | Build de produção aprovado, inclusive na instalação limpa |
| Build conectado | Build aprovado sem credenciais; startup local falha fechado com 503 quando falta configuração |
| Modos divergentes | Build conectado + runtime portfólio devolve health 503, mesmo mudando a variável pública no runtime; rebuild é obrigatório |
| Navegador completo | **122/122**, desktop e celular Chromium emulados; zero falha, pulo ou flaky, 193.547 ms |
| Home preservada | Oito tamanhos de 320 a 1654 px aprovados; fonte/CSS/logo idênticos à 1.1.1 |
| Novas páginas | Fiscal e preparação real em oito tamanhos cada, 16 verificações sem overflow de página; tabelas têm rolagem própria |
| Smoke local | 28 rotas com 200, negativas de API 403 e rota inexistente 404; checklist não declara liberação real |
| Acessibilidade automática | Novas páginas/formulários/modal fiscal incluídos nos testes axe, com marcações WCAG2A/AA/2.1AA; não é auditoria humana completa |
| Dependências | `npm audit`: 0 vulnerabilidades reportadas, 149 dependências contabilizadas; sem alteração de dependências |
| Backup exemplar | `bash -n` e `--help` aprovados, sem executar dump remoto, cifragem real ou restauração externa |

## O que os testes novos exercitam

- NF-e/NFS-e separadas a partir da versão atual aprovada; descontos por maior resto com soma exata em centavos no domínio e no SQL.
- Retry por ID, unicidade de documento ativo, revisão desatualizada, snapshots de empresa/destinatário preservados e classificação dos mesmos itens sem alterar valores.
- Simulações explícitas de rejeição, autorização, timeout, consulta e cancelamento. Resultado incerto não permite reemissão/descarte. Recebimentos/estoque não são alterados automaticamente.
- CNPJ numérico/alfanumérico e CPF: formato/dígitos, sem comprovar inscrição/regularidade. A demo exige CPF/CNPJ vazio e e-mails fictícios.
- Permissões de proprietário/financeiro, negativa para recepção/técnico/conteúdo/cliente, MFA e outro workspace. SQL conectado e API rejeitam todos os comandos de simulação.
- Ausência de provedor real: API devolve 503 sem mudar rascunho ou emitir. Variáveis não instalam/ativam conector.
- Outbox privada: browser sem privilégios de leitura/escrita/claim/complete; reserva, lease, consulta após timeout/crash, token de fencing e evidência mínima de resultado.
- Restauração de cópia PGlite com snapshot fiscal e RLS preservados, além do teste de restauração operacional anterior.
- Pré-verificação não revela valores secretos, rejeita URL/origem inadequadas e chave privilegiada; health/readiness nunca afirmam operação real aprovada.
- Navegação por OS e busca, cadastro de destinatários distintos, espelho HTML sem script/conteúdo não escapado, acesso móvel e migração de sessão v2 sem notas retroativas.
- Regressão de todo o conjunto anterior: home, site/CRM, portal, OS/orçamentos/financeiro, estoque, mecânicos/serviços e comissões opcionais.

## Evidências

- `qa/vitest-v1.2.{json,log}`; `qa/typecheck-v1.2.log`
- `qa/build-v1.2.log`; `qa/instalacao-limpa-v1.2.log`
- `qa/connected-build-v1.2.{json,log}`
- `qa/playwright-v1.2.{json,log}`
- `qa/layout-v1.2.{json,log}`; `qa/http-smoke-v1.2.json`
- `qa/preflight-portfolio-v1.2.json`; `qa/preflight-connected-v1.2.json`
- `dependency-audit-v1.2.json`
- Capturas `qa/desktop-chromium-local-v1.2-{painel-fiscal,painel-ativacao,fiscal-documento}.png` e `qa/mobile-chromium-local-v1.2-painel-fiscal.png`
- `qa/resumo-v1.2.json`, com hashes do fonte empacotado e limites

Os logs incrementais de diagnóstico não são o resultado final. Foram corrigidos um erro de sintaxe do SQL novo, a reação à navegação por query na busca fiscal e contraste de textos do modal. Os testes finais passaram **sem remover cenários, reduzir exigências de acessibilidade ou converter falha em sucesso**.

## Limites que permanecem

PGlite é uma conexão local com identidades/JWTs de teste. O HTTP usa Auth substituído por fixture e RPC/RLS locais. O contrato de provedor usa fixtures explicitamente fictícias. Nada disso comprova Auth/TOTP/cookies/SMTP/PostgREST remotos, regras tributárias, emissão oficial, assinatura/XML, webhook real, armazenamento privado, concorrência de múltiplas conexões, teste de carga, backup externo ou recuperação de desastre. Docker/systemd/Caddy/Hostinger não foram executados/homologados neste ambiente.

**Não há provedor real, produtor/runner fiscal ou artefatos oficiais implementados/implantados.** Esses componentes e a configuração contábil serão concluídos depois da escolha do provedor, com homologação no destino e aceite dos responsáveis. O checklist é orientativo, não atestado de segurança, LGPD ou conformidade fiscal. Nenhum dado real, nota fiscal, cobrança, contratação, banco ou deployment novo foi criado nesta etapa. Os 46 itens do plano não foram declarados concluídos.

Ver `ATIVACAO-REAL.md`, `FISCAL-CONTRATO.md` e `HOMOLOGACAO-REAL-MODELO.md`.
