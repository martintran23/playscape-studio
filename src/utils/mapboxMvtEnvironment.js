import { VectorTile } from "@mapbox/vector-tile";
import Pbf from "pbf";
import { latLngToWorldXZ, tileFloatToLatLng } from "./stitchGeoreference";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

/** Landuse types where we scatter tree instances (approximate canopy / park). */
const TREE_LANDUSE_CLASSES = new Set(["wood", "forest", "scrub", "park", "national_park", "orchard"]);

export function getMapboxStreetsV8TileUrl(z, x, y) {
  if (!MAPBOX_TOKEN) {
    console.error("Missing Mapbox token for vector tiles.");
    return "";
  }
  return `https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${z}/${x}/${y}.mvt?access_token=${MAPBOX_TOKEN}`;
}

/** Mapbox Streets vector tiles are published to z16; higher zooms often return 404. */
const MVT_PUBLISHED_MAX_Z = 16;

function downsampleTileIndex(z, x, y, targetZ) {
  if (z <= targetZ) return { z, x, y };
  const d = z - targetZ;
  return { z: targetZ, x: x >> d, y: y >> d };
}

function mvtPointToWorldXZ(tx, ty, z, localX, localY, extent, layout) {
  const wx = tx + localX / extent;
  const wy = ty + localY / extent;
  const { lat, lng } = tileFloatToLatLng(wx, wy, z);
  return latLngToWorldXZ(layout, lat, lng);
}

function parseHeightMeters(properties) {
  if (properties.height != null) {
    const h = parseFloat(String(properties.height), 10);
    if (Number.isFinite(h) && h > 1) return Math.min(h, 140);
  }
  if (properties["building:levels"] != null) {
    const n = parseInt(String(properties["building:levels"]), 10);
    if (Number.isFinite(n) && n > 0) return Math.min(n * 3.2, 140);
  }
  if (properties.type === "garage" || properties.type === "shed") return 3.8;
  if (properties.type === "industrial" || properties.type === "commercial") return 14;
  return 10;
}

function parseMinHeightMeters(properties) {
  if (properties.min_height != null) {
    const h = parseFloat(String(properties.min_height), 10);
    if (Number.isFinite(h) && h > 0) return Math.min(h, 80);
  }
  return 0;
}

function ringAreaXZ(ring) {
  if (ring.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    a += ring[i].x * ring[j].z - ring[j].x * ring[i].z;
  }
  return Math.abs(a) * 0.5;
}

function ringCentroid(ring) {
  let sx = 0;
  let sz = 0;
  for (const p of ring) {
    sx += p.x;
    sz += p.z;
  }
  const n = ring.length;
  return { x: sx / n, z: sz / n };
}

function pointInPolygon(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i].x;
    const zi = ring[i].z;
    const xj = ring[j].x;
    const zj = ring[j].z;
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function parseTileToFeatures(buffer, tx, ty, z, layout, halfWorld) {
  const buildings = [];
  const treeZones = [];

  let tile;
  try {
    tile = new VectorTile(new Pbf(new Uint8Array(buffer)));
  } catch {
    return { buildings: [], treeZones: [] };
  }

  const buildingLayer = tile.layers.building;
  if (buildingLayer) {
    const extent = buildingLayer.extent || 4096;
    for (let i = 0; i < buildingLayer.length; i += 1) {
      const feature = buildingLayer.feature(i);
      if (feature.type !== 3) continue;
      const geoms = feature.loadGeometry();
      if (!geoms?.length) continue;

      const props = feature.properties || {};
      if (String(props.underground).toLowerCase() === "true") continue;

      const heightM = parseHeightMeters(props);
      const minHM = parseMinHeightMeters(props);
      if (heightM < 2) continue;

      const outer = geoms[0].map((pt) => mvtPointToWorldXZ(tx, ty, z, pt.x, pt.y, extent, layout));
      const centroid = ringCentroid(outer.map((p) => ({ x: p.x, z: p.z })));
      if (Math.abs(centroid.x) > halfWorld || Math.abs(centroid.z) > halfWorld) continue;

      const area = ringAreaXZ(outer.map((p) => ({ x: p.x, z: p.z })));
      if (area < 1.5) continue;

      const holes = [];
      for (let r = 1; r < geoms.length; r += 1) {
        holes.push(geoms[r].map((pt) => mvtPointToWorldXZ(tx, ty, z, pt.x, pt.y, extent, layout)));
      }

      buildings.push({
        outer,
        holes,
        heightM,
        minHM,
        buildingType: String(props.type || props.class || "residential").toLowerCase(),
        key: `${Math.round(centroid.x * 4) / 4}_${Math.round(centroid.z * 4) / 4}_${Math.round(heightM)}`,
      });
    }
  }

  const landuseLayer = tile.layers.landuse;
  if (landuseLayer) {
    const extent = landuseLayer.extent || 4096;
    for (let i = 0; i < landuseLayer.length; i += 1) {
      const feature = landuseLayer.feature(i);
      if (feature.type !== 3) continue;
      const geoms = feature.loadGeometry();
      if (!geoms?.length) continue;
      const props = feature.properties || {};
      const cls = String(props.class || props.type || "").toLowerCase();
      if (!TREE_LANDUSE_CLASSES.has(cls)) continue;

      const outer = geoms[0].map((pt) => mvtPointToWorldXZ(tx, ty, z, pt.x, pt.y, extent, layout));
      const ring = outer.map((p) => ({ x: p.x, z: p.z }));
      const centroid = ringCentroid(ring);
      if (Math.abs(centroid.x) > halfWorld * 1.05 || Math.abs(centroid.z) > halfWorld * 1.05) continue;
      const area = ringAreaXZ(ring);
      if (area < 120) continue;

      treeZones.push({ outerRing: ring });
    }
  }

  return { buildings, treeZones };
}

/**
 * Fetches Mapbox Streets v8 tiles (same grid as terrain) and returns extruded building specs + tree scatter zones.
 */
export async function fetchLocationEnvironmentFeatures({ layout, signal }) {
  if (!MAPBOX_TOKEN || !layout) {
    return { buildings: [], treeZones: [] };
  }

  const { worldSizeMeters, zoom, cx, cy, half } = layout;
  const halfWorld = worldSizeMeters * 0.5 + 2;

  const uniqueTiles = new Map();
  for (let row = -half; row <= half; row += 1) {
    for (let col = -half; col <= half; col += 1) {
      const tx = cx + col;
      const ty = cy + row;
      const down = downsampleTileIndex(zoom, tx, ty, MVT_PUBLISHED_MAX_Z);
      const key = `${down.z}/${down.x}/${down.y}`;
      if (!uniqueTiles.has(key)) uniqueTiles.set(key, down);
    }
  }

  const bufferByKey = new Map();
  await Promise.all(
    [...uniqueTiles.entries()].map(async ([key, t]) => {
      const url = getMapboxStreetsV8TileUrl(t.z, t.x, t.y);
      try {
        const res = await fetch(url, { signal });
        const buf = res.ok ? await res.arrayBuffer() : null;
        bufferByKey.set(key, buf);
      } catch {
        bufferByKey.set(key, null);
      }
    }),
  );

  const buildings = [];
  const treeZones = [];
  const seen = new Set();

  for (const [key, t] of uniqueTiles) {
    const buf = bufferByKey.get(key);
    if (!buf) continue;
    const parsed = parseTileToFeatures(buf, t.x, t.y, t.z, layout, halfWorld);
    for (const b of parsed.buildings) {
      if (seen.has(b.key)) continue;
      seen.add(b.key);
      buildings.push(b);
    }
    treeZones.push(...parsed.treeZones);
  }

  return { buildings, treeZones };
}

/** Deterministic pseudo-random 0..1 from integer coords */
export function hash01(ix, iz, salt) {
  let h = (ix * 374761393 + iz * 668265263 + salt * 1442695041) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Scatter tree positions inside polygon rings (world XZ).
 */
export function scatterTreePositions(treeZones, worldSizeMeters, { spacing = 7, maxInstances = 1600 } = {}) {
  const half = worldSizeMeters * 0.5;
  const out = [];
  let salt = 0;

  outer: for (const zone of treeZones) {
    const ring = zone.outerRing;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const p of ring) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }

    for (let x = minX; x <= maxX; x += spacing) {
      for (let z = minZ; z <= maxZ; z += spacing) {
        if (out.length >= maxInstances) break outer;
        if (Math.abs(x) > half || Math.abs(z) > half) continue;
        if (!pointInPolygon(x, z, ring)) continue;
        const ix = Math.round(x * 10);
        const iz = Math.round(z * 10);
        if (hash01(ix, iz, salt) > 0.42) continue;
        out.push({ x, z });
        salt += 1;
      }
    }
  }

  return out;
}
