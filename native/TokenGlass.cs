using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// Native Windows widget: no browser, webview, Electron or GPU helper process.
// A short-lived Node collector retains the existing, audited data adapters.
static class Json {
 public static readonly JavaScriptSerializer Codec=new JavaScriptSerializer {MaxJsonLength=16*1024*1024,RecursionLimit=128};
 public static Dictionary<string,object> Parse(string text){lock(Codec)return Codec.DeserializeObject(text) as Dictionary<string,object>??new Dictionary<string,object>();}
 public static object Get(object obj,string key){var d=obj as Dictionary<string,object>;object v;return d!=null&&d.TryGetValue(key,out v)?v:null;}
 public static string Str(object v){return Convert.ToString(v,CultureInfo.InvariantCulture)??"";}
 public static double Num(object v){double n;return double.TryParse(Str(v),NumberStyles.Any,CultureInfo.InvariantCulture,out n)?n:0;}
 public static IEnumerable<object> Rows(object v){return (v as IEnumerable<object>)??new object[0];}
 public static string Encode(object v){lock(Codec)return Codec.Serialize(v);}
}
static class Native {
 [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr context);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h,IntPtr after,int x,int y,int w,int height,uint flags);
 [DllImport("dwmapi.dll")] public static extern int DwmSetWindowAttribute(IntPtr h,int attr,ref int v,int size);
 [DllImport("dwmapi.dll")] public static extern int DwmExtendFrameIntoClientArea(IntPtr h,ref Margins m);
 [StructLayout(LayoutKind.Sequential)] public struct Margins {public int left,right,top,bottom;}
 [DllImport("user32.dll")] public static extern bool ReleaseCapture();
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,int m,IntPtr w,IntPtr l);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr a,string name);
 [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job,int info,IntPtr data,uint size);
 [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
 [StructLayout(LayoutKind.Sequential)] struct Point {public int x,y;}
 [StructLayout(LayoutKind.Sequential)] struct Size {public int width,height;}
 [StructLayout(LayoutKind.Sequential,Pack=1)] struct Blend {public byte operation,flags,alpha,format;}
 [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
 [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h,IntPtr dc);
 [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr dc);
 [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr dc,IntPtr obj);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
 [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr dc);
 [DllImport("user32.dll")] static extern bool UpdateLayeredWindow(IntPtr h,IntPtr dst,IntPtr pos,ref Size size,IntPtr src,ref Point point,int key,ref Blend blend,uint flags);
 public static void Present(IntPtr hwnd,Bitmap bitmap){IntPtr screen=GetDC(IntPtr.Zero),dc=CreateCompatibleDC(screen),image=bitmap.GetHbitmap(Color.FromArgb(0)),old=SelectObject(dc,image);try{var size=new Size{width=bitmap.Width,height=bitmap.Height};var point=new Point();var blend=new Blend{operation=0,alpha=255,format=1};UpdateLayeredWindow(hwnd,screen,IntPtr.Zero,ref size,dc,ref point,0,ref blend,2);}finally{SelectObject(dc,old);DeleteObject(image);DeleteDC(dc);ReleaseDC(IntPtr.Zero,screen);}}
 [StructLayout(LayoutKind.Sequential)] struct BasicLimit {public long processTime,jobTime;public uint flags;public UIntPtr minWS,maxWS;public uint active;public UIntPtr affinity;public uint priority,scheduling;}
 [StructLayout(LayoutKind.Sequential)] struct Io {public ulong a,b,c,d,e,f;}
 [StructLayout(LayoutKind.Sequential)] struct Limits {public BasicLimit basic;public Io io;public UIntPtr processMemory,jobMemory,peakProcess,peakJob;}
 public static IntPtr Job(){var h=CreateJobObject(IntPtr.Zero,null);var data=new Limits();data.basic.flags=0x2000;int size=Marshal.SizeOf(data);IntPtr p=Marshal.AllocHGlobal(size);try{Marshal.StructureToPtr(data,p,false);if(!SetInformationJobObject(h,9,p,(uint)size))throw new InvalidOperationException("Job configuration failed");}finally{Marshal.FreeHGlobal(p);}return h;}
 public static void Own(IntPtr job,Process p){if(!AssignProcessToJobObject(job,p.Handle)){try{p.Kill();}catch{}throw new InvalidOperationException("Child ownership failed");}}
}

sealed class Widget:Form {
 const string BaseDir=@"D:\TOKSCALE";
 readonly string dataRoot,pipeName;readonly bool test;
 readonly Dictionary<string,Dictionary<string,object>> turns=new Dictionary<string,Dictionary<string,object>>();
 readonly Dictionary<string,Image> icons=new Dictionary<string,Image>();
 readonly Dictionary<string,RectangleF> hits=new Dictionary<string,RectangleF>();
 readonly PrivateFontCollection fonts=new PrivateFontCollection();
 readonly FontFamily uiFamily;
 readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer();
 Dictionary<string,object> snapshot=new Dictionary<string,object>(),settings=new Dictionary<string,object>();
 Process collector,panel;IntPtr job;Thread server;bool quitting,manualPanel,expanded,dark,dragged;double exitAt;float scale=1;
 string layer="top",theme="system";Point down;string lastSnapshot="";bool firstPaint=true;int sourceOffset;
 static readonly Dictionary<string,string> names=new Dictionary<string,string>{{"claude","Claude Code"},{"codex","Codex"},{"zcode","ZCode"},{"opencode","OpenCode"},{"copilot","GitHub Copilot"},{"cursor","Cursor"},{"gemini","Gemini CLI"},{"kimi","Kimi"},{"qwen","Qwen"}};
 public string DataRoot {get{return dataRoot;}}
 public Widget(bool testing){
  test=testing;dataRoot=test?BaseDir+@"\work\native-test":BaseDir+@"\data";Directory.CreateDirectory(dataRoot);
  pipeName=Json.Str(Json.Get(Json.Parse(File.ReadAllText(BaseDir+@"\native\config.json")),"pipe"))+(test?"-test":"");
  try{settings=Json.Parse(File.ReadAllText(dataRoot+@"\settings.json"));}catch{}
  try{snapshot=Json.Parse(File.ReadAllText(dataRoot+@"\snapshot.json"));}catch{}
  theme=Json.Str(Json.Get(settings,"theme"));layer=Json.Str(Json.Get(settings,"layer"));if(layer=="")layer="top";
  expanded=Json.Get(settings,"expanded") is bool&&(bool)settings["expanded"];
  var assets=BaseDir+@"\app\ui\assets\";
  foreach(string id in new[]{"codex","codex-light","zcode","claude","opencode","copilot","copilot-dark"})try{icons[id]=Image.FromFile(assets+id+".png");}catch{}
  foreach(string f in new[]{"TokenGlassMaple-Regular.ttf","TokenGlassMaple-SemiBold.ttf"})try{fonts.AddFontFile(BaseDir+@"\app\ui\fonts\"+f);}catch{}
  uiFamily=fonts.Families.Length>0?fonts.Families[0]:new FontFamily("Microsoft YaHei UI");
  FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;StartPosition=FormStartPosition.Manual;AutoScaleMode=AutoScaleMode.None;
  Text="Token Glass · Native";AccessibleName="Token Glass 悬浮窗";
  SetStyle(ControlStyles.AllPaintingInWmPaint|ControlStyles.UserPaint|ControlStyles.OptimizedDoubleBuffer|ControlStyles.ResizeRedraw,true);
  using(var g=CreateGraphics())scale=g.DpiX/96f;
  ReadAppearance();ResizeWidget();var pos=Json.Get(settings,"position");Location=new Point((int)(Json.Num(Json.Get(pos,"x"))*scale),(int)(Json.Num(Json.Get(pos,"y"))*scale));
  if(pos==null){var area=Screen.PrimaryScreen.WorkingArea;Location=new Point(area.Right-Width-28,area.Top+80);}Clamp();
  job=Native.Job();timer.Interval=1000;timer.Tick+=Tick;
  MouseDown+=MousePressed;MouseUp+=MouseReleased;MouseMove+=(s,e)=>{if(e.Button==MouseButtons.Left&&Math.Abs(e.X-down.X)+Math.Abs(e.Y-down.Y)>4)dragged=true;};
  MouseWheel+=(s,e)=>{sourceOffset=Math.Max(0,Math.Min(Math.Max(0,TodayClients().Count-4),sourceOffset+(e.Delta<0?1:-1)));Invalidate();};
 }
 protected override bool ShowWithoutActivation {get{return true;}}
 protected override void WndProc(ref Message m){base.WndProc(ref m);if(m.Msg==0x2E0){scale=(m.WParam.ToInt64()&65535)/96f;ResizeWidget();Invalidate();}if((m.Msg==0x1A||m.Msg==0x31A)&&IsHandleCreated){bool old=dark;ReadAppearance();if(old!=dark){ApplyMaterial();Invalidate();}}}
 protected override CreateParams CreateParams {get{var p=base.CreateParams;p.ExStyle|=0x80080;return p;}}
 protected override void OnHandleCreated(EventArgs e){base.OnHandleCreated(e);ApplyMaterial();}
 protected override void OnPaintBackground(PaintEventArgs e){}
 new void Invalidate(){if(!IsHandleCreated||quitting)return;using(var g=Graphics.FromHwnd(Handle))OnPaint(new PaintEventArgs(g,ClientRectangle));}
 void ReadAppearance(){theme=Json.Str(Json.Get(settings,"theme"));dark=theme=="dark";if(theme=="system"||theme==""){try{dark=(int)Microsoft.Win32.Registry.GetValue(@"HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize","AppsUseLightTheme",1)==0;}catch{}}}
 void ApplyMaterial(){if(!IsHandleCreated)return;int round=2;Native.DwmSetWindowAttribute(Handle,33,ref round,4);int mode=dark?1:0;Native.DwmSetWindowAttribute(Handle,20,ref mode,4);int backdrop=(Json.Get(settings,"solid") is bool&&(bool)settings["solid"])?1:3;Native.DwmSetWindowAttribute(Handle,38,ref backdrop,4);var margins=new Native.Margins{left=-1};Native.DwmExtendFrameIntoClientArea(Handle,ref margins);SetLayer();}
 void SetLayer(){TopMost=layer=="top";if(layer=="bottom"&&IsHandleCreated)Native.SetWindowPos(Handle,new IntPtr(1),0,0,0,0,0x13);}
 void Clamp(){var a=Screen.FromRectangle(Bounds).WorkingArea;Location=new Point(Math.Max(a.Left,Math.Min(Left,a.Right-Width)),Math.Max(a.Top,Math.Min(Top,a.Bottom-Height)));}
 void ResizeWidget(){int n=Json.Rows(Json.Get(snapshot,"quotas")).Count();int clients=TodayClients().Count;ClientSize=new Size((int)(314*scale),(int)((260+Math.Max(0,(int)Math.Ceiling(n/2.0)-1)*43+(expanded?Math.Min(174,clients*36+24):0))*scale));Clamp();}
 void Save(){settings["theme"]=theme;settings["layer"]=layer;settings["expanded"]=expanded;settings["position"]=new{x=(int)(Left/scale),y=(int)(Top/scale)};Atomic(dataRoot+@"\settings.json",Json.Encode(settings));}
 static void Atomic(string file,string value){string tmp=file+".native-tmp";File.WriteAllText(tmp,value,new UTF8Encoding(false));for(int i=0;;i++){try{if(File.Exists(file))File.Replace(tmp,file,null);else File.Move(tmp,file);return;}catch(IOException ex){int code=ex.HResult&65535;if(i>=3||code!=32&&code!=33)throw;Thread.Sleep(2);}}}
 public void Start(Dictionary<string,object> initial,bool manual){
  StartPipe();StartCollector();if(initial!=null)Receive(initial);else if(manual){OpenPanel();Hide();}
  timer.Start();WriteState();
 }
 void StartCollector(){var psi=new ProcessStartInfo(BaseDir+@"\runtime\node.exe","\""+BaseDir+@"\app\src\native-collector.cjs"+"\""){UseShellExecute=false,CreateNoWindow=true,RedirectStandardInput=true,RedirectStandardOutput=true,RedirectStandardError=true,StandardOutputEncoding=Encoding.UTF8,WorkingDirectory=BaseDir};
  psi.EnvironmentVariables["TOKEN_GLASS_DATA"]=dataRoot;psi.EnvironmentVariables["TOKEN_GLASS_NATIVE"]="1";psi.EnvironmentVariables["TOKEN_GLASS_TOKSCALE"]=BaseDir+@"\desktop\resources\vendor\tokscale.exe";psi.EnvironmentVariables["TEMP"]=BaseDir+@"\temp";psi.EnvironmentVariables["TMP"]=BaseDir+@"\temp";psi.EnvironmentVariables["NODE_NO_WARNINGS"]="1";
  collector=new Process{StartInfo=psi,EnableRaisingEvents=true};collector.OutputDataReceived+=(s,e)=>{if(e.Data==null||quitting)return;try{var m=Json.Parse(e.Data);BeginInvoke((Action)(()=>Collected(m)));}catch{}};collector.ErrorDataReceived+=(s,e)=>{};
  collector.Exited+=(s,e)=>{if(!quitting)try{BeginInvoke((Action)(()=>{snapshot["warnings"]=new[]{"采集进程已退出，请重新打开监控"};Invalidate();WriteState();}));}catch{}};
  collector.Start();Native.Own(job,collector);collector.BeginOutputReadLine();collector.BeginErrorReadLine();
 }
 void Send(object m){try{if(collector!=null&&!collector.HasExited){collector.StandardInput.WriteLine(Json.Encode(m));collector.StandardInput.Flush();}}catch{}}
 void Collected(Dictionary<string,object> m){string type=Json.Str(Json.Get(m,"type"));if(type=="snapshot"){
   var next=Json.Get(m,"data") as Dictionary<string,object>;if(next==null)return;string encoded=Json.Encode(next);if(encoded==lastSnapshot)return;lastSnapshot=encoded;snapshot=next;ResizeWidget();Invalidate();WriteState();
  }else if(type=="turn-ended"){m["kind"]="stop";Receive(m);}}
 void StartPipe(){server=new Thread(()=>{while(!quitting){try{var p=new NamedPipeServerStream(pipeName,PipeDirection.InOut,16,PipeTransmissionMode.Byte,PipeOptions.Asynchronous);p.WaitForConnection();ThreadPool.QueueUserWorkItem(_=>{using(p){try{var reader=new StreamReader(p,Encoding.UTF8,false,4096,true);string line=reader.ReadLine();if(line==null||line.Length>65536)return;var data=Json.Parse(line);Invoke((Action)(()=>Receive(data)));byte[] ack=Encoding.UTF8.GetBytes("ok\n");p.Write(ack,0,ack.Length);p.Flush();}catch{}}});}catch{if(!quitting)Thread.Sleep(50);}}});server.IsBackground=true;server.Start();}
 public void Receive(Dictionary<string,object> e){if(quitting)return;string command=Json.Str(Json.Get(e,"command"));if(command!=""){
   if(command=="panel-open"){manualPanel=true;Send(new{type="mode",panel=true});}
   if(command=="panel-closed"){manualPanel=false;Send(new{type="mode",panel=false});if(turns.Count==0)exitAt=Now()+3000;}
   if(command=="show-widget"){Show();SetLayer();}
   if(command=="open-panel")OpenPanel();
   if(command=="refresh")Send(new{type="refresh",force=true});
   if(command=="quit"){Quit();return;}
   if(command=="setting"){string settingKey=Json.Str(Json.Get(e,"key"));if(new[]{"theme","layer","expanded","solid","opacity"}.Contains(settingKey)){settings[settingKey]=Json.Get(e,"value");theme=Json.Str(Json.Get(settings,"theme"));layer=Json.Str(Json.Get(settings,"layer"));expanded=Json.Get(settings,"expanded") is bool&&(bool)settings["expanded"];ReadAppearance();ApplyMaterial();ResizeWidget();Save();Invalidate();}}
   WriteState();return;
  }
  string source=Json.Str(Json.Get(e,"source")),session=Json.Str(Json.Get(e,"session")),kind=Json.Str(Json.Get(e,"kind"));if(!new[]{"codex","zcode"}.Contains(source)||session==""||!new[]{"start","stop"}.Contains(kind))return;
  string key=source+":"+session;double at=Json.Num(Json.Get(e,"at"));if(at==0)at=Now();
  if(kind=="start"){e["since"]=at;turns[key]=e;exitAt=0;Show();SetLayer();}else{Dictionary<string,object> t;if(turns.TryGetValue(key,out t)){string incoming=Json.Str(Json.Get(e,"turn")),existing=Json.Str(Json.Get(t,"turn"));if(at>=Json.Num(Json.Get(t,"since"))&&(incoming==""||existing==""||incoming==existing))turns.Remove(key);}if(turns.Count==0&&!manualPanel)exitAt=Now()+3000;}
  Send(new{type="active",active=turns.Values.ToArray()});if(kind=="start")Send(new{type="refresh"});Invalidate();WriteState();
 }
 static double Now(){return(DateTime.UtcNow-new DateTime(1970,1,1)).TotalMilliseconds;}
 void Tick(object sender,EventArgs e){if(quitting)return;foreach(var pair in turns.ToArray()){int pid=(int)Json.Num(Json.Get(pair.Value,"hostPid"));if(pid<=0)continue;try{if(!Process.GetProcessById(pid).HasExited)continue;}catch{}Receive(new Dictionary<string,object>{{"source",Json.Get(pair.Value,"source")},{"session",Json.Get(pair.Value,"session")},{"kind","stop"},{"at",Now()}});}
  if(panel!=null&&panel.HasExited){panel.Dispose();panel=null;manualPanel=false;Send(new{type="mode",panel=false});if(turns.Count==0)exitAt=Now()+3000;WriteState();}
  if(exitAt>0&&Now()>=exitAt&&turns.Count==0&&!manualPanel)Quit();
 }
 void WriteState(){if(quitting)return;var state=new Dictionary<string,object>(snapshot);state["active"]=turns.Values.ToArray();state["settings"]=settings;state["manual"]=manualPanel;try{state["hookStatus"]=Json.Get(Json.Parse(File.ReadAllText(dataRoot+@"\hook-status.json")),"message");}catch{}
  Atomic(dataRoot+@"\native-state.json",Json.Encode(state));Atomic(dataRoot+@"\runtime.json",Json.Encode(new{pid=Process.GetCurrentProcess().Id,collector=collector==null?0:collector.Id,active=turns.Values.ToArray(),manualPanel=manualPanel,native=true,updatedAt=Now()}));
 }
 void OpenPanel(){if(panel!=null&&!panel.HasExited){manualPanel=true;panel.Refresh();Native.SetForegroundWindow(panel.MainWindowHandle);return;}manualPanel=true;exitAt=0;Send(new{type="mode",panel=true});WriteState();
  var psi=new ProcessStartInfo(BaseDir+@"\desktop\Token Glass.exe","--native-panel"){UseShellExecute=false,WorkingDirectory=BaseDir+@"\desktop"};psi.EnvironmentVariables["TOKEN_GLASS_DATA"]=dataRoot;psi.EnvironmentVariables["TOKEN_GLASS_PIPE"]=pipeName;psi.EnvironmentVariables.Remove("ELECTRON_RUN_AS_NODE");panel=Process.Start(psi);Native.Own(job,panel);
 }
 public void Quit(){if(quitting)return;quitting=true;timer.Stop();try{Send(new{type="stop"});}catch{}try{if(collector!=null&&!collector.HasExited)collector.StandardInput.Close();}catch{}Native.CloseHandle(job);job=IntPtr.Zero;try{File.Delete(dataRoot+@"\runtime.json");File.Delete(dataRoot+@"\native-state.json");}catch{}Close();}
 protected override void OnFormClosing(FormClosingEventArgs e){if(!quitting){e.Cancel=true;Quit();return;}base.OnFormClosing(e);}
 protected override void Dispose(bool disposing){if(disposing){timer.Dispose();foreach(var i in icons.Values)i.Dispose();uiFamily.Dispose();fonts.Dispose();if(job!=IntPtr.Zero)Native.CloseHandle(job);}base.Dispose(disposing);}
 List<object> TodayClients(){var graph=Json.Get(snapshot,"graph");var today=Json.Rows(Json.Get(graph,"contributions")).FirstOrDefault(d=>Json.Str(Json.Get(d,"date"))==DateTime.Now.ToString("yyyy-MM-dd"));return Json.Rows(Json.Get(today,"clients")).ToList();}
 static double Tokens(object c){var d=Json.Get(c,"tokens") as Dictionary<string,object>;return d==null?0:d.Values.Sum(v=>Json.Num(v));}
 static string Format(double v){return(v>=100000000?v/100000000:v/10000).ToString("F1",CultureInfo.InvariantCulture)+(v>=100000000?"亿":"万");}
 Font FontAt(float size,bool bold=false){return new Font(uiFamily,size,bold?FontStyle.Bold:FontStyle.Regular,GraphicsUnit.Pixel);}
 GraphicsPath Rounded(float width,float height,float radius){var p=new GraphicsPath();p.AddArc(0,0,radius*2,radius*2,180,90);p.AddArc(width-radius*2,0,radius*2,radius*2,270,90);p.AddArc(width-radius*2,height-radius*2,radius*2,radius*2,0,90);p.AddArc(0,height-radius*2,radius*2,radius*2,90,90);p.CloseFigure();return p;}
 void Label(Graphics g,string text,float x,float y,float size,Color color,bool bold=false,float width=280){using(var f=FontAt(size,bold))using(var b=new SolidBrush(color))using(var format=new StringFormat{Trimming=StringTrimming.EllipsisCharacter,FormatFlags=StringFormatFlags.NoWrap})g.DrawString(text,f,b,new RectangleF(x,y,width,60),format);}
 void DrawIcon(Graphics g,string id,float x,float y,float size){string file=id=="codex"&&!dark?"codex-light":id=="copilot"&&dark?"copilot-dark":id;Image image;if(icons.TryGetValue(file,out image)){g.DrawImage(image,x,y,size,size);}else Label(g,names.ContainsKey(id)?names[id].Substring(0,1):id.Substring(0,1),x,y,size*.7f,dark?Color.White:Color.DimGray);}
 protected override void OnPaint(PaintEventArgs e){var bitmap=new Bitmap(ClientSize.Width,ClientSize.Height,System.Drawing.Imaging.PixelFormat.Format32bppPArgb);var g=Graphics.FromImage(bitmap);g.Clear(Color.Transparent);g.ScaleTransform(scale,scale);g.SmoothingMode=SmoothingMode.AntiAlias;g.TextRenderingHint=TextRenderingHint.AntiAliasGridFit;hits.Clear();float w=ClientSize.Width/scale,h=ClientSize.Height/scale;
  bool solid=Json.Get(settings,"solid") is bool&&(bool)settings["solid"];double opacity=Json.Get(settings,"opacity")==null?.7:Json.Num(Json.Get(settings,"opacity"));
  using(var shape=Rounded(w,h,8))using(var brush=new SolidBrush(Color.FromArgb(solid?255:(int)(Math.Max(.25,Math.Min(.95,opacity))*180),dark?Color.FromArgb(19,25,32):Color.FromArgb(248,250,253))))g.FillPath(brush,shape);
  Color text=dark?Color.FromArgb(229,236,242):Color.FromArgb(38,49,59),muted=dark?Color.FromArgb(149,163,177):Color.FromArgb(112,129,141),accent=dark?Color.FromArgb(118,217,190):Color.FromArgb(36,139,120);
  // Opaque text areas are drawn directly over the DWM-owned translucent surface.
  Label(g,"◇",17,14,21,accent);Label(g,"Token Glass",44,17,12,text,true);Label(g,layer=="top"?"◆":"◇",250,15,15,accent);Label(g,"⋯",279,13,18,muted);
  hits["pin"]=new RectangleF(244,8,28,28);hits["menu"]=new RectangleF(276,8,30,28);
  Label(g,"今日 TOKEN",17,61,10,muted);double today=TodayClients().Sum(c=>Tokens(c)),total=Json.Num(Json.Get(Json.Get(Json.Get(snapshot,"graph"),"summary"),"totalTokens"));
  Label(g,Format(today),15,80,34,text,true);Label(g,"累计 "+Format(total),17,129,10,muted);
  var activeSources=new HashSet<string>(turns.Values.Select(t=>Json.Str(Json.Get(t,"source"))));var speed=Json.Rows(Json.Get(snapshot,"speeds")).Where(s=>activeSources.Count==0||activeSources.Contains(Json.Str(Json.Get(s,"source")))).OrderByDescending(s=>Json.Num(Json.Get(s,"at"))).FirstOrDefault();Label(g,speed==null?"— tok/s":Json.Num(Json.Get(speed,"rate")).ToString("F1",CultureInfo.InvariantCulture)+" tok/s",200,126,12,accent,true,100);
  hits["panel"]=new RectangleF(0,46,w,101);
  float y=161;var quotas=Json.Rows(Json.Get(snapshot,"quotas")).ToArray();for(int i=0;i<quotas.Length;i++){var q=quotas[i];float x=17+(i%2)*146,cy=y+(i/2)*43;string id=Json.Str(Json.Get(q,"source"));DrawIcon(g,id,x,cy,10);Label(g,(id=="codex"?"Codex":"ZCode")+" "+Json.Str(Json.Get(q,"label")),x+13,cy-1,8,muted,false,82);double remain=Json.Num(Json.Get(q,"remaining"));Label(g,Math.Round(remain)+"%",x+102,cy-1,8,text,true,35);
   if(Now()-Json.Num(Json.Get(q,"updatedAt"))>600000)Label(g,"上次",x+82,cy-1,7,muted,false,24);
   using(var b=new SolidBrush(Color.FromArgb(35,muted)))g.FillRectangle(b,x,cy+17,134,3);using(var b=new SolidBrush(remain<10?Color.FromArgb(205,121,110):accent))g.FillRectangle(b,x,cy+17,(float)(134*Math.Max(0,Math.Min(100,remain))/100),3);
  }
  if(expanded){y=161+(float)Math.Ceiling(quotas.Length/2.0)*43+16;using(var p=new Pen(Color.FromArgb(30,muted)))g.DrawLine(p,17,y-7,297,y-7);foreach(var c in TodayClients().OrderByDescending(Tokens).Skip(sourceOffset).Take(4)){string id=Json.Str(Json.Get(c,"client"));DrawIcon(g,id,17,y+3,21);Label(g,names.ContainsKey(id)?names[id]:id,48,y+5,11,text,false,135);Label(g,Format(Tokens(c)),208,y+5,11,text,true,90);y+=36;}}
  Label(g,"●",17,h-26,7,accent);Label(g,turns.Count>0?turns.Count+" 个任务进行中":"本轮已结束",29,h-27,9,muted);Label(g,expanded?"收起":"展开",269,h-27,9,muted);hits["expand"]=new RectangleF(254,h-39,60,39);
  if(firstPaint){firstPaint=false;try{Atomic(dataRoot+@"\native-render.json",Json.Encode(new{font=fonts.Families.Length>0?fonts.Families[0].Name:"fallback",native=true,dpi=scale*96,at=Now()}));}catch{}}
  g.Dispose();Native.Present(Handle,bitmap);bitmap.Dispose();
 }
 void MousePressed(object sender,MouseEventArgs e){down=e.Location;dragged=false;if(e.Button==MouseButtons.Right){MenuAt(e.Location);return;}var p=new PointF(e.X/scale,e.Y/scale);if(e.Button==MouseButtons.Left&&p.Y<45&&!hits["pin"].Contains(p)&&!hits["menu"].Contains(p)){Native.ReleaseCapture();Native.SendMessage(Handle,0xA1,new IntPtr(2),IntPtr.Zero);Clamp();Save();dragged=true;}}
 void MouseReleased(object sender,MouseEventArgs e){if(dragged||e.Button!=MouseButtons.Left)return;var p=new PointF(e.X/scale,e.Y/scale);foreach(var hit in hits.ToArray())if(hit.Value.Contains(p)){if(hit.Key=="panel")OpenPanel();if(hit.Key=="pin"){layer=layer=="top"?"normal":"top";SetLayer();Save();}if(hit.Key=="expand"){expanded=!expanded;Save();ResizeWidget();}if(hit.Key=="menu")MenuAt(e.Location);Invalidate();WriteState();break;}}
 void MenuAt(Point p){var menu=new ContextMenuStrip();menu.Items.Add("打开统计面板",null,(s,e)=>OpenPanel());menu.Items.Add("置顶",null,(s,e)=>{layer="top";SetLayer();Save();Invalidate();});menu.Items.Add("普通窗口",null,(s,e)=>{layer="normal";SetLayer();Save();Invalidate();});menu.Items.Add("置于其他窗口下方",null,(s,e)=>{layer="bottom";SetLayer();Save();Invalidate();});menu.Items.Add("退出监控",null,(s,e)=>Quit());menu.Closed+=(s,e)=>menu.Dispose();menu.Show(this,p);}
}
static class Program {
 [STAThread] static void Main(string[] args){Environment.SetEnvironmentVariable("TEMP",@"D:\TOKSCALE\temp");Environment.SetEnvironmentVariable("TMP",@"D:\TOKSCALE\temp");bool test=args.Contains("--test");try{Native.SetProcessDpiAwarenessContext(new IntPtr(-4));}catch{}
  Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);Dictionary<string,object> initial=null;int index=Array.IndexOf(args,"--event");if(index>=0&&index+1<args.Length)try{initial=Json.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(args[index+1])));}catch{}
  bool fresh;using(var mutex=new Mutex(true,"Local\\TokenGlassNative-"+Environment.UserName+(test?"-test":""),out fresh)){if(!fresh){try{string name=Json.Str(Json.Get(Json.Parse(File.ReadAllText(@"D:\TOKSCALE\native\config.json")),"pipe"))+(test?"-test":"");using(var p=new NamedPipeClientStream(".",name,PipeDirection.InOut)){p.Connect(1500);var b=Encoding.UTF8.GetBytes(Json.Encode(initial??new Dictionary<string,object>{{"command","open-panel"}})+"\n");p.Write(b,0,b.Length);p.Flush();}}catch{}return;}
   try{using(var widget=new Widget(test)){widget.Shown+=(s,e)=>widget.Start(initial,initial==null);Application.Run(widget);}}catch(Exception e){File.WriteAllText(@"D:\TOKSCALE\data\native-error.json",Json.Encode(new{error=e.GetType().Name,message=e.Message,at=DateTime.UtcNow.ToString("o")}));}finally{mutex.ReleaseMutex();}
  }
 }
}
