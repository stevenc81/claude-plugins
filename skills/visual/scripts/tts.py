"""Make one wav per beat with Kokoro (mlx-audio). Prints and saves durations and phrase starts.

Usage: tts.sh beats.json outdir [voice]   (wraps this file with its dependencies)
beats.json: [{"id": "b01", "text": ["Phrase for step one.", "Phrase for step two."]}, ...]
  "text" is a list of phrases, one per animation step (a plain string counts as one phrase).
Writes outdir/<id>.wav, outdir/durations.json ({"b01": 6.4, ...})
and outdir/starts.json ({"b01": [0.35, 2.9], ...}: seconds into the wav where each phrase starts).
"""
import json, os, sys, wave
import numpy as np
from mlx_audio.tts.utils import load_model

SR = 24000
LEAD = 0.35  # silence before the first phrase (covers the 0.3 s slide fade-out)
GAP = 0.3    # silence between phrases; 0.15 after a comma
TAIL = 0.3   # silence after the last phrase
SPEED = 0.92  # a little slower than normal, easier for non-native listeners


def silence(s):
    return np.zeros(int(SR * s), dtype=np.float32)


def trim(a):
    """Cut Kokoro's own silence at both ends (about 0.35 s before, 0.5 s after) with a 10 ms fade."""
    loud = np.flatnonzero(np.abs(a) > 0.01)
    a = a[max(0, loud[0] - int(SR * 0.04)):loud[-1] + int(SR * 0.06)].copy()
    f = int(SR * 0.01)
    a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
    return a


beats = json.load(open(sys.argv[1]))
out = sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else "af_heart"
os.makedirs(out, exist_ok=True)

model = load_model("mlx-community/Kokoro-82M-bf16")
durations, starts = {}, {}
for b in beats:
    phrases = [b["text"]] if isinstance(b["text"], str) else b["text"]
    audio, starts[b["id"]] = [silence(LEAD)], []
    for i, p in enumerate(phrases):
        parts = [np.array(r.audio, dtype=np.float32).flatten()
                 for r in model.generate(text=p, voice=voice, speed=SPEED, lang_code="a")]
        speech = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
        if speech.size < SR * 0.3 or not np.isfinite(speech).all() or np.abs(speech).max() <= 0.01:
            sys.exit(f"{b['id']} phrase {i + 1}: no usable speech. Check the text: {p!r}")
        if i:
            audio.append(silence(GAP / 2 if phrases[i - 1].rstrip().endswith(",") else GAP))
        starts[b["id"]].append(round(sum(map(len, audio)) / SR, 2))
        audio.append(trim(speech))
    audio.append(silence(TAIL))
    pcm = (np.clip(np.concatenate(audio), -1, 1) * 32767).astype(np.int16)
    with wave.open(f"{out}/{b['id']}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    durations[b["id"]] = round(len(pcm) / SR, 2)
    print(b["id"], durations[b["id"]], "starts", starts[b["id"]])
json.dump(durations, open(f"{out}/durations.json", "w"), indent=1)
json.dump(starts, open(f"{out}/starts.json", "w"), indent=1)
print("total", round(sum(durations.values()), 1))
