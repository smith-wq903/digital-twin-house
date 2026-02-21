import type { JSX } from 'react';

/** 16進カラーを明暗調整 (factor > 1 = 明るく, < 1 = 暗く) */
function shade(hex: string, factor: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (shift: number) =>
    Math.min(255, Math.max(0, Math.round(((n >> shift) & 0xff) * factor)))
      .toString(16)
      .padStart(2, '0');
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

interface SubMesh {
  pos: [number, number, number];
  size: [number, number, number];
  color: string;
}

interface ModelProps {
  size: [number, number, number];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
}

function Parts({
  parts,
  emissive = '#000000',
  emissiveIntensity = 0,
}: {
  parts: SubMesh[];
  emissive?: string;
  emissiveIntensity?: number;
}): JSX.Element {
  return (
    <>
      {parts.map(({ pos, size, color }, i) => (
        <mesh key={i} castShadow receiveShadow position={pos}>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissiveIntensity} />
        </mesh>
      ))}
    </>
  );
}

// ===== テーブル / デスク =====
// 天板 + 4本脚
export function TableModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const lw = Math.min(w, d) * 0.08;
  const topH = Math.max(h * 0.08, 0.03);
  const legH = h - topH;
  const dark = shade(color, 0.65);

  return (
    <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={[
      // 天板
      { pos: [0, h / 2 - topH / 2, 0], size: [w, topH, d], color },
      // 4本脚
      ...([ [-1, -1], [1, -1], [1, 1], [-1, 1] ] as [number, number][]).map(([sx, sz]): SubMesh => ({
        pos: [sx * (w / 2 - lw / 2), -h / 2 + legH / 2, sz * (d / 2 - lw / 2)],
        size: [lw, legH, lw],
        color: dark,
      })),
    ]} />
  );
}

// ===== ソファ =====
// バックレスト（z-方向）+ シート + 左右アームレスト
export function SofaModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const dark = shade(color, 0.62);
  const light = shade(color, 1.18);
  const backD = Math.max(d * 0.22, 0.1);
  const seatH = h * 0.5;
  const armW = w * 0.12;
  const armH = h * 0.62;
  const frontD = d - backD;
  const frontZ = backD / 2; // 前部分の中心Z

  return (
    <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={[
      // バックレスト（奥）
      { pos: [0, 0, -d / 2 + backD / 2], size: [w, h, backD], color: dark },
      // シート
      { pos: [0, -h / 2 + seatH / 2, frontZ], size: [w, seatH, frontD], color },
      // 左アームレスト
      { pos: [-w / 2 + armW / 2, -h / 2 + armH / 2, frontZ], size: [armW, armH, frontD], color: light },
      // 右アームレスト
      { pos: [w / 2 - armW / 2, -h / 2 + armH / 2, frontZ], size: [armW, armH, frontD], color: light },
    ]} />
  );
}

// ===== ベッド =====
// フレーム + マットレス + ヘッドボード + 枕2つ
export function BedModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const dark = shade(color, 0.58);
  const frameH = h * 0.35;
  const mattressH = h * 0.45;
  const mattressY = -h / 2 + frameH + mattressH / 2;
  const headH = Math.max(h * 2.1, 0.8); // バウンディングボックス外に飛び出してOK
  const headD = Math.max(d * 0.09, 0.06);
  const pillowSz: [number, number, number] = [w * 0.33, h * 0.28, d * 0.13];
  const pillowY = mattressY + mattressH / 2 + pillowSz[1] / 2;
  const pillowZ = -d / 2 + headD + d * 0.09;

  return (
    <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={[
      // ベッドフレーム（土台）
      { pos: [0, -h / 2 + frameH / 2, 0], size: [w, frameH, d], color: dark },
      // マットレス（明るい色）
      { pos: [0, mattressY, d * 0.03], size: [w * 0.92, mattressH, d * 0.87], color: shade('#f5f0eb', 0.98) },
      // ヘッドボード
      { pos: [0, -h / 2 + headH / 2, -d / 2 + headD / 2], size: [w, headH, headD], color: dark },
      // 枕1
      { pos: [-w * 0.21, pillowY, pillowZ], size: pillowSz, color: '#e8e4df' },
      // 枕2
      { pos: [w * 0.21, pillowY, pillowZ], size: pillowSz, color: '#e8e4df' },
    ]} />
  );
}

// ===== 本棚 / 収納棚 =====
// 外枠（左右板・背板・天底）+ 内部棚板
export function ShelfModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const dark = shade(color, 0.68);
  const pt = Math.max(Math.min(w, d) * 0.07, 0.025);
  const numShelves = Math.max(2, Math.round(h / 0.45));

  const parts: SubMesh[] = [
    // 左右板
    { pos: [-w / 2 + pt / 2, 0, 0], size: [pt, h, d], color },
    { pos: [w / 2 - pt / 2, 0, 0], size: [pt, h, d], color },
    // 背板
    { pos: [0, 0, -d / 2 + pt / 2], size: [w, h, pt], color: dark },
    // 天板
    { pos: [0, h / 2 - pt / 2, 0], size: [w, pt, d], color },
    // 底板
    { pos: [0, -h / 2 + pt / 2, 0], size: [w, pt, d], color },
  ];

  // 内部棚板
  for (let i = 1; i <= numShelves; i++) {
    const shelfY = -h / 2 + (h / (numShelves + 1)) * i;
    parts.push({
      pos: [0, shelfY, pt / 2],
      size: [w - 2 * pt, pt, d - pt],
      color,
    });
  }

  return <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={parts} />;
}

// ===== 椅子 =====
// 座板 + 前2脚（短）+ 後2脚（全高・背もたれ支柱）+ 背もたれ板
export function ChairModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const dark = shade(color, 0.62);
  const lw = Math.min(w, d) * 0.1;
  const seatFrac = 0.44; // 座面が床からの高さ比
  const seatH = h * 0.05;
  const seatY = -h / 2 + h * seatFrac; // 座面下端のY
  const frontLegH = h * seatFrac;
  const backLegH = h;
  // 背もたれ板: 座面より上、後脚上部に横架
  const restH = h * 0.36;
  const restThick = Math.max(d * 0.09, 0.03);
  const aboveSeat = h / 2 - (seatY + seatH); // 座面上端から天井まで
  const restY = seatY + seatH + aboveSeat * 0.42; // 中間やや下

  return (
    <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={[
      // 座板
      { pos: [0, seatY + seatH / 2, 0], size: [w, seatH, d], color },
      // 前脚（z+方向）
      { pos: [-(w / 2 - lw / 2), -h / 2 + frontLegH / 2, d / 2 - lw / 2], size: [lw, frontLegH, lw], color: dark },
      { pos: [w / 2 - lw / 2, -h / 2 + frontLegH / 2, d / 2 - lw / 2], size: [lw, frontLegH, lw], color: dark },
      // 後脚（z-方向・全高）
      { pos: [-(w / 2 - lw / 2), -h / 2 + backLegH / 2, -(d / 2 - lw / 2)], size: [lw, backLegH, lw], color: dark },
      { pos: [w / 2 - lw / 2, -h / 2 + backLegH / 2, -(d / 2 - lw / 2)], size: [lw, backLegH, lw], color: dark },
      // 背もたれ板
      { pos: [0, restY, -(d / 2 - restThick / 2)], size: [w - 2 * lw, restH, restThick], color },
    ]} />
  );
}

// ===== バスタブ =====
// 底板 + 左右壁 + 前壁（低め）+ 後壁（高め・蛇口側）
export function BathtubModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const dark = shade(color, 0.72);
  const wt = Math.max(w * 0.1, 0.06); // 壁厚
  const floorH = h * 0.2;

  return (
    <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={[
      // 底板
      { pos: [0, -h / 2 + floorH / 2, 0], size: [w, floorH, d], color: dark },
      // 左壁
      { pos: [-w / 2 + wt / 2, 0, 0], size: [wt, h, d], color },
      // 右壁
      { pos: [w / 2 - wt / 2, 0, 0], size: [wt, h, d], color },
      // 前壁（やや低め）
      { pos: [0, -h / 2 + h * 0.65 / 2, -d / 2 + wt / 2], size: [w, h * 0.65, wt], color },
      // 後壁（蛇口側・全高）
      { pos: [0, 0, d / 2 - wt / 2], size: [w, h, wt], color },
    ]} />
  );
}

// ===== テレビ台 =====
// 薄い天板 + 脚4本 + 棚板1枚
export function TVStandModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const dark = shade(color, 0.65);
  const topH = h * 0.08;
  const lw = Math.min(w, d) * 0.07;
  const legH = h - topH;
  const shelfY = -h / 2 + legH * 0.45;

  return (
    <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={[
      // 天板
      { pos: [0, h / 2 - topH / 2, 0], size: [w, topH, d], color },
      // 4本脚
      ...( [ [-1, -1], [1, -1], [1, 1], [-1, 1] ] as [number, number][]).map(([sx, sz]): SubMesh => ({
        pos: [sx * (w / 2 - lw / 2), -h / 2 + legH / 2, sz * (d / 2 - lw / 2)],
        size: [lw, legH, lw],
        color: dark,
      })),
      // 中段棚板
      { pos: [0, shelfY, 0], size: [w - lw * 2, topH * 0.8, d - lw * 2], color },
    ]} />
  );
}

// ===== テレビ =====
// 薄型パネル + 画面エリア + スタンド
export function TVModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const panelH = h * 0.86;
  const screenColor = shade('#1a2a3a', 1.0);
  const dark = shade(color, 0.6);

  return (
    <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={[
      // メインパネル（ベゼル込み）
      { pos: [0, h / 2 - panelH / 2, 0], size: [w, panelH, d], color },
      // スクリーン面（暗い色）
      { pos: [0, h / 2 - panelH / 2 + h * 0.02, d / 2 - d * 0.15], size: [w * 0.88, panelH * 0.85, d * 0.2], color: screenColor },
      // スタンド首
      { pos: [0, -h / 2 + h * 0.08, 0], size: [w * 0.07, h * 0.16, d * 0.5], color: dark },
      // スタンドベース
      { pos: [0, -h / 2 + h * 0.02, 0], size: [w * 0.38, h * 0.04, d * 1.8], color: dark },
    ]} />
  );
}

// ===== エアコン =====
// 横長の壁掛けユニット
export function AirConModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const light = shade(color, 1.3);
  const dark = shade(color, 0.65);

  return (
    <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={[
      // 本体
      { pos: [0, 0, 0], size: [w, h, d], color },
      // フロントパネル（明るめ）
      { pos: [0, h * 0.08, d / 2 - d * 0.08], size: [w * 0.96, h * 0.7, d * 0.15], color: light },
      // 吹き出し口スリット（暗め）
      { pos: [0, -h * 0.32, d / 2 - d * 0.08], size: [w * 0.9, h * 0.18, d * 0.12], color: dark },
    ]} />
  );
}

// ===== 電子レンジ =====
// 箱型本体 + ガラスドア + コントロールパネル
export function MicrowaveModel({ size, color, emissive, emissiveIntensity }: ModelProps) {
  const [w, h, d] = size;
  const doorColor = shade('#aaccdd', 0.7); // 暗めのガラス色
  const panelColor = shade(color, 0.75);
  const handleColor = shade(color, 0.5);

  return (
    <Parts emissive={emissive} emissiveIntensity={emissiveIntensity} parts={[
      // 本体
      { pos: [0, 0, 0], size: [w, h, d], color },
      // ガラスドア（左寄り）
      { pos: [-w * 0.13, 0, d / 2 - d * 0.04], size: [w * 0.62, h * 0.82, d * 0.07], color: doorColor },
      // コントロールパネル（右）
      { pos: [w * 0.32, 0, d / 2 - d * 0.04], size: [w * 0.28, h * 0.82, d * 0.07], color: panelColor },
      // ドアハンドル
      { pos: [-w * 0.44 + w * 0.03, 0, d / 2 - d * 0.01], size: [w * 0.04, h * 0.45, d * 0.06], color: handleColor },
    ]} />
  );
}

// ===== ディスパッチャ =====
export function FurnitureModel({
  name,
  size,
  color,
  emissive,
  emissiveIntensity,
}: {
  name: string;
  size: [number, number, number];
  color: string;
  emissive?: string;
  emissiveIntensity?: number;
}): JSX.Element {
  const props: ModelProps = { size, color, emissive, emissiveIntensity };
  switch (name) {
    case 'テーブル':
    case 'デスク':
      return <TableModel {...props} />;
    case 'ソファ':
      return <SofaModel {...props} />;
    case 'ベッド':
      return <BedModel {...props} />;
    case '本棚':
    case '収納棚':
      return <ShelfModel {...props} />;
    case '椅子':
      return <ChairModel {...props} />;
    case 'バスタブ':
      return <BathtubModel {...props} />;
    case 'テレビ台':
      return <TVStandModel {...props} />;
    case 'テレビ':
      return <TVModel {...props} />;
    case 'エアコン':
      return <AirConModel {...props} />;
    case '電子レンジ':
      return <MicrowaveModel {...props} />;
    default:
      return (
        <mesh castShadow receiveShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={color} emissive={emissive ?? '#000000'} emissiveIntensity={emissiveIntensity ?? 0} />
        </mesh>
      );
  }
}
