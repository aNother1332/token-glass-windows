const fs=require('node:fs'),path=require('node:path');
const base='D:\\TOKSCALE';fs.mkdirSync(path.join(base,'hooks'),{recursive:true});fs.mkdirSync(path.join(base,'runtime'),{recursive:true});
fs.copyFileSync(process.execPath,path.join(base,'runtime','node.exe'));
for(const f of ['hook.cjs','paths.cjs'])fs.copyFileSync(path.join(__dirname,'../src',f),path.join(base,'hooks',f));
const node=path.join(base,'runtime','node.exe'),script=path.join(base,'hooks','hook.cjs');
const zhooks={UserPromptSubmit:[{hooks:[{type:'process',command:node,args:[script,'zcode','start'],timeoutMs:4000}]}],Stop:[{hooks:[{type:'process',command:node,args:[script,'zcode','stop'],timeoutMs:2000}]}]};
fs.writeFileSync(path.join(base,'hooks','zcode-additions.json'),JSON.stringify(zhooks,null,2));
let toml='# BEGIN TOKEN GLASS — scripts and runtime are on D:\\TOKSCALE\n';
for(const [name,kind]of [['UserPromptSubmit','start'],['Stop','stop'],['Interrupt','stop'],['SessionEnd','stop']]){
 // Both paths are fixed and contain no spaces. Bare executable invocation works
 // in PowerShell and cmd; a quoted executable alone is not PowerShell syntax.
 toml+=`\n[[hooks.${name}]]\n[[hooks.${name}.hooks]]\ntype = "command"\ncommand = '${node} ${script} codex ${kind}'\ntimeout = ${kind==='start'?4:2}\n`;
}
toml+='# END TOKEN GLASS\n';fs.writeFileSync(path.join(base,'hooks','codex-additions.toml'),toml);
console.log(JSON.stringify({codexBytes:Buffer.byteLength(toml),zcodeBytes:fs.statSync(path.join(base,'hooks','zcode-additions.json')).size,filesRoot:base}));
