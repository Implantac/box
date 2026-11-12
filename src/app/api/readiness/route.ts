import { NextResponse } from 'next/server';
import { authContext, errorResult, HttpError, isConnected } from '@/lib/server/auth';
import { inspectRuntimeConfiguration } from '@/lib/runtime-config';
import { readinessChecklist } from '@/lib/readiness';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex'};
export async function GET(){try{
 let databaseVerified=false;
 if(isConnected()){
  const {client,session}=await authContext();if(session.role!=='owner')throw new HttpError('Somente o proprietário pode consultar a preparação operacional.',403,'FORBIDDEN');
  const {data,error}=await client.rpc('box_read_workspace',{p_workspace:session.workspaceId});databaseVerified=!error&&data?.schemaVersion===4&&Array.isArray(data.fiscalDocuments)&&Array.isArray(data.fiscalRecipients);
 }
 const configuration=inspectRuntimeConfiguration({...process.env,NEXT_PUBLIC_APP_MODE:process.env.NEXT_PUBLIC_APP_MODE});
 return NextResponse.json({mode:configuration.mode,configurationValid:configuration.configured,configurationIssues:configuration.issues,databaseVerified,productionApproved:false,fiscalIssuance:'disabled',provider:'not-implemented',checks:readinessChecklist(configuration.mode,configuration.configured,databaseVerified)},{headers});
}catch(e){const r=errorResult(e);return NextResponse.json({error:r.error,code:r.code},{status:r.status,headers});}}
