# PyInstaller spec for the ChronoSolve solver sidecar.
# Produces a single-file console executable that runs timetable_solver.server:main.
from PyInstaller.utils.hooks import collect_all

datas, binaries, hiddenimports = [], [], []
for pkg in ("ortools", "uvicorn", "sse_starlette", "fastapi", "pydantic"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

a = Analysis(
    ["entry.py"],  # thin shim that calls server.main()
    pathex=["../src"],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    noarchive=False,
)
pyz = PYZ(a.pure)
# onedir (NOT onefile): OR-Tools' native libs make a onefile re-extract ~50s on
# every launch, which blows the frontend's startup poll. onedir extracts once at
# build time, so runtime startup is just exec + import. Bundled as a Tauri
# resource folder (not externalBin, which is single-file only).
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="solver",
    console=True,  # NOT windowed - needs stdio for PORT= + watchdog
    strip=False,
    upx=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="solver",
)
