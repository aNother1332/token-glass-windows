const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto');
// ZCode's installed v2 credential format: AES-GCM with its configured user secret.
// Read in memory only; never copy decrypted credentials into application data.
function decryptCredential(value){
  if(!value.startsWith('enc:v1:'))return value;
  const pieces=value.slice(7).split('.');if(pieces.length!==3)throw new Error('Unsupported credential format');
  const secret=process.env.ZCODE_CREDENTIAL_SECRET?.trim()||`zcode-credential-fallback:${os.platform()}:${os.homedir()}:${os.userInfo().username}`;
  const key=crypto.createHash('sha256').update(secret).digest();
  const [iv,tag,cipher]=pieces.map(p=>Buffer.from(p,'base64url'));if(iv.length!==12||tag.length!==16)throw new Error('Unsupported credential format');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(cipher),decipher.final()]).toString('utf8');
}
function parseZai(body,at=Date.now()){
  const windows=new Map();
  for(const r of body?.data?.limits||[]){
    if(!['TOKENS_LIMIT','CREDIT_LIMIT'].includes(r.type)||!Number.isFinite(r.percentage))continue;
    const id=r.unit===3&&r.number===5?'5h':r.unit===6&&r.number===1?'week':null;
    if(!id||windows.has(id)&&r.type!=='CREDIT_LIMIT')continue;
    let resetsAt=r.nextResetTime??r.next_reset_time??null;
    if(typeof resetsAt==='number')resetsAt=resetsAt>1e10?resetsAt:resetsAt>0?resetsAt*1000:null;
    windows.set(id,{source:'zcode',id,label:id==='5h'?'5 小时':'本周',remaining:100-Math.max(0,Math.min(100,r.percentage)),resetsAt,updatedAt:at});
  }
  return [...windows.values()];
}
async function zcodeQuota(provided){
  const home=process.env.ZCODE_HOME||'D:\\.zcode';
  const file=path.join(home,'v2','credentials.json');
  const credentials=provided||JSON.parse(fs.readFileSync(file,'utf8'));
  // Only existing Coding Plan API credentials; never OAuth tokens, custom provider keys or conversation data.
  const entries=Object.entries(credentials).filter(([k,v])=>/^account-provider:coding-plan:account:.*:api-key$/.test(k)&&typeof v==='string');
  const rows=[];
  for(const [id,value] of entries.slice(0,2)){
    let key;try{key=decryptCredential(value);}catch{continue;}
    const origin=id.includes('bigmodel')?'https://open.bigmodel.cn':id.includes('zai')?'https://api.z.ai':null;
    if(!origin||!key||key.length>4096||key.startsWith('enc:'))continue;
    const response=await fetch(origin+'/api/monitor/usage/quota/limit',{headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},signal:AbortSignal.timeout(6000),redirect:'error'});
    if(!response.ok)continue;
    rows.push(...parseZai(await response.json()));
  }
  return rows;
}
module.exports={parseZai,zcodeQuota,decryptCredential};
