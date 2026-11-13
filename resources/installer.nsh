; Pulse custom NSIS hooks.
;
; app.setLoginItemSettings() creates a per-user Run entry named "Pulse".
; Remove it during uninstall so Windows does not try to launch a missing app.

!macro customUnInstall
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Pulse"
!macroend
