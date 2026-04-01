import * as THREE from "three";
import { sampleElevationBilinear } from "./demSample";

/**
 * Non-linear height response: exaggerates larger relief vs flats (exponent > 1).
 */
export function curveDisplacementMeters(deltaMeters, verticalExaggeration, exponent) {
  if (!Number.isFinite(exponent) || exponent <= 1.001) {
    return deltaMeters * verticalExaggeration;
  }
  const sgn = Math.sign(deltaMeters);
  const m = Math.abs(deltaMeters) * verticalExaggeration;
  const ref = 12;
  return sgn * (Math.pow(m + 1e-5, exponent) / Math.pow(ref + 1e-5, exponent - 1));
}

/**
 * Object-space normal map (Y up) from Terrain-RGB raster. dx,dz in meters per texel.
 */
export function createNormalMapDataTexture(demPayload, worldSizeMeters, maxDim = 896) {
  if (!demPayload?.data) return null;
  const { data: demData, width: dw, height: dh } = demPayload;
  const tw = Math.max(32, Math.min(maxDim, dw));
  const th = Math.max(32, Math.min(maxDim, dh));

  const cellX = worldSizeMeters / dw;
  const cellZ = worldSizeMeters / dh;

  const rgba = new Uint8Array(tw * th * 4);

  for (let j = 0; j < th; j += 1) {
    for (let i = 0; i < tw; i += 1) {
      const u = i / (tw - 1);
      const v = j / (th - 1);
      const px = u * (dw - 1);
      const py = v * (dh - 1);

      const c = sampleElevationBilinear(demData, dw, dh, px, py);
      const l = sampleElevationBilinear(demData, dw, dh, px - 1, py);
      const r = sampleElevationBilinear(demData, dw, dh, px + 1, py);
      const d = sampleElevationBilinear(demData, dw, dh, px, py - 1);
      const uu = sampleElevationBilinear(demData, dw, dh, px, py + 1);

      const sx = worldSizeMeters / Math.max(dw, 1);
      const sz = worldSizeMeters / Math.max(dh, 1);
      const dhdx = (r - l) / (2 * sx);
      const dhdz = (uu - d) / (2 * sz);
      const nx = -dhdx;
      const ny = 1;
      const nz = -dhdz;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      const R = (nx * invLen * 0.5 + 0.5) * 255;
      const G = (ny * invLen * 0.5 + 0.5) * 255;
      const B = (nz * invLen * 0.5 + 0.5) * 255;
      const o = (j * tw + i) * 4;
      rgba[o] = R;
      rgba[o + 1] = G;
      rgba[o + 2] = B;
      rgba[o + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(rgba, tw, th, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
