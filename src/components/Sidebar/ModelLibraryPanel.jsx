import useSceneStore from "../../store/sceneStore";

function ModelLibraryPanel() {
  const models = useSceneStore((state) => state.models);
  const activeModelId = useSceneStore((state) => state.activeModelId);
  const setActiveModel = useSceneStore((state) => state.setActiveModel);
  const selectedObjectId = useSceneStore((state) => state.selectedObjectId);
  const rotateSelected = useSceneStore((state) => state.rotateSelected);
  const removeSelected = useSceneStore((state) => state.removeSelected);

  return (
    <aside className="w-72 border-r border-slate-200 bg-white p-4">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-slate-900">PlayScape Studio</h1>
        <p className="mt-1 text-sm text-slate-500">Choose a model, then click ground to place.</p>
      </div>

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
                <p className="text-xs text-slate-500">{model.modelPath}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h2 className="text-xs font-medium uppercase tracking-wide text-slate-500">Selected Object</h2>
        <p className="mt-2 text-sm text-slate-600">
          {selectedObjectId ? `ID: ${selectedObjectId.slice(0, 8)}...` : "Select any placed object"}
        </p>
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
      </section>
    </aside>
  );
}

export default ModelLibraryPanel;
