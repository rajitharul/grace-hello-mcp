"""Generate the GRACE Hello MCP icon(s) with zero dependencies (stdlib only).

Renders a badge: a vertical gradient background with a clean white ring mark in
the center, anti-aliased so it looks intentional.

Outputs two sizes:
  - static/icon.png      (512x512)  -> served over HTTPS, advertised to clients
  - static/icon-128.png  (128x128)  -> small, base64-embedded as a data: URI
                                        fallback inside the initialize response
"""
import os
import struct
import zlib

TOP = (15, 32, 39)      # #0F2027
BOTTOM = (44, 83, 100)  # #2C5364
RING = (43, 212, 196)   # #2BD4C4 teal
WHITE = (240, 248, 247)


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def smoothstep(edge0, edge1, x):
    if edge0 == edge1:
        return 0.0 if x < edge0 else 1.0
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def chunk(typ, data):
    return (
        struct.pack(">I", len(data))
        + typ
        + data
        + struct.pack(">I", zlib.crc32(typ + data) & 0xFFFFFFFF)
    )


def render(size):
    """Return PNG bytes for a square icon of the given pixel size."""
    cx = cy = size / 2.0
    ring_radius = size * 0.30
    ring_half_thickness = size * 0.075
    dot_radius = size * 0.085
    aa = size / 512.0 * 1.5  # anti-alias softness scaled to size

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # PNG filter type 0 for this scanline
        bg = lerp(TOP, BOTTOM, y / (size - 1))
        for x in range(size):
            dist = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
            r, g, b = bg

            ring_d = abs(dist - ring_radius)
            ring_a = 1.0 - smoothstep(ring_half_thickness - aa,
                                      ring_half_thickness + aa, ring_d)
            if ring_a > 0:
                r, g, b = lerp((r, g, b), RING, ring_a)

            dot_a = 1.0 - smoothstep(dot_radius - aa, dot_radius + aa, dist)
            if dot_a > 0:
                r, g, b = lerp((r, g, b), WHITE, dot_a)

            raw += bytes((r, g, b))

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    idat = zlib.compress(bytes(raw), 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


os.makedirs("static", exist_ok=True)
for size, path in [(512, "static/icon.png"), (128, "static/icon-128.png")]:
    png = render(size)
    with open(path, "wb") as f:
        f.write(png)
    print(f"Wrote {path} ({len(png)} bytes, {size}x{size})")
