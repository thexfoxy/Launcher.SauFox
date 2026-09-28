// Windows: no extra console window in a release build.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    saufox_launcher_lib::run()
}
