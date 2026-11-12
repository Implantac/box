import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { HttpError } from './auth';
// Proteção suplementar por instância. Não substitui limites do Auth e do proxy.
// Apenas hashes efêmeros; não registra IP, e-mail, senha ou token.
const salt=randomBytes(32);const entries=new Map<string,{count:number;expires:number}>();
export function rateLimit(key:string,max:number,windowMs=60000){const now=Date.now();if(entries.size>5000){for(const [k,v]of entries)if(v.expires<now)entries.delete(k);if(entries.size>10000)throw new HttpError('Muitas tentativas. Aguarde um minuto e tente novamente.',429,'RATE_LIMIT');}const hash=createHash('sha256').update(salt).update(key).digest('hex');let e=entries.get(hash);if(!e||e.expires<now){e={count:0,expires:now+windowMs};entries.set(hash,e);}e.count++;if(e.count>max)throw new HttpError('Muitas tentativas. Aguarde um minuto e tente novamente.',429,'RATE_LIMIT');}
export function requestIp(request:Request){return (request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown').slice(0,100);}
