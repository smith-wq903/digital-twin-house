import { useRef } from 'react';
import { useHouseStore } from '../store/useHouseStore';
import type { Room, Furniture, Opening } from '../types';

// ---- 定数（Scene3D / FloorPlanEditor と同値）----
const SCALE = 0.05;   // 1 canvas px = 0.05 m
const OFFSET = 7;     // world = canvas * SCALE - OFFSET
const PX = 1 / SCALE; // 1 m = 20 canvas px

// =========================================================
// JSON
// =========================================================
interface SaveData {
  version: number;
  savedAt: string;
  rooms: Room[];
  furniture: Furniture[];
  openings?: Opening[];
}

// =========================================================
// CSV
// =========================================================
/** CSV テンプレート文字列 */
const CSV_TEMPLATE = `\
# Digital Twin House - CSVテンプレート
# 座標系: x=左右(m)、y=奥行(m)、中心が(0,0)
# 部屋  : x,y=左上角の位置(m)  width=幅(m)  height=奥行(m)
# 家具  : x,y=中心位置(m)  width=幅  height=高さ  depth=奥行(m)
#         rotation=Y軸回転(度)  elevation=床からの高さ(m)
# color : #rrggbb（省略可 → 自動）
type,name,x,y,width,height,depth,color,rotation,elevation
room,リビング,-3,-3,6,4,,#4a90d9,,
room,寝室,3,-3,4,4,,#7ed321,,
furniture,ソファ,-1,0,1.8,0.7,0.8,#c0392b,0,0
furniture,ベッド,3,-1,1.4,0.5,2.0,#2980b9,0,0
`;

const ROOM_COLORS = [
  '#4a90d9', '#7ed321', '#f5a623', '#d0021b',
  '#9013fe', '#50e3c2', '#b8e986', '#f8e71c',
];

/** CSV テキスト → rooms / furniture */
function parseCSV(text: string): { rooms: Room[]; furniture: Furniture[] } {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  if (lines.length < 2) return { rooms: [], furniture: [] };

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const col = (row: string[], key: string) => (row[headers.indexOf(key)] ?? '').trim();

  const rooms: Room[] = [];
  const furniture: Furniture[] = [];
  let colorIdx = 0;

  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const type = col(cols, 'type').toLowerCase();

    if (type === 'room') {
      const wx = parseFloat(col(cols, 'x') || '0');
      const wy = parseFloat(col(cols, 'y') || '0');
      const wm = parseFloat(col(cols, 'width') || '0');
      const hm = parseFloat(col(cols, 'height') || '0');
      if (wm <= 0 || hm <= 0) continue;
      // world → canvas px
      const cx = (wx + OFFSET) / SCALE;
      const cy = (wy + OFFSET) / SCALE;
      rooms.push({
        id: crypto.randomUUID(),
        name: col(cols, 'name') || '部屋',
        x: cx, y: cy,
        width: wm * PX, height: hm * PX,
        color: col(cols, 'color') || ROOM_COLORS[colorIdx++ % ROOM_COLORS.length],
      });

    } else if (type === 'furniture') {
      const posX  = parseFloat(col(cols, 'x')         || '0');
      const posZ  = parseFloat(col(cols, 'y')         || '0'); // CSV y = 3D Z
      const w     = parseFloat(col(cols, 'width')     || '0.5');
      const h     = parseFloat(col(cols, 'height')    || '0.5');
      const d     = parseFloat(col(cols, 'depth')     || '0.5');
      const rotDeg  = parseFloat(col(cols, 'rotation')  || '0');
      const elev  = parseFloat(col(cols, 'elevation') || '0');
      if (w <= 0 || h <= 0 || d <= 0) continue;
      const rotation = rotDeg * (Math.PI / 180);
      furniture.push({
        id: crypto.randomUUID(),
        name:     col(cols, 'name') || '家具',
        position: [posX, elev + h / 2, posZ],
        size:     [w, h, d],
        color:    col(cols, 'color') || '#888888',
        rotation,
        elevation: elev,
      });
    }
  }

  return { rooms, furniture };
}

/** rooms / furniture → CSV テキスト */
function toCSV(rooms: Room[], furniture: Furniture[]): string {
  const lines = [
    '# Digital Twin House - CSVエクスポート',
    'type,name,x,y,width,height,depth,color,rotation,elevation',
  ];
  for (const r of rooms) {
    const wx = (r.x * SCALE - OFFSET).toFixed(2);
    const wy = (r.y * SCALE - OFFSET).toFixed(2);
    const wm = (r.width  * SCALE).toFixed(2);
    const hm = (r.height * SCALE).toFixed(2);
    lines.push(`room,${r.name},${wx},${wy},${wm},${hm},,${r.color},,`);
  }
  for (const f of furniture) {
    const rotDeg = Math.round((f.rotation ?? 0) * 180 / Math.PI);
    const elev   = (f.elevation ?? 0).toFixed(2);
    lines.push(
      `furniture,${f.name},${f.position[0].toFixed(2)},${f.position[2].toFixed(2)},` +
      `${f.size[0].toFixed(2)},${f.size[1].toFixed(2)},${f.size[2].toFixed(2)},` +
      `${f.color},${rotDeg},${elev}`,
    );
  }
  return lines.join('\n');
}

/** 文字列をファイルとしてダウンロード */
function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// =========================================================
// コンポーネント
// =========================================================
export default function ExportImport() {
  const { rooms, furniture, openings, importState, addRoom, addFurniture } = useHouseStore();
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const csvFileRef  = useRef<HTMLInputElement>(null);

  // ---- JSON ----
  const handleJsonExport = () => {
    const data: SaveData = { version: 2, savedAt: new Date().toISOString(), rooms, furniture, openings };
    download(JSON.stringify(data, null, 2), `floorplan-${today()}.json`, 'application/json');
  };

  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as SaveData;
        if (!Array.isArray(data.rooms) || !Array.isArray(data.furniture)) throw new Error();
        importState(data.rooms, data.furniture, data.openings ?? []);
      } catch {
        alert('JSONの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ---- CSV ----
  const handleCsvExport = () => {
    download(toCSV(rooms, furniture), `floorplan-${today()}.csv`, 'text/csv');
  };

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { rooms: newRooms, furniture: newFurniture } = parseCSV(ev.target?.result as string);
        if (newRooms.length === 0 && newFurniture.length === 0) {
          alert('部屋・家具データが見つかりませんでした。\nCSVのフォーマットを確認してください。');
          return;
        }
        newRooms.forEach(addRoom);
        newFurniture.forEach(addFurniture);
        alert(`✓ 追加しました：部屋 ${newRooms.length} 件、家具 ${newFurniture.length} 件`);
      } catch {
        alert('CSVの読み込みに失敗しました。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="export-import-wrap">
      {/* JSON 行 */}
      <div className="export-import">
        <button className="ei-btn export" onClick={handleJsonExport} title="全データをJSONで保存">
          ⬇ JSON保存
        </button>
        <label className="ei-btn import" title="JSONを読み込んで復元（現在のデータは上書き）">
          ⬆ JSON読込
          <input ref={jsonFileRef} type="file" accept=".json,application/json" onChange={handleJsonImport} hidden />
        </label>
      </div>

      {/* CSV 行 */}
      <div className="export-import" style={{ borderTop: 'none', paddingTop: 0 }}>
        <button className="ei-btn csv-export" onClick={handleCsvExport} title="部屋と家具をCSVで書き出し">
          📄 CSV書出
        </button>
        <label className="ei-btn csv-import" title="CSVから部屋・家具を追加（既存データはそのまま）">
          📥 CSV読込
          <input ref={csvFileRef} type="file" accept=".csv,text/csv" onChange={handleCsvImport} hidden />
        </label>
        <button
          className="ei-btn template"
          onClick={() => download(CSV_TEMPLATE, 'floorplan-template.csv', 'text/csv')}
          title="CSVテンプレートをダウンロード"
        >
          📋 雛形
        </button>
      </div>
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
