'use strict';
function dayKey(time=Date.now()) { const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
const number=x=>Number.isFinite(Number(x))?Math.max(0,Number(x)):0;
function windowFrom(raw,source,id) {
  if(!raw)return null;
  const used=raw.usedPercent ?? raw.used_percent ?? raw.percentage;
  if(used==null||!Number.isFinite(Number(used)))return null;
  let reset=raw.resetsAt ?? raw.resets_at ?? raw.resetAt;
  if(typeof reset==='number'&&reset<1e12)reset*=1000;
  return {source,id,remaining:Math.max(0,Math.min(100,100-Number(used))),resetsAt:reset||null,minutes:raw.windowDurationMins??raw.window_minutes??null};
}
function codexQuota(container) {
  const q=container?.rateLimitsByLimitId?.codex || container?.rateLimits || container?.rate_limits || container;
  if(!q)return[];
  return ['primary','secondary'].map(k=>{
    const w=windowFrom(q[k],'codex',k);if(w)w.label=w.minutes===300?'5 小时':w.minutes===10080?'本周':w.minutes?`${w.minutes} 分钟`:k==='primary'?'主要额度':'次要额度';return w;
  }).filter(Boolean);
}
module.exports={dayKey,number,windowFrom,codexQuota};
