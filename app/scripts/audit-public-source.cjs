const{execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const base='D:/TOKSCALE';const files=execFileSync('git',['-C',base,'diff','--cached','--name-only','--diff-filter=ACMR','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const forbidden=/^(?:data|work|backups|cache|temp|outputs|desktop|build|runtime|hooks)\/|(?:^|\/)node_modules\/|\.(?:exe|dll|sqlite|db|jsonl|log)$/i;
const secrets=[/\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/,/\bsk-[A-Za-z0-9_-]{24,}\b/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/C:[\\/]Users[\\/][^\\/\s'"<>]+/i,/CODEX_THREAD_ID\s*[:=]\s*['"][0-9a-f-]{30,}['"]/];
const failures=[];
for(const file of files){if(forbidden.test(file)){failures.push({file,reason:'runtime/private path'});continue;}const bytes=execFileSync('git',['-C',base,'show',':'+file]);if(bytes.includes(0))continue;const text=bytes.toString('utf8');for(const regex of secrets)if(regex.test(text))failures.push({file,reason:'secret or machine-specific identifier pattern'});}
// Ensure the ignore policy protects actual local artifacts, without reading them.
const protectedPaths=['data/snapshot.json','backups/codex-config.before-command-fix.toml','outputs/panel-maple-light.png','work/native-test/native-state.json','runtime/node.exe','native/config.json'];
for(const file of protectedPaths){try{execFileSync('git',['-C',base,'check-ignore','--quiet',file]);}catch{failures.push({file,reason:'not ignored'});}}
const report={stagedFiles:files.length,protectedPaths:protectedPaths.length,passed:failures.length===0,failures};fs.writeFileSync(path.join(base,'outputs/public-source-audit.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(failures.length)process.exitCode=1;
