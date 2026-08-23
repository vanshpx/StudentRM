#!/usr/bin/env bash
set -e  # exit immediately on any error

echo "=== Step 1: Installing Python dependencies ==="
pip install -r requirements.txt

echo "=== Step 2: Building React frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== Build complete. frontend/dist exists: $(ls frontend/dist | head -3) ==="
