import { decodeTerrainRgbElevation } from "./mapboxTerrainService";

/**
 * Bilinear sample of Terrain-RGB imageData (RGBA) at fractional pixel (fx, fy).
 * fx, fy in [0, width-1] and [0, height-1] pixel space (top-left origin).
 */
export function sampleElevationBilinear(data, width, height, fx, fy) {
  const x = Math.max(0, Math.min(width - 1, fx));
  const y = Math.max(0, Math.min(height - 1, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;

  const read = (px, py) => {
    const i = (py * width + px) * 4;
    return decodeTerrainRgbElevation(data[i], data[i + 1], data[i + 2]);
  };

  const v00 = read(x0, y0);
  const v10 = read(x1, y0);
  const v01 = read(x0, y1);
  const v11 = read(x1, y1);
  const a = v00 * (1 - tx) + v10 * tx;
  const b = v01 * (1 - tx) + v11 * tx;
  return a * (1 - ty) + b * ty;
}
