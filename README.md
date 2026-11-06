# Jay Launcher

All your games from every launcher, in one library. Designed by Jayden M.

Jay Launcher finds the games you have installed in Steam, Epic Games, GOG and Ubisoft Connect, shows them in a single grid, and starts each one through its own launcher.

## Download

Get the latest `Jay Launcher Setup x.y.z.exe` from the **Releases** page and run it. During setup you pick which launchers to support. Only the ones you tick are scanned, and you can change this later with the **Launchers** button in the app.

Windows will show a "Windows protected your PC" screen because the installer is not code-signed. Click **More info**, then **Run anyway**.

## Supported launchers

| Launcher | How games are found | Status |
|---|---|---|
| Steam | `appmanifest_*.acf` in every Steam library folder | Working |
| Epic Games | Manifests in `ProgramData\Epic` | Working |
| GOG | Registry (`GOG.com\Games`) | Not yet tested on a real install |
| Ubisoft Connect | Registry (`Ubisoft\Launcher\Installs`) | Not yet tested on a real install. Titles come from the install folder name |

Windows only. Games that aren't detected can be added by hand with **+ Add game**.

## Build the installer

1. Unzip the project.
2. Double-click **`build.bat`** (it asks for admin once, installs what it needs, and builds).
3. The installer appears in `dist\` as `Jay Launcher Setup x.y.z.exe`.

To run it without building an installer: `npm install`, then `npm start`.

You can also build it on GitHub: **Actions → Build installer → Run workflow**. Pushing a tag like `v0.3.0` also publishes it as a Release.

## Add a launcher

1. Create `scanners/<name>.js` exporting `{ name, scan() }`. `scan()` returns games shaped like `{ id, title, launcher, launchUri | exe, installPath, art }`.
2. Add it to the list in `scanners/index.js`.
3. Add it to `ALL` in `config.js` and as a checkbox in `build/installer.nsh`.

## Project layout

```
main.js          app window, IPC
preload.js       safe bridge to the UI
library.js       saved library (JSON)
config.js        which launchers are enabled
scanners/        one file per launcher
renderer/        the UI
build/           installer page, icon, installer artwork
```

## License

Copyright (c) 2026 Jayden M. All rights reserved. See [LICENSE](LICENSE).
