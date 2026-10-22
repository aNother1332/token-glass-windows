const net=require('node:net'),fs=require('node:fs');
const config=JSON.parse(fs.readFileSync('D:/TOKSCALE/native/config.json','utf8'));
const pipe='\\\\.\\pipe\\'+config.pipe+(process.argv.includes('--test')?'-test':'');
const command=process.argv.find(a=>a.startsWith('{'));
const s=net.connect(pipe);const timer=setTimeout(()=>{s.destroy();process.exitCode=1;},2500);
s.once('connect',()=>s.write((command||'{"command":"quit"}')+'\n'));s.on('data',()=>{clearTimeout(timer);s.destroy();});s.on('end',()=>clearTimeout(timer));s.on('error',e=>{clearTimeout(timer);console.error(e.code);process.exitCode=1;});
