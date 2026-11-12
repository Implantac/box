import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { createSeed,sid } from '@/lib/seed';
import type { Role } from '@/lib/model';
export const workspaceId=sid(200);
export const users:Record<Role,string>={owner:sid(201),reception:sid(202),technician:sid(203),finance:sid(204),marketing:sid(205),customer:sid(206)};
export async function fixtureDatabase(){const db=new PGlite();await db.exec(`CREATE ROLE anon NOLOGIN;CREATE ROLE authenticated NOLOGIN;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$SELECT COALESCE(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;GRANT USAGE ON SCHEMA auth TO anon,authenticated;GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO anon,authenticated;`);
 for(const migration of ['202611120001_box_core.sql','202611120002_validation_and_public_content.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+migration,import.meta.url),'utf8'));
 const seed=createSeed();
 await db.query('INSERT INTO public.box_workspaces(id,name,settings) VALUES($1,$2,$3::jsonb)',[workspaceId,'Oficina fictícia de teste',JSON.stringify(seed.settings)]);
 for(const [role,userId]of Object.entries(users)){await db.query('INSERT INTO auth.users(id) VALUES($1)',[userId]);if(role!=='customer')await db.query('INSERT INTO public.box_members(workspace_id,user_id,display_name,role) VALUES($1,$2,$3,$4)',[workspaceId,userId,role==='technician'?'Lucas • demo':role==='owner'?'Admin • teste':role==='reception'?'Recepção • teste':role+' • teste',role]);}
 for(const [i,name]of ['Marina • demo','Rafael • demo'].entries()){await db.query('INSERT INTO auth.users(id) VALUES($1)',[sid(210+i)]);await db.query("INSERT INTO public.box_members(workspace_id,user_id,display_name,role) VALUES($1,$2,$3,'technician')",[workspaceId,sid(210+i),name]);}
 const insert=async(kind:string,d:object&{id:string},parent:string|null=null,customer:string|null=null,assignee:string|null=null)=>db.query('INSERT INTO public.box_records(workspace_id,id,kind,parent_id,customer_id,assignee,document) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)',[workspaceId,d.id,kind,parent,customer,assignee,JSON.stringify(d)]);
 for(const c of seed.customers)await insert('customer',c);
 for(const v of seed.vehicles)await insert('vehicle',v,null,v.customerId);
 for(const o of seed.orders)await insert('order',o,o.vehicleId,o.customerId,o.technician);
 for(const q of seed.quotes)await insert('quote',q,q.orderId,seed.orders.find(o=>o.id===q.orderId)!.customerId);
 for(const a of seed.appointments)await insert('appointment',a,null,a.customerId,a.technician);
 for(const p of seed.payments)await insert('payment',p,p.orderId,seed.orders.find(o=>o.id===p.orderId)!.customerId);
 for(const c of seed.costs)await insert('cost',c,c.orderId,seed.orders.find(o=>o.id===c.orderId)!.customerId);
 for(const l of seed.leads)await insert('lead',l);
 for(const p of seed.posts.filter(p=>p.status!=='agendado_demo'))await insert('post',p);
 await db.query("INSERT INTO public.box_members(workspace_id,user_id,display_name,role,customer_id) VALUES($1,$2,'Cliente • teste','customer',$3)",[workspaceId,users.customer,sid(3)]);
 await db.query('INSERT INTO auth.users(id) VALUES($1)',[sid(230)]);
 await db.query('INSERT INTO public.box_workspaces(id,name,settings) VALUES($1,$2,$3::jsonb)',[sid(300),'Outro workspace fictício',JSON.stringify(seed.settings)]);
 return db;
}
export async function asUser(db:PGlite,role:Role|'anonymous'|'outsider'='owner',aal='aal2'){await db.exec('RESET ROLE;');const sub=role==='outsider'?sid(230):role==='anonymous'?undefined:users[role];await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub,aal,role:role==='anonymous'?'anon':'authenticated'})]);await db.exec('SET ROLE '+(role==='anonymous'?'anon':'authenticated'));}
