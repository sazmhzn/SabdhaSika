"""Generate the PWA icon set.

The mark is the Devanagari syllable "śa" (श) — the first sound of *śabda*,
"word" — rendered exactly like the vocabulary tiles inside the app: a soft
gradient square, the glyph centred, the reading beneath.

Run:  python scripts/make_icons.py
"""

from __future__ import annotations

import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "icons")

INK = (11, 11, 12)
LABEL = (108, 108, 114)
TOP = (238, 238, 236)
BOTTOM = (214, 214, 210)

DEVANAGARI_CANDIDATES = [
    ("C:/Windows/Fonts/Nirmala.ttc", 0),
    ("C:/Windows/Fonts/Nirmala.ttc", 1),
    ("C:/Windows/Fonts/mangal.ttf", 0),
    ("/System/Library/Fonts/Supplemental/DevanagariMT.ttc", 0),
    ("/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf", 0),
    ("/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf", 0),
]

LATIN_CANDIDATES = [
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/segoeui.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def load(path: str, size: int, index: int = 0):
    try:
        return ImageFont.truetype(path, size, index=index)
    except Exception:
        return None


def glyph_font(size: int):
    for path, index in DEVANAGARI_CANDIDATES:
        f = load(path, size, index)
        if f:
            return f
    raise SystemExit("No Devanagari font found — install Noto Sans Devanagari.")


def latin_font(size: int):
    for path in LATIN_CANDIDATES:
        f = load(path, size)
        if f:
            return f
    return ImageFont.load_default()


def gradient_square(size: int, radius_ratio: float, pad: int = 0) -> Image.Image:
    """Vertical gradient, optionally rounded and inset."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    grad = Image.new("RGB", (1, size - pad * 2))
    for y in range(size - pad * 2):
        t = y / max(1, size - pad * 2 - 1)
        grad.putpixel(
            (0, y),
            tuple(round(TOP[i] + (BOTTOM[i] - TOP[i]) * t) for i in range(3)),
        )
    grad = grad.resize((size - pad * 2, size - pad * 2))

    mask = Image.new("L", (size - pad * 2, size - pad * 2), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, size - pad * 2 - 1, size - pad * 2 - 1],
        radius=int((size - pad * 2) * radius_ratio),
        fill=255,
    )
    canvas.paste(grad, (pad, pad), mask)
    return canvas


def draw_mark(size: int, radius_ratio: float, glyph_scale: float, label_scale: float,
              pad: int = 0) -> Image.Image:
    img = gradient_square(size, radius_ratio, pad)
    draw = ImageDraw.Draw(img)

    glyph = "श"
    gfont = glyph_font(int(size * glyph_scale))
    box = draw.textbbox((0, 0), glyph, font=gfont)
    gw, gh = box[2] - box[0], box[3] - box[1]
    gx = (size - gw) / 2 - box[0]
    gy = size * 0.5 - gh / 2 - box[1] - size * 0.085
    draw.text((gx, gy), glyph, font=gfont, fill=INK)

    label = "śa"
    lfont = latin_font(max(10, int(size * label_scale)))
    lb = draw.textbbox((0, 0), label, font=lfont)
    lw = lb[2] - lb[0]
    draw.text(((size - lw) / 2 - lb[0], size * 0.5 + size * 0.185), label, font=lfont, fill=LABEL)

    return img


def save(img: Image.Image, name: str):
    path = os.path.join(OUT, name)
    img.convert("RGB").save(path, "PNG", optimize=True)
    print("wrote", os.path.relpath(path, ROOT))


def main():
    os.makedirs(OUT, exist_ok=True)

    # "any" — rounded like the in-app tiles.
    for size in (192, 512):
        save(draw_mark(size, radius_ratio=0.235, glyph_scale=0.52, label_scale=0.115), f"icon-{size}.png")

    # "maskable" — full bleed, mark inside the 80% safe circle.
    for size in (192, 512):
        save(
            draw_mark(size, radius_ratio=0.5, glyph_scale=0.38, label_scale=0.085, pad=0),
            f"icon-maskable-{size}.png",
        )

    save(draw_mark(180, radius_ratio=0.235, glyph_scale=0.52, label_scale=0.115), "apple-touch-icon.png")
    save(draw_mark(32, radius_ratio=0.24, glyph_scale=0.54, label_scale=0.0), "favicon-32.png")

    probe = os.path.join(OUT, "_probe.png")
    if os.path.exists(probe):
        os.remove(probe)


if __name__ == "__main__":
    main()
