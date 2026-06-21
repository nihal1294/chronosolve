mod menu;
mod sidecar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(sidecar::SidecarState::default())
        .invoke_handler(tauri::generate_handler![
            sidecar::solver_port,
            menu::set_menu_states
        ])
        .setup(|app| {
            sidecar::spawn_sidecar(app.handle())?;
            menu::install(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building ChronoSolve")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            handle_macos_run_event(app, &event);
            if let tauri::RunEvent::Exit = event {
                sidecar::kill_sidecar(app);
            }
        });
}

/// macOS window lifecycle: closing the window hides it (the app stays in the
/// Dock) instead of destroying it, and a Dock click (`Reopen`) brings the same
/// window back with its in-memory state intact. Without this, closing the last
/// window leaves the app running with no way back, since the menu has no Window
/// submenu.
#[cfg(target_os = "macos")]
fn handle_macos_run_event(app: &tauri::AppHandle, event: &tauri::RunEvent) {
    use tauri::Manager;
    match event {
        tauri::RunEvent::WindowEvent {
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } => {
            api.prevent_close();
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.hide();
            }
        }
        tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}
