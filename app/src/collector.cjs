'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFile}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
const {dayKey,codexQuota}=require('./model.cjs');
const {requestRate}=require('./rates.cjs');
const {zcodeQuota}=require('./quotas.cjs');
const {readLines}=require('./log-lines.cjs');
const root=process.env.TOKEN_GLASS_DATA || 'D:\\TOKSCALE\\data';
const base='D:\\TOKSCALE';
fs.mkdirSync(root,{recursive:true});
const cacheFile=path.join(root,'snapshot.json');
const children=new Set();
let snapshot={graph:null,speeds:[],quotas:[],warnings:[],updatedAt:null,scanning:false};
try{snapshot={...snapshot,...JSON.parse(fs.readFileSync(cacheFile,'utf8')),scanning:false};}catch{}
let graphBusy=false,quotaBusy=false,lastQuota=0,active=[],lastFullGraph=0,panelMode=false,lastGraph=0;
let lastEmission='';
const emit=()=>{const next=JSON.stringify(snapshot);if(next===lastEmission)return;lastEmission=next;process.send?.({type:'snapshot',data:snapshot});};
function run(args,timeout=45000) {
  return new Promise((resolve,reject)=>{
    const exe=process.env.TOKEN_GLASS_TOKSCALE;
    const child=execFile(exe,args,{windowsHide:true,timeout,maxBuffer:40*1024*1024,env:{...process.env,TEMP:path.join(base,'temp'),TMP:path.join(base,'temp'),TOKSCALE_CONFIG_DIR:path.join(root,'tokscale'),TOKSCALE_PRICING_CACHE_ONLY:'1'}},(error,stdout,stderr)=>{
      children.delete(child);process.send?.({type:'child-exited',pid:child.pid});
      if(error)return reject(new Error(error.killed?'统计读取超时':`统计读取失败（${error.code||'未知'}）`));
      try{resolve({data:JSON.parse(stdout.replace(/^\uFEFF/,'')),warnings:stderr.split('\n').filter(s=>/partial|omit|incomplete|unsupported usage|unpriced/i.test(s)).slice(0,5)});}catch{reject(new Error('统计工具返回了无法识别的数据'));}
    });
    children.add(child);process.send?.({type:'child-started',pid:child.pid});
  });
}
async function graph(force=false) {
  if(!force&&Date.now()-lastGraph<25000)return;
  if(graphBusy)return;graphBusy=true;snapshot.scanning=true;emit();
  try{
    const full=!process.env.TOKEN_GLASS_NATIVE||panelMode||!snapshot.graph||Date.now()-lastFullGraph>600000;
    const result=await run(['graph','--no-spinner',...(full?[]:['--today'])]);
    if(!result.data?.summary||!Array.isArray(result.data?.contributions))throw new Error('Tokscale 数据格式不兼容');
    if(full){snapshot.graph=result.data;lastFullGraph=Date.now();}
    else{
      const today=dayKey(),previous=snapshot.graph.contributions.find(d=>d.date===today),next=result.data.contributions.find(d=>d.date===today);
      snapshot.graph={...snapshot.graph,contributions:[...snapshot.graph.contributions.filter(d=>d.date!==today),...(next?[next]:[])].sort((a,b)=>a.date.localeCompare(b.date)),summary:{...snapshot.graph.summary,totalTokens:snapshot.graph.summary.totalTokens-(previous?.totals?.tokens||0)+(next?.totals?.tokens||0),totalCost:snapshot.graph.summary.totalCost-(previous?.totals?.cost||0)+(next?.totals?.cost||0),clients:[...new Set([...snapshot.graph.summary.clients,...result.data.summary.clients])]}};
    }
    lastGraph=Date.now();snapshot.updatedAt=lastGraph;snapshot.warnings=result.warnings;
    fs.writeFileSync(cacheFile+'.tmp',JSON.stringify({...snapshot,speeds:[],scanning:false}));fs.renameSync(cacheFile+'.tmp',cacheFile);
  }catch(e){snapshot.warnings=[e.message];}
  finally{graphBusy=false;snapshot.scanning=false;emit();}
}
function findZcodeDb(){
  const candidates=[process.env.ZCODE_HOME&&path.join(process.env.ZCODE_HOME,'cli/db/db.sqlite'),'D:\\.zcode\\cli\\db\\db.sqlite',path.join(os.homedir(),'.zcode/cli/db/db.sqlite')].filter(Boolean);
  return candidates.find(p=>fs.existsSync(p));
}
let zdb;
function zcodeSpeed(){
  try{
    const file=findZcodeDb();if(!file)return[];
    if(!zdb){zdb=new DatabaseSync(file,{readOnly:true});zdb.exec('PRAGMA query_only=ON;PRAGMA busy_timeout=300');}
    for(const turn of active.filter(t=>t.source==='zcode')){
      const row=zdb.prepare('SELECT turn_id,status,completed_at FROM turn_usage WHERE session_id=? ORDER BY started_at DESC LIMIT 1').get(turn.session);
      if(row?.completed_at>=turn.since&&row.status!=='running')process.send?.({type:'turn-ended',source:'zcode',session:turn.session,turn:turn.turn||'',at:row.completed_at});
    }
    const sessions=active.filter(t=>t.source==='zcode').map(t=>t.session);
    const params=sessions.length?sessions:[];
    const rows=zdb.prepare(`SELECT session_id,turn_id,model_id,output_tokens,completed_at,COALESCE(duration_ms,completed_at-started_at) duration,time_to_first_token_ms,first_token_at,started_at FROM model_usage WHERE status='completed' AND query_source='main_turn' ${sessions.length?`AND session_id IN (${sessions.map(()=>'?').join(',')})`:''} ORDER BY completed_at DESC LIMIT 30`).all(...params);
    const seen=new Set();return rows.filter(r=>{if(seen.has(r.session_id))return false;seen.add(r.session_id);return true;}).map(r=>{
      const d=Number(r.duration),o=Number(r.output_tokens),ttft=Number(r.time_to_first_token_ms??(r.first_token_at!=null?r.first_token_at-r.started_at:NaN));
      return {source:'zcode',session:r.session_id,model:r.model_id,...requestRate(o,d,ttft),output:o,duration:d,at:r.completed_at,method:'请求端到端均速 · 含首字等待'};
    });
  }catch(e){snapshot.zcodeError='ZCode 速率暂不可用';return[];}
}
const logs=new Map();let files=[],lastIndex=0;
function indexCodex(){
  if(Date.now()-lastIndex<10000)return;lastIndex=Date.now();
  const dir=path.join(process.env.CODEX_HOME||path.join(os.homedir(),'.codex'),'sessions');let found=[];
  const walk=p=>{try{for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else if(e.name.endsWith('.jsonl')){const s=fs.statSync(f);found.push({path:f,mtime:s.mtimeMs});}}}catch{}};
  walk(dir);files=found.sort((a,b)=>b.mtime-a.mtime).slice(0,8);
}
function readCodex(){
  indexCodex();
  for(const file of files){
    try{
      const size=fs.statSync(file.path).size;
      let state=logs.get(file.path);
      if(!state||size<state.offset){state={offset:Math.max(0,size-1024*1024),tail:'',session:path.basename(file.path,'.jsonl').slice(-36),lastInputAt:null,firstOutputAt:null,previous:null};state.discardLine=state.offset>0;logs.set(file.path,state);}
      if(size===state.offset)continue;
      const lines=readLines(file.path,state,size);
      for(const line of lines){
        if(/"type"\s*:\s*"(?:function_call_output|custom_tool_call_output)"/.test(line)){
          const timestamp=line.match(/"timestamp"\s*:\s*"([^"]+)"/);const at=Date.parse(timestamp?.[1]);if(Number.isFinite(at)){state.lastInputAt=at;state.firstOutputAt=null;}continue;
        }
        // Ignore conversation bodies and tool input/output before JSON parsing.
        if(!/"(?:token_count|token_usage_record|turn_context|session_meta|item_completed|task_started|turn_started|task_complete|turn_complete|turn_aborted)"/.test(line))continue;
        let o;try{o=JSON.parse(line);}catch{continue;}const p=o.payload||{},at=Date.parse(o.timestamp);if(!Number.isFinite(at))continue;
        if(o.type==='session_meta'){state.session=p.id||state.session;continue;}
        if(o.type==='turn_context'){state.model=p.model||state.model;state.session=p.thread_id||state.session;}
        if(['task_started','turn_started'].includes(p.type)){state.lastInputAt=at;state.firstOutputAt=null;state.turn=p.turn_id||state.turn;}
        if(['task_complete','turn_complete','turn_aborted'].includes(p.type))process.send?.({type:'turn-ended',source:'codex',session:state.session,turn:p.turn_id||'',at});
        if(p.type==='item_completed'&&['Reasoning','AgentMessage'].includes(p.item?.type)&&Number.isFinite(p.started_at_ms)){
          if(state.lastInputAt==null||p.started_at_ms>=state.lastInputAt)state.firstOutputAt=Math.min(state.firstOutputAt??Infinity,p.started_at_ms);
        }
        if(p.rate_limits){const q=codexQuota(p.rate_limits);const latest=Math.max(0,...snapshot.quotas.filter(q=>q.source==='codex').map(q=>q.updatedAt||0));if(q.length&&at>=latest){snapshot.quotas=[...snapshot.quotas.filter(q=>q.source!=='codex'),...q.map(q=>({...q,updatedAt:at}))];}}
        const raw=o.type==='token_usage_record'?p.usage:p.type==='token_count'?p.info?.last_token_usage:null;
        const cumulative=p.info?.total_token_usage;
        if(!raw)continue;
        let output=Number(raw.output_tokens),duration=null,method='';
        if(state.firstOutputAt!=null&&at>state.firstOutputAt){duration=at-state.firstOutputAt;method='输出起始时间估算 · 含推理输出';}
        else if(state.lastInputAt!=null&&at>state.lastInputAt){duration=at-state.lastInputAt;method='请求边界估算 · 含等待';}
        else if(state.previous&&cumulative){duration=at-state.previous.at;output=Number(cumulative.output_tokens)-state.previous.output;method='累计记录差分估算';}
        if(cumulative)state.previous={at,output:Number(cumulative.output_tokens)};
        if(duration>=200&&duration<=(method.startsWith('累计')?120000:600000)&&output>=0){state.speed={source:'codex',session:p.session_id||p.thread_id||state.session,model:state.model||'Codex',rate:output/(duration/1000),output,duration,at,method};state.lastInputAt=at;state.firstOutputAt=null;}
      }
    }catch{}
  }
  const kept=new Set(files.map(f=>f.path));for(const key of logs.keys())if(!kept.has(key))logs.delete(key);
  const wanted=active.filter(t=>t.source==='codex').map(t=>t.session);
  return [...logs.values()].filter(s=>s.speed&&(!wanted.length||wanted.includes(s.speed.session))).map(s=>s.speed).sort((a,b)=>b.at-a.at).slice(0,6);
}
function speed(){snapshot.speeds=[...zcodeSpeed(),...readCodex()];emit();}
async function quotas(){
  if(quotaBusy||Date.now()-lastQuota<180000)return;quotaBusy=true;lastQuota=Date.now();
  try{
    try{const z=await zcodeQuota();if(z.length)snapshot.quotas=[...snapshot.quotas.filter(q=>q.source!=='zcode'),...z];}catch{}
    const {data}=await run(['usage','--json'],25000);
    const rows=[];
    for(const provider of Array.isArray(data)?data:[]){
      const source=/codex|openai/i.test(provider.provider)?'codex':/zai|z\.ai|bigmodel|glm|zcode/i.test(provider.provider)?'zcode':null;
      if(!source)continue;
      for(const metric of provider.metrics||[]){const remaining=Number(metric.remaining_percent);if(!Number.isFinite(remaining))continue;rows.push({source,id:metric.label,label:metric.label,remaining,resetsAt:metric.resets_at,updatedAt:Date.now()});}
    }
    if(rows.length){const sources=new Set(rows.map(r=>r.source));snapshot.quotas=[...snapshot.quotas.filter(r=>!sources.has(r.source)),...rows];}
    snapshot.quotaStatus={zcode:snapshot.quotas.some(q=>q.source==='zcode')?'available':'当前登录未返回可用额度',codex:snapshot.quotas.some(q=>q.source==='codex')?'available':'当前登录未返回可用额度'};
  }catch{snapshot.quotaError='额度更新失败，保留上次数据';}finally{quotaBusy=false;emit();}
}
async function detail(view,client='all'){
  const strategies={sessions:'session,model',projects:'workspace,model',models:'client,model'};
  const args=view==='hourly'?['hourly','--json','--no-spinner','--today']:['--json','--no-spinner','--group-by',strategies[view]||'client,model'];
  if(view==='hourly'&&client!=='all')args.push('--client',client);
  return (await run(args)).data;
}
process.on('message',async m=>{
  if(m.type==='active'){active=m.active||[];speed();}
  if(m.type==='refresh'){graph(!!m.force);quotas();}
  if(m.type==='mode'){panelMode=!!m.panel;if(panelMode)graph(true);}
  if(m.type==='detail'){try{process.send?.({type:'detail',id:m.id,data:await detail(m.view,m.client)});}catch(e){process.send?.({type:'detail',id:m.id,error:e.message});}}
  if(m.type==='stop'){for(const c of children)c.kill();try{zdb?.close();}catch{}process.exit(0);}
});
process.on('disconnect',()=>{for(const c of children)c.kill();process.exit(0);});
emit();speed();graph();quotas();setInterval(speed,2000);setInterval(graph,30000);setInterval(quotas,180000);
