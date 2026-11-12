import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { WorkspaceProvider } from '@/components/workspace-provider';
import './globals.css';
const manrope=localFont({src:'../../public/fonts/Manrope.ttf',variable:'--font-manrope',display:'swap',weight:'200 800'});
export const metadata: Metadata={title:{default:'BOX Experience — Oficina Digital | Portfólio',template:'%s | BOX Experience'},description:'Projeto conceitual independente: site automotivo, landing page, gestão da oficina e central de conteúdo. Demonstração com dados fictícios.',robots:{index:false,follow:false},icons:{icon:'/icon.svg'},openGraph:{title:'BOX Experience — Oficina Digital Integrada',description:'Um projeto de portfólio. Presença digital, atendimento e operação em uma experiência conectada.',locale:'pt_BR',type:'website'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR" className={manrope.variable}><body><WorkspaceProvider>{children}</WorkspaceProvider></body></html>}
