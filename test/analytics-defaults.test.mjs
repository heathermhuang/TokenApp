import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';
const output=await build({entryPoints:['src/template.ts'],bundle:true,format:'esm',platform:'node',write:false,logLevel:'silent'});
const {getHtml}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const html=getHtml({});const start=html.indexOf('window.dataLayer =');const head=html.slice(start,html.indexOf('</script>',start));
function boot(choice=null,blocked=false,url='https://token.app/?q=private'){const context={navigator:{},location:new URL(url),localStorage:{getItem(){if(blocked)throw Error('blocked');return choice;}},Date};context.window=context;vm.runInNewContext(head,context);return context;}
test('fresh public visits automatically grant analytics without advertising signals',()=>{const c=boot();const calls=c.dataLayer.map(x=>Array.from(x));assert.equal(c.tokenAnalyticsAllowed,true);assert.equal(calls.find(x=>x[0]==='consent')[2].analytics_storage,'granted');assert.equal(calls.find(x=>x[0]==='consent')[2].ad_storage,'denied');assert.equal(calls.find(x=>x[0]==='config')[2].page_location,'https://token.app/');});
test('an existing explicit refusal remains off and blocked storage does not require opt-in',()=>{assert.equal(boot('declined')['ga-disable-G-Z59RHGWMWD'],true);assert.equal(boot(null,true).tokenAnalyticsAllowed,true);});
test('the consent panel opens only on an explicit settings request',()=>{const source=html.slice(html.indexOf('function initConsent('),html.indexOf('// ── Legal Modals',html.indexOf('function initConsent(')));const bar={style:{display:'none'},offsetHeight:40};const c={document:{getElementById:()=>bar,body:{style:{}}},window:{addEventListener(){}}};vm.runInNewContext(source,c);c.initConsent();assert.equal(bar.style.display,'none');c.initConsent(true);assert.equal(bar.style.display,'flex');});

test('development and preview hosts do not collect production analytics',()=>{assert.equal(boot(null,false,'http://localhost:8787/').tokenAnalyticsAllowed,false);assert.equal(boot(null,false,'https://preview.workers.dev/').tokenAnalyticsAllowed,false);});

test('the documented stable public workers.dev endpoint remains measured',()=>{assert.equal(boot(null,false,'https://token-app.measurable.workers.dev/').tokenAnalyticsAllowed,true);});
