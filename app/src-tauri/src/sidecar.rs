//! Spawns the Python solver sidecar and tracks its port and process handle.
//!
//! Dev runs the server from the repo checkout via `uv`; a release build runs
//! the bundled PyInstaller onedir binary from the app's resource directory.
//! Either way the server prints `PORT=<n>` to stdout once it is listening, and
//! exits when its stdin pipe closes (i.e. when this app goes away).

use std::io::{BufRead, BufReader};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[derive(Default)]
pub struct SidecarState {
    pub port: Mutex<Option<u16>>,
    pub child: Mutex<Option<Child>>,
    // Holding the child's stdin keeps the watchdog pipe open; dropping it (on
    // exit or kill) closes the pipe and the `--parent-watchdog` server exits.
    pub stdin: Mutex<Option<ChildStdin>>,
}

/// Repo root is two levels above src-tauri (repo/app/src-tauri) - dev only.
#[cfg(debug_assertions)]
fn repo_root() -> std::path::PathBuf {
    let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest
        .parent()
        .and_then(|app_dir| app_dir.parent())
        .expect("src-tauri must live at <repo>/app/src-tauri")
        .to_path_buf()
}

/// Dev: run the server from the repo via `uv` (no packaging build needed).
#[cfg(debug_assertions)]
fn build_command(_app: &AppHandle) -> Command {
    let mut cmd = Command::new("uv");
    cmd.args([
        "run",
        "python",
        "-m",
        "timetable_solver.server",
        "--parent-watchdog",
    ])
    .current_dir(repo_root());
    cmd
}

/// Release: run the bundled PyInstaller onedir binary from resources. The exe
/// and its `_internal/` libs must stay siblings, so the whole folder ships as a
/// resource; resources can lose the +x bit, so restore it before spawning.
#[cfg(not(debug_assertions))]
fn build_command(app: &AppHandle) -> Command {
    let dir = app
        .path()
        .resource_dir()
        .expect("resource dir")
        .join("binaries/solver");
    let bin = dir.join("solver");
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(&bin) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(&bin, perms);
        }
    }
    let mut cmd = Command::new(&bin);
    cmd.arg("--parent-watchdog").current_dir(&dir);
    cmd
}

pub fn spawn_sidecar(app: &AppHandle) -> tauri::Result<()> {
    let mut child = build_command(app)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .expect("failed to spawn solver sidecar");

    let stdout = child.stdout.take().expect("sidecar stdout pipe");
    let stderr = child.stderr.take().expect("sidecar stderr pipe");
    let stdin = child.stdin.take();

    let state = app.state::<SidecarState>();
    *state.stdin.lock().unwrap() = stdin;
    *state.child.lock().unwrap() = Some(child);

    // Watch stdout for the port announcement.
    let handle = app.clone();
    std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(port) = line.trim().strip_prefix("PORT=") {
                if let Ok(port) = port.parse::<u16>() {
                    eprintln!("chronosolve: solver sidecar ready on port {port}");
                    *handle.state::<SidecarState>().port.lock().unwrap() = Some(port);
                }
            }
        }
    });
    // Surface sidecar diagnostics - a silent solver death is undebuggable.
    std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            eprintln!("sidecar: {line}");
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
    // Drop stdin first (closes the watchdog pipe), then hard-kill as a backstop.
    let _ = state.stdin.lock().unwrap().take();
    let child = state.child.lock().unwrap().take();
    if let Some(mut child) = child {
        let _ = child.kill();
    }
}
