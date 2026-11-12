import {chromium,devices} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.BOX_TEST_URL||'http://localhost:3000';
const browser=await chromium.launch({headless:true});const runs=[];
try{
 for(const profile of ['desktop','mobile'])for(const path of ['/','/painel','/cliente'])for(let attempt=1;attempt<=3;attempt++){
  const context=await browser.newContext(profile==='mobile'?{...devices['Pixel 7'],viewport:{width:390,height:844}}:{viewport:{width:1440,height:1000}});
  const page=await context.newPage();const client=await context.newCDPSession(page);
  await client.send('Network.enable');await client.send('Network.setCacheDisabled',{cacheDisabled:true});
  await client.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:93750,connectionType:'cellular4g'});
  await client.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.addInitScript(()=>{
   window.__boxMetrics={lcp:null,cls:0,events:[],longTasks:[]};
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.__boxMetrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
   new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__boxMetrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true});
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.__boxMetrics.events.push({name:e.name,duration:e.duration,inputDelay:e.processingStart-e.startTime});}).observe({type:'event',buffered:true,durationThreshold:16});
   new PerformanceObserver(list=>{for(const e of list.getEntries())window.__boxMetrics.longTasks.push(e.duration);}).observe({type:'longtask',buffered:true});
  });
  const response=await page.goto(base+path,{waitUntil:'networkidle'});await page.locator('h1').first().waitFor();await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const before=await page.evaluate(()=>{const nav=performance.getEntriesByType('navigation')[0];const paints=performance.getEntriesByType('paint');return{...window.__boxMetrics,ttfbMs:nav.responseStart-nav.requestStart,fcpMs:paints.find(e=>e.name==='first-contentful-paint')?.startTime,domContentLoadedMs:nav.domContentLoadedEventEnd,resources:performance.getEntriesByType('resource').length,transferredBytes:performance.getEntriesByType('resource').reduce((n,e)=>n+(e.transferSize||0),0)};});
  if(path==='/')await page.getByRole('button',{name:'Simular solicitação'}).click();
  else if(path==='/painel')await page.getByRole('button',{name:'Abrir ações rápidas'}).click();
  else await page.getByRole('button',{name:'Aprovar orçamento fictício'}).click();
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,250)));
  const after=await page.evaluate(()=>window.__boxMetrics);
  const interaction=after.events.filter(e=>['click','pointerdown','pointerup','keydown','keyup'].includes(e.name));
  runs.push({profile,path,attempt,httpStatus:response?.status(),...before,events:undefined,longTasks:undefined,totalBlockingTimeApproxMs:before.longTasks.reduce((n,d)=>n+Math.max(0,d-50),0),maxObservedInteractionMs:interaction.length?Math.max(...interaction.map(e=>e.duration)):null,maxObservedInputDelayMs:interaction.length?Math.max(...interaction.map(e=>e.inputDelay)):null,interactionSamples:interaction.length});
  await context.close();
 }
}finally{await browser.close();}
const median=arr=>[...arr].sort((a,b)=>a-b)[Math.floor(arr.length/2)];
const summary=[];for(const profile of ['desktop','mobile'])for(const path of ['/','/painel','/cliente']){const list=runs.filter(r=>r.profile===profile&&r.path===path);const item={profile,path};for(const key of ['ttfbMs','fcpMs','lcp','cls','transferredBytes','totalBlockingTimeApproxMs'])item[key]=Number(median(list.map(r=>r[key]||0)).toFixed(key==='cls'?4:2));const observed=list.map(r=>r.maxObservedInteractionMs).filter(n=>n!==null);item.maxObservedInteractionMs=observed.length?Math.max(...observed):null;summary.push(item);}
await mkdir('docs/qa',{recursive:true});
const report={date:'2026-11-12',measuredAt:new Date().toISOString(),url:base,environment:'Chromium headless no sandbox de desenvolvimento; build de produção local, sem CDN',method:'3 contextos frios por rota/perfil, cache desabilitado, 150ms de latência, download 1,6Mbps, upload 750kbps, CPU 4x. Medianas por rota. Uma interação fictícia por carregamento. Não é medição de campo, p75, Lighthouse, INP real nem capacidade de carga.',eventTimingNote:'Amostras event timing a partir de 16ms; null indica ausência de amostra acima do limiar, não duração zero.',summary,runs};
await writeFile('docs/qa/desempenho-laboratorio.json',JSON.stringify(report,null,2));console.log(JSON.stringify(summary,null,2));
