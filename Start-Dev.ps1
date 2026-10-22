$ErrorActionPreference = 'Stop'
$env:TEMP = 'D:\TOKSCALE\temp'
$env:TMP = $env:TEMP
$env:npm_config_cache = 'D:\TOKSCALE\cache\npm'
$env:ELECTRON_CACHE = 'D:\TOKSCALE\cache\electron'
$env:ELECTRON_BUILDER_CACHE = 'D:\TOKSCALE\cache\electron-builder'
$env:TOKEN_GLASS_DATA = 'D:\TOKSCALE\data'
Set-Location -LiteralPath 'D:\TOKSCALE\app'
npm start
