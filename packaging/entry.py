# PyInstaller entry shim: importable, no package-relative tricks.
from timetable_solver.server import main

if __name__ == "__main__":
    main()
