import * as THREE from "three";

function interp(L, xa, ya, za, xb, yb, zb) {
  if ((ya - L) * (yb - L) > 0) return null;
  if (Math.abs(ya - yb) < 1e-9) return null;
  const t = (L - ya) / (yb - ya);
  if (t < -1e-5 || t > 1 + 1e-5) return null;
  return new THREE.Vector3(xa + (xb - xa) * t, L, za + (zb - za) * t);
}

/**
 * Optional debug iso-contours on displaced terrain grid (marching edges per cell).
 */
export function buildContourLineSegments(geometry, spacingMeters = 12, maxSegments = 18000) {
  const pos = geometry?.attributes?.position;
  const params = geometry?.parameters;
  if (!pos || params?.widthSegments == null) return null;

  const wSeg = params.widthSegments;
  const hSeg = params.heightSegments;
  const w = wSeg + 1;
  const id = (ix, iz) => iz * w + ix;

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (!(maxY > minY) || spacingMeters <= 0) return null;

  const out = [];
  let n = 0;

  const pushSeg = (a, b) => {
    if (n >= maxSegments) return false;
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
    n += 2;
    return true;
  };

  const firstL = Math.ceil(minY / spacingMeters) * spacingMeters;
  for (let L = firstL; L < maxY && n < maxSegments; L += spacingMeters) {
    for (let iz = 0; iz < hSeg && n < maxSegments; iz += 1) {
      for (let ix = 0; ix < wSeg && n < maxSegments; ix += 1) {
        const i00 = id(ix, iz);
        const i10 = id(ix + 1, iz);
        const i11 = id(ix + 1, iz + 1);
        const i01 = id(ix, iz + 1);

        const pts = [];
        const e0 = interp(L, pos.getX(i00), pos.getY(i00), pos.getZ(i00), pos.getX(i10), pos.getY(i10), pos.getZ(i10));
        const e1 = interp(L, pos.getX(i10), pos.getY(i10), pos.getZ(i10), pos.getX(i11), pos.getY(i11), pos.getZ(i11));
        const e2 = interp(L, pos.getX(i11), pos.getY(i11), pos.getZ(i11), pos.getX(i01), pos.getY(i01), pos.getZ(i01));
        const e3 = interp(L, pos.getX(i01), pos.getY(i01), pos.getZ(i01), pos.getX(i00), pos.getY(i00), pos.getZ(i00));
        if (e0) pts.push(e0);
        if (e1) pts.push(e1);
        if (e2) pts.push(e2);
        if (e3) pts.push(e3);

        if (pts.length === 2) {
          pushSeg(pts[0], pts[1]);
        } else if (pts.length === 3) {
          pushSeg(pts[0], pts[1]);
        } else if (pts.length === 4) {
          const d02 = pts[0].distanceTo(pts[2]);
          const d13 = pts[1].distanceTo(pts[3]);
          if (d02 <= d13) {
            pushSeg(pts[0], pts[2]);
            pushSeg(pts[1], pts[3]);
          } else {
            pushSeg(pts[0], pts[3]);
            pushSeg(pts[1], pts[2]);
          }
        }
      }
    }
  }

  if (out.length < 6) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(out), 3));
  return g;
}
