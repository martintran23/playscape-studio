const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

export function decodeTerrainRgbElevation(r, g, b) {
  // Mapbox Terrain-RGB encoding
  // elevation (meters) = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}

/** Inverse of decode — for synthesizing flat DEM filler tiles when a request fails. */
export function encodeTerrainRgbFromMeters(elevationMeters) {
  const v = Math.max(0, Math.min(16777215, Math.round((elevationMeters + 10000) / 0.1)));
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return { r, g, b };
}

export function latLngToTile(lng, lat, z) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z };
}

export function getTerrainRgbTileUrl(lat, lng, z) {
  if (!MAPBOX_TOKEN) {
    console.error("Missing Mapbox token. Set VITE_MAPBOX_TOKEN or VITE_MAPBOX_ACCESS_TOKEN.");
    return "";
  }

  const { x, y } = latLngToTile(lng, lat, z);
  // Mapbox raster tiles endpoint for Terrain-RGB (pngraw keeps original pixel values)
  return `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.pngraw?access_token=${MAPBOX_TOKEN}`;
}

/** Same x/y/z as terrain tiles — use for pixel-aligned satellite draping. */
export function getTerrainRgbTileUrlByXY(z, x, y) {
  if (!MAPBOX_TOKEN) {
    console.error("Missing Mapbox token. Set VITE_MAPBOX_TOKEN or VITE_MAPBOX_ACCESS_TOKEN.");
    return "";
  }
  return `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.pngraw?access_token=${MAPBOX_TOKEN}`;
}

/** Satellite raster tiles (256×256); must match terrain tile grid for accurate draping. */
export function getSatelliteRasterTileUrl(z, x, y) {
  if (!MAPBOX_TOKEN) {
    console.error("Missing Mapbox token. Set VITE_MAPBOX_TOKEN or VITE_MAPBOX_ACCESS_TOKEN.");
    return "";
  }
  return `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}.jpg?access_token=${MAPBOX_TOKEN}`;
}

