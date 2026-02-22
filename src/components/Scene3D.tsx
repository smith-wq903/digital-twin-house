import { useRef, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text, Grid, Environment, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useHouseStore } from '../store/useHouseStore';
import { getCollidingIds } from '../utils/collision';
import { FurnitureModel } from './FurnitureModels';
import InspectorPanel from './InspectorPanel';
import type { Room, Furniture, Opening } from '../types';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsType } from 'three-stdlib';

const SCALE = 0.05;
const WALL_H = 2.4;
const FLOOR_T = 0.1;
const OFFSET = 7;

// ---- 部屋 ----
function RoomMesh({ room }: { room: Room }) {
  const cx = (room.x + room.width / 2) * SCALE - OFFSET;
  const cz = (room.y + room.height / 2) * SCALE - OFFSET;
  const w = room.width * SCALE;
  const d = room.height * SCALE;
  const walls: { pos: [number, number, number]; args: [number, number, number] }[] = [
    { pos: [0, WALL_H / 2, -d / 2], args: [w, WALL_H, 0.08] },
    { pos: [0, WALL_H / 2,  d / 2], args: [w, WALL_H, 0.08] },
    { pos: [-w / 2, WALL_H / 2, 0], args: [0.08, WALL_H, d] },
    { pos: [ w / 2, WALL_H / 2, 0], args: [0.08, WALL_H, d] },
  ];
  return (
    <group position={[cx, 0, cz]}>
      <mesh position={[0, -FLOOR_T / 2, 0]} receiveShadow>
        <boxGeometry args={[w, FLOOR_T, d]} />
        <meshStandardMaterial color={room.color} opacity={0.6} transparent />
      </mesh>
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.pos} castShadow receiveShadow>
          <boxGeometry args={wall.args} />
          <meshStandardMaterial color={room.color} opacity={0.3} transparent />
        </mesh>
      ))}
      <Text position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#fff" anchorX="center" anchorY="middle">
        {room.name}
      </Text>
    </group>
  );
}

// ---- 家具 ----
function FurnitureMesh({
  item,
  orbitRef,
  isColliding,
}: {
  item: Furniture;
  orbitRef: React.RefObject<OrbitControlsType | null>;
  isColliding: boolean;
}) {
  const { camera, gl } = useThree();
  const isDragging = useRef(false);
  const { selectedFurnitureId, selectFurniture, selectOpening, updateFurniturePosition } = useHouseStore();
  const isSelected = selectedFurnitureId === item.id;
  const floorPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    isDragging.current = true;
    selectFurniture(item.id);
    selectOpening(null);
    if (orbitRef.current) orbitRef.current.enabled = false;
    gl.domElement.style.cursor = 'grabbing';

    // ドラッグ中は途中位置をUndoスタックに積まない
    useHouseStore.temporal.getState().pause();

    const raycaster = new THREE.Raycaster();
    const onMove = (ev: PointerEvent) => {
      if (!isDragging.current) return;
      const rect = gl.domElement.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
      const target = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(floorPlane, target))
        updateFurniturePosition(item.id, [target.x, item.position[1], target.z]);
    };
    const onUp = () => {
      isDragging.current = false;
      if (orbitRef.current) orbitRef.current.enabled = true;
      gl.domElement.style.cursor = 'auto';
      gl.domElement.removeEventListener('pointermove', onMove);
      gl.domElement.removeEventListener('pointerup', onUp);
      // ドラッグ終了時点の位置を1ステップとして記録
      useHouseStore.temporal.getState().resume();
    };
    gl.domElement.addEventListener('pointermove', onMove);
    gl.domElement.addEventListener('pointerup', onUp);
  };

  // 干渉中は赤みを帯びたエミッシブ、選択中は白
  const emissiveColor = isColliding ? '#ff3300' : isSelected ? '#ffffff' : '#000000';
  const emissiveIntensity = isColliding ? 0.25 : isSelected ? 0.15 : 0;

  return (
    <group
      position={item.position}
      rotation={[0, item.rotation ?? 0, 0]}
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      onPointerEnter={() => { if (!isDragging.current) gl.domElement.style.cursor = 'grab'; }}
      onPointerLeave={() => { if (!isDragging.current) gl.domElement.style.cursor = 'auto'; }}
    >
      <FurnitureModel
        name={item.name}
        size={item.size}
        color={item.color}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
      />

      {/* 選択時：白ワイヤーフレーム */}
      {isSelected && !isColliding && (
        <mesh>
          <boxGeometry args={[item.size[0] + 0.05, item.size[1] + 0.05, item.size[2] + 0.05]} />
          <meshStandardMaterial color="#ffffff" wireframe />
        </mesh>
      )}

      {/* 干渉時：赤ワイヤーフレーム */}
      {isColliding && (
        <mesh>
          <boxGeometry args={[item.size[0] + 0.06, item.size[1] + 0.06, item.size[2] + 0.06]} />
          <meshStandardMaterial color="#ff4400" wireframe />
        </mesh>
      )}

      <Text
        position={[0, item.size[1] / 2 + 0.15, 0]}
        fontSize={0.2}
        color={isColliding ? '#ff8866' : '#ffffff'}
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {item.name}
      </Text>
    </group>
  );
}

// ---- 窓・ドア ----
function OpeningMesh({ opening }: { opening: Opening }) {
  const { selectedOpeningId, selectOpening, selectFurniture } = useHouseStore();
  const { gl } = useThree();
  const isSelected = selectedOpeningId === opening.id;
  const widthM = opening.widthPx * SCALE;
  const h = opening.height;
  const worldX = opening.canvasX * SCALE - OFFSET;
  const worldZ = opening.canvasY * SCALE - OFFSET;
  const posY = opening.sillHeight + h / 2;
  const rotY = opening.wallAxis === 'v' ? Math.PI / 2 : 0;
  const wt = 0.13; // opening thickness (≥ wall thickness 0.08)
  const ft = 0.055; // frame bar thickness

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectOpening(opening.id);
    selectFurniture(null);
  };

  const hoverHandlers = {
    onPointerEnter: () => { gl.domElement.style.cursor = 'pointer'; },
    onPointerLeave: () => { gl.domElement.style.cursor = 'auto'; },
  };

  if (opening.kind === 'column') {
    const depthM = (opening.depthPx ?? opening.widthPx) * SCALE;
    return (
      <group position={[worldX, opening.sillHeight + h / 2, worldZ]} rotation={[0, rotY, 0]} onClick={handleClick} {...hoverHandlers}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[widthM, h, depthM]} />
          <meshStandardMaterial color="#aaaaaa" roughness={0.7} />
        </mesh>
        {isSelected && (
          <mesh>
            <boxGeometry args={[widthM + 0.06, h + 0.06, depthM + 0.06]} />
            <meshStandardMaterial color="#ffee00" wireframe />
          </mesh>
        )}
      </group>
    );
  }

  if (opening.kind === 'window') {
    return (
      <group position={[worldX, posY, worldZ]} rotation={[0, rotY, 0]} onClick={handleClick} {...hoverHandlers}>
        {/* 枠 4辺 */}
        <mesh castShadow position={[-widthM / 2 + ft / 2, 0, 0]}>
          <boxGeometry args={[ft, h, wt]} /><meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh castShadow position={[widthM / 2 - ft / 2, 0, 0]}>
          <boxGeometry args={[ft, h, wt]} /><meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh castShadow position={[0, h / 2 - ft / 2, 0]}>
          <boxGeometry args={[widthM, ft, wt]} /><meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh castShadow position={[0, -h / 2 + ft / 2, 0]}>
          <boxGeometry args={[widthM, ft, wt]} /><meshStandardMaterial color="#2a2a2a" />
        </mesh>
        {/* ガラス（半透明・薄水色）*/}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[widthM - 2 * ft, h - 2 * ft, wt * 0.25]} />
          <meshStandardMaterial color="#b8e8ff" transparent opacity={0.55} />
        </mesh>
        {/* 選択ハイライト */}
        {isSelected && (
          <mesh>
            <boxGeometry args={[widthM + 0.06, h + 0.06, wt + 0.06]} />
            <meshStandardMaterial color="#ffee00" wireframe />
          </mesh>
        )}
      </group>
    );
  }

  // ドア
  return (
    <group position={[worldX, posY, worldZ]} rotation={[0, rotY, 0]} onClick={handleClick} {...hoverHandlers}>
      {/* 枠 左右 + 上 */}
      <mesh castShadow position={[-widthM / 2 + ft / 2, 0, 0]}>
        <boxGeometry args={[ft, h, wt]} /><meshStandardMaterial color="#5c3d1e" />
      </mesh>
      <mesh castShadow position={[widthM / 2 - ft / 2, 0, 0]}>
        <boxGeometry args={[ft, h, wt]} /><meshStandardMaterial color="#5c3d1e" />
      </mesh>
      <mesh castShadow position={[0, h / 2 - ft / 2, 0]}>
        <boxGeometry args={[widthM, ft, wt]} /><meshStandardMaterial color="#5c3d1e" />
      </mesh>
      {/* ドアパネル */}
      <mesh castShadow position={[0, -ft / 2, wt * 0.2]}>
        <boxGeometry args={[widthM - 2 * ft, h - ft, wt * 0.4]} />
        <meshStandardMaterial color="#c0894a" />
      </mesh>
      {/* ノブ */}
      <mesh position={[widthM * 0.35, 0, wt * 0.42]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* 選択ハイライト */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[widthM + 0.06, h + 0.06, wt + 0.06]} />
          <meshStandardMaterial color="#ffee00" wireframe />
        </mesh>
      )}
    </group>
  );
}

// ---- グリッドラベル ----
function GridLabels() {
  const labels: { pos: [number, number, number]; text: string }[] = [];
  for (let m = -12; m <= 12; m += 2) {
    if (m === 0) continue;
    labels.push({ pos: [m, 0.01, -14.5], text: `${Math.abs(m)}` });
    labels.push({ pos: [-14.5, 0.01, m], text: `${Math.abs(m)}` });
  }
  return (
    <>
      {labels.map((l, i) => (
        <Text key={i} position={l.pos} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.25} color="#666688" anchorX="center" anchorY="middle">
          {l.text}
        </Text>
      ))}
      <Text position={[14, 0.01, -14.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.3} color="#8888aa" anchorX="center" anchorY="middle">
        m
      </Text>
    </>
  );
}

// ---- 計測ツール（3D） ----
function MeasureTool3D() {
  const { measureMode, measurePoints, measureHeights, addMeasurePoint } = useHouseStore();

  const handleFloorClick = (e: ThreeEvent<MouseEvent>) => {
    if (!measureMode) return;
    e.stopPropagation();
    addMeasurePoint({ x: e.point.x, y: 0, z: e.point.z });
  };

  const pts = measurePoints;
  const [h1, h2] = measureHeights;
  const p1 = pts[0] ? new THREE.Vector3(pts[0].x, h1, pts[0].z) : null;
  const p2 = pts[1] ? new THREE.Vector3(pts[1].x, h2, pts[1].z) : null;
  const linePoints = p1 && p2 ? [p1, p2] : null;

  return (
    <>
      {measureMode && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} onClick={handleFloorClick}>
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {p1 && (
        <group>
          <mesh position={p1}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial color="#ffee00" emissive="#ffee00" emissiveIntensity={0.5} />
          </mesh>
          {h1 > 0 && (
            <Line
              points={[new THREE.Vector3(pts[0].x, 0, pts[0].z), p1]}
              color="#ffee0088"
              lineWidth={1}
              dashed dashSize={0.1} gapSize={0.05}
            />
          )}
        </group>
      )}
      {p2 && (
        <group>
          <mesh position={p2}>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial color="#ffee00" emissive="#ffee00" emissiveIntensity={0.5} />
          </mesh>
          {h2 > 0 && (
            <Line
              points={[new THREE.Vector3(pts[1].x, 0, pts[1].z), p2]}
              color="#ffee0088"
              lineWidth={1}
              dashed dashSize={0.1} gapSize={0.05}
            />
          )}
        </group>
      )}
      {linePoints && <Line points={linePoints} color="#ffee00" lineWidth={2} />}
    </>
  );
}

// ---- 計測パネル（DOM） ----
function MeasurePanel() {
  const { measureMode, measurePoints, measureHeights, setMeasureHeight, clearMeasurePoints } = useHouseStore();
  if (!measureMode) return null;

  const pts = measurePoints;
  const [h1, h2] = measureHeights;
  let hDist: number | null = null, vDiff: number | null = null, totalDist: number | null = null;
  if (pts.length === 2) {
    const dx = pts[1].x - pts[0].x;
    const dz = pts[1].z - pts[0].z;
    hDist = Math.sqrt(dx * dx + dz * dz);
    vDiff = Math.abs(h2 - h1);
    totalDist = Math.sqrt(dx * dx + (h2 - h1) ** 2 + dz * dz);
  }

  return (
    <div className="measure-panel">
      <div className="measure-panel-title">📏 計測</div>
      {pts.length === 0 && <p className="measure-hint">床面をクリックして地点1を設定</p>}
      {pts.length === 1 && <p className="measure-hint">もう一度クリックして地点2を設定</p>}
      {pts.length >= 1 && (
        <div className="measure-heights">
          <label className="measure-height-row">
            <span>地点1 高さ</span>
            <input type="number" className="measure-height-input" value={Math.round(h1 * 1000)} step="100" min="0" max="10000"
              onChange={(e) => setMeasureHeight(0, (parseFloat(e.target.value) || 0) / 1000)} />
            <span className="measure-unit">mm</span>
          </label>
          {pts.length === 2 && (
            <label className="measure-height-row">
              <span>地点2 高さ</span>
              <input type="number" className="measure-height-input" value={Math.round(h2 * 1000)} step="100" min="0" max="10000"
                onChange={(e) => setMeasureHeight(1, (parseFloat(e.target.value) || 0) / 1000)} />
              <span className="measure-unit">mm</span>
            </label>
          )}
        </div>
      )}
      {hDist !== null && totalDist !== null && vDiff !== null && (
        <div className="measure-results">
          <div className="measure-result-row">
            <span className="measure-label">水平距離</span>
            <span className="measure-value">{Math.round(hDist * 1000)} mm</span>
          </div>
          <div className="measure-result-row">
            <span className="measure-label">高低差</span>
            <span className="measure-value">{Math.round(vDiff * 1000)} mm</span>
          </div>
          <div className="measure-result-row total">
            <span className="measure-label">空間距離</span>
            <span className="measure-value">{Math.round(totalDist * 1000)} mm</span>
          </div>
        </div>
      )}
      {pts.length > 0 && (
        <button className="measure-clear-btn" onClick={clearMeasurePoints}>クリア</button>
      )}
      {pts.length === 2 && <p className="measure-hint" style={{ marginTop: 4 }}>再クリックで新しい計測</p>}
    </div>
  );
}

// ---- キーボード ----
function KeyboardController() {
  const { furniture, selectedFurnitureId, updateFurniturePosition, updateFurniture, selectFurniture } = useHouseStore();
  // 矢印キー長押し中のUndo停止タイマー
  const arrowResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedFurnitureId) return;
      if (document.activeElement?.tagName === 'INPUT') return;

      const item = furniture.find((f) => f.id === selectedFurnitureId);
      if (!item) return;

      // 矢印キー：XZ移動（連続押し中はUndo記録を一時停止）
      const step = 0.2;
      const [x, y, z] = item.position;
      const posMap: Record<string, [number, number, number]> = {
        ArrowLeft:  [x - step, y, z],
        ArrowRight: [x + step, y, z],
        ArrowUp:    [x, y, z - step],
        ArrowDown:  [x, y, z + step],
      };
      if (posMap[e.key]) {
        e.preventDefault();
        // 連続押し中はUndo記録を一時停止し、400ms操作が止まったら再開
        useHouseStore.temporal.getState().pause();
        if (arrowResumeTimer.current) clearTimeout(arrowResumeTimer.current);
        arrowResumeTimer.current = setTimeout(() => {
          useHouseStore.temporal.getState().resume();
        }, 400);
        updateFurniturePosition(selectedFurnitureId, posMap[e.key]);
        return;
      }

      // R キー：90° 回転
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        updateFurniture(selectedFurnitureId, { rotation: (item.rotation ?? 0) + Math.PI / 2 });
        return;
      }

      if (e.key === 'Escape') selectFurniture(null);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (arrowResumeTimer.current) clearTimeout(arrowResumeTimer.current);
    };
  }, [furniture, selectedFurnitureId, updateFurniturePosition, updateFurniture, selectFurniture]);

  return null;
}

// ---- 背景クリックで選択解除 ----
function DeselectBackground() {
  const { selectFurniture, selectOpening } = useHouseStore();
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.01, 0]}
      onClick={() => { selectFurniture(null); selectOpening(null); }}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

// ---- メイン ----
export default function Scene3D() {
  const { rooms, furniture, openings, measureMode, setMeasureMode } = useHouseStore();
  const orbitRef = useRef<OrbitControlsType>(null);

  // 干渉IDセットをメモ化（furniture が変わったときだけ再計算）
  const collidingIds = useMemo(() => getCollidingIds(furniture), [furniture]);

  return (
    <div className="scene-wrapper">
      <div className="scene-help">
        <span>ドラッグ: 移動　Ctrl+ドラッグ / 右ドラッグ: 回転　ホイール: ズーム</span>
        <span>家具ドラッグ: 移動　矢印: 微調整　R: 90°回転　Esc: 解除</span>
      </div>

      <button
        className={`measure-btn ${measureMode ? 'active' : ''}`}
        onClick={() => setMeasureMode(!measureMode)}
        title="計測ツール"
      >
        📏 {measureMode ? '計測中' : '計測'}
      </button>

      <MeasurePanel />
      <InspectorPanel />

      <Canvas shadows camera={{ position: [8, 10, 12], fov: 50 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 20, 10]} intensity={1.2} castShadow shadow-mapSize={[2048, 2048]} />
        <Environment preset="city" />

        <Grid args={[30, 30]} position={[0, -0.05, 0]} cellColor="#444466" sectionColor="#666688" cellSize={1} sectionSize={5} />
        <GridLabels />

        {rooms.map((r) => <RoomMesh key={r.id} room={r} />)}
        {openings.map((o) => <OpeningMesh key={o.id} opening={o} />)}

        {furniture.map((f) => (
          <FurnitureMesh
            key={f.id}
            item={f}
            orbitRef={orbitRef}
            isColliding={collidingIds.has(f.id)}
          />
        ))}

        <MeasureTool3D />
        <DeselectBackground />
        <KeyboardController />

        <OrbitControls
          ref={orbitRef}
          makeDefault
          minDistance={3}
          maxDistance={40}
          maxPolarAngle={Math.PI / 2.1}
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
        />
      </Canvas>
    </div>
  );
}
