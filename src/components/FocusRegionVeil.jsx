import { useEffect, useMemo } from "react";
import * as THREE from "three";

/**
 * Semi-opaque overlay with a polygon-shaped hole so only the selected region reads as "active".
 * Outer extent covers the stitched terrain; hole uses the same XZ as placement polygon.
 */
export default function FocusRegionVeil({ polygonLocal, outerHalfExtent, y = 12 }) {
  const geometry = useMemo(() => {
    if (!polygonLocal?.length || polygonLocal.length < 3 || !Number.isFinite(outerHalfExtent)) return null;

    const outer = new THREE.Shape();
    const M = outerHalfExtent;
    outer.moveTo(-M, -M);
    outer.lineTo(M, -M);
    outer.lineTo(M, M);
    outer.lineTo(-M, M);
    outer.closePath();

    const hole = new THREE.Path();
    const holePts = [...polygonLocal].reverse();
    for (let i = 0; i < holePts.length; i += 1) {
      const p = holePts[i];
      const sx = p.x;
      const sy = p.z;
      if (i === 0) hole.moveTo(sx, sy);
      else hole.lineTo(sx, sy);
    }
    hole.closePath();
    outer.holes.push(hole);

    try {
      const geom = new THREE.ShapeGeometry(outer);
      geom.rotateX(Math.PI / 2);
      geom.translate(0, y, 0);
      return geom;
    } catch {
      return null;
    }
  }, [polygonLocal, outerHalfExtent, y]);

  useEffect(
    () => () => {
      geometry?.dispose();
    },
    [geometry],
  );

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} renderOrder={40} frustumCulled={false} raycast={() => null}>
      <meshBasicMaterial
        color="#0f172a"
        transparent
        opacity={0.78}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
