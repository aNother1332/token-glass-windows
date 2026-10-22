'use strict';
// Invoked by the host only on prompt/stop. No daemon, no scheduled task.
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { root, pipe } = require('./paths.cjs');
const [hookSource,hookKind]=process.argv.slice(2);
function record(phase,detail={}){
  if(!['codex','zcode'].includes(hookSource)||!['start','stop'].includes(hookKind))return;
  try{
    fs.mkdirSync(root,{recursive:true});
    const file=path.join(root,`hook-${hookSource}-${hookKind}.json`);
    const allowed={};for(const k of ['hasSession','payloadBytes','monitorPid','errorCode'])if(detail[k]!=null)allowed[k]=detail[k];
    fs.writeFileSync(file,JSON.stringify({source:hookSource,event:hookKind,phase,at:Date.now(),pid:process.pid,...allowed}));
  }catch{}
}
async function main() {
  const [source,kind] = process.argv.slice(2);
  record('invoked');
  let text = '';
  await new Promise(resolve => {
    const timer=setTimeout(resolve,500); process.stdin.setEncoding('utf8');
    process.stdin.on('data',s=>{ if(text.length<65536)text+=s; });
    process.stdin.on('end',()=>{clearTimeout(timer);resolve();}); process.stdin.resume();
  });
  process.stdin.pause();
  let input={};try{input=JSON.parse(text.replace(/^\uFEFF/,''));}catch{}
  // Do not store prompt, response, credentials, cwd or the original hook payload.
  const session=input.session_id || input.thread_id || process.env.ZCODE_SESSION_ID || process.env.CODEX_THREAD_ID;
  if(!session || !['codex','zcode'].includes(source) || !['start','stop'].includes(kind)){record('invalid-input',{hasSession:!!session,payloadBytes:text.length});return;}
  const event={source,kind,session:String(session),turn:input.turn_id||'',at:Date.now()};
  if(kind==='start')try{
    const script=`$tgPid=${process.ppid};for($i=0;$i -lt 12;$i++){ $p=Get-CimInstance Win32_Process -Filter "ProcessId=$tgPid" -ErrorAction SilentlyContinue;if(!$p){break};if($p.Name -match '^(codex|zcode)(-cli)?\\.exe$'){Write-Output $p.ProcessId;break};$tgPid=$p.ParentProcessId}`;
    event.hostPid=Number(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:1800,encoding:'utf8'}).trim())||null;
  }catch{}
  const sent=await new Promise(resolve=>{
    const s=net.connect(pipe);const t=setTimeout(()=>{s.destroy();resolve(false);},400);
    s.once('connect',()=>s.write(JSON.stringify(event)+'\n'));
    s.once('data',()=>{clearTimeout(t);s.destroy();resolve(true);});
    s.once('error',()=>{clearTimeout(t);resolve(false);});
  });
  if(sent||kind!=='start'){record(sent?'delivered':'monitor-not-running');return;}
  let install;try{install=JSON.parse(fs.readFileSync(path.join(root,'installation.json'),'utf8'));}catch{record('installation-missing');return;}
  const args=[...(install.args||[]),'--event',Buffer.from(JSON.stringify(event)).toString('base64')];
  const env={...process.env,TEMP:'D:\\TOKSCALE\\temp',TMP:'D:\\TOKSCALE\\temp'};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(install.exe,args,{detached:true,stdio:'ignore',windowsHide:true,env});
  await new Promise(resolve=>{child.once('spawn',()=>{record('monitor-spawned',{monitorPid:child.pid});resolve();});child.once('error',e=>{record('spawn-failed',{errorCode:e.code||'UNKNOWN'});resolve();});});child.unref();
}
main().catch(e=>record('failed',{errorCode:e.code||e.name||'UNKNOWN'})).finally(()=>{process.stdout.write('{}\n');process.exit(0);});
