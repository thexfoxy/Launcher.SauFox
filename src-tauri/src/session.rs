// The signed-in session, kept in the OS keychain (Windows Credential
// Manager). Only the access and refresh tokens and the account's basics are
// stored; the tokens never touch disk in the clear.
use crate::config::{KEYRING_SERVICE, KEYRING_USER};
use serde::{Deserialize, Serialize};

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

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

pub fn load() -> Option<Session> {
    let raw = entry().ok()?.get_password().ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save(session: &Session) -> Result<(), String> {
    let raw = serde_json::to_string(session).map_err(|e| e.to_string())?;
    entry()?.set_password(&raw).map_err(|e| e.to_string())
}

pub fn clear() {
    if let Ok(e) = entry() {
        let _ = e.delete_credential();
    }
}
