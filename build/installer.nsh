; Custom installer page: pick which launchers to support.
; Nothing is ticked by default. Choices are written to $INSTDIR\launchers.conf,
; which the app reads on first start (and the user can change later in Settings).

!include nsDialogs.nsh
!include LogicLib.nsh

; electron-builder compiles this file twice (installer + uninstaller).
; The page code is only used by the installer, so keep it out of the
; uninstaller pass or NSIS raises "not referenced" warnings (treated as errors).
!macro customHeader
  BrandingText "Jay Launcher - Designed by Jayden M."
!macroend

!ifndef BUILD_UNINSTALLER

Var chkSteam
Var chkEpic
Var chkGog
Var chkUbisoft
Var stSteam
Var stEpic
Var stGog
Var stUbisoft

Function LauncherPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Choose the game launchers you want Jay Launcher to look for. Only the ones you tick will be scanned. You can change this later in Settings."
  Pop $0

  ${NSD_CreateCheckbox} 10u 34u 100% 12u "Steam"
  Pop $chkSteam
  ${NSD_CreateCheckbox} 10u 50u 100% 12u "Epic Games Launcher"
  Pop $chkEpic
  ${NSD_CreateCheckbox} 10u 66u 100% 12u "GOG (Galaxy / offline installers)"
  Pop $chkGog
  ${NSD_CreateCheckbox} 10u 82u 100% 12u "Ubisoft Connect"
  Pop $chkUbisoft

  nsDialogs::Show
FunctionEnd

Function LauncherPageLeave
  ${NSD_GetState} $chkSteam $stSteam
  ${NSD_GetState} $chkEpic $stEpic
  ${NSD_GetState} $chkGog $stGog
  ${NSD_GetState} $chkUbisoft $stUbisoft

  ${If} $stSteam != ${BST_CHECKED}
  ${AndIf} $stEpic != ${BST_CHECKED}
  ${AndIf} $stGog != ${BST_CHECKED}
  ${AndIf} $stUbisoft != ${BST_CHECKED}
    MessageBox MB_ICONEXCLAMATION|MB_OK "Please pick at least one launcher."
    Abort
  ${EndIf}
FunctionEnd

!macro customPageAfterChangeDir
  Page custom LauncherPageCreate LauncherPageLeave
!macroend

!macro customInstall
  FileOpen $0 "$INSTDIR\launchers.conf" w
  ${If} $stSteam == ${BST_CHECKED}
    FileWrite $0 "steam=1$\r$\n"
  ${EndIf}
  ${If} $stEpic == ${BST_CHECKED}
    FileWrite $0 "epic=1$\r$\n"
  ${EndIf}
  ${If} $stGog == ${BST_CHECKED}
    FileWrite $0 "gog=1$\r$\n"
  ${EndIf}
  ${If} $stUbisoft == ${BST_CHECKED}
    FileWrite $0 "ubisoft=1$\r$\n"
  ${EndIf}
  FileClose $0
!macroend

!endif

!macro customUnInstall
  Delete "$INSTDIR\launchers.conf"
!macroend
