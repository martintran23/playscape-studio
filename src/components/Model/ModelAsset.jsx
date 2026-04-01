import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";

/**
 * Loads a GLB and scales it to match the scene (meters).
 * GLBs from different sources use inconsistent units; `fitMaxDimensionMeters` uniformly scales
 * so the largest axis of the bounding box matches that many meters (× `scale` as fine-tune).
 */
function ModelAsset({ modelPath, scale = 1, fitMaxDimensionMeters }) {
  const { scene } = useGLTF(modelPath);
  const object = useMemo(() => {
    const clone = scene.clone();
    clone.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (fitMaxDimensionMeters != null && Number.isFinite(fitMaxDimensionMeters) && maxDim > 1e-8) {
      const uniform = (fitMaxDimensionMeters * scale) / maxDim;
      clone.scale.setScalar(uniform);
    } else {
      clone.scale.setScalar(scale);
    }
    return clone;
  }, [scene, scale, fitMaxDimensionMeters]);

  return <primitive object={object} />;
}

export default ModelAsset;
