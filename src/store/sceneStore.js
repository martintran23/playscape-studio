import { create } from "zustand";
import {
  BOUNDARY_LIMIT,
  DEFAULT_ROTATION_SNAP,
  DEFAULT_TRANSLATION_SNAP,
  canPlaceAt,
  normalizeTransform,
} from "../utils/sceneRules";
import { pointInPolygon2D } from "../utils/polygon2d";

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
    fitMaxDimensionMeters: 5.5,
    radius: 2.4,
    scale: 1,
  },
  {
    id: "swing",
    name: "Swing set",
    modelPath: publicModel("Swing set.glb"),
    color: "#22c55e",
    fitMaxDimensionMeters: 3.8,
    radius: 1.8,
    scale: 1,
  },
  {
    id: "seesaw",
    name: "Seesaw",
    modelPath: publicModel("Seesaw.glb"),
    color: "#3b82f6",
    fitMaxDimensionMeters: 3.5,
    radius: 1.5,
    scale: 1,
  },
  {
    id: "jungleGym",
    name: "Jungle gym",
    modelPath: publicModel("Jungle gym.glb"),
    color: "#a855f7",
    fitMaxDimensionMeters: 7.5,
    radius: 3.2,
    scale: 1,
  },
  {
    id: "playStructure",
    name: "Play structure",
    modelPath: publicModel("Play Structure.glb"),
    color: "#eab308",
    fitMaxDimensionMeters: 10,
    radius: 4.5,
    scale: 1,
  },
  {
    id: "basketballCourt",
    name: "Basketball court",
    modelPath: publicModel("Basketball court.glb"),
    color: "#ea580c",
    fitMaxDimensionMeters: 17,
    radius: 9,
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
  /** Updated by ParkScene for focus-region build (world ↔ tile mapping). */
  lastStitchLayout: null,
  setLastStitchLayout: (layout) => set({ lastStitchLayout: layout }),
  /** three.js terrain mesh for raycast height snapping */
  terrainMesh: null,
  setTerrainMesh: (mesh) => set({ terrainMesh: mesh }),
  /** Incremented after terrain vertices are displaced so draped content re-raycasts to real Y. */
  terrainSurfaceEpoch: 0,
  bumpTerrainSurface: () => set((s) => ({ terrainSurfaceEpoch: s.terrainSurfaceEpoch + 1 })),
  terrainVerticalExaggeration: 1,
  setTerrainVerticalExaggeration: (value) => set({ terrainVerticalExaggeration: Math.max(0.25, Math.min(4, value)) }),
  /** >1 exaggerates larger relief vs flats (visual only). */
  terrainHeightCurveExponent: 1.16,
  setTerrainHeightCurveExponent: (value) =>
    set({ terrainHeightCurveExponent: Math.max(1, Math.min(1.45, value)) }),
  /** Debug iso-contours on the draped terrain grid. */
  terrainDebugContours: false,
  setTerrainDebugContours: (value) => set({ terrainDebugContours: Boolean(value) }),

  /** Area outline on main editor terrain ({x,y,z} world space). */
  areaSelectionActive: false,
  setAreaSelectionActive: (value) => set({ areaSelectionActive: Boolean(value) }),
  selectedAreaPoints: [],
  selectedAreaClosed: false,
  addSelectedAreaPoint: (point) =>
    set((state) => {
      if (state.selectedAreaClosed) return state;
      return { selectedAreaPoints: [...state.selectedAreaPoints, point] };
    }),
  setSelectedAreaClosed: (value) => set({ selectedAreaClosed: Boolean(value) }),
  resetSelectedArea: () =>
    set({
      selectedAreaPoints: [],
      selectedAreaClosed: false,
    }),

  /** `main` = full park editor; `focus` = constrained polygon region. */
  placementContext: "main",
  setPlacementContext: (value) => set({ placementContext: value === "focus" ? "focus" : "main" }),
  /** Focus-only: cropped terrain + placement polygon (local XZ, origin at region center). */
  focusDesign: null,
  setFocusDesign: (payload) => set({ focusDesign: payload, focusPlacedObjects: [] }),
  focusPlacementPolygon: null,
  setFocusPlacementPolygon: (poly) => set({ focusPlacementPolygon: poly }),
  focusPlacedObjects: [],
  clearFocusScene: () =>
    set({
      focusPlacedObjects: [],
      focusPlacementPolygon: null,
      focusDesign: null,
    }),

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

      const isFocus = state.placementContext === "focus";
      const boundary =
        isFocus && state.focusDesign?.groundSize
          ? state.focusDesign.groundSize * 0.52
          : state.boundaryLimit;
      const polygonConstraint = isFocus ? state.focusPlacementPolygon : null;

      const transform = normalizeTransform({
        position,
        rotation: [0, 0, 0],
        translationSnap: state.translationSnap,
        rotationSnap: state.rotationSnap,
        boundaryLimit: boundary,
        skipTranslationSnap: isFocus,
        skipBoundaryClamp: isFocus,
      });

      const objects = isFocus ? state.focusPlacedObjects : state.placedObjects;
      const isAllowed = canPlaceAt({
        candidatePosition: transform.position,
        candidateRadius: model.radius,
        objects,
        modelById: Object.fromEntries(state.models.map((entry) => [entry.id, entry])),
        boundaryLimit: boundary,
        polygonConstraint,
        pointInPolygonFn: pointInPolygon2D,
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

      if (isFocus) {
        return {
          ...state,
          focusPlacedObjects: [...state.focusPlacedObjects, newObject],
          selectedObjectId: newObject.id,
        };
      }

      return {
        ...state,
        placedObjects: [...state.placedObjects, newObject],
        selectedObjectId: newObject.id,
      };
    }),

  selectObject: (objectId) => set({ selectedObjectId: objectId }),

  updateObjectTransform: ({ id, position, rotation }) =>
    set((state) => {
      const isFocus = state.placementContext === "focus";
      const listKey = isFocus ? "focusPlacedObjects" : "placedObjects";
      const objects = state[listKey];
      const boundary =
        isFocus && state.focusDesign?.groundSize
          ? state.focusDesign.groundSize * 0.52
          : state.boundaryLimit;
      const polygonConstraint = isFocus ? state.focusPlacementPolygon : null;

      const next = objects.map((object) => {
        if (object.id !== id) return object;

        const modelById = Object.fromEntries(state.models.map((entry) => [entry.id, entry]));
        const model = modelById[object.modelId];
        if (!model) return object;

        const transform = normalizeTransform({
          position: position ?? object.position,
          rotation: rotation ?? object.rotation,
          translationSnap: state.translationSnap,
          rotationSnap: state.rotationSnap,
          boundaryLimit: boundary,
          skipTranslationSnap: isFocus,
          skipBoundaryClamp: isFocus,
        });

        const isAllowed = canPlaceAt({
          candidatePosition: transform.position,
          candidateRadius: model.radius,
          objects: objects.filter((entry) => entry.id !== id),
          modelById,
          boundaryLimit: boundary,
          polygonConstraint,
          pointInPolygonFn: pointInPolygon2D,
        });

        if (!isAllowed) return object;

        return { ...object, position: transform.position, rotation: transform.rotation };
      });

      return { [listKey]: next };
    }),

  rotateSelected: (deltaRadians) =>
    set((state) => {
      const isFocus = state.placementContext === "focus";
      const key = isFocus ? "focusPlacedObjects" : "placedObjects";
      return {
        [key]: state[key].map((object) =>
          object.id === state.selectedObjectId
            ? {
                ...object,
                rotation: [object.rotation[0], object.rotation[1] + deltaRadians, object.rotation[2]],
              }
            : object,
        ),
      };
    }),

  removeSelected: () =>
    set((state) => {
      const isFocus = state.placementContext === "focus";
      const key = isFocus ? "focusPlacedObjects" : "placedObjects";
      return {
        [key]: state[key].filter((object) => object.id !== state.selectedObjectId),
        selectedObjectId: null,
      };
    }),

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
