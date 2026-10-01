// Verify server metadata and stage files before replacing an existing install.
use crate::{api, paths};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{fs, io::Write, path::{Path, PathBuf}};
use tauri::{Emitter, Window};
pub static MUTATION: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
#[derive(Clone, Serialize)]
struct Progress { work_id: String, phase: String, received: u64, total: u64 }
#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Installed {
    pub work_id: String,
    pub version: String,
    pub build_id: String,
    pub exe: Option<String>,
}
pub fn installed(work_id: &str) -> Option<Installed> {
    let raw = fs::read_to_string(paths::game_dir(work_id).join(".saufox.json")).ok()?;
    serde_json::from_str(&raw).ok()
}
// Validate Windows names even when running tests on Unix.
fn safe_relative(value: &str) -> bool {
    !value.is_empty() && value.split('/').all(|part| {
        let base = part.split('.').next().unwrap_or("").to_ascii_uppercase();
        !part.is_empty() && part != "." && part != ".." && !part.ends_with(['.', ' '])
            && !part.chars().any(|c| c.is_control() || matches!(c, '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
            && !matches!(base.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "COM1" | "COM2" | "COM3" | "COM4" | "COM5" | "COM6" | "COM7" | "COM8" | "COM9" | "LPT1" | "LPT2" | "LPT3" | "LPT4" | "LPT5" | "LPT6" | "LPT7" | "LPT8" | "LPT9")
    })
}
pub fn checked_executable(dir: &Path, relative: &str) -> Result<PathBuf, String> {
    if !safe_relative(relative) || !relative.to_ascii_lowercase().ends_with(".exe") { return Err("invalid executable path".into()); }
    let root = dir.canonicalize().map_err(|e| e.to_string())?;
    let exe = dir.join(relative).canonicalize().map_err(|e| e.to_string())?;
    if !exe.starts_with(&root) || !exe.is_file() { return Err("executable outside game folder".into()); }
    Ok(exe)
}
struct Scratch { temp: PathBuf, stage: PathBuf }
impl Drop for Scratch {
    fn drop(&mut self) { let _ = fs::remove_file(&self.temp); let _ = fs::remove_dir_all(&self.stage); }
}
pub async fn install(window: Window, work_id: String, build_id: String, _version: String, _sha256: Option<String>) -> Result<Installed, String> {
    let metadata = api::download_link(&build_id).await?;
    if metadata.work_id != work_id || metadata.platform != "windows" || metadata.size_bytes == 0
        || metadata.sha256.len() != 64 || !metadata.sha256.bytes().all(|b| b.is_ascii_hexdigit())
        || !safe_relative(&metadata.entrypoint) || !metadata.entrypoint.ends_with(".exe") { return Err("invalid build metadata".into()); }
    let url = url::Url::parse(&metadata.url).map_err(|e| e.to_string())?;
    if url.scheme() != "https" { return Err("insecure download URL".into()); }
    fs::create_dir_all(paths::downloads_dir()).map_err(|e| e.to_string())?;
    fs::create_dir_all(paths::games_dir()).map_err(|e| e.to_string())?;
    let mut random = [0u8; 16]; getrandom::getrandom(&mut random).map_err(|e| e.to_string())?;
    let nonce = hex::encode(random);
    let scratch = Scratch { temp: paths::downloads_dir().join(format!("{nonce}.part")), stage: paths::games_dir().join(format!(".stage-{nonce}")) };
    let client = reqwest::Client::builder().https_only(true)
        .connect_timeout(std::time::Duration::from_secs(30)).read_timeout(std::time::Duration::from_secs(120))
        .build().map_err(|e| e.to_string())?;
    let res = client.get(url).send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() { return Err(format!("download failed ({})", res.status())); }
    let total = metadata.size_bytes;
    if res.content_length().is_some_and(|n| n != total) { return Err("download size mismatch".into()); }
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(&scratch.temp).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new(); let mut received = 0u64; let mut last = 0u64;
    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        received = received.checked_add(chunk.len() as u64).ok_or("download too large")?;
        if received > total { return Err("download size mismatch".into()); }
        file.write_all(&chunk).map_err(|e| e.to_string())?; hasher.update(&chunk);
        if received - last > 2_000_000 || received == total {
            last = received;
            let _ = window.emit("install-progress", Progress { work_id: work_id.clone(), phase: "download".into(), received, total });
        }
    }
    file.sync_all().map_err(|e| e.to_string())?; drop(file);
    verify(received, total, &hex::encode(hasher.finalize()), &metadata.sha256)?;
    let _ = window.emit("install-progress", Progress { work_id: work_id.clone(), phase: "install".into(), received, total });
    fs::create_dir(&scratch.stage).map_err(|e| e.to_string())?;
    unpack(&scratch.temp, &scratch.stage, &metadata.file_name, &metadata.entrypoint)?;
    checked_executable(&scratch.stage, &metadata.entrypoint)?;
    let record = Installed { work_id: work_id.clone(), version: metadata.version, build_id, exe: Some(metadata.entrypoint) };
    fs::write(scratch.stage.join(".saufox.json"), serde_json::to_vec(&record).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    replace(&scratch.stage, &paths::game_dir(&work_id), &paths::games_dir().join(format!(".backup-{nonce}")))?;
    let _ = window.emit("install-progress", Progress { work_id, phase: "done".into(), received, total });
    Ok(record)
}
fn verify(received: u64, expected: u64, actual: &str, wanted: &str) -> Result<(), String> {
    if received != expected || !actual.eq_ignore_ascii_case(wanted) { return Err("the download was damaged; please try again".into()); }
    Ok(())
}
fn replace(stage: &Path, dir: &Path, backup: &Path) -> Result<(), String> {
    let had_previous = dir.exists();
    if had_previous { fs::rename(dir, backup).map_err(|e| e.to_string())?; }
    if let Err(error) = fs::rename(stage, dir) {
        if had_previous { fs::rename(backup, dir).map_err(|restore| format!("{error}; restore failed: {restore}; previous install is at {}", backup.display()))?; }
        return Err(error.to_string());
    }
    if had_previous { let _ = fs::remove_dir_all(backup); }
    Ok(())
}
fn unpack(archive: &Path, dir: &Path, file_name: &str, entrypoint: &str) -> Result<(), String> {
    if file_name.to_ascii_lowercase().ends_with(".exe") {
        if entrypoint.contains('/') { return Err("single executable requires a top-level entrypoint".into()); }
        fs::copy(archive, dir.join(entrypoint)).map_err(|e| e.to_string())?; return Ok(());
    }
    if !file_name.to_ascii_lowercase().ends_with(".zip") { return Err("Windows builds must be ZIP or EXE files".into()); }
    let mut zip = zip::ZipArchive::new(fs::File::open(archive).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    if zip.len() > 100_000 { return Err("too many archive entries".into()); }
    let mut expanded = 0u64;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().trim_end_matches('/');
        if !safe_relative(name) || entry.unix_mode().is_some_and(|mode| mode & 0o170000 == 0o120000) { return Err("unsafe archive entry".into()); }
        let out = dir.join(name);
        if entry.is_dir() { fs::create_dir_all(&out).map_err(|e| e.to_string())?; continue; }
        expanded = expanded.checked_add(entry.size()).ok_or("archive too large")?;
        if expanded > 100_000_000_000 { return Err("archive exceeds 100 GB".into()); }
        if let Some(parent) = out.parent() { fs::create_dir_all(parent).map_err(|e| e.to_string())?; }
        let mut dest = fs::OpenOptions::new().create_new(true).write(true).open(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut dest).map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn uninstall(work_id: &str) -> Result<(), String> {
    let dir = paths::game_dir(work_id);
    if dir.exists() { fs::remove_dir_all(&dir).map_err(|e| e.to_string())?; }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_windows_path_aliases_and_traversal() {
        for bad in ["../game.exe", "/game.exe", "C:/game.exe", "a\\b.exe", "con.exe", "bin./game.exe", "bin/game.exe:stream", "./game.exe"] { assert!(!safe_relative(bad), "{bad}"); }
        assert!(safe_relative("bin/Game.exe"));
    }
    #[test]
    fn size_and_checksum_are_both_required() {
        assert!(verify(3, 4, "abcd", "abcd").is_err()); assert!(verify(4, 4, "abcd", "ffff").is_err()); assert!(verify(4, 4, "abcd", "ABCD").is_ok());
    }
    #[test]
    fn failed_replacement_restores_previous_version() {
        let mut bytes = [0u8; 16]; getrandom::getrandom(&mut bytes).unwrap();
        let root = std::env::temp_dir().join(hex::encode(bytes)); let dir = root.join("game"); fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("old.exe"), b"old").unwrap();
        assert!(replace(&root.join("missing"), &dir, &root.join("backup")).is_err());
        assert_eq!(fs::read(dir.join("old.exe")).unwrap(), b"old"); fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn corrupt_zip_and_traversal_are_rejected_without_touching_existing_files() {
        let mut bytes = [0u8; 16]; getrandom::getrandom(&mut bytes).unwrap();
        let root = std::env::temp_dir().join(hex::encode(bytes));
        let stage = root.join("stage"); fs::create_dir_all(&stage).unwrap();
        let archive = root.join("build.zip");
        fs::write(&archive, b"not a zip").unwrap();
        assert!(unpack(&archive, &stage, "build.zip", "Game.exe").is_err());
        let mut zip = zip::ZipWriter::new(fs::File::create(&archive).unwrap());
        zip.start_file("../escape.exe", zip::write::SimpleFileOptions::default()).unwrap();
        zip.write_all(b"bad").unwrap(); zip.finish().unwrap();
        assert!(unpack(&archive, &stage, "build.zip", "Game.exe").is_err());
        assert!(!root.join("escape.exe").exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn only_the_declared_executable_is_used() {
        let mut bytes = [0u8; 16]; getrandom::getrandom(&mut bytes).unwrap();
        let root = std::env::temp_dir().join(hex::encode(bytes)); fs::create_dir_all(root.join("bin")).unwrap();
        fs::write(root.join("CrashReporter.exe"), b"helper").unwrap();
        fs::write(root.join("bin/Game.exe"), b"game").unwrap();
        assert_eq!(checked_executable(&root, "bin/Game.exe").unwrap(), root.join("bin/Game.exe").canonicalize().unwrap());
        assert!(checked_executable(&root, "Missing.exe").is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
