const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('tokenGlass',{
  state:()=>ipcRenderer.invoke('get-state'),
  action:(name,value)=>ipcRenderer.invoke('action',name,value),
  detail:(view,client)=>ipcRenderer.invoke('detail',view,client),
  subscribe:callback=>{const fn=(_event,data)=>callback(data);ipcRenderer.on('state',fn);return()=>ipcRenderer.removeListener('state',fn);}
});
