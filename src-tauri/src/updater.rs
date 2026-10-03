// Updating the launcher itself, like Steam: on every start, before the main
// window shows, the launcher asks for a newer version (quietly, a few
// seconds at most). If there is one, a small window in the site's style
// downloads it, the installer replaces the launcher and starts it again.
//
// Safety: the update list comes only from the fixed HTTPS address in
// tauri.conf.json, and every installer must carry a signature made with the
// studio's private key, checked against the public key built into this
// launcher before anything runs. Only a newer version is accepted. The
// window can't start or steer an update (it has no updater permission); it
// only shows what this code reports.
use serde_json::json;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::{Update, UpdaterExt};

const CHECK_TIMEOUT: Duration = Duration::from_secs(6);

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let found = match app.updater() {
            Ok(updater) => tokio::time::timeout(CHECK_TIMEOUT, updater.check()).await.ok().and_then(|r| r.ok()).flatten(),
            Err(_) => None,
        };
        match found {
            Some(update) => run(app, update).await,
            None => show_main(&app),
        }
    });
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

async fn run(app: AppHandle, update: Update) {
    let info = json!({ "version": update.version, "current": update.current_version });
    let window = WebviewWindowBuilder::new(&app, "update", WebviewUrl::App("update.html".into()))
        .title("SauFox")
        .inner_size(540.0, 280.0)
        .resizable(false)
        .maximizable(false)
        .decorations(false)
        .center()
        .initialization_script(&format!("window.__SAUFOX_UPDATE__ = {info};"))
        .build();
    if window.is_err() {
        return show_main(&app);
    }
    // Give the page a moment to start listening.
    tokio::time::sleep(Duration::from_millis(400)).await;

    let mut received: u64 = 0;
    let progress_app = app.clone();
    let install_app = app.clone();
    let result = update
        .download_and_install(
            move |chunk, total| {
                received += chunk as u64;
                let _ = progress_app.emit_to("update", "update-progress", json!({ "received": received, "total": total }));
            },
            move || {
                let _ = install_app.emit_to("update", "update-progress", json!({ "phase": "install" }));
            },
        )
        .await;

    // On Windows the installer takes over and the launcher closes before
    // this point. Anything else (no connection, a bad signature) carries on
    // with the version already installed.
    if result.is_err() {
        let _ = app.emit_to("update", "update-progress", json!({ "phase": "error" }));
        tokio::time::sleep(Duration::from_secs(3)).await;
        if let Some(w) = app.get_webview_window("update") {
            let _ = w.close();
        }
        show_main(&app);
    }
}
