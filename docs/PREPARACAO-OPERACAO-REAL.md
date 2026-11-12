# Preparação para operação real — evolução 1.2.0

## Decisão confirmada pelo usuário

Preparar o sistema existente para futura operação real, mantendo o portfólio independente e sem ativar integrações ou serviços. Preparar **NF-e para peças e NFS-e para serviços**, com integração fiscal **substituível, sem provedor escolhido**. Nenhum município, CNPJ, regime tributário, certificado ou dado comercial foi confirmado.

## Entrega desta etapa

1. Módulo fiscal ligado à OS e à versão aprovada do orçamento, com separação de peças/serviços e rateio exato de desconto em centavos.
2. Cadastros de emitente/destinatário e classificações por item sem códigos/alíquotas tributárias inventados. Snapshots e eventos preservados.
3. Demonstração explícita de autorização, rejeição, resultado incerto, consulta e cancelamento. Nenhuma simulação recebe chave/protocolo real, gera XML oficial ou se confunde com emissão.
4. Persistência conectada de cadastros/rascunhos via migração local, com MFA, autorização no SQL, RLS, revisão e proteção contra duplicidade. Simulações proibidas no servidor e no SQL.
5. Contrato de provedor e processamento fiscal assíncrono substituíveis, com idempotência e tratamento de resultado incerto. Sem implementação de provedor real ou credenciais.
6. Painel de preparação, validação de configuração sem revelar valores secretos, pré-verificação por linha de comando e roteiro de implantação/homologação/retorno.
7. Testes automatizados, build, pacote portátil e evidências identificadas da versão. Preservar a home 1.1.1 e todos os ZIPs anteriores.

## Não é uma liberação de produção

A conclusão do código desta etapa **não** comprova que o sistema inteiro está homologado, que todos os 46 itens do plano estão concluídos ou que basta mudar uma variável para emitir notas. Sem um provedor escolhido não existe conector real para emissão/consulta/cancelamento/artefatos/webhooks. Ele será implementado e homologado contra a especificação vigente do destino; o contrato entregue delimita essa ligação.

Continuam exigindo responsáveis e evidências: infraestrutura dedicada, Auth/MFA/SMTP reais, provisionamento individual, RLS via PostgREST, backup/restauração independente, concorrência multiconexão/carga, monitoramento, LGPD/termos/dados comerciais, configuração contábil, município/UF e regime, certificado/credenciais em cofre, conector fiscal, fila/worker operacionais, homologação e autorização expressa para produção. Redes, mensagens, pagamentos reais e captação pública não são implementados por esta preparação.

## Segurança e mudanças externas

- Nenhum banco/hospedagem remoto, plano, projeto de terceiro, repositório remoto ou integração real será alterado nesta etapa.
- Nenhuma senha, token ou certificado deve ser enviado pelo chat ou incluído no pacote.
- O site publicado permanece na versão 1.1.1 até uma publicação nova autorizada e verificada.
- A versão 1.2.0 será entregue como fonte/pacote e prévia local. A sessão da demo será ampliada sem apagar o histórico anterior.
- Não reaproveitar banco de outro negócio. Não trocar o projeto AGROTECH. Manter os registros históricos de publicação.

Os resultados efetivamente executados e limitações finais estão registrados em `VALIDACAO-1.2.md`.

## Encerramento desta etapa

Fonte 1.2.0 validado localmente: 347 testes e 122 cenários de navegador aprovados, builds portfólio/conectado e instalação limpa executados. O modo conectado sem configuração e os modos divergentes falharam fechados. Ver os resultados completos e pendências em `VALIDACAO-1.2.md`. Nenhuma publicação ou operação externa foi realizada.
