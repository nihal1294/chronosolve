set shell := ["bash", "-euo", "pipefail", "-c"]

default: help

help:
    @just --list

# Install Python (uv) + frontend (npm) dependencies
sync:
    ./scripts/workflow.sh sync

# Every CI quality gate, check-only (mirrors .github/workflows/ci.yml)
check:
    ./scripts/workflow.sh check

# Auto-format: ruff format + prettier --write + cargo fmt
format:
    ./scripts/workflow.sh format

# Auto-fix lints: ruff --fix + eslint --fix + clippy
lint:
    ./scripts/workflow.sh lint

# Python tests (with coverage) + frontend tests
test:
    ./scripts/workflow.sh test

# Solver sidecar API in the foreground (prints PORT=<n>)
server:
    ./scripts/workflow.sh server

# Browser dev mode: sidecar in background + Vite pointed at it
web:
    ./scripts/workflow.sh web

# Full desktop app dev mode (Tauri manages the sidecar)
dev:
    ./scripts/workflow.sh dev

# CLI smoke: template -> validate -> solve (TIME_LIMIT=30 to override)
solve:
    ./scripts/workflow.sh solve

# Print an example problem definition to start from
template out='my_school.yaml':
    uv run timetable template > {{out}}

clean:
    ./scripts/workflow.sh clean

clean-all:
    ./scripts/workflow.sh clean-all
