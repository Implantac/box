import type { WorkshopData, WorkshopCommand } from './workshop-model';
import type { FiscalData, FiscalCommand } from './fiscal-model';
export type Role = 'owner' | 'reception' | 'technician' | 'finance' | 'marketing' | 'customer';
export type Channel = 'instagram' | 'facebook' | 'youtube';
export type OrderStatus = 'recepcao' | 'diagnostico' | 'aguardando_aprovacao' | 'aguardando_pecas' | 'execucao' | 'testes' | 'pronto' | 'entregue' | 'cancelada';
export type QuoteStatus = 'rascunho' | 'enviado' | 'aprovado' | 'recusado';
export interface Customer { id: string; name: string; email: string; phone: string; notes: string; userId?: string; createdAt: string }
export interface Vehicle { id: string; customerId: string; model: string; year: number; plate: string; km: number }
export interface WorkOrder { id: string; number: string; customerId: string; customerName: string; vehicleId: string; vehicleLabel: string; status: OrderStatus; complaint: string; diagnosis: string; technician: string; dueDate: string; createdAt: string; returnOf?: string; cancellationReason?: string; currentQuoteId?: string; currentQuoteVersion?: number; checklist: string[] }
export interface QuoteItem { id?: string; partId?: string; description: string; kind: 'peca' | 'servico'; quantity: number; unitCents: number }
export interface Quote { id: string; orderId: string; version: number; status: QuoteStatus; items: QuoteItem[]; discountCents: number; terms: string; createdAt: string; respondedAt?: string; evidence?: string }
export interface Appointment { id: string; customerId: string; customerName: string; vehicleLabel: string; service: string; startsAt: string; duration: number; technician: string; status: 'solicitado' | 'confirmado' | 'concluido' | 'cancelado' | 'faltou' }
export interface Payment { id: string; orderId: string; amountCents: number; method: 'pix' | 'cartao' | 'dinheiro'; kind: 'recebimento' | 'estorno'; note: string; createdAt: string }
export interface Cost { id: string; orderId: string; description: string; amountCents: number; createdAt: string }
export interface Lead { id: string; name: string; phone: string; vehicle: string; note: string; source: string; status: 'novo' | 'em_contato' | 'convertido' | 'perdido'; createdAt: string; nextAction: string }
export interface Delivery { channel: Channel; status: 'simulado' | 'falha_simulada' | 'requer_conexao'; message: string; at: string }
export interface SocialPost { id: string; title: string; caption: string; variants?: Partial<Record<Channel,string>>; mediaKind: 'imagem' | 'video'; visual: 'gear' | 'care' | 'team'; channels: Channel[]; revision: number; approvedRevision?: number; rightsConfirmed: boolean; status: 'rascunho' | 'aprovado' | 'agendado_demo' | 'simulado' | 'parcial_demo'; scheduledAt?: string; deliveries: Delivery[]; createdAt: string }
export interface Audit { id: string; action: string; actor: string; entityId: string; at: string }
export interface Settings { heroTitle: string; heroSubtitle: string; brandName: string; location: string }
export interface Workspace extends WorkshopData, FiscalData { revision: number; customers: Customer[]; vehicles: Vehicle[]; orders: WorkOrder[]; quotes: Quote[]; appointments: Appointment[]; payments: Payment[]; costs: Cost[]; leads: Lead[]; posts: SocialPost[]; audit: Audit[]; settings: Settings }
export interface Session { role: Role; name: string; userId: string; workspaceId: string; needsMfa?: boolean }
export type Command =
 | { type: 'create_customer'; customer: Customer; vehicle?: Vehicle }
 | { type: 'create_order'; order: WorkOrder }
 | { type: 'transition_order'; id: string; status: OrderStatus; note?: string; diagnosis?: string; checklist?: string[] }
 | { type: 'create_quote'; quote: Quote }
 | { type: 'set_quote_status'; id: string; status: QuoteStatus; evidence?: string; customerId?: string }
 | { type: 'create_appointment'; appointment: Appointment }
 | { type: 'set_appointment_status'; id: string; status: Appointment['status'] }
 | { type: 'record_payment'; payment: Payment }
 | { type: 'record_cost'; cost: Cost }
 | { type: 'create_lead'; lead: Lead }
 | { type: 'set_lead_status'; id: string; status: Lead['status']; nextAction?: string }
 | { type: 'save_post'; post: SocialPost }
 | { type: 'approve_post'; id: string }
 | { type: 'simulate_post'; id: string; failChannel?: Channel; scheduleAt?: string }
 | { type: 'cancel_post_schedule'; id: string }
 | { type: 'update_settings'; settings: Settings }
 | WorkshopCommand
 | FiscalCommand;
export const ROLE_LABELS: Record<Role, string> = { owner: 'Proprietário', reception: 'Recepção', technician: 'Técnico', finance: 'Financeiro', marketing: 'Conteúdo', customer: 'Cliente' };
export const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
 recepcao: { label: 'Recepção', tone: 'neutral' }, diagnostico: { label: 'Em diagnóstico', tone: 'blue' }, aguardando_aprovacao: { label: 'Aguardando aprovação', tone: 'amber' }, aguardando_pecas: { label: 'Aguardando peças', tone: 'purple' }, execucao: { label: 'Em execução', tone: 'amber' }, testes: { label: 'Em testes', tone: 'blue' }, pronto: { label: 'Pronto para entrega', tone: 'green' }, entregue: { label: 'Entregue', tone: 'neutral' }, cancelada: { label: 'Cancelada', tone: 'red' }
};
export const QUOTE_LABELS: Record<QuoteStatus, string> = { rascunho: 'Rascunho', enviado: 'Aguardando resposta', aprovado: 'Aprovado', recusado: 'Recusado' };
export const CHANNEL_LABELS: Record<Channel, string> = { instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube Shorts' };
export const DEMO_DAY = '2026-11-12';
export const SAMPLE_TECHNICIANS = ['Lucas • demo', 'Marina • demo', 'Rafael • demo'];
export const CHECKLIST = ['Condição externa registrada', 'Quilometragem conferida', 'Itens autorizados conferidos', 'Teste final realizado', 'Orientações de entrega preparadas'];
export const id = () => crypto.randomUUID();
