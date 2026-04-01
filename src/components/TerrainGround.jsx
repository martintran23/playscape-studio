import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import {
  decodeTerrainRgbElevation,
  encodeTerrainRgbFromMeters,
  getSatelliteRasterTileUrl,
  getTerrainRgbTileUrlByXY,
} from "../utils/mapboxTerrainService";
import { sampleElevationBilinear } from "../utils/demSample";
import useSceneStore from "../store/sceneStore";

const NATIVE_TILE_PX = 256;

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    image.src = url;
  });
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

function applyDisplacement(geometry, layout, demPayload, verticalExaggeration) {
  if (!demPayload || !geometry || !layout) return;
  const { data, width, height, baseElevation } = demPayload;
  const positions = geometry.attributes.position;
  const { pxRef, pyRef, canvasW, canvasH, worldSizeMeters: ws } = layout;
  for (let vi = 0; vi < positions.count; vi += 1) {
    const vx = positions.getX(vi);
    const vz = positions.getZ(vi);
    const px = pxRef + (vx / ws) * canvasW;
    const py = pyRef - (vz / ws) * canvasH;
    const fx = Math.max(0, Math.min(width - 1, (px / canvasW) * (width - 1)));
    const fy = Math.max(0, Math.min(height - 1, (py / canvasH) * (height - 1)));
    const elev = sampleElevationBilinear(data, width, height, fx, fy);
    positions.setY(vi, (elev - baseElevation) * verticalExaggeration);
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
  const [isLoading, setIsLoading] = useState(false);
  const setTerrainMesh = useSceneStore((state) => state.setTerrainMesh);

  const worldSizeMeters = stitchLayout?.worldSizeMeters;

  const geometry = useMemo(() => {
    if (!layoutValid(stitchLayout)) return null;
    const g = new THREE.PlaneGeometry(worldSizeMeters, worldSizeMeters, segments, segments);
    g.rotateX(-Math.PI / 2);
    applyStitchUv(g, stitchLayout);
    return g;
  }, [worldSizeMeters, segments, stitchLayout]);

  useEffect(() => {
    if (!layoutValid(stitchLayout) || !worldSizeMeters) {
      setDemPayload(null);
      setSatTexture(null);
      setIsLoading(false);
      return undefined;
    }

    const { cx, cy, zoom, half, canvasW, canvasH } = stitchLayout;
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      setDemPayload(null);
      setSatTexture(null);
      if (satTextureRef.current) {
        satTextureRef.current.dispose();
        satTextureRef.current = null;
      }

      try {
        const z = zoom;
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
                try {
                  const [satImg, demImg] = await Promise.all([loadImage(satUrl), loadImage(demUrl)]);
                  if (cancelled) return;
                  satCtx.drawImage(satImg, dx, dy, NATIVE_TILE_PX, NATIVE_TILE_PX);
                  demCtx.drawImage(demImg, dx, dy, NATIVE_TILE_PX, NATIVE_TILE_PX);
                } catch {
                  if (cancelled) return;
                  satCtx.fillStyle = "#5a6b52";
                  satCtx.fillRect(dx, dy, NATIVE_TILE_PX, NATIVE_TILE_PX);
                  failedDemTiles.push({ dx, dy });
                }
              })(),
            );
          }
        }

        await Promise.all(tasks);
        if (cancelled) return;

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
          console.warn("TerrainGround: could not read DEM pixels (tainted canvas or browser policy). Showing satellite only, flat height.", demErr);
        }

        const tex = new THREE.CanvasTexture(satCanvas);
        tex.needsUpdate = true;
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        // Stitch sizes are not power-of-two (e.g. 9×256); mipmaps break sampling on many GPUs.
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 4;
        tex.colorSpace = THREE.SRGBColorSpace;
        if (cancelled) {
          tex.dispose();
          return;
        }
        satTextureRef.current = tex;
        setSatTexture(tex);

        setDemPayload(demPayloadNext);
      } catch (error) {
        if (!cancelled) {
          console.error("TerrainGround stitch failed:", error);
          setSatTexture(null);
          setDemPayload(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [stitchLayout]);

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
    applyDisplacement(geometry, stitchLayout, demPayload, verticalExaggeration);
  }, [demPayload, geometry, stitchLayout, verticalExaggeration]);

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

  return (
    <group>
      <mesh ref={bindMesh} geometry={geometry} receiveShadow onClick={onPlaceObject}>
        <meshStandardMaterial
          key={satTexture ? satTexture.uuid : "sat-pending"}
          map={satTexture ?? null}
          color={satTexture ? "#ffffff" : "#d1d5db"}
        />
      </mesh>
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
