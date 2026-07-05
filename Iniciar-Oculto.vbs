' Arranca el cotizador SIN mostrar ninguna ventana (para el inicio automático).
' No se usa para la primera instalación — para eso use Iniciar-Windows.bat.
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

Set shell = CreateObject("WScript.Shell")
shell.CurrentDirectory = scriptDir

' Refuerza el PATH por si la tarea programada arranca con uno incompleto — causa
' muy común de que "node" no se encuentre pese a que funciona bien al abrirlo a mano.
On Error Resume Next
progFiles = shell.ExpandEnvironmentStrings("%ProgramFiles%")
shell.Environment("PROCESS")("PATH") = shell.Environment("PROCESS")("PATH") & ";" & progFiles & "\nodejs"
On Error Goto 0

' Registra lo que pase (o el error) en un archivo, para poder revisar si algo falla
' sin que nadie vea ninguna ventana.
If Not fso.FolderExists(scriptDir & "\data") Then fso.CreateFolder(scriptDir & "\data")
logPath = scriptDir & "\data\inicio-automatico.log"
shell.Run "cmd /c (echo. & echo === Intento de inicio: %date% %time% ===) >> " & Chr(34) & logPath & Chr(34) & " 2>&1 & node server.js >> " & Chr(34) & logPath & Chr(34) & " 2>&1", 0, False
