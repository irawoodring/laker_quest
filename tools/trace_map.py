"""Trace GVSU's official Allendale campus map into Laker Quest's tile map.

Usage:
    python3 tools/trace_map.py <allendale_campus_map.jpg> [--preview out.png]

Reads the 560x732 campus map image (the one with the A-F / 1-9 grid),
classifies every pixel by its map color (building, road, sidewalk, parking
lot, field, water), downsamples to one tile per 2x2 image pixels, names
buildings from the map's labels, and writes src/campus_map.js.

Everything is in IMAGE PIXEL coordinates of that map, so you can check a
spot by hovering over the map image. Tile = ((x - 145) / 2, (y - 44) / 2).
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

MAP_BOX = (145, 46, 538, 612)       # x0, y0, x1, y1 of the drawn map
SCALE = 2                            # image pixels per tile
EAST_PAD = 18                        # extra tiles east: woods + Grand River

# Areas that are not part of the scaled map: the two inset boxes, the
# legend, the compass, and the "to ..." direction notes.
MASKS = [
    (152, 244, 219, 312),   # Meadows clubhouse inset
    (202, 538, 266, 602),   # Luce St inset
    (474, 500, 538, 612),   # legend
    (150, 80, 205, 130),    # compass
    (150, 70, 240, 80),     # "to downtown Allendale"
    (480, 70, 538, 80),     # "to Grand Rapids"
    (490, 130, 538, 160),   # "to Grand River & boathouse"
    (150, 312, 200, 322),   # "to 48th Ave"
    (330, 615, 400, 612),
]

# (id, code, name, image x, image y). The label point picks which traced
# building gets the name.
LABELS = [
    ('fc', 'FC', 'Hosford Football Center', 241, 128),
    ('mpf', 'MPF', 'Multi-Purpose Facility', 240, 114),
    ('rac', 'RAC', 'Ravine Center', 311, 151),
    ('ah', 'AH', 'Alumni House & Visitor Center', 347, 98),
    ('cub', 'CUB', 'Central Utilities Building', 419, 93),
    ('ser', 'SER', 'Service Building / Public Safety', 386, 106),
    ('wlc', 'WLC', 'Weed Living Center', 431, 132),
    ('hlc', 'HLC', 'Hoobler Living Center', 463, 129),
    ('flc', 'FLC', 'Frey Living Center', 476, 140),
    ('dlc', 'DLC', 'DeVos Living Center', 495, 141),
    ('olc', 'OLC', 'Ott Living Center', 430, 149),
    ('klc', 'KLC', 'Kleiner Commons', 452, 159),
    ('nlc', 'NLC', 'North C Living Center', 469, 158),
    ('plc', 'PLC', 'Pew Living Center', 498, 164),
    ('jlc', 'JLC', 'Johnson Living Center', 432, 170),
    ('hll', 'HLL', 'Hills Living Center', 482, 172),
    ('krp', 'KRP', 'Kirkpatrick Living Center', 504, 179),
    ('sta', 'STA', 'Stafford Living Center', 529, 175),
    ('kis', 'KIS', 'Kistler Living Center', 459, 186),
    ('pkc', 'PKC', 'Pickard Living Center', 480, 196),
    ('slc', 'SLC', 'Seidman Living Center', 502, 197),
    ('swn', 'SWN', 'Swanson Living Center', 529, 200),
    ('cop', 'COP', 'Copeland Living Center', 443, 196),
    ('rob', 'ROB', 'Robinson Living Center', 451, 218),
    ('mak', 'MAK', 'Mackinac Hall', 417, 236),
    ('man', 'MAN', 'Manitou Hall', 411, 247),
    ('hhlc', 'HHLC', 'Holton-Hooker Living Center', 461, 247),
    ('mplc', 'MPLC', 'Maple Living Center', 488, 253),
    ('com', 'COM', 'Commons', 422, 263),
    ('pnlc', 'PNLC', 'Pine Living Center', 448, 269),
    ('oklc', 'OKLC', 'Oak Living Center', 466, 268),
    ('ktb', 'KTB', 'Kelly Family Sports Center', 283, 217),
    ('fh', 'FH', 'Fieldhouse', 351, 224),
    ('fha', 'FHA', 'Fieldhouse Arena', 356, 202),
    ('pool', 'POOL', 'Fieldhouse Natatorium', 372, 231),
    ('rc', 'RC', 'Recreation Center', 336, 245),
    ('khs', 'KHS', 'Kindschi Hall of Science', 363, 261),
    ('lmp', 'LMP', 'Marketplace', 351, 276),
    ('pad', 'PAD', 'Padnos Hall of Science', 404, 278),
    ('ltt', 'LTT', 'Loutit Lecture Hall', 389, 283),
    ('hry', 'HRY', 'Henry Hall', 386, 293),
    ('stu', 'STU', 'Lubbers Student Services Center', 369, 309),
    ('cdc', 'CDC', 'Cook-DeWitt Center', 392, 328),
    ('lib', 'LIB', 'Mary Idema Pew Library', 349, 348),
    ('kc', 'KC', 'Kirkhof Center', 375, 352),
    ('jhz', 'JHZ', 'Zumberge Hall', 416, 352),
    ('ash', 'ASH', 'Au Sable Hall', 450, 341),
    ('lhh', 'LHH', 'Lake Huron Hall', 455, 360),
    ('sh', 'SH', 'Seidman House', 445, 374),
    ('lsh', 'LSH', 'Lake Superior Hall', 422, 377),
    ('pac', 'PAC', 'Haas Center for Performing Arts', 394, 379),
    ('lat', 'LAT', 'Louis Armstrong Theatre', 389, 395),
    ('lmh', 'LMH', 'Lake Michigan Hall', 432, 397),
    ('loh', 'LOH', 'Lake Ontario Hall', 456, 397),
    ('cr', 'CR', 'Calder Residence', 510, 381),
    ('cac', 'CAC', 'Calder Art Center', 516, 400),
    ('cc', 'CC', "Children's Enrichment Center", 261, 350),
    ('mmb', 'MMB', 'Meadows Maintenance Building', 236, 352),
    ('nhh', 'NHH', 'Niemeyer Learning & Living Center', 440, 434),
    ('mur', 'MUR', 'Murray Living Center', 457, 446),
    ('sub', 'SUB', 'South Utilities Building', 482, 437),
    ('con', 'CON', 'Blue Connection', 381, 447),
    ('vlc', 'VLC', 'VanSteeland Living Center', 411, 484),
    ('sac', 'SAC', 'South Apartment C', 381, 556),
    ('sad', 'SAD', 'South Apartment D', 399, 571),
    ('uhc', 'UHC', 'Campus Health Center', 340, 520),
    ('ags', 'AGS', 'Art Gallery Support Building', 340, 529),
]

# Unlabeled clusters of small buildings, named by area.
CLUSTERS = [
    ('lva', 'Laker Village Apartments', (255, 418, 352, 512)),
    ('gva', 'Grand Valley Apartments', (418, 532, 472, 592)),
    ('sae', 'South Apartments', (365, 515, 410, 590)),
]

# Cook Carillon Tower: a tiny square on the map, placed as a special object.
CARILLON = (377, 332)

# Real standing water on the map. Light blue elsewhere is the anti-aliased
# edge of blue (faculty/staff) lots or bus-stop icons, not water.
WATER_KEEP = [
    (388, 334, 418, 364),   # Zumberge Pond
]

# The ravine creek (blue line) and the Little Mac Bridge across it.
CREEK = [(560, 240), (545, 244), (529, 246), (519, 252), (513, 263), (511, 269), (491, 270),
         (483, 273), (470, 277), (460, 280), (452, 283), (443, 286), (432, 290), (422, 296), (415, 305)]
BRIDGE = [(419, 284), (431, 306)]
BOATHOUSE_TRAIL = (520, 112)        # trail east to the river starts here

# Region hints for terrain that the map leaves white.
GOLF = (145, 95, 228, 330)           # The Meadows golf course
FARM_SOUTH_Y = 516                   # south of Pierce St: farmland
WOODS_EAST_X = 522                   # east edge: wooded ravines toward the river

HEADER = """// GENERATED by tools/trace_map.py from GVSU's Allendale campus map, then
// safe to edit by hand: change a character in `rows` to change that tile.
//
// Tile legend:
//   .  grass                  B  building (shapes come from connected B tiles)
//   R  road                   W  sidewalk             D  dirt trail
//   r b y g u o k  parking lots, by permit color (red, blue, yellow, green,
//                  purple, orange, black)
//   F  field / turf           ~  water                =  bridge
//   G  golf course            A  farmland             K  Cook Carillon Tower
//   T  woods (dense trees)    t  arboretum (trees)    V  ravine (impassable)
//
// Rerunning the tracer overwrites hand edits, so keep a copy of anything you
// change, or make the change in the tracer instead.
"""

CLASSES = ['white', 'bldg', 'road', 'walk', 'red', 'blue', 'yellow', 'green',
           'purple', 'orange', 'field', 'water', 'black']
C = {name: i for i, name in enumerate(CLASSES)}

TILE_CHAR = {'white': '.', 'bldg': 'B', 'road': 'R', 'walk': 'W', 'red': 'r', 'blue': 'b',
             'yellow': 'y', 'green': 'g', 'purple': 'u', 'orange': 'o', 'field': 'F', 'water': '~', 'black': 'k'}


def classify(arr):
    r, g, b = (arr[..., i].astype(int) for i in range(3))
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    sat = mx - mn
    out = np.full(r.shape, C['white'], dtype=np.uint8)
    rules = [
        ('walk', (sat < 25) & (mx > 212) & (mx <= 236)),
        ('road', (sat < 18) & (mx >= 160) & (mx <= 212)),
        ('field', (g > r + 5) & (g > b + 18) & (mx > 150)),
        ('water', (b > r + 25) & (b > 200) & (g > 180)),
        ('orange', (r > 210) & (g > 80) & (g < 170) & (b < 80)),
        ('purple', (b > 110) & (g < 80) & (r < 140)),
        ('green', (g > 130) & (r < 140) & (b < 130) & (g - r > 40)),
        ('yellow', (r > 190) & (g > 150) & (b < 90)),
        ('blue', (b > 150) & (r < 90) & (g < 190)),
        ('red', (r > 170) & (g < 120) & (b < 130)),
        ('bldg', (mx < 125) & (sat < 60)),
        ('black', mx < 42),          # the black ADA-only lot by Kirkhof
    ]
    for name, mask in rules:   # later rules win
        out[mask] = C[name]
    return out


def main():
    src = sys.argv[1]
    preview = sys.argv[sys.argv.index('--preview') + 1] if '--preview' in sys.argv else None
    im = np.array(Image.open(src).convert('RGB'))
    x0, y0, x1, y1 = MAP_BOX
    px = classify(im[y0:y1, x0:x1])
    for a, b, c2, d in MASKS:
        px[max(0, b - y0):max(0, d - y0), max(0, a - x0):max(0, c2 - x0)] = C['white']

    # Fill holes left by label text inside buildings and lots. Lots can be
    # closed a little (they never touch each other); buildings only get
    # enclosed holes filled so neighboring buildings stay separate.
    for name in ['bldg', 'red', 'blue', 'yellow', 'green', 'purple', 'orange', 'field', 'black']:
        m = px == C[name]
        if name != 'bldg':
            m = ndimage.binary_closing(m, structure=np.ones((3, 3)), iterations=1)
        filled = ndimage.binary_fill_holes(m)
        px[filled & ((px == C['white']) | (px == C['walk']) | (px == C['road']))] = C[name]

    # Downsample: 2x2 pixels per tile.
    H, W = px.shape[0] // SCALE, px.shape[1] // SCALE
    counts = np.zeros((len(CLASSES), H, W), dtype=np.int16)
    for i in range(len(CLASSES)):
        m = (px[:H * SCALE, :W * SCALE] == i).astype(np.int16)
        counts[i] = m.reshape(H, SCALE, W, SCALE).sum(axis=(1, 3))
    tiles = np.full((H, W), C['white'], dtype=np.uint8)
    for name, need in [('walk', 1), ('field', 2), ('red', 2), ('blue', 2), ('yellow', 2), ('green', 2),
                       ('purple', 2), ('orange', 2), ('road', 2), ('water', 2), ('bldg', 2), ('black', 3)]:
        tiles[counts[C[name]] >= need] = C[name]

    # Keep only water inside the known water areas.
    lab, n = ndimage.label(tiles == C['water'])
    for i, (ys, xs) in enumerate(ndimage.find_objects(lab), start=1):
        cx = x0 + (xs.start + xs.stop) / 2 * SCALE
        cy = y0 + (ys.start + ys.stop) / 2 * SCALE
        if not any(a <= cx < c2 and b <= cy < d for a, b, c2, d in WATER_KEEP):
            tiles[lab == i] = C['white']

    # Remove specks: tiny building blobs (label text) and tiny road blobs.
    def tile_of(x, y):
        return int((x - x0) // SCALE), int((y - y0) // SCALE)

    keep_pts = [tile_of(x, y) for _, _, _, x, y in LABELS]
    for name, min_size in [('bldg', 5), ('road', 8), ('water', 3), ('black', 12)]:
        lab, n = ndimage.label(tiles == C[name])
        sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        keep = {lab[ty, tx] for tx, ty in keep_pts if 0 <= ty < H and 0 <= tx < W}
        for i, s in enumerate(sizes, start=1):
            if s < min_size and i not in keep:
                tiles[lab == i] = C['white']

    # Thin walks next to roads are road edges, not sidewalks; keep only walks
    # with some length.
    lab, n = ndimage.label(tiles == C['walk'])
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    for i, s in enumerate(sizes, start=1):
        if s < 4:
            tiles[lab == i] = C['white']

    # Tidy building outlines so they draw cleanly: fill one-tile notches and
    # trim one-tile spurs left by anti-aliased map edges.
    B = C['bldg']
    for _ in range(2):
        bm = tiles == B
        p = np.pad(bm, 1)
        n4 = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        fill = ~bm & (n4 >= 3) & ((tiles == C['white']) | (tiles == C['walk']))
        tiles[fill] = B
        bm = tiles == B
        p = np.pad(bm, 1)
        n4 = p[:-2, 1:-1].astype(int) + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]
        lab, _n = ndimage.label(bm)
        big = ndimage.sum(bm, lab, lab) > 6
        tiles[bm & (n4 <= 1) & big] = C['white']

    grid = [[TILE_CHAR[CLASSES[v]] for v in row] for row in tiles]

    def tset(tx, ty, ch, only=None):
        if 0 <= ty < H and 0 <= tx < W and (only is None or grid[ty][tx] in only):
            grid[ty][tx] = ch

    # Terrain the map leaves white.
    gx0, gy0 = tile_of(GOLF[0], GOLF[1])
    gx1, gy1 = tile_of(GOLF[2], GOLF[3])
    for ty in range(gy0, gy1):
        for tx in range(gx0, gx1):
            tset(tx, ty, 'G', '.')
    fy = tile_of(0, FARM_SOUTH_Y)[1]
    sx = tile_of(372, 0)[0]
    for ty in range(fy, H):
        for tx in range(0, sx):
            tset(tx, ty, 'A', '.')
    wx = tile_of(WOODS_EAST_X, 0)[0]
    for ty in range(tile_of(0, 120)[1], H):
        for tx in range(wx, W):
            tset(tx, ty, 'T', '.')

    # Ravine: woods along the creek; the creek itself is water.
    def line_tiles(a, b):
        (ax, ay), (bx, by) = tile_of(*a), tile_of(*b)
        n = max(abs(bx - ax), abs(by - ay), 1)
        return [(round(ax + (bx - ax) * i / n), round(ay + (by - ay) * i / n)) for i in range(n + 1)]

    creek = []
    for a, b in zip(CREEK, CREEK[1:]):
        creek += line_tiles(a, b)
    for tx, ty in creek:
        for dy in range(-5, 6):
            for dx in range(-5, 6):
                if dx * dx + dy * dy <= 22:
                    tset(tx + dx, ty + dy, 'V', '.TFWG')
    for tx, ty in creek:
        tset(tx, ty, '~')
        tset(tx, ty + 1, '~')
    for tx, ty in line_tiles(*BRIDGE):
        for dx in (0, 1):
            tset(tx + dx, ty, '=')
    # Arboretum (light green on the map) is a garden of trees, not a field.
    ax0, ay0 = tile_of(416, 292)
    ax1, ay1 = tile_of(482, 334)
    for ty in range(ay0, ay1):
        for tx in range(ax0, ax1):
            tset(tx, ty, 't', 'F')

    # Pad east: woods, then the Grand River.
    for row in grid:
        row += ['T'] * (EAST_PAD - 7) + ['~'] * 6 + ['T']
    W2 = W + EAST_PAD
    # Trail from the end of East Ravine Center Dr ("to Grand River & Grand
    # Valley Boathouse" on the map) through the woods to the riverbank.
    tx0, ty0 = tile_of(*BOATHOUSE_TRAIL)
    while tx0 > 0 and grid[ty0][tx0 - 1] not in 'RWy':
        tx0 -= 1
    for tx in range(tx0, W2 - 7):
        for ty in (ty0, ty0 + 1):
            if grid[ty][tx] in '.TV':
                grid[ty][tx] = 'D'
    # Lake Michigan Dr crosses the river on a bridge.
    for ty in range(H):
        if grid[ty][W - 1] == 'R':
            for tx in range(W, W2):
                grid[ty][tx] = 'R'

    # The carillon is drawn as its own object; clear stray building specks
    # from the map's tiny square and leave a plaza around the tower.
    ccx, ccy = tile_of(*CARILLON)
    for ty in range(ccy - 3, ccy + 3):
        for tx in range(ccx - 3, ccx + 3):
            if grid[ty][tx] == 'B':
                grid[ty][tx] = 'W'

    # Buildings: connected components, named by label or cluster.
    bmask = np.array([[c == 'B' for c in row] for row in grid])
    lab, n = ndimage.label(bmask)
    buildings = []
    named = {}
    sizes = ndimage.sum(np.ones_like(lab), lab, range(n + 1))
    small_ok = {'CON', 'UHC', 'CC'}
    for bid, code, name, x, y in LABELS:
        tx, ty = tile_of(x, y)
        # Labels sit on or beside their building. Snap to the nearest
        # component that is big enough to be a building (label text leaves
        # small specks behind).
        min_size = 3 if code in small_ok else 8
        best, best_d = 0, 1e9
        for r in range(0, 9):
            y_lo, x_lo = max(0, ty - r), max(0, tx - r)
            win = lab[y_lo:ty + r + 1, x_lo:tx + r + 1]
            for yy, xx in zip(*np.nonzero(win)):
                comp = win[yy, xx]
                if sizes[comp] < min_size:
                    continue
                d = (yy + y_lo - ty) ** 2 + (xx + x_lo - tx) ** 2
                if d < best_d:
                    best, best_d = int(comp), d
            if best:
                break
        if best and best not in named:
            named[best] = (bid, code, name)
        elif best:
            # Several labels on one connected complex: keep the first id,
            # list every name.
            pb, pc, pn = named[best]
            named[best] = (pb, pc + '/' + code, pn + ' / ' + name)
    objs = ndimage.find_objects(lab)
    cluster_count = {}
    n_buildings = 0
    for i, sl in enumerate(objs, start=1):
        ys, xs = sl
        if ys.start <= ccy < ys.stop and xs.start <= ccx < xs.stop and (ys.stop - ys.start) <= 4:
            continue   # the carillon square; handled separately
        if i in named:
            bid, code, name = named[i]
        else:
            cx = (xs.start + xs.stop) / 2 * SCALE + x0
            cy = (ys.start + ys.stop) / 2 * SCALE + y0
            bid, code, name = None, '', 'Campus building'
            for cid, cname, (a, b, c2, d) in CLUSTERS:
                if a <= cx < c2 and b <= cy < d:
                    cluster_count[cid] = cluster_count.get(cid, 0) + 1
                    bid, name = '%s%d' % (cid, cluster_count[cid]), cname
            if bid is None:
                bid = 'b%d' % i
        n_buildings += 1
        if bid.startswith('b') and not code:
            continue   # unnamed building: the game finds it from the 'B' tiles
        # Any tile inside the building identifies it.
        ys_in, xs_in = np.nonzero(lab[sl] == i)
        at = [int(xs.start + xs_in[0]), int(ys.start + ys_in[0])]
        buildings.append({'id': bid, 'code': code, 'name': name, 'at': at})
    for ty in range(ccy - 1, ccy + 1):
        for tx in range(ccx - 1, ccx + 1):
            grid[ty][tx] = 'K'

    dst = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'campus_map.js')
    rows = [''.join(r) for r in grid]
    with open(dst, 'w') as f:
        f.write(HEADER)
        f.write('window.LQ = window.LQ || {};\n\n')
        f.write('LQ.CAMPUS_MAP = {\n')
        f.write('  width: %d,\n  height: %d,\n' % (W2, H))
        f.write('  // Map image pixels per tile, and the image pixel at tile (0, 0).\n')
        f.write('  scale: %d,\n  origin: [%d, %d],\n' % (SCALE, x0, y0))
        f.write('  // Top-left tile of the 2x2 Cook Carillon Tower.\n')
        f.write('  carillon: [%d, %d],\n\n' % (ccx - 1, ccy - 1))
        f.write('  // One string per row of tiles, north to south. Row numbers are in the comments.\n')
        f.write('  rows: [\n')
        for ty, row in enumerate(rows):
            f.write("    '%s', // %d\n" % (row, ty))
        f.write('  ],\n\n')
        f.write('  // Building names. `at` is any tile inside the building (x, y). Buildings\n')
        f.write('  // not listed here are still built from their B tiles, just unnamed.\n')
        f.write('  buildings: [\n')
        for b in buildings:
            f.write('    { id: %s, code: %s, name: %s, at: [%d, %d] },\n' % (
                json.dumps(b['id']), json.dumps(b['code']), json.dumps(b['name']), b['at'][0], b['at'][1]))
        f.write('  ],\n};\n')
    print('wrote', dst, W2, 'x', H, 'tiles,', n_buildings, 'buildings,', len(buildings), 'named')
    have = {c for b in buildings for c in b['code'].split('/')}
    missing = [code for _, code, _, _, _ in LABELS if code not in have]
    if missing:
        print('labels with no building:', missing)

    if preview:
        pal = {'.': (120, 192, 96), 'B': (40, 50, 70), 'R': (90, 90, 100), 'W': (225, 220, 200),
               'r': (220, 60, 60), 'b': (40, 120, 210), 'y': (230, 190, 30), 'g': (40, 170, 70),
               'u': (100, 50, 150), 'o': (240, 130, 40), 'F': (60, 160, 60), '~': (70, 150, 230),
               'k': (20, 20, 20), 'D': (200, 160, 112), 'G': (150, 215, 130), 'A': (160, 120, 72), 'T': (30, 90, 40), 'V': (40, 80, 40),
               '=': (180, 140, 90), 't': (80, 140, 70), 'K': (250, 210, 60)}
        img = Image.new('RGB', (W2, H))
        for ty, row in enumerate(grid):
            for tx, ch in enumerate(row):
                img.putpixel((tx, ty), pal.get(ch, (255, 0, 255)))
        img.resize((W2 * 3, H * 3), Image.NEAREST).save(preview)


if __name__ == '__main__':
    main()
