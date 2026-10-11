"""
Builds every Fadhal logo asset from the master artwork.

  python scripts/brand-assets.py          (needs Pillow, numpy and scipy)

Input   src/assets/brand/source/fadhal-logo.jpg — the arch emblem beside the فضل / FADHAL wordmark,
        on a flat off-white background.
Output  src/assets/brand/   transparent cut-outs used by <Logo>, <LogoMark> and <LogoIcon>
        public/             favicon.ico, home-screen and PWA icons
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / 'src/assets/brand/source/fadhal-logo.jpg'
OUT = ROOT / 'src/assets/brand'
PUBLIC = ROOT / 'public'
PAPER = np.array([246, 241, 232], np.float32)  # tailwind `paper`: icon tiles, and the ink colour of the reversed logo
BRASS = np.array([226, 200, 147], np.float32)  # tailwind `brass-300`: foil stamp on the passport cover


def cut_out(rgb: np.ndarray) -> np.ndarray:
    """Lift the artwork off its flat background: float RGBA, flat fills, soft fringe-free edges.

    The emblem's three colours touch each other, so pixels are matched to the nearest of the artwork's
    flat colours (found by k-means), not to whole shapes. Edge pixels against the background take that
    colour at partial opacity; colour-to-colour edges inside the artwork keep their original blend.
    """
    img = rgb.astype(np.float32)
    edge = np.concatenate([img[:8].reshape(-1, 3), img[-8:].reshape(-1, 3), img[:, :8].reshape(-1, 3), img[:, -8:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    shapes = np.linalg.norm(img - bg, axis=-1) > 60
    inner = ndimage.binary_erosion(shapes, iterations=2)
    # Flat colours of the artwork: olive ink, terracotta and sand
    px = img[inner]
    centres = np.array([[66, 68, 52], [188, 106, 68], [220, 190, 158]], np.float32)
    for _ in range(12):
        nearest = np.argmin(((px[:, None, :] - centres[None]) ** 2).sum(-1), axis=1)
        centres = np.array([np.median(px[nearest == k], axis=0) for k in range(len(centres))], np.float32)
    # For each flat colour: how far along background -> colour the pixel sits, and how far off that line it is
    best_a = np.zeros(img.shape[:2], np.float32)
    best_r = np.full(img.shape[:2], np.inf, np.float32)
    best_c = np.zeros(img.shape[:2], np.int32)
    for k, c in enumerate(centres):
        span = c - bg
        a = np.clip(((img - bg) * span).sum(-1) / max(float((span * span).sum()), 1e-6), 0, 1)
        r = np.linalg.norm(img - (bg + a[..., None] * span), axis=-1)
        better = r < best_r
        best_a[better], best_r[better], best_c[better] = a[better], r[better], k
    solid = centres[best_c]
    alpha = best_a
    interior = inner | (alpha > 0.96)
    alpha[interior] = 1
    # Inside the artwork: flat colour where a pixel matches one, the original pixel on colour-to-colour edges
    blend = interior & (best_r > 28)
    solid[blend] = img[blend]
    gap = ndimage.distance_transform_edt(~shapes)
    alpha[(gap > 3) | (alpha < 0.04)] = 0  # JPEG noise away from the shapes
    solid[alpha == 0] = 0  # uniform transparent pixels compress far better
    return np.dstack([solid, alpha * 255])


def reversed_ink(rgba: np.ndarray) -> np.ndarray:
    """Logo for dark backgrounds: the olive ink (pillar, wordmark) turns paper; terracotta and sand keep their colour."""
    out = rgba.copy()
    luma = rgba[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
    ink = np.clip((120 - luma) / 40, 0, 1)[..., None]
    out[..., :3] = rgba[..., :3] * (1 - ink) + PAPER * ink
    return out


def foil(rgba: np.ndarray, colour: np.ndarray) -> np.ndarray:
    """Single-colour stamp in three tones of `colour`, so the touching shapes of the emblem stay readable."""
    out = rgba.copy()
    luma = rgba[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
    tone = np.clip(0.62 + 0.45 * (luma - 60) / 160, 0.62, 1.07)[..., None]
    out[..., :3] = np.where(rgba[..., 3:] > 0, np.clip(colour * tone, 0, 255), 0)
    return out


def bbox(alpha: np.ndarray, left: int = 0, right: int | None = None) -> tuple[int, int, int, int]:
    """(top, bottom, left, right) of the opaque pixels between two columns."""
    sub = alpha[:, left:right] > 127
    rows = np.nonzero(sub.any(axis=1))[0]
    cols = np.nonzero(sub.any(axis=0))[0]
    return int(rows[0]), int(rows[-1]), int(left + cols[0]), int(left + cols[-1])


def split_columns(alpha: np.ndarray, min_gap: int = 20) -> int:
    """The empty column band between the emblem and the wordmark: returns its middle."""
    cols = np.nonzero((alpha > 127).any(axis=0))[0]
    gaps = np.nonzero(np.diff(cols) > min_gap)[0]
    g = gaps[0]
    return int((cols[g] + cols[g + 1]) // 2)


def crop(rgba: np.ndarray, top: int, bottom: int, left: int, right: int, pad: int = 6) -> Image.Image:
    h, w = rgba.shape[:2]
    part = rgba[max(top - pad, 0) : min(bottom + pad + 1, h), max(left - pad, 0) : min(right + pad + 1, w)]
    return Image.fromarray(np.clip(part + 0.5, 0, 255).astype(np.uint8), 'RGBA')


def by_height(im: Image.Image, height: int) -> Image.Image:
    return im.resize((round(im.width * height / im.height), height), Image.Resampling.LANCZOS)


def tile(mark: Image.Image, size: int, height: float, radius: float | None) -> Image.Image:
    """The emblem centred on a paper tile, `height` (fraction of size) tall. `radius` rounds the corners; None = full bleed."""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=round(size * radius) if radius else 0, fill=tuple(int(c) for c in PAPER) + (255,)
    )
    art = mark.resize((round(size * height * mark.width / mark.height), round(size * height)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def save(im: Image.Image, path: Path) -> None:
    # 8-bit palette with alpha: indistinguishable for flat artwork at a quarter of the size
    im.quantize(256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    print(f'{path.relative_to(ROOT)}  {im.width}x{im.height}  {path.stat().st_size // 1024} KB')


def main() -> None:
    rgba = cut_out(np.asarray(Image.open(MASTER).convert('RGB')))
    alpha = rgba[..., 3]
    mid = split_columns(alpha)
    emblem = bbox(alpha, 0, mid)
    lockup = bbox(alpha)
    light = reversed_ink(rgba)

    # Emblem beside the bilingual wordmark — sized for 3x screens
    save(by_height(crop(rgba, *lockup), 256), OUT / 'fadhal-logo.png')
    save(by_height(crop(light, *lockup), 256), OUT / 'fadhal-logo-light.png')
    # Emblem alone
    mark = crop(rgba, *emblem)
    save(by_height(mark, 192), OUT / 'fadhal-mark.png')
    save(by_height(crop(light, *emblem), 192), OUT / 'fadhal-mark-light.png')
    save(by_height(crop(foil(rgba, BRASS), *emblem), 192), OUT / 'fadhal-mark-foil.png')

    # Square icons: rounded paper tile for tabs and installs, full bleed where the OS applies its own mask
    save(tile(mark, 192, 0.74, 0.22), OUT / 'fadhal-icon.png')
    save(tile(mark, 192, 0.74, 0.22), PUBLIC / 'icon-192.png')
    save(tile(mark, 512, 0.74, 0.22), PUBLIC / 'icon-512.png')
    save(tile(mark, 512, 0.58, None), PUBLIC / 'icon-maskable-512.png')  # inside the 80% safe zone
    save(tile(mark, 180, 0.72, None).convert('RGB'), PUBLIC / 'apple-touch-icon.png')  # iOS fills transparency with black
    tile(mark, 256, 0.84, 0.18).save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f'public/favicon.ico  16/32/48/64  {(PUBLIC / "favicon.ico").stat().st_size // 1024} KB')
    print('parts (top, bottom, left, right):', {'emblem': emblem, 'lockup': lockup})


if __name__ == '__main__':
    main()
