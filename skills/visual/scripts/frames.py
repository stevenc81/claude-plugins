"""Extract one still per beat, late in the beat so every item on screen is visible.

Usage: uv run --offline --no-project --python 3.12 python frames.py video.mp4 outdir
Reads times.json next to the video (real beat start and end, written by the scene).
Writes outdir/<beat id>.png, sampled 0.15 s before the beat ends, after its last animation.
"""
import json, subprocess, sys, os

video, out = sys.argv[1:3]
os.makedirs(out, exist_ok=True)
total = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "csv=p=0", video], capture_output=True, text=True, check=True).stdout)
for bid, (start, end) in json.load(open(os.path.join(os.path.dirname(video), "times.json"))).items():
    at = min(end - 0.15, total - 0.2)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{at:.2f}", "-i", video,
                    "-frames:v", "1", f"{out}/{bid}.png"], check=True)
    png = f"{out}/{bid}.png"
    if not os.path.exists(png) or os.path.getsize(png) == 0:
        sys.exit(f"{bid}: ffmpeg wrote no frame at {at:.2f} s")
    print(bid, f"{at:.1f}s")
