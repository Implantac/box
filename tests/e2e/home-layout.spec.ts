import {test,expect} from '@playwright/test';

const sizes=[
 {width:1654,height:900},{width:1440,height:900},{width:1366,height:768},
 {width:1024,height:768},{width:768,height:1024},{width:390,height:844},
 {width:360,height:800},{width:320,height:740}
];

test('logo inteira e página sem colisões em oito tamanhos de tela',async({page},testInfo)=>{
 const measurements=[];
 for(const viewport of sizes){
  await page.setViewportSize(viewport);
  const response=await page.goto('/');
  expect(response?.status()).toBe(200);
  await page.evaluate(()=>document.fonts.ready);
  const image=page.getByRole('img',{name:'Proposta conceitual do emblema Box em preto e dourado'});
  await expect(image).toBeVisible();
  await expect.poll(()=>image.evaluate((e:HTMLImageElement)=>e.complete&&e.naturalWidth===720)).toBe(true);
  const result=await page.evaluate(()=>{
   const rect=(selector:string)=>{
    const element=document.querySelector(selector)!;
    const r=element.getBoundingClientRect();
    return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
   };
   const image=rect('.hero-emblem'),figure=rect('.hero-art');
   const overlaps=(a:ReturnType<typeof rect>,b:ReturnType<typeof rect>)=>a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1;
   const peers=['.hero-copy','.art-heading','.hero-art-caption','.hero-bottom','.public-header'];
   const sections=[...document.querySelectorAll('main>section')].map(e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom}});
   return {
    image,
    obstructions:peers.filter(selector=>overlaps(image,rect(selector))),
    fullImageInFigure:image.x>=figure.x-1&&image.y>=figure.y-1&&image.right<=figure.right+1&&image.bottom<=figure.bottom+1,
    noHorizontalOverflow:document.documentElement.scrollWidth<=innerWidth+1,
    logoInsidePage:image.x>=0&&image.right<=innerWidth+1,
    noSectionCollisions:sections.every((r,i)=>!i||r.top>=sections[i-1].bottom-1),
    obsoleteOverlayRemoved:document.querySelector('.hero-art .floating-label')===null,
    captionAfterImage:rect('.hero-art-caption').y>=image.bottom+10,
    connectionAfterFigure:rect('.hero-bottom').y>=figure.bottom+20,
    layoutMode:getComputedStyle(document.querySelector('.hero-art')!).position
   };
  });
  expect(result.obstructions,JSON.stringify(viewport)).toEqual([]);
  expect(result.fullImageInFigure).toBe(true);
  expect(result.noHorizontalOverflow).toBe(true);
  expect(result.logoInsidePage).toBe(true);
  expect(result.noSectionCollisions).toBe(true);
  expect(result.obsoleteOverlayRemoved).toBe(true);
  expect(result.captionAfterImage).toBe(true);
  expect(result.connectionAfterFigure).toBe(true);
  expect(result.layoutMode).not.toBe('absolute');
  expect(result.image.width/result.image.height).toBeCloseTo(1,2);
  if(viewport.width>=1366)expect(result.image.width).toBeGreaterThanOrEqual(540);
  if(viewport.width<=900)expect(result.image.bottom).toBeLessThan(viewport.height);
  measurements.push({viewport,...result});
 }
 await testInfo.attach('home-layout-measurements',{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
});

test('página reorganizada mantém menu, âncoras, FAQ e entrada fictícia no CRM',async({page},testInfo)=>{
 const errors:string[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/');
 if(testInfo.project.name.startsWith('mobile'))await page.getByRole('button',{name:'Abrir menu',exact:true}).click();
 await page.getByRole('navigation',{name:'Navegação principal'}).getByRole('link',{name:'Soluções',exact:true}).click();
 await expect(page).toHaveURL(/#servicos$/);
 if(testInfo.project.name.startsWith('mobile'))await expect(page.getByRole('button',{name:'Abrir menu',exact:true})).toHaveAttribute('aria-expanded','false');
 const question=page.getByRole('button',{name:/^O formulário confirma um agendamento\?/});
 await question.click();
 await expect(question).toHaveAttribute('aria-expanded','true');
 await expect(page.getByText('Na demonstração, ele cria uma solicitação fictícia no CRM da sua sessão.',{exact:false})).toBeVisible();
 await question.click();
 await expect(question).toHaveAttribute('aria-expanded','false');
 await page.locator('.hero-actions').getByRole('link',{name:'Explorar a experiência'}).click();
 await expect(page).toHaveURL(/#contato$/);
 await page.getByLabel('Preferência de período').selectOption('Tarde');
 await page.getByRole('button',{name:'Simular solicitação',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Experiência adicionada à fila.',exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Ver no sistema',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Visitante • exemplo fictício',exact:true})).toBeVisible();
 expect(errors).toEqual([]);
});
