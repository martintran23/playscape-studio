import { create } from "zustand";

const MODEL_LIBRARY = [
  { id: "slide", name: "Play Slide", modelPath: "/models/slide.glb", color: "#f97316" },
  { id: "swing", name: "Swing Set", modelPath: "/models/swing.glb", color: "#22c55e" },
  { id: "seesaw", name: "Seesaw", modelPath: "/models/seesaw.glb", color: "#3b82f6" },
];

const useSceneStore = create((set) => ({
  models: MODEL_LIBRARY,
  placedObjects: [],
  activeModelId: MODEL_LIBRARY[0].id,
  selectedObjectId: null,

  setActiveModel: (modelId) => set({ activeModelId: modelId }),

  addObjectAt: ({ modelId, position }) =>
    set((state) => {
      const newObject = {
        id: crypto.randomUUID(),
        modelId,
        position,
        rotation: [0, 0, 0],
      };

      return {
        placedObjects: [...state.placedObjects, newObject],
        selectedObjectId: newObject.id,
      };
    }),

  selectObject: (objectId) => set({ selectedObjectId: objectId }),

  updateObjectTransform: ({ id, position, rotation }) =>
    set((state) => ({
      placedObjects: state.placedObjects.map((object) =>
        object.id === id
          ? {
              ...object,
              position: position ?? object.position,
              rotation: rotation ?? object.rotation,
            }
          : object,
      ),
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
}));

export default useSceneStore;
