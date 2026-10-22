// Read-only app-server inspection. No thread creation or model request.
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const exe=require('./find-codex.cjs').findCodex();
const cwd='D:\\TOKSCALE';
const child=spawn(exe,['-c','log_dir="D:/TOKSCALE/work/codex-probe-logs"','app-server','--stdio'],{cwd,windowsHide:true,env:{...process.env,TEMP:'D:\\TOKSCALE\\temp',TMP:'D:\\TOKSCALE\\temp'},stdio:['pipe','pipe','pipe']});
let text='',next=1;const pending=new Map();
child.stdout.on('data',b=>{text+=b;let i;while((i=text.indexOf('\n'))>=0){const line=text.slice(0,i);text=text.slice(i+1);try{const o=JSON.parse(line);const p=pending.get(o.id);if(p){pending.delete(o.id);o.error?p.reject(new Error(o.error.message)):p.resolve(o.result);}}catch{}}});
child.stderr.resume();
const rpc=(method,params)=>new Promise((resolve,reject)=>{const id=next++;pending.set(id,{resolve,reject});child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
const timer=setTimeout(()=>{child.kill();console.error('Host probe timeout');process.exitCode=1;},20000);
(async()=>{
 await rpc('initialize',{clientInfo:{name:'token_glass_diagnostic',version:'0.1.0'},capabilities:{experimentalApi:true}});
 child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'initialized',params:{}})+'\n');
 const listing=await rpc('hooks/list',{cwds:[cwd]});
 function find(o,out=[]){if(!o||typeof o!=='object')return out;if(typeof o.command==='string'&&o.command.includes('TOKSCALE'))out.push({event:o.eventName,enabled:o.enabled,trust:o.trustStatus,source:o.sourcePath,timeout:o.timeoutSec});for(const v of Object.values(o))if(v&&typeof v==='object')find(v,out);return out;}
 const result={hooks:find(listing),responseKeys:Object.keys(listing),at:Date.now()};
 fs.writeFileSync('D:/TOKSCALE/outputs/hook-host-diagnostic.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{clearTimeout(timer);child.stdin.end();child.kill();});
