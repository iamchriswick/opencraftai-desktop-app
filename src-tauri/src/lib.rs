use tauri::{
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt as AutostartExt};
use tauri_plugin_clipboard_manager::ClipboardExt;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_store::StoreExt;

const DEFAULT_HOTKEY: &str = "Control+Space";
const STORE_FILE: &str = "settings.json";
const HOTKEY_KEY: &str = "hotkey";

fn toggle_companion_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("companion") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            let _ = window.set_skip_taskbar(true);
            let _ = window.set_always_on_top(false);
        } else {
            let _ = window.set_skip_taskbar(true);
            let _ = window.set_always_on_top(true);
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
async fn get_app_version(app: AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
async fn set_hotkey(
    app: AppHandle,
    old_hotkey: String,
    new_hotkey: String,
) -> Result<(), String> {
    let gs = app.global_shortcut();

    if !old_hotkey.is_empty() {
        let _ = gs.unregister(old_hotkey.as_str());
    }

    gs.register(new_hotkey.as_str())
        .map_err(|e| e.to_string())?;

    if let Ok(store) = app.store(STORE_FILE) {
        store.set(HOTKEY_KEY, new_hotkey);
        let _ = store.save();
    }

    Ok(())
}

#[tauri::command]
async fn get_saved_hotkey(app: AppHandle) -> String {
    if let Ok(store) = app.store(STORE_FILE) {
        store
            .get(HOTKEY_KEY)
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| DEFAULT_HOTKEY.to_string())
    } else {
        DEFAULT_HOTKEY.to_string()
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_companion_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Create companion window loading the React launcher app
            let companion = WebviewWindowBuilder::new(
                app,
                "companion",
                WebviewUrl::External("https://opencraftai.com/login".parse().unwrap()),
            )
            .title("OpenCraft AI")
            .inner_size(1201.0, 800.0)
            .visible(false)
            .decorations(true)
            .skip_taskbar(true)
            .center()
            .resizable(true)
            .on_new_window(|_url, _features| tauri::webview::NewWindowResponse::Allow)
            .build()?;

            // Resize to 90% of monitor height and re-center
            if let Ok(Some(monitor)) = companion.primary_monitor() {
                let scale = monitor.scale_factor();
                let phys_h = monitor.size().height;
                let logical_h = (phys_h as f64 / scale) * 0.9;
                let _ = companion.set_size(tauri::LogicalSize::new(1201.0_f64, logical_h));
                let _ = companion.center();
            }

            // Build system tray context menu
            let copy_info = MenuItem::with_id(app, "copy-info", "Copy App Info", true, None::<&str>)?;
            let reload = MenuItem::with_id(app, "reload", "Reload", true, None::<&str>)?;
            let sep1 = PredefinedMenuItem::separator(app)?;
            let open_window = MenuItem::with_id(app, "open-window", "Open App Window", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            let autostart_item = CheckMenuItem::with_id(app, "autostart", "Launch at Login", true, autostart_enabled, None::<&str>)?;
            let sep2 = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;

            let tray_menu = Menu::with_items(app, &[
                &copy_info,
                &reload,
                &sep1,
                &open_window,
                &settings_item,
                &autostart_item,
                &sep2,
                &quit,
            ])?;

            let autostart_item_handle = autostart_item.clone();

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .tooltip("OpenCraft AI")
                .on_menu_event(move |app, event| {
                    let version = app.package_info().version.to_string();
                    match event.id().as_ref() {
                        "copy-info" => {
                            let info = format!("OpenCraft AI v{}", version);
                            let _ = app.clipboard().write_text(info);
                        }
                        "reload" => {
                            if let Some(window) = app.get_webview_window("companion") {
                                let _ = window.eval("window.location.reload()");
                            }
                        }
                        "open-window" => {
                            if let Some(window) = app.get_webview_window("companion") {
                                let _ = window.set_skip_taskbar(false);
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "settings" => {
                            if let Some(w) = app.get_webview_window("companion") {
                                let _ = w.eval("window.history.pushState({}, '', '/settings'); window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));");
                                let _ = w.set_skip_taskbar(false);
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "autostart" => {
                            let al = app.autolaunch();
                            if al.is_enabled().unwrap_or(false) {
                                let _ = al.disable();
                                let _ = autostart_item_handle.set_checked(false);
                            } else {
                                let _ = al.enable();
                                let _ = autostart_item_handle.set_checked(true);
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_companion_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Intercept companion window close → hide instead of quit
            let win = companion.clone();
            companion.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = win.hide();
                }
            });

            // Load persisted hotkey and register it
            let hotkey = if let Ok(store) = app.store(STORE_FILE) {
                store
                    .get(HOTKEY_KEY)
                    .and_then(|v| v.as_str().map(|s| s.to_string()))
                    .unwrap_or_else(|| DEFAULT_HOTKEY.to_string())
            } else {
                DEFAULT_HOTKEY.to_string()
            };

            let _ = app.global_shortcut().register(hotkey.as_str());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            set_hotkey,
            get_saved_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
