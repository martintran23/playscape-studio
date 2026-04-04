import { useLayoutEffect, useMemo, useState } from "react";
import useLocationStore from "../store/locationStore";
import useSceneStore from "../store/sceneStore";
import { latLngToWorldXZ } from "../utils/stitchGeoreference";
import { getTopSurfaceHeightAt } from "../utils/terrainRaycast";

const ROOF_NUDGE = 0.06;

/**
 * Map pin at the searched address. Ray hits terrain + Mapbox building meshes so the pin sits on a roof when present.
 * Hidden in focused design mode (`visible={false}`).
 */
export default function AddressLocationMarker({ stitchLayout, visible = true }) {
  const selectedLocation = useLocationStore((s) => s.selectedLocation);
  const terrainMesh = useSceneStore((s) => s.terrainMesh);
  const environmentRoot = useSceneStore((s) => s.environmentRootForRaycast);
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
    const roots = [terrainMesh, environmentRoot].filter(Boolean);
    const h = getTopSurfaceHeightAt(xz.x, xz.z, roots);
    setBaseY((h != null ? h : 0) + ROOF_NUDGE);
  }, [xz, terrainMesh, environmentRoot, terrainSurfaceEpoch]);

  if (!visible || !xz) return null;

  const pinH = 2.2;
  const headR = 0.38;

  return (
    <group position={[xz.x, baseY, xz.z]} raycast={() => null} name="address-location-marker">
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
