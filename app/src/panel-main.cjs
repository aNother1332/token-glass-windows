'use strict';
// Full web panel is a client of the lightweight native host. It owns no hooks,
// activity lifecycle or background collector and exists only while opened.
const {app,BrowserWindow,ipcMain,nativeTheme,shell}=require('electron');
const fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {execFile}=require('node:child_process');
const {root,pipe:defaultPipe}=require('./paths.cjs');
const pipe=process.env.TOKEN_GLASS_PIPE?'\\\\.\\pipe\\'+process.env.TOKEN_GLASS_PIPE:defaultPipe;
const owned=new Set();let panel,state={},mtime=0,poll,closing=false;
for(const [key,value]of Object.entries({userData:path.join(root,'electron'),sessionData:path.join(root,'electron/session'),logs:path.join(root,'logs'),crashDumps:path.join(root,'crashes')}))app.setPath(key,value);
function command(command,extra={}){return new Promise((resolve,reject)=>{const s=net.connect(pipe);const timer=setTimeout(()=>{s.destroy();reject(new Error('原生小窗响应超时'));},1800);s.once('connect',()=>s.write(JSON.stringify({command,...extra})+'\n'));s.once('data',()=>{clearTimeout(timer);s.destroy();resolve();});s.once('error',e=>{clearTimeout(timer);reject(e);});});}
function read(){try{const file=path.join(root,'native-state.json'),next=fs.statSync(file).mtimeMs;if(next===mtime)return;mtime=next;state=JSON.parse(fs.readFileSync(file,'utf8'));nativeTheme.themeSource=state.settings?.theme||'system';if(panel&&!panel.isDestroyed()){panel.setBackgroundMaterial(state.settings?.solid?'none':'acrylic');panel.setBackgroundColor(state.settings?.solid?(nativeTheme.shouldUseDarkColors?'#171b24':'#f4f6fb'):'#00000000');panel.webContents.send('state',state);}}catch{}}
if(!app.requestSingleInstanceLock()){app.quit();return;}
app.on('second-instance',()=>{panel?.show();panel?.focus();});
app.whenReady().then(()=>{
 read();panel=new BrowserWindow({width:1180,height:820,minWidth:850,minHeight:620,frame:false,show:false,backgroundMaterial:'acrylic',backgroundColor:'#00000000',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 panel.loadFile(path.join(__dirname,'../ui/index.html'),{query:{view:'panel'}});panel.once('ready-to-show',()=>panel.show());panel.webContents.setWindowOpenHandler(()=>({action:'deny'}));panel.on('closed',()=>app.quit());
 poll=setInterval(read,1000);command('panel-open').catch(()=>{});
});
app.on('before-quit',()=>{if(closing)return;closing=true;clearInterval(poll);for(const c of owned)try{execFile('taskkill.exe',['/PID',String(c.pid),'/T','/F'],{windowsHide:true});}catch{}command('panel-closed').catch(()=>{});});
app.on('window-all-closed',()=>app.quit());
ipcMain.handle('get-state',()=>{read();return state;});
ipcMain.handle('action',async(_event,name,value)=>{
 if(name==='minimize')return panel.minimize();
 if(name==='close-panel')return panel.close();
 if(name==='open-panel')return panel.focus();
 if(name==='setting')return command('setting',{key:value.key,value:value.value});
 if(name==='export'){const file=path.join('D:/TOKSCALE/outputs',`token-glass-${Date.now()}.json`);fs.writeFileSync(file,JSON.stringify(state.graph,null,2));shell.showItemInFolder(file);return file;}
 if(['show-widget','refresh','quit'].includes(name))return command(name);
});
ipcMain.handle('detail',(_event,view,client='all')=>{
 if(!['sessions','projects','models','hourly'].includes(view)||client!=='all'&&!/^[a-z0-9-]{1,40}$/.test(client))throw new Error('Unknown report');
 const strategies={sessions:'session,model',projects:'workspace,model',models:'client,model'};
 const args=view==='hourly'?['hourly','--json','--no-spinner','--today']:['--json','--no-spinner','--group-by',strategies[view]];
 if(view==='hourly'&&client!=='all')args.push('--client',client);
 return new Promise((resolve,reject)=>{const c=execFile(path.join(process.resourcesPath,'vendor/tokscale.exe'),args,{windowsHide:true,timeout:45000,maxBuffer:40*1024*1024,env:{...process.env,TEMP:'D:/TOKSCALE/temp',TMP:'D:/TOKSCALE/temp',TOKSCALE_CONFIG_DIR:path.join(root,'tokscale'),TOKSCALE_PRICING_CACHE_ONLY:'1'}},(err,stdout)=>{owned.delete(c);if(err)return reject(new Error('统计读取失败'));try{resolve(JSON.parse(stdout.replace(/^\uFEFF/,'')));}catch{reject(new Error('统计数据格式错误'));}});owned.add(c);});
});
