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

; The default _CHECK_APP_RUNNING macro (allowOnlyOneInstallerInstance.nsh)
; only closes a running instance silently when electron-builder's own
; ${isUpdated} check recognizes this as an update over an existing install;
; otherwise it shows a blocking "please close JellyWave first" OK/Cancel
; dialog and just Quits if the app is still running by the time the user
; dismisses it. That detection wasn't reliably kicking in for every install
; here, so closing the running app before upgrading kept requiring a manual
; close first. This drops the ${isUpdated} branch entirely and always just
; closes it ourselves — same graceful-then-forced kill sequence the default
; macro uses for its silent path, just unconditional.
!macro customCheckAppRunning
  Var /GLOBAL IsPowerShellAvailable
  StrCpy $IsPowerShellAvailable 1

  ${GetProcessInfo} 0 $pid $1 $2 $3 $4
  ${if} $3 != "${APP_EXECUTABLE_FILENAME}"
    !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
    ${if} $R0 == 0
      DetailPrint "$(appClosing)"
      !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 0
      ; give it a moment to exit gracefully before checking again
      Sleep 300

      StrCpy $R1 0
      loop:
        IntOp $R1 $R1 + 1

        !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
        ${if} $R0 == 0
          Sleep 1000
          !insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 1 ; 1 = force kill
          !insertmacro FIND_PROCESS "${APP_EXECUTABLE_FILENAME}" $R0
          ${if} $R0 == 0
            DetailPrint `Waiting for "${PRODUCT_NAME}" to close.`
            Sleep 2000
          ${else}
            Goto not_running
          ${endIf}
        ${else}
          Goto not_running
        ${endIf}

        ; Still running after a forced kill attempt — likely elevated
        ; permissions we can't touch. Only now ask the user to close it
        ; themselves, instead of failing silently.
        ${if} $R1 > 2
          MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY loop
          Quit
        ${else}
          Goto loop
        ${endIf}
      not_running:
    ${endIf}
  ${endIf}
!macroend
