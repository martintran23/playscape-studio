# PlayScape Studio (Frontend MVP)

Web-based 3D park layout planner MVP built with React + Vite + React Three Fiber.

## Tech Stack

- React (Vite)
- React Three Fiber + Drei + Three.js
- Zustand
- Tailwind CSS

## Project Structure

```txt
playscape-studio/
  src/
    components/
      Model/
        ModelAsset.jsx
        PlacedObject.jsx
        SeesawModel.jsx
        SlideModel.jsx
        SwingModel.jsx
      Scene/
        ParkScene.jsx
      Sidebar/
        ModelLibraryPanel.jsx
    store/
      sceneStore.js
    utils/
      sceneRules.js
    App.jsx
    index.css
    main.jsx
  index.html
  vite.config.js
  tailwind.config.js
  postcss.config.js
```

## MVP Features Implemented

1. 3D scene with:
   - Ground plane
   - Ambient + directional lighting
   - OrbitControls (pan, zoom, rotate)
2. Sidebar model library with 3 real GLB-backed playground items
3. Click-to-place object on ground plane
4. Object manipulation:
   - Select object
   - Transform gizmos (`TransformControls`) for move/rotate
   - Rotation button shortcut
   - Delete selected object
5. Scene state in Zustand:
   - `id`, `position`, `rotation`, `modelId`
6. Placement constraints:
   - Snap-to-grid translation (0.5m)
   - Rotation snapping (22.5deg)
   - Boundary limit ring
   - Collision/overlap prevention
7. Save/load scene JSON using `localStorage`
8. Modular folder architecture + lazy loaded 3D scene/model chunks

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start development server:

   ```bash
   npm run dev
   ```

3. Build for production:

   ```bash
   npm run build
   ```

4. Preview production build:

   ```bash
   npm run preview
   ```

5. Optional: enable live Mapbox location search

   - Copy `.env.example` to `.env.local`
   - Set `VITE_MAPBOX_ACCESS_TOKEN` with your Mapbox public token
   - Restart `npm run dev` after env changes


## Notes

- GLB assets currently load from Khronos sample model URLs for fast MVP testing.
- `save/load` currently uses browser localStorage and is ready to be replaced by FastAPI endpoints later.

## Location Selection Flow

- Entry route `/` shows `LocationSelectionPage`.
- Search and pick a location, then click **Continue** to enter `/editor`.
- Search uses Mapbox Geocoding when `VITE_MAPBOX_ACCESS_TOKEN` is set; otherwise it falls back to mock suggestions.
- Requests are debounced and throttled to reduce API spam.
- Selected location shape:

  ```json
  {
    "name": "string",
    "latitude": 0,
    "longitude": 0
  }
  ```

- Editor route `/editor` requires a selected location and redirects to `/` if missing.
- Scene receives location data and initializes camera position from coordinates.

## Test Checklist

1. Run `npm run dev`.
2. Open `/` and confirm location page appears first.
3. Type in search field, verify loading state and suggestions.
4. Select a location, confirm **Continue** is enabled, then enter editor.
5. Refresh on `/editor`: expected redirect back to `/` (in-memory store reset).
6. Verify existing 3D placement/edit controls still work.
