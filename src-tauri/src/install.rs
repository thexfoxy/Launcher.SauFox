// Downloading a build and installing it. The file streams to disk with
// progress the window can show, is checked against its SHA-256, then
// unpacked into the game's own folder. A small manifest records what's
// installed so the library knows the state next time.
use crate::api;
use crate::paths;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use tauri::{Emitter, Window};

#[derive(Clone, Serialize)]
struct Progress {
    work_id: String,
    phase: String, // "download" | "verify" | "install" | "done"
    received: u64,
    total: u64,
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct Installed {
    pub work_id: String,
    pub version: String,
    pub build_id: String,
    pub exe: Option<String>,
}

fn manifest_path(work_id: &str) -> PathBuf {
    paths::game_dir(work_id).join(".saufox.json")
}

pub fn installed(work_id: &str) -> Option<Installed> {
    let raw = fs::read_to_string(manifest_path(work_id)).ok()?;
    serde_json::from_str(&raw).ok()
}

fn emit(window: &Window, p: Progress) {
    let _ = window.emit("install-progress", p);
}

/// Download build `build_id` of `work_id` (version `version`) and install it.
pub async fn install(
    window: Window,
    work_id: String,
    build_id: String,
    version: String,
    sha256: Option<String>,
) -> Result<Installed, String> {
    let (url, file_name, size) = api::download_link(&build_id).await?;
    fs::create_dir_all(paths::downloads_dir()).map_err(|e| e.to_string())?;
    let temp = paths::downloads_dir().join(format!("{build_id}.part"));

    // Download, streaming to disk, reporting progress.
    let res = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("download failed ({})", res.status()));
    }
    let total = if size > 0 { size } else { res.content_length().unwrap_or(0) };
    let mut file = fs::File::create(&temp).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut received: u64 = 0;
    let mut stream = res.bytes_stream();
    let mut last = 0u64;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        hasher.update(&chunk);
        received += chunk.len() as u64;
        if received - last > 2_000_000 || received == total {
            last = received;
            emit(&window, Progress { work_id: work_id.clone(), phase: "download".into(), received, total });
        }
    }
    file.flush().map_err(|e| e.to_string())?;
    drop(file);

    // Check the file is exactly what we expect.
    emit(&window, Progress { work_id: work_id.clone(), phase: "verify".into(), received, total });
    if let Some(want) = sha256.as_deref().filter(|s| s.len() == 64) {
        let got = hex::encode(hasher.finalize());
        if !got.eq_ignore_ascii_case(want) {
            let _ = fs::remove_file(&temp);
            return Err("the download was damaged; please try again".into());
        }
    }

    // Unpack into a fresh game folder.
    emit(&window, Progress { work_id: work_id.clone(), phase: "install".into(), received, total });
    let dir = paths::game_dir(&work_id);
    if dir.exists() {
        let _ = fs::remove_dir_all(&dir);
    }
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let exe = unzip(&temp, &dir, &file_name)?;
    let _ = fs::remove_file(&temp);

    let record = Installed { work_id: work_id.clone(), version, build_id, exe };
    fs::write(
        manifest_path(&work_id),
        serde_json::to_string(&record).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    emit(&window, Progress { work_id, phase: "done".into(), received, total });
    Ok(record)
}

// Unzip an archive; if it isn't a zip, keep the single file as-is. Returns
// the game's launch executable if one is found.
fn unzip(archive: &PathBuf, dir: &PathBuf, file_name: &str) -> Result<Option<String>, String> {
    let file = fs::File::open(archive).map_err(|e| e.to_string())?;
    let mut zip = match zip::ZipArchive::new(file) {
        Ok(z) => z,
        Err(_) => {
            // Not a zip: store the file directly.
            let dest = dir.join(sanitize(file_name));
            fs::copy(archive, &dest).map_err(|e| e.to_string())?;
            return Ok(dest.file_name().and_then(|n| n.to_str()).map(|s| s.to_string()));
        }
    };
    let mut exe: Option<String> = None;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        let name = match entry.enclosed_name() {
            Some(p) => p.to_path_buf(),
            None => continue, // reject entries with ".." or absolute paths
        };
        let out = dir.join(&name);
        if entry.is_dir() {
            fs::create_dir_all(&out).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = out.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut dest = fs::File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut dest).map_err(|e| e.to_string())?;
        if exe.is_none() {
            if let Some(s) = out.to_str() {
                if s.to_ascii_lowercase().ends_with(".exe") {
                    exe = Some(name.to_string_lossy().to_string());
                }
            }
        }
    }
    Ok(exe)
}

fn sanitize(name: &str) -> String {
    name.chars()
        .filter(|c| !matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
        .collect()
}

pub fn uninstall(work_id: &str) -> Result<(), String> {
    let dir = paths::game_dir(work_id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}
