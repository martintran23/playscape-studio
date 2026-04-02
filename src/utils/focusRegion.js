import { METERS_PER_WORLD_UNIT } from "../constants/geoscene";
import { computeStitchLayout, latLngToWorldXZ, worldXZToLatLng } from "./stitchGeoreference";
import { getSlippyTileWorldMeters } from "./mapboxService";

const FOCUS_MAP_ZOOM = 19;
const NATIVE_TILE_PX = 256;
/** Starting odd tile count; grows until the stitch covers the padded selection bbox. */
const DEFAULT_TILE_GRID = 5;
const MAX_TILE_GRID = 21;
const BBOX_PAD = 1.06;

/**
 * Builds a tighter stitch centered on the polygon. `worldSizeMeters` is always
 * `tileGrid × slippyTileWorldMeters` at the layout center latitude (same as the main editor),
 * so scene units stay **METERS_PER_WORLD_UNIT meters** per unit and GLB scale matches imagery.
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

  const centerGeo = worldXZToLatLng(sourceStitchLayout, cx, cz);
  const tileM = getSlippyTileWorldMeters(centerGeo.latitude, FOCUS_MAP_ZOOM, NATIVE_TILE_PX);
  const minExtent = Math.max(width, depth) * BBOX_PAD;

  let tileGrid = DEFAULT_TILE_GRID;
  while (tileGrid * tileM < minExtent && tileGrid < MAX_TILE_GRID) {
    tileGrid += 2;
  }

  const worldSizeMeters = tileM * tileGrid;
  if (!Number.isFinite(worldSizeMeters) || worldSizeMeters <= 0) return null;

  const stitchLayout = computeStitchLayout(
    centerGeo.longitude,
    centerGeo.latitude,
    FOCUS_MAP_ZOOM,
    tileGrid,
    worldSizeMeters,
  );

  const polygonLocal = pointsWorld.map((p) => {
    const { latitude, longitude } = worldXZToLatLng(sourceStitchLayout, p.x, p.z);
    const w = latLngToWorldXZ(stitchLayout, latitude, longitude);
    return {
      x: w.x * METERS_PER_WORLD_UNIT,
      z: w.z * METERS_PER_WORLD_UNIT,
    };
  });

  const groundSize = worldSizeMeters * METERS_PER_WORLD_UNIT;

  return {
    stitchLayout,
    groundSize,
    polygonLocal,
    centerGeo,
    mapCenterLat: centerGeo.latitude,
    mapCenterLng: centerGeo.longitude,
    originWorld: { x: cx, z: cz },
    mapZoom: FOCUS_MAP_ZOOM,
    tileGrid,
    lodSegments: 320,
  };
}
