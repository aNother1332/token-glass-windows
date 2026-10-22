// Run manually to remove only Token Glass registrations; preserve all other hooks.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const codex=path.join(os.homedir(),'.codex','config.toml');
if(fs.existsSync(codex)){
 const original=fs.readFileSync(codex,'utf8');const next=original.replace(/# BEGIN TOKEN GLASS[^\n]*\n[\s\S]*?# END TOKEN GLASS\r?\n?/,'');
 if(next!==original)fs.writeFileSync(codex,next);
}
const zcode='D:\\.zcode\\cli\\config.json';
if(fs.existsSync(zcode)){
 const o=JSON.parse(fs.readFileSync(zcode,'utf8'));
 for(const [event,groups]of Object.entries(o.hooks?.events||{})){
  o.hooks.events[event]=groups.map(g=>({...g,hooks:(g.hooks||[]).filter(h=>!(h.args||[]).includes('D:\\TOKSCALE\\hooks\\hook.cjs'))})).filter(g=>g.hooks.length);
 }
 fs.writeFileSync(zcode,JSON.stringify(o,null,2)+'\n');
}
fs.writeFileSync('D:\\TOKSCALE\\data\\hook-status.json',JSON.stringify({message:'钩子已解除登记，仍可手动打开历史面板。'}));
console.log('Token Glass hooks removed. Other hooks and local history were preserved.');
