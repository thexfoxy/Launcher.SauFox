# SauFox launcher

A small desktop app (like Steam, in miniature) where a buyer signs in with
their SauFox account, sees the games they own, installs them straight from
our servers, and plays. Built with [Tauri](https://tauri.app) — a Rust
backend and the same dark, orange-lit web look as the rest of SauFox.

Serves **Windows** first. The Rust code is cross-platform where it can be.

## How it fits together

- **Signing in** never touches the account password. The launcher opens
  `saufoxentertainment.ir/launcher?port=<loopback port>&state=<random>` in
  the browser; the website (already signed in, or after signing in) asks the
  `library` Edge Function for a **one-time** token and sends it back to the
  launcher's loopback server. The launcher turns it into its own session
  with Supabase `verifyOtp`. The token works once and only for this
  launcher; the browser's session is never handed over. (`src/auth.rs`, and
  `launcherPage` on the website.)
- **The session** — the access and refresh tokens and the account's basics —
  is kept in the **OS keychain** (Windows Credential Manager), never on disk
  in the clear. (`src/session.rs`.)
- **The library** comes from `my_licenses()` (the games the account bought or
  redeemed, each with its key) joined with the published `builds`. Row-level
  security means only owned files ever come back. (`src/api.rs`,
  `library` command in `src/lib.rs`.)
- **Redeeming a key** in the launcher calls `redeem_license` — the same
  one-time keys shown in the receipt email and the profile.
- **Devices.** Before a game installs, the launcher registers this computer
  against the key with `activate_device`; a key runs on up to `max_devices`
  computers (default 3). The computer is identified by a **hash** of durable
  machine facts plus a per-install secret kept in the keychain — never
  anything that names the machine to us. `release_device` frees a slot.
  (`src/device.rs`.)
- **Installing** streams the file from a one-hour signed link
  (`library` → `download`, `source: "launcher"`), checks it against the
  build's SHA-256, and unpacks it into the game's own folder under the
  user's local app data. Zip entries with `..` or absolute paths are
  refused. (`src/install.rs`.)
- **Playing** starts the game's executable and hands it the license id and
  device id over environment variables, so the game can check itself with
  our server on start. (`src/launch.rs`.)

## Protecting the game files

The launcher keeps games under the user's own local app data, downloads only
over authenticated, expiring links, and checks each file's SHA-256. Real
protection against copying and tampering lives **inside the game build**, not
the launcher: for Unreal Engine, ship the content in encrypted `.pak` files
and add a startup license check (the `SAUFOX_LICENSE` / `SAUFOX_DEVICE` the
launcher passes, validated against our server, with a short offline grace
period). No protection is unbreakable; the aim is that a plain copy of the
game folder to another computer does not run. That game-side plugin is the
next piece, kept in the game's own project.

## Building

GitHub Actions (`.github/workflows/build.yml`) builds the Windows installer
on every push to `main` (download it from the run's **Artifacts**) and makes
a **Release** when you push a tag like `v0.1.0`. Nothing to run by hand.

Locally, with Rust and Node installed:

```
npm install
npm run tauri icon app-icon.png   # once, or when the icon changes
npm run tauri dev                 # run it
npm run tauri build               # make an installer
```

## Layout

```
src/            the window (HTML/CSS/JS), the SauFox look
src-tauri/      the Rust backend
  src/auth.rs      sign-in handoff + loopback server
  src/session.rs   the session in the OS keychain
  src/device.rs    this computer's private id
  src/api.rs       Supabase REST + Edge Function calls
  src/install.rs   download, verify, unpack
  src/launch.rs    start the game
  src/lib.rs       the commands the window calls
app-icon.png    source icon; CI makes the app icons from it
```

Signed-code note: until the app is signed with a code-signing certificate,
Windows SmartScreen shows an "unknown publisher" warning on first run. The
certificate is a paid, optional next step.
