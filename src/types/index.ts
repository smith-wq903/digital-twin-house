/** 共通の詳細情報 */
export interface ItemMeta {
  maker?: string;      // メーカー
  modelNo?: string;   // 型番
  material?: string;  // 素材
  contents?: string;  // 内容物
  memo?: string;      // メモ
  /** 自由追加項目 */
  custom: { key: string; value: string }[];
}

export interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  meta?: ItemMeta;
}

export interface Furniture {
  id: string;
  name: string;
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  /** Y軸回転（ラジアン）。デフォルト 0 */
  rotation: number;
  /** 床面からの底辺高さ（m）。デフォルト 0 */
  elevation: number;
  meta?: ItemMeta;
}

export interface MeasurePoint {
  x: number;
  y: number;
  z: number;
}

export type OpeningKind = 'door' | 'window' | 'column';

export interface Opening {
  id: string;
  kind: OpeningKind;
  /** 2Dキャンバス上の中心座標 (px) */
  canvasX: number;
  canvasY: number;
  /** 壁の向き: 'h'=横走り壁(上下), 'v'=縦走り壁(左右) */
  wallAxis: 'h' | 'v';
  /** 壁方向の幅（キャンバスpx）*/
  widthPx: number;
  /** 壁直交方向の奥行（キャンバスpx）柱のみ使用 */
  depthPx?: number;
  /** 高さ（m）*/
  height: number;
  /** 床からの下端高さ（m）: ドア=0, 窓≈0.9, 柱=0 */
  sillHeight: number;
  meta?: ItemMeta;
}

export interface HouseStore {
  rooms: Room[];
  furniture: Furniture[];
  openings: Opening[];
  selectedFurnitureId: string | null;
  selectedRoomId: string | null;
  selectedOpeningId: string | null;
  floorPlanImage: string | null;
  measureMode: boolean;
  measurePoints: MeasurePoint[];
  measureHeights: [number, number];

  addRoom: (room: Room) => void;
  updateRoom: (id: string, patch: Partial<Omit<Room, 'id'>>) => void;
  removeRoom: (id: string) => void;
  selectRoom: (id: string | null) => void;

  addFurniture: (item: Furniture) => void;
  updateFurniture: (id: string, patch: Partial<Omit<Furniture, 'id'>>) => void;
  updateFurniturePosition: (id: string, position: [number, number, number]) => void;
  updateFurnitureSize: (id: string, size: [number, number, number]) => void;
  updateFurnitureElevation: (id: string, elevation: number) => void;
  removeFurniture: (id: string) => void;
  selectFurniture: (id: string | null) => void;

  setFloorPlanImage: (url: string | null) => void;
  setMeasureMode: (on: boolean) => void;
  addMeasurePoint: (pt: MeasurePoint) => void;
  clearMeasurePoints: () => void;
  setMeasureHeight: (index: 0 | 1, height: number) => void;

  addOpening: (o: Opening) => void;
  updateOpening: (id: string, patch: Partial<Omit<Opening, 'id'>>) => void;
  removeOpening: (id: string) => void;
  selectOpening: (id: string | null) => void;

  importState: (rooms: Room[], furniture: Furniture[], openings?: Opening[]) => void;
}
