$ErrorActionPreference='Stop'
$env:TEMP='D:\TOKSCALE\temp';$env:TMP=$env:TEMP
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /codepage:65001 /target:winexe /platform:x64 /optimize+ /out:D:\TOKSCALE\native\TokenGlass.Widget.exe /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll /reference:System.Web.Extensions.dll D:\TOKSCALE\native\TokenGlass.cs
if($LASTEXITCODE -ne 0){throw 'Native build failed'}
& D:\TOKSCALE\runtime\node.exe -e "const fs=require('fs');const{pipe}=require('D:/TOKSCALE/app/src/paths.cjs');fs.writeFileSync('D:/TOKSCALE/native/config.json',JSON.stringify({pipe:pipe.replace(/^.*pipe\\/,'')}));"
