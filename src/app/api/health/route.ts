import { NextResponse } from 'next/server';
import {version} from '../../../../package.json';
import {inspectRuntimeConfiguration} from '@/lib/runtime-config';
export const dynamic='force-dynamic';
export async function GET(){const report=inspectRuntimeConfiguration({...process.env,NEXT_PUBLIC_APP_MODE:process.env.NEXT_PUBLIC_APP_MODE});return NextResponse.json({application:'box-oficina-portfolio',version,mode:report.mode,applicationReady:report.configured,databaseConnection:report.mode==='portfolio'?'not-used':'not-checked',socialPublishing:'disabled',fiscalIssuance:'disabled',productionApproved:false},{status:report.configured?200:503,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});}
