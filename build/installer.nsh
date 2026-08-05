; electron-builder's default "is the app already running" check pipes
; $INSTDIR through a PowerShell one-liner (Get-CimInstance ... Path.StartsWith).
; $INSTDIR here contains non-ASCII characters (a Slovak/Central-European
; Windows username), and that PowerShell command gets built by NSIS's
; ANSI-processed script layer before nsExec ever launches it — exactly the
; kind of path that can silently corrupt those characters, which broke the
; check for at least one real install (installer insisted the app was still
; running even though it wasn't, per Task Manager).
;
; The plain tasklist/taskkill fallback path in the default macros matches by
; image name only — no path, no PowerShell, nothing for a Unicode username to
; corrupt — so force that path unconditionally instead of trying to detect
; whether PowerShell "works" (the default's own detection can't see the
; specific failure mode above; its availability probe never touches $INSTDIR).
!include "getProcessInfo.nsh"
Var pid

!macro customCheckAppRunning
  Var /GLOBAL IsPowerShellAvailable
  StrCpy $IsPowerShellAvailable 1
  !insertmacro _CHECK_APP_RUNNING
!macroend
