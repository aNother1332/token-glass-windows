const{test}=require('node:test');
const assert=require('node:assert/strict');
const{tokens}=require('../ui/format.js');
test('below one hundred million uses 万 with exactly one decimal',()=>{
  for(const[n,expected]of [[0,'0.0万'],[1000,'0.1万'],[10000,'1.0万'],[123456,'12.3万'],[99995000,'9999.5万'],[99999999,'10000.0万']])assert.equal(tokens(n),expected);
});
test('one hundred million and above uses 亿 with exactly one decimal',()=>{
  for(const[n,expected]of [[100000000,'1.0亿'],[125000000,'1.3亿'],[2030000000,'20.3亿']])assert.equal(tokens(n),expected);
});
