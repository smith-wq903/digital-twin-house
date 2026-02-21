import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { temporal } from 'zundo';
import type { HouseStore, Room, Furniture, MeasurePoint, Opening } from '../types';

/** 家具に rotation / elevation がない旧データに対してデフォルトを補完 */
function normalizeFurniture(f: Partial<Furniture> & Pick<Furniture, 'id'>): Furniture {
  return {
    rotation: 0,
    elevation: 0,
    ...f,
  } as Furniture;
}

export const useHouseStore = create<HouseStore>()(
  temporal(
  persist(
  (set) => ({
  rooms: [],
  furniture: [],
  openings: [],
  selectedFurnitureId: null,
  selectedRoomId: null,
  selectedOpeningId: null,
  floorPlanImage: null,
  measureMode: false,
  measurePoints: [],
  measureHeights: [0, 0],

  addRoom: (room: Room) =>
    set((s) => ({ rooms: [...s.rooms, room] })),

  updateRoom: (id, patch) =>
    set((s) => ({
      rooms: s.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    })),

  removeRoom: (id) =>
    set((s) => ({
      rooms: s.rooms.filter((r) => r.id !== id),
      selectedRoomId: s.selectedRoomId === id ? null : s.selectedRoomId,
    })),

  selectRoom: (id) => set({ selectedRoomId: id }),

  addFurniture: (item: Furniture) =>
    set((s) => ({ furniture: [...s.furniture, normalizeFurniture(item)] })),

  updateFurniture: (id, patch) =>
    set((s) => ({
      furniture: s.furniture.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),

  updateFurniturePosition: (id, position) =>
    set((s) => ({
      furniture: s.furniture.map((f) => (f.id === id ? { ...f, position } : f)),
    })),

  /** サイズ変更時に elevation を考慮して Y 座標を補正 */
  updateFurnitureSize: (id, size) =>
    set((s) => ({
      furniture: s.furniture.map((f) => {
        if (f.id !== id) return f;
        const elev = f.elevation ?? 0;
        const newY = elev + size[1] / 2;
        return { ...f, size, position: [f.position[0], newY, f.position[2]] };
      }),
    })),

  /** 高さ位置（elevation）変更時に Y 座標を自動補正 */
  updateFurnitureElevation: (id, elevation) =>
    set((s) => ({
      furniture: s.furniture.map((f) => {
        if (f.id !== id) return f;
        const newY = elevation + f.size[1] / 2;
        return { ...f, elevation, position: [f.position[0], newY, f.position[2]] };
      }),
    })),

  removeFurniture: (id) =>
    set((s) => ({
      furniture: s.furniture.filter((f) => f.id !== id),
      selectedFurnitureId: s.selectedFurnitureId === id ? null : s.selectedFurnitureId,
    })),

  selectFurniture: (id) => set({ selectedFurnitureId: id }),

  setFloorPlanImage: (url) => set({ floorPlanImage: url }),

  setMeasureMode: (on) =>
    set({ measureMode: on, measurePoints: [], measureHeights: [0, 0] }),

  addMeasurePoint: (pt: MeasurePoint) =>
    set((s) => {
      if (s.measurePoints.length >= 2) {
        return { measurePoints: [pt], measureHeights: [0, 0] };
      }
      return { measurePoints: [...s.measurePoints, pt] };
    }),

  clearMeasurePoints: () => set({ measurePoints: [], measureHeights: [0, 0] }),

  setMeasureHeight: (index, height) =>
    set((s) => {
      const next: [number, number] = [...s.measureHeights] as [number, number];
      next[index] = height;
      return { measureHeights: next };
    }),

  addOpening: (o: Opening) =>
    set((s) => ({ openings: [...s.openings, o] })),

  updateOpening: (id, patch) =>
    set((s) => ({
      openings: s.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    })),

  removeOpening: (id) =>
    set((s) => ({
      openings: s.openings.filter((o) => o.id !== id),
      selectedOpeningId: s.selectedOpeningId === id ? null : s.selectedOpeningId,
    })),

  selectOpening: (id) => set({ selectedOpeningId: id }),

  importState: (rooms, furniture, openings = []) =>
    set({
      rooms,
      furniture: furniture.map(normalizeFurniture),
      openings,
      selectedRoomId: null,
      selectedFurnitureId: null,
      selectedOpeningId: null,
      measurePoints: [],
      measureHeights: [0, 0],
    }),
  }),
  {
    name: 'digital-twin-house',
    // UI状態・大きなバイナリは除外し、間取りデータだけを永続化
    partialize: (state) => ({
      rooms: state.rooms,
      furniture: state.furniture,
      openings: state.openings,
    }),
  }
  ),
  {
    // Undo/Redo の対象：間取りデータのみ（UI選択状態などは除外）
    partialize: (state) => ({
      rooms: state.rooms,
      furniture: state.furniture,
      openings: state.openings,
    }),
    limit: 100, // 最大100ステップ
  }
));
