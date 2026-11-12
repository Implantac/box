'use client';
import Link from 'next/link';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';
import { DashboardShell } from './dashboard-shell';
import { useWorkspace } from './workspace-provider';
import { canSee } from '@/lib/domain';
import { Empty } from './ui';
import { Overview } from './overview';
import { OrdersPage, OrderDetail } from './orders';
import { CustomersPage, AgendaPage, LeadsPage } from './operations';
import { QuotesPage, FinancePage } from './commercial';
import { SocialPage } from './social';
import { ReportsPage, SettingsPage } from './settings-reports';
export function Dashboard({ path = [] }: { path?: string[] }) {
 const {role,ready,portfolio,setRole}=useWorkspace();const section=path[0]||'inicio';
 const components:Record<string,React.ReactNode>={inicio:<Overview/>,ordens:path[1]?<OrderDetail orderId={path[1]}/>:<OrdersPage/>,clientes:<CustomersPage/>,agenda:<AgendaPage/>,atendimentos:<LeadsPage/>,orcamentos:<QuotesPage/>,financeiro:<FinancePage/>,conteudo:<SocialPage/>,relatorios:<ReportsPage/>,configuracoes:<SettingsPage/>};
 return <DashboardShell section={section}>{!ready?<div className="loading-shell"><span className="spinner"/>Preparando sua experiência…</div>:!canSee(role,section)?<section className="panel access-denied"><Empty title="Este perfil tem outro foco." action={portfolio?<button className="btn btn-gold" onClick={()=>setRole('owner')}><ShieldCheck size={16}/>Explorar como proprietário</button>:<Link className="btn btn-gold" href={role==='customer'?'/cliente':'/painel'}>Ir para minha área <ArrowUpRight size={16}/></Link>}>O acesso a este módulo não está disponível para a função selecionada. No modo conectado, essa restrição também é aplicada pelo servidor.</Empty></section>:components[section]||<Empty title="Módulo não encontrado" action={<Link className="btn btn-gold" href="/painel">Voltar ao início</Link>}/>}</DashboardShell>;
}
