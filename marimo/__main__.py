# Copyright 2026 Marimo. All rights reserved.
from __future__ import annotations

import multiprocessing

from marimo._cli.cli import main

if __name__ == "__main__":
    multiprocessing.freeze_support()
    main(prog_name="marimo")
