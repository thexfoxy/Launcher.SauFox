// Talking to Supabase: turning the one-time launcher token into a session,
// keeping it fresh, and reading the account's games and files. Every request
// carries the public anon key; the account's own access token is added for
// anything private. The database and Edge Functions decide what comes back.
use crate::config::{SUPABASE_ANON_KEY, SUPABASE_URL};
use crate::session::{self, Session};
use serde::Deserialize;
use serde_json::{json, Value};

fn client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("SauFoxLauncher/0.1")
        .build()
        .expect("client")
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
    #[serde(default)]
    expires_at: i64,
    #[serde(default)]
    user: Option<UserPart>,
}

#[derive(Deserialize)]
struct UserPart {
    #[serde(default)]
    id: String,
    #[serde(default)]
    email: String,
}

fn to_session(t: TokenResponse) -> Session {
    let (user_id, email) = t.user.map(|u| (u.id, u.email)).unwrap_or_default();
    Session {
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at: t.expires_at,
        email,
        user_id,
    }
}

/// Exchange the one-time token from the website's sign-in for a session.
pub async fn verify_otp(token_hash: &str) -> Result<Session, String> {
    let res = client()
        .post(format!("{SUPABASE_URL}/auth/v1/verify"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&json!({ "type": "magiclink", "token_hash": token_hash }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("sign-in failed ({})", res.status()));
    }
    let token: TokenResponse = res.json().await.map_err(|e| e.to_string())?;
    let session = to_session(token);
    session::save(&session)?;
    Ok(session)
}

/// A valid access token, refreshing the session first if it's about to end.
pub async fn fresh_token() -> Result<Session, String> {
    let session = session::load().ok_or("signed out")?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    if session.expires_at == 0 || session.expires_at - now > 120 {
        return Ok(session);
    }
    let res = client()
        .post(format!("{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&json!({ "refresh_token": session.refresh_token }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        session::clear();
        return Err("session expired".into());
    }
    let token: TokenResponse = res.json().await.map_err(|e| e.to_string())?;
    let mut next = to_session(token);
    if next.email.is_empty() {
        next.email = session.email;
    }
    if next.user_id.is_empty() {
        next.user_id = session.user_id;
    }
    session::save(&next)?;
    Ok(next)
}

async fn rpc(name: &str, body: Value) -> Result<Value, String> {
    let session = fresh_token().await?;
    let res = client()
        .post(format!("{SUPABASE_URL}/rest/v1/rpc/{name}"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", session.access_token))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("server error ({})", res.status()));
    }
    res.json().await.map_err(|e| e.to_string())
}

/// The account's games (bought or redeemed), each with its key.
pub async fn my_licenses() -> Result<Value, String> {
    rpc("my_licenses", json!({})).await
}

/// Redeem a game key into the account's library.
pub async fn redeem(code: &str) -> Result<Value, String> {
    rpc("redeem_license", json!({ "p_code": code })).await
}

/// Register this computer against a license (up to the license's device cap).
pub async fn activate_device(
    license_id: &str,
    device_hash: &str,
    device_name: &str,
) -> Result<Value, String> {
    rpc(
        "activate_device",
        json!({ "p_license": license_id, "p_device_hash": device_hash, "p_device_name": device_name }),
    )
    .await
}

/// The published files for a work (row-level security returns only owned).
pub async fn builds(work_id: &str) -> Result<Value, String> {
    let session = fresh_token().await?;
    let res = client()
        .get(format!("{SUPABASE_URL}/rest/v1/builds"))
        .query(&[
            ("select", "id,work_id,platform,version,size_bytes,sha256,file_name,created_at"),
            ("work_id", &format!("eq.{work_id}")),
            ("published", "eq.true"),
            ("order", "created_at.desc"),
        ])
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", session.access_token))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("server error ({})", res.status()));
    }
    res.json().await.map_err(|e| e.to_string())
}

/// A one-hour link to download a build's file.
pub async fn download_link(build_id: &str) -> Result<(String, String, u64), String> {
    let session = fresh_token().await?;
    let res = client()
        .post(format!("{SUPABASE_URL}/functions/v1/library"))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", session.access_token))
        .header("Content-Type", "application/json")
        .json(&json!({ "action": "download", "build_id": build_id, "source": "launcher" }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let body: Value = res.json().await.map_err(|e| e.to_string())?;
    if let Some(url) = body.get("url").and_then(|v| v.as_str()) {
        let name = body.get("file_name").and_then(|v| v.as_str()).unwrap_or("game.zip").to_string();
        let size = body.get("size_bytes").and_then(|v| v.as_u64()).unwrap_or(0);
        Ok((url.to_string(), name, size))
    } else {
        Err(body
            .get("error")
            .and_then(|v| v.as_str())
            .unwrap_or("download refused")
            .to_string())
    }
}
