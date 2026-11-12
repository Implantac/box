import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
export default function NotFound(){return <main className="not-found-page"><span className="eyebrow">BOX EXPERIENCE</span><h1>404</h1><h2>Este caminho não está na jornada.</h2><p>A página pode ter mudado. Você pode voltar ao site ou explorar o sistema demonstrativo.</p><div className="button-row"><Link className="btn btn-gold" href="/">Voltar ao site <ArrowRight size={16}/></Link><Link className="btn btn-outline" href="/painel">Abrir o sistema</Link></div></main>}
