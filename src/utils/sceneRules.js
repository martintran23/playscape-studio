export const DEFAULT_TRANSLATION_SNAP = 0.5;
export const DEFAULT_ROTATION_SNAP = Math.PI / 8;
export const BOUNDARY_LIMIT = 45;
const MIN_GAP = 0.15;

const snapValue = (value, step) => Math.round(value / step) * step;

export function normalizeTransform({
  position,
  rotation,
  translationSnap,
  rotationSnap,
  boundaryLimit = BOUNDARY_LIMIT,
  skipTranslationSnap = false,
  skipBoundaryClamp = false,
}) {
  const snappedX = skipTranslationSnap ? position[0] : snapValue(position[0], translationSnap);
  const snappedZ = skipTranslationSnap ? position[2] : snapValue(position[2], translationSnap);
  const snappedY = position[1] ?? 0;

  const clampedX = skipBoundaryClamp
    ? snappedX
    : Math.max(-boundaryLimit, Math.min(boundaryLimit, snappedX));
  const clampedZ = skipBoundaryClamp
    ? snappedZ
    : Math.max(-boundaryLimit, Math.min(boundaryLimit, snappedZ));
  const snappedRy = snapValue(rotation[1] ?? 0, rotationSnap);

  return {
    position: [clampedX, snappedY, clampedZ],
    rotation: [rotation[0] ?? 0, snappedRy, rotation[2] ?? 0],
  };
}

export function canPlaceAt({
  candidatePosition,
  candidateRadius,
  objects,
  modelById,
  boundaryLimit = BOUNDARY_LIMIT,
  polygonConstraint = null,
  pointInPolygonFn = null,
}) {
  const [x, , z] = candidatePosition;

  if (polygonConstraint?.length >= 3 && typeof pointInPolygonFn === "function") {
    /* Center inside polygon; overlap checks still use full radii. Ring test was too strict vs mesh/FP error. */
    if (!pointInPolygonFn(x, z, polygonConstraint, 0)) return false;
  } else if (Math.abs(x) > boundaryLimit || Math.abs(z) > boundaryLimit) {
    return false;
  }

  return !objects.some((entry) => {
    const model = modelById[entry.modelId];
    if (!model) return false;

    const dx = entry.position[0] - x;
    const dz = entry.position[2] - z;
    const distance = Math.hypot(dx, dz);
    return distance < model.radius + candidateRadius + MIN_GAP;
  });
}
