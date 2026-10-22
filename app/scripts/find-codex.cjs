const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
function findCodex(){
 if(process.env.TOKEN_GLASS_CODEX_EXE&&fs.existsSync(process.env.TOKEN_GLASS_CODEX_EXE))return process.env.TOKEN_GLASS_CODEX_EXE;
 const base=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData/Local'),'OpenAI/Codex/bin');
 try{for(const d of fs.readdirSync(base).reverse()){const file=path.join(base,d,'codex.exe');if(fs.existsSync(file))return file;}}catch{}
 return 'codex.exe';
}
module.exports={findCodex};
