use tauri::menu::{Menu, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Wry};

/// Build the application menu.
/// Minimizes accelerators to avoid conflicts with marimo's hotkey system.
///
/// Design decision: marimo frontend has its own hotkey system (hotkeys.ts).
/// If we set Ctrl+N, Ctrl+O, etc. as menu accelerators, the menu will
/// consume the keystrokes before the WebView sees them, breaking the
/// editor's shortcuts. Only Ctrl+Q (quit) and View shortcuts (F5, F11, F12)
/// are safe to use as accelerators.
///
/// macOS note: An Edit menu with standard items is required for Cmd+C/V/X
/// to work in the WebView on macOS (AppKit requirement).
pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let menu = Menu::new(app)?;

    // File menu
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::with_id("new_notebook", "New Notebook").build(app)?)
        .item(&MenuItemBuilder::with_id("open_file", "Open...").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id("home_page", "Home Page").build(app)?)
        .separator()
        .quit()
        .build()?;
    menu.append(&file_menu)?;

    // Edit menu (required for macOS Cmd+C/V/X to work in WebView)
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;
    menu.append(&edit_menu)?;

    // View menu
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id("reload", "Reload")
                .accelerator("F5")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id("devtools", "Developer Tools")
                .accelerator("F12")
                .build(app)?,
        )
        .build()?;
    menu.append(&view_menu)?;

    Ok(menu)
}
