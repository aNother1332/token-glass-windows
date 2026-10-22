const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const{readLines}=require('../src/log-lines.cjs');
test('bounded rollout reader preserves split UTF-8 and ignores huge tool lines',()=>{
 const file='D:/TOKSCALE/temp/line-reader-fixture.jsonl';
 const huge='x'.repeat(1500000),content='a'.repeat(65535)+'中\n'+huge+'\n'+JSON.stringify({type:'token_count',value:17})+'\n';fs.writeFileSync(file,content);
 const state={offset:0,tail:''},lines=[];const size=fs.statSync(file).size;
 try{while(state.offset<size)lines.push(...readLines(file,state,size,65536));assert.equal(lines[0],'a'.repeat(65535)+'中');assert.equal(lines.length,2);assert.equal(JSON.parse(lines[1]).value,17);assert.ok(state.tail.length<=512*1024);}finally{fs.unlinkSync(file);}
});
