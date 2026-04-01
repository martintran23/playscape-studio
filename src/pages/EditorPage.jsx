import { Navigate } from "react-router-dom";
import { Suspense, lazy, useMemo } from "react";
import ModelLibraryPanel from "../components/Sidebar/ModelLibraryPanel";
import useLocationStore from "../store/locationStore";

const ParkScene = lazy(() => import("../components/Scene/ParkScene"));

function mapLocationToCamera(location) {
  const latOffset = ((location.latitude % 1) * 6) + 8;
  const lngOffset = ((Math.abs(location.longitude) % 1) * 6) + 8;
  return [lngOffset, 10, latOffset];
}

function EditorPage() {
  const selectedLocation = useLocationStore((state) => state.selectedLocation);

  const cameraPosition = useMemo(() => {
    if (!selectedLocation) return [8, 8, 8];
    return mapLocationToCamera(selectedLocation);
  }, [selectedLocation]);

  if (!selectedLocation) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="page-enter flex h-full min-h-0 w-full">
      <ModelLibraryPanel />
      <section className="min-h-0 min-w-0 flex-1">
        <div className="h-full min-h-0 w-full">
          <Suspense fallback={<div className="grid h-full place-items-center text-slate-500">Loading 3D editor...</div>}>
            <ParkScene location={selectedLocation} initialCameraPosition={cameraPosition} />
          </Suspense>
        </div>
      </section>
    </main>
  );
}

export default EditorPage;
