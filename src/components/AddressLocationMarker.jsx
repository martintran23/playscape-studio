import { useLayoutEffect, useMemo, useState } from "react";
import useLocationStore from "../store/locationStore";
import useSceneStore from "../store/sceneStore";
import { latLngToWorldXZ } from "../utils/stitchGeoreference";
import { getTerrainHeightAt } from "../utils/terrainRaycast";

/**
 * Map-style pin at the selected search address (lat/lng → current stitch XZ, draped on terrain).
 */
export default function AddressLocationMarker({ stitchLayout }) {
  const selectedLocation = useLocationStore((s) => s.selectedLocation);
  const terrainMesh = useSceneStore((s) => s.terrainMesh);
  const terrainSurfaceEpoch = useSceneStore((s) => s.terrainSurfaceEpoch);

  const lat = selectedLocation?.latitude;
  const lng = selectedLocation?.longitude;

  const xz = useMemo(() => {
    if (stitchLayout == null || lat == null || lng == null) return null;
    return latLngToWorldXZ(stitchLayout, lat, lng);
  }, [stitchLayout, lat, lng]);

  const [baseY, setBaseY] = useState(0);
  useLayoutEffect(() => {
    if (!xz) return;
    const h = getTerrainHeightAt(terrainMesh, xz.x, xz.z);
    setBaseY(h != null ? h : 0);
  }, [xz, terrainMesh, terrainSurfaceEpoch]);

  if (!xz) return null;

  const pinH = 2.2;
  const headR = 0.38;

  return (
    <group position={[xz.x, baseY, xz.z]} raycast={() => null}>
      <mesh position={[0, pinH * 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.14, pinH * 0.75, 10]} />
        <meshStandardMaterial color="#b91c1c" metalness={0.15} roughness={0.45} />
      </mesh>
      <mesh position={[0, pinH * 0.82, 0]} castShadow>
        <sphereGeometry args={[headR, 20, 20]} />
        <meshStandardMaterial
          color="#ef4444"
          metalness={0.2}
          roughness={0.35}
          emissive="#7f1d1d"
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} renderOrder={8}>
        <ringGeometry args={[headR * 0.85, headR * 1.15, 24]} />
        <meshBasicMaterial color="#fca5a5" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}
