const fs=require('node:fs'),net=require('node:net'),path=require('node:path'),{spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {pipe}=require('../src/paths.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,ms=15000){const end=Date.now()+ms;while(Date.now()<end){if(await fn())return;await wait(150);}throw new Error('Lifecycle timeout');}
function send(event){return new Promise((resolve,reject)=>{const s=net.connect(pipe);const t=setTimeout(()=>{s.destroy();reject(new Error('Pipe acknowledgement timeout'));},3000);s.once('connect',()=>s.write(JSON.stringify({...event,at:Date.now()})+'\n'));s.once('data',()=>{clearTimeout(t);s.destroy();resolve();});s.once('error',e=>{clearTimeout(t);reject(e);});});}
const runtime='D:/TOKSCALE/data/runtime.json';
const read=()=>{try{return JSON.parse(fs.readFileSync(runtime,'utf8'));}catch{return null;}};
(async()=>{
 assert.equal(read(),null,'Close previous monitor first');
 const config=fs.readFileSync(path.join(require('node:os').homedir(),'.codex/config.toml'),'utf8');
 const command=config.match(/command = '([^'\r\n]*TOKSCALE[^'\r\n]*codex start)'/)[1];
 const hook=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{env:{...process.env,TEMP:'D:/TOKSCALE/temp',TMP:'D:/TOKSCALE/temp'},windowsHide:true,stdio:['pipe','pipe','pipe']});hook.stdin.end(JSON.stringify({session_id:'lifecycle-test-c',turn_id:'turn-c'}));
 await until(()=>read()?.active.length===1);
 const pids=[read().pid,read().collector];
 await send({source:'zcode',kind:'start',session:'lifecycle-test-z',turn:'turn-z'});assert.equal(read().active.length,2);
 await send({source:'codex',kind:'stop',session:'lifecycle-test-c',turn:'turn-c'});await wait(3400);assert.equal(read().active.length,1,'First stop must not terminate concurrent host');
 await send({source:'zcode',kind:'stop',session:'lifecycle-test-z',turn:'turn-z'});await until(()=>!read(),10000);await wait(4500);
 for(const pid of pids){assert.throws(()=>process.kill(pid,0),`Leaked process ${pid}`);}
 console.log(JSON.stringify({registeredCommandShell:'powershell.exe',hookWake:true,concurrentTasks:true,delayedExit:true,noResidentProcesses:true,pids}));
})().catch(e=>{console.error(e);process.exitCode=1;});
