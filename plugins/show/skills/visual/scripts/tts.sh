#!/bin/bash
# Usage: tts.sh beats.json outdir [voice]   (one wav per beat + durations.json + starts.json)
# Runs offline so a slow network never stalls it; falls back to online (first run downloads everything).
SPACY_MODEL='en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl'
ARGS=("$@")
run() {
  uv run "$@" --no-project --python 3.12 --with mlx-audio --with misaki --with num2words --with spacy \
    --with phonemizer-fork --with espeakng-loader --with "$SPACY_MODEL" --with 'setuptools<81' \
    python "$(dirname "$0")/tts.py" "${ARGS[@]}"
}
HF_HUB_OFFLINE=1 run --offline || { echo "Offline run failed; trying again online." >&2; run; }
