//! The desktop shell for the full Zenith app: one ordinary, resizable window around the same React
//! build that runs in a browser. The page decides where it is running (`src/lib/platform`):
//! saved data goes to a JSON file in the app's data folder through the store plugin, and the
//! notification plugin gives the page the Web `Notification` API, so reminders reach the system.
//! Everything else lives in the page.

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        // Must be registered first. A second launch focuses the open window instead of starting
        // another copy, so two processes never write the same store file.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .run(tauri::generate_context!())
        .expect("error while running Zenith");
}
