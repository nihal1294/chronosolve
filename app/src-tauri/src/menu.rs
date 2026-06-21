//! Native macOS menu bar. Custom item ids match the frontend command ids in
//! `use-app-commands.ts`; clicking one (or pressing its accelerator) emits a
//! `"menu"` event carrying that id, which the webview routes to the matching
//! command. Items that mirror a shortcut carry a native accelerator so macOS
//! displays it; on desktop the JS dispatcher steps aside (see
//! `use-app-commands.ts`) so each shortcut fires exactly once. Predefined items
//! (Quit, the Edit group) keep their native accelerators and need no handling.

use tauri::image::Image;
use tauri::menu::{
    AboutMetadata, AboutMetadataBuilder, MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder,
};
use tauri::{App, Emitter, Manager};

pub fn install(app: &App) -> tauri::Result<()> {
    let about = about_metadata();
    let settings = MenuItemBuilder::with_id("nav-/settings", "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    let app_menu = SubmenuBuilder::new(app, "ChronoSolve")
        .about(Some(about.clone()))
        .separator()
        .item(&settings)
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    // new/save/solve/halt start disabled (no problem loaded, not solving); the
    // frontend re-syncs them via `set_menu_states` so the menu never offers an
    // action that would silently no-op.
    let new = MenuItemBuilder::with_id("new", "New")
        .accelerator("CmdOrCtrl+N")
        .enabled(false)
        .build(app)?;
    let open = MenuItemBuilder::with_id("open", "Open…")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save = MenuItemBuilder::with_id("save", "Save…")
        .accelerator("CmdOrCtrl+S")
        .enabled(false)
        .build(app)?;
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new)
        .item(&open)
        .item(&save)
        .separator()
        .text("template", "Load Template")
        .text("import", "Import CSV…")
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .text("nav-/", "Dashboard")
        .text("nav-/data", "Data")
        .text("nav-/constraints", "Constraints")
        .text("nav-/solver", "Scheduler")
        .text("nav-/timetable", "Timetable")
        .build()?;

    let solve = MenuItemBuilder::with_id("solve", "Run")
        .accelerator("CmdOrCtrl+Enter")
        .enabled(false)
        .build(app)?;
    let halt = MenuItemBuilder::with_id("halt", "Halt")
        .accelerator("CmdOrCtrl+.")
        .enabled(false)
        .build(app)?;
    let scheduler_menu = SubmenuBuilder::new(app, "Scheduler")
        .item(&solve)
        .item(&halt)
        .build()?;

    // "How to Use" launches the guided tour (its `help-guide` id maps to the
    // tour command in the webview). "Show Help Hints" carries the Cmd-/
    // accelerator so the native menu owns it on desktop; the JS dispatcher steps
    // aside there (see `use-app-commands.ts`), so the toggle fires exactly once.
    let help_hints = MenuItemBuilder::with_id("toggle-help-hints", "Show Help Hints")
        .accelerator("CmdOrCtrl+/")
        .build(app)?;
    let help_menu = SubmenuBuilder::new(app, "Help")
        .text("help-guide", "How to Use")
        .item(&help_hints)
        .text("shortcuts", "Keyboard Shortcuts")
        .separator()
        .text("help-issues", "Report an Issue")
        .separator()
        .about(Some(about))
        .build()?;

    let menu = MenuBuilder::new(app)
        .items(&[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &scheduler_menu,
            &help_menu,
        ])
        .build()?;

    app.set_menu(menu)?;
    app.manage(MenuItemHandles {
        new_item: new.clone(),
        solve: solve.clone(),
        halt: halt.clone(),
        save: save.clone(),
    });
    app.on_menu_event(|app, event| {
        match event.id().0.as_str() {
            // `help-issues` is handled entirely here (open the URL) and is
            // deliberately NOT forwarded to the webview - there is no matching
            // frontend command, so it never double-dispatches. Every other id
            // (custom items + predefined ids) goes to the webview, which runs
            // the matching command or simply ignores an unknown id.
            "help-issues" => open_url("https://github.com/nihal1294/chronosolve/issues"),
            _ => {
                let _ = app.emit("menu", event.id().0.clone());
            }
        }
    });

    Ok(())
}

/// Handles for the menu items whose availability tracks app state. The frontend
/// enables/disables them through `set_menu_states` so the native menu mirrors
/// the command registry - a conditional item (Run with no problem loaded) is
/// greyed out instead of sitting enabled and silently doing nothing when clicked.
pub struct MenuItemHandles {
    new_item: MenuItem<tauri::Wry>,
    solve: MenuItem<tauri::Wry>,
    halt: MenuItem<tauri::Wry>,
    save: MenuItem<tauri::Wry>,
}

/// Mirror the frontend command availability onto the native menu items. Called
/// whenever canSolve/busy/hasDoc/canSave change (see `use-menu-events.ts`).
/// Save tracks `can_save` (any YAML text present), NOT `has_doc` (a parsed
/// document) - an invalid-YAML draft has no parsed doc but is still savable.
#[tauri::command]
pub fn set_menu_states(
    handles: tauri::State<'_, MenuItemHandles>,
    can_solve: bool,
    busy: bool,
    has_doc: bool,
    can_save: bool,
) {
    let _ = handles.solve.set_enabled(can_solve && !busy);
    let _ = handles.halt.set_enabled(busy);
    let _ = handles.new_item.set_enabled(has_doc);
    let _ = handles.save.set_enabled(can_save);
}

/// About-panel metadata carrying our app icon, embedded at compile time. A
/// `tauri dev` run is a bare binary with no `.app` bundle, so the native macOS
/// About panel otherwise falls back to the generic system icon; supplying the
/// icon here shows the ChronoSolve mark in dev and the packaged app alike. Name
/// and version are left unset so the panel keeps deriving them from the bundle.
fn about_metadata() -> AboutMetadata<'static> {
    AboutMetadataBuilder::new()
        .icon(Image::from_bytes(include_bytes!("../icons/128x128@2x.png")).ok())
        .build()
}

/// Open an external URL in the user's default browser. Shells out per the
/// existing sidecar pattern rather than pulling in the shell/opener plugin -
/// the URLs are hard-coded constants, never user input.
fn open_url(url: &str) {
    #[cfg(target_os = "macos")]
    let _ = std::process::Command::new("open").arg(url).spawn();
    #[cfg(target_os = "windows")]
    let _ = std::process::Command::new("cmd")
        .args(["/C", "start", "", url])
        .spawn();
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let _ = std::process::Command::new("xdg-open").arg(url).spawn();
}
