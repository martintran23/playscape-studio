import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

function unionMeshWorldBox(root) {
  const box = new THREE.Box3();
  let hit = false;
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!child.isMesh || !child.geometry) return;
    const geom = child.geometry;
    if (!geom.boundingBox) geom.computeBoundingBox();
    const local = geom.boundingBox;
    if (!local) return;
    const wb = local.clone().applyMatrix4(child.matrixWorld);
    if (!hit) {
      box.copy(wb);
      hit = true;
    } else {
      box.union(wb);
    }
  });
  if (!hit) {
    box.setFromObject(root);
  }
  return box;
}

/**
 * Loads a GLB and scales it to match the scene.
 * Target size is always `fitMaxDimensionMeters` (real meters); independent of focus vs main
 * or terrain extent — assumes `METERS_PER_WORLD_UNIT` in `constants/geoscene.js`.
 */
function ModelAsset({ modelPath, scale = 1, fitMaxDimensionMeters }) {
  const { scene } = useGLTF(modelPath);
  const object = useMemo(() => {
    const clone = scene.clone();
    clone.updateMatrixWorld(true);
    const box = unionMeshWorldBox(clone);
    const size = box.getSize(new THREE.Vector3());
    const footprint = Math.max(size.x, size.z);
    /* Blend footprint with height so spurious tall colliders don’t dominate, but thin poles still scale. */
    const refDim = Math.max(footprint, size.y * 0.35, 1e-8);

    if (fitMaxDimensionMeters != null && Number.isFinite(fitMaxDimensionMeters) && refDim > 1e-8) {
      let uniform = (fitMaxDimensionMeters * scale) / refDim;
      uniform = Math.min(Math.max(uniform, 1e-6), 800);
      clone.scale.setScalar(uniform);
    } else {
      clone.scale.setScalar(scale);
    }
    clone.updateMatrixWorld(true);
    const grounded = unionMeshWorldBox(clone);
    clone.position.y = -grounded.min.y;
    clone.updateMatrixWorld(true);
    return clone;
  }, [scene, scale, fitMaxDimensionMeters]);

  return <primitive object={object} />;
}

export default ModelAsset;
