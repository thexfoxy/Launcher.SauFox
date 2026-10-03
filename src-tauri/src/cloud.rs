// Cloud saves. Each game is told a save folder when it starts
// (SAUFOX_SAVE_DIR, under %LOCALAPPDATA%\SauFox\Saves\<game>). Before the
// game starts, the launcher brings in the cloud copy if it's newer; after
// the game closes, it uploads the folder if it changed. The copy lives in the
// private "saves" bucket at <user id>/<game>/save.zip, which only the player
// can read or write, and only for games they own.
//
// A save is identified by a hash of its content (every file's path and
// bytes), so the same save gives the same hash on every computer. When both
// sides changed since the last sync, the newer one wins and the other is
// kept in Saves\.backups\<game>, so nothing is ever lost.
use crate::api;
use crate::config::{SUPABASE_ANON_KEY, SUPABASE_URL};
use crate::paths;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

/// The biggest save we keep (the bucket refuses anything larger too).
const MAX_ZIP: u64 = 50 * 1024 * 1024;
/// Limits on a save folder, and on what a downloaded ZIP may unpack to.
const MAX_FILES: usize = 5000;
const MAX_TOTAL: u64 = 200 * 1024 * 1024;
const KEEP_BACKUPS: usize = 5;

struct Local {
    sha256: String,
    newest: u64,
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// Every regular file under `dir`, as (path relative with "/", full path),
/// in a fixed order. Links are skipped, so a save can't point outside its
/// folder.
fn files(dir: &Path) -> Result<Vec<(String, PathBuf)>, String> {
    let mut out = Vec::new();
    let mut stack = vec![dir.to_path_buf()];
    while let Some(d) = stack.pop() {
        let entries = match fs::read_dir(&d) {
            Ok(e) => e,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let kind = entry.file_type().map_err(|e| e.to_string())?;
            let path = entry.path();
            if kind.is_symlink() {
                continue;
            }
            if kind.is_dir() {
                stack.push(path);
            } else if kind.is_file() {
                let rel = path.strip_prefix(dir).map_err(|e| e.to_string())?;
                let rel = rel.components().map(|c| c.as_os_str().to_string_lossy().into_owned()).collect::<Vec<_>>().join("/");
                out.push((rel, path));
                if out.len() > MAX_FILES {
                    return Err("save-too-big".into());
                }
            }
        }
    }
    out.sort_by(|a, b| a.0.cmp(&b.0));
    Ok(out)
}

/// The save folder's content hash and newest change, or None when empty.
fn local(dir: &Path) -> Result<Option<Local>, String> {
    let list = files(dir)?;
    if list.is_empty() {
        return Ok(None);
    }
    let mut hash = Sha256::new();
    let mut newest = 0;
    let mut total = 0u64;
    for (rel, path) in &list {
        let meta = fs::metadata(path).map_err(|e| e.to_string())?;
        total += meta.len();
        if total > MAX_TOTAL {
            return Err("save-too-big".into());
        }
        if let Ok(m) = meta.modified() {
            newest = newest.max(m.duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0));
        }
        hash.update(rel.as_bytes());
        hash.update([0]);
        hash.update(meta.len().to_le_bytes());
        let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
        let mut buf = [0u8; 64 * 1024];
        loop {
            let n = f.read(&mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            hash.update(&buf[..n]);
        }
    }
    Ok(Some(Local { sha256: hex::encode(hash.finalize()), newest }))
}

// What was last in sync, per game (so we know which side changed).
fn state_path(work_id: &str) -> PathBuf {
    paths::saves_dir().join(format!(".{}.sync", paths::safe(work_id)))
}
fn synced(work_id: &str) -> Option<String> {
    fs::read_to_string(state_path(work_id)).ok().map(|s| s.trim().to_string()).filter(|s| s.len() == 64)
}
fn set_synced(work_id: &str, sha: &str) {
    let _ = fs::create_dir_all(paths::saves_dir());
    let _ = fs::write(state_path(work_id), sha);
}

fn object_path(user_id: &str, work_id: &str) -> String {
    format!("{user_id}/{work_id}/save.zip")
}

fn zip_dir(dir: &Path) -> Result<Vec<u8>, String> {
    let mut out = std::io::Cursor::new(Vec::new());
    {
        let mut zip = zip::ZipWriter::new(&mut out);
        let options = zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .last_modified_time(zip::DateTime::default());
        for (rel, path) in files(dir)? {
            zip.start_file(rel, options).map_err(|e| e.to_string())?;
            let mut f = fs::File::open(&path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        }
        zip.finish().map_err(|e| e.to_string())?;
    }
    let bytes = out.into_inner();
    if bytes.len() as u64 > MAX_ZIP {
        return Err("save-too-big".into());
    }
    Ok(bytes)
}

/// Unpack a ZIP into `dest` (which must not exist yet). Every name must stay
/// inside the folder, and the whole must stay within the size limits.
fn unzip(bytes: &[u8], dest: &Path) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes)).map_err(|e| e.to_string())?;
    if archive.len() > MAX_FILES {
        return Err("save-too-big".into());
    }
    fs::create_dir_all(dest).map_err(|e| e.to_string())?;
    let mut total = 0u64;
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let rel = entry.enclosed_name().ok_or("bad name in save")?;
        let target = dest.join(rel);
        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            continue;
        }
        if entry.is_symlink() {
            continue;
        }
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut f = fs::File::create(&target).map_err(|e| e.to_string())?;
        let left = MAX_TOTAL.saturating_sub(total);
        let n = std::io::copy(&mut (&mut entry).take(left + 1), &mut f).map_err(|e| e.to_string())?;
        total += n;
        if total > MAX_TOTAL {
            return Err("save-too-big".into());
        }
        f.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

async fn download(user_id: &str, token: &str, work_id: &str) -> Result<Vec<u8>, String> {
    let res = api::client()
        .get(format!("{SUPABASE_URL}/storage/v1/object/authenticated/saves/{}", object_path(user_id, work_id)))
        .header("apikey", SUPABASE_ANON_KEY)
        .bearer_auth(token)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("cloud download failed ({})", res.status()));
    }
    if res.content_length().unwrap_or(0) > MAX_ZIP {
        return Err("save-too-big".into());
    }
    let bytes = res.bytes().await.map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_ZIP {
        return Err("save-too-big".into());
    }
    Ok(bytes.to_vec())
}

async fn upload(user_id: &str, token: &str, work_id: &str, bytes: Vec<u8>) -> Result<(), String> {
    let res = api::client()
        .post(format!("{SUPABASE_URL}/storage/v1/object/saves/{}", object_path(user_id, work_id)))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/zip")
        .header("x-upsert", "true")
        .bearer_auth(token)
        .body(bytes)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("cloud upload failed ({})", res.status()));
    }
    Ok(())
}

/// Move a folder into the game's backups, keeping the newest few.
fn back_up(work_id: &str, dir: &Path, why: &str) {
    if !dir.exists() {
        return;
    }
    let root = paths::saves_dir().join(".backups").join(paths::safe(work_id));
    let _ = fs::create_dir_all(&root);
    let _ = fs::rename(dir, root.join(format!("{}-{why}", now())));
    if let Ok(entries) = fs::read_dir(&root) {
        let mut names: Vec<_> = entries.flatten().map(|e| e.path()).collect();
        names.sort();
        while names.len() > KEEP_BACKUPS {
            let _ = fs::remove_dir_all(names.remove(0));
        }
    }
}

/// Put the cloud copy in place of the local folder, after checking it
/// unpacks to exactly the save the server recorded.
fn install(work_id: &str, bytes: &[u8], expect: &str) -> Result<(), String> {
    let dir = paths::save_dir(work_id);
    let incoming = paths::saves_dir().join(format!(".incoming-{}", paths::safe(work_id)));
    let _ = fs::remove_dir_all(&incoming);
    unzip(bytes, &incoming).map_err(|e| {
        let _ = fs::remove_dir_all(&incoming);
        e
    })?;
    let got = local(&incoming)?.map(|l| l.sha256);
    if got.as_deref() != Some(expect) {
        let _ = fs::remove_dir_all(&incoming);
        return Err("cloud save didn't match".into());
    }
    back_up(work_id, &dir, "replaced");
    fs::rename(&incoming, &dir).map_err(|e| e.to_string())?;
    set_synced(work_id, expect);
    Ok(())
}

/// Keep the cloud copy as a backup without touching the local save.
fn keep_cloud_copy(work_id: &str, bytes: &[u8]) {
    let tmp = paths::saves_dir().join(format!(".cloudcopy-{}", paths::safe(work_id)));
    let _ = fs::remove_dir_all(&tmp);
    if unzip(bytes, &tmp).is_ok() {
        back_up(work_id, &tmp, "cloud");
    }
    let _ = fs::remove_dir_all(&tmp);
}

/// Before the game starts: bring in the cloud copy when it's the newer one.
/// Answers what happened: "none", "synced", "downloaded" or "kept-local".
pub async fn pull(work_id: &str) -> Result<&'static str, String> {
    let dir = paths::save_dir(work_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let info = api::call("save_info", json!({ "p_work": work_id })).await?;
    let Some(cloud_sha) = info.get("sha256").and_then(Value::as_str).map(str::to_string) else {
        return Ok("none");
    };
    let cloud_at = info.get("updated_epoch").and_then(Value::as_u64).unwrap_or(0);
    let mine = local(&dir)?;
    if mine.as_ref().map(|l| l.sha256.as_str()) == Some(cloud_sha.as_str()) {
        set_synced(work_id, &cloud_sha);
        return Ok("synced");
    }
    let session = api::fresh_token().await?;
    let unchanged_here = match &mine {
        None => true,
        Some(l) => synced(work_id).as_deref() == Some(l.sha256.as_str()),
    };
    let bytes = download(&session.user_id, &session.access_token, work_id).await?;
    if unchanged_here || mine.as_ref().map(|l| l.newest <= cloud_at).unwrap_or(true) {
        install(work_id, &bytes, &cloud_sha)?;
        Ok("downloaded")
    } else {
        // Both changed, and this computer's save is newer: keep it (it goes
        // up after the game), and keep the cloud's as a backup.
        keep_cloud_copy(work_id, &bytes);
        Ok("kept-local")
    }
}

/// After the game closes: upload the save if it changed.
/// Answers "none", "synced" or "uploaded".
pub async fn push(work_id: &str) -> Result<&'static str, String> {
    let dir = paths::save_dir(work_id);
    let Some(mine) = local(&dir)? else { return Ok("none") };
    let last = synced(work_id);
    if last.as_deref() == Some(mine.sha256.as_str()) {
        return Ok("synced");
    }
    let session = api::fresh_token().await?;
    let info = api::call("save_info", json!({ "p_work": work_id })).await?;
    let cloud_sha = info.get("sha256").and_then(Value::as_str).map(str::to_string);
    if cloud_sha.as_deref() == Some(mine.sha256.as_str()) {
        set_synced(work_id, &mine.sha256);
        return Ok("synced");
    }
    // The cloud changed elsewhere since we last synced (say, played on
    // another computer while this one was offline): keep that copy too.
    if cloud_sha.is_some() && cloud_sha != last {
        if let Ok(bytes) = download(&session.user_id, &session.access_token, work_id).await {
            keep_cloud_copy(work_id, &bytes);
        }
    }
    let bytes = zip_dir(&dir)?;
    let size = bytes.len() as u64;
    upload(&session.user_id, &session.access_token, work_id, bytes).await?;
    api::call(
        "save_commit",
        json!({ "p_work": work_id, "p_sha256": mine.sha256, "p_size": size, "p_device": crate::device::device_name() }),
    )
    .await?;
    set_synced(work_id, &mine.sha256);
    Ok("uploaded")
}

/// For the game page: what's in the cloud, and whether this computer has it.
pub async fn status(work_id: &str) -> Result<Value, String> {
    let info = api::call("save_info", json!({ "p_work": work_id })).await?;
    let mine = local(&paths::save_dir(work_id)).ok().flatten().map(|l| l.sha256);
    let in_sync = info.get("sha256").and_then(Value::as_str).is_some_and(|s| Some(s) == mine.as_deref());
    Ok(json!({ "cloud": info, "in_sync": in_sync, "has_local": mine.is_some() }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("saufox-cloud-{name}-{}", now()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn zip_round_trip_keeps_the_hash() {
        let src = temp("src");
        fs::create_dir_all(src.join("slot1")).unwrap();
        fs::write(src.join("slot1/save.dat"), b"level 3").unwrap();
        fs::write(src.join("settings.ini"), b"volume=7").unwrap();
        let a = local(&src).unwrap().unwrap().sha256;
        let bytes = zip_dir(&src).unwrap();
        let dest = temp("dest").join("out");
        unzip(&bytes, &dest).unwrap();
        assert_eq!(local(&dest).unwrap().unwrap().sha256, a);
        fs::write(dest.join("settings.ini"), b"volume=8").unwrap();
        assert_ne!(local(&dest).unwrap().unwrap().sha256, a);
    }

    #[test]
    fn unzip_refuses_names_outside_the_folder() {
        let mut out = std::io::Cursor::new(Vec::new());
        {
            let mut zip = zip::ZipWriter::new(&mut out);
            zip.start_file("../evil.txt", zip::write::SimpleFileOptions::default()).unwrap();
            zip.write_all(b"x").unwrap();
            zip.finish().unwrap();
        }
        let dest = temp("evil").join("out");
        assert!(unzip(&out.into_inner(), &dest).is_err());
        assert!(!dest.parent().unwrap().join("evil.txt").exists());
    }

    #[test]
    fn empty_folder_has_no_save() {
        assert!(local(&temp("empty")).unwrap().is_none());
    }
}
