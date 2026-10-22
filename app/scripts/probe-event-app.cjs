const{_electron}=require('@playwright/test');
const net=require('node:net'),assert=require('node:assert/strict');const{pipe}=require('../src/paths.cjs');
(async()=>{
 const env={...process.env,TEMP:'D:/TOKSCALE/temp',TMP:'D:/TOKSCALE/temp'};delete env.ELECTRON_RUN_AS_NODE;
 const event={source:'codex',kind:'start',session:'probe-c',at:Date.now()};
 const app=await _electron.launch({executablePath:'D:/TOKSCALE/desktop/Token Glass.exe',args:['--legacy','--event',Buffer.from(JSON.stringify(event)).toString('base64')],env});const child=app.process();
 app.process().stderr.on('data',b=>process.stderr.write(b));
 await app.evaluate(({dialog})=>{dialog.showErrorBox=(title,content)=>console.error('CAPTURED ERROR:',title,content);});
 try{
  const w=await app.firstWindow();await w.waitForSelector('.widget-number');
  assert.equal(await w.isVisible('.widget-number'),true);console.log('widget visible',true);
  for(const e of [{source:'zcode',kind:'start',session:'probe-z'},{source:'codex',kind:'stop',session:'probe-c'},{source:'zcode',kind:'stop',session:'probe-z'}]){
   console.log('sending',e.kind,e.source);
   await new Promise((resolve,reject)=>{const s=net.connect(pipe);const t=setTimeout(()=>{s.destroy();reject(new Error('Pipe reply timeout'));},5000);s.once('connect',()=>s.write(JSON.stringify({...e,at:Date.now()})+'\n'));s.on('data',()=>{clearTimeout(t);s.destroy();resolve();});s.on('error',e=>{clearTimeout(t);reject(e);});});
  }
  await new Promise(r=>setTimeout(r,8000));assert.equal(child.exitCode,0);console.log('exited',child.exitCode);
 }finally{await app.close().catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
