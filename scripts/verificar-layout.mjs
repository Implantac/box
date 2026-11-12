import {chromium} from '@playwright/test';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const base=process.env.BOX_TEST_URL;
if(!base||!/^https?:\/\//.test(base))throw new Error('Defina BOX_TEST_URL com a URL do build a verificar.');
const version=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8')).version;
const release=version.endsWith('.0')?version.slice(0,-2):version;
const remote=base.startsWith('https://');
const folder=`docs/qa/visual-v${release}`;
await mkdir(folder,{recursive:true});
const sizes=[['wide',1654,900],['desktop',1440,900],['laptop',1366,768],['tablet-landscape',1024,768],['tablet',768,1024],['mobile',390,844],['small-mobile',360,800],['minimum',320,740]];
const report={checkedAt:new Date().toISOString(),version,url:base,mode:remote?'public-https':'local-production',checks:[],browserErrors:[],assetErrors:[],passed:false};
const browser=await chromium.launch();
try{
 const context=await browser.newContext();
 const health=await context.request.get(base+'/api/health',{maxRedirects:0});
 if(health.status()!==200)throw new Error('Health não respondeu 200; não contornar a proteção da hospedagem.');
 report.health=await health.json();
 if(report.health.version!==version||report.health.mode!=='portfolio'||report.health.databaseConnection!=='not-used')throw new Error('O build não corresponde à versão de portfólio esperada.');
 for(const [name,width,height] of sizes){
  const page=await context.newPage();
  await page.setViewportSize({width,height});
  page.on('pageerror',e=>report.browserErrors.push({viewport:name,message:e.message}));
  page.on('response',r=>{if(r.status()>=400&&/\/(?:_next|assets)\//.test(r.url()))report.assetErrors.push({viewport:name,status:r.status(),url:r.url()});});
  const response=await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.hero-emblem').waitFor();
  const result=await page.evaluate(()=>{
   const rect=selector=>{const e=document.querySelector(selector);const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
   const image=rect('.hero-emblem'),figure=rect('.hero-art'),hero=rect('.hero');
   const overlaps=(a,b)=>a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1;
   const peerSelectors=['.hero-copy','.art-heading','.hero-art-caption','.hero-bottom','.public-header'];
   const picture=document.querySelector('.hero-emblem');
   const sections=[...document.querySelectorAll('main>section')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom}});
   const cards=[...document.querySelectorAll('#servicos .service-card')].map(e=>{const r=e.getBoundingClientRect();return {width:r.width,bottom:r.bottom}});
   return {
    image,figure,
    imageDecoded:picture.complete&&picture.naturalWidth===720,
    obstructions:peerSelectors.filter(s=>overlaps(image,rect(s))),
    imageInFigure:image.x>=figure.x-1&&image.y>=figure.y-1&&image.right<=figure.right+1&&image.bottom<=figure.bottom+1,
    imageNotClipped:image.x>=hero.x-1&&image.y>=hero.y-1&&image.right<=hero.right+1&&image.bottom<=hero.bottom+1,
    noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+1,
    imageInsidePage:image.x>=0&&image.right<=innerWidth+1,
    captionAfterImage:rect('.hero-art-caption').y>=image.bottom+10,
    connectionOutsideFigure:rect('.hero-bottom').y>=figure.bottom+20,
    noSectionCollisions:sections.every((r,i)=>!i||r.top>=sections[i-1].bottom-1),
    alignedServiceCards:innerWidth<=720||cards.every(c=>Math.abs(c.width-cards[0].width)<1&&Math.abs(c.bottom-cards[0].bottom)<1),
    pageHeight:document.documentElement.scrollHeight
   };
  });
  const passed=response.status()===200&&result.obstructions.length===0&&Object.entries(result).every(([key,value])=>!['image','figure','obstructions','pageHeight'].includes(key)?value===true:true);
  const screenshots=[];
  if(['desktop','tablet','mobile','wide'].includes(name)){
   const prefix=`${folder}/${remote?'publico':'local'}-${name}`;
   await page.screenshot({path:prefix+'-hero.png',fullPage:false,scale:'css'});screenshots.push(prefix+'-hero.png');
   if(name!=='wide'){await page.screenshot({path:prefix+'.png',fullPage:true,scale:'css'});screenshots.push(prefix+'.png');}
  }
  report.checks.push({name,width,height,status:response.status(),...result,passed,screenshots});
  await page.close();
 }
 report.passed=report.checks.every(c=>c.passed)&&report.browserErrors.length===0&&report.assetErrors.length===0;
 if(!report.passed)process.exitCode=1;
}catch(e){report.error=e.message;process.exitCode=1;}
finally{
 await browser.close();
 const path=`docs/qa/layout-${remote?'deploy-':''}v${release}.json`;
 await writeFile(path,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({path,version,viewports:report.checks.length,passed:report.passed,error:report.error,browserErrors:report.browserErrors,assetErrors:report.assetErrors,checks:report.checks.map(({name,width,height,passed,obstructions})=>({name,width,height,passed,obstructions}))},null,2));
}
