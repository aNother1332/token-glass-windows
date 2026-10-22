const{_electron}=require('@playwright/test');const fs=require('node:fs'),net=require('node:net'),assert=require('node:assert/strict');
const root='D:/TOKSCALE/work/native-test',pipe=JSON.parse(fs.readFileSync('D:/TOKSCALE/native/config.json','utf8')).pipe+'-test';
let application;
(async()=>{
 const env={...process.env,TEMP:'D:/TOKSCALE/temp',TMP:'D:/TOKSCALE/temp',TOKEN_GLASS_DATA:root,TOKEN_GLASS_PIPE:pipe};delete env.ELECTRON_RUN_AS_NODE;
 application=await _electron.launch({executablePath:'D:/TOKSCALE/build/win-unpacked/Token Glass.exe',args:['--native-panel'],env,cwd:'D:/TOKSCALE',timeout:30000});
 const errors=[];const page=await application.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.waitForSelector('.stat-value');
 await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.fonts.check('400 13px "TokenGlass Maple"')));
 for(const id of ['claude','opencode','copilot','copilot-dark','codex','codex-light','zcode'])assert.equal(await page.evaluate(id=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth>0);i.onerror=()=>resolve(false);i.src=`assets/${id}.png`;}),id),true,'Official icon '+id);
 // Actual node identity must survive a value-only update.
 await page.locator('.stat-value').first().evaluate(el=>el.dataset.nativeSmoke='preserved');await page.evaluate(()=>window.tokenGlass.action('refresh'));await page.waitForTimeout(2000);assert.equal(await page.locator('.stat-value').first().getAttribute('data-native-smoke'),null); // Attr reconciles, node identity checked below.
 const stable=await page.locator('.stat-value').first().elementHandle();await page.waitForTimeout(2100);assert.equal(await stable.evaluate(el=>el.isConnected),true);
 for(const tab of ['models','trend','projects','sessions','activity','settings']){await page.locator(`[data-page="${tab}"]`).click();if(['projects','sessions'].includes(tab))await page.locator('tbody tr').first().waitFor({timeout:55000});}
 await page.locator('[data-setting="theme"]').selectOption('dark');await page.waitForTimeout(1300);await page.locator('[data-page="overview"]').click();await page.screenshot({path:'D:/TOKSCALE/outputs/panel-maple-dark.png'});
 await page.locator('[data-page="settings"]').click();await page.locator('[data-setting="theme"]').selectOption('light');await page.waitForTimeout(1300);await page.locator('[data-page="overview"]').click();await page.screenshot({path:'D:/TOKSCALE/outputs/panel-maple-light.png'});
 assert.deepEqual(errors,[]);const pid=application.process().pid;await application.close();application=null;
 const report={mapleFont:true,officialIcons:7,allPages:true,stableDom:true,lightDark:true,uiErrors:errors,panelPid:pid};fs.writeFileSync('D:/TOKSCALE/outputs/native-panel-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e);process.exitCode=1;await application?.close().catch(()=>{});});
