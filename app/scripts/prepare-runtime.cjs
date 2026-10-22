// Build setup only. Does not edit client configuration or trust records.
const fs=require('node:fs'),path=require('node:path');
const base='D:/TOKSCALE';
for(const dir of ['runtime','data','temp','cache','backups','work','outputs','hooks','app/vendor'])fs.mkdirSync(path.join(base,dir),{recursive:true});
const runtime=path.join(base,'runtime/node.exe');if(path.resolve(process.execPath).toLowerCase()!==path.resolve(runtime).toLowerCase())fs.copyFileSync(process.execPath,runtime);
const vendor=require.resolve('@tokscale/cli-win32-x64-msvc');fs.copyFileSync(vendor,path.join(base,'app/vendor/tokscale.exe'));
console.log('D-drive runtime and Tokscale vendor binary prepared. Client hooks were not changed.');
