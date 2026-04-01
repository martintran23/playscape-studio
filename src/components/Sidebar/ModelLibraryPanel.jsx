import { useNavigate } from "react-router-dom";
import useSceneStore from "../../store/sceneStore";
import useLocationStore from "../../store/locationStore";
import { buildFocusStitchFromWorldPolygon } from "../../utils/focusRegion";

function modelFileLabel(modelPath) {
  const base = modelPath.split("/").pop() ?? modelPath;
  try {
    return decodeURIComponent(base);
  } catch {
    return base;
  }
}

function ModelLibraryPanel({ variant = "park" }) {
  const navigate = useNavigate();
  const models = useSceneStore((state) => state.models);
  const activeModelId = useSceneStore((state) => state.activeModelId);
  const setActiveModel = useSceneStore((state) => state.setActiveModel);
  const selectedObjectId = useSceneStore((state) => state.selectedObjectId);
  const rotateSelected = useSceneStore((state) => state.rotateSelected);
  const removeSelected = useSceneStore((state) => state.removeSelected);
  const transformMode = useSceneStore((state) => state.transformMode);
  const setTransformMode = useSceneStore((state) => state.setTransformMode);
  const saveScene = useSceneStore((state) => state.saveScene);
  const loadScene = useSceneStore((state) => state.loadScene);
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const terrainVerticalExaggeration = useSceneStore((state) => state.terrainVerticalExaggeration);
  const setTerrainVerticalExaggeration = useSceneStore((state) => state.setTerrainVerticalExaggeration);
  const areaSelectionActive = useSceneStore((state) => state.areaSelectionActive);
  const setAreaSelectionActive = useSceneStore((state) => state.setAreaSelectionActive);
  const selectedAreaPoints = useSceneStore((state) => state.selectedAreaPoints);
  const selectedAreaClosed = useSceneStore((state) => state.selectedAreaClosed);
  const setSelectedAreaClosed = useSceneStore((state) => state.setSelectedAreaClosed);
  const resetSelectedArea = useSceneStore((state) => state.resetSelectedArea);
  const lastStitchLayout = useSceneStore((state) => state.lastStitchLayout);
  const setFocusDesign = useSceneStore((state) => state.setFocusDesign);

  const isPark = variant === "park";
  const canFinish = selectedAreaPoints.length >= 3 && !selectedAreaClosed;
  const canEnterFocus =
    selectedAreaClosed && selectedAreaPoints.length >= 3 && lastStitchLayout;

  const handleToggleAreaMode = () => {
    if (areaSelectionActive) {
      resetSelectedArea();
    }
    setAreaSelectionActive(!areaSelectionActive);
  };

  const handleFinishOutline = () => {
    if (canFinish) setSelectedAreaClosed(true);
  };

  const handleEnterFocus = () => {
    if (!canEnterFocus) return;
    const fd = buildFocusStitchFromWorldPolygon(lastStitchLayout, selectedAreaPoints);
    if (!fd) return;
    setFocusDesign(fd);
    navigate("/focus-editor");
  };

  return (
    <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain p-4">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">PlayScape Studio</h1>
        <p className="mt-1 text-sm text-slate-500">
          {isPark ? "Choose a model, then click ground to place." : "Place equipment inside the highlighted region only."}
        </p>
        {selectedLocation ? (
          <p className="mt-2 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
            {selectedLocation.name} ({selectedLocation.latitude.toFixed(3)}, {selectedLocation.longitude.toFixed(3)})
          </p>
        ) : null}
      </div>

      {isPark ? (
        <section className="mb-6 rounded-lg border border-amber-200 bg-amber-50/80 p-3">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-900/80">Area selection</h2>
          <p className="text-xs text-amber-900/70">
            Turn on, click terrain to add corners. Click near the orange marker or use Finish to close.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleToggleAreaMode}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                areaSelectionActive ? "bg-amber-600 text-white" : "bg-white text-amber-900 ring-1 ring-amber-300"
              }`}
            >
              {areaSelectionActive ? "Stop selecting" : "Select area"}
            </button>
            <button
              type="button"
              onClick={handleFinishOutline}
              disabled={!canFinish}
              className="rounded-md bg-white px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Finish selection
            </button>
            <button
              type="button"
              onClick={handleEnterFocus}
              disabled={!canEnterFocus}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Enter design mode
            </button>
          </div>
          {selectedAreaPoints.length > 0 ? (
            <p className="mt-2 text-xs text-amber-900/80">
              Points: {selectedAreaPoints.length}
              {selectedAreaClosed ? " · closed" : ""}
            </p>
          ) : null}
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">Model Library</h2>
        <div className="space-y-2">
          {models.map((model) => {
            const isActive = model.id === activeModelId;
            return (
              <button
                key={model.id}
                type="button"
                onClick={() => setActiveModel(model.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  isActive ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 hover:bg-slate-50"
                }`}
              >
                <p className="text-sm font-medium">{model.name}</p>
                <p className="text-xs text-slate-500">{modelFileLabel(model.modelPath)}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Terrain relief</h2>
        <label htmlFor="terrain-exag" className="flex flex-col gap-1 text-sm text-slate-600">
          <span className="flex justify-between">
            <span>Vertical exaggeration</span>
            <span className="tabular-nums text-slate-800">{terrainVerticalExaggeration.toFixed(2)}×</span>
          </span>
          <input
            id="terrain-exag"
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={terrainVerticalExaggeration}
            onChange={(e) => setTerrainVerticalExaggeration(Number(e.target.value))}
            className="w-full accent-blue-600"
          />
        </label>
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected Object</h2>
        <p className="mt-2 text-sm text-slate-600">
          {selectedObjectId ? `ID: ${selectedObjectId.slice(0, 8)}...` : "Select any placed object"}
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTransformMode("translate")}
            className={`rounded-md px-3 py-2 text-sm ${
              transformMode === "translate" ? "bg-blue-600 text-white" : "bg-white text-slate-700"
            }`}
          >
            Move
          </button>
          <button
            type="button"
            onClick={() => setTransformMode("rotate")}
            className={`rounded-md px-3 py-2 text-sm ${
              transformMode === "rotate" ? "bg-blue-600 text-white" : "bg-white text-slate-700"
            }`}
          >
            Rotate
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => rotateSelected(Math.PI / 8)}
            disabled={!selectedObjectId}
            className="flex-1 rounded-md bg-slate-900 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Rotate +22.5°
          </button>
          <button
            type="button"
            onClick={removeSelected}
            disabled={!selectedObjectId}
            className="flex-1 rounded-md bg-rose-500 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Delete
          </button>
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={saveScene} className="flex-1 rounded-md bg-emerald-600 px-3 py-2 text-sm text-white">
            Save
          </button>
          <button type="button" onClick={loadScene} className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm text-white">
            Load
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">Snap: 0.5m translate, 22.5deg rotate. Items cannot overlap and must stay in bounds.</p>
      </section>
      </div>
    </aside>
  );
}

export default ModelLibraryPanel;
