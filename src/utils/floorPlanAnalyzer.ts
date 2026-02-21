import type { Room } from '../types';

const ROOM_COLORS = [
  '#4a90d9', '#7ed321', '#f5a623', '#d0021b',
  '#9013fe', '#50e3c2', '#b8e986', '#f8e71c',
];

/** 処理用の最大解像度 */
const MAX_SIZE = 400;

/** 壁とみなす明度の閾値 (0-255) */
const WALL_THRESHOLD = 200;

/** 壁を膨張させるピクセル半径（ドア開口部を埋める） */
const DILATE_RADIUS = 6;

/** 部屋として認識する最小面積（全ピクセル数に対する割合） */
const MIN_AREA_RATIO = 0.008;

// ピクセル状態定数
const OPEN = 1;    // 明るい（部屋候補）
const WALL = 0;    // 壁
const EXTERIOR = 2; // 外部（建物の外）

/**
 * 間取り図画像を解析して Room[] を返す。
 * Canvas API のみ使用（外部ライブラリ不要）。
 */
export function analyzeFloorPlan(
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
): Room[] {
  // ---- Step 0: オフスクリーンキャンバスに縮小描画 ----
  const srcW = image.naturalWidth || image.width;
  const srcH = image.naturalHeight || image.height;
  const scale = Math.min(MAX_SIZE / srcW, MAX_SIZE / srcH, 1);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(image, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);

  // ---- Step 1: グレースケール → 二値化 ----
  // 1 = 明るい（部屋候補）, 0 = 暗い（壁）
  const binary = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    binary[i] = gray >= WALL_THRESHOLD ? OPEN : WALL;
  }

  // 画像が反転している場合（背景が暗い）は反転
  const openCount = binary.reduce((s, v) => s + v, 0);
  if (openCount < w * h * 0.3) {
    for (let i = 0; i < binary.length; i++) {
      binary[i] = binary[i] === OPEN ? WALL : OPEN;
    }
  }

  // ---- Step 2: 壁を膨張（ドア開口部を塞ぐ） ----
  const dilated = dilateWalls(binary, w, h, DILATE_RADIUS);

  // ---- Step 3: 外縁からFlood Fillで「建物外部」をマーク ----
  // 外部ピクセルを EXTERIOR(2) にセット
  const labeled = new Uint8Array(dilated);
  const queue: number[] = [];

  const enqueueEdge = (x: number, y: number) => {
    const idx = y * w + x;
    if (labeled[idx] === OPEN) {
      labeled[idx] = EXTERIOR;
      queue.push(idx);
    }
  };

  for (let x = 0; x < w; x++) { enqueueEdge(x, 0); enqueueEdge(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { enqueueEdge(0, y); enqueueEdge(w - 1, y); }

  // BFS
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = (curr / w) | 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
      const nidx = ny * w + nx;
      if (labeled[nidx] === OPEN) {
        labeled[nidx] = EXTERIOR;
        queue.push(nidx);
      }
    }
  }

  // ---- Step 4: 残った OPEN 領域 = 部屋の候補。連結成分を検出 ----
  const visited = new Uint8Array(w * h);
  const rooms: Room[] = [];
  const minArea = w * h * MIN_AREA_RATIO;
  let colorIdx = 0;

  for (let startY = 1; startY < h - 1; startY++) {
    for (let startX = 1; startX < w - 1; startX++) {
      const startIdx = startY * w + startX;
      if (labeled[startIdx] !== OPEN || visited[startIdx]) continue;

      // BFS でこの連結成分を探索
      const regionQueue: number[] = [startIdx];
      visited[startIdx] = 1;
      let minX = startX, maxX = startX, minY = startY, maxY = startY;
      let area = 0;
      let qHead = 0;

      while (qHead < regionQueue.length) {
        const curr = regionQueue[qHead++];
        const cx = curr % w;
        const cy = (curr / w) | 0;
        area++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nidx = ny * w + nx;
          if (labeled[nidx] === OPEN && !visited[nidx]) {
            visited[nidx] = 1;
            regionQueue.push(nidx);
          }
        }
      }

      if (area < minArea) continue;

      // スケールをキャンバス座標に変換
      const scaleX = canvasWidth / w;
      const scaleY = canvasHeight / h;

      rooms.push({
        id: crypto.randomUUID(),
        name: `部屋${rooms.length + 1}`,
        x: minX * scaleX,
        y: minY * scaleY,
        width: (maxX - minX) * scaleX,
        height: (maxY - minY) * scaleY,
        color: ROOM_COLORS[colorIdx % ROOM_COLORS.length],
      });
      colorIdx++;
    }
  }

  return rooms;
}

/** 壁ピクセル (WALL=0) を radius 分膨張させる */
function dilateWalls(
  src: Uint8Array,
  w: number,
  h: number,
  radius: number,
): Uint8Array {
  const dst = new Uint8Array(src);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y * w + x] !== WALL) continue;
      const y0 = Math.max(0, y - radius);
      const y1 = Math.min(h - 1, y + radius);
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      for (let ny = y0; ny <= y1; ny++) {
        for (let nx = x0; nx <= x1; nx++) {
          dst[ny * w + nx] = WALL;
        }
      }
    }
  }
  return dst;
}
