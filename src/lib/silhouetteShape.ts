import * as THREE from "three";

export type SilhouetteResult = {
  shape: THREE.Shape;
  /** world-space Y of the artwork center inside the shape */
  centerY: number;
  /** total height of the shape (from y = 0 upwards) */
  boardH: number;
  boardW: number;
};

type Src = HTMLImageElement | HTMLCanvasElement | ImageBitmap;

function getSize(img: Src) {
  return { w: (img as HTMLImageElement).width, h: (img as HTMLImageElement).height };
}

/** Chamfer distance transform (approx euclidean) over the "outside" region. */
function distanceTransform(mask: Uint8Array, w: number, h: number) {
  const INF = 1e9;
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : INF;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? INF : d[y * w + x]!);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let v = d[i]!;
      v = Math.min(v, at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + 1.414, at(x + 1, y - 1) + 1.414);
      d[i] = v;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      let v = d[i]!;
      v = Math.min(v, at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + 1.414, at(x - 1, y + 1) + 1.414);
      d[i] = v;
    }
  }
  return d;
}

/** Moore-neighbour contour tracing of the largest blob. */
function traceContour(mask: Uint8Array, w: number, h: number): [number, number][] | null {
  let start = -1;
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const sx = start % w;
  const sy = (start / w) | 0;
  const dirs = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ] as const;
  const solid = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;

  const pts: [number, number][] = [];
  let cx = sx;
  let cy = sy;
  let dir = 6; // came from "up"
  const maxSteps = w * h * 4;
  for (let step = 0; step < maxSteps; step++) {
    pts.push([cx, cy]);
    let found = false;
    for (let k = 0; k < 8; k++) {
      const nd = (dir + 6 + k) % 8;
      const dx = dirs[nd]![0];
      const dy = dirs[nd]![1];
      const nx = cx + dx;
      const ny = cy + dy;
      if (solid(nx, ny)) {
        cx = nx;
        cy = ny;
        dir = nd;
        found = true;
        break;
      }
    }
    if (!found) break;
    if (cx === sx && cy === sy && pts.length > 8) break;
  }
  return pts.length > 12 ? pts : null;
}

/** Ramer–Douglas–Peucker simplification. */
function simplify(points: [number, number][], eps: number): [number, number][] {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = points[a]!;
    const [bx, by] = points[b]!;
    let maxD = -1;
    let idx = -1;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i]!;
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Build an acrylic-stand outline that follows the cut-out silhouette,
 * expanded outwards by `margin` (world units).
 */
export function buildSilhouetteShape(
  img: Src,
  worldWidth: number,
  worldHeight: number,
  margin: number,
): SilhouetteResult | null {
  if (typeof document === "undefined") return null;
  const { w: iw, h: ih } = getSize(img);
  if (!iw || !ih) return null;

  // work at a modest resolution for speed
  const maxDim = 220;
  const scale = Math.min(1, maxDim / Math.max(iw, ih));
  const mw = Math.max(8, Math.round(iw * scale));
  const mh = Math.max(8, Math.round(ih * scale));
  const pxPerWorld = mw / worldWidth;
  const pad = Math.max(2, Math.ceil(margin * pxPerWorld) + 2);
  const cw = mw + pad * 2;
  const ch = mh + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img as CanvasImageSource, pad, pad, mw, mh);
  const data = ctx.getImageData(0, 0, cw, ch).data;

  const base = new Uint8Array(cw * ch);
  let any = false;
  for (let i = 0; i < base.length; i++) {
    if (data[i * 4 + 3]! > 24) {
      base[i] = 1;
      any = true;
    }
  }
  if (!any) return null;

  // dilate by margin using distance transform
  const radius = margin * pxPerWorld;
  const dist = distanceTransform(base, cw, ch);
  const grown = new Uint8Array(cw * ch);
  for (let i = 0; i < grown.length; i++) grown[i] = dist[i]! <= radius ? 1 : 0;

  const contour = traceContour(grown, cw, ch);
  if (!contour) return null;
  const simplified = simplify(contour, 1.2);
  if (simplified.length < 8) return null;

  // pixel -> world
  const centerY = worldHeight / 2 + margin;
  const toWorld = (p: [number, number]): [number, number] => [
    ((p[0] - pad) / mw - 0.5) * worldWidth,
    centerY + (0.5 - (p[1] - pad) / mh) * worldHeight,
  ];
  const world = simplified.map(toWorld);

  let minY = Infinity;
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of world) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }
  const lift = -minY; // put the bottom of the silhouette at y = 0

  const shape = new THREE.Shape();
  const pts = world.map(([x, y]) => new THREE.Vector2(x, y + lift));
  shape.moveTo(pts[0]!.x, pts[0]!.y);
  // smooth the outline slightly with quadratic midpoints
  for (let i = 1; i <= pts.length; i++) {
    const cur = pts[i % pts.length]!;
    const next = pts[(i + 1) % pts.length]!;
    shape.quadraticCurveTo(cur.x, cur.y, (cur.x + next.x) / 2, (cur.y + next.y) / 2);
  }
  shape.closePath();

  return {
    shape,
    centerY: centerY + lift,
    boardH: maxY + lift,
    boardW: maxX - minX,
  };
}
