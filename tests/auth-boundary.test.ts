import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {jsonBody,requireOrigin,config,errorResult,HttpError} from '@/lib/server/auth';
import {rateLimit} from '@/lib/server/rate-limit';
import {commandSchema} from '@/lib/validation';
import {createSeed} from '@/lib/seed';
const request=(body:string,headers:Record<string,string>={})=>new Request('https://box.example.com/api/workspace',{method:'POST',body,headers});
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();});
describe('limites de corpo sem confiar no content-length',()=>{
 it('decodifica JSON UTF-8 inclusive caracteres portugueses',async()=>{expect(await jsonBody(request('{"ação":"avaliação fictícia"}'))).toEqual({ação:'avaliação fictícia'});});
 it('rejeita JSON inválido e vazio',async()=>{await expect(jsonBody(request('{'))).rejects.toMatchObject({status:400});await expect(jsonBody(new Request('https://box.example.com'))).rejects.toMatchObject({status:400});});
 it('rejeita content-length acima do limite',async()=>{await expect(jsonBody(request('{}',{'content-length':'40001'}))).rejects.toMatchObject({status:413});});
 it('rejeita corpo grande mesmo sem content-length',async()=>{await expect(jsonBody(request(JSON.stringify({text:'x'.repeat(40000)})))).rejects.toMatchObject({status:413});});
 it('lê UTF-8 dividido entre blocos',async()=>{const data=new TextEncoder().encode('{"texto":"ç"}');const pos=data.indexOf(195)+1;const stream=new ReadableStream({start(c){c.enqueue(data.slice(0,pos));c.enqueue(data.slice(pos));c.close();}});const req=new Request('https://box.example.com',{method:'POST',body:stream,duplex:'half'} as RequestInit);expect(await jsonBody(req)).toEqual({texto:'ç'});});
});
describe('configuração e origem falham fechadas',()=>{
 beforeEach(()=>{vi.stubEnv('APP_MODE','connected');vi.stubEnv('NEXT_PUBLIC_APP_MODE','connected');vi.stubEnv('SUPABASE_URL','https://dedicated.example.supabase.co');vi.stubEnv('SUPABASE_PUBLISHABLE_KEY','fictional-test-only');vi.stubEnv('BOX_WORKSPACE_ID','d0000000-0000-4000-8000-000000000200');vi.stubEnv('APP_ORIGIN','https://box.example.com');});
 it('aceita apenas a origem e o tipo JSON configurados',()=>{expect(()=>requireOrigin(request('{}',{origin:'https://box.example.com','content-type':'application/json; charset=utf-8'}))).not.toThrow();});
 it('bloqueia origem ausente, diferente e sufixo enganoso',()=>{for(const origin of ['', 'https://other.example.com','https://box.example.com.attacker.invalid'])expect(()=>requireOrigin(request('{}',{origin,'content-type':'application/json'}))).toThrow(/Origem/);});
 it('bloqueia mime enganoso',()=>{expect(()=>requireOrigin(request('{}',{origin:'https://box.example.com','content-type':'application/json-evil'}))).toThrow(/Formato/);});
 it('bloqueia modos divergentes e credencial ausente',()=>{vi.stubEnv('NEXT_PUBLIC_APP_MODE','portfolio');expect(()=>config()).toThrow(/modos/);vi.stubEnv('NEXT_PUBLIC_APP_MODE','connected');vi.stubEnv('SUPABASE_URL','');expect(()=>config()).toThrow(/configurado/);});
 it('exige HTTPS em produção e desativa API no portfólio',()=>{vi.stubEnv('NODE_ENV','production');vi.stubEnv('APP_ORIGIN','http://box.example.com');expect(()=>config()).toThrow(/HTTPS/);vi.stubEnv('APP_MODE','portfolio');expect(()=>config()).toThrow(/desativada/);});
 it('erro inesperado não devolve segredos internos',()=>{expect(errorResult(new Error('not-a-real-token-value'))).toEqual({error:'Não foi possível concluir a operação. Tente novamente.',code:'SERVER_ERROR',status:500});expect(errorResult(new HttpError('Conflito fictício',409))).toMatchObject({status:409,error:'Conflito fictício'});});
});
describe('proteção suplementar e variantes',()=>{
 it('limita por chave durante janela e libera depois',()=>{let now=1000;vi.spyOn(Date,'now').mockImplementation(()=>now);rateLimit('unit-fiction-only',2,100);rateLimit('unit-fiction-only',2,100);expect(()=>rateLimit('unit-fiction-only',2,100)).toThrow(/Muitas/);now=1101;expect(()=>rateLimit('unit-fiction-only',2,100)).not.toThrow();});
 it('contrato aceita variante conhecida e bloqueia destino desconhecido, tipo errado e excesso',()=>{const post=createSeed().posts[0];expect(commandSchema.safeParse({type:'save_post',post:{...post,variants:{facebook:'Texto fictício da rede.'}}}).success).toBe(true);for(const variants of [{tiktok:'Fictício'}, {instagram:1}, {youtube:'x'.repeat(2201)}])expect(commandSchema.safeParse({type:'save_post',post:{...post,variants}}).success).toBe(false);});
});
