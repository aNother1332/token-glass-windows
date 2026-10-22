$ErrorActionPreference='Stop'
$root='D:\TOKSCALE\work\native-test'
& D:\TOKSCALE\runtime\node.exe D:\TOKSCALE\app\scripts\native-control.cjs --test '{"command":"open-panel"}'
Start-Sleep -Seconds 3
$runtime=Get-Content -LiteralPath (Join-Path $root 'runtime.json') -Raw|ConvertFrom-Json
if(!$runtime.manualPanel){throw 'Panel was not retained'}
$all=@(Get-CimInstance Win32_Process);$ids=[System.Collections.Generic.HashSet[int]]::new();[void]$ids.Add([int]$runtime.pid)
do{$added=$false;foreach($entry in $all){if($ids.Contains([int]$entry.ParentProcessId)-and $ids.Add([int]$entry.ProcessId)){$added=$true}}}while($added)
$owned=@($all|Where-Object {$ids.Contains([int]$_.ProcessId)})
if(!@($owned|Where-Object Name -eq 'Token Glass.exe').Count){throw 'Native host did not start the web panel'}
& D:\TOKSCALE\runtime\node.exe D:\TOKSCALE\app\scripts\native-control.cjs --test
Start-Sleep -Seconds 2
foreach($entry in $owned){if(Get-Process -Id $entry.ProcessId -ErrorAction SilentlyContinue){throw "Owned process survived native quit: $($entry.ProcessId)"}}
if(Test-Path (Join-Path $root 'runtime.json')){throw 'Runtime marker survived quit'}
$report=[pscustomobject]@{nativeStartedPanel=$true;ownedProcessCount=$owned.Count;manualPanelRetained=$true;allOwnedProcessesExited=$true}
$report|ConvertTo-Json|Set-Content D:\TOKSCALE\outputs\native-owned-panel-verification.json -Encoding utf8
$report|ConvertTo-Json
