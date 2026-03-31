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
        PlacedObject.jsx
      Scene/
        ParkScene.jsx
      Sidebar/
        ModelLibraryPanel.jsx
    store/
      sceneStore.js
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
2. Sidebar model library with 3 mock playground items
3. Click-to-place object on ground plane
4. Object manipulation:
   - Select object
   - Drag object to move position
   - Rotate selected object
   - Delete selected object
5. Scene state in Zustand:
   - `id`, `position`, `rotation`, `modelId`
6. Modular folder architecture for scalability

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

## Notes

- Current model rendering uses placeholder cubes for fast MVP iteration.
- Model metadata already includes GLB paths (`modelPath`) so you can swap in GLTF loading next.
