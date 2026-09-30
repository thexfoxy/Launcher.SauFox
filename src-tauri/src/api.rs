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
    expires_in: i64,
    #[serde(default)]
    user: Option<UserPart>,
}

fn now_secs() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
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
    // Prefer the absolute expiry; fall back to expires_in, then to a
    // conservative hour, so the token is never treated as non-expiring.
    let expires_at = if t.expires_at > 0 {
        t.expires_at
    } else if t.expires_in > 0 {
        now_secs() + t.expires_in
    } else {
        now_secs() + 3600
    };
    Session {
        access_token: t.access_token,
        refresh_token: t.refresh_token,
        expires_at,
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
    static REFRESH: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    let _guard = REFRESH.lock().await;
    let session = session::load().ok_or("signed out")?;
    let now = now_secs();
    // A live access token that isn't about to expire is reused as-is. An empty
    // one means it was just loaded from the keychain (which never keeps the
    // access token), so it must be minted from the refresh token below.
    if !session.access_token.is_empty() && session.expires_at - now > 120 {
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
        if matches!(res.status().as_u16(), 400 | 401 | 403) {
            session::clear();
            return Err("session expired".into());
        }
        return Err("session refresh unavailable; try again".into());
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

/// The whole published game catalogue (public), for the store. No account is
/// needed — anyone may read published works — so this works signed out too.
pub async fn catalog() -> Result<Value, String> {
    let res = client()
        .get(format!("{SUPABASE_URL}/rest/v1/works"))
        .query(&[
            (
                "select",
                "id,title,status,status_text,status_text_fa,price_irr,price_usd,cover_url,hero_url,hero_focus,genres,platforms,rating,stills,synopsis,synopsis_fa,review_count,review_sum",
            ),
            ("kind", "eq.Game"),
            ("published", "eq.true"),
            ("order", "sort.asc,created_at.desc"),
        ])
        .header("apikey", SUPABASE_ANON_KEY)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !res.status().is_success() {
        return Err(format!("server error ({})", res.status()));
    }
    res.json().await.map_err(|e| e.to_string())
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
#[derive(Deserialize)]
pub struct Download {
    pub url: String,
    pub file_name: String,
    pub size_bytes: u64,
    pub sha256: String,
    pub entrypoint: String,
    pub work_id: String,
    pub version: String,
    pub platform: String,
}
pub async fn download_link(build_id: &str) -> Result<Download, String> {
    let session = fresh_token().await?;
    let res = client()
        .post(format!("{SUPABASE_URL}/functions/v1/library"))
        .header("apikey", SUPABASE_ANON_KEY)
        .bearer_auth(session.access_token)
        .json(&json!({ "action": "download", "build_id": build_id, "source": "launcher" }))
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() { return Err(format!("download refused ({})", res.status())); }
    res.json().await.map_err(|e| e.to_string())
}

pub async fn devices(license_id: &str) -> Result<Value, String> {
    let session = fresh_token().await?;
    let res = client().get(format!("{SUPABASE_URL}/rest/v1/license_devices"))
        .query(&[("select", "device_hash,device_name,last_seen_at"), ("license_id", &format!("eq.{license_id}"))])
        .header("apikey", SUPABASE_ANON_KEY).bearer_auth(session.access_token)
        .send().await.map_err(|e| e.to_string())?;
    if !res.status().is_success() { return Err(format!("server error ({})", res.status())); }
    res.json().await.map_err(|e| e.to_string())
}
pub async fn release_device(license_id: &str, hash: &str) -> Result<Value, String> {
    rpc("release_device", json!({"p_license": license_id, "p_device_hash": hash})).await
}
pub async fn authorize_game(work_id: &str, license_id: &str) -> Result<String, String> {
    let licenses = my_licenses().await?;
    if !licenses.as_array().map(|rows| rows.iter().any(|row|
        row["license_id"].as_str() == Some(license_id) && row["work_id"].as_str() == Some(work_id)
    )).unwrap_or(false) { return Err("Not your license".into()); }
    let hash = crate::device::device_hash()?;
    let result = activate_device(license_id, &hash, &crate::device::device_name()).await?;
    if result[0]["ok"].as_bool() != Some(true) { return Err("device-limit".into()); }
    Ok(hash)
}
