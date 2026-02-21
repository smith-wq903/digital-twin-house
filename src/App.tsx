import { useState } from 'react';
import FloorPlanEditor from './components/FloorPlanEditor';
import Scene3D from './components/Scene3D';
import FurniturePanel from './components/FurniturePanel';
import ExportImport from './components/ExportImport';
import './index.css';

type Tab = 'floor' | 'furniture';

export default function App() {
  const [tab, setTab] = useState<Tab>('floor');

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏠 Digital Twin House</h1>
        <p className="subtitle">間取りを描いて、家具を配置して、3Dで確認</p>
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
