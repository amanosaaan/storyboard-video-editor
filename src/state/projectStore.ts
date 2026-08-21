import { nanoid } from 'nanoid';
import { create } from 'zustand';
import type { AspectRatio, Layer, MediaAsset, Project, Scene } from '../domain/types';
import { ASPECT_RATIO_RESOLUTIONS } from '../domain/types';

interface EditorState {
  project: Project | null;
  selectedLayerId: string | null;

  loadProject: (project: Project) => void;
  closeProject: () => void;

  addScene: () => string | null;
  removeScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => string | null;
  reorderScenes: (fromIndex: number, toIndex: number) => void;
  updateSceneDuration: (sceneId: string, duration: number) => void;
  updateScene: (sceneId: string, patch: Partial<Scene>) => void;

  addMediaAsset: (asset: MediaAsset) => void;
  removeMediaAsset: (mediaId: string) => void;

  addLayerToScene: (sceneId: string, layer: Layer) => void;
  updateLayer: (sceneId: string, layerId: string, patch: Partial<Layer>) => void;
  removeLayer: (sceneId: string, layerId: string) => void;
  selectLayer: (layerId: string | null) => void;

  renameProject: (name: string) => void;
  setAspectRatio: (ratio: AspectRatio) => void;
}

function touch(): Pick<Project, 'updatedAt'> {
  return { updatedAt: Date.now() };
}

function emptyScene(): Scene {
  return { id: nanoid(), duration: 5000, layers: [] };
}

export const useProjectStore = create<EditorState>((set, get) => ({
  project: null,
  selectedLayerId: null,

  loadProject: (project) => set({ project, selectedLayerId: null }),

  closeProject: () => set({ project: null, selectedLayerId: null }),

  addScene: () => {
    const state = get();
    if (!state.project) return null;
    const scene = emptyScene();
    set({
      project: { ...state.project, scenes: [...state.project.scenes, scene], ...touch() },
      selectedLayerId: null,
    });
    return scene.id;
  },

  removeScene: (sceneId) =>
    set((state) => {
      if (!state.project) return state;
      const scenes = state.project.scenes.filter((s) => s.id !== sceneId);
      if (scenes.length === 0) scenes.push(emptyScene());
      const project = { ...state.project, scenes, ...touch() };
      return { project, selectedLayerId: null };
    }),

  duplicateScene: (sceneId) => {
    const state = get();
    if (!state.project) return null;
    const index = state.project.scenes.findIndex((s) => s.id === sceneId);
    if (index === -1) return null;
    const original = state.project.scenes[index];
    const copy: Scene = {
      ...original,
      id: nanoid(),
      layers: original.layers.map((l) => ({ ...l, id: nanoid() })),
    };
    const scenes = [...state.project.scenes];
    scenes.splice(index + 1, 0, copy);
    set({ project: { ...state.project, scenes, ...touch() }, selectedLayerId: null });
    return copy.id;
  },

  reorderScenes: (fromIndex, toIndex) =>
    set((state) => {
      if (!state.project) return state;
      const scenes = [...state.project.scenes];
      const [moved] = scenes.splice(fromIndex, 1);
      scenes.splice(toIndex, 0, moved);
      const project = { ...state.project, scenes, ...touch() };
      return { project };
    }),

  updateSceneDuration: (sceneId, duration) =>
    set((state) => {
      if (!state.project) return state;
      const scenes = state.project.scenes.map((s) => (s.id === sceneId ? { ...s, duration } : s));
      const project = { ...state.project, scenes, ...touch() };
      return { project };
    }),

  updateScene: (sceneId, patch) =>
    set((state) => {
      if (!state.project) return state;
      const scenes = state.project.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s));
      const project = { ...state.project, scenes, ...touch() };
      return { project };
    }),

  addMediaAsset: (asset) =>
    set((state) => {
      if (!state.project) return state;
      const project = {
        ...state.project,
        mediaLibrary: [...state.project.mediaLibrary, asset],
        ...touch(),
      };
      return { project };
    }),

  removeMediaAsset: (mediaId) =>
    set((state) => {
      if (!state.project) return state;
      const project = {
        ...state.project,
        mediaLibrary: state.project.mediaLibrary.filter((m) => m.id !== mediaId),
        scenes: state.project.scenes.map((s) => ({
          ...s,
          layers: s.layers.filter((l) => !('mediaId' in l) || l.mediaId !== mediaId),
        })),
        ...touch(),
      };
      return { project };
    }),

  addLayerToScene: (sceneId, layer) =>
    set((state) => {
      if (!state.project) return state;
      const scenes = state.project.scenes.map((s) =>
        s.id === sceneId ? { ...s, layers: [...s.layers, layer] } : s,
      );
      const project = { ...state.project, scenes, ...touch() };
      return { project, selectedLayerId: layer.id };
    }),

  updateLayer: (sceneId, layerId, patch) =>
    set((state) => {
      if (!state.project) return state;
      const scenes = state.project.scenes.map((s) =>
        s.id !== sceneId
          ? s
          : {
              ...s,
              layers: s.layers.map((l) => (l.id === layerId ? ({ ...l, ...patch } as Layer) : l)),
            },
      );
      const project = { ...state.project, scenes, ...touch() };
      return { project };
    }),

  removeLayer: (sceneId, layerId) =>
    set((state) => {
      if (!state.project) return state;
      const scenes = state.project.scenes.map((s) =>
        s.id !== sceneId ? s : { ...s, layers: s.layers.filter((l) => l.id !== layerId) },
      );
      const project = { ...state.project, scenes, ...touch() };
      const selectedLayerId = get().selectedLayerId === layerId ? null : get().selectedLayerId;
      return { project, selectedLayerId };
    }),

  selectLayer: (layerId) => set({ selectedLayerId: layerId }),

  renameProject: (name) =>
    set((state) => {
      if (!state.project) return state;
      return { project: { ...state.project, name, ...touch() } };
    }),

  setAspectRatio: (aspectRatio) =>
    set((state) => {
      if (!state.project) return state;
      return {
        project: {
          ...state.project,
          aspectRatio,
          resolution: ASPECT_RATIO_RESOLUTIONS[aspectRatio],
          ...touch(),
        },
      };
    }),
}));
