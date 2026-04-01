import { Navigate, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useMemo } from "react";
import ModelLibraryPanel from "../components/Sidebar/ModelLibraryPanel";
import useSceneStore from "../store/sceneStore";

const ParkScene = lazy(() => import("../components/Scene/ParkScene"));

export default function FocusEditorPage() {
  const navigate = useNavigate();
  const focusDesign = useSceneStore((s) => s.focusDesign);
  const setPlacementContext = useSceneStore((s) => s.setPlacementContext);
  const setFocusPlacementPolygon = useSceneStore((s) => s.setFocusPlacementPolygon);
  const setBoundaryLimit = useSceneStore((s) => s.setBoundaryLimit);
  const setMapCenter = useSceneStore((s) => s.setMapCenter);
  const setFocusDesign = useSceneStore((s) => s.setFocusDesign);

  const gs = focusDesign?.groundSize ?? 120;

  const cameraPosition = useMemo(
    () => [0, Math.max(32, gs * 0.36), Math.max(40, gs * 0.44)],
    [gs],
  );

  useEffect(() => {
    if (!focusDesign) return undefined;
    setPlacementContext("focus");
    setFocusPlacementPolygon(focusDesign.polygonLocal);
    setBoundaryLimit(focusDesign.groundSize * 0.48);
    setMapCenter({ latitude: focusDesign.mapCenterLat, longitude: focusDesign.mapCenterLng });
    return () => {
      setPlacementContext("main");
      setFocusPlacementPolygon(null);
      /* Do not clear focusDesign here — React Strict Mode runs this between mounts and would wipe the session. */
    };
  }, [focusDesign, setPlacementContext, setFocusPlacementPolygon, setBoundaryLimit, setMapCenter]);

  if (!focusDesign) {
    return <Navigate to="/editor" replace />;
  }

  return (
    <main className="page-enter relative flex h-full min-h-0 w-full">
      <div className="pointer-events-none absolute left-1/2 top-5 z-10 -translate-x-1/2 rounded-full border border-blue-200/80 bg-white/95 px-5 py-2 text-sm font-medium text-slate-800 shadow-md backdrop-blur-sm">
        Focused Design Area
      </div>
      <button
        type="button"
        onClick={() => {
          setFocusDesign(null);
          navigate("/editor");
        }}
        className="absolute left-4 top-5 z-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow hover:bg-slate-50"
      >
        ← Back to editor
      </button>
      <ModelLibraryPanel variant="focus" />
      <section className="relative z-0 min-h-0 min-w-0 flex-1">
        {/* Match editor: flex height chain + min height so %/h-full Canvas never resolves to 0 */}
        <div className="h-full min-h-[min(50vh,480px)] w-full min-w-0">
          <Suspense fallback={<div className="grid h-full place-items-center text-slate-500">Loading focus scene…</div>}>
            <ParkScene variant="focus" focusDesign={focusDesign} initialCameraPosition={cameraPosition} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
