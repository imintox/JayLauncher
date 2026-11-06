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
| Ubisoft Connect | Registry (`Ubisoft\Launcher\Installs`); titles come from the install folder name | Not yet tested on a real install |
| EA app | Registry (`EA Games`) plus each game's `__Installer\installerdata.xml` | Not yet tested on a real install |
| Battle.net | Blizzard uninstall entries in the registry; known Blizzard titles only | Not yet tested on a real install |
| Xbox / Game Pass | Installed Xbox packages (PowerShell `Get-AppxPackage`) | Not yet tested on a real install |
| Rockstar Games | Registry (`Rockstar Games`); GTA V, RDR2, Max Payne 3, L.A. Noire | Not yet tested on a real install |

Not supported yet: itch.io and Amazon Games (their game lists are stored in SQLite databases). Windows only.

The **Launchers** dialog shows how many games each scanner found, so you can see which ones are working. Games that aren't detected can be added by hand with **+ Add game**.

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

## Settings

Open **Settings** in the app:

- **Launchers:** tick the launchers to scan (with a count of games found for each). **Select all** and **Clear all** are there too. The installer has the same Select all button.
- **Custom game folders:** add any folder that holds games (for example `D:\Games`). Each sub-folder is treated as one game, so this works for launchers that aren't built in. Games show up under the folder's name.
- **General:** start with Windows, scan on start, close Jay Launcher when a game starts, download updates automatically, card size, and default sort.
- **Hidden games:** games you hid with the ✕ button, with Unhide and Unhide all.

## Updates

The installed app checks GitHub Releases when it starts and every 6 hours. A new version downloads in the background and a **Restart to update** bar appears. People's launcher choices are kept.

To publish an update: raise `version` in `package.json`, commit and push, then on GitHub open **Actions → Build installer → Run workflow**, tick **Publish a Release**, and run it. (Pushing a tag like `v0.5.1` does the same.)

GitHub then builds the installer and publishes the Release. The repo has to stay public for installed copies to find updates.

## License

Copyright (c) 2026 Jayden M. All rights reserved. See [LICENSE](LICENSE).
