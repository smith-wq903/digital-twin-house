import { useState, useEffect } from 'react';
import { useStore } from 'zustand';
import FloorPlanEditor from './components/FloorPlanEditor';
import Scene3D from './components/Scene3D';
import FurniturePanel from './components/FurniturePanel';
import ExportImport from './components/ExportImport';
import { useHouseStore } from './store/useHouseStore';
import './index.css';

type Tab = 'floor' | 'furniture';

export default function App() {
  const [tab, setTab] = useState<Tab>('floor');

  // Undo/Redo の状態（ボタンの有効・無効に使用）
  const canUndo = useStore(useHouseStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useHouseStore.temporal, (s) => s.futureStates.length > 0);

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y でアンドゥ・リドゥ
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const isUndo = e.key === 'z' && !e.shiftKey;
      const isRedo = e.key === 'y' || (e.key === 'z' && e.shiftKey);
      if (!isUndo && !isRedo) return;
      // 入力中はブラウザのネイティブ動作（テキスト編集）を優先
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      const temporal = useHouseStore.temporal.getState();
      if (isUndo) temporal.undo();
      if (isRedo) temporal.redo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏠 Digital Twin House</h1>
        <p className="subtitle">間取りを描いて、家具を配置して、3Dで確認</p>
        <div className="undo-redo-btns">
          <button
            className="undo-btn"
            onClick={() => useHouseStore.temporal.getState().undo()}
            disabled={!canUndo}
            title="元に戻す (Ctrl+Z)"
          >↩ 元に戻す</button>
          <button
            className="undo-btn"
            onClick={() => useHouseStore.temporal.getState().redo()}
            disabled={!canRedo}
            title="やり直し (Ctrl+Shift+Z)"
          >↪ やり直し</button>
        </div>
      </header>

      <div className="app-body">
        {/* 左パネル */}
        <aside className="left-panel">
          <div className="tab-bar">
            <button className={`tab-btn ${tab === 'floor' ? 'active' : ''}`} onClick={() => setTab('floor')}>
              間取りエディタ
            </button>
            <button className={`tab-btn ${tab === 'furniture' ? 'active' : ''}`} onClick={() => setTab('furniture')}>
              家具
            </button>
          </div>

          <div className="panel-content">
            {tab === 'floor' && <FloorPlanEditor />}
            {tab === 'furniture' && <FurniturePanel />}
          </div>

          {/* 常時表示の Export / Import */}
          <ExportImport />
        </aside>

        {/* 右：3Dビュー */}
        <main className="view-3d">
          <Scene3D />
        </main>
      </div>
    </div>
  );
}
