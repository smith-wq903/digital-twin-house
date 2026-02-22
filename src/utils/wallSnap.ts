import type { Room } from '../types';

export interface WallHit {
  canvasX: number;
  canvasY: number;
  wallAxis: 'h' | 'v';
}

/**
 * 柱を壁に「辺で」貼り付けるとき、柱の中心座標を計算する。
 * cursor: クリック/ドラッグ中のカーソル位置（キャンバスpx）
 * wall: findNearestWall の結果
 * depthPx: 壁直交方向の柱サイズ（px）
 */
export function columnEdgeCenter(
  cursor: { cx: number; cy: number },
  wall: WallHit,
  depthPx: number,
): { canvasX: number; canvasY: number } {
  const dh = depthPx / 2;
  if (wall.wallAxis === 'h') {
    // 横走り壁: 壁は水平（Y固定）、柱は Y方向に飛び出す
    const offsetY = cursor.cy >= wall.canvasY ? dh : -dh;
    return { canvasX: wall.canvasX, canvasY: wall.canvasY + offsetY };
  } else {
    // 縦走り壁: 壁は垂直（X固定）、柱は X方向に飛び出す
    const offsetX = cursor.cx >= wall.canvasX ? dh : -dh;
    return { canvasX: wall.canvasX + offsetX, canvasY: wall.canvasY };
  }
}

/**
 * rooms の壁のうち最も近いスナップ点を返す。
 * @param snapDist スナップ距離（キャンバスpx）。Infinity を渡すと常に最近傍を返す。
 */
export function findNearestWall(
  rooms: Room[],
  cx: number,
  cy: number,
  snapDist = 14,
): WallHit | null {
  let best: WallHit | null = null;
  let bestDist = snapDist;
  for (const room of rooms) {
    const segs: { x1: number; y1: number; x2: number; y2: number; axis: 'h' | 'v' }[] = [
      { x1: room.x, y1: room.y, x2: room.x + room.width, y2: room.y, axis: 'h' },
      { x1: room.x, y1: room.y + room.height, x2: room.x + room.width, y2: room.y + room.height, axis: 'h' },
      { x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.height, axis: 'v' },
      { x1: room.x + room.width, y1: room.y, x2: room.x + room.width, y2: room.y + room.height, axis: 'v' },
    ];
    for (const seg of segs) {
      const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = Math.max(0.05, Math.min(0.95, ((cx - seg.x1) * dx + (cy - seg.y1) * dy) / lenSq));
      const px = seg.x1 + t * dx, py = seg.y1 + t * dy;
      const d = Math.hypot(cx - px, cy - py);
      if (d < bestDist) { bestDist = d; best = { canvasX: px, canvasY: py, wallAxis: seg.axis }; }
    }
  }
  return best;
}
