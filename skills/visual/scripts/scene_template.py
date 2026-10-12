"""Scene template. Copy to the temp folder and replace the sample beats.

Rules: one method per beat; each beat is a list of steps; each step is a list of animations.
Step i starts when the voice starts phrase i of that beat (starts.json from tts.sh), so a beat
needs exactly one step per phrase. The beat lasts exactly as long as its wav.
Keep every item inside x = +-6.4 and y = +-3.7. Smallest font 28. No Tex/MathTex (no LaTeX installed).
Build rows with row(...), cards with card(...); never place text by hand next to other text.
Show text with FadeIn, not Write (Write draws an outline first). Keep each thing in the same place across beats.
T(), card() and row() raise an error instead of shrinking text or running off screen.
beat() writes times.json next to the video: the real start and end of each beat, for frames.py.
"""
import json, os
from manim import *

AUD = os.environ["AUDIO_DIR"]
DUR = json.load(open(f"{AUD}/durations.json"))
STARTS = json.load(open(f"{AUD}/starts.json"))
FONT, MONO = "Helvetica Neue", "Menlo"
BG, WHITE, MUTED = "#0B1020", "#F5F7FA", "#C5CFE0"
ORANGE, PINK, BLUE, GREEN, YELLOW = "#F6821F", "#E10098", "#4DA3FF", "#3DDC97", "#FFD166"
# Use only these colors: Manim's own (RED, PURPLE, ...) are ManimColor objects, and comparing them with the strings above fails.


def T(s, size=36, color=WHITE, mono=False, **kw):
    if size < 28:
        raise ValueError(f"T({s!r}): font size {size} is below 28")
    return Text(s, font=MONO if mono else FONT, font_size=size, color=color, **kw)


def card(label, color, w=4.2, h=1.3, size=36, mono=False, sub=None, sub_size=28):
    box = RoundedRectangle(corner_radius=0.2, width=w, height=h, stroke_color=color,
                           stroke_width=4, fill_color=BG, fill_opacity=1)
    parts = [T(label, size, WHITE, mono)]
    if sub:
        parts.append(VGroup(*[T(l, sub_size, MUTED) for l in sub.split("\n")]).arrange(DOWN, buff=0.12))
    txt = VGroup(*parts).arrange(DOWN, buff=0.15)
    if txt.width > w - 0.4 or txt.height > h - 0.2:
        raise ValueError(f"card({label!r}): text is {txt.width:.1f} x {txt.height:.1f}, room is "
                         f"{w - 0.4:.1f} x {h - 0.2:.1f}. Shorten the text or make the card bigger.")
    return VGroup(box, txt.move_to(box))


def header(name, color, url):
    return VGroup(T(name, 52, color), T(url, 28, MUTED, mono=True)).arrange(DOWN, buff=0.2).to_edge(UP, buff=0.5)


def row(*cards, buff=0.4):
    r = VGroup(*cards).arrange(RIGHT, buff=buff)
    if r.width > 12.8:
        raise ValueError(f"row is {r.width:.1f} wide, the limit is 12.8. Use narrower cards or two rows.")
    return r


class Explainer(Scene):
    def construct(self):
        self.camera.background_color = BG
        self.b01(); self.b02()   # one call per beat, same ids as beats.json

    clock, times = 0.0, {}  # where the next beat's audio starts; real beat start and end

    def beat(self, bid, steps):
        """Start step i when the voice starts phrase i; the beat lasts as long as its audio.
        All targets are absolute times, so frame rounding never adds up across beats."""
        dur, starts = DUR[bid], STARTS[bid]
        if len(steps) != len(starts):
            raise ValueError(f"{bid}: {len(steps)} steps but {len(starts)} phrases in beats.json")
        t0, frame, begin = self.clock, 1 / config.frame_rate, self.time
        self.clock += dur
        self.add_sound(f"{AUD}/{bid}.wav", time_offset=max(0.0, t0 - self.time))
        if self.mobjects:  # clear the old slide first, alone, so two slides never show together
            self.play(FadeOut(*self.mobjects), run_time=0.3)
        for i, s in enumerate(steps):
            lag = t0 + starts[i] - self.time
            if lag >= frame:
                self.wait(lag)
            nxt = starts[i + 1] if i + 1 < len(starts) else dur
            self.play(*s, run_time=max(2 * frame, min(0.5, t0 + nxt - self.time)))
        if self.clock - self.time >= frame:
            self.wait(self.clock - self.time)
        self.times[bid] = [round(begin, 3), round(self.time, 3)]
        path = os.path.join(os.path.dirname(self.renderer.file_writer.movie_file_path), "times.json")
        json.dump(self.times, open(path, "w"), indent=1)

    # Sample beats.json for these two beats:
    # {"id": "b01", "text": ["Topic title.", "Thing A and thing B,", "and how A connects to B."]}
    # {"id": "b02", "text": ["Part one has three parts.", "First,", "second,", "and third."]}
    def b01(self):
        title = T("Topic title", 56).to_edge(UP, buff=0.8)
        a, b = card("Thing A", BLUE, 3.8), card("Thing B", GREEN, 3.8)
        a.move_to(LEFT * 4.4), b.move_to(RIGHT * 4.4)
        arrow = Arrow(a.get_right(), b.get_left(), buff=0.2, color=WHITE)
        label = T("connects to", 32, MUTED).next_to(arrow, UP, buff=0.15)
        self.beat("b01", [[FadeIn(title)], [FadeIn(a), FadeIn(b)], [GrowFromCenter(arrow), FadeIn(label)]])

    def b02(self):
        h = header("Part one", ORANGE, "detail.example.com")
        chips = row(*[card(t, WHITE, 3.9, 1.0, 30) for t in ["First", "Second", "Third"]])
        self.beat("b02", [[FadeIn(h)], [FadeIn(chips[0])], [FadeIn(chips[1])], [FadeIn(chips[2])]])
