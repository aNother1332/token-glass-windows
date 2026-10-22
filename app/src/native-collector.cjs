'use strict';
// The native host owns the process lifetime. Reuse exactly the same collection
// logic with a bounded newline protocol, without loading Electron/Chromium.
const readline=require('node:readline');
process.send=m=>process.stdout.write(JSON.stringify(m)+'\n');
readline.createInterface({input:process.stdin}).on('line',line=>{
 if(line.length>262144)return;
 try{process.emit('message',JSON.parse(line));}catch{}
}).on('close',()=>process.emit('disconnect'));
require('./collector.cjs');
