import { useHouseStore } from '../store/useHouseStore';
import MetaEditor from './MetaEditor';
import type { OpeningKind } from '../types';

const SCALE = 0.05; // 1px = 0.05m

// ---- 家具インスペクター ----
function FurnitureInspector() {
  const {
    furniture, selectedFurnitureId, selectFurniture, removeFurniture,
    updateFurniture, updateFurnitureSize, updateFurnitureElevation,
  } = useHouseStore();

  const item = furniture.find((f) => f.id === selectedFurnitureId);
  if (!item) return null;

  const radToDeg = (rad: number) =>
    Math.round(((rad % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) * (180 / Math.PI));
  const degToRad = (deg: number) => (deg % 360) * (Math.PI / 180);

  const handleSizeChange = (axis: 0 | 1 | 2, val: number) => {
    const s = [...item.size] as [number, number, number];
    s[axis] = Math.max(0.1, val);
    updateFurnitureSize(item.id, s);
  };

  return (
    <>
      <div className="inspector-header">
        <span className="inspector-title" title={item.name}>{item.name}</span>
        <button className="inspector-close" onClick={() => selectFurniture(null)} title="閉じる">✕</button>
      </div>
      <div className="inspector-body">
        {/* 名前 */}
        <div className="insp-row">
          <span className="insp-label">名前</span>
          <input
            className="insp-input"
            value={item.name}
            onChange={(e) => updateFurniture(item.id, { name: e.target.value })}
          />
        </div>

        {/* サイズ */}
        <div className="insp-section">サイズ</div>
        <div className="insp-size-grid">
          {(['W（幅）', 'H（高さ）', 'D（奥行）'] as const).map((label, i) => (
            <label key={label} className="insp-num-label">
              {label}
              <div className="insp-num-row">
                <input
                  type="number" className="insp-num" step="0.1" min="0.1"
                  value={+item.size[i].toFixed(2)}
                  onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) handleSizeChange(i as 0 | 1 | 2, v); }}
                />
                <span className="insp-unit">m</span>
              </div>
            </label>
          ))}
        </div>

        {/* 回転 */}
        <div className="insp-row" style={{ marginTop: 6 }}>
          <span className="insp-label">回転</span>
          <div className="insp-rot-row">
            <button className="insp-rot-btn" onClick={() => updateFurniture(item.id, { rotation: (item.rotation ?? 0) - Math.PI / 2 })}>−90°</button>
            <input
              type="number" className="insp-num" step="1" min="0" max="359"
              style={{ width: 52 }}
              value={radToDeg(item.rotation ?? 0)}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateFurniture(item.id, { rotation: degToRad(v) }); }}
            />
            <span className="insp-unit">°</span>
            <button className="insp-rot-btn" onClick={() => updateFurniture(item.id, { rotation: (item.rotation ?? 0) + Math.PI / 2 })}>+90°</button>
          </div>
        </div>

        {/* 床高さ */}
        <div className="insp-row">
          <span className="insp-label">床高さ</span>
          <div className="insp-num-row">
            <input
              type="number" className="insp-num" step="0.05" min="0"
              style={{ width: 64 }}
              value={+(item.elevation ?? 0).toFixed(2)}
              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v >= 0) updateFurnitureElevation(item.id, v); }}
            />
            <span className="insp-unit">m</span>
          </div>
        </div>

        {/* 色 */}
        <div className="insp-row">
          <span className="insp-label">色</span>
          <input
            type="color" className="color-picker"
            value={item.color}
            onChange={(e) => updateFurniture(item.id, { color: e.target.value })}
          />
          <span className="insp-hex">{item.color.toUpperCase()}</span>
        </div>

        {/* 詳細情報 */}
        <MetaEditor
          meta={item.meta}
          onChange={(meta) => updateFurniture(item.id, { meta })}
        />

        {/* 削除 */}
        <button className="insp-delete-btn" onClick={() => removeFurniture(item.id)}>
          削除
        </button>
      </div>
    </>
  );
}

// ---- 建具インスペクター ----
function OpeningInspector() {
  const {
    openings, selectedOpeningId, selectOpening, removeOpening, updateOpening,
  } = useHouseStore();

  const opening = openings.find((o) => o.id === selectedOpeningId);
  if (!opening) return null;

  const widthM = +(opening.widthPx * SCALE).toFixed(2);
  const kindLabel = opening.kind === 'door' ? 'ドア' : '窓';

  return (
    <>
      <div className="inspector-header">
        <span className="inspector-title">{kindLabel}</span>
        <button className="inspector-close" onClick={() => selectOpening(null)} title="閉じる">✕</button>
      </div>
      <div className="inspector-body">
        {/* 種類 */}
        <div className="insp-row">
          <span className="insp-label">種類</span>
          <div className="insp-kind-toggle">
            {(['door', 'window'] as OpeningKind[]).map((k) => (
              <button
                key={k}
                className={`insp-kind-btn ${opening.kind === k ? 'active' : ''}`}
                onClick={() => updateOpening(opening.id, { kind: k })}
              >
                {k === 'door' ? 'ドア' : '窓'}
              </button>
            ))}
          </div>
        </div>

        {/* 幅 */}
        <div className="insp-row">
          <span className="insp-label">幅</span>
          <div className="insp-num-row">
            <input
              type="number" className="insp-num" step="0.05" min="0.1"
              style={{ width: 64 }}
              value={widthM}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) updateOpening(opening.id, { widthPx: Math.round(v / SCALE) });
              }}
            />
            <span className="insp-unit">m</span>
          </div>
        </div>

        {/* 高さ */}
        <div className="insp-row">
          <span className="insp-label">高さ</span>
          <div className="insp-num-row">
            <input
              type="number" className="insp-num" step="0.05" min="0.1"
              style={{ width: 64 }}
              value={+opening.height.toFixed(2)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v > 0) updateOpening(opening.id, { height: v });
              }}
            />
            <span className="insp-unit">m</span>
          </div>
        </div>

        {/* 下端高さ */}
        <div className="insp-row">
          <span className="insp-label">下端高さ</span>
          <div className="insp-num-row">
            <input
              type="number" className="insp-num" step="0.05" min="0"
              style={{ width: 64 }}
              value={+opening.sillHeight.toFixed(2)}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!isNaN(v) && v >= 0) updateOpening(opening.id, { sillHeight: v });
              }}
            />
            <span className="insp-unit">m</span>
          </div>
        </div>

        {/* 詳細情報 */}
        <MetaEditor
          meta={opening.meta}
          onChange={(meta) => updateOpening(opening.id, { meta })}
        />

        {/* 削除 */}
        <button className="insp-delete-btn" onClick={() => removeOpening(opening.id)}>
          削除
        </button>
      </div>
    </>
  );
}

// ---- メイン ----
export default function InspectorPanel() {
  const { selectedFurnitureId, selectedOpeningId } = useHouseStore();

  if (!selectedFurnitureId && !selectedOpeningId) return null;

  return (
    <div
      className="inspector-panel"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {selectedFurnitureId && <FurnitureInspector />}
      {selectedOpeningId && <OpeningInspector />}
    </div>
  );
}
