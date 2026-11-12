-- Executar SOMENTE por administrador, em projeto Supabase DEDICADO.
-- Não é migração automática. Requer usuário já criado individualmente no Auth.
-- Uso: psql -X -v ON_ERROR_STOP=1 -v admin_user_id=UUID_REAL_DO_AUTH \
--      -v admin_name='Administrador' -f supabase/provisionar-admin.sql
-- Credenciais em PGSERVICE/PGPASSFILE, não na linha de comando ou no chat.
\if :{?admin_user_id}
\else
  \echo 'Informe admin_user_id de um usuário existente no Auth, por canal seguro.'
  \quit 3
\endif
\if :{?admin_name}
\else
  \echo 'Informe admin_name. Não use conta coletiva.'
  \quit 3
\endif
BEGIN;
INSERT INTO public.box_workspaces(name,settings)
VALUES('Box — homologação de portfólio',jsonb_build_object(
 'heroTitle','Precisão em cada detalhe. Confiança em cada etapa.',
 'heroSubtitle','Um conceito de experiência automotiva que conecta cuidado, transparência e tecnologia — da primeira conversa à entrega do veículo.',
 'brandName','Box Serviços Automotivos','location','Apucarana, Paraná'))
RETURNING id AS box_workspace_id \gset
INSERT INTO public.box_members(workspace_id,user_id,display_name,role)
VALUES(:'box_workspace_id'::uuid,:'admin_user_id'::uuid,:'admin_name','owner');
COMMIT;
\echo 'Workspace dedicado criado. Configure BOX_WORKSPACE_ID somente no servidor:' :box_workspace_id
-- Não cria usuários, envia convites, desliga MFA ou modifica outros workspaces.
