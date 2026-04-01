/**
 * Ray casting point-in-polygon (XZ plane).
 */
function pointInPolygonRaycast(x, z, polygon) {
  if (!polygon?.length) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersect = (zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * @param {number} [footprintRadius] meters — if positive, center plus a ring of samples must lie inside (horizontal footprint).
 */
export function pointInPolygon2D(x, z, polygon, footprintRadius = 0) {
  if (!polygon?.length) return false;
  const r = Number(footprintRadius);
  if (!Number.isFinite(r) || r <= 0) {
    return pointInPolygonRaycast(x, z, polygon);
  }
  if (!pointInPolygonRaycast(x, z, polygon)) return false;
  const n = 8;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const pz = z + Math.sin(a) * r;
    if (!pointInPolygonRaycast(px, pz, polygon)) return false;
  }
  return true;
}

export function boundingBoxXZ(points) {
  if (!points?.length) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, cx: 0, cz: 0, width: 0, depth: 0 };
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    const x = p.x;
    const z = p.z;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    cx,
    cz,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

export function distanceXZ(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}
