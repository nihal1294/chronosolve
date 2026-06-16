#!/usr/bin/env bash
# Build the solver sidecar (PyInstaller onedir) and stage the folder where Tauri
# bundles it as a resource.
#
# onedir, NOT onefile: a onefile binary re-extracts OR-Tools' large native libs
# to a temp dir on EVERY launch (~50s here), which blows the frontend's startup
# poll. onedir extracts once at build time, so runtime is just exec + import
# (~6s warm). The trade-off is a folder instead of a single file, so it ships as
# a Tauri resource rather than externalBin (which is single-file only).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${REPO_ROOT}/app/src-tauri/binaries"

cd "${REPO_ROOT}/packaging"
uv run --group packaging pyinstaller --clean --noconfirm solver.spec

rm -rf "${DEST}/solver"
mkdir -p "${DEST}"
cp -R "dist/solver" "${DEST}/solver"
echo "staged ${DEST}/solver ($(du -sh "${DEST}/solver" | cut -f1))"
