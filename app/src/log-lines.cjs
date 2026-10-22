'use strict';
const fs=require('node:fs');
const {StringDecoder}=require('node:string_decoder');
// Bound allocations even when a rollout contains a multi-megabyte tool result.
function readLines(file,state,size,budget=1024*1024){
 const lines=[],fd=fs.openSync(file,'r'),buffer=Buffer.allocUnsafe(64*1024);
 let remaining=Math.min(size-state.offset,budget);
 try{while(remaining>0){const n=fs.readSync(fd,buffer,0,Math.min(buffer.length,remaining),state.offset);if(!n)break;state.offset+=n;remaining-=n;
  state.decoder??=new StringDecoder('utf8');
  const text=state.tail+state.decoder.write(buffer.subarray(0,n)),parts=text.split('\n');state.tail=parts.pop();
  for(const line of parts){if(state.discardLine){state.discardLine=false;continue;}if(line.length<=512*1024)lines.push(line);}
  if(state.tail.length>512*1024){state.tail='';state.discardLine=true;}
 }}finally{fs.closeSync(fd);}return lines;
}
module.exports={readLines};
