// Turns map data (campus or an interior) into tiles, collision, drawable
// objects and a pre-rendered ground layer.
window.LQ = window.LQ || {};

const T = LQ.T = {
  GRASS: 0, PATH: 1, BRICK: 2, ROAD: 3, ROAD_LINE_H: 4, ROAD_LINE_V: 5,
  WATER: 6, TREE: 7, RAVINE: 8, BRIDGE: 9, TURF: 10, FAIRWAY: 11, SAND: 12,
  FARM: 13, PARKING: 14, FLOWERS: 15, BUILDING: 16, DOOR: 17, STANDS: 18,
  DIRT: 19, FLOOR_WOOD: 20, FLOOR_TILE: 21, FLOOR_CARPET: 22, WALL: 23,
  FURN: 24, EXIT: 25, VOID: 26, FOOTBALL: 27, PILLAR: 28,
};

LQ.SOLID = new Set([T.WATER, T.TREE, T.RAVINE, T.BUILDING, T.STANDS, T.WALL, T.FURN, T.VOID, T.PILLAR]);

// ------------------------------------------------------------ map object
LQ.GameMap = class {
  constructor(id, w, h, fill) {
    this.id = id;
    this.w = w;
    this.h = h;
    this.tiles = new Uint8Array(w * h).fill(fill);
    this.solidOverride = new Map();   // idx -> bool (doors, furniture)
    this.objects = [];                // y-sorted static drawables
    this.doors = [];                  // {x, y, building, interior}
    this.signs = [];                  // {x, y, text}
    this.exits = [];                  // interior exits {x, y}
    this.treeRows = [];               // trees bucketed by row for culling
    this.ground = null;
  }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  get(x, y) { return this.inside(x, y) ? this.tiles[y * this.w + x] : T.VOID; }
  set(x, y, t) { if (this.inside(x, y)) this.tiles[y * this.w + x] = t; }
  fill(r, t, onlyIf) {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++)
        if (!onlyIf || onlyIf(this.get(x, y), x, y)) this.set(x, y, t);
  }
  isSolid(x, y) {
    if (!this.inside(x, y)) return true;
    const i = y * this.w + x;
    if (this.solidOverride.has(i)) return this.solidOverride.get(i);
    return LQ.SOLID.has(this.tiles[i]);
  }
  // Pixel-space box collision against the tile grid.
  boxBlocked(px, py, w, h) {
    const x0 = Math.floor(px / 16), x1 = Math.floor((px + w - 1) / 16);
    const y0 = Math.floor(py / 16), y1 = Math.floor((py + h - 1) / 16);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        if (this.isSolid(x, y)) return true;
    return false;
  }
  buildingAt() { return null; }
  // Nearest tile you can stand on (optionally not a road), searching outward.
  snapOpen(tx, ty, avoidRoad) {
    const ok = (x, y) => {
      if (this.isSolid(x, y) || this.isSolid(x, y - 1)) return false;
      const t = this.get(x, y);
      if (t === T.DOOR || t === T.EXIT || t === T.BRIDGE) return false;
      return !(avoidRoad && (t === T.ROAD || t === T.PARKING));
    };
    for (let r = 0; r < 20; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (Math.max(Math.abs(dx), Math.abs(dy)) === r && ok(tx + dx, ty + dy)) return [tx + dx, ty + dy];
    return [tx, ty];
  }
  // Ground is drawn in 32x32-tile chunks, rendered on demand and cached.
  chunk(cx, cy) {
    if (!this.chunks) this.chunks = new Map();
    const key = cx + ',' + cy;
    let c = this.chunks.get(key);
    if (c) { this.chunks.delete(key); this.chunks.set(key, c); return c; }
    c = document.createElement('canvas');
    c.width = c.height = 512;
    const ctx = c.getContext('2d');
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const tx = cx * 32 + x, ty = cy * 32 + y;
        if (this.inside(tx, ty)) LQ.drawTile(ctx, this.get(tx, ty), tx, ty, x * 16, y * 16, this);
      }
    this.chunks.set(key, c);
    if (this.chunks.size > 30) this.chunks.delete(this.chunks.keys().next().value);
    return c;
  }
  drawGround(ctx, camX, camY, vw, vh) {
    for (let cy = Math.floor(camY / 512); cy <= Math.floor((camY + vh - 1) / 512); cy++)
      for (let cx = Math.floor(camX / 512); cx <= Math.floor((camX + vw - 1) / 512); cx++)
        if (cx >= 0 && cy >= 0 && cx * 32 < this.w && cy * 32 < this.h) ctx.drawImage(this.chunk(cx, cy), cx * 512 - camX, cy * 512 - camY);
  }
};

// ------------------------------------------------------------ campus build
// Terrain char from the traced map -> tile type.
LQ.MAP_CHARS = {
  '.': T.GRASS, B: T.BUILDING, K: T.BUILDING, R: T.ROAD, W: T.PATH,
  p: T.PARKING, r: T.PARKING, b: T.PARKING, y: T.PARKING, g: T.PARKING, u: T.PARKING, o: T.PARKING, k: T.PARKING,
  F: T.TURF, Y: T.FOOTBALL, S: T.STANDS, H: T.PILLAR, '~': T.WATER, G: T.FAIRWAY, A: T.FARM, T: T.GRASS, V: T.RAVINE, '=': T.BRIDGE, t: T.GRASS, D: T.DIRT,
};
// Parking lot colors match the campus map's permit colors.
LQ.LOT_COLORS = { r: '#d84850', b: '#3878d0', y: '#e0b828', g: '#40b060', u: '#7050b0', o: '#e88030', k: '#282830' };

// Buildings are the connected groups of 'B' tiles in the map rows. Names
// come from CAMPUS_MAP.buildings: an entry names the group containing its
// `at` tile (several entries on one group are joined with " / ").
LQ.findBuildings = function (D) {
  const W = D.width, H = D.height;
  const seen = new Uint8Array(W * H);
  const isB = (x, y) => x >= 0 && y >= 0 && x < W && y < H && D.rows[y][x] === 'B';
  const named = new Map();   // "x,y" -> entry
  for (const e of D.buildings) named.set(e.at[0] + ',' + e.at[1], e);
  const out = [];
  for (let y0 = 0; y0 < H; y0++)
    for (let x0 = 0; x0 < W; x0++) {
      if (!isB(x0, y0) || seen[y0 * W + x0]) continue;
      const cells = new Set(), stack = [[x0, y0]];
      seen[y0 * W + x0] = 1;
      let minX = x0, maxX = x0, minY = y0, maxY = y0;
      const entries = [];
      while (stack.length) {
        const [x, y] = stack.pop();
        const key = x + ',' + y;
        cells.add(key);
        if (named.has(key)) entries.push(named.get(key));
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (isB(nx, ny) && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; stack.push([nx, ny]); }
        }
      }
      entries.sort((a, b) => D.buildings.indexOf(a) - D.buildings.indexOf(b));
      out.push({
        id: entries.length ? entries[0].id : 'b' + out.length,
        code: entries.map((e) => e.code).filter(Boolean).join('/'),
        style: entries.length ? entries[0].style : null,
        name: entries.length ? entries.map((e) => e.name).join(' / ') : 'Campus building',
        x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, cells,
      });
    }
  return out;
};

LQ.buildCampus = function () {
  const D = LQ.CAMPUS_MAP, C = LQ.CAMPUS;
  const m = new LQ.GameMap('campus', D.width, D.height, T.GRASS);
  m.name = 'GVSU Allendale';
  m.terrain = D.rows;
  m.lotColor = new Map();
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const ch = D.rows[y][x];
      m.tiles[y * m.w + x] = LQ.MAP_CHARS[ch] !== undefined ? LQ.MAP_CHARS[ch] : T.GRASS;
      if (LQ.LOT_COLORS[ch]) m.lotColor.set(y * m.w + x, LQ.LOT_COLORS[ch]);
    }

  // Buildings with their traced shapes.
  const walkable = (t) => !LQ.SOLID.has(t) && t !== T.DOOR;
  m.buildings = [];
  for (const src of LQ.findBuildings(D)) {
    const w = src.w, h = src.h;
    const has = (x, y) => src.cells.has((src.x + x) + ',' + (src.y + y));
    const interior = C.interiors[src.id] || null;
    const style = C.styles[src.id] || src.style || 'brick';
    // Door: a south-facing edge near the middle, preferring sidewalks.
    let door = null, best = 1e9;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!has(x, y) || has(x, y + 1)) continue;
        const below = m.get(src.x + x, src.y + y + 1);
        if (!walkable(below)) continue;
        const score = Math.abs(x + 0.5 - w / 2) + (h - 1 - y) * 1.5 - (below === T.PATH ? 3 : 0);
        if (score < best) { best = score; door = [src.x + x, src.y + y]; }
      }
    const b = { id: src.id, code: src.code, name: src.name, x: src.x, y: src.y, w, h, mask: src.mask, has, style, interior, door };
    m.buildings.push(b);
    if (door) {
      const [dx, dy] = door;
      m.set(dx, dy, T.DOOR);
      m.solidOverride.set(dy * m.w + dx, !interior);
      m.doors.push({ x: dx, y: dy, building: b, interior });
      for (let yy = dy + 1; yy < dy + 4; yy++) {
        const t = m.get(dx, yy);
        if (t !== T.GRASS && t !== T.FAIRWAY) break;
        m.set(dx, yy, T.PATH);
      }
    }
    // Draw in horizontal slices so characters in courtyards sort correctly.
    const sprite = LQ.renderBuilding(b);
    const R = LQ.BUILDING_RISE;
    // The sprite has a 1px outline border on every side.
    for (let k = 0; k * 16 < sprite.height; k++) {
      const sh = Math.min(16, sprite.height - k * 16);
      m.objects.push({
        kind: 'bslice', sprite, sy: k * 16, sh,
        x: b.x * 16 - 1, y: b.y * 16 - R - 1 + k * 16, w: sprite.width,
        sortY: (b.y + LQ.clamp(k, 0, h - 1) + 1) * 16,
      });
    }
  }
  m.buildingAt = function (x, y) {
    return this.buildings.find((b) => b.has(x - b.x, y - b.y));
  };

  // Cook Carillon Tower.
  const [cx0, cy0] = D.carillon;
  const ca = { name: 'Cook Carillon Tower', x: cx0, y: cy0, w: 2, h: 2 };
  m.fill(ca, T.BUILDING);
  m.carillon = ca;
  m.objects.push({ kind: 'carillon', sortY: (ca.y + ca.h) * 16, sprite: LQ.renderCarillon(), x: ca.x * 16, y: (ca.y + ca.h) * 16 });

  // The Transformational Link arch: you walk under it between its pillars.
  if (D.arch) {
    const [ax, ay] = D.arch;
    m.arch = { name: 'The Transformational Link', x: ax, y: ay };
    const sprite = LQ.renderArch();
    m.objects.push({ kind: 'carillon', sortY: (ay + 1) * 16, sprite, x: (ax - 1) * 16, y: (ay + 1) * 16 });
  }

  // Signs, snapped to the nearest open spot off the road.
  for (const sg of C.signs) {
    const [tx, ty] = m.snapOpen(...LQ.imgTile(sg.at[0], sg.at[1]), true);
    const s = { x: tx, y: ty, text: sg.text };
    m.solidOverride.set(ty * m.w + tx, true);
    m.signs.push(s);
    m.objects.push({ kind: 'sign', sortY: (ty + 1) * 16, x: tx * 16, y: ty * 16 + 6, sprite: LQ.signSprite || (LQ.signSprite = LQ.makeSignSprite()) });
  }
  const signAt = new Set(m.signs.map((s) => s.y * m.w + s.x));

  // Trees: thick in the woods and ravine edges, scattered on lawns.
  const DENSITY = { '.': 0.03, T: 0.55, t: 0.3, G: 0.012 };
  for (let y = 0; y < m.h; y++) {
    m.treeRows[y] = [];
    for (let x = 0; x < m.w; x++) {
      const ch = D.rows[y][x];
      const p = DENSITY[ch];
      const t = m.get(x, y);
      if (!p || (t !== T.GRASS && t !== T.FAIRWAY) || signAt.has(y * m.w + x)) continue;
      const crowded = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, -2], [1, 1], [-1, 1]].some(([dx, dy]) => {
        const n = m.get(x + dx, y + dy);
        return n !== T.GRASS && n !== T.TREE && n !== T.RAVINE && n !== T.WATER && n !== T.FAIRWAY && n !== T.FARM && n !== T.VOID;
      });
      if (crowded && ch !== 'T') continue;
      const besideWalk = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const n = m.get(x + dx, y + dy);
        return n === T.PATH || n === T.DIRT || n === T.BRIDGE || n === T.ROAD || n === T.PILLAR;
      });
      if (besideWalk) continue;
      if (LQ.hash(x, y, 3) < p && (x + y) % 2 === 0) {
        m.set(x, y, T.TREE);
        m.treeRows[y].push({ x, y, v: Math.floor(LQ.hash(x, y, 5) * 3) });
      } else if (ch === '.' && LQ.hash(x, y, 9) < 0.01) {
        m.set(x, y, T.FLOWERS);
      } else if (ch === 't' && LQ.hash(x, y, 9) < 0.12) {
        m.set(x, y, T.FLOWERS);
      }
    }
  }
  return m;
};

// ------------------------------------------------------------ interiors
LQ.buildInterior = function (def) {
  const m = new LQ.GameMap(def.id, def.w, def.h, T.WALL);
  m.name = def.name;
  m.def = def;
  const floor = def.floor === 'tile' ? T.FLOOR_TILE : def.floor === 'carpet' ? T.FLOOR_CARPET : T.FLOOR_WOOD;
  m.fill({ x: 1, y: 2, w: def.w - 2, h: def.h - 3 }, floor);
  const ex = Math.floor(def.w / 2) - 1;
  for (const x of [ex, ex + 1]) {
    m.set(x, def.h - 1, T.EXIT);
    m.exits.push({ x, y: def.h - 1 });
  }
  for (const f of def.furniture || []) {
    m.fill(f, T.FURN);
    m.objects.push({ kind: 'furn', f, sortY: (f.y + f.h) * 16, sprite: LQ.renderFurniture(f) });
  }
  return m;
};

// ------------------------------------------------------------ tile art
LQ.TILE_COLORS = {
  grass: ['#88d070', '#78c060', '#98d880'],
  path: '#d8d4c4',
  pathSeam: '#b8b4a8',
  brick: '#c87860',
  brickSeam: '#a05848',
  road: '#585862',
  roadSpeck: '#5a5a66',
  line: '#f0d050',
  water: '#4898e8',
  waterLight: '#88c8f8',
  ravine: '#3a7038',
  ravineDark: '#285028',
  bridge: '#a87850',
  bridgeDark: '#785030',
  turf: ['#50a848', '#5cb854'],
  fairway: ['#7cd068', '#88dc74'],
  sand: '#f0e0a0',
  farm: ['#a07848', '#886038'],
  parking: '#8a8a94',
  dirt: '#c8a070',
  stands: '#9898a8',
};

LQ.drawTile = function (cx, t, x, y, px, py, m) {
  const C = LQ.TILE_COLORS;
  const h = (s) => LQ.hash(x, y, s);
  const dots = (col, n, seed) => {
    cx.fillStyle = col;
    for (let i = 0; i < n; i++) cx.fillRect(px + Math.floor(LQ.hash(x * 7 + i, y, seed) * 15), py + Math.floor(LQ.hash(x, y * 7 + i, seed) * 15), 1, 1);
  };
  switch (t) {
    case T.GRASS: case T.TREE: case T.FLOWERS: {
      cx.fillStyle = C.grass[0];
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = C.grass[1];
      for (let i = 0; i < 4; i++) {
        const gx = px + Math.floor(LQ.hash(x * 5 + i, y, 1) * 14), gy = py + Math.floor(LQ.hash(x, y * 5 + i, 2) * 14);
        cx.fillRect(gx, gy, 1, 2);
        cx.fillRect(gx + 2, gy + 1, 1, 2);
      }
      dots(C.grass[2], 3, 4);
      if (t === T.FLOWERS) {
        const cols = ['#f87898', '#f8f070', '#f8f8f8', '#b088f8'];
        for (let i = 0; i < 4; i++) {
          cx.fillStyle = cols[Math.floor(h(20 + i) * 4)];
          const fx = px + 2 + Math.floor(h(30 + i) * 11), fy = py + 2 + Math.floor(h(40 + i) * 11);
          cx.fillRect(fx, fy, 2, 2);
        }
      }
      break;
    }
    case T.PATH: case T.DOOR: case T.PILLAR: {
      cx.fillStyle = C.path;
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = C.pathSeam;
      if (x % 2 === 0) cx.fillRect(px, py, 1, 16);
      if (y % 2 === 0) cx.fillRect(px, py, 16, 1);
      dots('#c8c4b8', 2, 6);
      // Darker curb edge against roads and lots.
      const hard = (dx, dy) => { const n = m.get(x + dx, y + dy); return n === T.ROAD || n === T.PARKING; };
      cx.fillStyle = '#9a968c';
      if (hard(0, -1)) cx.fillRect(px, py, 16, 2);
      if (hard(0, 1)) cx.fillRect(px, py + 14, 16, 2);
      if (hard(-1, 0)) cx.fillRect(px, py, 2, 16);
      if (hard(1, 0)) cx.fillRect(px + 14, py, 2, 16);
      break;
    }
    case T.BRICK: {
      cx.fillStyle = C.brick;
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = C.brickSeam;
      for (let r = 0; r < 4; r++) {
        cx.fillRect(px, py + r * 4, 16, 1);
        const off = (r + y) % 2 ? 0 : 4;
        cx.fillRect(px + off, py + r * 4, 1, 4);
        cx.fillRect(px + off + 8, py + r * 4, 1, 4);
      }
      break;
    }
    case T.ROAD: case T.ROAD_LINE_H: case T.ROAD_LINE_V: {
      cx.fillStyle = C.road;
      cx.fillRect(px, py, 16, 16);
      dots(C.roadSpeck, 6, 8);
      // Light curb where the road meets anything that isn't road or lot.
      if (m.id === 'campus') {
        const curb = (dx, dy) => { const n = m.get(x + dx, y + dy); return n !== T.ROAD && n !== T.PARKING && n !== T.BRIDGE && n !== T.VOID && n !== T.WATER; };
        cx.fillStyle = '#c8c8c8';
        if (curb(0, -1)) cx.fillRect(px, py, 16, 1);
        if (curb(0, 1)) cx.fillRect(px, py + 15, 16, 1);
        if (curb(-1, 0)) cx.fillRect(px, py, 1, 16);
        if (curb(1, 0)) cx.fillRect(px + 15, py, 1, 16);
      }
      cx.fillStyle = C.line;
      if (t === T.ROAD_LINE_H && x % 2 === 0) cx.fillRect(px + 2, py + 15, 12, 2);
      if (t === T.ROAD_LINE_V && y % 2 === 0) cx.fillRect(px + 15, py + 2, 2, 12);
      break;
    }
    case T.WATER: {
      cx.fillStyle = C.water;
      cx.fillRect(px, py, 16, 16);
      // Shore lip where water meets land.
      cx.fillStyle = '#f0e8c0';
      if (m.get(x, y - 1) !== T.WATER && m.get(x, y - 1) !== T.VOID) cx.fillRect(px, py, 16, 2);
      if (m.get(x - 1, y) !== T.WATER && m.get(x - 1, y) !== T.VOID) cx.fillRect(px, py, 2, 16);
      if (m.get(x + 1, y) !== T.WATER && m.get(x + 1, y) !== T.VOID) cx.fillRect(px + 14, py, 2, 16);
      cx.fillStyle = '#3070c0';
      if (m.get(x, y + 1) !== T.WATER && m.get(x, y + 1) !== T.VOID) cx.fillRect(px, py + 14, 16, 2);
      break;
    }
    case T.RAVINE: {
      cx.fillStyle = C.ravineDark;
      cx.fillRect(px, py, 16, 16);
      // Bumpy tree-top canopy seen from above.
      for (let i = 0; i < 3; i++) {
        cx.fillStyle = i % 2 ? C.ravine : '#4a8a44';
        const bx = px + Math.floor(h(50 + i) * 10), by = py + Math.floor(h(60 + i) * 10);
        cx.fillRect(bx, by + 1, 7, 5);
        cx.fillRect(bx + 1, by, 5, 7);
      }
      break;
    }
    case T.BRIDGE: {
      cx.fillStyle = C.bridge;
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = C.bridgeDark;
      for (let r = 0; r < 16; r += 4) cx.fillRect(px, py + r, 16, 1);
      // Railings with safety fencing.
      const left = m.get(x - 1, y) !== T.BRIDGE, right = m.get(x + 1, y) !== T.BRIDGE;
      cx.fillStyle = '#505060';
      if (left) { cx.fillRect(px, py, 3, 16); cx.fillStyle = '#9898a8'; cx.fillRect(px + 1, py, 1, 16); cx.fillStyle = '#505060'; }
      if (right) { cx.fillRect(px + 13, py, 3, 16); cx.fillStyle = '#9898a8'; cx.fillRect(px + 14, py, 1, 16); }
      break;
    }
    case T.TURF: {
      cx.fillStyle = C.turf[y % 2];
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = '#f8f8f8';
      if (y % 4 === 0) cx.fillRect(px, py, 16, 1);
      break;
    }
    case T.FAIRWAY: {
      cx.fillStyle = C.fairway[(x + y) % 2];
      cx.fillRect(px, py, 16, 16);
      break;
    }
    case T.SAND: {
      cx.fillStyle = C.sand;
      cx.fillRect(px, py, 16, 16);
      dots('#d8c888', 6, 12);
      break;
    }
    case T.FARM: {
      cx.fillStyle = C.farm[0];
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = C.farm[1];
      for (let r = 0; r < 16; r += 4) cx.fillRect(px, py + r, 16, 2);
      cx.fillStyle = '#7ab048';
      for (let i = 0; i < 16; i += 4) cx.fillRect(px + i + 1, py + 2 + (x % 2) * 4, 2, 2);
      break;
    }
    case T.PARKING: {
      // Lighter than roads, in rows of stalls with an aisle every third row.
      cx.fillStyle = C.parking;
      cx.fillRect(px, py, 16, 16);
      dots(C.roadSpeck, 3, 13);
      cx.fillStyle = '#e8e8e8';
      const row = y % 3;
      if (row === 0) { for (const lx of [0, 8]) cx.fillRect(px + lx, py + 4, 1, 12); }
      if (row === 1) { for (const lx of [0, 8]) cx.fillRect(px + lx, py, 1, 12); }
      // Curb in the lot's permit color where it meets grass or sidewalk
      // (openings onto roads stay open).
      const lot = m.lotColor && m.lotColor.get(y * m.w + x);
      cx.fillStyle = lot || '#b8b8c0';
      const edge = (dx, dy) => { const n = m.get(x + dx, y + dy); return n !== T.PARKING && n !== T.ROAD && n !== T.VOID; };
      if (edge(0, -1)) cx.fillRect(px, py, 16, 2);
      if (edge(0, 1)) cx.fillRect(px, py + 14, 16, 2);
      if (edge(-1, 0)) cx.fillRect(px, py, 2, 16);
      if (edge(1, 0)) cx.fillRect(px + 14, py, 2, 16);
      break;
    }
    case T.FOOTBALL: {
      // One tile is about ten yards: a yard line on every tile, end zones in
      // Laker blue, white sidelines.
      const inF = (dx, dy) => m.get(x + dx, y + dy) === T.FOOTBALL;
      const endZone = !inF(0, -1) || !inF(0, 1);
      cx.fillStyle = endZone ? '#2050b0' : (y % 2 ? '#3c9a44' : '#46a84e');
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = '#f8f8f8';
      if (!endZone) {
        cx.fillRect(px, py, 16, 1);
        for (const hx of [5, 10]) cx.fillRect(px + hx, py + 7, 1, 2);   // hash marks
      } else if (inF(0, 1)) cx.fillRect(px, py + 15, 16, 1);
      else cx.fillRect(px, py, 16, 1);
      if (!inF(-1, 0)) cx.fillRect(px, py, 2, 16);
      if (!inF(1, 0)) cx.fillRect(px + 14, py, 2, 16);
      break;
    }
    case T.DIRT: {
      cx.fillStyle = C.dirt;
      cx.fillRect(px, py, 16, 16);
      dots('#a88050', 5, 14);
      break;
    }
    case T.STANDS: {
      cx.fillStyle = C.stands;
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = '#707080';
      for (let r = 0; r < 16; r += 4) cx.fillRect(px, py + r, 16, 1);
      cx.fillStyle = '#0032a0';
      for (let r = 2; r < 16; r += 4) cx.fillRect(px + 2, py + r, 12, 1);
      break;
    }
    case T.FLOOR_WOOD: {
      cx.fillStyle = '#d8a868';
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = '#b88848';
      for (let r = 0; r < 16; r += 4) cx.fillRect(px, py + r, 16, 1);
      cx.fillRect(px + ((y * 5) % 16), py, 1, 16);
      break;
    }
    case T.FLOOR_TILE: {
      cx.fillStyle = (x + y) % 2 ? '#e8e8f0' : '#c8d0e0';
      cx.fillRect(px, py, 16, 16);
      break;
    }
    case T.FLOOR_CARPET: {
      cx.fillStyle = '#4868b0';
      cx.fillRect(px, py, 16, 16);
      dots('#5878c0', 10, 15);
      break;
    }
    case T.WALL: {
      const below = m.get(x, y + 1);
      const isFace = below !== T.WALL && below !== T.VOID && y < m.h - 1;
      cx.fillStyle = isFace ? '#f0e8d8' : '#504858';
      cx.fillRect(px, py, 16, 16);
      if (isFace) {
        cx.fillStyle = '#d8ccb8';
        cx.fillRect(px, py + 13, 16, 3);
        cx.fillStyle = '#0032a0';
        cx.fillRect(px, py + 4, 16, 2);
      }
      break;
    }
    case T.EXIT: {
      cx.fillStyle = '#a04040';
      cx.fillRect(px, py, 16, 16);
      cx.fillStyle = '#c86060';
      cx.fillRect(px + 2, py + 2, 12, 10);
      break;
    }
    case T.BUILDING: case T.FURN: {
      cx.fillStyle = m.id === 'campus' ? C.grass[0] : '#d8a868';
      cx.fillRect(px, py, 16, 16);
      break;
    }
    default:
      cx.fillStyle = '#000';
      cx.fillRect(px, py, 16, 16);
  }
};

// ------------------------------------------------------------ trees
LQ.treeSprites = null;
LQ.getTreeSprites = function () {
  if (LQ.treeSprites) return LQ.treeSprites;
  const greens = [['#2f7a3a', '#48a050', '#70c070'], ['#2a6a48', '#3e9060', '#68b880'], ['#4a7a2a', '#68a038', '#90c858']];
  LQ.treeSprites = greens.map(([d, m, l]) => LQ.makeSprite([
    '.....kkkkkk.....',
    '...kkmmmmmmkk...',
    '..kmmmllmmmmmk..',
    '.kmmllllmmmmmdk.',
    '.kmmlllmmmmmmdk.',
    'kmmmllmmmmmmmddk',
    'kmmmmmmmmmmmmddk',
    'kmmmmmmmmmmmdddk',
    'kdmmmmmmmmmmdddk',
    '.kdmmmmmmmmdddk.',
    '.kddmmmmmddddkk.',
    '..kkdddddddkk...',
    '....kkkbbkkk....',
    '......kbbk......',
    '......kbbk......',
    '.....kbbbbk.....',
    '......kkkk......',
  ], { k: '#183018', d, m, l, b: '#7a5030' }));
  return LQ.treeSprites;
};

// ------------------------------------------------------------ buildings
LQ.BUILDING_STYLES = {
  brick: { wall: '#b86048', wall2: '#a04c38', roof: '#707888', roof2: '#5a6070', win: '#a8d8f8', trim: '#e8dcc8' },
  stone: { wall: '#e0d0b0', wall2: '#c8b898', roof: '#9a5040', roof2: '#7a3c30', win: '#88c0e8', trim: '#f8f0e0' },
  glass: { wall: '#90c8f0', wall2: '#70a8d8', roof: '#d8d8e0', roof2: '#b8b8c8', win: '#c8e8ff', trim: '#f8f8f8', glassy: true },
  modern: { wall: '#d0d0d8', wall2: '#b0b0c0', roof: '#7a7a88', roof2: '#62626e', win: '#a8d8f8', trim: '#0032a0', band: true },
  house: { wall: '#f0d890', wall2: '#d8c070', roof: '#c05040', roof2: '#983828', win: '#a8d8f8', trim: '#f8f8f8', house: true },
  utility: { wall: '#a8a8b0', wall2: '#909098', roof: '#606068', roof2: '#4a4a52', win: '#7898b8', trim: '#c8c8d0' },
  shop: { wall: '#f0e0c0', wall2: '#d8c8a8', roof: '#606878', roof2: '#4a5060', win: '#a8d8f8', trim: '#e04848', awning: true },
};
LQ.BUILDING_RISE = 14;   // pixels the roof rises above the footprint (oblique view)

// Draws a building of any traced shape in Earthbound's oblique view. Each
// column of the footprint is split into a south-facing wall (its bottom one
// or two tiles) and a roof above it. The roof is shifted up by RISE pixels,
// so every column has a visible roof, even a building one tile deep.
LQ.renderBuilding = function (b) {
  const S = Object.assign({}, LQ.BUILDING_STYLES[b.style] || LQ.BUILDING_STYLES.brick);
  if (b.style === 'brick' || b.style === 'stone') {
    const roofs = [['#707888', '#5a6070'], ['#9a5040', '#7a3c30'], ['#5a8068', '#46644f'], ['#6a6a9a', '#54547c']];
    const r = roofs[Math.floor(LQ.hash(b.x, b.y, 8) * roofs.length)];
    S.roof = r[0];
    S.roof2 = r[1];
  }
  const R = LQ.BUILDING_RISE;
  const W = b.w * 16, H = b.h * 16 + R;
  const c = document.createElement('canvas');
  c.width = W + 2;
  c.height = H + 2;
  const cx = c.getContext('2d');
  cx.translate(1, 1);   // room for the outline
  const has = b.has;
  // Wall height is the same for the whole building so the facade lines up.
  const wallT = Math.min(b.w, b.h) >= 6 ? 2 : 1;
  const wallAt = new Set();   // "x,y" of wall tiles
  const runs = [];
  for (let x = 0; x < b.w; x++)
    for (let y = 0; y < b.h; y++) {
      if (!has(x, y) || has(x, y - 1)) continue;
      let y1 = y;
      while (has(x, y1 + 1)) y1++;
      const wt = Math.min(wallT, y1 - y + 1);
      for (let k = 0; k < wt; k++) wallAt.add(x + ',' + (y1 - k));
      runs.push({ x, y0: y, y1, wt });
    }
  const isWall = (x, y) => wallAt.has(x + ',' + y);

  // Canvas y of a footprint row's top edge is row*16 + R.
  for (const { x, y0, y1, wt } of runs) {
    const px = x * 16;
    // Roof: from R above the run's top down to where the wall starts.
    const roofTop = y0 * 16, roofBot = (y1 + 1 - wt) * 16 + R;
    cx.fillStyle = S.roof;
    cx.fillRect(px, roofTop, 16, roofBot - roofTop);
    cx.fillStyle = S.roof2;
    for (let yy = roofTop + 6; yy < roofBot - 4; yy += 8) cx.fillRect(px, yy, 16, 1);
    cx.fillRect(px, roofBot - 3, 16, 3);   // roof lip above the wall
    if (S.glassy && roofBot - roofTop >= 20) { cx.fillStyle = '#a8d8f8'; cx.fillRect(px + 3, roofTop + 4, 10, Math.min(10, roofBot - roofTop - 12)); }
    for (let ty = y0; ty <= y1 - wt; ty++) {
      if (LQ.hash(x + b.x, ty + b.y, 2) < 0.07 && has(x - 1, ty) && has(x + 1, ty) && has(x, ty - 1)) {
        const vy = ty * 16 + 3;
        cx.fillStyle = '#181820'; cx.fillRect(px + 3, vy, 10, 8);
        cx.fillStyle = '#c0c0c8'; cx.fillRect(px + 4, vy + 1, 8, 6);
      }
    }
    // Wall: the bottom wt tiles of the run.
    const wallTop = roofBot, wallBot = (y1 + 1) * 16 + R;
    cx.fillStyle = S.wall;
    cx.fillRect(px, wallTop, 16, wallBot - wallTop);
    if (b.style === 'brick') {
      cx.fillStyle = S.wall2;
      for (let yy = wallTop + 3; yy < wallBot - 1; yy += 3) for (let xx = px + ((yy / 3) | 0) % 2 * 3; xx < px + 16; xx += 6) cx.fillRect(xx, yy, Math.min(3, px + 16 - xx), 1);
    }
    cx.fillStyle = S.trim;
    cx.fillRect(px, wallTop, 16, 2);
    if (S.band) { cx.fillStyle = '#0032a0'; cx.fillRect(px, wallTop + 3, 16, 2); }
    if (S.awning) for (let xx = px; xx < px + 16; xx += 4) { cx.fillStyle = (xx / 4) % 2 ? '#f8f8f8' : '#e04848'; cx.fillRect(xx, wallTop + 2, 4, 4); }
    // Edges where a neighboring column's wall sits at a different height.
    cx.fillStyle = '#181820';
    for (let ty = y1 + 1 - wt; ty <= y1; ty++) {
      const yy = ty * 16 + R;
      if (!isWall(x - 1, ty)) cx.fillRect(px, yy, 1, 16);
      if (!isWall(x + 1, ty)) cx.fillRect(px + 15, yy, 1, 16);
    }
    // Roof beside a neighbor's wall: draw the seam between them.
    for (let ty = y0; ty <= y1 - wt; ty++) {
      if (isWall(x - 1, ty)) cx.fillRect(px, ty * 16 + R, 1, 16);
      if (isWall(x + 1, ty)) cx.fillRect(px + 15, ty * 16 + R, 1, 16);
    }
    // Windows and the door, one per wall tile.
    for (let ty = y1 + 1 - wt; ty <= y1; ty++) {
      const top = ty * 16 + R;
      const isDoor = b.door && b.door[0] === b.x + x && b.door[1] === b.y + ty;
      if (isDoor) {
        const dx = px + 2, dy = top + 16;
        cx.fillStyle = '#181820'; cx.fillRect(dx - 1, dy - 13, 14, 13);
        cx.fillStyle = b.interior ? '#5a3a28' : '#584848'; cx.fillRect(dx, dy - 12, 12, 12);
        cx.fillStyle = b.interior ? '#a8d8f8' : '#7a6a6a'; cx.fillRect(dx + 2, dy - 10, 8, 4);
        cx.fillStyle = '#f8d040'; cx.fillRect(dx + 9, dy - 5, 2, 2);
        continue;
      }
      const wy = top + 4;
      if (S.glassy) {
        cx.fillStyle = '#304860'; cx.fillRect(px + 1, wy - 1, 14, 10);
        cx.fillStyle = S.win; cx.fillRect(px + 2, wy, 12, 8);
        cx.fillStyle = '#f8ffff'; cx.fillRect(px + 3, wy + 1, 2, 3);
      } else {
        cx.fillStyle = '#283040'; cx.fillRect(px + 3, wy - 1, 10, 10);
        cx.fillStyle = S.win; cx.fillRect(px + 4, wy, 8, 8);
        cx.fillStyle = '#f8ffff'; cx.fillRect(px + 5, wy + 1, 2, 3);
        cx.fillStyle = '#283040'; cx.fillRect(px + 4, wy + 4, 8, 1);
      }
    }
  }

  // Black outline around the whole silhouette.
  const img = cx.getImageData(0, 0, c.width, c.height);
  const d = img.data, cw = c.width, chh = c.height;
  const solid = (x, y) => x >= 0 && y >= 0 && x < cw && y < chh && d[(y * cw + x) * 4 + 3] > 0;
  const edge = [];
  for (let y = 0; y < chh; y++)
    for (let x = 0; x < cw; x++)
      if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) edge.push(x, y);
  cx.setTransform(1, 0, 0, 1, 0, 0);
  cx.fillStyle = '#181820';
  for (let i = 0; i < edge.length; i += 2) cx.fillRect(edge[i], edge[i + 1], 1, 1);
  return c;
};

// The Transformational Link: a tall steel arch over the walkway, drawn
// 3 tiles wide with its pillars on the outer tiles.
LQ.renderArch = function () {
  const W = 48, H = 72;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const cx = c.getContext('2d');
  const k = '#181820', steel = '#b8c4d8', shine = '#f0f4ff', blue = '#0032a0';
  // Arc: a thick half-ellipse from pillar to pillar.
  for (let i = 0; i <= 64; i++) {
    const a = Math.PI * i / 64;
    const x = 24 - Math.cos(a) * 18, y = 46 - Math.sin(a) * 38;
    cx.fillStyle = k; cx.fillRect(Math.round(x) - 4, Math.round(y) - 4, 8, 8);
  }
  for (let i = 0; i <= 64; i++) {
    const a = Math.PI * i / 64;
    const x = 24 - Math.cos(a) * 18, y = 46 - Math.sin(a) * 38;
    cx.fillStyle = blue; cx.fillRect(Math.round(x) - 3, Math.round(y) - 3, 6, 6);
  }
  for (let i = 4; i <= 60; i++) {
    const a = Math.PI * i / 64;
    const x = 24 - Math.cos(a) * 18, y = 46 - Math.sin(a) * 38;
    cx.fillStyle = shine; cx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 1);
  }
  // Pillars.
  for (const px of [3, 35]) {
    cx.fillStyle = k; cx.fillRect(px - 1, 40, 12, 32);
    cx.fillStyle = steel; cx.fillRect(px, 41, 10, 30);
    cx.fillStyle = shine; cx.fillRect(px + 2, 42, 2, 28);
    cx.fillStyle = '#8890a8'; cx.fillRect(px, 66, 10, 5);
  }
  return c;
};

LQ.renderCarillon = function () {
  // Tall brick bell tower: belfry with bells, clock faces, copper cap.
  const W = 32, H = 112;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const cx = c.getContext('2d');
  const k = '#181820';
  // Cap
  cx.fillStyle = k;
  cx.fillRect(14, 0, 4, 2);
  for (let i = 0; i < 12; i++) cx.fillRect(14 - i, 2 + i, 4 + i * 2, 1);
  cx.fillStyle = '#58a890';
  for (let i = 1; i < 12; i++) cx.fillRect(15 - i, 2 + i, 2 + i * 2 - 2, 1);
  // Shaft
  cx.fillStyle = k;
  cx.fillRect(3, 14, 26, H - 14);
  cx.fillStyle = '#b86048';
  cx.fillRect(4, 15, 24, H - 16);
  cx.fillStyle = '#a04c38';
  for (let y = 18; y < H - 2; y += 3) for (let x = 4 + ((y / 3) % 2) * 3; x < 28; x += 6) cx.fillRect(x, y, 4, 1);
  // Belfry opening with bells
  cx.fillStyle = '#281818';
  cx.fillRect(7, 18, 18, 16);
  cx.fillStyle = '#d8a838';
  [[9, 22], [17, 22], [13, 27]].forEach(([x, y]) => { cx.fillRect(x + 1, y, 4, 2); cx.fillRect(x, y + 2, 6, 3); });
  // Clock
  cx.fillStyle = k;
  cx.fillRect(8, 40, 16, 16);
  cx.fillStyle = '#f8f0e0';
  cx.fillRect(9, 41, 14, 14);
  cx.fillStyle = k;
  cx.fillRect(15, 43, 2, 6);
  cx.fillRect(16, 47, 5, 2);
  // Stone trim bands
  cx.fillStyle = '#e8dcc8';
  [15, 36, 60, H - 6].forEach((y) => cx.fillRect(4, y, 24, 2));
  // Door at base
  cx.fillStyle = k;
  cx.fillRect(11, H - 20, 10, 20);
  cx.fillStyle = '#5a3a28';
  cx.fillRect(12, H - 19, 8, 19);
  return c;
};

// ------------------------------------------------------------ furniture
LQ.renderFurniture = function (f) {
  const W = f.w * 16, H = f.h * 16 + 8;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const cx = c.getContext('2d');
  const k = '#181820';
  const box = (top, front) => {
    cx.fillStyle = k;
    cx.fillRect(0, 0, W, H);
    cx.fillStyle = top;
    cx.fillRect(1, 1, W - 2, H - 12);
    cx.fillStyle = front;
    cx.fillRect(1, H - 11, W - 2, 10);
  };
  switch (f.type) {
    case 'shelf': {
      box('#8a5a38', '#6a4028');
      const books = ['#e04848', '#4878e0', '#48b860', '#f0c040', '#a060d0', '#f8f8f8'];
      for (let row = 0; row < f.h; row++)
        for (let x = 2; x < W - 3; x += 3) {
          cx.fillStyle = books[Math.floor(LQ.hash(x, row + f.x * 3 + f.y, 4) * books.length)];
          cx.fillRect(x, 3 + row * 16, 2, 9);
        }
      break;
    }
    case 'counter':
      box('#e8e0d0', '#0032a0');
      cx.fillStyle = '#f8f8f8';
      cx.fillRect(1, H - 8, W - 2, 1);
      break;
    case 'table':
      box('#c89060', '#a07040');
      cx.fillStyle = '#f8f8f8';
      cx.fillRect(4, 4, 6, 4);
      break;
    case 'bed':
      box('#f8f8f8', '#4868b0');
      cx.fillStyle = '#4878e0';
      cx.fillRect(1, 12, W - 2, H - 24);
      cx.fillStyle = '#f8f8f8';
      cx.fillRect(3, 3, W - 6, 7);
      break;
    case 'desk':
      box('#a8a8b8', '#787888');
      cx.fillStyle = '#283040';
      cx.fillRect(4, 3, 10, 7);
      cx.fillStyle = '#70e0a0';
      cx.fillRect(5, 4, 8, 5);
      break;
    case 'plant':
      cx.fillStyle = '#c86040';
      cx.fillRect(4, H - 10, 8, 10);
      cx.fillStyle = '#3a8a3a';
      cx.fillRect(2, H - 22, 12, 13);
      cx.fillStyle = '#58b058';
      cx.fillRect(4, H - 20, 4, 6);
      break;
    case 'machine':
      box('#d84848', '#a83030');
      cx.fillStyle = '#c8e8ff';
      cx.fillRect(3, 3, W - 6, H - 18);
      cx.fillStyle = '#f8d040';
      for (let i = 0; i < 3; i++) cx.fillRect(5 + i * 4, 6, 2, 2);
      break;
    case 'gym':
      box('#808090', '#505060');
      cx.fillStyle = '#181820';
      cx.fillRect(2, 6, W - 4, 2);
      cx.fillRect(2, 3, 3, 8);
      cx.fillRect(W - 5, 3, 3, 8);
      break;
    default:
      box('#c0c0c0', '#909090');
  }
  return c;
};
