// Regression: execute the registered command through actual Windows shells.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs'),assert=require('node:assert/strict');
const cfg=fs.readFileSync(require('node:path').join(require('node:os').homedir(),'.codex/config.toml'),'utf8');
const command=cfg.match(/command = '([^'\r\n]*TOKSCALE[^'\r\n]*codex start)'/)[1];
const status='D:/TOKSCALE/data/hook-codex-start.json';
const env={...process.env,TEMP:'D:/TOKSCALE/temp',TMP:'D:/TOKSCALE/temp'};
delete env.CODEX_THREAD_ID;delete env.ZCODE_SESSION_ID;
for(const [shell,args] of [['powershell.exe',['-NoProfile','-NonInteractive','-Command',command]],['cmd.exe',['/d','/s','/c',command]]]){
 const at=Date.now();
 const r=spawnSync(shell,args,{input:'{}',encoding:'utf8',windowsHide:true,timeout:10000,env});
 assert.equal(r.status,0,shell+' failed to execute registered hook');
 const recorded=JSON.parse(fs.readFileSync(status,'utf8'));
 assert.ok(recorded.at>=at,shell+' did not reach hook script');
 assert.equal(recorded.phase,'invalid-input'); // Empty fixture must not launch app.
 console.log(JSON.stringify({shell,exit:r.status,reachedHook:true}));
}
