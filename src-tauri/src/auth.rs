// Signing in without ever handling the account password. The launcher opens
// the website's sign-in-the-launcher page in the browser, listening on a
// loopback port for the one-time token the website sends back once the
// person allows it. The token works once and only signs in this launcher.
use crate::api;
use crate::config::SITE;
use crate::session::Session;
use std::time::{Duration, Instant};

fn random_state() -> String {
    // 32 hex chars from the OS keychain-quality randomness we already use.
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0).to_le_bytes());
    h.update(std::process::id().to_le_bytes());
    h.update(Instant::now().elapsed().as_nanos().to_le_bytes());
    hex::encode(&h.finalize()[..16])
}

fn query_of(url: &str) -> Vec<(String, String)> {
    url.split_once('?')
        .map(|(_, q)| q)
        .unwrap_or("")
        .split('&')
        .filter_map(|kv| {
            let (k, v) = kv.split_once('=')?;
            Some((k.to_string(), urldecode(v)))
        })
        .collect()
}

fn urldecode(s: &str) -> String {
    let bytes = s.replace('+', " ");
    let mut out = String::new();
    let mut it = bytes.bytes().peekable();
    while let Some(b) = it.next() {
        if b == b'%' {
            let h: String = (0..2).filter_map(|_| it.next().map(|c| c as char)).collect();
            if let Ok(n) = u8::from_str_radix(&h, 16) {
                out.push(n as char);
                continue;
            }
        }
        out.push(b as char);
    }
    out
}

const DONE_PAGE: &str = "<!doctype html><meta charset=utf-8><title>SauFox</title><body style=\"background:#0f0f11;color:#f5f3ef;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0\"><div style=\"text-align:center\"><h2>You can go back to the launcher.</h2><p style=\"color:#8e8c95\">This tab can be closed.</p></div>";

/// Open the browser, wait for the website's callback, and turn the one-time
/// token into a saved session. Blocks (call it off the UI thread).
pub async fn sign_in() -> Result<Session, String> {
    let server = tiny_http::Server::http("127.0.0.1:0").map_err(|e| e.to_string())?;
    let port = server.server_addr().to_ip().map(|a| a.port()).ok_or("no port")?;
    let state = random_state();

    let url = format!("{SITE}/launcher?port={port}&state={state}");
    if webbrowser_open(&url).is_err() {
        return Err(format!("couldn't open the browser. Go to: {url}"));
    }

    // Wait up to five minutes for the person to allow it.
    let deadline = Instant::now() + Duration::from_secs(300);
    let want_state = state.clone();
    let token_hash = tokio::task::spawn_blocking(move || -> Result<String, String> {
        loop {
            if Instant::now() > deadline {
                return Err("sign-in timed out".into());
            }
            match server.recv_timeout(Duration::from_secs(2)) {
                Ok(Some(request)) => {
                    let url = request.url().to_string();
                    if !url.starts_with("/callback") {
                        let _ = request.respond(tiny_http::Response::empty(404));
                        continue;
                    }
                    let params = query_of(&url);
                    let get = |k: &str| params.iter().find(|(a, _)| a == k).map(|(_, v)| v.clone());
                    if get("state").as_deref() != Some(&want_state) {
                        let _ = request.respond(tiny_http::Response::from_string("bad state").with_status_code(400));
                        continue;
                    }
                    let _ = request.respond(
                        tiny_http::Response::from_string(DONE_PAGE)
                            .with_header("Content-Type: text/html; charset=utf-8".parse::<tiny_http::Header>().unwrap()),
                    );
                    if let Some(err) = get("error") {
                        return Err(if err == "cancelled" { "sign-in cancelled".into() } else { err });
                    }
                    match get("token_hash") {
                        Some(t) if !t.is_empty() => return Ok(t),
                        _ => return Err("no token returned".into()),
                    }
                }
                Ok(None) => continue,
                Err(e) => return Err(e.to_string()),
            }
        }
    })
    .await
    .map_err(|e| e.to_string())??;

    // Drain the token holder into a session.
    api::verify_otp(&token_hash).await
}

// Open a URL in the default browser without extra crates.
fn webbrowser_open(url: &str) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    {
        // Not `cmd /C start`: the sign-in URL carries `?port=…&state=…`, and
        // cmd treats `&` as a command separator, so `start` would open only
        // the part before it and drop the state — the website would then say
        // the link isn't from the launcher. rundll32's FileProtocolHandler
        // takes the whole URL as one argument, no shell parsing, and hands it
        // to the default browser.
        std::process::Command::new("rundll32.exe")
            .arg("url.dll,FileProtocolHandler")
            .arg(url)
            .spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(url).spawn()?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open").arg(url).spawn()?;
    }
    Ok(())
}
