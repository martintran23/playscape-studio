import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";

function ModelAsset({ modelPath, scale = 1 }) {
  const { scene } = useGLTF(modelPath);
  const cloned = useMemo(() => scene.clone(), [scene]);
  return <primitive object={cloned} scale={scale} />;
}

export default ModelAsset;
