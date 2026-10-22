const fs=require('node:fs');
const file='D:/TOKSCALE/outputs/native-widget-memory-long.json';const raw=JSON.parse(fs.readFileSync(file,'utf8'));
fs.writeFileSync(file.replace('.json','.raw.json'),JSON.stringify(raw,null,2));
const records=raw.records.filter(s=>s.native&&!s.manualPanel&&s.processes.some(p=>p.role==='main')&&s.totalPrivateWorkingSetMiB>0);
const stats=field=>{const values=records.map(r=>r[field]);return{Minimum:Math.min(...values),Maximum:Math.max(...values),Average:values.reduce((a,b)=>a+b,0)/values.length};};
const report={...raw,samples:records.length,attemptedSamples:raw.records.length,excludedSamples:raw.records.length-records.length,exclusionReason:'A cold-start marker referenced the previous, exited test host before the new process wrote runtime.json. Zero-process samples are invalid, not zero memory usage.',workingSetMiB:stats('totalWorkingSetMiB'),privateWorkingSetMiB:stats('totalPrivateWorkingSetMiB'),privateBytesMiB:stats('totalPrivateBytesMiB'),durationSeconds:(Date.parse(records.at(-1).at)-Date.parse(records[0].at))/1000,records};
fs.writeFileSync(file,JSON.stringify(report,null,2));
let baseline;try{baseline=JSON.parse(fs.readFileSync('D:/TOKSCALE/outputs/widget-memory.json','utf8'));}catch{}
console.log(JSON.stringify({samples:report.samples,excluded:report.excludedSamples,durationSeconds:report.durationSeconds,workingSet:report.workingSetMiB,privateWorkingSet:report.privateWorkingSetMiB,privateBytes:report.privateBytesMiB,privateWorkingSetReductionPercent:baseline?.privateWorkingSetMiB?100*(1-report.privateWorkingSetMiB.Average/baseline.privateWorkingSetMiB.Average):null},null,2));
