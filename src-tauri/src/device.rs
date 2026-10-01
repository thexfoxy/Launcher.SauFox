// A stable, privacy-keeping id for this computer: a hash of a few durable
// machine facts plus a random secret made once and kept in the OS keychain.
// We store only the hash server-side, never anything that names the machine.
use crate::config::KEYRING_SERVICE;
use sha2::{Digest, Sha256};

fn machine_salt() -> Result<String, String> {
    static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let _guard = LOCK.lock().map_err(|_| "device key unavailable")?;
    let entry = keyring::Entry::new(KEYRING_SERVICE, "device-salt").map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) if !value.is_empty() => return Ok(value),
        Ok(_) | Err(keyring::Error::NoEntry) => {},
        Err(e) => return Err(e.to_string()),
    }
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).map_err(|e| e.to_string())?;
    let salt = hex::encode(bytes);
    entry.set_password(&salt).map_err(|e| e.to_string())?;
    Ok(salt)
}

fn hostname() -> String {
    std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
        .or_else(|_| std::env::var("HOST"))
        .unwrap_or_default()
}

fn os_id() -> String {
    // Durable across reboots, not across a reinstall of Windows — good
    // enough to count computers without identifying the person.
    #[cfg(target_os = "windows")]
    {
        // The machine GUID, read once.
        if let Ok(out) = std::process::Command::new("reg")
            .args(["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid"])
            .output()
        {
            if let Ok(text) = String::from_utf8(out.stdout) {
                if let Some(line) = text.lines().find(|l| l.contains("MachineGuid")) {
                    if let Some(guid) = line.split_whitespace().last() {
                        return guid.to_string();
                    }
                }
            }
        }
    }
    hostname()
}

/// A 64-hex-character id for this computer.
pub fn device_hash() -> Result<String, String> {
    let mut h = Sha256::new();
    h.update(b"saufox-device-v1");
    h.update(os_id().as_bytes());
    h.update(machine_salt()?.as_bytes());
    Ok(hex::encode(h.finalize()))
}

/// A friendly name to show the owner in their device list.
pub fn device_name() -> String {
    let name = hostname();
    if name.is_empty() {
        "PC".to_string()
    } else {
        name
    }
}
