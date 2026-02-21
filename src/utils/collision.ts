import type { Furniture } from '../types';

/** XZ平面上の家具4隅のワールド座標を返す（Y軸回転考慮） */
function getFootprint(f: Furniture): [number, number][] {
  const [w, , d] = f.size;
  const [px, , pz] = f.position;
  const rot = f.rotation ?? 0;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const hw = w / 2;
  const hd = d / 2;

  return (
    [
      [-hw, -hd],
      [ hw, -hd],
      [ hw,  hd],
      [-hw,  hd],
    ] as [number, number][]
  ).map(([lx, lz]) => [
    px + lx * cos - lz * sin,
    pz + lx * sin + lz * cos,
  ]);
}

/** 2D点列を軸方向に射影して [min, max] を返す */
function project(pts: [number, number][], nx: number, ny: number): [number, number] {
  const dots = pts.map(([x, y]) => x * nx + y * ny);
  return [Math.min(...dots), Math.max(...dots)];
}

/** 2D SAT（分離軸定理）で2多角形が交差するか判定 */
function sat2D(a: [number, number][], b: [number, number][]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const j = (i + 1) % poly.length;
      const ex = poly[j][0] - poly[i][0];
      const ey = poly[j][1] - poly[i][1];
      // エッジの法線（外向き）
      const nx = -ey;
      const ny = ex;

      const [minA, maxA] = project(a, nx, ny);
      const [minB, maxB] = project(b, nx, ny);

      // 分離軸が見つかれば非交差
      if (maxA <= minB || maxB <= minA) return false;
    }
  }
  return true; // 全軸で重なる → 交差
}

/**
 * 2つの家具が3Dで交差しているか判定する。
 * Y軸範囲（elevation〜elevation+height）と XZ平面の SAT を組み合わせる。
 */
export function checkCollision(a: Furniture, b: Furniture): boolean {
  const aBot = a.elevation ?? 0;
  const aTop = aBot + a.size[1];
  const bBot = b.elevation ?? 0;
  const bTop = bBot + b.size[1];

  // Y範囲が重ならなければ交差なし
  if (aBot >= bTop || bBot >= aTop) return false;

  // XZ平面で SAT 判定
  return sat2D(getFootprint(a), getFootprint(b));
}

/** furniture 配列から干渉中の ID セットを返す（O(n²)） */
export function getCollidingIds(furniture: Furniture[]): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < furniture.length; i++) {
    for (let j = i + 1; j < furniture.length; j++) {
      if (checkCollision(furniture[i], furniture[j])) {
        ids.add(furniture[i].id);
        ids.add(furniture[j].id);
      }
    }
  }
  return ids;
}
