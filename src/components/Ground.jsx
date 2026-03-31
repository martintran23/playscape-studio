function Ground({ texture, isLoadingTexture, onPlaceObject, size = 120 }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={onPlaceObject}>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial map={texture ?? null} color={texture ? "#ffffff" : "#d1d5db"} />
      </mesh>
      {isLoadingTexture ? (
        <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[18, 4]} />
          <meshBasicMaterial color="#0f172a" transparent opacity={0.75} />
        </mesh>
      ) : null}
    </group>
  );
}

export default Ground;
