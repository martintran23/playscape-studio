import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import PlacedObject from "../Model/PlacedObject";
import useSceneStore from "../../store/sceneStore";

function GroundPlane() {
  const activeModelId = useSceneStore((state) => state.activeModelId);
  const addObjectAt = useSceneStore((state) => state.addObjectAt);
  const selectObject = useSceneStore((state) => state.selectObject);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={(event) => {
        event.stopPropagation();
        addObjectAt({
          modelId: activeModelId,
          position: [event.point.x, 0.6, event.point.z],
        });
      }}
      onPointerMissed={() => selectObject(null)}
    >
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#d1d5db" />
    </mesh>
  );
}

function ParkScene() {
  const placedObjects = useSceneStore((state) => state.placedObjects);
  const models = useSceneStore((state) => state.models);
  const modelById = Object.fromEntries(models.map((model) => [model.id, model]));

  return (
    <div className="h-full w-full">
      <Canvas shadows camera={{ position: [8, 8, 8], fov: 50 }}>
        <color attach="background" args={["#f8fafc"]} />
        <ambientLight intensity={0.65} />
        <directionalLight position={[12, 14, 8]} intensity={1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
        <Grid args={[200, 200]} cellSize={1} cellThickness={0.7} sectionSize={5} sectionThickness={1.1} sectionColor="#94a3b8" fadeDistance={180} />
        <GroundPlane />

        {placedObjects.map((object) => (
          <PlacedObject key={object.id} object={object} model={modelById[object.modelId]} />
        ))}

        <OrbitControls makeDefault enablePan enableZoom enableRotate />
      </Canvas>
    </div>
  );
}

export default ParkScene;
