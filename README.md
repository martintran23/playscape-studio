# PlayScape Studio (Frontend MVP)

Web-based 3D park layout planner MVP built with React + Vite + React Three Fiber.

## Tech Stack

- React (Vite)
- React Three Fiber + Drei + Three.js
- Zustand
- Tailwind CSS
- Mapbox (geocoding, satellite / terrain-rgb tiles) when configured

## Project Structure

```txt
playscape-studio/
  public/models/          # GLB playground assets
  src/
    components/
      Model/              # PlacedObject, ModelAsset, lazy GLB load
      Scene/              # ParkScene, FocusCameraIntro
      Sidebar/            # ModelLibraryPanel
      TerrainGround.jsx   # Stitched satellite + DEM mesh
      AreaSelectionOverlay.jsx
      FocusRegionVeil.jsx
      ...
    pages/                # LocationSelectionPage, EditorPage, FocusEditorPage
    store/                # sceneStore, locationStore
    utils/                # sceneRules, stitchGeoreference, focusRegion, polygon2d, mapbox*
    App.jsx
    main.jsx
  ...
```

## MVP Features Implemented

1. **Location flow:** Pick a place on `/`, open the 3D editor on `/editor` (Mapbox geocoding when `VITE_MAPBOX_ACCESS_TOKEN` or `VITE_MAPBOX_TOKEN` is set; otherwise mock suggestions).
2. **3D park editor:** Georeferenced terrain (stitched Mapbox satellite + terrain-rgb), orbit camera, grid and backdrop tuned for the main scene.
3. **Model library:** Multiple playground GLBs from `public/models/`; click terrain to place; transform gizmos for move/rotate; delete; snap and boundary rules in the main editor.
4. **Area selection (main editor):** Draw a closed polygon on the ground, then **Enter design mode** for a focused view on that region (`/focus-editor`).
5. **Focused design mode (prototype):** Tighter terrain stitch, placement constrained to the selected polygon, region veil and outline. Scale vs real-world imagery is still being tuned.
6. **Persistence:** Save/load placed objects via `localStorage` (main scene).

## Notes

- Set `VITE_MAPBOX_ACCESS_TOKEN` or `VITE_MAPBOX_TOKEN` in `.env.local` (see `.env.example`) for search and terrain; restart the dev server after changes.
- `save` / `load` use browser `localStorage` and can later be replaced with API endpoints.
