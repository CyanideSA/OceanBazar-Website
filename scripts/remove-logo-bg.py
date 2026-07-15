"""Remove the dark background from a PNG logo (e.g. source artwork) while preserving the
bright glow/particle texture around the logo.

Strategy: convert dark pixels to transparency using a soft luminance ramp.
Pixels darker than HARD_DARK become fully transparent. Pixels between
HARD_DARK and SOFT_BOUND get an alpha proportional to luminance, preserving
mid-tone glow. Pixels at or above SOFT_BOUND keep their original alpha.
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

HARD_DARK = 18         # Lum below this -> fully transparent
SOFT_BOUND = 70        # Lum above this -> fully opaque
EDGE_FEATHER = True    # Smooth alpha ramp between bounds


def remove_dark_background(src: Path, dst: Path) -> None:
    img = Image.open(src).convert("RGBA")
    arr = np.array(img)

    rgb = arr[..., :3].astype(np.int32)
    # Perceptual luminance approximation (Rec. 709)
    lum = (rgb[..., 0] * 0.2126 + rgb[..., 1] * 0.7152 + rgb[..., 2] * 0.0722)

    if EDGE_FEATHER:
        ramp = np.clip((lum - HARD_DARK) / (SOFT_BOUND - HARD_DARK), 0.0, 1.0)
        new_alpha = (ramp * 255.0).astype(np.uint8)
    else:
        new_alpha = np.where(lum >= HARD_DARK, 255, 0).astype(np.uint8)

    # Combine with original alpha (so already-transparent pixels stay so)
    final_alpha = np.minimum(arr[..., 3], new_alpha)
    arr[..., 3] = final_alpha

    Image.fromarray(arr, mode="RGBA").save(dst, format="PNG", optimize=True)
    print(f"saved transparent logo -> {dst}")


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: remove-logo-bg.py <input.png> <output.png>")
        return 2
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    remove_dark_background(src, dst)
    return 0


if __name__ == "__main__":
    sys.exit(main())
