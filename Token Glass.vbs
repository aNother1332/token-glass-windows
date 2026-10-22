Dim shell, env
Set shell = CreateObject("WScript.Shell")
Set env = shell.Environment("Process")
env("TEMP") = "D:\TOKSCALE\temp"
env("TMP") = "D:\TOKSCALE\temp"
env("TOKEN_GLASS_DATA") = "D:\TOKSCALE\data"
shell.CurrentDirectory = "D:\TOKSCALE\desktop"
shell.Run Chr(34) & "D:\TOKSCALE\native\TokenGlass.Widget.exe" & Chr(34), 1, False
