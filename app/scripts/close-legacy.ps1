param([int]$MonitorPid)
$proc=Get-Process -Id $MonitorPid -ErrorAction SilentlyContinue
if(!$proc){exit 0}
if($proc.Path -ine 'D:\TOKSCALE\desktop\Token Glass.exe'){throw 'Refusing to close an unrelated process'}
Add-Type @'
using System;using System.Runtime.InteropServices;
public class TgClose {public delegate bool CB(IntPtr h,IntPtr p);[DllImport("user32.dll")]public static extern bool EnumWindows(CB c,IntPtr p);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport("user32.dll")]public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);public static void Close(uint pid){EnumWindows((h,p)=>{uint x;GetWindowThreadProcessId(h,out x);if(x==pid)PostMessage(h,0x10,IntPtr.Zero,IntPtr.Zero);return true;},IntPtr.Zero);}}
'@
[TgClose]::Close($MonitorPid)
try{Wait-Process -Id $MonitorPid -Timeout 6 -ErrorAction Stop}catch{& taskkill.exe /PID $MonitorPid /T /F | Out-Null}
