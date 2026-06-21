#!/bin/bash
# Run the Quad Fetch agent with the libexpat fix for macOS.
# The Homebrew Python 3.12 build links against a newer libexpat than ships
# with macOS, so we need to override DYLD_LIBRARY_PATH to use the Homebrew one.
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export DYLD_LIBRARY_PATH=/opt/homebrew/Cellar/expat/2.8.1/lib
exec "$SCRIPT_DIR/.venv/bin/python3.12" "$SCRIPT_DIR/quad_agent.py"
