// The online side of the launcher: presence (online, and which game is
// running), playtime, friends and profiles. The server keeps the records;
// the launcher only reports which of the account's games is running, with a
// heartbeat every minute, and the server checks the game is theirs.
use crate::api;
use serde_json::{json, Value};
use std::process::Child;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

static PLAYING: Mutex<Option<String>> = Mutex::new(None);

/// The functions the window may call by name. Anything else is refused.
const ALLOWED: &[&str] = &[
    "my_friends",
    "friend_request",
    "friend_respond",
    "friend_remove",
    "public_profile",
    "my_playtime",
    "send_message",
    "chat_history",
    "inbox",
    "mark_read",
    "block_user",
    "unblock_user",
    "my_blocks",
    "game_achievements",
];

pub fn playing() -> Option<String> {
    PLAYING.lock().ok().and_then(|p| p.clone())
}

fn set_playing(work: Option<String>) {
    if let Ok(mut p) = PLAYING.lock() {
        *p = work;
    }
}

pub async fn call(action: &str, args: Value) -> Result<Value, String> {
    if !ALLOWED.contains(&action) {
        return Err("blocked".into());
    }
    api::call(action, args).await
}

/// Tell the server the account is online, and in which game.
pub async fn heartbeat() -> Result<(), String> {
    api::call("heartbeat", json!({ "p_playing": playing() })).await.map(|_| ())
}

/// Count a started game as being played until its process ends, then tell
/// the window (and the server) it has stopped.
pub fn watch_game(app: AppHandle, work_id: String, mut child: Child, on_exit: impl FnOnce() + Send + 'static) {
    set_playing(Some(work_id.clone()));
    tauri::async_runtime::spawn(async { let _ = heartbeat().await; });
    let _ = app.emit("game-started", &work_id);
    std::thread::spawn(move || {
        let _ = child.wait();
        on_exit();
        if playing().as_deref() == Some(work_id.as_str()) {
            set_playing(None);
        }
        tauri::async_runtime::spawn(async { let _ = heartbeat().await; });
        let _ = app.emit("game-exited", &work_id);
    });
}
