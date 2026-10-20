#!/bin/bash
# Usage: setup.sh png|manim|tts   (first run on a machine; the only online step for packages)
# `uv run` ignores build constraints (tested on uv 0.13.1), so a package built from source
# (pycairo, srt, docopt) would get unpinned build tools. `uv pip install` honours them. This script
# installs the lock file into a throwaway folder with build.lock.txt as the build constraints. uv keeps
# the built wheels in its cache, so the later `uv run` calls reuse them and build nothing.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
case "$1" in png|manim|tts) ;; *) echo "usage: $0 png|manim|tts" >&2; exit 2 ;; esac
TMPD="$(mktemp -d)"; trap 'rm -rf "$TMPD"' EXIT
uv pip install --python 3.12 --build-constraints "$HERE/build.lock.txt" --target "$TMPD" -r "$HERE/$1.lock.txt"
