import * as THREE from "three";

const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3(0, -1, 0);
const _raycaster = new THREE.Raycaster();

/**
 * Returns world Y on terrain mesh directly below (x, z), or null if no hit.
 */
export function getTerrainHeightAt(mesh, x, z) {
  if (!mesh) return null;
  _origin.set(x, 1e6, z);
  _raycaster.set(_origin, _dir);
  const hits = _raycaster.intersectObject(mesh, false);
  if (!hits.length) return null;
  return hits[0].point.y;
}
