-- BOX 1.2: cadastros e rascunhos fiscais; outbox PRIVADA para conector futuro.
-- Aplicar apenas em homologação dedicada e autorizada. Não instala provedor/worker/certificado.
BEGIN;
CREATE TABLE public.box_fiscal_issuers (
 workspace_id uuid PRIMARY KEY REFERENCES public.box_workspaces(id), document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.box_fiscal_recipients (
 workspace_id uuid NOT NULL REFERENCES public.box_workspaces(id), id uuid NOT NULL, customer_id uuid NOT NULL,
 document jsonb NOT NULL CHECK(jsonb_typeof(document)='object'), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id), UNIQUE(workspace_id,customer_id), FOREIGN KEY(workspace_id,customer_id) REFERENCES public.box_records(workspace_id,id)
);
CREATE TABLE public.box_fiscal_documents (
 workspace_id uuid NOT NULL REFERENCES public.box_workspaces(id), id uuid NOT NULL, order_id uuid NOT NULL, quote_id uuid NOT NULL,
 model text NOT NULL CHECK(model IN ('nfe','nfse')), environment text NOT NULL CHECK(environment IN ('homologacao','producao')),
 status text NOT NULL CHECK(status IN ('rascunho','em_processamento','autorizada','rejeitada','resultado_incerto','cancelamento_pendente','cancelada','descartada')),
 document jsonb NOT NULL, request_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,id), FOREIGN KEY(workspace_id,order_id) REFERENCES public.box_records(workspace_id,id), FOREIGN KEY(workspace_id,quote_id) REFERENCES public.box_records(workspace_id,id),
 CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=100000),
 CHECK(COALESCE(document->>'id'=id::text AND document->>'orderId'=order_id::text AND document->>'quoteId'=quote_id::text AND document->>'model'=model AND document->>'environment'=environment AND document->>'status'=status,false))
);
CREATE UNIQUE INDEX box_fiscal_active_document ON public.box_fiscal_documents(workspace_id,order_id,quote_id,model) WHERE status NOT IN ('cancelada','descartada');
CREATE INDEX box_fiscal_document_recent ON public.box_fiscal_documents(workspace_id,created_at DESC);
ALTER TABLE public.box_fiscal_issuers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.box_fiscal_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.box_fiscal_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY box_fiscal_issuer_read ON public.box_fiscal_issuers FOR SELECT TO authenticated USING(public.box_role(workspace_id) IN ('owner','finance'));
CREATE POLICY box_fiscal_recipient_read ON public.box_fiscal_recipients FOR SELECT TO authenticated USING(public.box_role(workspace_id) IN ('owner','finance'));
CREATE POLICY box_fiscal_document_read ON public.box_fiscal_documents FOR SELECT TO authenticated USING(public.box_role(workspace_id) IN ('owner','finance'));
REVOKE ALL ON public.box_fiscal_issuers,public.box_fiscal_recipients,public.box_fiscal_documents FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.box_fiscal_issuers,public.box_fiscal_recipients,public.box_fiscal_documents TO authenticated;

CREATE FUNCTION public.box_fiscal_only_keys(d jsonb,allowed text[]) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT COALESCE(jsonb_typeof(d)='object' AND NOT EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE NOT k=ANY(allowed)),false)
$$;
CREATE FUNCTION public.box_fiscal_tax_id(v text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE size integer; i integer; total integer; remainder integer; weights integer[];
BEGIN
 IF v ~ '^([0-9])\1+$' THEN RETURN false;END IF;
 IF v ~ '^[0-9]{11}$' THEN
  FOR size IN 9..10 LOOP total:=0;FOR i IN 1..size LOOP total:=total+substring(v,i,1)::integer*(size+2-i);END LOOP;remainder:=(total*10)%11;IF remainder=10 THEN remainder:=0;END IF;IF substring(v,size+1,1)::integer<>remainder THEN RETURN false;END IF;END LOOP;RETURN true;
 END IF;
 IF v IS NULL OR v !~ '^[A-Z0-9]{12}[0-9]{2}$' THEN RETURN false;END IF;
 FOR size IN 12..13 LOOP weights:=CASE WHEN size=12 THEN ARRAY[5,4,3,2,9,8,7,6,5,4,3,2] ELSE ARRAY[6,5,4,3,2,9,8,7,6,5,4,3,2] END;total:=0;FOR i IN 1..size LOOP total:=total+(ascii(substring(v,i,1))-48)*weights[i];END LOOP;remainder:=total%11;remainder:=CASE WHEN remainder<2 THEN 0 ELSE 11-remainder END;IF substring(v,size+1,1)::integer<>remainder THEN RETURN false;END IF;END LOOP;RETURN true;
END $$;
CREATE FUNCTION public.box_fiscal_party_valid(d jsonb,issuer boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE a jsonb:=d->'address'; k text; valid boolean;
BEGIN
 IF NOT public.box_fiscal_only_keys(d,ARRAY['legalName','taxId','email','stateRegistration','municipalRegistration','address']||CASE WHEN issuer THEN ARRAY['taxRegime'] ELSE ARRAY[]::text[] END) OR NOT public.box_fiscal_only_keys(a,ARRAY['street','number','complement','district','city','state','cityCode','zip']) THEN RETURN false;END IF;
 valid:=public.box_text(d,'legalName',0,120) AND public.box_text(d,'taxId',0,14) AND public.box_text(d,'email',0,254) AND public.box_text(d,'stateRegistration',0,30) AND public.box_text(d,'municipalRegistration',0,30);
 valid:=valid AND (d->>'taxId'='' OR public.box_fiscal_tax_id(d->>'taxId')) AND (NOT issuer OR d->>'taxId'='' OR length(d->>'taxId')=14) AND (d->>'email'='' OR d->>'email' ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
 valid:=valid AND public.box_text(a,'street',0,120) AND public.box_text(a,'number',0,20) AND public.box_text(a,'complement',0,80) AND public.box_text(a,'district',0,80) AND public.box_text(a,'city',0,100) AND public.box_text(a,'state',0,2) AND public.box_text(a,'cityCode',0,7) AND public.box_text(a,'zip',0,8);
 valid:=valid AND (a->>'state'='' OR a->>'state'=ANY(ARRAY['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'])) AND (a->>'cityCode'='' OR a->>'cityCode' ~ '^[0-9]{7}$') AND (a->>'zip'='' OR a->>'zip' ~ '^[0-9]{8}$');
 RETURN COALESCE(valid AND (NOT issuer OR d->>'taxRegime' IN ('nao_definido','simples_nacional','simples_excesso','regime_normal')),false);
END $$;
CREATE FUNCTION public.box_fiscal_empty_party() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT '{"legalName":"","taxId":"","email":"","stateRegistration":"","municipalRegistration":"","address":{"street":"","number":"","complement":"","district":"","city":"","state":"","cityCode":"","zip":""}}'::jsonb $$;
CREATE FUNCTION public.box_fiscal_classification(idx integer) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT jsonb_build_object('sourceIndex',idx,'ncm','','cfop','','cstOrCsosn','','origin','','serviceCode','','municipalServiceCode','','taxationCode','') $$;
CREATE FUNCTION public.box_fiscal_class_valid(c jsonb,m text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE valid boolean;
BEGIN
 IF NOT public.box_fiscal_only_keys(c,ARRAY['sourceIndex','ncm','cfop','cstOrCsosn','origin','serviceCode','municipalServiceCode','taxationCode']) THEN RETURN false;END IF;
 valid:=public.box_integer(c,'sourceIndex',0,29) AND public.box_text(c,'ncm',0,8) AND public.box_text(c,'cfop',0,4) AND public.box_text(c,'cstOrCsosn',0,3) AND public.box_text(c,'origin',0,1) AND public.box_text(c,'serviceCode',0,30) AND public.box_text(c,'municipalServiceCode',0,30) AND public.box_text(c,'taxationCode',0,30);
 valid:=valid AND (c->>'ncm'='' OR c->>'ncm' ~ '^[0-9]{8}$') AND (c->>'cfop'='' OR c->>'cfop' ~ '^[0-9]{4}$') AND (c->>'cstOrCsosn'='' OR c->>'cstOrCsosn' ~ '^[0-9]{2,3}$') AND (c->>'origin'='' OR c->>'origin' ~ '^[0-8]$');
 RETURN COALESCE(valid AND CASE m WHEN 'nfe' THEN c->>'serviceCode'='' AND c->>'municipalServiceCode'='' AND c->>'taxationCode'='' WHEN 'nfse' THEN c->>'ncm'='' AND c->>'cfop'='' AND c->>'cstOrCsosn'='' AND c->>'origin'='' ELSE false END,false);
END $$;
CREATE OR REPLACE FUNCTION public.box_read_workspace(p_workspace uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb; key text; category text;
BEGIN
 IF public.box_role(p_workspace) IS NULL THEN RAISE EXCEPTION 'Acesso não autorizado' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('revision',revision,'settings',settings) INTO result FROM public.box_workspaces WHERE id=p_workspace;
 FOR key,category IN SELECT * FROM (VALUES ('customers','customer'),('vehicles','vehicle'),('orders','order'),('quotes','quote'),('appointments','appointment'),('payments','payment'),('costs','cost'),('leads','lead'),('posts','post'),('parts','part'),('stockMovements','stock_movement'),('mechanics','mechanic'),('commissionRules','commission_rule'),('absences','absence'),('services','service'),('commissions','commission'),('commissionPayments','commission_payment')) v(a,b) LOOP
  result:=result||jsonb_build_object(key,COALESCE((SELECT jsonb_agg(CASE WHEN category='service' THEN document||jsonb_build_object('authorizationCurrent',public.box_ops_service_authorized(p_workspace,document)) ELSE document END ORDER BY created_at DESC,id) FROM public.box_records WHERE workspace_id=p_workspace AND kind=category),'[]'::jsonb));
 END LOOP;
 result:=result||jsonb_build_object('audit',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'action',a.action,'actor',a.actor_name,'entityId',a.entity_id,'at',a.created_at)) FROM (SELECT * FROM public.box_audit WHERE workspace_id=p_workspace ORDER BY created_at DESC LIMIT 250) a),'[]'::jsonb));
 RETURN result||jsonb_build_object('schemaVersion',4,'fiscalIssuer',(SELECT document FROM public.box_fiscal_issuers WHERE workspace_id=p_workspace),'fiscalRecipients',COALESCE((SELECT jsonb_agg(document ORDER BY updated_at DESC,id) FROM public.box_fiscal_recipients WHERE workspace_id=p_workspace),'[]'::jsonb),'fiscalDocuments',COALESCE((SELECT jsonb_agg(document ORDER BY created_at DESC,id) FROM public.box_fiscal_documents WHERE workspace_id=p_workspace),'[]'::jsonb));
END $$;
ALTER FUNCTION public.box_command(uuid,integer,jsonb) RENAME TO box_command_v11;
REVOKE ALL ON FUNCTION public.box_command_v11(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION public.box_command(p_workspace uuid,p_expected_revision integer,p_command jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op text:=p_command->>'type';r text;actor text;rev integer;rid uuid;cid uuid;oid uuid;qid uuid;d jsonb;old jsonb;o jsonb;q jsonb;issuer jsonb;recipient jsonb;line jsonb;item jsonb;classes jsonb;items jsonb:='[]'::jsonb;idx integer;m text;net bigint;amount bigint:=0;event jsonb;allowed text[];existing_key text;
BEGIN
 IF op IS NULL OR op NOT IN ('save_fiscal_issuer','save_fiscal_recipient','prepare_fiscal_document','classify_fiscal_document','discard_fiscal_document','simulate_fiscal_result','reconcile_fiscal_demo','cancel_fiscal_demo') THEN RETURN public.box_command_v11(p_workspace,p_expected_revision,p_command);END IF;
 r:=public.box_role(p_workspace);actor:=public.box_name(p_workspace);
 IF r IS NULL OR r NOT IN ('owner','finance') OR (op='save_fiscal_issuer' AND r<>'owner') THEN RAISE EXCEPTION 'Perfil não autorizado' USING ERRCODE='42501';END IF;
 IF op IN ('simulate_fiscal_result','reconcile_fiscal_demo','cancel_fiscal_demo') THEN RAISE EXCEPTION 'Simulações fiscais não são permitidas no banco conectado' USING ERRCODE='42501';END IF;
 IF p_command IS NULL OR jsonb_typeof(p_command)<>'object' OR octet_length(p_command::text)>40000 THEN RAISE EXCEPTION 'Comando inválido' USING ERRCODE='22023';END IF;
 allowed:=CASE op WHEN 'save_fiscal_issuer' THEN ARRAY['type','issuer'] WHEN 'save_fiscal_recipient' THEN ARRAY['type','recipient'] WHEN 'prepare_fiscal_document' THEN ARRAY['type','id','orderId','model'] WHEN 'classify_fiscal_document' THEN ARRAY['type','id','classifications'] ELSE ARRAY['type','id','reason'] END;
 IF NOT public.box_fiscal_only_keys(p_command,allowed) THEN RAISE EXCEPTION 'Campos não permitidos' USING ERRCODE='22023';END IF;
 SELECT revision INTO rev FROM public.box_workspaces WHERE id=p_workspace FOR UPDATE;
 IF p_expected_revision IS DISTINCT FROM rev THEN RAISE EXCEPTION 'Revisão desatualizada' USING ERRCODE='40001';END IF;
 IF op='save_fiscal_issuer' THEN
  d:=p_command->'issuer';IF NOT public.box_fiscal_party_valid(d,true) THEN RAISE EXCEPTION 'Emitente inválido' USING ERRCODE='22023';END IF;
  INSERT INTO public.box_fiscal_issuers(workspace_id,document) VALUES(p_workspace,d) ON CONFLICT(workspace_id) DO UPDATE SET document=EXCLUDED.document,updated_at=now();
 ELSIF op='save_fiscal_recipient' THEN
  d:=p_command->'recipient';rid:=(d->>'id')::uuid;cid:=(d->>'customerId')::uuid;
  IF rid IS NULL OR cid IS NULL OR NOT public.box_fiscal_only_keys(d,ARRAY['id','customerId','party']) OR NOT public.box_fiscal_party_valid(d->'party') OR NOT EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=p_workspace AND id=cid AND kind='customer') THEN RAISE EXCEPTION 'Destinatário inválido' USING ERRCODE='22023';END IF;
  IF EXISTS(SELECT 1 FROM public.box_fiscal_recipients WHERE workspace_id=p_workspace AND id=rid AND customer_id<>cid) THEN RAISE EXCEPTION 'Vínculo não pode ser reescrito' USING ERRCODE='22023';END IF;
  INSERT INTO public.box_fiscal_recipients(workspace_id,id,customer_id,document) VALUES(p_workspace,rid,cid,d) ON CONFLICT(workspace_id,id) DO UPDATE SET document=EXCLUDED.document,updated_at=now();
 ELSIF op='prepare_fiscal_document' THEN
  rid:=(p_command->>'id')::uuid;oid:=(p_command->>'orderId')::uuid;m:=p_command->>'model';
  IF rid IS NULL OR oid IS NULL OR m IS NULL OR m NOT IN ('nfe','nfse') THEN RAISE EXCEPTION 'Modelo/identificador inválido' USING ERRCODE='22023';END IF;
  SELECT request_key INTO existing_key FROM public.box_fiscal_documents WHERE workspace_id=p_workspace AND id=rid;
  IF FOUND THEN IF existing_key<>p_command::text THEN RAISE EXCEPTION 'Identificador já utilizado' USING ERRCODE='22023';END IF;RETURN jsonb_build_object('revision',rev,'success',true,'duplicate',true);END IF;
  SELECT document INTO o FROM public.box_records WHERE workspace_id=p_workspace AND id=oid AND kind='order';
  SELECT document,id INTO q,qid FROM public.box_records WHERE workspace_id=p_workspace AND parent_id=oid AND kind='quote' ORDER BY (document->>'version')::integer DESC LIMIT 1;
  IF o IS NULL OR o->>'status'='cancelada' OR q->>'status' IS DISTINCT FROM 'aprovado' THEN RAISE EXCEPTION 'Exige OS não cancelada e orçamento atual aprovado' USING ERRCODE='22023';END IF;
  SELECT document INTO issuer FROM public.box_fiscal_issuers WHERE workspace_id=p_workspace;
  SELECT document->'party' INTO recipient FROM public.box_fiscal_recipients WHERE workspace_id=p_workspace AND customer_id=(o->>'customerId')::uuid;
  issuer:=COALESCE(issuer,public.box_fiscal_empty_party()||'{"taxRegime":"nao_definido"}'::jsonb);recipient:=COALESCE(recipient,public.box_fiscal_empty_party()||jsonb_build_object('legalName',o->>'customerName'));
  FOR item,idx IN SELECT value,ordinality::integer-1 FROM jsonb_array_elements(q->'items') WITH ORDINALITY LOOP
   IF item->>'kind'=(CASE m WHEN 'nfe' THEN 'peca' ELSE 'servico' END) THEN net:=public.box_ops_net_item(q,idx);amount:=amount+net;line:=jsonb_build_object('sourceIndex',idx,'description',item->>'description','kind',item->>'kind','quantity',(item->>'quantity')::integer,'unitCents',(item->>'unitCents')::bigint,'discountCents',(item->>'quantity')::bigint*(item->>'unitCents')::bigint-net,'totalCents',net,'classification',public.box_fiscal_classification(idx));items:=items||jsonb_build_array(line);END IF;
  END LOOP;
  IF jsonb_array_length(items)=0 OR amount<=0 THEN RAISE EXCEPTION 'Sem itens com valor positivo para esse modelo' USING ERRCODE='22023';END IF;
  event:=jsonb_build_object('id',gen_random_uuid(),'at',now(),'action','preparado','message','Rascunho preparado da versão aprovada. Não transmitido; sem validade fiscal.');
  d:=jsonb_build_object('id',rid,'orderId',oid,'orderNumber',o->>'number','customerId',o->>'customerId','quoteId',qid,'quoteVersion',(q->>'version')::integer,'model',m,'environment','homologacao','status','rascunho','issuer',issuer,'recipient',recipient,'items',items,'totalCents',amount,'createdAt',now(),'updatedAt',now(),'events',jsonb_build_array(event));
  INSERT INTO public.box_fiscal_documents(workspace_id,id,order_id,quote_id,model,environment,status,document,request_key) VALUES(p_workspace,rid,oid,qid,m,'homologacao','rascunho',d,p_command::text);
 ELSE
  rid:=(p_command->>'id')::uuid;SELECT document INTO old FROM public.box_fiscal_documents WHERE workspace_id=p_workspace AND id=rid FOR UPDATE;
  IF old IS NULL OR old->>'status' NOT IN ('rascunho','rejeitada') OR jsonb_array_length(old->'events')>=100 THEN RAISE EXCEPTION 'Rascunho indisponível para alteração' USING ERRCODE='22023';END IF;
  IF op='classify_fiscal_document' THEN
   classes:=p_command->'classifications';IF jsonb_typeof(classes) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Classificações inválidas' USING ERRCODE='22023';END IF;
   IF jsonb_array_length(classes)<>jsonb_array_length(old->'items') OR jsonb_array_length(classes) NOT BETWEEN 1 AND 30 OR (SELECT count(DISTINCT value->>'sourceIndex') FROM jsonb_array_elements(classes))<>jsonb_array_length(classes) THEN RAISE EXCEPTION 'Itens/classificações divergentes' USING ERRCODE='22023';END IF;
   FOR item IN SELECT value FROM jsonb_array_elements(old->'items') LOOP
    SELECT value INTO line FROM jsonb_array_elements(classes) WHERE value->'sourceIndex'=item->'sourceIndex';IF line IS NULL OR NOT public.box_fiscal_class_valid(line,old->>'model') THEN RAISE EXCEPTION 'Classificação fiscal inválida' USING ERRCODE='22023';END IF;items:=items||jsonb_build_array(item||jsonb_build_object('classification',line));
   END LOOP;
   d:=old||jsonb_build_object('items',items);event:=jsonb_build_object('id',gen_random_uuid(),'at',now(),'action','classificado','message','Classificações informadas; sem cálculo nem validação tributária.');
  ELSE
   IF NOT public.box_text(p_command,'reason',5,255) THEN RAISE EXCEPTION 'Motivo obrigatório' USING ERRCODE='22023';END IF;d:=old||'{"status":"descartada"}'::jsonb;event:=jsonb_build_object('id',gen_random_uuid(),'at',now(),'action','descartado','message',p_command->>'reason');
  END IF;
  d:=d||jsonb_build_object('updatedAt',now(),'events',(old->'events')||jsonb_build_array(event));UPDATE public.box_fiscal_documents SET status=d->>'status',document=d,updated_at=now() WHERE workspace_id=p_workspace AND id=rid;
 END IF;
 INSERT INTO public.box_audit(workspace_id,actor_id,actor_name,action,entity_id) VALUES(p_workspace,(SELECT auth.uid()),actor,op,rid);
 UPDATE public.box_workspaces SET revision=revision+1 WHERE id=p_workspace RETURNING revision INTO rev;RETURN jsonb_build_object('revision',rev,'success',true);
END $$;
REVOKE ALL ON FUNCTION public.box_command(uuid,integer,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.box_command(uuid,integer,jsonb) TO authenticated;

-- Outbox privada. Não há produtor/worker/credencial de emissão ativos nesta entrega.
-- Apenas a administração do banco pode executar estes contratos até provisionar um worker dedicado.
CREATE TABLE public.box_fiscal_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,document_id uuid NOT NULL,
 action text NOT NULL CHECK(action IN ('submit','cancel')),idempotency_key text NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','inflight','pending','unknown','succeeded','rejected')),
 consult_required boolean NOT NULL DEFAULT false, attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),
 provider_reference text,reason text,lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz NOT NULL DEFAULT now(),
 outcome jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,document_id) REFERENCES public.box_fiscal_documents(workspace_id,id),UNIQUE(workspace_id,document_id,action)
);
ALTER TABLE public.box_fiscal_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.box_fiscal_jobs FROM PUBLIC,anon,authenticated;
CREATE INDEX box_fiscal_jobs_pending ON public.box_fiscal_jobs(next_attempt_at) WHERE state IN ('queued','pending','unknown','inflight');
CREATE FUNCTION public.box_fiscal_claim_jobs(p_limit integer DEFAULT 10) RETURNS SETOF public.box_fiscal_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Limite inválido' USING ERRCODE='22023';END IF;
 RETURN QUERY WITH candidates AS (SELECT id FROM public.box_fiscal_jobs WHERE (state IN ('queued','pending','unknown') OR (state='inflight' AND lease_until<now())) AND next_attempt_at<=now() ORDER BY next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT p_limit)
 UPDATE public.box_fiscal_jobs j SET consult_required=j.consult_required OR j.state<>'queued' OR j.attempts>0,state='inflight',attempts=j.attempts+1,lease_token=gen_random_uuid(),lease_until=now()+interval '2 minutes',updated_at=now() FROM candidates c WHERE j.id=c.id RETURNING j.*;
END $$;
CREATE FUNCTION public.box_fiscal_complete_job(p_id uuid,p_lease_token uuid,p_outcome jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE j public.box_fiscal_jobs;w uuid;d jsonb;st text;event jsonb;outcome_status text:=p_outcome->>'status';
BEGIN
 -- Mesma ordem de locks do app: workspace antes do documento. Lease/token são reavaliados após esperar.
 SELECT workspace_id INTO w FROM public.box_fiscal_jobs WHERE id=p_id;IF NOT FOUND THEN RETURN false;END IF;
 PERFORM 1 FROM public.box_workspaces WHERE id=w FOR UPDATE;
 SELECT * INTO j FROM public.box_fiscal_jobs WHERE id=p_id AND state='inflight' AND lease_token=p_lease_token AND lease_until>=now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false;END IF;
 IF outcome_status IS NULL OR outcome_status NOT IN ('pending','unknown','authorized','rejected','canceled') OR octet_length(p_outcome::text)>4000 OR NOT public.box_fiscal_only_keys(p_outcome,ARRAY['status','providerReference','number','protocol','accessKey','code']) THEN RAISE EXCEPTION 'Resultado inválido' USING ERRCODE='22023';END IF;
 IF (outcome_status='authorized' AND (j.action<>'submit' OR NOT public.box_text(p_outcome,'number',1,40) OR NOT public.box_text(p_outcome,'protocol',1,120) OR NOT public.box_text(p_outcome,'providerReference',1,120))) OR (outcome_status='canceled' AND (j.action<>'cancel' OR NOT public.box_text(p_outcome,'protocol',1,120) OR NOT public.box_text(p_outcome,'providerReference',1,120))) THEN RAISE EXCEPTION 'Falta evidência mínima' USING ERRCODE='22023';END IF;
 SELECT document INTO d FROM public.box_fiscal_documents WHERE workspace_id=j.workspace_id AND id=j.document_id FOR UPDATE;
 IF (outcome_status='pending' AND NOT public.box_text(p_outcome,'providerReference',1,120)) OR (outcome_status='rejected' AND NOT public.box_text(p_outcome,'code',1,80)) OR (outcome_status='authorized' AND d->>'model'='nfe' AND COALESCE(p_outcome->>'accessKey','') !~ '^[0-9]{44}$') THEN RAISE EXCEPTION 'Resultado sem referência ou chave mínima' USING ERRCODE='22023';END IF;
 st:=CASE outcome_status WHEN 'authorized' THEN 'autorizada' WHEN 'canceled' THEN 'cancelada' WHEN 'rejected' THEN CASE j.action WHEN 'cancel' THEN 'autorizada' ELSE 'rejeitada' END WHEN 'pending' THEN CASE j.action WHEN 'cancel' THEN 'cancelamento_pendente' ELSE 'em_processamento' END ELSE 'resultado_incerto' END;
 event:=jsonb_build_object('id',gen_random_uuid(),'at',now(),'action','provider_'||outcome_status,'message','Resultado do conector: '||outcome_status||'. Artefatos e regras dependem da homologação do provedor.');
 d:=d||jsonb_build_object('status',st,'updatedAt',now(),'events',CASE WHEN d->>'status'=st THEN d->'events' ELSE (d->'events')||jsonb_build_array(event) END);
 UPDATE public.box_fiscal_documents SET status=st,document=d,updated_at=now() WHERE workspace_id=j.workspace_id AND id=j.document_id;
 UPDATE public.box_fiscal_jobs SET state=CASE outcome_status WHEN 'authorized' THEN 'succeeded' WHEN 'canceled' THEN 'succeeded' WHEN 'rejected' THEN 'rejected' WHEN 'pending' THEN 'pending' ELSE 'unknown' END,consult_required=true,outcome=p_outcome,provider_reference=COALESCE(p_outcome->>'providerReference',provider_reference),lease_token=NULL,lease_until=NULL,next_attempt_at=now()+interval '1 minute',updated_at=now() WHERE id=p_id;
 UPDATE public.box_workspaces SET revision=revision+1 WHERE id=j.workspace_id;RETURN true;
END $$;
-- Helpers privados, inclusive claim/complete: não expor por RPC ao navegador.
DO $$ DECLARE f record;BEGIN FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'box_fiscal_%' LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature);END LOOP;END $$;
COMMIT;
