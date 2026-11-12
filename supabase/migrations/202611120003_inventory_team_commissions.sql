-- BOX 1.1 — inventário, alocações e comissões. Projeto dedicado; homologar antes de dados reais.
-- Não cria usuários, não publica conteúdo e não envia pagamentos.
BEGIN;
ALTER TABLE public.box_records DROP CONSTRAINT box_records_kind_check;
ALTER TABLE public.box_records ADD CONSTRAINT box_records_kind_check CHECK(kind IN ('customer','vehicle','order','quote','appointment','payment','cost','lead','post','part','stock_movement','mechanic','commission_rule','absence','service','commission','commission_payment'));
CREATE UNIQUE INDEX box_part_sku_unique ON public.box_records(workspace_id,lower(document->>'sku')) WHERE kind='part';
CREATE UNIQUE INDEX box_mechanic_name_unique ON public.box_records(workspace_id,lower(document->>'name')) WHERE kind='mechanic';
CREATE UNIQUE INDEX box_rule_mechanic_unique ON public.box_records(workspace_id,parent_id) WHERE kind='commission_rule';
CREATE UNIQUE INDEX box_service_item_unique ON public.box_records(workspace_id,parent_id,(document->>'serviceKey')) WHERE kind='service' AND document->>'status'<>'cancelado';
CREATE INDEX box_operations_reference_idx ON public.box_records(workspace_id,(document->>'referenceId')) WHERE kind='stock_movement';
CREATE FUNCTION public.box_ops_get(w uuid,rid uuid,k text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$ SELECT document FROM public.box_records WHERE workspace_id=w AND id=rid AND kind=k $$;
CREATE FUNCTION public.box_ops_staff(w uuid,n text,active_only boolean DEFAULT true) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=w AND kind='mechanic' AND document->>'name'=n) THEN EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=w AND kind='mechanic' AND document->>'name'=n AND (NOT active_only OR document->>'active'='true')) ELSE EXISTS(SELECT 1 FROM public.box_members WHERE workspace_id=w AND display_name=n AND role IN ('owner','reception','technician')) END
$$;
CREATE FUNCTION public.box_ops_owns_mechanic(w uuid,m text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(public.box_role(w) IN ('owner','technician') AND EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=w AND kind='mechanic' AND id::text=m AND document->>'userId'=(SELECT auth.uid())::text),false)
$$;
CREATE FUNCTION public.box_ops_owns_order(w uuid,o uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(public.box_role(w) IN ('owner','technician') AND EXISTS(SELECT 1 FROM public.box_records t JOIN public.box_records m ON m.workspace_id=t.workspace_id AND m.id::text=t.document->>'mechanicId' AND m.kind='mechanic' WHERE t.workspace_id=w AND t.kind='service' AND t.parent_id=o AND m.document->>'userId'=(SELECT auth.uid())::text),false)
$$;
CREATE FUNCTION public.box_ops_service_authorized(w uuid,t jsonb) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((public.box_role(w) IN ('owner','reception','finance') OR (public.box_role(w)='technician' AND public.box_ops_owns_mechanic(w,t->>'mechanicId'))) AND EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=w AND kind='service' AND id::text=t->>'id' AND document->>'mechanicId'=t->>'mechanicId' AND document->>'orderId'=t->>'orderId' AND document->>'quoteId'=t->>'quoteId') AND (SELECT document->>'status'='aprovado' AND document->>'id'=t->>'quoteId' FROM public.box_records WHERE workspace_id=w AND kind='quote' AND parent_id=(t->>'orderId')::uuid ORDER BY (document->>'version')::integer DESC LIMIT 1),false)
$$;
CREATE FUNCTION public.box_ops_pending(w uuid,rid uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE((SELECT (document->>'quantity')::bigint FROM public.box_records WHERE workspace_id=w AND id=rid AND kind='stock_movement' AND document->>'kind'='reserva'),0)-COALESCE((SELECT sum((document->>'quantity')::bigint) FROM public.box_records WHERE workspace_id=w AND kind='stock_movement' AND document->>'referenceId'=rid::text AND document->>'kind' IN ('consumo','liberacao')),0)
$$;
CREATE FUNCTION public.box_ops_physical(w uuid,p uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(sum(CASE WHEN document->>'kind' IN ('entrada','ajuste_entrada','devolucao') THEN (document->>'quantity')::bigint WHEN document->>'kind' IN ('consumo','ajuste_saida') THEN -(document->>'quantity')::bigint ELSE 0 END),0) FROM public.box_records WHERE workspace_id=w AND kind='stock_movement' AND parent_id=p
$$;
CREATE FUNCTION public.box_ops_reserved(w uuid,p uuid,o uuid DEFAULT NULL) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(sum(public.box_ops_pending(w,id)),0) FROM public.box_records WHERE workspace_id=w AND kind='stock_movement' AND parent_id=p AND document->>'kind'='reserva' AND (o IS NULL OR document->>'orderId'=o::text)
$$;
CREATE FUNCTION public.box_ops_consumed(w uuid,p uuid,o uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(sum(CASE WHEN document->>'kind'='consumo' THEN (document->>'quantity')::bigint WHEN document->>'kind'='devolucao' THEN -(document->>'quantity')::bigint ELSE 0 END),0) FROM public.box_records WHERE workspace_id=w AND kind='stock_movement' AND parent_id=p AND document->>'orderId'=o::text
$$;
CREATE FUNCTION public.box_ops_paid(w uuid,c uuid) RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(sum(CASE WHEN document->>'kind'='estorno' THEN -(document->>'amountCents')::bigint ELSE (document->>'amountCents')::bigint END),0) FROM public.box_records WHERE workspace_id=w AND kind='commission_payment' AND parent_id=c
$$;
CREATE FUNCTION public.box_ops_policy(p jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT COALESCE(public.box_integer(p,'value',0,100000000) AND (CASE p->>'mode' WHEN 'sem' THEN (p->>'value')::bigint=0 WHEN 'percentual' THEN (p->>'value')::bigint BETWEEN 1 AND 10000 WHEN 'fixo' THEN (p->>'value')::bigint>0 ELSE false END),false)
$$;
CREATE FUNCTION public.box_ops_net_item(q jsonb,idx integer) RETURNS bigint LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 WITH amounts AS (SELECT ordinality-1 AS i,(value->>'quantity')::numeric*(value->>'unitCents')::numeric AS gross FROM jsonb_array_elements(q->'items') WITH ORDINALITY), totals AS (SELECT *,sum(gross) OVER() AS total FROM amounts), cuts AS (SELECT *,floor(gross*(q->>'discountCents')::numeric/NULLIF(total,0)) AS cut,mod(gross*(q->>'discountCents')::numeric,NULLIF(total,0)) AS rest FROM totals), ranked AS (SELECT *,row_number() OVER(ORDER BY rest DESC,i) AS rn,(q->>'discountCents')::numeric-sum(cut) OVER() AS left_count FROM cuts) SELECT (gross-cut-CASE WHEN rn<=left_count THEN 1 ELSE 0 END)::bigint FROM ranked WHERE i=idx
$$;
CREATE FUNCTION public.box_ops_key(o uuid,q jsonb,idx integer) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT COALESCE(q->'items'->idx->>'id','legacy:'||o::text||':'||idx::text) $$;
CREATE FUNCTION public.box_ops_conflict(w uuid,m jsonb,st timestamptz,mins integer,excluded uuid DEFAULT NULL,linked uuid DEFAULT NULL) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE en timestamptz:=st+make_interval(mins=>mins);
BEGIN
 IF m IS NULL OR m->>'active' IS DISTINCT FROM 'true' THEN RETURN 'Mecânico inativo ou não cadastrado.';END IF;
 IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=w AND kind='absence' AND parent_id=(m->>'id')::uuid AND document->>'status'='ativa' AND (document->>'startsAt')::timestamptz<en AND (document->>'endsAt')::timestamptz>st) THEN RETURN 'Indisponibilidade do mecânico nesse intervalo.';END IF;
 IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=w AND kind='service' AND document->>'mechanicId'=m->>'id' AND (excluded IS NULL OR id<>excluded) AND document->>'status' NOT IN ('concluido','cancelado') AND (document->>'plannedAt')::timestamptz<en AND (document->>'plannedAt')::timestamptz+make_interval(mins=>(document->>'duration')::integer)>st) THEN RETURN 'Conflito com outro serviço alocado.';END IF;
 IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=w AND kind='appointment' AND assignee=m->>'name' AND (linked IS NULL OR id<>linked) AND document->>'status' IN ('solicitado','confirmado') AND (document->>'startsAt')::timestamptz<en AND (document->>'startsAt')::timestamptz+make_interval(mins=>(document->>'duration')::integer)>st) THEN RETURN 'Horário já reservado na agenda.';END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION public.box_ops_release(w uuid,o uuid,reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.box_records; n bigint; d jsonb; rid uuid;
BEGIN FOR r IN SELECT * FROM public.box_records WHERE workspace_id=w AND kind='stock_movement' AND document->>'kind'='reserva' AND document->>'orderId'=o::text LOOP n:=public.box_ops_pending(w,r.id);IF n>0 THEN rid:=gen_random_uuid();d:=jsonb_build_object('id',rid,'partId',r.document->>'partId','kind','liberacao','quantity',n,'unitCostCents',0,'reason',reason,'createdAt',now(),'orderId',o,'quoteId',r.document->>'quoteId','referenceId',r.id);INSERT INTO public.box_records(workspace_id,id,kind,parent_id,document) VALUES(w,rid,'stock_movement',r.parent_id,d);END IF;END LOOP;END $$;
CREATE FUNCTION public.box_ops_order_work(w uuid,o uuid,cancelled boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.box_records; target text:=CASE WHEN cancelled THEN 'cancelado' ELSE 'pausado' END; note text:=CASE WHEN cancelled THEN 'Serviço não concluído cancelado com a OS; histórico preservado.' ELSE 'Nova versão do orçamento: revisar o vínculo após aprovação antes de retomar.' END;
BEGIN
 PERFORM public.box_ops_release(w,o,CASE WHEN cancelled THEN 'Reserva liberada: OS cancelada.' ELSE 'Reserva liberada: nova versão do orçamento exige revisão e autorização.' END);
 FOR r IN SELECT * FROM public.box_records WHERE workspace_id=w AND kind='service' AND parent_id=o AND document->>'status' NOT IN ('concluido','cancelado') LOOP
  UPDATE public.box_records SET document=r.document||jsonb_build_object('status',target,'history',(r.document->'history')||jsonb_build_array(jsonb_build_object('status',target,'at',now(),'note',note))),updated_at=now() WHERE workspace_id=w AND id=r.id;
  IF cancelled THEN UPDATE public.box_records SET document=document||jsonb_build_object('status','cancelada','cancellationReason','OS cancelada antes da conclusão do serviço.'),updated_at=now() WHERE workspace_id=w AND kind='commission' AND parent_id=r.id AND document->>'status'='prevista';END IF;
 END LOOP;
END $$;
CREATE FUNCTION public.box_ops_finished(w uuid,o uuid) RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=w AND kind='service' AND parent_id=o AND document->>'status' NOT IN ('concluido','cancelado')) THEN RAISE EXCEPTION 'Conclua ou cancele os serviços antes de avançar.' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=w AND kind='stock_movement' AND document->>'kind'='reserva' AND document->>'orderId'=o::text AND public.box_ops_pending(w,id)>0) THEN RAISE EXCEPTION 'Baixe ou libere as reservas antes de avançar.' USING ERRCODE='22023';END IF;
END $$;
CREATE FUNCTION public.box_ops_commission(w uuid,t jsonb,p jsonb,request_key text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rid uuid:=gen_random_uuid();q jsonb; base bigint; amount bigint;d jsonb;
BEGIN
 IF NOT public.box_ops_policy(p) THEN RAISE EXCEPTION 'Regra de comissão inválida.' USING ERRCODE='22023';END IF;
 q:=public.box_ops_get(w,(t->>'quoteId')::uuid,'quote');base:=public.box_ops_net_item(q,(t->>'itemIndex')::integer);
 amount:=CASE p->>'mode' WHEN 'sem' THEN 0 WHEN 'fixo' THEN (p->>'value')::bigint ELSE floor(base::numeric*(p->>'value')::numeric/10000+0.5)::bigint END;
 d:=jsonb_build_object('id',rid,'description',t->>'description','serviceId',t->>'id','orderId',t->>'orderId','mechanicId',t->>'mechanicId','quoteId',t->>'quoteId','baseCents',base,'mode',p->>'mode','value',(p->>'value')::bigint,'amountCents',amount,'status','prevista','createdAt',now())||CASE WHEN request_key IS NOT NULL THEN jsonb_build_object('requestKey',request_key) ELSE '{}'::jsonb END;
 INSERT INTO public.box_records(workspace_id,id,kind,parent_id,document) VALUES(w,rid,'commission',(t->>'id')::uuid,d);
END $$;
-- A política lê documentos operacionais e financeiros separadamente.
DROP POLICY box_records_read ON public.box_records;
CREATE POLICY box_records_read ON public.box_records FOR SELECT TO authenticated USING(
 CASE public.box_role(workspace_id)
 WHEN 'owner' THEN true
 WHEN 'reception' THEN kind IN ('customer','vehicle','order','quote','appointment','lead','part','stock_movement','mechanic','absence','service')
 WHEN 'technician' THEN (kind IN ('order','appointment') AND assignee=public.box_name(workspace_id)) OR (kind='order' AND public.box_ops_owns_order(workspace_id,id)) OR (kind='mechanic' AND document->>'userId'=(SELECT auth.uid())::text) OR (kind IN ('absence','service') AND public.box_ops_owns_mechanic(workspace_id,document->>'mechanicId'))
 WHEN 'finance' THEN kind IN ('order','quote','payment','cost','appointment','part','stock_movement','mechanic','absence','service','commission_rule','commission','commission_payment')
 WHEN 'marketing' THEN kind='post'
 WHEN 'customer' THEN (kind='customer' AND id=public.box_customer(workspace_id)) OR (kind IN ('vehicle','order') AND customer_id=public.box_customer(workspace_id)) OR (kind='quote' AND customer_id=public.box_customer(workspace_id) AND document->>'status'<>'rascunho')
 ELSE false END
);
CREATE OR REPLACE FUNCTION public.box_read_workspace(p_workspace uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; key text; category text;
BEGIN
 IF public.box_role(p_workspace) IS NULL THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('revision',revision,'settings',settings) INTO result FROM public.box_workspaces WHERE id=p_workspace;
 FOR key,category IN SELECT * FROM (VALUES ('customers','customer'),('vehicles','vehicle'),('orders','order'),('quotes','quote'),('appointments','appointment'),('payments','payment'),('costs','cost'),('leads','lead'),('posts','post'),('parts','part'),('stockMovements','stock_movement'),('mechanics','mechanic'),('commissionRules','commission_rule'),('absences','absence'),('services','service'),('commissions','commission'),('commissionPayments','commission_payment')) v(a,b) LOOP
  result:=result||jsonb_build_object(key,COALESCE((SELECT jsonb_agg(CASE WHEN category='service' THEN document||jsonb_build_object('authorizationCurrent',public.box_ops_service_authorized(p_workspace,document)) ELSE document END ORDER BY created_at DESC,id) FROM public.box_records WHERE workspace_id=p_workspace AND kind=category),'[]'::jsonb));
 END LOOP;
 result:=result||jsonb_build_object('audit',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'actor',a.actor_name,'entityId',a.entity_id,'at',a.created_at)) FROM (SELECT * FROM public.box_audit WHERE workspace_id=p_workspace ORDER BY created_at DESC LIMIT 250) a),'[]'::jsonb));RETURN result;
END $$;
-- A implementação legada é privada; o novo entrypoint aplica também os vínculos cruzados.
ALTER FUNCTION public.box_command(uuid,integer,jsonb) RENAME TO box_command_v1;
REVOKE ALL ON FUNCTION public.box_command_v1(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;

-- Compatibilidade do cadastro operacional com a agenda/OS legadas, sem mudar histórico.
CREATE OR REPLACE FUNCTION public.box_valid_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE d jsonb:=NEW.document; valid boolean; item jsonb; related public.box_records; stamp timestamptz;
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR octet_length(d::text)>40000 OR d->>'id' IS DISTINCT FROM NEW.id::text THEN RAISE EXCEPTION 'Documento inválido' USING ERRCODE='22023'; END IF;
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.workspace_id<>OLD.workspace_id OR NEW.kind<>OLD.kind OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.assignee IS DISTINCT FROM OLD.assignee) THEN RAISE EXCEPTION 'Vínculos não podem ser reescritos' USING ERRCODE='22023';END IF;
 IF NEW.customer_id IS NOT NULL THEN
  SELECT * INTO related FROM public.box_records WHERE workspace_id=NEW.workspace_id AND id=NEW.customer_id AND kind='customer';
  IF NOT FOUND THEN RAISE EXCEPTION 'Vínculo de cliente inválido' USING ERRCODE='22023';END IF;
 END IF;
 CASE NEW.kind
 WHEN 'customer' THEN
  valid:=NEW.parent_id IS NULL AND NEW.customer_id IS NULL AND public.box_text(d,'name',3,120) AND public.box_text(d,'email',0,254) AND public.box_text(d,'phone',0,40) AND public.box_text(d,'notes',0,1000) AND (d->>'email'='' OR d->>'email' ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
 WHEN 'vehicle' THEN
  valid:=NEW.parent_id IS NULL AND NEW.customer_id IS NOT NULL AND d->>'customerId'=NEW.customer_id::text AND public.box_text(d,'model',2,120) AND public.box_integer(d,'year',1900,2100) AND public.box_text(d,'plate',0,16) AND public.box_integer(d,'km',0,3000000);
 WHEN 'order' THEN
  valid:=d->>'status' IN ('recepcao','diagnostico','aguardando_aprovacao','aguardando_pecas','execucao','testes','pronto','entregue','cancelada') AND public.box_text(d,'number',3,40) AND public.box_text(d,'customerName',3,120) AND public.box_text(d,'vehicleLabel',2,160) AND public.box_text(d,'complaint',5,3000) AND public.box_text(d,'diagnosis',0,3000) AND public.box_text(d,'technician',2,120) AND NEW.assignee=d->>'technician' AND d->>'customerId'=NEW.customer_id::text AND d->>'vehicleId'=NEW.parent_id::text AND public.box_text(d,'dueDate',10,10) AND d->>'dueDate' ~ '^\d{4}-\d{2}-\d{2}$' AND jsonb_typeof(d->'checklist')='array';
  IF valid THEN
   PERFORM (d->>'dueDate')::date;
   valid:=jsonb_array_length(d->'checklist')<=10 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(d->'checklist') x WHERE jsonb_typeof(x)<>'string' OR length(x#>>'{}') NOT BETWEEN 1 AND 120);
  END IF;
  SELECT * INTO related FROM public.box_records WHERE workspace_id=NEW.workspace_id AND id=NEW.parent_id AND kind='vehicle' AND customer_id=NEW.customer_id;
  valid:=valid AND related.id IS NOT NULL AND public.box_ops_staff(NEW.workspace_id,NEW.assignee,false);
  IF d?'currentQuoteId' THEN valid:=valid AND public.box_integer(d,'currentQuoteVersion',1,10000) AND EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=NEW.workspace_id AND id=(d->>'currentQuoteId')::uuid AND kind='quote' AND parent_id=NEW.id AND (document->>'version')::integer=(d->>'currentQuoteVersion')::integer);END IF;
  IF d->>'status'='cancelada' THEN valid:=valid AND public.box_text(d,'cancellationReason',5,500);END IF;
  IF d?'returnOf' THEN valid:=valid AND EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=NEW.workspace_id AND id=(d->>'returnOf')::uuid AND kind='order' AND parent_id=NEW.parent_id AND customer_id=NEW.customer_id AND document->>'status' IN ('entregue','cancelada'));END IF;
 WHEN 'quote' THEN
  valid:=d->>'orderId'=NEW.parent_id::text AND d->>'status' IN ('rascunho','enviado','aprovado','recusado') AND public.box_integer(d,'version',1,10000) AND public.box_integer(d,'discountCents',0,100000000) AND public.box_text(d,'terms',10,2000) AND jsonb_typeof(d->'items')='array';
  IF valid THEN
   valid:=jsonb_array_length(d->'items') BETWEEN 1 AND 30;
   FOR item IN SELECT value FROM jsonb_array_elements(d->'items') LOOP valid:=valid AND public.box_text(item,'description',3,200) AND item->>'kind' IN ('peca','servico') AND public.box_integer(item,'quantity',1,999) AND public.box_integer(item,'unitCents',0,100000000);END LOOP;
   IF valid THEN valid:=public.box_quote_total(d)>0;END IF;
  END IF;
  valid:=valid AND EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=NEW.workspace_id AND id=NEW.parent_id AND kind='order' AND customer_id=NEW.customer_id);
  IF d->>'status' IN ('aprovado','recusado') THEN valid:=valid AND public.box_text(d,'respondedAt',10,60) AND public.box_text(d,'evidence',10,1000);stamp:=(d->>'respondedAt')::timestamptz;END IF;
  IF TG_OP='UPDATE' THEN
   IF OLD.document->>'status' IN ('aprovado','recusado') OR (d-ARRAY['status','respondedAt','evidence']) IS DISTINCT FROM (OLD.document-ARRAY['status','respondedAt','evidence']) THEN RAISE EXCEPTION 'Versão de orçamento é imutável; crie outra versão' USING ERRCODE='22023';END IF;
  END IF;
 WHEN 'appointment' THEN
  valid:=NEW.parent_id IS NULL AND d->>'customerId'=NEW.customer_id::text AND public.box_text(d,'customerName',3,120) AND public.box_text(d,'vehicleLabel',1,160) AND public.box_text(d,'service',3,200) AND public.box_text(d,'startsAt',10,60) AND public.box_integer(d,'duration',15,480) AND public.box_text(d,'technician',2,120) AND NEW.assignee=d->>'technician' AND d->>'status' IN ('solicitado','confirmado','concluido','cancelado','faltou') AND public.box_ops_staff(NEW.workspace_id,NEW.assignee,false);
  stamp:=(d->>'startsAt')::timestamptz;
 WHEN 'payment','cost' THEN
  valid:=d->>'orderId'=NEW.parent_id::text AND public.box_integer(d,'amountCents',1,100000000) AND EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=NEW.workspace_id AND id=NEW.parent_id AND kind='order' AND customer_id=NEW.customer_id);
  IF NEW.kind='payment' THEN valid:=valid AND d->>'kind' IN ('recebimento','estorno') AND d->>'method' IN ('pix','cartao','dinheiro') AND public.box_text(d,'note',0,500);ELSE valid:=valid AND public.box_text(d,'description',3,200);END IF;
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Lançamento é imutável; registre um estorno separado' USING ERRCODE='22023';END IF;
 WHEN 'lead' THEN
  valid:=NEW.parent_id IS NULL AND NEW.customer_id IS NULL AND public.box_text(d,'name',3,120) AND public.box_text(d,'phone',0,40) AND public.box_text(d,'vehicle',0,160) AND public.box_text(d,'note',5,1000) AND public.box_text(d,'source',1,100) AND public.box_text(d,'nextAction',0,250) AND d->>'status' IN ('novo','em_contato','convertido','perdido');
 WHEN 'post' THEN
  valid:=NEW.parent_id IS NULL AND NEW.customer_id IS NULL AND public.box_text(d,'title',3,120) AND public.box_text(d,'caption',10,2200) AND d->>'mediaKind' IN ('imagem','video') AND d->>'visual' IN ('gear','care','team') AND jsonb_typeof(d->'channels')='array' AND public.box_integer(d,'revision',1,10000) AND jsonb_typeof(d->'rightsConfirmed')='boolean' AND d->>'status' IN ('rascunho','aprovado') AND d->'deliveries'='[]'::jsonb;
  IF valid THEN valid:=jsonb_array_length(d->'channels') BETWEEN 1 AND 3 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(d->'channels') v WHERE v NOT IN ('instagram','facebook','youtube')) AND (SELECT count(DISTINCT v) FROM jsonb_array_elements_text(d->'channels') v)=jsonb_array_length(d->'channels') AND NOT (d->>'mediaKind'='imagem' AND d->'channels' @> '["youtube"]'::jsonb);END IF;
  IF d?'variants' THEN
   IF jsonb_typeof(d->'variants') IS DISTINCT FROM 'object' THEN valid:=false;ELSE valid:=valid AND NOT EXISTS(SELECT 1 FROM jsonb_each(d->'variants') v WHERE v.key NOT IN ('instagram','facebook','youtube') OR jsonb_typeof(v.value)<>'string' OR length(v.value#>>'{}')>2200);END IF;
  END IF;
  IF d->>'status'='aprovado' THEN valid:=valid AND d->>'rightsConfirmed'='true' AND d->'approvedRevision'=d->'revision';END IF;
 ELSE valid:=false;
 END CASE;
 IF valid IS DISTINCT FROM true THEN RAISE EXCEPTION 'Documento não atende às regras da entidade' USING ERRCODE='22023';END IF;
 IF NEW.kind NOT IN ('vehicle','appointment') THEN
  IF NOT public.box_text(d,'createdAt',10,60) THEN RAISE EXCEPTION 'Data inválida' USING ERRCODE='22023';END IF;stamp:=(d->>'createdAt')::timestamptz;
 END IF;
 RETURN NEW;
END $$;

DROP TRIGGER box_record_integrity ON public.box_records;
CREATE TRIGGER box_record_integrity BEFORE INSERT OR UPDATE ON public.box_records FOR EACH ROW WHEN (NEW.kind IN ('customer','vehicle','order','quote','appointment','payment','cost','lead','post')) EXECUTE FUNCTION public.box_valid_record();

CREATE OR REPLACE FUNCTION public.box_command_v1(p_workspace uuid,p_expected_revision integer,p_command jsonb) RETURNS jsonb
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
  IF NOT public.box_ops_staff(p_workspace,assigned,true) THEN RAISE EXCEPTION 'Responsável não cadastrado na equipe' USING ERRCODE='22023'; END IF;
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
  IF NOT public.box_ops_staff(p_workspace,assigned,true) THEN RAISE EXCEPTION 'Responsável não cadastrado' USING ERRCODE='22023'; END IF;
  start_time:=(d->>'startsAt')::timestamptz;end_time:=start_time+make_interval(mins=>(d->>'duration')::integer);
  IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND kind='appointment' AND assignee=assigned AND document->>'status' IN ('solicitado','confirmado') AND (document->>'startsAt')::timestamptz<end_time AND (document->>'startsAt')::timestamptz+make_interval(mins=>(document->>'duration')::integer)>start_time) THEN RAISE EXCEPTION 'Conflito de horário para o responsável' USING ERRCODE='22023'; END IF;
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

CREATE FUNCTION public.box_ops_valid_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE d jsonb:=NEW.document; valid boolean:=false; related jsonb; source jsonb; v jsonb; st timestamptz; en timestamptz; expected bigint;
BEGIN
 IF jsonb_typeof(d) IS DISTINCT FROM 'object' OR octet_length(d::text)>40000 OR d->>'id' IS DISTINCT FROM NEW.id::text THEN RAISE EXCEPTION 'Documento operacional inválido.' USING ERRCODE='22023';END IF;
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.workspace_id<>OLD.workspace_id OR NEW.kind<>OLD.kind OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.assignee IS DISTINCT FROM OLD.assignee) THEN RAISE EXCEPTION 'Vínculos operacionais são preservados.' USING ERRCODE='22023';END IF;
 IF NEW.customer_id IS NOT NULL THEN RAISE EXCEPTION 'Documento operacional não usa vínculo público de cliente.' USING ERRCODE='22023';END IF;
 CASE NEW.kind
 WHEN 'part' THEN
  IF TG_OP='UPDATE' AND d->>'unit' IS DISTINCT FROM OLD.document->>'unit' AND EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=NEW.workspace_id AND kind='stock_movement' AND parent_id=NEW.id) THEN RAISE EXCEPTION 'Unidade é preservada após movimento de estoque.' USING ERRCODE='22023';END IF;
  valid:=NEW.parent_id IS NULL AND public.box_text(d,'sku',2,40) AND public.box_text(d,'name',3,160) AND public.box_text(d,'location',0,100) AND d->>'unit' IN ('un','kit','frasco') AND public.box_integer(d,'minimum',0,100000) AND public.box_integer(d,'referenceCostCents',0,100000000);
 WHEN 'mechanic' THEN
  valid:=NEW.parent_id IS NULL AND public.box_text(d,'name',3,120) AND public.box_text(d,'note',0,250) AND jsonb_typeof(d->'active')='boolean';
  IF d?'userId' THEN valid:=valid AND EXISTS(SELECT 1 FROM public.box_members WHERE workspace_id=NEW.workspace_id AND user_id=(d->>'userId')::uuid AND role IN ('owner','technician') AND display_name=d->>'name');END IF;
  IF TG_OP='UPDATE' AND (d->>'name' IS DISTINCT FROM OLD.document->>'name' OR d->>'userId' IS DISTINCT FROM OLD.document->>'userId') THEN RAISE EXCEPTION 'Nome e conta do mecânico exigem preservação/provisionamento administrativo.' USING ERRCODE='22023';END IF;
 WHEN 'commission_rule' THEN valid:=d->>'mechanicId'=NEW.parent_id::text AND public.box_ops_get(NEW.workspace_id,NEW.parent_id,'mechanic') IS NOT NULL AND public.box_ops_policy(d);
 WHEN 'absence' THEN
  valid:=d->>'mechanicId'=NEW.parent_id::text AND public.box_ops_get(NEW.workspace_id,NEW.parent_id,'mechanic') IS NOT NULL AND d->>'status' IN ('ativa','cancelada') AND public.box_text(d,'reason',5,300) AND public.box_text(d,'startsAt',10,60) AND public.box_text(d,'endsAt',10,60);
  st:=(d->>'startsAt')::timestamptz;en:=(d->>'endsAt')::timestamptz;valid:=valid AND en>st AND en<=st+interval '31 days';
  IF d->>'status'='cancelada' THEN valid:=valid AND public.box_text(d,'cancellationReason',5,300);END IF;
 WHEN 'stock_movement' THEN
  related:=public.box_ops_get(NEW.workspace_id,NEW.parent_id,'part');
  valid:=related IS NOT NULL AND d->>'partId'=NEW.parent_id::text AND public.box_integer(d,'quantity',1,100000) AND public.box_integer(d,'unitCostCents',0,100000000) AND public.box_text(d,'reason',5,300) AND d->>'kind' IN ('entrada','ajuste_entrada','ajuste_saida','reserva','liberacao','consumo','devolucao');
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Movimento de estoque é imutável; registre outro movimento.' USING ERRCODE='22023';END IF;
  IF d->>'kind' IN ('reserva','liberacao','consumo','devolucao') THEN
   related:=public.box_ops_get(NEW.workspace_id,(d->>'orderId')::uuid,'order');source:=public.box_ops_get(NEW.workspace_id,(d->>'quoteId')::uuid,'quote');
   valid:=valid AND related IS NOT NULL AND source->>'orderId'=related->>'id';
  END IF;
  IF d->>'kind' IN ('liberacao','consumo','devolucao') THEN
   source:=public.box_ops_get(NEW.workspace_id,(d->>'referenceId')::uuid,'stock_movement');valid:=valid AND source->>'partId'=d->>'partId' AND source->>'orderId'=d->>'orderId' AND source->>'quoteId'=d->>'quoteId';
   IF d->>'kind'='devolucao' THEN
    valid:=valid AND source->>'kind'='consumo' AND source->'unitCostCents'=d->'unitCostCents';
    SELECT COALESCE(sum((document->>'quantity')::bigint),0) INTO expected FROM public.box_records WHERE workspace_id=NEW.workspace_id AND kind='stock_movement' AND document->>'kind'='devolucao' AND document->>'referenceId'=source->>'id';
    valid:=valid AND (d->>'quantity')::bigint<=(source->>'quantity')::bigint-expected;
   ELSE valid:=valid AND source->>'kind'='reserva' AND (d->>'quantity')::bigint<=public.box_ops_pending(NEW.workspace_id,(source->>'id')::uuid);END IF;
  END IF;
  IF d->>'kind'='ajuste_saida' THEN valid:=valid AND (d->>'quantity')::bigint<=public.box_ops_physical(NEW.workspace_id,NEW.parent_id)-public.box_ops_reserved(NEW.workspace_id,NEW.parent_id);END IF;
  IF d->>'kind'='consumo' THEN valid:=valid AND (d->>'quantity')::bigint<=public.box_ops_physical(NEW.workspace_id,NEW.parent_id);END IF;
  IF d->>'kind'='reserva' THEN valid:=valid AND (d->>'quantity')::bigint<=public.box_ops_physical(NEW.workspace_id,NEW.parent_id)-public.box_ops_reserved(NEW.workspace_id,NEW.parent_id);END IF;
 WHEN 'service' THEN
  related:=public.box_ops_get(NEW.workspace_id,(d->>'mechanicId')::uuid,'mechanic');source:=public.box_ops_get(NEW.workspace_id,(d->>'quoteId')::uuid,'quote');
  valid:=related IS NOT NULL AND d->>'orderId'=NEW.parent_id::text AND public.box_ops_get(NEW.workspace_id,NEW.parent_id,'order') IS NOT NULL AND NEW.assignee=related->>'name' AND source->>'orderId'=NEW.parent_id::text AND public.box_integer(d,'itemIndex',0,29) AND public.box_integer(d,'duration',15,480) AND public.box_text(d,'description',3,200) AND public.box_text(d,'plannedAt',10,60) AND d->>'status' IN ('planejado','em_execucao','pausado','concluido','cancelado') AND jsonb_typeof(d->'history')='array';
  IF valid THEN valid:=source->'items'->((d->>'itemIndex')::integer)->>'kind'='servico' AND d->>'serviceKey'=public.box_ops_key(NEW.parent_id,source,(d->>'itemIndex')::integer);END IF;
  st:=(d->>'plannedAt')::timestamptz;
  IF d?'startedAt' THEN st:=(d->>'startedAt')::timestamptz;END IF;
  IF d->>'status'='concluido' THEN valid:=valid AND public.box_text(d,'completedAt',10,60);st:=(d->>'completedAt')::timestamptz;END IF;
  IF TG_OP='UPDATE' AND (d->>'mechanicId' IS DISTINCT FROM OLD.document->>'mechanicId' OR d->>'serviceKey' IS DISTINCT FROM OLD.document->>'serviceKey' OR d->>'plannedAt' IS DISTINCT FROM OLD.document->>'plannedAt' OR d->'duration' IS DISTINCT FROM OLD.document->'duration') THEN RAISE EXCEPTION 'Alocação é preservada. Cancele e crie outra, com histórico.' USING ERRCODE='22023';END IF;
 WHEN 'commission' THEN
  related:=public.box_ops_get(NEW.workspace_id,NEW.parent_id,'service');
  valid:=related IS NOT NULL AND d->>'serviceId'=NEW.parent_id::text AND d->>'orderId'=related->>'orderId' AND d->>'mechanicId'=related->>'mechanicId' AND public.box_ops_get(NEW.workspace_id,(d->>'quoteId')::uuid,'quote')->>'orderId'=related->>'orderId' AND public.box_text(d,'description',3,200) AND public.box_ops_policy(d) AND public.box_integer(d,'baseCents',0,3000000000000) AND public.box_integer(d,'amountCents',0,3000000000000) AND d->>'status' IN ('prevista','gerada','cancelada');
  expected:=CASE d->>'mode' WHEN 'sem' THEN 0 WHEN 'fixo' THEN (d->>'value')::bigint WHEN 'percentual' THEN floor((d->>'baseCents')::numeric*(d->>'value')::numeric/10000+0.5)::bigint ELSE -1 END;valid:=valid AND (d->>'amountCents')::bigint=expected;
  IF d->>'status'='gerada' THEN valid:=valid AND public.box_text(d,'earnedAt',10,60);st:=(d->>'earnedAt')::timestamptz;END IF;
  IF d->>'status'='cancelada' THEN valid:=valid AND public.box_text(d,'cancellationReason',5,300);END IF;
  IF TG_OP='UPDATE' AND (d-ARRAY['status','earnedAt','cancellationReason']) IS DISTINCT FROM (OLD.document-ARRAY['status','earnedAt','cancellationReason']) THEN RAISE EXCEPTION 'Fotografia da comissão é imutável.' USING ERRCODE='22023';END IF;
 WHEN 'commission_payment' THEN
  related:=public.box_ops_get(NEW.workspace_id,NEW.parent_id,'commission');valid:=related IS NOT NULL AND d->>'commissionId'=NEW.parent_id::text AND public.box_integer(d,'amountCents',1,100000000) AND public.box_text(d,'note',5,300) AND d->>'kind' IN ('repasse','estorno');
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Repasse é imutável. Registre estorno separado.' USING ERRCODE='22023';END IF;
 END CASE;
 IF valid IS DISTINCT FROM true OR NOT public.box_text(d,'createdAt',10,60) THEN RAISE EXCEPTION 'Documento operacional não atende às regras.' USING ERRCODE='22023';END IF;
 st:=(d->>'createdAt')::timestamptz;RETURN NEW;
END $$;
CREATE TRIGGER box_operations_integrity BEFORE INSERT OR UPDATE ON public.box_records FOR EACH ROW WHEN (NEW.kind IN ('part','stock_movement','mechanic','commission_rule','absence','service','commission','commission_payment')) EXECUTE FUNCTION public.box_ops_valid_record();
CREATE FUNCTION public.box_ops_quote_links() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE i jsonb; keys text[]:=ARRAY[]::text[];
BEGIN
 IF jsonb_typeof(NEW.document->'items') IS DISTINCT FROM 'array' THEN RETURN NEW;END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(NEW.document->'items') LOOP
  IF i?'id' THEN
   IF jsonb_typeof(i->'id') IS DISTINCT FROM 'string' OR NOT ((i->>'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR (i->>'id') ~ ('^legacy:'||NEW.parent_id::text||':[0-9]{1,2}$')) OR i->>'id'=ANY(keys) THEN RAISE EXCEPTION 'Identificação de item inválida ou repetida.' USING ERRCODE='22023';END IF;keys:=array_append(keys,i->>'id');
  END IF;
  IF i?'partId' AND (i->>'kind' IS DISTINCT FROM 'peca' OR public.box_ops_get(NEW.workspace_id,(i->>'partId')::uuid,'part') IS NULL) THEN RAISE EXCEPTION 'Vínculo de estoque do orçamento inválido.' USING ERRCODE='22023';END IF;
 END LOOP;RETURN NEW;
END $$;
CREATE TRIGGER box_quote_stock_links BEFORE INSERT OR UPDATE ON public.box_records FOR EACH ROW WHEN (NEW.kind='quote') EXECUTE FUNCTION public.box_ops_quote_links();

CREATE FUNCTION public.box_command(p_workspace uuid,p_expected_revision integer,p_command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r text;actor text;rev integer;op text;rid uuid;pid uuid;mid uuid;oid uuid;linked uuid;d jsonb;old jsonb;p jsonb;m jsonb;o jsonb;q jsonb;item jsonb;rule jsonb;t jsonb;c jsonb;ref jsonb;result jsonb;qty bigint;cost bigint;amount bigint;allowed bigint;paid bigint;idx integer;mins integer;st timestamptz;en timestamptz;msg text;key text;row_item record;
BEGIN
 SELECT role,display_name INTO r,actor FROM public.box_members WHERE workspace_id=p_workspace AND user_id=(SELECT auth.uid());
 IF r IS NULL OR (SELECT auth.jwt()->>'aal') IS DISTINCT FROM 'aal2' THEN RAISE EXCEPTION 'Acesso não autorizado.' USING ERRCODE='42501';END IF;
 IF p_command IS NULL OR jsonb_typeof(p_command) IS DISTINCT FROM 'object' OR octet_length(p_command::text)>40000 THEN RAISE EXCEPTION 'Comando inválido ou muito grande.' USING ERRCODE='22023';END IF;
 SELECT revision INTO rev FROM public.box_workspaces WHERE id=p_workspace FOR UPDATE;
 IF p_expected_revision IS DISTINCT FROM rev THEN RAISE EXCEPTION 'Os dados mudaram. Atualize antes de tentar novamente.' USING ERRCODE='40001';END IF;
 op:=p_command->>'type';
 IF op IN ('create_customer','create_order','transition_order','create_quote','set_quote_status','create_appointment','set_appointment_status','record_payment','record_cost','create_lead','set_lead_status','save_post','approve_post','update_settings') THEN
  IF NOT(r='owner' OR (r='reception' AND op IN ('create_customer','create_order','transition_order','create_quote','set_quote_status','create_appointment','set_appointment_status','create_lead','set_lead_status')) OR (r='technician' AND op='transition_order') OR (r='finance' AND op IN ('record_payment','record_cost')) OR (r='marketing' AND op='save_post') OR (r='customer' AND op='set_quote_status')) THEN RAISE EXCEPTION 'Este perfil não pode executar essa ação.' USING ERRCODE='42501';END IF;
  IF op='transition_order' AND r='technician' AND NOT EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND id=(p_command->>'id')::uuid AND kind='order' AND assignee=actor) THEN RAISE EXCEPTION 'OS não disponível para este perfil.' USING ERRCODE='42501';END IF;
  IF op='create_quote' THEN
   oid:=(p_command#>>'{quote,orderId}')::uuid;
   FOR row_item IN SELECT id FROM public.box_records WHERE workspace_id=p_workspace AND kind='part' LOOP
    qty:=public.box_ops_consumed(p_workspace,row_item.id,oid);
    SELECT COALESCE(sum((value->>'quantity')::bigint),0) INTO allowed FROM jsonb_array_elements(p_command#>'{quote,items}') WHERE value->>'kind'='peca' AND value->>'partId'=row_item.id::text;
    IF qty>allowed THEN RAISE EXCEPTION 'Há peças já baixadas. Preserve os itens ou devolva material não utilizado.' USING ERRCODE='22023';END IF;
   END LOOP;
  ELSIF op='transition_order' THEN
   oid:=(p_command->>'id')::uuid;o:=public.box_ops_get(p_workspace,oid,'order');
   IF p_command->>'status' IS DISTINCT FROM o->>'status' AND p_command->>'status' IN ('testes','pronto','entregue') THEN PERFORM public.box_ops_finished(p_workspace,oid);END IF;
  ELSIF op='create_appointment' THEN
   d:=p_command->'appointment';SELECT document INTO m FROM public.box_records WHERE workspace_id=p_workspace AND kind='mechanic' AND document->>'name'=d->>'technician';
   IF m IS NOT NULL THEN msg:=public.box_ops_conflict(p_workspace,m,(d->>'startsAt')::timestamptz,(d->>'duration')::integer);IF msg IS NOT NULL THEN RAISE EXCEPTION '%',msg USING ERRCODE='22023';END IF;END IF;
  END IF;
  result:=public.box_command_v1(p_workspace,p_expected_revision,p_command);
  IF op='create_quote' THEN PERFORM public.box_ops_order_work(p_workspace,(p_command#>>'{quote,orderId}')::uuid,false);END IF;
  IF op='transition_order' AND p_command->>'status'='cancelada' THEN PERFORM public.box_ops_order_work(p_workspace,(p_command->>'id')::uuid,true);END IF;
  RETURN result;
 END IF;
 IF op IS NULL OR op NOT IN ('save_part','record_stock','reserve_part','consume_reserved_part','release_reserved_part','return_part','save_mechanic','save_commission_rule','create_absence','cancel_absence','create_service','set_service_status','refresh_service_authorization','record_commission_payment','cancel_commission') THEN RAISE EXCEPTION 'Operação indisponível.' USING ERRCODE='22023';END IF;
 IF NOT(r='owner' OR (r='reception' AND op IN ('record_stock','reserve_part','consume_reserved_part','release_reserved_part','return_part','create_absence','cancel_absence','create_service','set_service_status','refresh_service_authorization')) OR (r='finance' AND op IN ('save_part','save_commission_rule','record_commission_payment','cancel_commission')) OR (r='technician' AND op='set_service_status')) THEN RAISE EXCEPTION 'Este perfil não tem permissão para essa ação.' USING ERRCODE='42501';END IF;
 IF op='create_service' AND p_command?'commission' AND r<>'owner' THEN RAISE EXCEPTION 'Somente proprietário define exceção por serviço.' USING ERRCODE='42501';END IF;
 rid:=COALESCE(p_command->>'id',p_command#>>'{part,id}',p_command#>>'{mechanic,id}',p_command#>>'{rule,id}',p_command#>>'{absence,id}',p_command#>>'{service,id}')::uuid;
 IF rid IS NULL THEN RAISE EXCEPTION 'Identificador obrigatório.' USING ERRCODE='22023';END IF;
 IF op IN ('record_stock','reserve_part','consume_reserved_part','release_reserved_part','return_part','create_service','record_commission_payment') THEN
  SELECT document INTO old FROM public.box_records WHERE workspace_id=p_workspace AND id=rid;
  IF old IS NOT NULL THEN IF (op='create_service' AND old->>'requestKey'=(p_command-'commission')::text AND (r<>'owner' OR EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND kind='commission' AND parent_id=rid AND document->>'requestKey'=p_command::text))) OR (op<>'create_service' AND old->>'requestKey'=p_command::text) THEN RETURN jsonb_build_object('revision',rev,'duplicate',true);ELSE RAISE EXCEPTION 'Identificador já usado em outro lançamento.' USING ERRCODE='22023';END IF;END IF;
 END IF;
 IF op='save_part' THEN
  d:=p_command->'part';old:=public.box_ops_get(p_workspace,rid,'part');
  d:=jsonb_build_object('id',rid,'sku',upper(trim(d->>'sku')),'name',trim(d->>'name'),'unit',d->>'unit','location',d->>'location','minimum',d->'minimum','referenceCostCents',d->'referenceCostCents','createdAt',COALESCE(old->'createdAt',to_jsonb(now())));
  INSERT INTO public.box_records(workspace_id,id,kind,document) VALUES(p_workspace,rid,'part',d) ON CONFLICT(workspace_id,id) DO UPDATE SET document=EXCLUDED.document,updated_at=now();
 ELSIF op IN ('record_stock','reserve_part','consume_reserved_part','release_reserved_part','return_part') THEN
  IF NOT public.box_integer(p_command,'quantity',1,100000) THEN RAISE EXCEPTION 'Quantidade inteira positiva obrigatória.' USING ERRCODE='22023';END IF;qty:=(p_command->>'quantity')::bigint;
  IF op='record_stock' THEN
   pid:=(p_command->>'partId')::uuid;p:=public.box_ops_get(p_workspace,pid,'part');
   IF p IS NULL OR p_command->>'kind' NOT IN ('entrada','ajuste_entrada','ajuste_saida') OR NOT public.box_text(p_command,'reason',5,300) THEN RAISE EXCEPTION 'Movimento inválido.' USING ERRCODE='22023';END IF;
   IF p_command->>'kind'='ajuste_saida' THEN IF qty>public.box_ops_physical(p_workspace,pid)-public.box_ops_reserved(p_workspace,pid) THEN RAISE EXCEPTION 'Ajuste não pode consumir reservas nem deixar saldo negativo.' USING ERRCODE='22023';END IF;
   ELSIF public.box_ops_physical(p_workspace,pid)+qty>100000000 THEN RAISE EXCEPTION 'Saldo físico fora do limite.' USING ERRCODE='22023';END IF;
   d:=jsonb_build_object('id',rid,'partId',pid,'kind',p_command->>'kind','quantity',qty,'unitCostCents',p->'referenceCostCents','reason',p_command->>'reason');
  ELSIF op='reserve_part' THEN
   pid:=(p_command->>'partId')::uuid;oid:=(p_command->>'orderId')::uuid;p:=public.box_ops_get(p_workspace,pid,'part');o:=public.box_ops_get(p_workspace,oid,'order');
   SELECT document INTO q FROM public.box_records WHERE workspace_id=p_workspace AND parent_id=oid AND kind='quote' ORDER BY (document->>'version')::integer DESC LIMIT 1;
   IF p IS NULL OR o IS NULL OR o->>'status' IN ('entregue','cancelada') OR q->>'status' IS DISTINCT FROM 'aprovado' THEN RAISE EXCEPTION 'Reserva exige peça, OS aberta e orçamento atual aprovado.' USING ERRCODE='22023';END IF;
   SELECT COALESCE(sum((value->>'quantity')::bigint),0) INTO allowed FROM jsonb_array_elements(q->'items') WHERE value->>'kind'='peca' AND value->>'partId'=pid::text;
   IF qty>allowed-public.box_ops_consumed(p_workspace,pid,oid)-public.box_ops_reserved(p_workspace,pid,oid) OR qty>public.box_ops_physical(p_workspace,pid)-public.box_ops_reserved(p_workspace,pid) THEN RAISE EXCEPTION 'Quantidade autorizada ou estoque disponível insuficiente.' USING ERRCODE='22023';END IF;
   d:=jsonb_build_object('id',rid,'partId',pid,'kind','reserva','quantity',qty,'unitCostCents',0,'reason','Reserva da versão aprovada do orçamento.','orderId',oid,'quoteId',q->>'id');
  ELSIF op IN ('consume_reserved_part','release_reserved_part') THEN
   ref:=public.box_ops_get(p_workspace,(p_command->>'reservationId')::uuid,'stock_movement');
   IF ref->>'kind' IS DISTINCT FROM 'reserva' OR qty>public.box_ops_pending(p_workspace,(ref->>'id')::uuid) THEN RAISE EXCEPTION 'Reserva inválida ou quantidade maior que o saldo.' USING ERRCODE='22023';END IF;
   pid:=(ref->>'partId')::uuid;oid:=(ref->>'orderId')::uuid;cost:=0;
   IF op='consume_reserved_part' THEN
    o:=public.box_ops_get(p_workspace,oid,'order');SELECT document INTO q FROM public.box_records WHERE workspace_id=p_workspace AND parent_id=oid AND kind='quote' ORDER BY (document->>'version')::integer DESC LIMIT 1;
    IF o->>'status' IN ('entregue','cancelada') OR q->>'status' IS DISTINCT FROM 'aprovado' OR q->>'id' IS DISTINCT FROM ref->>'quoteId' OR qty>public.box_ops_physical(p_workspace,pid) THEN RAISE EXCEPTION 'Baixa exige OS aberta, reserva e autorização vigente.' USING ERRCODE='22023';END IF;
    p:=public.box_ops_get(p_workspace,pid,'part');cost:=(p->>'referenceCostCents')::bigint;
   ELSIF NOT public.box_text(p_command,'reason',5,300) THEN RAISE EXCEPTION 'Informe motivo da liberação.' USING ERRCODE='22023';END IF;
   d:=jsonb_build_object('id',rid,'partId',pid,'kind',CASE WHEN op='consume_reserved_part' THEN 'consumo' ELSE 'liberacao' END,'quantity',qty,'unitCostCents',cost,'reason',CASE WHEN op='consume_reserved_part' THEN 'Peça baixada na OS, sob autorização vigente.' ELSE p_command->>'reason' END,'orderId',oid,'quoteId',ref->>'quoteId','referenceId',ref->>'id');
  ELSE
   ref:=public.box_ops_get(p_workspace,(p_command->>'consumptionId')::uuid,'stock_movement');
   SELECT COALESCE(sum((document->>'quantity')::bigint),0) INTO allowed FROM public.box_records WHERE workspace_id=p_workspace AND kind='stock_movement' AND document->>'kind'='devolucao' AND document->>'referenceId'=ref->>'id';
   IF ref->>'kind' IS DISTINCT FROM 'consumo' OR qty>(ref->>'quantity')::bigint-allowed OR NOT public.box_text(p_command,'reason',5,300) THEN RAISE EXCEPTION 'Devolução ultrapassa a baixa original ou motivo inválido.' USING ERRCODE='22023';END IF;
   pid:=(ref->>'partId')::uuid;d:=jsonb_build_object('id',rid,'partId',pid,'kind','devolucao','quantity',qty,'unitCostCents',ref->'unitCostCents','reason',p_command->>'reason','orderId',ref->>'orderId','quoteId',ref->>'quoteId','referenceId',ref->>'id');
  END IF;
  d:=d||jsonb_build_object('createdAt',now(),'requestKey',p_command::text);INSERT INTO public.box_records(workspace_id,id,kind,parent_id,document) VALUES(p_workspace,rid,'stock_movement',pid,d);
 ELSIF op='save_mechanic' THEN
  d:=p_command->'mechanic';old:=public.box_ops_get(p_workspace,rid,'mechanic');
  IF old IS NOT NULL AND (old->>'name' IS DISTINCT FROM d->>'name' OR old->>'userId' IS DISTINCT FROM d->>'userId') THEN RAISE EXCEPTION 'Nome e conta são preservados no histórico.' USING ERRCODE='22023';END IF;
  IF d->>'active'='false' AND (EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND kind='service' AND document->>'mechanicId'=rid::text AND document->>'status' NOT IN ('concluido','cancelado')) OR EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND kind='appointment' AND assignee=d->>'name' AND document->>'status' IN ('solicitado','confirmado') AND (document->>'startsAt')::timestamptz+make_interval(mins=>(document->>'duration')::integer)>now())) THEN RAISE EXCEPTION 'Resolva alocações e agenda antes de inativar.' USING ERRCODE='22023';END IF;
  d:=jsonb_build_object('id',rid,'name',trim(d->>'name'),'active',d->'active','note',d->>'note','createdAt',COALESCE(old->'createdAt',to_jsonb(now())))||CASE WHEN d?'userId' THEN jsonb_build_object('userId',d->>'userId') ELSE '{}'::jsonb END;
  INSERT INTO public.box_records(workspace_id,id,kind,document) VALUES(p_workspace,rid,'mechanic',d) ON CONFLICT(workspace_id,id) DO UPDATE SET document=EXCLUDED.document,updated_at=now();
 ELSIF op='save_commission_rule' THEN
  d:=p_command->'rule';mid:=(d->>'mechanicId')::uuid;
  IF public.box_ops_get(p_workspace,mid,'mechanic') IS NULL OR NOT public.box_ops_policy(d) THEN RAISE EXCEPTION 'Mecânico ou regra inválida.' USING ERRCODE='22023';END IF;
  d:=jsonb_build_object('id',rid,'mechanicId',mid,'mode',d->>'mode','value',d->'value','createdAt',now());
  INSERT INTO public.box_records(workspace_id,id,kind,parent_id,document) VALUES(p_workspace,rid,'commission_rule',mid,d) ON CONFLICT(workspace_id,id) DO UPDATE SET document=EXCLUDED.document,updated_at=now();
 ELSIF op='create_absence' THEN
  d:=p_command->'absence';mid:=(d->>'mechanicId')::uuid;m:=public.box_ops_get(p_workspace,mid,'mechanic');st:=(d->>'startsAt')::timestamptz;en:=(d->>'endsAt')::timestamptz;
  IF st IS NULL OR en IS NULL OR en<=st OR en>st+interval '31 days' THEN RAISE EXCEPTION 'Intervalo de indisponibilidade inválido.' USING ERRCODE='22023';END IF;
  mins:=ceil(extract(epoch FROM en-st)/60)::integer;msg:=public.box_ops_conflict(p_workspace,m,st,mins);
  IF msg IS NOT NULL THEN RAISE EXCEPTION '%',msg USING ERRCODE='22023';END IF;
  IF st<=now() AND en>now() AND EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND kind='service' AND document->>'mechanicId'=mid::text AND document->>'status'='em_execucao') THEN RAISE EXCEPTION 'Pause ou conclua a execução antes de registrar ausência.' USING ERRCODE='22023';END IF;
  d:=jsonb_build_object('id',rid,'mechanicId',mid,'startsAt',d->>'startsAt','endsAt',d->>'endsAt','reason',d->>'reason','status','ativa','createdAt',now());INSERT INTO public.box_records(workspace_id,id,kind,parent_id,document) VALUES(p_workspace,rid,'absence',mid,d);
 ELSIF op='cancel_absence' THEN
  old:=public.box_ops_get(p_workspace,rid,'absence');IF old->>'status' IS DISTINCT FROM 'ativa' OR NOT public.box_text(p_command,'reason',5,300) THEN RAISE EXCEPTION 'Indisponibilidade inexistente, encerrada ou sem motivo.' USING ERRCODE='22023';END IF;
  UPDATE public.box_records SET document=old||jsonb_build_object('status','cancelada','cancellationReason',p_command->>'reason'),updated_at=now() WHERE workspace_id=p_workspace AND id=rid;
 ELSIF op='create_service' THEN
  d:=p_command->'service';oid:=(d->>'orderId')::uuid;mid:=(d->>'mechanicId')::uuid;o:=public.box_ops_get(p_workspace,oid,'order');m:=public.box_ops_get(p_workspace,mid,'mechanic');
  SELECT document INTO q FROM public.box_records WHERE workspace_id=p_workspace AND parent_id=oid AND kind='quote' ORDER BY (document->>'version')::integer DESC LIMIT 1;
  IF o IS NULL OR o->>'status' IN ('entregue','cancelada') OR q->>'status' IS DISTINCT FROM 'aprovado' OR q->>'id' IS DISTINCT FROM d->>'quoteId' OR NOT public.box_integer(d,'itemIndex',0,29) OR NOT public.box_integer(d,'duration',15,480) THEN RAISE EXCEPTION 'Serviço exige OS aberta e item da versão aprovada.' USING ERRCODE='22023';END IF;
  idx:=(d->>'itemIndex')::integer;item:=q->'items'->idx;key:=public.box_ops_key(oid,q,idx);
  IF item->>'kind' IS DISTINCT FROM 'servico' OR EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND kind='service' AND parent_id=oid AND document->>'serviceKey'=key AND document->>'status'<>'cancelado') THEN RAISE EXCEPTION 'Item inválido, já alocado ou concluído. Não duplique comissão.' USING ERRCODE='22023';END IF;
  st:=(d->>'plannedAt')::timestamptz;mins:=(d->>'duration')::integer;linked:=(d->>'appointmentId')::uuid;
  IF linked IS NOT NULL THEN
   ref:=public.box_ops_get(p_workspace,linked,'appointment');IF ref->>'status' IS DISTINCT FROM 'confirmado' OR ref->>'customerId' IS DISTINCT FROM o->>'customerId' OR ref->>'technician' IS DISTINCT FROM m->>'name' OR st<(ref->>'startsAt')::timestamptz OR st+make_interval(mins=>mins)>(ref->>'startsAt')::timestamptz+make_interval(mins=>(ref->>'duration')::integer) THEN RAISE EXCEPTION 'Agendamento vinculado não corresponde ao serviço.' USING ERRCODE='22023';END IF;
  END IF;
  msg:=public.box_ops_conflict(p_workspace,m,st,mins,NULL,linked);IF msg IS NOT NULL OR st IS NULL THEN RAISE EXCEPTION '%',COALESCE(msg,'Início previsto obrigatório.') USING ERRCODE='22023';END IF;
  IF p_command?'commission' THEN IF r<>'owner' THEN RAISE EXCEPTION 'Somente proprietário define exceção por serviço.' USING ERRCODE='42501';END IF;rule:=p_command->'commission';ELSE SELECT document INTO rule FROM public.box_records WHERE workspace_id=p_workspace AND kind='commission_rule' AND parent_id=mid;rule:=COALESCE(rule,'{"mode":"sem","value":0}'::jsonb);END IF;
  d:=jsonb_build_object('id',rid,'orderId',oid,'mechanicId',mid,'quoteId',q->>'id','itemIndex',idx,'serviceKey',key,'description',item->>'description','plannedAt',d->>'plannedAt','duration',mins,'status','planejado','createdAt',now(),'history',jsonb_build_array(jsonb_build_object('status','planejado','at',now(),'note','Item aprovado alocado ao mecânico.')),'requestKey',(p_command-'commission')::text)||CASE WHEN linked IS NOT NULL THEN jsonb_build_object('appointmentId',linked) ELSE '{}'::jsonb END;
  INSERT INTO public.box_records(workspace_id,id,kind,parent_id,assignee,document) VALUES(p_workspace,rid,'service',oid,m->>'name',d);PERFORM public.box_ops_commission(p_workspace,d,rule,p_command::text);
 ELSIF op='set_service_status' THEN
  t:=public.box_ops_get(p_workspace,rid,'service');mid:=(t->>'mechanicId')::uuid;m:=public.box_ops_get(p_workspace,mid,'mechanic');
  IF t IS NULL OR (r='technician' AND NOT public.box_ops_owns_mechanic(p_workspace,mid::text)) THEN RAISE EXCEPTION 'Serviço não disponível para este perfil.' USING ERRCODE='42501';END IF;
  key:=p_command->>'status';IF t->>'status' IN ('concluido','cancelado') OR key IS NULL OR key NOT IN ('em_execucao','pausado','concluido','cancelado') OR key=t->>'status' THEN RAISE EXCEPTION 'Serviço encerrado ou transição inválida.' USING ERRCODE='22023';END IF;
  d:=t;
  IF key IN ('em_execucao','concluido') THEN
   SELECT document INTO q FROM public.box_records WHERE workspace_id=p_workspace AND kind='quote' AND parent_id=(t->>'orderId')::uuid ORDER BY (document->>'version')::integer DESC LIMIT 1;
   IF q->>'status' IS DISTINCT FROM 'aprovado' OR q->>'id' IS DISTINCT FROM t->>'quoteId' THEN RAISE EXCEPTION 'Revise a autorização vigente antes de executar.' USING ERRCODE='22023';END IF;
  END IF;
  IF key='em_execucao' THEN
   o:=public.box_ops_get(p_workspace,(t->>'orderId')::uuid,'order');IF t->>'status' NOT IN ('planejado','pausado') OR o->>'status' IS DISTINCT FROM 'execucao' THEN RAISE EXCEPTION 'Avance a OS para execução antes de iniciar o serviço.' USING ERRCODE='22023';END IF;
   IF EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND kind='service' AND id<>rid AND document->>'mechanicId'=mid::text AND document->>'status'='em_execucao') THEN RAISE EXCEPTION 'Mecânico já executa outro serviço.' USING ERRCODE='22023';END IF;
   msg:=public.box_ops_conflict(p_workspace,m,now(),(t->>'duration')::integer,rid,(t->>'appointmentId')::uuid);IF msg IS NOT NULL THEN RAISE EXCEPTION '%',msg USING ERRCODE='22023';END IF;
   d:=d||jsonb_build_object('startedAt',COALESCE(t->'startedAt',to_jsonb(now())));
  ELSIF key='pausado' THEN IF t->>'status'<>'em_execucao' OR NOT public.box_text(p_command,'note',5,300) THEN RAISE EXCEPTION 'Pausa exige execução e motivo.' USING ERRCODE='22023';END IF;
  ELSIF key='concluido' THEN
   IF t->>'status'<>'em_execucao' THEN RAISE EXCEPTION 'Inicie ou retome antes de concluir.' USING ERRCODE='22023';END IF;
   d:=d||jsonb_build_object('completedAt',now());UPDATE public.box_records SET document=document||jsonb_build_object('status','gerada','earnedAt',now()),updated_at=now() WHERE workspace_id=p_workspace AND kind='commission' AND parent_id=rid AND document->>'status'='prevista';IF NOT FOUND THEN RAISE EXCEPTION 'Previsão de comissão não encontrada.' USING ERRCODE='22023';END IF;
  ELSE
   IF NOT public.box_text(p_command,'note',5,300) THEN RAISE EXCEPTION 'Cancelamento exige motivo.' USING ERRCODE='22023';END IF;
   UPDATE public.box_records SET document=document||jsonb_build_object('status','cancelada','cancellationReason',p_command->>'note'),updated_at=now() WHERE workspace_id=p_workspace AND kind='commission' AND parent_id=rid AND document->>'status'='prevista';
  END IF;
  d:=d||jsonb_build_object('status',key,'history',(t->'history')||jsonb_build_array(jsonb_build_object('status',key,'at',now(),'note',COALESCE(NULLIF(trim(p_command->>'note'),''),CASE WHEN key='concluido' THEN 'Conclusão registrada; comissão gerada sem efetuar repasse.' ELSE 'Execução iniciada pelo responsável.' END))));UPDATE public.box_records SET document=d,updated_at=now() WHERE workspace_id=p_workspace AND id=rid;
 ELSIF op='refresh_service_authorization' THEN
  t:=public.box_ops_get(p_workspace,rid,'service');IF t IS NULL OR t->>'status' IN ('concluido','cancelado') THEN RAISE EXCEPTION 'Serviço encerrado não revisa autorização.' USING ERRCODE='22023';END IF;
  oid:=(t->>'orderId')::uuid;SELECT document INTO q FROM public.box_records WHERE workspace_id=p_workspace AND kind='quote' AND parent_id=oid ORDER BY (document->>'version')::integer DESC LIMIT 1;
  IF q->>'status' IS DISTINCT FROM 'aprovado' OR q->>'id'=t->>'quoteId' THEN RAISE EXCEPTION 'É necessária uma nova versão aprovada.' USING ERRCODE='22023';END IF;
  SELECT ordinality::integer-1 INTO idx FROM jsonb_array_elements(q->'items') WITH ORDINALITY WHERE public.box_ops_key(oid,q,ordinality::integer-1)=t->>'serviceKey' AND value->>'kind'='servico';
  IF idx IS NULL THEN RAISE EXCEPTION 'Item removido. Cancele este serviço e aloque outro item aprovado.' USING ERRCODE='22023';END IF;
  SELECT document INTO rule FROM public.box_records WHERE workspace_id=p_workspace AND kind='commission' AND parent_id=rid AND document->>'status'='prevista';IF rule IS NULL THEN RAISE EXCEPTION 'Previsão anterior inexistente.' USING ERRCODE='22023';END IF;
  UPDATE public.box_records SET document=document||jsonb_build_object('status','cancelada','cancellationReason','Autorização substituída; base histórica preservada.'),updated_at=now() WHERE workspace_id=p_workspace AND kind='commission' AND parent_id=rid AND document->>'status'='prevista';
  d:=t||jsonb_build_object('quoteId',q->>'id','itemIndex',idx,'description',q->'items'->idx->>'description','status','pausado','history',(t->'history')||jsonb_build_array(jsonb_build_object('status','pausado','at',now(),'note','Vínculo revisado para a versão atual aprovada; depende de retomada.')));UPDATE public.box_records SET document=d,updated_at=now() WHERE workspace_id=p_workspace AND id=rid;PERFORM public.box_ops_commission(p_workspace,d,rule);
 ELSIF op='record_commission_payment' THEN
  pid:=(p_command->>'commissionId')::uuid;c:=public.box_ops_get(p_workspace,pid,'commission');
  IF c->>'status' IS DISTINCT FROM 'gerada' OR NOT public.box_integer(p_command,'amountCents',1,100000000) OR NOT public.box_text(p_command,'note',5,300) OR p_command->>'kind' NOT IN ('repasse','estorno') THEN RAISE EXCEPTION 'Repasse exige comissão gerada, valor positivo e motivo.' USING ERRCODE='22023';END IF;
  amount:=(p_command->>'amountCents')::bigint;paid:=public.box_ops_paid(p_workspace,pid);
  IF (p_command->>'kind'='repasse' AND amount>(c->>'amountCents')::bigint-paid) OR (p_command->>'kind'='estorno' AND amount>paid) THEN RAISE EXCEPTION 'Valor ultrapassa saldo de comissão ou repasse líquido.' USING ERRCODE='22023';END IF;
  d:=jsonb_build_object('id',rid,'commissionId',pid,'kind',p_command->>'kind','amountCents',amount,'note',p_command->>'note','createdAt',now(),'requestKey',p_command::text);INSERT INTO public.box_records(workspace_id,id,kind,parent_id,document) VALUES(p_workspace,rid,'commission_payment',pid,d);
 ELSIF op='cancel_commission' THEN
  c:=public.box_ops_get(p_workspace,rid,'commission');IF c->>'status' IS DISTINCT FROM 'gerada' OR public.box_ops_paid(p_workspace,rid)<>0 OR NOT public.box_text(p_command,'reason',5,300) THEN RAISE EXCEPTION 'Estorne repasses antes de cancelar uma comissão gerada, com motivo.' USING ERRCODE='22023';END IF;
  UPDATE public.box_records SET document=c||jsonb_build_object('status','cancelada','cancellationReason',p_command->>'reason'),updated_at=now() WHERE workspace_id=p_workspace AND id=rid;
 END IF;
 INSERT INTO public.box_audit(workspace_id,actor_id,actor_name,action,entity_id) VALUES(p_workspace,(SELECT auth.uid()),actor,op,rid);UPDATE public.box_workspaces SET revision=revision+1 WHERE id=p_workspace RETURNING revision INTO rev;RETURN jsonb_build_object('revision',rev,'success',true);
END $$;
-- Helpers são internos. Não permitir chamar o entrypoint antigo para contornar as novas regras.
DO $$ DECLARE f record;BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'box_ops_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);END LOOP;END $$;
GRANT EXECUTE ON FUNCTION public.box_ops_owns_mechanic(uuid,text),public.box_ops_owns_order(uuid,uuid),public.box_ops_service_authorized(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.box_command_v1(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.box_command(uuid,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.box_command(uuid,integer,jsonb) TO authenticated;
COMMIT;
