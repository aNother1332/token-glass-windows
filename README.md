# Token Glass for Windows

随 AI 回答启停的 Windows 毛玻璃 Token 监控。小窗显示今日／累计 Token、最近回复的输出速率，以及可获得的 5 小时／周会员额度。点击小窗打开完整历史面板。

## 运行方式

- **原生悬浮窗**：Windows 原生窗口、DWM Acrylic、应用内 Maple Mono CN 字体子集，平时不启动 Chromium。
- **按需完整面板**：点击后启动 Electron，查看 Tokscale 历史统计、日／小时趋势、工具、模型、项目、会话和活动记录；关闭后释放面板进程。
- **事件生命周期**：由 Codex／ZCode 提交消息钩子启动。多个任务共用一个小窗；最后一个任务结束约 3 秒后退出。手动打开的面板保留到关闭。
- **手动退出**：小窗菜单可完全退出本轮监控，结束钩子不会将它重新唤起。没有开机启动项、计划任务或空闲守护进程。
- **窗口层级**：置顶、普通窗口、置于其他应用下方；支持拖动、展开和多显示器 DPI 调整。

历史解析由未修改的 Tokscale CLI 提供，保留其支持的本机数据源。Codex／ZCode 具备额外的速率、额度和任务生命周期适配。其他工具能否显示历史取决于本机记录和 Tokscale 版本。

## 字体、图标与数字

Maple Mono CN v7.9 的两个静态字重经过子集化，内部重命名为 **TokenGlass Maple**。中文、英文和数字使用同一套字形；未包含的动态汉字由 Windows 系统字体回退。字体只从应用目录加载，不安装到系统。

Codex、ZCode、Claude／Claude Code、OpenCode、GitHub Copilot 使用官方应用资产。来源与授权见 [图标说明](app/ui/assets/SOURCES.md)、[第三方说明](app/THIRD-PARTY.md) 和各目录授权文件。品牌图标用于识别数据来源，不代表项目由这些公司提供或认可。

Token 数字低于 1 亿时显示一位小数的“万”，达到 1 亿时显示一位小数的“亿”。例如 `12345678 → 1234.6万`、`123456789 → 1.2亿`。速率保持 `tok/s`。

## 构建环境

当前版本面向 **Windows 11 x64**，项目固定放在 `D:\TOKSCALE`。需要 Node.js 24.16 或兼容的 Node 24 版本、npm、Python 3.12、Git、GitHub CLI，以及 Windows 自带的 .NET Framework 4.x C# 编译器。Windows 10 的 Acrylic／圆角表现未验证。

构建依赖与工具缓存同样可以全部放在 D 盘。不要在已有 `D:\TOKSCALE` 数据目录上执行清空操作。

```powershell
git clone https://github.com/aNother1332/token-glass-windows.git D:\TOKSCALE
$env:TEMP = 'D:\TOKSCALE\temp'
$env:TMP = $env:TEMP
$env:npm_config_cache = 'D:\TOKSCALE\cache\npm'
$env:ELECTRON_CACHE = 'D:\TOKSCALE\cache\electron'
$env:ELECTRON_BUILDER_CACHE = 'D:\TOKSCALE\cache\electron-builder'
New-Item -ItemType Directory -Force D:\TOKSCALE\temp | Out-Null
Set-Location D:\TOKSCALE\app
npm ci
node scripts\prepare-runtime.cjs
```

第一次构建字体时安装工具到项目目录，并从官方发行包提取两个字重：

```powershell
python -m pip install fonttools brotli pymupdf --target D:\TOKSCALE\work\font-tools --cache-dir D:\TOKSCALE\cache\pip
python scripts\fetch-maple.py
gh api repos/subframe7536/maple-font/contents/OFL.txt -H 'Accept: application/vnd.github.raw+json' |
  Set-Content D:\TOKSCALE\work\fonts\OFL.txt -Encoding utf8
```

已提交的字体子集可直接使用；重新生成需要上述原始字体和构建依赖。`fetch-maple.py` 使用官方 GitHub Release 的范围请求，只读取所需字体，并验证 ZIP 成员 CRC。

```powershell
& D:\TOKSCALE\Build.ps1
node D:\TOKSCALE\app\scripts\activate-native.cjs
```

构建生成原生小窗 `native\TokenGlass.Widget.exe` 和 Electron 面板 `build\win-unpacked`。激活脚本更新 D 盘启动指针、复制面板交付目录，并在升级时迁移现有活动任务；它不登记或信任客户端钩子。正在运行原生版本时，先从小窗菜单退出，再构建升级。

日常手动打开：双击 `D:\TOKSCALE\Token Glass.vbs`。自动唤起需要下面的客户端配置。

## 钩子登记

```powershell
D:\TOKSCALE\runtime\node.exe D:\TOKSCALE\app\scripts\prepare-hooks.cjs
```

此脚本只生成 `hooks\codex-additions.toml` 和 `hooks\zcode-additions.json`，不会自动修改客户端配置。

将生成内容合并到自己的 Codex／ZCode 配置，保留已有钩子。Codex 需要在 `/hooks` 中审查并信任命令；命令修改后可能需要重新信任。不要绕过客户端信任机制。

ZCode 使用 process 钩子；Codex 使用 `UserPromptSubmit`、`Stop`、`Interrupt`、`SessionEnd`。本机命令钩子需要客户端实际执行本地事件，远程编排支持情况依客户端而定。

## 数据与隐私

历史数据来自本机日志／数据库，通过 Tokscale 读取。速率采用已写入记录的输出 Token 和请求／输出时间边界计算，不是服务端逐 Token 的精确解码速度。

Codex 优先读取日志中的额度快照；ZCode 在内存中复用已有 Coding Plan 凭据，仅访问官方额度接口。凭据不传给界面、不写入应用缓存，不上传对话。无可靠额度数据时不推算百分比，过期记录标记为“上次”。

源码仓库不包含用量数据、凭据、客户端配置、配置备份、日志、项目／会话列表、运行时、依赖目录或本机诊断截图。字体和图标为离线资源，运行时不需要访问字体 CDN。

## 验证

```powershell
Set-Location D:\TOKSCALE\app
npm test
node scripts\native-smoke.cjs
```

集成测试使用 D 盘独立测试目录和独立命名管道。`native-panel-smoke.cjs` 验证字体、图标、页面、明暗主题及 DOM 保留；运行前先用 `start-native-test.cjs` 启动测试宿主。`native-hook-smoke.cjs` 使用 Codex 本地临时会话与环回 HTTP 失败夹具，验证真实钩子，不调用付费模型。它要求本机已登记并信任钩子。

内存采样：

```powershell
& scripts\widget-memory.ps1 -Samples 61 -IntervalSeconds 10
```

报告分别记录私有工作集、全部进程工作集与私有提交内存。工作集相加包含共享页重复计算，不能当作独占物理内存；一分钟或十分钟测量也不能证明不存在长期泄漏。

## 许可

应用源码为 MIT；字体、图标与依赖保留各自的许可。品牌标识不因应用源码的 MIT 许可而获得额外商标授权。
