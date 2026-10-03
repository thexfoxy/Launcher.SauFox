// The achievement popup: a small card at the bottom-right of the screen, on
// top of the game, for a few seconds. It never takes focus from the game.
use serde_json::Value;
use std::time::Duration;
use tauri::{AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

const W: f64 = 360.0;
const H: f64 = 96.0;

pub fn achievement(app: &AppHandle, event: &Value) {
    let app = app.clone();
    let event = event.clone();
    // Windows are made on the main thread.
    let handle = app.clone();
    let _ = handle.run_on_main_thread(move || {
        // A new one replaces any still showing.
        for (label, old) in app.webview_windows() {
            if label.starts_with("achievement") {
                let _ = old.close();
            }
        }
        let script = format!("window.__SAUFOX_ACHIEVEMENT__ = {};", event);
        let label = format!("achievement-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0));
        let Ok(window) = WebviewWindowBuilder::new(&app, label, WebviewUrl::App("achievement.html".into()))
            .title("SauFox")
            .inner_size(W, H)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .initialization_script(&script)
            .build()
        else {
            return;
        };
        if let Ok(Some(monitor)) = window.primary_monitor() {
            let scale = monitor.scale_factor();
            let size = monitor.size();
            let pos = monitor.position();
            let x = pos.x + size.width as i32 - ((W + 24.0) * scale) as i32;
            let y = pos.y + size.height as i32 - ((H + 72.0) * scale) as i32;
            let _ = window.set_position(PhysicalPosition::new(x, y));
        }
        let _ = window.show();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(Duration::from_millis(6500)).await;
            let _ = window.close();
        });
    });
}
