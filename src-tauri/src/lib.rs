// The launcher's backend: the commands the window calls. The window only
// ever asks; every private decision (who owns what, how many computers a
// key runs on) is made by the server, and the account's tokens live in the
// OS keychain, never in the window.
mod api;
mod auth;
mod config;
mod device;
mod install;
mod launch;
mod paths;
mod session;

use serde_json::{json, Value};
use tauri::Window;

#[tauri::command]
fn me() -> Option<Value> {
    session::load().map(|s| json!({ "email": s.email, "user_id": s.user_id }))
}

#[tauri::command]
async fn sign_in() -> Result<Value, String> {
    let s = auth::sign_in().await?;
    Ok(json!({ "email": s.email, "user_id": s.user_id }))
}

#[tauri::command]
fn sign_out() {
    session::clear();
}

// The library: each game, its key, whether it's installed, and its newest
// Windows build (with the version and download size).
#[tauri::command]
async fn library() -> Result<Value, String> {
    let licenses = api::my_licenses().await?;
    let list = licenses.as_array().cloned().unwrap_or_default();
    let mut games = Vec::new();
    for lic in list {
        let work_id = lic.get("work_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
        if work_id.is_empty() {
            continue;
        }
        let builds = api::builds(&work_id).await.unwrap_or(Value::Array(vec![]));
        let build = builds
            .as_array()
            .and_then(|a| a.iter().find(|b| b.get("platform").and_then(|p| p.as_str()) == Some("windows")))
            .cloned();
        let installed = install::installed(&work_id);
        games.push(json!({
            "license_id": lic.get("license_id"),
            "code": lic.get("code"),
            "work_id": work_id,
            "title": lic.get("title"),
            "cover_url": lic.get("cover_url"),
            "mine": lic.get("mine"),
            "devices": lic.get("devices"),
            "max_devices": lic.get("max_devices"),
            "build": build,
            "installed": installed.as_ref().map(|i| json!({ "version": i.version, "build_id": i.build_id })),
        }));
    }
    Ok(Value::Array(games))
}

#[tauri::command]
async fn redeem(code: String) -> Result<Value, String> {
    api::redeem(&code).await
}

#[tauri::command]
async fn install_game(
    window: Window,
    work_id: String,
    license_id: String,
    build_id: String,
    version: String,
    sha256: Option<String>,
) -> Result<Value, String> {
    // Count this computer against the key before the files land.
    let hash = device::device_hash();
    let name = device::device_name();
    let activation = api::activate_device(&license_id, &hash, &name).await?;
    let ok = activation
        .as_array()
        .and_then(|a| a.first())
        .and_then(|r| r.get("ok"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !ok {
        return Err("device-limit".into());
    }
    let record = install::install(window, work_id, build_id, version, sha256).await?;
    Ok(json!({ "version": record.version, "build_id": record.build_id }))
}

#[tauri::command]
fn play(work_id: String, license_id: String) -> Result<(), String> {
    launch::launch(&work_id, &license_id, &device::device_hash())
}

#[tauri::command]
fn uninstall(work_id: String) -> Result<(), String> {
    install::uninstall(&work_id)
}

#[tauri::command]
fn device_info() -> Value {
    json!({ "name": device::device_name() })
}

// Open a saufox link in the default browser (used for help and the site).
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    if !url.starts_with("https://saufoxentertainment.ir") && !url.starts_with("https://portal.saufoxentertainment.ir") {
        return Err("blocked".into());
    }
    #[cfg(target_os = "windows")]
    let r = std::process::Command::new("cmd").args(["/C", "start", "", &url]).spawn();
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(&url).spawn();
    r.map(|_| ()).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            me,
            sign_in,
            sign_out,
            library,
            redeem,
            install_game,
            play,
            uninstall,
            device_info,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running the launcher");
}
