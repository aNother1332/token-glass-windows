// End-to-end rate follows zcode-tps; Codex timing boundaries follow Token Pulse.
function requestRate(output,duration,ttft){
  if(!Number.isFinite(output)||output<=0||!Number.isFinite(duration)||duration<1000||duration>3600000)return{rate:null,decode:null};
  return{rate:output/(duration/1000),decode:Number.isFinite(ttft)&&ttft>=0&&ttft<=duration&&duration-ttft>=200?output/((duration-ttft)/1000):null};
}
module.exports={requestRate};
