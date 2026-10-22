const koffi=require('koffi');
const user=koffi.load('user32.dll'),dwm=koffi.load('dwmapi.dll');
const position=user.func('bool __stdcall SetWindowPos(intptr_t hWnd, intptr_t hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags)');
const attribute=dwm.func('int __stdcall DwmSetWindowAttribute(intptr_t hwnd, uint attribute, const int *value, uint size)');
const handle=w=>w.getNativeWindowHandle().readBigUInt64LE();
function bottom(w){position(handle(w),1n,0,0,0,0,0x1|0x2|0x10);}
// DWM must clip its own Acrylic backdrop. A GDI window region only clips the
// client surface and leaves square grey backdrop corners on Windows 11.
const rounded=new WeakSet();
function round(w){if(rounded.has(w))return;rounded.add(w);attribute(handle(w),33,[2],4);}
module.exports={bottom,round};
