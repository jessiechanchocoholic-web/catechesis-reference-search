#!/usr/bin/env python3
"""Backward-compatible entry. Packaging now embeds the zip in the Worker, not public/."""
import subprocess
import sys

raise SystemExit(subprocess.call(["node", "scripts/package.mjs"]))
