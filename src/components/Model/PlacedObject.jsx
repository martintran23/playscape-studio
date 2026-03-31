import { Suspense, lazy, useMemo, useRef } from "react";
import { TransformControls } from "@react-three/drei";
import useSceneStore from "../../store/sceneStore";
import { getTerrainHeightAt } from "../../utils/terrainRaycast";

const SlideModel = lazy(() => import("./SlideModel"));
const SwingModel = lazy(() => import("./SwingModel"));
const SeesawModel = lazy(() => import("./SeesawModel"));

const MODEL_COMPONENTS = {
  slide: SlideModel,
  swing: SwingModel,
  seesaw: SeesawModel,
};

function PlacedObject({ object, model }) {
  const groupRef = useRef(null);

  const selectedObjectId = useSceneStore((state) => state.selectedObjectId);
  const selectObject = useSceneStore((state) => state.selectObject);
  const updateObjectTransform = useSceneStore((state) => state.updateObjectTransform);
  const transformMode = useSceneStore((state) => state.transformMode);
  const translationSnap = useSceneStore((state) => state.translationSnap);
  const rotationSnap = useSceneStore((state) => state.rotationSnap);
  const terrainMesh = useSceneStore((state) => state.terrainMesh);

  const isSelected = selectedObjectId === object.id;
  const ModelComponent = useMemo(() => MODEL_COMPONENTS[model.id], [model.id]);

  const meshContent = (
    <group
      ref={groupRef}
      position={object.position}
      rotation={object.rotation}
      onClick={(event) => {
        event.stopPropagation();
        selectObject(object.id);
      }}
    >
      <Suspense fallback={null}>
        <ModelComponent modelPath={model.modelPath} scale={model.scale} />
      </Suspense>
      {isSelected ? (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[model.radius + 0.05, model.radius + 0.12, 48]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      ) : null}
    </group>
  );

  if (!isSelected) return meshContent;

  return (
    <TransformControls
      mode={transformMode}
      showX
      showY={false}
      showZ
      translationSnap={translationSnap}
      rotationSnap={rotationSnap}
      onObjectChange={() => {
        if (!groupRef.current) return;
        const position = groupRef.current.position;
        const rotation = groupRef.current.rotation;
        let y = position.y;
        const terrainY = getTerrainHeightAt(terrainMesh, position.x, position.z);
        if (terrainY != null) {
          y = terrainY;
          position.y = y;
        }
        updateObjectTransform({
          id: object.id,
          position: [position.x, y, position.z],
          rotation: [0, rotation.y, 0],
        });
      }}
    >
      {meshContent}
    </TransformControls>
  );
}

export default PlacedObject;
