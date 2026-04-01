import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const _target = new THREE.Vector3();
const _endPos = new THREE.Vector3();

/**
 * Smooths camera from its initial position toward a framing of the origin (focused region center).
 */
export default function FocusCameraIntro({ orbitRef, groundSize, enabled }) {
  const { camera, invalidate } = useThree();
  const t0 = useRef(null);
  const from = useRef(new THREE.Vector3());
  const done = useRef(false);

  useFrame((state) => {
    if (!enabled || done.current) return;
    const controls = orbitRef?.current;
    if (!controls?.target) return;
    if (t0.current === null) {
      t0.current = state.clock.elapsedTime;
      from.current.copy(camera.position);
    }
    const t = Math.min(1, (state.clock.elapsedTime - t0.current) / 1.15);
    const k = 1 - (1 - t) ** 3;
    _endPos.set(0, Math.max(28, groundSize * 0.28), Math.max(36, groundSize * 0.36));
    camera.position.lerpVectors(from.current, _endPos, k);
    _target.set(0, 0, 0);
    controls.target.lerp(_target, k);
    controls.update?.();
    invalidate();
    if (t >= 1) done.current = true;
  });

  return null;
}
