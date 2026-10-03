// Starting an installed game. The launcher hands the game its license and a
// short-lived proof over environment variables, so the game can check with
// our server on start (the check itself lives in the game). We never keep
// the game files in the clear on a shared path; they sit under the user's
// local app data, in the game's own folder.
use crate::install;
use crate::paths;

/// Launch the game for `work_id`, passing the license id and device id so the
/// game can validate itself. Returns the running game's process, so the
/// launcher can count playtime until it ends.
pub fn launch(work_id: &str, license_id: &str, device_hash: &str) -> Result<std::process::Child, String> {
    let record = install::installed(work_id).ok_or("not installed")?;
    let dir = paths::game_dir(work_id);
    let relative = record.exe.as_deref().ok_or("Reinstall this game to record its executable")?;
    let exe = install::checked_executable(&dir, relative)?;

    let mut cmd = std::process::Command::new(&exe);
    if let Some(parent) = exe.parent() {
        cmd.current_dir(parent);
    }
    cmd.env("SAUFOX_LICENSE", license_id)
        .env("SAUFOX_DEVICE", device_hash);
    cmd.spawn().map_err(|e| e.to_string())
}
