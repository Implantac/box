import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base=process.env.BOX_TEST_URL;
const expectedVersion=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
if(!base||!base.startsWith('https://'))throw new Error('Defina BOX_TEST_URL com a URL HTTPS real do deployment.');
const browser=await chromium.launch({headless:true});const context=await browser.newContext();
const report={checkedAt:new Date().toISOString(),url:base,expectedVersion,anonymous:true,checks:[],browserErrors:[],publicPortfolioVerified:false};
try{
 const health=await context.request.get(base+'/api/health',{maxRedirects:0});
 const location=health.headers().location;let cleanLocation;
 if(location){const u=new URL(location,base);u.search='';u.hash='';cleanLocation=u.href;}
 report.checks.push({path:'/api/health',status:health.status(),redirect:cleanLocation});
 if(health.status()!==200){report.blockedBeforeApplication=true;report.note='Não foi tentado contornar autenticação, obter token de bypass ou desativar proteção por caminhos não expostos.';}
 else{
  const json=await health.json();report.health=json;
  if(json.version!==expectedVersion)throw new Error('A versão pública não corresponde à fonte local. Não anunciar módulos novos como implantados.');
  if(json.mode!=='portfolio'||json.databaseConnection!=='not-used'||json.socialPublishing!=='disabled'||(expectedVersion==='1.2.0'&&(json.fiscalIssuance!=='disabled'||json.productionApproved!==false)))throw new Error('A resposta de saúde não corresponde ao modo de portfólio esperado.');
  const page=await context.newPage();page.on('pageerror',e=>report.browserErrors.push(e.message));
  for(const path of ['/','/cambio-automatico','/painel','/painel/ordens','/painel/conteudo','/painel/estoque','/painel/mecanicos','/painel/comissoes','/painel/fiscal','/painel/ativacao','/cliente']){
   const r=await page.goto(base+path,{waitUntil:'networkidle'});await page.locator('h1').first().waitFor();
   const result={path,status:r.status(),h1:await page.locator('h1').first().innerText(),noHorizontalOverflow:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)};report.checks.push(result);
   if(result.status!==200||!result.noHorizontalOverflow)throw new Error('Falha na rota '+path);
  }
  await page.goto(base+'/cambio-automatico');await page.getByRole('button',{name:'Simular solicitação'}).click();
  await page.getByRole('heading',{name:'Experiência adicionada à fila.'}).waitFor();await page.getByRole('link',{name:'Ver no sistema'}).click();
  await page.getByRole('heading',{name:'Visitante • exemplo fictício'}).waitFor();report.fictionalFormToCrm=true;
  await page.goto(base+'/cliente');await page.getByRole('button',{name:'Aprovar orçamento fictício'}).click();await page.getByRole('checkbox').check();
  await page.getByRole('button',{name:'Confirmar aprovação',exact:true}).click();await page.getByText('Aprovação registrada',{exact:true}).waitFor();report.fictionalPortalApproval=true;
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/painel');await page.getByRole('button',{name:'Abrir navegação'}).click();
  await page.getByRole('link',{name:'Agenda',exact:true}).click();await page.getByRole('heading',{name:'Agenda da oficina'}).waitFor();report.mobileNavigation=true;
  const noindex=await page.locator('meta[name="robots"]').getAttribute('content');report.noindex=noindex?.includes('noindex');
  report.publicPortfolioVerified=report.browserErrors.length===0&&report.noindex===true;
 }
}catch(e){report.error=e.message;process.exitCode=1;}
finally{if(!report.publicPortfolioVerified)process.exitCode=1;await browser.close();await mkdir('docs/qa',{recursive:true});await writeFile(`docs/qa/deploy-v${expectedVersion}-smoke.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));}
