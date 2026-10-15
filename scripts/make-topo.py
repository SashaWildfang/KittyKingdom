"""Seamless topographic contour tile (public/topo.svg) for the site background.
A smooth periodic field (sums of cosines with whole-number frequencies) → marching squares → joined, simplified lines."""
import math, random, sys

T = 720          # tile size in px
N = 180          # grid cells per side
LEVELS = 22
random.seed(11)
TERMS = [(a, b, random.uniform(0.35, 1.0) / math.hypot(a, b), random.uniform(0, 2 * math.pi))
         for a in range(-3, 4) for b in range(0, 4) if (a, b) != (0, 0) and not (b == 0 and a < 0)]

def f(i, j):
    x, y = i / N, j / N
    return sum(w * math.cos(2 * math.pi * (a * x + b * y) + p) for a, b, w, p in TERMS)

G = [[f(i, j) for j in range(N)] for i in range(N)]
lo = min(min(r) for r in G); hi = max(max(r) for r in G)
levels = [lo + (hi - lo) * (k + 0.5) / LEVELS for k in range(LEVELS)]

def v(i, j):
    return G[i % N][j % N]

def interp(p1, p2, a, b, lv):
    t = (lv - a) / (b - a) if b != a else 0.5
    return (p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t)

out = []
for li, lv in enumerate(levels):
    segs = []
    for i in range(N):
        for j in range(N):
            c = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            vals = [v(*p) for p in c]
            edges = []
            for k in range(4):
                a, b = vals[k], vals[(k + 1) % 4]
                if (a < lv) != (b < lv):
                    edges.append(interp(c[k], c[(k + 1) % 4], a, b, lv))
            if len(edges) == 2:
                segs.append((edges[0], edges[1]))
            elif len(edges) == 4:
                segs.append((edges[0], edges[1])); segs.append((edges[2], edges[3]))
    # join segments into polylines
    key = lambda p: (round(p[0], 4), round(p[1], 4))
    ends = {}
    for idx, (p, q) in enumerate(segs):
        ends.setdefault(key(p), []).append(idx); ends.setdefault(key(q), []).append(idx)
    used = [False] * len(segs)
    for s0 in range(len(segs)):
        if used[s0]: continue
        used[s0] = True
        line = [segs[s0][0], segs[s0][1]]
        for direction in (1, 0):
            while True:
                tip = line[-1] if direction else line[0]
                nxt = None
                for idx in ends.get(key(tip), []):
                    if not used[idx]:
                        nxt = idx; break
                if nxt is None: break
                used[nxt] = True
                p, q = segs[nxt]
                other = q if key(p) == key(tip) else p
                if direction: line.append(other)
                else: line.insert(0, other)
        out.append((li, line))

def rdp(pts, eps):
    if len(pts) < 3: return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0, 0
    for k in range(1, len(pts) - 1):
        d = abs(dy * pts[k][0] - dx * pts[k][1] + x2 * y1 - y2 * x1) / L
        if d > dmax: dmax, idx = d, k
    if dmax > eps:
        return rdp(pts[:idx + 1], eps)[:-1] + rdp(pts[idx:], eps)
    return [pts[0], pts[-1]]

s = T / N
paths = {"major": [], "minor": []}
for li, line in out:
    pts = rdp([(x * s, y * s) for x, y in line], 0.45)
    if len(pts) < 2: continue
    d = "M" + " ".join(f"{x:.1f} {y:.1f}" for x, y in pts)
    paths["major" if li % 4 == 1 else "minor"].append(d)

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" width="{T}" height="{T}" viewBox="0 0 {T} {T}" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round">'
       f'<path stroke-opacity=".5" stroke-width="1" d="{"".join(paths["minor"])}"/>'
       f'<path stroke-width="1.5" d="{"".join(paths["major"])}"/></svg>')
open(sys.argv[1], "w").write(svg)
print(f"{len(paths['minor'])} minor + {len(paths['major'])} major lines, {len(svg)//1024} KB")
