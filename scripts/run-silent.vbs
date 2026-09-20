' AeroPulse Pro - Silent Background Runner
' Runs the Node.js dashboard server without showing any command prompt / console window.

Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(scriptDir)

Set oShell = CreateObject("Wscript.Shell")
oShell.CurrentDirectory = projectDir

nodeExe = "C:\Program Files\nodejs\node.exe"
If Not fso.FileExists(nodeExe) Then
    nodeExe = "node.exe"
End If

' 0 = SW_HIDE (hidden window), False = do not wait for return
cmd = """" & nodeExe & """ src/server.js"
oShell.Run cmd, 0, False
