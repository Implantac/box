import type { Payment, Quote, QuoteItem } from './model';
export const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
export function toCents(value: string): number {
 const raw=value.trim();
 let clean:string;
 if(raw.includes(',')){if(!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(raw))throw new Error('Confira o valor. Exemplo: 1.234,56.');clean=raw.replace(/\./g,'').replace(',','.');}
 else if(/^\d+(?:\.\d{1,2})?$/.test(raw))clean=raw;
 else if(/^\d{1,3}(?:\.\d{3})+$/.test(raw))clean=raw.replace(/\./g,'');
 else throw new Error('Informe um valor com no máximo duas casas decimais.');
 if (!/^\d+(\.\d{1,2})?$/.test(clean)) throw new Error('Informe um valor com no máximo duas casas decimais.');
 const [whole, fraction = ''] = clean.split('.');
 const result = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
 if (!Number.isSafeInteger(result) || result < 0 || result > 100000000) throw new Error('Valor fora do limite permitido.');
 return result;
}
export const dateBR = (v: string, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: 'short', ...options }).format(new Date(v.length === 10 ? v + 'T12:00:00-03:00' : v));
export const timeBR = (v: string) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(v));
export const dateKey = (v: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(v));
export const quoteTotal = (q: Pick<Quote, 'items' | 'discountCents'>) => q.items.reduce((s: number, i: QuoteItem) => s + i.quantity * i.unitCents, 0) - q.discountCents;
export const latestQuote = (quotes: Quote[], orderId: string) => quotes.filter(q => q.orderId === orderId).sort((a, b) => b.version - a.version)[0];
export const netPaid = (payments: Payment[], orderId?: string) => payments.filter(p => !orderId || p.orderId === orderId).reduce((s, p) => s + (p.kind === 'estorno' ? -p.amountCents : p.amountCents), 0);
export const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export function csvCell(v: unknown): string { let s = String(v ?? ''); if (/^(?:[\s\uFEFF]*[=+\-@]|[\t\r\n])/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; }
export function downloadFile(name: string, text: string, type = 'text/plain;charset=utf-8') {
 const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 500);
}
export function exportCsv(name: string, rows: unknown[][]) { downloadFile(name, '\uFEFF' + rows.map(r => r.map(csvCell).join(';')).join('\r\n'), 'text/csv;charset=utf-8'); }
