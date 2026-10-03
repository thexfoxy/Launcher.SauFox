# SauFox launcher SDK

What a game gets when the SauFox launcher starts it, and how to use it for
**achievements** and **cloud saves**. Ready-made code: [`unreal/`](unreal/) (Unreal Engine 5, C++ and Blueprints),
[`unity/SauFox.cs`](unity/SauFox.cs) and [`godot/saufox.gd`](godot/saufox.gd).
Any other engine only needs an HTTP request.

## Unreal Engine (quick start)

1. Copy `unreal/SauFoxSDK.h` and `unreal/SauFoxSDK.cpp` into your game module's
   `Source/<Game>/` folder and replace `MYGAME_API` with your module's macro
   (e.g. `CANDLEWOOD_API`).
2. In `<Game>.Build.cs`, add `"HTTP", "Json", "JsonUtilities"` to
   `PublicDependencyModuleNames`. Regenerate project files and build.
3. In Blueprints, the **SauFox** category has: *Unlock Achievement*,
   *Save Game to SauFox* / *Load Game from SauFox* / *Does SauFox Save Exist*
   (use them instead of *Save Game to Slot* / *Load Game from Slot*),
   *Get Save Dir* and *Is Available*.

Use *Save Game to SauFox* for everything you want in the cloud: Unreal's own
*Save Game to Slot* writes to `Saved/SaveGames` next to the game, which the
launcher doesn't sync. Keep config (`GameUserSettings.ini`) where Unreal puts it.

## Environment variables

| Variable | What it is |
| --- | --- |
| `SAUFOX_SAVE_DIR` | The folder to keep save files in (synced with the cloud). |
| `SAUFOX_SDK_URL` | `http://127.0.0.1:<port>`, the launcher, for this game only. |
| `SAUFOX_SDK_TOKEN` | Send as `Authorization: Bearer <token>` on every request. |
| `SAUFOX_WORK_ID` | The game's id on the site (e.g. `the-candlewood`). |
| `SAUFOX_LICENSE`, `SAUFOX_DEVICE` | As before, for the game's own license check. |

If they're missing, the game wasn't started by the launcher: skip achievements
and save somewhere of your own, so the game still runs.

## Cloud saves

Write every save file under `SAUFOX_SAVE_DIR` (subfolders are fine). That's all.
Before the game starts, the launcher brings in the cloud copy if it's newer;
after the game closes, it uploads the folder if anything changed. Limits: 50 MB
zipped, 5,000 files. If two computers both changed the save, the newer one is
kept and the other goes to `%LOCALAPPDATA%\SauFox\Saves\.backups\<game>`.

Don't keep anything in that folder that isn't a save (logs, caches, shader
caches): it all goes to the cloud.

## Achievements

Define them in the admin panel (Admin → Achievements): a **key** such as
`first_steps`, a title and description in English and Persian, and whether it's
hidden until unlocked. Then, from the game:

```
POST {SAUFOX_SDK_URL}/v1/achievements/unlock
Authorization: Bearer {SAUFOX_SDK_TOKEN}
Content-Type: application/json

{"key": "first_steps"}
```

Answer: `{"ok": true, "new": true}` the first time (the launcher shows the
popup), `"new": false` after. Unlocking again is harmless. Errors:
`404 unknown-achievement` (no such key for this game), `403 not-owned`,
`401` (wrong token), `502` (server unreachable; try again later).

Also available:

- `GET /v1/achievements`: every achievement with `unlocked_at` (null if not yet)
  and `percent` (how many players have it).
- `GET /v1/user`: the player's username (`handle`) and `save_dir`.

## Security

The launcher listens only on 127.0.0.1, only while the game runs, and only for
requests carrying the token. The game never gets the player's session, and the
server checks the player owns the game. Achievements unlocked by the game
can't be verified beyond that, the same as on any PC store.
