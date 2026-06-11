mod sidecar;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .manage(sidecar::SidecarState::default())
        .invoke_handler(tauri::generate_handler![sidecar::solver_port])
        .setup(|app| {
            sidecar::spawn_sidecar(app.handle())?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building ChronoSolve")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                sidecar::kill_sidecar(app);
            }
        });
}
