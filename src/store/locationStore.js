import { create } from "zustand";

const useLocationStore = create((set) => ({
  selectedLocation: null,
  setLocation: (location) => set({ selectedLocation: location }),
}));

export default useLocationStore;
