#!/bin/bash
# Usage: tts.sh beats.json outdir [voice]   (one wav per beat + durations.json + starts.json)
#        tts.sh --setup                      (first run on a machine: download packages and model, online)
# Normal runs are always offline. They never go online, even after a failure. If a package or the
# model is missing from the cache, run `tts.sh --setup` once; it is the only online step.
# Versions: tts.lock.txt (all packages, exact versions) and MODEL_REVISION in tts.py.
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ "$1" = "--setup" ]; then
  bash "$HERE/setup.sh" tts || exit 1
  # --offline: packages come only from the cache that setup.sh filled, so uv cannot download or
  # build them here. Only tts.py goes online, to download the model.
  uv run --offline --no-project --python 3.12 --with-requirements "$HERE/tts.lock.txt" python "$HERE/tts.py" --setup
else
  HF_HUB_OFFLINE=1 uv run --offline --no-project --python 3.12 --with-requirements "$HERE/tts.lock.txt" python "$HERE/tts.py" "$@" \
    || { echo "Offline run failed. If packages or the model are not downloaded yet, run: bash $0 --setup" >&2; exit 1; }
fi
