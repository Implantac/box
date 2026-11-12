import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('prévia e exportação respeitam a legenda de cada destino',async({page})=>{
 await page.goto('/painel/conteudo');
 await page.getByRole('button',{name:'Editar Cuidado que começa no diagnóstico'}).click();
 await page.getByLabel('Legenda específica · Instagram (opcional)',{exact:true}).fill('Legenda exclusiva e fictícia para Instagram.');
 await page.getByLabel('Legenda específica · Facebook (opcional)',{exact:true}).fill('Legenda exclusiva e fictícia para Facebook.');
 await page.getByRole('button',{name:'Salvar rascunho'}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'Ver conteúdo Cuidado que começa no diagnóstico'}).click();
 await expect(page.locator('.network-preview>p')).toHaveText('Legenda exclusiva e fictícia para Instagram.');
 await page.getByRole('button',{name:'Prévia Facebook',exact:true}).click();
 await expect(page.locator('.network-preview>p')).toHaveText('Legenda exclusiva e fictícia para Facebook.');
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Exportar legenda para publicação manual'}).click();
 const download=await downloadPromise;
 expect(download.suggestedFilename()).toBe('box-legenda-facebook-demo.txt');
 const stream=await download.createReadStream();expect(stream).toBeTruthy();const chunks:Buffer[]=[];
 for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
 expect(Buffer.concat(chunks).toString()).toBe('Legenda exclusiva e fictícia para Facebook.');
 await page.getByRole('button',{name:'Prévia YouTube Shorts',exact:true}).click();
 await expect(page.locator('.network-preview>p')).toContainText('Cada detalhe conta. Nesta demonstração');
 const axe=await new AxeBuilder({page}).include('dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(axe.violations).toEqual([]);
});

test('conteúdo só para Facebook não abre prévia nem exportação de outra rede',async({page})=>{
 await page.goto('/painel/conteudo');
 await page.getByRole('button',{name:'Editar Cuidado que começa no diagnóstico'}).click();
 await page.getByRole('checkbox',{name:'Instagram',exact:true}).uncheck();
 await page.getByRole('checkbox',{name:'YouTube Shorts',exact:true}).uncheck();
 await page.getByLabel('Legenda específica · Facebook (opcional)',{exact:true}).fill('Somente Facebook, conteúdo fictício.');
 await page.getByRole('button',{name:'Salvar rascunho'}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'Ver conteúdo Cuidado que começa no diagnóstico'}).click();
 await expect(page.getByRole('button',{name:'Prévia Instagram',exact:true})).toHaveCount(0);
 await expect(page.locator('.network-preview-header small')).toContainText('Facebook');
 await expect(page.locator('.network-preview>p')).toHaveText('Somente Facebook, conteúdo fictício.');
});

test('formulário aberto é acessível, mantém foco na janela e volta ao fechar',async({page})=>{
 await page.goto('/painel/clientes');
 const opener=page.getByRole('button',{name:'Novo cliente',exact:true});await opener.click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
 const axe=await new AxeBuilder({page}).include('dialog').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 expect(axe.violations).toEqual([]);
 for(let i=0;i<18;i++)await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('dialog')))).toBe(true);
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(opener).toBeFocused();
});
