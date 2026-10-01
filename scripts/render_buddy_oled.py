#!/usr/bin/env python3
"""
render_buddy_oled.py
-----------------------------------------------------------------------------
Renders real preview art for the StrazzTunedBuddy project page.

StrazzTunedBuddy is Arduino firmware for an SSD1306 128x64 OLED, so there is no
way to "screenshot" it without the physical hardware. Instead of faking art,
this interprets the firmware's own drawing calls and rasterises exactly what the
device would show.

It implements the small subset of Adafruit_GFX the sketch actually uses
(clearDisplay / fillRect / fillCircle / drawCircle / fillTriangle / drawLine /
fillRoundRect / drawRoundRect), tracks the sketch's local int/float variables so
parametric calls like `fillTriangle(x1 - radius1, ...)` evaluate correctly, and
snapshots the framebuffer on every `display.display()`. The following `delay()`
becomes that frame's duration, so each expression exports as an animated GIF at
the firmware's real timing.

Text frames (the "STRAZZ TUNED" splash) are skipped: reproducing them would need
the GFX bitmap font, and an approximation would misrepresent the device.

Usage:  python3 scripts/render_buddy_oled.py <path-to-StrazzBuddy1.ino> <outdir>
"""

import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw

WIDTH, HEIGHT = 128, 64
SCALE = 4                      # nearest-neighbour upscale; keeps hard pixel edges
ON = (255, 243, 207)           # warm white, matching a white OLED under the site's palette
OFF = (6, 6, 8)

# Expressions worth exporting, in the order the page presents them.
EXPRESSIONS = ["regEyes", "heart", "carrotEyes", "sideEye", "sleep", "wakeUp"]

CALL_RE = re.compile(r"display\.(\w+)\s*\(([^;]*)\)\s*;")
DECL_RE = re.compile(r"^\s*(?:int|float|double)\s+(\w+)\s*=\s*([^;]+);")
DELAY_RE = re.compile(r"^\s*delay\s*\(\s*(\d+)\s*\)\s*;")


def split_args(raw):
    """Split a call's argument list on top-level commas only."""
    args, depth, cur = [], 0, ""
    for ch in raw:
        if ch == "," and depth == 0:
            args.append(cur.strip())
            cur = ""
            continue
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth -= 1
        cur += ch
    if cur.strip():
        args.append(cur.strip())
    return args


class Display:
    """Framebuffer mimicking the SSD1306 + the GFX primitives the sketch uses."""

    def __init__(self):
        self.img = Image.new("RGB", (WIDTH, HEIGHT), OFF)
        self.draw = ImageDraw.Draw(self.img)
        self.frames = []           # (image, duration_ms)

    @staticmethod
    def _color(token):
        return OFF if str(token).strip() == "BLACK" else ON

    def clearDisplay(self):
        self.draw.rectangle([0, 0, WIDTH, HEIGHT], fill=OFF)

    def fillRect(self, x, y, w, h, c):
        self.draw.rectangle([x, y, x + w - 1, y + h - 1], fill=self._color(c))

    def drawRect(self, x, y, w, h, c):
        self.draw.rectangle([x, y, x + w - 1, y + h - 1], outline=self._color(c))

    def fillCircle(self, x, y, r, c):
        self.draw.ellipse([x - r, y - r, x + r, y + r], fill=self._color(c))

    def drawCircle(self, x, y, r, c):
        self.draw.ellipse([x - r, y - r, x + r, y + r], outline=self._color(c))

    def fillTriangle(self, x1, y1, x2, y2, x3, y3, c):
        self.draw.polygon([(x1, y1), (x2, y2), (x3, y3)], fill=self._color(c))

    def drawLine(self, x1, y1, x2, y2, c):
        self.draw.line([(x1, y1), (x2, y2)], fill=self._color(c))

    def fillRoundRect(self, x, y, w, h, r, c):
        self.draw.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=r, fill=self._color(c))

    def drawRoundRect(self, x, y, w, h, r, c):
        self.draw.rounded_rectangle([x, y, x + w - 1, y + h - 1], radius=r, outline=self._color(c))

    def display(self):
        self.frames.append([self.img.copy(), 500])

    def set_last_delay(self, ms):
        if self.frames:
            self.frames[-1][1] = ms


def extract_function(source, name):
    """Return the body of `void name() { ... }` by brace matching."""
    start = source.find("void %s()" % name)
    if start == -1:
        return None
    open_brace = source.find("{", start)
    depth, i = 0, open_brace
    while i < len(source):
        if source[i] == "{":
            depth += 1
        elif source[i] == "}":
            depth -= 1
            if depth == 0:
                return source[open_brace + 1:i]
        i += 1
    return None


def run_function(body):
    """Interpret one function body, returning its captured frames."""
    disp = Display()
    env = {}
    skipped_text = False

    for line in body.splitlines():
        line = line.split("//")[0]
        if not line.strip():
            continue

        decl = DECL_RE.match(line)
        if decl:
            try:
                env[decl.group(1)] = eval(decl.group(2), {"__builtins__": {}}, dict(env))
            except Exception:
                pass
            continue

        delay = DELAY_RE.match(line)
        if delay:
            disp.set_last_delay(int(delay.group(1)))
            continue

        for call in CALL_RE.finditer(line):
            fn, raw = call.group(1), call.group(2)
            if fn in ("setCursor", "setTextSize", "setTextColor", "println", "print"):
                skipped_text = True
                continue
            method = getattr(disp, fn, None)
            if method is None:
                continue
            args = []
            for a in split_args(raw):
                if a in ("WHITE", "BLACK", "SSD1306_WHITE", "SSD1306_BLACK"):
                    args.append("BLACK" if "BLACK" in a else "WHITE")
                    continue
                try:
                    args.append(eval(a, {"__builtins__": {}}, dict(env)))
                except Exception:
                    args.append(0)
            try:
                method(*args)
            except TypeError:
                pass

    return disp.frames, skipped_text


def upscale(img):
    return img.resize((WIDTH * SCALE, HEIGHT * SCALE), Image.NEAREST)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1

    source = Path(sys.argv[1]).read_text(errors="ignore")
    outdir = Path(sys.argv[2])
    outdir.mkdir(parents=True, exist_ok=True)

    for name in EXPRESSIONS:
        body = extract_function(source, name)
        if body is None:
            print("  ! %-12s not found in sketch" % name)
            continue

        frames, skipped_text = run_function(body)
        if not frames:
            print("  ! %-12s produced no frames" % name)
            continue

        # De-duplicate consecutive identical frames so GIFs stay small.
        merged = []
        for img, dur in frames:
            if merged and merged[-1][0].tobytes() == img.tobytes():
                merged[-1][1] += dur
            else:
                merged.append([img, dur])

        images = [upscale(f[0]) for f in merged]
        durations = [max(f[1], 40) for f in merged]

        gif = outdir / ("%s.gif" % name.lower())
        images[0].save(
            gif, save_all=True, append_images=images[1:],
            duration=durations, loop=0, optimize=True,
        )
        # Representative still: the longest-held frame reads as the "resting" face.
        still_idx = durations.index(max(durations))
        images[still_idx].save(outdir / ("%s.png" % name.lower()))

        note = " (text frames skipped)" if skipped_text else ""
        print("  %-12s %2d frames -> %s%s" % (name, len(merged), gif.name, note))

    return 0


if __name__ == "__main__":
    sys.exit(main())
