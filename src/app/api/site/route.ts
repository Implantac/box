import { NextResponse } from 'next/server';
import { config, isConnected } from '@/lib/server/auth';
import { createClient } from '@supabase/supabase-js';
import { createSeed } from '@/lib/seed';
import { settingsSchema } from '@/lib/validation';
export const dynamic='force-dynamic';
export async function GET(){const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};if(!isConnected())return NextResponse.json({settings:createSeed().settings},{headers});try{const c=config();const client=createClient(c.url,c.key,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.rpc('box_public_settings',{p_workspace:c.workspace});const parsed=settingsSchema.safeParse(data);if(error||!parsed.success)return NextResponse.json({error:'Conteúdo público temporariamente indisponível.'},{status:503,headers});return NextResponse.json({settings:parsed.data},{headers});}catch{return NextResponse.json({error:'Conteúdo público não configurado.'},{status:503,headers});}}
