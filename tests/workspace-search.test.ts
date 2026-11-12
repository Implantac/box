import { describe, it, expect } from 'vitest';
import { createSeed, sid } from '@/lib/seed';
import { searchWorkspace } from '@/lib/workspace-search';

describe('busca integrada e limites por perfil', () => {
 it('localiza a OS pelo veículo sem alterar a URL com o termo', () => {
  const result = searchWorkspace(createSeed(), 'owner', 'corolla');
  expect(result[0]).toMatchObject({ kind: 'order', id: sid(43), href: `/painel/ordens/${sid(43)}` });
  expect(result[0].href).not.toContain('corolla');
 });
 it('localiza peça por código e abre recorte de identificador', () => {
  const result = searchWorkspace(createSeed(), 'reception', 'box-demo-001');
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ kind: 'part', href: `/painel/estoque?registro=${sid(401)}` });
 });
 it('ignora acentos, caixa e espaços nas palavras da pesquisa', () => {
  const result = searchWorkspace(createSeed(), 'owner', '  FILTRO demonstracao  ');
  expect(result.some(r => r.kind === 'part' && r.id === sid(401))).toBe(true);
 });
 it('encontra mecânico, serviços e comissões, sem indexar valores', () => {
  const result = searchWorkspace(createSeed(), 'owner', 'Marina');
  expect(new Set(result.map(r => r.kind))).toEqual(new Set(['mechanic', 'service', 'commission']));
  expect(JSON.stringify(result)).not.toContain('amountCents');
 });
 it('recepção nunca recebe resultado de comissão mesmo com a seed completa da demo', () => {
  const result = searchWorkspace(createSeed(), 'reception', 'Marina');
  expect(result.some(r => r.kind === 'service')).toBe(true);
  expect(result.some(r => r.kind === 'commission')).toBe(false);
  expect(searchWorkspace(createSeed(), 'reception', 'comissão')).toEqual([]);
 });
 it.each(['marketing', 'customer'] as const)('%s não pesquisa registros internos', role => {
  expect(searchWorkspace(createSeed(), role, 'demo')).toEqual([]);
 });
 it('técnico encontra somente suas OS, serviços e seu cadastro', () => {
  const seed = createSeed();
  expect(searchWorkspace(seed, 'technician', 'Marina')).toEqual([]);
  expect(searchWorkspace(seed, 'technician', 'box-demo')).toEqual([]);
  const results = searchWorkspace(seed, 'technician', 'Lucas');
  expect(results.some(r => r.kind === 'mechanic' && r.id === sid(451))).toBe(true);
  expect(results.every(r => !['part', 'commission'].includes(r.kind))).toBe(true);
 });
 it('identidade conectada usa vínculo individual, não o nome padrão da demo', () => {
  const seed = createSeed();
  seed.mechanics[1].userId = sid(900);
  const actor = { portfolio: false, name: 'Marina • demo', userId: sid(900) };
  expect(searchWorkspace(seed, 'technician', 'Marina', actor).some(r => r.kind === 'mechanic')).toBe(true);
  expect(searchWorkspace(seed, 'technician', 'Lucas', actor)).toEqual([]);
 });
 it('financeiro encontra apuração e operação sem abrir a edição de OS', () => {
  const result = searchWorkspace(createSeed(), 'finance', 'Marina');
  expect(result.some(r => r.kind === 'commission')).toBe(true);
  expect(result.every(r => !r.href.startsWith('/painel/ordens/'))).toBe(true);
 });
 it('não pesquisa motivos internos, request keys, nem termos de um caractere', () => {
  const seed = createSeed();
  seed.services[0].requestKey = 'segredo-de-retry-nunca-indexado';
  expect(searchWorkspace(seed, 'owner', 'segredo-de-retry')).toEqual([]);
  expect(searchWorkspace(seed, 'owner', 'f')).toEqual([]);
  expect(searchWorkspace(seed, 'owner', 'transferência financeira')).toEqual([]);
  expect(searchWorkspace(seed, 'owner', 'demo').length).toBeLessThanOrEqual(8);
 });
});
