import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Sky, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import PlacedObject from "../Model/PlacedObject";
import AreaSelectionOverlay from "../AreaSelectionOverlay";
import useSceneStore from "../../store/sceneStore";
import useLocationStore from "../../store/locationStore";
import { getSlippyTileWorldMeters } from "../../utils/mapboxService";
import { computeStitchLayout, worldXZToLatLng } from "../../utils/stitchGeoreference";
import { getTerrainHeightAt } from "../../utils/terrainRaycast";
import { distanceXZ } from "../../utils/polygon2d";
import TerrainGround from "../TerrainGround";
import LocationEnvironment3D from "../LocationEnvironment3D";
import BackdropSatellite from "../BackdropSatellite";
import FocusRegionVeil from "../FocusRegionVeil";
import FocusCameraIntro from "./FocusCameraIntro";
import ScaleReferenceCube from "./ScaleReferenceCube";
import AddressLocationMarker from "../AddressLocationMarker";

const MAP_ZOOM = 18;
const DEBUG_SCALE_CUBE = import.meta.env.VITE_DEBUG_SCALE_CUBE === "1";
const NATIVE_TILE_PX = 256;
const CLOSE_RING_M = 2.85;

/** Camera-distance LOD: wider tile stitch + lower mesh resolution when zoomed out. */
function TerrainLodPanController({ orbitRef, stitchedGroundSize, onLodChange, onPanRecenter, isTerrainLoading }) {
  const { camera } = useThree();
  const frame = useRef(0);
  const cooldown = useRef(0);
  const lastLodRef = useRef({ tileGrid: 9, segments: 240 });

  useFrame(() => {
    if (!orbitRef.current) return;
    frame.current += 1;

    const target = orbitRef.current.target;
    const dist = camera.position.distanceTo(target);

    if (frame.current % 12 === 0) {
      const tileGrid = dist > 220 ? 11 : 9;
      const segments = dist > 180 ? 128 : dist > 90 ? 192 : 256;
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
  variant,
  effectiveLocation,
  mapCenterLat,
  mapCenterLng,
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
  areaSelectionActive,
  selectedAreaPoints,
  selectedAreaClosed,
  addSelectedAreaPoint,
  setSelectedAreaClosed,
  focusPolygonLocal,
}) {
  const orbitRef = useRef(null);
  const isPark = variant === "park";
  const isFocus = variant === "focus";

  const focusSelectionPoints = useMemo(() => {
    if (!isFocus || !focusPolygonLocal?.length) return null;
    return focusPolygonLocal.map((p) => ({ x: p.x, y: 0.18, z: p.z }));
  }, [isFocus, focusPolygonLocal]);
  const fogNear = Math.min(220, 48 + groundSize * 0.22);
  const fogFar = Math.max(720, groundSize * 2.8);
  /* Tight fog + small focus patch can wash the whole scene white; keep focus views clear. */
  const useFog = isPark;

  const onTerrainPointer = (event) => {
    event.stopPropagation();
    if (isPark && areaSelectionActive && !selectedAreaClosed) {
      const x = event.point.x;
      const z = event.point.z;
      const y = getTerrainHeightAt(terrainMesh, x, z) ?? event.point.y;
      if (selectedAreaPoints.length >= 3) {
        const first = selectedAreaPoints[0];
        if (distanceXZ({ x, z }, { x: first.x, z: first.z }) < CLOSE_RING_M) {
          setSelectedAreaClosed(true);
          return;
        }
      }
      addSelectedAreaPoint({ x, y, z });
      return;
    }

    const geoPosition = worldXZToLatLng(stitchLayout, event.point.x, event.point.z);
    const y = getTerrainHeightAt(terrainMesh, event.point.x, event.point.z) ?? event.point.y;
    addObjectAt({
      modelId: activeModelId,
      position: [event.point.x, y, event.point.z],
      geoPosition,
    });
  };

  return (
    <>
      <color attach="background" args={["#f8fafc"]} />
      {useFog ? <fog attach="fog" args={["#d8ecff", fogNear, fogFar]} /> : null}
      <Sky distance={450000} sunPosition={[10, 12, 5]} inclination={0.5} azimuth={0.2} />
      <hemisphereLight skyColor="#eaf4ff" groundColor="#7a6f62" intensity={0.42} />
      <ambientLight intensity={0.48} />
      <directionalLight
        castShadow
        position={[28, 46, 18]}
        intensity={1.35}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={groundSize * 4.2}
        shadow-camera-left={-groundSize * 0.62}
        shadow-camera-right={groundSize * 0.62}
        shadow-camera-top={groundSize * 0.62}
        shadow-camera-bottom={-groundSize * 0.62}
        shadow-bias={-0.00006}
        shadow-normalBias={0.03}
      />
      {isPark ? (
        <BackdropSatellite
          centerLat={mapCenterLat ?? effectiveLocation.latitude}
          centerLng={mapCenterLng ?? effectiveLocation.longitude}
          groundSize={groundSize}
        />
      ) : null}
      {isPark ? (
        <Grid
          args={[groundSize + 28, groundSize + 28]}
          cellSize={1}
          cellThickness={0.7}
          sectionSize={5}
          sectionThickness={1.1}
          sectionColor="#94a3b8"
          fadeDistance={85}
        />
      ) : null}
      {isPark ? (
        <TerrainLodPanController
          orbitRef={orbitRef}
          stitchedGroundSize={groundSize}
          onLodChange={handleLodChange}
          onPanRecenter={handlePanRecenter}
          isTerrainLoading={terrainLoading}
        />
      ) : null}
      <TerrainGround
        stitchLayout={stitchLayout}
        segments={lodSegments}
        verticalExaggeration={terrainVerticalExaggeration}
        onLoadStateChange={setTerrainLoading}
        onPlaceObject={onTerrainPointer}
      />
      <AddressLocationMarker stitchLayout={stitchLayout} visible={!isFocus} />
      {isFocus && focusPolygonLocal?.length >= 3 ? (
        <>
          <FocusRegionVeil
            polygonLocal={focusPolygonLocal}
            outerHalfExtent={Math.max(groundSize, stitchLayout?.worldSizeMeters ?? groundSize) * 0.52}
            y={Math.max(14, groundSize * 0.055)}
          />
          {focusSelectionPoints ? (
            <AreaSelectionOverlay points={focusSelectionPoints} closed />
          ) : null}
        </>
      ) : null}
      <LocationEnvironment3D
        stitchLayout={stitchLayout}
        verticalExaggeration={terrainVerticalExaggeration}
        enabled={isPark}
      />
      {isPark ? (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[boundaryLimit - 0.06, boundaryLimit + 0.06, 128]} />
          <meshBasicMaterial color="#334155" />
        </mesh>
      ) : null}

      {isPark && selectedAreaPoints.length ? (
        <AreaSelectionOverlay points={selectedAreaPoints} closed={selectedAreaClosed} />
      ) : null}

      {placedObjects.map((object) => (
        <PlacedObject key={object.id} object={object} model={modelById[object.modelId]} />
      ))}

      {DEBUG_SCALE_CUBE ? <ScaleReferenceCube /> : null}

      <OrbitControls
        ref={orbitRef}
        makeDefault
        enablePan
        enableZoom
        enableRotate
        minDistance={isFocus ? 2.5 : 4}
        maxDistance={isFocus ? Math.max(96, groundSize * 1.35) : 800}
      />
      {variant === "focus" ? <FocusCameraIntro orbitRef={orbitRef} groundSize={groundSize} enabled /> : null}
    </>
  );
}

/**
 * @param {object} props
 * @param {'park' | 'focus'} [props.variant]
 * @param {object | null} [props.focusDesign] stitch + bounds from buildFocusStitchFromWorldPolygon
 */
function ParkScene({ location, initialCameraPosition = [8, 8, 8], variant = "park", focusDesign = null }) {
  const selectedLocation = useLocationStore((state) => state.selectedLocation);
  const effectiveLocation = location ?? selectedLocation;

  const placedObjects = useSceneStore((state) =>
    variant === "focus" ? state.focusPlacedObjects : state.placedObjects,
  );
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
  const setLastStitchLayout = useSceneStore((state) => state.setLastStitchLayout);

  const areaSelectionActive = useSceneStore((state) => state.areaSelectionActive);
  const selectedAreaPoints = useSceneStore((state) => state.selectedAreaPoints);
  const selectedAreaClosed = useSceneStore((state) => state.selectedAreaClosed);
  const addSelectedAreaPoint = useSceneStore((state) => state.addSelectedAreaPoint);
  const setSelectedAreaClosed = useSceneStore((state) => state.setSelectedAreaClosed);

  const [lodTileGrid, setLodTileGrid] = useState(9);
  const [lodSegments, setLodSegments] = useState(240);
  const [terrainLoading, setTerrainLoading] = useState(false);

  const isFocus = variant === "focus" && focusDesign?.stitchLayout;

  const refLat = isFocus
    ? focusDesign.mapCenterLat
    : mapCenterLat ?? effectiveLocation?.latitude ?? 0;
  const tileM = !isFocus && effectiveLocation ? getSlippyTileWorldMeters(refLat, MAP_ZOOM, NATIVE_TILE_PX) : 0;

  const groundSize = isFocus ? focusDesign.groundSize : tileM * lodTileGrid;

  const stitchLayout = useMemo(() => {
    if (isFocus) return focusDesign.stitchLayout;
    const lat = mapCenterLat ?? effectiveLocation.latitude;
    const lng = mapCenterLng ?? effectiveLocation.longitude;
    return computeStitchLayout(lng, lat, MAP_ZOOM, lodTileGrid, groundSize);
  }, [
    isFocus,
    focusDesign,
    mapCenterLat,
    mapCenterLng,
    effectiveLocation.latitude,
    effectiveLocation.longitude,
    lodTileGrid,
    groundSize,
  ]);

  const lodSegmentsResolved = isFocus ? (focusDesign.lodSegments ?? 320) : lodSegments;

  const modelById = Object.fromEntries(models.map((model) => [model.id, model]));

  const locationForBackdrop = useMemo(() => {
    if (isFocus) {
      return {
        latitude: focusDesign.mapCenterLat,
        longitude: focusDesign.mapCenterLng,
      };
    }
    return effectiveLocation;
  }, [isFocus, focusDesign, effectiveLocation]);

  useEffect(() => {
    models.forEach((model) => useGLTF.preload(model.modelPath));
  }, [models]);

  useEffect(() => {
    if (isFocus || !effectiveLocation) return;
    setMapCenter({ latitude: effectiveLocation.latitude, longitude: effectiveLocation.longitude });
  }, [isFocus, effectiveLocation, setMapCenter]);

  useEffect(() => {
    if (isFocus || !effectiveLocation || !groundSize) return;
    setBoundaryLimit(groundSize * 0.5 - 2);
  }, [isFocus, effectiveLocation, groundSize, setBoundaryLimit]);

  useEffect(() => {
    setLastStitchLayout(stitchLayout);
  }, [stitchLayout, setLastStitchLayout]);

  const handleLodChange = ({ tileGrid, segments }) => {
    setLodTileGrid(tileGrid);
    setLodSegments(segments);
  };

  const handlePanRecenter = (offsetX, offsetZ) => {
    const next = worldXZToLatLng(stitchLayout, offsetX, offsetZ);
    setMapCenter({ latitude: next.latitude, longitude: next.longitude });
    shiftSceneOrigin({ offsetX, offsetZ });
  };

  if (!effectiveLocation && !isFocus) {
    return <div className="grid h-full place-items-center text-slate-500">No location selected.</div>;
  }

  if (isFocus && !focusDesign?.stitchLayout) {
    return <div className="grid h-full place-items-center text-slate-500">Missing focus region.</div>;
  }

  const canvasKey = isFocus
    ? `focus-${focusDesign.mapCenterLat}-${focusDesign.mapCenterLng}-${focusDesign.groundSize}`
    : "park";

  return (
    <div className="h-full min-h-0 w-full">
      <Canvas
        key={canvasKey}
        className="h-full w-full"
        style={{ display: "block", minHeight: 0 }}
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: initialCameraPosition, fov: 50, near: 0.1, far: 20000 }}
        onPointerMissed={() => selectObject(null)}
      >
        <ParkSceneContent
          variant={isFocus ? "focus" : "park"}
          effectiveLocation={locationForBackdrop}
          mapCenterLat={isFocus ? focusDesign.mapCenterLat : mapCenterLat}
          mapCenterLng={isFocus ? focusDesign.mapCenterLng : mapCenterLng}
          groundSize={groundSize}
          stitchLayout={stitchLayout}
          lodSegments={lodSegmentsResolved}
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
          areaSelectionActive={areaSelectionActive}
          selectedAreaPoints={selectedAreaPoints}
          selectedAreaClosed={selectedAreaClosed}
          addSelectedAreaPoint={addSelectedAreaPoint}
          setSelectedAreaClosed={setSelectedAreaClosed}
          focusPolygonLocal={isFocus ? focusDesign.polygonLocal : null}
        />
      </Canvas>
    </div>
  );
}

export default ParkScene;
