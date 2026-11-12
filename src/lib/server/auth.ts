import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Role, Session } from '../model';
import { inspectRuntimeConfiguration } from '../runtime-config';
export class HttpError extends Error { constructor(message:string,public status=400,public code='REQUEST_ERROR'){super(message);} }
export const isConnected=()=>process.env.APP_MODE==='connected';
export function config(){
 if(!isConnected())throw new HttpError('API conectada desativada no portfólio. A demonstração usa somente dados fictícios locais.',403,'PORTFOLIO_ONLY');
 const report=inspectRuntimeConfiguration({...process.env,NEXT_PUBLIC_APP_MODE:process.env.NEXT_PUBLIC_APP_MODE});
 if(!report.configured){const issue=report.issues[0];throw new HttpError(issue.message,503,issue.code);}
 const url=process.env.SUPABASE_URL!;const key=process.env.SUPABASE_PUBLISHABLE_KEY!;const workspace=process.env.BOX_WORKSPACE_ID!;const origin=process.env.APP_ORIGIN!;
 return{url,key,workspace,origin:new URL(origin).origin};
}
export async function serverClient(){
 const c=config();const jar=await cookies();
 return createServerClient(c.url,c.key,{
  cookieOptions:{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'},
  cookies:{
   getAll(){return jar.getAll();},
   setAll(items){try{items.forEach(({name,value,options})=>jar.set(name,value,{...options,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'}));}catch{/* Server Components não escrevem cookies; o proxy faz a renovação. */}}
  }
 });
}
export async function authContext(requireMfa=true){
 const c=config();const client=await serverClient();const {data,error}=await client.auth.getUser();
 if(error||!data.user)throw new HttpError('Entre com sua conta para continuar.',401,'UNAUTHENTICATED');
 const {data:member,error:memberError}=await client.from('box_members').select('user_id,workspace_id,role,display_name,customer_id').eq('workspace_id',c.workspace).eq('user_id',data.user.id).maybeSingle();
 if(memberError||!member)throw new HttpError('Sua conta não está vinculada a este workspace. Solicite acesso ao responsável.',403,'NO_MEMBERSHIP');
 const {data:assurance,error:assuranceError}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 const needsMfa=Boolean(assuranceError||assurance?.currentLevel!=='aal2');
 if(requireMfa&&needsMfa)throw new HttpError('Conclua a verificação de segurança para acessar o workspace.',403,'MFA_REQUIRED');
 const session:Session={role:member.role as Role,name:member.display_name,userId:data.user.id,workspaceId:member.workspace_id,needsMfa:Boolean(needsMfa)};
 return{client,user:data.user,member,session};
}
export async function protectPage(){if(!isConnected())return;try{await authContext();}catch(e){if(e instanceof HttpError){if(e.code==='MFA_REQUIRED')redirect('/entrar/seguranca');redirect('/entrar');}throw e;}}
export function requireOrigin(request:Request){const c=config();const origin=request.headers.get('origin');let parsed='';try{parsed=origin?new URL(origin).origin:'';}catch{}if(!origin||parsed!==c.origin||origin!==c.origin)throw new HttpError('Origem da requisição não permitida.',403,'INVALID_ORIGIN');if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')||''))throw new HttpError('Formato da requisição inválido.',415,'INVALID_CONTENT_TYPE');}
export async function jsonBody(request:Request){
 const limit=40000;const length=Number(request.headers.get('content-length')||0);if(length>limit)throw new HttpError('Requisição muito grande.',413);
 const reader=request.body?.getReader();const decoder=new TextDecoder();let size=0;let text='';
 if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new HttpError('Requisição muito grande.',413);}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}finally{reader.releaseLock();}}
 try{return JSON.parse(text);}catch{throw new HttpError('JSON inválido.',400);}
}
export function errorResult(e:unknown){if(e instanceof HttpError)return{error:e.message,code:e.code,status:e.status};return{error:'Não foi possível concluir a operação. Tente novamente.',code:'SERVER_ERROR',status:500};}
