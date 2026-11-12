// Extensão v1.1: estoque, capacidade da equipe e comissões. Valores sempre fictícios na demo.
export type CommissionMode = 'sem' | 'percentual' | 'fixo';
/** value: pontos-base (100 = 1%) ou centavos; sem comissão usa zero. */
export interface CommissionPolicy { mode: CommissionMode; value: number }
export interface Part { id: string; sku: string; name: string; unit: 'un' | 'kit' | 'frasco'; location: string; minimum: number; referenceCostCents: number; createdAt: string }
export type StockMovementKind = 'entrada' | 'ajuste_entrada' | 'ajuste_saida' | 'reserva' | 'liberacao' | 'consumo' | 'devolucao';
/** Reserva/liberação não alteram o saldo físico. referenceId aponta para reserva ou consumo. */
export interface StockMovement { id: string; partId: string; kind: StockMovementKind; quantity: number; unitCostCents: number; reason: string; createdAt: string; orderId?: string; quoteId?: string; referenceId?: string; requestKey?: string }
export interface Mechanic { id: string; name: string; active: boolean; note: string; userId?: string; createdAt: string }
export interface CommissionRule extends CommissionPolicy { id: string; mechanicId: string; createdAt: string }
export interface MechanicAbsence { id: string; mechanicId: string; startsAt: string; endsAt: string; reason: string; status: 'ativa' | 'cancelada'; createdAt: string; cancellationReason?: string }
export type ServiceStatus = 'planejado' | 'em_execucao' | 'pausado' | 'concluido' | 'cancelado';
export interface ServiceEvent { status: ServiceStatus; at: string; note: string }
export interface ServiceTask { authorizationCurrent?: boolean; id: string; orderId: string; mechanicId: string; quoteId: string; itemIndex: number; serviceKey: string; description: string; plannedAt: string; duration: number; status: ServiceStatus; appointmentId?: string; startedAt?: string; completedAt?: string; createdAt: string; history: ServiceEvent[]; requestKey?: string }
/** Fotografia da base e da regra: mudanças posteriores não recalculam o histórico. */
export interface ServiceCommission extends CommissionPolicy { requestKey?: string; description: string; id: string; serviceId: string; orderId: string; mechanicId: string; quoteId: string; baseCents: number; amountCents: number; status: 'prevista' | 'gerada' | 'cancelada'; createdAt: string; earnedAt?: string; cancellationReason?: string }
export interface CommissionPayment { id: string; commissionId: string; kind: 'repasse' | 'estorno'; amountCents: number; note: string; createdAt: string; requestKey?: string }
export interface WorkshopData { parts: Part[]; stockMovements: StockMovement[]; mechanics: Mechanic[]; commissionRules: CommissionRule[]; absences: MechanicAbsence[]; services: ServiceTask[]; commissions: ServiceCommission[]; commissionPayments: CommissionPayment[] }
export type WorkshopCommand =
 | { type: 'save_part'; part: Part }
 | { type: 'record_stock'; id: string; partId: string; kind: 'entrada' | 'ajuste_entrada' | 'ajuste_saida'; quantity: number; reason: string }
 | { type: 'reserve_part'; id: string; orderId: string; partId: string; quantity: number }
 | { type: 'consume_reserved_part'; id: string; reservationId: string; quantity: number }
 | { type: 'release_reserved_part'; id: string; reservationId: string; quantity: number; reason: string }
 | { type: 'return_part'; id: string; consumptionId: string; quantity: number; reason: string }
 | { type: 'save_mechanic'; mechanic: Mechanic }
 | { type: 'save_commission_rule'; rule: CommissionRule }
 | { type: 'create_absence'; absence: MechanicAbsence }
 | { type: 'cancel_absence'; id: string; reason: string }
 | { type: 'create_service'; service: Pick<ServiceTask, 'id' | 'orderId' | 'mechanicId' | 'quoteId' | 'itemIndex' | 'plannedAt' | 'duration' | 'appointmentId'>; commission?: CommissionPolicy }
 | { type: 'set_service_status'; id: string; status: Exclude<ServiceStatus,'planejado'>; note?: string }
 | { type: 'refresh_service_authorization'; id: string }
 | { type: 'record_commission_payment'; id: string; commissionId: string; kind: 'repasse' | 'estorno'; amountCents: number; note: string }
 | { type: 'cancel_commission'; id: string; reason: string };
export const DEMO_NOW = '2026-11-12T12:00:00-03:00';
export const SERVICE_LABELS: Record<ServiceStatus,string> = { planejado:'Planejado',em_execucao:'Em execução',pausado:'Pausado',concluido:'Concluído',cancelado:'Cancelado' };
export const STOCK_LABELS: Record<StockMovementKind,string> = { entrada:'Entrada',ajuste_entrada:'Ajuste de entrada',ajuste_saida:'Ajuste de saída',reserva:'Reserva para OS',liberacao:'Liberação de reserva',consumo:'Baixa na OS',devolucao:'Devolução não utilizada' };
export const emptyWorkshop = (): WorkshopData => ({parts:[],stockMovements:[],mechanics:[],commissionRules:[],absences:[],services:[],commissions:[],commissionPayments:[]});
