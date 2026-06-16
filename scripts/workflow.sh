#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
APP_DIR="${REPO_ROOT}/app"
TAURI_DIR="${APP_DIR}/src-tauri"

TIME_LIMIT="${TIME_LIMIT:-30}"

usage() {
  cat <<'EOF'
Usage: scripts/workflow.sh <command> [args]

Commands:
  sync
    Install Python (uv) and frontend (npm) dependencies.

  check
    Run every CI quality gate, check-only (mirrors .github/workflows/ci.yml):
    ruff format/check + pytest, prettier + eslint + vitest + build,
    cargo fmt + clippy.

  format
    Auto-format everything: ruff format, prettier --write, cargo fmt.

  lint
    Auto-fix lints: ruff check --fix, eslint --fix, cargo clippy.

  test
    Run Python tests (with coverage) and frontend tests.

  server
    Run the solver sidecar API in the foreground (prints PORT=<n>).

  web
    Browser dev mode: start the sidecar in the background, point the
    frontend at it via app/.env.development.local, then run Vite.
    The sidecar is stopped when Vite exits.

  dev
    Full desktop app dev mode (Tauri manages the sidecar). Needs Rust + uv.

  package
    Build the distributable: PyInstaller solver sidecar + Tauri .dmg (macOS).
    Needs Rust + uv + npm.

  solve
    End-to-end CLI smoke: template -> validate -> solve (TIME_LIMIT seconds).

  clean
    Remove repo caches, build artifacts, and stray temp files
    (__pycache__, .coverage, .DS_Store). Drops the packaging outputs too:
    packaging/build + packaging/dist, the staged sidecar (app/src-tauri/
    binaries), and the Tauri bundle (.app/.dmg). Installed dependencies and the
    Rust compile cache are kept.

  clean-all
    clean + the rest of the Rust target directory (the compile cache).
    node_modules is left in place.

Environment overrides:
  TIME_LIMIT (solve time limit in seconds, default 30)
EOF
}

ensure_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Missing required command: $cmd" >&2
    exit 1
  fi
}

step() {
  printf '\n==> %s\n' "$1"
}

# The Tauri bundle references binaries/solver as a resource, and tauri-build
# errors at compile time if that glob matches nothing - which breaks `cargo`,
# `tauri dev`, and `just check` on a fresh clone or after `clean`, even though
# dev mode runs the sidecar from source (uv), not the bundled copy. Drop a tiny
# stub so the glob always matches; a packaging build (build_sidecar.sh)
# overwrites it with the real onedir.
ensure_sidecar_stub() {
  local dir="${TAURI_DIR}/binaries/solver"
  if [[ -z "$(ls -A "$dir" 2>/dev/null)" ]]; then
    mkdir -p "$dir"
    echo "placeholder; replaced by scripts/build_sidecar.sh for packaging" \
      >"${dir}/stub.txt"
  fi
}

do_sync() {
  ensure_command uv
  ensure_command npm
  step "uv sync"
  (cd "$REPO_ROOT" && uv sync)
  step "npm install (app/)"
  (cd "$APP_DIR" && npm install)
}

do_check() {
  ensure_command uv
  ensure_command npm
  ensure_command cargo
  ensure_sidecar_stub
  step "Python: ruff format --check"
  (cd "$REPO_ROOT" && uv run ruff format --check .)
  step "Python: ruff check"
  (cd "$REPO_ROOT" && uv run ruff check .)
  step "Python: pytest"
  (cd "$REPO_ROOT" && uv run pytest tests/)
  step "Frontend: prettier --check"
  (cd "$APP_DIR" && npm run format:check)
  step "Frontend: eslint"
  (cd "$APP_DIR" && npm run lint)
  step "Frontend: vitest"
  (cd "$APP_DIR" && npm run test)
  step "Frontend: tsc + vite build"
  (cd "$APP_DIR" && npm run build)
  step "Rust: cargo fmt --check"
  (cd "$TAURI_DIR" && cargo fmt --check)
  step "Rust: cargo clippy"
  (cd "$TAURI_DIR" && cargo clippy -- -D warnings)
  step "All checks passed"
}

do_format() {
  ensure_command uv
  ensure_command npm
  ensure_command cargo
  (cd "$REPO_ROOT" && uv run ruff format .)
  (cd "$APP_DIR" && npm run format)
  (cd "$TAURI_DIR" && cargo fmt)
}

do_lint() {
  ensure_command uv
  ensure_command npm
  ensure_command cargo
  (cd "$REPO_ROOT" && uv run ruff check --fix .)
  (cd "$APP_DIR" && npm run lint:fix)
  (cd "$TAURI_DIR" && cargo clippy -- -D warnings)
}

do_test() {
  ensure_command uv
  ensure_command npm
  step "Python: pytest"
  (cd "$REPO_ROOT" && uv run pytest tests/ --cov=. --cov-report=term-missing)
  step "Frontend: vitest"
  (cd "$APP_DIR" && npm run test)
}

do_server() {
  ensure_command uv
  (cd "$REPO_ROOT" && uv run python -m timetable_solver.server)
}

do_web() {
  ensure_command uv
  ensure_command npm
  local log_file
  log_file="$(mktemp -t chronosolve-sidecar)"

  (cd "$REPO_ROOT" && uv run python -m timetable_solver.server >"$log_file" 2>&1) &
  local sidecar_pid=$!
  # shellcheck disable=SC2064  -- expand the pid now, not at exit time
  trap "kill ${sidecar_pid} 2>/dev/null || true" EXIT INT TERM

  local port=""
  for _ in $(seq 1 40); do
    port="$(sed -n 's/^PORT=//p' "$log_file" | head -1)"
    [[ -n "$port" ]] && break
    sleep 0.25
  done
  if [[ -z "$port" ]]; then
    echo "Sidecar did not announce a port within 10s; see $log_file" >&2
    exit 1
  fi

  echo "VITE_SOLVER_URL=http://127.0.0.1:${port}" >"${APP_DIR}/.env.development.local"
  step "Sidecar on port ${port} (log: ${log_file}); starting Vite"
  (cd "$APP_DIR" && npm run dev)
}

do_dev() {
  ensure_command uv
  ensure_command npm
  ensure_command cargo
  ensure_sidecar_stub
  (cd "$APP_DIR" && npm run tauri dev)
}

do_package() {
  ensure_command uv
  ensure_command npm
  ensure_command cargo
  ensure_command rustc
  step "Building solver sidecar (PyInstaller onedir)"
  "${REPO_ROOT}/scripts/build_sidecar.sh"
  step "Building Tauri bundle (.dmg)"
  (cd "$APP_DIR" && npm run tauri build)
  step "Bundle output:"
  ls "${TAURI_DIR}/target/release/bundle/dmg/" 2>/dev/null || true
}

do_solve() {
  ensure_command uv
  local work_dir
  work_dir="$(mktemp -d -t chronosolve-solve)"
  step "Template -> ${work_dir}/problem.yaml"
  (cd "$REPO_ROOT" && uv run timetable template >"${work_dir}/problem.yaml")
  step "Validate"
  (cd "$REPO_ROOT" && uv run timetable validate "${work_dir}/problem.yaml")
  step "Solve (time limit ${TIME_LIMIT}s)"
  (cd "$REPO_ROOT" && uv run timetable solve "${work_dir}/problem.yaml" --time-limit "$TIME_LIMIT")
}

do_clean() {
  rm -rf \
    "${REPO_ROOT}/.pytest_cache" \
    "${REPO_ROOT}/.ruff_cache" \
    "${REPO_ROOT}/htmlcov" \
    "${REPO_ROOT}/.uv-cache" \
    "${REPO_ROOT}/dist" \
    "${REPO_ROOT}/build" \
    "${APP_DIR}/dist" \
    "${REPO_ROOT}/packaging/build" \
    "${REPO_ROOT}/packaging/dist" \
    "${TAURI_DIR}/binaries" \
    "${TAURI_DIR}/target/release/bundle"
  rm -f "${REPO_ROOT}/coverage.xml"
  # Repo-wide sweep of stray temp files, everywhere including inside
  # node_modules/.venv/target (a __pycache__ or .coverage there is just a
  # regenerable cache, never the dependency itself). Only .git is skipped so we
  # never touch VCS internals. Installed packages are left in place.
  find "${REPO_ROOT}" \
    -name .git -prune -o \
    \( -type d -name __pycache__ -o -type f -name .coverage -o -type f -name .DS_Store \) \
    -exec rm -rf {} +
}

do_clean_all() {
  # Heavier clean: also drop the Rust build cache. node_modules is intentionally
  # left in place - re-fetching it makes dev/test iteration slow.
  do_clean
  rm -rf "${TAURI_DIR}/target"
}

main() {
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    sync) do_sync ;;
    check) do_check ;;
    format) do_format ;;
    lint) do_lint ;;
    test) do_test ;;
    server) do_server ;;
    web) do_web ;;
    dev) do_dev ;;
    package) do_package ;;
    solve) do_solve ;;
    clean) do_clean ;;
    clean-all) do_clean_all ;;
    help | -h | --help) usage ;;
    *)
      echo "Unknown command: $cmd" >&2
      usage
      exit 1
      ;;
  esac
}

main "$@"
