import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  decodeTerrainRgbElevation,
  encodeTerrainRgbFromMeters,
  getSatelliteRasterTileUrl,
  getTerrainRgbTileUrlByXY,
} from "../utils/mapboxTerrainService";
import { sampleElevationBilinear } from "../utils/demSample";
import { curveDisplacementMeters } from "../utils/terrainSurfaceEnhance";
import { buildContourLineSegments } from "../utils/terrainContours";
import useSceneStore from "../store/sceneStore";

const NATIVE_TILE_PX = 256;

const USE_BASIC_TERRAIN_MATERIAL = import.meta.env.VITE_TERRAIN_DEBUG_BASIC === "1";

/**
 * Fetch tiles as ImageBitmap so 2D canvases stay CORS-clean: getImageData works for DEM,
 * and CanvasTexture uploads reliably (avoids tainted-canvas black maps from HTMLImageElement).
 */
async function loadTileBitmap(url) {
  if (!url) {
    throw new Error("Empty tile URL — set VITE_MAPBOX_TOKEN (or VITE_MAPBOX_ACCESS_TOKEN).");
  }
  const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" });
  if (!res.ok) {
    throw new Error(`Tile HTTP ${res.status}: ${url.slice(0, 120)}`);
  }
  const blob = await res.blob();
  return createImageBitmap(blob);
}

function fillDemTileFlat(demCtx, dx, dy, elevationMeters) {
  const { r, g, b } = encodeTerrainRgbFromMeters(elevationMeters);
  const img = demCtx.createImageData(NATIVE_TILE_PX, NATIVE_TILE_PX);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = 255;
  }
  demCtx.putImageData(img, dx, dy);
}

function applyStitchUv(geometry, layout) {
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const { pxRef, pyRef, canvasW, canvasH, worldSizeMeters: ws } = layout;
  for (let i = 0; i < pos.count; i += 1) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const px = pxRef + (vx / ws) * canvasW;
    const py = pyRef - (vz / ws) * canvasH;
    const u = THREE.MathUtils.clamp(px / canvasW, 0, 1);
    const v = THREE.MathUtils.clamp(1 - py / canvasH, 0, 1);
    uv.setXY(i, u, v);
  }
  uv.needsUpdate = true;
}

function applyDisplacement(geometry, layout, demPayload, verticalExaggeration, heightCurveExponent) {
  if (!demPayload || !geometry || !layout) return;
  const { data, width, height, baseElevation } = demPayload;
  const positions = geometry.attributes.position;
  const { pxRef, pyRef, canvasW, canvasH, worldSizeMeters: ws } = layout;
  const curveExp = heightCurveExponent ?? 1;
  for (let vi = 0; vi < positions.count; vi += 1) {
    const vx = positions.getX(vi);
    const vz = positions.getZ(vi);
    const px = pxRef + (vx / ws) * canvasW;
    const py = pyRef - (vz / ws) * canvasH;
    const fx = Math.max(0, Math.min(width - 1, (px / canvasW) * (width - 1)));
    const fy = Math.max(0, Math.min(height - 1, (py / canvasH) * (height - 1)));
    const elev = sampleElevationBilinear(data, width, height, fx, fy);
    positions.setY(
      vi,
      curveDisplacementMeters(elev - baseElevation, verticalExaggeration, curveExp),
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}

/**
 * Georeferenced terrain: stitched satellite + terrain-rgb on same slippy grid.
 * Scene origin pins (stitchLayout ref) to satellite/DEM sampling. Partial tile failures use placeholders so the patch still appears.
 */
function TerrainGround({
  stitchLayout,
  segments = 240,
  verticalExaggeration = 1,
  onPlaceObject,
  onLoadStateChange,
}) {
  const meshRef = useRef(null);
  const satTextureRef = useRef(null);
  const [satTexture, setSatTexture] = useState(null);
  const [demPayload, setDemPayload] = useState(null);
  const bumpTerrainSurface = useSceneStore((state) => state.bumpTerrainSurface);
  const terrainHeightCurveExponent = useSceneStore((state) => state.terrainHeightCurveExponent);
  const terrainDebugContours = useSceneStore((state) => state.terrainDebugContours);
  const terrainSurfaceEpoch = useSceneStore((state) => state.terrainSurfaceEpoch);
  const [contourGeo, setContourGeo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stitchError, setStitchError] = useState(null);
  const setTerrainMesh = useSceneStore((state) => state.setTerrainMesh);

  const worldSizeMeters = stitchLayout?.worldSizeMeters;

  const geometry = useMemo(() => {
    if (!layoutValid(stitchLayout)) return null;
    const g = new THREE.PlaneGeometry(worldSizeMeters, worldSizeMeters, segments, segments);
    g.rotateX(-Math.PI / 2);
    applyStitchUv(g, stitchLayout);
    if (import.meta.env.DEV && g.attributes.uv) {
      console.log("[TerrainGround] geometry UVs", g.attributes.uv.count);
    }
    return g;
  }, [worldSizeMeters, segments, stitchLayout]);

  useEffect(() => {
    if (!layoutValid(stitchLayout) || !worldSizeMeters) {
      setDemPayload(null);
      setSatTexture(null);
      setStitchError(null);
      setIsLoading(false);
      return undefined;
    }

    const { cx, cy, zoom, half, canvasW, canvasH } = stitchLayout;
    let alive = true;

    const run = async () => {
      setIsLoading(true);
      setStitchError(null);
      setDemPayload(null);
      setSatTexture(null);
      if (satTextureRef.current) {
        satTextureRef.current.dispose();
        satTextureRef.current = null;
      }

      try {
        const z = zoom;
        const sampleTx = cx;
        const sampleTy = cy;
        const sampleSatUrl = getSatelliteRasterTileUrl(z, sampleTx, sampleTy);
        const sampleDemUrl = getTerrainRgbTileUrlByXY(z, sampleTx, sampleTy);
        if (import.meta.env.DEV) {
          console.log("[TerrainGround] sample satellite tile URL:", sampleSatUrl);
          console.log("[TerrainGround] sample terrain-rgb tile URL:", sampleDemUrl);
        }

        const satCanvas = document.createElement("canvas");
        satCanvas.width = canvasW;
        satCanvas.height = canvasH;
        const satCtx = satCanvas.getContext("2d");
        if (!satCtx) throw new Error("Satellite canvas unavailable");

        const demCanvas = document.createElement("canvas");
        demCanvas.width = canvasW;
        demCanvas.height = canvasH;
        const demCtx = demCanvas.getContext("2d", { willReadFrequently: true });
        if (!demCtx) throw new Error("DEM canvas unavailable");

        const failedDemTiles = [];
        let tileFailCount = 0;

        const tasks = [];
        for (let row = -half; row <= half; row += 1) {
          for (let col = -half; col <= half; col += 1) {
            const tx = cx + col;
            const ty = cy + row;
            const satUrl = getSatelliteRasterTileUrl(z, tx, ty);
            const demUrl = getTerrainRgbTileUrlByXY(z, tx, ty);
            const dx = (col + half) * NATIVE_TILE_PX;
            const dy = (row + half) * NATIVE_TILE_PX;

            tasks.push(
              (async () => {
                let satBmp;
                let demBmp;
                try {
                  [satBmp, demBmp] = await Promise.all([loadTileBitmap(satUrl), loadTileBitmap(demUrl)]);
                  if (!alive) return;
                  satCtx.drawImage(satBmp, dx, dy, NATIVE_TILE_PX, NATIVE_TILE_PX);
                  demCtx.drawImage(demBmp, dx, dy, NATIVE_TILE_PX, NATIVE_TILE_PX);
                } catch (err) {
                  tileFailCount += 1;
                  if (import.meta.env.DEV && tileFailCount <= 3) {
                    console.warn("[TerrainGround] tile failed, using placeholder:", err?.message ?? err);
                  }
                  if (!alive) return;
                  satCtx.fillStyle = "#5a6b52";
                  satCtx.fillRect(dx, dy, NATIVE_TILE_PX, NATIVE_TILE_PX);
                  failedDemTiles.push({ dx, dy });
                } finally {
                  satBmp?.close?.();
                  demBmp?.close?.();
                }
              })(),
            );
          }
        }

        await Promise.all(tasks);
        if (!alive) return;

        let demPayloadNext = null;
        try {
          const { data, width, height } = demCtx.getImageData(0, 0, canvasW, canvasH);
          const mid = Math.floor(canvasW / 2);
          const midIdx = (mid * width + mid) * 4;
          const baseElevation = decodeTerrainRgbElevation(data[midIdx], data[midIdx + 1], data[midIdx + 2]);

          if (failedDemTiles.length) {
            for (const { dx, dy } of failedDemTiles) {
              fillDemTileFlat(demCtx, dx, dy, baseElevation);
            }
          }

          const demFinal = demCtx.getImageData(0, 0, canvasW, canvasH);
          demPayloadNext = {
            data: new Uint8ClampedArray(demFinal.data),
            width: demFinal.width,
            height: demFinal.height,
            baseElevation,
          };
        } catch (demErr) {
          console.warn("TerrainGround: could not read DEM pixels.", demErr);
        }

        const configureSatelliteTexture = (texture) => {
          texture.wrapS = THREE.ClampToEdgeWrapping;
          texture.wrapT = THREE.ClampToEdgeWrapping;
          texture.generateMipmaps = false;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = 4;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          return texture;
        };

        const albedoTex = configureSatelliteTexture(new THREE.CanvasTexture(satCanvas));

        if (!alive) {
          albedoTex.dispose();
          return;
        }
        satTextureRef.current = albedoTex;
        setSatTexture(albedoTex);
        if (import.meta.env.DEV) {
          console.log("[TerrainGround] satellite albedo texture", albedoTex, {
            tileFailures: tileFailCount,
            demOk: Boolean(demPayloadNext?.data),
          });
        }

        setDemPayload(demPayloadNext);
        if (tileFailCount === tasks.length) {
          setStitchError(new Error("All Mapbox tiles failed — check token, network, and CORS."));
        }
      } catch (error) {
        if (alive) {
          console.error("TerrainGround stitch failed:", error);
          setStitchError(error instanceof Error ? error : new Error(String(error)));
          setSatTexture(null);
          setDemPayload(null);
        }
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [stitchLayout, worldSizeMeters]);

  useEffect(
    () => () => {
      if (satTextureRef.current) {
        satTextureRef.current.dispose();
        satTextureRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (!demPayload?.data || !geometry || !layoutValid(stitchLayout)) return;
    applyDisplacement(geometry, stitchLayout, demPayload, verticalExaggeration, terrainHeightCurveExponent);
    bumpTerrainSurface();
  }, [
    demPayload,
    geometry,
    stitchLayout,
    verticalExaggeration,
    bumpTerrainSurface,
    terrainHeightCurveExponent,
  ]);

  useEffect(() => {
    if (!terrainDebugContours || !geometry || !demPayload?.data) {
      setContourGeo((prev) => {
        if (prev) prev.dispose();
        return null;
      });
      return;
    }
    const next = buildContourLineSegments(geometry, 11, 22000);
    setContourGeo((prev) => {
      if (prev) prev.dispose();
      return next;
    });
  }, [terrainDebugContours, geometry, demPayload?.data, terrainSurfaceEpoch]);

  const bindMesh = (node) => {
    meshRef.current = node;
    setTerrainMesh(node ?? null);
  };

  useEffect(
    () => () => {
      setTerrainMesh(null);
    },
    [setTerrainMesh],
  );

  useEffect(() => {
    onLoadStateChange?.(isLoading);
  }, [isLoading, onLoadStateChange]);

  if (!geometry) return null;

  const matKey = satTexture?.uuid ?? "sat-pending";
  const fallbackColor = stitchError && !satTexture ? "#ef4444" : "#d1d5db";

  return (
    <group>
      <mesh ref={bindMesh} geometry={geometry} receiveShadow onClick={onPlaceObject}>
        {USE_BASIC_TERRAIN_MATERIAL ? (
          <meshBasicMaterial
            key={`${matKey}-basic`}
            map={satTexture ?? undefined}
            color={satTexture ? "#ffffff" : fallbackColor}
            side={THREE.DoubleSide}
          />
        ) : (
          <meshStandardMaterial
            key={matKey}
            map={satTexture ?? undefined}
            color={satTexture ? "#ffffff" : fallbackColor}
            roughness={0.88}
            metalness={0.04}
            envMapIntensity={0.45}
            side={THREE.DoubleSide}
          />
        )}
      </mesh>
      {contourGeo ? (
        <lineSegments geometry={contourGeo} frustumCulled={false}>
          <lineBasicMaterial color="#0f172a" transparent opacity={0.55} depthWrite={false} />
        </lineSegments>
      ) : null}
      {isLoading ? (
        <mesh position={[0, 2, 0]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      ) : null}
    </group>
  );
}

function layoutValid(layout) {
  return layout != null && layout.cx != null && layout.cy != null && layout.half != null && layout.canvasW > 0;
}

export default TerrainGround;
