'use strict';
(function(scope){
  function tokens(value){
    const parsed=Number(value);
    const n=Number.isFinite(parsed)?Math.max(0,parsed):0;
    return n<100000000?(n/10000).toFixed(1)+'万':(n/100000000).toFixed(1)+'亿';
  }
  if(typeof module==='object'&&module.exports)module.exports={tokens};
  else scope.TokenGlassFormat={tokens};
})(globalThis);
