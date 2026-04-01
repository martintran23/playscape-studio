import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { getTerrainHeightAt } from "./terrainRaycast";
import { scatterTreePositions } from "./mapboxMvtEnvironment";

const ROOF_THICK = 0.22;
const BUILDING_BASE_BUMP = 0.06;

function setUniformVertexColor(geometry, color) {
  const pos = geometry.attributes.position;
  const n = pos.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 1) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(arr, 3));
}

/** Wall shell: extruded footprint from base y=0 through wallHeight. */
function extrudeFootprintGeometry(outer, holes, extrudeDepth) {
  if (outer.length < 3) return null;
  const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, p.z)));
  for (const hole of holes) {
    if (hole.length < 3) continue;
    shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, p.z))));
  }
  const geom = new THREE.ExtrudeGeometry(shape, { depth: extrudeDepth, bevelEnabled: false, curveSegments: 1 });
  geom.rotateX(-Math.PI / 2);
  geom.scale(1, 1, -1);
  geom.computeBoundingBox();
  const bot = geom.boundingBox.min.y;
  geom.translate(0, -bot, 0);
  return geom;
}

/** Closed roof slab (footprint extruded thin) sitting on top of walls. */
function roofSlabGeometry(outer, holes, thickness, wallHeight) {
  if (outer.length < 3) return null;
  const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, p.z)));
  for (const hole of holes) {
    if (hole.length < 3) continue;
    shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p.x, p.z))));
  }
  const geom = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 1 });
  geom.rotateX(-Math.PI / 2);
  geom.scale(1, 1, -1);
  geom.computeBoundingBox();
  const bot = geom.boundingBox.min.y;
  geom.translate(0, wallHeight - bot, 0);
  return geom;
}

function wallRoofColors(buildingType, area) {
  const t = String(buildingType || "residential").toLowerCase();
  const wall = new THREE.Color();
  const roof = new THREE.Color();

  if (t.includes("commercial") || t.includes("retail") || t === "hotel") {
    wall.set("#c5d0e0");
    roof.set("#4a5568");
    return { wall, roof };
  }
  if (t.includes("industrial") || t === "warehouse" || t.includes("manufacturing")) {
    wall.set("#b8aea0");
    roof.set("#4d453c");
    return { wall, roof };
  }
  if (t.includes("civic") || t.includes("public") || t === "school" || t.includes("hospital")) {
    wall.set("#ddd2b8");
    roof.set("#6b5344");
    return { wall, roof };
  }
  if (t === "garage" || t === "shed" || t.includes("storage")) {
    wall.set("#9ca3af");
    roof.set("#3f4450");
    return { wall, roof };
  }
  if (t.includes("church") || t.includes("religious")) {
    wall.set("#d4c4b0");
    roof.set("#5c4a3a");
    return { wall, roof };
  }

  const j = ((area * 0.0007) % 1) * 0.11 - 0.055;
  wall.setHSL(0.1 + j, 0.26, 0.72);
  roof.setHSL(0.07 + j * 0.4, 0.18, 0.34);
  return { wall, roof };
}

/**
 * Merged building mesh + instanced tree mesh; callers dispose prior objects when rebuilding.
 */
export function buildEnvironmentMeshes({
  buildings,
  treeZones,
  worldSizeMeters,
  verticalExaggeration,
  terrainMesh,
}) {
  const buildingGeoms = [];
  const defaultGroundY = terrainMesh ? null : 0;
  const roofThickness = ROOF_THICK * Math.max(0.65, Math.min(1.2, verticalExaggeration));

  const limit = Math.min(buildings.length, 5000);
  const terrainHalf = worldSizeMeters * 0.5 - 0.25;
  for (let i = 0; i < limit; i += 1) {
    const b = buildings[i];
    const minH = b.minHM * verticalExaggeration;
    const wallH = Math.max(0.55, (b.heightM - b.minHM) * verticalExaggeration);
    const outer = b.outer.map((p) => ({ x: p.x, z: p.z }));
    const holes = b.holes.map((h) => h.map((p) => ({ x: p.x, z: p.z })));
    const cx = outer.reduce((s, p) => s + p.x, 0) / outer.length;
    const cz = outer.reduce((s, p) => s + p.z, 0) / outer.length;
    /* Sample terrain toward stitched bounds so fringe footprints still sit on the mesh. */
    const sampleX = THREE.MathUtils.clamp(cx, -terrainHalf, terrainHalf);
    const sampleZ = THREE.MathUtils.clamp(cz, -terrainHalf, terrainHalf);
    const groundY = getTerrainHeightAt(terrainMesh, sampleX, sampleZ) ?? defaultGroundY ?? 0;
    const baseLift = minH + groundY + BUILDING_BASE_BUMP;

    const gWall = extrudeFootprintGeometry(outer, holes, wallH);
    const gRoof = roofSlabGeometry(outer, holes, roofThickness, wallH);
    if (!gWall || !gRoof) continue;

    const area = b.outer.length > 2 ? Math.abs(ringArea2D(outer)) : 100;
    const { wall: wallCol, roof: roofCol } = wallRoofColors(b.buildingType, area);
    setUniformVertexColor(gWall, wallCol);
    setUniformVertexColor(gRoof, roofCol);

    const mergedB = mergeGeometries([gWall, gRoof], false);
    gWall.dispose();
    gRoof.dispose();
    mergedB.computeVertexNormals();
    mergedB.translate(0, baseLift, 0);
    buildingGeoms.push(mergedB);
  }

  let buildingMesh = null;
  if (buildingGeoms.length) {
    const merged = mergeGeometries(buildingGeoms, false);
    for (const g of buildingGeoms) g.dispose();
    merged.computeVertexNormals();
    buildingMesh = new THREE.Mesh(
      merged,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.07,
        roughness: 0.82,
        flatShading: false,
        envMapIntensity: 0.35,
        polygonOffset: true,
        polygonOffsetFactor: 2,
        polygonOffsetUnits: 2,
      }),
    );
    buildingMesh.castShadow = true;
    buildingMesh.receiveShadow = true;
  }

  const positions = scatterTreePositions(treeZones, worldSizeMeters, { spacing: 5.25, maxInstances: 4500 });
  let treeInstancedMesh = null;

  if (positions.length && terrainMesh) {
    const trunkGeom = new THREE.CylinderGeometry(0.12, 0.16, 1.1, 6);
    trunkGeom.translate(0, 0.55, 0);
    const crownGeom = new THREE.ConeGeometry(0.85, 1.4, 6);
    crownGeom.translate(0, 2.0, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: "#5c4033", roughness: 0.95 });
    const crownMat = new THREE.MeshStandardMaterial({ color: "#2d6a3e", roughness: 0.92 });

    const trunkInst = new THREE.InstancedMesh(trunkGeom, trunkMat, positions.length);
    const crownInst = new THREE.InstancedMesh(crownGeom, crownMat, positions.length);
    trunkInst.castShadow = true;
    crownInst.castShadow = true;
    trunkInst.receiveShadow = false;
    crownInst.receiveShadow = false;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < positions.length; i += 1) {
      const { x, z } = positions[i];
      const y = getTerrainHeightAt(terrainMesh, x, z) ?? 0;
      const scale = 0.85 + hash01Local(i, 2) * 0.55;
      dummy.position.set(x, y, z);
      dummy.scale.setScalar(scale);
      dummy.rotation.y = hash01Local(i, 3) * Math.PI * 2;
      dummy.updateMatrix();
      trunkInst.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(scale * (0.95 + hash01Local(i, 5) * 0.15));
      dummy.updateMatrix();
      crownInst.setMatrixAt(i, dummy.matrix);
    }
    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    treeInstancedMesh = new THREE.Group();
    treeInstancedMesh.add(trunkInst);
    treeInstancedMesh.add(crownInst);
  }

  return { buildingMesh, treeGroup: treeInstancedMesh };
}

function ringArea2D(ring) {
  let a = 0;
  for (let i = 0; i < ring.length; i += 1) {
    const j = (i + 1) % ring.length;
    a += ring[i].x * ring[j].z - ring[j].x * ring[i].z;
  }
  return a * 0.5;
}

function hash01Local(i, salt) {
  let h = (i * 1597334677 + salt * 3812015801) | 0;
  h = (h ^ (h >>> 15)) * 2246822507;
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
