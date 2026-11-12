'use client';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { applyCommand } from '@/lib/domain';
import { createSeed, sid } from '@/lib/seed';
import { type Command, type Role, type Session, type Workspace, ROLE_LABELS } from '@/lib/model';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
const KEY='box-portfolio-v1-session';
const PORTFOLIO=process.env.NEXT_PUBLIC_APP_MODE!=='connected';
const emptyWorkspace=():Workspace=>({...createSeed(),customers:[],vehicles:[],orders:[],quotes:[],appointments:[],payments:[],costs:[],leads:[],posts:[],audit:[]});
type Toast={id:number;message:string;error:boolean};
type MutationOptions={customerId?:string;publicLead?:boolean};
interface Store{state:Workspace;ready:boolean;portfolio:boolean;role:Role;session:Session|null;error:string;setRole:(r:Role)=>void;mutate:(c:Command,options?:MutationOptions)=>Promise<void>;notify:(m:string,error?:boolean)=>void;reset:()=>void;reload:()=>Promise<void>}
const Context=createContext<Store|null>(null);
export function WorkspaceProvider({children}:{children:ReactNode}){
 const [state,setState]=useState<Workspace>(()=>PORTFOLIO?createSeed():emptyWorkspace());const stateRef=useRef(state);const path=usePathname();
 const [role,changeRole]=useState<Role>('owner');const [ready,setReady]=useState(false);const [session,setSession]=useState<Session|null>(null);const [error,setError]=useState('');const [toasts,setToasts]=useState<Toast[]>([]);const toastRef=useRef<HTMLDivElement>(null);
 const notify=useCallback((message:string,error=false)=>{const item={id:Date.now()+Math.random(),message,error};setToasts(t=>[...t.slice(-2),item]);setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==item.id)),6500);},[]);
 useEffect(()=>{const el=toastRef.current;if(!el?.showPopover)return;try{if(toasts.length)el.showPopover();else el.hidePopover();}catch{/* fallback visual sem Popover API */}},[toasts.length]);
 const persist=useCallback((s:Workspace)=>{stateRef.current=s;setState(s);if(PORTFOLIO){try{sessionStorage.setItem(KEY,JSON.stringify({version:1,state:s}));}catch{/* modo privado: continua na memória */}}},[]);
 const reload=useCallback(async()=>{if(PORTFOLIO)return;const response=await fetch('/api/workspace',{cache:'no-store'});if(response.status===401){window.location.assign('/entrar');return;}const result=await response.json();if(!response.ok){if(result.code==='MFA_REQUIRED'){window.location.assign('/entrar/seguranca');return;}throw new Error(result.error||'Não foi possível carregar os dados.');}persist(result.state);setSession(result.session);changeRole(result.session.role);setError('');},[persist]);
 useEffect(()=>{if(PORTFOLIO){try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'null');if(saved?.version===1&&['customers','vehicles','orders','quotes','appointments','payments','costs','leads','posts','audit'].every(k=>Array.isArray(saved.state?.[k]))&&Number.isInteger(saved.state?.revision)&&typeof saved.state?.settings?.heroTitle==='string')persist(saved.state);else persist(createSeed());}catch{persist(createSeed());}setReady(true);}},[persist]);
 useEffect(()=>{if(PORTFOLIO)return;let active=true;setError('');if(path.startsWith('/painel')||path==='/cliente'){setReady(false);reload().catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setReady(true);});}else{setReady(true);fetch('/api/site',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(active&&data?.settings)persist({...stateRef.current,settings:data.settings});}).catch(()=>{/* site conceitual continua sem dados privados */});}return()=>{active=false;};},[path,persist,reload]);
 const mutate=useCallback(async(command:Command,options?:MutationOptions)=>{try{if(PORTFOLIO){if(options?.publicLead&&command.type!=='create_lead')throw new Error('A simulação pública só cria solicitações fictícias.');const actingRole=options?.publicLead?'reception':options?.customerId?'customer':role;persist(applyCommand(stateRef.current,command,actingRole,{portfolio:true,expectedRevision:stateRef.current.revision,customerId:options?.customerId,actorName:actingRole==='technician'?'Lucas • demo':ROLE_LABELS[actingRole]}));}else{const res=await fetch('/api/workspace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({command,revision:stateRef.current.revision})});const result=await res.json();if(!res.ok){if(res.status===401){window.location.assign('/entrar');return;}if(result.code==='MFA_REQUIRED'){window.location.assign('/entrar/seguranca');return;}if(res.status===409)await reload();throw new Error(result.error||'Não foi possível salvar.');}await reload();}}catch(e){const message=e instanceof Error?e.message:'Não foi possível concluir.';notify(message,true);throw e;}},[role,persist,reload,notify]);
 const setRole=(r:Role)=>{if(PORTFOLIO&&Object.hasOwn(ROLE_LABELS,r)){changeRole(r);notify(`Perfil demonstrativo: ${ROLE_LABELS[r]}. Não é uma sessão autenticada.`);}};
 const reset=()=>{if(PORTFOLIO){persist(createSeed());changeRole('owner');notify('Sua demonstração foi reiniciada. Nenhum dado externo foi alterado.');}};
 return <Context.Provider value={{state,ready,portfolio:PORTFOLIO,role,session,error,setRole,mutate,notify,reset,reload}}>{children}<div ref={toastRef} popover="manual" className="toasts" aria-live="polite">{toasts.map(t=><div key={t.id} className={`toast ${t.error?'toast-error':''}`}>{t.error?<AlertCircle size={19}/>:<CheckCircle2 size={19}/>}<span>{t.message}</span><button aria-label="Fechar aviso" onClick={()=>setToasts(all=>all.filter(x=>x.id!==t.id))}><X size={16}/></button></div>)}</div></Context.Provider>;
}
export function useWorkspace(){const c=useContext(Context);if(!c)throw new Error('WorkspaceProvider ausente.');return c;}
export const defaultCustomerId=sid(3);
