# Purchase and installation reliability

Requires the companion ORG.SauFox database migration and library Edge Function before distributing this launcher.

- Artifact identity, size, SHA-256 and executable path come from the server. The installer's legacy UI parameters do not authorize or validate a file.
- Downloads stream to disk. Extraction uses a fresh staging directory, rejects unsafe Windows paths and symlinks, and requires the declared executable. A failed download/extraction leaves the installed version intact. A failed final rename restores the previous directory. If restoration itself fails, the error includes the backup directory so files remain recoverable.
- The two final renames are not a crash-atomic filesystem transaction. A machine failure between them can leave a `.backup-*` directory in the Games directory for recovery. This is not automatic power-loss recovery.
- Installation, launching and uninstalling are serialized. Launching requires an online check of the effective license owner and device cap. Release registered devices from the game's detail panel. It does not stop an already running game; that requires validation in the game itself.
- New auth state and device salts use OS randomness. Existing device salts remain stable. Keychain errors are reported instead of silently creating a different device identity.
- Browser links require the exact HTTPS SauFox or portal host. Launching uses the recorded executable inside the game directory, never a guessed EXE.

Windows CI runs Rust tests/checks and JavaScript syntax validation. Tests cover origin spoofing, traversal/Windows aliases, size/hash failure, and rollback after replacement failure. Real keychain, gateway, installed-game and desktop UI integration still require a Windows smoke test before release.
