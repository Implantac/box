import {describe,it,expect} from 'vitest';
import {toCents,csvCell,quoteTotal,dateBR,dateKey} from '@/lib/format';
import {commandSchema,workspaceRequestSchema,loginSchema} from '@/lib/validation';
import {createSeed,sid} from '@/lib/seed';
describe('valores sem ponto flutuante',()=>{
 it.each([['1.234,56',123456],['1234,56',123456],['10,00',1000],['10.00',1000],['0,01',1],['1.234',123400],['10',1000],['0',0]])('%s vira %i centavos',(input,expected)=>{expect(toCents(input)).toBe(expected);});
 it.each(['-1','1,234','abc','1.2.3','1,2,3','NaN','1000001,00','1e4',''])('rejeita %s',value=>expect(()=>toCents(value)).toThrow());
 it('soma por quantidade e aplica desconto',()=>{expect(quoteTotal({items:[{description:'Fictício',kind:'peca',quantity:3,unitCents:333}],discountCents:99})).toBe(900);});
});
describe('CSV protegido contra fórmulas',()=>{
 it.each(['=1+1','+cmd','-2+3','@SUM(A1)','\t=cmd','\r=cmd',' =1+1','\n=cmd'])('neutraliza início %j',v=>expect(csvCell(v)).toMatch(/^"'/));
 it('escapa aspas e delimitadores',()=>{expect(csvCell('a;"b"')).toBe('"a;""b"""');});
});
describe('datas em São Paulo',()=>{
 it('preserva dia civil sem deslocamento UTC',()=>expect(dateBR('2026-11-12',{month:'2-digit',year:'numeric'})).toBe('12/11/2026'));
 it('considera fuso no agrupamento',()=>expect(dateKey('2026-11-13T01:00:00Z')).toBe('2026-11-12'));
});
describe('contratos da API',()=>{
 it('aceita cliente fictício válido',()=>{expect(commandSchema.safeParse({type:'create_customer',customer:createSeed().customers[0],vehicle:createSeed().vehicles[0]}).success).toBe(true);});
 it('não aceita papel, workspace ou vínculo do cliente enviados pelo navegador',()=>{expect(workspaceRequestSchema.safeParse({revision:1,role:'owner',command:{type:'approve_post',id:sid(141)}}).success).toBe(false);expect(commandSchema.safeParse({type:'set_quote_status',id:sid(62),status:'aprovado',customerId:sid(3)}).success).toBe(false);});
 it('rejeita quantidade fracionária e números em string',()=>{const q={...createSeed().quotes[0],status:'rascunho',items:[{description:'Fictício',kind:'peca',quantity:1.5,unitCents:1000}]};expect(commandSchema.safeParse({type:'create_quote',quote:q}).success).toBe(false);expect(commandSchema.safeParse({type:'record_cost',cost:{id:sid(400),orderId:sid(41),amountCents:'1000',description:'Teste fictício',createdAt:new Date().toISOString()}}).success).toBe(false);});
 it('rejeita UUID arbitrário e comando desconhecido',()=>{expect(commandSchema.safeParse({type:'approve_post',id:'1 OR 1=1'}).success).toBe(false);expect(commandSchema.safeParse({type:'delete_everything'}).success).toBe(false);});
 it('não valida credenciais vazias',()=>expect(loginSchema.safeParse({email:'sem-email',password:''}).success).toBe(false));
 it('rejeita data inexistente',()=>{const a={...createSeed().appointments[0],startsAt:'2026-99-40T09:00:00-03:00'};expect(commandSchema.safeParse({type:'create_appointment',appointment:a}).success).toBe(false);});
});
