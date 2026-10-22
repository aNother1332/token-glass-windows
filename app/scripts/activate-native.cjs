const fs=require('node:fs'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process'),net=require('node:net');
const base='D:/TOKSCALE',runtime=base+'/data/runtime.json',install=base+'/data/installation.json';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const exe=base+'/native/TokenGlass.Widget.exe';if(!fs.existsSync(exe))throw new Error('Build native widget first');
 let active=[];try{const old=JSON.parse(fs.readFileSync(runtime,'utf8'));if(old.native)throw new Error('Close native widget before deployment');active=old.active||[];execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',base+'/app/scripts/close-legacy.ps1','-MonitorPid',String(old.pid)],{windowsHide:true,timeout:12000});}catch(e){if(e.code!=='ENOENT')throw e;}
 await wait(1000);fs.cpSync(base+'/build/win-unpacked',base+'/desktop',{recursive:true,force:true});
 if(fs.existsSync(install))fs.copyFileSync(install,base+'/backups/installation.before-native.json');
 fs.writeFileSync(install,JSON.stringify({exe,args:[]}));
 const vbs=fs.readFileSync(base+'/Token Glass.vbs','utf8').replace('D:\\TOKSCALE\\desktop\\Token Glass.exe','D:\\TOKSCALE\\native\\TokenGlass.Widget.exe');fs.writeFileSync(base+'/Token Glass.vbs',vbs);
 if(active.length){const first={...active[0],kind:'start',at:Date.now()};const child=spawn(exe,['--event',Buffer.from(JSON.stringify(first)).toString('base64')],{detached:true,stdio:'ignore',windowsHide:true});child.unref();const pipe=require('../src/paths.cjs').pipe;
  for(let i=0;i<40;i++){try{if(JSON.parse(fs.readFileSync(runtime,'utf8')).native)break;}catch{}await wait(100);}
  for(const event of active.slice(1))await new Promise((resolve,reject)=>{const s=net.connect(pipe);s.once('connect',()=>s.write(JSON.stringify({...event,kind:'start',at:Date.now()})+'\n'));s.once('data',()=>{s.destroy();resolve();});s.once('error',reject);});
 }
 console.log(JSON.stringify({nativeLauncher:exe,migratedActiveTasks:active.length,hooksUnchanged:true}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
