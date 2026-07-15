"""Remove solid plate (black or white) from logo PNGs while preserving colored logo texture.

Auto-detects plate from corner color (light corners → white plate, dark → black plate).

Strategy (no ML, no remapping of logo RGB):
1) BFS flood from corners through neutral plate pixels only.
2) BFS from transparency into trapped plate (letter holes).
3) Halo pass on semi-transparent neutral plate fringe.
4) Peel opaque neutral plate pixels touching transparency.

Does not alter RGB of surviving pixels (texture unchanged); only sets alpha to 0 on plate/halo.
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


def _neighbor_min_alpha_8(a: np.ndarray) -> np.ndarray:
    """Min alpha among 8 neighbors; border padded with 255."""
    h, w = a.shape
    p = np.pad(a.astype(np.uint16), ((1, 1), (1, 1)), constant_values=255)
    m = p[1:-1, 1:-1].copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            if dy == 0 and dx == 0:
                continue
            m = np.minimum(m, p[1 + dy : 1 + dy + h, 1 + dx : 1 + dx + w])
    return m.astype(np.uint8)


def _peel_neutral_rim_dark(
    arr: np.ndarray,
    *,
    iterations: int = 6,
    chroma_lim: float = 10.0,
    rgb_sum_lim: float = 90.0,
    neighbor_alpha_below: int = 52,
) -> None:
    """Opaque neutral-dark pixels touching transparency (plate ring only)."""
    rgb_f = arr[..., :3].astype(np.float32)
    r, g, b = rgb_f[..., 0], rgb_f[..., 1], rgb_f[..., 2]
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    for _ in range(iterations):
        a = arr[..., 3]
        min_nb = _neighbor_min_alpha_8(a)
        rim = (
            (a > 250)
            & (min_nb < neighbor_alpha_below)
            & (chroma <= chroma_lim)
            & ((r + g + b) <= rgb_sum_lim)
        )
        if not np.any(rim):
            break
        arr[rim, 3] = 0


def _peel_neutral_rim_light(
    arr: np.ndarray,
    *,
    iterations: int = 6,
    chroma_lim: float = 14.0,
    rgb_sum_min: float = 650.0,
    neighbor_alpha_below: int = 52,
) -> None:
    """Opaque neutral-light pixels touching transparency (white plate ring only)."""
    rgb_f = arr[..., :3].astype(np.float32)
    r, g, b = rgb_f[..., 0], rgb_f[..., 1], rgb_f[..., 2]
    chroma = np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)
    for _ in range(iterations):
        a = arr[..., 3]
        min_nb = _neighbor_min_alpha_8(a)
        rim = (
            (a > 250)
            & (min_nb < neighbor_alpha_below)
            & (chroma <= chroma_lim)
            & ((r + g + b) >= rgb_sum_min)
        )
        if not np.any(rim):
            break
        arr[rim, 3] = 0


def _flood_plate_from_corners(
    arr: np.ndarray,
    br: float,
    bg: float,
    bb: float,
    tol_sq: float,
    *,
    light_plate: bool,
    chroma_max: int,
    rgb_sum_max: int,
    rgb_sum_min: int,
) -> None:
    h, w = arr.shape[:2]
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for sy, sx in ((0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)):
        q.append((sy, sx))

    while q:
        y, x = q.popleft()
        if visited[y, x]:
            continue
        visited[y, x] = True

        r, g, b = arr[y, x, :3].astype(np.float32)
        chroma = float(np.max([r, g, b]) - np.min([r, g, b]))
        if chroma > chroma_max:
            continue
        s = r + g + b
        if light_plate:
            if s < rgb_sum_min:
                continue
        elif s > rgb_sum_max:
            continue
        dr, dg, db = r - br, g - bg, b - bb
        if dr * dr + dg * dg + db * db > tol_sq:
            continue

        arr[y, x, 3] = 0
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                q.append((ny, nx))


def _flood_plate_from_transparency(
    arr: np.ndarray,
    br: float,
    bg: float,
    bb: float,
    tol_sq: float,
    *,
    light_plate: bool,
    chroma_max: int,
    rgb_sum_max: int,
    rgb_sum_min: int,
) -> None:
    h, w = arr.shape[:2]
    visited2 = np.zeros((h, w), dtype=bool)
    q2: deque[tuple[int, int]] = deque()
    for yy in range(h):
        for xx in range(w):
            if arr[yy, xx, 3] == 0:
                q2.append((yy, xx))
                visited2[yy, xx] = True

    while q2:
        y, x = q2.popleft()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            ny, nx = y + dy, x + dx
            if ny < 0 or ny >= h or nx < 0 or nx >= w or visited2[ny, nx]:
                continue
            visited2[ny, nx] = True
            if arr[ny, nx, 3] == 0:
                q2.append((ny, nx))
                continue
            r, g, b = arr[ny, nx, :3].astype(np.float32)
            chroma = float(np.max([r, g, b]) - np.min([r, g, b]))
            if chroma > chroma_max:
                continue
            s = r + g + b
            if light_plate:
                if s < rgb_sum_min:
                    continue
            elif s > rgb_sum_max:
                continue
            dr, dg, db = r - br, g - bg, b - bb
            if dr * dr + dg * dg + db * db > tol_sq:
                continue
            arr[ny, nx, 3] = 0
            q2.append((ny, nx))


def _clear_trapped_neutral_plate(
    arr: np.ndarray,
    *,
    light_plate: bool,
    chroma_max: float = 14.0,
    rgb_sum_max: float = 62.0,
    rgb_sum_min: float = 680.0,
) -> None:
    """Remove neutral plate pixels trapped inside letter counters / icon (not reached by flood).

    Only targets near-neutral pixels so saturated navy/teal logo texture is preserved.
    """
    rgb = arr[..., :3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    chroma = mx - mn
    s = r + g + b
    a = arr[..., 3]
    if light_plate:
        trapped = (a > 0) & (chroma <= chroma_max) & (s >= rgb_sum_min)
    else:
        trapped = (a > 0) & (chroma <= chroma_max) & (s <= rgb_sum_max)
    arr[trapped, 3] = 0


def _trim_alpha_padding(arr: np.ndarray, pad: int = 4) -> np.ndarray:
    """Crop to non-transparent bounds with small padding."""
    a = arr[..., 3]
    ys, xs = np.where(a > 8)
    if ys.size == 0:
        return arr
    y0, y1 = max(0, int(ys.min()) - pad), min(arr.shape[0], int(ys.max()) + pad + 1)
    x0, x1 = max(0, int(xs.min()) - pad), min(arr.shape[1], int(xs.max()) + pad + 1)
    return arr[y0:y1, x0:x1]


def strip_plate(
    src: Path,
    dst: Path,
    *,
    tol: float | None = None,
    force_light: bool | None = None,
) -> None:
    img = Image.open(src).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]

    corners = np.array(
        [
            arr[0, 0, :3],
            arr[0, w - 1, :3],
            arr[h - 1, 0, :3],
            arr[h - 1, w - 1, :3],
        ],
        dtype=np.float32,
    )
    br, bg, bb = np.median(corners, axis=0)
    light_plate = force_light if force_light is not None else float(br + bg + bb) / 3.0 > 200.0
    if tol is None:
        tol = 52.0 if light_plate else 58.0
    tol_sq = tol * tol

    if light_plate:
        chroma_max = 22
        rgb_sum_min = 680
        rgb_sum_max = 9999
        halo_chroma_max = 16
        halo_rgb_sum_min = 620
        halo_rgb_sum_max = 9999
    else:
        chroma_max = 20
        rgb_sum_min = 0
        rgb_sum_max = 132
        halo_chroma_max = 12
        halo_rgb_sum_min = 0
        halo_rgb_sum_max = 92

    _flood_plate_from_corners(
        arr, br, bg, bb, tol_sq,
        light_plate=light_plate,
        chroma_max=chroma_max,
        rgb_sum_max=rgb_sum_max,
        rgb_sum_min=rgb_sum_min,
    )
    _flood_plate_from_transparency(
        arr, br, bg, bb, tol_sq,
        light_plate=light_plate,
        chroma_max=chroma_max,
        rgb_sum_max=rgb_sum_max,
        rgb_sum_min=rgb_sum_min,
    )

    rgb = arr[..., :3].astype(np.float32)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    chroma = mx - mn
    a = arr[..., 3]
    s = r + g + b
    if light_plate:
        halo = (
            (a > 0)
            & (a < 248)
            & (chroma <= halo_chroma_max)
            & (s >= halo_rgb_sum_min)
        )
        _peel_neutral_rim_light(arr)
    else:
        halo = (
            (a > 0)
            & (a < 248)
            & (chroma <= halo_chroma_max)
            & (s <= halo_rgb_sum_max)
        )
        _peel_neutral_rim_dark(arr)
    arr[halo, 3] = 0

    # Letter counters / icon center: neutral plate enclosed by colored logo strokes
    _clear_trapped_neutral_plate(
        arr,
        light_plate=light_plate,
        chroma_max=14.0 if not light_plate else 16.0,
        rgb_sum_max=62.0,
        rgb_sum_min=680.0,
    )

    arr = _trim_alpha_padding(arr, pad=6)

    Image.fromarray(arr, mode="RGBA").save(dst, format="PNG", optimize=True)
    aa = arr[..., 3]
    plate = "white" if light_plate else "black"
    print(
        f"saved {dst} ({plate} plate) | alpha mean={aa.mean():.1f} "
        f"opaque%={(aa > 250).mean() * 100:.1f} transparent%={(aa < 8).mean() * 100:.1f}"
    )


def strip_black_plate(src: Path, dst: Path, *, tol: float | None = 58.0) -> None:
    strip_plate(src, dst, tol=tol, force_light=False)


def main() -> int:
    if len(sys.argv) < 3:
        print(
            "usage: strip_logo_black_plate.py <input.png> <output.png> [tol]\n"
            "  tol = max Euclidean distance in RGB from corner plate color (default 58)"
        )
        return 2
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    tol = float(sys.argv[3]) if len(sys.argv) > 3 else None
    strip_plate(src, dst, tol=tol)
    return 0


if __name__ == "__main__":
    sys.exit(main())
