"""
build.py — used by Render to build the project.
Pure Python: no shell script, no CRLF issues.
"""
import subprocess
import sys
import os
from pathlib import Path

ROOT = Path(__file__).parent

def run(cmd, cwd=None):
    print(f"\n>>> {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd or ROOT, check=True)
    return result

print("=== Step 1: Installing Python dependencies ===")
run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])

print("\n=== Step 2: Installing frontend Node dependencies ===")
run(["npm", "install"], cwd=ROOT / "frontend")

print("\n=== Step 3: Building React frontend ===")
run(["npm", "run", "build"], cwd=ROOT / "frontend")

dist = ROOT / "frontend" / "dist"
if dist.exists():
    print(f"\n=== Build complete. frontend/dist contents: {list(dist.iterdir())} ===")
else:
    print("\n!!! ERROR: frontend/dist was NOT created !!!")
    sys.exit(1)
