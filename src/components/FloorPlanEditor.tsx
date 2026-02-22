import { useRef, useState, useCallback, useEffect } from 'react';
import { useHouseStore } from '../store/useHouseStore';
import { analyzeFloorPlan } from '../utils/floorPlanAnalyzer';
import type { Room, OpeningKind } from '../types';
import MetaEditor from './MetaEditor';

const ROOM_COLORS = [
  '#4a90d9', '#7ed321', '#f5a623', '#d0021b',
  '#9013fe', '#50e3c2', '#b8e986', '#f8e71c',
];
const CANVAS_W = 280;
const CANVAS_H = 280;
/** 1px = SCALE m  (0.05 → 20px = 1m) */
const PX_PER_M = 1 / 0.05; // 20
const HANDLE_R = 7; // handle hit radius in px
const WALL_SNAP = 14; // px snap distance for opening placement
/** デフォルト開口幅 (px) */
const DEFAULT_DOOR_W = 20;  // 1.0m
const DEFAULT_WIN_W  = 28;  // 1.4m
const DEFAULT_COL_W  = 10;  // 0.5m

type EditorMode = 'draw' | 'edit' | 'opening';

interface WallHit {
  canvasX: number;
  canvasY: number;
  wallAxis: 'h' | 'v';
}

/** ビュー変換: scale・panX・panY (キャンバスpx基準) */
interface ViewState {
  scale: number;
  panX: number;
  panY: number;
}

/** CSS px → キャンバス world px */
function cssPxToWorld(cssPx: { x: number; y: number }, view: ViewState) {
  return {
    x: (cssPx.x - view.panX) / view.scale,
    y: (cssPx.y - view.panY) / view.scale,
  };
}

/** 最も近い壁上のスナップ点を返す */
function findNearestWall(rooms: Room[], cx: number, cy: number): WallHit | null {
  let best: WallHit | null = null;
  let bestDist = WALL_SNAP;
  for (const room of rooms) {
    const segs: { x1: number; y1: number; x2: number; y2: number; axis: 'h' | 'v' }[] = [
      { x1: room.x, y1: room.y, x2: room.x + room.width, y2: room.y, axis: 'h' },
      { x1: room.x, y1: room.y + room.height, x2: room.x + room.width, y2: room.y + room.height, axis: 'h' },
      { x1: room.x, y1: room.y, x2: room.x, y2: room.y + room.height, axis: 'v' },
      { x1: room.x + room.width, y1: room.y, x2: room.x + room.width, y2: room.y + room.height, axis: 'v' },
    ];
    for (const seg of segs) {
      const dx = seg.x2 - seg.x1, dy = seg.y2 - seg.y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = Math.max(0.05, Math.min(0.95, ((cx - seg.x1) * dx + (cy - seg.y1) * dy) / lenSq));
      const px = seg.x1 + t * dx, py = seg.y1 + t * dy;
      const d = Math.hypot(cx - px, cy - py);
      if (d < bestDist) { bestDist = d; best = { canvasX: px, canvasY: py, wallAxis: seg.axis }; }
    }
  }
  return best;
}

interface DrawDrag {
  kind: 'draw';
  startX: number; startY: number;
  currentX: number; currentY: number;
}
interface MoveDrag {
  kind: 'move';
  roomId: string;
  offsetX: number; offsetY: number;
}
interface ResizeDrag {
  kind: 'resize';
  roomId: string;
  corner: 'tl' | 'tr' | 'bl' | 'br';
  orig: Room;
  startX: number; startY: number;
}
interface MoveOpeningDrag {
  kind: 'move-opening';
  openingId: string;
  /** drag start world coord */
  startWX: number; startWY: number;
  /** original opening position */
  origCX: number; origCY: number;
}
/** Middle-mouse pan drag */
interface PanDrag {
  kind: 'pan';
  startPanX: number; startPanY: number;
  startMouseX: number; startMouseY: number;
}
type DragState = DrawDrag | MoveDrag | ResizeDrag | MoveOpeningDrag | PanDrag | null;

function corners(r: Room) {
  return {
    tl: { x: r.x,           y: r.y            },
    tr: { x: r.x + r.width, y: r.y            },
    bl: { x: r.x,           y: r.y + r.height },
    br: { x: r.x + r.width, y: r.y + r.height },
  } as const;
}
function dist(ax: number, ay: number, bx: number, by: number) {
  return Math.hypot(ax - bx, ay - by);
}

export default function FloorPlanEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<EditorMode>('draw');
  const [dragState, setDragState] = useState<DragState>(null);
  const [roomName, setRoomName] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeMsg, setAnalyzeMsg] = useState('');
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [openingKind, setOpeningKind] = useState<OpeningKind>('door');
  const [hoverWall, setHoverWall] = useState<WallHit | null>(null);
  const [view, setView] = useState<ViewState>({ scale: 1, panX: 0, panY: 0 });

  const {
    rooms, addRoom, updateRoom, removeRoom,
    selectedRoomId, selectRoom,
    openings, addOpening, updateOpening, removeOpening, selectedOpeningId, selectOpening,
    floorPlanImage, setFloorPlanImage,
  } = useHouseStore();

  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const colorIndex = useRef(0);
  const dragRef = useRef<DragState>(null);
  const viewRef = useRef<ViewState>(view);

  // keep refs in sync
  useEffect(() => { dragRef.current = dragState; }, [dragState]);
  useEffect(() => { viewRef.current = view; }, [view]);

  // load background image
  useEffect(() => {
    if (!floorPlanImage) { bgImageRef.current = null; setAnalyzeMsg(''); return; }
    const img = new Image();
    img.onload = () => { bgImageRef.current = img; };
    img.src = floorPlanImage;
  }, [floorPlanImage]);

  // ---- redraw ----
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const v = viewRef.current;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // bg (always screen space)
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // apply view transform
    ctx.save();
    ctx.setTransform(v.scale, 0, 0, v.scale, v.panX, v.panY);

    if (bgImageRef.current) {
      ctx.globalAlpha = 0.4;
      ctx.drawImage(bgImageRef.current, 0, 0, CANVAS_W, CANVAS_H);
      ctx.globalAlpha = 1;
    }

    // grid
    const gridStep = PX_PER_M;
    const startX = Math.floor(-v.panX / v.scale / gridStep) * gridStep;
    const startY = Math.floor(-v.panY / v.scale / gridStep) * gridStep;
    const endX = startX + CANVAS_W / v.scale + gridStep;
    const endY = startY + CANVAS_H / v.scale + gridStep;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1 / v.scale;
    for (let x = startX; x <= endX; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }

    // rooms
    for (const room of rooms) {
      const isSelected = room.id === selectedRoomId;
      ctx.fillStyle = room.color + '55';
      ctx.fillRect(room.x, room.y, room.width, room.height);
      ctx.strokeStyle = isSelected ? '#ffffff' : room.color;
      ctx.lineWidth = (isSelected ? 2 : 2) / v.scale;
      if (isSelected) ctx.setLineDash([5 / v.scale, 3 / v.scale]);
      ctx.strokeRect(room.x, room.y, room.width, room.height);
      ctx.setLineDash([]);

      ctx.fillStyle = '#fff';
      ctx.font = `${11 / v.scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(room.name, room.x + room.width / 2, room.y + room.height / 2 + 4 / v.scale);

      if (isSelected && mode === 'edit') {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = room.color;
        ctx.lineWidth = 1.5 / v.scale;
        for (const c of Object.values(corners(room))) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, (HANDLE_R - 2) / v.scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // draw-mode preview
    if (dragState?.kind === 'draw') {
      const x = Math.min(dragState.startX, dragState.currentX);
      const y = Math.min(dragState.startY, dragState.currentY);
      const w = Math.abs(dragState.currentX - dragState.startX);
      const h = Math.abs(dragState.currentY - dragState.startY);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / v.scale;
      ctx.setLineDash([4 / v.scale, 4 / v.scale]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
    }

    // openings（窓・ドア・柱）
    for (const op of openings) {
      const isSelOp = op.id === selectedOpeningId;
      const hw = op.widthPx / 2;
      ctx.save();
      ctx.lineCap = 'round';

      if (op.kind === 'column') {
        // 柱: 塗り潰しグレー矩形
        const dh = (op.depthPx ?? op.widthPx) / 2;
        ctx.fillStyle = isSelOp ? '#ffffff' : '#999999';
        ctx.strokeStyle = isSelOp ? '#ffee00' : '#cccccc';
        ctx.lineWidth = (isSelOp ? 2 : 1) / v.scale;
        if (op.wallAxis === 'h') {
          ctx.fillRect(op.canvasX - hw, op.canvasY - dh, op.widthPx, op.depthPx ?? op.widthPx);
          ctx.strokeRect(op.canvasX - hw, op.canvasY - dh, op.widthPx, op.depthPx ?? op.widthPx);
        } else {
          ctx.fillRect(op.canvasX - dh, op.canvasY - hw, op.depthPx ?? op.widthPx, op.widthPx);
          ctx.strokeRect(op.canvasX - dh, op.canvasY - hw, op.depthPx ?? op.widthPx, op.widthPx);
        }
        ctx.fillStyle = '#333';
        ctx.font = `bold ${8 / v.scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('C', op.canvasX, op.canvasY + 3 / v.scale);
      } else {
        const isDoor = op.kind === 'door';
        ctx.strokeStyle = isSelOp ? '#ffffff' : isDoor ? '#d4904a' : '#88d4ff';
        ctx.lineWidth = (isSelOp ? 4 : 3) / v.scale;
        ctx.beginPath();
        if (op.wallAxis === 'h') {
          ctx.moveTo(op.canvasX - hw, op.canvasY);
          ctx.lineTo(op.canvasX + hw, op.canvasY);
        } else {
          ctx.moveTo(op.canvasX, op.canvasY - hw);
          ctx.lineTo(op.canvasX, op.canvasY + hw);
        }
        ctx.stroke();
        ctx.fillStyle = isDoor ? '#d4904a' : '#88d4ff';
        ctx.font = `bold ${8 / v.scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(isDoor ? 'D' : 'W', op.canvasX, op.canvasY - 5 / v.scale);
      }
      ctx.restore();
    }

    // opening モード: ホバープレビュー
    if (mode === 'opening' && hoverWall) {
      ctx.save();
      if (openingKind === 'column') {
        const hw = DEFAULT_COL_W / 2;
        ctx.fillStyle = 'rgba(153,153,153,0.5)';
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1 / v.scale;
        ctx.setLineDash([4 / v.scale, 3 / v.scale]);
        if (hoverWall.wallAxis === 'h') {
          ctx.fillRect(hoverWall.canvasX - hw, hoverWall.canvasY - hw, DEFAULT_COL_W, DEFAULT_COL_W);
          ctx.strokeRect(hoverWall.canvasX - hw, hoverWall.canvasY - hw, DEFAULT_COL_W, DEFAULT_COL_W);
        } else {
          ctx.fillRect(hoverWall.canvasX - hw, hoverWall.canvasY - hw, DEFAULT_COL_W, DEFAULT_COL_W);
          ctx.strokeRect(hoverWall.canvasX - hw, hoverWall.canvasY - hw, DEFAULT_COL_W, DEFAULT_COL_W);
        }
      } else {
        const hw = (openingKind === 'door' ? DEFAULT_DOOR_W : DEFAULT_WIN_W) / 2;
        ctx.strokeStyle = openingKind === 'door' ? 'rgba(212,144,74,0.6)' : 'rgba(136,212,255,0.6)';
        ctx.lineWidth = 3 / v.scale;
        ctx.setLineDash([4 / v.scale, 3 / v.scale]);
        ctx.lineCap = 'round';
        ctx.beginPath();
        if (hoverWall.wallAxis === 'h') {
          ctx.moveTo(hoverWall.canvasX - hw, hoverWall.canvasY);
          ctx.lineTo(hoverWall.canvasX + hw, hoverWall.canvasY);
        } else {
          ctx.moveTo(hoverWall.canvasX, hoverWall.canvasY - hw);
          ctx.lineTo(hoverWall.canvasX, hoverWall.canvasY + hw);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.restore(); // end view transform

    // scale bar (always screen space)
    const barX = 8, barY = CANVAS_H - 10, barW = PX_PER_M * v.scale;
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(barX, barY - 4); ctx.lineTo(barX, barY);
    ctx.lineTo(barX + barW, barY);
    ctx.lineTo(barX + barW, barY - 4);
    ctx.stroke();
    ctx.fillStyle = '#aaa';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('1 m', barX + barW + 3, barY);
  }, [rooms, selectedRoomId, dragState, mode, openings, selectedOpeningId, hoverWall, openingKind, view]);

  useEffect(() => { redraw(); }, [redraw]);

  // ---- wheel zoom (non-passive) ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;
      setView((prev) => {
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        const newScale = Math.max(0.3, Math.min(8, prev.scale * factor));
        // zoom towards cursor
        const newPanX = cssX - (cssX - prev.panX) * (newScale / prev.scale);
        const newPanY = cssY - (cssY - prev.panY) * (newScale / prev.scale);
        return { scale: newScale, panX: newPanX, panY: newPanY };
      });
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  // ---- pointer helpers ----
  const getCSS = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    return cssPxToWorld(getCSS(e), viewRef.current);
  };

  const hitCorner = (room: Room, px: number, py: number) => {
    const c = corners(room);
    const threshold = HANDLE_R / viewRef.current.scale;
    for (const [key, pt] of Object.entries(c)) {
      if (dist(px, py, pt.x, pt.y) <= threshold) return key as 'tl' | 'tr' | 'bl' | 'br';
    }
    return null;
  };

  const hitRoom = (px: number, py: number): Room | null => {
    for (let i = rooms.length - 1; i >= 0; i--) {
      const r = rooms[i];
      if (px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height) return r;
    }
    return null;
  };

  const hitOpening = (px: number, py: number) => {
    const threshold = 8 / viewRef.current.scale;
    return openings.find((op) => {
      const hw = op.widthPx / 2;
      if (op.kind === 'column') {
        const dh = (op.depthPx ?? op.widthPx) / 2;
        return Math.abs(op.canvasX - px) <= hw && Math.abs(op.canvasY - py) <= dh;
      }
      if (op.wallAxis === 'h') return Math.abs(op.canvasY - py) < threshold && px >= op.canvasX - hw && px <= op.canvasX + hw;
      return Math.abs(op.canvasX - px) < threshold && py >= op.canvasY - hw && py <= op.canvasY + hw;
    });
  };

  // ---- mouse handlers ----
  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // middle mouse → pan
    if (e.button === 1) {
      e.preventDefault();
      const css = getCSS(e);
      setDragState({ kind: 'pan', startPanX: viewRef.current.panX, startPanY: viewRef.current.panY, startMouseX: css.x, startMouseY: css.y });
      return;
    }

    const { x, y } = getPos(e);

    if (mode === 'opening') {
      // 既存開口クリック → 選択 or ドラッグ開始
      const hitOp = hitOpening(x, y);
      if (hitOp) {
        selectOpening(hitOp.id);
        setDragState({ kind: 'move-opening', openingId: hitOp.id, startWX: x, startWY: y, origCX: hitOp.canvasX, origCY: hitOp.canvasY });
        return;
      }

      // 壁スナップして新規追加
      const wall = findNearestWall(rooms, x, y);
      if (wall) {
        const isDoor = openingKind === 'door';
        const isColumn = openingKind === 'column';
        addOpening({
          id: crypto.randomUUID(),
          kind: openingKind,
          canvasX: wall.canvasX,
          canvasY: wall.canvasY,
          wallAxis: wall.wallAxis,
          widthPx: isDoor ? DEFAULT_DOOR_W : isColumn ? DEFAULT_COL_W : DEFAULT_WIN_W,
          depthPx: isColumn ? DEFAULT_COL_W : undefined,
          height: isDoor ? 2.0 : isColumn ? 2.4 : 1.1,
          sillHeight: isDoor || isColumn ? 0 : 0.9,
        });
        selectOpening(null);
      }
      return;
    }

    if (mode === 'draw') {
      setDragState({ kind: 'draw', startX: x, startY: y, currentX: x, currentY: y });
      return;
    }

    // edit mode: check handles of selected room first
    if (selectedRoomId) {
      const sel = rooms.find((r) => r.id === selectedRoomId);
      if (sel) {
        const corner = hitCorner(sel, x, y);
        if (corner) {
          setDragState({ kind: 'resize', roomId: sel.id, corner, orig: { ...sel }, startX: x, startY: y });
          return;
        }
      }
    }

    const hit = hitRoom(x, y);
    if (hit) {
      selectRoom(hit.id);
      setDragState({ kind: 'move', roomId: hit.id, offsetX: x - hit.x, offsetY: y - hit.y });
    } else {
      selectRoom(null);
    }
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const css = getCSS(e);
    const { x, y } = cssPxToWorld(css, viewRef.current);

    if (dragState?.kind === 'pan') {
      setView((prev) => ({
        ...prev,
        panX: dragState.startPanX + (css.x - dragState.startMouseX),
        panY: dragState.startPanY + (css.y - dragState.startMouseY),
      }));
      return;
    }

    if (mode === 'opening') {
      if (dragState?.kind === 'move-opening') {
        const dx = x - dragState.startWX;
        const dy = y - dragState.startWY;
        const newCX = dragState.origCX + dx;
        const newCY = dragState.origCY + dy;
        // snap to nearest wall
        const wall = findNearestWall(rooms, newCX, newCY);
        if (wall) {
          updateOpening(dragState.openingId, { canvasX: wall.canvasX, canvasY: wall.canvasY, wallAxis: wall.wallAxis });
        } else {
          updateOpening(dragState.openingId, { canvasX: newCX, canvasY: newCY });
        }
        return;
      }
      setHoverWall(findNearestWall(rooms, x, y));
      return;
    }

    const ds = dragState;
    if (!ds) return;

    if (ds.kind === 'draw') {
      setDragState({ ...ds, currentX: x, currentY: y });
      return;
    }
    if (ds.kind === 'move') {
      updateRoom(ds.roomId, { x: x - ds.offsetX, y: y - ds.offsetY });
      return;
    }
    if (ds.kind === 'resize') {
      const dx = x - ds.startX;
      const dy = y - ds.startY;
      const o = ds.orig;
      const MIN = 20;
      let nx = o.x, ny = o.y, nw = o.width, nh = o.height;
      if (ds.corner === 'tl') {
        nx = Math.min(o.x + dx, o.x + o.width - MIN);
        ny = Math.min(o.y + dy, o.y + o.height - MIN);
        nw = o.width - (nx - o.x);
        nh = o.height - (ny - o.y);
      } else if (ds.corner === 'tr') {
        ny = Math.min(o.y + dy, o.y + o.height - MIN);
        nw = Math.max(o.width + dx, MIN);
        nh = o.height - (ny - o.y);
      } else if (ds.corner === 'bl') {
        nx = Math.min(o.x + dx, o.x + o.width - MIN);
        nw = o.width - (nx - o.x);
        nh = Math.max(o.height + dy, MIN);
      } else {
        nw = Math.max(o.width + dx, MIN);
        nh = Math.max(o.height + dy, MIN);
      }
      updateRoom(ds.roomId, { x: nx, y: ny, width: nw, height: nh });
    }
  };

  const onMouseUp = () => {
    const ds = dragState;
    if (ds?.kind === 'draw') {
      const w = Math.abs(ds.currentX - ds.startX);
      const h = Math.abs(ds.currentY - ds.startY);
      if (w > 10 && h > 10) {
        const name = roomName.trim() || `部屋${rooms.length + 1}`;
        addRoom({
          id: crypto.randomUUID(),
          name,
          x: Math.min(ds.startX, ds.currentX),
          y: Math.min(ds.startY, ds.currentY),
          width: w, height: h,
          color: ROOM_COLORS[colorIndex.current++ % ROOM_COLORS.length],
        });
        setRoomName('');
      }
    }
    setDragState(null);
  };

  // fit-to-view: show all rooms in canvas
  const fitToView = useCallback(() => {
    if (rooms.length === 0) { setView({ scale: 1, panX: 0, panY: 0 }); return; }
    const xs = rooms.flatMap((r) => [r.x, r.x + r.width]);
    const ys = rooms.flatMap((r) => [r.y, r.y + r.height]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const pad = 20;
    const scaleX = (CANVAS_W - pad * 2) / (maxX - minX || 1);
    const scaleY = (CANVAS_H - pad * 2) / (maxY - minY || 1);
    const s = Math.min(scaleX, scaleY, 4);
    const panX = pad + (CANVAS_W - pad * 2 - (maxX - minX) * s) / 2 - minX * s;
    const panY = pad + (CANVAS_H - pad * 2 - (maxY - minY) * s) / 2 - minY * s;
    setView({ scale: s, panX, panY });
  }, [rooms]);

  // keyboard: Delete removes selected room / opening
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedOpeningId) { removeOpening(selectedOpeningId); return; }
        if (selectedRoomId) removeRoom(selectedRoomId);
      }
      if (e.key === 'Escape') { selectRoom(null); selectOpening(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRoomId, removeRoom, selectRoom, selectedOpeningId, removeOpening, selectOpening]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzeMsg('');
    setFloorPlanImage(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleAutoDetect = () => {
    if (!bgImageRef.current) return;
    setAnalyzing(true); setAnalyzeMsg('');
    setTimeout(() => {
      try {
        const detected = analyzeFloorPlan(bgImageRef.current!, CANVAS_W, CANVAS_H);
        if (detected.length === 0) {
          setAnalyzeMsg('部屋を検出できませんでした。白背景＋黒壁の間取り図をお試しください。');
        } else {
          detected.forEach((r) => addRoom(r));
          setAnalyzeMsg(`✓ ${detected.length} 部屋を検出しました`);
        }
      } catch { setAnalyzeMsg('解析中にエラーが発生しました。'); }
      finally { setAnalyzing(false); }
    }, 0);
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // cursor style
  const canvasCursor = (() => {
    if (dragState?.kind === 'pan') return 'grabbing';
    if (mode === 'edit') return 'default';
    if (mode === 'opening') return 'crosshair';
    return 'crosshair';
  })();

  return (
    <div className="floor-plan-editor">
      <h3>間取りエディタ</h3>

      {/* 画像アップロード */}
      <div className="upload-area">
        <label className="upload-btn">
          画像をアップロード
          <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
        </label>
        {floorPlanImage && (
          <button className="clear-btn" onClick={() => setFloorPlanImage(null)}>✕ 削除</button>
        )}
      </div>

      {floorPlanImage && (
        <div className="auto-detect-area">
          <button className="auto-detect-btn" onClick={handleAutoDetect} disabled={analyzing}>
            {analyzing ? '解析中…' : '自動検出'}
          </button>
          {analyzeMsg && (
            <p className={`analyze-msg ${analyzeMsg.startsWith('✓') ? 'ok' : 'err'}`}>{analyzeMsg}</p>
          )}
          <p className="hint" style={{ marginTop: 4 }}>※ 白背景＋黒線の間取り図向け</p>
        </div>
      )}

      {/* モード切り替え */}
      <div className="mode-toggle">
        <button className={`mode-btn ${mode === 'draw' ? 'active' : ''}`} onClick={() => { setMode('draw'); selectRoom(null); setHoverWall(null); }}>
          ✏ 描く
        </button>
        <button className={`mode-btn ${mode === 'edit' ? 'active' : ''}`} onClick={() => { setMode('edit'); setHoverWall(null); }}>
          ✦ 編集
        </button>
        <button className={`mode-btn ${mode === 'opening' ? 'active' : ''}`} onClick={() => { setMode('opening'); selectRoom(null); }}>
          🚪 建具
        </button>
      </div>

      {/* 建具モードのコントロール */}
      {mode === 'opening' && (
        <div className="opening-controls">
          <div className="opening-kind-toggle">
            <button
              className={`opening-kind-btn ${openingKind === 'door' ? 'active' : ''}`}
              onClick={() => setOpeningKind('door')}
            >🚪 ドア</button>
            <button
              className={`opening-kind-btn ${openingKind === 'window' ? 'active' : ''}`}
              onClick={() => setOpeningKind('window')}
            >🪟 窓</button>
            <button
              className={`opening-kind-btn ${openingKind === 'column' ? 'active' : ''}`}
              onClick={() => setOpeningKind('column')}
            >🏛 柱</button>
          </div>
          <p className="hint">壁の近くをクリックして配置　ドラッグで移動　Deleteで削除</p>
          {/* 建具リスト */}
          {openings.length > 0 && (
            <div className="opening-list">
              {openings.map((op) => (
                <div
                  key={op.id}
                  className={`opening-chip ${op.id === selectedOpeningId ? 'selected' : ''}`}
                  onClick={() => selectOpening(op.id === selectedOpeningId ? null : op.id)}
                >
                  <span style={{ color: op.kind === 'door' ? '#d4904a' : op.kind === 'window' ? '#88d4ff' : '#aaaaaa' }}>
                    {op.kind === 'door' ? '🚪' : op.kind === 'window' ? '🪟' : '🏛'}
                  </span>
                  <span className="opening-chip-label">
                    {op.kind === 'door' ? 'ドア' : op.kind === 'window' ? '窓' : '柱'}{' '}
                    {Math.round(op.widthPx * 50)}
                    {op.kind === 'column' ? `×${Math.round((op.depthPx ?? op.widthPx) * 50)}` : ''}
                    mm
                  </span>
                  <button
                    className="remove-btn"
                    onClick={(e) => { e.stopPropagation(); removeOpening(op.id); }}
                    title="削除"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          {/* 選択中の建具プロパティ */}
          {(() => {
            const sel = openings.find((o) => o.id === selectedOpeningId);
            if (!sel) return null;
            const widthMM = Math.round(sel.widthPx * 50);
            const depthMM = Math.round((sel.depthPx ?? sel.widthPx) * 50);
            const isColumn = sel.kind === 'column';
            return (
              <div className="opening-props">
                <div className="opening-props-title">
                  {sel.kind === 'door' ? '🚪 ドア' : sel.kind === 'window' ? '🪟 窓' : '🏛 柱'} を編集
                </div>
                <div className="props-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <label className="props-num-label">
                    幅
                    <div className="num-input-row">
                      <input
                        type="number" className="props-num" step="10" min="100" max="4000"
                        value={widthMM}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v >= 100) updateOpening(sel.id, { widthPx: Math.round(v / 50) });
                        }}
                      />
                      <span className="props-unit">mm</span>
                    </div>
                  </label>
                  {isColumn && (
                    <label className="props-num-label">
                      奥行
                      <div className="num-input-row">
                        <input
                          type="number" className="props-num" step="10" min="100" max="4000"
                          value={depthMM}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= 100) updateOpening(sel.id, { depthPx: Math.round(v / 50) });
                          }}
                        />
                        <span className="props-unit">mm</span>
                      </div>
                    </label>
                  )}
                  <label className="props-num-label">
                    高さ
                    <div className="num-input-row">
                      <input
                        type="number" className="props-num" step="10" min="300" max="3000"
                        value={Math.round(sel.height * 1000)}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v >= 300) updateOpening(sel.id, { height: v / 1000 });
                        }}
                      />
                      <span className="props-unit">mm</span>
                    </div>
                  </label>
                  {!isColumn && (
                    <label className="props-num-label">
                      {sel.kind === 'window' ? '窓台高さ' : '床高さ'}
                      <div className="num-input-row">
                        <input
                          type="number" className="props-num" step="10" min="0" max="2500"
                          value={Math.round(sel.sillHeight * 1000)}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= 0) updateOpening(sel.id, { sillHeight: v / 1000 });
                          }}
                        />
                        <span className="props-unit">mm</span>
                      </div>
                    </label>
                  )}
                </div>
                <MetaEditor
                  meta={sel.meta}
                  onChange={(meta) => updateOpening(sel.id, { meta })}
                />
              </div>
            );
          })()}
        </div>
      )}

      {/* 描くモードの部屋名入力 */}
      {mode === 'draw' && (
        <div className="room-name-row">
          <input
            type="text"
            placeholder="部屋名（例：リビング）"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            className="room-name-input"
          />
          <p className="hint">ドラッグして部屋を描く</p>
        </div>
      )}

      {/* 編集モードのプロパティパネル */}
      {mode === 'edit' && selectedRoom && (
        <div className="room-props">
          <div className="props-row">
            <label>名前</label>
            <input
              className="props-input"
              value={selectedRoom.name}
              onChange={(e) => updateRoom(selectedRoom.id, { name: e.target.value })}
            />
          </div>
          <div className="props-grid">
            {(
              [
                { label: 'X (mm)', key: 'x' as const, toM: true },
                { label: 'Y (mm)', key: 'y' as const, toM: true },
                { label: 'W (mm)', key: 'width' as const, toM: true },
                { label: 'H (mm)', key: 'height' as const, toM: true },
              ] as const
            ).map(({ label, key, toM }) => (
              <label key={key} className="props-num-label">
                {label}
                <input
                  type="number"
                  className="props-num"
                  step="100"
                  min={key === 'width' || key === 'height' ? 100 : undefined}
                  value={toM ? Math.round(selectedRoom[key] / PX_PER_M * 1000) : selectedRoom[key]}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (isNaN(v)) return;
                    updateRoom(selectedRoom.id, { [key]: toM ? (v / 1000) * PX_PER_M : v });
                  }}
                />
              </label>
            ))}
          </div>
          <p className="hint" style={{ marginTop: 4 }}>角ドラッグでリサイズ　Delete で削除</p>
          <MetaEditor
            meta={selectedRoom.meta}
            onChange={(meta) => updateRoom(selectedRoom.id, { meta })}
          />
        </div>
      )}
      {mode === 'edit' && !selectedRoom && (
        <p className="hint" style={{ marginTop: 4 }}>部屋をクリックして選択</p>
      )}

      {/* キャンバス + ズームコントロール */}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className="floor-canvas"
          style={{ cursor: canvasCursor }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => { onMouseUp(); setHoverWall(null); }}
          onContextMenu={(e) => e.preventDefault()}
        />
        {/* zoom buttons */}
        <div style={{ position: 'absolute', bottom: 18, right: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <button
            className="zoom-btn"
            title="拡大"
            onClick={() => setView((v) => {
              const f = 1.25;
              const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
              const ns = Math.min(8, v.scale * f);
              return { scale: ns, panX: cx - (cx - v.panX) * (ns / v.scale), panY: cy - (cy - v.panY) * (ns / v.scale) };
            })}
          >＋</button>
          <button
            className="zoom-btn"
            title="縮小"
            onClick={() => setView((v) => {
              const f = 1 / 1.25;
              const cx = CANVAS_W / 2, cy = CANVAS_H / 2;
              const ns = Math.max(0.3, v.scale * f);
              return { scale: ns, panX: cx - (cx - v.panX) * (ns / v.scale), panY: cy - (cy - v.panY) * (ns / v.scale) };
            })}
          >－</button>
          <button
            className="zoom-btn"
            title="全体表示"
            onClick={fitToView}
          >⊡</button>
        </div>
      </div>

      {/* 部屋リスト */}
      {rooms.length > 0 && (
        <div className="room-list-header">
          <span className="room-list-hint">名前をダブルクリックで編集</span>
        </div>
      )}
      <div className="room-list">
        {rooms.map((room) => (
          <div
            key={room.id}
            className={`room-chip ${room.id === selectedRoomId ? 'selected' : ''}`}
            style={{ borderColor: room.color }}
            onClick={() => { if (mode === 'edit') selectRoom(room.id); }}
          >
            <span style={{ color: room.color }}>■</span>

            {editingRoomId === room.id ? (
              <input
                className="room-name-inline"
                autoFocus
                value={room.name}
                onChange={(e) => updateRoom(room.id, { name: e.target.value })}
                onBlur={() => setEditingRoomId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') setEditingRoomId(null);
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="room-chip-name"
                onDoubleClick={(e) => { e.stopPropagation(); setEditingRoomId(room.id); }}
                title="ダブルクリックで名前を編集"
              >
                {room.name}
              </span>
            )}

            <button onClick={(e) => { e.stopPropagation(); removeRoom(room.id); }} className="remove-btn">✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
