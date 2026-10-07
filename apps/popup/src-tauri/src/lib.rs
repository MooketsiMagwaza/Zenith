//! The pop-up's native shell: one small frameless window that stays on top, a tray icon, three
//! global shortcuts, and a command that shrinks the window to a ball and back. Everything the
//! window shows (timers, decks, journal, reminders) lives in the page; see `src/bridge`.

use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// The ball is this many logical pixels across, plus a margin for the page's drop shadow.
const BALL_LOGICAL: f64 = 100.0 + 24.0;

/// The window's size and position before it shrank, so it can go back exactly where it was.
#[derive(Default)]
struct Expanded(Mutex<Option<(PhysicalPosition<i32>, PhysicalSize<u32>)>>);

fn show_window(window: &WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
}

fn toggle_visible(window: &WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        show_window(window);
    }
}

/// Shrinks the window to a ball around its centre, or restores it. The page is told which, so it
/// can draw the ball or the full window.
#[tauri::command]
fn toggle_minimize(window: WebviewWindow, saved: tauri::State<Expanded>) -> Result<(), String> {
    let mut saved = saved.0.lock().map_err(|e| e.to_string())?;
    // A frameless window on Windows and Linux ignores resizing unless it is allowed first.
    window.set_resizable(true).map_err(|e| e.to_string())?;

    if let Some((position, size)) = saved.take() {
        window.set_size(size).map_err(|e| e.to_string())?;
        window.set_position(position).map_err(|e| e.to_string())?;
        window.set_resizable(false).map_err(|e| e.to_string())?;
        window.emit("window:restored", ()).map_err(|e| e.to_string())?;
    } else {
        let position = window.outer_position().map_err(|e| e.to_string())?;
        let size = window.outer_size().map_err(|e| e.to_string())?;
        let ball = (BALL_LOGICAL * window.scale_factor().map_err(|e| e.to_string())?).round() as i32;
        let centre_x = position.x + size.width as i32 / 2;
        let centre_y = position.y + size.height as i32 / 2;

        *saved = Some((position, size));
        window
            .set_size(PhysicalSize::new(ball as u32, ball as u32))
            .map_err(|e| e.to_string())?;
        window
            .set_position(PhysicalPosition::new(centre_x - ball / 2, centre_y - ball / 2))
            .map_err(|e| e.to_string())?;
        window.set_resizable(false).map_err(|e| e.to_string())?;
        window.emit("window:minimized", ()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "Show or hide", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Zenith", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&toggle, &quit])?;

    let mut tray = TrayIconBuilder::new()
        .tooltip("Zenith")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "toggle" => {
                if let Some(window) = app.get_webview_window("main") {
                    toggle_visible(&window);
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    toggle_visible(&window);
                }
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

pub fn run() {
    let toggle = Shortcut::new(Some(Modifiers::ALT), Code::Space);
    let focus = Shortcut::new(Some(Modifiers::ALT), Code::KeyF);
    let zen = Shortcut::new(Some(Modifiers::ALT), Code::KeyZ);

    tauri::Builder::default()
        .manage(Expanded::default())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    let Some(window) = app.get_webview_window("main") else {
                        return;
                    };
                    if shortcut == &toggle {
                        toggle_visible(&window);
                    } else if shortcut == &focus {
                        show_window(&window);
                        let _ = window.emit("view:open", "focus");
                    } else if shortcut == &zen {
                        show_window(&window);
                        let _ = window.emit("view:open", "zen");
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![toggle_minimize])
        .setup(move |app| {
            // Another program may already hold a shortcut; the pop-up still works from the tray.
            for shortcut in [toggle, focus, zen] {
                if let Err(error) = app.global_shortcut().register(shortcut) {
                    eprintln!("could not register {shortcut}: {error}");
                }
            }
            build_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing hides the window; Quit in the tray menu is the way out.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running the Zenith pop-up");
}
