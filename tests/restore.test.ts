import {describe,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {fixtureDatabase,asUser,workspaceId} from './helpers/database';
import {sid} from '@/lib/seed';
import type {Workspace} from '@/lib/model';
describe('recuperação do banco local de teste',()=>{
 it('restaura snapshot independente com registros, vínculos, funções e RLS',async()=>{const source=await fixtureDatabase();let restored:PGlite|undefined;try{const snapshot=await source.dumpDataDir('gzip');expect(snapshot.size).toBeGreaterThan(1000);restored=new PGlite({loadDataDir:snapshot});await asUser(restored,'owner');const result=await restored.query<{state:Workspace}>('SELECT public.box_read_workspace($1) state',[workspaceId]);expect(result.rows[0].state.orders).toHaveLength(8);expect(result.rows[0].state.quotes).toHaveLength(6);await asUser(restored,'customer');const own=await restored.query<{state:Workspace}>('SELECT public.box_read_workspace($1) state',[workspaceId]);expect(own.rows[0].state.customers.map(x=>x.id)).toEqual([sid(3)]);expect(own.rows[0].state.payments).toEqual([]);await expect(restored.query('DELETE FROM public.box_audit')).rejects.toMatchObject({code:'42501'});}finally{await source.close();await restored?.close();}},60000);
});
