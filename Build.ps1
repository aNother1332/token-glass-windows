$ErrorActionPreference = 'Stop'
$env:TEMP = 'D:\TOKSCALE\temp'
$env:TMP = $env:TEMP
$env:npm_config_cache = 'D:\TOKSCALE\cache\npm'
$env:ELECTRON_CACHE = 'D:\TOKSCALE\cache\electron'
$env:ELECTRON_BUILDER_CACHE = 'D:\TOKSCALE\cache\electron-builder'
Set-Location -LiteralPath 'D:\TOKSCALE\app'
$env:PYTHONIOENCODING='utf-8'
python scripts\subset-fonts.py
if($LASTEXITCODE -ne 0){throw 'Font subset build failed'}
& D:\TOKSCALE\native\Build.ps1
npm run build
if($LASTEXITCODE -ne 0){throw 'Electron panel build failed'}
