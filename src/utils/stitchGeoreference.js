import { latLngToTile } from "./mapboxTerrainService";

/**
 * Fractional slippy tile (same projection as Mapbox raster / MVT).
 */
export function latLngToTileFloat(lng, lat, zoom) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

export function tileFloatToLatLng(tileX, tileY, zoom) {
  const n = 2 ** zoom;
  const lng = (tileX / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

/**
 * Layout for a tileGrid×tileGrid stitch centered on the integer tile that contains (centerLng, centerLat).
 * Scene origin (0,0) is pinned to (centerLng, centerLat) — the same point shown at the center of the user's search.
 */
export function computeStitchLayout(centerLng, centerLat, zoom, tileGrid, worldSizeMeters) {
  const { x: cx, y: cy } = latLngToTile(centerLng, centerLat, zoom);
  const half = Math.floor(tileGrid / 2);
  const canvasW = tileGrid * 256;
  const canvasH = tileGrid * 256;
  const { x: refTileX, y: refTileY } = latLngToTileFloat(centerLng, centerLat, zoom);
  const pxRef = (refTileX - (cx - half)) * 256;
  const pyRef = (refTileY - (cy - half)) * 256;

  return {
    cx,
    cy,
    zoom,
    half,
    canvasW,
    canvasH,
    worldSizeMeters,
    refTileX,
    refTileY,
    pxRef,
    pyRef,
  };
}

export function latLngToWorldXZ(layout, lat, lng) {
  const { x: tx, y: ty } = latLngToTileFloat(lng, lat, layout.zoom);
  const px = (tx - (layout.cx - layout.half)) * 256;
  const py = (ty - (layout.cy - layout.half)) * 256;
  const { pxRef, pyRef, canvasW, canvasH, worldSizeMeters: ws } = layout;
  const worldX = ((px - pxRef) / canvasW) * ws;
  const worldZ = ((pyRef - py) / canvasH) * ws;
  return { x: worldX, z: worldZ };
}

export function worldXZToLatLng(layout, worldX, worldZ) {
  const { pxRef, pyRef, canvasW, canvasH, worldSizeMeters: ws, cx, cy, half, zoom } = layout;
  const px = pxRef + (worldX / ws) * canvasW;
  const py = pyRef - (worldZ / ws) * canvasH;
  const tileX = cx - half + px / 256;
  const tileY = cy - half + py / 256;
  const { lat, lng } = tileFloatToLatLng(tileX, tileY, zoom);
  return { latitude: lat, longitude: lng };
}
