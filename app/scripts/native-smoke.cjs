const fs=require('node:fs'),net=require('node:net'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root='D:/TOKSCALE/work/native-test',config=JSON.parse(fs.readFileSync('D:/TOKSCALE/native/config.json','utf8'));
const pipe='\\\\.\\pipe\\'+config.pipe+'-test';
const read=()=>{try{return JSON.parse(fs.readFileSync(root+'/runtime.json','utf8'));}catch{return null;}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn,ms=12000){const end=Date.now()+ms;while(Date.now()<end){if(fn())return;await wait(100);}throw new Error('Native lifecycle timeout');}
function send(data){return new Promise((resolve,reject)=>{const s=net.connect(pipe);const t=setTimeout(()=>{s.destroy();reject(new Error('Native pipe timeout'));},2500);s.once('connect',()=>s.write(JSON.stringify({...data,at:data.at??Date.now()})+'\n'));s.once('data',()=>{clearTimeout(t);s.destroy();resolve();});s.once('end',()=>{clearTimeout(t);resolve();});s.once('error',e=>{clearTimeout(t);reject(e);});});}
let pids=[];
(async()=>{
 if(read()){await send({command:'quit'});await until(()=>!read());await wait(500);}
 const event={source:'codex',kind:'start',session:'native-a',turn:'turn-a',at:Date.now()};
 const child=spawn('D:/TOKSCALE/native/TokenGlass.Widget.exe',['--test','--event',Buffer.from(JSON.stringify(event)).toString('base64')],{stdio:'ignore',windowsHide:true});
 await until(()=>read()?.active.length===1);pids=[read().pid,read().collector];
 assert.equal(read().native,true);assert.equal(JSON.parse(fs.readFileSync(root+'/native-render.json','utf8')).font,'TokenGlass Maple');
 await send({source:'zcode',kind:'start',session:'native-b',turn:'turn-b'});assert.equal(read().active.length,2);
 await send({source:'codex',kind:'stop',session:'native-a',turn:'old-turn'});assert.equal(read().active.length,2);
 await send({source:'codex',kind:'stop',session:'native-a',turn:'turn-a',at:event.at-1});assert.equal(read().active.length,2);
 await send({source:'codex',kind:'stop',session:'native-a',turn:'turn-a'});await wait(3400);assert.equal(read().active.length,1);
 await send({command:'panel-open'});await send({source:'zcode',kind:'stop',session:'native-b',turn:'turn-b'});await wait(3400);assert.equal(read().manualPanel,true);assert.equal(read().active.length,0);
 await send({command:'panel-closed'});await until(()=>!read());await wait(1000);for(const pid of pids)assert.throws(()=>process.kill(pid,0));
 const report={nativeWindow:true,mapleFont:true,concurrentTasks:true,staleStopsIgnored:true,manualPanelLifetime:true,delayedExit:true,noResidentProcesses:true,pids};fs.writeFileSync('D:/TOKSCALE/outputs/native-lifecycle-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(async e=>{console.error(e);process.exitCode=1;if(read())await send({command:'quit'}).catch(()=>{});});
