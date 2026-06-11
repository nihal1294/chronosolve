//! Spawns the Python solver sidecar and tracks its port and process handle.
//!
//! Dev mode runs the server from the repo checkout via `uv`; the server
//! announces its auto-selected port by printing `PORT=<n>` to stdout.
//! A bundled PyInstaller sidecar replaces this in the packaging milestone.

use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

#[derive(Default)]
pub struct SidecarState {
    pub port: Mutex<Option<u16>>,
    pub child: Mutex<Option<CommandChild>>,
}

/// Repo root is two levels above src-tauri (repo/app/src-tauri).
fn repo_root() -> std::path::PathBuf {
    let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest
        .parent()
        .and_then(|app_dir| app_dir.parent())
        .expect("src-tauri must live at <repo>/app/src-tauri")
        .to_path_buf()
}

pub fn spawn_sidecar(app: &AppHandle) -> tauri::Result<()> {
    // --parent-watchdog: the server exits itself when our stdin pipe closes,
    // covering every shutdown path (including crashes) — kill() below is only
    // the fast path and cannot reach through the `uv run` wrapper process.
    let (mut rx, child) = app
        .shell()
        .command("uv")
        .args(["run", "python", "-m", "timetable_solver.server", "--parent-watchdog"])
        .current_dir(repo_root())
        .spawn()
        .expect("failed to spawn solver sidecar (is uv on PATH?)");

    let state = app.state::<SidecarState>();
    *state.child.lock().unwrap() = Some(child);

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    if let Some(port) = text.trim().strip_prefix("PORT=") {
                        if let Ok(port) = port.parse::<u16>() {
                            eprintln!("chronosolve: solver sidecar ready on port {port}");
                            let state = handle.state::<SidecarState>();
                            *state.port.lock().unwrap() = Some(port);
                        }
                    }
                }
                // Surface sidecar diagnostics — a silent solver death is undebuggable.
                CommandEvent::Stderr(line) => {
                    eprintln!("sidecar: {}", String::from_utf8_lossy(&line).trim_end());
                }
                CommandEvent::Error(message) => eprintln!("sidecar error: {message}"),
                CommandEvent::Terminated(payload) => {
                    eprintln!("sidecar terminated: {:?}", payload.code);
                }
                _ => {}
            }
        }
    });
    Ok(())
}

/// Frontend polls this until the sidecar has announced its port.
#[tauri::command]
pub fn solver_port(state: tauri::State<'_, SidecarState>) -> Option<u16> {
    *state.port.lock().unwrap()
}

pub fn kill_sidecar(app: &AppHandle) {
    let state = app.state::<SidecarState>();
    // Take the child out in its own statement so the MutexGuard temporary
    // drops before `state` (E0597 when the if-let is the trailing expression).
    let child = state.child.lock().unwrap().take();
    if let Some(child) = child {
        let _ = child.kill();
    }
}
