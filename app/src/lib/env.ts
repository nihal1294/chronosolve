// Tiny runtime-environment helpers shared across libs and components.

/** True inside the Tauri shell; false in the browser dev/preview rig. Native
    dialogs, the bundled sidecar, etc. are only available when this is true. */
export const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;
