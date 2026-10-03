// The game SDK: while a game runs, the launcher listens on a random port on
// 127.0.0.1 for that one game. The game finds it through SAUFOX_SDK_URL and
// SAUFOX_SDK_TOKEN (environment variables only the game gets), and can:
//
//   GET  /v1/user                     the player's username and save folder
//   GET  /v1/achievements             the game's achievements and which are unlocked
//   POST /v1/achievements/unlock      {"key":"first_steps"}
//
// The game never sees the player's session: the launcher calls the server
// as the player, for this game only (the token is tied to it), and the
// server checks the player owns it. Requests from web pages are refused
// (they carry an Origin header, or the wrong Host), and the listener closes
// when the game does.
use crate::{api, paths, popup};
use serde_json::{json, Value};
use std::io::Read;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

pub struct Sdk {
    pub url: String,
    pub token: String,
    stop: Arc<AtomicBool>,
}

impl Sdk {
    pub fn stop(&self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

fn same(a: &[u8], b: &[u8]) -> bool {
    // Compare without stopping at the first difference.
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

fn reply(request: tiny_http::Request, code: u16, body: Value) {
    let response = tiny_http::Response::from_string(body.to_string())
        .with_status_code(code)
        .with_header("Content-Type: application/json".parse::<tiny_http::Header>().unwrap())
        .with_header("Cache-Control: no-store".parse::<tiny_http::Header>().unwrap());
    let _ = request.respond(response);
}

fn header<'a>(request: &'a tiny_http::Request, name: &'static str) -> Option<&'a str> {
    request.headers().iter().find(|h| h.field.equiv(name)).map(|h| h.value.as_str())
}

pub fn valid_key(key: &str) -> bool {
    (1..=40).contains(&key.len()) && key.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'_')
}

/// Start listening for `work_id`'s game.
pub fn start(app: AppHandle, work_id: String) -> Result<Sdk, String> {
    let server = tiny_http::Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = server.server_addr().to_ip().map(|a| a.port()).ok_or("no port")?;
    let mut raw = [0u8; 32];
    getrandom::getrandom(&mut raw).map_err(|e| e.to_string())?;
    let token = hex::encode(raw);
    let stop = Arc::new(AtomicBool::new(false));
    let sdk = Sdk { url: format!("http://127.0.0.1:{port}"), token: token.clone(), stop: stop.clone() };

    std::thread::spawn(move || {
        let hosts = [format!("127.0.0.1:{port}"), format!("localhost:{port}")];
        let expected = format!("Bearer {token}");
        while !stop.load(Ordering::SeqCst) {
            let mut request = match server.recv_timeout(Duration::from_millis(500)) {
                Ok(Some(r)) => r,
                Ok(None) => continue,
                Err(_) => break,
            };
            if header(&request, "Origin").is_some() || !header(&request, "Host").is_some_and(|h| hosts.iter().any(|x| x == h)) {
                reply(request, 403, json!({ "ok": false, "error": "forbidden" }));
                continue;
            }
            if !same(header(&request, "Authorization").unwrap_or("").as_bytes(), expected.as_bytes()) {
                reply(request, 401, json!({ "ok": false, "error": "unauthorized" }));
                continue;
            }
            let mut body = String::new();
            if request.as_reader().take(4096).read_to_string(&mut body).is_err() {
                reply(request, 400, json!({ "ok": false, "error": "bad-body" }));
                continue;
            }
            let method = request.method().as_str().to_ascii_uppercase();
            let path = request.url().split('?').next().unwrap_or("").to_string();
            let answer = tauri::async_runtime::block_on(handle(&app, &work_id, &method, &path, &body));
            match answer {
                Ok(value) => reply(request, 200, value),
                Err((code, error)) => reply(request, code, json!({ "ok": false, "error": error })),
            }
        }
    });
    Ok(sdk)
}

async fn handle(app: &AppHandle, work_id: &str, method: &str, path: &str, body: &str) -> Result<Value, (u16, String)> {
    let server = |e: String| (502, if e.contains("SF052") || e.contains("429") { "rate-limited".to_string() } else { "server".to_string() });
    match (method, path) {
        ("GET", "/v1/user") => {
            let profile = api::my_profile().await.map_err(server)?;
            Ok(json!({
                "ok": true,
                "handle": profile.get("handle").cloned().unwrap_or(Value::Null),
                "save_dir": paths::save_dir(work_id).to_string_lossy(),
            }))
        }
        ("GET", "/v1/achievements") => {
            let list = api::call("game_achievements", json!({ "p_work": work_id })).await.map_err(server)?;
            Ok(json!({ "ok": true, "achievements": list }))
        }
        ("POST", "/v1/achievements/unlock") => {
            let input: Value = serde_json::from_str(body).map_err(|_| (400, "bad-json".to_string()))?;
            let key = input.get("key").and_then(Value::as_str).unwrap_or("");
            if !valid_key(key) {
                return Err((400, "bad-key".into()));
            }
            let result = api::call("unlock_achievement", json!({ "p_work": work_id, "p_key": key }))
                .await
                .map_err(|e| if e.contains("SF051") { (404, "unknown-achievement".to_string()) } else if e.contains("SF050") { (403, "not-owned".to_string()) } else { server(e) })?;
            let new = result.get("new").and_then(Value::as_bool).unwrap_or(false);
            if new {
                let event = json!({ "work_id": work_id, "achievement": result });
                let _ = app.emit("achievement-unlocked", &event);
                popup::achievement(app, &event);
            }
            Ok(json!({ "ok": true, "new": new }))
        }
        _ => Err((404, "not-found".into())),
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn keys() {
        assert!(super::valid_key("first_steps"));
        assert!(super::valid_key("a1"));
        for bad in ["", "First", "a-b", "a b", "../x", &"a".repeat(41)] {
            assert!(!super::valid_key(bad));
        }
    }

    #[test]
    fn constant_time_compare() {
        assert!(super::same(b"Bearer abc", b"Bearer abc"));
        assert!(!super::same(b"Bearer abc", b"Bearer abd"));
        assert!(!super::same(b"Bearer ab", b"Bearer abc"));
    }
}
