export type ProcessedImage = {
  url: string;
  width: number;
  height: number;
};

/**
 * Simple background removal: samples the four corners, treats similar colored
 * pixels as background (flood fill from the borders), then crops to the
 * remaining subject bounding box.
 */
export async function removeBackground(
  file: File,
  tolerance = 0.14,
): Promise<ProcessedImage> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ].map(([x, y]) => {
    const i = (y! * w + x!) * 4;
    return [data[i]!, data[i + 1]!, data[i + 2]!] as const;
  });

  const tol = tolerance * 255 * Math.sqrt(3);
  const isBg = (i: number) => {
    for (const c of corners) {
      const dr = data[i]! - c[0];
      const dg = data[i + 1]! - c[1];
      const db = data[i + 2]! - c[2];
      if (Math.sqrt(dr * dr + dg * dg + db * db) < tol) return true;
    }
    return false;
  };

  // Flood fill from the borders so interior colors matching the bg stay opaque.
  const visited = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) {
    stack.push(x, x + (h - 1) * w);
  }
  for (let y = 0; y < h; y++) {
    stack.push(y * w, y * w + w - 1);
  }

  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (!isBg(i)) continue;
    data[i + 3] = 0;
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }

  // Soften edges: pixels adjacent to transparency get partial alpha.
  const alphaCopy = new Uint8ClampedArray(w * h);
  for (let p = 0; p < w * h; p++) alphaCopy[p] = data[p * 4 + 3]!;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (alphaCopy[p]! === 0) continue;
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) sum += alphaCopy[p + dy * w + dx]!;
      data[p * 4 + 3] = Math.round(sum / 9);
    }
  }

  // Crop to subject bounds.
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! > 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  if (maxX < minX || maxY < minY) {
    minX = 0;
    minY = 0;
    maxX = w - 1;
    maxY = h - 1;
  }

  const pad = 8;
  const cw = Math.min(w, maxX - minX + 1 + pad * 2);
  const ch = Math.min(h, maxY - minY + 1 + pad * 2);
  const sx = Math.max(0, minX - pad);
  const sy = Math.max(0, minY - pad);

  const out = document.createElement("canvas");
  out.width = cw;
  out.height = ch;
  const octx = out.getContext("2d")!;
  octx.drawImage(canvas, sx, sy, cw, ch, 0, 0, cw, ch);

  return { url: out.toDataURL("image/png"), width: cw, height: ch };
}

export async function loadRaw(file: File): Promise<ProcessedImage> {
  const url = URL.createObjectURL(file);
  const size = await new Promise<{ width: number; height: number }>((res, rej) => {
    const im = new Image();
    im.onload = () => res({ width: im.naturalWidth, height: im.naturalHeight });
    im.onerror = rej;
    im.src = url;
  });
  return { url, ...size };
}
