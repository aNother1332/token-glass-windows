param([int]$Samples=12,[int]$IntervalSeconds=5,[string]$Output='D:\TOKSCALE\outputs\widget-memory.json',[string]$DataRoot='D:\TOKSCALE\data')
$ErrorActionPreference='Stop'
$records=@()
function Read-RuntimeMarker {
 for($attempt=0;$attempt -lt 12;$attempt++){
  try{return (Get-Content -LiteralPath (Join-Path $DataRoot 'runtime.json') -Raw|ConvertFrom-Json)}catch{if($attempt -eq 11){throw};Start-Sleep -Milliseconds 20}
 }
}
for($i=0;$i -lt $Samples;$i++){
 $runtime=Read-RuntimeMarker
 $all=@(Get-CimInstance Win32_Process)
 $resident=@{};Get-CimInstance Win32_PerfFormattedData_PerfProc_Process|ForEach-Object {$resident[[int]$_.IDProcess]=[double]$_.WorkingSetPrivate}
 $ids=[System.Collections.Generic.HashSet[int]]::new();[void]$ids.Add([int]$runtime.pid)
 do{$added=$false;foreach($entry in $all){if($ids.Contains([int]$entry.ParentProcessId) -and $ids.Add([int]$entry.ProcessId)){$added=$true}}}while($added)
 $rows=@(foreach($entry in $all){if(!$ids.Contains([int]$entry.ProcessId)){continue};$proc=Get-Process -Id $entry.ProcessId -ErrorAction SilentlyContinue;if(!$proc){continue}
 $role=if($entry.ProcessId -eq $runtime.pid){'main'}elseif($entry.ProcessId -eq $runtime.collector){'collector'}elseif($entry.CommandLine -match '--type=([^ ]+)'){$Matches[1]}else{$entry.Name}
 [pscustomobject]@{pid=$proc.Id;role=$role;workingSetMiB=[math]::Round($proc.WorkingSet64/1MB,2);privateWorkingSetMiB=[math]::Round($resident[[int]$proc.Id]/1MB,2);privateBytesMiB=[math]::Round($proc.PrivateMemorySize64/1MB,2)}
 })
 if(!@($rows|Where-Object role -eq 'main').Count){throw 'Runtime marker points to an exited process; wait for widget startup before sampling'}
 $records+=[pscustomobject]@{at=(Get-Date).ToString('o');manualPanel=$runtime.manualPanel;native=[bool]$runtime.native;processes=$rows;totalWorkingSetMiB=[math]::Round(($rows|Measure-Object workingSetMiB -Sum).Sum,2);totalPrivateWorkingSetMiB=[math]::Round(($rows|Measure-Object privateWorkingSetMiB -Sum).Sum,2);totalPrivateBytesMiB=[math]::Round(($rows|Measure-Object privateBytesMiB -Sum).Sum,2)}
 if($i -lt $Samples-1){Start-Sleep -Seconds $IntervalSeconds}
}
$report=[pscustomobject]@{mode='widget only, no detail panel';samples=$Samples;intervalSeconds=$IntervalSeconds;note='Working set includes shared pages and may double count them across processes; private working set is private resident RAM; private bytes is committed private memory.';workingSetMiB=($records|Measure-Object totalWorkingSetMiB -Minimum -Maximum -Average|Select-Object Minimum,Maximum,Average);privateWorkingSetMiB=($records|Measure-Object totalPrivateWorkingSetMiB -Minimum -Maximum -Average|Select-Object Minimum,Maximum,Average);privateBytesMiB=($records|Measure-Object totalPrivateBytesMiB -Minimum -Maximum -Average|Select-Object Minimum,Maximum,Average);records=$records}
$report|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $Output -Encoding utf8
$report|Select-Object mode,samples,workingSetMiB,privateWorkingSetMiB,privateBytesMiB|ConvertTo-Json -Depth 4
