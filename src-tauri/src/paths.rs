// Where the launcher keeps games on this computer.
use std::path::PathBuf;

pub fn root() -> PathBuf {
    // %LOCALAPPDATA%\SauFox on Windows, the platform data dir elsewhere.
    let base = dirs::data_local_dir().unwrap_or_else(|| std::env::temp_dir());
    base.join("SauFox")
}

pub fn games_dir() -> PathBuf {
    root().join("Games")
}

pub fn game_dir(work_id: &str) -> PathBuf {
    games_dir().join(safe(work_id))
}

pub fn downloads_dir() -> PathBuf {
    root().join("Downloads")
}

// Keep a work id to safe folder characters.
fn safe(name: &str) -> String {
    let s: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let s = s.trim_matches('-').to_string();
    if s.is_empty() {
        "game".into()
    } else {
        s
    }
}
