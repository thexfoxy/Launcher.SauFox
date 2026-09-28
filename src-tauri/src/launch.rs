// Starting an installed game. The launcher hands the game its license and a
// short-lived proof over environment variables, so the game can check with
// our server on start (the check itself lives in the game). We never keep
// the game files in the clear on a shared path; they sit under the user's
// local app data, in the game's own folder.
use crate::install;
use crate::paths;
use std::path::PathBuf;

/// Launch the game for `work_id`, passing the license id and device id so the
/// game can validate itself. Returns once the game has started.
pub fn launch(work_id: &str, license_id: &str, device_hash: &str) -> Result<(), String> {
    let record = install::installed(work_id).ok_or("not installed")?;
    let dir = paths::game_dir(work_id);
    let exe = record
        .exe
        .as_ref()
        .map(|e| dir.join(e))
        .filter(|p| p.exists())
        .or_else(|| find_exe(&dir))
        .ok_or("couldn't find the game to start")?;

    let mut cmd = std::process::Command::new(&exe);
    if let Some(parent) = exe.parent() {
        cmd.current_dir(parent);
    }
    cmd.env("SAUFOX_LICENSE", license_id)
        .env("SAUFOX_DEVICE", device_hash);
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

fn find_exe(dir: &PathBuf) -> Option<PathBuf> {
    let entries = std::fs::read_dir(dir).ok()?;
    let mut hits: Vec<PathBuf> = entries
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().map(|x| x.eq_ignore_ascii_case("exe")).unwrap_or(false))
        .collect();
    // Prefer a top-level exe that isn't an installer/crash-handler.
    hits.sort_by_key(|p| {
        let n = p.file_name().and_then(|s| s.to_str()).unwrap_or("").to_ascii_lowercase();
        (n.contains("crash") || n.contains("setup") || n.contains("unins")) as u8
    });
    hits.into_iter().next()
}
