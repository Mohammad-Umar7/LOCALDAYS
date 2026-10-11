"""
Builds every LocalDays logo asset from the master artwork.

  python scripts/brand-assets.py          (needs Pillow, numpy and scipy)

Input   src/assets/brand/source/localdays-logo.jpg — emblem, wordmark and tagline on a flat off-white background.
Output  src/assets/brand/   transparent cut-outs used by <Logo>, <LogoMark> and <LogoIcon>
        public/             favicon.ico, home-screen and PWA icons
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / 'src/assets/brand/source/localdays-logo.jpg'
OUT = ROOT / 'src/assets/brand'
PUBLIC = ROOT / 'public'
PAPER = np.array([246, 241, 232], np.float32)  # tailwind `paper`: icon tiles, and the ink colour of the reversed logo
BRASS = np.array([226, 200, 147], np.float32)  # tailwind `brass-300`: foil stamp on the passport cover


def cut_out(rgb: np.ndarray) -> np.ndarray:
    """Lift the artwork off its flat background: float RGBA, flat fills, soft fringe-free edges."""
    img = rgb.astype(np.float32)
    edge = np.concatenate([img[:8].reshape(-1, 3), img[-8:].reshape(-1, 3), img[:, :8].reshape(-1, 3), img[:, -8:].reshape(-1, 3)])
    bg = np.median(edge, axis=0)
    shapes = np.linalg.norm(img - bg, axis=-1) > 60
    # Solid pixels sit one pixel in from each shape's edge. The artwork is flat-coloured and its shapes are
    # separated by background, so each connected shape is snapped to its median colour (drops JPEG noise).
    core = ndimage.binary_erosion(shapes, iterations=1)
    labels, count = ndimage.label(core)
    fills = np.array([[0, 0, 0]] + [np.median(img[labels == i], axis=0) for i in range(1, count + 1)], np.float32)
    # Every pixel takes the fill of its nearest solid pixel, so edges carry no background tint...
    gap, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    solid = fills[labels[iy, ix]]
    # ...and its opacity is how far it sits from the background towards that fill
    span = solid - bg
    alpha = np.clip(((img - bg) * span).sum(-1) / np.maximum((span * span).sum(-1), 1e-6), 0, 1)
    alpha[ndimage.binary_erosion(shapes, iterations=2) | (alpha > 0.96)] = 1
    alpha[(gap > 3) | (alpha < 0.04)] = 0  # JPEG noise away from the shapes
    solid[alpha == 0] = 0  # uniform transparent pixels compress far better
    return np.dstack([solid, alpha * 255])


def reversed_ink(rgba: np.ndarray) -> np.ndarray:
    """Logo for dark backgrounds: the dark-green ink (leaf, dune, wordmark) turns paper; sun and sands keep their colour."""
    out = rgba.copy()
    luma = rgba[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
    ink = np.clip((120 - luma) / 40, 0, 1)[..., None]
    out[..., :3] = rgba[..., :3] * (1 - ink) + PAPER * ink
    return out


def foil(rgba: np.ndarray, colour: np.ndarray) -> np.ndarray:
    """Single-colour stamp: every shape in one colour; the gaps between shapes keep the drawing readable."""
    out = rgba.copy()
    out[..., :3] = np.where(rgba[..., 3:] > 0, colour, 0)
    return out


def bands(alpha: np.ndarray, min_gap: int = 6) -> list[tuple[int, int, int, int]]:
    """Bounding boxes (top, bottom, left, right) of the stacked parts, split on empty rows."""
    rows = np.nonzero((alpha > 127).any(axis=1))[0]
    splits = np.nonzero(np.diff(rows) > min_gap)[0]
    out = []
    for top, bottom in zip(np.r_[rows[0], rows[splits + 1]], np.r_[rows[splits], rows[-1]]):
        cols = np.nonzero((alpha[top : bottom + 1] > 127).any(axis=0))[0]
        out.append((int(top), int(bottom), int(cols[0]), int(cols[-1])))
    return out


def crop(rgba: np.ndarray, top: int, bottom: int, left: int, right: int, pad: int = 6) -> Image.Image:
    h, w = rgba.shape[:2]
    part = rgba[max(top - pad, 0) : min(bottom + pad + 1, h), max(left - pad, 0) : min(right + pad + 1, w)]
    return Image.fromarray(np.clip(part + 0.5, 0, 255).astype(np.uint8), 'RGBA')


def by_height(im: Image.Image, height: int) -> Image.Image:
    return im.resize((round(im.width * height / im.height), height), Image.Resampling.LANCZOS)


def tile(mark: Image.Image, size: int, width: float, radius: float | None) -> Image.Image:
    """The emblem centred on a paper tile. `radius` (fraction of size) rounds the corners; None = full bleed."""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(canvas).rounded_rectangle(
        (0, 0, size - 1, size - 1), radius=round(size * radius) if radius else 0, fill=tuple(int(c) for c in PAPER) + (255,)
    )
    art = mark.resize((round(size * width), round(size * width * mark.height / mark.width)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(art, ((size - art.width) // 2, (size - art.height) // 2))
    return canvas


def save(im: Image.Image, path: Path) -> None:
    # 8-bit palette with alpha: indistinguishable for flat artwork at a quarter of the size
    im.quantize(256, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)
    print(f'{path.relative_to(ROOT)}  {im.width}x{im.height}  {path.stat().st_size // 1024} KB')


def main() -> None:
    rgba = cut_out(np.asarray(Image.open(MASTER).convert('RGB')))
    emblem, wordmark, tagline = bands(rgba[..., 3])
    stacked = (emblem[0], wordmark[1], min(emblem[2], wordmark[2]), max(emblem[3], wordmark[3]))
    light = reversed_ink(rgba)

    # Emblem over wordmark (the tagline is unreadable at header sizes) — sized for 3x screens
    save(by_height(crop(rgba, *stacked), 256), OUT / 'localdays-logo.png')
    save(by_height(crop(light, *stacked), 256), OUT / 'localdays-logo-light.png')
    # Emblem alone
    mark = crop(rgba, *emblem)
    save(by_height(mark, 192), OUT / 'localdays-mark.png')
    save(by_height(crop(light, *emblem), 192), OUT / 'localdays-mark-light.png')
    save(by_height(crop(foil(rgba, BRASS), *emblem), 192), OUT / 'localdays-mark-foil.png')

    # Square icons: rounded paper tile for tabs and installs, full bleed where the OS applies its own mask
    save(tile(mark, 192, 0.86, 0.22), OUT / 'localdays-icon.png')
    save(tile(mark, 192, 0.86, 0.22), PUBLIC / 'icon-192.png')
    save(tile(mark, 512, 0.86, 0.22), PUBLIC / 'icon-512.png')
    save(tile(mark, 512, 0.66, None), PUBLIC / 'icon-maskable-512.png')  # inside the 80% safe zone
    save(tile(mark, 180, 0.82, None).convert('RGB'), PUBLIC / 'apple-touch-icon.png')  # iOS fills transparency with black
    tile(mark, 256, 0.94, 0.18).save(PUBLIC / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print(f'public/favicon.ico  16/32/48/64  {(PUBLIC / "favicon.ico").stat().st_size // 1024} KB')
    print('parts (top, bottom, left, right):', {'emblem': emblem, 'wordmark': wordmark, 'tagline': tagline})


if __name__ == '__main__':
    main()
