import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Sky, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import PlacedObject from "../Model/PlacedObject";
import useSceneStore from "../../store/sceneStore";
import useLocationStore from "../../store/locationStore";
import { getSlippyTileWorldMeters } from "../../utils/mapboxService";
import { computeStitchLayout, worldXZToLatLng } from "../../utils/stitchGeoreference";
import { getTerrainHeightAt } from "../../utils/terrainRaycast";
import TerrainGround from "../TerrainGround";
import LocationEnvironment3D from "../LocationEnvironment3D";

const MAP_ZOOM = 18;
const NATIVE_TILE_PX = 256;

/** Camera-distance LOD: wider tile stitch + lower mesh resolution when zoomed out. */
function TerrainLodPanController({ orbitRef, stitchedGroundSize, onLodChange, onPanRecenter, isTerrainLoading }) {
  const { camera } = useThree();
  const frame = useRef(0);
  const cooldown = useRef(0);
  const lastLodRef = useRef({ tileGrid: 5, segments: 240 });

  useFrame(() => {
    if (!orbitRef.current) return;
    frame.current += 1;

    const target = orbitRef.current.target;
    const dist = camera.position.distanceTo(target);

    if (frame.current % 12 === 0) {
      const tileGrid = dist > 150 ? 7 : 5;
      const segments = dist > 125 ? 128 : dist > 60 ? 192 : 256;
      if (tileGrid !== lastLodRef.current.tileGrid || segments !== lastLodRef.current.segments) {
        lastLodRef.current = { tileGrid, segments };
        onLodChange({ tileGrid, segments });
      }
    }

    if (isTerrainLoading) return;

    if (cooldown.current > 0) {
      cooldown.current -= 1;
      return;
    }

    const pan = Math.hypot(target.x, target.z);
    const threshold = stitchedGroundSize * 0.3;
    if (pan > threshold) {
      const tx = target.x;
      const ty = target.y;
      const tz = target.z;
      onPanRecenter(tx, tz);
      camera.position.x -= tx;
      camera.position.z -= tz;
      orbitRef.current.target.set(0, ty, 0);
      orbitRef.current.update();
      cooldown.current = 50;
    }
  });

  return null;
}

function ParkSceneContent({
  effectiveLocation,
  groundSize,
  stitchLayout,
  lodSegments,
  terrainVerticalExaggeration,
  terrainLoading,
  setTerrainLoading,
  placedObjects,
  modelById,
  selectObject,
  boundaryLimit,
  activeModelId,
  addObjectAt,
  terrainMesh,
  handlePanRecenter,
  handleLodChange,
}) {
  const orbitRef = useRef(null);

  return (
    <>
      <color attach="background" args={["#f8fafc"]} />
      <fog attach="fog" args={["#d8ecff", 120, 560]} />
      <Sky distance={450000} sunPosition={[10, 12, 5]} inclination={0.5} azimuth={0.2} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[16, 22, 10]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[groundSize * 3.2, groundSize * 3.2]} />
        <meshStandardMaterial color="#7aa867" />
      </mesh>
      <Grid
        args={[groundSize + 12, groundSize + 12]}
        cellSize={1}
        cellThickness={0.7}
        sectionSize={5}
        sectionThickness={1.1}
        sectionColor="#94a3b8"
        fadeDistance={85}
      />
      <TerrainLodPanController
        orbitRef={orbitRef}
        stitchedGroundSize={groundSize}
        onLodChange={handleLodChange}
        onPanRecenter={handlePanRecenter}
        isTerrainLoading={terrainLoading}
      />
      <TerrainGround
        stitchLayout={stitchLayout}
        segments={lodSegments}
        verticalExaggeration={terrainVerticalExaggeration}
        onLoadStateChange={setTerrainLoading}
        onPlaceObject={(event) => {
          event.stopPropagation();
          const geoPosition = worldXZToLatLng(stitchLayout, event.point.x, event.point.z);
          const y = getTerrainHeightAt(terrainMesh, event.point.x, event.point.z) ?? event.point.y;
          addObjectAt({
            modelId: activeModelId,
            position: [event.point.x, y, event.point.z],
            geoPosition,
          });
        }}
      />
      <LocationEnvironment3D stitchLayout={stitchLayout} verticalExaggeration={terrainVerticalExaggeration} />
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[boundaryLimit - 0.06, boundaryLimit + 0.06, 128]} />
        <meshBasicMaterial color="#334155" />
      </mesh>

      {placedObjects.map((object) => (
        <PlacedObject key={object.id} object={object} model={modelById[object.modelId]} />
      ))}

      <OrbitControls
        ref={orbitRef}
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={4}
        maxDistance={800}
      />
    </>
  );
}

function ParkScene({ location, initialCameraPosition = [8, 8, 8] }) {
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const effectiveLocation = location ?? selectedLocation;

  const placedObjects = useSceneStore((state) => state.placedObjects);
  const models = useSceneStore((state) => state.models);
  const selectObject = useSceneStore((state) => state.selectObject);
  const boundaryLimit = useSceneStore((state) => state.boundaryLimit);
  const activeModelId = useSceneStore((state) => state.activeModelId);
  const addObjectAt = useSceneStore((state) => state.addObjectAt);
  const setBoundaryLimit = useSceneStore((state) => state.setBoundaryLimit);
  const mapCenterLat = useSceneStore((state) => state.mapCenterLat);
  const mapCenterLng = useSceneStore((state) => state.mapCenterLng);
  const setMapCenter = useSceneStore((state) => state.setMapCenter);
  const shiftSceneOrigin = useSceneStore((state) => state.shiftSceneOrigin);
  const terrainVerticalExaggeration = useSceneStore((state) => state.terrainVerticalExaggeration);
  const terrainMesh = useSceneStore((state) => state.terrainMesh);

  const [lodTileGrid, setLodTileGrid] = useState(5);
  const [lodSegments, setLodSegments] = useState(240);
  const [terrainLoading, setTerrainLoading] = useState(false);

  const refLat = mapCenterLat ?? effectiveLocation?.latitude ?? 0;
  const tileM = effectiveLocation ? getSlippyTileWorldMeters(refLat, MAP_ZOOM, NATIVE_TILE_PX) : 0;
  const groundSize = tileM * lodTileGrid;

  const stitchLayout = useMemo(() => {
    const lat = mapCenterLat ?? effectiveLocation.latitude;
    const lng = mapCenterLng ?? effectiveLocation.longitude;
    return computeStitchLayout(lng, lat, MAP_ZOOM, lodTileGrid, groundSize);
  }, [mapCenterLat, mapCenterLng, effectiveLocation.latitude, effectiveLocation.longitude, lodTileGrid, groundSize]);

  const modelById = Object.fromEntries(models.map((model) => [model.id, model]));

  useEffect(() => {
    models.forEach((model) => useGLTF.preload(model.modelPath));
  }, [models]);

  useEffect(() => {
    if (!effectiveLocation) return;
    setMapCenter({ latitude: effectiveLocation.latitude, longitude: effectiveLocation.longitude });
  }, [effectiveLocation, setMapCenter]);

  useEffect(() => {
    if (!effectiveLocation || !groundSize) return;
    setBoundaryLimit(groundSize * 0.5 - 2);
  }, [effectiveLocation, groundSize, setBoundaryLimit]);

  const handleLodChange = ({ tileGrid, segments }) => {
    setLodTileGrid(tileGrid);
    setLodSegments(segments);
  };

  const handlePanRecenter = (offsetX, offsetZ) => {
    const next = worldXZToLatLng(stitchLayout, offsetX, offsetZ);
    setMapCenter({ latitude: next.latitude, longitude: next.longitude });
    shiftSceneOrigin({ offsetX, offsetZ });
  };

  if (!effectiveLocation) {
    return <div className="grid h-full place-items-center text-slate-500">No location selected.</div>;
  }

  return (
    <div className="h-full w-full">
      <Canvas shadows camera={{ position: initialCameraPosition, fov: 50 }} onPointerMissed={() => selectObject(null)}>
        <ParkSceneContent
          effectiveLocation={effectiveLocation}
          groundSize={groundSize}
          stitchLayout={stitchLayout}
          lodSegments={lodSegments}
          terrainVerticalExaggeration={terrainVerticalExaggeration}
          terrainLoading={terrainLoading}
          setTerrainLoading={setTerrainLoading}
          placedObjects={placedObjects}
          modelById={modelById}
          selectObject={selectObject}
          boundaryLimit={boundaryLimit}
          activeModelId={activeModelId}
          addObjectAt={addObjectAt}
          terrainMesh={terrainMesh}
          handlePanRecenter={handlePanRecenter}
          handleLodChange={handleLodChange}
        />
      </Canvas>
    </div>
  );
}

export default ParkScene;
