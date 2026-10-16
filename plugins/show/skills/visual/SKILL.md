---
name: visual
description: Use to show the user a picture or a video inline in the terminal. Use it for any process, data flow or structure with 3 or more parts, for a chart, and when the user asks for an image, a diagram, a video or a video explainer. Makes a PNG (SVG and resvg) or a narrated mp4 (Kokoro and Manim), then shows it in the chat with the show plugin.
---

# Visual

The `show` plugin adds the tool `mcp__show__media`. It shows a PNG, or plays an mp4 with sound, inline in the chat. Ghostty draws the pixels.
The picture appears where you call the tool. So call it at the point in your reply where the picture belongs, then continue the reply below it.
If the tool is missing, the plugin did not load. Tell the user, and use a text diagram for now.

For all text in a picture or a narration, follow the same writing rules as your chat replies. If you cannot see them, for example as a subagent, and `~/.claude/hooks/rules.sh` exists, read that file first.
Use only facts the user gave or you verified. If a fact is missing, ask or leave it out.

Run this setup first:
```
S="<this skill's base directory>/scripts"   # Claude Code shows the base directory when the skill loads
OUT="$(getconf DARWIN_USER_TEMP_DIR)claude-visual"   # your private temp folder; macOS deletes files there after 3 days without use
case "$OUT" in /*) mkdir -p "$OUT" ;; *) echo "no private temp folder" >&2; exit 1 ;; esac
```

## Image (the default)

1. **Draw.** Write `$OUT/<YYYY-MM-DD>-<topic-slug>.svg`.
   - Size: `width="1200"` and a height from 300 to 900. Wide pictures fit the terminal best.
   - Colors: a full-size `<rect>` in `#12151b` first. Text `#e8ebf0`, muted text `#9aa3b2`, lines `#4a5363`. One color per idea: `#ff8a3d`, `#5aa9ff`, `#5fd38d`, `#e5c07b`.
   - Text: `font-family="Helvetica"`, size 24 or more. The terminal shows the picture about 1000 pixels wide, so smaller text is hard to read.
   - Boxes: a text is about 0.55 x font size x characters wide. Make each box that wide plus 40. Put boxes on a grid with at least 40 between them.
   - Arrows: put a short label on each arrow, a plain verb and what moves, for example `sends wav`.
   - For a diagram, load the `artifact-diagramming` skill if you have it. For a chart, load the `dataviz` skill if you have it. Use them for their drawing rules only.
2. **Render.** `uv run --offline --no-project --python 3.12 --with resvg-py python "$S/png.py" <file.svg>` writes the PNG beside the SVG in about 0.2 s. On the first run on a machine, leave out `--offline`.
3. **Check (do not skip).** Read the PNG. Fix text that overlaps, is cut off, or runs out of its box. Render and read it again.
4. **Show.** Call `mcp__show__media` with the PNG path and a one-line `alt`.

## Video (only when the user asks)

A narrated 1 to 3 minute explainer (3Blue1Brown style), with a local voice and Manim. Free, offline, no LaTeX. Shell variables do not last from one Bash call to the next, so start each call with the setup lines and this one:
```
TMP="$OUT/work-<topic-slug>"; mkdir -p "$TMP"   # the same path in every call
```
If any step fails and you stop, run `rm -rf "${TMP:?}"` before you report the failure.

1. **Script.** Write `$TMP/beats.json`: `[{"id":"b01","text":["First phrase.","Second phrase."]}, ...]`. Each phrase is one animation step: the step starts when the voice starts that phrase. So name the thing that the step shows in the first 3 words of its phrase. A phrase is a sentence, or a clause that ends with a comma. A beat has 1 to 4 phrases. Total 1 to 3 minutes (about 2.5 words per second).
   Write acronyms as normal capitals. Kokoro says these correctly (tested 2026-10-11): API, AI, MCP, DNS, GraphQL, EKS, PR, URL, CLI, SQL, OAuth, ArgoCD, Kubernetes, Terraform, GitHub.
   Kokoro spells an unknown capital word letter by letter and guesses unknown tool names. If people say a term as a word, write its sound as misaki phonemes in the text. These are tested: `[JSON](/ʤˈAsᵊn/)`, `[YAML](/jˈæmᵊl/)`, `[kubectl](/kjˈub kəntɹˈOl/)`.
2. **Voice.** `bash "$S/tts.sh" "$TMP/beats.json" "$TMP/audio"` writes `b01.wav ...`, `durations.json`, and `starts.json` (where each phrase starts in its wav), and prints them. Model: Kokoro-82M through mlx-audio, voice `af_heart`. It runs offline and falls back to online if that fails; the first run on a machine downloads packages and the model (about 5 minutes). If the total is outside the target, edit the text and run again.
   Fallback if Kokoro fails: make one `say -v Samantha -o p1.aiff "phrase"` per phrase, join each beat's phrases into `b01.wav` with `ffmpeg`, and write `durations.json` and `starts.json` by hand with `ffprobe`.
3. **Animate.** Copy `"$S/scene_template.py"` to `"$TMP/scene.py"`. Write one method per beat; each beat is a list of steps, one step per phrase. `beat()` calls `add_sound` and starts step i when the voice starts phrase i, so picture and voice stay in sync. It stops with an error if the step count and the phrase count differ. `T()`, `card()`, and `row()` also stop with an error if text is below size 28, does not fit its card, or a row is wider than 12.8. Then shorten the text, make the card bigger, or split the row.
   The checks do not cover arrows and arrow labels. Make the gap between two cards at least the label width plus 0.4 (about 2.4 for a short label at size 28).
   Look: dark background, simple shapes, arrows, short labels, one color per idea. Use only the colors that the template defines. Text must never overlap, never be cut off, and stay at font size 28 or more. Use `row()`, `card()`, `header()`; avoid hand-placed text. Plain `Text` only, never `Tex` or `MathTex`. Show text with `FadeIn`, not `Write` (`Write` draws an outline first). Keep each thing in the same place on screen from beat to beat.
4. **Render.**
   ```
   cd "$TMP" && AUDIO_DIR="$TMP/audio" uv run --offline --no-project --python 3.12 --with manim manim --disable_caching -r 1920,1080 --fps 30 --media_dir "$TMP/media" scene.py Explainer
   ```
   Result: `$TMP/media/videos/scene/1080p30/Explainer.mp4`, with `times.json` next to it (the real start and end of each beat). Keep `--disable_caching`: cached animations shift the timing. On the first run on a machine, leave out `--offline`.
5. **Check (do not skip).** `uv run --offline --no-project --python 3.12 python "$S/frames.py" <video> "$TMP/frames"` writes `$TMP/frames/<beat id>.png`, one PNG per beat, sampled 0.15 s before the beat ends (from `times.json`).
   Read every PNG. Fix overlapping, cut-off, tiny, or off-center items; render again; read the changed frames again. Confirm the total length with `ffprobe`.
6. **Show.** Copy the mp4 to `"$OUT/<YYYY-MM-DD>-<topic-slug>.mp4"` and run `rm -rf "${TMP:?}"`. Then call `mcp__show__media` with the mp4 path. The video plays in the chat with sound, and the call returns when it ends. The user can type `/pause` to pause and resume it, and press Esc to stop it. Then tell the user the length and anything you left out.
