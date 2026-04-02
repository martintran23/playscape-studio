/**
 * Scene convention: when `stitchLayout.worldSizeMeters` equals the physical east–west span of
 * the stitched tile grid (`tileGrid × slippyTileWorldMeters` at the layout center latitude),
 * **one world unit on the ground plane is one meter** (`latLngToWorldXZ` / `worldXZToLatLng`).
 *
 * Never set `worldSizeMeters` from polygon bbox alone — that redefines meters per unit and breaks
 * GLB sizes (fitMaxDimensionMeters) relative to imagery.
 */
export const METERS_PER_WORLD_UNIT = 1;
