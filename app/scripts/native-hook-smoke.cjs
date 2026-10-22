// Exercise the real Codex hook runner with an ephemeral, local-only model fixture.
// No user chat is created, no provider credentials copied, and no paid request sent.
const fs=require('node:fs'),http=require('node:http'),net=require('node:net'),assert=require('node:assert/strict');
const{spawn}=require('node:child_process');
const{pipe}=require('../src/paths.cjs');
const base='D:/TOKSCALE',runtime=base+'/data/runtime.json';
const read=()=>{try{return JSON.parse(fs.readFileSync(runtime,'utf8'));}catch{return null;}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let child,server,threadId;const hooks=[];let requests=0;
async function stop(){if(read()?.active.some(a=>a.session===threadId))await new Promise(resolve=>{const s=net.connect(pipe);s.on('connect',()=>s.write(JSON.stringify({source:'codex',kind:'stop',session:threadId,at:Date.now()})+'\n'));s.on('data',()=>{s.destroy();resolve();});s.on('error',resolve);setTimeout(()=>{s.destroy();resolve();},1000);});}
(async()=>{
 assert.ok(!read()||read().native,'Update or close the legacy Electron monitor before native-hook test');
 server=http.createServer((req,res)=>{requests++;req.resume();res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{message:'Token Glass local diagnostic fixture; no model generation',type:'invalid_request_error'}}));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const port=server.address().port;
 const config={model_provider:'token_glass_fixture',model_providers:{token_glass_fixture:{name:'Token Glass local fixture',base_url:`http://127.0.0.1:${port}/v1`,wire_api:'responses',requires_openai_auth:false,request_max_retries:0,stream_max_retries:0}},model:'token-glass-fixture',log_dir:base+'/work/codex-probe-logs'};
 child=spawn(require('./find-codex.cjs').findCodex(),['-c',`log_dir="${base}/work/codex-probe-logs"`,'app-server','--stdio'],{cwd:base+'/work',windowsHide:true,env:{...process.env,TEMP:base+'/temp',TMP:base+'/temp'},stdio:['pipe','pipe','pipe']});
 const pending=new Map();let next=1,text='';
 child.stderr.resume();
 child.stdout.on('data',b=>{text+=b;let i;while((i=text.indexOf('\n'))>=0){const line=text.slice(0,i);text=text.slice(i+1);try{const o=JSON.parse(line);const p=pending.get(o.id);if(p){pending.delete(o.id);o.error?p.reject(new Error(o.error.message)):p.resolve(o.result);}else if(o.method?.includes('hook')&&o.params?.run){const r=o.params.run;hooks.push({method:o.method,event:r.eventName,status:r.status,entries:r.entries?.map(e=>({kind:e.kind,text:String(e.text).replace(/(Bearer\s+|api[_-]?key[=: ]+)[^\s,;]+/gi,'$1<REDACTED>').slice(0,1800)}))});}}catch{}}});
 const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=next++;const timer=setTimeout(()=>reject(new Error('RPC timeout: '+method)),20000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r);},reject:e=>{clearTimeout(timer);reject(e);}});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 await rpc('initialize',{clientInfo:{name:'token_glass_local_fixture',version:'0.1.0'},capabilities:{experimentalApi:true}});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'initialized',params:{}})+'\n');
 const started=await rpc('thread/start',{ephemeral:true,cwd:base+'/work',model:'token-glass-fixture',modelProvider:'token_glass_fixture',config});threadId=started.thread.id;
 await rpc('turn/start',{threadId,input:[{type:'text',text:'Token Glass local hook test.',text_elements:[]}]});
 let woke=false;const deadline=Date.now()+12000;
 while(Date.now()<deadline){if(read()?.active.some(a=>a.session===threadId)){woke=true;break;}if(hooks.some(h=>h.status==='failed'))break;await wait(100);}
 await wait(500);
 let status;try{status=JSON.parse(fs.readFileSync(base+'/data/hook-codex-start.json','utf8'));}catch{}
 const report={nativeHookWokeMonitor:woke,hookNotifications:hooks,localFixtureRequests:requests,hookStatus:status||null,at:Date.now()};
 fs.writeFileSync(base+'/outputs/native-hook-diagnostic.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 assert.equal(woke,true,'Real Codex UserPromptSubmit did not display the monitor');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(async()=>{await stop();child?.stdin.end();child?.kill();server?.close();});
