import { useHouseStore } from '../store/useHouseStore';
import type { Furniture } from '../types';

interface FurnitureTemplate {
  name: string;
  size: [number, number, number];
  color: string;
  emoji: string;
}

const TEMPLATES: FurnitureTemplate[] = [
  { name: 'ソファ',   size: [1.8, 0.7, 0.8],  color: '#c0392b', emoji: '🛋' },
  { name: 'テーブル', size: [1.2, 0.75, 0.8], color: '#8B4513', emoji: '🪑' },
  { name: 'ベッド',   size: [1.4, 0.5, 2.0],  color: '#2980b9', emoji: '🛏' },
  { name: '本棚',     size: [0.9, 1.8, 0.3],  color: '#27ae60', emoji: '📚' },
  { name: 'テレビ台', size: [1.5, 0.5, 0.4],  color: '#555566', emoji: '📺' },
  { name: 'デスク',   size: [1.2, 0.75, 0.6], color: '#d35400', emoji: '💻' },
  { name: '冷蔵庫',   size: [0.6, 1.7, 0.6],  color: '#95a5a6', emoji: '🧊' },
  { name: 'バスタブ', size: [0.8, 0.5, 1.6],  color: '#5dade2', emoji: '🛁' },
  { name: '洗濯機',   size: [0.6, 0.9, 0.6],  color: '#aab7c4', emoji: '🫧' },
  { name: '収納棚',   size: [0.8, 1.6, 0.4],  color: '#a9cce3', emoji: '🗄' },
  { name: '椅子',     size: [0.45, 0.85, 0.45], color: '#7B5E40', emoji: '💺' },
  { name: 'テレビ',   size: [1.2, 0.7, 0.08],  color: '#1a1a1a', emoji: '📺' },
  { name: 'エアコン', size: [0.85, 0.22, 0.25], color: '#d8dde3', emoji: '❄' },
  { name: '電子レンジ', size: [0.5, 0.32, 0.4], color: '#888890', emoji: '📡' },
];

export default function FurniturePanel() {
  const {
    furniture, addFurniture, removeFurniture, selectFurniture,
    selectedFurnitureId,
  } = useHouseStore();

  const handleAdd = (tmpl: FurnitureTemplate) => {
    const item: Furniture = {
      id: crypto.randomUUID(),
      name: tmpl.name,
      position: [0, tmpl.size[1] / 2, 0],
      size: tmpl.size,
      color: tmpl.color,
      rotation: 0,
      elevation: 0,
    };
    addFurniture(item);
  };

  return (
    <div className="furniture-panel">
      <h3>家具を追加</h3>
      <div className="furniture-grid">
        {TEMPLATES.map((tmpl) => (
          <button
            key={tmpl.name}
            className="furniture-btn"
            onClick={() => handleAdd(tmpl)}
            title={`${tmpl.name} (${tmpl.size.join(' × ')} m)`}
          >
            <span className="furniture-emoji">{tmpl.emoji}</span>
            <span className="furniture-label">{tmpl.name}</span>
          </button>
        ))}
      </div>

      {furniture.length > 0 && (
        <>
          <h3>配置済み家具</h3>
          <div className="placed-list">
            {furniture.map((item) => (
              <div
                key={item.id}
                className={`placed-item ${selectedFurnitureId === item.id ? 'selected' : ''}`}
                onClick={() => selectFurniture(item.id)}
              >
                <span style={{ color: item.color }}>■</span>
                <span className="placed-name">{item.name}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFurniture(item.id); }}
                  className="remove-btn"
                  title="削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <p className="hint" style={{ marginTop: 6 }}>クリックで選択　3D画面でドラッグして移動　矢印キーで微調整　Rキーで90°回転</p>
        </>
      )}
    </div>
  );
}
