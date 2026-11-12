import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sid } from '../../src/lib/seed';
import type { Workspace } from '../../src/lib/model';
import { stockBalance, directCosts, commissionNetPaid } from '../../src/lib/workshop';

// Interface em modo portfólio. Autorização real é exercitada separadamente pelos testes HTTP/RLS.
const key = 'box-portfolio-v1-session';
const saved = (page: Page): Promise<Workspace> => page.evaluate(key => JSON.parse(sessionStorage.getItem(key) || 'null')?.state, key);
const test = base.extend({ page: async ({ page }, use) => {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await use(page);
 expect(errors, 'Sem erro de execução nos novos fluxos').toEqual([]);
} });
test.setTimeout(60000);
async function start(page: Page, path: string) {
 await page.goto(path);
 await expect.poll(() => page.evaluate(key => Boolean(sessionStorage.getItem(key)), key)).toBe(true);
 await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}
async function closed(page: Page) { await expect(page.getByRole('dialog')).not.toBeVisible(); }
async function checkDialog(page: Page) {
 const axe = await new AxeBuilder({ page }).include('dialog').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
 expect(axe.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
}
async function approveCorolla(page: Page) {
 await start(page, '/cliente');
 await page.getByRole('button', { name: 'Aprovar orçamento fictício' }).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button', { name: 'Confirmar aprovação', exact: true }).click();
 await expect(page.getByText('Aprovação registrada', { exact: true })).toBeVisible();
 await page.goto('/painel/ordens/' + sid(43));
 await page.getByLabel('Situação do atendimento').selectOption('execucao');
 await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
 await expect.poll(async () => (await saved(page)).orders.find(o => o.id === sid(43))?.status).toBe('execucao');
}
async function search(page: Page, value: string) {
 if ((page.viewportSize()?.width || 1440) < 761) {
  await page.getByRole('button', { name: 'Abrir busca', exact: true }).click();
  await page.getByLabel('Buscar registros da oficina').fill(value);
  return page.locator('.modal-search-results');
 }
 await page.getByLabel('Buscar na oficina', { exact: true }).fill(value);
 return page.locator('.search-results');
}
async function navigate(page: Page, label: string) {
 if ((page.viewportSize()?.width || 1440) < 761) await page.getByRole('button', { name: 'Abrir navegação' }).click();
 await page.getByRole('navigation', { name: 'Navegação do sistema' }).getByRole('link', { name: label, exact: true }).click();
}

test('peça nova, entrada, ajuste motivado e unidade histórica preservada', async ({ page }) => {
 await start(page, '/painel/estoque');
 await page.getByRole('button', { name: 'Nova peça', exact: true }).click();
 await checkDialog(page);
 await page.getByLabel('Código da peça', { exact: true }).fill('QA-PECA-001');
 await page.getByLabel('Nome da peça', { exact: true }).fill('Peça fictícia do fluxo de estoque');
 await page.getByLabel('Estoque mínimo', { exact: true }).fill('2');
 await page.getByLabel('Custo de referência (R$)', { exact: true }).fill('10,00');
 await page.getByRole('button', { name: 'Salvar peça', exact: true }).click();
 await closed(page);
 let state = await saved(page);
 const part = state.parts.find(p => p.sku === 'QA-PECA-001')!;
 expect(stockBalance(state, part.id)).toEqual({ physical: 0, reserved: 0, available: 0 });
 await page.getByRole('button', { name: 'Movimentar peça QA-PECA-001', exact: true }).click();
 await page.getByLabel('Quantidade inteira').fill('3');
 await page.getByLabel('Motivo / referência').fill('Entrada fictícia para o teste de interface.');
 await page.getByRole('button', { name: 'Registrar movimento', exact: true }).click();
 await closed(page);
 await page.getByRole('button', { name: 'Movimentar peça QA-PECA-001', exact: true }).click();
 await page.getByLabel('Tipo de movimento').selectOption('ajuste_saida');
 await page.getByLabel('Quantidade inteira').fill('1');
 await page.getByLabel('Motivo / referência').fill('Correção de contagem fictícia e motivada.');
 await page.getByRole('button', { name: 'Registrar movimento', exact: true }).click();
 await closed(page);
 await page.getByRole('button', { name: 'Editar peça QA-PECA-001', exact: true }).click();
 await expect(page.getByLabel('Unidade', { exact: true })).toBeDisabled();
 await page.getByLabel('Custo de referência (R$)', { exact: true }).fill('20,00');
 await page.getByRole('button', { name: 'Salvar peça', exact: true }).click();
 await closed(page);
 state = await saved(page);
 expect(stockBalance(state, part.id)).toEqual({ physical: 2, reserved: 0, available: 2 });
 expect(state.stockMovements.filter(m => m.partId === part.id).map(m => m.unitCostCents)).toEqual([1000, 1000]);
 await page.getByRole('checkbox', { name: 'Somente no mínimo ou abaixo' }).check();
 await expect(page.locator('[data-part="QA-PECA-001"]')).toBeVisible();
});

test('OS exige conclusão e resolução de reservas; baixa e devolução mantêm origem', async ({ page }) => {
 await start(page, '/painel/ordens/' + sid(42));
 await page.getByLabel('Situação do atendimento').selectOption('testes');
 await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
 await expect(page.getByText('Conclua ou cancele os serviços alocados antes de avançar para testes ou entrega.')).toBeVisible();
 await page.locator(`[data-service="${sid(481)}"]`).getByRole('button', { name: /Concluir serviço/ }).click();
 await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
 await expect(page.getByText('Baixe ou libere as reservas de peças antes de avançar para testes ou entrega.')).toBeVisible();
 await page.getByRole('button', { name: 'Liberar reserva BOX-DEMO-001 OS-2026-0042', exact: true }).click();
 await page.getByLabel('Motivo', { exact: true }).fill('Reserva fictícia liberada antes de nova separação.');
 await page.getByRole('button', { name: 'Liberar reserva', exact: true }).click();
 await closed(page);
 await page.getByRole('button', { name: 'Reservar peça para esta OS' }).click();
 await page.getByRole('button', { name: 'Confirmar reserva', exact: true }).click();
 await closed(page);
 let state = await saved(page);
 const reservation = state.stockMovements.find(m => m.kind === 'reserva' && m.orderId === sid(42) && m.id !== sid(441))!;
 expect(stockBalance(state, sid(401))).toEqual({ physical: 8, reserved: 1, available: 7 });
 await page.getByRole('button', { name: 'Baixar reserva BOX-DEMO-001 OS-2026-0042', exact: true }).click();
 await page.getByRole('button', { name: 'Confirmar baixa' }).click();
 await closed(page);
 state = await saved(page);
 const consumption = state.stockMovements.find(m => m.kind === 'consumo' && m.referenceId === reservation.id)!;
 expect(stockBalance(state, sid(401))).toEqual({ physical: 7, reserved: 0, available: 7 });
 expect(directCosts(state, sid(42)).parts).toBe(9500);
 await page.getByRole('button', { name: 'Ver baixas e devoluções desta OS' }).click();
 await page.getByRole('button', { name: 'Devolver peça BOX-DEMO-001 OS-2026-0042', exact: true }).click();
 await page.getByLabel('Motivo', { exact: true }).fill('Material fictício não utilizado e devolvido à origem.');
 await page.getByRole('button', { name: 'Confirmar devolução' }).click();
 await closed(page);
 state = await saved(page);
 expect(stockBalance(state, sid(401))).toEqual({ physical: 8, reserved: 0, available: 8 });
 expect(state.stockMovements.find(m => m.kind === 'devolucao' && m.referenceId === consumption.id)?.unitCostCents).toBe(9500);
 expect(directCosts(state, sid(42)).parts).toBe(0);
 await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
 await expect.poll(async () => (await saved(page)).orders.find(o => o.id === sid(42))?.status).toBe('testes');
});

test('reserva e alocação ficam bloqueadas sem aprovação da versão da própria OS', async ({ page }) => {
 await start(page, '/painel/ordens/' + sid(43));
 await page.getByRole('button', { name: 'Reservar peça para esta OS' }).click();
 await expect(page.getByLabel('Ordem de serviço', { exact: true })).toHaveValue(sid(43));
 await expect(page.getByRole('button', { name: 'Confirmar reserva', exact: true })).toBeDisabled();
 await expect(page.getByText('Sem peça vinculada ao estoque', { exact: true })).toBeVisible();
 await page.keyboard.press('Escape');
 await page.getByRole('button', { name: 'Alocar serviço desta OS' }).click();
 await expect(page.getByLabel('Ordem de serviço', { exact: true })).toHaveValue(sid(43));
 await expect(page.getByRole('button', { name: 'Confirmar alocação', exact: true })).toBeDisabled();
 expect((await saved(page)).services).toHaveLength(4);
});

test('alocação fixa, execução, pausa, conclusão, repasse parcial e estorno', async ({ page }) => {
 await approveCorolla(page);
 await page.getByRole('button', { name: 'Alocar serviço desta OS' }).click();
 await page.getByLabel('Mecânico responsável', { exact: true }).selectOption(sid(454));
 await page.getByLabel('Comissão neste serviço', { exact: true }).selectOption('fixo');
 await page.getByLabel('Valor fixo deste serviço (R$)', { exact: true }).fill('50,00');
 await checkDialog(page);
 await page.getByRole('button', { name: 'Confirmar alocação', exact: true }).click();
 await closed(page);
 let state = await saved(page);
 const task = state.services.find(t => t.orderId === sid(43))!;
 const commission = state.commissions.find(c => c.serviceId === task.id)!;
 expect(commission).toMatchObject({ status: 'prevista', mode: 'fixo', amountCents: 5000, baseCents: 89000 });
 const row = page.locator(`[data-service="${task.id}"]`);
 await row.getByRole('button', { name: /Iniciar serviço/ }).click();
 await row.getByRole('button', { name: /Pausar serviço/ }).click();
 await page.getByLabel('Motivo', { exact: true }).fill('Pausa fictícia para conferência do fluxo.');
 await page.getByRole('button', { name: 'Registrar pausa', exact: true }).click();
 await closed(page);
 await row.getByRole('button', { name: /Retomar serviço/ }).click();
 await row.getByRole('button', { name: /Concluir serviço/ }).click();
 await expect.poll(async () => (await saved(page)).commissions.find(c => c.id === commission.id)?.status).toBe('gerada');
 state = await saved(page);
 expect(state.services.find(t => t.id === task.id)?.history.map(h => h.status)).toEqual(['planejado', 'em_execucao', 'pausado', 'em_execucao', 'concluido']);
 const costs = directCosts(state).total;
 await page.goto('/painel/comissoes');
 const entry = page.locator(`[data-commission="${commission.id}"]`);
 await entry.getByRole('button', { name: /Registrar repasse/ }).click();
 await page.getByLabel('Valor do registro (R$)', { exact: true }).fill('20,00');
 await checkDialog(page);
 await page.getByRole('button', { name: 'Confirmar registro de repasse', exact: true }).click();
 await closed(page);
 await entry.getByRole('button', { name: /Estornar repasse/ }).click();
 await page.getByLabel('Valor do registro (R$)', { exact: true }).fill('5,00');
 await page.getByRole('button', { name: 'Registrar estorno', exact: true }).click();
 await closed(page);
 state = await saved(page);
 expect(commissionNetPaid(state, commission.id)).toBe(1500);
 expect(state.commissionPayments.filter(p => p.commissionId === commission.id)).toHaveLength(2);
 expect(directCosts(state).total).toBe(costs);
});

test('regra opcional aceita fixo, nenhuma e percentual sem recalcular o histórico', async ({ page }) => {
 await start(page, '/painel/comissoes');
 const before = (await saved(page)).commissions;
 await page.getByRole('button', { name: 'Configurar regras' }).click();
 await page.getByRole('button', { name: 'Editar regra de comissão Lucas • demo', exact: true }).click();
 await page.getByLabel('Modelo de comissão').selectOption('fixo');
 await page.getByLabel('Valor fixo (R$)', { exact: true }).fill('35,50');
 await checkDialog(page);
 await page.getByRole('button', { name: 'Salvar regra padrão' }).click();
 await closed(page);
 expect((await saved(page)).commissionRules.find(r => r.mechanicId === sid(451))).toMatchObject({ mode: 'fixo', value: 3550 });
 await page.getByRole('button', { name: 'Editar regra de comissão Lucas • demo', exact: true }).click();
 await page.getByLabel('Modelo de comissão').selectOption('sem');
 await page.getByRole('button', { name: 'Salvar regra padrão' }).click();
 await closed(page);
 expect((await saved(page)).commissionRules.find(r => r.mechanicId === sid(451))).toMatchObject({ mode: 'sem', value: 0 });
 await page.getByRole('button', { name: 'Editar regra de comissão Lucas • demo', exact: true }).click();
 await page.getByLabel('Modelo de comissão').selectOption('percentual');
 await page.getByLabel('Percentual (%)', { exact: true }).fill('12,50');
 await page.getByRole('button', { name: 'Salvar regra padrão' }).click();
 await closed(page);
 const state = await saved(page);
 expect(state.commissionRules.find(r => r.mechanicId === sid(451))).toMatchObject({ mode: 'percentual', value: 1250 });
 expect(state.commissions).toEqual(before);
});

test('disponibilidade cruza execução e ausências, com cancelamento motivado', async ({ page }) => {
 await start(page, '/painel/mecanicos');
 await expect(page.locator('[data-mechanic="Lucas • demo"]').getByText('Disponível', { exact: true })).toBeVisible();
 await expect(page.locator('[data-mechanic="Marina • demo"]').getByText('Em serviço', { exact: true })).toBeVisible();
 await expect(page.locator('[data-mechanic="Rafael • demo"]').getByText('Indisponível', { exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Indisponibilidades', exact: true }).click();
 await page.getByRole('button', { name: 'Registrar indisponibilidade', exact: true }).click();
 await page.getByLabel('Mecânico', { exact: true }).selectOption(sid(454));
 await page.getByLabel('Motivo operacional', { exact: true }).fill('Intervalo fictício para teste operacional.');
 await checkDialog(page);
 await page.getByRole('dialog').getByRole('button', { name: 'Registrar indisponibilidade', exact: true }).click();
 await closed(page);
 await page.getByRole('button', { name: 'Disponibilidade', exact: true }).click();
 await expect(page.locator('[data-mechanic="Camila • demo"]').getByText('Indisponível', { exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Indisponibilidades', exact: true }).click();
 await page.getByRole('button', { name: 'Cancelar indisponibilidade Camila • demo', exact: true }).click();
 await page.getByLabel('Motivo', { exact: true }).fill('Cancelamento fictício sem apagar o intervalo anterior.');
 await page.getByRole('button', { name: 'Confirmar registro', exact: true }).click();
 await closed(page);
 const state = await saved(page);
 expect(state.absences.find(a => a.mechanicId === sid(454))).toMatchObject({ status: 'cancelada', cancellationReason: 'Cancelamento fictício sem apagar o intervalo anterior.' });
 await page.getByRole('button', { name: 'Registrar indisponibilidade', exact: true }).click();
 await page.getByLabel('Mecânico', { exact: true }).selectOption(sid(452));
 await page.getByLabel('Motivo operacional', { exact: true }).fill('Conflito fictício com serviço ainda em execução.');
 await page.getByRole('dialog').getByRole('button', { name: 'Registrar indisponibilidade', exact: true }).click();
 await expect(page.getByText('Mecânico já alocado em outro serviço nesse intervalo.', { exact: true })).toBeVisible();
 await expect(page.getByRole('dialog')).toBeVisible();
 expect((await saved(page)).absences).toHaveLength(2);
});

test('técnico acompanha item próprio em OS de outro responsável sem editar a ordem', async ({ page }) => {
 await approveCorolla(page);
 await page.getByRole('button', { name: 'Alocar serviço desta OS' }).click();
 await page.getByLabel('Mecânico responsável', { exact: true }).selectOption(sid(451));
 await page.getByRole('button', { name: 'Confirmar alocação', exact: true }).click();
 await closed(page);
 const state = await saved(page);
 const task = state.services.find(t => t.orderId === sid(43))!;
 expect(state.commissions.find(c => c.serviceId === task.id)).toMatchObject({ mode: 'percentual', value: 1000, baseCents: 89000, amountCents: 8900 });
 await page.getByLabel('Perfil de demonstração').selectOption('technician');
 await expect(page.getByLabel('Diagnóstico e evidências')).toBeDisabled();
 await expect(page.getByRole('button', { name: 'Salvar acompanhamento' })).toBeDisabled();
 const row = page.locator(`[data-service="${task.id}"]`);
 await row.getByRole('button', { name: /Iniciar serviço/ }).click();
 await row.getByRole('button', { name: /Concluir serviço/ }).click();
 await expect(row.getByText('Concluído', { exact: true })).toBeVisible();
 await navigate(page, 'Mecânicos e serviços');
 await expect(page.locator('[data-mechanic]')).toHaveCount(1);
 await expect(page.locator('[data-mechanic="Lucas • demo"]')).toBeVisible();
 await expect(page.getByRole('navigation', { name: 'Navegação do sistema' }).getByRole('link', { name: 'Comissões', exact: true })).toHaveCount(0);
});

test('nova versão libera reservas e revisão preserva a comissão substituída', async ({ page }) => {
 await start(page, '/painel/ordens/' + sid(42));
 await page.getByRole('button', { name: 'Nova versão / adicional' }).click();
 await page.getByLabel('Unitário (R$)', { exact: true }).first().fill('1550,00');
 await page.getByRole('button', { name: 'Salvar versão 2' }).click();
 await closed(page);
 let state = await saved(page);
 expect(stockBalance(state, sid(401)).reserved).toBe(0);
 expect(state.services.find(t => t.id === sid(481))?.status).toBe('pausado');
 expect(state.commissions.find(c => c.id === sid(491))).toMatchObject({ status: 'prevista', amountCents: 18125 });
 await page.goto('/painel/orcamentos');
 await page.getByRole('button', { name: 'Abrir orçamento de Volkswagen Golf 2017' }).click();
 await page.getByRole('button', { name: 'Registrar autorização ou recusa recebida por outro meio' }).click();
 await page.getByLabel('Evidência / referência da resposta').fill('Autorização fictícia explícita da versão adicional.');
 await page.getByRole('button', { name: 'Registrar resposta', exact: true }).click();
 await expect(page.getByText('Resposta vinculada à versão 2', { exact: true })).toBeVisible();
 await page.keyboard.press('Escape');
 await page.goto('/painel/ordens/' + sid(42));
 const row = page.locator(`[data-service="${sid(481)}"]`);
 await row.getByRole('button', { name: 'Revisar autorização', exact: true }).click();
 await expect.poll(async () => (await saved(page)).commissions.find(c => c.id === sid(491))?.status).toBe('cancelada');
 state = await saved(page);
 expect(state.commissions.find(c => c.serviceId === sid(481) && c.status === 'prevista')).toMatchObject({ baseCents: 155000, amountCents: 19375, value: 1250 });
 expect(state.stockMovements.find(m => m.id === sid(441))).toBeDefined();
 expect(state.quotes.filter(q => q.orderId === sid(42))).toHaveLength(2);
 await page.getByLabel('Situação do atendimento').selectOption('execucao');
 await page.getByRole('button', { name: 'Salvar acompanhamento' }).click();
 await expect.poll(async () => (await saved(page)).orders.find(o => o.id === sid(42))?.status).toBe('execucao');
 await row.getByRole('button', { name: /Retomar serviço/ }).click();
 await expect(row.getByText('Em execução', { exact: true })).toBeVisible();
});

test('busca global abre o registro certo no desktop e no celular e respeita perfis', async ({ page }) => {
 await start(page, '/painel');
 let results = await search(page, 'BOX-DEMO-001');
 await results.getByRole('link', { name: /Peça · BOX-DEMO-001/ }).click();
 await expect(page.locator('.search-scope-note')).toContainText('Peça selecionada');
 await expect(page.locator('tr[data-part]')).toHaveCount(1);
 results = await search(page, 'Marina');
 await results.getByRole('link', { name: /^Mecânico Marina/ }).click();
 await expect(page.locator('[data-mechanic]')).toHaveCount(1);
 await expect(page.locator('[data-mechanic="Marina • demo"]')).toBeVisible();
 results = await search(page, 'Golf');
 await results.getByRole('link', { name: /^Serviço ·/ }).click();
 await expect(page.locator('tr[data-service]')).toHaveCount(1);
 await expect(page.locator('tr[data-service]')).toHaveAttribute('data-service', sid(481));
 results = await search(page, 'comissão');
 await results.getByRole('link', { name: /^Comissão ·/ }).first().click();
 await expect(page.locator('.search-scope-note')).toContainText('Comissão selecionada');
 await expect(page.locator('tr[data-commission]')).toHaveCount(1);
 await page.getByLabel('Perfil de demonstração').selectOption('reception');
 await expect(page.getByText('Este perfil tem outro foco.', { exact: true })).toBeVisible();
 results = await search(page, 'comissão');
 await expect(results.getByRole('link')).toHaveCount(0);
 await expect(results).toContainText('Nenhum registro disponível');
});

test('CSV de estoque e apuração exporta somente o recorte demonstrativo', async ({ page }) => {
 await start(page, '/painel/estoque');
 await page.getByLabel('Buscar peça no estoque').fill('BOX-DEMO-001');
 let pending = page.waitForEvent('download');
 await page.getByRole('button', { name: 'Exportar saldo' }).click();
 let download = await pending;
 expect(download.suggestedFilename()).toBe('box-estoque-ficticio.csv');
 let stream = await download.createReadStream();
 let chunks: Buffer[] = [];
 for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
 let text = Buffer.concat(chunks).toString();
 expect(text).toContain('BOX-DEMO-001');
 expect(text).not.toContain('BOX-DEMO-002');
 await page.goto('/painel/comissoes');
 await page.getByLabel('Mecânico da apuração').selectOption(sid(452));
 pending = page.waitForEvent('download');
 await page.getByRole('button', { name: 'Exportar apuração' }).click();
 download = await pending;
 expect(download.suggestedFilename()).toBe('box-comissoes-ficticias.csv');
 stream = await download.createReadStream();chunks = [];
 for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
 text = Buffer.concat(chunks).toString();
 expect(text).toContain('Marina');
 expect(text).not.toContain('Rafael');
});

test('falha de cadastro duplicado mantém formulário sem criar peça ou sucesso fictício', async ({ page }) => {
 await start(page, '/painel/estoque');
 await page.getByRole('button', { name: 'Nova peça', exact: true }).click();
 await page.getByLabel('Código da peça', { exact: true }).fill('box-demo-001');
 await page.getByLabel('Nome da peça', { exact: true }).fill('Cadastro fictício duplicado');
 await page.getByRole('button', { name: 'Salvar peça', exact: true }).click();
 await expect(page.getByText('Código da peça já utilizado.', { exact: true })).toBeVisible();
 await expect(page.getByRole('dialog')).toBeVisible();
 expect((await saved(page)).parts).toHaveLength(6);
 await page.keyboard.press('Escape');
 await closed(page);
});
