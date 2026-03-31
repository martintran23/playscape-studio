const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
const EARTH_RADIUS_METERS = 6378137;
const DEFAULT_ZOOM = 18;
const DEFAULT_SIZE = 1024;

export function getMapboxStaticImage(lat, lng, options = {}) {
  const zoom = options.zoom ?? DEFAULT_ZOOM;
  const width = options.width ?? DEFAULT_SIZE;
  const height = options.height ?? DEFAULT_SIZE;

  if (!MAPBOX_TOKEN) {
    console.error("Missing Mapbox token. Set VITE_MAPBOX_TOKEN or VITE_MAPBOX_ACCESS_TOKEN.");
    return "";
  }

  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},${zoom}/${width}x${height}?access_token=${MAPBOX_TOKEN}`;
}

export function getMapMetrics(lat, options = {}) {
  const zoom = options.zoom ?? DEFAULT_ZOOM;
  const width = options.width ?? DEFAULT_SIZE;
  const height = options.height ?? DEFAULT_SIZE;
  const latRadians = (lat * Math.PI) / 180;
  const metersPerPixel = (156543.03392 * Math.cos(latRadians)) / 2 ** zoom;

  return {
    zoom,
    width,
    height,
    metersPerPixel,
    worldWidthMeters: width * metersPerPixel,
    worldHeightMeters: height * metersPerPixel,
  };
}

export function worldOffsetToLatLng(centerLat, centerLng, offsetX, offsetZ) {
  const latRadians = (centerLat * Math.PI) / 180;
  const deltaLat = (-offsetZ / EARTH_RADIUS_METERS) * (180 / Math.PI);
  const deltaLng = (offsetX / (EARTH_RADIUS_METERS * Math.cos(latRadians))) * (180 / Math.PI);
  return {
    latitude: centerLat + deltaLat,
    longitude: centerLng + deltaLng,
  };
}

/** Inverse of offsets used in worldOffsetToLatLng: local XZ meters from scene origin at (centerLat, centerLng). */
export function latLngToWorldOffset(centerLat, centerLng, lat, lng) {
  const latRadians = (centerLat * Math.PI) / 180;
  const deltaLat = lat - centerLat;
  const deltaLng = lng - centerLng;
  const offsetZ = (-(deltaLat * Math.PI) / 180) * EARTH_RADIUS_METERS;
  const offsetX = (((deltaLng * Math.PI) / 180) * EARTH_RADIUS_METERS * Math.cos(latRadians));
  return { offsetX, offsetZ };
}

/** Ground width/height in meters for one standard 256px Mapbox raster tile at zoom z (Web Mercator). */
export function getSlippyTileWorldMeters(latitude, zoom, tilePixelSize = 256) {
  const latRadians = (latitude * Math.PI) / 180;
  const metersPerPixel = (156543.03392 * Math.cos(latRadians)) / 2 ** zoom;
  return tilePixelSize * metersPerPixel;
}
