import { useEffect, useRef, useState } from "react";
import useSceneStore from "../store/sceneStore";
import { fetchLocationEnvironmentFeatures } from "../utils/mapboxMvtEnvironment";
import { buildEnvironmentMeshes } from "../utils/buildLocationEnvironmentMeshes";

function disposeObject3D(root) {
  if (!root) return;
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m.dispose?.());
    }
  });
}

/**
 * Mapbox Streets vector tiles: real building footprints/heights + trees in forest/park landuse.
 * Uses the same stitch layout as TerrainGround so footprints sit on the orthophoto.
 */
export default function LocationEnvironment3D({ stitchLayout, verticalExaggeration }) {
  const terrainMesh = useSceneStore((s) => s.terrainMesh);
  const terrainSurfaceEpoch = useSceneStore((s) => s.terrainSurfaceEpoch);
  const groupRef = useRef(null);
  const [features, setFeatures] = useState({ buildings: [], treeZones: [] });
  const worldSizeMeters = stitchLayout?.worldSizeMeters ?? 0;

  useEffect(() => {
    if (!stitchLayout) {
      setFeatures({ buildings: [], treeZones: [] });
      return undefined;
    }

    let cancelled = false;
    const ac = new AbortController();

    fetchLocationEnvironmentFeatures({ layout: stitchLayout, signal: ac.signal })
      .then((data) => {
        if (!cancelled) setFeatures(data);
      })
      .catch((err) => {
        if (err?.name === "AbortError" || cancelled) return;
        console.warn("Location environment tiles:", err);
        if (!cancelled) setFeatures({ buildings: [], treeZones: [] });
      });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [stitchLayout]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return undefined;

    const clearChildren = () => {
      while (group.children.length) {
        const ch = group.children[0];
        group.remove(ch);
        disposeObject3D(ch);
      }
    };

    if (!terrainMesh) {
      clearChildren();
      return undefined;
    }

    const { buildingMesh, treeGroup } = buildEnvironmentMeshes({
      buildings: features.buildings,
      treeZones: features.treeZones,
      worldSizeMeters,
      verticalExaggeration,
      terrainMesh,
    });

    clearChildren();
    if (buildingMesh) group.add(buildingMesh);
    if (treeGroup) group.add(treeGroup);

    return () => {
      clearChildren();
    };
  }, [features, terrainMesh, verticalExaggeration, worldSizeMeters, terrainSurfaceEpoch]);

  return <group ref={groupRef} />;
}
