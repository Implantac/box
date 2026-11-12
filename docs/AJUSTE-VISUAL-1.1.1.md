# Box 1.1.1 — logo em destaque e distribuição da página

**12/11/2026 · Correção visual do portfólio, sem alterar regras operacionais**

## O que foi ajustado

- **Logo inteira e desobstruída.** O emblema, sua ponta inferior e “Serviços Automotivos” agora aparecem completos. A imagem original foi preservada, sem recorte ou regeneração.
- A marca ganhou uma área própria no fluxo da página. Imagem, identificação e legenda ocupam linhas independentes; não dependem de posicionamento absoluto ou de uma altura fixa.
- O cartão “O cuidado encontra a tecnologia” foi transformado em uma faixa **abaixo da apresentação**, fora da área da logo.
- No desktop, o emblema pode chegar a **560 px**, contra 490 px na medição anterior em 1440×900. Texto e marca usam colunas equilibradas e um contêiner mais amplo.
- No celular/tablet estreito, a marca aparece antes do texto, com tamanho proporcional e sem sobreposição.
- Margens, intervalos entre seções, títulos, descrições, cards, etapas, FAQ, formulário e rodapé foram revisados. Os cards de soluções têm ações alinhadas na mesma linha no desktop.
- Menu móvel e botões foram ajustados para não disputar espaço em telas pequenas. A identidade preto/grafite/dourado foi mantida.

Os estilos novos estão limitados a `.home-page`, em `src/app/home.css`. As regras de estoque, serviços, comissões, OS, financeiro, permissões, banco e restauração não foram alteradas.

## Validação local concluída

| Verificação | Resultado | Evidência |
|---|---|---|
| TypeScript | Passou | `qa/typecheck-v1.1.1.log` |
| Lógica, API e SQL/RLS local | **273/273**, 10 arquivos | `qa/vitest-v1.1.1.{json,log}` |
| Build de produção | Passou, Node.js 22 | `qa/build-v1.1.1.log` |
| Instalação limpa | npm ci + typecheck + 273 testes + build passaram | `qa/instalacao-limpa-v1.1.1.log` |
| Navegador no build local de produção | **96/96**, sem falhas, pulos ou flaky | `qa/playwright-v1.1.1.{json,log}` |
| Layout em oito tamanhos | Sem interseção da logo com texto/legenda/faixa, corte, colisão de seções ou rolagem horizontal da página | `qa/layout-v1.1.1.json` |
| Acessibilidade automática | Sem violações nos cenários axe selecionados da suíte | Incluída nos 96 testes; não auditoria completa |
| Dependências | Zero alertas conhecidos no npm audit desta execução | `dependency-audit-v1.1.1.json` |

A suíte mantém os 92 cenários anteriores e acrescenta dois testes por perfil: matriz de layout e jornada da home com menu/âncoras, FAQ e formulário fictício → CRM. Os oito tamanhos são **1654×900, 1440×900, 1366×768, 1024×768, 768×1024, 390×844, 360×800 e 320×740**, em pixels CSS. Desktop e celular são Chromium; não são aparelhos físicos.

Capturas finais do build local de produção:

- [Desktop — apresentação](qa/visual-v1.1.1/local-desktop-hero.png) e [página completa](qa/visual-v1.1.1/local-desktop.png).
- [Tablet — página completa](qa/visual-v1.1.1/local-tablet.png).
- [Celular — apresentação](qa/visual-v1.1.1/local-mobile-hero.png) e [página completa](qa/visual-v1.1.1/local-mobile.png).

Duas falhas de preparação dos testes foram corrigidas antes da execução final: configuração Playwright usando `import.meta` em carregamento CommonJS e seletor exato de FAQ que ignorava o sinal “+” do botão. Não foram falhas das regras de negócio. Os relatórios finais são os identificados acima.

## Publicação 1.1.1 confirmada

**A correção 1.1.1 foi publicada com autorização e validada em https://box-portfolio-orpin.vercel.app.** Deployment **`dpl_F2C2uUAyeViorNM44AfjpFHTViJJ`**, origem CLI, produção **READY/PROMOTED**, Node.js **22.x**. O pacote foi identificado e empacotado antes do envio; os relatórios pós-publicação complementam esse ZIP intacto.

- **96/96 E2E públicos**, zero falha, pulo ou flaky; início **19:14:39.411 UTC**, duração **153,33 s**. Relatório `qa/playwright-deploy-v1.1.1.{json,log}`.
- **Oito tamanhos públicos aprovados**, sem obstruções da imagem, corte ou rolagem horizontal da página; `qa/layout-deploy-v1.1.1.{json,log}`.
- HTTPS/certificado/hostname/noindex, **26 rotas com 200**, workspace 403 e inexistente 404; `qa/vercel-https-v1.1.1.json`.
- Health 1.1.1 / portfolio / banco não utilizado / redes desabilitadas; smoke passou e zero erro JavaScript observado.
- Imagem original da logo preservada byte a byte também no endereço público. SSO intacto; aliases técnicos continuam 302 para login, sem bypass.
- Sessão temporária do CLI encerrada e diretório de autenticação removido após o envio.
- Registro consolidado: `qa/publicacao-v1.1.1.json`. Capturas públicas: [desktop](qa/visual-v1.1.1/publico-desktop.png), [tablet](qa/visual-v1.1.1/publico-tablet.png) e [celular](qa/visual-v1.1.1/publico-mobile.png).

O único destino autorizado é o projeto separado **`box-portfolio/prj_s2lz8fMNbxGAR6qJye5KHu5gxBFc`**, equipe `team_1A1MXMKRlbBUFJJTs5xjNKrk`. **Não alterar `box-oficina-portfolio`, ligado ao AGROTECH.**

O GitHub `Implantac/box/main` continua na 1.0, commit `f261c49b4c302f9894dce1f1b04cc2966890f746`. Não houve push; o deploy automático Git continua desabilitado. Não redeployar o `main` antigo para esta correção.

Para repetir as verificações do site publicado, com Node.js 22 e dependências instaladas:

```bash
BOX_TEST_URL=https://box-portfolio-orpin.vercel.app node scripts/verificar-deploy.mjs
BOX_TEST_URL=https://box-portfolio-orpin.vercel.app node scripts/verificar-layout.mjs
BOX_TEST_URL=https://box-portfolio-orpin.vercel.app npx playwright test --config=playwright.release.config.ts
```

As verificações exigem a versão pública correspondente; a 1.1.1 foi confirmada antes da suíte remota. Relatórios públicos e locais têm nomes separados. `qa/resumo-v1.1.1.json` conserva a fotografia **local pré-publicação**. A documentação interna do ZIP permanece uma fotografia de seu empacotamento; este comprovante posterior e os relatórios públicos a complementam sem alterar o ZIP.

## Limites preservados

Somente dados fictícios. Sem banco/migração remota, pagamento, rede social real, contratação ou mudança em AGROTECH. Docker/Hostinger, Auth/MFA/PostgREST/SMTP remotos, concorrência multiconexão e backup externo continuam sem homologação. Não houve nova campanha de desempenho ou aprovação de Core Web Vitals. Os 46 itens do planejamento não foram declarados concluídos.

Histórico da versão anterior: [Validação 1.1.0](VALIDACAO.md).
