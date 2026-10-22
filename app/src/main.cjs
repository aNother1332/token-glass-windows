'use strict';
if(process.argv.includes('--native-panel')){require('./panel-main.cjs');return;}
if(!process.argv.includes('--legacy')){
 const {app}=require('electron');const {spawn}=require('node:child_process');
 const args=process.argv.slice(app.isPackaged?1:2),env={...process.env,TEMP:'D:/TOKSCALE/temp',TMP:'D:/TOKSCALE/temp'};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn('D:/TOKSCALE/native/TokenGlass.Widget.exe',args,{detached:true,stdio:'ignore',windowsHide:true,env});child.on('error',()=>app.exit(1));child.once('spawn',()=>{child.unref();app.exit(0);});return;
}
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {fork,execFile}=require('node:child_process');
process.env.TEMP='D:\\TOKSCALE\\temp';process.env.TMP=process.env.TEMP;
fs.mkdirSync(process.env.TEMP,{recursive:true});
const {app,BrowserWindow,ipcMain,Menu,Tray,nativeImage,nativeTheme,screen,shell}=require('electron');
const {root,pipe}=require('./paths.cjs');
const {Activity,safeEvent}=require('./lifecycle.cjs');
const {dayKey}=require('./model.cjs');
const windows=require('./windows.cjs');
fs.mkdirSync(root,{recursive:true});
app.setPath('userData',path.join(root,'electron'));app.setPath('sessionData',path.join(root,'electron','session'));app.setPath('logs',path.join(root,'logs'));app.setPath('crashDumps',path.join(root,'crashes'));
app.commandLine.appendSwitch('disable-http-cache');
const args=process.argv.slice(app.isPackaged?1:2);
const readEvent=a=>{try{const i=a.indexOf('--event');return i>=0?safeEvent(JSON.parse(Buffer.from(a[i+1],'base64').toString())):null;}catch{return null;}};
const initial=readEvent(args);
if(!app.requestSingleInstanceLock({event:initial,manual:!initial})) {app.quit();return;}
const activity=new Activity();let widget,panel,tray,server,collector,exiting=false,exitTimer,healthTimer;
const pending=new Map(),ownedChildren=new Set();let nextId=0;
let snapshot={graph:null,speeds:[],quotas:[],warnings:[],scanning:true};
const runtimeFile=path.join(root,'runtime.json');
function runtime(){fs.writeFileSync(runtimeFile,JSON.stringify({pid:process.pid,collector:collector?.pid,active:activity.active,manualPanel:activity.manualPanel,updatedAt:Date.now()}));}
const configFile=path.join(root,'settings.json');
let settings={theme:'system',layer:'top',expanded:false,opacity:0.7,solid:false,position:null};
try{settings={...settings,...JSON.parse(fs.readFileSync(configFile,'utf8'))};}catch{}
function save(){fs.writeFileSync(configFile,JSON.stringify(settings,null,2));}
function state(){let hookStatus;try{hookStatus=JSON.parse(fs.readFileSync(path.join(root,'hook-status.json'),'utf8')).message;}catch{}return {...snapshot,active:activity.active,settings,manual:activity.manualPanel,hookStatus};}
function broadcast(){for(const w of [widget,panel])if(w&&!w.isDestroyed())w.webContents.send('state',state());}
function bounds(){
  const quotaExtra=Math.max(0,Math.ceil((snapshot.quotas?.length||0)/2)-1)*43;
  const sourceCount=new Set((snapshot.graph?.contributions?.find(d=>d.date===dayKey())?.clients||[]).map(c=>c.client)).size;
  const area=screen.getPrimaryDisplay().workArea;const width=314,height=260+(settings.expanded?Math.min(174,sourceCount*36+24):0)+quotaExtra;
  const p=settings.position||{x:area.x+area.width-width-28,y:area.y+80};
  const display=screen.getDisplayMatching({...p,width,height}).workArea;
  return {x:Math.max(display.x,Math.min(p.x,display.x+display.width-width)),y:Math.max(display.y,Math.min(p.y,display.y+display.height-height)),width,height};
}
function applyAppearance(w){
  if(!w||w.isDestroyed())return;
  nativeTheme.themeSource=settings.theme;
  try{w.setBackgroundMaterial(settings.solid?'none':'acrylic');}catch{}
  w.setBackgroundColor(settings.solid?(nativeTheme.shouldUseDarkColors?'#171b24':'#f4f6fb'):'#00000000');
}
function createWidget(){
  if(widget&&!widget.isDestroyed()){widget.showInactive();return;}
  widget=new BrowserWindow({...bounds(),frame:false,thickFrame:false,hasShadow:false,show:false,resizable:false,maximizable:false,minimizable:false,skipTaskbar:true,roundedCorners:true,backgroundMaterial:settings.solid?'none':'acrylic',backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  widget.loadFile(path.join(__dirname,'../ui/index.html'),{query:{view:'widget'}});
  widget.once('ready-to-show',()=>{applyAppearance(widget);setLayer();widget.showInactive();windows.round(widget,screen.getDisplayMatching(widget.getBounds()).scaleFactor);broadcast();});
  widget.on('focus',()=>{if(settings.layer==='bottom')windows.bottom(widget);});
  widget.on('resize',()=>{if(widget&&!widget.isDestroyed())windows.round(widget,screen.getDisplayMatching(widget.getBounds()).scaleFactor);});
  widget.on('moved',()=>{if(!widget||widget.isDestroyed())return;const{x,y}=widget.getBounds();settings.position={x,y};save();});
  widget.on('close',e=>{if(!exiting){e.preventDefault();quit(true);}});
  widget.webContents.setWindowOpenHandler(()=>({action:'deny'}));
}
function setLayer(){if(!widget||widget.isDestroyed())return;widget.setAlwaysOnTop(settings.layer==='top');if(settings.layer==='bottom')windows.bottom(widget);}
function openPanel(){
  clearTimeout(exitTimer);activity.manualPanel=true;
  if(panel&&!panel.isDestroyed()){panel.show();panel.focus();broadcast();return;}
  const area=screen.getPrimaryDisplay().workArea;
  panel=new BrowserWindow({width:Math.min(1180,area.width-60),height:Math.min(820,area.height-60),minWidth:850,minHeight:620,frame:false,show:false,roundedCorners:true,backgroundMaterial:'acrylic',backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
  panel.loadFile(path.join(__dirname,'../ui/index.html'),{query:{view:'panel'}});
  panel.once('ready-to-show',()=>{applyAppearance(panel);panel.show();broadcast();});
  panel.on('closed',()=>{panel=null;activity.manualPanel=false;if(activity.canExit)quit(false);else broadcast();});
  panel.webContents.setWindowOpenHandler(()=>({action:'deny'}));
}
function receive(raw){
  let e;try{e=safeEvent(raw);}catch{return;}
  activity.receive(e);clearTimeout(exitTimer);
  runtime();
  if(e.kind==='start')createWidget();
  collector?.send({type:'active',active:activity.active});collector?.send({type:'refresh'});broadcast();
  if(activity.canExit)exitTimer=setTimeout(()=>quit(false),3000);
}
function quit(manual){
  if(exiting)return;exiting=true;clearTimeout(exitTimer);clearInterval(healthTimer);
  try{fs.unlinkSync(runtimeFile);}catch{}
  server?.close();tray?.destroy();
  for(const w of [widget,panel])if(w&&!w.isDestroyed())w.destroy();
  const kills=[...ownedChildren];if(collector?.pid)kills.push(collector.pid);
  if(collector?.connected)collector.send({type:'stop'});
  if(kills.length)Promise.allSettled(kills.map(pid=>new Promise(resolve=>execFile('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true,timeout:3500},resolve)))).then(()=>app.exit(0));else app.exit(0);
  setTimeout(()=>app.exit(0),4500).unref();
}
app.on('second-instance',(_e,_argv,_cwd,data)=>{if(data?.event)receive(data.event);else openPanel();});
app.on('window-all-closed',()=>{if(!exiting&&activity.canExit)quit(false);});
app.on('before-quit',e=>{if(!exiting){e.preventDefault();quit(true);}});
app.whenReady().then(()=>{
  // Diagnostic legacy windows must not overwrite the native launch pointer.
  if(process.env.TOKEN_GLASS_LEGACY_INSTALL==='1')fs.writeFileSync(path.join(root,'installation.json'),JSON.stringify({exe:process.execPath,args:app.isPackaged?['--legacy']:[app.getAppPath(),'--legacy']}));
  const vendor=app.isPackaged?path.join(process.resourcesPath,'vendor'):path.join(__dirname,'../vendor');
  collector=fork(path.join(__dirname,'collector.cjs'),[],{execPath:process.execPath,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',TOKEN_GLASS_DATA:root,TOKEN_GLASS_TOKSCALE:path.join(vendor,'tokscale.exe'),NODE_NO_WARNINGS:'1'},stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});
  runtime();
  collector.on('message',m=>{
    if(m.type==='snapshot'){const count=snapshot.quotas?.length||0;snapshot=m.data;if(widget&&!widget.isDestroyed()&&count!==(snapshot.quotas?.length||0))widget.setBounds(bounds());broadcast();}
    if(m.type==='child-started')ownedChildren.add(m.pid);
    if(m.type==='child-exited')ownedChildren.delete(m.pid);
    if(m.type==='turn-ended'){const turn=activity.active.find(t=>t.source===m.source&&t.session===m.session);if(turn&&m.at>=turn.since)receive({...m,kind:'stop'});}
    if(m.type==='detail'){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.data);}}
  });
  collector.on('exit',()=>{if(!exiting){snapshot.warnings=['采集进程已退出，请重新打开监控'];broadcast();}});
  server=net.createServer(socket=>{
    let input='';socket.setTimeout(1500,()=>socket.destroy());socket.on('data',b=>{input+=b;if(input.length>4096){socket.destroy();return;}if(input.includes('\n')){try{receive(JSON.parse(input.split('\n')[0]));socket.end('ok');}catch{socket.destroy();}}});
  });server.on('error',()=>{});server.listen(pipe);
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'../ui/icon.png')));tray.setToolTip('Token Glass · 回答期间运行');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'查看统计面板',click:openPanel},{label:'显示悬浮窗',click:createWidget},{type:'separator'},{label:'退出监控',click:()=>quit(true)}]));tray.on('click',openPanel);
  healthTimer=setInterval(()=>{
    for(const t of activity.active){if(!t.hostPid)continue;try{process.kill(t.hostPid,0);}catch{receive({...t,kind:'stop'});}}
  },3000);
  if(initial)receive(initial);else openPanel();
});
ipcMain.handle('get-state',()=>state());
ipcMain.handle('action',(_event,name,value)=>{
  if(name==='open-panel')openPanel();
  else if(name==='close-panel')panel?.close();
  else if(name==='minimize')panel?.minimize();
  else if(name==='quit')quit(true);
  else if(name==='show-widget')createWidget();
  else if(name==='refresh')collector?.send({type:'refresh'});
  else if(name==='export'){const file=path.join('D:\\TOKSCALE\\outputs',`token-glass-${Date.now()}.json`);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(snapshot.graph,null,2));shell.showItemInFolder(file);return file;}
  else if(name==='setting'){
    if(!value||!['theme','layer','expanded','opacity','solid'].includes(value.key))return;
    const allowed={theme:['system','light','dark'],layer:['top','normal','bottom']};
    if(allowed[value.key]&&!allowed[value.key].includes(value.value))return;
    settings[value.key]=value.key==='opacity'?Math.max(0.25,Math.min(0.95,Number(value.value))):value.value;
    save();if(widget&&!widget.isDestroyed())widget.setBounds(bounds());setLayer();for(const w of [widget,panel])applyAppearance(w);broadcast();
  }
});
ipcMain.handle('detail',(_event,view,client='all')=>{
  if(!['sessions','projects','models','hourly'].includes(view))throw new Error('Unknown view');
  if(client!=='all'&&!/^[a-z0-9-]{1,40}$/.test(client))throw new Error('Unknown client');
  return new Promise((resolve,reject)=>{const id=++nextId;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('读取超时，可稍后重试'));},50000);pending.set(id,{resolve,reject,timer});collector.send({type:'detail',id,view,client});});
});
