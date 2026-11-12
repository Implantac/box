import {defineConfig} from '@playwright/test';
import {version} from './package.json';
import base from './playwright.config';

const release=version.endsWith('.0')?version.slice(0,-2):version;
const url=process.env.BOX_TEST_URL;
if(!url||!/^https?:\/\//.test(url))throw new Error('Defina BOX_TEST_URL com o endereço do build a verificar.');
const remote=url.startsWith('https://');
export default defineConfig({
 ...base,
 webServer:undefined,
 use:{...base.use,baseURL:url},
 reporter:[['list'],['json',{outputFile:`docs/qa/playwright-${remote?'deploy-':''}v${release}.json`}]],
 projects:base.projects?.map(project=>({...project,name:`${project.name}-${remote?'deploy':'local'}-v${release}`}))
});
