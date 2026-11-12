'use client';
import { Children, cloneElement, isValidElement, useEffect, useId, useRef, type ReactNode, type FormEvent } from 'react';
import { X, ArrowUpRight, Check, ChevronDown, Search, CircleHelp } from 'lucide-react';
import Link from 'next/link';
import { STATUS, type OrderStatus } from '@/lib/model';
export function Brand({ light = false, compact = false }: { light?: boolean; compact?: boolean }) { return <Link href="/" className={`brand ${light ? 'brand-light' : ''}`} aria-label="Box Experience — início"><img src="/assets/box-marca.webp" width="44" height="44" alt="Emblema conceitual Box"/><span className="brand-word">BOX{!compact && <small>SERVIÇOS AUTOMOTIVOS</small>}</span></Link>; }
export function Modal({ title, subtitle, children, onClose, wide = false }: { title: string; subtitle?: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
 const ref = useRef<HTMLDialogElement>(null);
 useEffect(() => { const d = ref.current; const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null; d?.showModal(); const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { d?.close(); document.body.style.overflow = old; requestAnimationFrame(()=>{if(previousFocus?.isConnected&&!document.querySelector('dialog[open]'))previousFocus.focus();}); }; }, []);
 return <dialog className={`modal ${wide ? 'modal-wide' : ''}`} ref={ref} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) onClose(); }} aria-labelledby="modal-title"><div className="modal-inner"><header><div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Fechar janela"><X size={20}/></button></header>{children}</div></dialog>;
}
export function Field({ label, children, hint, className = '' }: { label: string; children: ReactNode; hint?: string; className?: string }) {
 const uid=useId();const inputId=`field-${uid}`;const hintId=`hint-${uid}`;
 const controls=Children.map(children,child=>isValidElement<{id?:string;'aria-describedby'?:string}>(child)?cloneElement(child,{id:inputId,...(hint?{'aria-describedby':[child.props['aria-describedby'],hintId].filter(Boolean).join(' ')}:{})}):child);
 return <div className={`field ${className}`}><label htmlFor={inputId}>{label}</label>{controls}{hint&&<small id={hintId}>{hint}</small>}</div>;
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) { return <div className="empty-state"><div className="empty-icon"><Search size={25}/></div><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>; }
export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`badge badge-${tone}`}><i/>{children}</span>; }
export function OrderBadge({ status }: { status: OrderStatus }) { return <Badge tone={STATUS[status]?.tone}>{STATUS[status]?.label || status}</Badge>; }
export function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) { return <div className="page-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>; }
export function DemoNotice({ small = false }: { small?: boolean }) { return <div className={`demo-notice ${small ? 'small' : ''}`}><span className="demo-dot"/><strong>Ambiente de portfólio</strong><span>{small ? 'Dados fictícios' : 'Dados fictícios. Nenhum atendimento, pagamento ou publicação é real.'}</span></div>; }
export function HelpTip({ children }: { children: ReactNode }) { return <div className="help-tip"><CircleHelp size={17}/><span>{children}</span></div>; }
export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) { return <button className="btn btn-gold" type="submit" disabled={busy}>{busy ? <><span className="spinner"/> Salvando…</> : children}</button>; }
export function Form({ onSubmit, children, className = '' }: { onSubmit: (data: FormData, event: FormEvent<HTMLFormElement>) => void; children: ReactNode; className?: string }) { return <form className={className} onSubmit={e => { e.preventDefault(); onSubmit(new FormData(e.currentTarget), e); }}>{children}</form>; }
export function Chevron() { return <ChevronDown size={16}/>; }
export function ArrowLink({ href, children }: { href: string; children: ReactNode }) { return <Link className="arrow-link" href={href}>{children}<ArrowUpRight size={17}/></Link>; }
export function SuccessMark() { return <span className="success-mark"><Check size={20}/></span>; }
