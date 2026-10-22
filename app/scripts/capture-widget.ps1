param([string]$Output='D:\TOKSCALE\outputs\widget-edge-before.png',[string]$DataRoot='D:\TOKSCALE\data')
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;using System.Runtime.InteropServices;
public class TgCapture {public delegate bool CB(IntPtr h,IntPtr p);[StructLayout(LayoutKind.Sequential)]public struct RECT{public int left,top,right,bottom;}[DllImport("user32.dll")]public static extern bool EnumWindows(CB c,IntPtr p);[DllImport("user32.dll")]public static extern bool IsWindowVisible(IntPtr h);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);[DllImport("user32.dll")]public static extern bool GetWindowRect(IntPtr h,out RECT r);[DllImport("user32.dll")]public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);public static IntPtr Find(uint pid){IntPtr found=IntPtr.Zero;EnumWindows((h,p)=>{uint x;GetWindowThreadProcessId(h,out x);RECT r;GetWindowRect(h,out r);if(x==pid&&IsWindowVisible(h)&&r.right-r.left>200){found=h;return false;}return true;},IntPtr.Zero);return found;}}
'@
$runtime=Get-Content -LiteralPath (Join-Path $DataRoot 'runtime.json') -Raw|ConvertFrom-Json
$hwnd=[TgCapture]::Find($runtime.pid);if($hwnd -eq [IntPtr]::Zero){throw 'No visible widget'}
$rect=New-Object TgCapture+RECT;[void][TgCapture]::GetWindowRect($hwnd,[ref]$rect)
$tgKeepTopmost=((Get-Content -LiteralPath (Join-Path $DataRoot 'settings.json') -Raw|ConvertFrom-Json).layer -eq 'top'); [void][TgCapture]::SetWindowPos($hwnd,[IntPtr](-1),0,0,0,0,0x13); Start-Sleep -Milliseconds 300; $padding=20;$image=New-Object System.Drawing.Bitmap(($rect.right-$rect.left+2*$padding),($rect.bottom-$rect.top+2*$padding));$graphics=[System.Drawing.Graphics]::FromImage($image)
$graphics.CopyFromScreen(($rect.left-$padding),($rect.top-$padding),0,0,$image.Size);$image.Save($Output);$graphics.Dispose();$image.Dispose(); if(!$tgKeepTopmost){[void][TgCapture]::SetWindowPos($hwnd,[IntPtr](-2),0,0,0,0,0x13)}
[pscustomobject]@{path=$Output;bounds=$rect}|ConvertTo-Json
