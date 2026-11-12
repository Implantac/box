import '../../workshop.css';
import '../../fiscal.css';
import { Dashboard } from '@/components/dashboard';
import { protectPage } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export const metadata={title:'Workspace de demonstração',robots:{index:false,follow:false}};
export default async function Page({params}:{params:Promise<{section?:string[]}>}){await protectPage();const p=await params;return <Dashboard path={p.section}/>}
