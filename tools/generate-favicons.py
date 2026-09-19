"""One-shot generator for the Janoon browser icons.

No third-party dependency: it rasterises the same "J" geometry and the same
warm palette as `public/logo.svg`, using signed-distance fields with analytic
anti-aliasing, then writes the PNG sizes and a multi-size .ico itself.

Run from the project root:  python3 tools/generate-favicons.py
"""

import math
import os
import struct
import zlib

W = 512.0
CX = CY = 256.0

# --- geometry, in the same 512-unit space as logo.svg -----------------------
STEM_A, STEM_B = (362.0, 114.0), (362.0, 292.0)
ARC_C, ARC_R = (256.0, 292.0), 106.0
TAIL_A, TAIL_B = (150.0, 292.0), (150.0, 228.0)
STROKE = 62.0
RADIUS = 112.0

BG_FROM, BG_TO = (0x2A, 0x20, 0x16), (0x12, 0x0E, 0x0A)
GOLD_0, GOLD_1, GOLD_2 = (0xF0, 0xCD, 0x72), (0xE3, 0xB3, 0x41), (0xC9, 0x82, 0x2F)


def clamp(v, lo=0.0, hi=1.0):
    return lo if v < lo else hi if v > hi else v


def lerp(a, b, t):
    return a + (b - a) * t


def lerp3(c0, c1, t):
    return tuple(lerp(c0[i], c1[i], t) for i in range(3))


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    length2 = vx * vx + vy * vy
    t = 0.0 if length2 == 0 else clamp(((px - ax) * vx + (py - ay) * vy) / length2)
    return math.hypot(px - (ax + t * vx), py - (ay + t * vy))


def sdf_round_rect(px, py, w, h, r):
    qx = abs(px - w / 2) - (w / 2 - r)
    qy = abs(py - h / 2) - (h / 2 - r)
    return math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - r


def bg_color(u, v):
    return lerp3(BG_FROM, BG_TO, clamp((u + v) / 2.0))


def gold_color(u, v):
    t = clamp(((u - 0.15) * 0.7 + v) / 1.49)
    if t < 0.5:
        return lerp3(GOLD_0, GOLD_1, t * 2)
    return lerp3(GOLD_1, GOLD_2, (t - 0.5) * 2)


def render(size, radius, jscale):
    """RGBA rows for one square icon, sampled one pixel at a time."""
    px = W / size

    def scale(point):
        return (CX + (point[0] - CX) * jscale, CY + (point[1] - CY) * jscale)

    stem_a, stem_b = scale(STEM_A), scale(STEM_B)
    tail_a, tail_b = scale(TAIL_A), scale(TAIL_B)
    arc_c = scale(ARC_C)
    arc_r = ARC_R * jscale
    half = STROKE * jscale / 2.0

    rows = []
    for row_index in range(size):
        y = (row_index + 0.5) * px
        row = bytearray()
        for col_index in range(size):
            x = (col_index + 0.5) * px

            tile_alpha = clamp(0.5 - sdf_round_rect(x, y, W, W, radius) / px)

            # Distance to the centreline of the stroked "J".
            d = min(
                seg_dist(x, y, *stem_a, *stem_b),
                seg_dist(x, y, *tail_a, *tail_b),
            )
            dx, dy = x - arc_c[0], y - arc_c[1]
            angle = math.atan2(dy, dx)
            if angle < 0:
                angle += 2 * math.pi
            if angle <= math.pi:  # the hook's lower half
                d = min(d, abs(math.hypot(dx, dy) - arc_r))
            else:
                d = min(
                    d,
                    math.hypot(x - stem_a[0], y - stem_a[1]),
                    math.hypot(x - tail_a[0], y - tail_a[1]),
                )
            j_alpha = clamp(0.5 - (d - half) / px)

            if j_alpha <= 0.0 and tile_alpha <= 0.0:
                row += b"\x00\x00\x00\x00"
                continue

            bg = bg_color(x / W, y / W)
            gold = gold_color(x / W, y / W)
            row += bytes(
                (
                    int(gold[0] * j_alpha + bg[0] * (1 - j_alpha) + 0.5),
                    int(gold[1] * j_alpha + bg[1] * (1 - j_alpha) + 0.5),
                    int(gold[2] * j_alpha + bg[2] * (1 - j_alpha) + 0.5),
                    int((j_alpha + tile_alpha * (1 - j_alpha)) * 255 + 0.5),
                )
            )
        rows.append(row)
    return encode_png(size, rows)


def encode_png(size, rows):
    raw = b"".join(b"\x00" + bytes(row) for row in rows)

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def encode_ico(items):
    header = struct.pack("<HHH", 0, 1, len(items))
    offset = 6 + 16 * len(items)
    entries, blobs = b"", b""
    for size, blob in items:
        dim = 0 if size >= 256 else size
        entries += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(blob), offset)
        offset += len(blob)
        blobs += blob
    return header + entries + blobs


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        handle.write(data)
    print("wrote %-30s %7d bytes" % (path, len(data)))


def main():
    # Rounded tile for the browser tab / legacy icon — the same treatment the
    # SVG gets, so the tab and the manifest agree.
    tile = lambda size: render(size, RADIUS, 1.0)
    # Full-bleed for iOS and the PWA: those platforms apply their own mask, so
    # the artwork sits inside the maskable safe zone instead of a rounded tile.
    bleed = lambda size: render(size, 0.0, 0.94)

    write("public/favicon-16x16.png", tile(16))
    write("public/favicon-32x32.png", tile(32))
    write("public/apple-touch-icon.png", bleed(180))
    write("public/icon-192.png", bleed(192))
    write("public/icon-512.png", bleed(512))
    write(
        "public/favicon.ico",
        encode_ico([(16, tile(16)), (32, tile(32)), (48, tile(48))]),
    )


if __name__ == "__main__":
    main()
