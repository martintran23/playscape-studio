import { create } from "zustand";
import {
  BOUNDARY_LIMIT,
  DEFAULT_ROTATION_SNAP,
  DEFAULT_TRANSLATION_SNAP,
  canPlaceAt,
  normalizeTransform,
} from "../utils/sceneRules";

/** Files in /public/models/ — use encodeURIComponent for names with spaces. */
function publicModel(fileName) {
  return `/models/${encodeURIComponent(fileName)}`;
}

/**
 * Playground equipment catalog. GLBs live in public/models/.
 *
 * `fitMaxDimensionMeters` — largest axis of the model’s bounding box is scaled to this many meters
 * (sources mix cm/m/arbitrary units). Multiply with `scale` for fine-tuning.
 * `radius` — rough placement footprint (meters) for overlap checks.
 */
const MODEL_LIBRARY = [
  {
    id: "slide",
    name: "Slide",
    modelPath: publicModel("Slide.glb"),
    color: "#f97316",
    fitMaxDimensionMeters: 7,
    radius: 3,
    scale: 1,
  },
  {
    id: "swing",
    name: "Swing set",
    modelPath: publicModel("Swing set.glb"),
    color: "#22c55e",
    fitMaxDimensionMeters: 4.5,
    radius: 2.5,
    scale: 1,
  },
  {
    id: "seesaw",
    name: "Seesaw",
    modelPath: publicModel("Seesaw.glb"),
    color: "#3b82f6",
    fitMaxDimensionMeters: 4.5,
    radius: 2,
    scale: 1,
  },
  {
    id: "jungleGym",
    name: "Jungle gym",
    modelPath: publicModel("Jungle gym.glb"),
    color: "#a855f7",
    fitMaxDimensionMeters: 11,
    radius: 4.5,
    scale: 1,
  },
  {
    id: "playStructure",
    name: "Play structure",
    modelPath: publicModel("Play Structure.glb"),
    color: "#eab308",
    fitMaxDimensionMeters: 16,
    radius: 6.5,
    scale: 1,
  },
  {
    id: "basketballCourt",
    name: "Basketball court",
    modelPath: publicModel("Basketball court.glb"),
    color: "#ea580c",
    fitMaxDimensionMeters: 22,
    radius: 12,
    scale: 1,
  },
];

const STORAGE_KEY = "playscape.scene.v1";

const useSceneStore = create((set, get) => ({
  models: MODEL_LIBRARY,
  placedObjects: [],
  activeModelId: MODEL_LIBRARY[0].id,
  selectedObjectId: null,
  transformMode: "translate",
  boundaryLimit: BOUNDARY_LIMIT,
  translationSnap: DEFAULT_TRANSLATION_SNAP,
  rotationSnap: DEFAULT_ROTATION_SNAP,
  /** Georeferencing origin for placements (updates when map recenters on pan). */
  mapCenterLat: null,
  mapCenterLng: null,
  setMapCenter: ({ latitude, longitude }) => set({ mapCenterLat: latitude, mapCenterLng: longitude }),
  /** three.js terrain mesh for raycast height snapping */
  terrainMesh: null,
  setTerrainMesh: (mesh) => set({ terrainMesh: mesh }),
  terrainVerticalExaggeration: 1,
  setTerrainVerticalExaggeration: (value) => set({ terrainVerticalExaggeration: Math.max(0.25, Math.min(4, value)) }),

  setActiveModel: (modelId) => set({ activeModelId: modelId }),
  setTransformMode: (mode) => set({ transformMode: mode }),
  setBoundaryLimit: (value) => set({ boundaryLimit: value }),
  shiftSceneOrigin: ({ offsetX, offsetZ }) =>
    set((state) => ({
      placedObjects: state.placedObjects.map((object) => ({
        ...object,
        position: [object.position[0] - offsetX, object.position[1], object.position[2] - offsetZ],
      })),
    })),

  addObjectAt: ({ modelId, position, geoPosition = null }) =>
    set((state) => {
      const model = state.models.find((entry) => entry.id === modelId);
      if (!model) return state;

      const transform = normalizeTransform({
        position,
        rotation: [0, 0, 0],
        translationSnap: state.translationSnap,
        rotationSnap: state.rotationSnap,
        boundaryLimit: state.boundaryLimit,
      });

      const isAllowed = canPlaceAt({
        candidatePosition: transform.position,
        candidateRadius: model.radius,
        objects: state.placedObjects,
        modelById: Object.fromEntries(state.models.map((entry) => [entry.id, entry])),
        boundaryLimit: state.boundaryLimit,
      });

      if (!isAllowed) {
        return { ...state, selectedObjectId: null };
      }

      const newObject = {
        id: crypto.randomUUID(),
        modelId,
        position: transform.position,
        rotation: transform.rotation,
        geoPosition,
      };

      return {
        placedObjects: [...state.placedObjects, newObject],
        selectedObjectId: newObject.id,
      };
    }),

  selectObject: (objectId) => set({ selectedObjectId: objectId }),

  updateObjectTransform: ({ id, position, rotation }) =>
    set((state) => ({
      placedObjects: state.placedObjects.map((object) => {
        if (object.id !== id) return object;

        const modelById = Object.fromEntries(state.models.map((entry) => [entry.id, entry]));
        const model = modelById[object.modelId];
        if (!model) return object;

        const transform = normalizeTransform({
          position: position ?? object.position,
          rotation: rotation ?? object.rotation,
          translationSnap: state.translationSnap,
          rotationSnap: state.rotationSnap,
          boundaryLimit: state.boundaryLimit,
        });

        const isAllowed = canPlaceAt({
          candidatePosition: transform.position,
          candidateRadius: model.radius,
          objects: state.placedObjects.filter((entry) => entry.id !== id),
          modelById,
          boundaryLimit: state.boundaryLimit,
        });

        if (!isAllowed) return object;

        return { ...object, position: transform.position, rotation: transform.rotation };
      }),
    })),

  rotateSelected: (deltaRadians) =>
    set((state) => ({
      placedObjects: state.placedObjects.map((object) =>
        object.id === state.selectedObjectId
          ? {
              ...object,
              rotation: [object.rotation[0], object.rotation[1] + deltaRadians, object.rotation[2]],
            }
          : object,
      ),
    })),

  removeSelected: () =>
    set((state) => ({
      placedObjects: state.placedObjects.filter((object) => object.id !== state.selectedObjectId),
      selectedObjectId: null,
    })),

  saveScene: () => {
    const state = get();
    const payload = {
      placedObjects: state.placedObjects,
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  },

  loadScene: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      if (!parsed?.placedObjects || !Array.isArray(parsed.placedObjects)) return;

      set({
        placedObjects: parsed.placedObjects,
        selectedObjectId: null,
      });
    } catch {
      // Ignore invalid JSON and keep current state.
    }
  },
}));

export default useSceneStore;
