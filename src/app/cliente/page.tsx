import { ClientPortal } from '@/components/portal';
import { protectPage } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export const metadata={title:'Portal demonstrativo do cliente',robots:{index:false,follow:false}};
export default async function Page(){await protectPage();return <ClientPortal/>}
