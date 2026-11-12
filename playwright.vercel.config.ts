import {defineConfig} from '@playwright/test';
import base from './playwright.config';
const url=process.env.BOX_TEST_URL;
if(!url||!url.startsWith('https://'))throw new Error('Defina BOX_TEST_URL com o endereço HTTPS do deployment a verificar.');
export default defineConfig({...base,webServer:undefined,use:{...base.use,baseURL:url},reporter:[['list'],['json',{outputFile:'docs/qa/playwright-deploy-v1.1.json'}]],projects:base.projects?.map(project=>({...project,name:project.name+'-deploy-v1.1'}))});
