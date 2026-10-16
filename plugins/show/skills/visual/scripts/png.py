"""Render an SVG to a PNG beside it, at 2x, and print the PNG's path and size.

Usage: uv run --offline --no-project --python 3.12 --with resvg-py python png.py <file.svg>
"""

import struct
import sys
from pathlib import Path

import resvg_py

svg = Path(sys.argv[1]).resolve()
png = svg.with_suffix(".png")
png.write_bytes(bytes(resvg_py.svg_to_bytes(svg_path=str(svg), zoom=2)))
width, height = struct.unpack(">II", png.read_bytes()[16:24])
print(f"{png} {width}x{height}")
