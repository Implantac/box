-- BOX Experience v1.0 — projeto dedicado, homologação antes do uso real.
-- Não contém dados pessoais nem cria usuários administradores automaticamente.
-- Documentos tipados por entidade, com vínculos relacionais, RLS e escrita por RPC.
BEGIN;
CREATE TABLE public.box_workspaces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK (length(name) BETWEEN 3 AND 100),
 revision integer NOT NULL DEFAULT 1 CHECK (revision > 0), settings jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.box_members (
 workspace_id uuid NOT NULL REFERENCES public.box_workspaces(id), user_id uuid NOT NULL REFERENCES auth.users(id),
 display_name text NOT NULL CHECK (length(display_name) BETWEEN 2 AND 120),
 role text NOT NULL CHECK (role IN ('owner','reception','technician','finance','marketing','customer')),
 customer_id uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE public.box_records (
 workspace_id uuid NOT NULL REFERENCES public.box_workspaces(id), id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('customer','vehicle','order','quote','appointment','payment','cost','lead','post')),
 parent_id uuid, customer_id uuid, assignee text,
 document jsonb NOT NULL CHECK (jsonb_typeof(document)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id), CHECK (COALESCE(document->>'id'=id::text,false)),
 FOREIGN KEY(workspace_id,parent_id) REFERENCES public.box_records(workspace_id,id),
 FOREIGN KEY(workspace_id,customer_id) REFERENCES public.box_records(workspace_id,id)
);
ALTER TABLE public.box_members ADD CONSTRAINT box_member_customer_fk FOREIGN KEY(workspace_id,customer_id) REFERENCES public.box_records(workspace_id,id);
CREATE INDEX box_records_kind_idx ON public.box_records(workspace_id,kind,created_at DESC);
CREATE INDEX box_records_customer_idx ON public.box_records(workspace_id,customer_id);
CREATE INDEX box_records_parent_idx ON public.box_records(workspace_id,parent_id);
CREATE UNIQUE INDEX box_quote_version_unique ON public.box_records(workspace_id,parent_id,((document->>'version')::integer)) WHERE kind='quote';
CREATE UNIQUE INDEX box_order_number_unique ON public.box_records(workspace_id,(document->>'number')) WHERE kind='order';
CREATE TABLE public.box_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.box_workspaces(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id), actor_name text NOT NULL, action text NOT NULL,
 entity_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX box_audit_recent_idx ON public.box_audit(workspace_id,created_at DESC);
ALTER TABLE public.box_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.box_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.box_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.box_audit ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.box_role(w uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT role FROM public.box_members WHERE workspace_id=w AND user_id=(SELECT auth.uid()) AND (SELECT auth.jwt()->>'aal')='aal2' LIMIT 1
$$;
CREATE FUNCTION public.box_name(w uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT display_name FROM public.box_members WHERE workspace_id=w AND user_id=(SELECT auth.uid()) AND (SELECT auth.jwt()->>'aal')='aal2' LIMIT 1
$$;
CREATE FUNCTION public.box_customer(w uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT customer_id FROM public.box_members WHERE workspace_id=w AND user_id=(SELECT auth.uid()) AND (SELECT auth.jwt()->>'aal')='aal2' AND role='customer' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.box_role(uuid),public.box_name(uuid),public.box_customer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.box_role(uuid),public.box_name(uuid),public.box_customer(uuid) TO authenticated;
CREATE POLICY box_workspace_read ON public.box_workspaces FOR SELECT TO authenticated USING(public.box_role(id) IS NOT NULL);
CREATE POLICY box_members_read ON public.box_members FOR SELECT TO authenticated USING(user_id=(SELECT auth.uid()) OR public.box_role(workspace_id)='owner');
CREATE POLICY box_records_read ON public.box_records FOR SELECT TO authenticated USING (
 CASE public.box_role(workspace_id)
 WHEN 'owner' THEN true
 WHEN 'reception' THEN kind IN ('customer','vehicle','order','quote','appointment','lead')
 WHEN 'technician' THEN kind IN ('order','appointment') AND assignee=public.box_name(workspace_id)
 WHEN 'finance' THEN kind IN ('order','quote','payment','cost')
 WHEN 'marketing' THEN kind='post'
 WHEN 'customer' THEN (kind='customer' AND id=public.box_customer(workspace_id)) OR (kind IN ('vehicle','order') AND customer_id=public.box_customer(workspace_id)) OR (kind='quote' AND customer_id=public.box_customer(workspace_id) AND document->>'status'<>'rascunho')
 ELSE false END
);
CREATE POLICY box_audit_read ON public.box_audit FOR SELECT TO authenticated USING(public.box_role(workspace_id)='owner');
REVOKE ALL ON public.box_workspaces,public.box_members,public.box_records,public.box_audit FROM anon,authenticated;
GRANT SELECT ON public.box_workspaces,public.box_members,public.box_records,public.box_audit TO authenticated;

CREATE FUNCTION public.box_quote_total(d jsonb) RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT COALESCE(sum((v->>'quantity')::bigint*(v->>'unitCents')::bigint),0)-COALESCE((d->>'discountCents')::bigint,0) FROM jsonb_array_elements(d->'items') v
$$;
REVOKE ALL ON FUNCTION public.box_quote_total(jsonb) FROM PUBLIC;
-- SECURITY INVOKER: cada SELECT continua sujeito a RLS.
CREATE FUNCTION public.box_read_workspace(p_workspace uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; key text; category text;
BEGIN
 IF public.box_role(p_workspace) IS NULL THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('revision',revision,'settings',settings) INTO result FROM public.box_workspaces WHERE id=p_workspace;
 FOR key,category IN SELECT * FROM (VALUES ('customers','customer'),('vehicles','vehicle'),('orders','order'),('quotes','quote'),('appointments','appointment'),('payments','payment'),('costs','cost'),('leads','lead'),('posts','post')) v(a,b) LOOP
  result:=result || jsonb_build_object(key,COALESCE((SELECT jsonb_agg(document ORDER BY created_at DESC,id) FROM public.box_records WHERE workspace_id=p_workspace AND kind=category),'[]'::jsonb));
 END LOOP;
 result:=result || jsonb_build_object('audit',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'actor',a.actor_name,'entityId',a.entity_id,'at',a.created_at)) FROM (SELECT * FROM public.box_audit WHERE workspace_id=p_workspace ORDER BY created_at DESC LIMIT 250) a),'[]'::jsonb));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.box_read_workspace(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.box_read_workspace(uuid) TO authenticated;

-- A escrita é deliberadamente restrita a esta função. O bloqueio da linha do
-- workspace serializa comandos de uma oficina e evita corrida de versões/agenda.
CREATE FUNCTION public.box_command(p_workspace uuid,p_expected_revision integer,p_command jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text; actor text; rev integer; op text; d jsonb; old jsonb; parent jsonb; customer jsonb; vehicle jsonb; item jsonb; rid uuid; pid uuid; cid uuid; kind_value text; assigned text; latest jsonb; n integer; paid bigint; total bigint; a bigint; start_time timestamptz; end_time timestamptz; is_customer boolean;
BEGIN
 SELECT role,display_name INTO r,actor FROM public.box_members WHERE workspace_id=p_workspace AND user_id=(SELECT auth.uid());
 IF r IS NULL OR (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501'; END IF;
 IF p_command IS NULL OR jsonb_typeof(p_command)<>'object' OR octet_length(p_command::text)>40000 THEN RAISE EXCEPTION 'Comando muito grande' USING ERRCODE='22023'; END IF;
 SELECT revision INTO rev FROM public.box_workspaces WHERE id=p_workspace FOR UPDATE;
 IF p_expected_revision IS DISTINCT FROM rev THEN RAISE EXCEPTION 'Os dados mudaram. Atualize e tente novamente.' USING ERRCODE='40001'; END IF;
 op:=p_command->>'type';
 IF op IS NULL OR (p_command?'id' AND jsonb_typeof(p_command->'id')<>'string') OR op NOT IN ('create_customer','create_order','transition_order','create_quote','set_quote_status','create_appointment','set_appointment_status','record_payment','record_cost','create_lead','set_lead_status','save_post','approve_post','update_settings') THEN RAISE EXCEPTION 'Operação indisponível neste ambiente' USING ERRCODE='22023'; END IF;
 IF NOT (r='owner' OR
 (r='reception' AND op IN ('create_customer','create_order','transition_order','create_quote','set_quote_status','create_appointment','set_appointment_status','create_lead','set_lead_status')) OR
 (r='technician' AND op='transition_order') OR
 (r='finance' AND op IN ('record_payment','record_cost')) OR
 (r='marketing' AND op='save_post') OR
 (r='customer' AND op='set_quote_status')) THEN RAISE EXCEPTION 'Este perfil não pode executar essa ação' USING ERRCODE='42501'; END IF;
 IF op='create_customer' THEN
  d:=p_command->'customer';rid:=(d->>'id')::uuid;kind_value:='customer';
  IF d->>'name' IS NULL OR length(trim(d->>'name')) NOT BETWEEN 3 AND 120 THEN RAISE EXCEPTION 'Nome inválido' USING ERRCODE='22023'; END IF;
  d:=d || jsonb_build_object('createdAt',now());
  INSERT INTO public.box_records(workspace_id,id,kind,document) VALUES(p_workspace,rid,kind_value,d);
  IF p_command->'vehicle' IS NOT NULL AND p_command->'vehicle'<>'null'::jsonb THEN
   vehicle:=p_command->'vehicle';
   IF vehicle->>'customerId' IS DISTINCT FROM rid::text OR length(COALESCE(vehicle->>'model',''))<2 OR (vehicle->>'year')::integer NOT BETWEEN 1900 AND 2100 OR (vehicle->>'km')::integer NOT BETWEEN 0 AND 3000000 THEN RAISE EXCEPTION 'Veículo inválido' USING ERRCODE='22023'; END IF;
   INSERT INTO public.box_records(workspace_id,id,kind,customer_id,document) VALUES(p_workspace,(vehicle->>'id')::uuid,'vehicle',rid,vehicle);
  END IF;
 ELSIF op='create_order' THEN
  d:=p_command->'order';rid:=(d->>'id')::uuid;cid:=(d->>'customerId')::uuid;pid:=(d->>'vehicleId')::uuid;
  SELECT document INTO customer FROM public.box_records WHERE workspace_id=p_workspace AND id=cid AND kind='customer';
  SELECT document INTO vehicle FROM public.box_records WHERE workspace_id=p_workspace AND id=pid AND kind='vehicle' AND customer_id=cid;
  IF customer IS NULL OR vehicle IS NULL OR length(COALESCE(d->>'complaint',''))<5 THEN RAISE EXCEPTION 'Cliente, veículo ou queixa inválidos' USING ERRCODE='22023'; END IF;
  IF d->>'returnOf' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND id=(d->>'returnOf')::uuid AND kind='order' AND customer_id=cid AND parent_id=pid AND document->>'status' IN ('entregue','cancelada')) THEN RAISE EXCEPTION 'Retorno inválido' USING ERRCODE='22023'; END IF;
  IF d->>'number' IS NULL OR d->>'dueDate' IS NULL OR (d->>'dueDate') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Número ou previsão inválidos' USING ERRCODE='22023'; END IF;
  assigned:=d->>'technician';
  IF NOT EXISTS(SELECT 1 FROM public.box_members WHERE workspace_id=p_workspace AND display_name=assigned AND role IN ('owner','technician','reception')) THEN RAISE EXCEPTION 'Responsável não cadastrado na equipe' USING ERRCODE='22023'; END IF;
  d:=(d-'currentQuoteId'-'currentQuoteVersion') || jsonb_build_object('status','recepcao','customerName',customer->>'name','vehicleLabel',(vehicle->>'model')||' '||(vehicle->>'year'),'createdAt',now(),'checklist','[]'::jsonb);
  INSERT INTO public.box_records(workspace_id,id,kind,parent_id,customer_id,assignee,document) VALUES(p_workspace,rid,'order',pid,cid,assigned,d);
 ELSIF op='transition_order' THEN
  rid:=(p_command->>'id')::uuid;SELECT document,customer_id,assignee INTO old,cid,assigned FROM public.box_records WHERE workspace_id=p_workspace AND id=rid AND kind='order';
  IF old IS NULL OR (r='technician' AND assigned<>actor) THEN RAISE EXCEPTION 'OS não disponível para este perfil' USING ERRCODE='42501'; END IF;
  IF p_command->>'status' IS DISTINCT FROM old->>'status' THEN
   IF NOT (CASE old->>'status'
    WHEN 'recepcao' THEN p_command->>'status' IN ('diagnostico','cancelada')
    WHEN 'diagnostico' THEN p_command->>'status' IN ('aguardando_aprovacao','cancelada')
    WHEN 'aguardando_aprovacao' THEN p_command->>'status' IN ('execucao','aguardando_pecas','diagnostico','cancelada')
    WHEN 'aguardando_pecas' THEN p_command->>'status' IN ('execucao','diagnostico','cancelada')
    WHEN 'execucao' THEN p_command->>'status' IN ('testes','aguardando_pecas','diagnostico','cancelada')
    WHEN 'testes' THEN p_command->>'status' IN ('pronto','execucao')
    WHEN 'pronto' THEN p_command->>'status' IN ('entregue','testes') ELSE false END) THEN RAISE EXCEPTION 'Mudança de etapa não permitida' USING ERRCODE='22023'; END IF;
   IF p_command->>'status' IN ('execucao','aguardando_pecas') THEN
    SELECT document INTO latest FROM public.box_records WHERE workspace_id=p_workspace AND parent_id=rid AND kind='quote' ORDER BY (document->>'version')::integer DESC LIMIT 1;
    IF latest IS NULL OR latest->>'status'<>'aprovado' THEN RAISE EXCEPTION 'Orçamento atual precisa estar aprovado' USING ERRCODE='22023'; END IF;
   END IF;
   IF p_command->>'status'='cancelada' AND length(COALESCE(p_command->>'note',''))<5 THEN RAISE EXCEPTION 'Informe motivo do cancelamento' USING ERRCODE='22023'; END IF;
   IF p_command->>'status'='pronto' AND NOT COALESCE(p_command->'checklist',old->'checklist') @> '["Teste final realizado"]'::jsonb THEN RAISE EXCEPTION 'Registre o teste final' USING ERRCODE='22023'; END IF;
  END IF;
  IF old->>'status' IN ('entregue','cancelada') THEN RAISE EXCEPTION 'OS encerrada é preservada. Abra um retorno.' USING ERRCODE='22023'; END IF;
  d:=old || jsonb_build_object('status',p_command->>'status','diagnosis',COALESCE(p_command->>'diagnosis',old->>'diagnosis'),'checklist',COALESCE(p_command->'checklist',old->'checklist'));
  IF p_command->>'status'='cancelada' THEN d:=d || jsonb_build_object('cancellationReason',p_command->>'note'); END IF;
  UPDATE public.box_records SET document=d,updated_at=now() WHERE workspace_id=p_workspace AND id=rid;
 ELSIF op='create_quote' THEN
  d:=p_command->'quote';rid:=(d->>'id')::uuid;pid:=(d->>'orderId')::uuid;
  SELECT document,customer_id INTO parent,cid FROM public.box_records WHERE workspace_id=p_workspace AND id=pid AND kind='order';
  IF parent IS NULL OR parent->>'status' IN ('entregue','cancelada') THEN RAISE EXCEPTION 'Ordem encerrada ou inexistente' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(max((document->>'version')::integer),0)+1 INTO n FROM public.box_records WHERE workspace_id=p_workspace AND parent_id=pid AND kind='quote';
  IF (d->>'version')::integer IS DISTINCT FROM n OR jsonb_array_length(d->'items') NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Versão ou itens inválidos' USING ERRCODE='22023'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(d->'items') LOOP
   IF item->>'description' IS NULL OR length(item->>'description') NOT BETWEEN 3 AND 200 OR (item->>'quantity')::numeric NOT BETWEEN 1 AND 999 OR mod((item->>'quantity')::numeric,1)<>0 OR (item->>'unitCents')::numeric NOT BETWEEN 0 AND 100000000 OR mod((item->>'unitCents')::numeric,1)<>0 OR item->>'kind' NOT IN ('peca','servico') THEN RAISE EXCEPTION 'Item de orçamento inválido' USING ERRCODE='22023'; END IF;
  END LOOP;
  IF (d->>'discountCents')::bigint<0 OR public.box_quote_total(d)<=0 THEN RAISE EXCEPTION 'Total inválido' USING ERRCODE='22023'; END IF;
  d:=(d-'respondedAt'-'evidence') || jsonb_build_object('status','rascunho','createdAt',now());
  INSERT INTO public.box_records(workspace_id,id,kind,parent_id,customer_id,document) VALUES(p_workspace,rid,'quote',pid,cid,d);
  UPDATE public.box_records SET document=document || jsonb_build_object('currentQuoteId',rid::text,'currentQuoteVersion',(d->>'version')::integer) || CASE WHEN parent->>'status' IN ('aguardando_pecas','execucao','testes','pronto') THEN '{"status":"aguardando_aprovacao"}'::jsonb ELSE '{}'::jsonb END,updated_at=now() WHERE workspace_id=p_workspace AND id=pid;
 ELSIF op='set_quote_status' THEN
  rid:=(p_command->>'id')::uuid;SELECT document,parent_id,customer_id INTO old,pid,cid FROM public.box_records WHERE workspace_id=p_workspace AND id=rid AND kind='quote';
  IF old IS NULL THEN RAISE EXCEPTION 'Orçamento inexistente' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND id=pid AND document->>'status' IN ('entregue','cancelada')) THEN RAISE EXCEPTION 'Atendimento encerrado não recebe nova autorização' USING ERRCODE='22023'; END IF;
  SELECT document INTO latest FROM public.box_records WHERE workspace_id=p_workspace AND parent_id=pid AND kind='quote' ORDER BY (document->>'version')::integer DESC LIMIT 1;
  IF latest->>'id'<>rid::text OR old->>'status' IN ('aprovado','recusado') OR p_command->>'status' NOT IN ('enviado','aprovado','recusado') THEN RAISE EXCEPTION 'Versão histórica ou resposta já registrada' USING ERRCODE='22023'; END IF;
  IF r='customer' THEN
   IF cid IS DISTINCT FROM public.box_customer(p_workspace) OR old->>'status'<>'enviado' OR p_command->>'status' NOT IN ('aprovado','recusado') THEN RAISE EXCEPTION 'Orçamento não pertence ao cliente autenticado' USING ERRCODE='42501'; END IF;
  ELSIF p_command->>'status' IN ('aprovado','recusado') AND length(COALESCE(p_command->>'evidence',''))<10 THEN RAISE EXCEPTION 'Registre a evidência da resposta' USING ERRCODE='22023'; END IF;
  d:=old || jsonb_build_object('status',p_command->>'status');
  IF p_command->>'status' IN ('aprovado','recusado') THEN d:=d || jsonb_build_object('respondedAt',now(),'evidence',CASE WHEN r='customer' THEN 'Resposta do cliente autenticado à versão exibida.' ELSE p_command->>'evidence' END); END IF;
  UPDATE public.box_records SET document=d,updated_at=now() WHERE workspace_id=p_workspace AND id=rid;
 ELSIF op='create_appointment' THEN
  d:=p_command->'appointment';rid:=(d->>'id')::uuid;cid:=(d->>'customerId')::uuid;assigned:=d->>'technician';
  SELECT document INTO customer FROM public.box_records WHERE workspace_id=p_workspace AND id=cid AND kind='customer';
  IF customer IS NULL OR (d->>'duration')::integer NOT BETWEEN 15 AND 480 OR length(COALESCE(d->>'service',''))<3 OR d->>'status' NOT IN ('solicitado','confirmado') THEN RAISE EXCEPTION 'Agendamento inválido' USING ERRCODE='22023'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.box_members WHERE workspace_id=p_workspace AND display_name=assigned AND role IN ('owner','technician','reception')) THEN RAISE EXCEPTION 'Responsável não cadastrado' USING ERRCODE='22023'; END IF;
  start_time:=(d->>'startsAt')::timestamptz;end_time:=start_time+make_interval(mins=>(d->>'duration')::integer);
  IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND kind='appointment' AND assignee=assigned AND document->>'status'<>'cancelado' AND (document->>'startsAt')::timestamptz<end_time AND (document->>'startsAt')::timestamptz+make_interval(mins=>(document->>'duration')::integer)>start_time) THEN RAISE EXCEPTION 'Conflito de horário para o responsável' USING ERRCODE='22023'; END IF;
  d:=d || jsonb_build_object('customerName',customer->>'name');
  INSERT INTO public.box_records(workspace_id,id,kind,customer_id,assignee,document) VALUES(p_workspace,rid,'appointment',cid,assigned,d);
 ELSIF op='set_appointment_status' THEN
  rid:=(p_command->>'id')::uuid;SELECT document INTO old FROM public.box_records WHERE workspace_id=p_workspace AND id=rid AND kind='appointment';
  IF old IS NULL OR p_command->>'status' NOT IN ('solicitado','confirmado','concluido','cancelado','faltou') THEN RAISE EXCEPTION 'Agendamento inválido' USING ERRCODE='22023'; END IF;
  -- Reativar horário cancelado exige nova reserva, com nova checagem de conflito.
  IF old->>'status' IN ('cancelado','concluido','faltou') THEN RAISE EXCEPTION 'Registro encerrado. Crie nova reserva.' USING ERRCODE='22023'; END IF;
  UPDATE public.box_records SET document=old || jsonb_build_object('status',p_command->>'status'),updated_at=now() WHERE workspace_id=p_workspace AND id=rid;
 ELSIF op='record_payment' OR op='record_cost' THEN
  d:=CASE WHEN op='record_payment' THEN p_command->'payment' ELSE p_command->'cost' END;rid:=(d->>'id')::uuid;pid:=(d->>'orderId')::uuid;a:=(d->>'amountCents')::bigint;
  SELECT document INTO old FROM public.box_records WHERE workspace_id=p_workspace AND id=rid AND kind=CASE WHEN op='record_payment' THEN 'payment' ELSE 'cost' END;
  IF old IS NOT NULL THEN IF (old-'createdAt') IS DISTINCT FROM (d-'createdAt') THEN RAISE EXCEPTION 'Identificador já usado em outro lançamento' USING ERRCODE='22023';END IF;RETURN jsonb_build_object('revision',rev,'duplicate',true);END IF;
  SELECT document,customer_id INTO parent,cid FROM public.box_records WHERE workspace_id=p_workspace AND id=pid AND kind='order';
  IF parent IS NULL OR a IS NULL OR a NOT BETWEEN 1 AND 100000000 OR mod((d->>'amountCents')::numeric,1)<>0 THEN RAISE EXCEPTION 'Lançamento inválido' USING ERRCODE='22023'; END IF;
  IF op='record_payment' THEN
   IF d->>'kind' NOT IN ('recebimento','estorno') OR d->>'method' NOT IN ('pix','cartao','dinheiro') THEN RAISE EXCEPTION 'Forma ou tipo inválidos' USING ERRCODE='22023'; END IF;
   SELECT COALESCE(sum(CASE WHEN document->>'kind'='estorno' THEN -(document->>'amountCents')::bigint ELSE (document->>'amountCents')::bigint END),0) INTO paid FROM public.box_records WHERE workspace_id=p_workspace AND parent_id=pid AND kind='payment';
   IF d->>'kind'='estorno' THEN
    IF a>paid OR length(COALESCE(d->>'note',''))<5 THEN RAISE EXCEPTION 'Valor ou motivo do estorno inválidos' USING ERRCODE='22023'; END IF;
   ELSE
    SELECT document INTO latest FROM public.box_records WHERE workspace_id=p_workspace AND parent_id=pid AND kind='quote' ORDER BY (document->>'version')::integer DESC LIMIT 1;
    IF latest IS NULL OR latest->>'status'<>'aprovado' OR a>public.box_quote_total(latest)-paid THEN RAISE EXCEPTION 'Recebimento excede o saldo autorizado' USING ERRCODE='22023'; END IF;
   END IF;kind_value:='payment';
  ELSE
   IF length(COALESCE(d->>'description',''))<3 THEN RAISE EXCEPTION 'Descreva o custo' USING ERRCODE='22023'; END IF;kind_value:='cost';
  END IF;
  d:=d || jsonb_build_object('createdAt',now());INSERT INTO public.box_records(workspace_id,id,kind,parent_id,customer_id,document) VALUES(p_workspace,rid,kind_value,pid,cid,d);
 ELSIF op='create_lead' THEN
  d:=p_command->'lead';rid:=(d->>'id')::uuid;
  IF length(COALESCE(d->>'name',''))<3 OR length(COALESCE(d->>'note',''))<5 THEN RAISE EXCEPTION 'Contato inválido' USING ERRCODE='22023'; END IF;
  d:=d || jsonb_build_object('status','novo','createdAt',now());INSERT INTO public.box_records(workspace_id,id,kind,document) VALUES(p_workspace,rid,'lead',d);
 ELSIF op='set_lead_status' THEN
  rid:=(p_command->>'id')::uuid;SELECT document INTO old FROM public.box_records WHERE workspace_id=p_workspace AND id=rid AND kind='lead';
  IF old IS NULL OR p_command->>'status' NOT IN ('novo','em_contato','convertido','perdido') THEN RAISE EXCEPTION 'Contato inválido' USING ERRCODE='22023'; END IF;
  UPDATE public.box_records SET document=old || jsonb_build_object('status',p_command->>'status','nextAction',COALESCE(p_command->>'nextAction',old->>'nextAction')),updated_at=now() WHERE workspace_id=p_workspace AND id=rid;
 ELSIF op='save_post' THEN
  d:=p_command->'post';rid:=(d->>'id')::uuid;IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND id=rid AND kind<>'post') THEN RAISE EXCEPTION 'Identificador pertence a outra entidade' USING ERRCODE='22023';END IF;SELECT document INTO old FROM public.box_records WHERE workspace_id=p_workspace AND id=rid AND kind='post';
  IF length(COALESCE(d->>'title','')) NOT BETWEEN 3 AND 120 OR length(COALESCE(d->>'caption','')) NOT BETWEEN 10 AND 2200 OR d->>'mediaKind' NOT IN ('imagem','video') OR jsonb_array_length(d->'channels') NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'Conteúdo inválido' USING ERRCODE='22023'; END IF;
  IF d->>'mediaKind'='imagem' AND d->'channels' @> '["youtube"]'::jsonb THEN RAISE EXCEPTION 'Shorts exige vídeo' USING ERRCODE='22023'; END IF;
  d:=(d-'approvedRevision'-'scheduledAt') || jsonb_build_object('revision',COALESCE((old->>'revision')::integer,0)+1,'status','rascunho','deliveries','[]'::jsonb);
  INSERT INTO public.box_records(workspace_id,id,kind,document) VALUES(p_workspace,rid,'post',d) ON CONFLICT(workspace_id,id) DO UPDATE SET document=EXCLUDED.document,updated_at=now();
 ELSIF op='approve_post' THEN
  rid:=(p_command->>'id')::uuid;SELECT document INTO old FROM public.box_records WHERE workspace_id=p_workspace AND id=rid AND kind='post';
  IF old IS NULL OR old->>'rightsConfirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirme direitos e revisão de dados' USING ERRCODE='22023'; END IF;
  UPDATE public.box_records SET document=old || jsonb_build_object('status','aprovado','approvedRevision',(old->>'revision')::integer),updated_at=now() WHERE workspace_id=p_workspace AND id=rid;
 ELSIF op='update_settings' THEN
  d:=p_command->'settings';
  IF length(COALESCE(d->>'heroTitle','')) NOT BETWEEN 10 AND 120 OR length(COALESCE(d->>'heroSubtitle','')) NOT BETWEEN 10 AND 350 OR length(COALESCE(d->>'brandName','')) NOT BETWEEN 3 AND 80 THEN RAISE EXCEPTION 'Conteúdo institucional inválido' USING ERRCODE='22023'; END IF;
  UPDATE public.box_workspaces SET settings=d WHERE id=p_workspace;
 END IF;
 INSERT INTO public.box_audit(workspace_id,actor_id,actor_name,action,entity_id) VALUES(p_workspace,(SELECT auth.uid()),actor,op,rid);
 UPDATE public.box_workspaces SET revision=revision+1 WHERE id=p_workspace RETURNING revision INTO rev;
 RETURN jsonb_build_object('revision',rev,'success',true);
END $$;
REVOKE ALL ON FUNCTION public.box_command(uuid,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.box_command(uuid,integer,jsonb) TO authenticated;
-- Todas as funções BOX têm privilégios explícitos; não altera defaults de outros schemas.
COMMIT;
