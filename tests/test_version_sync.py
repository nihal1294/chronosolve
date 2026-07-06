"""All first-party version surfaces must carry the same version.

Every file release-please bumps via extra-files (release-please-config.json),
plus the release manifest, must agree at every commit. This fails loudly on the
Release PR if any updater silently no-ops - release-please's extra-file updaters
warn and leave the file unchanged when a jsonpath or annotation stops matching.
The two TOML lockfile entries are the fragile ones: their jsonpath filters
(`@.name.value`) rely on release-please's internal toml-edit leaf boxing
({start, end, value}), which a future release-please major could change.
"""

import json
import re
import tomllib
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]


def _json_version(path: Path, *keys: str) -> str:
    """Read a version string from a JSON file via a key path."""
    data = json.loads(path.read_text())
    for key in keys:
        data = data[key]
    assert isinstance(data, str), f"{path.name}: {'.'.join(keys)} is not a string"
    return data


def _lock_package_version(path: Path, package: str) -> str:
    """Version of the single [[package]] entry named `package` in a TOML lockfile."""
    data = tomllib.loads(path.read_text())
    matches = [p["version"] for p in data["package"] if p["name"] == package]
    assert len(matches) == 1, f"expected exactly one {package!r} entry in {path.name}"
    return matches[0]


def _regex_version(path: Path, pattern: str) -> str:
    """Extract group 1 of `pattern` from a source file."""
    match = re.search(pattern, path.read_text(), re.MULTILINE)
    assert match, f"version pattern not found in {path.name}"
    return match.group(1)


def collect_versions() -> dict[str, str]:
    """Gather the version string from every release-managed surface."""
    app = REPO / "app"
    return {
        "release-please manifest": _json_version(REPO / ".release-please-manifest.json", "."),
        "pyproject.toml": tomllib.loads((REPO / "pyproject.toml").read_text())["project"][
            "version"
        ],
        "uv.lock [timetable-solver]": _lock_package_version(REPO / "uv.lock", "timetable-solver"),
        "app/package.json": _json_version(app / "package.json", "version"),
        "app/package-lock.json $.version": _json_version(app / "package-lock.json", "version"),
        'app/package-lock.json $.packages[""]': _json_version(
            app / "package-lock.json", "packages", "", "version"
        ),
        "app/src-tauri/tauri.conf.json": _json_version(
            app / "src-tauri" / "tauri.conf.json", "version"
        ),
        "app/src-tauri/Cargo.toml": tomllib.loads((app / "src-tauri" / "Cargo.toml").read_text())[
            "package"
        ]["version"],
        "app/src-tauri/Cargo.lock [app]": _lock_package_version(
            app / "src-tauri" / "Cargo.lock", "app"
        ),
        "SettingsRoute.tsx APP_VERSION": _regex_version(
            app / "src" / "routes" / "SettingsRoute.tsx", r'const APP_VERSION = "([^"]+)"'
        ),
        "server.py VERSION": _regex_version(
            REPO / "src" / "timetable_solver" / "server.py", r'^VERSION = "([^"]+)"'
        ),
    }


def test_all_version_surfaces_agree() -> None:
    """A release (or human) bumping one surface but not another must fail CI."""
    versions = collect_versions()
    detail = "\n".join(f"  {name}: {value}" for name, value in sorted(versions.items()))
    assert len(set(versions.values())) == 1, f"version surfaces disagree:\n{detail}"
