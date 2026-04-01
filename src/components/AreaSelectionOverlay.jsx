import { useEffect, useMemo } from "react";
import { Line } from "@react-three/drei";
import * as THREE from "three";

const STROKE = "#fbbf24";
const STROKE_OUTER = "#f59e0b";
const FILL_COLOR = "#1d4ed8";

function tryCreateFillGeometry(shape, centerY) {
  try {
    const geom = new THREE.ShapeGeometry(shape);
    /* Shape lives in XY; +π/2 around X maps (x, y_shape, 0) → (x, 0, y_shape) = world XZ with z = y_shape. */
    geom.rotateX(Math.PI / 2);
    geom.translate(0, centerY, 0);
    return geom;
  } catch {
    return null;
  }
}

/**
 * Selection outline: drei's Line (screen-space width) + fill. LineLoop is not used (single-vertex WebGL issues).
 */
export default function AreaSelectionOverlay({ points, closed }) {
  const { linePointsOuter, linePointsInner, shapeGeometry, centerY } = useMemo(() => {
    if (!points?.length) {
      return { linePointsOuter: null, linePointsInner: null, shapeGeometry: null, centerY: 0 };
    }

    const ys = points.map((p) => p.y);
    const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const centerY = Number.isFinite(avgY) ? avgY + 0.12 : 0.12;
    const innerY = centerY + 0.02;

    let linePointsOuter = null;
    let linePointsInner = null;
    if (points.length >= 2) {
      const base = points.map((p) => [p.x, centerY, p.z]);
      if (closed && points.length >= 3) {
        linePointsOuter = [...base, base[0]];
        linePointsInner = points.map((p) => [p.x, innerY, p.z]);
        linePointsInner.push(linePointsInner[0]);
      } else {
        linePointsOuter = base;
        linePointsInner = points.map((p) => [p.x, innerY, p.z]);
      }
    }

    let shapeGeometry = null;
    if (closed && points.length >= 3) {
      const shape = new THREE.Shape();
      shape.moveTo(points[0].x, points[0].z);
      for (let k = 1; k < points.length; k += 1) {
        shape.lineTo(points[k].x, points[k].z);
      }
      shape.closePath();
      shapeGeometry = tryCreateFillGeometry(shape, centerY + 0.01);
    }

    return { linePointsOuter, linePointsInner, shapeGeometry, centerY };
  }, [points, closed]);

  useEffect(
    () => () => {
      shapeGeometry?.dispose();
    },
    [shapeGeometry],
  );

  if (!points?.length) return null;

  const passthroughRaycast = () => null;

  return (
    <group>
      {linePointsOuter && linePointsInner ? (
        <>
          <Line
            points={linePointsOuter}
            color={STROKE_OUTER}
            lineWidth={7}
            depthTest={false}
            transparent
            opacity={0.95}
            renderOrder={10}
            raycast={passthroughRaycast}
          />
          <Line
            points={linePointsInner}
            color={STROKE}
            lineWidth={4}
            depthTest={false}
            transparent
            opacity={1}
            renderOrder={11}
            raycast={passthroughRaycast}
          />
        </>
      ) : null}
      {shapeGeometry ? (
        <mesh geometry={shapeGeometry} renderOrder={2} raycast={passthroughRaycast}>
          <meshStandardMaterial
            color={FILL_COLOR}
            transparent
            opacity={0.34}
            depthWrite={false}
            roughness={0.85}
            metalness={0}
            emissive="#1e3a8a"
            emissiveIntensity={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {!closed ? (
        <mesh
          position={[points[0].x, centerY + 0.12, points[0].z]}
          renderOrder={12}
          raycast={passthroughRaycast}
        >
          <sphereGeometry args={[0.42, 20, 20]} />
          <meshStandardMaterial
            color="#ea580c"
            emissive="#c2410c"
            emissiveIntensity={0.55}
            depthTest={false}
          />
        </mesh>
      ) : null}
    </group>
  );
}
