// The signed-in session. Only the small, long-lived parts live in the OS
// keychain (Windows Credential Manager): the refresh token and the account's
// basics. The access token is large — it carries the account's Google profile
// in its claims and can run well past a kilobyte — and Windows Credential
// Manager caps a single credential near 2.5 KB, so storing the whole thing
// there fails and sign-in looks broken. The access token is short-lived
// anyway, so it lives only in memory and is minted from the refresh token
// whenever it's needed.
use crate::config::{KEYRING_SERVICE, KEYRING_USER};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct Session {
    pub access_token: String,
    pub refresh_token: String,
    #[serde(default)]
    pub expires_at: i64,
    #[serde(default)]
    pub email: String,
    #[serde(default)]
    pub user_id: String,
}

// What actually goes into the keychain: everything except the big, short-lived
// access token.
#[derive(Serialize, Deserialize, Default)]
struct Stored {
    refresh_token: String,
    #[serde(default)]
    email: String,
    #[serde(default)]
    user_id: String,
}

// The live session (with a valid access token) for this run of the launcher.
static CACHE: Mutex<Option<Session>> = Mutex::new(None);

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

pub fn load() -> Option<Session> {
    if let Some(s) = CACHE.lock().ok().and_then(|c| c.clone()) {
        return Some(s);
    }
    let raw = entry().ok()?.get_password().ok()?;
    // Older builds stored the whole Session; both shapes deserialize into
    // Stored (extra fields are ignored), so an existing sign-in keeps working.
    let stored: Stored = serde_json::from_str(&raw).ok()?;
    if stored.refresh_token.is_empty() {
        return None;
    }
    Some(Session {
        access_token: String::new(),
        refresh_token: stored.refresh_token,
        expires_at: 0,
        email: stored.email,
        user_id: stored.user_id,
    })
}

pub fn save(session: &Session) -> Result<(), String> {
    let stored = Stored {
        refresh_token: session.refresh_token.clone(),
        email: session.email.clone(),
        user_id: session.user_id.clone(),
    };
    let raw = serde_json::to_string(&stored).map_err(|e| e.to_string())?;
    entry()?.set_password(&raw).map_err(|e| e.to_string())?;
    if let Ok(mut c) = CACHE.lock() {
        *c = Some(session.clone());
    }
    Ok(())
}

pub fn clear() {
    if let Ok(mut c) = CACHE.lock() {
        *c = None;
    }
    if let Ok(e) = entry() {
        let _ = e.delete_credential();
    }
}
