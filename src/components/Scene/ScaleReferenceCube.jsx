import { METERS_PER_WORLD_UNIT } from "../../constants/geoscene";

const S = METERS_PER_WORLD_UNIT;

/**
 * 1m reference for debugging scale between main and focus editors.
 * Set VITE_DEBUG_SCALE_CUBE=1 in .env.local
 */
export default function ScaleReferenceCube({ position = [2.5, S * 0.5, 2.5] }) {
  return (
    <mesh position={position} castShadow receiveShadow name="debug-scale-cube-1m">
      <boxGeometry args={[S, S, S]} />
      <meshStandardMaterial color="#dc2626" metalness={0.05} roughness={0.65} />
    </mesh>
  );
}
