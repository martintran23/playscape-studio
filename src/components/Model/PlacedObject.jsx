import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import useSceneStore from "../../store/sceneStore";

function PlacedObject({ object, model }) {
  const ref = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const dragPoint = useMemo(() => new THREE.Vector3(), []);

  const selectedObjectId = useSceneStore((state) => state.selectedObjectId);
  const selectObject = useSceneStore((state) => state.selectObject);
  const updateObjectTransform = useSceneStore((state) => state.updateObjectTransform);

  const isSelected = selectedObjectId === object.id;

  const handlePointerDown = (event) => {
    event.stopPropagation();
    setIsDragging(true);
    selectObject(object.id);
  };

  const handlePointerUp = (event) => {
    event.stopPropagation();
    setIsDragging(false);
  };

  const handlePointerMove = (event) => {
    if (!isDragging) return;
    event.stopPropagation();

    if (event.ray.intersectPlane(dragPlane, dragPoint)) {
      updateObjectTransform({
        id: object.id,
        position: [dragPoint.x, 0.6, dragPoint.z],
      });
    }
  };

  return (
    <mesh
      ref={ref}
      position={object.position}
      rotation={object.rotation}
      castShadow
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        selectObject(object.id);
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      {/* Placeholder geometry for now; replace with GLTF model per modelPath later. */}
      <boxGeometry args={[1.2, 1.2, 1.2]} />
      <meshStandardMaterial color={isSelected ? "#facc15" : model.color} />
    </mesh>
  );
}

export default PlacedObject;
