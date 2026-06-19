"""Generate static/icon.png with zero dependencies (stdlib only).

Draws a 512x512 badge: a vertical gradient background with a clean white ring
mark in the center. Anti-aliased edges so it looks intentional, not pixelated.
"""
import os
import struct
import zlib

W = H = 512


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def smoothstep(edge0, edge1, x):
    if edge0 == edge1:
        return 0.0 if x < edge0 else 1.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


TOP = (15, 32, 39)      # #0F2027
BOTTOM = (44, 83, 100)  # #2C5364
RING = (43, 212, 196)   # #2BD4C4 teal
WHITE = (240, 248, 247)

cx = cy = W / 2.0
ring_radius = W * 0.30
ring_half_thickness = W * 0.075
dot_radius = W * 0.085

raw = bytearray()
for y in range(H):
    raw.append(0)  # PNG filter type 0 for this scanline
    bg_t = y / (H - 1)
    bg = lerp(TOP, BOTTOM, bg_t)
    for x in range(W):
        dx = x - cx
        dy = y - cy
        dist = (dx * dx + dy * dy) ** 0.5

        r, g, b = bg

        # Outer ring (teal): band centered on ring_radius, soft 1.5px edges.
        ring_d = abs(dist - ring_radius)
        ring_a = 1.0 - smoothstep(ring_half_thickness - 1.5,
                                  ring_half_thickness + 1.5, ring_d)
        if ring_a > 0:
            r, g, b = lerp((r, g, b), RING, ring_a)

        # Center dot (white).
        dot_a = 1.0 - smoothstep(dot_radius - 1.5, dot_radius + 1.5, dist)
        if dot_a > 0:
            r, g, b = lerp((r, g, b), WHITE, dot_a)

        raw += bytes((r, g, b))


def chunk(typ, data):
    return (
        struct.pack(">I", len(data))
        + typ
        + data
        + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
    )


sig = b"\x89PNG\r\n\x1a\n"
ihdr = struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)  # 8-bit, RGB
idat = zlib.compress(bytes(raw), 9)
png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

os.makedirs("static", exist_ok=True)
with open("static/icon.png", "wb") as f:
    f.write(png)
print(f"Wrote static/icon.png ({len(png)} bytes, {W}x{H})")
