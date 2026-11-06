; Custom installer page: pick which launchers to support.
; Nothing is ticked by default. Choices are written to $INSTDIR\launchers.conf,
; which the app reads on first start (and the user can change later in Settings).

!include nsDialogs.nsh
!include LogicLib.nsh

!macro customHeader
  BrandingText "Jay Launcher - Designed by Jayden M."
!macroend

; electron-builder compiles this file twice (installer + uninstaller).
; The page code is only used by the installer.
!ifndef BUILD_UNINSTALLER

Var chkSteam
Var chkEpic
Var chkGog
Var chkUbisoft
Var chkEa
Var chkBnet
Var chkXbox
Var chkRockstar
Var stSteam
Var stEpic
Var stGog
Var stUbisoft
Var stEa
Var stBnet
Var stXbox
Var stRockstar

Function LauncherPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 24u "Choose the game launchers you want Jay Launcher to look for. Only the ones you tick will be scanned. You can change this later in Settings."
  Pop $0

  ${NSD_CreateCheckbox} 10u 34u 135u 12u "Steam"
  Pop $chkSteam
  ${NSD_CreateCheckbox} 10u 50u 135u 12u "Epic Games Launcher"
  Pop $chkEpic
  ${NSD_CreateCheckbox} 10u 66u 135u 12u "GOG"
  Pop $chkGog
  ${NSD_CreateCheckbox} 10u 82u 135u 12u "Ubisoft Connect"
  Pop $chkUbisoft

  ${NSD_CreateCheckbox} 155u 34u 135u 12u "EA app"
  Pop $chkEa
  ${NSD_CreateCheckbox} 155u 50u 135u 12u "Battle.net"
  Pop $chkBnet
  ${NSD_CreateCheckbox} 155u 66u 135u 12u "Xbox / Game Pass"
  Pop $chkXbox
  ${NSD_CreateCheckbox} 155u 82u 135u 12u "Rockstar Games"
  Pop $chkRockstar

  nsDialogs::Show
FunctionEnd

Function LauncherPageLeave
  ${NSD_GetState} $chkSteam $stSteam
  ${NSD_GetState} $chkEpic $stEpic
  ${NSD_GetState} $chkGog $stGog
  ${NSD_GetState} $chkUbisoft $stUbisoft
  ${NSD_GetState} $chkEa $stEa
  ${NSD_GetState} $chkBnet $stBnet
  ${NSD_GetState} $chkXbox $stXbox
  ${NSD_GetState} $chkRockstar $stRockstar

  ${If} $stSteam != ${BST_CHECKED}
  ${AndIf} $stEpic != ${BST_CHECKED}
  ${AndIf} $stGog != ${BST_CHECKED}
  ${AndIf} $stUbisoft != ${BST_CHECKED}
  ${AndIf} $stEa != ${BST_CHECKED}
  ${AndIf} $stBnet != ${BST_CHECKED}
  ${AndIf} $stXbox != ${BST_CHECKED}
  ${AndIf} $stRockstar != ${BST_CHECKED}
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
  ${If} $stEa == ${BST_CHECKED}
    FileWrite $0 "ea=1$\r$\n"
  ${EndIf}
  ${If} $stBnet == ${BST_CHECKED}
    FileWrite $0 "battlenet=1$\r$\n"
  ${EndIf}
  ${If} $stXbox == ${BST_CHECKED}
    FileWrite $0 "xbox=1$\r$\n"
  ${EndIf}
  ${If} $stRockstar == ${BST_CHECKED}
    FileWrite $0 "rockstar=1$\r$\n"
  ${EndIf}
  FileClose $0
!macroend

!endif

!macro customUnInstall
  Delete "$INSTDIR\launchers.conf"
!macroend
