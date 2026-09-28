// Where the launcher talks to. The Supabase URL and publishable key are
// public by design (the same ones the website ships); every private rule is
// enforced by the database and the Edge Functions, never here.
pub const SUPABASE_URL: &str = "https://gwyqkzhhnspfadqefmix.supabase.co";
pub const SUPABASE_ANON_KEY: &str =
    "sb_publishable_IB06YrDhrsKJbVghWP-zzg_xDgB1mXN";
pub const SITE: &str = "https://saufoxentertainment.ir";

// The keychain entry the session is kept under.
pub const KEYRING_SERVICE: &str = "ir.saufoxentertainment.launcher";
pub const KEYRING_USER: &str = "session";
