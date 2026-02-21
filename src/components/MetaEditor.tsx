import { useState } from 'react';
import type { ItemMeta } from '../types';

export const EMPTY_META: ItemMeta = { custom: [] };

function hasMeta(meta?: ItemMeta): boolean {
  if (!meta) return false;
  return !!(
    meta.maker || meta.modelNo || meta.material ||
    meta.contents || meta.memo || meta.custom?.length
  );
}

const COMMON_FIELDS: { key: keyof Omit<ItemMeta, 'custom'>; label: string; textarea?: boolean }[] = [
  { key: 'maker',    label: 'メーカー' },
  { key: 'modelNo',  label: '型番' },
  { key: 'material', label: '素材' },
  { key: 'contents', label: '内容物', textarea: true },
  { key: 'memo',     label: 'メモ',   textarea: true },
];

interface Props {
  meta?: ItemMeta;
  onChange: (meta: ItemMeta) => void;
}

export default function MetaEditor({ meta, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const m = meta ?? EMPTY_META;

  const set = (patch: Partial<ItemMeta>) => onChange({ ...m, ...patch });

  const setCustom = (i: number, field: 'key' | 'value', val: string) => {
    const custom = m.custom.map((c, idx) => idx === i ? { ...c, [field]: val } : c);
    set({ custom });
  };

  return (
    <div className="meta-editor">
      <button className="meta-toggle" onClick={() => setOpen((o) => !o)}>
        <span className="meta-toggle-arrow">{open ? '▾' : '▸'}</span>
        詳細情報
        {hasMeta(m) && <span className="meta-dot" title="情報あり" />}
      </button>

      {open && (
        <div className="meta-body">
          {/* 共通項目 */}
          {COMMON_FIELDS.map(({ key, label, textarea }) => (
            <div key={key} className="meta-row">
              <span className="meta-label">{label}</span>
              {textarea ? (
                <textarea
                  className="meta-textarea"
                  value={m[key] ?? ''}
                  placeholder={label}
                  rows={2}
                  onChange={(e) => set({ [key]: e.target.value })}
                />
              ) : (
                <input
                  className="meta-input"
                  value={m[key] ?? ''}
                  placeholder={label}
                  onChange={(e) => set({ [key]: e.target.value })}
                />
              )}
            </div>
          ))}

          {/* 自由追加項目 */}
          <div className="meta-custom-header">
            <span className="meta-section-label">カスタム項目</span>
            <button
              className="meta-add-btn"
              onClick={() => set({ custom: [...m.custom, { key: '', value: '' }] })}
            >＋ 追加</button>
          </div>

          {m.custom.map((entry, i) => (
            <div key={i} className="meta-custom-row">
              <input
                className="meta-custom-key"
                value={entry.key}
                placeholder="項目名"
                onChange={(e) => setCustom(i, 'key', e.target.value)}
              />
              <span className="meta-colon">:</span>
              <input
                className="meta-custom-val"
                value={entry.value}
                placeholder="値"
                onChange={(e) => setCustom(i, 'value', e.target.value)}
              />
              <button
                className="remove-btn"
                onClick={() => set({ custom: m.custom.filter((_, idx) => idx !== i) })}
                title="削除"
              >✕</button>
            </div>
          ))}

          {m.custom.length === 0 && (
            <p className="meta-empty-hint">「＋ 追加」で自由項目を追加できます</p>
          )}
        </div>
      )}
    </div>
  );
}
