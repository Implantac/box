-- Defesa adicional no banco. A API também valida, mas não é a única barreira.
BEGIN;
CREATE UNIQUE INDEX box_staff_display_name_unique ON public.box_members(workspace_id,display_name) WHERE role IN ('owner','reception','technician');
CREATE FUNCTION public.box_text(d jsonb,k text,lo integer,hi integer) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT COALESCE(jsonb_typeof(d->k)='string' AND length(trim(d->>k))>=lo AND length(d->>k)<=hi,false)
$$;
CREATE FUNCTION public.box_integer(d jsonb,k text,lo bigint,hi bigint) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE v numeric;
BEGIN IF jsonb_typeof(d->k) IS DISTINCT FROM 'number' THEN RETURN false;END IF;v:=(d->>k)::numeric;RETURN v>=lo AND v<=hi AND trunc(v)=v;END $$;
CREATE FUNCTION public.box_valid_record() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
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
  valid:=valid AND related.id IS NOT NULL AND EXISTS(SELECT 1 FROM public.box_members WHERE workspace_id=NEW.workspace_id AND display_name=NEW.assignee AND role IN ('owner','reception','technician'));
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
  valid:=NEW.parent_id IS NULL AND d->>'customerId'=NEW.customer_id::text AND public.box_text(d,'customerName',3,120) AND public.box_text(d,'vehicleLabel',1,160) AND public.box_text(d,'service',3,200) AND public.box_text(d,'startsAt',10,60) AND public.box_integer(d,'duration',15,480) AND public.box_text(d,'technician',2,120) AND NEW.assignee=d->>'technician' AND d->>'status' IN ('solicitado','confirmado','concluido','cancelado','faltou') AND EXISTS(SELECT 1 FROM public.box_members WHERE workspace_id=NEW.workspace_id AND display_name=NEW.assignee AND role IN ('owner','reception','technician'));
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
CREATE TRIGGER box_record_integrity BEFORE INSERT OR UPDATE ON public.box_records FOR EACH ROW EXECUTE FUNCTION public.box_valid_record();
CREATE FUNCTION public.box_valid_member() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.role='customer' THEN
  IF NOT EXISTS(SELECT 1 FROM public.box_records WHERE workspace_id=NEW.workspace_id AND id=NEW.customer_id AND kind='customer') THEN RAISE EXCEPTION 'Vínculo de conta com cliente inválido' USING ERRCODE='22023';END IF;
 ELSIF NEW.customer_id IS NOT NULL THEN RAISE EXCEPTION 'Somente conta de cliente recebe esse vínculo' USING ERRCODE='22023';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER box_member_integrity BEFORE INSERT OR UPDATE ON public.box_members FOR EACH ROW EXECUTE FUNCTION public.box_valid_member();
CREATE FUNCTION public.box_valid_settings() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NOT (public.box_text(NEW.settings,'brandName',3,80) AND public.box_text(NEW.settings,'heroTitle',10,120) AND public.box_text(NEW.settings,'heroSubtitle',10,350) AND public.box_text(NEW.settings,'location',0,80)) THEN RAISE EXCEPTION 'Conteúdo institucional inválido' USING ERRCODE='22023';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER box_settings_integrity BEFORE INSERT OR UPDATE OF settings ON public.box_workspaces FOR EACH ROW EXECUTE FUNCTION public.box_valid_settings();
-- Só estes quatro campos são públicos. Não concede SELECT anônimo nas tabelas.
CREATE FUNCTION public.box_public_settings(p_workspace uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('brandName',settings->>'brandName','heroTitle',settings->>'heroTitle','heroSubtitle',settings->>'heroSubtitle','location',settings->>'location') FROM public.box_workspaces WHERE id=p_workspace
$$;
REVOKE ALL ON FUNCTION public.box_text(jsonb,text,integer,integer),public.box_integer(jsonb,text,bigint,bigint),public.box_valid_record(),public.box_valid_member(),public.box_valid_settings(),public.box_public_settings(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.box_public_settings(uuid) TO anon,authenticated;
COMMIT;
