const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const root='D:/TOKSCALE/work/native-test';fs.mkdirSync(root,{recursive:true});
for(const f of ['snapshot.json','settings.json','hook-status.json'])try{fs.copyFileSync('D:/TOKSCALE/data/'+f,path.join(root,f));}catch{}
const s=JSON.parse(fs.readFileSync(root+'/settings.json','utf8'));s.layer='top';s.expanded=true;s.position={x:1000,y:100};fs.writeFileSync(root+'/settings.json',JSON.stringify(s));
const p=spawn('D:/TOKSCALE/native/TokenGlass.Widget.exe',['--test','--event',Buffer.from(JSON.stringify({source:'codex',kind:'start',session:'native-fixture',at:Date.now()})).toString('base64')],{detached:true,stdio:'ignore',windowsHide:true});p.unref();
(async()=>{const deadline=Date.now()+8000;while(Date.now()<deadline){try{const r=JSON.parse(fs.readFileSync(root+'/runtime.json','utf8'));if(r.pid===p.pid){console.log(JSON.stringify({pid:p.pid,root}));return;}}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error('Test widget did not become ready');})().catch(e=>{console.error(e.message);process.exitCode=1;});
