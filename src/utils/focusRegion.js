import { computeStitchLayout, latLngToWorldXZ, worldXZToLatLng } from "./stitchGeoreference";

const FOCUS_MAP_ZOOM = 19;
/** Odd count, centered on region — smaller than park stitch so less “map around” the selection */
const DEFAULT_TILE_GRID = 5;
const MIN_GROUND_M = 32;
const BBOX_PAD = 1.06;

/**
 * Builds a tighter stitch layout centered on the polygon AABB and returns polygon in focus-local XZ (origin at center).
 */
export function buildFocusStitchFromWorldPolygon(sourceStitchLayout, pointsWorld) {
  if (!sourceStitchLayout || !pointsWorld?.length) return null;

  const xs = pointsWorld.map((p) => p.x);
  const zs = pointsWorld.map((p) => p.z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const width = maxX - minX;
  const depth = maxZ - minZ;

  let groundSize = Math.max(width, depth) * BBOX_PAD;
  groundSize = Math.max(groundSize, MIN_GROUND_M);

  const centerGeo = worldXZToLatLng(sourceStitchLayout, cx, cz);
  const stitchLayout = computeStitchLayout(
    centerGeo.longitude,
    centerGeo.latitude,
    FOCUS_MAP_ZOOM,
    DEFAULT_TILE_GRID,
    groundSize,
  );

  /** Same XZ space as focus terrain raycasts (not main-editor bbox offsets). */
  const polygonLocal = pointsWorld.map((p) => {
    const { latitude, longitude } = worldXZToLatLng(sourceStitchLayout, p.x, p.z);
    const w = latLngToWorldXZ(stitchLayout, latitude, longitude);
    return { x: w.x, z: w.z };
  });

  return {
    stitchLayout,
    groundSize,
    polygonLocal,
    centerGeo,
    mapCenterLat: centerGeo.latitude,
    mapCenterLng: centerGeo.longitude,
    originWorld: { x: cx, z: cz },
    mapZoom: FOCUS_MAP_ZOOM,
    tileGrid: DEFAULT_TILE_GRID,
    lodSegments: 320,
  };
}
