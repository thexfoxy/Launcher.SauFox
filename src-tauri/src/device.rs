// A stable, privacy-keeping id for this computer: a hash of a few durable
// machine facts plus a random secret made once and kept in the OS keychain.
// We store only the hash server-side, never anything that names the machine.
use crate::config::KEYRING_SERVICE;
use sha2::{Digest, Sha256};

fn machine_salt() -> String {
    // A per-install random secret, so the hash can't be guessed from public
    // machine facts and can't be reproduced on another computer.
    let entry = keyring::Entry::new(KEYRING_SERVICE, "device-salt");
    if let Ok(e) = &entry {
        if let Ok(v) = e.get_password() {
            if !v.is_empty() {
                return v;
            }
        }
    }
    let mut seed = Sha256::new();
    seed.update(std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0).to_le_bytes());
    seed.update(std::process::id().to_le_bytes());
    seed.update(hostname().as_bytes());
    let salt = hex::encode(seed.finalize());
    if let Ok(e) = &entry {
        let _ = e.set_password(&salt);
    }
    salt
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
pub fn device_hash() -> String {
    let mut h = Sha256::new();
    h.update(b"saufox-device-v1");
    h.update(os_id().as_bytes());
    h.update(machine_salt().as_bytes());
    hex::encode(h.finalize())
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
